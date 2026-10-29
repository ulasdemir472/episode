import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import { handleNotificationJob } from '../_shared/notification-worker.ts';
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
type Mutation = { table: string; data: Record<string, unknown> | Record<string, unknown>[]; filters: unknown[] };
type Delivery = { id: string; token: string; title: string; body: string; data: Record<string, unknown> };
function fakeAdmin(options: { authorized?: boolean; deliveries?: Delivery[]; scans?: { media_id: number }[]; receipts?: { id: string; ticket_id: string; device_id: string }[] } = {}) {
  const mutations: Mutation[] = [];
  const calls: string[] = [];
  return {
    mutations, calls,
    client: {
      rpc: async (name: string) => { calls.push(name); return { error: null, data: name === 'authorize_episode_worker' ? options.authorized ?? true : name === 'claim_push_deliveries' ? options.deliveries ?? [] : name === 'claim_episode_scans' ? options.scans ?? [] : 0 }; },
      from: (table: string) => {
        let data: Mutation['data'] | undefined;
        let single = false;
        const filters: unknown[] = [];
        const query = {
          select: () => query,
          eq: (...values: unknown[]) => { filters.push(values); return query; },
          lt: (...values: unknown[]) => { filters.push(values); return query; },
          is: (...values: unknown[]) => { filters.push(values); return query; },
          limit: () => query,
          single: () => { single = true; return query; },
          update: (patch: Record<string, unknown>) => { data = patch; return query; },
          upsert: (rows: Record<string, unknown>[]) => { data = rows; return query; },
          then: (resolve: (value: unknown) => unknown) => {
            if (data) mutations.push({ table, data, filters });
            return Promise.resolve({ error: null, data: single ? { attempts: 1, device_id: 'device-1' } : options.receipts ?? [] }).then(resolve);
          },
        };
        return query;
      },
    } as unknown as SupabaseClient,
  };
}
const delivery: Delivery = { id: 'delivery-1', token: 'ExpoPushToken[test]', title: 'New episode', body: 'S1 E2', data: { notificationId: 'notification-1' } };
const request = () => new Request('https://example.test/notification-worker', { method: 'POST', headers: { 'x-episode-worker-secret': 'a'.repeat(64) } });
const environment = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service', TMDB_ACCESS_TOKEN: 'tmdb' };
const now = () => new Date('2026-10-29T10:00:00Z');

Deno.test('worker denies unauthorized callers before scanning or sending pushes', async () => {
  const admin = fakeAdmin({ authorized: false });
  const response = await handleNotificationJob(request(), { environment, createAdmin: () => admin.client, now });
  assert(response.status === 401, 'Unauthorized caller should be rejected');
  assert(admin.calls.length === 1 && admin.mutations.length === 0, 'Only secret validation may run');
});
Deno.test('worker stores Expo tickets for later delivery receipt checks', async () => {
  const admin = fakeAdmin({ deliveries: [delivery] });
  let payload: unknown;
  const fetcher: typeof fetch = async (_url, init) => { payload = JSON.parse(String(init?.body)); return Response.json({ data: [{ status: 'ok', id: 'ticket-1' }] }); };
  const response = await handleNotificationJob(request(), { environment, createAdmin: () => admin.client, fetch: fetcher, now });
  assert(response.status === 200, 'Push job should succeed');
  const patch = admin.mutations.find((item) => item.table === 'notification_deliveries')?.data as Record<string, unknown>;
  assert(patch.status === 'sent' && patch.ticket_id === 'ticket-1', 'Ticket must be saved');
  assert(Array.isArray(payload) && payload[0].channelId === 'new-episodes', 'Android channel must match device registration');
});
Deno.test('temporary Expo failures remain queued with exponential backoff', async () => {
  const admin = fakeAdmin({ deliveries: [delivery] });
  const response = await handleNotificationJob(request(), { environment, createAdmin: () => admin.client, fetch: async () => new Response('', { status: 429 }), now });
  assert(response.status === 200, 'A durable retry is a successful worker run');
  const patch = admin.mutations.find((item) => item.table === 'notification_deliveries')?.data as Record<string, unknown>;
  assert(patch.status === 'pending' && patch.next_attempt_at === '2026-10-29T10:01:00.000Z', 'Retry must use the original job clock');
});
Deno.test('invalid device tickets stop future delivery to that device', async () => {
  const admin = fakeAdmin({ deliveries: [delivery] });
  await handleNotificationJob(request(), { environment, createAdmin: () => admin.client, fetch: async () => Response.json({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }), now });
  assert(admin.mutations.some((item) => item.table === 'devices' && (item.data as Record<string, unknown>).notifications_enabled === false), 'Device should be disabled');
});
Deno.test('batch-release scanning collects every released episode in both languages', async () => {
  const admin = fakeAdmin({ scans: [{ media_id: 12 }] });
  const fetcher: typeof fetch = async (url) => String(url).includes('/season/') ? Response.json({ episodes: [{ episode_number: 1, name: 'One', air_date: '2026-10-29' }, { episode_number: 2, name: 'Two', air_date: '2026-10-29' }, { episode_number: 3, name: 'Future', air_date: '2026-12-01' }] }) : Response.json({ original_name: 'Show', seasons: [{ season_number: 1, air_date: '2026-01-01' }] });
  const response = await handleNotificationJob(request(), { environment, createAdmin: () => admin.client, fetch: fetcher, now });
  assert(response.status === 200, 'Scan should succeed');
  const rows = admin.mutations.filter((item) => item.table === 'episode_release_catalog').flatMap((item) => item.data as Record<string, unknown>[]);
  assert(rows.length === 4, 'Both episodes in both languages must be cached');
  assert(rows.every((item) => Number(item.episode_number) <= 2), 'Distant future episodes must not be enqueued');
  assert(admin.calls.includes('enqueue_episode_notifications'), 'Database must handle deduplication and user preferences');
});
Deno.test('delivery receipt errors disable stale devices', async () => {
  const admin = fakeAdmin({ receipts: [{ id: 'delivery-1', ticket_id: 'ticket-1', device_id: 'device-1' }] });
  const response = await handleNotificationJob(request(), { environment, createAdmin: () => admin.client, fetch: async () => Response.json({ data: { 'ticket-1': { status: 'error', details: { error: 'DeviceNotRegistered' } } } }), now });
  assert(response.status === 200, 'Receipt check should succeed');
  assert(admin.mutations.some((item) => item.table === 'devices' && (item.data as Record<string, unknown>).notifications_enabled === false), 'Receipt should disable unregistered devices');
});
