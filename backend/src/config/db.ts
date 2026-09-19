import mongoose from 'mongoose';
import { loadEnv } from './env.js';

export async function connectDB(uri = loadEnv().mongoUri): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function isMongoReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function pingMongo(): Promise<boolean> {
  if (!isMongoReady() || !mongoose.connection.db) {
    return false;
  }
  try {
    await mongoose.connection.db.admin().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

export async function reconcileOrphanedScans(): Promise<number> {
  if (!isMongoReady()) {
    return 0;
  }
  const { ScanModel } = await import('../models/Scan.js');
  const result = await ScanModel.updateMany(
    { status: { $in: ['queued', 'running'] } },
    {
      $set: {
        status: 'failed',
        completedAt: new Date().toISOString(),
        errorLog: [{ code: 'INTERRUPTED', message: 'Scan was interrupted by a process restart.' }],
      },
    },
  );
  return result.modifiedCount;
}
