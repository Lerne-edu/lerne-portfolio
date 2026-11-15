-- Access-rule tests. Run in the Supabase SQL Editor on a TEST project after schema.sql (never on real data).
-- It creates fake people, then checks what each one can and cannot read, and shows one result table.
-- Every row must say PASS. Afterwards run supabase/rls-cleanup.sql to remove the fake data.
-- NOT YET RUN: if the script itself fails, send me the error; it is a test helper, not part of the app.

-- ---------- fake people (ids are fixed so the checks can refer to them) ----------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1','rlstest-admin@example.test','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000000b1','rlstest-schoolA@example.test','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000000b2','rlstest-schoolB@example.test','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000000c1','rlstest-parent1@example.test','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000000c2','rlstest-parent2@example.test','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000000d1','rlstest-teacher@example.test','authenticated','authenticated')
on conflict do nothing;

insert into schools (id, school_code, name, state) values
  ('00000000-0000-0000-0000-00000000aa01','RLS-A','RLS Test School A','Tamil Nadu'),
  ('00000000-0000-0000-0000-00000000aa02','RLS-B','RLS Test School B','Tamil Nadu') on conflict do nothing;
insert into profiles (id, role, full_name, school_id) values
  ('00000000-0000-0000-0000-0000000000a1','lerne_admin','RLS Admin',null),
  ('00000000-0000-0000-0000-0000000000b1','school_admin','RLS Principal A','00000000-0000-0000-0000-00000000aa01'),
  ('00000000-0000-0000-0000-0000000000b2','school_admin','RLS Principal B','00000000-0000-0000-0000-00000000aa02'),
  ('00000000-0000-0000-0000-0000000000c1','parent','RLS Parent 1',null),
  ('00000000-0000-0000-0000-0000000000c2','parent','RLS Parent 2',null),
  ('00000000-0000-0000-0000-0000000000d1','teacher','RLS Teacher','00000000-0000-0000-0000-00000000aa01') on conflict do nothing;

-- Two students at School A (grades 8 and 9), one at School B; each with its own parent
insert into students (id, lerne_id, full_name, dob) values
  ('00000000-0000-0000-0000-00000000e001','RLSTEST-0001','RLS Child One','2013-01-01'),
  ('00000000-0000-0000-0000-00000000e002','RLSTEST-0002','RLS Child Two','2012-01-01'),
  ('00000000-0000-0000-0000-00000000e003','RLSTEST-0003','RLS Child Three','2013-06-01') on conflict do nothing;
insert into parents (id, user_id, full_name) values
  ('00000000-0000-0000-0000-00000000f001','00000000-0000-0000-0000-0000000000c1','RLS Parent 1'),
  ('00000000-0000-0000-0000-00000000f002','00000000-0000-0000-0000-0000000000c2','RLS Parent 2') on conflict do nothing;
insert into student_parents (student_id, parent_id) values
  ('00000000-0000-0000-0000-00000000e001','00000000-0000-0000-0000-00000000f001'),
  ('00000000-0000-0000-0000-00000000e002','00000000-0000-0000-0000-00000000f002'),
  ('00000000-0000-0000-0000-00000000e003','00000000-0000-0000-0000-00000000f002') on conflict do nothing;
insert into enrollments (student_id, school_id, grade, section, academic_year, joined_on) values
  ('00000000-0000-0000-0000-00000000e001','00000000-0000-0000-0000-00000000aa01',8,'A','2026-27','2026-06-01'),
  ('00000000-0000-0000-0000-00000000e002','00000000-0000-0000-0000-00000000aa01',9,'A','2026-27','2026-06-01'),
  ('00000000-0000-0000-0000-00000000e003','00000000-0000-0000-0000-00000000aa02',8,'A','2026-27','2026-06-01');
-- Child Three's parent has NOT consented; the others have
insert into consents (student_id, parent_id, status) values
  ('00000000-0000-0000-0000-00000000e001','00000000-0000-0000-0000-00000000f001','agreed'),
  ('00000000-0000-0000-0000-00000000e002','00000000-0000-0000-0000-00000000f002','agreed'),
  ('00000000-0000-0000-0000-00000000e003','00000000-0000-0000-0000-00000000f002','pending');
