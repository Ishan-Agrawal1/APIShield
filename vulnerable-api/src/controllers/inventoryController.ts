import type { Request, Response } from 'express';
import { Note } from '../models/Note.js';

export async function getV1Notes(req: Request, res: Response): Promise<void> {
  const requesterId = req.user?.userId;
  if (!requesterId) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const notes = await Note.find({ userId: requesterId }).sort({ _id: 1 });
  res.json({
    version: 'v1',
    notes: notes.map((note) => ({
      id: note._id,
      userId: note.userId,
      title: note.title,
      content: note.content,
    })),
  });
}

export async function getV2Notes(req: Request, res: Response): Promise<void> {
  const requesterId = req.user?.userId;
  if (!requesterId) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const notes = await Note.find({ userId: requesterId }).sort({ _id: 1 });
  res.json({
    apiVersion: '2.0',
    result: {
      count: notes.length,
      items: notes.map((note) => ({
        noteId: note._id,
        ownerId: note.userId,
        headline: note.title,
        body: note.content,
        timestamps: {
          created: note.createdAt.toISOString(),
          updated: note.updatedAt.toISOString(),
        },
      })),
    },
  });
}

export function getDebug(_req: Request, res: Response): void {
  res.json({
    service: 'vulnerable-api',
    version: '1.0.0',
    status: 'ok',
    purpose: 'lab diagnostic',
    documentedInventory: [
      'POST /auth/register',
      'POST /auth/login',
      'GET /auth/me',
      'GET /api/users',
      'GET /api/users/{id}',
      'GET /api/notes',
      'POST /api/notes',
      'GET /api/notes/{id}',
      'PATCH /api/notes/{id}',
      'DELETE /api/notes/{id}',
    ],
    note: 'This endpoint is intentionally omitted from openapi.yaml so APIShield can later compare declared versus observed inventory.',
  });
}

export function getHealth(_req: Request, res: Response): void {
  res.json({
    status: 'ok',
    service: 'vulnerable-api',
  });
}
