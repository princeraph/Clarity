#!/usr/bin/env node
// Lot E1 in a real browser, against a real backend: one task window, centred.
//   1. On a topic's page the circle ticks the task; only the title opens it.
//   2. The window is centred; title, topic, estimate, description save when left.
//   3. Another task's title, clicked behind the window, replaces it in place.
//   4. A subtask opens beside its task, in the same window; Esc closes it, then the task.
//   5. « Edit » on a card opens the same window, not the form.
//   6. Narrow window: the subtask takes the task's place; Esc brings the task back.
//   7. A click on the page outside closes the window.
//
// Not run by the CI. By hand, as for 2.8:
//   CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   NODE_PATH=$(npm root -g) node frontend/tools/essai-navigateur-e1.cjs

const { chromium } = require('playwright');
const API = 'http://localhost:3001/api';
const URL = 'http://localhost:5173/';
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK   ' : 'ÉCART'} ${msg}`); if (!cond) bad++; };
const call = async (path, opts = {}) => { const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts }); return { status: r.status, body: await r.json().catch(() => null) }; };
const tasks = async () => { const { body } = await call('/tasks'); return [...body.tasks, ...body.archivedTasks]; };
const get = async (id) => (await tasks()).find(t => t.id === id);
const until = async (fn, ms = 5000) => { for (let k = 0; k < ms / 100; k++) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
const make = async (body) => (await call('/tasks', { method: 'POST', body: JSON.stringify(body) })).body.task;

(async () => {
  for (const t of await tasks()) await fetch(`${API}/tasks/${t.id}`, { method: 'DELETE' });
  await call('/settings', { method: 'POST', body: JSON.stringify({ onboardingComplete: true }) });
  const A = await make({ title: 'Courses', tags: ['Maison'], subtasks: [
    { id: 's1', title: 'Lait', notes: '', dueDate: null, done: false },
    { id: 's2', title: 'Pain', notes: '', dueDate: null, done: false },
  ] });
  const B = await make({ title: 'Arroser', tags: ['Maison'] });
  const C = await make({ title: 'Ranger la cave', tags: ['Maison'] });

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
  const win = '[data-task-window]';

  // 1. The circle ticks.
  await p.click('[data-tour="topics"] button:has-text("Maison")');
  await p.click(`[data-topic-row="${B.id}"] [data-action="toggle-done"]`);
  ok(await until(async () => (await get(B.id)).status === 'done'), 'le cercle, dans la page du sujet, coche la tâche');
  ok(!(await p.$(win)), '… sans ouvrir la fenêtre');

  // 2. Centred, edited in place.
  await p.click(`[data-topic-task="${A.id}"]`);
  await p.waitForSelector(win);
  const box = await p.$eval(win, el => { const r = el.getBoundingClientRect(); return { l: r.left, r: innerWidth - r.right }; });
  ok(Math.abs(box.l - box.r) < 4, `la fenêtre est au centre (marges ${Math.round(box.l)} / ${Math.round(box.r)})`);
  await p.fill(`${win} [data-field="title"]`, 'Courses du samedi');
  await p.press(`${win} [data-field="title"]`, 'Enter');
  await p.fill(`${win} [data-field="estimate"]`, '45');
  await p.fill(`${win} [data-field="description"]`, 'Marché, puis boulangerie');
  await p.fill(`${win} [data-field="topic"]`, 'maison ');
  await p.click(`${win} [data-field="title"]`);   // leave the topic field
  ok(await until(async () => { const a = await get(A.id); return a.title === 'Courses du samedi' && a.estimatedDuration === 45 && a.description === 'Marché, puis boulangerie'; }), 'titre, estimation, description : enregistrés en quittant le champ');
  ok(JSON.stringify((await get(A.id)).tags) === '["Maison"]', 'le sujet tapé « maison » garde l’orthographe connue');
  await p.selectOption(`${win} [data-field="status"]`, 'in_progress');
  ok(await until(async () => (await get(A.id)).status === 'in_progress'), 'le statut se change dans la fenêtre');

  // 3. Another task replaces it in place.
  await p.$eval(win, el => { el.__same = 1; });
  await p.click(`[data-topic-task="${C.id}"]`, { position: { x: 6, y: 6 } });   // its start shows left of the window
  ok(await until(async () => !!(await p.$(`[data-detail-panel="${C.id}"]`))), 'cliquer une autre tâche derrière la fenêtre l’y ouvre');
  ok(await p.$eval(win, el => el.__same === 1), '… dans la même fenêtre, ni fermée ni rouverte');

  // 4. Subtask beside its task.
  await p.click(`[data-topic-task="${A.id}"]`, { position: { x: 6, y: 6 } });
  await p.click(`${win} [data-subtask-id="s1"]`);
  await p.waitForSelector(`${win} [data-subtask-panel="s1"]`);
  const side = await p.evaluate(() => {
    const t = document.querySelector('[data-detail-panel]')?.getBoundingClientRect();
    const s = document.querySelector('[data-subtask-panel]')?.getBoundingClientRect();
    return t && s ? { beside: s.left >= t.right - 2, w: innerWidth, l: document.querySelector('[data-task-window]').getBoundingClientRect().left } : null;
  });
  ok(!!side && side.beside, 'la sous-tâche s’ouvre à côté de la tâche, dans la même fenêtre');
  ok(/Courses du samedi.*›.*Lait/.test(await p.textContent(`${win} [data-action="back-to-task"]`)), 'le fil dit « Tâche › Sous-tâche »');
  await p.fill(`${win} [data-field="subtask-notes"]`, 'Demi-écrémé');
  await p.click(`${win} [data-field="subtask-title"]`);
  ok(await until(async () => (await get(A.id)).subtasks.find(s => s.id === 's1').notes === 'Demi-écrémé'), 'les notes de la sous-tâche s’enregistrent');
  await p.click(`${win} [data-subtask-id="s2"]`);
  ok(await until(async () => !!(await p.$(`${win} [data-subtask-panel="s2"]`))), 'une autre sous-tâche remplace la première');
  await p.keyboard.press('Escape');
  ok(await until(async () => !(await p.$('[data-subtask-panel]')) && !!(await p.$(win))), 'Échap ferme d’abord la sous-tâche, la tâche reste');
  await p.keyboard.press('Escape');
  ok(await until(async () => !(await p.$(win))), 'Échap encore : la fenêtre se ferme');

  // 5. « Edit » opens the same window.
  await p.click('[data-tour="nav-inbox"]');
  await p.hover('text=Ranger la cave');
  await p.locator('button', { hasText: /^Modifier$/ }).first().click({ force: true, timeout: 5000 });
  ok(await until(async () => !!(await p.$(win))), '« Modifier » ouvre la même fenêtre');
  ok(!/Modifier la tâche/.test(await p.textContent('body')), '… et plus le formulaire');

  // 7. Outside click closes.
  await p.mouse.click(30, 870);
  ok(await until(async () => !(await p.$(win))), 'un clic sur la page, hors de la fenêtre, la ferme');

  // 6. Narrow.
  await p.setViewportSize({ width: 900, height: 800 });
  await p.click('[data-tour="topics"] button:has-text("Maison")').catch(() => {});
  await p.click(`[data-topic-task="${A.id}"]`);
  await p.click(`${win} [data-subtask-id="s1"]`);
  ok(await until(async () => !!(await p.$(`${win} [data-subtask-panel="s1"]`)) && !(await p.$('[data-detail-panel]'))), 'écran étroit : la sous-tâche prend la place de la tâche');
  const fits = await p.$eval(win, el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; });
  ok(fits, '… et la fenêtre tient dans l’écran');
  await p.click(`${win} [data-action="back-to-task"]`);
  ok(await until(async () => !!(await p.$('[data-detail-panel]')) && !(await p.$('[data-subtask-panel]'))), 'la flèche retour ramène la tâche');

  ok(errors.length === 0, `aucune erreur dans la page${errors.length ? ' : ' + errors.join(' | ') : ''}`);
  await browser.close();
  console.log(bad ? `\n${bad} écart(s).` : '\nTout est vert.');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
