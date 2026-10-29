import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';
import {
  checkConfiguration,
  configureAndVerifyWorker,
  deploySupabase,
  managementClient,
  projectReference,
  synchronizeSecrets,
} from '../deploy-supabase.mjs';

const environment = {
  GITHUB_REF: 'refs/heads/main',
  SUPABASE_ACCESS_TOKEN: 'test-pat-never-log',
  SUPABASE_PROJECT_ID: 'abcdefghijklmnopqrst',
  SUPABASE_DB_PASSWORD: 'test-password-never-log',
  EXPO_TOKEN: 'test-expo-token-never-log',
};
const healthyResponse = {
  status_code: 200, timed_out: false,
  content: JSON.stringify({ scanned: 2, scanErrors: 0, deliveries: 1 }),
};

function harness({ response = healthyResponse, pendingPolls = 0, cronCount = 1, requestId = '42' } = {}) {
  const events = [];
  let polls = 0;
  let time = 0;
  return {
    events,
    run(args) { events.push(['cli', args]); },
    log(message) { events.push(['log', message]); },
    now: () => time,
    sleep: async (milliseconds) => { time += milliseconds; },
    request: async (path, method, body) => {
      events.push(['api', path, method, body]);
      if (path === '/secrets') return [{ name: 'TMDB_ACCESS_TOKEN' }, { name: 'OMDB_API_KEY' }];
      if (body.query.includes('configure_episode_worker')) return [{}];
      if (body.query.includes('cron.job')) return [{ count: cronCount }];
      if (body.query.includes('as request_id')) return [{ request_id: requestId }];
      if (body.query.includes('net._http_response')) return polls++ < pendingPolls ? [] : [response];
      throw new Error('Unexpected API request in test');
    },
  };
}

test('deployment validates all required secret names without printing their values', async () => {
  for (const name of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_ID', 'EXPO_TOKEN']) {
    const dependencies = harness();
    await assert.rejects(deploySupabase({ ...environment, [name]: '' }, dependencies), (error) => {
      assert.match(error.message, new RegExp(name));
      for (const value of Object.values(environment)) assert.ok(!error.message.includes(value));
      return true;
    });
    assert.deepEqual(dependencies.events, []);
  }
});

test('deployment uses token-based temporary login even when a stale database password is inherited', async () => {
  for (const password of [undefined, 'stale-password']) {
    const source = { ...environment, SUPABASE_DB_PASSWORD: password };
    const dependencies = harness();
    const commands = [];
    dependencies.run = (args, cliEnvironment) => {
      commands.push(args[0]);
      assert.equal(Object.hasOwn(cliEnvironment, 'SUPABASE_DB_PASSWORD'), false);
      assert.equal(cliEnvironment.SUPABASE_ACCESS_TOKEN, environment.SUPABASE_ACCESS_TOKEN);
    };
    await deploySupabase(source, dependencies);
    assert.deepEqual(commands, ['link', 'db', 'functions']);
    assert.equal(source.SUPABASE_DB_PASSWORD, password);
  }
});

test('non-main deployment fails before contacting Supabase or executing CLI commands', async () => {
  const dependencies = harness();
  await assert.rejects(deploySupabase({ ...environment, GITHUB_REF: 'refs/heads/feature' }, dependencies), /only allowed from main/);
  assert.deepEqual(dependencies.events, []);
});

test('project references cannot inject URLs, SQL or shell arguments', () => {
  for (const value of ["x'); drop table users; --", 'https://abc.supabase.co', '../other', 'ABC', 'a'.repeat(21)]) {
    assert.throws(() => checkConfiguration({ ...environment, SUPABASE_PROJECT_ID: value }), /20-character project reference/);
  }
  assert.doesNotThrow(() => checkConfiguration(environment));
});

