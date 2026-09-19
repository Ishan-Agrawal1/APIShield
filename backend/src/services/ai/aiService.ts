import type { Finding } from '@apishield/contracts';
import { z } from 'zod';
import { isAiConfigured, loadEnv } from '../../config/env.js';
import { LIMITS } from '../../config/limits.js';
import { minimizeForAi } from '../../utils/sanitize.js';
import { ruleBasedAnalysis } from './fallback.js';
import type { AiProvider } from './provider.js';
import { OpenAiCompatibleProvider } from './openAiCompatibleProvider.js';

let injected: AiProvider | undefined;

export function setAiProviderForTests(provider: AiProvider | undefined): void {
  injected = provider;
}

export async function attachAiAnalysis(findings: Finding[]): Promise<Finding[]> {
  const provider = injected;
  const liveProvider = provider ?? (isAiConfigured() ? new OpenAiCompatibleProvider(loadEnv()) : undefined);
  const output: Finding[] = [];
  for (const finding of findings) {
    const fallback = ruleBasedAnalysis(finding);
    if (!liveProvider) {
      output.push({
        ...finding,
        analysisMode: 'rule_based',
        optionalAiAnalysis: {
          ...fallback,
          provider: 'rule_based',
          generatedAt: new Date().toISOString(),
        },
      });
      continue;
    }
    const payload = minimizeForAi(finding as unknown as Record<string, unknown>);
    if (!payload) {
      output.push({
        ...finding,
        analysisMode: 'rule_based',
        optionalAiAnalysis: {
          ...fallback,
          provider: 'rule_based',
          generatedAt: new Date().toISOString(),
        },
      });
      continue;
    }
    try {
      const analysis = await liveProvider.explain(payload);
      output.push({
        ...finding,
        analysisMode: 'ai_assisted',
        optionalAiAnalysis: {
          ...analysis,
          provider: 'injected-or-configured',
          generatedAt: new Date().toISOString(),
        },
      });
    } catch {
      output.push({
        ...finding,
        analysisMode: 'rule_based',
        optionalAiAnalysis: {
          ...fallback,
          provider: 'rule_based',
          generatedAt: new Date().toISOString(),
        },
      });
    }
  }
  return output;
}

export const aiOutputSchema = z.object({
  explanation: z.string(),
  potentialImpact: z.string(),
  remediation: z.string(),
  developerSummary: z.string(),
});

export { LIMITS };
