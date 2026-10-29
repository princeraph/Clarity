#!/usr/bin/env node
// Clarity 2.7.0 in a real browser, against a real backend: the day's rituals.
//   1. A quick task: « courses 17h » → today at 17:00, in « Quick », alone.
//   2. Someday: put away from a task's details, gone from the Inbox, on its
//      own page, brought back.
//   3. Brain dump: lines typed, sorted, created where they were sorted.
//   4. Plan my day: offered in the morning; what is left from before gets a
//      place; whether the day fits; a task pulled into today; offer gone.
//   5. End my day: what is not done gets a place.
//
// Not run by the CI. By hand, as for 2.6:
//   CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   NODE_PATH=$(npm root -g) node frontend/tools/essai-navigateur-2.7.cjs

const { chromium } = require('playwright');
const API = 'http://localhost:3001/api';
const URL = 'http://localhost:5173/';
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK   ' : 'ÉCART'} ${msg}`); if (!cond) bad++; };
const call = async (path, opts = {}) => { const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts }); return { status: r.status, body: await r.json().catch(() => null) }; };
const tasks = async () => { const { body } = await call('/tasks'); return [...body.tasks, ...body.archivedTasks]; };
const find = async (title) => (await tasks()).find(t => t.title === title);
const until = async (fn, ms = 5000) => { for (let k = 0; k < ms / 100; k++) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const NOW = new Date(); const TODAY = iso(NOW);
const plus = (n) => { const d = new Date(NOW); d.setDate(d.getDate() + n); return iso(d); };

(async () => {
  for (const t of await tasks()) await fetch(`${API}/tasks/${t.id}`, { method: 'DELETE' });
  await call('/settings', { method: 'POST', body: JSON.stringify({ onboardingComplete: true, workday: { start: '09:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00', label: '' }], days: [0, 1, 2, 3, 4, 5, 6] } }) });
  const mk = async (title, extra) => (await call('/tasks', { method: 'POST', body: JSON.stringify({ title, status: 'not_started', ...extra }) })).body.task;
  ok((await call('/tasks', { method: 'POST', body: JSON.stringify({ title: 'x', someday: 'oui' }) })).status === 400, 'someday qui n’est pas vrai/faux : refusé');
  const late = await mk('Rapport en retard', { deadline: plus(-2), estimatedDuration: 60 });
  const big = await mk('Gros dossier', { deadline: TODAY, estimatedDuration: 420 });
  const undated = await mk('Ranger le bureau', { estimatedDuration: 30 });
  const parked = await mk('Apprendre la guitare');

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  // Morning, on today's date: the plan is offered before 14:00.
  await p.clock.setFixedTime(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 9, 0));
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
  await p.click('[data-tour="nav-today"]');

  // 1. Quick tasks.
  await p.fill('[data-field="quick-add"]', 'courses 17h');
  await p.keyboard.press('Enter');
  ok(await until(async () => { const t = await find('courses'); return t && t.quick && t.time === '17:00' && t.deadline === TODAY; }), '« courses 17h » : tâche rapide, aujourd’hui à 17 h');
  await p.fill('[data-field="quick-add"]', 'appeler le garage');
  await p.keyboard.press('Enter');
  ok(await until(async () => { const t = await find('appeler le garage'); return t && t.quick && !t.deadline && !t.time; }), 'sans heure : ni date ni heure');
  const courses = await find('courses');
  ok(await until(async () => !!(await p.$(`[data-tour="quick"] [data-task-id="${courses.id}"]`))), 'elle s’affiche dans « Rapide »');
  ok(!(await p.$(`[data-tour="today-list"] [data-task-id="${courses.id}"]`)), '… et pas une seconde fois dans les groupes du jour');

  // 2. Someday, from a task's details.
  await p.click('[data-tour="nav-inbox"]');
  await p.waitForSelector(`[data-task-id="${parked.id}"]`);
  await p.click(`[data-task-id="${parked.id}"] span[style*="cursor"]`).catch(() => p.click(`[data-task-id="${parked.id}"]`));
  await p.waitForSelector('[data-detail-panel] [data-action="someday"]');
  await p.click('[data-detail-panel] [data-action="someday"]');
  ok(await until(async () => (await find('Apprendre la guitare')).someday === true), '« Un jour » depuis le détail : enregistré');
  ok(await until(async () => !(await p.$(`[data-sortable="tasks"] [data-task-id="${parked.id}"]`))), 'elle quitte la Boîte de réception');
  ok(await until(async () => /Un jour\s*1/.test(await p.textContent('[data-tour="nav-later"]'))), 'la barre latérale compte 1 dans « Un jour »');
  await p.click('[data-tour="nav-later"]');
  ok(await until(async () => !!(await p.$(`[data-someday-task="${parked.id}"]`))), 'elle est sur la page « Un jour »');

  // 3. Brain dump.
  await p.click('[data-tour="brain-dump"]');
  await p.fill('[data-ritual="dump"] [data-field="dump"]', '- acheter des timbres\ndentiste vendredi 9h\nlire ce livre\nrien du tout\n');
  await p.click('[data-ritual="dump"] [data-act="sort"]');
  await p.waitForSelector('[data-ritual="dump"] [data-dump-line="3"]');
  await p.click('[data-dump-line="0"] [data-choice="today"]');
  await p.click('[data-dump-line="2"] [data-choice="someday"]');
  await p.click('[data-dump-line="3"] [data-choice="drop"]');
  await p.click('[data-ritual="dump"] [data-act="create"]');
  ok(await until(async () => (await find('acheter des timbres'))?.deadline === TODAY), 'vidage : « aujourd’hui » → pour aujourd’hui');
  ok(await until(async () => { const d = await find('dentiste'); return d?.time === '09:00' && !!d?.deadline; }), '… la ligne datée garde son jour et son heure');
  ok(await until(async () => (await find('lire ce livre'))?.someday === true), '… « un jour » → rangée dans Un jour');
  ok(await until(async () => !(await p.$('[data-ritual="dump"]'))) && !(await find('rien du tout')), '… « rien » : pas créée');
  ok(await until(async () => { const l = await find('lire ce livre'); return !!l && !!(await p.$(`[data-someday-task="${l.id}"]`)); }), 'la page « Un jour » la montre aussitôt');

  // Bring back from Someday.
  await p.click(`[data-someday-task="${parked.id}"] [data-choice="later"]`);
  ok(await until(async () => (await find('Apprendre la guitare')).someday === false), '« Ramener » : de retour, sans date');

  // 4. Plan my day.
  await p.click('[data-tour="nav-today"]');
  ok(await until(async () => !!(await p.$('[data-ritual-offer="plan"]'))), 'le matin, « Planifier ma journée » est proposé');
  await p.click('[data-act="open-plan"]');
  await p.waitForSelector('[data-ritual="plan"]');
  ok(/Ce qui reste d’avant/.test(await p.textContent('[data-ritual="plan"]')), 'étape 1 : ce qui reste d’avant');
  await p.click(`[data-ritual="plan"] [data-ritual-task="${late.id}"] [data-choice="today"]`);
  ok(await until(async () => (await find('Rapport en retard')).deadline === TODAY), 'le rapport en retard passe à aujourd’hui');
  await p.click('[data-ritual="plan"] [data-act="next"]');
  ok(await until(async () => (await p.$eval('[data-ritual="plan"] [data-capacity]', el => el.dataset.capacity).catch(() => null)) === 'over'), 'étape 2 : 8 h prévues pour 8 h libres moins ce qui est passé — Clarity dit que ça déborde');
  await p.click(`[data-ritual="plan"] [data-ritual-task="${big.id}"] [data-choice="tomorrow"]`);
  ok(await until(async () => (await find('Gros dossier')).deadline === plus(1)), 'le gros dossier passe à demain');
  ok(await until(async () => (await p.$eval('[data-ritual="plan"] [data-capacity]', el => el.dataset.capacity).catch(() => null)) === 'fits'), '… et la journée tient');
  await p.click(`[data-ritual="plan"] [data-ritual-task="${undated.id}"] [data-choice="today"]`);
  ok(await until(async () => (await find('Ranger le bureau')).deadline === TODAY), 'une tâche sans date tirée vers aujourd’hui');
  while (await p.$('[data-ritual="plan"] [data-act="next"]')) await p.click('[data-ritual="plan"] [data-act="next"]');
  await p.click('[data-ritual="plan"] [data-act="finish"]');
  ok(await until(async () => !(await p.$('[data-ritual-offer="plan"]'))), 'plan fait : la proposition disparaît pour aujourd’hui');

  // 5. End my day.
  await p.click('[data-act="shutdown"]');
  await p.waitForSelector('[data-ritual="shutdown"]');
  await p.click(`[data-ritual="shutdown"] [data-ritual-task="${undated.id}"] [data-choice="tomorrow"]`);
  ok(await until(async () => (await find('Ranger le bureau')).deadline === plus(1)), 'fin de journée : la tâche non faite passe à demain');
  await p.click('[data-ritual="shutdown"] [data-act="finish"]');
  ok(await until(async () => !(await p.$('[data-ritual="shutdown"]'))), '« Journée terminée » ferme');

  ok(errors.length === 0, `aucune erreur dans la page${errors.length ? ' : ' + errors.join(' | ') : ''}`);
  await browser.close();
  console.log(bad ? `\n${bad} écart(s).` : '\nTout est vert.');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
