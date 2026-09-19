import { Router, type Request, type Response, type NextFunction } from 'express';
import { getFinding } from '../services/findingService.js';

const router = Router();

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getFinding(String(req.params.id)));
  } catch (error) {
    next(error);
  }
});

export default router;
