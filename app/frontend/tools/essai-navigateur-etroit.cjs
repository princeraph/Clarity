#!/usr/bin/env node
// Narrow window (< 1100 px): a subtask's page goes over its task's page
// instead of pushing it left over the list (tâche 2, 29 October).
//   1. 1000 px: open a subtask; the task's page stays at the right edge, the
//      subtask's page covers it exactly; the list keeps its width.
//   2. « ‹ task title » in the subtask's page goes back to the task.
//   3. Widen to 1400 px with a subtask open: the task slides left (2.8.0).
//   4. Narrow again while open: the task returns under the subtask.
//
// Not run by the CI. By hand, as for 2.8:
//   CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   NODE_PATH=$(npm root -g) node frontend/tools/essai-navigateur-etroit.cjs

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
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 }, locale: 'fr-FR' });
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
  const rect = (sel) => p.$eval(sel, el => { const r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right) }; });
  const settle = () => new Promise(r => setTimeout(r, 400));
  const W = () => p.evaluate(() => window.innerWidth);

  // 1. Narrow: over, not beside.
  await p.click('[data-detail-panel] [data-subtask-id="s1"]');
  ok(await until(async () => !!(await p.$('[data-subtask-panel="s1"]'))), '1000 px : la sous-tâche s’ouvre');
  await settle();
  let task = await rect('[data-detail-panel]'), page = await rect('[data-subtask-panel]');
  ok(task.right === await W(), `1000 px : la tâche reste au bord droit (droite ${task.right})`);
  ok(page.left === task.left && page.right === task.right, `1000 px : la sous-tâche recouvre la tâche (${page.left}-${page.right} sur ${task.left}-${task.right})`);
  ok(task.left >= (await W()) - 360, `1000 px : la liste garde ${task.left} px`);
  const onTop = await p.evaluate(() => { const r = document.querySelector('[data-subtask-panel]').getBoundingClientRect(); return !!document.elementFromPoint(r.left + 40, r.top + 60)?.closest('[data-subtask-panel]'); });
  ok(onTop, '1000 px : c’est la sous-tâche qu’on voit, pas la tâche');

  // 2. Back to the task.
  await p.click('[data-subtask-panel] [data-action="back-to-task"]');
  ok(await until(async () => !(await p.$('[data-subtask-panel]')) && !!(await p.$('[data-detail-panel]'))), '« ‹ tâche » ramène à la tâche, qui reste ouverte');

  // 3. Wide: beside, as in 2.8.0.
  await p.setViewportSize({ width: 1400, height: 800 });
  await p.click('[data-detail-panel] [data-subtask-id="s2"]');
  await p.waitForSelector('[data-subtask-panel="s2"]');
  await settle();
  task = await rect('[data-detail-panel]'); page = await rect('[data-subtask-panel]');
  ok(task.right === page.left, `1400 px : la tâche glisse à gauche de la sous-tâche (${task.right} / ${page.left})`);

  // 4. Narrow while open.
  await p.setViewportSize({ width: 1000, height: 800 });
  await settle();
  task = await rect('[data-detail-panel]'); page = await rect('[data-subtask-panel]');
  ok(task.right === 1000 && page.left === task.left, `rétréci, ouverte : la tâche revient sous la sous-tâche (${task.left}-${task.right})`);

  // Esc still closes the subtask first.
  await p.keyboard.press('Escape');
  ok(await until(async () => !(await p.$('[data-subtask-panel]')) && !!(await p.$('[data-detail-panel]'))), 'Échap ferme d’abord la sous-tâche');

  ok(errors.length === 0, `aucune erreur dans la page${errors.length ? ' : ' + errors.join(' | ') : ''}`);
  await browser.close();
  console.log(bad ? `\n${bad} écart(s).` : '\nTout est vert.');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
