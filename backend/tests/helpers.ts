import { after, before } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { resetEnvCache } from '../src/config/env.js';

process.env.NODE_ENV = 'test';
process.env.APISHIELD_OPERATOR_TOKEN = process.env.APISHIELD_OPERATOR_TOKEN || 'test-operator-token';
process.env.ALLOWED_HOSTS = '127.0.0.1,localhost';
process.env.ALLOWED_ORIGINS = 'http://127.0.0.1:3000,http://localhost:3000';

const runningChildren: ChildProcess[] = [];
let memory: MongoMemoryServer | undefined;
let target: ChildProcess | undefined;

export const OPERATOR = process.env.APISHIELD_OPERATOR_TOKEN;

export async function startBackendDatabase(): Promise<string> {
  resetEnvCache();
  const external = process.env.TEST_MONGO_URI;
  if (external) {
    process.env.MONGO_URI = external;
    resetEnvCache();
    await connectDB(external);
    return external;
  }
  memory = await MongoMemoryServer.create();
  const uri = memory.getUri('apishield-test');
  process.env.MONGO_URI = uri;
  resetEnvCache();
  await connectDB(uri);
  return uri;
}

export async function stopBackendDatabase(): Promise<void> {
  await disconnectDB();
  await memory?.stop();
  memory = undefined;
}

export async function clearCollections(): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    return;
  }
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

export function registerBackendSuite(): void {
  before(async () => {
    await startBackendDatabase();
  });
  after(async () => {
    await stopTargetApi();
    await stopBackendDatabase();
  });
}

function labMongoUri(dbName: string): string | undefined {
  const base = process.env.TEST_MONGO_URI;
  if (!base) {
    return undefined;
  }
  const url = new URL(base);
  url.pathname = `/${dbName}`;
  return url.toString();
}

function labDatabaseEnv(dbName: string): NodeJS.ProcessEnv {
  const uri = labMongoUri(dbName);
  if (uri) {
    return { MONGO_URI: uri, USE_MEMORY_DB: 'false' };
  }
  return { USE_MEMORY_DB: 'true' };
}

export async function startTargetApi(port = 15051): Promise<string> {
  const origin = `http://127.0.0.1:${port}`;
  process.env.DEMO_VULNERABLE_ORIGIN = origin;
  const cwd = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'vulnerable-api');
  target = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd,
    env: {
      ...process.env,
      PORT: String(port),
      BIND_HOST: '127.0.0.1',
      NODE_ENV: 'development',
      APP_MODE: 'vulnerable',
      ENABLE_FIXTURE_HELPERS: 'true',
      LOG_FILE: '',
      JWT_SECRET: 'test-lab-secret',
      ...labDatabaseEnv('vulnerable-api-itest'),
    },
    stdio: 'pipe',
  });
  runningChildren.push(target);
  await waitForHttp(`${origin}/api/health`, 20_000);
  return origin;
}

export async function startFixedApi(port = 15052): Promise<string> {
  const origin = `http://127.0.0.1:${port}`;
  process.env.DEMO_FIXED_ORIGIN = origin;
  const cwd = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'vulnerable-api');
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd,
    env: {
      ...process.env,
      PORT: String(port),
      BIND_HOST: '127.0.0.1',
      NODE_ENV: 'development',
      APP_MODE: 'fixed',
      ENABLE_FIXTURE_HELPERS: 'true',
      LOG_FILE: '',
      JWT_SECRET: 'test-lab-secret',
      ...labDatabaseEnv('vulnerable-api-fixed-itest'),
    },
    stdio: 'pipe',
  });
  runningChildren.push(child);
  await waitForHttp(`${origin}/api/health`, 20_000);
  return origin;
}

export async function stopTargetApi(): Promise<void> {
  const children = [...runningChildren, target].filter(Boolean) as ChildProcess[];
  for (const child of children) {
    child.kill();
  }
  runningChildren.length = 0;
  target = undefined;
}

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}
