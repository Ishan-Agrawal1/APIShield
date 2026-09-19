import { Suspense } from 'react';
import NewScanForm from './form';

export default function NewScanPage() {
  return (
    <Suspense fallback={<p className="muted">Loading scan configuration…</p>}>
      <NewScanForm />
    </Suspense>
  );
}
