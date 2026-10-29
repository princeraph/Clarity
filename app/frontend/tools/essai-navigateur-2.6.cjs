#!/usr/bin/env node
// Clarity 2.6.0 in a real browser, against a real backend: the fixes asked for
// on 29 October.
//   1. Settings opens on Account, the first page of its list.
//   2. The Inbox stays where it was scrolled: the 5-second refresh neither
//      moves the cards nor climbs back up.
//   3. Topics: « Perso » and « perso » are one; the count leaves out what is
//      done; renamed (merged), removed — the tasks stay.
//   4. A topic's task, in the side panel: subtasks added, edited, given notes
//      there — the full form never opens.
//   5. « Clarity suggests »: one proposal at a time; the mode can be chosen.
//
// Not run by the CI. By hand, as for 2.5:
//   CLARITY_DATA_DIR=<empty folder> node backend/server.js
//   (cd frontend && npx vite preview --port 5173 --strictPort)
//   NODE_PATH=$(npm root -g) node frontend/tools/essai-navigateur-2.6.cjs

const { chromium } = require('playwright');
const API = 'http://localhost:3001/api';
const URL = 'http://localhost:5173/';
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK   ' : 'ÉCART'} ${msg}`); if (!cond) bad++; };
const call = async (path, opts = {}) => { const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts }); return { status: r.status, body: await r.json().catch(() => null) }; };
const tasks = async () => { const { body } = await call('/tasks'); return [...body.tasks, ...body.archivedTasks]; };
const until = async (fn, ms = 4000) => { for (let k = 0; k < ms / 100; k++) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  for (const t of await tasks()) await fetch(`${API}/tasks/${t.id}`, { method: 'DELETE' });
  await call('/settings', { method: 'POST', body: JSON.stringify({ onboardingComplete: true }) });
  const mk = async (title, extra) => (await call('/tasks', { method: 'POST', body: JSON.stringify({ title, status: 'not_started', ...extra }) })).body.task;

  // Enough tasks for the Inbox to scroll.
  for (let i = 1; i <= 40; i++) await mk(`Tâche ${String(i).padStart(2, '0')}`, { priority: 'medium' });
  const P1 = await mk('Courses', { tags: ['Perso'] });
  const P2 = await mk('Pharmacie', { tags: ['perso'] });          // same topic, other case
  const P3 = await mk('Banque', { tags: ['Perso'], status: 'done' });
  ok((await tasks()).find(t => t.id === P2.id).tags[0] === 'Perso', 'le serveur range « perso » sous l’orthographe déjà utilisée');

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR', reducedMotion: 'no-preference' });
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
  await p.route('**/api/suggestions/next', r => r.fulfill({ json: { suggestion: null } }));
  await p.goto(URL);

  // 1. Settings.
  await p.click('[data-tour="settings"]');
  // The page on screen is the one whose button in the Settings list is lit.
  const lit = (id) => p.$eval(`[data-tour="settings-${id}"]`, b => getComputedStyle(b).boxShadow !== 'none').catch(() => false);
  ok(await until(() => lit('account')), 'Réglages s’ouvre sur Compte');
  ok(!(await lit('appearance')), '… et pas sur Apparence');

  // 2. Inbox: scrolled, then two refreshes.
  await p.click('[data-tour="nav-inbox"]');
  await p.waitForSelector('[data-sortable="tasks"] [data-sort-id]');
  const scroller = 'main [data-sortable="tasks"]';
  const scrolled = await p.$eval(scroller, el => { let s = el.parentElement; while (s && getComputedStyle(s).overflowY !== 'auto') s = s.parentElement; s.scrollTop = 900; return s.scrollTop; });
  ok(scrolled > 800, `la Boîte de réception défile (${scrolled} px)`);
  // Watch every card for 11 s: two refreshes at 5 s.
  await p.$eval(scroller, el => {
    window.__moved = 0;
    new MutationObserver(ms => { for (const m of ms) if (/translateY/.test(m.target.style.transform || '')) window.__moved++; })
      .observe(el, { attributes: true, subtree: true, attributeFilter: ['style'] });
  });
  await wait(11000);
  const after = await p.$eval(scroller, el => { let s = el.parentElement; while (s && getComputedStyle(s).overflowY !== 'auto') s = s.parentElement; return s.scrollTop; });
  const moved = await p.evaluate(() => window.__moved);
  ok(Math.abs(after - scrolled) < 2, `deux rafraîchissements plus tard, la liste est restée où elle était (${scrolled} → ${after} px)`);
  ok(moved === 0, `aucune carte n’a glissé pendant ce temps (${moved} mouvement(s))`);

  // 3. Topics.
  const sidebarTopics = async () => p.$$eval('[data-tour="topics"] button', l => l.map(b => b.innerText.replace(/\s+/g, ' ').trim()).filter(s => s && !s.startsWith('+')));
  const topics = await sidebarTopics();
  ok(topics.filter(s => /^perso\b/i.test(s)).length === 1, `un seul sujet « Perso » (${topics.join(' | ')})`);
  ok(topics.some(s => /^Perso 2$/.test(s)), 'il compte 2 tâches à faire, pas la terminée');
  await p.click('[data-tour="topics"] button:has-text("Perso")');
  await p.waitForSelector(`[data-topic-task="${P1.id}"]`);
  ok(!!(await p.$(`[data-topic-task="${P2.id}"]`)), 'la page du sujet montre aussi la tâche écrite « perso »');

  // 4. A task of the topic, in the side panel.
  await p.click(`[data-topic-task="${P1.id}"]`);
  await p.waitForSelector('[data-detail-panel]');
  await p.click('[data-detail-panel] [data-action="add-subtask"]');
  await p.fill('[data-detail-panel] [data-field="new-subtask"]', 'Lait');
  await p.keyboard.press('Enter');
  await p.fill('[data-detail-panel] [data-field="new-subtask"]', 'Pain');
  await p.keyboard.press('Enter');
  ok(!(await p.$('[data-task-form]')), 'ajouter une sous-tâche n’ouvre pas la fenêtre complète');
  ok(await until(async () => ((await tasks()).find(t => t.id === P1.id).subtasks || []).map(s => s.title).join() === 'Lait,Pain'), 'deux sous-tâches ajoutées depuis le panneau');
  await p.keyboard.press('Escape').catch(() => {});
  const lait = (await tasks()).find(t => t.id === P1.id).subtasks[0];
  await p.waitForSelector(`[data-detail-panel] [data-subtask-id="${lait.id}"]`);
  await p.click(`[data-detail-panel] [data-subtask-id="${lait.id}"] > div`);
  await p.fill(`[data-subtask-id="${lait.id}"] [data-field="subtask-title"]`, 'Lait d’avoine');
  await p.fill(`[data-subtask-id="${lait.id}"] [data-field="subtask-notes"]`, 'Celui sans sucre');
  await p.click('[data-detail-panel]', { position: { x: 20, y: 20 } });   // leave the fields
  ok(!(await p.$('[data-task-form]')), 'modifier une sous-tâche n’ouvre pas la fenêtre complète');
  ok(await until(async () => { const s = (await tasks()).find(t => t.id === P1.id).subtasks[0]; return s.title === 'Lait d’avoine' && s.notes === 'Celui sans sucre'; }), 'titre et notes de la sous-tâche enregistrés');
  await wait(5500);   // one refresh: what is typed is not overwritten
  ok(await p.$eval(`[data-subtask-id="${lait.id}"] [data-field="subtask-notes"]`, el => el.value) === 'Celui sans sucre', 'le rafraîchissement n’efface pas les champs ouverts');
  await p.keyboard.press('Escape');
  await p.waitForSelector('[data-detail-panel]', { state: 'detached' }).catch(() => {});

  // Rename (merge) and remove.
  await mk('Rendez-vous', { tags: ['Maison'] });
  await p.click('[data-action="rename-topic"]');
  await p.fill('[data-field="topic-name"]', 'maison');
  await p.keyboard.press('Enter');
  ok(await until(async () => (await tasks()).filter(t => (t.tags || []).includes('Maison')).length === 4), 'renommé « maison » : fusionné avec le sujet « Maison » existant, 4 tâches');
  ok(await until(async () => !(await tasks()).some(t => (t.tags || []).some(x => /^perso$/i.test(x)))), 'plus aucune tâche ne porte « Perso »');
  ok(await until(async () => /Maison/.test(await p.$eval('main h1', el => el.textContent))), 'la page suit le nouveau nom');
  await p.click('[data-action="remove-topic"]');
  await p.click('[data-action="remove-topic-confirm"]');
  ok(await until(async () => !(await tasks()).some(t => (t.tags || []).includes('Maison'))), 'sujet retiré de toutes ses tâches');
  ok((await tasks()).some(t => t.id === P1.id) && (await tasks()).some(t => t.id === P3.id), '… et les tâches sont toujours là');
  ok(await until(async () => !(await sidebarTopics()).some(s => /^Maison/.test(s))), 'il a quitté la barre latérale');

  // 5. Suggestions: one at a time, mode chosen in Settings.
  const H = await mk('Refaire le site', { difficulty: 5, estimatedDuration: 240 });
  const L = await Promise.all(['Logo', 'Texte', 'Photos'].map(n => mk(n, { difficulty: 1 })));
  await call(`/tasks/${H.id}`, { method: 'PUT', body: JSON.stringify({ links: L.map(x => ({ to: x.id, type: 'blocks', strength: 'hard' })) }) });
  await p.click('[data-tour="nav-inbox"]');
  await p.waitForSelector(`[data-task-id="${H.id}"]`);
  await p.click(`[data-task-id="${H.id}"] span[style*="cursor"]`).catch(() => p.click(`[data-task-id="${H.id}"]`));
  await p.waitForSelector('[data-detail-panel]');
  const shown = await p.$$eval('[data-detail-panel] [data-suggestion]', l => l.length);
  ok(shown <= 1, `au plus une suggestion à la fois (${shown})`);
  await p.keyboard.press('Escape');
  await p.click('[data-tour="settings"]');
  await p.click('[data-tour="settings-suggestions"]');
  await p.waitForSelector('[data-mode="daily"]');
  ok(await p.$eval('[data-mode="daily"]', b => b.getAttribute('aria-checked')) === 'true', 'par défaut : une suggestion par jour');
  await p.click('[data-mode="onRequest"]');
  ok(await until(async () => (await call('/suggestions/status')).body?.preferences?.suggestionMode === 'onRequest'), 'le mode « sur demande » se choisit et s’enregistre');
  await p.click('[data-mode="daily"]');

  ok(errors.length === 0, `aucune erreur dans la page${errors.length ? ' : ' + errors.join(' | ') : ''}`);
  await browser.close();
  console.log(bad ? `\n${bad} écart(s).` : '\nTout est vert.');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
