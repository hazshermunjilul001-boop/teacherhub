-- TeacherHub: configurable school-head/principal position label
-- Run once in the Supabase SQL editor before using the Position / Title field.

alter table public.sections
  add column if not exists school_head_title text not null default 'Principal';

update public.sections
set school_head_title = 'Principal'
where school_head_title is null or btrim(school_head_title) = '';
