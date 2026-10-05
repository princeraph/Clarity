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
// Then two sweeps for text that never reaches a dictionary at all: prose
// written into the JSX, and prose in JavaScript that lands on screen anyway
// (props, ternaries, toasts, label arrays, en-US dates, units glued to numbers,
// backend sentences shown verbatim). See sweepLiterals().
//
// Usage: node tools/verifier-locales.mjs [src-folder]   (default: ../src)

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
// An optional source folder, so the checker can be shown a COPY of src/ with a
// defect planted in it — the way to prove a check bites without touching the
// real tree.
const SRC = process.argv[2] ? resolve(process.argv[2]) : join(HERE, '..', 'src');
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

// Every .js in locales/ is taken to be a dictionary — that is what the folder
// means. A file here that default-exports anything else used to kill this
// script on `'key' in undefined`: a TypeError with a stack trace and no clue,
// stopping the whole quality barrier over what is really a misplaced file. It
// now says which file, and where such a file belongs. (This happened: a
// quick-capture grammar module landed here before moving to src/lib/.)
const dicts = {};
for (const name of readdirSync(LOCALES).filter(f => f.endsWith('.js'))) {
  const mod = await import(pathToFileURL(join(LOCALES, name)).href);
  const dict = mod.default;
  if (!dict || typeof dict !== 'object' || Array.isArray(dict)) {
    console.error(`locales/${name} does not default-export a dictionary object.`);
    console.error('Only dictionaries belong in src/locales/. Language helpers');
    console.error('that are not key/value tables go in src/lib/, where nothing');
    console.error('treats them as one.');
    process.exit(1);
  }
  dicts[name.replace(/\.js$/, '')] = dict;
}

