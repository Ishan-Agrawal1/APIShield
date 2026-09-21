'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, isAbortError } from '../../../lib/api';

interface Discovery {
  specificationId: string;
  title: string;
  openapiVersion: string;
  count: number;
  warnings?: Array<{ code: string; message: string }>;
  supportSummary: {
    discovery: string;
    execution: string;
    unsupportedConstructs: Array<{ construct: string; reason: string; location?: string }>;
  };
  endpoints: Array<{ id: string; method: string; path: string; authenticationRequired: boolean; supportStatus: string }>;
}

export default function DiscoveryPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Discovery | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api<Discovery>(`api/specifications/${params.id}/endpoints`, { signal: controller.signal })
      .then(setData)
      .catch((err: Error) => {
        if (!isAbortError(err)) {
          setError(err.message);
        }
      });
    return () => controller.abort();
  }, [params.id]);

  if (error) return <div className="p-8 text-terminal-critical border border-terminal-critical bg-terminal-bg">ERR: {error}</div>;
  if (!data) return <div className="p-8 text-terminal-accent animate-pulse bg-terminal-bg border border-terminal-border">LOADING DISCOVERY DATA...</div>;

  return (
    <div className="shell min-h-screen">
      <header className="top">
        <a href="/" className="brand">APIShield</a>
      </header>

      <section className="bg-terminal-panel border border-terminal-border p-6 max-w-5xl mx-auto mt-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-terminal-border pb-4 mb-6">
          <div>
            <h1 className="!mt-0 !mb-1 !border-0 text-2xl text-white">{data.title}</h1>
            <p className="text-terminal-muted text-xs font-mono">
              OPENAPI {data.openapiVersion} // {data.count} OPERATIONS // DISCOVERY {data.supportSummary.discovery} // EXECUTION {data.supportSummary.execution}
            </p>
          </div>
          <a className="button focus-visible-ring" href={`/scans/new?specificationId=${data.specificationId}`}>CONFIGURE_SCAN</a>
        </div>

        {data.warnings?.length ? (
          <div className="mb-6 p-4 border border-terminal-warning/30 bg-terminal-warning/10">
            <h2 className="!mt-0 text-sm text-terminal-warning mb-2 border-0">WARNINGS</h2>
            <ul className="list-none space-y-1 text-sm text-terminal-text">
              {data.warnings.map((warning) => (
                <li key={warning.code + warning.message} className="flex gap-2">
                  <span className="text-terminal-warning font-bold">[{warning.code}]</span>
                  <span>{warning.message}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {data.supportSummary.unsupportedConstructs.length > 0 ? (
          <div className="mb-6 p-4 border border-terminal-border bg-terminal-bg">
            <h2 className="!mt-0 text-sm text-terminal-muted mb-2 border-0">SUPPORT MATRIX GAPS</h2>
            <p className="text-xs text-terminal-muted mb-4">UNSUPPORTED CONSTRUCTS ARE LISTED. THEY ARE NOT TREATED AS PASSES.</p>
            <ul className="list-none space-y-1 text-xs text-terminal-text font-mono">
              {data.supportSummary.unsupportedConstructs.map((item) => (
                <li key={`${item.construct}-${item.location ?? ''}`} className="flex flex-col md:flex-row gap-2 border-b border-terminal-border/30 pb-1">
                  <span className="text-terminal-medium min-w-[200px] truncate">{item.construct}{item.location ? ` @ ${item.location}` : ''}</span>
                  <span className="text-terminal-muted">{item.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-8">
          <h2 className="text-sm text-terminal-text mb-4 border-b border-terminal-border pb-2">DISCOVERED ENDPOINTS</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-terminal-border text-terminal-muted text-xs uppercase">
                  <th className="py-2 min-w-[100px]">METHOD</th>
                  <th className="py-2 min-w-[250px]">PATH</th>
                  <th className="py-2 min-w-[120px]">AUTH</th>
                  <th className="py-2 min-w-[150px]">SUPPORT</th>
                </tr>
              </thead>
              <tbody>
                {data.endpoints.map((endpoint) => (
                  <tr key={endpoint.id} className="border-b border-terminal-border hover:bg-terminal-bg transition-colors">
                    <td className="py-2 font-mono text-terminal-accent">{endpoint.method}</td>
                    <td className="py-2 font-mono text-terminal-text truncate max-w-[400px]" title={endpoint.path}>{endpoint.path}</td>
                    <td className="py-2 text-xs">
                      {endpoint.authenticationRequired ? (
                        <span className="text-terminal-medium bg-terminal-medium/10 px-1 border border-terminal-medium/30">REQUIRED</span>
                      ) : (
                        <span className="text-terminal-info bg-terminal-info/10 px-1 border border-terminal-info/30">OPTIONAL/PUBLIC</span>
                      )}
                    </td>
                    <td className="py-2 text-xs">
                      <span className={`px-1 border ${endpoint.supportStatus === 'supported' ? 'text-terminal-info border-terminal-info/30 bg-terminal-info/10' : 'text-terminal-warning border-terminal-warning/30 bg-terminal-warning/10'}`}>
                        {endpoint.supportStatus.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
