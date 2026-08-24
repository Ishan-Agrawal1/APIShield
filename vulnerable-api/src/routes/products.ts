/**
 * Product Routes
 * 
 * GET  /api/products — List all products (public)
 * POST /api/products — Create a product (requires auth)
 */
import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { getProducts, addProduct } from '../config/db.js';

const router = Router();

// GET /api/products — Public endpoint, no auth required
router.get('/', (_req, res) => {
  res.json(getProducts());
});

// POST /api/products — Requires authentication
router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const { name, price, description } = req.body;

  if (!name || price === undefined) {
    res.status(400).json({ error: 'Name and price are required.' });
    return;
  }

  const products = getProducts();
  const newProduct = {
    id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1,
    name,
    price: Number(price),
    description: description || '',
    createdBy: req.user?.userId || 0,
  };

  addProduct(newProduct);
  res.status(201).json(newProduct);
});

export default router;
