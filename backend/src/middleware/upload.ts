import type { NextFunction, Request, Response } from 'express';
import { LIMITS } from '../config/limits.js';
import { AppError } from '../utils/errors.js';

export function boundedBody(req: Request, _res: Response, next: NextFunction): void {
  const lengthHeader = req.headers['content-length'];
  if (lengthHeader) {
    const length = Number(lengthHeader);
    if (Number.isFinite(length) && length > LIMITS.openApiUploadBytes) {
      next(new AppError(413, 'UPLOAD_TOO_LARGE', 'Upload exceeds the 2 MiB limit.'));
      return;
    }
  }
  next();
}