insert into teacher_assignments (teacher_id, grade, section) values ('00000000-0000-0000-0000-0000000000d1', 8, 'A');
-- Child One: one verified record, one pending record
insert into achievements (student_id, category, title, level, result, achieved_on, academic_year, source, created_by) values
  ('00000000-0000-0000-0000-00000000e001','challenges','RLS verified record','state','winner','2026-08-01','2026-27','lerne_program',null);
insert into achievements (student_id, category, title, level, result, achieved_on, academic_year, source) values
  ('00000000-0000-0000-0000-00000000e001','external','RLS pending record','school','participation','2026-08-02','2026-27','external');

-- ---------- helper: count the rows a person can see, as that person ----------
create or replace function pg_temp.seen(uid uuid, q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin execute q into n; exception when others then n := -1; end;   -- -1 = the database refused
  execute 'reset role';
  return n;
end $$;

-- ---------- the checks ----------
select check_name, expected, actual, case when expected = actual then 'PASS' else 'FAIL' end as result from (values
  ('Parent 1 sees only their own child',
     1::bigint, pg_temp.seen('00000000-0000-0000-0000-0000000000c1', 'select count(*) from students')),
  ('Parent 1 cannot see another family''s records (Parent 2 student records)',
     0::bigint, pg_temp.seen('00000000-0000-0000-0000-0000000000c1', $q$select count(*) from achievements where student_id = '00000000-0000-0000-0000-00000000e002'$q$)),
  ('Parent 2 sees their two children',
     2::bigint, pg_temp.seen('00000000-0000-0000-0000-0000000000c2', 'select count(*) from students')),
  ('Parent 2 sees no records for the child they have not consented for',
     0::bigint, pg_temp.seen('00000000-0000-0000-0000-0000000000c2', $q$select count(*) from achievements where student_id = '00000000-0000-0000-0000-00000000e003'$q$)),
  ('School A admin sees only School A students (consented only)',
     2::bigint, pg_temp.seen('00000000-0000-0000-0000-0000000000b1', 'select count(*) from students')),
  ('School B admin sees none (its only student has no consent)',
     0::bigint, pg_temp.seen('00000000-0000-0000-0000-0000000000b2', 'select count(*) from students')),
  ('School A admin sees verified records only, never pending ones',
     1::bigint, pg_temp.seen('00000000-0000-0000-0000-0000000000b1', 'select count(*) from achievements')),
  ('Teacher sees only the assigned grade and section (Grade 8 A)',
     1::bigint, pg_temp.seen('00000000-0000-0000-0000-0000000000d1', 'select count(*) from students')),
  ('Parent cannot change a record''s status',
     0::bigint, pg_temp.seen('00000000-0000-0000-0000-0000000000c1', $q$with u as (update achievements set status = 'verified' where title = 'RLS pending record' returning 1) select count(*) from u$q$)),
  ('Parent cannot change a student''s Lerne ID',
     -1::bigint, pg_temp.seen('00000000-0000-0000-0000-0000000000c1', $q$with u as (update students set lerne_id = 'HACKED' returning 1) select count(*) from u$q$)),
  ('Parent cannot read the audit log',
     0::bigint, pg_temp.seen('00000000-0000-0000-0000-0000000000c1', 'select count(*) from audit_log')),
  ('Parent cannot read another school''s teachers or school admins',
     0::bigint, pg_temp.seen('00000000-0000-0000-0000-0000000000c1', $q$select count(*) from profiles where role in ('school_admin','teacher')$q$)),
  ('School admin cannot read the Lerne team''s duplicate flags',
     0::bigint, pg_temp.seen('00000000-0000-0000-0000-0000000000b1', 'select count(*) from duplicate_flags')),
  ('Lerne admin sees all three students',
     3::bigint, pg_temp.seen('00000000-0000-0000-0000-0000000000a1', 'select count(*) from students'))
) as t(check_name, expected, actual);
