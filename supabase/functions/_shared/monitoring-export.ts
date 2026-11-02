import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import { attribute, type Environment, monitoringEnvironment, nanoseconds, otlpTransport, resource } from './otlp.ts';
import { analyticsEvents } from '../../../src/domain/analytics.ts';

export function snapshotMetrics(snapshot: Record<string, unknown>, environment: string) {
  const timestamp = Date.parse(String(snapshot.collected_at));
  if (!Number.isFinite(timestamp) || !Array.isArray(snapshot.counters) || !Array.isArray(snapshot.jobs) || !Array.isArray(snapshot.sessions) || !Array.isArray(snapshot.events)) throw new Error('Invalid snapshot');
  const number = (value: unknown) => { const parsed = Number(value); if (value === null || value === undefined || !Number.isFinite(parsed) || parsed < 0) throw new Error('Invalid metric value'); return parsed; };
  const gauge = (name: string, points: [number, Record<string, string>?][]) => ({ name, gauge: { dataPoints: points.map(([value, labels = {}]) => ({
    attributes: Object.entries({ environment, ...labels }).map(([key, item]) => attribute(key, item)), timeUnixNano: nanoseconds(timestamp), asDouble: value,
  })) } });
  const counters = snapshot.counters as { metric: string; provider: string; source: string; result: string; value: number }[];
  const count = (metric: string, provider?: string, source?: string, result?: string) => counters.filter((c) => c.metric === metric && (!provider || c.provider === provider) && (!source || c.source === source) && (!result || c.result === result)).reduce((sum, row) => sum + number(row.value), 0);
  const metrics = [
    gauge('episode_telemetry_snapshot_timestamp_seconds', [[timestamp / 1000]]),
    gauge('episode_catalog_requests_today', [[count('catalog_requests')]]),
    gauge('episode_catalog_errors_today', [[count('catalog_errors')]]),
    gauge('episode_provider_daily_quota_limit', [[1000, { provider: 'omdb' }]]),
    gauge('episode_provider_daily_safety_limit', [[950, { provider: 'omdb' }]]),
    gauge('episode_provider_budget_reserved_today', [[number(snapshot.omdb_reserved), { provider: 'omdb' }]]),
    gauge('episode_provider_request_attempts_today', (['tmdb', 'omdb'] as const).flatMap((provider) => (['catalog', 'notification_worker'] as const).map((source): [number, Record<string, string>] => [count('provider_attempts', provider, source), { provider, source }]))),
    gauge('episode_catalog_cache_responses_today', ['hit', 'miss', 'stale_error', 'stale_limit'].map((cache_result): [number, Record<string, string>] => [count('cache_response', undefined, undefined, cache_result), { cache_result }])),
    gauge('episode_notification_queue_pending', [[number(snapshot.queue_pending)]]),
    gauge('episode_notification_queue_oldest_age_seconds', [[number(snapshot.queue_oldest_age)]]),
    gauge('episode_user_activity_snapshot_timestamp_seconds', [[timestamp / 1000]]),
    gauge('episode_users_registered', [[number(snapshot.users_registered)]]),
    gauge('episode_users_new_today', [[number(snapshot.users_new_today)]]),
    gauge('episode_analytics_enabled_users', [[number(snapshot.analytics_enabled_users)]]),
    gauge('episode_users_active', (['day', '7d', '30d', '15m'] as const).map((window): [number, Record<string, string>] => [number(snapshot[`users_active_${window}`]), { window }])),
    gauge('episode_user_sessions_today', ['ios', 'android', 'web'].map((platform): [number, Record<string, string>] => [number((snapshot.sessions as { platform: string; value: number }[]).find((row) => row.platform === platform)?.value ?? 0), { platform }])),
    gauge('episode_user_foreground_seconds_today', [[number(snapshot.foreground_seconds)]]),
    gauge('episode_user_events_today', analyticsEvents.map((event): [number, Record<string, string>] => [number((snapshot.events as { event: string; value: number }[]).find((row) => row.event === event)?.value ?? 0), { event }])),
  ];
  for (const job of snapshot.jobs as { job: string; completed_at: string; succeeded_at: string | null; scan_errors: number; success: boolean }[]) {
    if (job.job !== 'notification-worker') continue;
    metrics.push(gauge('episode_worker_last_completed_timestamp_seconds', [[number(Date.parse(job.completed_at) / 1000)]]));
    metrics.push(gauge('episode_worker_last_run_scan_errors', [[number(job.scan_errors)]]));
    metrics.push(gauge('episode_worker_last_run_success', [[job.success ? 1 : 0]]));
    if (job.succeeded_at) metrics.push(gauge('episode_worker_last_success_timestamp_seconds', [[number(Date.parse(job.succeeded_at) / 1000)]]));
  }
  return { resourceMetrics: [{ resource: resource('episode-monitoring', environment), scopeMetrics: [{ scope: { name: 'episode-observability', version: '1' }, metrics }] }] };
}

export async function handleMonitoringExport(request: Request, dependencies: { admin: SupabaseClient; environment: Environment; fetch?: typeof fetch }) {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const secret = request.headers.get('x-episode-monitoring-secret');
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const authorized = await dependencies.admin.rpc('authorize_monitoring_export', { provided_secret: secret });
  if (authorized.error || authorized.data !== true) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const transport = otlpTransport(dependencies.environment, dependencies.fetch);
    if (!transport) return Response.json({ error: 'Monitoring destination is not configured' }, { status: 503 });
    const snapshot = await dependencies.admin.rpc('observability_snapshot');
    if (snapshot.error || !snapshot.data) throw new Error('Snapshot unavailable');
    await transport.send('metrics', snapshotMetrics(snapshot.data, monitoringEnvironment(dependencies.environment)));
    return Response.json({ exported: true, collected_at: snapshot.data.collected_at, quota_date: snapshot.data.quota_date, quota_timezone: snapshot.data.quota_timezone });
  } catch { return Response.json({ error: 'Monitoring export failed' }, { status: 502 }); }
}
