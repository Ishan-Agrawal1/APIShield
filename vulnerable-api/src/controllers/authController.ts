/**
 * Authentication Controller
 * 
 * Handles user login and JWT token generation.
 * 
 * VULNERABILITY (V03): No rate limiting on login endpoint.
 * An attacker can make unlimited login attempts without throttling.
 * → API4:2023 — Unrestricted Resource Consumption
 */
import type { Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getUserByEmail } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-insecure-secret-key-12345';

/**
 * POST /api/auth/login
 * 
 * Accepts email + password, returns a JWT token on success.
 * 
 * VULNERABLE: No rate limiting — unlimited login attempts allowed.
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  // Basic input validation
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  // Find user by email
  const user = getUserByEmail(email);
  if (!user) {
    // VULNERABILITY: Slightly different error message reveals whether email exists
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  // Verify password
  const isMatch = await bcryptjs.compare(password, user.password);
  if (!isMatch) {
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  // Generate JWT — no expiration set (another weakness for the lab)
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};
