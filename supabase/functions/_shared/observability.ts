import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import { attribute, background, type Environment, monitoringEnvironment, nanoseconds, otlpTransport, resource } from './otlp.ts';

type Service = 'catalog-api' | 'notification-worker' | 'delete-account';
type Observation = { metric: string; provider: string; source: string; result: string; value: number };
export type Measure = <T>(name: 'cache.lookup' | 'quota.reserve' | 'cache.write' | 'cache.prune', work: () => PromiseLike<T>) => Promise<T>;
const hex = (length: number) => Array.from(crypto.getRandomValues(new Uint8Array(length)), (value) => value.toString(16).padStart(2, '0')).join('');

export async function observeRequest(request: Request, options: {
  service: Service; environment: Environment; admin: SupabaseClient;
  handler: (fetcher: typeof fetch, measure: Measure) => Promise<Response>;
  fetch?: typeof fetch; defer?: (task: Promise<unknown>) => void;
}) {
  const start = Date.now();
  const environment = monitoringEnvironment(options.environment);
  const source = options.service === 'catalog-api' ? 'catalog' : options.service === 'notification-worker' ? 'notification_worker' : 'delete_account';
  const parent = /^00-([a-f0-9]{32})-([a-f0-9]{16})-([a-f0-9]{2})$/.exec(request.headers.get('traceparent') ?? '');
  const validParent = parent && !/^0+$/.test(parent[1]!) && !/^0+$/.test(parent[2]!);
  const traceId = validParent ? parent[1]! : hex(16);
  const spanId = hex(8);
  const requestedRate = Number(options.environment.MONITORING_TRACE_SAMPLE_RATE ?? '0.1');
  const sample = Math.random() < (Number.isFinite(requestedRate) ? Math.max(0, Math.min(1, requestedRate)) : 0.1);
  const observations = new Map<string, Observation>();
  const children: Record<string, unknown>[] = [];
  const record = (metric: string, provider = 'none', result = 'none') => {
    const key = `${metric}:${provider}:${result}`;
    const item = observations.get(key) ?? { metric, provider, source, result, value: 0 };
    item.value += 1; observations.set(key, item);
  };
  const rawFetch = options.fetch ?? fetch;
  const measure: Measure = async (name, work) => {
    const began = Date.now(); let failed = false;
    try {
      const value = await work();
      failed = Boolean(value && typeof value === 'object' && 'error' in value && value.error);
      return value;
    } catch (error) { failed = true; throw error; }
    finally {
      if (sample && children.length < 32) children.push({ traceId, spanId: hex(8), parentSpanId: spanId, name, kind: 3,
        startTimeUnixNano: nanoseconds(began), endTimeUnixNano: nanoseconds(Date.now()), status: { code: failed ? 2 : 1 } });
    }
  };
  const instrumentedFetch: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const provider = url.hostname === 'api.themoviedb.org' ? 'tmdb' : url.hostname === 'www.omdbapi.com' ? 'omdb' : url.hostname === 'exp.host' ? 'expo' : undefined;
    if (!provider) return rawFetch(input, init);
    const began = Date.now();
    record('provider_attempts', provider);
    let failed = false;
    let statusCode: number | undefined;
    try {
      const response = await rawFetch(input, init);
      statusCode = response.status;
      failed = !response.ok;
      return response;
    } catch (error) { failed = true; throw error; }
    finally {
      if (failed) record('provider_errors', provider);
      if (sample && children.length < 32) children.push({ traceId, spanId: hex(8), parentSpanId: spanId, name: `${provider}.request`, kind: 3,
        startTimeUnixNano: nanoseconds(began), endTimeUnixNano: nanoseconds(Date.now()),
        attributes: [attribute('provider', provider), ...(statusCode === undefined ? [] : [{ key: 'http.response.status_code', value: { intValue: String(statusCode) } }])], status: { code: failed ? 2 : 1 } });
    }
  };
  let response: Response;
  try { response = await options.handler(instrumentedFetch, measure); }
  catch { response = Response.json({ error: 'Request failed' }, { status: 500 }); }
  const ended = Date.now();
  const isCatalog = options.service === 'catalog-api' && request.method === 'POST';
  const cache = response.headers.get('x-episode-cache')?.toLowerCase().replaceAll('-', '_');
  if (isCatalog) {
    record('catalog_requests');
    if (response.status === 429 || response.status >= 500) record('catalog_errors');
    if (response.ok && cache && ['hit', 'miss', 'stale_error', 'stale_limit'].includes(cache)) record('cache_response', 'none', cache);
  }
  let job: Record<string, unknown> | null = null;
  if (options.service === 'notification-worker') {
    const body = await response.clone().json().catch(() => null);
    if (body && Number.isInteger(body.scanned)) job = { job: options.service, success: response.ok && body.scanErrors === 0, scan_errors: Number.isInteger(body.scanErrors) ? body.scanErrors : 0 };
  }
  const log = { event: 'request_finished', environment, service: options.service, status: response.status,
    result: response.ok ? cache?.startsWith('stale') ? 'degraded' : 'success' : 'error', duration_ms: ended - start, cache_result: cache, trace_id: traceId };
  // Unauthenticated privileged-job requests must not generate DB writes or OTLP traffic.
  if (request.method !== 'OPTIONS' && (options.service !== 'notification-worker' || job !== null) && (options.service !== 'delete-account' || response.status !== 401)) {
    const task = (async () => {
      const query = options.admin.rpc('record_observability', { observations: [...observations.values()], job_result: job });
      if ('abortSignal' in query) query.abortSignal(AbortSignal.timeout(3000));
      const recorded = await Promise.resolve(query).then((value) => !value.error).catch(() => false);
      if (!recorded) console.error(JSON.stringify({ event: 'observability_record_failed', service: options.service }));
      console.log(JSON.stringify(log));
      const transport = otlpTransport(options.environment, rawFetch);
      if (!transport) return;
      const scope = { name: 'episode-observability', version: '1' };
      const telemetryResource = resource(options.service, environment);
      const sends = [transport.send('logs', { resourceLogs: [{ resource: telemetryResource, scopeLogs: [{ scope, logRecords: [{
        timeUnixNano: nanoseconds(ended), observedTimeUnixNano: nanoseconds(ended), severityNumber: response.ok ? 9 : 17,
        severityText: response.ok ? 'INFO' : 'ERROR', traceId, spanId, body: { stringValue: JSON.stringify(log) },
      }] }] }] })];
      if (sample) sends.push(transport.send('traces', { resourceSpans: [{ resource: telemetryResource, scopeSpans: [{ scope, spans: [{
        traceId, spanId, ...(validParent ? { parentSpanId: parent[2] } : {}), name: options.service, kind: 2,
        startTimeUnixNano: nanoseconds(start), endTimeUnixNano: nanoseconds(ended),
        attributes: [attribute('result', log.result)], status: { code: response.ok ? 1 : 2 },
      }, ...children] }] }] }));
      const results = await Promise.allSettled(sends);
      if (results.some((result) => result.status === 'rejected')) console.error(JSON.stringify({ event: 'otlp_delivery_failed', service: options.service }));
    })();
    (options.defer ?? background)(task);
  }
  const headers = new Headers(response.headers); headers.set('X-Request-Id', traceId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
