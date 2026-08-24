/**
 * In-memory data store for the vulnerable API lab.
 * 
 * Uses simple arrays instead of a real database for simplicity.
 * Data is pre-seeded with test users and products on import.
 * 
 * Test Users:
 *   - Admin  (ID: 1)   — admin@test.com    / admin123
 *   - User A (ID: 101) — userA@test.com     / password123
 *   - User B (ID: 102) — userB@test.com     / password123
 */
import bcryptjs from 'bcryptjs';
import type { User } from '../models/User.js';
import type { Product } from '../models/Product.js';

// ---------------------------------------------------------------------------
// Pre-hash passwords synchronously so the store is ready at import time.
// In a real app you'd never do this — passwords would be hashed at signup.
// ---------------------------------------------------------------------------
const SALT_ROUNDS = 10;
const hashedPassword123 = bcryptjs.hashSync('password123', SALT_ROUNDS);
const hashedAdmin123 = bcryptjs.hashSync('admin123', SALT_ROUNDS);

// ---------------------------------------------------------------------------
// Users store
// ---------------------------------------------------------------------------
let users: User[] = [
  {
    id: 1,
    name: 'Admin',
    email: 'admin@test.com',
    password: hashedAdmin123,
    role: 'admin',
  },
  {
    id: 101,
    name: 'User A',
    email: 'userA@test.com',
    password: hashedPassword123,
    role: 'user',
  },
  {
    id: 102,
    name: 'User B',
    email: 'userB@test.com',
    password: hashedPassword123,
    role: 'user',
  },
];

// ---------------------------------------------------------------------------
// Products store
// ---------------------------------------------------------------------------
let products: Product[] = [
  {
    id: 1,
    name: 'Widget',
    price: 9.99,
    description: 'A basic widget',
    createdBy: 101,
  },
  {
    id: 2,
    name: 'Gadget',
    price: 19.99,
    description: 'A fancy gadget',
    createdBy: 102,
  },
  {
    id: 3,
    name: 'Doohickey',
    price: 4.49,
    description: 'A small doohickey',
    createdBy: 1,
  },
];

// ---------------------------------------------------------------------------
// Accessor helpers
// ---------------------------------------------------------------------------
export const getUsers = (): User[] => users;

export const getUserById = (id: number): User | undefined =>
  users.find((u) => u.id === id);

export const getUserByEmail = (email: string): User | undefined =>
  users.find((u) => u.email === email);

export const getProducts = (): Product[] => products;

export const addProduct = (product: Product): void => {
  products.push(product);
};

// ---------------------------------------------------------------------------
// Reset — used by the seed script and tests
// ---------------------------------------------------------------------------
export const resetStore = (): void => {
  const freshHashedPassword123 = bcryptjs.hashSync('password123', SALT_ROUNDS);
  const freshHashedAdmin123 = bcryptjs.hashSync('admin123', SALT_ROUNDS);

  users = [
    { id: 1, name: 'Admin', email: 'admin@test.com', password: freshHashedAdmin123, role: 'admin' },
    { id: 101, name: 'User A', email: 'userA@test.com', password: freshHashedPassword123, role: 'user' },
    { id: 102, name: 'User B', email: 'userB@test.com', password: freshHashedPassword123, role: 'user' },
  ];

  products = [
    { id: 1, name: 'Widget', price: 9.99, description: 'A basic widget', createdBy: 101 },
    { id: 2, name: 'Gadget', price: 19.99, description: 'A fancy gadget', createdBy: 102 },
    { id: 3, name: 'Doohickey', price: 4.49, description: 'A small doohickey', createdBy: 1 },
  ];

  console.log('[Seed] ✅ Data store reset with default users and products.');
};
