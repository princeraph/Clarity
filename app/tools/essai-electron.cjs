#!/usr/bin/env node
// Clarity in its REAL Electron window (tâche 3, 29 October 2026). Every other
// test drives the page in Chromium or calls the backend; the window itself —
// preload, key, CSP under file://, the system notification, a mouse drag —
// had never been opened by anything but a person. This launches `electron .`
// as `npm start` does, with its own backend, in a throwaway data folder.
//   1. The window: page from file://, preload bridge, no Node in the page.
//   2. The key: the window has it, its own calls pass; without it, 401.
//   3. CSP: present, an injected script is refused, nothing else is.
//   4. Navigation locked: the window stays on Clarity.
//   5. A reminder due: a system notification; clicking it opens the task.
//      One missed while Clarity was closed comes back as its own card.
//   6. A drag with the mouse puts a task first, and the rank is saved.
//
// Run by the CI (job `controles`, under xvfb; on Linux without the sandbox,
// which Ubuntu 24.04's runners refuse to an unprivileged Electron). By hand, from app/:
//   npx install-electron   (once)
//   xvfb-run -a node tools/essai-electron.cjs     (Linux without a screen)
//   node tools/essai-electron.cjs                 (Windows, macOS)

const path = require('path');
const fs = require('fs');
const os = require('os');
let pw;
// playwright or playwright-core, local (the CI installs it without saving) or
// global (this session's machine). Only the Electron launcher is used: no
// browser to download.
for (const name of ['playwright', 'playwright-core']) { try { pw = require(name); break; } catch { /* next */ } }
if (!pw) pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));

