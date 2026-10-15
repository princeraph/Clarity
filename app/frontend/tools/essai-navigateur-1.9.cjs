#!/usr/bin/env node
// Clarity 1.9.0 in a real browser, against a real backend: what Clarity
// proposes, and what Confirm / Not now / Never for this do. The assistant's
// analysis is injected into the task list the page reads (no model needed);
// the two fixed rules come from the tasks themselves.
//
// Not run by the CI (Playwright and two servers). By hand, as for 1.7 / 1.8:
//   CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   NODE_PATH=$(npm root -g) node frontend/tools/essai-navigateur-1.9.cjs

const { chromium } = require('playwright');
const API = 'http://localhost:3001/api';
const URL = 'http://localhost:5173/';
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK   ' : 'ÉCART'} ${msg}`); if (!cond) bad++; };
const call = async (path, opts = {}) => { const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts }); return { status: r.status, body: await r.json().catch(() => null) }; };
const tasks = async () => { const { body } = await call('/tasks'); return [...body.tasks, ...body.archivedTasks]; };
const byTitle = async (title) => (await tasks()).find(t => t.title === title);
const put = (id, body) => call(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) });
const until = async (fn, ms = 7000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 150)); } return false; };
const day = (k) => { const d = new Date(); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

async function seed() {
  for (const t of await tasks()) await fetch(`${API}/tasks/${t.id}`, { method: 'DELETE' });
  await call('/settings', { method: 'POST', body: JSON.stringify({ onboardingComplete: true }) });
  const mk = async (title, extra = {}) => (await call('/tasks', { method: 'POST', body: JSON.stringify({ title, status: 'not_started', deadline: day(0), ...extra }) })).body.task;
  const A = await mk('Payer le loyer'), B = await mk('Fermer le mois');
  const D = await mk('Envoyer le mail', { estimatedDuration: 15 });
  await mk('Rapport annuel', { estimatedDuration: 180, links: [{ to: D.id, type: 'blocks', strength: 'hard' }] });
  const E = await mk('Ranger le grenier', { estimatedDuration: 240 });
  for (const k of [1, 2, 3]) await put(E.id, { deadline: day(k) });   // put off three times
  return { A, B, E };
}

(async () => {
  const { A, B, E } = await seed();
  const analysis = {
    analyzedAt: new Date(Date.now() + 60000).toISOString(), whatToDoNext: '', overallInsight: '',
    taskAnalysis: [
      { id: A.id, priority: 1, priorityLevel: 'medium', reasoning: 'Le loyer est dû aujourd’hui.', actionPlan: [], suggestedLevel: 'high', suggestedDifficulty: 2,
        suggestedLinks: [{ to: B.id, type: 'blocks', strength: 'hard', why: 'Le mois se ferme après le loyer.' }] },
      { id: B.id, priority: 2, priorityLevel: 'medium', reasoning: '', actionPlan: [], suggestedLinks: [{ to: E.id, type: 'related', strength: 'hard', why: 'Même week-end.' }] },
    ],
  };

  const browser = await chromium.launch();
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
  await p.route('**/api/crash', r => r.request().method() === 'GET' ? r.fulfill({ json: { available: false, asked: true } }) : r.continue());
  await p.route('**/api/feedback', r => r.request().method() === 'GET' ? r.fulfill({ json: { enabled: false } }) : r.continue());
  // The assistant's analysis, as if it had just run.
  await p.route('**/api/tasks', async r => {
    if (r.request().method() !== 'GET') return r.continue();
    const res = await r.fetch(); const json = await res.json();
    r.fulfill({ response: res, json: { ...json, analysis } });
  });
  await p.goto(URL);
  await p.waitForSelector('main [data-task-id]');
  const card = async (title) => `main [data-task-id="${(await byTitle(title)).id}"]`;
  const chip = async (title) => p.textContent(`${await card(title)} [data-chip="suggest"]`).catch(() => null);

  // 1. ✦ on the cards.
  ok((await chip('Payer le loyer'))?.includes('3'), `✦ 3 sur « Payer le loyer » (lien, niveau, difficulté) — ${await chip('Payer le loyer')}`);
  ok((await chip('Rapport annuel'))?.includes('1'), '✦ sur « Rapport annuel » : lourde, retient une tâche légère');
  ok((await chip('Ranger le grenier'))?.includes('1'), '✦ sur « Ranger le grenier » : repoussée 3 fois, lourde, ne débloque rien');
  ok(!(await chip('Envoyer le mail')), 'rien sur « Envoyer le mail »');
  // An empty plan from the assistant printed a stray « 0 » under the card.
  const lines = (await p.innerText(await card('Fermer le mois'))).split('\n').map(l => l.trim());
  ok(!lines.includes('0'), 'pas de « 0 » orphelin sous une carte au plan vide');

  // 2. Confirm a link; « not now » a level; « never » a difficulty.
  await p.click(`${await card('Payer le loyer')} [data-chip="suggest"]`);
  await p.waitForSelector('[data-suggestions]');
  ok(/Le mois se ferme après le loyer/.test(await p.textContent('[data-suggestion="link"]')), 'le lien proposé dit pourquoi');
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
  await p.click('[data-suggestion="link"] [data-act="confirm"]');
  ok(await until(async () => (await byTitle('Payer le loyer')).links?.some(l => l.to === B.id && l.type === 'blocks')), 'Confirmer écrit le lien');
  await p.click('[data-suggestion="level"] [data-act="later"]');
  ok(await until(async () => (await byTitle('Payer le loyer')).dismissed?.some(d => d.key === 'level' && !d.never)), '« Pas maintenant » est enregistré');
  await p.click('[data-suggestion="difficulty"] [data-act="never"]');
  ok(await until(async () => (await byTitle('Payer le loyer')).dismissed?.some(d => d.key === 'difficulty' && d.never)), '« Jamais pour ça » est enregistré');
  ok(await until(async () => !(await p.$('[data-suggestions]'))), 'le bloc disparaît quand il n\'y a plus rien');
  await p.keyboard.press('Escape');

  // 3. The task changes: « not now » comes back, « never » does not.
  await put(A.id, { title: 'Payer le loyer de novembre' });
  ok(await until(async () => (await p.textContent(`main [data-task-id="${A.id}"] [data-chip="suggest"]`).catch(() => ''))?.includes('1')), '« Pas maintenant » revient quand la tâche change ; « Jamais » non (✦ 1)');

  // 4. The fixed rules.
  await p.click(`${await card('Rapport annuel')} [data-chip="suggest"]`);
  await p.click('[data-suggestion="heavy"] [data-act="alt"]');
  ok(await until(async () => (await byTitle('Rapport annuel')).links?.[0]?.strength === 'soft'), '« Passer en mieux avant » change la force du lien');
  await p.keyboard.press('Escape');
  await p.click(`${await card('Ranger le grenier')} [data-chip="suggest"]`);
  ok(/repoussée 3 fois/.test(await p.textContent('[data-suggestion="lower"]')), '« Faire descendre » dit ses chiffres');
  await p.click('[data-suggestion="lower"] [data-act="confirm"]');
  ok(await until(async () => (await byTitle('Ranger le grenier')).priority === 'low'), 'Confirmer la fait descendre d\'un cran (Moyenne → Basse), sans l\'abandonner');
  await p.keyboard.press('Escape');

  // 5. The graph: a proposed link, dotted.
  await p.click('[data-tour="nav-graph"]');
  await p.waitForSelector('[data-node]');
  ok(await until(async () => (await p.$$('[data-edge="suggested"]')).length >= 1), 'le graphe trace le lien proposé en pointillé');

  ok(errors.length === 0, `aucune erreur de page (${errors.join(' | ')})`);
  await browser.close();
  console.log(bad ? `${bad} écart(s)` : 'tout est vert');
  process.exit(bad ? 1 : 0);
})();
