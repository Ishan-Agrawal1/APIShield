import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const connStr = process.env.MONGO_URI || 'mongodb://localhost:27017/apishield';
    await mongoose.connect(connStr);
    console.log(`[Database] Connected to MongoDB: ${mongoose.connection.host}`);
  } catch (error) {
    console.error('[Database] Connection failed:', error);
    process.exit(1);
  }
};