test('project configuration accepts surrounding whitespace and canonical HTTPS project URLs', async () => {
  const ref = environment.SUPABASE_PROJECT_ID;
  for (const value of [` ${ref}\r\n`, `https://${ref}.supabase.co`, ` https://${ref}.supabase.co/\n`]) {
    assert.equal(projectReference(value), ref);
    const dependencies = harness();
    dependencies.run = (args, configuration) => {
      assert.equal(configuration.SUPABASE_PROJECT_ID, ref);
      dependencies.events.push(['cli', args]);
    };
    await deploySupabase({ ...environment, SUPABASE_PROJECT_ID: value }, dependencies);
    const sql = dependencies.events.find((event) => event[3]?.query.includes('configure_episode_worker'))[3].query;
    assert.match(sql, new RegExp(`https://${ref}\\.supabase\\.co`));
    assert.doesNotMatch(sql, /https:\/\/https:/);
  }
});

test('project URL normalization rejects credentials, alternate hosts, protocols and injected paths', () => {
  const ref = environment.SUPABASE_PROJECT_ID;
  for (const value of [
    `${ref}.supabase.co`, `http://${ref}.supabase.co`, `https://${ref}.supabase.co.evil.test`,
    `https://user@${ref}.supabase.co`, `https://${ref}.supabase.co:443`,
    `https://${ref}.supabase.co/rest/v1`, `https://${ref}.supabase.co?query=1`,
    `https://${ref}.supabase.co/#anchor`, `${ref}\nother`,
  ]) assert.throws(() => projectReference(value), /20-character project reference/);
});

test('deployment applies migrations before functions and verifies worker after deployment', async () => {
  const dependencies = harness({ pendingPolls: 2 });
  await deploySupabase(environment, dependencies);
  const operations = dependencies.events.filter(([kind]) => kind !== 'log');
  assert.deepEqual(operations.slice(0, 4), [
    ['api', '/secrets', undefined, undefined],
    ['cli', ['link', '--project-ref', environment.SUPABASE_PROJECT_ID]],
    ['cli', ['db', 'push', '--linked', '--yes']],
    ['cli', ['functions', 'deploy', '--project-ref', environment.SUPABASE_PROJECT_ID, '--use-api']],
  ]);
  assert.match(operations[4][3].query, /configure_episode_worker\('https:\/\/abcdefghijklmnopqrst.supabase.co'\)/);
  const sql = operations.filter(([kind, path]) => kind === 'api' && path === '/database/query').map((event) => event[3].query).join('\n');
  assert.doesNotMatch(sql, /vault\.|decrypted_secret|request_headers/);
  assert.match(dependencies.events.at(-1)[1], /check passed/);
});

test('link, migration and function errors each stop all subsequent deployment stages', async () => {
  for (const failedCommand of ['link', 'db', 'functions']) {
    const dependencies = harness();
    const executed = [];
    dependencies.run = (args) => {
      executed.push(args[0]);
      if (args[0] === failedCommand) throw new Error('Simulated CLI failure');
    };
    await assert.rejects(deploySupabase(environment, dependencies), /Simulated CLI failure/);
    assert.deepEqual(executed, ['link', 'db', 'functions'].slice(0, ['link', 'db', 'functions'].indexOf(failedCommand) + 1));
    assert.equal(dependencies.events.filter((event) => event[1] === '/database/query').length, 0);
  }
});

test('existing server secrets are preserved when GitHub does not supply replacements', async () => {
  const dependencies = harness();
  await synchronizeSecrets(environment, dependencies.request);
  assert.equal(dependencies.events.length, 1);
});

test('supplied server secrets are synchronized without shell interpolation or logging', async () => {
  const token = 'token with spaces $() `literal`\nsecond line';
  const dependencies = harness();
  await synchronizeSecrets({ ...environment, TMDB_ACCESS_TOKEN: token, EXPO_ACCESS_TOKEN: 'push-protection' }, dependencies.request);
  assert.deepEqual(dependencies.events[1], ['api', '/secrets', 'POST', [
    { name: 'TMDB_ACCESS_TOKEN', value: token },
    { name: 'EXPO_ACCESS_TOKEN', value: 'push-protection' },
  ]]);
});

