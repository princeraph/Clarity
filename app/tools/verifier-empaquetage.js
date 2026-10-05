// electron-builder afterPack hook: inspect the packaged app, not the staging folder.
//
// tools/preparer-backend.mjs already checks .backend-pkg/ before packaging. That
// was not enough. Moving from electron-builder 24 to 26 changed how extraResources
// are copied: a node_modules folder at the root of a `from` is now always dropped,
// whatever the filter says. The staged backend was complete; the packaged one had
// no express — "Cannot find package 'express'" at first launch, the very defect
// the staging step exists to prevent. Nothing failed: the check looked at the
// wrong folder. This one looks at what will actually ship.
//
// CommonJS on purpose: electron-builder require()s this file.

const fs = require('fs');
const path = require('path');

exports.default = async function verifierEmpaquetage(context) {
  const resources = context.packager.getResourcesDir
    ? context.packager.getResourcesDir(context.appOutDir)
    : path.join(context.appOutDir, 'resources');
  const backend = path.join(resources, 'backend');
  const manques = [];

  for (const f of ['server.js', 'package.json', 'src']) {
    if (!fs.existsSync(path.join(backend, f))) manques.push(`backend/${f}`);
  }
  // Every runtime dependency the backend declares — read, not copied by hand.
  const deps = Object.keys(JSON.parse(fs.readFileSync(path.join(backend, 'package.json'), 'utf8')).dependencies || {});
  if (!deps.length) manques.push('backend/package.json declares no dependencies');
  for (const dep of deps) {
    if (!fs.existsSync(path.join(backend, 'node_modules', dep, 'package.json'))) manques.push(`backend/node_modules/${dep}`);
  }
  if (!fs.existsSync(path.join(resources, 'frontend', 'dist', 'index.html'))) manques.push('frontend/dist/index.html');
  if (!fs.existsSync(path.join(backend, 'src', 'llm', 'engineWorker.js'))) manques.push('backend/src/llm/engineWorker.js');

  // The built-in assistant: an engine for the platform being packaged, and no
  // CUDA build — 540 MB that preparer-backend removes on purpose.
  const enginesDir = path.join(backend, 'node_modules', '@node-llama-cpp');
  const engines = fs.existsSync(enginesDir) ? fs.readdirSync(enginesDir) : [];
  const prefix = { win32: 'win-', darwin: 'mac-', linux: 'linux-' }[context.electronPlatformName];
  if (!engines.some(n => n.startsWith(prefix))) manques.push(`backend/node_modules/@node-llama-cpp/${prefix}* (built-in assistant engine)`);
  const cuda = engines.filter(n => n.includes('cuda'));
  if (cuda.length) {
    throw new Error(`[verifier-empaquetage] CUDA engines were packaged (${cuda.join(', ')}) — hundreds of MB nobody needs`);
  }

  if (manques.length) {
    throw new Error(`[verifier-empaquetage] the packaged app is incomplete — it would not start:\n  ${manques.join('\n  ')}`);
  }
  if (fs.existsSync(path.join(backend, 'node_modules', 'jest'))) {
    throw new Error('[verifier-empaquetage] dev dependency jest was packaged with the backend');
  }
  console.log(`  • [verifier-empaquetage] backend complete in ${path.relative(process.cwd(), backend)} — engines: ${engines.join(', ')}`);
};
