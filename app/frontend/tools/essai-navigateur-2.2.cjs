#!/usr/bin/env node
// Clarity 2.2.0 in a real browser, against a real backend: the working day
// edited in full (several breaks, hours by day), the day plan changed by hand
// (drag, earlier / later, length, not today, add a task or a break, hours for
// today only, « redo » that asks), and a density that shows.
//
// Not run by the CI. By hand, as for 2.1:
//   CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   NODE_PATH=$(npm root -g) node frontend/tools/essai-navigateur-2.2.cjs

const { chromium } = require('playwright');
const API = 'http://localhost:3001/api';
const URL = 'http://localhost:5173/';
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK   ' : 'ÉCART'} ${msg}`); if (!cond) bad++; };
const call = async (path, opts = {}) => { const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts }); return { status: r.status, body: await r.json().catch(() => null) }; };
const tasks = async () => { const { body } = await call('/tasks'); return [...body.tasks, ...body.archivedTasks]; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plus = (k) => iso(new Date(Date.now() + k * 86400000));
const TODAY = plus(0);
const WD = new Date().getDay();
const at = (hhmm) => new Date(`${TODAY}T${hhmm}:00`);
const workday = async () => (await call('/settings')).body.workday;
const until = async (fn, ms = 3000) => { for (let k = 0; k < ms / 100; k++) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };

(async () => {
  for (const t of await tasks()) await fetch(`${API}/tasks/${t.id}`, { method: 'DELETE' });
  const ALL = { start: '09:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00', label: '' }], days: [0, 1, 2, 3, 4, 5, 6] };
  await call('/settings', { method: 'POST', body: JSON.stringify({ onboardingComplete: true, workday: ALL }) });
  const mk = async (title, extra) => (await call('/tasks', { method: 'POST', body: JSON.stringify({ title, status: 'not_started', deadline: TODAY, ...extra }) })).body.task;
  const A = await mk('Rapport', { priority: 'top', estimatedDuration: 60 });
  const B = await mk('Réunion de prépa', { priority: 'very_high', estimatedDuration: 60 });
  const C = await mk('Courriels', { priority: 'high', estimatedDuration: 60 });
  const D = await mk('Lire le contrat', { deadline: plus(2), priority: 'low', estimatedDuration: 30 });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1300 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.clock.install({ time: at('08:00') });
  await p.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    Object.entries({ 'clarity-onboarding-done': '1', 'clarity-tutorialSeen': '1', 'clarity-locale': 'fr', 'clarity-lastSeenVersion': '9.9.9' }).forEach(([k, v]) => localStorage.setItem(k, v));
    sessionStorage.setItem('seeded', '1');
  });
  await p.route('**/api/crash', r => r.request().method() === 'GET' ? r.fulfill({ json: { available: false, asked: true } }) : r.continue());
  await p.route('**/api/feedback', r => r.request().method() === 'GET' ? r.fulfill({ json: { enabled: false } }) : r.continue());
  await p.goto(URL);
  await p.waitForSelector('[data-time-grid="day"]', { timeout: 8000 });
  const block = (id) => p.$eval(`[data-time-grid="day"] [data-task="${id}"]`, el => ({ start: el.dataset.start, end: el.dataset.end, pinned: el.hasAttribute('data-pinned'), h: el.getBoundingClientRect().height })).catch(() => null);
  const startOf = async (id) => (await block(id))?.start;

  // 1. Settings › Day to day, in full.
  await p.click('[data-tour="settings"]');
  await p.click('[data-tour="settings-daily"]');
  await p.click('[data-tour="workday"] [data-act="add-break"]');
  ok(await until(async () => (await workday()).breaks.length === 2), 'une deuxième pause s\'ajoute et s\'enregistre');
  await p.fill('input[name="workday-break-1-label"]', 'Café');
  await p.press('input[name="workday-break-1-label"]', 'Tab');
  ok(await until(async () => (await workday()).breaks[1].label === 'Café'), '… on la nomme « Café »');
  await p.fill('input[name="workday-break-1-start"]', '12:30');
  ok(await p.waitForSelector('[data-tour="workday"] [role="alert"]', { timeout: 3000 }).then(() => true, () => false), 'deux pauses qui se chevauchent : refusé, et dit');
  ok((await workday()).breaks[1].start !== '12:30', '… rien n\'est enregistré');
  await p.click('[data-tour="workday"] [data-break="1"] [data-act="remove-break"]');
  ok(await until(async () => (await workday()).breaks.length === 1), 'une pause se retire');
  await p.click('[data-act="per-day"]');
  ok(await until(async () => Object.keys((await workday()).byDay || {}).length === 7), 'heures par jour : chaque jour reçoit les heures communes');
  await p.fill(`input[name="workday-${WD}-break-0-start"]`, '11:00');
  await p.fill(`input[name="workday-${WD}-break-0-end"]`, '11:30');
  ok(await until(async () => (await workday()).byDay?.[WD]?.breaks[0].end === '11:30'), 'aujourd\'hui a sa pause à lui, 11 h – 11 h 30');
  await p.fill(`input[name="workday-${WD}-end"]`, '12:00');
  ok(await until(async () => (await workday()).byDay?.[WD]?.end === '12:00'), '… et finit à midi, ce jour-là seulement');
  ok((await workday()).byDay[(WD + 1) % 7].end === '18:00' && (await workday()).byDay[(WD + 1) % 7].breaks[0].start === '12:00', '… le lendemain garde 18 h et sa pause de midi');

  await p.click('[data-tour="nav-today"]');
  await p.waitForSelector('[data-time-grid="day"]');
  await p.clock.runFor(1000);
  const grid = await p.$$eval('[data-time-grid="day"] [data-block]', l => l.map(b => [b.dataset.block, b.dataset.start, b.dataset.end]));
  ok(grid.some(([k, s, e]) => k === 'break' && s === '11:00' && e === '11:30'), `la grille suit le jour : pause 11 h – 11 h 30 (${JSON.stringify(grid)})`);
  ok(grid.filter(([k]) => k === 'task').every(([, , e]) => e <= '12:00'), '… et rien après midi');
  ok(!!(await p.$('[data-overflow-row]')), '… ce qui ne tient plus est dit');
  // Back to the same hours for the rest.
  await call('/settings', { method: 'POST', body: JSON.stringify({ workday: ALL }) });
  await p.evaluate(() => window.dispatchEvent(new Event('clarity-workday')));
  await p.waitForTimeout(400);

  // 2. The plan by hand.
  ok(await startOf(A.id) === '09:00', `« Rapport » à 9 h d'abord (${await startOf(A.id)})`);
  const box = await p.$eval(`[data-time-grid="day"] [data-task="${A.id}"]`, el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 10, h: r.height }; });
  const pxPerMin = (box.h + 2) / 60;
  await p.mouse.move(box.x, box.y); await p.mouse.down();
  await p.mouse.move(box.x, box.y + 40, { steps: 4 });
  await p.mouse.move(box.x, box.y + 300 * pxPerMin, { steps: 8 });
  ok(!!(await p.$('[data-drag-time]')), 'en glissant, l\'heure s\'affiche');
  await p.mouse.up();
  await p.waitForTimeout(200);
  const ra = await block(A.id);
  ok(ra && ra.start === '14:00' && ra.pinned, `glissé de 5 h : « Rapport » épinglé à 14 h (${JSON.stringify(ra)})`);
  ok(await startOf(B.id) === '09:00', '… le reste remonte autour');
  // Select, then earlier / later.
  await p.click(`[data-time-grid="day"] [data-task="${C.id}"]`);
  await p.waitForSelector('[data-selected-panel="task"]');
  const cBefore = await startOf(C.id);
  await p.click('[data-act="earlier"]');
  await p.waitForTimeout(150);
  ok(await startOf(C.id) < cBefore && await startOf(C.id) === '09:00', `« Plus tôt » : « Courriels » passe avant « Réunion » (${cBefore} → ${await startOf(C.id)})`);
  await p.focus(`[data-time-grid="day"] [data-task="${C.id}"]`);
  await p.keyboard.press('Alt+ArrowDown');
  await p.waitForTimeout(150);
  ok(await startOf(C.id) === cBefore, 'Alt + ↓ : il revient à sa place');
  // Length.
  await p.fill('input[name="duration"]', '25');
  await p.check('input[name="keep-estimate"]');
  await p.click('[data-act="set-duration"]');
  await p.waitForTimeout(150);
  const rc = await block(C.id);
  ok(rc && (Number(rc.end.slice(0, 2)) * 60 + Number(rc.end.slice(3))) - (Number(rc.start.slice(0, 2)) * 60 + Number(rc.start.slice(3))) === 25, `durée 25 min sur la grille (${rc?.start}–${rc?.end})`);
  ok(await until(async () => (await tasks()).find(t => t.id === C.id).estimatedDuration === 25), '« Garder comme estimation » l\'écrit sur la tâche');
  // Not today, then back.
  await p.click('[data-act="remove-today"]');
  await p.waitForTimeout(150);
  ok(!(await block(C.id)) && /Courriels/.test(await p.textContent('[data-not-today]')), '« Retirer du jour » : hors de la grille, dans « Pas aujourd\'hui »');
  await p.click(`[data-not-today] [data-task="${C.id}"]`);
  await p.waitForTimeout(150);
  ok(!!(await block(C.id)), '« Remettre » : de retour');
  // Add a task of another day, and a break.
  await p.selectOption('select[name="add-task"]', D.id);
  await p.click('[data-act="add-task"]');
  await p.waitForTimeout(150);
  ok(!!(await block(D.id)) && !(await p.$(`select[name="add-task"] option[value="${D.id}"]`)), '« Lire le contrat » (dans 2 jours) ajouté au jour');
  await p.fill('input[name="pause-at"]', '15:00');
  await p.selectOption('select[name="pause-for"]', '30');
  await p.click('[data-act="add-pause"]');
  await p.waitForTimeout(150);
  ok(await p.$$eval('[data-time-grid="day"] [data-block="pause"]', l => l.map(b => `${b.dataset.start}-${b.dataset.end}`).join()) === '15:00-15:30', 'une pause 15 h – 15 h 30 pour aujourd\'hui');
  ok((await workday()).breaks.length === 1, '… sans toucher aux réglages');
  // Hours for today only.
  await p.fill('input[name="today-end"]', '16:00');
  await p.waitForTimeout(200);
  ok((await p.$$eval('[data-time-grid="day"] [data-block="task"]', l => l.map(b => b.dataset.end))).every(e => e <= '16:00'), 'finir à 16 h aujourd\'hui seulement : rien après');
  ok((await workday()).end === '18:00', '… les réglages gardent 18 h');

  // 3. Accepted: changes still apply; « Redo » asks.
  await p.click('[data-act="accept"]');
  await p.waitForSelector('[data-day-plan="accepted"]');
  ok((await block(A.id))?.start === '14:00', 'accepté : « Rapport » toujours épinglé à 14 h');
  await p.click(`[data-time-grid="day"] [data-task="${B.id}"]`);
  await p.click('[data-act="later-block"]');
  await p.waitForTimeout(150);
  ok((await block(B.id))?.start !== '09:00', 'sur le plan accepté aussi, « Plus tard » déplace');
  await p.click('[data-act="redo"]');
  ok(!!(await p.$('[data-redo-ask]')), '« Refaire le plan » demande : garder mes changements ou repartir de zéro');
  await p.click('[data-act="redo-keep"]');
  await p.waitForSelector('[data-day-plan="preview"]');
  ok((await block(A.id))?.pinned, '« Garder » : l\'épingle reste');
  await p.click('[data-act="accept"]');
  await p.click('[data-act="redo"]');
  await p.click('[data-act="redo-fresh"]');
  await p.waitForSelector('[data-day-plan="preview"]');
  ok(!(await block(A.id))?.pinned && (await block(A.id))?.start === '09:00', '« Repartir de zéro » : le plan de Clarity revient');

  // 4. Density shows.
  const hBal = (await block(A.id)).h;
  await p.click('[data-tour="settings"]');
  await p.click('[data-tour="settings-appearance"]');
  const pv = async () => p.$eval('[data-preview-hour]', el => el.getBoundingClientRect().height);
  const before = await pv();
  await p.click('button:has-text("Compact")');
  await p.waitForTimeout(150);
  ok(await pv() < before, `Apparence › Compact : l'aperçu se resserre aussitôt (${before} → ${await pv()})`);
  await p.click('[data-tour="nav-today"]');
  await p.waitForSelector('[data-time-grid="day"]');
  const hCompact = (await block(A.id)).h;
  ok(hCompact < hBal * 0.85, `… et le plan du jour aussi (${hBal} → ${hCompact})`);

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
  await browser.close();
  console.log(bad ? `${bad} écart(s)` : 'tout est vert');
  process.exit(bad ? 1 : 0);
})();
