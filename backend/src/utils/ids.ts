import { createHash, randomUUID } from 'node:crypto';

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function stableId(...parts: string[]): string {
  return sha256Hex(parts.join('|')).slice(0, 32);
}

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function monotonicMs(): number {
  return Number(process.hrtime.bigint() / 1_000_000n);
}
