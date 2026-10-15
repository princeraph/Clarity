#!/usr/bin/env node
// Clarity 1.7.0 in a real browser, against a real backend: the keyboard in
// lists, every « Undo », the quick capture's time and date, the cheat sheet,
// the weekly review in the sidebar.
//
// Not run by the CI: it needs Playwright and two servers. By hand:
//   CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   NODE_PATH=$(npm root -g) node frontend/tools/essai-navigateur-1.7.cjs
// The data folder must be a throwaway one: the scenario creates and deletes.

const { chromium } = require('playwright');
const API = 'http://localhost:3001/api';
const URL = 'http://localhost:5173/';
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK   ' : 'ÉCART'} ${msg}`); if (!cond) bad++; };
const api = async (path, opts = {}) => (await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts })).json();
const tasks = async () => { const r = await api('/tasks'); return [...(r.tasks || []), ...(r.archivedTasks || [])]; };
const byTitle = async (title) => (await tasks()).find(t => t.title === title);
const until = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function seed() {
  for (const t of await tasks()) await fetch(`${API}/tasks/${t.id}`, { method: 'DELETE' });
  await api('/settings', { method: 'POST', body: JSON.stringify({ onboardingComplete: true }) });
  const today = localDay();
  for (const [title, extra] of [
    ['Rédiger le rapport', {}], ['Appeler le dentiste', {}], ['Préparer la réunion', {}],
    ['Payer le loyer', { recurring: 'weekly' }],
    ['Trier les factures', { subtasks: [{ id: 's1', title: 'Janvier', done: false }] }],
  ]) await api('/tasks', { method: 'POST', body: JSON.stringify({ title, deadline: today, status: 'not_started', ...extra }) });
}

async function page(browser, storage = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    Object.entries({ 'clarity-onboarding-done': '1', 'clarity-tutorialSeen': '1', 'clarity-locale': 'fr', ...s }).forEach(([k, v]) => localStorage.setItem(k, v));
    sessionStorage.setItem('seeded', '1');
  }, storage);
  // The crash-report question (after 8 s) and the feedback prompt (after
  // 20 s) would cover the window mid-scenario: answered for it here.
  await p.route('**/api/crash', r => r.request().method() === 'GET' ? r.fulfill({ json: { available: false, asked: true } }) : r.continue());
  await p.route('**/api/feedback', r => r.request().method() === 'GET' ? r.fulfill({ json: { enabled: false } }) : r.continue());
  await p.goto(URL);
  await p.waitForSelector('main [data-task-id]');
  return { p, ctx, errors };
}
const focusedTitle = (p) => p.evaluate(() => document.activeElement?.getAttribute('aria-label') || null);
const undo = (p) => p.click('button:has-text("Annuler")');

