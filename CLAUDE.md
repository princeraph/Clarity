# Clarity — AI Task Manager

Windows-first Electron + React task manager, local AI backend. App in `app/`.

Repo holds **Clarity only** — extracted from multi-project repo, file used to say so. `README.md` = entry point for reader, `CONTRIBUTING.md` = contributor rules, `JOURNAL.md` = record of what done and measured.

## How to run

```bash
# From app/
npm run setup      # first time only — installs dependencies and Electron's binary, nothing else
npm start          # launches Electron app

# During development (hot-reload)
cd frontend && npm run dev     # Vite dev server on :5173
cd backend  && node server.js  # Express API on :3001
```

Or on Windows: double-click `start.bat`.

## Architecture

```
app/
  frontend/   React (Vite) — src/main.jsx is the entry, src/App.jsx the main root
  backend/    Express — server.js is the single entry point
  electron/   Electron shell — preload.js + main.js
```

### Two windows, one bundle

Electron opens **two** windows from same Vite build:

- **Main window** — `mainWindow.loadFile(getFrontendPath())`, renders `<App />`.
- **Tray popup** — 336×420 frameless, transparent, always-on-top window loaded with `{ hash: 'tray' }`. `main.jsx` reads hash (`window.location.hash === '#tray'`), renders `<TrayMenu />` not `<App />`.

**Single instance** (`electron/main.js`): whole startup path behind `app.requestSingleInstanceLock()`. Two copies = two backends writing same `tasks.json`, each blind to other's writes. Second launch now focuses first window. **Lock keyed on app name, so dev app and installed app must have same name.** They did not: `package.json` had `name: "clarity"` (used by `npm start`) and only `build.productName: "Clarity"` (used by installer). Measured with both running: second copy started anyway, backend hit `EADDRINUSE`, window silently used first one's backend — until it quit. Top-level `productName: "Clarity"` gives both same name and same data folder; second launch now steps aside. (Windows and macOS data folder does not move — case-insensitive. Linux: dev data folder under `~/.config/clarity` now looked for under `Clarity`.) **Navigation locked** on both windows via `lockNavigation()` — `will-navigate` refused, `setWindowOpenHandler` denies, `http(s)` URLs go to system browser. Either window navigating away would run foreign content in renderer holding preload bridge.

Tray behaviour (`electron/main.js`): main window close button **hides**, not quits, while tray exists (Win11 convention — app state preserved). Real quit goes through tray menu and `quittingForReal` flag. Popup hides on `blur`. `positionTrayWindow()` anchors it to tray icon, clamped inside work area with 8px gutter, flips above or below taskbar depending on which half of screen icon sits.

### Frontend

