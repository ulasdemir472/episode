begin;

create table public.observability_daily (
  usage_date date not null default current_date,
  metric text not null,
  provider text not null default 'none',
  source text not null,
  result text not null default 'none',
  value bigint not null default 0 check (value >= 0),
  primary key (usage_date, metric, provider, source, result)
);
create table public.observability_jobs (
  job text primary key,
  completed_at timestamptz not null,
  succeeded_at timestamptz,
  success boolean not null,
  scan_errors integer not null
);
create table public.analytics_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false
);
create table public.analytics_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  received_at timestamptz not null default now(),
  primary key(user_id, event_id)
);
create index analytics_receipts_received on public.analytics_receipts(received_at);
create table public.analytics_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  last_seen_at timestamptz not null,
  foreground_seconds integer not null default 0,
  events jsonb not null default '{}'::jsonb,
  primary key(user_id, activity_date)
);
create index analytics_daily_date on public.analytics_daily(activity_date);
create table public.analytics_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  started_at timestamptz not null,
  platform text not null check (platform in ('ios','android','web')),
  primary key(user_id, session_id)
);
create index analytics_sessions_started on public.analytics_sessions(started_at);

alter table public.observability_daily enable row level security;
alter table public.observability_jobs enable row level security;
alter table public.analytics_preferences enable row level security;
alter table public.analytics_receipts enable row level security;
alter table public.analytics_daily enable row level security;
alter table public.analytics_sessions enable row level security;
revoke all on public.observability_daily, public.observability_jobs, public.analytics_preferences, public.analytics_receipts, public.analytics_daily, public.analytics_sessions from public, anon, authenticated;
grant all on public.observability_daily, public.observability_jobs, public.analytics_preferences, public.analytics_receipts, public.analytics_daily, public.analytics_sessions to service_role;

alter table public.notification_deliveries add column enqueued_at timestamptz;
-- Existing deliveries have no exact enqueue timestamp. Notification creation is
-- the documented approximation for these rows; new deliveries use their own time.
update public.notification_deliveries d set enqueued_at = n.created_at from public.notifications n where n.id = d.notification_id;
alter table public.notification_deliveries alter column enqueued_at set default now();
alter table public.notification_deliveries alter column enqueued_at set not null;

create function public.record_observability(observations jsonb, job_result jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
declare item jsonb; amount integer;
begin
  if jsonb_typeof(observations) <> 'array' or jsonb_array_length(observations) > 64 then raise exception 'Invalid observation batch'; end if;
  for item in select * from jsonb_array_elements(observations) loop
    amount := (item->>'value')::integer;
    if item->>'metric' not in ('catalog_requests','catalog_errors','provider_attempts','provider_errors','cache_response')
      or item->>'provider' not in ('none','tmdb','omdb','expo')
      or item->>'source' not in ('catalog','notification_worker','delete_account')
      or item->>'result' not in ('none','hit','miss','stale_error','stale_limit')
      or amount is null or amount < 1 or amount > 100000 then raise exception 'Invalid observation'; end if;
    insert into public.observability_daily(usage_date,metric,provider,source,result,value)
      values(current_date,item->>'metric',item->>'provider',item->>'source',item->>'result',amount)
      on conflict(usage_date,metric,provider,source,result) do update set value = observability_daily.value + excluded.value;
  end loop;
  if job_result is not null then
    if job_result->>'job' is distinct from 'notification-worker' or (job_result->>'scan_errors')::integer < 0 then raise exception 'Invalid job'; end if;
    insert into public.observability_jobs(job,completed_at,succeeded_at,success,scan_errors)
      values('notification-worker',now(),case when (job_result->>'success')::boolean then now() end,(job_result->>'success')::boolean,(job_result->>'scan_errors')::integer)
      on conflict(job) do update set completed_at=excluded.completed_at, succeeded_at=coalesce(excluded.succeeded_at,observability_jobs.succeeded_at), success=excluded.success, scan_errors=excluded.scan_errors;
  end if;
end $$;

create function public.set_analytics_preference(target_user uuid, is_enabled boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if target_user is null or is_enabled is null then raise exception 'Invalid preference'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_user::text,0));
  insert into public.analytics_preferences(user_id,enabled) values(target_user,is_enabled) on conflict(user_id) do update set enabled=excluded.enabled;
  if not is_enabled then
    delete from public.analytics_daily where user_id=target_user;
    delete from public.analytics_sessions where user_id=target_user;
    delete from public.analytics_receipts where user_id=target_user;
  end if;
  return is_enabled;
