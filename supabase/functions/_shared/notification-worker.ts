import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import { dayOffset, deliveryRetry, scheduleSeasonNumbers, ticketOutcome } from './episode-schedule.ts';

type Ticket = { status: string; id?: string; message?: string; details?: { error?: string } };
const headers = { 'Content-Type': 'application/json' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { headers, status });

export async function handleNotificationJob(request: Request, dependencies: { environment: Record<string, string | undefined>; createAdmin: (url: string, key: string) => SupabaseClient; fetch?: typeof fetch; now?: () => Date }): Promise<Response> {
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const secret = request.headers.get('x-episode-worker-secret');
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) return reply({ error: 'Unauthorized' }, 401);
  const url = dependencies.environment.SUPABASE_URL;
  const key = dependencies.environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return reply({ error: 'Server configuration missing' }, 503);
  const admin = dependencies.createAdmin(url, key);
  const fetcher = dependencies.fetch ?? fetch;
  const authorization = await admin.rpc('authorize_episode_worker', { provided_secret: secret });
  if (authorization.error || authorization.data !== true) return reply({ error: 'Unauthorized' }, 401);
  const now = dependencies.now?.() ?? new Date();
  const scanDeadline = Date.now() + 80_000;
  const from = dayOffset(now, -2);
  const to = dayOffset(now, 1);
  let scanned = 0;
  let scanErrors = 0;
  const tmdbToken = dependencies.environment.TMDB_ACCESS_TOKEN;
  try {
    if (tmdbToken) {
      const claimed = await admin.rpc('claim_episode_scans', { batch_size: 10 });
      if (claimed.error) throw claimed.error;
      const tmdb = async (path: string) => {
        const remaining = scanDeadline - Date.now();
        if (remaining < 1000) throw new Error('Episode scan time budget reached');
        const response = await fetcher(`https://api.themoviedb.org/3${path}`, { headers: { Authorization: `Bearer ${tmdbToken}` }, signal: AbortSignal.timeout(Math.min(10_000, remaining)) });
        if (!response.ok) throw new Error(`TMDB ${response.status}`);
        return response.json();
      };
      for (const show of claimed.data ?? []) {
        if (Date.now() >= scanDeadline) break;
        try {
          // Both translations are cached once per show, independently of user count.
          for (const language of ['tr', 'en']) {
            const details = await tmdb(`/tv/${show.media_id}?language=${language === 'en' ? 'en-US' : 'tr-TR'}`);
            for (const season of scheduleSeasonNumbers(details.seasons ?? [], from, to)) {
              const data = await tmdb(`/tv/${show.media_id}/season/${season}?language=${language === 'en' ? 'en-US' : 'tr-TR'}`);
              const rows = (data.episodes ?? []).filter((episode: { air_date?: string }) => episode.air_date && episode.air_date >= from && episode.air_date <= to).map((episode: { episode_number: number; name: string; air_date: string }) => ({ media_id: show.media_id, season_number: season, episode_number: episode.episode_number, language, show_title: details.original_name || details.name, episode_title: episode.name, air_date: episode.air_date }));
              if (rows.length) { const result = await admin.from('episode_release_catalog').upsert(rows); if (result.error) throw result.error; }
            }
          }
          const result = await admin.from('episode_sync_state').update({ next_check_at: new Date(now.getTime() + 3_600_000).toISOString(), locked_until: null, last_error: null }).eq('media_id', show.media_id);
          if (result.error) throw result.error;
          scanned += 1;
        } catch (error) {
          scanErrors += 1;
          console.error('episode_scan_failed', { mediaId: show.media_id, message: error instanceof Error ? error.message : 'Unknown error' });
          await admin.from('episode_sync_state').update({ next_check_at: new Date(now.getTime() + 300_000).toISOString(), locked_until: null, last_error: error instanceof Error ? error.message : 'Scan failed' }).eq('media_id', show.media_id);
        }
      }
      const enqueued = await admin.rpc('enqueue_episode_notifications');
      if (enqueued.error) throw enqueued.error;
    }

    const pending = await admin.rpc('claim_push_deliveries', { batch_size: 100 });
    if (pending.error) throw pending.error;
    const deliveries = pending.data ?? [];
    const expoHeaders: Record<string, string> = { ...headers };
    const expoToken = dependencies.environment.EXPO_ACCESS_TOKEN;
    if (expoToken) expoHeaders.Authorization = `Bearer ${expoToken}`;
    if (deliveries.length) {
      let tickets: Ticket[] = [];
      let transportError: string | undefined;
      let retryable = true;
      try {
        const response = await fetcher('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: expoHeaders, body: JSON.stringify(deliveries.map((item: { token: string; title: string; body: string; data: unknown }) => ({ to: item.token, title: item.title, body: item.body, data: item.data, sound: 'default', channelId: 'new-episodes' }))), signal: AbortSignal.timeout(15_000) });
        if (!response.ok) { retryable = response.status === 429 || response.status >= 500; throw new Error(`Expo ${response.status}`); }
        const payload = await response.json();
        tickets = Array.isArray(payload.data) ? payload.data : [payload.data];
      } catch (error) { transportError = error instanceof Error ? error.message : 'Push transport failed'; }
      for (let index = 0; index < deliveries.length; index++) {
        const item = deliveries[index];
        const ticket = tickets[index];
        const outcome = ticket ? ticketOutcome(ticket) : { status: retryable ? 'pending' : 'failed', error: transportError ?? 'Missing push ticket' };
        const attempts = await admin.from('notification_deliveries').select('attempts,device_id').eq('id', item.id).single();
        if (attempts.error) throw attempts.error;
        const status = outcome.status === 'pending' && attempts.data.attempts >= 6 ? 'failed' : outcome.status;
        const result = await admin.from('notification_deliveries').update({ status, ticket_id: 'ticketId' in outcome ? outcome.ticketId : null, sent_at: status === 'sent' ? now.toISOString() : null, locked_until: null, next_attempt_at: deliveryRetry(attempts.data.attempts, now), last_error: 'error' in outcome ? outcome.error : null }).eq('id', item.id);
        if (result.error) throw result.error;
        if ('disableDevice' in outcome && outcome.disableDevice) await admin.from('devices').update({ notifications_enabled: false }).eq('id', attempts.data.device_id);
      }
    }

    const receipts = await admin.from('notification_deliveries').select('id,ticket_id,device_id').eq('status', 'sent').is('receipt_checked_at', null).lt('sent_at', new Date(now.getTime() - 900_000).toISOString()).limit(500);
    if (receipts.error) throw receipts.error;
    if (receipts.data?.length) {
      const response = await fetcher('https://exp.host/--/api/v2/push/getReceipts', { method: 'POST', headers: expoHeaders, body: JSON.stringify({ ids: receipts.data.map((item) => item.ticket_id) }), signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`Expo receipts ${response.status}`);
      const payload = await response.json();
      for (const item of receipts.data) {
        const receipt = payload.data?.[item.ticket_id];
        if (!receipt) continue;
        const result = await admin.from('notification_deliveries').update({ receipt_checked_at: now.toISOString(), last_error: receipt.status === 'error' ? receipt.details?.error ?? receipt.message : null, status: receipt.status === 'error' ? 'failed' : 'sent' }).eq('id', item.id);
        if (result.error) throw result.error;
        if (receipt.details?.error === 'DeviceNotRegistered') await admin.from('devices').update({ notifications_enabled: false }).eq('id', item.device_id);
      }
    }
    if (!tmdbToken) return reply({ error: 'TMDB_ACCESS_TOKEN is required for episode scans', scanned, deliveries: deliveries.length }, 503);
    return reply({ scanned, scanErrors, deliveries: deliveries.length });
  } catch (error) {
    console.error('notification_worker_failed', error instanceof Error ? error.message : 'Unknown error');
    return reply({ error: 'Notification job failed', scanned, scanErrors }, 500);
  }
}
