import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = dirname(fileURLToPath(import.meta.url));
const yamlPath = join(root, '..', 'openapi.yaml');
const jsonPath = join(root, '..', 'openapi.json');
const spec = parse(readFileSync(yamlPath, 'utf8'));
writeFileSync(jsonPath, `${JSON.stringify(spec, null, 2)}\n`);
console.log('Wrote', jsonPath);
