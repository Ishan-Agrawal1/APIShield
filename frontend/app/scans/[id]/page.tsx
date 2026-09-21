'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, isAbortError } from '../../../lib/api';

interface Scan {
  id: string;
  status: string;
  progress: { percent: number; executed: number; skipped: number; errored: number; totalPlanned: number };
  coverage: Array<{ scanner: string; outcome: string; reason?: string; casesExecuted: number; casesPlanned: number }>;
  errors: Array<{ code: string; message: string }>;
}

interface Findings {
  items: Array<{
    id: string;
    severity: string;
    confidence: string;
    ruleId: string;
    vulnerability: string;
    endpoint: string;
    method: string;
    analysisMode: string;
  }>;
}

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
  parameter?: string;
  evidence: {
    summary: string;
    policy?: any;
    requests?: Array<{
      method: string;
      redactedUrl: string;
      status: number | null;
      excerpt?: any;
    }>;
    objectIdentity?: any;
    conclusion: string;
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

function FindingDetailPane({ findingId }: { findingId: string }) {
  const [finding, setFinding] = useState<FindingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!findingId) return;
    setLoading(true);
    const controller = new AbortController();
    api<FindingDetail>(`api/findings/${findingId}`, { signal: controller.signal })
      .then(setFinding)
      .catch((err: Error) => {
        if (!isAbortError(err)) setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [findingId]);

  if (loading) return <div aria-live="polite" aria-busy="true" className="p-4 text-terminal-accent animate-pulse flex items-center gap-2">_ FETCHING DETAIL DATA...</div>;
  if (error) return <div className="p-4 text-terminal-critical bg-terminal-critical/10 border border-terminal-critical">ERR_FETCH: {error}</div>;
  if (!finding) return null;

  const config = SEVERITY_CONFIG[finding.severity.toLowerCase()] || SEVERITY_CONFIG.informational;
  const analysis = finding.optionalAiAnalysis;
  const isBOLA = finding.ruleId.toLowerCase().includes('bola') || finding.vulnerability.toLowerCase().includes('broken object level authorization');

  return (
    <div className="flex flex-col h-full overflow-y-auto" tabIndex={-1}>
      <div className={`border-b-2 ${config.color} pb-4 mb-6`}>
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="!mt-0 !mb-1 text-2xl !border-0 text-white">{finding.vulnerability || finding.ruleId}</h2>
            <div className="text-terminal-muted text-xs font-mono">RULE: {finding.ruleId}</div>
          </div>
          <span className={`px-2 py-1 border font-bold flex items-center gap-2 ${config.color}`}>
            <span aria-hidden="true">{config.icon}</span>
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
          <h3 className="text-sm text-terminal-muted uppercase border-b border-terminal-border pb-1 mb-3">Overview</h3>
          <p className="text-terminal-text leading-relaxed text-sm">{finding.description}</p>
          {finding.parameter && (
            <div className="mt-4">
              <span className="text-terminal-muted text-xs uppercase mr-2">AFFECTED PARAMETER:</span>
              <span className="text-terminal-accent bg-terminal-bg px-2 py-1 border border-terminal-accent/30 font-mono text-sm">{finding.parameter}</span>
            </div>
          )}
        </section>

        <section>
          <h3 className="text-sm text-terminal-muted uppercase border-b border-terminal-border pb-1 mb-3">Evidence</h3>
          
          <div className="bg-terminal-bg border border-terminal-border p-4 text-sm flex flex-col gap-4">
            
            {/* BOLA SPECIFIC PRESENTATION */}
            {isBOLA && (finding.evidence.policy || finding.evidence.objectIdentity) && (
              <div className="border border-terminal-critical/50 bg-terminal-critical/5 p-3 mb-2">
                <div className="text-terminal-critical font-bold text-xs uppercase mb-2 flex items-center gap-2">
                  <span className="animate-pulse">▲</span> BOLA CONTEXT DETECTED
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  {finding.evidence.policy && (
                    <div>
                      <div className="text-terminal-muted mb-1">ATTACKER CONTEXT (POLICY)</div>
                      <pre className="!bg-terminal-panel !border-terminal-border !text-terminal-text !p-2 overflow-x-auto">
                        {JSON.stringify(finding.evidence.policy, null, 2)}
                      </pre>
                    </div>
                  )}
                  {finding.evidence.objectIdentity && (
                    <div>
                      <div className="text-terminal-muted mb-1">TARGET OBJECT IDENTITY</div>
                      <pre className="!bg-terminal-panel !border-terminal-border !text-terminal-text !p-2 overflow-x-auto">
                        {JSON.stringify(finding.evidence.objectIdentity, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <div className="mb-1 text-terminal-muted text-xs uppercase">SUMMARY</div>
              <p className="text-terminal-text leading-relaxed">{finding.evidence.summary}</p>
            </div>
            
            {finding.evidence.requests && finding.evidence.requests.length > 0 && (
              <div className="border-t border-terminal-border pt-4">
                <div className="mb-3 text-terminal-muted text-xs uppercase">OBSERVED REQUESTS & RESPONSES</div>
                <div className="flex flex-col gap-4">
                  {finding.evidence.requests.map((req, idx) => (
                    <div key={idx} className="bg-terminal-panel border border-terminal-border">
                      <div className="bg-terminal-border/30 p-2 flex justify-between items-center text-xs font-mono border-b border-terminal-border">
                        <span className="text-terminal-accent">{req.method} {req.redactedUrl}</span>
                        <span className={`px-2 py-0.5 ${req.status && req.status >= 400 ? 'bg-terminal-critical text-terminal-bg' : 'bg-terminal-info text-terminal-bg'}`}>
                          HTTP {req.status || 'ERR'}
                        </span>
                      </div>
                      {req.excerpt && (
                        <div className="p-2">
                          <div className="text-terminal-muted text-[10px] uppercase mb-1">PAYLOAD EXCERPT (REDACTED)</div>
                          <pre className="!bg-terminal-bg !border-0 !text-terminal-medium !p-2 overflow-x-auto text-xs whitespace-pre-wrap word-break-all max-h-64 overflow-y-auto">
                            {typeof req.excerpt === 'string' ? req.excerpt : JSON.stringify(req.excerpt, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-terminal-border pt-4 bg-terminal-panel p-3">
              <div className="mb-1 text-terminal-accent text-xs uppercase font-bold">CONCLUSION / FLAG REASON</div>
              <p className="text-terminal-text leading-relaxed">{finding.evidence.conclusion}</p>
            </div>
          </div>
        </section>

        {analysis ? (
          <section className="border border-terminal-accent/30 bg-terminal-accent/5 p-4">
            <h3 className="!mt-0 text-terminal-accent flex items-center gap-2 text-sm uppercase">
              <span className="animate-pulse">_</span> AI ANALYSIS
              {analysis.provider && <span className="text-[10px] text-terminal-muted font-normal ml-auto">via {analysis.provider}</span>}
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
                  <pre className="mt-1 !bg-terminal-bg !border-terminal-border overflow-x-auto text-xs">{analysis.remediation}</pre>
                </div>
              )}
            </div>
          </section>
        ) : null}

        <section>
          <h3 className="text-sm text-terminal-muted uppercase border-b border-terminal-border pb-1 mb-3">Remediation</h3>
          <div className="text-terminal-text leading-relaxed text-sm bg-terminal-bg border border-terminal-border p-4">
            {finding.remediation}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ScanPage() {
  const params = useParams<{ id: string }>();
  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Findings['items']>([]);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState('');
  const [vulnerabilityFilter, setVulnerabilityFilter] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    async function poll() {
      try {
        const query = new URLSearchParams({ limit: '100' });
        if (severityFilter) query.set('severity', severityFilter);
        if (vulnerabilityFilter) query.set('vulnerability', vulnerabilityFilter);
        const current = await api<Scan>(`api/scans/${params.id}`, { signal: controller.signal });
        setScan(current);
        const listed = await api<Findings>(`api/scans/${params.id}/findings?${query.toString()}`, { signal: controller.signal });
        setFindings(listed.items);
        
        // Auto-select first finding if none selected
        if (listed.items.length > 0 && !selectedFindingId && !controller.signal.aborted) {
            setSelectedFindingId(listed.items[0].id);
        }

        if (['queued', 'running'].includes(current.status) && !controller.signal.aborted) {
          timer = window.setTimeout(() => void poll(), 1000);
        }
      } catch (err) {
        if (!isAbortError(err) && !controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load scan');
        }
      }
    }
    void poll();
    return () => {
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [params.id, severityFilter, vulnerabilityFilter, selectedFindingId]);

  async function cancel() {
    if (cancelling || !scan) return;
    setCancelling(true);
    try {
      const updated = await api<Scan>(`api/scans/${scan.id}/cancel`, { method: 'POST' });
      setScan(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
      setCancelling(false);
    }
  }

  if (error) return <div className="p-8 text-terminal-critical border border-terminal-critical bg-terminal-bg">ERR: {error}</div>;
  if (!scan) return <div className="p-8 text-terminal-accent animate-pulse">INITIATING TERMINAL LINK...</div>;

  const isRunning = ['queued', 'running'].includes(scan.status);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-4">
      {/* STATUS HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border border-terminal-border bg-terminal-panel p-4 shrink-0">
        <div>
          <div className="text-xs text-terminal-muted uppercase mb-1">SCAN_ID // {scan.id}</div>
          <div className="flex items-center gap-4 text-sm">
            <span className={`font-bold ${scan.status === 'failed' ? 'text-terminal-critical' : scan.status === 'completed' ? 'text-terminal-info' : 'text-terminal-accent'}`}>
              STATUS: {scan.status.toUpperCase()}
            </span>
            <span className="text-terminal-muted">|</span>
            <span role="status" aria-live="polite" aria-atomic="true">
              PROGRESS: {scan.progress.percent}% [{scan.progress.executed}/{scan.progress.totalPlanned}]
            </span>
            {isRunning && (
              <span className="animate-pulse text-terminal-accent">_</span>
            )}
          </div>
        </div>
        
        <div className="flex gap-4">
          {isRunning && (
            <button type="button" disabled={cancelling} onClick={() => void cancel()} className="focus-visible-ring hover:bg-terminal-critical/10 hover:border-terminal-critical hover:text-terminal-critical">
              {cancelling ? 'ABORTING...' : 'ABORT SCAN'}
            </button>
          )}
          <a href={`/scans/${scan.id}/report`} className="button focus-visible-ring">EXPORT_RPT</a>
        </div>
      </header>

      {/* SPLIT PANE */}
      <main className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
        
        {/* LEFT PANE: FINDINGS TICKER */}
        <div className="flex flex-col w-full md:w-1/3 min-w-[320px] bg-terminal-panel border border-terminal-border shrink-0 h-full">
          <div className="p-3 border-b border-terminal-border shrink-0">
            <div className="text-xs text-terminal-muted uppercase font-bold mb-3">Triage Queue</div>
            <div className="flex flex-col gap-2">
              <select aria-label="Filter by Severity" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="text-xs py-1 focus-visible-ring">
                <option value="">SEVERITY: ALL</option>
                <option value="critical">CRITICAL</option>
                <option value="high">HIGH</option>
                <option value="medium">MEDIUM</option>
                <option value="low">LOW</option>
                <option value="informational">INFORMATIONAL</option>
              </select>
              <select aria-label="Filter by Vulnerability Type" value={vulnerabilityFilter} onChange={(e) => setVulnerabilityFilter(e.target.value)} className="text-xs py-1 focus-visible-ring">
                <option value="">TYPE: ALL</option>
                <option value="API1:2023 Broken Object Level Authorization">BOLA</option>
                <option value="API2:2023 Broken Authentication">AUTH_BROKEN</option>
                <option value="API8:2023 Security Misconfiguration">MISCONFIG</option>
              </select>
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {findings.length === 0 ? (
              <div className="text-terminal-muted text-xs p-4 text-center mt-8">NO MATCHING FINDINGS IN SCOPE</div>
            ) : (
              findings.map((f) => {
                const config = SEVERITY_CONFIG[f.severity.toLowerCase()] || SEVERITY_CONFIG.informational;
                const isSelected = selectedFindingId === f.id;
                
                return (
                  <button 
                    key={f.id} 
                    onClick={() => setSelectedFindingId(f.id)}
                    className={`w-full text-left p-3 border focus-visible-ring transition-colors ${isSelected ? 'bg-terminal-bg border-terminal-accent' : 'bg-transparent border-transparent hover:border-terminal-border'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-xs font-bold flex items-center gap-1 ${config.color}`}>
                        <span>{config.icon}</span>
                        <span>{f.severity.toUpperCase()}</span>
                      </span>
                      <span className="text-[10px] text-terminal-muted bg-terminal-bg px-1 border border-terminal-border">{f.analysisMode === 'ai_assisted' ? 'AI' : 'RULE'}</span>
                    </div>
                    <div className="text-sm font-bold text-white mb-1 truncate">{f.ruleId}</div>
                    <div className="text-xs text-terminal-muted font-mono truncate">
                      <span className="text-terminal-text">{f.method}</span> {f.endpoint}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: DETAIL ANALYSIS */}
        <div className="flex-1 bg-terminal-panel border border-terminal-border p-6 overflow-hidden h-full">
          {selectedFindingId ? (
            <FindingDetailPane findingId={selectedFindingId} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-terminal-muted text-sm uppercase">
              <div className="animate-pulse mb-4 text-4xl">_</div>
              Awaiting Target Selection
            </div>
          )}
        </div>
        
      </main>
    </div>
  );
}
