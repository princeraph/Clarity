#!/usr/bin/env node
// Accessibility audit (2.5.0): axe-core over the main screens, light and dark.
// Not in the CI (it needs axe-core and two servers). By hand:
//   npm install --prefix <folder> axe-core@4.10.2
//   CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   AXE=<folder>/node_modules/axe-core/axe.min.js NODE_PATH=$(npm root -g) node frontend/tools/audit-accessibilite.cjs
// Fails on any « serious » or « critical » finding (WCAG 2.1 A and AA).
const { chromium } = require('playwright');
const API = 'http://localhost:3001/api';
const call = async (path, opts = {}) => { const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts }); return r.json().catch(() => null); };

(async () => {
  for (const t of [...((await call('/tasks')).tasks || [])]) await fetch(`${API}/tasks/${t.id}`, { method: 'DELETE' });
  await call('/settings', { method: 'POST', body: JSON.stringify({ onboardingComplete: true, workday: { start: '00:00', end: '23:59', breaks: [], days: [0, 1, 2, 3, 4, 5, 6] } }) });
  const today = new Date().toISOString().slice(0, 10);
  const A = (await call('/tasks', { method: 'POST', body: JSON.stringify({ title: 'Rapport', deadline: today, priority: 'top', estimatedDuration: 60 }) })).task;
  await call('/tasks', { method: 'POST', body: JSON.stringify({ title: 'Courriels', deadline: today, priority: 'medium', estimatedDuration: 15 }) });
  await call('/tasks', { method: 'POST', body: JSON.stringify({ title: 'Lire le contrat', priority: 'low' }) });

  const browser = await chromium.launch();
  const found = new Map();
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR', bypassCSP: true });
    const p = await ctx.newPage();
    await p.addInitScript((th) => {
      Object.entries({ 'clarity-onboarding-done': '1', 'clarity-tutorialSeen': '1', 'clarity-locale': 'fr', 'clarity-lastSeenVersion': '9.9.9', 'clarity-theme': th }).forEach(([k, v]) => localStorage.setItem(k, v));
    }, theme);
    await p.route('**/api/crash', r => r.request().method() === 'GET' ? r.fulfill({ json: { available: false, asked: true } }) : r.continue());
    await p.route('**/api/feedback', r => r.request().method() === 'GET' ? r.fulfill({ json: { enabled: false } }) : r.continue());
    await p.route('**/api/reminders/claim', r => r.fulfill({ json: { reminders: [] } }));
    await p.goto('http://localhost:5173/');
    await p.waitForSelector('[data-tour="today-list"]');
    const screens = [
      ['Aujourd’hui', async () => {}],
      ['Détail', async () => { await p.click(`[data-task-id="${A.id}"] span >> text=Rapport`); await p.waitForSelector('[data-reminder-row]'); }],
      ['Boîte de réception', async () => { await p.keyboard.press('Escape'); await p.click('[data-tour="nav-inbox"]'); await p.waitForSelector('[data-sortable="tasks"]'); }],
      ['Calendrier', async () => { await p.click('[data-tour="nav-upcoming"]'); await p.waitForSelector('[data-time-grid="week"]'); }],
      ['Réglages › Au quotidien', async () => { await p.click('[data-tour="settings"]'); await p.click('[data-tour="settings-daily"]'); await p.waitForSelector('[data-tour="workday"]'); }],
      ['Réglages › Apparence', async () => { await p.click('[data-tour="settings-appearance"]'); }],
      ['Réglages › Données', async () => { await p.click('[data-tour="settings-data"]'); await p.waitForSelector('[data-import]'); }],
      ['Réglages › Aide', async () => { await p.click('[data-tour="settings-help"]'); await p.waitForSelector('[data-tour="help"]'); }],
    ];
    for (const [name, go] of screens) {
      await go();
      await p.waitForTimeout(400);
      await p.addScriptTag({ path: process.env.AXE });
      const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations
        .map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 40).map(n => ({ target: n.target.join(' '), why: (n.failureSummary || '').split('\n').slice(1, 2).join(' ').slice(0, 160) })), count: v.nodes.length })));
      for (const v of r) {
        const k = `${v.id}`;
        const cur = found.get(k) || { ...v, where: new Set(), count: 0 };
        cur.where.add(`${name} (${theme})`); cur.count += v.count;
        if (!cur.examples) cur.examples = v.nodes; 
        found.set(k, cur);
      }
    }
    await ctx.close();
  }
  await browser.close();
  let bad = 0;
  for (const v of [...found.values()].sort((a, b) => (a.impact === 'critical' ? -1 : 1))) {
    if (v.impact === 'serious' || v.impact === 'critical') bad++;
    console.log(`${v.impact.toUpperCase().padEnd(9)} ${v.id} — ${v.help} — ${v.count} élément(s) — ${[...v.where].slice(0, 4).join(', ')}`);
    for (const n of v.examples) console.log(`          ${n.target}  ${n.why}`);
  }
  console.log(bad ? `${bad} règle(s) graves en écart` : 'aucun écart grave');
  process.exit(bad ? 1 : 0);
})();
