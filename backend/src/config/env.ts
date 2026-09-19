import dotenv from 'dotenv';
import { AppError } from '../utils/errors.js';

dotenv.config();

export interface BackendEnv {
  port: number;
  bindHost: string;
  nodeEnv: string;
  mongoUri: string;
  operatorToken: string;
  allowedHosts: string[];
  allowedOrigins: string[];
  demoUserAEmail: string;
  demoUserAPassword: string;
  demoUserBEmail: string;
  demoUserBPassword: string;
  aiProvider: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
}

let cached: BackendEnv | undefined;

export function loadEnv(): BackendEnv {
  if (cached) {
    return cached;
  }

  const operatorToken =
    process.env.APISHIELD_OPERATOR_TOKEN ||
    (process.env.NODE_ENV === 'production' ? '' : 'local-dev-operator-token');
  if (!operatorToken) {
    throw new AppError(
      500,
      'CONFIG_INVALID',
      'APISHIELD_OPERATOR_TOKEN is required. Copy backend/.env.example and run node scripts/bootstrap-secrets.mjs.',
      false,
    );
  }

  cached = {
    port: Number(process.env.PORT) || 5000,
    bindHost: process.env.BIND_HOST || '127.0.0.1',
    nodeEnv: process.env.NODE_ENV || 'development',
    mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/apishield',
    operatorToken,
    allowedHosts: (process.env.ALLOWED_HOSTS || '127.0.0.1,localhost')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:3000,http://localhost:3000')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    demoUserAEmail: process.env.DEMO_USER_A_EMAIL || 'user1@test.com',
    demoUserAPassword: process.env.DEMO_USER_A_PASSWORD || 'password123',
    demoUserBEmail: process.env.DEMO_USER_B_EMAIL || 'user2@test.com',
    demoUserBPassword: process.env.DEMO_USER_B_PASSWORD || 'password123',
    aiProvider: process.env.AI_PROVIDER || '',
    aiBaseUrl: process.env.AI_BASE_URL || '',
    aiApiKey: process.env.AI_API_KEY || '',
    aiModel: process.env.AI_MODEL || 'gpt-4o-mini',
  };
  return cached;
}

export function resetEnvCache(): void {
  cached = undefined;
}

export function isAiConfigured(): boolean {
  try {
    const env = loadEnv();
    return Boolean(env.aiProvider && env.aiBaseUrl && env.aiApiKey);
  } catch {
    return false;
  }
}
