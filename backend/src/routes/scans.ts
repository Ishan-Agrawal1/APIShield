import { Router, type Request, type Response, type NextFunction } from 'express';
import { cancelQueuedOrRunning, createScan, getScan, listScans, previewScan } from '../services/scanService.js';
import { createRouteScan, previewRouteScan } from '../services/adhocScanService.js';
import { listFindings } from '../services/findingService.js';
import { assertReportFormat, buildHtmlReport, buildReport } from '../services/reportService.js';
import type { RouteScanInput, ScannerName } from '@apishield/contracts';

const router = Router();

function extractRouteInput(body: unknown): RouteScanInput {
  const source = (body ?? {}) as Record<string, unknown>;
  return {
    url: String(source.url ?? ''),
    method: String(source.method ?? 'GET'),
    headers: isStringRecord(source.headers) ? (source.headers as Record<string, string>) : undefined,
    pathParams: isStringRecord(source.pathParams) ? (source.pathParams as Record<string, string>) : undefined,
    queryParams: isRecord(source.queryParams) ? (source.queryParams as Record<string, string | string[]>) : undefined,
    body: source.body,
    authorization: typeof source.authorization === 'string' ? source.authorization : null,
    enabledScanners: Array.isArray(source.enabledScanners) ? (source.enabledScanners as ScannerName[]) : undefined,
    label: typeof source.label === 'string' ? source.label : undefined,
  };
}

function isRecord(value: unknown): boolean {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStringRecord(value: unknown): boolean {
  return isRecord(value);
}

router.post('/route/preview', (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(previewRouteScan(extractRouteInput(req.body)));
  } catch (error) {
    next(error);
  }
});

router.post('/route', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scan = await createRouteScan(extractRouteInput(req.body));
    res.status(202).json(scan);
  } catch (error) {
    next(error);
  }
});

router.post('/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await previewScan({
      specificationId: String(req.body?.specificationId ?? ''),
      targetProfileId: String(req.body?.targetProfileId ?? ''),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scan = await createScan({
      specificationId: String(req.body?.specificationId ?? ''),
      targetProfileId: String(req.body?.targetProfileId ?? ''),
      selectedEndpointIds: Array.isArray(req.body?.selectedEndpointIds) ? req.body.selectedEndpointIds.map(String) : undefined,
      enabledScanners: Array.isArray(req.body?.enabledScanners) ? (req.body.enabledScanners as ScannerName[]) : undefined,
      resourceObservations: Boolean(req.body?.resourceObservations),
      dryRun: Boolean(req.body?.dryRun),
      runtimeCredentials: Array.isArray(req.body?.runtimeCredentials)
        ? req.body.runtimeCredentials.map((item: { reference?: unknown; token?: unknown }) => ({
            reference: String(item?.reference ?? ''),
            token: String(item?.token ?? ''),
          }))
        : undefined,
    });
    res.status(202).json(scan);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await listScans(Number(req.query.page) || 1, Number(req.query.limit) || 20);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getScan(String(req.params.id)));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await cancelQueuedOrRunning(String(req.params.id)));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/findings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(
      await listFindings(String(req.params.id), {
        severity: typeof req.query.severity === 'string' ? req.query.severity : undefined,
        vulnerability: typeof req.query.vulnerability === 'string' ? req.query.vulnerability : undefined,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.get('/:id/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = assertReportFormat(typeof req.query.format === 'string' ? req.query.format : 'json');
    if (format === 'html') {
      res.type('html').send(await buildHtmlReport(String(req.params.id)));
      return;
    }
    res.json(await buildReport(String(req.params.id)));
  } catch (error) {
    next(error);
  }
});

export default router;
