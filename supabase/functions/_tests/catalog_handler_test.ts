import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import { handleCatalog } from '../_shared/catalog-handler.ts';
function assert(value: unknown,message: string){if(!value)throw new Error(message);}
const environment={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service',OMDB_API_KEY:'private-api-key',TMDB_ACCESS_TOKEN:'private-tmdb-token'};
const request=()=>new Request('https://example.test/catalog',{method:'POST',body:JSON.stringify({service:'omdb',params:{i:'tt1234567'}})});
function fixture(cached: unknown,reserved=true){
  const calls:{name:string;args:Record<string,unknown>}[]=[];
  const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:cached,error:null}),upsert:async()=>({error:null})};
  const admin={from:()=>query,rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});return {error:null,data:name==='reserve_external_api_request'?reserved:null};}} as unknown as SupabaseClient;
  return {admin,calls};
}
Deno.test('fresh cache avoids both upstream requests and quota reservations',async()=>{
  const {admin,calls}=fixture({payload:{rating:8},expires_at:new Date(Date.now()+60000).toISOString()});let requests=0;
  const response=await handleCatalog(request(),{environment,createAdmin:()=>admin,fetch:async()=>{requests++;return Response.json({});}});
  assert(response.headers.get('X-Episode-Cache')==='HIT'&&requests===0,'Fresh cache must avoid provider usage');
  assert(!calls.some(call=>call.name==='reserve_external_api_request'),'Fresh cache must not reserve quota');
});
Deno.test('safety-limit stale responses never make an upstream request',async()=>{
  const {admin}=fixture({payload:{rating:8},expires_at:new Date(0).toISOString(),stale_until:new Date(Date.now()+60000).toISOString()},false);let requests=0;
  const response=await handleCatalog(request(),{environment,createAdmin:()=>admin,fetch:async()=>{requests++;return Response.json({});}});
  assert(response.status===200&&response.headers.get('X-Episode-Cache')==='STALE-LIMIT'&&requests===0,'Quota protection must be preserved');
});
Deno.test('upstream errors without a cache are counted and never disclose the server key',async()=>{
  const {admin,calls}=fixture(null);
  const response=await handleCatalog(request(),{environment,createAdmin:()=>admin,fetch:()=>Promise.reject(new Error('network failed: https://www.omdbapi.com/?apikey=private-api-key'))});
  const body=await response.text();
  assert(response.status===502&&!body.includes('private-api-key')&&!body.includes('omdbapi.com'),'Transport errors must not escape to the mobile client');
  assert(calls.some(call=>call.args.error_delta===1),'A failure without stale cache must increment error usage');
});
