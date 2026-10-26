-- REVIEW DRAFT: not applied to Supabase.
-- Run once through the Supabase migration workflow after review, as postgres.
-- Prerequisite: public.profiles has id (UUID) and is_superadmin (boolean),
-- and existing permissions prevent ordinary users from granting themselves admin.
-- Existing profiles, generations, votes, signup triggers and Storage are untouched.
-- API keys remain in server environment variables; never store them in these rows.
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security
-- Reference: https://supabase.com/docs/guides/database/functions

begin;

-- Fail before creating anything if the existing admin contract is incompatible.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'id' and udt_name = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'is_superadmin' and udt_name = 'bool'
  ) then
    raise exception 'Expected public.profiles.id UUID and is_superadmin boolean. Review the schema before applying.';
  end if;
end;
$$;

-- Keep the security-definer helper outside the exposed public API schema.
create schema if not exists admin_generation_private;
revoke all on schema admin_generation_private from public, anon, authenticated;
grant usage on schema admin_generation_private to authenticated, service_role;

create function admin_generation_private.is_superadmin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_superadmin is true
  );
$$;
revoke all on function admin_generation_private.is_superadmin() from public, anon, authenticated;
grant execute on function admin_generation_private.is_superadmin() to authenticated, service_role;

create function admin_generation_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function admin_generation_private.touch_updated_at() from public, anon, authenticated;

