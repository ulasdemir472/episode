import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const requiredSecrets = ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_ID', 'SUPABASE_DB_PASSWORD', 'EXPO_TOKEN'];
const serverSecrets = ['TMDB_ACCESS_TOKEN', 'OMDB_API_KEY', 'EXPO_ACCESS_TOKEN'];

export function checkConfiguration(environment) {
  if (environment.GITHUB_REF !== 'refs/heads/main') {
    throw new Error('Deployment is only allowed from main.');
  }
  const missing = requiredSecrets.filter((name) => !environment[name]?.trim());
  if (missing.length) throw new Error(`Missing GitHub Actions secrets: ${missing.join(', ')}`);
  if (!/^[a-z0-9]{20}$/.test(environment.SUPABASE_PROJECT_ID)) {
    throw new Error('SUPABASE_PROJECT_ID must be the 20-character project reference, not its URL.');
  }
}

// Never include API response bodies or transport errors in logs: they may contain credentials.
export function managementClient(environment, fetcher = fetch) {
  const base = `https://api.supabase.com/v1/projects/${environment.SUPABASE_PROJECT_ID}`;
  return async (path, method = 'GET', body) => {
    let response;
    try {
      response = await fetcher(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${environment.SUPABASE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(30_000),
        redirect: 'error',
      });
    } catch {
      throw new Error(`Supabase Management API ${method} ${path}: connection failed.`);
    }
    if (!response.ok) {
      throw new Error(`Supabase Management API ${method} ${path}: HTTP ${response.status}. Check token permissions and project status.`);
    }
    if (response.status === 204) return null;
    try { return await response.json(); }
    catch { throw new Error(`Supabase Management API ${method} ${path}: invalid JSON response.`); }
  };
}

export async function synchronizeSecrets(environment, request) {
  const existing = await request('/secrets');
  if (!Array.isArray(existing)) throw new Error('Unable to read Supabase secret names.');
  const available = new Set(existing.map((item) => item.name));
  const supplied = serverSecrets.filter((name) => environment[name]?.trim())
    .map((name) => ({ name, value: environment[name] }));
  const missing = ['TMDB_ACCESS_TOKEN', 'OMDB_API_KEY']
    .filter((name) => !available.has(name) && !supplied.some((item) => item.name === name));
  if (missing.length) {
    throw new Error(`Missing server secrets: ${missing.join(', ')}. Set them in GitHub Actions or Supabase Edge Function secrets.`);
  }
  // Omitting a GitHub secret preserves the existing server value, including Expo push protection.
  if (supplied.length) await request('/secrets', 'POST', supplied);
}

export async function configureAndVerifyWorker(environment, request, {
  sleep = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds)),
  now = Date.now,
} = {}) {
  const query = (sql, readOnly = false) => request('/database/query', 'POST', { query: sql, read_only: readOnly });
  const projectUrl = `https://${environment.SUPABASE_PROJECT_ID}.supabase.co`;
  await query(`select public.configure_episode_worker('${projectUrl}');`);
  const cron = await query("select count(*)::int as count from cron.job where jobname = 'episode-notifications' and active and schedule = '*/5 * * * *' and command = 'select public.invoke_episode_worker()';", true);
  if (cron?.[0]?.count !== 1) throw new Error('The episode-notifications Cron job is missing, inactive or incorrectly configured.');
  // The Vault secret stays in PostgreSQL. CI invokes the same function used by Cron.
  const invoked = await query('select public.invoke_episode_worker()::text as request_id;');
  const requestId = String(invoked?.[0]?.request_id ?? '');
  if (!/^[1-9][0-9]{0,18}$/.test(requestId)) throw new Error('The notification worker could not be scheduled.');
  const deadline = now() + 180_000;
  while (now() < deadline) {
    const rows = await query(`select status_code, timed_out, content from net._http_response where id = ${requestId};`, true);
    if (rows?.length) {
      const response = rows[0];
      if (response.timed_out || response.status_code !== 200) {
        throw new Error('Notification worker check failed. Inspect Edge Function logs and pg_net responses.');
      }
      let payload;
      try { payload = typeof response.content === 'string' ? JSON.parse(response.content) : response.content; }
      catch { throw new Error('Notification worker returned invalid JSON.'); }
      if (!payload || payload.error || payload.scanErrors !== 0 ||
        !Number.isInteger(payload.scanned) || payload.scanned < 0 ||
        !Number.isInteger(payload.deliveries) || payload.deliveries < 0) {
        throw new Error('Notification worker reported scan errors or an unexpected response. Inspect Edge Function logs.');
      }
      return;
    }
    await sleep(3000);
  }
  throw new Error('Notification worker did not complete within 180 seconds. Inspect Edge Function logs and pg_net responses.');
}

function runSupabase(args, environment) {
  const result = spawnSync('supabase', args, { env: environment, stdio: 'inherit', timeout: 300_000 });
  if (result.error || result.status !== 0) throw new Error(`Supabase ${args.slice(0, 2).join(' ')} failed. Deployment stopped.`);
}

export async function deploySupabase(environment, {
  request = managementClient(environment),
  run = runSupabase,
  log = console.log,
  sleep,
  now,
} = {}) {
  checkConfiguration(environment);
  log('Checking server secrets.');
  await synchronizeSecrets(environment, request);
  log('Linking the Supabase project.');
  run(['link', '--project-ref', environment.SUPABASE_PROJECT_ID], environment);
  log('Applying pending database migrations.');
  // Never reset the database or repair migration history automatically.
  run(['db', 'push', '--linked', '--yes'], environment);
  log('Deploying Edge Functions with per-function JWT settings.');
  run(['functions', 'deploy', '--project-ref', environment.SUPABASE_PROJECT_ID, '--use-api'], environment);
  log('Configuring and checking the notification worker.');
  await configureAndVerifyWorker(environment, request, { sleep, now });
  log('Supabase deployment and notification worker check passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.includes('--check-config')) {
      checkConfiguration(process.env);
      console.log('Deployment configuration passed.');
    } else {
      await deploySupabase(process.env);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
