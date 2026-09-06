import type { Request, Response } from 'express';
import { nextNumericId } from '../config/db.js';
import { INTERNAL_NOTES_FETCH_CAP } from '../config/fixtures.js';
import { Note, toPublicNote } from '../models/Note.js';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseNoteId(value: string | string[] | undefined): number | null {
  const id = Number(firstParam(value));
  return Number.isInteger(id) ? id : null;
}

export async function listNotes(req: Request, res: Response): Promise<void> {
  const requesterId = req.user?.userId;
  if (!requesterId) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const rawLimit = req.query.limit;
  let requestedLimit: number | null = null;

  if (rawLimit !== undefined) {
    requestedLimit = Number(rawLimit);
    if (!Number.isFinite(requestedLimit) || requestedLimit < 0) {
      res.status(400).json({ error: 'limit must be a non-negative number.' });
      return;
    }
  }

  // INTENTIONAL V4: excessively large limit values are accepted.
  // Actual fetch work is capped so the lab does not become a real DoS target.
  const fetchLimit = requestedLimit === null
    ? INTERNAL_NOTES_FETCH_CAP
    : Math.min(requestedLimit, INTERNAL_NOTES_FETCH_CAP);

  const notes = await Note.find({ userId: requesterId })
    .sort({ _id: 1 })
    .limit(fetchLimit);

  res.json({
    notes: notes.map((note) => toPublicNote(note)),
    count: notes.length,
    limit: requestedLimit,
    accepted: requestedLimit === null ? true : requestedLimit >= 0,
    internalFetchCap: INTERNAL_NOTES_FETCH_CAP,
  });
}

export async function createNote(req: Request, res: Response): Promise<void> {
  const requesterId = req.user?.userId;
  if (!requesterId) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const content = typeof req.body?.content === 'string' ? req.body.content : '';

  if (!title) {
    res.status(400).json({ error: 'title is required.' });
    return;
  }

  const note = await Note.create({
    _id: await nextNumericId(Note),
    userId: requesterId,
    title,
    content,
  });

  res.status(201).json(toPublicNote(note));
}

export async function getNoteById(req: Request, res: Response): Promise<void> {
  const id = parseNoteId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'Invalid note id.' });
    return;
  }

  const note = await Note.findById(id);
  if (!note) {
    res.status(404).json({ error: 'Note not found.' });
    return;
  }

  // INTENTIONAL V1 BOLA: authenticate the caller, but do not enforce note ownership.
  res.json(toPublicNote(note));
}

export async function patchNoteById(req: Request, res: Response): Promise<void> {
  const id = parseNoteId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'Invalid note id.' });
    return;
  }

  const note = await Note.findById(id);
  if (!note) {
    res.status(404).json({ error: 'Note not found.' });
    return;
  }

  if (typeof req.body?.title === 'string') {
    const title = req.body.title.trim();
    if (!title) {
      res.status(400).json({ error: 'title cannot be empty.' });
      return;
    }
    note.title = title;
  }

  if (typeof req.body?.content === 'string') {
    note.content = req.body.content;
  }

  // INTENTIONAL V2 BOLA: authenticate the caller, but do not enforce note ownership.
  await note.save();
  res.json(toPublicNote(note));
}

export async function deleteNoteById(req: Request, res: Response): Promise<void> {
  const id = parseNoteId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'Invalid note id.' });
    return;
  }

  const requesterId = req.user?.userId;
  const note = await Note.findById(id);
  if (!note) {
    res.status(404).json({ error: 'Note not found.' });
    return;
  }

  if (note.userId !== requesterId) {
    res.status(403).json({ error: 'Forbidden. Notes may only be deleted by their owner.' });
    return;
  }

  await note.deleteOne();
  res.json({ deleted: true, id: note._id });
}
