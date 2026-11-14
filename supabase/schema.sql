-- =====================================================================
-- portfolio@lerne database. Run ONCE on a NEW Supabase project.
-- It starts from a clean slate, so it can be re-run safely while the project is still a test:
-- if the database already holds students it stops with a message instead of deleting anything.
-- (This fixes the error: type "user_role" already exists)
-- =====================================================================
do $$
declare has_rows boolean := false;
begin
  -- The table name must only be looked at when it exists, so the check runs as dynamic SQL.
  -- (A plain "exists (select 1 from public.students)" fails on a brand-new database with: relation "public.students" does not exist)
  if to_regclass('public.students') is not null then
    execute 'select exists (select 1 from public.students limit 1)' into has_rows;
    if has_rows then
      raise exception 'This database already contains student data. schema.sql is for a new project only: do not run it again.';
    end if;
  end if;
end $$;

drop schema if exists public cascade;
create schema public;
create schema if not exists extensions;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

-- Lerne Portfolio: database schema (Supabase / PostgreSQL)
-- Run in Supabase: SQL Editor > New query > paste > Run.
-- Not yet tested against a live database. Run on a fresh free project first.

create extension if not exists pg_trgm with schema extensions;

-- ---------- Types ----------
create type user_role as enum ('lerne_admin','school_admin','teacher','parent','student');
create type verification_status as enum ('verified','pending','needs_more_proof','rejected');
create type record_source as enum ('lerne_program','external');
create type record_category as enum
  ('grand_test','skill_labs','challenges','scientific_journal','publications','innovation_patent_cell','external');
create type achievement_level as enum ('school','district','state','national','international');
create type achievement_result as enum ('participation','selected_published','winner');
create type consent_status as enum ('pending','agreed','declined');

-- ---------- Core tables ----------
create table schools (
  id uuid primary key default gen_random_uuid(),
  school_code text unique not null,            -- e.g. SCH-TN-0001
  name text not null,
  state text not null,
  district text,
  is_partner boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row per login (links to Supabase auth user)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role user_role not null,
  full_name text not null,
  must_change_password boolean not null default false,   -- set for accounts created with a starting password
  school_id uuid references schools(id),       -- for school_admin and teacher
  created_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  lerne_id text unique not null,               -- permanent, e.g. LERNE-2026-00001
  user_id uuid unique references profiles(id), -- optional student login
  full_name text not null,
  name_norm text generated always as (lower(regexp_replace(trim(full_name), '\s+', ' ', 'g'))) stored,
  dob date not null,
  gender text,
  birth_cert_no text,                          -- optional, duplicate check
  pen text,                                    -- optional, duplicate check
  bio text,
  interests text,
  languages text,
  aspiration text,
  goals text,
  outside_school text,                           -- school name for families who signed up on their own
  hidden_at timestamptz,                         -- soft delete: the record is hidden before it is removed for good
  photo_path text,                               -- profile photo in the private 'photos' bucket
  public_profile boolean not null default false,  -- only a parent may turn on
  created_at timestamptz not null default now()
);
create index students_dob_idx on students (dob);
create index students_name_trgm on students using gin (name_norm extensions.gin_trgm_ops);

create table parents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references profiles(id),
  full_name text not null,
  mobile text,
  email text,
  invited_at timestamptz,
  created_at timestamptz not null default now()
);

create table student_parents (
  student_id uuid not null references students(id) on delete cascade,
  parent_id uuid not null references parents(id) on delete cascade,
  relationship text,
  is_primary boolean not null default false,
  primary key (student_id, parent_id)
);

-- School history: one row per school stay
create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  school_id uuid not null references schools(id),
  grade smallint not null check (grade between 1 and 12),
  section text,
  admission_no text,
  academic_year text not null,                 -- e.g. 2026-27
  joined_on date not null default current_date,
  left_on date                                 -- null = current student
);
create index enrollments_school_idx on enrollments (school_id, left_on);

create table consents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  parent_id uuid not null references parents(id),
  status consent_status not null default 'pending',
  policy_version text,
  decided_at timestamptz,
  identity_confirmed_at timestamptz     -- when the parent confirmed "Is this your child?"
);

create table skill_areas (
  code text primary key,
  name text not null
);
insert into skill_areas (code, name) values
  ('research_science','Research & Science'),
  ('writing_comm','Writing & Communication'),
  ('innovation','Innovation & Problem-solving'),
  ('maths_logic','Maths & Logic'),
  ('academics','Academics (Science, English, Social Studies)'),
  ('creativity_arts','Creativity & Arts'),
  ('leadership','Leadership & Teamwork'),
  ('sports','Sports & Fitness');

