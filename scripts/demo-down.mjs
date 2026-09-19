import { run } from './lib.mjs';

try {
  await run('docker', ['compose', 'stop', 'vulnerable-api', 'vulnerable-api-fixed', 'mongo']);
} catch {
  console.log('No owned Compose services were running.');
}