create table public.llm_providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9_-]*$'),
  name text not null check (length(btrim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.llm_models (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.llm_providers(id) on delete restrict,
  name text not null check (length(btrim(name)) > 0),
  model_identifier text not null check (length(btrim(model_identifier)) > 0),
  supports_images boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, model_identifier)
);

create table public.prompt_chains (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9_-]*$'),
  name text not null check (length(btrim(name)) > 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prompt_chain_steps (
  id uuid primary key default gen_random_uuid(),
  prompt_chain_id uuid not null references public.prompt_chains(id) on delete cascade,
  llm_model_id uuid not null references public.llm_models(id) on delete restrict,
  position integer not null check (position > 0),
  name text not null check (length(btrim(name)) > 0),
  prompt_template text not null check (length(btrim(prompt_template)) > 0),
  include_image boolean not null default true,
  use_community_examples boolean not null default true,
  use_curated_examples boolean not null default false,
  use_terms boolean not null default false,
  include_user_context boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prompt_chain_id, position)
);
create index prompt_chain_steps_model_idx on public.prompt_chain_steps(llm_model_id);

-- One caption-generation pool. Weights are relative, not percentages:
-- probability = weight / sum(enabled weights for active, executable chains).
-- Application code must reject chains with no steps or inactive models/providers.
create table public.prompt_chain_mix (
  id uuid primary key default gen_random_uuid(),
  prompt_chain_id uuid not null unique references public.prompt_chains(id) on delete cascade,
  weight numeric(12,6) not null default 1 check (weight > 0),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Terms" means vocabulary/context for caption generation, not legal agreements.
create table public.terms (
  id uuid primary key default gen_random_uuid(),
  term text not null check (length(btrim(term)) > 0),
  definition text not null check (length(btrim(definition)) > 0),
  example text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index terms_normalized_term_idx on public.terms(lower(btrim(term)));

-- Metadata only: this creates no bucket and changes no Storage policy.
-- Track existing/new objects when integration is implemented; no automatic backfill.
create table public.images (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references auth.users(id) on delete set null,
  storage_bucket text not null default 'generations' check (length(btrim(storage_bucket)) > 0),
  storage_path text not null check (length(btrim(storage_path)) > 0),
  original_filename text,
  mime_type text not null check (mime_type ~ '^image/[a-zA-Z0-9.+-]+$'),
  size_bytes bigint check (size_bytes >= 0),
  alt_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);
create index images_uploaded_by_idx on public.images(uploaded_by);

create table public.ai_generation_examples (
  id uuid primary key default gen_random_uuid(),
  prompt_chain_id uuid references public.prompt_chains(id) on delete restrict,
  image_id uuid references public.images(id) on delete set null,
  caption text not null check (length(btrim(caption)) > 0),
  context text,
  sentiment text not null default 'positive' check (sentiment in ('positive', 'negative')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.ai_generation_examples.prompt_chain_id is 'NULL means an example available to all chains.';
create index ai_generation_examples_chain_idx on public.ai_generation_examples(prompt_chain_id);
create index ai_generation_examples_image_idx on public.ai_generation_examples(image_id);

create table public.generation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  image_id uuid references public.images(id) on delete set null,
  prompt_chain_id uuid references public.prompt_chains(id) on delete set null,
  user_context text,
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed')),
  -- Preserve chain/step/model configuration used, even after admin edits/deletes.
  configuration_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration_snapshot) = 'object'),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('succeeded', 'failed') or completed_at is not null),
  check (completed_at is null or (started_at is not null and completed_at >= started_at))
);
create index generation_requests_user_created_idx on public.generation_requests(user_id, created_at desc, id);
create index generation_requests_chain_idx on public.generation_requests(prompt_chain_id);
create index generation_requests_image_idx on public.generation_requests(image_id);
create index generation_requests_created_idx on public.generation_requests(created_at desc, id);

-- One response per actual provider call, including retry attempts and failures.
create table public.llm_responses (
  id uuid primary key default gen_random_uuid(),
  generation_request_id uuid not null references public.generation_requests(id) on delete restrict,
  prompt_chain_step_id uuid references public.prompt_chain_steps(id) on delete set null,
  llm_model_id uuid references public.llm_models(id) on delete set null,
  step_position integer not null check (step_position > 0),
  attempt integer not null default 1 check (attempt > 0),
  provider_slug text not null check (length(btrim(provider_slug)) > 0),
  model_identifier text not null check (length(btrim(model_identifier)) > 0),
  prompt_text text not null,
  response_text text,
  status text not null check (status in ('succeeded', 'failed')),
  http_status integer check (http_status between 100 and 599),
  error_message text,
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  latency_ms integer check (latency_ms >= 0),
  -- Only sanitized metadata: exclude API keys, image base64 and auth headers.
  response_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(response_metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (generation_request_id, step_position, attempt),
  check (status <> 'succeeded' or length(btrim(response_text)) > 0 and response_text is not null)
);
create index llm_responses_step_idx on public.llm_responses(prompt_chain_step_id);
create index llm_responses_model_idx on public.llm_responses(llm_model_id);
create index llm_responses_created_idx on public.llm_responses(created_at desc, id);

create table public.allowed_signup_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique check (
    domain = lower(btrim(domain)) and length(domain) <= 253
    and domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whitelisted_email_addresses (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (
    email = lower(btrim(email)) and length(email) <= 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- All new tables deny anonymous access. Configuration is admin-only through
-- authenticated sessions; the future generation server reads it with service_role.
-- Never expose that server credential via NEXT_PUBLIC_* or browser code.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'llm_providers', 'llm_models', 'prompt_chains', 'prompt_chain_steps',
    'prompt_chain_mix', 'terms', 'images', 'ai_generation_examples',
    'allowed_signup_domains', 'whitelisted_email_addresses',
    'generation_requests', 'llm_responses'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);

    if table_name in ('generation_requests', 'llm_responses') then
      -- History is read-only for admin/user sessions. Only trusted server code writes it.
      execute format('grant select on table public.%I to authenticated', table_name);
      execute format('create policy admin_read on public.%I for select to authenticated using ((select admin_generation_private.is_superadmin()))', table_name);
    else
      execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
      execute format('create policy admin_manage on public.%I for all to authenticated using ((select admin_generation_private.is_superadmin())) with check ((select admin_generation_private.is_superadmin()))', table_name);
    end if;

    if table_name <> 'llm_responses' then
      execute format('create trigger touch_updated_at before update on public.%I for each row execute function admin_generation_private.touch_updated_at()', table_name);
    end if;
  end loop;
end;
$$;

create policy owner_read on public.images for select to authenticated
  using (uploaded_by = (select auth.uid()));
create policy owner_read on public.generation_requests for select to authenticated
  using (user_id = (select auth.uid()));
create policy owner_read on public.llm_responses for select to authenticated
  using (exists (
    select 1 from public.generation_requests r
    where r.id = generation_request_id and r.user_id = (select auth.uid())
  ));

-- Seed the exact model identifier/prompt observed in the existing app.
-- This does not verify provider availability or change the current app's behavior.
insert into public.llm_providers (slug, name) values ('google', 'Google Gemini');
insert into public.llm_models (provider_id, name, model_identifier)
  select id, 'Gemini caption model', 'gemini-3.5-flash-lite'
  from public.llm_providers where slug = 'google';
insert into public.prompt_chains (slug, name, description)
  values ('default-caption', 'Default caption', 'Single-step caption prompt copied from the user-facing app.');
insert into public.prompt_chain_steps (prompt_chain_id, llm_model_id, position, name, prompt_template)
  select c.id, m.id, 1, 'Generate caption',
    'Write one short, funny meme-style caption for this image. Keep it under 15 words. Return ONLY the caption text, no quotes, no extra commentary.'
  from public.prompt_chains c
  cross join public.llm_models m
  join public.llm_providers p on p.id = m.provider_id
  where c.slug = 'default-caption' and p.slug = 'google' and m.model_identifier = 'gemini-3.5-flash-lite';
insert into public.prompt_chain_mix (prompt_chain_id, weight)
  select id, 1 from public.prompt_chains where slug = 'default-caption';

-- No signup domain/email seeds: domain-only access would be broader than the
-- current Columbia UNI-format regex. Review the existing signup trigger first.
-- No historical logs/examples/images are fabricated or backfilled.
-- A later migration will link public.generations to generation_requests after
-- its live schema and save flow are confirmed. Keep this migration additive.

commit;
