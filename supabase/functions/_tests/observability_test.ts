import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import { observeRequest } from '../_shared/observability.ts';
import { handleMonitoringExport, snapshotMetrics } from '../_shared/monitoring-export.ts';
import { otlpTransport } from '../_shared/otlp.ts';
import { handleAnalyticsIntake } from '../_shared/analytics-intake.ts';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
const cloud = { OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otlp-example.grafana.net/otlp', OTEL_EXPORTER_OTLP_HEADERS: 'Authorization=Basic dGVzdDpzZWNyZXQ=', MONITORING_TRACE_SAMPLE_RATE: '1' };
const snapshot = () => ({ collected_at: new Date().toISOString(), quota_date: '2026-11-02', quota_timezone: 'UTC', counters: [], jobs: [], sessions: [], events: [], omdb_reserved: 7, queue_pending: 0, queue_oldest_age: 0, users_registered: 2, users_new_today: 1, analytics_enabled_users: 1, users_active_day: 1, users_active_7d: 1, users_active_30d: 1, users_active_15m: 1, foreground_seconds: 60 });

Deno.test('catalog observes actual provider attempts and stale success without disclosing private data', async () => {
  const pending: Promise<unknown>[]=[]; const calls: unknown[]=[]; const payloads: string[]=[];
  const admin={ rpc: async (_name: string, args: unknown) => { calls.push(args); return {error:null}; } } as unknown as SupabaseClient;
  const response=await observeRequest(new Request('https://example.test/catalog-api',{method:'POST',body:'{"query":"private-search"}'}),{
    service:'catalog-api',environment:cloud,admin,defer:(task)=>pending.push(task),
    fetch: async (input,init) => {
      if(String(input).includes('api.themoviedb.org')) return new Response('unavailable',{status:503});
      payloads.push(String(init?.body)); return Response.json({});
    },
    handler:async (fetcher)=>{ await fetcher('https://api.themoviedb.org/3/search/multi?query=private-search',{headers:{Authorization:'Bearer private-secret'}}); return Response.json({cached:true},{headers:{'X-Episode-Cache':'STALE-ERROR'}}); },
  });
  await Promise.all(pending);
  const recorded=JSON.stringify(calls);
  assert(response.status===200,'Stale success must remain a success');
  assert(recorded.includes('provider_attempts') && recorded.includes('stale_error'),'Provider and degraded outcome must both be recorded');
  assert(!recorded.includes('catalog_errors'),'Stale content is a degraded success, not a failed catalog request');
  assert(payloads.length===2 && payloads.every((body)=>!body.includes('private-search')&&!body.includes('private-secret')),'Telemetry must never contain query text or authorization');
});
Deno.test('telemetry write failures never fail the business request',async()=>{
  const pending:Promise<unknown>[]=[];
  const admin={rpc:()=>Promise.reject(new Error('private-database-error'))} as unknown as SupabaseClient;
  const response=await observeRequest(new Request('https://example.test/catalog-api',{method:'POST'}),{service:'catalog-api',environment:{},admin,defer:(task)=>pending.push(task),handler:async()=>Response.json({ok:true})});
  await Promise.all(pending); assert(response.status===200,'Monitoring must fail open');
});
Deno.test('unauthorized worker calls do not create telemetry work',async()=>{
  let writes=0; let background=0;
  const admin={rpc:()=>{ writes++;return Promise.resolve({error:null}); }} as unknown as SupabaseClient;
  await observeRequest(new Request('https://example.test/worker',{method:'POST'}),{service:'notification-worker',environment:cloud,admin,defer:()=>{background++;},handler:async()=>Response.json({error:'Unauthorized'},{status:401})});
  assert(writes===0&&background===0,'A rejected privileged request must not consume telemetry or DB quota');
});
Deno.test('OTLP destination rejects credential leaks and remote redirects',async()=>{
  for(const endpoint of ['http://otlp-example.grafana.net/otlp','https://evil.test/otlp','https://user:secret@otlp-example.grafana.net/otlp','https://otlp-example.grafana.net/otlp?token=secret']){
    let rejected=false; try {otlpTransport({...cloud,OTEL_EXPORTER_OTLP_ENDPOINT:endpoint});}catch{rejected=true;}
    assert(rejected,'Invalid destination accepted');
  }
  let redirect:RequestRedirect|undefined;
  await otlpTransport(cloud,async(_input,init)=>{redirect=init?.redirect;return Response.json({});})!.send('logs',{});
  assert(redirect==='error','OTLP must not follow redirects with authentication');
});
Deno.test('export requires the private job secret and reports partial rejection as failure',async()=>{
  let snapshots=0;
  const admin={rpc:async(name:string)=> name==='authorize_monitoring_export'?{error:null,data:true}:(snapshots++,{error:null,data:snapshot()})} as unknown as SupabaseClient;
  const forbidden=await handleMonitoringExport(new Request('https://example.test/export',{method:'POST'}),{admin,environment:cloud});
  assert(forbidden.status===401&&snapshots===0,'Authorization must precede snapshot collection');
  const req=()=>new Request('https://example.test/export',{method:'POST',headers:{'x-episode-monitoring-secret':'a'.repeat(64)}});
  const missing=await handleMonitoringExport(req(),{admin,environment:{}});
  assert(missing.status===503&&snapshots===0,'Unconfigured Cloud must not pretend to export');
  const rejected=await handleMonitoringExport(req(),{admin,environment:cloud,fetch:async()=>Response.json({partialSuccess:{rejectedDataPoints:'1'}})});
  assert(rejected.status===502,'Partial rejection must not mark the snapshot exported');
  const accepted=await handleMonitoringExport(req(),{admin,environment:cloud,fetch:async()=>Response.json({})});
  assert(accepted.status===200,'Accepted OTLP snapshot should complete');
});
Deno.test('snapshot metrics never invent a successful worker or missing source data',()=>{
  const data=snapshotMetrics(snapshot(),'production');
  const names=data.resourceMetrics[0]!.scopeMetrics[0]!.metrics.map((metric)=>metric.name);
  assert(!names.includes('episode_worker_last_completed_timestamp_seconds'),'No job record must mean no job timestamp');
  let rejected=false;try{snapshotMetrics({...snapshot(),users_registered:null},'production');}catch{rejected=true;}
  assert(rejected,'Missing account data must not become zero');
});
Deno.test('analytics validates the JWT identity, rejects private fields and never trusts a supplied account',async()=>{
  const calls:unknown[]=[];
  const admin={auth:{getUser:async()=>({error:null,data:{user:{id:'alice'}}})},rpc:async(_name:string,body:unknown)=>{calls.push(body);return {error:null,data:1};}} as unknown as SupabaseClient;
  const req=(body:unknown)=>new Request('https://example.test/analytics',{method:'POST',headers:{Authorization:'Bearer token'},body:JSON.stringify(body)});
  const event={id:'valid_identity_1',session_id:'valid_session_1',name:'search_submitted',platform:'ios',occurred_at:new Date().toISOString()};
  assert((await handleAnalyticsIntake(req({account_id:'bob',operation:'events',events:[event]}),{admin})).status===409,'Cross-account events must be rejected');
  assert((await handleAnalyticsIntake(req({account_id:'alice',operation:'events',events:[{...event,query:'private-search'}]}),{admin})).status===400,'Private event fields must be rejected');
  assert(calls.length===0,'Invalid events must not reach the database');
  const result=await handleAnalyticsIntake(req({account_id:'alice',operation:'events',events:[event]}),{admin});
  assert(result.status===200&&JSON.stringify(calls).includes('target_user'),'Verified identity should reach ingestion');
});
