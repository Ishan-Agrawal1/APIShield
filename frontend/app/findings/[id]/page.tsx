'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, isAbortError } from '../../../lib/api';

interface FindingDetail {
  id: string;
  ruleId: string;
  vulnerability: string;
  severity: string;
  confidence: string;
  description: string;
  remediation: string;
  analysisMode: string;
  method?: string;
  endpoint?: string;
  affectedParameter?: string;
  evidence: { 
    summary: string; 
    conclusion: string;
    request?: string;
    response?: string;
  };
  optionalAiAnalysis?: {
    explanation: string;
    potentialImpact: string;
    remediation: string;
    developerSummary: string;
    provider: string;
  };
}

const SEVERITY_CONFIG: Record<string, { color: string; icon: string }> = {
  critical: { color: 'text-terminal-critical border-terminal-critical', icon: '▲' },
  high: { color: 'text-terminal-high border-terminal-high', icon: '◆' },
  medium: { color: 'text-terminal-medium border-terminal-medium', icon: '■' },
  low: { color: 'text-terminal-low border-terminal-low', icon: '▼' },
  informational: { color: 'text-terminal-info border-terminal-info', icon: '●' },
};

export default function FindingPage() {
  const params = useParams<{ id: string }>();
  const [finding, setFinding] = useState<FindingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api<FindingDetail>(`api/findings/${params.id}`, { signal: controller.signal })
      .then(setFinding)
      .catch((err: Error) => {
        if (!isAbortError(err)) {
          setError(err.message);
        }
      });
    return () => controller.abort();
  }, [params.id]);

  if (error) return <div className="p-8 text-terminal-critical bg-terminal-bg border border-terminal-critical">ERR_FETCH: {error}</div>;
  if (!finding) return <div className="p-8 text-terminal-accent animate-pulse bg-terminal-bg">FETCHING DETAIL DATA...</div>;

  const config = SEVERITY_CONFIG[finding.severity.toLowerCase()] || SEVERITY_CONFIG.informational;
  const analysis = finding.optionalAiAnalysis;

  return (
    <div className="shell min-h-screen">
      <header className="top">
        <a href="/" className="brand">APIShield</a>
      </header>
      
      <div className="bg-terminal-panel border border-terminal-border p-6 max-w-4xl mx-auto mt-8">
        <div className={`border-b-2 ${config.color} pb-4 mb-6`}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <h2 className="!mt-0 !mb-1 text-2xl !border-0 text-white">{finding.vulnerability || finding.ruleId}</h2>
              <div className="text-terminal-muted text-xs font-mono">RULE: {finding.ruleId}</div>
            </div>
            <span className={`px-2 py-1 border font-bold flex items-center gap-2 ${config.color}`}>
              <span>{config.icon}</span>
              <span>{finding.severity.toUpperCase()}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-terminal-muted uppercase mt-2">
            {finding.method && finding.endpoint && (
               <span>TARGET: <span className="text-terminal-text bg-terminal-panel px-1 border border-terminal-border font-mono">{finding.method} {finding.endpoint}</span></span>
            )}
            <span>CONFIDENCE: <span className="text-terminal-text">{finding.confidence}</span></span>
            <span>MODE: <span className="text-terminal-text">{finding.analysisMode === 'ai_assisted' ? 'AI-ASSISTED' : 'RULE-BASED'}</span></span>
            <span>ID: <span className="text-terminal-text">{finding.id}</span></span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <section>
            <h3>Overview</h3>
            <p className="text-terminal-text leading-relaxed">{finding.description}</p>
            {finding.affectedParameter && (
              <div className="mt-4">
                <span className="text-terminal-muted text-xs uppercase mr-2">AFFECTED PARAMETER:</span>
                <span className="text-terminal-accent bg-terminal-bg px-2 py-1 border border-terminal-accent/30 font-mono text-sm">{finding.affectedParameter}</span>
              </div>
            )}
          </section>

          <section>
            <h3>Evidence</h3>
            <div className="bg-terminal-bg border border-terminal-border p-4 text-sm flex flex-col gap-4">
              <div>
                <div className="mb-1 text-terminal-muted text-xs">SUMMARY</div>
                <pre className="!border-0 !p-0 !bg-transparent">{finding.evidence.summary}</pre>
              </div>
              
              {finding.evidence.request && (
                <div className="border-t border-terminal-border pt-4">
                  <div className="mb-2 text-terminal-muted text-xs uppercase">Request</div>
                  <pre className="text-terminal-medium !p-2 !bg-terminal-panel !border-terminal-border">{finding.evidence.request}</pre>
                </div>
              )}
              
              {finding.evidence.response && (
                <div className="border-t border-terminal-border pt-4">
                  <div className="mb-2 text-terminal-muted text-xs uppercase">Response</div>
                  <pre className="text-terminal-low !p-2 !bg-terminal-panel !border-terminal-border">{finding.evidence.response}</pre>
                </div>
              )}

              <div className="border-t border-terminal-border pt-4">
                <div className="mb-1 text-terminal-muted text-xs uppercase">CONCLUSION</div>
                <pre className="!border-0 !p-0 !bg-transparent">{finding.evidence.conclusion}</pre>
              </div>
            </div>
          </section>

          {analysis ? (
            <section className="border border-terminal-accent/30 bg-terminal-accent/5 p-4">
              <h3 className="!mt-0 text-terminal-accent flex items-center gap-2">
                <span className="animate-pulse">_</span> AI ANALYSIS
                {analysis.provider && <span className="text-xs text-terminal-muted font-normal ml-auto">via {analysis.provider}</span>}
              </h3>
              
              <div className="space-y-4 text-sm mt-4">
                <div>
                  <div className="text-terminal-muted mb-1 text-xs uppercase">Explanation</div>
                  <div className="text-terminal-text leading-relaxed">{analysis.explanation}</div>
                </div>
                
                {analysis.potentialImpact && (
                  <div>
                    <div className="text-terminal-muted mb-1 text-xs uppercase">Risk & Impact</div>
                    <div className="text-terminal-critical leading-relaxed">{analysis.potentialImpact}</div>
                  </div>
                )}
                
                {analysis.developerSummary && (
                  <div>
                    <div className="text-terminal-muted mb-1 text-xs uppercase">TL;DR for Devs</div>
                    <div className="text-terminal-text leading-relaxed">{analysis.developerSummary}</div>
                  </div>
                )}
                
                {analysis.remediation && (
                  <div>
                    <div className="text-terminal-muted mb-1 text-xs uppercase">Suggested Fix</div>
                    <pre className="mt-1">{analysis.remediation}</pre>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          <section>
            <h3>Remediation</h3>
            <div className="text-terminal-text leading-relaxed">{finding.remediation}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
