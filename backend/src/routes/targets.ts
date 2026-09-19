import { Router, type Request, type Response } from 'express';
import { publicTargetProfiles } from '../config/targetProfiles.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    notice: 'Only these server-side profiles may be scanned. Uploaded OpenAPI servers do not grant network access.',
    items: publicTargetProfiles(),
  });
});

export default router;
