export interface AiProvider {
  explain(payload: Record<string, unknown>): Promise<{
    explanation: string;
    potentialImpact: string;
    remediation: string;
    developerSummary: string;
  }>;
}
