create table if not exists public.external_api_cache (
  cache_key text primary key,
  service text not null check (service in ('tmdb', 'omdb')),
  payload jsonb not null,
  status_code integer not null default 200,
  expires_at timestamptz not null,
  stale_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists external_api_cache_expiry_idx
  on public.external_api_cache (expires_at);

create table if not exists public.external_api_usage_daily (
  usage_date date not null default current_date,
  service text not null check (service in ('tmdb', 'omdb')),
  request_count integer not null default 0,
  cache_hit_count integer not null default 0,
  stale_hit_count integer not null default 0,
  error_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (usage_date, service)
);

alter table public.external_api_cache enable row level security;
alter table public.external_api_usage_daily enable row level security;

-- No client policies are intentional. Only the Edge Function's service role may
-- read/write the shared cache and counters.

create or replace function public.increment_external_api_usage(
  target_service text,
  request_delta integer default 0,
  cache_hit_delta integer default 0,
  stale_hit_delta integer default 0,
  error_delta integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_service not in ('tmdb', 'omdb') then
    raise exception 'Unsupported external API service';
  end if;

  insert into public.external_api_usage_daily (
    usage_date, service, request_count, cache_hit_count, stale_hit_count, error_count
  ) values (
    current_date, target_service, request_delta, cache_hit_delta, stale_hit_delta, error_delta
  )
  on conflict (usage_date, service) do update set
    request_count = external_api_usage_daily.request_count + excluded.request_count,
    cache_hit_count = external_api_usage_daily.cache_hit_count + excluded.cache_hit_count,
    stale_hit_count = external_api_usage_daily.stale_hit_count + excluded.stale_hit_count,
    error_count = external_api_usage_daily.error_count + excluded.error_count,
    updated_at = now();
end;
$$;

revoke all on function public.increment_external_api_usage(text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.increment_external_api_usage(text, integer, integer, integer, integer) to service_role;

create or replace function public.reserve_external_api_request(
  target_service text,
  daily_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reserved boolean;
begin
  if target_service not in ('tmdb', 'omdb') or daily_limit < 1 then
    raise exception 'Invalid external API reservation';
  end if;

  insert into public.external_api_usage_daily (usage_date, service, request_count)
  values (current_date, target_service, 1)
  on conflict (usage_date, service) do update set
    request_count = external_api_usage_daily.request_count + 1,
    updated_at = now()
  where external_api_usage_daily.request_count < daily_limit
  returning true into reserved;

  return coalesce(reserved, false);
end;
$$;

revoke all on function public.reserve_external_api_request(text, integer) from public, anon, authenticated;
grant execute on function public.reserve_external_api_request(text, integer) to service_role;

create or replace function public.prune_external_api_cache()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.external_api_cache where stale_until < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.prune_external_api_cache() from public, anon, authenticated;
grant execute on function public.prune_external_api_cache() to service_role;
