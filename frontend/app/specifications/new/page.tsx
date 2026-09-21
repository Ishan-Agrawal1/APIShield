'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';

export default function UploadPage() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const spec = await api<{ id: string }>('api/specifications', {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      router.push(`/specifications/${spec.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setBusy(false);
    }
  }

  return (
    <div className="shell min-h-screen">
      <header className="top">
        <a href="/" className="brand">APIShield</a>
      </header>

      <section className="bg-terminal-panel border border-terminal-border p-6 max-w-4xl mx-auto mt-8">
        <h1 className="!mt-0 !mb-2 border-b border-terminal-border pb-2 text-xl text-white">UPLOAD_OPENAPI</h1>
        <p className="text-terminal-muted text-xs mb-6">
          YAML OR JSON, UP TO 2 MIB. UPLOADED <code className="bg-terminal-bg px-1 font-mono text-terminal-text border border-terminal-border">servers</code> VALUES ARE METADATA ONLY.
        </p>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="spec" className="text-terminal-muted text-xs font-bold uppercase">DOCUMENT_PAYLOAD</label>
            <textarea 
              id="spec" 
              rows={18} 
              value={content} 
              onChange={(event) => setContent(event.target.value)} 
              required 
              className="w-full bg-terminal-bg text-terminal-text border border-terminal-border p-4 focus-visible-ring font-mono text-sm resize-y"
              placeholder="# PASTE OPENAPI SPECIFICATION HERE..."
            />
          </div>
          
          {error ? (
            <div className="p-4 bg-terminal-critical/10 border border-terminal-critical text-terminal-critical text-sm">
              ERR: {error}
            </div>
          ) : null}
          
          <div className="border-t border-terminal-border pt-4">
            <button 
              disabled={busy} 
              type="submit" 
              className="button focus-visible-ring w-full md:w-auto"
            >
              {busy ? '_ PROCESSING...' : 'PARSE_AND_DISCOVER'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
