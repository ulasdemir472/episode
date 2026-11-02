begin;
select public.test_assert(not has_function_privilege('authenticated','public.observability_snapshot()','execute'),'Snapshots must not be callable by mobile clients');
select public.test_assert(not has_function_privilege('anon','public.ingest_analytics(uuid,jsonb)','execute'),'Anonymous clients cannot choose an analytics identity');
select public.test_assert(not has_table_privilege('authenticated','public.analytics_daily','select'),'Identifiable analytics cannot be read by other members');
select public.test_assert((select count(*)=1 from cron.job where jobname='episode-monitoring-export' and not active),'Cloud export must initially be disabled');
select public.test_assert(not public.authorize_monitoring_export(repeat('a',64)),'Unknown secrets cannot authorize export');

insert into auth.users(id) values('90000000-0000-0000-0000-000000000001'),('90000000-0000-0000-0000-000000000002');
select public.test_assert(public.ingest_analytics('90000000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object('id','event_000000001','name','session_started','occurred_at',now(),'session_id','session_0000001','platform','ios')))=0,'Analytics must be opt-in');
select public.set_analytics_preference('90000000-0000-0000-0000-000000000001',true);
select public.test_assert(public.ingest_analytics('90000000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object('id','event_000000001','name','session_started','occurred_at',now(),'session_id','session_0000001','platform','ios')))=1,'First event should be accepted');
select public.test_assert(public.ingest_analytics('90000000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object('id','event_000000001','name','session_started','occurred_at',now(),'session_id','session_0000001','platform','ios')))=0,'Retry must not duplicate events');
select public.test_assert((select count(*)=1 from public.analytics_sessions where user_id='90000000-0000-0000-0000-000000000001'),'Session starts must be idempotent');
select public.ingest_analytics('90000000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object('id','event_000000002','name','foreground','occurred_at',now(),'session_id','session_0000001','platform','ios','seconds',60)));
select public.test_assert((select foreground_seconds=60 and (events->>'session_started')::int=1 from public.analytics_daily where user_id='90000000-0000-0000-0000-000000000001'),'Unique events must update the daily aggregate once');
select public.set_analytics_preference('90000000-0000-0000-0000-000000000002',true);
select public.ingest_analytics('90000000-0000-0000-0000-000000000002',jsonb_build_array(jsonb_build_object('id','event_000000003','name','screen_view','occurred_at',now()-interval '1 day','session_id','session_0000002','platform','android')));
select public.test_assert(not exists(select 1 from public.analytics_daily where user_id='90000000-0000-0000-0000-000000000002' and last_seen_at>now()-interval '15 minutes'),'Delayed offline events must not create current presence');

do $$ declare failed boolean:=false; begin
  begin
    perform public.ingest_analytics('90000000-0000-0000-0000-000000000001',jsonb_build_array(
      jsonb_build_object('id','event_atomic001','name','screen_view','occurred_at',now(),'session_id','session_0000001','platform','ios'),
      jsonb_build_object('id','event_atomic002','name','arbitrary_secret','occurred_at',now(),'session_id','session_0000001','platform','ios')));
  exception when others then failed:=true; end;
  perform public.test_assert(failed,'Invalid event names must be rejected');
  perform public.test_assert(not exists(select 1 from public.analytics_receipts where event_id='event_atomic001'),'An invalid batch must roll back earlier events');
end $$;

select public.record_observability('[{"metric":"provider_attempts","provider":"tmdb","source":"notification_worker","result":"none","value":2},{"metric":"catalog_requests","provider":"none","source":"catalog","result":"none","value":1},{"metric":"cache_response","provider":"none","source":"catalog","result":"stale_error","value":1}]'::jsonb,'{"job":"notification-worker","success":true,"scan_errors":0}');
select public.record_observability('[]'::jsonb,'{"job":"notification-worker","success":false,"scan_errors":1}');
select public.test_assert((select value=2 from public.observability_daily where usage_date=current_date and metric='provider_attempts' and source='notification_worker' and provider='tmdb'),'Worker API attempts must have their own source');
select public.test_assert((select not success and succeeded_at is not null and scan_errors=1 from public.observability_jobs where job='notification-worker'),'Failed completion must not erase last successful job time');
select public.test_assert((public.observability_snapshot()->>'users_registered')::bigint=(select count(*) from public.profiles),'User snapshot must include real registered accounts');
select public.test_assert(not (public.observability_snapshot()::text like '%90000000-0000-0000-0000-000000000001%'),'Export snapshot must not contain user IDs');

insert into public.devices(id,user_id,platform,expo_push_token,notifications_enabled) values('90000000-0000-0000-0000-000000000010','90000000-0000-0000-0000-000000000002','ios','ExponentPushToken[monitoring-test]',true);
insert into public.notifications(id,user_id,type,title,body,data) values('90000000-0000-0000-0000-000000000011','90000000-0000-0000-0000-000000000002','new_episode','Test','Test','{}');
update public.notification_deliveries set enqueued_at=now()-interval '1 hour' where notification_id='90000000-0000-0000-0000-000000000011';
select public.test_assert((public.observability_snapshot()->>'queue_pending')::int=1 and (public.observability_snapshot()->>'queue_oldest_age')::numeric>=3599,'Eligible old deliveries must be visible');
update public.devices set notifications_enabled=false where id='90000000-0000-0000-0000-000000000010';
select public.test_assert((public.observability_snapshot()->>'queue_pending')::int=0 and (public.observability_snapshot()->>'queue_oldest_age')::numeric=0,'Disabled push devices must not trigger backlog alerts');

select public.set_analytics_preference('90000000-0000-0000-0000-000000000001',false);
select public.test_assert(not exists(select 1 from public.analytics_daily where user_id='90000000-0000-0000-0000-000000000001'),'Opt-out must delete identifiable activity');
select public.test_assert(not exists(select 1 from public.analytics_receipts where user_id='90000000-0000-0000-0000-000000000001'),'Opt-out must delete dedupe records');
select public.test_assert(not exists(select 1 from public.analytics_sessions where user_id='90000000-0000-0000-0000-000000000001'),'Opt-out must delete sessions');
delete from auth.users where id='90000000-0000-0000-0000-000000000002';
select public.test_assert(not exists(select 1 from public.analytics_daily where user_id='90000000-0000-0000-0000-000000000002'),'Account deletion must cascade to analytics');
rollback;