// A component that calls t() without useLocale() in scope compiles fine and
// then throws "t is not defined" the moment it renders. Vite cannot see it;
// this can, so it is checked here rather than discovered by a user.
// The closing paren must NOT be required on the same line. The old pattern
// ended in `([^)]*)\)`, so a component whose props are destructured across
// several lines —
//     export default function SearchCapture({
//       open, onClose, …
//     }) {
// — never matched. It was therefore not a function as far as this check was
// concerned, and its body was folded into the PRECEDING function's. When that
// neighbour happened to hold useLocale(), the check saw a hook and stayed
// quiet. That is how SearchCapture shipped calling t() seventeen times with no
// hook of its own: Ctrl+K threw "t is not defined" on every open, and the one
// guard meant to catch exactly this was blind to it — the worst kind of
// failure, since it reported success.
const FN_START = /^(?:export default )?function ([A-Za-z][\w]*)\s*\(/;

// Arguments run from the opening paren to its match, however many lines that
// takes. Depth counting rather than a lazy regex, so a default value that
// itself contains parens does not end the list early.
function argsOf(lines, start) {
  const texte = lines.slice(start, start + 40).join('\n');
  const debut = texte.indexOf('(');
  if (debut === -1) return '';
  let profondeur = 0;
  for (let i = debut; i < texte.length; i++) {
    if (texte[i] === '(') profondeur++;
    else if (texte[i] === ')' && --profondeur === 0) return texte.slice(debut + 1, i);
  }
  return '';
}

const scopeProblems = [];
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  const starts = [];
  lines.forEach((l, i) => { const m = l.match(FN_START); if (m) starts.push({ i, name: m[1], args: argsOf(lines, i) }); });
  starts.forEach((fn, idx) => {
    const body = lines.slice(fn.i, idx + 1 < starts.length ? starts[idx + 1].i : lines.length).join('\n');
    const callsT = /\bt\(\s*['`]/.test(body) || /\bt\(\s*[A-Za-z_$][\w$.]*\s*[,)]/.test(body);
    // useLocale() is how a component gets t; the provider that BUILDS t
    // (LocaleContext: `const t = (key, vars) => …`) has it by definition.
    const hasHook = /const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useLocale\(\)/.test(body) || /\bconst\s+t\s*=\s*(\([^)]*\)|\w+)\s*=>/.test(body);
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

// Text written straight into the JSX never reaches a dictionary, so none of the
// checks above can see it: it simply stays English in every language. That is
// how fourteen strings — the offline banner, "+ Add Task", a whole paragraph of
// the Patterns view — shipped untranslated while this script said "Aucun
// écart". Two shapes are caught: a text node of two words or more between tags,
// and a quoted attribute meant for people (placeholder, title, label, value…).
// Text inside <code> is a command to type, not prose, and is left alone.
// ── The second sweep ─────────────────────────────────────────────────────────
//
// The text-node and quoted-attribute checks above still let a French interface
// show "Next →", "Saving…", "112d overdue", "Jun 15", "1/3 subtasks", "SETTINGS
// ·", a toast, a status message, a density picker — because none of those is a
// text node between two tags or a quoted attribute. They are string literals
// in JavaScript that happen to land on screen: a ternary inside {…}, a prop
// written as {'…'}, an argument to showToast(), an array mapped into buttons, a
// template string with a unit glued on, a date formatted in en-US. Each shape
// below is one of those, taken from a real leak.
//
// Escape hatch, for text that is genuinely not interface prose (a user's own
// words echoed back, a brand name): a comment containing `locales-ok` on the
// line, or the line before, with the reason.

// "Prose" = something a person reads: two words, or one capitalised word.
// Identifiers ('in_progress'), CSS ('1px solid'), ids ('nextWeek') are not.
const WORD = /[A-Za-zÀ-ÿ]{2,}/g;
function isProse(raw, { singleWord = true } = {}) {
  const txt = raw.replace(/\$\{[^}]*\}/g, ' ').trim();
  if (!txt || /^[a-z][\w-]*(\.[\w-]+)+$/.test(txt)) return false;          // a key: 'nav.inbox'
  if (/\d(px|ms|s|%|em|rem|vh|vw|fr|deg)\b|oklch|rgba?\(|#[0-9a-f]{3,8}\b|https?:|var\(/i.test(txt)) return false; // CSS, URL
  if (/^[\w-]+$/.test(txt) && /[_-]/.test(txt)) return false;               // in_progress, model-name
  const words = txt.match(WORD) || [];
  if (words.length >= 2 && /[A-Za-zÀ-ÿ]{2,}[\s,.!?…’'·—→-]+[^]*[A-Za-zÀ-ÿ]{2,}/.test(txt)) return true;
  return singleWord && /^[A-Z][a-zà-ÿ]{2,}[.!?…:]*(\s*[→←…])?$/.test(txt);
}

// Not interface prose even when it looks like a word: product names, key caps,
// a list made only of product names, a file path.
const BRANDS = new Set(['Clarity', 'clarity', 'JSON', 'CSV', 'AUTO', 'MD', 'Markdown', 'Geist', 'Ollama', 'OpenAI', 'Anthropic', 'OpenRouter', 'Ctrl', 'Tab', 'Version']);
const NOT_PROSE = {
  test(txt) {
    if (/^(Ctrl|Shift|Alt)\+/.test(txt) || /^[\w.-]*\/[\w./-]*$/.test(txt)) return true;
    const words = txt.match(/[A-Za-zÀ-ÿ]+/g) || [];
    return words.length > 0 && words.every(w => BRANDS.has(w));
  },
};

// The text of `{…}` starting at `open`, balanced across nested braces and
// strings, or null.
function balanced(src, open, o = '{', c = '}') {
  let depth = 0, q = null;
  for (let i = open; i < src.length && i < open + 4000; i++) {
    const ch = src[i];
    if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue; }
    if (ch === o) depth++;
    else if (ch === c && --depth === 0) return src.slice(open + 1, i);
  }
  return null;
}

// Blank out what is already translated or nested deeper — t('…') calls, inner
// (…) / {…} / JSX — so only the literals sitting at the top of an expression
// are left to judge.
function topLevel(expr) {
  let out = expr.replace(/\bt\(\s*(['`])(?:\\.|(?!\1).)*\1[^)]*\)/g, 't()')
    // A literal compared against is an id, not text: filter === 'Overdue'.
    .replace(/(===|!==|==|!=)\s*('[^'\n]*'|"[^"\n]*")/g, '$1 _')
    .replace(/('[^'\n]*'|"[^"\n]*")\s*(===|!==|==|!=)/g, '_ $2');
  for (let k = 0; k < 6; k++) {
    const before = out;
    out = out.replace(/\([^()]*\)/g, '()').replace(/\{[^{}]*\}/g, '{}').replace(/<[^<>]*>/g, '<>');
    if (out === before) break;
  }
  return out;
}

const LITERAL_RE = /'((?:\\.|[^'\\\n])*)'|"((?:\\.|[^"\\\n])*)"|`((?:\\.|[^`\\])*)`/g;
const literalsIn = expr => [...expr.matchAll(LITERAL_RE)].map(m => m[1] ?? m[2] ?? m[3]);

// Props whose value a person reads.
const PROSE_PROPS = 'hint|label|title|placeholder|message|subtitle|note|left|aria-label|alt|tooltip';
// Calls whose string argument ends up on screen.
const SHOWN_BY = 'showToast|setMessages|setStatus|setError|setNote|setSaveError|setRescheduleError|setBreakdownError|setStreamedText|setElicitNote|alert|confirm|showNotification';

const MONTH_OR_DAY = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)(day)?$|^(Su|Mo|Tu|We|Th|Fr|Sa)$|^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)$/;

function sweepLiterals(f, src, raw) {
  const out = [];
  const name = relative(SRC, f);
  const rawLines = raw.split('\n');
  const exempt = line => /locales-ok/.test(rawLines[line - 1] ?? '') || /locales-ok/.test(rawLines[line - 2] ?? '');
  const lineOf = i => src.slice(0, i).split('\n').length;
  const report = (i, what, txt) => {
    const line = lineOf(i);
    if (!exempt(line)) out.push(`${name}:${line} ${what}: « ${String(txt).replace(/\s+/g, ' ').slice(0, 60)} »`);
  };

  // 1. A prop whose value is an expression holding a literal:
  //    hint={isOllama ? 'Ollama not connected…' : ''}, label={'Saving…'}.
  for (const m of src.matchAll(new RegExp(`\\b(${PROSE_PROPS})=\\{`, 'g'))) {
    const expr = balanced(src, m.index + m[0].length - 1);
    if (expr === null) continue;
    for (const lit of literalsIn(topLevel(expr))) {
      if (isProse(lit) && !NOT_PROSE.test(lit.trim())) report(m.index, `${m[1]}={…} holds a literal instead of t()`, lit);
    }
  }

  // 2. A JSX child expression with a literal at its top: {saving ? 'Saving…' :
  //    t('…')}, {task.description || 'No notes yet.'}, {cond ? 'Done →' : …}.
  for (const m of src.matchAll(/(?<![=-])>\s*\{(?!\/\*)/g)) {
    const open = m.index + m[0].length - 1;
    const expr = balanced(src, open);
    if (expr === null) continue;
    for (const lit of literalsIn(topLevel(expr))) {
      if (isProse(lit) && !NOT_PROSE.test(lit.trim())) report(open, 'literal shown from a JSX expression instead of t()', lit);
    }
  }

  // 3. Text right AFTER an expression — `{n}d overdue`, `{a}/{b} subtasks`,
  //    `{done} of {total} done`, `{n} min` — and single-word text nodes that the
  //    two-word rule above lets through: >Focus<, >reset<, >Settings · {x}.
  for (const m of src.matchAll(/((?<![=-])>|\})([^<>{}`;=()]+)(?=[<{])/g)) {
    const txt = m[2].replace(/\s+/g, ' ').trim();
    if (!txt || /[\[\]]|\.\.\./.test(txt)) continue;
    const afterExpr = m[1] === '}';
    if (afterExpr && /^[dhm]\b|^min\b/.test(m[2])) { report(m.index, 'unit written after a number — use fmtDuration/fmtHours or a key', txt); continue; }
    if (!/[A-Za-zÀ-ÿ]{3,}/.test(txt) || NOT_PROSE.test(txt)) continue;
    if (afterExpr) {
      // Only inside JSX: the next tag or expression must open on this same
      // stretch, and plain JS (`} else {`, `} catch {`) has no prose in it.
      if (/^(else|catch|finally|return|from|while|const|let|var|if|async|await|export|function|import)\b/.test(txt)) continue;
      if (!/[A-Za-zÀ-ÿ]{2,}[ ·:,.'’][^]*[A-Za-zÀ-ÿ]{2,}|^[A-Za-zÀ-ÿ]{3,}$/.test(txt)) continue;
      const tail = src.slice(m.index + m[0].length, m.index + m[0].length + 2);
      if (!/^<\/|^\{/.test(tail)) continue;
    } else {
      if (/[A-Za-zÀ-ÿ]{2,}[ ,.'’][^]*[A-Za-zÀ-ÿ]{2,}/.test(txt)) continue;   // the two-word check above has it
      const tag = src.slice(src.lastIndexOf('<', m.index), m.index);
      if (/^<code\b/.test(tag)) continue;
    }
    report(m.index, 'text written in the JSX instead of t()', txt);
  }

  // 4. Strings handed to something that shows them: showToast('Task added'),
  //    setStatus({ message: 'Failed to save.' }), showNotification('…').
  for (const m of src.matchAll(new RegExp(`\\b(${SHOWN_BY})\\s*\\(`, 'g'))) {
    const args = balanced(src, m.index + m[0].length - 1, '(', ')');
    if (args === null) continue;
    let flat = args.replace(/\bt\(\s*(['`])(?:\\.|(?!\1).)*\1[^)]*\)/g, 't()');
    for (const lit of literalsIn(flat)) {
      if (isProse(lit) && !NOT_PROSE.test(lit.trim())) report(m.index, `${m[1]}() is given a literal instead of t()`, lit);
    }
  }
  //    …and `message: '…'` / `label: '…'` in any object, which is how status
  //    lines and button rows travel: { label: 'Done', color }, { label: 'save' }.
  for (const m of src.matchAll(/\b(?:message|label|title|hint|placeholder|subtitle):\s*('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)/g)) {
    const lit = m[1].slice(1, -1);
    if (isProse(lit) && !NOT_PROSE.test(lit.trim())) report(m.index, `${m[0].split(':')[0]}: holds a literal instead of t()`, lit);
  }

  // 5. Labels kept in an array and mapped into buttons:
  //    ['Spacious', 'Balanced', 'Compact'].map(…).
  for (const m of src.matchAll(/\[((?:\s*(?:'[^'\n]*'|"[^"\n]*")\s*,?)+)\]\s*\.map\(/g)) {
    for (const lit of literalsIn(m[1])) {
      if (isProse(lit) && !NOT_PROSE.test(lit.trim())) { report(m.index, 'label array mapped to the screen — map keys through t()', lit); break; }
    }
  }
  //    Pairs too — [['none', 'None'], ['daily', 'Daily']].map(…).
  for (const m of src.matchAll(/\[\s*\[\s*'[^'\n]*'\s*,\s*'([^'\n]*)'\s*\]/g)) {
    if (isProse(m[1]) && /\]\s*\]\s*\.map\(/.test(src.slice(m.index, m.index + 600))) report(m.index, 'label pairs mapped to the screen — map keys through t()', m[1]);
  }
  //    And names of days and months, which belong to the locale (fmtDate),
  //    never to a hand-written list.
  for (const m of src.matchAll(/\[\s*(['"])([A-Za-z]+)\1\s*,\s*(['"])([A-Za-z]+)\3/g)) {
    if (MONTH_OR_DAY.test(m[2]) && MONTH_OR_DAY.test(m[4])) report(m.index, 'day or month names written by hand — use fmtDate', `${m[2]}, ${m[4]}, …`);
  }

  // 6. Numbers and dates formatted outside the locale: toLocaleDateString('en-US'),
  //    toLocaleString() with no locale, and a unit glued to an interpolation in a
  //    template string — `${n}d overdue`, `${h}h ${m}m`.
  for (const m of src.matchAll(/\.toLocale(?:Date|Time)?String\(\s*(\)|['"]en-US['"])/g)) {
    report(m.index, 'date formatted outside the interface locale — use fmtDate/fmtDateTime', m[0]);
  }
  for (const m of src.matchAll(/`((?:\\.|[^`\\])*)`/g)) {
    const unit = m[1].match(/\$\{[^}]+\}(d|h|m|min)\b(?![-\w])/);
    if (unit) report(m.index, 'unit glued to a number — use fmtDuration/fmtHours or a key', '`' + m[1] + '`');
  }

  // 7. Text the backend wrote in English, shown as it came: err.error || …,
  //    {s.why}, ${status.reason}. Translate from the code that comes with it.
  for (const m of src.matchAll(/\b(?:err|body|data|json|resp)\.error\s*\|\||\{\s*\w+\.(?:why|reason)\s*\}|\$\{\s*\w+\.(?:why|reason)\s*\}/g)) {
    report(m.index, 'backend text shown verbatim — translate from its code', m[0]);
  }
  return out;
}

const hardcoded = [];
for (const f of files.filter(f => f.endsWith('.jsx'))) {
  const src = readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    // A `//` after a colon is a URL (placeholder="http://…"), not a comment.
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const lineOf = i => src.slice(0, i).split('\n').length;
  const TEXT_NODE = />([^<>{}`;=()]*)(?=[<{])/g;
  for (const m of src.matchAll(TEXT_NODE)) {
    const txt = m[1].replace(/\s+/g, ' ').trim();
    if (!/[A-Za-zÀ-ÿ]{2,}[ ,.'’][^]*[A-Za-zÀ-ÿ]{2,}/.test(txt)) continue;
    const tag = src.slice(src.lastIndexOf('<', m.index), m.index);
    if (/^<code\b/.test(tag)) continue;
    hardcoded.push(`${relative(SRC, f)}:${lineOf(m.index)} text written in the JSX, not through t(): « ${txt.slice(0, 60)} »`);
  }
  const ATTR = /\b(placeholder|title|aria-label|label|value|alt)=(?:"([^"]*)"|\{`([^`]*)`\})/g;
  for (const m of src.matchAll(ATTR)) {
    const txt = (m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, ' ');
    if (!/[A-Za-zÀ-ÿ]{2,}\s+[A-Za-zÀ-ÿ]{2,}/.test(txt)) continue;
    hardcoded.push(`${relative(SRC, f)}:${lineOf(m.index)} ${m[1]}= written in the JSX, not through t(): « ${(m[2] ?? m[3]).slice(0, 60)} »`);
  }

  hardcoded.push(...sweepLiterals(f, src, readFileSync(f, 'utf8')));
}

const problems = [...scopeProblems, ...hardcoded];
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