-- Every record: Lerne program result or external achievement
create table achievements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  category record_category not null,
  external_type text,                          -- publication, record title, sports, arts...
  title text not null,
  level achievement_level not null,
  result achievement_result not null,
  achieved_on date not null,
  academic_year text not null,
  organiser text,
  description text,
  proof_url text,
  proof_path text,                             -- uploaded certificate (private storage)
  proof_ref text,                              -- DOI / ISBN / record number
  subject_scores jsonb,                        -- Grand Test marks per subject
  source record_source not null,
  status verification_status not null default 'pending',
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  review_note text,
  is_public boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index achievements_student_idx on achievements (student_id, achieved_on);
create index achievements_queue_idx on achievements (status) where status = 'pending';

create table achievement_skills (
  achievement_id uuid references achievements(id) on delete cascade,
  skill_code text references skill_areas(code),
  primary key (achievement_id, skill_code)
);

-- Near-matches found by the duplicate check, for the Lerne team to review
create table duplicate_flags (
  id uuid primary key default gen_random_uuid(),
  candidate_student_id uuid references students(id) on delete set null,
  submitted jsonb not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  table_name text,
  row_id text,
  at timestamptz not null default now()
);

-- ---------- Records from Lerne programs are verified automatically ----------
create function set_initial_status() returns trigger language plpgsql as $$
begin
  if new.source = 'lerne_program' then
    new.status := 'verified';
    new.verified_at := now();
  else
    new.status := 'pending';
    new.verified_by := null;
    new.verified_at := null;
  end if;
  return new;
end $$;
create trigger achievements_initial_status before insert on achievements
  for each row execute function set_initial_status();

-- ---------- Lerne ID: LERNE + year + 5-digit running number ----------
create table id_counters (year int primary key, last_number int not null);

create function next_lerne_id() returns text language plpgsql as $$
declare y int := extract(year from now())::int; n int;
begin
  insert into id_counters (year, last_number) values (y, 1)
  on conflict (year) do update set last_number = id_counters.last_number + 1
  returning last_number into n;
  return 'LERNE-' || y || '-' || lpad(n::text, 5, '0');
end $$;

