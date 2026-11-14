-- Removes everything rls-tests.sql created. Safe to run more than once,
-- and safe to run before schema.sql (it simply does nothing if the tables are not there yet).
do $$
begin
  if to_regclass('public.achievements') is not null then
    execute $q$delete from achievements where student_id in (select id from students where lerne_id like 'RLSTEST-%')$q$;
  end if;
  if to_regclass('public.students') is not null then
    execute $q$delete from students where lerne_id like 'RLSTEST-%'$q$;
  end if;
  if to_regclass('public.parents') is not null then
    execute $q$delete from parents where full_name like 'RLS Parent%'$q$;
  end if;
  if to_regclass('public.teacher_assignments') is not null then
    execute $q$delete from teacher_assignments where teacher_id = '00000000-0000-0000-0000-0000000000d1'$q$;
  end if;
  if to_regclass('public.profiles') is not null then
    execute $q$delete from profiles where full_name like 'RLS %'$q$;
  end if;
  if to_regclass('public.schools') is not null then
    execute $q$delete from schools where school_code in ('RLS-A','RLS-B')$q$;
  end if;
  delete from auth.users where email like 'rlstest-%@example.test';
end $$;
