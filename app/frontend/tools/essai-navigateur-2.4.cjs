#!/usr/bin/env node
// Clarity 2.4.0 in a real browser, against a real backend: tasks put in order
// by hand. Drag with the mouse, the others making room; the rank kept by the
// server; « Undo »; dropped among another level, it takes that level; a task
// that waits on another stays after it; Alt + ↑ / ↓; cards that slide.
//
// Not run by the CI. By hand, as for 2.3:
//   CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   NODE_PATH=$(npm root -g) node frontend/tools/essai-navigateur-2.4.cjs

const { chromium } = require('playwright');
const API = 'http://localhost:3001/api';
const URL = 'http://localhost:5173/';
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK   ' : 'ÉCART'} ${msg}`); if (!cond) bad++; };
const call = async (path, opts = {}) => { const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts }); return { status: r.status, body: await r.json().catch(() => null) }; };
const tasks = async () => { const { body } = await call('/tasks'); return [...body.tasks, ...body.archivedTasks]; };
const until = async (fn, ms = 4000) => { for (let k = 0; k < ms / 100; k++) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };

(async () => {
  for (const t of await tasks()) await fetch(`${API}/tasks/${t.id}`, { method: 'DELETE' });
  await call('/settings', { method: 'POST', body: JSON.stringify({ onboardingComplete: true }) });
  const mk = async (title, extra) => (await call('/tasks', { method: 'POST', body: JSON.stringify({ title, status: 'not_started', ...extra }) })).body.task;
  // Created oldest first: without an assistant, the newest leads its level.
  const C = await mk('Gamma', { priority: 'high' });
  const B = await mk('Bêta', { priority: 'high' });
  const A = await mk('Alpha', { priority: 'high' });
  const E = await mk('Epsilon', { priority: 'medium' });
  const D = await mk('Delta', { priority: 'medium' });
  const Y = await mk('Préalable', { priority: 'low' });
  const X = await mk('Suite', { priority: 'low' });
  await call(`/tasks/${Y.id}`, { method: 'PUT', body: JSON.stringify({ links: [{ to: X.id, type: 'blocks', strength: 'hard' }] }) });
  ok((await call(`/tasks/${A.id}`, { method: 'PUT', body: JSON.stringify({ rank: 'haut' }) })).status === 400, 'un rang qui n\'est pas un nombre est refusé');

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
  await p.route('**/api/reminders/claim', r => r.fulfill({ json: { reminders: [] } }));
  await p.goto(URL);
  await p.click('[data-tour="nav-inbox"]');
  await p.waitForSelector('[data-sortable="tasks"] [data-sort-id]');
  const order = () => p.$$eval('[data-sortable="tasks"] [data-sort-id]', l => l.map(x => x.querySelector('[data-task-id] span[style*="cursor"]')?.textContent || x.innerText.split('\n')[0]));
  const titles = async () => (await order()).map(s => s.trim());
  ok((await titles()).join() === 'Alpha,Bêta,Gamma,Delta,Epsilon,Préalable,Suite', `l'ordre de départ (${(await titles()).join(', ')})`);

  const drag = async (fromTitle, toTitle, below = false) => {
    const id = { Alpha: A, Bêta: B, Gamma: C, Delta: D, Epsilon: E, Préalable: Y, Suite: X };
    await p.$eval(`[data-sortable="tasks"] [data-sort-id="${id[toTitle].id}"]`, el => el.scrollIntoView({ block: 'center' }));
    const a = await p.$eval(`[data-sortable="tasks"] [data-sort-id="${id[fromTitle].id}"]`, el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width * 0.6, y: r.y + r.height / 2 }; });
    const b = await p.$eval(`[data-sortable="tasks"] [data-sort-id="${id[toTitle].id}"]`, el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
    await p.mouse.move(a.x, a.y); await p.mouse.down();
    await p.mouse.move(a.x, a.y + (b.top > a.y ? 10 : -10), { steps: 3 });
    const y = below ? b.bottom - 4 : b.top + 4;
    await p.mouse.move(a.x, y, { steps: 10 });
    const making = await p.$$eval('[data-sortable="tasks"] [data-sort-id]:not([data-dragging])', l => l.some(x => /translateY/.test(x.style.transform)));
    await p.mouse.up();
    return making;
  };

  // 1. Gamma to the top of its level.
  const room = await drag('Gamma', 'Alpha');
  ok(room, 'en glissant, les autres cartes font de la place');
  ok(await until(async () => (await titles()).slice(0, 3).join() === 'Gamma,Alpha,Bêta'), `Gamma en tête (${(await titles()).join(', ')})`);
  ok(await until(async () => { const ts = await tasks(); return ts.find(t => t.id === C.id).rank === 10 && ts.find(t => t.id === A.id).rank === 20; }), 'les rangs sont enregistrés (10, 20, 30)');
  ok(await until(async () => /Ordre enregistré/.test(await p.textContent('body'))), 'un message le dit, avec « Annuler »');
  await p.click('button:has-text("Annuler")');
  ok(await until(async () => (await tasks()).find(t => t.id === C.id).rank == null), '« Annuler » remet l\'ordre de Clarity');
  ok(await until(async () => (await titles()).slice(0, 3).join() === 'Alpha,Bêta,Gamma'), '… à l\'écran aussi');
  await p.reload(); await p.click('[data-tour="nav-inbox"]'); await p.waitForSelector('[data-sortable="tasks"] [data-sort-id]');

  // 2. Alpha dropped among the medium ones: it takes their level.
  await drag('Alpha', 'Epsilon');
  ok(await until(async () => (await tasks()).find(t => t.id === A.id).priority === 'medium'), 'Alpha déposée parmi les « moyenne » : son niveau devient Moyenne');
  ok(await until(async () => /niveau changé/.test(await p.textContent('body'))), '… et le message le dit');
  ok(await until(async () => { const t = await titles(); return t.indexOf('Alpha') > t.indexOf('Delta') && t.indexOf('Alpha') < t.indexOf('Epsilon'); }), `… placée entre Delta et Epsilon (${(await titles()).join(', ')})`);

  // 3. A task that waits on another, dropped above it.
  await drag('Suite', 'Préalable');
  ok(await until(async () => /attend une autre tâche/.test(await p.textContent('body'))), '« Suite » au-dessus de ce qui la bloque : le message le dit');
  ok(await until(async () => { const t = await titles(); return t.indexOf('Suite') > t.indexOf('Préalable'); }), '… et elle reste après');

  // 4. The keyboard.
  await p.waitForTimeout(400);
  const before = await titles();
  const i = before.indexOf('Epsilon');
  await p.focus(`[data-sortable="tasks"] [data-task-id="${E.id}"]`);
  await p.keyboard.press('Alt+ArrowUp');
  ok(await until(async () => (await titles()).indexOf('Epsilon') === i - 1), `Alt + ↑ : Epsilon monte d'une place (${(await titles()).join(', ')})`);

  // 5. The cards slide when the order changes (unless less motion is asked).
  const slid = await p.evaluate(async () => {
    const seen = new Set();
    const obs = new MutationObserver(ms => ms.forEach(m => { if (m.target.style?.transform?.includes('translateY')) seen.add(m.target.dataset.sortId); }));
    obs.observe(document.querySelector('[data-sortable="tasks"]'), { attributes: true, subtree: true, attributeFilter: ['style'] });
    const el = document.querySelector('[data-sortable="tasks"] [data-task-id]');
    el.focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    await new Promise(r => setTimeout(r, 1200));
    obs.disconnect();
    return seen.size;
  });
  ok(slid >= 2, `les cartes glissent vers leur nouvelle place (${slid} animées)`);

  // 6. Today's lists move too.
  await call(`/tasks/${D.id}`, { method: 'PUT', body: JSON.stringify({ deadline: new Date(Date.now() - 86400e3).toISOString().slice(0, 10) }) });
  await call(`/tasks/${E.id}`, { method: 'PUT', body: JSON.stringify({ deadline: new Date(Date.now() - 86400e3).toISOString().slice(0, 10) }) });
  await p.click('[data-tour="nav-today"]');
  ok(await p.waitForSelector('[data-sortable="overdue"] [data-sort-id]', { timeout: 6000 }).then(() => true, () => false), 'Aujourd\'hui : les listes se glissent aussi');

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await browser.close();
  console.log(bad ? `${bad} écart(s)` : 'tout est vert');
  process.exit(bad ? 1 : 0);
})();
