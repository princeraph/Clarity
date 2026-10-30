#!/usr/bin/env node
// Lot E2 in a real browser, against a real backend:
//   1. History keeps every completion: a task deleted since, a repeating
//      task's past occurrence; grouped by month.
//   2. A topic's page no longer lists finished tasks; « See finished » opens
//      History filtered on the topic.
//   3. « New task » opens the form; Ctrl+K: typing puts « Create » first and
//      Enter creates.
//
// Not run by the CI. By hand, as for E1:
//   CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   NODE_PATH=$(npm root -g) node frontend/tools/essai-navigateur-e2.cjs

const { chromium } = require('playwright');
const API = 'http://localhost:3001/api';
const URL = 'http://localhost:5173/';
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK   ' : 'ÉCART'} ${msg}`); if (!cond) bad++; };
const call = async (path, opts = {}) => { const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts }); return { status: r.status, body: await r.json().catch(() => null) }; };
const tasks = async () => { const { body } = await call('/tasks'); return [...body.tasks, ...body.archivedTasks]; };
const until = async (fn, ms = 5000) => { for (let k = 0; k < ms / 100; k++) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
const make = async (body) => (await call('/tasks', { method: 'POST', body: JSON.stringify(body) })).body.task;
const tick = (id) => call(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'done' }) });

(async () => {
  for (const t of await tasks()) await fetch(`${API}/tasks/${t.id}`, { method: 'DELETE' });
  await call('/settings', { method: 'POST', body: JSON.stringify({ onboardingComplete: true }) });
  const R = await make({ title: 'Arroser les plantes', recurring: 'daily', deadline: '2026-10-30' });
  await tick(R.id);
  const D = await make({ title: 'Tâche supprimée ensuite' });
  await tick(D.id);
  await fetch(`${API}/tasks/${D.id}`, { method: 'DELETE' });
  const M = await make({ title: 'Réparer le robinet', tags: ['Maison'] });
  await tick(M.id);
  const O = await make({ title: 'Repeindre la porte', tags: ['Maison'] });
  const U = await make({ title: 'Cochée puis décochée' });
  await tick(U.id);
  await call(`/tasks/${U.id}`, { method: 'PUT', body: JSON.stringify({ status: 'not_started' }) });

  const reg = (await call('/completions')).body.completions.map(e => e.title);
  ok(reg.includes('Tâche supprimée ensuite') && reg.includes('Arroser les plantes') && reg.includes('Réparer le robinet'), 'le registre garde la tâche supprimée et l’occurrence répétée');
  ok(!reg.includes('Cochée puis décochée'), '… et pas une coche annulée');

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

  // 1. History.
  await p.click('[data-tour="nav-history"]');
  ok(await until(async () => /Tâche supprimée ensuite/.test(await p.textContent('main'))), 'History montre la tâche supprimée depuis');
  ok(/Arroser les plantes/.test(await p.textContent('main')), '… et l’occurrence passée de la tâche répétée');
  ok(/octobre 2026|novembre 2026/i.test(await p.textContent('[data-history-month]')), '… groupées par mois');

  // 2. Topic.
  await p.click('[data-tour="topics"] button:has-text("Maison")');
  await p.waitForSelector(`[data-topic-task="${O.id}"]`);
  ok(!(await p.$(`[data-topic-task="${M.id}"]`)), 'la page du sujet ne liste plus la tâche finie');
  await p.click('[data-action="see-finished"]');
  ok(await until(async () => !!(await p.$('[data-history-topic="Maison"]'))), '« Voir les finies » ouvre History filtré sur le sujet');
  ok(await until(async () => { const m = await p.textContent('main'); return /Réparer le robinet/.test(m) && !/Tâche supprimée ensuite/.test(m); }), '… avec seulement les tâches du sujet');

  // 3. Creating.
  await p.click('[data-tour="capture"]');
  ok(await until(async () => !!(await p.$('[data-task-form]'))), '« Nouvelle tâche » ouvre directement la création');
  await p.keyboard.press('Escape');
  await until(async () => !(await p.$('[data-task-form]')));
  await p.keyboard.press('Control+k');
  await p.keyboard.type('Repeindre');   // also finds « Repeindre la porte »
  ok(await until(async () => /Créer « Repeindre »/.test(await p.textContent('body'))), 'Ctrl+K : la première ligne dit « Créer « … » »');
  await p.keyboard.press('Enter');
  ok(await until(async () => (await tasks()).some(x => x.title === 'Repeindre')), '… et Entrée crée, même quand une tâche ressemble');
  ok(!(await p.$('[data-task-window]')), '… sans ouvrir la tâche qui ressemblait');

  ok(errors.length === 0, `aucune erreur dans la page${errors.length ? ' : ' + errors.join(' | ') : ''}`);
  await browser.close();
  console.log(bad ? `\n${bad} écart(s).` : '\nTout est vert.');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
