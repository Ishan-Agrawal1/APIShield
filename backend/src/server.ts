import { loadEnv } from './config/env.js';
import app from './app.js';
import { connectDB, disconnectDB, reconcileOrphanedScans } from './config/db.js';

const env = loadEnv();

const startServer = async (): Promise<void> => {
  try {
    await connectDB();
    const orphaned = await reconcileOrphanedScans();
    if (orphaned > 0) {
      console.log(JSON.stringify({ msg: 'Reconciled interrupted scans', count: orphaned }));
    }
    const server = app.listen(env.port, env.bindHost, () => {
      console.log(
        JSON.stringify({
          msg: 'APIShield backend listening',
          host: env.bindHost,
          port: env.port,
          notice: 'Authorized local demo only. Uploaded OpenAPI servers cannot grant network access.',
        }),
      );
    });

    const shutdown = async () => {
      server.close();
      await disconnectDB();
      process.exit(0);
    };
    process.on('SIGINT', () => {
      void shutdown();
    });
    process.on('SIGTERM', () => {
      void shutdown();
    });
  } catch (error) {
    console.error('[Server] Failed to start server:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

void startServer();
