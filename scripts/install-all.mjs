import { join } from 'node:path';
import { packages, root, run } from './lib.mjs';

for (const name of packages) {
  await run('npm', ['install'], { cwd: join(root, name) });
}
