import mongoose from 'mongoose';
import { getMongoUri } from './env.js';

export async function connectDB(uri = getMongoUri()): Promise<void> {
  if (mongoose.connection.readyState === 1 && mongoose.connection.getClient()) {
    return;
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
  console.log(`[vulnerable-api] Connected to MongoDB (${mongoose.connection.name})`);
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export async function connectWithRetry(retries = 10, delayMs = 1000): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await connectDB();
      return;
    } catch (error) {
      lastError = error;
      console.error(
        `[vulnerable-api] MongoDB connection attempt ${attempt}/${retries} failed. Retrying...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

export async function nextNumericId(model: { findOne: () => { sort: (spec: { _id: -1 }) => { lean: () => Promise<{ _id: number } | null> } } }): Promise<number> {
  const last = await model.findOne().sort({ _id: -1 }).lean();
  return last ? last._id + 1 : 1;
}
