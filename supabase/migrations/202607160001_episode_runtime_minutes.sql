begin;

alter table public.episode_progress
  add column if not exists runtime_minutes integer
  check (runtime_minutes is null or runtime_minutes between 1 and 600);

commit;
