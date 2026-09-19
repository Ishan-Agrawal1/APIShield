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
    <section className="panel">
      <h1>Upload OpenAPI</h1>
      <p className="muted">YAML or JSON, up to 2 MiB. Uploaded <code>servers</code> values are metadata only.</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="spec">Document</label>
        <textarea id="spec" rows={18} value={content} onChange={(event) => setContent(event.target.value)} required />
        {error ? <p className="error">{error}</p> : null}
        <p><button disabled={busy} type="submit">{busy ? 'Uploading…' : 'Parse and discover'}</button></p>
      </form>
    </section>
  );
}
