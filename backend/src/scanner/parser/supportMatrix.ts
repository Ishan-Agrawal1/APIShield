import type { SupportStatus, SupportSummary } from '@apishield/contracts';

export interface SupportIssue {
  construct: string;
  location: string;
  reason: string;
  affects: Array<'discovery' | 'validation' | 'generation' | 'execution'>;
}

export function buildSupportSummary(
  versionFamily: string,
  issues: SupportIssue[],
  discoveredCount: number,
): SupportSummary {
  const rank = (status: SupportStatus): number =>
    status === 'unsupported' ? 2 : status === 'partial' ? 1 : 0;

  const summary: SupportSummary = {
    discovery: discoveredCount > 0 ? 'supported' : 'partial',
    validation: 'supported',
    generation: 'supported',
    execution: versionFamily === '3.2' ? 'partial' : 'supported',
    unsupportedConstructs: issues.map(({ construct, location, reason }) => ({ construct, location, reason })),
  };

  for (const issue of issues) {
    for (const area of issue.affects) {
      if (rank('partial') > rank(summary[area])) {
        summary[area] = 'partial';
      }
    }
  }

  if (versionFamily === 'other') {
    summary.discovery = 'unsupported';
    summary.validation = 'unsupported';
    summary.generation = 'unsupported';
    summary.execution = 'unsupported';
  }
  return summary;
}

export const PUBLISHED_SUPPORT_MATRIX = {
  '3.0.x': {
    discovery: 'ordinary REST paths/methods, parameters, JSON bodies, bearer/http/apiKey schemes',
    execution: 'HTTP methods get/put/post/delete/options/head/patch/trace',
  },
  '3.1.x': {
    discovery: 'same REST subset; JSON Schema 2020-12 keywords are preserved but not fully generated',
    execution: 'same as 3.0 for ordinary REST operations',
  },
  '3.2.x': {
    discovery: 'recognizes query operations and additionalOperations; they are not executed',
    execution: 'unsupported for query/additionalOperations; ordinary HTTP methods remain executable',
  },
};