-- ---------- Duplicate check, then create or link ----------
-- Returns {status: 'linked'|'created'|'review', lerne_id, student_id}
create function create_or_link_student(
  p_name text, p_dob date, p_parent_name text,
  p_birth_cert text default null, p_pen text default null, p_force boolean default false
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_norm text := lower(regexp_replace(trim(p_name), '\s+', ' ', 'g'));
  v_parent text := lower(regexp_replace(trim(p_parent_name), '\s+', ' ', 'g'));
  v_id uuid; v_lerne text; v_flag uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' and auth_role() is distinct from 'lerne_admin' then
    raise exception 'not allowed';
  end if;
  if not p_force then
  -- 1. Strong match: birth certificate or PEN, if given
  select s.id into v_id from students s
  where (p_birth_cert is not null and s.birth_cert_no = p_birth_cert)
     or (p_pen is not null and s.pen = p_pen) limit 1;

  -- 2. Exact match: name + date of birth + one parent's name
  if v_id is null then
    select s.id into v_id from students s
      join student_parents sp on sp.student_id = s.id
      join parents p on p.id = sp.parent_id
    where s.name_norm = v_norm and s.dob = p_dob
      and lower(regexp_replace(trim(p.full_name), '\s+', ' ', 'g')) = v_parent
    limit 1;
  end if;

  if v_id is not null then
    select lerne_id into v_lerne from students where id = v_id;
    return jsonb_build_object('status','linked','lerne_id',v_lerne,'student_id',v_id);
  end if;

  -- 3. Near match: same date of birth, similar name -> flag for manual check
  select s.id into v_id from students s
  where s.dob = p_dob and similarity(s.name_norm, v_norm) > 0.6
  order by similarity(s.name_norm, v_norm) desc limit 1;

  if v_id is not null then
    insert into duplicate_flags (candidate_student_id, submitted)
    values (v_id, jsonb_build_object('name',p_name,'dob',p_dob,'parent',p_parent_name)) returning id into v_flag;
    return jsonb_build_object('status','review','candidate_student_id',v_id,'flag_id',v_flag);
  end if;

  end if;

  -- 4. New student
  insert into students (lerne_id, full_name, dob, birth_cert_no, pen)
  values (next_lerne_id(), p_name, p_dob, p_birth_cert, p_pen)
  returning id, lerne_id into v_id, v_lerne;
  return jsonb_build_object('status','created','lerne_id',v_lerne,'student_id',v_id);
end $$;
revoke all on function create_or_link_student(text,date,text,text,text,boolean) from public;
grant execute on function create_or_link_student(text,date,text,text,text,boolean) to authenticated, service_role;
-- The function itself rejects everyone except Lerne admins and the server (service) key.

-- ---------- Access rules (row level security) ----------
create function auth_role() returns user_role language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

create function my_school_id() returns uuid language sql stable security definer set search_path = public as
$$ select school_id from profiles where id = auth.uid() $$;

-- True once the student is 18 or has finished Grade 12 (control passes from the parent to the student)
create function student_is_independent(sid uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from students s where s.id = sid and (
     s.dob <= current_date - interval '18 years'
     or exists (select 1 from enrollments e where e.student_id = s.id and e.grade = 12 and e.left_on is not null))) $$;

create function is_my_child(sid uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from student_parents sp join parents p on p.id = sp.parent_id
                  where sp.student_id = sid and p.user_id = auth.uid())
   -- parental control ends at 18 once the student has their own login
   and not exists (select 1 from students s where s.id = sid and s.user_id is not null and student_is_independent(sid)) $$;

-- Parent, or the student themself once they are 18 or older
create function can_control(sid uuid) returns boolean language sql stable security definer set search_path = public as
$$ select is_my_child(sid) or (exists (select 1 from students s where s.id = sid and s.user_id = auth.uid()) and student_is_independent(sid)) $$;
grant execute on function can_control(uuid) to authenticated;

-- Used inside access rules instead of inline subqueries on students: reading students from a rule on
-- enrollments (and the reverse) would make the rules call each other forever ("infinite recursion").
create function is_own_student(sid uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from students s where s.id = sid and s.user_id = auth.uid()) $$;
create function is_own_adult_student(sid uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from students s where s.id = sid and s.user_id = auth.uid()) and student_is_independent(sid) $$;
grant execute on function is_own_student(uuid), is_own_adult_student(uuid) to authenticated;

-- Individual plan: students outside partner schools keep viewing for free but need a plan to add records
create table individual_plans (
  student_id uuid primary key references students(id) on delete cascade,
  active_until date not null
);
create table plan_payments (
  payment_id text primary key,
  student_id uuid references students(id) on delete set null,   -- payment kept for accounts when a student is deleted
  amount_paise int,
  kind text not null default 'plan',   -- plan, mentor or item
  user_id uuid,                        -- who paid (items)
  item_id uuid,                        -- which store item
  created_at timestamptz not null default now()
);
create function can_add_records(sid uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from enrollments e join schools sc on sc.id = e.school_id
                  where e.student_id = sid and e.left_on is null and sc.is_partner)
       or exists (select 1 from individual_plans p where p.student_id = sid and p.active_until >= current_date) $$;
grant execute on function can_add_records(uuid) to authenticated;

create function consent_given(sid uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from consents c where c.student_id = sid and c.status = 'agreed') $$;

-- A new school needs its own parent agreement once a student has been at another school
create table school_consents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  school_id uuid not null references schools(id),
  status consent_status not null default 'pending',
  decided_at timestamptz,
  unique (student_id, school_id)
);
create function school_access_ok(sid uuid, sch uuid) returns boolean language sql stable security definer set search_path = public as
$$ select consent_given(sid) and (
     not exists (select 1 from enrollments e where e.student_id = sid and e.school_id <> sch)
     or exists (select 1 from school_consents c where c.student_id = sid and c.school_id = sch and c.status = 'agreed')) $$;

alter table schools enable row level security;
alter table profiles enable row level security;
alter table students enable row level security;
alter table parents enable row level security;
alter table student_parents enable row level security;
alter table enrollments enable row level security;
alter table consents enable row level security;
alter table achievements enable row level security;
alter table achievement_skills enable row level security;
alter table duplicate_flags enable row level security;
alter table audit_log enable row level security;
alter table skill_areas enable row level security;
alter table id_counters enable row level security;

create policy skills_read on skill_areas for select using (true);

