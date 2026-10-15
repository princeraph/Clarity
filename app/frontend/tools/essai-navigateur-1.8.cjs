#!/usr/bin/env node
// Clarity 1.8.0 in a real browser, against a real backend: priority levels,
// links and what they do to the order, the graph that keeps its layout.
//
// Not run by the CI (Playwright and two servers). By hand, as for 1.7:
//   CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   NODE_PATH=$(npm root -g) node frontend/tools/essai-navigateur-1.8.cjs

const { chromium } = require('playwright');
const API = 'http://localhost:3001/api';
const URL = 'http://localhost:5173/';
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK   ' : 'ÉCART'} ${msg}`); if (!cond) bad++; };
const call = async (path, opts = {}) => { const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts }); return { status: r.status, body: await r.json().catch(() => null) }; };
const tasks = async () => { const { body } = await call('/tasks'); return [...body.tasks, ...body.archivedTasks]; };
const byTitle = async (title) => (await tasks()).find(t => t.title === title);
const until = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
const day = (k) => { const d = new Date(); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

async function seed() {
  for (const t of await tasks()) await fetch(`${API}/tasks/${t.id}`, { method: 'DELETE' });
  await call('/settings', { method: 'POST', body: JSON.stringify({ onboardingComplete: true }) });
  for (const [title, extra] of [
    ['Payer le loyer', {}], ['Fermer le mois', { deadline: day(3) }],
    ['Lire un livre', { deadline: day(0) }], ['Ranger le garage', { deadline: day(0) }],
  ]) await call('/tasks', { method: 'POST', body: JSON.stringify({ title, status: 'not_started', ...extra }) });
}

async function open(browser, view = null) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    Object.entries({ 'clarity-onboarding-done': '1', 'clarity-tutorialSeen': '1', 'clarity-locale': 'fr' }).forEach(([k, v]) => localStorage.setItem(k, v));
    sessionStorage.setItem('seeded', '1');
  });
  // The crash-report question (after 8 s) and the feedback prompt (after
  // 20 s) would cover the window mid-scenario: answered for it here.
  await p.route('**/api/crash', r => r.request().method() === 'GET' ? r.fulfill({ json: { available: false, asked: true } }) : r.continue());
  await p.route('**/api/feedback', r => r.request().method() === 'GET' ? r.fulfill({ json: { enabled: false } }) : r.continue());
  await p.goto(URL);
  await p.waitForSelector('main [data-task-id]');
  return { p, ctx, errors };
}
const firstCard = (p) => p.getAttribute('[data-tour="today-list"] [data-task-id]', 'aria-label');
const card = async (title) => `main [data-task-id="${(await byTitle(title)).id}"]`;

