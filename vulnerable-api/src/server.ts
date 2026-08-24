/**
 * Vulnerable API Lab — Server Entry Point
 * 
 * Starts the Express server and seeds the in-memory data store.
 * 
 * Known vulnerabilities (intentional):
 *   V01 — BOLA (API1:2023)
 *   V02 — Broken Authentication (API2:2023)
 *   V03 — Unrestricted Resource Consumption (API4:2023)
 *   V04 — Security Misconfiguration (API8:2023)
 *   V05 — Improper Inventory Management (API9:2023)
 */
import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { resetStore } from './config/db.js';

const PORT = process.env.PORT || 5001;

// Seed the data store on startup
resetStore();

const server = app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          🔓 VULNERABLE API LABORATORY                      ║');
  console.log('║          ⚠️  FOR TESTING PURPOSES ONLY                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  🚀 Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('  📋 Known Vulnerabilities:');
  console.log('  ─────────────────────────');
  console.log('  V01  BOLA                    GET  /api/users/:id');
  console.log('  V02  Broken Authentication   GET  /api/admin/users');
  console.log('  V03  Resource Consumption    POST /api/auth/login');
  console.log('  V04  Security Misconfiguration    (headers, errors)');
  console.log('  V05  Inventory Management    GET  /api/v1/users, /api/admin-old');
  console.log('');
  console.log('  🔑 Test Credentials:');
  console.log('  ────────────────────');
  console.log('  admin@test.com   / admin123');
  console.log('  userA@test.com   / password123');
  console.log('  userB@test.com   / password123');
  console.log('');
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Vulnerable API] ❌ Port ${PORT} is already in use.`);
  } else {
    console.error('[Vulnerable API] ❌ Server error:', err.message);
  }
  process.exit(1);
});
