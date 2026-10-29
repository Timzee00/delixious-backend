import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The deployed Render service historically runs npm install without a separate build.
// Preserve that behavior, but use the committed monorepo frontend instead of cloning.
if (process.env.NODE_ENV !== 'production') process.exit(0);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = path.join(root, 'frontend');
if (!fs.existsSync(path.join(frontend, 'package.json'))) {
  console.error('[delixious] Monorepo frontend/package.json is missing. Check the checkout.');
  process.exit(1);
}
function run(args) {
  console.log('[delixious] npm ' + args.join(' '));
  execFileSync('npm', args, { cwd: root, stdio: 'inherit', env: process.env });
}
try {
  run(['ci', '--include=dev', '--prefix', 'frontend']);
  run(['run', 'build', '--prefix', 'frontend']);
} catch (error) {
  console.error('[delixious] Building the bundled frontend failed:', error.message);
  process.exit(1);
}