(async () => {
  await seed();
  const [loyer, mois] = [await byTitle('Payer le loyer'), await byTitle('Fermer le mois')];

  // 0. The server's rules.
  ok((await call(`/tasks/${loyer.id}`, { method: 'PUT', body: JSON.stringify({ priority: 'urgent' }) })).status === 400, 'un niveau inconnu est refusé');
  ok((await call(`/tasks/${loyer.id}`, { method: 'PUT', body: JSON.stringify({ difficulty: 7 }) })).status === 400, 'une difficulté hors 1–5 est refusée');
  ok((await call(`/tasks/${loyer.id}`, { method: 'PUT', body: JSON.stringify({ links: [{ to: 'nope', type: 'blocks' }] }) })).status === 400, 'un lien vers une tâche inconnue est refusé');

  const browser = await chromium.launch();
  {
    const { p, ctx, errors } = await open(browser);

    // 1. A level set in the detail panel leads the list.
    await p.click(`${await card('Lire un livre')} span:has-text("Lire un livre")`);
    await p.click('[data-tour="detail-priority"] [data-level="top"]');
    ok(await until(async () => (await byTitle('Lire un livre')).priority === 'top'), 'le détail règle « Priorité absolue »');
    await p.keyboard.press('Escape');
    ok(await until(async () => (await firstCard(p)) === 'Lire un livre'), 'la tâche en priorité absolue passe en tête');
    ok(!!(await p.$(`${await card('Lire un livre')} [data-level="top"]`)), 'la carte porte le marqueur du niveau');
    ok(!(await p.$(`${await card('Ranger le garage')} [data-level]`)), 'sans niveau choisi, pas de marqueur');

    // 2. A link added in the detail panel: « Fermer le mois » blocked by « Payer le loyer ».
    await p.click(`${await card('Fermer le mois')} span:has-text("Fermer le mois")`);
    await p.click('[data-add-link]');
    await p.click('[role="radio"]:has-text("Bloquée par…")');
    await p.fill('[data-tour="detail-links"] input', 'Payer');
    await p.click('[data-link-candidate]:has-text("Payer le loyer")');
    ok(await until(async () => (await byTitle('Payer le loyer')).links?.some(l => l.to === mois.id && l.type === 'blocks' && l.strength === 'hard')), 'le lien est écrit sur la tâche qui bloque');
    ok(await p.waitForSelector('[data-link-row="links.rowBlockedBy"]', { timeout: 3000 }).then(() => true, () => false), 'le détail montre « Bloquée par »');
    await p.keyboard.press('Escape');
    await call(`/tasks/${mois.id}`, { method: 'PUT', body: JSON.stringify({ priority: 'top' }) });
    await p.waitForTimeout(5600);   // the next refresh
    const order = await p.$$eval('[data-tour="today-list"] [data-task-id]', els => els.map(e => e.getAttribute('aria-label')));
    ok(order.indexOf('Payer le loyer') < order.indexOf('Ranger le garage'), `le bloquant d'une priorité absolue passe devant les tâches moyennes (${order.join(' > ')})`);
    ok(order.indexOf('Fermer le mois') > order.indexOf('Ranger le garage'), 'la tâche bloquée descend sous les autres');
    ok(!!(await p.$(`${await card('Payer le loyer')} [data-chip="inherited"]`)), 'la carte dit « hérité de »');
    ok(!!(await p.$(`${await card('Payer le loyer')} [data-chip="before"]`)), 'la carte dit « avant le …, pour … »');
    ok(!!(await p.$(`${await card('Fermer le mois')} [data-chip="blocked"]`)), 'la carte bloquée dit « bloquée par 1 »');

    // 3. A loop is refused, and said: loyer → mois → livre, then « livre blocks loyer ».
    await call(`/tasks/${mois.id}`, { method: 'PUT', body: JSON.stringify({ links: [{ to: (await byTitle('Lire un livre')).id, type: 'blocks' }] }) });
    await p.waitForTimeout(5600);
    await p.screenshot({ path: process.env.SHOT || '/dev/null' }).catch(() => {});
    ok(!(await p.$('[data-tour="detail-links"]')), 'Échap a refermé le détail après l\'ajout d\'un lien');
    await p.click(`${await card('Lire un livre')} span:has-text("Lire un livre")`);
    await p.click('[data-add-link]');
    await p.click('[role="radio"]:has-text("Bloque…")');
    await p.fill('[data-tour="detail-links"] input', 'Payer');
    await p.click('[data-link-candidate]:has-text("Payer le loyer")');
    ok(await p.waitForSelector('[role="alert"]:has-text("boucle")', { timeout: 3000 }).then(() => true, () => false), 'une boucle est refusée, et dite');
    await p.keyboard.press('Escape'); await p.keyboard.press('Escape');

    // 4. Finishing the blocker sets the other free, and says so.
    await p.click(`${await card('Payer le loyer')} [data-check]`);
    ok(await p.waitForSelector('text=« Fermer le mois » est débloquée', { timeout: 4000 }).then(() => true, () => false), 'terminer le bloquant : « Fermer le mois » est débloquée');

    // 5. !2 in the quick capture; the level from the right-click menu.
    await p.keyboard.press('Control+k'); await p.keyboard.press('Tab');
    await p.keyboard.type('Ranger la cave !2');
    await p.keyboard.press('Enter');
    ok(await until(async () => (await byTitle('Ranger la cave'))?.priority === 'very_high'), 'la saisie « !2 » donne « Très haute »');
    await p.click(`${await card('Ranger le garage')}`, { button: 'right' });
    await p.click('[data-menu="priority"] [data-level="low"]');
    ok(await until(async () => (await byTitle('Ranger le garage')).priority === 'low'), 'le clic droit règle « Basse »');
    ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
    await ctx.close();
  }

  // 6. The graph: drawn every frame, and still after a refresh.
  {
    const { p, ctx, errors } = await open(browser);
    await p.click('[data-tour="nav-graph"]');
    await p.waitForSelector('[data-node]');
    // Count how many distinct positions one node takes in a second of settling.
    const frames = await p.evaluate(() => new Promise(res => {
      const el = document.querySelector('[data-node] rect');
      const seen = new Set(); const t0 = performance.now();
      const tick = () => { seen.add(el?.getAttribute('x') + ',' + el?.getAttribute('y')); if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else res(seen.size); };
      requestAnimationFrame(tick);
    }));
    ok(frames >= 30, `le graphe bouge à chaque image (${frames} positions en 1 s ; ~20 avant)`);
    await p.waitForTimeout(4000);   // settled
    const where = () => p.$$eval('[data-node] rect', rs => rs.map(r => `${Math.round(r.getAttribute('x'))},${Math.round(r.getAttribute('y'))}`).join(' '));
    const before = await where();
    // A change elsewhere (a title, as a timer or the sync would make) reaches
    // the graph at the next refresh: it used to throw every bubble back.
    const garage = await byTitle('Ranger le garage');
    await call(`/tasks/${garage.id}`, { method: 'PUT', body: JSON.stringify({ title: 'Ranger le garage (vite)' }) });
    // Watched the whole time, not only at the end: a restarted layout comes
    // back to the same resting place — what the person sees is the jump.
    let moved = 0;
    for (let k = 0; k < 65; k++) { await p.waitForTimeout(100); if ((await where()) !== before) moved++; }
    ok(moved === 0, `une tâche modifiée ailleurs : les bulles n'ont pas bougé (${moved} instants sur 65 en mouvement)`);
    ok(await p.$$eval('[data-edge="hard"]', es => es.length) >= 1, 'le lien « impossible avant » est tracé');
    ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
    await ctx.close();
  }

  // 7. Deleting a task removes the links that point at it.
  await fetch(`${API}/tasks/${mois.id}`, { method: 'DELETE' });
  ok(!(await byTitle('Payer le loyer')).links?.length, 'supprimer une tâche retire les liens qui la visent');

  await browser.close();
  console.log(bad ? `${bad} écart(s)` : 'tout est vert');
  process.exit(bad ? 1 : 0);
})();
