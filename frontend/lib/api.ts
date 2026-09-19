export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('content-type') && init?.body) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(`/api/proxy/${path.replace(/^\//, '')}`, {
    ...init,
    headers,
  });
  if (init?.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    let message = response.statusText;
    if (data && typeof data === 'object' && 'error' in data) {
      const err = (data as { error: unknown }).error;
      if (err && typeof err === 'object' && err !== null && 'message' in err) {
        message = String((err as { message: unknown }).message);
      } else {
        message = JSON.stringify(err);
      }
    }
    throw new Error(message);
  }
  return data as T;
}

export function isAbortError(error: unknown): boolean {
  return (error instanceof DOMException && error.name === 'AbortError') || (error instanceof Error && error.name === 'AbortError');
}