test('missing server secrets stop deployment before mutations', async () => {
  const calls = [];
  await assert.rejects(deploySupabase({ ...environment, TMDB_ACCESS_TOKEN: 'only-one' }, {
    log() {},
    run() { assert.fail('CLI must not execute'); },
    request: async (...args) => { calls.push(args); return []; },
  }), /OMDB_API_KEY/);
  assert.deepEqual(calls, [['/secrets']]);
});

test('server secret synchronization errors stop migrations', async () => {
  const dependencies = harness();
  const request = dependencies.request;
  dependencies.request = async (...args) => {
    if (args[1] === 'POST') throw new Error('Secret update failed');
    return request(...args);
  };
  await assert.rejects(deploySupabase({ ...environment, TMDB_ACCESS_TOKEN: 'new-token' }, dependencies), /Secret update failed/);
  assert.equal(dependencies.events.some(([kind]) => kind === 'cli'), false);
});

test('inactive, missing or duplicate Cron jobs prevent successful deployment', async () => {
  for (const cronCount of [0, 2]) {
    const dependencies = harness({ cronCount });
    await assert.rejects(configureAndVerifyWorker(environment, dependencies.request, dependencies), /Cron job/);
    assert.equal(dependencies.events.some((event) => event[3]?.query.includes('as request_id')), false);
  }
});

test('missing or invalid pg_net request identifiers cannot reach response SQL', async () => {
  for (const requestId of [null, '0', '42; drop schema public', '9'.repeat(30)]) {
    const dependencies = harness({ requestId });
    await assert.rejects(configureAndVerifyWorker(environment, dependencies.request, dependencies), /could not be scheduled/);
    assert.equal(dependencies.events.some((event) => event[3]?.query.includes('net._http_response')), false);
  }
});

test('worker non-200, network timeout, scan errors and invalid payloads fail readiness', async () => {
  const responses = [
    { ...healthyResponse, status_code: 401 },
    { ...healthyResponse, status_code: 503 },
    { ...healthyResponse, timed_out: true },
    { ...healthyResponse, content: '{' },
    { ...healthyResponse, content: '{}' },
    { ...healthyResponse, content: '{"error":"secret-never-log"}' },
    { ...healthyResponse, content: '{"scanned":0,"scanErrors":1,"deliveries":0}' },
  ];
  for (const response of responses) {
    const dependencies = harness({ response });
    await assert.rejects(deploySupabase(environment, dependencies), (error) => {
      assert.match(error.message, /worker/i);
      assert.doesNotMatch(error.message, /secret-never-log/);
      return true;
    });
    assert.doesNotMatch(dependencies.events.at(-1)[1], /check passed/);
  }
});

test('a queued HTTP request alone is insufficient: polling has a bounded deadline', async () => {
  const dependencies = harness({ pendingPolls: Infinity });
  await assert.rejects(configureAndVerifyWorker(environment, dependencies.request, dependencies), /within 180 seconds/);
  assert.equal(dependencies.events.filter((event) => event[3]?.query.includes('net._http_response')).length, 60);
});

test('Management API sends credentials only in authorization headers and handles JSON responses', async () => {
  const calls = [];
  const request = managementClient(environment, async (...args) => {
    calls.push(args);
    return new Response('[{"name":"TMDB_ACCESS_TOKEN"}]', { status: 200 });
  });
  assert.deepEqual(await request('/secrets'), [{ name: 'TMDB_ACCESS_TOKEN' }]);
  assert.equal(calls[0][0], `https://api.supabase.com/v1/projects/${environment.SUPABASE_PROJECT_ID}/secrets`);
  assert.equal(calls[0][1].headers.Authorization, `Bearer ${environment.SUPABASE_ACCESS_TOKEN}`);
  assert.equal(calls[0][1].redirect, 'error');
});

test('Management API errors never disclose response bodies, credentials or transport errors', async () => {
  for (const fetcher of [
    async () => new Response('secret-never-log', { status: 403 }),
    async () => { throw new Error(`secret-never-log ${environment.SUPABASE_ACCESS_TOKEN}`); },
    async () => new Response('secret-never-log', { status: 200 }),
  ]) {
    await assert.rejects(managementClient(environment, fetcher)('/secrets'), (error) => {
      assert.match(error.message, /Supabase Management API/);
      assert.doesNotMatch(error.message, /secret-never-log|test-pat-never-log/);
      return true;
    });
  }
});

