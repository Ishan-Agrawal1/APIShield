'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, isAbortError } from '../../../lib/api';
import Link from 'next/link';

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
  const [targetProfileId, setTargetProfileId] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resourceObservations, setResourceObservations] = useState(false);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [loadingTargets, setLoadingTargets] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingTargets(true);
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
      })
      .finally(() => setLoadingTargets(false));
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

  if (!specificationId) {
    return (
      <div className="border border-terminal-border bg-terminal-panel p-12 text-center max-w-2xl mx-auto mt-12">
         <div className="text-terminal-critical text-4xl mb-4">■</div>
         <h2 className="text-terminal-text text-xl mb-2 border-0">DEPENDENCY MISSING</h2>
         <p className="text-terminal-muted text-sm mb-8">Scan configuration requires a specificationId. Upload an OpenAPI document first.</p>
         <Link href="/specifications/new" className="button focus-visible-ring min-h-[44px] inline-flex items-center justify-center">
           UPLOAD SPECIFICATION
         </Link>
      </div>
    );
  }

  return (
    <section className="bg-terminal-panel border border-terminal-border p-6 max-w-4xl mx-auto">
      <h1 className="border-b border-terminal-border pb-4 mb-6">CONFIGURE SCAN SEQUENCE</h1>
      
      {error && <div className="border border-terminal-critical bg-terminal-critical/10 text-terminal-critical p-4 mb-6">ERR: {error}</div>}

      {loadingTargets ? (
        <div className="text-terminal-accent text-sm animate-pulse mb-6 flex items-center gap-2">_ FETCHING TARGET PROFILES...</div>
      ) : (
        <div className="space-y-8">
          <div>
            <label htmlFor="target" className="block text-terminal-muted text-xs uppercase mb-2">Approved Target Profile</label>
            <select 
              id="target" 
              value={targetProfileId} 
              onChange={(event) => setTargetProfileId(event.target.value)}
              className="w-full bg-terminal-bg text-terminal-text border border-terminal-border p-3 focus-visible-ring min-h-[44px]"
            >
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label} (ORIGIN: {target.approvedOrigin})
                </option>
              ))}
            </select>
            {selected && <div className="mt-2 text-xs text-terminal-muted">Enforced Origin: {selected.approvedOrigin}. Target drift blocked.</div>}
          </div>

          {selected && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-terminal-border pt-6">
              
              <div>
                <h2 className="text-sm border-0 mb-4 text-white">OWNERSHIP FIXTURES</h2>
                {selected.objects.length === 0 ? (
                  <div className="text-terminal-muted text-xs bg-terminal-bg p-3 border border-terminal-border">NO FIXTURES DETECTED</div>
                ) : (
                  <ul className="space-y-2">
                    {selected.objects.map((object) => (
                      <li key={object.objectId} className="text-xs bg-terminal-bg border border-terminal-border p-2 font-mono flex flex-col gap-1">
                        <div><span className="text-terminal-muted">OBJ:</span> <span className="text-terminal-accent">{object.objectId}</span></div>
                        <div><span className="text-terminal-muted">OWNER:</span> {object.ownerPrincipalId}</div>
                        <div><span className="text-terminal-muted">VISIBILITY:</span> {object.visibility}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h2 className="text-sm border-0 mb-2 text-white">RUNTIME CREDENTIALS</h2>
                <p className="text-terminal-muted text-xs mb-4">
                  Tokens remain local to this form to bootstrap the executor.
                </p>
                <div className="space-y-4">
                  {selected.principals.map((principal) => (
                    <div key={principal.id}>
                      <label htmlFor={`token-${principal.credentialReference}`} className="block text-terminal-muted text-[10px] uppercase mb-1">
                        {principal.label} <span className="opacity-50">({principal.credentialReference})</span>
                      </label>
                      <input
                        id={`token-${principal.credentialReference}`}
                        type="password"
                        autoComplete="off"
                        value={tokens[principal.credentialReference] ?? ''}
                        onChange={(event) =>
                          setTokens((current) => ({ ...current, [principal.credentialReference]: event.target.value }))
                        }
                        className="w-full bg-terminal-bg text-terminal-text border border-terminal-border p-2 focus-visible-ring min-h-[44px]"
                        placeholder="••••••••••••"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-terminal-border pt-6">
            <label className="flex items-center gap-3 cursor-pointer group min-h-[44px]">
              <div className="relative flex items-center justify-center">
                <input 
                  type="checkbox" 
                  checked={resourceObservations} 
                  onChange={(event) => setResourceObservations(event.target.checked)} 
                  className="peer appearance-none w-5 h-5 border border-terminal-muted bg-terminal-bg checked:border-terminal-accent focus-visible-ring"
                />
                <div className="absolute inset-0 m-auto w-3 h-3 bg-terminal-accent opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
              </div>
              <span className="text-sm text-terminal-text group-hover:text-terminal-accent transition-colors">
                Enable bounded resource observations <span className="text-terminal-muted">(local demo only)</span>
              </span>
            </label>
          </div>

          <div className="border-t border-terminal-border pt-6 flex flex-wrap gap-4 items-center justify-between">
            <button type="button" onClick={() => void loadPreview()} className="button bg-transparent hover:bg-terminal-bg focus-visible-ring min-h-[44px]">
              PREVIEW ATTACK VECTOR
            </button>
            <button type="button" disabled={busy || !specificationId || !targetProfileId} onClick={() => void startScan()} className="button bg-terminal-accent/10 border-terminal-accent text-terminal-accent hover:bg-terminal-accent hover:text-terminal-bg focus-visible-ring min-h-[44px]">
              {busy ? '_ EXECUTING' : 'INITIALIZE SEQUENCE'}
            </button>
          </div>
          
          {preview && (
            <div className="mt-8 border border-terminal-border bg-terminal-bg p-4">
              <div className="flex gap-4 text-xs font-mono mb-4 pb-2 border-b border-terminal-border text-terminal-muted">
                <span>VECTORS: <span className="text-terminal-text font-bold">{preview.generated}</span></span>
                <span>ELIGIBLE: <span className="text-terminal-info font-bold">{preview.eligible}</span></span>
                <span>SKIPPED: <span className="text-terminal-medium font-bold">{preview.skipped}</span></span>
              </div>
              
              {preview.cases?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="min-w-[120px]">VARIANT</th>
                        <th className="min-w-[180px]">TARGET</th>
                        <th className="min-w-[100px]">ELIGIBLE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.cases.slice(0, 20).map((item) => (
                        <tr key={item.id} className="hover:bg-terminal-panel">
                          <td className="text-terminal-text font-mono">{item.variant}</td>
                          <td className="text-terminal-muted font-mono truncate max-w-[200px]">
                            {item.requestTemplate ? `${item.requestTemplate.method} ${item.requestTemplate.pathTemplate}` : item.id}
                          </td>
                          <td>
                            {item.executionEligibility.eligible ? (
                              <span className="text-terminal-info bg-terminal-info/10 px-1 border border-terminal-info/30">YES</span>
                            ) : (
                              <span className="text-terminal-medium bg-terminal-medium/10 px-1 border border-terminal-medium/30 truncate block max-w-[150px]" title={item.executionEligibility.reason}>
                                {item.executionEligibility.reason ?? 'SKIPPED'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.generated > 20 && <div className="text-center text-terminal-muted text-[10px] mt-4 pt-2 border-t border-terminal-border">SHOWING FIRST 20 VECTORS</div>}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