end $$;

create function public.ingest_analytics(target_user uuid, batch jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare item jsonb; event_time timestamptz; event_name text; accepted integer := 0; inserted integer; seconds integer; activity_day date;
begin
  if target_user is null or jsonb_typeof(batch) <> 'array' or jsonb_array_length(batch) not between 1 and 50 then raise exception 'Invalid analytics batch'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_user::text,0));
  if not exists(select 1 from public.analytics_preferences where user_id=target_user and enabled) then return 0; end if;
  if (select count(*) from public.analytics_receipts where user_id=target_user and received_at > now()-interval '1 minute') + jsonb_array_length(batch) > 240 then raise exception 'analytics_rate_limited'; end if;
  for item in select * from jsonb_array_elements(batch) loop
    event_name := item->>'name';
    event_time := (item->>'occurred_at')::timestamptz;
    seconds := case when event_name='foreground' then (item->>'seconds')::integer else 0 end;
    if event_name is null or event_name not in ('session_started','foreground','screen_view','search_submitted','media_detail_opened','library_item_added','episode_marked','comment_submitted','friend_request_sent','watch_wheel_spun','notification_opened','shared_list_used')
      or event_time is null or event_time < now()-interval '7 days' or event_time > now()+interval '5 minutes'
      or coalesce(item->>'id','') !~ '^[a-zA-Z0-9_-]{12,80}$' or coalesce(item->>'session_id','') !~ '^[a-zA-Z0-9_-]{12,80}$'
      or coalesce(item->>'platform','') not in ('ios','android','web') or seconds is null or seconds not between 0 and 120
      or (select count(*) from jsonb_object_keys(item)) > (case when event_name='foreground' then 6 else 5 end)
      then raise exception 'Invalid analytics event'; end if;
    insert into public.analytics_receipts(user_id,event_id) values(target_user,item->>'id') on conflict do nothing;
    get diagnostics inserted = row_count;
    if inserted=0 then continue; end if;
    accepted := accepted+1;
    -- Clamp the small permitted future clock skew; never create future presence.
    event_time := least(event_time,now());
    activity_day := (event_time at time zone 'Europe/Istanbul')::date;
    insert into public.analytics_daily(user_id,activity_date,last_seen_at,foreground_seconds,events)
      values(target_user,activity_day,event_time,seconds,jsonb_build_object(event_name,1))
      on conflict(user_id,activity_date) do update set last_seen_at=greatest(analytics_daily.last_seen_at,excluded.last_seen_at),
        foreground_seconds=analytics_daily.foreground_seconds+excluded.foreground_seconds,
        events=jsonb_set(analytics_daily.events,array[event_name],to_jsonb(coalesce((analytics_daily.events->>event_name)::integer,0)+1));
    if event_name='session_started' then
      insert into public.analytics_sessions(user_id,session_id,started_at,platform) values(target_user,item->>'session_id',event_time,item->>'platform') on conflict do nothing;
    end if;
  end loop;
  return accepted;
end $$;

