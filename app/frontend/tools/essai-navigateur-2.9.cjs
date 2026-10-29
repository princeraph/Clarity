#!/usr/bin/env node
// Clarity 2.9.0 (lot C′) in a real browser: topics offered while a tag is
// typed (task form and Ctrl+K), and « New session » in Focus.
//
// Not run by the CI. By hand, as for 2.8:
//   CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   NODE_PATH=$(npm root -g) node frontend/tools/essai-navigateur-2.9.cjs

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
  const F = (await call('/tasks', { method: 'POST', body: JSON.stringify({ title: 'Écrire le rapport', tags: ['Perso'] }) })).body.task;

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' });
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
  await p.click('[data-tour="nav-inbox"]');
  await p.waitForSelector(`[data-task-id="${F.id}"]`);

  // 1. The task form.
  await p.click('main button:has-text("Ajouter")');
  await p.waitForSelector('[data-task-form]');
  await p.fill('[data-task-form] input[placeholder*="étiquette"]', 'per');
  ok(await until(async () => !!(await p.$('[data-task-form] [data-suggest-tag="Perso"]'))), 'formulaire : « per » propose #Perso');
  await p.click('[data-task-form] [data-suggest-tag="Perso"]');
  ok(await until(async () => /Perso/.test(await p.textContent('[data-task-form]')) && !(await p.$('[data-task-form] [data-suggest-tag]'))), '… cliqué : ajouté, la proposition s’efface');
  await p.keyboard.press('Escape');
  ok(await until(async () => !(await p.$('[data-task-form]'))), 'Échap ferme le formulaire, où que soit le curseur');

  // 2. Ctrl+K.
  await p.keyboard.press('Control+k');
  await p.keyboard.type('acheter du pain #pe');
  ok(await until(async () => !!(await p.$('[data-suggest-tag="Perso"]'))), 'Ctrl+K : « #pe » propose #Perso');
  await p.click('[data-suggest-tag="Perso"]');
  await p.keyboard.press('Enter');
  ok(await until(async () => { const t = (await tasks()).find(x => x.title === 'acheter du pain'); return t && t.tags.join() === 'Perso'; }), '… la tâche est créée dans « Perso », pas « pe »');

  // 3. Focus: a new session once the first is over.
  await p.clock.install();   // only now: a fake clock from the start froze the overlays' animations
  await p.keyboard.press('Escape').catch(() => {});
  await p.click(`[data-task-id="${F.id}"] span[style*="cursor"]`).catch(() => p.click(`[data-task-id="${F.id}"]`));
  await p.click('[data-detail-panel] button:has-text("Focus")');
  ok(await until(async () => /restant/.test(await p.textContent('body'))), 'le mode Focus démarre');
  ok(!(await p.$('button:has-text("Nouvelle séance")')), 'pas de « Nouvelle séance » pendant la séance');
  await p.clock.fastForward('26:00');
  ok(await until(async () => !!(await p.$('button:has-text("Nouvelle séance")'))), 'séance dépassée : « Nouvelle séance » apparaît');
  await p.click('button:has-text("Nouvelle séance")');
  ok(await until(async () => /restant · séance 2/.test(await p.textContent('body'))), '… cliquée : séance 2, le compte repart');

  ok(errors.length === 0, `aucune erreur dans la page${errors.length ? ' : ' + errors.join(' | ') : ''}`);
  await browser.close();
  console.log(bad ? `\n${bad} écart(s).` : '\nTout est vert.');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
