#!/usr/bin/env node
// Clarity 2.3.0 in a real browser, against a real backend: reminders. A
// task's own reminder set from the detail panel, the card that comes when it
// is due (once), « in 10 minutes », « done »; the reminder before a task with
// its hour; the morning summary; the block of the day plan; the settings.
// The server's clock is the real one: reminders are set a minute in the past.
//
// Not run by the CI. By hand, as for 2.2:
//   CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   NODE_PATH=$(npm root -g) node frontend/tools/essai-navigateur-2.3.cjs

const { chromium } = require('playwright');
const API = 'http://localhost:3001/api';
const URL = 'http://localhost:5173/';
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK   ' : 'ÉCART'} ${msg}`); if (!cond) bad++; };
const call = async (path, opts = {}) => { const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts }); return { status: r.status, body: await r.json().catch(() => null) }; };
const tasks = async () => { const { body } = await call('/tasks'); return [...body.tasks, ...body.archivedTasks]; };
const task = async (id) => (await tasks()).find(t => t.id === id);
const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const TODAY = stamp(new Date()).slice(0, 10);
const until = async (fn, ms = 4000) => { for (let k = 0; k < ms / 100; k++) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };

(async () => {
  for (const t of await tasks()) await fetch(`${API}/tasks/${t.id}`, { method: 'DELETE' });
  // Too close to midnight for a day that starts « a minute ago »: wait for it.
  while (stamp(new Date()).slice(11) >= '23:57') await new Promise(r => setTimeout(r, 20e3));
  const now = new Date();
  // The working day started a minute ago, every day: the morning summary is due.
  const startH = stamp(new Date(now - 60e3)).slice(11);
  await call('/settings', { method: 'POST', body: JSON.stringify({ onboardingComplete: true, reminders: { before: 10, morning: true, blocks: true },
    workday: { start: startH, end: '23:59', breaks: [], days: [0, 1, 2, 3, 4, 5, 6] } }) });
  const mk = async (title, extra) => (await call('/tasks', { method: 'POST', body: JSON.stringify({ title, status: 'not_started', ...extra }) })).body.task;
  const A = await mk('Appeler la banque', { deadline: TODAY });
  const in8 = new Date(now.getTime() + 8 * 60e3);
  const B = await mk('Réunion client', { deadline: stamp(in8).slice(0, 10), time: stamp(in8).slice(11) });
  ok((await call(`/tasks/${A.id}`, { method: 'PUT', body: JSON.stringify({ reminder: '2026-02-31T10:00' }) })).status === 400, 'un rappel à une date qui n\'existe pas est refusé');

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'fr-FR' });
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
  await p.goto(URL);

  // 1. On opening: the morning summary, and « Réunion client » in 8 minutes (10 before).
  ok(await p.waitForSelector('[data-reminder-card="morning"]', { timeout: 6000 }).then(() => true, () => false), 'le résumé du jour arrive au début des heures');
  ok(/Appeler la banque/.test(await p.textContent('[data-reminder-card="morning"]')), '… et nomme ce qui est pour aujourd\'hui');
  ok(!!(await p.$('[data-reminder-card="before"]')) && /Réunion client/.test(await p.textContent('[data-reminder-card="before"]')), '« Réunion client » dans 8 min : rappel « bientôt »');
  await p.click('[data-reminder-card="morning"] [data-act="open"]');
  ok(!(await p.$('[data-reminder-card="morning"]')), '« Voir la journée » ferme la carte');
  await p.click('[data-reminder-card="before"] button[aria-label="Fermer"]');

  // 2. Set a reminder from the detail panel.
  await p.click(`[data-task-id="${A.id}"] span >> text=Appeler la banque`);
  await p.waitForSelector('[data-reminder-row]');
  ok(await p.$$eval('[data-reminder-row] [data-remind]', l => l.map(b => b.dataset.remind).includes('hour')), 'le détail propose « Dans 1 h », « Prochain matin »…');
  await p.click('[data-reminder-row] [data-remind="hour"]');
  ok(await until(async () => !!(await task(A.id)).reminder), '« Dans 1 h » s\'enregistre');
  ok(await p.waitForSelector('[data-reminder-set]', { timeout: 3000 }).then(() => true, () => false), '… et s\'affiche, avec « Retirer le rappel »');
  // Now one due: a minute ago.
  await call(`/tasks/${A.id}`, { method: 'PUT', body: JSON.stringify({ reminder: stamp(new Date(Date.now() - 60e3)) }) });
  await p.keyboard.press('Escape');
  ok(!!(await p.waitForSelector(`[data-task-id="${A.id}"] [data-chip="reminder"]`, { timeout: 7000 }).catch(() => null)), 'la carte de la tâche montre 🔔 et l\'heure');
  await p.reload();
  ok(await p.waitForSelector('[data-reminder-card="task"]', { timeout: 6000 }).then(() => true, () => false), 'le rappel échu arrive');
  ok(!(await p.$('[data-reminder-card="morning"]')), 'le résumé, déjà donné, ne revient pas après rechargement');
  await p.click('[data-reminder-card="task"] [data-act="soon"]');
  const later = (await until(async () => (await task(A.id)).reminder > stamp(new Date()))) && (await task(A.id)).reminder;
  ok(!!later && new Date(later) - new Date() <= 15 * 60e3, `« Dans 10 min » reprogramme (${later})`);
  // Another minute than the first (the same minute would be the same reminder, given already).
  await call(`/tasks/${A.id}`, { method: 'PUT', body: JSON.stringify({ reminder: stamp(new Date(Date.now() - 3 * 60e3)) }) });
  await p.reload();
  await p.waitForSelector('[data-reminder-card="task"]', { timeout: 6000 });
  await p.click('[data-reminder-card="task"] [data-act="done"]');
  ok(await until(async () => (await task(A.id)).status === 'done'), '« Fait » termine la tâche');
  const claim = await call('/reminders/claim', { method: 'POST' });
  ok(claim.body.reminders.length === 0, 'rien n\'est donné deux fois (le serveur s\'en souvient)');

  // 3. A block of the accepted day plan starts.
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  await p.evaluate(({ day, start, id }) => {
    localStorage.setItem('clarity-day-plan', JSON.stringify({ date: day, blocks: [{ id: 'task-x', kind: 'task', taskIds: [id], start, end: start + 45 }], overflow: [] }));
  }, { day: stamp(new Date()).slice(0, 10), start: nowMin, id: B.id });
  await p.reload();
  ok(await p.waitForSelector('[data-reminder-card="block"]', { timeout: 6000 }).then(() => true, () => false), 'un bloc du plan commence : « C\'est l\'heure »');
  await p.reload();
  await p.waitForTimeout(1500);
  ok(await p.$$eval('[data-reminder-card="block"]', l => l.length) === 1, '… une seule fois : la carte reste jusqu\'à ce qu\'on la ferme, sans doublon');
  await p.click('[data-reminder-card="block"] button[aria-label="Fermer"]');
  await p.reload();
  await p.waitForTimeout(1500);
  ok(!(await p.$('[data-reminder-card="block"]')), '… fermée, elle ne revient pas');

  // 4. Settings.
  await p.click('[data-tour="settings"]');
  await p.click('[data-tour="settings-daily"]');
  await p.selectOption('select[name="remind-before"]', '30');
  await p.click('[data-tour="reminders"] [data-toggle="morning"]');
  ok(await until(async () => { const r = (await call('/settings')).body.reminders; return r.before === 30 && r.morning === false; }), 'réglages : 30 min avant, sans résumé du matin, enregistrés');
  ok((await call('/settings', { method: 'POST', body: JSON.stringify({ reminders: { before: 7 } }) })).status === 400, '… une valeur hors liste est refusée');

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await browser.close();
  console.log(bad ? `${bad} écart(s)` : 'tout est vert');
  process.exit(bad ? 1 : 0);
})();
