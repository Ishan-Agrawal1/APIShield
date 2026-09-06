import { after, before, beforeEach } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { seedDatabase } from '../src/config/seed.js';
import { clearLogEvents } from '../src/middleware/httpLogger.js';
import app from '../src/app.js';

let memoryServer: MongoMemoryServer | undefined;
let suiteCount = 0;

export async function startTestDatabase(): Promise<void> {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-lab-secret';
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
  process.env.LOG_FILE = '';

  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (process.env.MONGO_URI) {
    await connectDB(process.env.MONGO_URI);
    return;
  }

  memoryServer = await MongoMemoryServer.create();
  await connectDB(memoryServer.getUri());
}

export async function stopTestDatabase(): Promise<void> {
  await disconnectDB();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }
}

export function registerHttpSuite(): typeof app {
  suiteCount += 1;

  before(async () => {
    await startTestDatabase();
  });

  beforeEach(async () => {
    await seedDatabase();
    clearLogEvents();
  });

  after(async () => {
    suiteCount -= 1;
    if (suiteCount === 0) {
      await stopTestDatabase();
    }
  });

  return app;
}

export async function loginAs(email: string, password = 'password123'): Promise<string> {
  const response = await request(app).post('/auth/login').send({ email, password });
  if (typeof response.body?.token !== 'string') {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(response.body)}`);
  }
  return response.body.token;
}
