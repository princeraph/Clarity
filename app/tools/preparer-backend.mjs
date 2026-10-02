// Stages the backend for electron-builder, WITH its production dependencies.
//
// The old extraResources filter copied backend/ but excluded node_modules, so
// the installed app had server.js and no express: "Cannot find package
// 'express'" at the first launch. Copying backend/node_modules as-is is not the
// fix either — it holds jest and every dev dependency. So the backend is staged
// into .backend-pkg/ (git-ignored) and installed there with --omit=dev.
//
// Usage: node tools/preparer-backend.mjs   (run by `npm run build`)

import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(APP, 'backend');
const OUT = join(APP, '.backend-pkg');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const entry of ['server.js', 'src', 'package.json', 'package-lock.json']) {
  const from = join(SRC, entry);
  if (!existsSync(from)) throw new Error(`missing ${from}`);
  cpSync(from, join(OUT, entry), { recursive: true });
}
// seed-tasks.json is demo data used by Seed.bat; ship it, never real data.
const seed = join(SRC, 'data', 'seed-tasks.json');
if (existsSync(seed)) {
  mkdirSync(join(OUT, 'data'), { recursive: true });
  cpSync(seed, join(OUT, 'data', 'seed-tasks.json'));
}

execSync('npm ci --omit=dev --no-audit --no-fund', { cwd: OUT, stdio: 'inherit' });

// Fail the build here rather than on a customer's machine.
for (const dep of ['express', 'cors', 'uuid']) {
  if (!existsSync(join(OUT, 'node_modules', dep))) throw new Error(`staged backend lacks ${dep}`);
}
if (existsSync(join(OUT, 'node_modules', 'jest'))) throw new Error('dev dependency jest leaked into the package');
console.log('[preparer-backend] staged backend with production dependencies in .backend-pkg/');
