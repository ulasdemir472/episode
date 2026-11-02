export type Environment = Record<string, string | undefined>;
export type Signal = 'metrics' | 'logs' | 'traces';
export const attribute = (key: string, value: string) => ({ key, value: { stringValue: value } });
export const nanoseconds = (time: number) => (BigInt(Math.floor(time)) * 1_000_000n).toString();
export const monitoringEnvironment = (env: Environment) => ['production', 'preview', 'local'].includes(env.MONITORING_ENVIRONMENT ?? '') ? env.MONITORING_ENVIRONMENT! : 'production';
export const resource = (service: string, environment: string) => ({ attributes: [attribute('service.name', service), attribute('service.namespace', 'episode'), attribute('deployment.environment.name', environment)] });

export function otlpTransport(env: Environment, fetcher: typeof fetch = fetch) {
  const value = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!value) return undefined;
  const url = new URL(value);
  const local = env.MONITORING_ALLOW_LOCAL === 'true' && ['localhost', '127.0.0.1', 'host.docker.internal', 'lgtm'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || (!local && (url.protocol !== 'https:' || !url.hostname.endsWith('.grafana.net'))) || (local && !['http:', 'https:'].includes(url.protocol))) throw new Error('Invalid OTLP destination');
  const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'application/json' });
  const configuredHeaders = env.OTEL_EXPORTER_OTLP_HEADERS?.trim();
  if (configuredHeaders) {
    const match = /^Authorization=(.+)$/i.exec(configuredHeaders);
    if (!match) throw new Error('Invalid OTLP authentication');
    const authorization = decodeURIComponent(match[1]!);
    if (!/^Basic [A-Za-z0-9+/=]+$/.test(authorization)) throw new Error('Invalid OTLP authentication');
    headers.set('Authorization', authorization);
  } else if (!local) throw new Error('OTLP authentication is missing');
  return {
    async send(signal: Signal, payload: unknown) {
      const response = await fetcher(`${url.toString().replace(/\/$/, '')}/v1/${signal}`, {
        method: 'POST', headers, body: JSON.stringify(payload), redirect: 'error', signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`OTLP ${signal} HTTP ${response.status}`);
      const body = await response.text();
      if (body) {
        const partial = JSON.parse(body).partialSuccess;
        if (partial && ['rejectedDataPoints', 'rejectedLogRecords', 'rejectedSpans'].some((key) => Number(partial[key] ?? 0) > 0)) throw new Error(`OTLP ${signal} partially rejected`);
      }
    },
  };
}

export function background(task: Promise<unknown>) {
  const safe = task.catch(() => console.error(JSON.stringify({ event: 'observability_background_failed' })));
  const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (task: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime) runtime.waitUntil(safe);
  else void safe;
}
