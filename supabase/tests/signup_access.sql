-- Transactional regression test; apply migration 002 first. No rows persist.
begin;
do $$
declare
  fixture_id uuid := gen_random_uuid();
  fixture_domain text := 'signup-test-' || replace(gen_random_uuid()::text, '-', '') || '.invalid';
  fixture_email text;
  denied boolean := false;
begin
  fixture_email := 'external@' || fixture_domain;
  if not admin_generation_private.signup_email_allowed('AB123@COLUMBIA.EDU')
    or admin_generation_private.signup_email_allowed(null)
    or admin_generation_private.signup_email_allowed('ab123@columbia.edu.evil.invalid') then
    raise exception 'Original UNI/null/suffix behavior failed';
  end if;
  -- A random reserved domain cannot have been intentionally configured already.
  if admin_generation_private.signup_email_allowed(fixture_email) then
    raise exception 'Unlisted account accepted';
  end if;
  begin
    insert into auth.users (id,email) values (fixture_id,fixture_email);
  exception when raise_exception then
    if sqlerrm not like 'Use a Columbia UNI email%' then raise; end if;
    denied := true;
  end;
  if not denied then raise exception 'Signup trigger failed to reject unlisted user'; end if;

  insert into public.allowed_signup_domains(domain,is_active) values(fixture_domain,false);
  if admin_generation_private.signup_email_allowed(fixture_email) then
    raise exception 'Inactive domain accepted';
  end if;
  update public.allowed_signup_domains set is_active=true where domain=fixture_domain;
  if not admin_generation_private.signup_email_allowed(upper(fixture_email))
    or admin_generation_private.signup_email_allowed('external@sub.' || fixture_domain)
    or admin_generation_private.signup_email_allowed('external@@' || fixture_domain)
    or admin_generation_private.signup_email_allowed(' ' || fixture_email) then
    raise exception 'Exact domain or email syntax behavior failed';
  end if;
  insert into auth.users(id,email) values(fixture_id,fixture_email);
  if not exists(select 1 from public.profiles where id=fixture_id and uni is null and is_superadmin=false) then
    raise exception 'Ordinary external profile creation failed';
  end if;
  perform set_config('request.jwt.claim.sub',fixture_id::text,true);
  if not public.current_user_signup_allowed() then raise exception 'Current-user RPC rejected active domain'; end if;
  update public.allowed_signup_domains set is_active=false where domain=fixture_domain;
  if public.current_user_signup_allowed() then raise exception 'Inactive allowance still accepted by RPC'; end if;
  insert into public.whitelisted_email_addresses(email,is_active) values(fixture_email,false);
  if public.current_user_signup_allowed() then raise exception 'Inactive whitelist accepted'; end if;
  update public.whitelisted_email_addresses set is_active=true where email=fixture_email;
  if not public.current_user_signup_allowed()
    or admin_generation_private.signup_email_allowed('other@' || fixture_domain) then
    raise exception 'Exact email whitelist behavior failed';
  end if;
  perform set_config('request.jwt.claim.sub','',true);
  if public.current_user_signup_allowed() then raise exception 'Unauthenticated RPC accepted'; end if;
  if has_function_privilege('anon','public.current_user_signup_allowed()','execute')
    or not has_function_privilege('authenticated','public.current_user_signup_allowed()','execute')
    or has_function_privilege('authenticated','admin_generation_private.signup_email_allowed(text)','execute') then
    raise exception 'Function privilege boundaries failed';
  end if;
end;
$$;
rollback;
select 'Signup access regression checks passed; fixtures rolled back.' as result;