-- Lerne admin: everything
create policy admin_all_schools on schools for all using (auth_role() = 'lerne_admin');
create policy admin_all_profiles on profiles for all using (auth_role() = 'lerne_admin');
create policy admin_all_students on students for all using (auth_role() = 'lerne_admin');
create policy admin_all_parents on parents for all using (auth_role() = 'lerne_admin');
create policy admin_all_sp on student_parents for all using (auth_role() = 'lerne_admin');
create policy admin_all_enroll on enrollments for all using (auth_role() = 'lerne_admin');
create policy admin_all_consents on consents for all using (auth_role() = 'lerne_admin');
create policy admin_all_ach on achievements for all using (auth_role() = 'lerne_admin');
create policy admin_all_achskills on achievement_skills for all using (auth_role() = 'lerne_admin');
create policy admin_all_flags on duplicate_flags for all using (auth_role() = 'lerne_admin');
create policy admin_read_audit on audit_log for select using (auth_role() = 'lerne_admin');

-- Everyone can read their own profile; school admins read their own school
create policy own_profile on profiles for select using (id = auth.uid());
create policy own_school on schools for select using (id = my_school_id());

-- Parents: their own record and their children
create policy parent_self on parents for select using (user_id = auth.uid());
create policy parent_links on student_parents for select using (is_my_child(student_id));
create policy parent_children on students for select using (is_my_child(id));
create policy parent_children_edit on students for update using (is_my_child(id));
create policy parent_enrollments on enrollments for select using (is_my_child(student_id));
create policy parent_consent_view on consents for select using (is_my_child(student_id));
create policy parent_consent_decide on consents for update using (is_my_child(student_id));
create policy parent_view_ach on achievements for select using (is_my_child(student_id) and consent_given(student_id));
create policy parent_add_external on achievements for insert
  with check (is_my_child(student_id) and consent_given(student_id) and can_add_records(student_id) and source = 'external');

-- Students: their own record
create policy student_self on students for select using (user_id = auth.uid());
create policy student_enrollments on enrollments for select using (
  is_own_student(student_id));
create policy student_view_ach on achievements for select using (
  is_own_student(student_id)
  and consent_given(student_id));
create policy student_add_external on achievements for insert with check (
  is_own_student(student_id)
  and consent_given(student_id) and can_add_records(student_id) and source = 'external');

-- School admin: current students only; verified records only; only the years at that school; consent required
create policy school_enrollments on enrollments for select using (
  auth_role() = 'school_admin' and school_id = my_school_id());
create policy school_students on students for select using (
  auth_role() = 'school_admin' and school_access_ok(id, my_school_id()) and exists (
    select 1 from enrollments e where e.student_id = students.id
      and e.school_id = my_school_id() and e.left_on is null));
create policy school_view_ach on achievements for select using (
  auth_role() = 'school_admin' and status = 'verified' and school_access_ok(student_id, my_school_id()) and exists (
    select 1 from enrollments e where e.student_id = achievements.student_id
      and e.school_id = my_school_id()
      and achievements.achieved_on >= e.joined_on
      and achievements.achieved_on <= coalesce(e.left_on, 'infinity'::date)));

-- Parents and students have no UPDATE policy on achievements, so only the
-- Lerne team can change status or verify.

-- Column-level update rules: families may only edit profile text, never IDs or links.
-- (Lerne admins make other changes with the server key.)
revoke update on students from authenticated;
grant update (bio, interests, languages, aspiration, goals, public_profile, birth_cert_no, pen) on students to authenticated;
revoke update on consents from authenticated;
grant update (status, decided_at, identity_confirmed_at) on consents to authenticated;

-- ---------- Parent sign-in by mobile OTP ----------
-- The school's student list is the whitelist: a number must already be saved on a parent.
create function parent_phone_registered(p_phone text) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from parents
   where right(regexp_replace(coalesce(mobile,''),'\D','','g'),10) = right(regexp_replace(p_phone,'\D','','g'),10)) $$;
grant execute on function parent_phone_registered(text) to anon, authenticated;

-- After OTP, link the logged-in phone to its parent record and create the parent profile.
create function claim_parent_account() returns integer
language plpgsql security definer set search_path = public as $$
declare v_phone text := regexp_replace(coalesce(auth.jwt()->>'phone',''),'\D','','g');
        v_id uuid; v_name text; n int;
begin
  if auth.uid() is null or length(v_phone) < 10 then return 0; end if;
  select id, full_name into v_id, v_name from parents
   where user_id is null and right(regexp_replace(coalesce(mobile,''),'\D','','g'),10) = right(v_phone,10)
   order by created_at limit 1;
  if v_id is null then return 0; end if;
  insert into profiles (id, role, full_name) values (auth.uid(), 'parent', v_name) on conflict (id) do nothing;
  update parents set user_id = auth.uid() where id = v_id;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function claim_parent_account() to authenticated;

