#!/usr/bin/env node
// Clarity 2.8.0 in a real browser, against a real backend: a subtask opens as
// a page beside its task (the owner's drawing, option A of 29 October).
//   1. Click a subtask: its page opens on the right, the task's slides left.
//   2. Date, level, status, difficulty, title, notes: saved.
//   3. Another subtask replaces the page.
//   4. Esc closes the subtask's page first, then the task's.
//   5. « Make it a task »: a task with what the subtask had, linked back.
//
// Not run by the CI. By hand, as for 2.7:
//   CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   NODE_PATH=$(npm root -g) node frontend/tools/essai-navigateur-2.8.cjs

const { chromium } = require('playwright');
const API = 'http://localhost:3001/api';
const URL = 'http://localhost:5173/';
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK   ' : 'ÉCART'} ${msg}`); if (!cond) bad++; };
const call = async (path, opts = {}) => { const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts }); return { status: r.status, body: await r.json().catch(() => null) }; };
const tasks = async () => { const { body } = await call('/tasks'); return [...body.tasks, ...body.archivedTasks]; };
const until = async (fn, ms = 5000) => { for (let k = 0; k < ms / 100; k++) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };

(async () => {
  for (const t of await tasks()) await fetch(`${API}/tasks/${t.id}`, { method: 'DELETE' });
  await call('/settings', { method: 'POST', body: JSON.stringify({ onboardingComplete: true }) });
  const P = (await call('/tasks', { method: 'POST', body: JSON.stringify({ title: 'Courses', tags: ['Maison'], subtasks: [
    { id: 's1', title: 'Lait', notes: '', dueDate: null, done: false },
    { id: 's2', title: 'Pain', notes: '', dueDate: null, done: false },
    { id: 's3', title: 'Œufs', notes: '', dueDate: null, done: false },
  ] }) })).body.task;
  const parent = async () => (await tasks()).find(t => t.id === P.id);
  const sub = async (id) => (await parent()).subtasks.find(s => s.id === id);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    Object.entries({ 'clarity-onboarding-done': '1', 'clarity-tutorialSeen': '1', 'clarity-locale': 'fr', 'clarity-lastSeenVersion': '9.9.9' }).forEach(([k, v]) => localStorage.setItem(k, v));
    sessionStorage.setItem('seeded', '1');
  });
  await p.route('**/api/crash', r => r.request().method() === 'GET' ? r.fulfill({ json: { available: false, asked: true } }) : r.continue());
  await p.route('**/api/feedback', r => r.request().method() === 'GET' ? r.fulfill({ json: { enabled: false } }) : r.continue());
  await p.route('**/api/reminders/claim', r => r.fulfill({ json: { reminders: [] } }));
  await p.route('**/api/suggestions/next', r => r.fulfill({ json: { suggestion: null } }));
  await p.goto(URL);

  // From the topic's page, as the owner described.
  await p.click('[data-tour="topics"] button:has-text("Maison")');
  await p.click(`[data-topic-task="${P.id}"]`);
  await p.waitForSelector('[data-detail-panel]');
  const right = () => p.$eval('[data-detail-panel]', el => Math.round(window.innerWidth - el.getBoundingClientRect().right));

  // 1. Open.
  await p.click('[data-detail-panel] [data-subtask-id="s1"]');
  ok(await until(async () => !!(await p.$('[data-subtask-panel="s1"]'))), 'cliquer une sous-tâche ouvre sa page');
  ok(await until(async () => (await right()) >= 350), `la tâche glisse à gauche pour lui faire place (${await right()} px)`);
  const box = await p.$eval('[data-subtask-panel="s1"]', el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right }; });
  const task = await p.$eval('[data-detail-panel]', el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right }; });
  ok(task.right <= box.left + 1, 'la sous-tâche est à droite de sa tâche, sans la couvrir');

  // 2. Every field.
  const S = '[data-subtask-panel="s1"]';
  await p.fill(`${S} [data-field="subtask-title"]`, 'Lait d’avoine');
  await p.fill(`${S} [data-field="subtask-notes"]`, 'Sans sucre');
  await p.click(`${S} [data-level="high"]`);
  await p.click(`${S} [data-status="in_progress"]`);
  await p.click(`${S} [role="radiogroup"][aria-label="Difficulté"] button:has-text("2")`).catch(() => {});
  await p.fill(`${S} [data-field="subtask-due"]`, '2026-11-02');
  ok(await until(async () => { const s = await sub('s1'); return s.title === 'Lait d’avoine' && s.notes === 'Sans sucre'; }), 'titre et notes enregistrés');
  ok(await until(async () => { const s = await sub('s1'); return s.priority === 'high' && s.status === 'in_progress' && s.done === false && s.dueDate === '2026-11-02'; }), 'niveau, statut (en cours, pas cochée) et date enregistrés');
  ok(await until(async () => (await sub('s1')).difficulty === 2), 'difficulté enregistrée');
  ok(!(await p.$('[data-task-form]')), 'jamais la fenêtre complète');

  // 3. Another replaces it.
  await p.click('[data-detail-panel] [data-subtask-id="s2"]');
  ok(await until(async () => !!(await p.$('[data-subtask-panel="s2"]')) && !(await p.$('[data-subtask-panel="s1"]'))), 'une autre sous-tâche remplace la page');
  await p.click('[data-subtask-panel="s2"] [data-status="done"]');
  ok(await until(async () => (await sub('s2')).done === true), '« Terminée » coche la sous-tâche');

  // 4. Esc, twice.
  await p.keyboard.press('Escape');
  ok(await until(async () => !(await p.$('[data-subtask-panel]')) && !!(await p.$('[data-detail-panel]'))), 'Échap ferme d’abord la sous-tâche, la tâche reste');
  ok(await until(async () => (await right()) < 5), '… et la tâche reprend sa place');
  await p.keyboard.press('Escape');
  ok(await until(async () => !(await p.$('[data-detail-panel]'))), 'Échap encore : la tâche se ferme');

  // 5. Make it a task.
  await p.click(`[data-topic-task="${P.id}"]`);
  await p.click('[data-detail-panel] [data-subtask-id="s1"]');
  await p.click('[data-subtask-panel="s1"] [data-action="promote-subtask"]');
  ok(await until(async () => !(await parent()).subtasks.some(s => s.id === 's1')), '« En faire une tâche » : elle quitte sa tâche');
  const made = (await tasks()).find(t => t.title === 'Lait d’avoine');
  ok(!!made && made.priority === 'high' && made.difficulty === 2 && made.status === 'in_progress' && made.deadline === '2026-11-02' && made.notes === 'Sans sucre', 'la nouvelle tâche garde date, niveau, difficulté, statut, notes');
  ok(!!made && made.tags.includes('Maison') && (made.links || []).some(l => l.to === P.id && l.type === 'related'), '… le sujet de sa tâche, et un lien vers elle');
  ok(await until(async () => /est devenue une tâche/.test(await p.textContent('body'))), 'un message le dit, avec « Ouvrir »');
  ok((await parent()).subtasks.map(s => s.id).join() === 's2,s3', 'les autres sous-tâches restent');

  ok(errors.length === 0, `aucune erreur dans la page${errors.length ? ' : ' + errors.join(' | ') : ''}`);
  await browser.close();
  console.log(bad ? `\n${bad} écart(s).` : '\nTout est vert.');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