- **Theme system**: `useTheme()` → `T` object from `ThemeContext.jsx`. All colours from `T.*` tokens — never hardcode colours. Key tokens: `T.ink`, `T.paper`, `T.paperSubtle`, `T.paperMuted`, `T.hairline`, `T.hairlineSoft`, `T.accent`, `T.accentSoft`, `T.accentInk`, `T.danger`, `T.dangerSoft`, `T.dangerBorder`, `T.done`, `T.warn`, `T.ink20/40/60/80`, `T.fontUI`, `T.fontMono`, `T.r6/r10/r14/rPill`.
- **API base**: `const API = 'http://localhost:3001/api'` — declared independently in each file (pre-existing pattern, do not consolidate).
- **localStorage keys**: `clarity-theme`, `clarity-accent`, `clarity-density`, `clarity-font`, `clarity-shortcuts`, `clarity-tutorialSeen`, `clarity-onboarding-done`, `clarity-userName`, `sidebar-collapsed`.
- **Views**: FocusView (home), TasksView, CalendarView, WeeklySummaryView, ArchiveView, HistoryView, GraphView, **PatternsView**, TopicDetailView, SettingsView. `PatternsView` (`view === 'patterns'`) renders profile's observed layer from `GET /api/profile` — **no model involved**. Metric with `enough` false shown as sample count, never as conclusion. Until estimation has enough samples, view opens on `EstimationProgress` ("2 of 5"), fed by `observed.estimation.pending`: open tasks estimated but never timed are LISTED (timer is all they need); tasks timed but never estimated only COUNTED — estimate written after time logged would bias every ratio toward 1, so UI never asks. Selected by `view` state string in `App.jsx` — `TopicDetailView` is `view === 'topic-detail'`, reads topic from `activeArea`.
- **Langue : `contexts/LocaleContext.jsx` + `src/locales/{en,fr}.js`.** `useLocale()` → `{ t, locale, setLocale, fmtDate, fmtDateTime, dateLocale }`. **Sélecteur de langue proposait longtemps huit langues, en implémentait aucune** : écrivait `clarity-locale` dans localStorage, rien ne relisait, bannière annonçait traductions « en cours » inexistantes. Règle : **langue proposée seulement si elle existe.** Ajouter une langue = ajouter fichier à `DICTIONARIES`, traduire clés ; `tools/verifier-locales.mjs` refuse dictionnaire auquel il manque une clé.
- **Vérificateur porte trois contrôles qu'aucune relecture ne rattrape**, tourne dans barrière de qualité : (1) toute clé utilisée existe dans **chaque** dictionnaire, jeux de clés identiques ; (2) composant appelant `t()` sans `useLocale()` dans sa portée — compile, puis jette « t is not defined » à l'écran ; (3) `t()` **niveau module**, évalué à l'import avant qu'aucun composant existe — a blanchi toute l'app une fois. Deux derniers invisibles pour Vite. **(4) texte écrit directement dans JSX** — nœud texte de deux mots ou plus, ou attribut destiné à humain (`placeholder`, `title`, `label`, `value`…) — les trois autres contrôles ne le voient pas, car jamais via `t()`. Quatorze chaînes, dont paragraphe entier de Tendances et bandeau hors ligne, restaient en anglais en français pendant que vérificateur disait « Aucun écart ». Texte dans `<code>` (commande à taper) exempté.
- **Constante de module ne porte jamais de texte, elle porte des clés** (`NAV_ITEMS`, `SECTIONS`, `DEFAULT_SHORTCUTS`, `FILTERS`, `STEPS`) — sinon libellé figé au chargement du module, ne suit pas changement de langue.
- **Identifiant interne jamais libellé traduit.** `GraphView` comparait `due === 'Overdue'` : vrai en anglais, faux ailleurs. Helpers renvoient `{ label, overdue }`, filtres gardent `id` anglais distinct de la clé affichée.
- **Dates passent par `fmtDate`/`fmtDateTime`**, jamais `toLocaleDateString('en-US', …)` : date fait partie de la langue de l'interface.
- **Modals/overlays**: SearchCapture, TaskForm, TaskDetailPanel, ChatPanel, FocusMode, SchedulingPopover, ContextMenu, TutorialOverlay, OnboardingView.
- **SearchCapture** = command palette, **creates and finds**. `parseInput()` strips `#tag`, `for 2h` / `~30m` duration, natural-language dates from title; same overlay searches existing tasks, navigates views (`onNavigate`), opens chat (`onOpenChat`). Replaced older capture-only `QuickCapture`, which no longer exists.
- **TrayMenu** renders in tray popup only, never inside `<App />`. Carries **own always-dark palette** (local `C` object, not `T`) because popup sits against Windows taskbar whatever app theme — one deliberate exception to "all colours from `T`" rule.

- **`src/lib/saisie.js` — grammaire de saisie rapide, deux langues, toujours.** `parseInput(text, now)` pure, prend `now` en argument, donc vérifiable sans attendre mardi. Vivait inline dans `SearchCapture.jsx` avec littéraux anglais (`for`, `today`, `monday`) dans interface qui traduit — utilisateur français tapait dans boîte française que seul l'anglais comprenait. Abréviations françaises de jours volontairement absentes : `mer` et `dim` sont mots ordinaires, « aller à la mer » deviendrait échéance mercredi, mot mangé. `tools/verifier-saisie.mjs` tient 23 cas dans deux langues, pièges inclus, tourne dans `qualite.json` et CI.

### Backend (`backend/server.js`)

Single Express file. All routes, business logic, AI calls, file I/O here.

