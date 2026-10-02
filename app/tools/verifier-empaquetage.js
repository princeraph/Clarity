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

  if (manques.length) {
    throw new Error(`[verifier-empaquetage] the packaged app is incomplete — it would not start:\n  ${manques.join('\n  ')}`);
  }
  if (fs.existsSync(path.join(backend, 'node_modules', 'jest'))) {
    throw new Error('[verifier-empaquetage] dev dependency jest was packaged with the backend');
  }
  console.log(`  • [verifier-empaquetage] backend complete in ${path.relative(process.cwd(), backend)}`);
};