function workflow(name) {
  return parse(readFileSync(new URL(`../../.github/workflows/${name}.yml`, import.meta.url), 'utf8'), { uniqueKeys: true });
}

test('automatic OTA and native releases serialize deployment and gate builds on the selected checks', () => {
  const ota = workflow('ota-update');
  const release = workflow('release');
  assert.deepEqual(ota.on.push.branches, ['main']);
  assert.deepEqual(ota.concurrency, release.concurrency);
  assert.equal(ota.concurrency['cancel-in-progress'], false);
  for (const [pipeline, job] of [[ota, 'update'], [release, 'build']]) {
    assert.equal(pipeline.jobs.backend.uses, './.github/workflows/supabase-deploy.yml');
    assert.equal(pipeline.jobs.backend.secrets, 'inherit');
    const checkout = pipeline.jobs[job].steps.find((step) => step.uses?.startsWith('actions/checkout'));
    assert.equal(checkout.with.ref, '${{ github.sha }}');
  }
  assert.equal(ota.jobs.update.needs, 'backend');
  assert.equal(ota.jobs.update.if, undefined);
  assert.deepEqual(release.jobs.build.needs, ['checks', 'backend']);
  assert.equal(release.on.workflow_dispatch.inputs.deploy_backend.default, false);
  assert.equal(release.jobs.checks.uses, './.github/workflows/ci.yml');
  const condition = (expression, inputs, needs, cancelled = () => false) =>
    new Function('inputs', 'needs', 'cancelled', `return (${expression.slice(3, -2)});`)(inputs, needs, cancelled);
  for (const deploy_backend of [false, true]) {
    const inputs = { deploy_backend };
    assert.equal(condition(release.jobs.backend.if, inputs), deploy_backend);
    assert.equal(condition(release.jobs.checks.if, inputs), !deploy_backend);
    for (const result of ['success', 'failure', 'cancelled', 'skipped']) {
      const needs = {
        backend: { result: deploy_backend ? result : 'skipped' },
        checks: { result: deploy_backend ? 'skipped' : result },
      };
      assert.equal(condition(release.jobs.build.if, inputs, needs), result === 'success');
      assert.equal(condition(release.jobs.build.if, inputs, needs, () => true), false);
    }
  }
  assert.equal(ota.on.workflow_dispatch.inputs.channel.default, 'preview');
  assert.ok(ota.jobs.update.steps.find((step) => step.env?.CHANNEL).env.CHANNEL.includes("'preview'"));
});

test('backend tests exactly the commit being deployed and gates mutation on every CI job', () => {
  const backend = workflow('supabase-deploy');
  const ci = workflow('ci');
  assert.ok(Object.hasOwn(backend.on, 'workflow_call'));
  assert.equal(backend.on.push, undefined); // A single caller owns the deployment lock.
  assert.equal(backend.concurrency, undefined); // Do not deadlock a reusable caller.
  assert.equal(backend.jobs.checks.needs, 'configuration');
  assert.equal(backend.jobs.checks.uses, './.github/workflows/ci.yml');
  assert.equal(backend.jobs.deploy.needs, 'checks');
  assert.equal(backend.jobs.deploy.if, undefined);
  for (const name of ['configuration', 'deploy']) {
    const checkout = backend.jobs[name].steps.find((step) => step.uses?.startsWith('actions/checkout'));
    assert.equal(checkout.with.ref, '${{ github.sha }}');
  }
  assert.ok(Object.hasOwn(ci.on, 'workflow_call'));
  assert.deepEqual(ci.on.push.branches, ['develop']); // main checks run through the deployment caller.
  assert.ok(ci.jobs.quality.steps.some((step) => step.run === 'pnpm validate'));
  assert.ok(ci.jobs.edge.steps.some((step) => step.run?.includes('deno test')));
  assert.ok(ci.jobs.database.steps.some((step) => step.run === 'node scripts/test-database.mjs'));
});
