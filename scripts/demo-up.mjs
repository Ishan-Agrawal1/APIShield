import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { root, run, waitForHttp } from './lib.mjs';

async function main() {
  try {
    await run('docker', ['compose', 'up', '-d', 'mongo']);
    await waitForHttp('http://127.0.0.1:27017', 5_000).catch(() => undefined);
  } catch (error) {
    console.error('BLOCKED: Docker Compose could not start MongoDB.');
    console.error('Start MongoDB 7 on 127.0.0.1:27017, then re-run npm run demo:up.');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const vulnerable = spawn('npm', ['run', 'dev'], {
    cwd: join(root, 'vulnerable-api'),
    env: { ...process.env, APP_MODE: 'vulnerable', PORT: '5001', BIND_HOST: '127.0.0.1' },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const fixed = spawn('npm', ['run', 'dev'], {
    cwd: join(root, 'vulnerable-api'),
    env: {
      ...process.env,
      APP_MODE: 'fixed',
      PORT: '5002',
      BIND_HOST: '127.0.0.1',
      MONGO_URI: 'mongodb://127.0.0.1:27017/vulnerable-api-fixed',
    },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  await waitForHttp('http://127.0.0.1:5001/api/health', 40_000);
  await waitForHttp('http://127.0.0.1:5002/api/health', 40_000);
  console.log('Demo services are healthy on 127.0.0.1:5001 (vulnerable) and 127.0.0.1:5002 (fixed).');
  console.log('Leave this process running, or start the APIs separately with npm run dev in each package.');
  vulnerable.unref();
  fixed.unref();
}

await main();
