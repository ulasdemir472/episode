import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const container = `episode-tests-${process.pid}-${Date.now()}`;
const image = process.env.EPISODE_TEST_DB_IMAGE || 'supabase/postgres:17.6.1.136';
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `Docker exited ${result.status}`);
  return result.stdout;
}
function sql(source) { return docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'episode_tests', '-v', 'ON_ERROR_STOP=1', '-X'], source); }
let started = false;
try {
  docker(['run', '--rm', '--detach', '--name', container, '--network', 'none', '--shm-size', '256m', '--env', 'POSTGRES_PASSWORD=episode-test-only', image, 'postgres', '-c', 'config_file=/etc/postgresql/postgresql.conf', '-c', 'shared_preload_libraries=pg_cron,pg_net,pgsodium,supabase_vault', '-c', 'cron.database_name=episode_tests']);
  started = true;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      docker(['exec', container, 'pg_isready', '-U', 'postgres']);
      if (docker(['exec', container, 'cat', '/proc/1/comm']).includes('postgres')) { ready = true; break; }
    } catch { /* Initial image setup starts and stops a temporary server. */ }
    await new Promise((done) => setTimeout(done, 300));
  }
  if (!ready) throw new Error('Test database did not become ready');
  docker(['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', 'create database episode_tests']);
  sql(readFileSync(resolve(root, 'supabase/tests/bootstrap.sql'), 'utf8'));
  for (const file of readdirSync(resolve(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).sort()) {
    sql(readFileSync(resolve(root, 'supabase/migrations', file), 'utf8'));
    console.log(`Migration passed: ${file}`);
  }
  for (const file of readdirSync(resolve(root, 'supabase/tests')).filter((name) => name.endsWith('.test.sql')).sort()) {
    sql(readFileSync(resolve(root, 'supabase/tests', file), 'utf8'));
    console.log(`Integration passed: ${file}`);
  }
} finally {
  if (started) docker(['rm', '--force', '--volumes', container]);
}
