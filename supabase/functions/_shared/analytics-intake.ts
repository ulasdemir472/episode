import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import { validateAnalyticsEvents } from '../../../src/domain/analytics.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
async function limitedJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty body');
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.length; if (length > 32768) { await reader.cancel(); throw new Error('Body too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(joined));
}
export async function handleAnalyticsIntake(request: Request, dependencies: { admin: SupabaseClient; now?: () => number }) {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply({ error: 'Unauthorized' }, 401);
  try {
    const auth = await dependencies.admin.auth.getUser(token);
    if (auth.error || !auth.data.user) return reply({ error: 'Unauthorized' }, 401);
    const userId = auth.data.user.id;
    let body;
    try { body = await limitedJson(request); } catch { return reply({ error: 'Invalid analytics request' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || body.account_id !== userId) return reply({ error: 'Account changed' }, 409);
    if (body.operation === 'status') {
      const result = await dependencies.admin.from('analytics_preferences').select('enabled').eq('user_id', userId).maybeSingle();
      if (result.error) throw result.error;
      return reply({ enabled: result.data?.enabled === true });
    }
    if (body.operation === 'preference' && typeof body.enabled === 'boolean') {
      const result = await dependencies.admin.rpc('set_analytics_preference', { target_user: userId, is_enabled: body.enabled });
      if (result.error) throw result.error;
      return reply({ enabled: result.data === true });
    }
    if (body.operation !== 'events') return reply({ error: 'Invalid operation' }, 400);
    let events;
    try { events = validateAnalyticsEvents(body.events, dependencies.now?.() ?? Date.now()); }
    catch { return reply({ error: 'Invalid analytics events' }, 400); }
    const result = await dependencies.admin.rpc('ingest_analytics', { target_user: userId, batch: events });
    if (result.error) return reply({ error: result.error.message?.includes('analytics_rate_limited') ? 'Rate limited' : 'Analytics unavailable' }, result.error.message?.includes('analytics_rate_limited') ? 429 : 503);
    return reply({ accepted: result.data });
  } catch { return reply({ error: 'Analytics unavailable' }, 503); }
}
