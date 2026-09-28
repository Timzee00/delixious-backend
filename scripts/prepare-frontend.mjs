import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.NODE_ENV !== 'production') {
  process.exit(0);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = path.join(root, 'frontend');

function run(command, args, cwd = root) {
  console.log(`[delixious] Running: ${command} ${args.join(' ')}`);
  execFileSync(command, args, { cwd, stdio: 'inherit', env: process.env });
}

try {
  // The existing Render service uses "npm install" + "npm start" rather than
  // the repository render.yaml build command. Prepare the frontend during
  // production startup so the service can still serve the unified app.
  if (fs.existsSync(frontend)) {
    fs.rmSync(frontend, { recursive: true, force: true });
  }

  run('git', ['clone', '--depth', '1', 'https://github.com/Timzee00/delixious-frontend.git', 'frontend']);
  run('npm', ['ci', '--prefix', 'frontend']);
  run('npm', ['run', 'build', '--prefix', 'frontend']);
} catch (error) {
  console.error('[delixious] Frontend preparation failed.');
  console.error(error);
  process.exit(1);
}