-- ---------- Bulk results upload: stop the same result being added twice ----------
create unique index if not exists achievements_dedupe
  on achievements (student_id, category, title, achieved_on);

-- ---------- Strengths page: families can read the skill tags of records they can see ----------
create policy view_skills on achievement_skills for select
  using (exists (select 1 from achievements a where a.id = achievement_id));

-- ---------- PDFs: families can read the name of the school their child is enrolled at ----------
-- (enrollment rules already limit which rows each person can see)
create policy family_schools on schools for select
  using (exists (select 1 from enrollments e where e.school_id = schools.id));

-- =====================================================================
-- School change, public profile, Getprofily link
-- =====================================================================
create type school_change_kind as enum ('same','changed','discontinued');
create table school_change_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  reported_by uuid references profiles(id),
  kind school_change_kind not null,
  new_school_name text,
  new_city text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table school_change_reports enable row level security;
create policy admin_all_moves on school_change_reports for all using (auth_role() = 'lerne_admin');
create policy parent_report_move on school_change_reports for insert
  with check (is_my_child(student_id) and reported_by = auth.uid());
create policy parent_view_moves on school_change_reports for select using (is_my_child(student_id));

-- Public profile (opt-in): a visitor needs the school and the exact Lerne ID
create function public_schools() returns table (school_code text, name text, state text)
language sql stable security definer set search_path = public as
$$ select school_code, name, state from schools where is_partner order by state, name $$;
grant execute on function public_schools() to anon, authenticated;

create function public_profile(p_school_code text, p_lerne_id text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s students%rowtype; sch schools%rowtype;
begin
  select * into sch from schools where school_code = p_school_code;
  select st.* into s from students st
   where st.lerne_id = upper(trim(p_lerne_id)) and st.public_profile and consent_given(st.id)
     and exists (select 1 from enrollments e where e.student_id = st.id and e.school_id = sch.id);
  if s.id is null then return null; end if;
  return jsonb_build_object(
    'name', s.full_name, 'lerne_id', s.lerne_id, 'school', sch.name, 'state', sch.state,
    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object('title', a.title, 'category', a.category, 'level', a.level,
             'result', a.result, 'date', a.achieved_on, 'organiser', a.organiser) order by a.achieved_on desc)
      from achievements a where a.student_id = s.id and a.status = 'verified' and a.is_public), '[]'::jsonb));
end $$;
grant execute on function public_profile(text, text) to anon, authenticated;

-- A parent chooses which verified records appear on the public profile
create function set_record_public(p_id uuid, p_public boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from achievements a where a.id = p_id and a.status = 'verified' and can_control(a.student_id)) then
    raise exception 'not allowed';
  end if;
  update achievements set is_public = p_public where id = p_id;
end $$;
grant execute on function set_record_public(uuid, boolean) to authenticated;

-- Getprofily link: the student (18 or older) creates a code; the code is shown once and only its hash is stored
create table getprofily_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table getprofily_links enable row level security;  -- no policies: functions and the server key only

create function create_getprofily_link() returns text
language plpgsql security definer set search_path = public as $$
declare s students%rowtype; t text;
begin
  select * into s from students where user_id = auth.uid();
  if s.id is null then raise exception 'students only'; end if;
  if not getprofily_eligible() then raise exception 'available after Grade 12 or from age 18'; end if;
  update getprofily_links set revoked_at = now() where student_id = s.id and revoked_at is null;
  t := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into getprofily_links (student_id, token_hash) values (s.id, sha256(convert_to(t, 'utf8')));
  return t;
end $$;
grant execute on function create_getprofily_link() to authenticated;

create function revoke_getprofily_link() returns void
language sql security definer set search_path = public as
$$ update getprofily_links set revoked_at = now()
   where revoked_at is null and student_id = (select id from students where user_id = auth.uid()) $$;
grant execute on function revoke_getprofily_link() to authenticated;

-- =====================================================================
-- Audit log: who viewed, exported or changed what (readable by Lerne admins only)
-- =====================================================================
create function log_audit(p_action text, p_table text default null, p_row text default null) returns void
language sql security definer set search_path = public as
$$ insert into audit_log (actor, action, table_name, row_id) values (auth.uid(), p_action, p_table, p_row) $$;
grant execute on function log_audit(text, text, text) to authenticated;

