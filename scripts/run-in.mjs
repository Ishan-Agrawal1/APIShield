import { join } from 'node:path';
import { packages, root, run } from './lib.mjs';

const script = process.argv[2];
if (!script) {
  console.error('Usage: node scripts/run-in.mjs <script>');
  process.exit(1);
}

for (const name of packages) {
  await run('npm', ['run', script, '--if-present'], { cwd: join(root, name) });
}
