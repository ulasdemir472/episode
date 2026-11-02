import assert from 'node:assert/strict';
import test from 'node:test';
import { configureMonitoringExport, synchronizeSecrets } from '../deploy-supabase.mjs';

test('monitoring remains opt-in without Cloud configuration', async()=>{
  const calls=[];
  await configureMonitoringExport({},async(...args)=>{calls.push(args);});
  assert.deepEqual(calls,[]);
  await configureMonitoringExport({MONITORING_EXPORT_ENABLED:'false'},async(...args)=>{calls.push(args);});
  assert.match(calls[0][2].query,/configure_monitoring_export\(false\)/);
});
test('monitoring Cron is enabled only after a successful real export response',async()=>{
  const queries=[];
  const request=async(path,_method,body)=>{
    if(path==='/secrets')return [{name:'OTEL_EXPORTER_OTLP_ENDPOINT'},{name:'OTEL_EXPORTER_OTLP_HEADERS'}];
    queries.push(body.query);
    if(body.query.includes('invoke_monitoring_export'))return [{request_id:'42'}];
    if(body.query.includes('net._http_response'))return [{status_code:200,timed_out:false,content:JSON.stringify({exported:true,collected_at:new Date().toISOString()})}];
    return [];
  };
  await configureMonitoringExport({MONITORING_EXPORT_ENABLED:'true'},request);
  assert.match(queries.at(-1),/configure_monitoring_export\(true\)/);
});
test('rejected exports and missing secrets never activate the Cron',async()=>{
  for(const ready of [false,true]){
    const queries=[];
    await assert.rejects(configureMonitoringExport({MONITORING_EXPORT_ENABLED:'true'},async(path,_method,body)=>{
      if(path==='/secrets')return ready?[{name:'OTEL_EXPORTER_OTLP_ENDPOINT'},{name:'OTEL_EXPORTER_OTLP_HEADERS'}]:[];
      queries.push(body.query);
      if(body.query.includes('invoke_monitoring_export'))return [{request_id:'42'}];
      return [{status_code:502,timed_out:false,content:'private-token-never-log'}];
    }),(error)=>{assert.doesNotMatch(error.message,/private-token-never-log/);return true;});
    assert.ok(!queries.some((sql)=>sql.includes('configure_monitoring_export(true)')));
  }
});
test('missing GitHub Cloud secrets preserve previously configured server values',async()=>{
  const calls=[];
  await synchronizeSecrets({},async(...args)=>{calls.push(args);return [{name:'TMDB_ACCESS_TOKEN'},{name:'OMDB_API_KEY'},{name:'OTEL_EXPORTER_OTLP_HEADERS'}];});
  assert.deepEqual(calls,[['/secrets']]);
});
