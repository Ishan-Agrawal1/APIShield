import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { root } from './lib.mjs';

const children = [
  spawn('npm', ['run', 'dev'], { cwd: join(root, 'vulnerable-api'), stdio: 'inherit', shell: process.platform === 'win32' }),
  spawn('npm', ['run', 'dev'], { cwd: join(root, 'backend'), stdio: 'inherit', shell: process.platform === 'win32' }),
  spawn('npm', ['run', 'dev'], { cwd: join(root, 'frontend'), stdio: 'inherit', shell: process.platform === 'win32' }),
];
console.log('Starting vulnerable-api, backend, and frontend. Bind hosts are loopback.');
for (const child of children) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });
}