-- =====================================================================
-- Notifications (in-app). Rows are created by the server with the service key.
-- =====================================================================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);
alter table notifications enable row level security;
create policy own_notifications_read on notifications for select using (user_id = auth.uid());
create policy own_notifications_update on notifications for update using (user_id = auth.uid());
revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;

-- =====================================================================
-- Must-haves: proof uploads, student profile edits, data requests
-- =====================================================================
-- Private bucket for proof files; only the server (service key) reads or writes it
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', false) on conflict (id) do nothing;

-- Students may edit their own profile text; only a parent may change public visibility
create policy student_self_edit on students for update using (user_id = auth.uid());
create function guard_public_profile() returns trigger language plpgsql as $$
begin
  if new.public_profile is distinct from old.public_profile
     and coalesce(auth.role(), '') <> 'service_role' and not can_control(new.id) then
    raise exception 'only a parent can change public visibility';
  end if;
  return new;
end $$;
create trigger students_guard_public before update on students
  for each row execute function guard_public_profile();

-- Parents ask to correct or delete their child's data; the Lerne team handles these
create table data_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  requested_by uuid references profiles(id),
  kind text not null check (kind in ('correction','deletion','other')),
  note text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table data_requests enable row level security;
create policy admin_all_requests on data_requests for all using (auth_role() = 'lerne_admin');
create policy parent_request_insert on data_requests for insert
  with check (can_control(student_id) and requested_by = auth.uid());
create policy parent_request_view on data_requests for select using (is_my_child(student_id));

-- =====================================================================
-- QR verification, yearly confirmation and inactivity flags
-- =====================================================================
-- Anyone holding a certificate's QR can confirm the record is real (the record id is unguessable)
create function verify_record(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', s.full_name, 'lerne_id', s.lerne_id, 'title', a.title, 'category', a.category,
         'level', a.level, 'result', a.result, 'date', a.achieved_on, 'organiser', a.organiser, 'verified_at', a.verified_at)
  from achievements a join students s on s.id = a.student_id
  where a.id = p_id and a.status = 'verified' and consent_given(s.id)
$$;
grant execute on function verify_record(uuid) to anon, authenticated;

create table inactivity_flags (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table inactivity_flags enable row level security;
create policy admin_all_inactivity on inactivity_flags for all using (auth_role() = 'lerne_admin');

-- Current students with consent, no new records and no parent login for p_months, not already flagged
create function inactive_students(p_months int default 6) returns table (student_id uuid)
language sql stable security definer set search_path = public as $$
  select s.id from students s
  where exists (select 1 from enrollments e where e.student_id = s.id and e.left_on is null
                and e.joined_on < current_date - make_interval(months => p_months))
    and consent_given(s.id)
    and not exists (select 1 from achievements a where a.student_id = s.id and a.created_at > now() - make_interval(months => p_months))
    and not exists (select 1 from student_parents sp join parents p on p.id = sp.parent_id join auth.users u on u.id = p.user_id
                    where sp.student_id = s.id and u.last_sign_in_at > now() - make_interval(months => p_months))
    and not exists (select 1 from inactivity_flags f where f.student_id = s.id and not f.resolved)
$$;
revoke all on function inactive_students(int) from public, anon, authenticated;

-- =====================================================================
-- Per-school consent, adult students, teachers and endorsements, AI summaries, plan access
-- =====================================================================
alter table school_consents enable row level security;
alter table individual_plans enable row level security;
alter table plan_payments enable row level security;
create policy admin_all_school_consents on school_consents for all using (auth_role() = 'lerne_admin');
create policy family_school_consents_view on school_consents for select using (can_control(student_id));
create policy family_school_consents_decide on school_consents for update using (can_control(student_id));
revoke update on school_consents from authenticated;
grant update (status, decided_at) on school_consents to authenticated;
create policy admin_all_plans on individual_plans for all using (auth_role() = 'lerne_admin');
create policy family_view_plan on individual_plans for select using (
  can_control(student_id) or is_own_student(student_id));
create policy admin_read_payments on plan_payments for select using (auth_role() = 'lerne_admin');

-- When a student who already has another school enrolls at a new one: earlier schools keep access,
-- the new school waits for the parent's agreement
create function on_enrollment_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from enrollments e where e.student_id = new.student_id and e.school_id <> new.school_id) then
    insert into school_consents (student_id, school_id, status)
      select distinct new.student_id, e.school_id, 'agreed'::consent_status from enrollments e
      where e.student_id = new.student_id and e.school_id <> new.school_id
      on conflict (student_id, school_id) do nothing;
    insert into school_consents (student_id, school_id, status) values (new.student_id, new.school_id, 'pending'::consent_status)
      on conflict (student_id, school_id) do nothing;
  end if;
  return new;
