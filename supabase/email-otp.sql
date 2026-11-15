-- Email-code sign-in for parents (free alternative to SMS OTP).
-- Safe to run more than once, and safe on a database that already has data: it only adds and replaces functions.
-- (schema.sql already contains the same two functions for brand-new projects.)

-- Is this email on a parent record that a school or Lerne has entered? (used before a code is sent)
create or replace function parent_email_registered(p_email text) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from parents where lower(trim(email)) = lower(trim(p_email))) $$;
grant execute on function parent_email_registered(text) to anon, authenticated;

-- After the code is verified, link the logged-in person to their parent record (by mobile OR by confirmed email)
-- and create the parent profile.
create or replace function claim_parent_account() returns integer
language plpgsql security definer set search_path = public as $$
declare v_phone text := regexp_replace(coalesce(auth.jwt()->>'phone',''),'\D','','g');
        v_email text := lower(trim(coalesce(auth.jwt()->>'email','')));
        v_id uuid; v_name text; n int;
begin
  if auth.uid() is null then return 0; end if;
  -- someone who already has a parent record is finished
  if exists (select 1 from parents where user_id = auth.uid()) then return 0; end if;

  if length(v_phone) >= 10 then
    select id, full_name into v_id, v_name from parents
     where user_id is null and right(regexp_replace(coalesce(mobile,''),'\D','','g'),10) = right(v_phone,10)
     order by created_at limit 1;
  elsif v_email <> '' and exists (select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null) then
    -- the email must be confirmed (the code proves the person can read it)
    select id, full_name into v_id, v_name from parents
     where user_id is null and lower(trim(email)) = v_email
     order by created_at limit 1;
  end if;

  if v_id is null then return 0; end if;
  insert into profiles (id, role, full_name) values (auth.uid(), 'parent', v_name) on conflict (id) do nothing;
  update parents set user_id = auth.uid() where id = v_id;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function claim_parent_account() to authenticated;
