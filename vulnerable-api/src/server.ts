import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { connectDB, connectWithRetry, disconnectDB } from './config/db.js';
import { seedIfEmpty } from './config/seed.js';
import { getPort } from './config/env.js';

async function connectLabDatabase(): Promise<void> {
  if (process.env.USE_MEMORY_DB === 'true') {
    await startMemoryMongo();
    return;
  }

  try {
    await connectWithRetry(3, 500);
  } catch (error) {
    console.warn('[vulnerable-api] MongoDB is unavailable. Starting an ephemeral in-memory database for local lab use.');
    console.warn('[vulnerable-api] For a reproducible MongoDB instance, run `docker compose up mongo` from the repository root.');
    await disconnectDB();
    try {
      await startMemoryMongo();
    } catch (memoryError) {
      console.error('[vulnerable-api] In-memory MongoDB fallback failed:', memoryError);
      throw error;
    }
  }
}

async function startMemoryMongo(): Promise<void> {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const memory = await MongoMemoryServer.create();
  await connectDB(memory.getUri());
  console.log('[vulnerable-api] Using mongodb-memory-server for this process.');
}

const start = async (): Promise<void> => {
  await connectLabDatabase();
  await seedIfEmpty();

  const port = getPort();
  const server = app.listen(port, () => {
    console.log('');
    console.log('Vulnerable API lab listening on http://localhost:' + port);
    console.log('This service is an intentionally vulnerable LOCAL test target.');
    console.log('');
    console.log('Seeded credentials:');
    console.log('  user1@test.com / password123  (id=1)');
    console.log('  user2@test.com / password123  (id=2)');
    console.log('  admin@test.com / password123  (id=3)');
    console.log('');
    console.log('Structured HTTP events: stdout JSON lines and logs/http-events.jsonl');
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[vulnerable-api] Port ${port} is already in use.`);
    } else {
      console.error('[vulnerable-api] Server error:', error.message);
    }
    process.exit(1);
  });
};

start().catch((error: unknown) => {
  console.error('[vulnerable-api] Failed to start:', error);
  process.exit(1);
});
