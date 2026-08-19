import { Router, type Request, type Response } from 'express';
import products from '../data/products.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json(products);
});

export default router;
