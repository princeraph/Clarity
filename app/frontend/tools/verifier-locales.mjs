#!/usr/bin/env node
// Refuse a half-translated interface.
//
// Clarity already shipped a language picker that offered eight languages and
// implemented none. The failure was not that translating is hard — it is that
// nothing in the build could tell the difference between "translated" and
// "claims to be translated". This can.
//
// Three checks, and any of them failing is an error, not a warning:
//   1. every key used in the source exists in every dictionary;
//   2. every dictionary holds exactly the same key set as English;
//   3. no dictionary has an empty string standing in for a translation.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const LOCALES = join(SRC, 'locales');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|mjs)$/.test(p)) out.push(p);
  }
  return out;
}

// t('key') and t("key", {...}) — only literal keys can be checked, so a
// computed key is reported rather than silently skipped.
const LITERAL = /\bt\(\s*'([^']+)'/g;
// t(item.labelKey) and t(`x.${y}`) — a key the scan cannot resolve. Reported,
// never silently skipped, so nobody assumes coverage the checker cannot give.
const COMPUTED = /\bt\(\s*[`$]|\bt\(\s*[A-Za-z_$][\w$.]*\s*[,)]/g;
// A key can also be named indirectly — `labelKey: 'nav.inbox'` — and is still
// used. So "unused" means "this string appears nowhere in the source at all".
const ANY_LITERAL = /'([A-Za-z][\w.]*\.[\w.]+)'/g;

const files = walk(SRC).filter(f => !f.startsWith(LOCALES));
const used = new Map();      // key -> first file that used it
const computed = [];
const mentioned = new Set();   // every dotted literal seen anywhere in src

for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(LITERAL)) {
    if (!used.has(m[1])) used.set(m[1], relative(SRC, f));
  }
  for (const m of text.matchAll(ANY_LITERAL)) mentioned.add(m[1]);
  if (COMPUTED.test(text)) computed.push(relative(SRC, f));
  COMPUTED.lastIndex = 0;
}

const dicts = {};
for (const name of readdirSync(LOCALES).filter(f => f.endsWith('.js'))) {
  const mod = await import(pathToFileURL(join(LOCALES, name)).href);
  dicts[name.replace(/\.js$/, '')] = mod.default;
}

// A component that calls t() without useLocale() in scope compiles fine and
// then throws "t is not defined" the moment it renders. Vite cannot see it;
// this can, so it is checked here rather than discovered by a user.
const FN_START = /^(?:export default )?function ([A-Za-z][\w]*)\s*\(([^)]*)\)/;
const scopeProblems = [];
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  const starts = [];
  lines.forEach((l, i) => { const m = l.match(FN_START); if (m) starts.push({ i, name: m[1], args: m[2] }); });
  starts.forEach((fn, idx) => {
    const body = lines.slice(fn.i, idx + 1 < starts.length ? starts[idx + 1].i : lines.length).join('\n');
    const callsT = /\bt\(\s*['`]/.test(body) || /\bt\(\s*[A-Za-z_$][\w$.]*\s*[,)]/.test(body);
    const hasHook = /const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useLocale\(\)/.test(body);
    const takesT = /\bt\b/.test(fn.args);
    if (callsT && !hasHook && !takesT) {
      scopeProblems.push(`${relative(SRC, f)}:${fn.i + 1} ${fn.name}() calls t() with no useLocale() in scope`);
    }
  });
}

// A t() call at module level runs when the file is imported, before any React
// component exists — so `t` is not defined and the whole app blanks out with a
// white screen and one console line. The build cannot see it either.
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  let depth = 0;
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    if (depth === 0 && /(^|[^\w.])t\(\s*['`]/.test(code) && !/^\s*(\/\/|\*)/.test(line)) {
      scopeProblems.push(`${relative(SRC, f)}:${i + 1} t() is called at module level, before any component exists`);
    }
    depth += (code.match(/[{(]/g) || []).length - (code.match(/[})]/g) || []).length;
    if (depth < 0) depth = 0;
  });
}

const problems = [...scopeProblems];
const base = 'en';
if (!dicts[base]) problems.push('no en.js — English is the fallback every other language leans on');

for (const [key, file] of used) {
  for (const [lang, dict] of Object.entries(dicts)) {
    if (!(key in dict)) problems.push(`${lang}: missing key "${key}" (used in ${file})`);
  }
}

if (dicts[base]) {
  const baseKeys = new Set(Object.keys(dicts[base]));
  for (const [lang, dict] of Object.entries(dicts)) {
    if (lang === base) continue;
    for (const k of Object.keys(dict)) if (!baseKeys.has(k)) problems.push(`${lang}: key "${k}" is not in ${base}`);
    for (const k of baseKeys) if (!(k in dict)) problems.push(`${lang}: key "${k}" from ${base} is not translated`);
  }
}

for (const [lang, dict] of Object.entries(dicts)) {
  for (const [k, v] of Object.entries(dict)) {
    if (typeof v !== 'string' || !v.trim()) problems.push(`${lang}: "${k}" is empty — an untranslated string must not pass as translated`);
  }
}

const unused = [...Object.keys(dicts[base] ?? {})].filter(k => !used.has(k) && !mentioned.has(k));

console.log(`locales — ${Object.keys(dicts).length} langue(s), ${used.size} clé(s) utilisée(s) dans ${files.length} fichier(s)`);
if (computed.length) console.log(`  note : clé calculée (non vérifiable) dans ${computed.join(', ')}`);
if (unused.length) console.log(`  note : ${unused.length} clé(s) définie(s) mais plus utilisée(s) : ${unused.slice(0, 8).join(', ')}${unused.length > 8 ? '…' : ''}`);

if (problems.length) {
  console.error(`\n${problems.length} écart(s) :`);
  for (const p of problems.slice(0, 40)) console.error(`  · ${p}`);
  if (problems.length > 40) console.error(`  … et ${problems.length - 40} autre(s)`);
  process.exit(1);
}
console.log('Aucun écart.');
