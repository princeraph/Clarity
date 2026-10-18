// Import (2.5.0): tasks from elsewhere, so trying Clarity does not mean
// typing everything again. Four shapes, recognised from the content:
//   - a Clarity export (.json, Settings › Data › Export) — tasks as they were;
//   - a Todoist CSV export (TYPE, CONTENT, DESCRIPTION, PRIORITY, DATE…);
//   - any CSV with a title column (title, titre, task, tâche, name, nom…),
//     and optionally a date, notes and priority;
//   - plain text: one task per line (« - », « * », « [ ] » and numbers removed;
//     « [x] » lines are done).
// Pure: returns what would be created; the server writes it in one go.

export const MAX_IMPORT = 2000;
const PRIORITIES = ['top', 'very_high', 'high', 'medium', 'low', 'very_low'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** One CSV line → cells (quotes, doubled quotes, commas or semicolons). */
export function csvRows(text) {
  const rows = [];
  const first = text.split(/\r?\n/, 1)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}

const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const col = (header, names) => header.findIndex(h => names.includes(norm(h)));

// « 2026-10-20 », « 20/10/2026 », « 10/20/2026 » (month first only when the
// first number cannot be a month) → ISO, or null.
export function readDate(s) {
  const v = String(s || '').trim();
  if (ISO.test(v.slice(0, 10)) && !Number.isNaN(Date.parse(v.slice(0, 10)))) return v.slice(0, 10);
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  if (!m) return null;
  let [, a, b, y] = m.map(Number);
  const [d, mo] = a > 12 ? [a, b] : b > 12 ? [b, a] : [a, b];   // day first unless impossible
  const date = new Date(y, mo - 1, d);
  if (date.getMonth() !== mo - 1) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fromClarity(json) {
  const list = Array.isArray(json) ? json : [...(json.tasks || []), ...(json.archivedTasks || [])];
  return list.filter(t => t && typeof t.title === 'string' && t.title.trim()).map(t => ({
    title: t.title.trim().slice(0, 200),
    ...(t.description ? { description: String(t.description).slice(0, 2000) } : {}),
    ...(ISO.test(t.deadline || '') ? { deadline: t.deadline } : {}),
    ...(/^\d{2}:\d{2}$/.test(t.time || '') ? { time: t.time } : {}),
    ...(PRIORITIES.includes(t.priority) ? { priority: t.priority } : {}),
    ...(Number.isInteger(t.difficulty) && t.difficulty >= 1 && t.difficulty <= 5 ? { difficulty: t.difficulty } : {}),
    ...(typeof t.estimatedDuration === 'number' && t.estimatedDuration > 0 ? { estimatedDuration: t.estimatedDuration } : {}),
    ...(Array.isArray(t.tags) ? { tags: t.tags.filter(x => typeof x === 'string').slice(0, 5) } : {}),
    ...(t.status === 'done' ? { status: 'done' } : {}),
  }));
}

function fromCsv(rows) {
  const [header, ...body] = rows;
  // Todoist: TYPE / CONTENT; its PRIORITY 1 is the highest (p1, red).
  const type = col(header, ['type']), content = col(header, ['content']);
  if (type !== -1 && content !== -1) {
    const desc = col(header, ['description']), pr = col(header, ['priority']), date = col(header, ['date']);
    const P = { 1: 'very_high', 2: 'high', 3: 'medium' };
    return body.filter(r => norm(r[type]) === 'task' && (r[content] || '').trim()).map(r => {
      const deadline = readDate(r[date]);
      const looseDate = !deadline && (r[date] || '').trim();
      const description = [r[desc] || '', looseDate ? `Todoist : ${looseDate}` : ''].filter(Boolean).join('\n').trim();
      return { title: r[content].trim().slice(0, 200), ...(description ? { description } : {}), ...(deadline ? { deadline } : {}), ...(P[Number(r[pr])] ? { priority: P[Number(r[pr])] } : {}) };
    });
  }
  const title = col(header, ['title', 'titre', 'task', 'tache', 'name', 'nom', 'subject', 'sujet', 'content']);
  if (title === -1) return null;
  const date = col(header, ['due', 'due date', 'deadline', 'echeance', 'date', 'date limite']);
  const notes = col(header, ['notes', 'note', 'description', 'details']);
  const pr = col(header, ['priority', 'priorite']);
  const words = { urgent: 'top', haute: 'high', high: 'high', moyenne: 'medium', medium: 'medium', basse: 'low', low: 'low' };
  return body.filter(r => (r[title] || '').trim()).map(r => {
    const deadline = date !== -1 ? readDate(r[date]) : null;
    const priority = pr !== -1 ? (PRIORITIES.includes(norm(r[pr])) ? norm(r[pr]) : words[norm(r[pr])]) : null;
    return { title: r[title].trim().slice(0, 200), ...(notes !== -1 && r[notes]?.trim() ? { description: r[notes].trim().slice(0, 2000) } : {}), ...(deadline ? { deadline } : {}), ...(priority ? { priority } : {}) };
  });
}

function fromText(text) {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
    const done = /^[-*]?\s*\[[xX]\]/.test(l);
    const title = l.replace(/^([-*•]|\d+[.)])\s+/, '').replace(/^\[[ xX]?\]\s*/, '').trim();
    return title ? { title: title.slice(0, 200), ...(done ? { status: 'done' } : {}) } : null;
  }).filter(Boolean);
}

/**
 * `text`: the file's content. Returns { format, tasks, skipped, tooMany }
 * — `skipped`: already in `existing` (same title and date, any case).
 */
export function parseImport(text, existing = []) {
  const raw = String(text || '').replace(/^﻿/, '');
  let format = 'text', tasks;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { tasks = fromClarity(JSON.parse(trimmed)); format = 'clarity'; } catch { tasks = null; }
  }
  if (!tasks) {
    const rows = /[,;]/.test(trimmed.split(/\r?\n/, 1)[0]) ? csvRows(raw) : [];
    const csv = rows.length > 1 ? fromCsv(rows) : null;
    if (csv) { tasks = csv; format = norm(rows[0].join()).includes('content') && norm(rows[0].join()).includes('type') ? 'todoist' : 'csv'; }
    else tasks = fromText(raw);
  }
  const seen = new Set(existing.map(t => `${norm(t.title)}|${t.deadline || ''}`));
  const fresh = [];
  let skipped = 0;
  for (const t of tasks) {
    const key = `${norm(t.title)}|${t.deadline || ''}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key); fresh.push(t);
  }
  return { format, tasks: fresh.slice(0, MAX_IMPORT), skipped, tooMany: fresh.length > MAX_IMPORT };
}
