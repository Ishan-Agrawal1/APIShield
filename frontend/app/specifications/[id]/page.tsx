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

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading discovery…</p>;

  return (
    <section className="panel">
      <h1>{data.title}</h1>
      <p className="muted">
        OpenAPI {data.openapiVersion} · {data.count} operations · discovery {data.supportSummary.discovery} · execution {data.supportSummary.execution}
      </p>
      {data.warnings?.length ? (
        <ul>
          {data.warnings.map((warning) => (
            <li key={warning.code + warning.message} className="muted">{warning.code}: {warning.message}</li>
          ))}
        </ul>
      ) : null}
      {data.supportSummary.unsupportedConstructs.length > 0 ? (
        <div>
          <h2>Support matrix gaps</h2>
          <p className="muted">Unsupported constructs are listed. They are not treated as passes.</p>
          <ul>
            {data.supportSummary.unsupportedConstructs.map((item) => (
              <li key={`${item.construct}-${item.location ?? ''}`}>
                {item.construct}{item.location ? ` @ ${item.location}` : ''}: {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <table>
        <thead>
          <tr><th>Method</th><th>Path</th><th>Auth</th><th>Support</th></tr>
        </thead>
        <tbody>
          {data.endpoints.map((endpoint) => (
            <tr key={endpoint.id}>
              <td>{endpoint.method}</td>
              <td>{endpoint.path}</td>
              <td>{endpoint.authenticationRequired ? 'required' : 'optional/public'}</td>
              <td>{endpoint.supportStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p><a className="button" href={`/scans/new?specificationId=${data.specificationId}`}>Configure scan</a></p>
    </section>
  );
}
