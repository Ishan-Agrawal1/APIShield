import type { Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import { nextNumericId } from '../config/db.js';
import { toPublicUser, User } from '../models/User.js';
import { signAuthToken } from '../utils/tokens.js';

export async function register(req: Request, res: Response): Promise<void> {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409).json({ error: 'A user with that email already exists.' });
    return;
  }

  const user = await User.create({
    _id: await nextNumericId(User),
    email,
    password: await bcryptjs.hash(password, 10),
    role: 'user',
  });

  const token = signAuthToken({
    userId: user._id,
    email: user.email,
    role: user.role,
  });

  res.status(201).json({
    token,
    userId: user._id,
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const user = await User.findOne({ email });
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  const matches = await bcryptjs.compare(password, user.password);
  if (!matches) {
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  const token = signAuthToken({
    userId: user._id,
    email: user.email,
    role: user.role,
  });

  res.json({
    token,
    userId: user._id,
  });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user?.userId);
  if (!user) {
    res.status(401).json({ error: 'Authenticated user no longer exists.' });
    return;
  }

  res.json(toPublicUser(user));
}
