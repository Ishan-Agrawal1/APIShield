/**
 * Seed script — resets the in-memory data store.
 * 
 * Run with: npm run seed
 * Also called automatically on server startup.
 */
import { resetStore, getUsers, getProducts } from './db.js';

console.log('╔══════════════════════════════════════════════╗');
console.log('║   Vulnerable API Lab — Seed Script          ║');
console.log('╚══════════════════════════════════════════════╝');
console.log('');

resetStore();

console.log('');
console.log('Seeded Users:');
console.log('─────────────');
for (const u of getUsers()) {
  console.log(`  ID: ${u.id} | ${u.name} | ${u.email} | Role: ${u.role}`);
}

console.log('');
console.log('Seeded Products:');
console.log('────────────────');
for (const p of getProducts()) {
  console.log(`  ID: ${p.id} | ${p.name} | $${p.price} | Created by User ${p.createdBy}`);
}

console.log('');
console.log('Test Credentials:');
console.log('─────────────────');
console.log('  admin@test.com   / admin123');
console.log('  userA@test.com   / password123');
console.log('  userB@test.com   / password123');
console.log('');
console.log('✅ Seed complete.');