- **Bound to loopback**: `app.listen(PORT, BIND_HOST)` with `BIND_HOST = process.env.CLARITY_BIND || '127.0.0.1'`. API has **no authentication**, so binding every interface put whole task store on local network. No supported reason to override: ngrok flow in `app/README.md` is for reaching **remote Ollama** (outbound); earlier version tunnelling port 3001 itself removed — see below.
- **CORS allowlist**, not `*`: Vite dev origins plus requests with **no `Origin` header** — what packaged Electron renderer sends (verified: `file://` page omits header, not `Origin: null`). Explicit `null` origin — sandboxed iframe or `data:` URL — gets 403.
- **Secrets encrypted at rest** (`src/security/secrets.js`): `apiKey` and `tunnelSecret` stored in `settings.json` as `{ "enc": "…" }`, encrypted by Electron `safeStorage` (DPAPI on Windows, Keychain on macOS). Backend cannot call `safeStorage` — runs as child process in plain-Node mode — so asks main process over child-process IPC channel (`stdio: [..., 'ipc']`, `answerSecretRequest` in `electron/main.js`). Plain values live only in memory; `readSettings()` returns them, nothing reads file raw except via `readRawSettings()`. Plain-text secret from older version encrypted on first start. Under plain `node server.js` no channel: secrets stored as before, encrypted one left untouched, never erased. On Linux without keyring Electron fallback is publicly known key; `canEncrypt()` reports unavailable instead of pretending. If encryption fails on save, route answers 500 — never falls back to writing key in clear. DPAPI path only provable on Windows: `windows` CI job migrates old plain-text key, saves new one, checks `settings.json` holds no trace of either, restarts installed app to read back. **Lesson:** `safeStorage` does not call DPAPI per secret — encrypts with key Chromium generates at app's first launch, protects with DPAPI, writes to `Local State` about ten seconds later. Killed before that write, app loses key and every secret encrypted with it (measured: read back empty; with 15 s wait, fine). Once Clarity has run once, key on disk, immediate kill harmless — CI proves exactly that. One remaining window: brand-new install killed in first seconds while secret being saved; secret reads empty, entered again. Never delete `Local State`: holds the key.
- **Host allowlist, before CORS** (`src/security/host.js`): only `127.0.0.1:3001`, `localhost:3001`, `[::1]:3001`. Loopback + CORS did **not** stop web page: with DNS rebinding, hostile domain re-points to 127.0.0.1, requests become same-origin, same-origin GET sends no `Origin` — CORS rule lets through. Measured before fix: `Host: evil.example:3001` → 200, task store readable. After: 403. List has **no extension point on purpose** — first draft read extra hosts from env var "for ngrok", would only invite exposing API.
- **Error middleware** honours `err.status`, default 500. On open SSE stream writes error frame and ends instead of setting status.
- **Data file**: `DATA_DIR/tasks.json` (default: `backend/data/tasks.json`). Read via `readData()`, write via `saveData(data)`. `readData()` distinguishes *missing* from *unparseable*: corrupt file moved aside as `tasks.corrupt-<ts>.json`, newest parseable backup restored, so bad file never silently replaced by empty store. `saveData()` writes via temp file and rename, refuses payload with no `tasks` array.
- **Settings file**: `DATA_DIR/settings.json`. `readSettings()` merges with `DEFAULT_SETTINGS`.
- **Backups**: `DATA_DIR/backups/tasks-YYYY-MM-DD.json` **and** `profile-YYYY-MM-DD.json`, last 7 kept **per series** — one shared list would let run of task backups evict every profile backup. Runs at startup and hourly.
- **Profile store** (`src/profile/`): `DATA_DIR/profile.json` + `DATA_DIR/journal.jsonl`, via `createProfileStore({ dataDir })`. Kept **out of `tasks.json` on purpose** — `DELETE /api/tasks/all` wipes task store, clearing to-do list must not erase user model. `profile.observed` recomputable from tasks; `profile.understanding` not, hence profile backed up.
- **`observed` cached in `profile.json`, version-stamped.** `computeObserved` writes `version: OBSERVED_VERSION`, `currentProfile()` recomputes on mismatch. **Bump `OBSERVED_VERSION` whenever meaning of anything under `observed` changes** — otherwise cache from old algorithm served forever, waiting never corrects. Recompute used to happen only when layer missing entirely.
- **`src/profile/metrics.js` pure** — no I/O, no model, no randomness — so unit-tested (`tests/metrics.test.js`). **Only** writer of `observed`; model must never write that layer. Every metric carries `samples` and `enough`, **metric below `MIN_SAMPLES` not a finding** — callers must not present conclusion sample size does not support.
- **`src/profile/brief.js` is ONLY place outbound prompt composed.** `buildOutboundContext()` decides what may cross device boundary; nothing else may reach for journal, insight's `evidence`, or transcript when assembling prompt. Local provider (`providerType === 'ollama'`) never leaves machine, gets fuller context; every other provider gets derived brief capped at `DEFAULT_BRIEF_BUDGET` characters. Brief **generated deterministically, not by model**, so description of user cannot drift or embellish.
- **`GET /api/context/preview`** returns exactly what would be sent, as `parts` (included) and `withheld` (refused, with reasons). Privacy pane in Settings renders it. Privacy claim that cannot be inspected is just a sentence.
- **`GET /api/backups/:name`** serves one backup for download. Name matched against `/^(tasks|profile)-\d{4}-\d{2}-\d{2}\.json$/` before joined to `BACKUPS_DIR` — never joined from raw input, or crafted name walks out of directory.
- **`POST /api/reset`** real factory reset: deletes `tasks.json`, `settings.json`, `profile.json`, `journal.jsonl`, **deliberately keeps `backups/`** so reset survivable. Settings button used to ask "All data will be lost?" then merely reload window, deleting nothing — destructive-looking control that was pure theatre. Wording now matches what it does, backups included.
- **Chat persisted** to journal as `exchange` entries, restored via `GET /api/chat/history`. Used to live only in React state, vanished with panel. History served locally, **never replayed to cloud provider** — only current exchange sent.
- **`currentProfile()`** lazily computes observed layer if never built, so fresh install does not send empty brief while history to derive from sits on disk.
- **`src/profile/insights.js` — understanding layer**, three rules enforced in code not convention: (1) **insight with no citable `evidence` refused** by `validateInsight`, so assistant never asserts what it cannot show basis for; (2) **`user-rejected` insight kept, never deleted**, its `key` blocked forever — `mergeInsights` will not re-derive conclusion user threw out; (3) insight no longer supported goes **`stale`**, not hardening into permanent truth. Derived insights produced **deterministically from `observed`** — no model decides what true about user. Each carries stable `key` so recompute updates in place, no duplicates.
- **`src/profile/elicitation.js` — Stage 2b, first place a *model* proposes conclusions about person**, not arithmetic. Proposal **not** insight: request to become one, `POST /api/profile/proposals/:id/accept` **only** path across. Four gates before even shown: (1) **every citation must resolve** — task id exists, journal entry exists, metric path really present in `observed`; unresolvable ref is signature of invented one, invented evidence worse than none because looks checkable; (2) statement keyed on **normalised** form, so rewording cannot slip declined idea back; (3) confidence capped at `MAX_ELICITED_CONFIDENCE` (0.6), below anything measured layer reaches, so hunch never borrows authority of arithmetic; (4) `source` set server-side to `elicited` — proposal cannot claim to be observation. Declining stores `user-rejected` record under same key, through same list that blocks re-derived observation.
- **Accepting uses `addInsight`, never `mergeInsights`.** `mergeInsights` treats `incoming` as *complete* set of currently-derived insights, stales every stored observation missing from it — routing single accepted proposal through it would stale entire measured layer. Test exists for exactly this.
- **Elicitation runs on local model only** (`NotLocalError`, HTTP 409). Needs raw journal entries to cite, which is exactly what `GET /api/context/preview` promises never leaves machine; sending anyway and still calling it hybrid would make promise decorative. `buildElicitationPrompt` lives in `brief.js` like every outbound prompt, includes **evidence catalogue** — without it model invents plausible ids, every citation refused.
- `POST /api/profile/insights/:id/reject` (optional `reason`, journalled as `correction`) and `/confirm`. Rejected insights never reach outbound brief — `describeUnderstanding` only passes `status === 'active'`.
- **`src/threads/` — étape 3, follow-up threads.** Task says what someone meant to do; thread says why it has not happened, only part anyone can help with: `state`, `blocker` (in person's words — reported, never inferred), `needs`, `options`, `checkIns`. `logic.js` **pure** — `now` always passed in, makes scheduling testable. Stored in `DATA_DIR/threads.json`, own file for same reason as profile: `DELETE /api/tasks/all` must not erase why something never got done. Threads pruned when task goes.
- **Back-off is the design, not detail.** Unanswered check-in waits longer, not repeats — 1 day, 3, 7, 14 — and after `MAX_UNANSWERED` thread **parks itself, stops asking**. Silence is answer; system asking every morning gets muted, then helps with nothing. Answering resets backoff. `muteThread` (user said stop) distinct from parking (Clarity read room) — flag `mutedByUser` is difference.
- **`stalledTasks()` decides which tasks deserve thread at all**: repeatedly postponed, past deadline, or untouched for `STALL_DAYS`. Opening one for every task would turn to-do list into interrogation, so threads never created automatically.
- **Options may come from model without approval gate** — unlike insights. Option is suggestion about what to *do*; wrong costs a line user ignores. Belief about who they are, wrong costs their trust. `source` records which. `buildOptionsPrompt` lives in `brief.js` like every outbound prompt.
- `POST /api/tasks/:id/thread/act` one dispatcher over whitelist (`THREAD_ACTIONS`) not dozen near-identical routes; unknown action is 400, never silently ignored.
- **`src/suggest/` — étape 4, suggestions proactives.** Dur n'est pas choisir quoi dire, c'est décider s'il faut parler : assistant qui se trompe là n'est pas qu'agaçant, il se fait couper, n'aide plus. `policy.js` donc **pur**, décide seul, avant qu'un mot soit choisi. Ordre des refus, du plus spécifique au plus général : règle de silence posée par personne → mode (`onRequest`, `daily`) → nuit → budget du jour → écart minimum. Refus renvoyé porte sa raison, pour dire quel réglage a fait taire Clarity.
- **Règle de silence l'emporte sur tout, échéance dépassée incluse.** « Arrête de demander » = instruction, pas avis à mettre en balance avec jugement de Clarity. Trois formes : `duration`, `untilTaskDone`, `indefinite`. Règle `untilTaskDone` dont tâche supprimée **se lève** — sinon supprimer tâche ferait taire Clarity pour toujours, rien à l'écran pour expliquer.
- **`GET /api/suggestions/status` regarde, `POST /api/suggestions/next` parle.** Seul le second consomme budget. Structurel, pas d'ordre : client interroge en boucle, si simple coup d'œil coûtait une unité, journée se viderait pendant que Clarity reste muette. « Rien à dire » ne coûte rien non plus.
- **Garde de nuit active par défaut** (22 h → 7 h). Personne ne pense interdire alerte à 3 h du matin. Fenêtre enjambe minuit, comparaison évidente la prend à l'envers : avec `from > to`, « dedans » = `hour >= from || hour < to`.
- **`candidates.js` déclenché par arithmétique**, jamais par modèle : relance échue, échéance passée, tâche reportée trois fois. Chaque candidat porte fait déclencheur (`because`), affiché à côté de suggestion — interruption non sollicitée doit se justifier, « modèle en avait envie » ne suffit pas. Une seule interruption par tâche, à sa raison la plus forte, rien répété avant trois jours.
- **Interrupteur dans la carte**, pas enfoui dans réglages : trouvé au moment du besoin, pas quand déjà excédé.
- **AI providers**: `backend/src/llm/` — `OllamaProvider`, `OpenAIProvider` (also used for OpenRouter), `AnthropicProvider`. Selected via `createProvider(settings)`. All expose `ping()`, `listModels()`, `generate(prompt, opts)`, `generateJSON(prompt)`, optionally `generateChat(system, messages, opts)`.
- **Mesurer avant de croire.** Sur machine utilisateur modèle écrit à 66-95 jetons/s, charge en ~9 s : modèle pas lent, chargement l'est. Neuf secondes valent plus de 700 jetons écrits. Toute optimisation provoquant rechargement perd, même si raccourcit génération.
- **Vitesse modèle local = problème d'ÉCRITURE, pas lecture.** Modèle local génère ~15 jetons/s ; lire prompt dix fois moins cher que produire réponse. Analyse demandait paragraphe par tâche, attendait tout en un appel non diffusé — deux minutes à vingt tâches. Maintenant limitée à `ANALYSIS_MAX_TASKS` (12, choisies par échéance : arithmétique, jamais modèle) et une phrase par tâche. **Avant d'allonger ce qu'on demande au modèle, rappel : coût linéaire en jetons produits.**
- **`keep_alive` et `num_ctx` envoyés à chaque appel Ollama, `num_ctx` NE DOIT JAMAIS VARIER.** Sans `keep_alive`, Ollama décharge après 5 min, chaque rafale repaie chargement (~9 s mesurées). Sans `num_ctx`, prompt dépassant contexte par défaut (2048) n'échoue pas : Ollama **coupe silencieusement le début**. Mais `num_ctx` fait partie du **chargement** du modèle, pas requête : le faire varier entre appels évince modèle résident, recharge — 8 à 9 secondes constatées, sur appels mêmes qu'on voulait accélérer. D'où constante unique `NUM_CTX = 8192`, utilisée partout **préchauffage compris**, sinon premier vrai appel recharge ce que préchauffage vient de charger. `wouldTruncate()` sert à avertir, jamais redimensionner.
- **`num_predict` dimensionné par appel**, jamais constante : seule borne sur temps d'attente.
- **`backend/tools/mesurer-modele.mjs`** mesure sur machine réelle — Ollama renvoie `load_duration`, `prompt_eval_duration`, `eval_duration`, rien estimé. Lancer avant d'optimiser autre chose côté modèle.
- **SSE streaming pattern**: all AI endpoints use `res.setHeader('Content-Type', 'text/event-stream')`, write `data: ${JSON.stringify({token})}\n\n`, then `data: ${JSON.stringify({done:true})}\n\n`, then `res.end()`. Errors write `data: ${JSON.stringify({error: msg})}\n\n`.

### AI endpoints

| Route | Method | What it does |
|---|---|---|
| `POST /api/weekly-summary` | streaming SSE | Generates weekly review, saves to `data.weeklySummary` |
| `POST /api/chat` | streaming SSE | Productivity coach with task context |
| `POST /api/tasks/:id/breakdown` | streaming SSE | Breaks task into 3–6 subtasks, saves them |
| `POST /api/analyze` | async | Triggers background AI prioritisation of all active tasks |

## Task data model

```js
{
  id:                string (uuid),
  title:             string,
  description:       string,
  deadline:          'YYYY-MM-DD' | null,
  time:              'HH:MM' | null,
  estimatedDuration: number (minutes) | null,
  deliverable:       string,
  status:            'not_started' | 'in_progress' | 'done',
  notes:             string,
  tags:              string[],
  subtasks:          [{ id, title, notes, dueDate, done }],
  recurring:         'none' | 'daily' | 'weekly' | 'monthly',
  timeTracked:       number (minutes, capped per-session at 1440),
  timerStarted:      ISO string | null,
  archived:          boolean,
  archivedAt:        ISO string | null,
  history:           [{ at: ISO, type: 'created'|'status'|'deadline'|'area', from, to }] (capped at 200),
  createdAt:         ISO string,
  updatedAt:         ISO string,
}
```

### History entry types

- `created` — task first created (no from/to)
- `status` — status changed: `from: old_status, to: new_status`
- `deadline` — deadline changed: `from: old_date, to: new_date`
- `area` — first tag changed: `from: old_tag, to: new_tag`

## Key patterns and invariants

- **TOCTOU on AI writes**: after streaming completes, always `const fresh = readData()` before writing subtasks/summaries — never use data object captured before streaming began.
- **Date arithmetic**: use local date (not UTC) — `new Date()` then read `.getFullYear()/.getMonth()/.getDate()`. Never `new Date().toISOString().slice(0,10)` for today.
- **Toast deduplication**: `setToast(prev => prev?.message === message && prev?.type === type && !action ? prev : { message, type, action, actionLabel })` — prevents animation restart on rapid identical calls.
- **handleStatusChange** in App.jsx: wraps fetch in try/catch, toast on failure, rethrows. Returns `fresh` data from `loadData()`. Callers catch if need to recover.
- **loadData** in App.jsx: returns `fresh` (API response) so callers use immediately without waiting for React state.
- **FocusMode key**: always render `<FocusMode key={liveTask.id} ...>` so timer state resets when active task changes.
- **renderMarkdown** (WeeklySummaryView): uses function replacers `(_, g) => \`...\${g}...\`` — never string replacement patterns like `'$1'`, JS interprets, breaks if AI output contains `$1`/`$&`.
- **One bundle serves both windows**: anything added to `main.jsx` — provider, global listener, import with side effects — also runs inside tray popup. Keep window-specific work behind `isTray` branch; heavy import added there paid twice.
- **Electron 44, electron-builder 26, pinned exactly** (no `^`). Two consequences of jump from 28/24 easy to undo by accident:
  - Since Electron 42, `npm install` no longer downloads Electron binary; first `electron` run does. `npm run setup`, `setup.bat`, `Update.bat` call `npx install-electron` so download happens where visible — `Clarity.vbs` launches hidden, silent two-minute first start looks like broken app.
  - electron-builder 26 always drops `node_modules` folder at root of `extraResources` `from`, whatever filter says. Packaged backend lost express, cors, uuid, no error. Hence separate `{ from: ".backend-pkg/node_modules" }` entry — and `tools/verifier-empaquetage.js` (`afterPack`), inspects what will actually ship, fails build otherwise. Checking staging folder not enough: it was complete.
- **Packaged app carries own Node.** `startBackend()` spawns `process.execPath` with `ELECTRON_RUN_AS_NODE=1`, never `'node'` — that was user's system Node, absent on normal PC: empty window, nothing saved. Installer takes backend from `.backend-pkg/`, staged by `tools/preparer-backend.mjs` with production dependencies only; old `extraResources` filter excluded `node_modules`, installed backend died on `Cannot find package 'express'`. Both verified by running staged backend under Electron binary. Neither ever seen, no installer ever built. First real build then died at last step on `"publish": { "provider": "github" }` — release-publishing config with no repository to resolve, no auto-updater to use it. `"publish": null` says what true: Clarity not published from build.
- **Nothing loads from internet.** Fonts bundled (`@fontsource/geist`, `@fontsource/geist-mono`, imported in `main.jsx`). Used to come from `fonts.googleapis.com` — every launch sent user's IP to Google under first screen saying "no cloud, no spying". `tools/verifier-paquet.mjs` now fails on any resource page fetches by itself from `http(s)://` (stylesheet, font, script, image, CSS `url()`/`@import`); clickable `<a href>` stays allowed.
- **`dist/` versioned on purpose**, Electron loads at runtime (`getFrontendPath()`), so app runs from bare clone, no build step. After changing anything under `frontend/src/`, run `npm run build` in `frontend/`, commit rebuilt `dist/` in same commit — otherwise app keeps shipping old code while source looks correct.

- **Setup must never regenerate versioned artifact.** `setup.bat` and `npm run setup` install dependencies, nothing else. Used to rebuild `frontend/dist/` and re-render `build/icon.*` — both already in git, already CI-verified. Regenerating produced nothing new, dirtied tracked directory: next `git pull` refused, naming files user never touched. Install blocking next update worse than step it claims to save. Rebuilding is for someone who changed sources (`npm run build:frontend`), different act. **Same for `Update.bat`**, broken there on 2 October: ran `npm run build`, rebuilds `frontend/dist/` before packaging. Harmless until pull touched `dist/index.html` — then pull refused. Now runs `npm run package` (stage backend + electron-builder, packaging committed `dist/` as is), warns if update leaves tracked file modified. `npm run build` stays for whoever changed `frontend/src/`.

- **`dist/index.html` normalised to LF** (`app/frontend/.gitattributes`). Vite writes platform line ending — LF on Linux, CRLF on Windows — bundle byte-identical either way. Without `text eol=lf`, Windows build shows every line of that file changed. Bundles stay `-text`: minified `.js` can hold `\r` inside string, normalising would corrupt what ships. Measured, not assumed: same asset hashes, 14 of 14 lines differing.

## Calendar integration

Place `.ics` file at `DATA_DIR/calendar.ics`. `GET /api/calendar/today` parses `VEVENT` blocks, returns today's events as `{ type: 'meeting', label, start, end }` (start/end decimal hours). Used by `FocusView` for `TimeBlockingStrip`.

## AI priority data

`data.analysis` shape (written by `runAnalysis`):

```js
{
  whatToDoNext:   string,
  overallInsight: string,
  analyzedAt:     ISO string,
  taskAnalysis: [{
    id:              uuid,
    priority:        number (1 = highest),
    priorityLevel:   'high'|'medium'|'low',
    reasoning:       string,
    actionPlan:      string[],
    dependencies:    uuid[],
    relatedTasks:    uuid[],
    relationshipNote: string,
  }]
}
```

Tasks get `aiData` merged in `rankedTasks` (App.jsx), sorted by `aiData.priority`.

## Git

- **Remote**: `princeraph/clarity` — Clarity is whole repo, at root
- **Production branch**: `main`
- **Author**: `git config user.email noreply@anthropic.com && git config user.name Claude`
- Work on `claude/*` branch, merge into `main` — **only once CI green on that branch, `windows` job included.** User pulls from `main`, only other Windows machine; before this job, every Windows-only defect (`Update.bat` rebuilding `dist/`, CRLF line in `dist/index.html`) found by user, mid-update. Job replays `Update.bat` steps, installs silently, starts installed backend, rebuilds `dist/` to check byte-identical to committed one.
- Every commit must rebuild `app/frontend/dist/` when `app/frontend/src/` changes, in **same** commit — see `CONTRIBUTING.md`, rule that breaks fastest, shows least

### Minutes GitHub Actions

Repo **public**: GitHub standard runners free here, Windows included, so CI runs on every push to `main` and `claude/**`. Minutes only counted for private repos — owner's quota ran out 8 October 2026 for that reason. What still holds:

- every job has `timeout-minutes` (stuck job otherwise runs 6 h);
- `qualité` cancels superseded run on same branch (`concurrency`); `publication` never cancels (`cancel-in-progress: false`) — cut short, would leave half-uploaded release;
- no `pull_request` trigger: re-ran same commit second time;
- **if repo ever goes private again**, revisit triggers first: every minute counts, Windows twice.

### Publishing a version for testers

Testers install `Clarity-Setup.exe` from https://princeraph.github.io/clarity-releases/ and installed app updates itself from **public** repo `princeraph/clarity-releases` (installers and download page only — never source, never data). To publish:

1. Change `version` in `app/package.json`, then run `npm install
   --package-lock-only` in `app/`: `package-lock.json` repeats version, `windows` job refuses packaging that rewrites tracked file (1.3.2, 6 October). Not `npm version`: reformats whole `package.json`. `package.json` stays place version read from (Electron passes it to backend as `CLARITY_VERSION`). Rewrite `update.news` in both locales: what "Clarity is up to date" window lists after update.
2. Merge into `main` once CI green, as any change.
3. That all: when `app/package.json` changes on `main`, `publication` workflow checks whether `clarity-releases` already has that version, if not builds, publishes release with secret `CLARITY_RELEASES_TOKEN`, copies `app/release-site/` to that repo (GitHub Pages serves it). No tag to push — this session's git proxy refuses tag pushes.

Version must be higher than testers' or electron-updater ignores it.

Repo extracted from `princeraph/Personal-Work` by `git subtree split`, so history before extraction says `projet-clarity/app/` where this repo says `app/`. History real and complete; only prefix moved.