'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, isAbortError } from '../../../lib/api';

interface Finding {
  id: string;
  ruleId: string;
  severity: string;
  confidence: string;
  description: string;
  remediation: string;
  analysisMode: string;
  evidence: { summary: string; conclusion: string };
  optionalAiAnalysis?: {
    explanation: string;
    potentialImpact: string;
    remediation: string;
    developerSummary: string;
    provider: string;
  };
}

export default function FindingPage() {
  const params = useParams<{ id: string }>();
  const [finding, setFinding] = useState<Finding | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api<Finding>(`api/findings/${params.id}`, { signal: controller.signal })
      .then(setFinding)
      .catch((err: Error) => {
        if (!isAbortError(err)) {
          setError(err.message);
        }
      });
    return () => controller.abort();
  }, [params.id]);

  if (error) return <p className="error">{error}</p>;
  if (!finding) return <p className="muted">Loading finding…</p>;

  const analysis = finding.optionalAiAnalysis;
  const aiAssisted = finding.analysisMode === 'ai_assisted';

  return (
    <section className="panel">
      <h1>{finding.ruleId}</h1>
      <p>{finding.severity} / {finding.confidence}</p>
      <p>{finding.description}</p>
      <h2>Evidence</h2>
      <pre>{`${finding.evidence.summary}\n${finding.evidence.conclusion}`}</pre>
      <h2>Remediation</h2>
      <p>{finding.remediation}</p>
      <h2>Explanation</h2>
      <p className="muted">{aiAssisted ? 'AI-assisted explanation' : 'Rule-based explanation'}{analysis?.provider ? ` · ${analysis.provider}` : ''}</p>
      <p>{analysis?.explanation ?? 'No additional explanation is attached.'}</p>
      {analysis?.potentialImpact ? (
        <>
          <h2>Potential impact</h2>
          <p>{analysis.potentialImpact}</p>
        </>
      ) : null}
      {analysis?.developerSummary ? (
        <>
          <h2>Developer summary</h2>
          <p>{analysis.developerSummary}</p>
        </>
      ) : null}
    </section>
  );
}
