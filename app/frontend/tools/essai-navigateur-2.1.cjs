#!/usr/bin/env node
// Clarity 2.1.0 in a real browser, against a real backend: levels you can see,
// the day plan as a time grid, « Upcoming », the week in Calendar. The clock
// is driven as in 2.0 (9:00, then an overrun at 10:25).
//
// Not run by the CI (Playwright and two servers). By hand:
//   CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   NODE_PATH=$(npm root -g) node frontend/tools/essai-navigateur-2.1.cjs
// SHOTS=<folder> keeps a screenshot of each screen, light and dark.

const { chromium } = require('playwright');
const API = 'http://localhost:3001/api';
const URL = 'http://localhost:5173/';
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK   ' : 'ÉCART'} ${msg}`); if (!cond) bad++; };
const call = async (path, opts = {}) => { const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts }); return { status: r.status, body: await r.json().catch(() => null) }; };
const tasks = async () => { const { body } = await call('/tasks'); return [...body.tasks, ...body.archivedTasks]; };
const byTitle = async (title) => (await tasks()).find(t => t.title === title);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plus = (k) => iso(new Date(Date.now() + k * 86400000));
const TODAY = plus(0);
const at = (hhmm) => new Date(`${TODAY}T${hhmm}:00`);
const shot = async (p, name) => { if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/${name}.png`, fullPage: false }); };

(async () => {
  for (const t of await tasks()) await fetch(`${API}/tasks/${t.id}`, { method: 'DELETE' });
  await call('/settings', { method: 'POST', body: JSON.stringify({ onboardingComplete: true,
    workday: { start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00', days: [0, 1, 2, 3, 4, 5, 6] } }) });
  const mk = async (title, extra) => (await call('/tasks', { method: 'POST', body: JSON.stringify({ title, status: 'not_started', deadline: TODAY, ...extra }) })).body.task;
  const A = await mk('Rapport', { priority: 'top', estimatedDuration: 60, tags: ['travail'] });
  await mk('Réunion de prépa', { priority: 'very_high', estimatedDuration: 60 });
  await mk('Répondre à Léa', { estimatedDuration: 10 });
  await mk('Payer la facture', { estimatedDuration: 15 });
  const E = await mk('Long préalable', { priority: 'very_low', estimatedDuration: 45 });
  const F = await mk('Suite urgente', { deadline: plus(1), priority: 'top', estimatedDuration: 30 });
  await call(`/tasks/${E.id}`, { method: 'PUT', body: JSON.stringify({ links: [{ to: F.id, type: 'blocks', strength: 'hard' }] }) });
  await mk('Lire le contrat', { deadline: plus(1), priority: 'low', estimatedDuration: 60 });
  for (let k = 0; k < 7; k++) await mk(`Dossier ${k + 1}`, { deadline: plus(3), priority: 'medium', estimatedDuration: 90 });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.clock.install({ time: at('09:00') });
  await p.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    Object.entries({ 'clarity-onboarding-done': '1', 'clarity-tutorialSeen': '1', 'clarity-locale': 'fr', 'clarity-lastSeenVersion': '9.9.9' }).forEach(([k, v]) => localStorage.setItem(k, v));
    sessionStorage.setItem('seeded', '1');
  });
  await p.route('**/api/crash', r => r.request().method() === 'GET' ? r.fulfill({ json: { available: false, asked: true } }) : r.continue());
  await p.route('**/api/feedback', r => r.request().method() === 'GET' ? r.fulfill({ json: { enabled: false } }) : r.continue());
  await p.route('**/api/profile', r => r.fulfill({ json: { observed: { estimation: { enough: false, medianRatio: null, byArea: { travail: { enough: true, medianRatio: 1.3 } } }, rhythm: { enough: false } } } }));
  await p.goto(URL);
  await p.waitForSelector('[data-day-plan="preview"] [data-time-grid="day"]', { timeout: 8000 });
  await p.clock.runFor(500);

  // 1. The plan as a time grid.
  const block = (sel) => p.$eval(sel, el => ({ start: el.dataset.start, end: el.dataset.end, h: el.getBoundingClientRect().height, text: el.innerText.replace(/\s+/g, ' ') })).catch(() => null);
  const r0 = await block(`[data-time-grid="day"] [data-task="${E.id}"]`);
  ok(r0 && r0.start === '09:00' && r0.end === '09:45', `« Long préalable » d'abord : il retient une tâche Absolue (${JSON.stringify(r0)})`);
  const r1 = await block(`[data-time-grid="day"] [data-task="${A.id}"]`);
  ok(r1 && r1.start === '09:45' && r1.end === '11:05', `puis « Rapport », 1 h corrigée en 1 h 20 (${JSON.stringify(r1)})`);
  ok(r1 && /×1,3/.test(r1.text), '… sa durée dit l\'écart mesuré');
  ok(r0 && r1 && Math.abs((r1.h + 2) / (r0.h + 2) - 80 / 45) < 0.05, `hauteur proportionnelle à la durée (${r1?.h} / ${r0?.h})`);
  const br = await block('[data-time-grid="day"] [data-block="break"]');
  ok(br && br.start === '12:00' && br.end === '13:00', 'la pause est sur la grille');
  ok(/Répondre à Léa.*Payer la facture|Payer la facture.*Répondre à Léa/.test((await block('[data-time-grid="day"] [data-block="batch"]'))?.text || ''), 'les petites tâches : un bloc, leurs deux titres dedans');
  ok(!!(await p.$('[data-time-grid="day"] [data-now-line]')), 'le trait de maintenant');
  ok(await p.$eval(`[data-time-grid="day"] [data-task="${A.id}"]`, el => el.dataset.level) === 'top', 'le bloc porte le niveau de sa tâche');
  ok(!(await p.$('text=Plage horaire')) && !(await p.$('[data-tour="today-list"] >> text=/^Ensuite$/')), 'la frise horizontale et « Ensuite » ont laissé la place');
  await shot(p, '1-plan-clair');

  // 2. Levels on the cards.
  const card = (id) => `[data-task-id="${id}"]`;
  const bar = (id) => p.$eval(`${card(id)} [data-level-bar]`, el => ({ level: el.dataset.levelBar, dashed: getComputedStyle(el).borderLeftStyle, w: parseFloat(getComputedStyle(el).borderLeftWidth), inh: el.hasAttribute('data-inherited') })).catch(() => null);
  const ba = await bar(A.id);
  ok(ba && ba.level === 'top' && ba.dashed === 'solid' && ba.w === 4, `« Rapport » : barre Absolue pleine, 4 px (${JSON.stringify(ba)})`);
  ok(/Priorité absolue/.test(await p.textContent(card(A.id))), '… son niveau est écrit');
  ok(await p.$eval(card(A.id), el => getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)'), '… et la carte est teintée');
  const be = await bar(E.id);
  ok(be && be.level === 'top' && be.dashed === 'dashed' && be.inh, `« Long préalable » (très basse) hérite d'Absolue : en pointillé (${JSON.stringify(be)})`);

  // 3. Upcoming.
  ok(await p.$$eval('[data-upcoming] [data-day]', l => l.map(d => d.dataset.day).join()) === [plus(1), plus(3)].join(), 'À venir : demain, puis le jour suivant qui a quelque chose');
  ok(/Demain/.test(await p.textContent(`[data-day="${plus(1)}"]`)), '« Demain »');
  ok(!!(await p.$(`[data-day="${plus(3)}"][data-over]`)) && /trop plein/.test(await p.textContent(`[data-day="${plus(3)}"] [data-load]`)), 'un jour de 10 h 30 sur 8 h : trop plein, dit');
  ok(await p.$$eval(`[data-day="${plus(3)}"] [data-upcoming-task]`, l => l.length) === 5 && /\+ 2 autres/.test(await p.textContent(`[data-day="${plus(3)}"]`)), '5 au plus, puis « + 2 autres »');
  await shot(p, '2-a-venir-clair');

  // 4. Accept; then the week in Calendar.
  await p.click('[data-act="accept"]');
  await p.waitForSelector('[data-day-plan="accepted"]');
  await p.click(`[data-day="${plus(3)}"] button >> nth=0`);
  await p.waitForSelector('[data-calendar="week"] [data-time-grid="week"]');
  ok(!!(await p.$(`[data-week-day="${plus(3)}"]`)), 'le jour cliqué ouvre la semaine qui le contient');
  ok(await p.$$eval(`[data-week-day="${plus(3)}"] [data-chip-task]`, l => l.length) === 3, '… ses tâches en haut du jour, 3 puis « +4 »');
  if (await p.$(`[data-week-day="${TODAY}"]`)) {
    ok(await p.$eval(`[data-column="${TODAY}"]`, c => !!c.querySelector(`[data-task]`)), 'aujourd\'hui, la semaine montre le plan accepté');
    ok(!!(await p.$(`[data-column="${TODAY}"] [data-now-line]`)), '… et le trait de maintenant');
  } else { await p.click('[data-calendar] button:has-text("Aujourd")'); }
  await shot(p, '3-semaine-clair');
  await p.click('[data-mode="month"]');
  ok(!!(await p.$(`[data-calendar="month"] [data-month-day="${TODAY}"] [data-level-bar="top"]`)), 'le mois : les tâches en couleur de niveau');
  await p.click('[data-mode="week"]');

  // 5. The overrun still moves the plan (2.0), now on the grid.
  await p.click('[data-tour="nav-today"]');
  await p.clock.runFor(85 * 60 * 1000);
  await p.waitForTimeout(300);
  ok(/Plan décalé de/.test(await p.textContent('[data-now]')), 'la journée déborde : le plan le dit');
  const r3 = await block(`[data-time-grid="day"] [data-task="${A.id}"]`);
  const r4 = await block(`[data-time-grid="day"] [data-task="${E.id}"]`);
  ok(r3 && r4 && r4.start > '09:00' && r3.start === r4.end && r3.start > '10:25', `la suite a glissé sur la grille : « Long préalable » ${r4?.start}–${r4?.end}, puis « Rapport » ${r3?.start}`);

  // 6. Dark.
  await p.evaluate(() => localStorage.setItem('clarity-theme', 'dark'));
  await p.reload();
  await p.waitForSelector('[data-time-grid="day"]');
  const fill = await p.$eval(`[data-time-grid="day"] [data-task="${A.id}"]`, el => getComputedStyle(el).backgroundColor);
  ok(!!fill && fill !== 'rgba(0, 0, 0, 0)', `sombre : les blocs gardent leur couleur (${fill})`);
  await shot(p, '4-plan-sombre');
  await p.click('[data-tour="nav-upcoming"]');
  await p.waitForSelector('[data-time-grid="week"]');
  await shot(p, '5-semaine-sombre');
  await p.click('[data-tour="nav-graph"]').catch(() => {});
  ok(await p.waitForSelector('[data-node-level="top"]', { timeout: 4000 }).then(() => true, () => false), 'le graphe : le niveau sur chaque nœud');

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await browser.close();
  console.log(bad ? `${bad} écart(s)` : 'tout est vert');
  process.exit(bad ? 1 : 0);
})();
