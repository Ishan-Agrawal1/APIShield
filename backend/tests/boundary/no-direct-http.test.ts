import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (full.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

describe('import boundary', () => {
  it('keeps scanners from calling HTTP clients directly', () => {
    const scannerRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'scanner');
    const files = walk(scannerRoot).filter((file) => !file.includes(`${join('scanner', 'executor')}`));
    const pattern = /\b(fetch\s*\(|axios|undici|http\.request|https\.request)/;
    const offenders = files.filter((file) => pattern.test(readFileSync(file, 'utf8')));
    assert.deepEqual(offenders, []);
  });
});
