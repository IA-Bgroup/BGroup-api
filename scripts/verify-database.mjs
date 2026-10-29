import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const wrangler = join(root, 'node_modules/wrangler/bin/wrangler.js');
const expectedMigrations = readdirSync(join(root, 'migrations'))
  .filter((name) => name.endsWith('.sql'))
  .sort();
assert.ok(expectedMigrations.length > 0, 'At least one migration is required.');

// Never use the developer's .wrangler database or a remote database.
const persistence = mkdtempSync(join(tmpdir(), 'aptus-db-verify-'));
const localOptions = [
  '--local',
  '--env',
  'development',
  '--config',
  join(root, 'wrangler.jsonc'),
  '--persist-to',
  persistence,
];

function runWrangler(args, json = false) {
  const result = spawnSync(process.execPath, [wrangler, ...args, ...localOptions], {
    cwd: root,
    env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `Local D1 verification failed: ${result.error?.message ?? result.signal ?? result.status}\n${result.stdout}\n${result.stderr}`
    );
  }
  if (!json) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    return;
  }
  return JSON.parse(result.stdout);
}

function verifyDatabase() {
  const results = runWrangler(
    [
      'd1',
      'execute',
      'bgroup-api-dev',
      '--json',
      '--command',
      'SELECT name FROM d1_migrations ORDER BY name; PRAGMA quick_check; PRAGMA foreign_key_check;',
    ],
    true
  );
  assert.equal(results.length, 3, 'All database checks must return a result.');
  assert.ok(
    results.every((result) => result.success),
    'A database check failed.'
  );
  assert.deepEqual(
    results[0].results.map((row) => row.name).sort(),
    expectedMigrations,
    'The temporary database must include every checked-in migration.'
  );
  assert.deepEqual(results[1].results, [{ quick_check: 'ok' }]);
  assert.deepEqual(results[2].results, [], 'Foreign key violations were found.');
}

try {
  runWrangler(['d1', 'migrations', 'apply', 'bgroup-api-dev']);
  verifyDatabase();
  // A second application must safely leave all migrations applied once.
  runWrangler(['d1', 'migrations', 'apply', 'bgroup-api-dev']);
  verifyDatabase();
  console.log(
    `Verified ${expectedMigrations.length} migration(s) in an isolated local D1 database.`
  );
} finally {
  rmSync(persistence, { recursive: true, force: true });
}
