import type { Request, Response } from 'express';
import { toPublicUser, User } from '../models/User.js';

export async function listUsers(_req: Request, res: Response): Promise<void> {
  const users = await User.find().sort({ _id: 1 });
  res.json(users.map((user) => toPublicUser(user)));
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(rawId);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid user id.' });
    return;
  }

  const requester = req.user;
  if (!requester) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  if (requester.userId !== id && requester.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden. Users may only view their own profile.' });
    return;
  }

  const user = await User.findById(id);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  res.json(toPublicUser(user));
}
