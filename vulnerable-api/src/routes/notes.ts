import { Router } from 'express';
import {
  createNote,
  deleteNoteById,
  getNoteById,
  listNotes,
  patchNoteById,
} from '../controllers/noteController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, listNotes);
router.post('/', authMiddleware, createNote);
router.get('/:id', authMiddleware, getNoteById);
router.patch('/:id', authMiddleware, patchNoteById);
router.delete('/:id', authMiddleware, deleteNoteById);

export default router;