(async () => {
  await seed();
  const browser = await chromium.launch();

  // 1. The keyboard in a list.
  {
    const { p, ctx, errors } = await page(browser);
    await p.keyboard.press('ArrowDown');
    const first = await focusedTitle(p);
    ok(!!first, `↓ prend la première tâche (« ${first} »)`);
    await p.keyboard.press('ArrowDown');
    const second = await focusedTitle(p);
    ok(second && second !== first, `↓ passe à la suivante (« ${second} »)`);
    await p.keyboard.press('ArrowUp');
    ok(await focusedTitle(p) === first, '↑ revient');

    await p.keyboard.press(' ');
    ok(await until(async () => (await byTitle(first))?.status === 'done'), `Espace termine « ${first} »`);
    await p.waitForTimeout(500);
    const next = await focusedTitle(p);
    ok(next && next !== first, `le focus passe à la suivante (« ${next} »)`);
    await p.keyboard.press(' ');
    ok(await until(async () => (await byTitle(next))?.status === 'done'), `Espace, encore : « ${next} » terminée`);
    await undo(p);
    ok(await until(async () => (await byTitle(next))?.status === 'not_started'), 'Annuler la remet à faire');

    const focusOn = async (title) => p.focus(`main [data-task-id][aria-label="${title}"]`);
    await focusOn(next);
    await p.keyboard.press('Enter');
    ok(await p.waitForSelector(`text=${next} >> nth=1`, { timeout: 3000 }).then(() => true, () => false), 'Entrée ouvre le détail');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);

    await focusOn(next);
    await p.keyboard.press('Delete');
    await p.waitForTimeout(200);
    ok(!(await p.$(`main [data-task-id][aria-label="${next}"]`)), 'Suppr la retire de la liste');
    await undo(p);
    await p.waitForTimeout(5600);
    ok(!!(await byTitle(next)), 'Annuler la garde (toujours là après 5 s)');

    // Typing never triggers the list keys.
    await p.keyboard.press('Control+k');
    await p.keyboard.press('Tab');   // from search to adding
    await p.keyboard.type('Appeler Marc demain à 14h');
    await p.waitForTimeout(150);
    const pills = await p.textContent('body');
    ok(/14:00/.test(pills), 'la saisie montre l\'heure comprise');
    await p.keyboard.press('Enter');
    const marc = await until(async () => !!(await byTitle('Appeler Marc')));
    const m = await byTitle('Appeler Marc');
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    ok(marc && m.time === '14:00' && m.deadline === localDay(tomorrow), `Ctrl+K « Appeler Marc demain à 14h » → ${m?.deadline} ${m?.time}`);
    ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
    await ctx.close();
  }

  // 2. A recurring task: finished, then undone — no second occurrence left.
  {
    const { p, ctx, errors } = await page(browser);
    const loyer = await byTitle('Payer le loyer');
    await p.click(`main [data-task-id="${loyer.id}"] [data-check]`);
    ok(await until(async () => (await tasks()).filter(t => t.title === 'Payer le loyer').length === 2), 'terminer une tâche répétée crée la suivante');
    await undo(p);
    ok(await until(async () => {
      const all = (await tasks()).filter(t => t.title === 'Payer le loyer');
      return all.length === 1 && all[0].status === 'not_started';
    }), 'Annuler : la tâche revient, l\'occurrence créée disparaît');
    ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
    await ctx.close();
  }

  // 3. Archive, and an edit in the detail panel, both undone.
  {
    const { p, ctx, errors } = await page(browser);
    const f = await byTitle('Trier les factures');
    const card = `main [data-task-id="${f.id}"]`;
    // The card's actions show on hover.
    await p.hover(card);
    await p.click(`${card} button:has-text("Archiver")`, { timeout: 5000 });
    ok(await until(async () => (await byTitle('Trier les factures'))?.archived === true), 'Archiver');
    await undo(p);
    ok(await until(async () => (await byTitle('Trier les factures'))?.archived === false), 'Annuler le désarchive');

    const r = await byTitle('Rédiger le rapport');
    await p.click(`main [data-task-id="${r.id}"] span:has-text("Rédiger le rapport")`);
    await p.selectOption('select:has(option[value="weekly"])', 'weekly');
    ok(await until(async () => (await byTitle('Rédiger le rapport'))?.recurring === 'weekly'), 'le détail change la répétition');
    await undo(p);
    ok(await until(async () => (await byTitle('Rédiger le rapport'))?.recurring === 'none'), 'Annuler remet « une seule fois »');
    ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
    await ctx.close();
  }

  // 4. A key changed in Settings › Keyboard: the new one works, the old one not;
  //    the cheat sheet shows the new one. And the weekly review is reachable.
  {
    const { p, ctx, errors } = await page(browser, { 'clarity-shortcuts': JSON.stringify({ complete: ['X'] }) });
    await p.keyboard.press('ArrowDown');
    const title = await focusedTitle(p);
    const before = (await byTitle(title)).status;
    await p.keyboard.press(' ');
    await p.waitForTimeout(600);
    ok((await byTitle(title)).status === before, 'Espace ne fait plus rien une fois remplacée');
    await p.keyboard.press('x');
    ok(await until(async () => (await byTitle(title))?.status !== before), 'X, la nouvelle touche, termine');

    await p.keyboard.press('?');
    const sheet = await p.waitForSelector('#shortcuts-title', { timeout: 3000 }).then(() => true, () => false);
    ok(sheet, '? ouvre l\'aide-mémoire');
    const row = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"] div')].find(d => /Marquer|terminée/i.test(d.firstChild?.textContent || ''))?.textContent || '');
    ok(/X/.test(row), `l'aide-mémoire montre la touche choisie (« ${row} »)`);
    await p.keyboard.press('Escape');
    ok(!(await p.$('#shortcuts-title')), 'Échap le ferme');

    await p.click('[data-tour="nav-weekly"]');
    await p.waitForTimeout(500);
    await p.screenshot({ path: process.env.SHOT || '/dev/null' }).catch(() => {});
    ok(await p.waitForSelector('h1:has-text("Votre semaine en revue")', { timeout: 3000 }).then(() => true, () => false), 'le bilan de la semaine s\'ouvre depuis la barre latérale');
    ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
    await ctx.close();
  }

  await browser.close();
  console.log(bad ? `${bad} écart(s)` : 'tout est vert');
  process.exit(bad ? 1 : 0);
})();
