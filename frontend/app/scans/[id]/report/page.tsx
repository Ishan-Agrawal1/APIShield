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

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-terminal-critical border-terminal-critical',
  high: 'text-terminal-high border-terminal-high',
  medium: 'text-terminal-medium border-terminal-medium',
  low: 'text-terminal-low border-terminal-low',
  informational: 'text-terminal-info border-terminal-info',
};

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

  if (error) return <div className="p-8 text-terminal-critical border border-terminal-critical bg-terminal-bg">ERR: {error}</div>;
  if (!report) return <div className="p-8 text-terminal-accent animate-pulse bg-terminal-bg border border-terminal-border">LOADING REPORT DATA...</div>;

  return (
    <div className="shell min-h-screen">
      <header className="top">
        <a href="/" className="brand">APIShield</a>
      </header>

      <section className="bg-terminal-panel border border-terminal-border p-6 max-w-5xl mx-auto mt-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-terminal-border pb-4 mb-6">
          <div>
            <h1 className="!mt-0 !mb-1 !border-0 text-2xl text-white">SCAN_REPORT</h1>
            <p className="text-terminal-muted text-xs font-mono">
              FINDINGS: <span className="text-terminal-accent font-bold">{report.counters.findings}</span> // 
              EXECUTIONS: <span className="text-terminal-accent font-bold">{report.counters.executions}</span> // 
              AI_STATUS: <span className="text-terminal-text">{report.aiStatus}</span>
            </p>
          </div>
          <div className="flex gap-4">
            <a className="button focus-visible-ring" href={`/api/proxy/api/scans/${params.id}/report?format=json`} target="_blank" rel="noreferrer">
              RAW_JSON
            </a>
            <a className="button focus-visible-ring" href={`/api/proxy/api/scans/${params.id}/report?format=html`} target="_blank" rel="noreferrer">
              PRINTABLE_HTML
            </a>
          </div>
        </div>

        <div className="mb-8 p-4 border border-terminal-muted bg-terminal-bg/50">
          <p className="text-xs text-terminal-muted uppercase leading-relaxed m-0">{report.disclaimer}</p>
        </div>

        {report.findings.length === 0 ? (
          <div className="p-8 text-center text-terminal-muted border border-terminal-border bg-terminal-bg">
            <p>NO FINDINGS IN TESTED SCOPE.</p>
            <p className="text-xs mt-2 opacity-50">THIS IS NOT A CERTIFICATE THAT THE API IS SECURE.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-sm border-b border-terminal-border pb-2">FINDINGS_LOG</h2>
            {report.findings.map((finding, index) => {
              const colorClass = SEVERITY_COLORS[finding.severity.toLowerCase()] || SEVERITY_COLORS.informational;
              
              return (
                <article key={finding.id ?? `${finding.ruleId}-${index}`} className="border border-terminal-border bg-terminal-bg p-4 flex flex-col gap-4">
                  <header className={`border-b border-terminal-border/30 pb-2 flex justify-between items-start`}>
                    <h3 className="!mt-0 !mb-0 text-white font-mono">{finding.ruleId}</h3>
                    <span className={`px-2 py-0.5 text-xs font-bold border ${colorClass}`}>
                      {finding.severity.toUpperCase()}
                    </span>
                  </header>
                  
                  <div className="text-sm text-terminal-text">
                    {finding.description}
                  </div>
                  
                  <div className="text-sm bg-terminal-panel p-3 border border-terminal-border">
                    <div className="text-xs text-terminal-muted uppercase mb-1">REMEDIATION</div>
                    <div className="text-terminal-text">{finding.remediation}</div>
                  </div>

                  <div className="text-xs text-terminal-muted font-mono flex items-center gap-2">
                    <span>ANALYSIS_MODE:</span>
                    <span className="bg-terminal-panel px-1 border border-terminal-border text-terminal-text">
                      {finding.analysisMode === 'ai_assisted' ? 'AI-ASSISTED' : 'RULE-BASED'}
                    </span>
                  </div>

                  {finding.optionalAiAnalysis?.explanation && (
                    <div className="mt-2 border border-terminal-accent/30 bg-terminal-accent/5 p-4 text-sm">
                      <div className="text-terminal-accent mb-2 flex items-center gap-2">
                        <span className="animate-pulse">_</span> AI_EXPLANATION 
                        <span className="text-[10px] text-terminal-muted ml-auto font-normal">via {finding.optionalAiAnalysis.provider}</span>
                      </div>
                      <div className="text-terminal-text leading-relaxed">
                        {finding.optionalAiAnalysis.explanation}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
