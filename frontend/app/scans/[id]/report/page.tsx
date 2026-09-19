'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, isAbortError } from '../../../../lib/api';

interface Report {
  disclaimer: string;
  aiStatus: string;
  counters: { findings: number; executions: number };
  findings: Array<{
    id?: string;
    ruleId: string;
    severity: string;
    description: string;
    remediation: string;
    analysisMode: string;
    optionalAiAnalysis?: { explanation: string; provider: string };
  }>;
}

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api<Report>(`api/scans/${params.id}/report?format=json`, { signal: controller.signal })
      .then(setReport)
      .catch((err: Error) => {
        if (!isAbortError(err)) {
          setError(err.message);
        }
      });
    return () => controller.abort();
  }, [params.id]);

  if (error) return <p className="error">{error}</p>;
  if (!report) return <p className="muted">Loading report…</p>;

  return (
    <section className="panel">
      <h1>Report</h1>
      <p>{report.disclaimer}</p>
      <p className="muted">Findings {report.counters.findings} · executions {report.counters.executions} · AI {report.aiStatus}</p>
      {report.findings.length === 0 ? (
        <p className="muted">No findings in tested scope. This is not a certificate that the API is secure.</p>
      ) : (
        report.findings.map((finding, index) => (
          <article key={finding.id ?? `${finding.ruleId}-${index}`}>
            <h2>{finding.ruleId} ({finding.severity})</h2>
            <p>{finding.description}</p>
            <p>{finding.remediation}</p>
            <p className="muted">
              {finding.analysisMode === 'ai_assisted' ? 'AI-assisted explanation' : 'Rule-based explanation'}
            </p>
            {finding.optionalAiAnalysis?.explanation ? <p>{finding.optionalAiAnalysis.explanation}</p> : null}
          </article>
        ))
      )}
      <p>
        <a href={`/api/proxy/api/scans/${params.id}/report?format=json`}>Download JSON</a>
        {' · '}
        <a href={`/api/proxy/api/scans/${params.id}/report?format=html`} target="_blank" rel="noreferrer">
          Printable HTML
        </a>
      </p>
    </section>
  );
}
