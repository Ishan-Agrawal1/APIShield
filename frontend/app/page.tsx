'use client';

import { useEffect, useState } from 'react';
import { api, isAbortError } from '../lib/api';
import Link from 'next/link';

interface ScanList {
  items: Array<{
    id: string;
    status: string;
    startedAt: string;
    targetProfileId: string;
    summary: { findingsBySeverity: Record<string, number> };
  }>;
}

const SEVERITY_CONFIG: Record<string, { color: string; icon: string }> = {
  critical: { color: 'text-terminal-critical border-terminal-critical', icon: '▲' },
  high: { color: 'text-terminal-high border-terminal-high', icon: '◆' },
  medium: { color: 'text-terminal-medium border-terminal-medium', icon: '■' },
  low: { color: 'text-terminal-low border-terminal-low', icon: '▼' },
  informational: { color: 'text-terminal-info border-terminal-info', icon: '●' },
};

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
      <main className="shell min-h-[calc(100vh-100px)] flex flex-col justify-center items-center">
        <div className="border border-terminal-critical bg-terminal-panel p-8 max-w-lg w-full text-center">
          <div className="text-terminal-critical text-4xl mb-4">▲</div>
          <h1 className="text-terminal-critical mb-2">SYS_ERR: BACKEND OFFLINE</h1>
          <p className="text-terminal-text text-sm mb-4">FAILED TO ESTABLISH UPLINK TO CONTROL NODE.</p>
          <div className="bg-terminal-bg p-4 border border-terminal-border text-terminal-muted font-mono text-xs text-left mb-6 overflow-x-auto">
            {error}
          </div>
          <button onClick={() => window.location.reload()} className="button w-full focus-visible-ring min-h-[44px]">RETRY CONNECTION</button>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main aria-live="polite" aria-busy="true" className="shell min-h-[calc(100vh-100px)] flex flex-col justify-center items-center">
         <div className="text-terminal-accent text-lg flex items-center gap-2">
            <span className="animate-pulse">_</span> ESTABLISHING LINK...
         </div>
      </main>
    );
  }

  const totalScans = data.items.length;
  
  // Aggregate severities
  const globalSeverities = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
  let totalFindings = 0;
  
  data.items.forEach(scan => {
    if (scan.summary && scan.summary.findingsBySeverity) {
      Object.entries(scan.summary.findingsBySeverity).forEach(([sev, count]) => {
        const key = sev.toLowerCase() as keyof typeof globalSeverities;
        if (globalSeverities[key] !== undefined) {
          globalSeverities[key] += count;
          totalFindings += count;
        }
      });
    }
  });

  return (
    <main className="shell min-h-screen">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl mb-1">COMMAND DASHBOARD</h1>
          <p className="text-terminal-muted text-sm font-mono">GLOBAL APISHIELD STATUS</p>
        </div>
        <div className="flex gap-3">
          <Link href="/scans/route" className="button bg-terminal-accent/10 border-terminal-accent text-terminal-accent hover:bg-terminal-accent hover:text-terminal-bg focus-visible-ring min-h-[44px] flex items-center justify-center">
            + ROUTE TEST
          </Link>
          <Link href="/scans/new" className="button focus-visible-ring min-h-[44px] flex items-center justify-center">
            + SPEC SCAN
          </Link>
        </div>
      </header>

      {totalScans === 0 ? (
        <div className="border border-terminal-border bg-terminal-panel p-12 text-center max-w-2xl mx-auto mt-12">
           <div className="text-terminal-muted text-4xl mb-4">■</div>
           <h2 className="text-terminal-text text-xl mb-2 border-0">SYSTEM STANDBY</h2>
           <p className="text-terminal-muted text-sm mb-8">No vulnerability sweeps recorded. Paste a single route to test, or upload an OpenAPI specification.</p>
           <div className="flex flex-wrap gap-3 justify-center">
             <Link href="/scans/route" className="button bg-terminal-accent/10 border-terminal-accent text-terminal-accent hover:bg-terminal-accent hover:text-terminal-bg focus-visible-ring min-h-[44px] inline-flex items-center justify-center">
               ROUTE SECURITY TEST
             </Link>
             <Link href="/specifications/new" className="button focus-visible-ring min-h-[44px] inline-flex items-center justify-center">
               UPLOAD SPECIFICATION
             </Link>
           </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* METRICS ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4">
            <div className="border border-terminal-border bg-terminal-panel p-4 flex flex-col items-center justify-center">
               <div className="text-terminal-muted text-xs uppercase mb-1">Total Scans</div>
               <div className="text-3xl text-terminal-text font-bold">{totalScans}</div>
            </div>
            <div className="border border-terminal-border bg-terminal-panel p-4 flex flex-col items-center justify-center">
               <div className="text-terminal-muted text-xs uppercase mb-1">Total Findings</div>
               <div className="text-3xl text-terminal-text font-bold">{totalFindings}</div>
            </div>
            
            {/* Severity Distribution */}
            {Object.entries(globalSeverities).map(([sev, count]) => {
              const config = SEVERITY_CONFIG[sev];
              if (!config) return null;
              return (
                <div key={sev} className="border border-terminal-border bg-terminal-panel p-4 flex flex-col items-center justify-center">
                  <div className={`text-[10px] uppercase font-bold mb-1 flex items-center gap-1 ${config.color}`}>
                     <span>{config.icon}</span> {sev}
                  </div>
                  <div className={`text-3xl font-bold ${count > 0 ? config.color.split(' ')[0] : 'text-terminal-muted'}`}>
                    {count}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RECENT SCANS LIST */}
          <section className="border border-terminal-border bg-terminal-panel p-4">
            <h2 className="!mt-0 border-b border-terminal-border pb-2 text-sm text-terminal-muted">RECENT SCANS</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="min-w-[120px]">SCAN_ID</th>
                    <th className="min-w-[120px]">STATUS</th>
                    <th className="min-w-[180px]">TIME</th>
                    <th className="min-w-[150px]">TARGET</th>
                    <th className="min-w-[200px]">FINDINGS (C/H/M/L/I)</th>
                    <th className="min-w-[100px] text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(scan => {
                    const statusColor = scan.status === 'failed' ? 'text-terminal-critical' : scan.status === 'completed' ? 'text-terminal-info' : 'text-terminal-accent';
                    const c = scan.summary?.findingsBySeverity?.critical || 0;
                    const h = scan.summary?.findingsBySeverity?.high || 0;
                    const m = scan.summary?.findingsBySeverity?.medium || 0;
                    const l = scan.summary?.findingsBySeverity?.low || 0;
                    const i = scan.summary?.findingsBySeverity?.informational || 0;
                    
                    return (
                      <tr key={scan.id} className="hover:bg-terminal-bg group transition-colors">
                        <td className="font-mono text-terminal-text">{scan.id}</td>
                        <td className={`font-bold uppercase ${statusColor}`}>{scan.status}</td>
                        <td className="text-terminal-muted">{new Date(scan.startedAt).toLocaleString()}</td>
                        <td className="font-mono text-terminal-text">{scan.targetProfileId || 'UNKNOWN'}</td>
                        <td className="font-mono text-xs flex gap-2">
                           <span className={c > 0 ? 'text-terminal-critical font-bold' : 'text-terminal-muted'}>{c}</span>/
                           <span className={h > 0 ? 'text-terminal-high font-bold' : 'text-terminal-muted'}>{h}</span>/
                           <span className={m > 0 ? 'text-terminal-medium font-bold' : 'text-terminal-muted'}>{m}</span>/
                           <span className={l > 0 ? 'text-terminal-low font-bold' : 'text-terminal-muted'}>{l}</span>/
                           <span className={i > 0 ? 'text-terminal-info font-bold' : 'text-terminal-muted'}>{i}</span>
                        </td>
                        <td className="text-right">
                          <Link href={`/scans/${scan.id}`} className="text-terminal-accent hover:underline focus-visible-ring px-2 py-1 inline-block min-h-[44px] min-w-[44px] content-center">
                            VIEW &rarr;
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
