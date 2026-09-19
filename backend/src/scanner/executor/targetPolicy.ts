import type { TargetProfile } from '@apishield/contracts';
import { AppError } from '../../utils/errors.js';
import { resolveAndValidate, type LookupFn } from './dnsGuard.js';

export interface PolicyDecision {
  ok: true;
  url: URL;
}

export async function assertTargetAllowed(
  rawUrl: string,
  profile: TargetProfile,
  lookupFn?: LookupFn,
): Promise<PolicyDecision> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError(400, 'INVALID_TARGET_URL', 'Target URL could not be parsed.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError(403, 'PROTOCOL_DENIED', 'Only HTTP and HTTPS targets are allowed.');
  }
  if (url.username || url.password) {
    throw new AppError(403, 'EMBEDDED_CREDENTIALS', 'Embedded URL credentials are not allowed.');
  }

  const approved = new URL(profile.approvedOrigin);
  if (url.protocol !== approved.protocol || url.hostname !== approved.hostname || url.port !== approved.port) {
    throw new AppError(403, 'ORIGIN_DENIED', 'Target origin is outside the approved profile.');
  }

  const prefixes = profile.pathScopePrefixes.length > 0 ? profile.pathScopePrefixes : ['/'];
  const allowedPath = prefixes.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}`));
  if (!allowedPath && prefixes.every((prefix) => prefix !== '/')) {
    const ok = prefixes.some((prefix) => url.pathname.startsWith(prefix));
    if (!ok) {
      throw new AppError(403, 'PATH_DENIED', 'Target path is outside the approved profile scope.');
    }
  }

  const allowLoopback =
    approved.hostname === '127.0.0.1' || approved.hostname === 'localhost';
  await resolveAndValidate(url.hostname, allowLoopback, lookupFn);
  return { ok: true, url };
}
