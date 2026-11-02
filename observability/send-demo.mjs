import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

// Deliberately fixed to loopback: demo data must not reach production or Cloud.
const endpoint = 'http://127.0.0.1:4318';
const args = new Set(process.argv.slice(2));
for (const arg of args) {
  if (!['--dry-run', '--watch'].includes(arg)) throw new Error(`Unknown option: ${arg}`);
}
const textAttribute = (key, value) => ({ key, value: { stringValue: value } });
const nanos = (milliseconds) => (BigInt(milliseconds) * 1_000_000n).toString();
const resource = (service) => ({ attributes: [
  textAttribute('service.name', service),
  textAttribute('service.namespace', 'episode'),
  textAttribute('deployment.environment.name', 'local'),
  textAttribute('demo', 'true'),
] });
const scope = { name: 'episode-local-demo', version: '1' };

function payloads(tick = 0) {
  const now = Date.now();
  const timestamp = nanos(now);
  const gauge = (name, points) => ({ name, gauge: { dataPoints: points.map(([value, attributes = {}]) => ({
    attributes: Object.entries({ environment: 'local', demo: 'true', ...attributes }).map(([key, item]) => textAttribute(key, item)),
    timeUnixNano: timestamp,
    asDouble: value,
  })) } });
  const metrics = [
    gauge('episode_telemetry_snapshot_timestamp_seconds', [[now / 1000]]),
    gauge('episode_catalog_requests_today', [[1482 + tick * 3]]),
    gauge('episode_catalog_errors_today', [[8]]),
    gauge('episode_provider_daily_quota_limit', [[1000, { provider: 'omdb' }]]),
    gauge('episode_provider_daily_safety_limit', [[950, { provider: 'omdb' }]]),
    gauge('episode_provider_budget_reserved_today', [[347 + tick, { provider: 'omdb' }]]),
    gauge('episode_provider_request_attempts_today', [
      [345 + tick, { provider: 'omdb', source: 'catalog' }],
      [180 + tick, { provider: 'tmdb', source: 'catalog' }],
      [74, { provider: 'tmdb', source: 'notification_worker' }],
    ]),
    gauge('episode_catalog_cache_responses_today', [
      [950 + tick, { cache_result: 'hit' }],
      [492 + tick * 2, { cache_result: 'miss' }],
      [25, { cache_result: 'stale_error' }],
      [7, { cache_result: 'stale_limit' }],
    ]),
    gauge('episode_worker_last_completed_timestamp_seconds', [[now / 1000 - 120]]),
    gauge('episode_worker_last_run_scan_errors', [[0]]),
    gauge('episode_worker_last_run_success', [[1]]),
    gauge('episode_worker_last_success_timestamp_seconds', [[now / 1000 - 120]]),
    gauge('episode_notification_queue_pending', [[2]]),
    gauge('episode_notification_queue_oldest_age_seconds', [[90]]),
    // These are synthetic user aggregates, never real account identifiers.
    gauge('episode_user_activity_snapshot_timestamp_seconds', [[now / 1000]]),
    gauge('episode_users_registered', [[42]]),
    gauge('episode_analytics_enabled_users', [[23]]),
    gauge('episode_users_new_today', [[3]]),
    gauge('episode_users_active', [
      [8, { window: 'day' }],
      [16, { window: '7d' }],
      [23, { window: '30d' }],
      [2, { window: '15m' }],
    ]),
    gauge('episode_user_sessions_today', [
      [7, { platform: 'ios' }],
      [4, { platform: 'android' }],
    ]),
    gauge('episode_user_foreground_seconds_today', [[2400 + tick * 30]]),
    gauge('episode_user_events_today', [
      [23 + tick, { event: 'search_submitted' }],
      [41 + tick, { event: 'media_detail_opened' }],
      [5, { event: 'library_item_added' }],
      [12 + tick, { event: 'episode_marked' }],
      [2, { event: 'comment_submitted' }],
      [1, { event: 'friend_request_sent' }],
      [3, { event: 'watch_wheel_spun' }],
      [4, { event: 'notification_opened' }],
    ]),
  ];
  const traceId = randomBytes(16).toString('hex');
  const rootId = randomBytes(8).toString('hex');
  const start = now - 1000;
  const span = (name, spanId, begin, end, extra = {}) => ({
    traceId, spanId, name, kind: 3,
    startTimeUnixNano: nanos(begin), endTimeUnixNano: nanos(end),
    attributes: [textAttribute('demo', 'true')], status: { code: 1 }, ...extra,
  });
  return {
    metrics: { resourceMetrics: [{ resource: resource('episode-lab'), scopeMetrics: [{ scope, metrics }] }] },
    logs: { resourceLogs: [{ resource: resource('catalog-api'), scopeLogs: [{ scope, logRecords: [{
      timeUnixNano: timestamp, observedTimeUnixNano: timestamp, severityNumber: 13, severityText: 'WARN',
      traceId, spanId: rootId,
      body: { stringValue: JSON.stringify({ event: 'catalog_request_finished', environment: 'local', demo: true,
        provider: 'tmdb', result: 'stale_error', duration_ms: 240, trace_id: traceId,
        message: 'Yerel demo: örnek bir stale fallback; gerçek kullanıcı isteği değildir.' }) },
    }] }] }] },
    traces: { resourceSpans: [{ resource: resource('catalog-api'), scopeSpans: [{ scope, spans: [
      span('catalog.request · LOCAL DEMO', rootId, start, start + 240, { kind: 2 }),
      span('cache.lookup', randomBytes(8).toString('hex'), start + 10, start + 30, { parentSpanId: rootId }),
      span('tmdb.fetch', randomBytes(8).toString('hex'), start + 35, start + 220, {
        parentSpanId: rootId, status: { code: 2, message: 'Synthetic upstream failure' },
      }),
    ] }] }] },
  };
}

if (args.has('--dry-run')) {
  const data = payloads();
  console.log(JSON.stringify({ mode: 'LOCAL DEMO / dry run', destination: endpoint,
    metricFamilies: data.metrics.resourceMetrics[0].scopeMetrics[0].metrics.length,
    logs: 1, spans: 3, productionRequests: 0 }));
} else {
  let running = true;
  let tick = 0;
  process.on('SIGINT', () => { running = false; });
  process.on('SIGTERM', () => { running = false; });
  do {
    // Keep the synthetic quota inside its example daily budget during long runs.
    const data = payloads(tick % 500);
    const results = await Promise.allSettled(Object.entries(data).map(async ([signal, body]) => {
      const response = await fetch(`${endpoint}/v1/${signal}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`${signal}: local collector returned ${response.status}`);
      const reply = await response.text();
      if (reply) {
        const partial = JSON.parse(reply).partialSuccess;
        if (partial && Object.values(partial).some((value) => Number(value) > 0)) {
          throw new Error(`${signal}: local collector rejected part of the payload`);
        }
      }
      return signal;
    }));
    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length) {
      for (const result of failed) console.error(result.reason.message);
      process.exitCode = 1;
      break;
    }
    console.log('LOCAL DEMO gönderildi: metrics + logs + traces. Grafana ortamı: local.');
    tick += 1;
    if (!args.has('--watch') || !running) break;
    await delay(30_000);
  } while (running);
}