create function public.observability_snapshot() returns jsonb
language sql stable security definer set search_path = '' as $$
  with eligible_deliveries as (
    select delivery.* from public.notification_deliveries delivery
    join public.notifications n on n.id=delivery.notification_id
    join public.devices d on d.id=delivery.device_id and d.user_id=n.user_id and d.notifications_enabled
    left join public.notification_preferences p on p.user_id=n.user_id
    where delivery.status in ('pending','processing') and delivery.attempts<6
      and coalesce(p.push_enabled,true) and case when n.type='new_episode' then coalesce(p.new_episodes,true) else coalesce(p.social,true) end
  )
  select jsonb_build_object(
    'collected_at',now(), 'quota_date',current_date, 'quota_timezone',current_setting('TimeZone'),
    'counters',coalesce((select jsonb_agg(to_jsonb(c)) from public.observability_daily c where usage_date=current_date),'[]'::jsonb),
    'omdb_reserved',coalesce((select request_count from public.external_api_usage_daily where service='omdb' and usage_date=current_date),0),
    'jobs',coalesce((select jsonb_agg(to_jsonb(j)) from public.observability_jobs j),'[]'::jsonb),
    'queue_pending',(select count(*) from eligible_deliveries),
    'queue_oldest_age',coalesce((select greatest(0,extract(epoch from now()-min(enqueued_at))) from eligible_deliveries where next_attempt_at<=now() and (locked_until is null or locked_until<now())),0),
    'users_registered',(select count(*) from public.profiles),
    'users_new_today',(select count(*) from public.profiles where (created_at at time zone 'Europe/Istanbul')::date=(now() at time zone 'Europe/Istanbul')::date),
    'analytics_enabled_users',(select count(*) from public.analytics_preferences where enabled),
    'users_active_day',(select count(*) from public.analytics_daily where activity_date=(now() at time zone 'Europe/Istanbul')::date),
    'users_active_7d',(select count(distinct user_id) from public.analytics_daily where activity_date>=(now() at time zone 'Europe/Istanbul')::date-6),
    'users_active_30d',(select count(distinct user_id) from public.analytics_daily where activity_date>=(now() at time zone 'Europe/Istanbul')::date-29),
    'users_active_15m',(select count(distinct user_id) from public.analytics_daily where last_seen_at>=now()-interval '15 minutes'),
    'sessions',coalesce((select jsonb_agg(to_jsonb(s)) from (select platform,count(*) as value from public.analytics_sessions where (started_at at time zone 'Europe/Istanbul')::date=(now() at time zone 'Europe/Istanbul')::date group by platform) s),'[]'::jsonb),
    'foreground_seconds',coalesce((select sum(foreground_seconds) from public.analytics_daily where activity_date=(now() at time zone 'Europe/Istanbul')::date),0),
    'events',coalesce((select jsonb_agg(to_jsonb(e)) from (select entry.key as event,sum(entry.value::bigint) as value from public.analytics_daily d cross join lateral jsonb_each_text(d.events) entry where activity_date=(now() at time zone 'Europe/Istanbul')::date group by entry.key) e),'[]'::jsonb)
  );
$$;

do $$ begin
  if not exists(select 1 from vault.secrets where name='episode_monitoring_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'episode_monitoring_secret');
  end if;
end $$;
create function public.authorize_monitoring_export(provided_secret text) returns boolean
language sql security definer set search_path = '' as $$
  select provided_secret is not null and length(provided_secret)=64 and exists(select 1 from vault.decrypted_secrets where name='episode_monitoring_secret' and decrypted_secret=provided_secret);
$$;
create function public.invoke_monitoring_export() returns bigint
language plpgsql security definer set search_path = '' as $$
declare project_url text; worker_secret text; request_id bigint;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name='episode_project_url';
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name='episode_monitoring_secret';
  if project_url is null or worker_secret is null then return null; end if;
  select net.http_post(url:=project_url||'/functions/v1/monitoring-export',headers:=jsonb_build_object('Content-Type','application/json','x-episode-monitoring-secret',worker_secret),body:='{}'::jsonb,timeout_milliseconds:=15000) into request_id;
  return request_id;
end $$;
create function public.configure_monitoring_export(is_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare job_id bigint;
begin
  select jobid into job_id from cron.job where jobname='episode-monitoring-export';
  if job_id is null then raise exception 'Monitoring job is missing'; end if;
  perform cron.alter_job(job_id,active:=is_enabled);
end $$;
create function public.prune_observability() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.observability_daily where usage_date<current_date-90;
  delete from public.analytics_receipts where received_at<now()-interval '14 days';
  delete from public.analytics_daily where activity_date<(now() at time zone 'Europe/Istanbul')::date-35;
  delete from public.analytics_sessions where started_at<now()-interval '35 days';
end $$;

revoke all on function public.record_observability(jsonb,jsonb),public.set_analytics_preference(uuid,boolean),public.ingest_analytics(uuid,jsonb),public.observability_snapshot(),public.authorize_monitoring_export(text),public.invoke_monitoring_export(),public.configure_monitoring_export(boolean),public.prune_observability() from public,anon,authenticated;
grant execute on function public.record_observability(jsonb,jsonb),public.set_analytics_preference(uuid,boolean),public.ingest_analytics(uuid,jsonb),public.observability_snapshot(),public.authorize_monitoring_export(text),public.invoke_monitoring_export(),public.configure_monitoring_export(boolean),public.prune_observability() to service_role;

do $$ declare new_job bigint; begin
  if not exists(select 1 from cron.job where jobname='episode-monitoring-export') then
    select cron.schedule('episode-monitoring-export','*/5 * * * *','select public.invoke_monitoring_export()') into new_job;
    perform cron.alter_job(new_job,active:=false);
  end if;
  if not exists(select 1 from cron.job where jobname='episode-observability-retention') then
    perform cron.schedule('episode-observability-retention','17 3 * * *','select public.prune_observability()');
  end if;
end $$;
commit;
