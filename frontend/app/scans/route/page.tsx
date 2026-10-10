'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';

interface KeyValue {
  key: string;
  value: string;
}

interface Preview {
  origin: string;
  method: string;
  pathTemplate: string;
  objectIdParameter: { name: string; value: string } | null;
  authenticated: boolean;
  generated: number;
  eligible: number;
  skipped: number;
  cases?: Array<{
    id: string;
    variant: string;
    scanner: string;
    expectedBehavior: string;
    executionEligibility: { eligible: boolean; reason?: string };
    requestTemplate?: { method: string; pathTemplate: string };
  }>;
}

const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

function toRecord(pairs: KeyValue[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const pair of pairs) {
    const key = pair.key.trim();
    if (key) {
      record[key] = pair.value;
    }
  }
  return record;
}

function PairEditor({
  label,
  pairs,
  setPairs,
  keyPlaceholder,
  valuePlaceholder,
}: {
  label: string;
  pairs: KeyValue[];
  setPairs: (next: KeyValue[]) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}) {
  return (
    <div>
      <div className="text-terminal-muted text-[10px] uppercase mb-2">{label}</div>
      <div className="space-y-2">
        {pairs.map((pair, index) => (
          <div key={index} className="flex gap-2">
            <input
              aria-label={`${label} name ${index + 1}`}
              value={pair.key}
              placeholder={keyPlaceholder}
              onChange={(event) => {
                const next = [...pairs];
                next[index] = { ...pair, key: event.target.value };
                setPairs(next);
              }}
              className="w-1/3 bg-terminal-bg border border-terminal-border p-2 text-sm font-mono focus-visible-ring"
            />
            <input
              aria-label={`${label} value ${index + 1}`}
              value={pair.value}
              placeholder={valuePlaceholder}
              onChange={(event) => {
                const next = [...pairs];
                next[index] = { ...pair, value: event.target.value };
                setPairs(next);
              }}
              className="flex-1 bg-terminal-bg border border-terminal-border p-2 text-sm font-mono focus-visible-ring"
            />
            <button
              type="button"
              aria-label={`Remove ${label} row ${index + 1}`}
              onClick={() => setPairs(pairs.filter((_, position) => position !== index))}
              className="px-3 text-terminal-muted hover:text-terminal-critical border border-terminal-border"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPairs([...pairs, { key: '', value: '' }])}
          className="text-terminal-accent text-xs hover:underline focus-visible-ring"
        >
          + ADD {label}
        </button>
      </div>
    </div>
  );
}

export default function RouteScanPage() {
  const router = useRouter();
  const [url, setUrl] = useState('http://127.0.0.1:5001/api/notes/{id}');
  const [method, setMethod] = useState('GET');
  const [authorization, setAuthorization] = useState('');
  const [pathParams, setPathParams] = useState<KeyValue[]>([{ key: 'id', value: '1' }]);
  const [queryParams, setQueryParams] = useState<KeyValue[]>([]);
  const [headers, setHeaders] = useState<KeyValue[]>([]);
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function buildPayload() {
    const payload: Record<string, unknown> = {
      url: url.trim(),
      method,
      pathParams: toRecord(pathParams),
      queryParams: toRecord(queryParams),
      headers: toRecord(headers),
      authorization: authorization.trim() || null,
    };
    if (body.trim() && method !== 'GET' && method !== 'HEAD') {
      try {
        payload.body = JSON.parse(body);
      } catch {
        throw new Error('Request body must be valid JSON.');
      }
    }
    return payload;
  }

  async function loadPreview() {
    setError(null);
    try {
      setPreview(await api<Preview>('api/scans/route/preview', { method: 'POST', body: JSON.stringify(buildPayload()) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    }
  }

  async function startScan() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const scan = await api<{ id: string }>('api/scans/route', { method: 'POST', body: JSON.stringify(buildPayload()) });
      setAuthorization('');
      router.push(`/scans/${scan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
      setBusy(false);
    }
  }

  return (
    <section className="bg-terminal-panel border border-terminal-border p-6 max-w-4xl mx-auto">
      <h1 className="border-b border-terminal-border pb-4 mb-2">ROUTE SECURITY TEST</h1>
      <p className="text-terminal-muted text-xs mb-6">
        Paste a single authorized route. APIShield generates controlled security test cases, executes them against the
        target, and reports findings. Loopback targets (127.0.0.1 / localhost) and approved profiles only.
      </p>

      {error && <div className="border border-terminal-critical bg-terminal-critical/10 text-terminal-critical p-4 mb-6 text-sm">ERR: {error}</div>}

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="md:w-36">
            <label htmlFor="method" className="block text-terminal-muted text-[10px] uppercase mb-2">Method</label>
            <select id="method" value={method} onChange={(event) => setMethod(event.target.value)} className="w-full bg-terminal-bg border border-terminal-border p-2 min-h-[44px] focus-visible-ring">
              {METHODS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="url" className="block text-terminal-muted text-[10px] uppercase mb-2">Target URL</label>
            <input id="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="http://127.0.0.1:5001/api/notes/{id}" className="w-full bg-terminal-bg border border-terminal-border p-2 font-mono min-h-[44px] focus-visible-ring" />
          </div>
        </div>

        <div>
          <label htmlFor="auth" className="block text-terminal-muted text-[10px] uppercase mb-2">Authorization (bearer token or full header; held in memory only)</label>
          <input id="auth" type="password" autoComplete="off" value={authorization} onChange={(event) => setAuthorization(event.target.value)} placeholder="paste a token to test the authenticated route" className="w-full bg-terminal-bg border border-terminal-border p-2 font-mono min-h-[44px] focus-visible-ring" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PairEditor label="PATH PARAMS" pairs={pathParams} setPairs={setPathParams} keyPlaceholder="id" valuePlaceholder="1" />
          <PairEditor label="QUERY PARAMS" pairs={queryParams} setPairs={setQueryParams} keyPlaceholder="limit" valuePlaceholder="10" />
        </div>

        <PairEditor label="HEADERS" pairs={headers} setPairs={setHeaders} keyPlaceholder="X-Trace-Id" valuePlaceholder="value" />

        {method !== 'GET' && method !== 'HEAD' && (
          <div>
            <label htmlFor="body" className="block text-terminal-muted text-[10px] uppercase mb-2">Request Body (JSON)</label>
            <textarea id="body" rows={5} value={body} onChange={(event) => setBody(event.target.value)} placeholder='{ "title": "example" }' className="w-full bg-terminal-bg border border-terminal-border p-3 font-mono text-sm focus-visible-ring" />
          </div>
        )}

        <div className="border-t border-terminal-border pt-6 flex flex-wrap gap-4 items-center justify-between">
          <button type="button" onClick={() => void loadPreview()} className="button bg-transparent hover:bg-terminal-bg focus-visible-ring min-h-[44px]">
            PREVIEW TEST CASES
          </button>
          <button type="button" disabled={busy} onClick={() => void startScan()} className="button bg-terminal-accent/10 border-terminal-accent text-terminal-accent hover:bg-terminal-accent hover:text-terminal-bg focus-visible-ring min-h-[44px]">
            {busy ? '_ STARTING' : 'START SECURITY TEST'}
          </button>
        </div>

        {preview && (
          <div className="mt-4 border border-terminal-border bg-terminal-bg p-4">
            <div className="flex flex-wrap gap-4 text-xs font-mono mb-4 pb-2 border-b border-terminal-border text-terminal-muted">
              <span>ROUTE: <span className="text-terminal-text">{preview.method} {preview.pathTemplate}</span></span>
              <span>CASES: <span className="text-terminal-text font-bold">{preview.generated}</span></span>
              <span>ELIGIBLE: <span className="text-terminal-info font-bold">{preview.eligible}</span></span>
              <span>SKIPPED: <span className="text-terminal-medium font-bold">{preview.skipped}</span></span>
              {preview.objectIdParameter && <span>OBJECT_ID: <span className="text-terminal-accent">{preview.objectIdParameter.name}={preview.objectIdParameter.value}</span></span>}
            </div>
            {preview.cases?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="min-w-[90px]">SCANNER</th>
                      <th className="min-w-[110px]">VARIANT</th>
                      <th className="min-w-[180px]">REQUEST</th>
                      <th className="min-w-[90px]">ELIGIBLE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.cases.map((item) => (
                      <tr key={item.id} className="hover:bg-terminal-panel">
                        <td className="text-terminal-muted font-mono uppercase">{item.scanner}</td>
                        <td className="text-terminal-text font-mono">{item.variant}</td>
                        <td className="text-terminal-muted font-mono truncate max-w-[220px]" title={item.expectedBehavior}>
                          {item.requestTemplate ? `${item.requestTemplate.method} ${item.requestTemplate.pathTemplate}` : item.id}
                        </td>
                        <td>
                          {item.executionEligibility.eligible ? (
                            <span className="text-terminal-info">YES</span>
                          ) : (
                            <span className="text-terminal-medium truncate block max-w-[140px]" title={item.executionEligibility.reason}>SKIP</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
