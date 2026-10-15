#!/usr/bin/env node
// Quality gate for the guided tour (src/tour/tours.js).
//
// The first tutorial lit fixed pixel positions: at any other window size it
// pointed at the wrong thing, and nothing could tell. A step now names an
// element (`data-tour`), so three things can be checked without a window:
//   1. every step's element is marked somewhere in the source;
//   2. every step's title and text exist in every language — the tour reads
//      them through computed keys, which verifier-locales cannot follow;
//   3. "what's new" picks the right versions for an update from A to B.
//
// Usage: node tools/verifier-visite.mjs [src-folder]   (default: ../src)

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] ? resolve(process.argv[2]) : join(HERE, '..', 'src');
const { DISCOVER, WHATS_NEW, whatsNewSteps } = await import(pathToFileURL(join(SRC, 'tour', 'tours.js')).href);

let bad = 0;
const fail = (msg) => { bad++; console.error(`ÉCART  ${msg}`); };

// 1. The marked elements: data-tour="x", and the Settings pages' settings-<id>.
function files(dir) {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(jsx?|mjs)$/.test(n) ? [p] : [];
  });
}
const marked = new Set();
for (const f of files(SRC)) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/data-tour="([\w-]+)"/g)) marked.add(m[1]);
  if (/data-tour=\{`nav-\$\{item\.id\}`\}/.test(text)) {
    const items = text.match(/const NAV_ITEMS = \[([\s\S]*?)\];/);
    for (const m of (items?.[1] || '').matchAll(/id:\s*'([\w-]+)'/g)) marked.add(`nav-${m[1]}`);
  }
  if (/data-tour=\{`settings-\$\{id\}`\}/.test(text)) {
    const sections = text.match(/const SECTIONS = \[([\s\S]*?)\];/);
    for (const m of (sections?.[1] || '').matchAll(/id:\s*'([\w-]+)'/g)) marked.add(`settings-${m[1]}`);
  }
}

const whatsNew = Object.entries(WHATS_NEW).flatMap(([v, steps]) => steps.map(s => ({
  ...s, where: `nouveautés ${v} › ${s.key}`,
  titleKey: `whatsNew.${s.key}.title`, bodyKey: `whatsNew.${s.key}.body`,
})));
const all = [...DISCOVER.map(s => ({ ...s, where: `visite › ${s.key}` })), ...whatsNew];
for (const s of all) {
  if (s.target && !marked.has(s.target)) fail(`${s.where} : aucun élément ne porte data-tour="${s.target}"`);
}

// 2. The words, in every language.
const langs = readdirSync(join(SRC, 'locales')).filter(n => n.endsWith('.js'));
for (const name of langs) {
  const dict = (await import(pathToFileURL(join(SRC, 'locales', name)).href)).default;
  for (const s of all) for (const k of [s.titleKey, s.bodyKey]) {
    if (!dict?.[k] || !String(dict[k]).trim()) fail(`${s.where} : « ${k} » manque dans ${name}`);
  }
}

// 3. Which versions an update shows.
const keys = (from, to) => whatsNewSteps(from, to).map(s => s.key).join(',');
const latest = Object.keys(WHATS_NEW).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
const cases = [
  ['1.6.1 → 1.6.2 : la 1.6.2 seule', keys('1.6.1', '1.6.2'), WHATS_NEW['1.6.2'].map(s => s.key).join(',')],
  ['1.5.9 → 1.6.2 : la 1.6.0 puis la 1.6.2', keys('1.5.9', '1.6.2'), [...WHATS_NEW['1.6.0'], ...WHATS_NEW['1.6.2']].map(s => s.key).join(',')],
  ['1.6.0 → 1.6.1 : rien à montrer', keys('1.6.0', '1.6.1'), ''],
  // In text, "1.6.10" would sort before "1.6.2" and the 1.6.2 news be lost.
  ['1.6.1 → 1.6.10 : les numéros se comparent en nombres', keys('1.6.1', '1.6.10'), WHATS_NEW['1.6.2'].map(s => s.key).join(',')],
  ['origine inconnue : la dernière version seule', keys(null, latest), WHATS_NEW[latest].map(s => s.key).join(',')],
];
for (const [name, got, want] of cases) if (got !== want) fail(`${name} : « ${got} », attendu « ${want} »`);

if (bad) process.exit(1);
console.log(`visite guidée — ${all.length} étapes, ${langs.length} langue(s), ${cases.length} cas de nouveautés, aucun écart.`);
