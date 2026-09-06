import dotenv from 'dotenv';
dotenv.config();

import bcryptjs from 'bcryptjs';
import { Note } from '../models/Note.js';
import { User } from '../models/User.js';
import { connectDB, disconnectDB } from './db.js';
import { SEED_NOTES, SEED_PASSWORD, SEED_USERS } from './fixtures.js';

export async function seedDatabase(): Promise<void> {
  const passwordHash = await bcryptjs.hash(SEED_PASSWORD, 10);

  await User.deleteMany({});
  await Note.deleteMany({});

  await User.create(
    SEED_USERS.map((user) => ({
      _id: user.id,
      email: user.email,
      password: passwordHash,
      role: user.role,
    })),
  );

  await Note.create(
    SEED_NOTES.map((note) => ({
      _id: note.id,
      userId: note.userId,
      title: note.title,
      content: note.content,
    })),
  );
}

export async function seedIfEmpty(): Promise<void> {
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    await seedDatabase();
    console.log('[vulnerable-api] Empty database seeded with default lab data.');
    return;
  }

  console.log('[vulnerable-api] Database already contains users; skipping automatic seed.');
}

const isDirectRun = process.argv[1]?.includes('seed');

if (isDirectRun) {
  const run = async (): Promise<void> => {
    await connectDB();
    await seedDatabase();

    console.log('Vulnerable API lab data reset.');
    console.log('');
    console.log('Users:');
    for (const user of SEED_USERS) {
      console.log(`  id=${user.id}  ${user.email}  role=${user.role}  password=${user.password}`);
    }
    console.log('');
    console.log('Notes:');
    for (const note of SEED_NOTES) {
      console.log(`  id=${note.id}  userId=${note.userId}  title="${note.title}"`);
    }

    await disconnectDB();
  };

  run().catch((error: unknown) => {
    console.error('[vulnerable-api] Seed failed:', error);
    process.exit(1);
  });
}
