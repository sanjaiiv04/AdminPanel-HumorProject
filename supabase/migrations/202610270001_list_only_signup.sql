-- Remove the Columbia UNI access exception. Keep existing superadmin sign-in
-- eligibility, profile creation, account flags, and existing sessions unchanged.
begin;
do $$
begin
  if to_regprocedure('admin_generation_private.signup_email_allowed(text)') is null
    or to_regprocedure('public.current_user_signup_allowed()') is null then
    raise exception 'Apply signup-access migration 002 first';
  end if;
end;
$$;
create or replace function admin_generation_private.signup_email_allowed(candidate text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    candidate ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and (
      exists (select 1 from public.allowed_signup_domains
        where is_active and domain = lower(split_part(candidate, '@', 2)))
      or exists (select 1 from public.whitelisted_email_addresses
        where is_active and email = lower(candidate))
    ), false);
$$;
revoke all on function admin_generation_private.signup_email_allowed(text) from public, anon, authenticated, service_role;

-- Retain the existing trigger identity; its name is historical.
create or replace function public.enforce_columbia_email()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not admin_generation_private.signup_email_allowed(new.email) then
    raise exception 'Use an email approved by a CapRate administrator';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_columbia_email() from public, anon, authenticated, service_role;
-- current_user_signup_allowed() is deliberately unchanged: it still checks
-- the actual auth user and preserves the protected is_superadmin exception.
notify pgrst, 'reload schema';
commit;
