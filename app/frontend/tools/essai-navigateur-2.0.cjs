#!/usr/bin/env node
// Clarity 2.0.0 in a real browser, against a real backend: the realistic day.
// The browser's clock is driven (Playwright's clock) so the day can start at
// 9:00 and overrun at 10:25 without waiting; the person's measured gap is
// injected into the profile the page reads.
//
// Not run by the CI (Playwright and two servers). By hand, as before:
//   CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   NODE_PATH=$(npm root -g) node frontend/tools/essai-navigateur-2.0.cjs

const { chromium } = require('playwright');
const API = 'http://localhost:3001/api';
const URL = 'http://localhost:5173/';
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK   ' : 'ÉCART'} ${msg}`); if (!cond) bad++; };
const call = async (path, opts = {}) => { const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts }); return { status: r.status, body: await r.json().catch(() => null) }; };
const tasks = async () => { const { body } = await call('/tasks'); return [...body.tasks, ...body.archivedTasks]; };
const byTitle = async (title) => (await tasks()).find(t => t.title === title);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const TODAY = iso(new Date());
const TOMORROW = iso(new Date(Date.now() + 86400000));
const at = (hhmm) => new Date(`${TODAY}T${hhmm}:00`);

(async () => {
  for (const t of await tasks()) await fetch(`${API}/tasks/${t.id}`, { method: 'DELETE' });
  await call('/settings', { method: 'POST', body: JSON.stringify({ onboardingComplete: true,
    workday: { start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00', days: [0, 1, 2, 3, 4, 5, 6] } }) });
  const mk = async (title, extra) => (await call('/tasks', { method: 'POST', body: JSON.stringify({ title, status: 'not_started', deadline: TODAY, ...extra }) })).body.task;
  await mk('Rapport', { priority: 'top', estimatedDuration: 60, tags: ['travail'] });
  await mk('Réunion de prépa', { priority: 'very_high', estimatedDuration: 60 });
  await mk('Gros dossier', { priority: 'high', estimatedDuration: 360 });
  await mk('Répondre à Léa', { estimatedDuration: 10 });
  await mk('Payer la facture', { estimatedDuration: 15 });
  const E = await mk('Long préalable', { deadline: TOMORROW, priority: 'very_low', estimatedDuration: 600 });
  await mk('Suite du préalable', { priority: 'low', estimatedDuration: 30 });
  await call(`/tasks/${E.id}`, { method: 'PUT', body: JSON.stringify({ links: [{ to: (await byTitle('Suite du préalable')).id, type: 'blocks', strength: 'hard' }] }) });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.clock.install({ time: at('09:00') });
  await p.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    Object.entries({ 'clarity-onboarding-done': '1', 'clarity-tutorialSeen': '1', 'clarity-locale': 'fr' }).forEach(([k, v]) => localStorage.setItem(k, v));
    sessionStorage.setItem('seeded', '1');
  });
  await p.route('**/api/crash', r => r.request().method() === 'GET' ? r.fulfill({ json: { available: false, asked: true } }) : r.continue());
  await p.route('**/api/feedback', r => r.request().method() === 'GET' ? r.fulfill({ json: { enabled: false } }) : r.continue());
  // The person's measured gap for « travail »: ×1,3 (five timed tasks, as Patterns would have it).
  await p.route('**/api/profile', r => r.fulfill({ json: { observed: { estimation: { enough: false, medianRatio: null, byArea: { travail: { enough: true, medianRatio: 1.3 } } }, rhythm: { enough: false } } } }));
  await p.goto(URL);
  await p.waitForSelector('[data-day-plan="preview"]', { timeout: 8000 });
  await p.clock.runFor(500);

  // 1. The proposed plan.
  const rows = () => p.$$eval('[data-day-plan] [data-block]', ls => ls.map(l => l.innerText.replace(/\s+/g, ' ').trim()));
  let r = await rows();
  ok(/^09:00–10:20 Rapport/.test(r[0]), `« Rapport » d'abord, 1 h corrigée en 1 h 20 par l'écart mesuré (${r[0]})`);
  ok(/×1,3/.test(r[0]), 'la durée dit l\'écart (×1,3)');
  ok(r.some(x => /10:20–11:20 Réunion de prépa/.test(x)), 'puis « Réunion de prépa »');
  ok(r.some(x => /Petites tâches \(2\)/.test(x)), 'les deux petites tâches en un bloc');
  const over = await p.$$eval('[data-overflow-row]', ls => ls.map(l => `${l.getAttribute('data-overflow-row')}:${l.innerText.split('\n')[0]}`));
  ok(over.includes('full:Gros dossier'), `« Gros dossier » (6 h) ne tient pas : journée pleine (${over.join(' | ')})`);
  ok(over.includes('blocked:Suite du préalable'), '« Suite du préalable » ne tient pas : bloquée par une tâche absente du jour');
  ok(/il manque/.test(await p.textContent('[data-day-plan]')), 'le plan dit ce qui manque');
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });

  // 2. « Tomorrow », then Accept.
  await p.click('[data-overflow-row="full"] [data-act="tomorrow"]');
  await p.clock.runFor(6000);
  ok((await byTitle('Gros dossier')).deadline === TOMORROW, '« Demain » passe « Gros dossier » au jour travaillé suivant');
  await p.click('[data-act="accept"]');
  await p.waitForSelector('[data-day-plan="accepted"]');
  ok(/Maintenant : Rapport jusqu’à 10:20/.test(await p.textContent('[data-now]')), `« Maintenant : Rapport, jusqu'à 10 h 20 » (${(await p.textContent('[data-now]')).trim()})`);
  ok(/Ensuite : Réunion de prépa/.test(await p.textContent('[data-now]')), '« Ensuite : Réunion de prépa »');

  // 3. The day overruns: 10:25, « Rapport » not done.
  await p.clock.runFor(85 * 60 * 1000);
  await p.waitForTimeout(300);
  const now = (await p.textContent('[data-now]')).replace(/\s+/g, ' ');
  ok(/Plan décalé de/.test(now), `le plan dit qu'il s'est décalé (${now.trim()})`);
  r = await rows();
  ok(/^10:25–11:45 Rapport/.test(r[0]), `« Rapport » repart de maintenant (${r[0]})`);

  // 4. Finished: the next one is « now ».
  await call(`/tasks/${(await byTitle('Rapport')).id}`, { method: 'PUT', body: JSON.stringify({ status: 'done' }) });
  await p.clock.runFor(6000);
  await p.waitForTimeout(300);
  ok(/(Maintenant|À \d\d:\d\d) ?:? ?Réunion de prépa/.test((await p.textContent('[data-now]')).replace(/\s+/g, ' ')), `après « Rapport », « Réunion de prépa » (${(await p.textContent('[data-now]')).replace(/\s+/g, ' ').trim()})`);

  // 5. The plan survives a reload; « Redo » goes back to the proposal.
  await p.reload();
  await p.waitForSelector('[data-day-plan="accepted"]');
  ok(true, 'le plan accepté survit au rechargement');
  await p.click('[data-act="redo"]');
  ok(await p.waitForSelector('[data-day-plan="preview"]', { timeout: 3000 }).then(() => true, () => false), '« Refaire le plan » revient à la proposition');

  // 6. Working hours in Settings › Day to day.
  await p.click('[data-tour="settings"]');
  await p.click('[data-tour="settings-daily"]');
  await p.fill('input[name="workday-end"]', '17:00');
  await p.clock.runFor(1000);
  ok(await (async () => { for (let k = 0; k < 20; k++) { if ((await call('/settings')).body.workday.end === '17:00') return true; await new Promise(r => setTimeout(r, 150)); } return false; })(), 'la fin de journée réglée à 17 h est enregistrée');
  await p.fill('input[name="workday-end"]', '08:00');
  ok(await p.waitForSelector('[data-tour="workday"] [role="alert"]', { timeout: 3000 }).then(() => true, () => false), 'une journée qui finit avant de commencer est refusée, et dite');
  ok((await call('/settings')).body.workday.end === '17:00', '… et rien n\'est enregistré');

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await browser.close();
  console.log(bad ? `${bad} écart(s)` : 'tout est vert');
  process.exit(bad ? 1 : 0);
})();
