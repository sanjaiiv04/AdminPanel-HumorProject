-- Additive signup policy. Does not seed domains, change profile creation,
-- promote users, or revoke existing sessions. Apply as postgres.
-- https://supabase.com/docs/guides/database/functions
begin;

-- Refuse to silently replace a different trigger contract.
do $$
begin
  if not exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    join pg_namespace n on n.oid = p.pronamespace
    where t.tgrelid = 'auth.users'::regclass
      and t.tgname = 'enforce_columbia_email_trigger'
      and n.nspname = 'public' and p.proname = 'enforce_columbia_email'
      and t.tgtype = 7 and t.tgenabled = 'O'
  ) then
    raise exception 'Expected BEFORE INSERT signup trigger is missing or changed. Review before applying.';
  end if;
end;
$$;

create function admin_generation_private.signup_email_allowed(candidate text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    lower(candidate) ~ '^[a-z]{2,3}[0-9]{1,4}@columbia\.edu$'
    or (
      candidate ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      and (
        exists (select 1 from public.allowed_signup_domains
          where is_active and domain = lower(split_part(candidate, '@', 2)))
        or exists (select 1 from public.whitelisted_email_addresses
          where is_active and email = lower(candidate))
      )
    ), false);
$$;
revoke all on function admin_generation_private.signup_email_allowed(text) from public, anon, authenticated, service_role;

-- Keep the existing trigger attached, and leave handle_new_user unchanged.
create or replace function public.enforce_columbia_email()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not admin_generation_private.signup_email_allowed(new.email) then
    raise exception 'Use a Columbia UNI email or an email approved by a CapRate administrator';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_columbia_email() from public, anon, authenticated, service_role;

-- No supplied email/user ID: clients can only check their own verified session.
create function public.current_user_signup_allowed()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid())
      and (admin_generation_private.signup_email_allowed(u.email)
        or exists (select 1 from public.profiles p
          where p.id = u.id and p.is_superadmin is true))
  );
$$;
revoke all on function public.current_user_signup_allowed() from public, anon, authenticated, service_role;
grant execute on function public.current_user_signup_allowed() to authenticated;

notify pgrst, 'reload schema';
commit;
