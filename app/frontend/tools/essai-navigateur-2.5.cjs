#!/usr/bin/env node
// Clarity 2.5.0 in a real browser, against a real backend that wants the
// window's key: refused without it, served with it (as Electron's preload
// gives it); the Content-Security-Policy in place and never tripped; import
// of a Todoist file with its preview; the Help page.
//
// Not run by the CI. By hand:
//   CLARITY_API_TOKEN=essai-cle-25 CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   IMPORT=<a Todoist CSV> NODE_PATH=$(npm root -g) node frontend/tools/essai-navigateur-2.5.cjs

const { chromium } = require('playwright');
const API = 'http://localhost:3001/api';
const KEY = 'essai-cle-25';
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK   ' : 'ÉCART'} ${msg}`); if (!cond) bad++; };
const call = async (path, opts = {}, key = KEY) => { const r = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(key ? { 'X-Clarity-Token': key } : {}) } }); return { status: r.status, body: await r.json().catch(() => null) }; };
const until = async (fn, ms = 4000) => { for (let k = 0; k < ms / 100; k++) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };

(async () => {
  // 1. The key.
  ok((await call('/tasks', {}, null)).status === 401, 'sans la clé : refusé (401)');
  ok((await call('/tasks', {}, 'mauvaise-cle-12')).status === 401, 'une mauvaise clé : refusé');
  ok((await call('/tasks', { method: 'POST', body: JSON.stringify({ title: 'pirate' }) }, null)).status === 401, 'une écriture sans clé : refusée');
  ok((await call('/health', {}, null)).status === 200, '/health reste ouvert (le connecteur IA s\'en sert)');
  ok((await call('/tasks')).status === 200, 'avec la clé : servi');
  for (const t of (await call('/tasks')).body.tasks) await call(`/tasks/${t.id}`, { method: 'DELETE' });
  await call('/settings', { method: 'POST', body: JSON.stringify({ onboardingComplete: true }) });
  await call('/tasks', { method: 'POST', body: JSON.stringify({ title: 'Courses' }) });

  const browser = await chromium.launch();
  const open = async (withKey) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' });
    const p = await ctx.newPage();
    const errors = [], csp = [];
    p.on('pageerror', e => errors.push(String(e)));
    p.on('console', m => { if (/Content Security Policy|Refused to/.test(m.text())) csp.push(m.text()); });
    await p.addInitScript(({ key }) => {
      Object.entries({ 'clarity-onboarding-done': '1', 'clarity-tutorialSeen': '1', 'clarity-locale': 'fr', 'clarity-lastSeenVersion': '9.9.9' }).forEach(([k, v]) => localStorage.setItem(k, v));
      // What Electron's preload gives the window (window.clarity.apiToken).
      if (key) window.clarity = { apiToken: key };
    }, { key: withKey ? KEY : '' });
    await p.route('**/api/crash', r => r.request().method() === 'GET' ? r.fulfill({ json: { available: false, asked: true } }) : r.continue());
    await p.route('**/api/feedback', r => r.request().method() === 'GET' ? r.fulfill({ json: { enabled: false } }) : r.continue());
    await p.goto('http://localhost:5173/');
    return { p, ctx, errors, csp };
  };

  // 2. Without the key, the page gets nothing; with it, everything.
  let w = await open(false);
  await w.p.waitForTimeout(2500);
  ok(!(await w.p.$('[data-task-id]')), 'une page sans la clé n\'obtient aucune tâche');
  await w.ctx.close();
  w = await open(true);
  ok(await w.p.waitForSelector('[data-task-id]', { timeout: 8000 }).then(() => true, () => false), 'avec la clé (comme dans Electron) : les tâches arrivent');
  ok(await w.p.$eval('meta[http-equiv="Content-Security-Policy"]', m => /default-src 'self'/.test(m.content)).catch(() => false), 'la page déclare sa politique de sécurité (CSP)');

  // 3. Import, with its preview.
  await w.p.click('[data-tour="settings"]');
  await w.p.click('[data-tour="settings-data"]');
  await w.p.setInputFiles('input[name="import-file"]', process.env.IMPORT);
  ok(await w.p.waitForSelector('[data-import-preview]', { timeout: 5000 }).then(() => true, () => false), 'un fichier Todoist : un aperçu d\'abord');
  const pv = await w.p.textContent('[data-import-preview]');
  ok(/Todoist/.test(pv) && /1 tâche à importer/.test(pv) && /1 déjà là/.test(pv), `… format reconnu, 1 à importer, « Courses » déjà là (${pv.replace(/\s+/g, ' ').slice(0, 120)})`);
  await w.p.click('[data-act="import"]');
  ok(await until(async () => /1 tâche importée/.test(await w.p.textContent('[data-import-result]').catch(() => ''))), 'importée, et dit');
  const t = (await call('/tasks')).body.tasks.find(x => x.title === 'Appeler le notaire');
  ok(t && t.deadline === '2026-10-22' && t.priority === 'very_high' && t.description === 'Pour la signature', 'avec sa date, sa priorité (p1 → Très haute) et sa note');

  // 4. Help.
  await w.p.click('[data-tour="settings-help"]');
  await w.p.click('[data-help="import"] summary');
  ok(/Réglages › Données › Importer/.test(await w.p.textContent('[data-help="import"]')), 'Aide : une question s\'ouvre sur sa réponse');

  ok(w.csp.length === 0, `aucun blocage de la politique de sécurité (${w.csp.slice(0, 2).join(' | ')})`);
  ok(w.errors.length === 0, `aucune erreur de page (${w.errors.join(' | ')})`);
  await browser.close();
  console.log(bad ? `${bad} écart(s)` : 'tout est vert');
  process.exit(bad ? 1 : 0);
})();
