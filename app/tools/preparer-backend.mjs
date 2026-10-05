// Stages the backend for electron-builder, WITH its production dependencies.
//
// The old extraResources filter copied backend/ but excluded node_modules, so
// the installed app had server.js and no express: "Cannot find package
// 'express'" at the first launch. Copying backend/node_modules as-is is not the
// fix either — it holds jest and every dev dependency. So the backend is staged
// into .backend-pkg/ (git-ignored) and installed there with --omit=dev.
//
// Usage: node tools/preparer-backend.mjs   (run by `npm run build`)

import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs';
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

// The built-in assistant's engine ships prebuilt for every GPU family npm
// finds for this platform. CUDA alone is 540 MB on Windows — five times the
// rest of the app — for NVIDIA cards that Vulkan already drives. The CPU and
// Vulkan builds stay; node-llama-cpp picks Vulkan when it works and the CPU
// otherwise.
const ENGINES = join(OUT, 'node_modules', '@node-llama-cpp');
const platformName = { win32: 'win', darwin: 'mac', linux: 'linux' }[process.platform];
if (existsSync(ENGINES)) {
  for (const name of readdirSync(ENGINES)) {
    // …and the builds for other processors (arm on an x64 machine).
    const forThisMachine = name.startsWith(`${platformName}-${process.arch}`);
    if (name.includes('cuda') || !forThisMachine) rmSync(join(ENGINES, name), { recursive: true, force: true });
  }
}
const engines = existsSync(ENGINES) ? readdirSync(ENGINES) : [];
if (!engines.some(n => n.startsWith(`${platformName}-`))) {
  throw new Error(`staged backend has no built-in assistant engine for ${process.platform} (found: ${engines.join(', ') || 'none'})`);
}

// Fail the build here rather than on a customer's machine.
// The list comes from backend/package.json, not from a copy kept here: a
// hand-written list would keep naming a package after it is dropped.
const deps = Object.keys(JSON.parse(readFileSync(join(SRC, 'package.json'), 'utf8')).dependencies || {});
for (const dep of deps) {
  if (!existsSync(join(OUT, 'node_modules', dep))) throw new Error(`staged backend lacks ${dep}`);
}
if (existsSync(join(OUT, 'node_modules', 'jest'))) throw new Error('dev dependency jest leaked into the package');
console.log('[preparer-backend] staged backend with production dependencies in .backend-pkg/');