end $$;
create trigger enrollments_school_consent after insert on enrollments
  for each row execute function on_enrollment_insert();

-- Adult students take over consent decisions
create policy student_consent_view on consents for select using (
  is_own_adult_student(student_id));
create policy student_consent_decide on consents for update using (
  is_own_adult_student(student_id));

-- Teachers: read-only access to assigned grades/sections, plus endorsements
create table teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  grade smallint not null check (grade between 1 and 12),
  section text
);
create unique index teacher_assignments_uniq on teacher_assignments (teacher_id, grade, coalesce(section, ''));
create function teacher_can_see(sid uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from enrollments e join teacher_assignments t on t.teacher_id = auth.uid()
                  where e.student_id = sid and e.left_on is null and e.school_id = my_school_id()
                    and e.grade = t.grade and (t.section is null or t.section = e.section)) $$;
alter table teacher_assignments enable row level security;
create policy admin_all_assignments on teacher_assignments for all using (auth_role() = 'lerne_admin');
create policy teacher_own_assignments on teacher_assignments for select using (teacher_id = auth.uid());
create policy school_admin_assignments on teacher_assignments for select using (
  auth_role() = 'school_admin' and exists (select 1 from profiles p where p.id = teacher_id and p.school_id = my_school_id()));
create policy school_admin_teachers on profiles for select using (
  auth_role() = 'school_admin' and role = 'teacher' and school_id = my_school_id());
create policy teacher_students on students for select using (
  auth_role() = 'teacher' and teacher_can_see(id) and school_access_ok(id, my_school_id()));
create policy teacher_enrollments on enrollments for select using (auth_role() = 'teacher' and teacher_can_see(student_id));
create policy teacher_view_ach on achievements for select using (
  auth_role() = 'teacher' and status = 'verified' and teacher_can_see(student_id) and school_access_ok(student_id, my_school_id()));

create table endorsements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  teacher_id uuid not null references profiles(id),
  teacher_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);
alter table endorsements enable row level security;
create policy admin_all_endorsements on endorsements for all using (auth_role() = 'lerne_admin');
create policy teacher_endorse on endorsements for insert with check (
  auth_role() = 'teacher' and teacher_id = auth.uid() and teacher_can_see(student_id));
create policy teacher_read_endorsements on endorsements for select using (auth_role() = 'teacher' and teacher_can_see(student_id));
create policy family_read_endorsements on endorsements for select using (
  can_control(student_id) or is_own_student(student_id));
create policy school_read_endorsements on endorsements for select using (
  auth_role() = 'school_admin' and exists (select 1 from enrollments e where e.student_id = endorsements.student_id
    and e.school_id = my_school_id() and e.left_on is null));

-- AI-written summaries: a draft is reviewed and approved by the Lerne team before families see it
create table ai_summaries (
  student_id uuid not null references students(id) on delete cascade,
  academic_year text not null,
  text text not null,
  approved boolean not null default false,
  primary key (student_id, academic_year)
);
alter table ai_summaries enable row level security;
create policy admin_all_ai on ai_summaries for all using (auth_role() = 'lerne_admin');
create policy family_read_ai on ai_summaries for select using (
  approved and (can_control(student_id) or is_own_student(student_id)));

-- =====================================================================
-- Batch 1: resubmit or delete pending entries, birthday notices
-- =====================================================================
create function owns_record(sid uuid) returns boolean language sql stable security definer set search_path = public as
$$ select is_my_child(sid) or exists (select 1 from students s where s.id = sid and s.user_id = auth.uid()) $$;

-- A family adds proof to an entry the team sent back (or edits a pending one); it returns to the queue
create function resubmit_achievement(p_id uuid, p_description text, p_proof_url text, p_proof_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from achievements a where a.id = p_id and a.source = 'external'
                 and a.status in ('pending','needs_more_proof') and owns_record(a.student_id) and consent_given(a.student_id)) then
    raise exception 'not allowed';
  end if;
  update achievements set description = nullif(p_description, ''), proof_url = nullif(p_proof_url, ''),
         proof_path = coalesce(p_proof_path, proof_path), status = 'pending', review_note = null,
         verified_by = null, verified_at = null
   where id = p_id;
end $$;
grant execute on function resubmit_achievement(uuid, text, text, text) to authenticated;

