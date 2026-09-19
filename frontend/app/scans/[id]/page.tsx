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

export default function ScanPage() {
  const params = useParams<{ id: string }>();
  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Findings['items']>([]);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState('');
  const [vulnerability, setVulnerability] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    async function poll() {
      try {
        const query = new URLSearchParams({ limit: '100' });
        if (severity) query.set('severity', severity);
        if (vulnerability) query.set('vulnerability', vulnerability);
        const current = await api<Scan>(`api/scans/${params.id}`, { signal: controller.signal });
        setScan(current);
        const listed = await api<Findings>(`api/scans/${params.id}/findings?${query.toString()}`, { signal: controller.signal });
        setFindings(listed.items);
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
  }, [params.id, severity, vulnerability]);

  async function cancel() {
    if (cancelling || !scan) {
      return;
    }
    setCancelling(true);
    try {
      const updated = await api<Scan>(`api/scans/${scan.id}/cancel`, { method: 'POST' });
      setScan(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
      setCancelling(false);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!scan) return <p className="muted">Loading scan…</p>;

  return (
    <section className="panel">
      <h1>Scan {scan.id}</h1>
      <p>
        Status: {scan.status} · progress {scan.progress.percent}% ({scan.progress.executed}/{scan.progress.totalPlanned} executed,
        {scan.progress.skipped} skipped, {scan.progress.errored} errored)
      </p>
      {scan.status === 'failed' ? <p className="error">Scan failed. {scan.errors[0]?.message}</p> : null}
      {scan.status === 'cancelled' ? <p className="muted">Scan cancelled. Partial evidence is retained; this is not a pass.</p> : null}
      {['queued', 'running'].includes(scan.status) ? (
        <p>
          <button type="button" disabled={cancelling} onClick={() => void cancel()}>
            {cancelling ? 'Cancelling…' : 'Cancel scan'}
          </button>
        </p>
      ) : null}
      <h2>Coverage</h2>
      <ul>
        {scan.coverage.map((row) => (
          <li key={row.scanner}>
            {row.scanner}: {row.outcome} ({row.casesExecuted}/{row.casesPlanned}) {row.reason ?? ''}
          </li>
        ))}
      </ul>
      <h2>Findings</h2>
      <div className="filters">
        <label htmlFor="severity">Severity</label>
        <select id="severity" value={severity} onChange={(event) => setSeverity(event.target.value)}>
          <option value="">All</option>
          <option value="critical">critical</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
          <option value="informational">informational</option>
        </select>
        <label htmlFor="type">Type</label>
        <select id="type" value={vulnerability} onChange={(event) => setVulnerability(event.target.value)}>
          <option value="">All</option>
          <option value="API1:2023 Broken Object Level Authorization">BOLA</option>
          <option value="API2:2023 Broken Authentication">Authentication</option>
          <option value="API8:2023 Security Misconfiguration">Misconfiguration</option>
        </select>
      </div>
      {findings.length === 0 ? (
        <p className="muted">No findings in tested scope. This is not a certificate that the API is secure.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Severity</th><th>Confidence</th><th>Rule</th><th>Endpoint</th><th>Analysis</th></tr>
          </thead>
          <tbody>
            {findings.map((finding) => (
              <tr key={finding.id}>
                <td>{finding.severity}</td>
                <td>{finding.confidence}</td>
                <td><a href={`/findings/${finding.id}`}>{finding.ruleId}</a></td>
                <td>{finding.method} {finding.endpoint}</td>
                <td>{finding.analysisMode === 'ai_assisted' ? 'AI-assisted' : 'Rule-based'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p><a href={`/scans/${scan.id}/report`}>Open report</a></p>
    </section>
  );
}
