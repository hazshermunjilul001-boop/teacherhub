alter table public.grades add column if not exists domain_scores jsonb;
alter table public.grades add column if not exists domain_highest_scores jsonb;
