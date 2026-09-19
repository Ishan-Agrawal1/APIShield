'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, isAbortError } from '../../../lib/api';

interface TargetItem {
  id: string;
  label: string;
  approvedOrigin: string;
  credentialReferences: string[];
  principals: Array<{ id: string; label: string; credentialReference: string }>;
  objects: Array<{ objectId: string; ownerPrincipalId: string; visibility: string }>;
}

interface Preview {
  generated: number;
  eligible: number;
  skipped: number;
  cases?: Array<{
    id: string;
    variant: string;
    executionEligibility: { eligible: boolean; reason?: string };
    requestTemplate?: { method: string; pathTemplate: string };
  }>;
}

export default function NewScanForm() {
  const router = useRouter();
  const search = useSearchParams();
  const specificationId = search.get('specificationId') ?? '';
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [targetProfileId, setTargetProfileId] = useState('demo-vulnerable');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resourceObservations, setResourceObservations] = useState(false);
  const [tokens, setTokens] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    api<{ items: TargetItem[] }>('api/targets', { signal: controller.signal })
      .then((data) => {
        setTargets(data.items);
        if (data.items[0]) {
          setTargetProfileId(data.items[0].id);
        }
      })
      .catch((err: Error) => {
        if (!isAbortError(err)) {
          setError(err.message);
        }
      });
    return () => controller.abort();
  }, []);

  const selected = targets.find((item) => item.id === targetProfileId);

  async function loadPreview() {
    setError(null);
    try {
      const result = await api<Preview>('api/scans/preview', {
        method: 'POST',
        body: JSON.stringify({ specificationId, targetProfileId }),
      });
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    }
  }

  async function startScan() {
    if (busy || !specificationId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const runtimeCredentials = Object.entries(tokens)
        .filter(([, token]) => token.trim())
        .map(([reference, token]) => ({ reference, token: token.trim() }));
      const scan = await api<{ id: string }>('api/scans', {
        method: 'POST',
        body: JSON.stringify({ specificationId, targetProfileId, resourceObservations, runtimeCredentials }),
      });
      setTokens({});
      router.push(`/scans/${scan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h1>Configure scan</h1>
      {!specificationId ? <p className="error">Upload a specification first so this form has a specificationId.</p> : null}
      <label htmlFor="target">Approved target</label>
      <select id="target" value={targetProfileId} onChange={(event) => setTargetProfileId(event.target.value)}>
        {targets.map((target) => (
          <option key={target.id} value={target.id}>
            {target.label} ({target.approvedOrigin})
          </option>
        ))}
      </select>
      {selected ? (
        <div>
          <p className="muted">Origin {selected.approvedOrigin}. Uploaded OpenAPI servers cannot change this.</p>
          <h2>Ownership fixtures</h2>
          <ul>
            {selected.objects.map((object) => (
              <li key={object.objectId}>
                object {object.objectId} · owner {object.ownerPrincipalId} · {object.visibility}
              </li>
            ))}
          </ul>
          <h2>Runtime credentials</h2>
          <p className="muted">
            Leave blank to bootstrap from the local demo login through the executor. Values stay in this form only — they are not written to browser storage.
          </p>
          {selected.principals.map((principal) => (
            <label key={principal.id} htmlFor={`token-${principal.credentialReference}`}>
              {principal.label} ({principal.credentialReference})
              <input
                id={`token-${principal.credentialReference}`}
                type="password"
                autoComplete="off"
                value={tokens[principal.credentialReference] ?? ''}
                onChange={(event) =>
                  setTokens((current) => ({ ...current, [principal.credentialReference]: event.target.value }))
                }
              />
            </label>
          ))}
        </div>
      ) : null}
      <label className="check">
        <input type="checkbox" checked={resourceObservations} onChange={(event) => setResourceObservations(event.target.checked)} />
        Enable bounded resource observations (local demo only)
      </label>
      <p>
        <button type="button" onClick={() => void loadPreview()}>Preview cases</button>
      </p>
      {preview ? (
        <div>
          <p className="muted">Generated {preview.generated} · eligible {preview.eligible} · skipped {preview.skipped}</p>
          {preview.cases?.length ? (
            <table>
              <thead>
                <tr><th>Variant</th><th>Request</th><th>Eligible</th></tr>
              </thead>
              <tbody>
                {preview.cases.slice(0, 20).map((item) => (
                  <tr key={item.id}>
                    <td>{item.variant}</td>
                    <td>{item.requestTemplate ? `${item.requestTemplate.method} ${item.requestTemplate.pathTemplate}` : item.id}</td>
                    <td>{item.executionEligibility.eligible ? 'yes' : item.executionEligibility.reason ?? 'skipped'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <p>
        <button type="button" disabled={busy || !specificationId} onClick={() => void startScan()}>
          {busy ? 'Starting…' : 'Start scan'}
        </button>
      </p>
    </section>
  );
}
