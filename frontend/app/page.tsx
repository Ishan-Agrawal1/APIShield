'use client';

import { useEffect, useState } from 'react';
import { api, isAbortError } from '../lib/api';

interface ScanList {
  items: Array<{
    id: string;
    status: string;
    startedAt: string;
    targetProfileId: string;
    summary: { findingsBySeverity: Record<string, number> };
  }>;
}

export default function HomePage() {
  const [data, setData] = useState<ScanList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api<ScanList>('api/scans', { signal: controller.signal })
      .then(setData)
      .catch((err: Error) => {
        if (!isAbortError(err)) {
          setError(err.message);
        }
      });
    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <section className="panel">
        <h1>Scan history</h1>
        <p className="error">Backend unavailable: {error}</p>
        <p className="muted">Start the control API on 127.0.0.1:5000, then refresh.</p>
      </section>
    );
  }
  if (!data) {
    return <p className="muted">Loading scan history…</p>;
  }
  if (data.items.length === 0) {
    return (
      <section className="panel">
        <h1>Scan history</h1>
        <p className="muted">No scans yet. Upload an OpenAPI document to start the connected workflow.</p>
        <a className="button" href="/specifications/new">Upload specification</a>
      </section>
    );
  }
  return (
    <section className="panel">
      <h1>Scan history</h1>
      <table>
        <thead>
          <tr>
            <th>Started</th>
            <th>Status</th>
            <th>Target</th>
            <th>High</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((scan) => (
            <tr key={scan.id}>
              <td>{scan.startedAt}</td>
              <td>{scan.status}</td>
              <td>{scan.targetProfileId}</td>
              <td>{scan.summary.findingsBySeverity.high ?? 0}</td>
              <td><a href={`/scans/${scan.id}`}>Open</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
