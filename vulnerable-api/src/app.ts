/**
 * Express Application Setup
 * 
 * VULNERABILITY (V04 — Security Misconfiguration):
 *   - No security headers (no Helmet)
 *   - X-Powered-By header exposed
 *   - CORS set to allow all origins (*)
 *   - Verbose error handler leaks stack traces
 *   - No request size limits
 * → API8:2023 — Security Misconfiguration
 */
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import router from './routes/index.js';

const app: Express = express();

// ─── Security Misconfiguration (V04) ─────────────────────────────────
// ⚠️  X-Powered-By is NOT disabled (Express default reveals framework)
// ⚠️  No Helmet — missing security headers
// ⚠️  CORS allows ALL origins
// ⚠️  No request body size limits

app.use(cors({
  origin: '*',                  // ⚠️  Allows any origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['*'],        // ⚠️  Allows any header
}));

app.use(express.json());        // ⚠️  No body size limit
app.use(express.urlencoded({ extended: true }));

// ─── Request Logger ──────────────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ─── Health Check ────────────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    // ⚠️  Exposes internal server info (misconfiguration)
    environment: process.env.NODE_ENV,
    nodeVersion: process.version,
  });
});

// ─── API Routes ──────────────────────────────────────────────────────
app.use('/api', router);

// ─── 404 Handler ─────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// ─── Global Error Handler (V04 — Verbose Errors) ────────────────────
// ⚠️  VULNERABLE: Leaks full stack traces and internal error details.
// A secure API would return a generic error message.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err.stack || err.message);

  // ⚠️  SECURITY MISCONFIGURATION: Exposes internal error details
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,                    // ⚠️  Leaks error message
    stack: err.stack,                        // ⚠️  Leaks full stack trace
    type: err.constructor.name,              // ⚠️  Leaks error type
    hint: 'This verbose error is intentional for the vulnerable API lab',
  });
});

export default app;
