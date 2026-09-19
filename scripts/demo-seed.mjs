import { join } from 'node:path';
import { root, run } from './lib.mjs';

await run('npm', ['run', 'seed'], {
  cwd: join(root, 'vulnerable-api'),
  env: { ...process.env, MONGO_URI: 'mongodb://127.0.0.1:27017/vulnerable-api' },
});
await run('npm', ['run', 'seed'], {
  cwd: join(root, 'vulnerable-api'),
  env: { ...process.env, MONGO_URI: 'mongodb://127.0.0.1:27017/vulnerable-api-fixed' },
});