const APP = path.join(__dirname, '..');
const API = 'http://127.0.0.1:3001/api';
let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK   ' : 'ÉCART'} ${msg}`); if (!cond) bad++; };
const until = async (fn, ms = 8000) => { for (let k = 0; k < ms / 100; k++) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
const pad = (n) => String(n).padStart(2, '0');
const localStamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

(async () => {
  // userData follows XDG_CONFIG_HOME on Linux, APPDATA on Windows: a fresh
  // folder, so the test neither reads nor touches a real Clarity's tasks.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clarity-electron-'));
  const env = { ...process.env, XDG_CONFIG_HOME: home, APPDATA: home, ELECTRON_ENABLE_LOGGING: '0' };
  delete env.CLARITY_API_TOKEN;   // the key must be the one Electron draws
  const app = await pw._electron.launch({ executablePath: require(path.join(APP, 'node_modules', 'electron')), args: process.platform === 'linux' ? [APP, '--no-sandbox'] : [APP], cwd: APP, env });
  const errors = [], cspHits = [];
  const main = async () => {
    for (let k = 0; k < 100; k++) {
      const w = app.windows().find(x => /index\.html$/.test(x.url()));
      if (w) return w;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('no main window');
  };
  const win = await main();
  win.on('pageerror', e => errors.push(String(e)));
  win.on('console', m => { if (/Content Security Policy/i.test(m.text())) cspHits.push(m.text()); });

  // Notifications and links leaving the app are recorded, not shown: a CI
  // runner has no notification daemon and no browser.
  await app.evaluate(({ Notification, shell }) => {
    global.__notes = []; global.__opened = [];
    Notification.isSupported = () => true;
    Notification.prototype.show = function () { global.__notes.push(this); };
    shell.openExternal = async (url) => { global.__opened.push(url); };
  });

  // 1. The window.
  await win.waitForLoadState('domcontentloaded');
  ok(win.url().startsWith('file://'), `la page vient du disque (${win.url().slice(0, 40)}…)`);
  const page = await win.evaluate(() => ({ bridge: typeof window.clarity, node: typeof window.require, proc: typeof window.process }));
  ok(page.bridge === 'object', 'le pont du preload est là (window.clarity)');
  ok(page.node === 'undefined' && page.proc === 'undefined', 'aucun accès à Node depuis la page');

  // 2. The key.
  const key = await win.evaluate(() => window.clarity.apiToken);
  ok(/^[0-9a-f]{64}$/.test(key), 'la fenêtre a reçu une clé tirée au hasard');
  ok((await fetch(`${API}/tasks`)).status === 401, 'sans la clé, l\'API répond 401');
  const call = async (p, opts = {}) => { const r = await fetch(API + p, { ...opts, headers: { 'Content-Type': 'application/json', 'X-Clarity-Token': key } }); return { status: r.status, body: await r.json().catch(() => null) }; };
  ok((await call('/tasks')).status === 200, 'avec la clé de la fenêtre, 200');
  const fromPage = await win.evaluate(async () => (await fetch('http://localhost:3001/api/tasks')).status);
  ok(fromPage === 200, `la page elle-même passe (${fromPage}) : elle joint la clé à chaque appel`);

  // Tasks, then the window as a returning user sees it.
  await call('/settings', { method: 'POST', body: JSON.stringify({ onboardingComplete: true, reminders: { before: 0, morning: false, blocks: false } }) });
  const mk = async (title, extra = {}) => (await call('/tasks', { method: 'POST', body: JSON.stringify({ title, ...extra }) })).body.task;
  const A = await mk('Alpha'), B = await mk('Bêta'), C = await mk('Gamma');
  const R = await mk('Appeler la banque');
  // A reminder is set afterwards, as the detail panel does (creation does not take one).
  ok((await call(`/tasks/${R.id}`, { method: 'PUT', body: JSON.stringify({ reminder: localStamp(new Date(Date.now() - 60000)) }) })).status === 200, 'un rappel échu est posé sur une tâche');
  // Missed while Clarity was closed (tâche 4): 13 hours late.
  const M = await mk('Payer le loyer');
  await call(`/tasks/${M.id}`, { method: 'PUT', body: JSON.stringify({ reminder: localStamp(new Date(Date.now() - 13 * 3600e3)) }) });
  await win.evaluate(() => {
    localStorage.clear();
    Object.entries({ 'clarity-onboarding-done': '1', 'clarity-tutorialSeen': '1', 'clarity-locale': 'fr', 'clarity-lastSeenVersion': '9.9.9' }).forEach(([k, v]) => localStorage.setItem(k, v));
  });
  await win.reload();
  await win.waitForLoadState('domcontentloaded');

  // 3. CSP.
  const csp = await win.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '');
  ok(/script-src 'self'/.test(csp) && /object-src 'none'/.test(csp), 'la CSP est dans la page chargée');
  const inline = await win.evaluate(() => new Promise(res => {
    let refused = false;
    document.addEventListener('securitypolicyviolation', () => { refused = true; }, { once: true });
    const s = document.createElement('script'); s.textContent = 'window.__ran = 1'; document.head.appendChild(s);
    setTimeout(() => res({ refused, ran: !!window.__ran }), 300);
  }));
  ok(inline.refused && !inline.ran, 'un script injecté est refusé par la CSP');

  // 5. The reminder (the window looks once the tasks are there).
  const seen = await until(async () => (await app.evaluate(() => global.__notes.length)) > 0);
  ok(seen, 'le rappel échu donne une notification système');
  ok(await until(async () => (await app.evaluate(() => global.__notes.length)) >= 2), 'deux notifications : le rappel du moment, et les rappels manqués');
  const notes = await app.evaluate(() => global.__notes.map(n => ({ title: n.title, body: n.body })));
  const k = notes.findIndex(n => /Appeler la banque/.test(n.body));
  const note = notes[k] || {};
  ok(notes.some(n => /Payer le loyer/.test(n.body) && !/Appeler/.test(n.body)), `le rappel manqué revient, à part (${notes.map(n => n.body).join(' | ')})`);
  ok(await until(async () => /Payer le loyer/.test(await win.$eval('[data-reminder-card="missed"]', el => el.textContent).catch(() => ''))), '… avec sa carte dans la fenêtre');
  ok(/Appeler la banque/.test(note.body), `… qui nomme la tâche (« ${note.title} » — « ${note.body} »)`);
  await app.evaluate((_electron, i) => global.__notes[i].emit('click'), k);
  ok(await until(async () => /Appeler la banque/.test(await win.$eval('[data-task-window] [data-field="title"]', el => el.value).catch(() => ''))), 'cliquer la notification ouvre la tâche dans la fenêtre');
  await win.keyboard.press('Escape');

  // 6. A drag with the mouse, in the real window.
  await win.click('[data-tour="nav-inbox"]');
  await win.waitForSelector(`[data-sortable="tasks"] [data-sort-id="${C.id}"]`);
  const order = () => win.$$eval('[data-sortable="tasks"] [data-sort-id]', l => l.map(x => x.dataset.sortId));
  const before = await order();
  const top = before[0];
  const a = await win.$eval(`[data-sortable="tasks"] [data-sort-id="${C.id}"]`, el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width * 0.6, y: r.y + r.height / 2 }; });
  const b = await win.$eval(`[data-sortable="tasks"] [data-sort-id="${top}"]`, el => el.getBoundingClientRect().top);
  await win.mouse.move(a.x, a.y); await win.mouse.down();
  await win.mouse.move(a.x, a.y - 10, { steps: 3 });
  await win.mouse.move(a.x, b + 4, { steps: 10 });
  await win.mouse.up();
  ok(await until(async () => (await order())[0] === C.id), 'glisser Gamma en haut : la liste suit');
  ok(await until(async () => { const ts = (await call('/tasks')).body.tasks; const g = ts.find(t => t.id === C.id); return g.rank != null && ts.filter(t => t.rank != null).every(t => t.id === C.id || t.rank > g.rank); }), 'le rang est enregistré par le serveur');

  // 4. Navigation locked (last: a failure here must not hide the others).
  await win.evaluate(() => { location.href = 'https://example.com/'; });
  await new Promise(r => setTimeout(r, 800));
  ok(win.url().startsWith('file://'), 'la fenêtre refuse de quitter Clarity');
  ok((await app.evaluate(() => global.__opened)).includes('https://example.com/'), '… et confie le lien au navigateur du système');

  ok(cspHits.length === 1, `la CSP n'a refusé que le script injecté (${cspHits.length})`);
  ok(errors.length === 0, `aucune erreur dans la page${errors.length ? ' : ' + errors.join(' | ') : ''}`);
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
  fs.rmSync(home, { recursive: true, force: true });
  console.log(bad ? `\n${bad} écart(s).` : '\nTout est vert.');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
