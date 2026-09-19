import { root, run, waitForHttp } from './lib.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return;
  }
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue;
    }
    const index = line.indexOf('=');
    const key = line.slice(0, index);
    const value = line.slice(index + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(join(root, 'backend', '.env'));

const steps = [
  ['lint', () => run('node', ['scripts/run-in.mjs', 'lint'])],
  ['typecheck', () => run('node', ['scripts/run-in.mjs', 'typecheck'])],
  ['unit', () => run('npm', ['run', 'test:unit'])],
  ['integration', () => run('npm', ['run', 'test:integration'])],
  ['build', () => run('node', ['scripts/run-in.mjs', 'build'])],
];

for (const [name, fn] of steps) {
  console.log(`\n== ${name} ==`);
  try {
    await fn();
  } catch (error) {
    console.error(`FAIL ${name}:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

console.log('\n== demo:verify ==');
try {
  await waitForHttp(process.env.APISHIELD_BACKEND_URL ? `${process.env.APISHIELD_BACKEND_URL}/ready` : 'http://127.0.0.1:5000/ready', 3_000);
  if (!process.env.APISHIELD_OPERATOR_TOKEN) {
    throw new Error('APISHIELD_OPERATOR_TOKEN is not set');
  }
  await run('npm', ['run', 'demo:verify'], { cwd: root });
} catch (error) {
  console.error(
    'BLOCKED: live demo gate was not run. Start Mongo + both lab APIs + the backend (`npm run demo:up` and the backend), set APISHIELD_OPERATOR_TOKEN, then re-run `npm run demo:verify`.',
  );
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 0;
}

console.log('\nCore verify steps passed.');
