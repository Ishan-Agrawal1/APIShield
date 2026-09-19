import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { root } from './lib.mjs';

function readEnvMap(filePath) {
  const map = new Map();
  if (!existsSync(filePath)) {
    return map;
  }
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue;
    }
    const index = line.indexOf('=');
    map.set(line.slice(0, index), line.slice(index + 1));
  }
  return map;
}

function upsertEnv(filePath, values, { overwrite = [] } = {}) {
  const map = readEnvMap(filePath);
  let changed = false;
  for (const [key, value] of Object.entries(values)) {
    const current = map.get(key);
    if (!current) {
      map.set(key, value);
      changed = true;
    } else if (overwrite.includes(key) && current !== value) {
      map.set(key, value);
      changed = true;
    }
  }
  if (!changed && existsSync(filePath)) {
    return;
  }
  const body = [...map.entries()].map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
  writeFileSync(filePath, body);
  console.log('Updated', filePath);
}

const backendEnv = join(root, 'backend', '.env');
const existingToken = readEnvMap(backendEnv).get('APISHIELD_OPERATOR_TOKEN');
const token = existingToken || randomBytes(24).toString('hex');

upsertEnv(backendEnv, {
  PORT: '5000',
  BIND_HOST: '127.0.0.1',
  NODE_ENV: 'development',
  MONGO_URI: 'mongodb://127.0.0.1:27017/apishield',
  APISHIELD_OPERATOR_TOKEN: token,
  ALLOWED_HOSTS: '127.0.0.1,localhost',
  ALLOWED_ORIGINS: 'http://127.0.0.1:3000,http://localhost:3000',
  DEMO_USER_A_EMAIL: 'user1@test.com',
  DEMO_USER_A_PASSWORD: 'password123',
  DEMO_USER_B_EMAIL: 'user2@test.com',
  DEMO_USER_B_PASSWORD: 'password123',
});
upsertEnv(
  join(root, 'frontend', '.env.local'),
  {
    BACKEND_URL: 'http://127.0.0.1:5000',
    APISHIELD_OPERATOR_TOKEN: token,
  },
  { overwrite: ['APISHIELD_OPERATOR_TOKEN'] },
);
upsertEnv(join(root, 'vulnerable-api', '.env'), {
  PORT: '5001',
  BIND_HOST: '127.0.0.1',
  APP_MODE: 'vulnerable',
  MONGO_URI: 'mongodb://127.0.0.1:27017/vulnerable-api',
  JWT_SECRET: 'lab-only-not-a-real-secret',
  ENABLE_FIXTURE_HELPERS: 'true',
  CORS_ORIGIN: 'http://127.0.0.1:3000',
});
console.log('Local demo secrets created without overwriting existing values.');
