import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const METADATA = new Set(['169.254.169.254', 'fd00:ec2::254', 'metadata.google.internal']);
const BLOCKED_RANGES = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
  /^0\./,
];

export type LookupFn = (hostname: string) => Promise<string[]>;

export async function defaultLookup(hostname: string): Promise<string[]> {
  if (isIP(hostname)) {
    return [hostname];
  }
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

export function isLoopback(address: string): boolean {
  return address === '127.0.0.1' || address === '::1' || address.startsWith('127.');
}

export function isBlockedAddress(address: string, allowLoopback: boolean): boolean {
  const lowered = address.toLowerCase();
  if (METADATA.has(lowered)) {
    return true;
  }
  if (isLoopback(address)) {
    return !allowLoopback;
  }
  return BLOCKED_RANGES.some((pattern) => pattern.test(address));
}

export async function resolveAndValidate(
  hostname: string,
  allowLoopback: boolean,
  lookupFn: LookupFn = defaultLookup,
): Promise<string[]> {
  const addresses = await lookupFn(hostname);
  if (addresses.length === 0) {
    throw new Error('DNS_EMPTY');
  }
  for (const address of addresses) {
    if (isBlockedAddress(address, allowLoopback)) {
      throw new Error('DESTINATION_BLOCKED');
    }
  }
  return addresses;
}
