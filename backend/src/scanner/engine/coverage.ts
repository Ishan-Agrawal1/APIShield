import type { CheckOutcome } from '@apishield/contracts';

export function summarizeCoverage(
  rows: Array<{ scanner: string; outcome: CheckOutcome; reason?: string; casesPlanned: number; casesExecuted: number }>,
): { status: 'completed' | 'partial' | 'failed'; errors: number } {
  const errored = rows.filter((row) => row.outcome === 'error').length;
  const skipped = rows.filter((row) => row.outcome === 'skipped').length;
  if (errored > 0 && rows.every((row) => row.outcome === 'error' || row.casesExecuted === 0)) {
    return { status: 'failed', errors: errored };
  }
  if (errored > 0 || skipped > 0) {
    return { status: 'partial', errors: errored };
  }
  return { status: 'completed', errors: 0 };
}

export function progressFromCounts(totalPlanned: number, executed: number, skipped: number, errored: number) {
  const percent = totalPlanned === 0 ? 100 : Math.min(100, Math.round(((executed + skipped + errored) / totalPlanned) * 100));
  return { totalPlanned, executed, skipped, errored, percent };
}
