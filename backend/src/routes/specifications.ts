import { Router, type Request, type Response, type NextFunction } from 'express';
import { ingestSpecification, getSpecification } from '../services/specificationService.js';
import { listDiscoveryView } from '../scanner/discovery/normalizeEndpoints.js';
import { AppError } from '../utils/errors.js';

const router = Router();

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const content = extractContent(req);
    const spec = await ingestSpecification(content);
    res.status(201).json(spec);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/endpoints', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spec = await getSpecification(String(req.params.id));
    res.json({
      specificationId: spec.id,
      title: spec.title,
      openapiVersion: spec.openapiVersion,
      supportSummary: spec.supportSummary,
      warnings: spec.warnings,
      count: spec.normalizedEndpoints.length,
      endpoints: listDiscoveryView(spec.normalizedEndpoints),
    });
  } catch (error) {
    next(error);
  }
});

function extractContent(req: Request): string {
  if (typeof req.body === 'string' && req.body.trim()) {
    return req.body;
  }
  if (req.body && typeof req.body === 'object' && typeof req.body.content === 'string') {
    return req.body.content;
  }
  throw new AppError(400, 'MISSING_SPEC', 'Upload an OpenAPI document as YAML/JSON text or JSON { content }.');
}

export default router;