create function delete_achievement(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from achievements a where a.id = p_id and a.source = 'external'
                 and a.status in ('pending','needs_more_proof','rejected') and owns_record(a.student_id)) then
    raise exception 'not allowed';
  end if;
  delete from achievements where id = p_id;
end $$;
grant execute on function delete_achievement(uuid) to authenticated;

create function students_turning_18(p_offset_days int) returns table (student_id uuid)
language sql stable security definer set search_path = public as
$$ select id from students where (dob + interval '18 years')::date = current_date + p_offset_days $$;
revoke all on function students_turning_18(int) from public, anon, authenticated;

-- =====================================================================
-- Batch 2: rate limiting for logins and OTP requests
-- =====================================================================
create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
alter table rate_limits enable row level security;  -- no policies: only the function below touches it

-- Returns false once p_key has been used more than p_limit times in the current window
create function rate_limit_hit(p_key text, p_limit int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds); n int;
begin
  insert into rate_limits (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1
  returning hits into n;
  return n <= p_limit;
end $$;
grant execute on function rate_limit_hit(text, int, int) to anon, authenticated;

-- =====================================================================
-- Gaps closed from the plan: photos, linking to Getprofily after Grade 12
-- =====================================================================
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;

-- A student can link to Getprofily after Grade 12 (graduated) or from age 18
create function getprofily_eligible() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from students s where s.user_id = auth.uid() and student_is_independent(s.id)) $$;
grant execute on function getprofily_eligible() to authenticated;

-- =====================================================================
-- Per-item store (journals, magazines, books) and paid mentor sessions
-- =====================================================================
insert into storage.buckets (id, name, public) values ('store', 'store', false) on conflict (id) do nothing;

create table store_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null check (kind in ('journal','magazine','book')),
  description text,
  price_inr int not null check (price_inr > 0),
  access_url text,      -- link to the content (only the server reads this)
  file_path text,       -- or an uploaded PDF in the private 'store' bucket
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table store_items enable row level security;
create policy admin_all_items on store_items for all using (auth_role() = 'lerne_admin');
create policy view_active_items on store_items for select using (active);
-- Signed-in users may see the catalogue, but never the access link or file
revoke select on store_items from authenticated, anon;
grant select (id, title, kind, description, price_inr, active, created_at) on store_items to authenticated;

create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  item_id uuid not null references store_items(id),
  payment_id text unique,
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);
alter table purchases enable row level security;
create policy admin_all_purchases on purchases for all using (auth_role() = 'lerne_admin');
create policy own_purchases on purchases for select using (user_id = auth.uid());

create table mentor_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  payment_id text unique,
  status text not null default 'paid' check (status in ('paid','scheduled','done')),
  scheduled_for text,
  created_at timestamptz not null default now()
);
alter table mentor_sessions enable row level security;
create policy admin_all_mentor on mentor_sessions for all using (auth_role() = 'lerne_admin');
create policy family_view_mentor on mentor_sessions for select using (can_control(student_id));

-- =====================================================================
-- Individual sign-up, public check by Lerne ID, soft delete
-- =====================================================================
-- A family signing up on their own (child not at a partner school). The account is completed on first sign-in.
create table pending_signups (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table pending_signups enable row level security;   -- no policies: the server key only

-- "Verify a record" by Lerne ID: verified achievements the parent chose to make public; no name, school or contact details
create function public_by_lerne_id(p_lerne_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when s.id is null then null else jsonb_build_object(
    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object('title', a.title, 'category', a.category, 'level', a.level,
             'result', a.result, 'date', a.achieved_on, 'organiser', a.organiser) order by a.achieved_on desc)
      from achievements a where a.student_id = s.id and a.status = 'verified' and a.is_public), '[]'::jsonb)) end
  from (select 1) x left join students s on s.lerne_id = upper(trim(p_lerne_id)) and s.public_profile
       and s.hidden_at is null and consent_given(s.id)
$$;
grant execute on function public_by_lerne_id(text) to anon, authenticated;

-- A hidden (soft-deleted) record cannot be switched back on by the family
create function block_hidden_consent() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'agreed' and coalesce(auth.role(), '') <> 'service_role'
     and exists (select 1 from students s where s.id = new.student_id and s.hidden_at is not null) then
    raise exception 'this record is hidden';
  end if;
  return new;
end $$;
create trigger consents_block_hidden before update on consents
  for each row execute function block_hidden_consent();

-- Make the API see the new tables right away
notify pgrst, 'reload schema';
