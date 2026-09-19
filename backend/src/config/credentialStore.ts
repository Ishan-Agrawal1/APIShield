export interface RuntimeCredential {
  reference: string;
  authorizationHeader: string;
}

const stores = new Map<string, Map<string, RuntimeCredential>>();

export function createCredentialStore(scanId: string): Map<string, RuntimeCredential> {
  const store = new Map<string, RuntimeCredential>();
  stores.set(scanId, store);
  return store;
}

export function getCredential(scanId: string, reference: string): RuntimeCredential | undefined {
  return stores.get(scanId)?.get(reference);
}

export function setCredential(scanId: string, credential: RuntimeCredential): void {
  const store = stores.get(scanId) ?? createCredentialStore(scanId);
  store.set(credential.reference, credential);
}

export function clearCredentials(scanId: string): void {
  const store = stores.get(scanId);
  if (store) {
    store.clear();
  }
  stores.delete(scanId);
}

export function hasCredentialStore(scanId: string): boolean {
  return stores.has(scanId);
}
