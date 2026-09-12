# Clarity — AI Task Manager

Windows-first Electron + React task manager with a local AI backend. The app lives in `projet-clarity/app/`.

This file documents **Clarity only** — the repo hosts several unrelated projects, one per `projet-*` folder. See the repo-root `README.md` for the map.

## How to run

```bash
# From projet-clarity/app/
npm run setup      # first time only — installs deps, builds frontend, generates icons
npm start          # launches Electron app

# During development (hot-reload)
cd frontend && npm run dev     # Vite dev server on :5173
cd backend  && node server.js  # Express API on :3001
```

Or on Windows: double-click `start.bat`.

## Architecture

```
projet-clarity/app/
  frontend/   React (Vite) — src/main.jsx is the entry, src/App.jsx the main root
  backend/    Express — server.js is the single entry point
  electron/   Electron shell — preload.js + main.js
```

### Two windows, one bundle

Electron opens **two** windows off the same Vite build:

- **Main window** — `mainWindow.loadFile(getFrontendPath())`, renders `<App />`.
- **Tray popup** — a 336×420 frameless, transparent, always-on-top window loaded
  with `{ hash: 'tray' }`. `main.jsx` reads that hash
  (`window.location.hash === '#tray'`) and renders `<TrayMenu />` instead of
  `<App />`.

**Single instance** (`electron/main.js`): the whole startup path sits behind
`app.requestSingleInstanceLock()`. Two copies meant two backends writing the same
`tasks.json`, each blind to the other's writes; a second launch now focuses the
first window instead. **Navigation is locked** on both windows via
`lockNavigation()` — `will-navigate` is refused and `setWindowOpenHandler`
denies, with `http(s)` URLs handed to the system browser. Either window
navigating away would run foreign content in a renderer holding the preload bridge.

Tray behaviour (`electron/main.js`): the main window's close button **hides**
rather than quits while a tray exists (Win11 convention — app state is
preserved); a real quit goes through the tray menu and the `quittingForReal`
flag. The popup hides on `blur`, and `positionTrayWindow()` anchors it to the
tray icon, clamped inside the work area with an 8px gutter, flipping above or
below the taskbar depending on which half of the screen the icon sits in.

### Frontend

- **Theme system**: `useTheme()` → `T` object from `ThemeContext.jsx`. All colours come from `T.*` tokens — never hardcode colours. Key tokens: `T.ink`, `T.paper`, `T.paperSubtle`, `T.paperMuted`, `T.hairline`, `T.hairlineSoft`, `T.accent`, `T.accentSoft`, `T.accentInk`, `T.danger`, `T.dangerSoft`, `T.dangerBorder`, `T.done`, `T.warn`, `T.ink20/40/60/80`, `T.fontUI`, `T.fontMono`, `T.r6/r10/r14/rPill`.
- **API base**: `const API = 'http://localhost:3001/api'` — declared independently in each file (pre-existing pattern, do not consolidate).
- **localStorage keys**: `clarity-theme`, `clarity-accent`, `clarity-density`, `clarity-font`, `clarity-shortcuts`, `clarity-tutorialSeen`, `clarity-onboarding-done`, `clarity-userName`, `sidebar-collapsed`.
- **Views**: FocusView (home), TasksView, CalendarView, WeeklySummaryView, ArchiveView, HistoryView, GraphView, **PatternsView**, TopicDetailView, SettingsView. `PatternsView` (`view === 'patterns'`) renders the profile's observed layer from `GET /api/profile` — **no model is involved**, and a metric whose `enough` is false is shown as a sample count, never as a conclusion. Selected by the `view` state string in `App.jsx` — `TopicDetailView` is `view === 'topic-detail'` and reads the topic from `activeArea`.
- **Modals/overlays**: SearchCapture, TaskForm, TaskDetailPanel, ChatPanel, FocusMode, SchedulingPopover, ContextMenu, TutorialOverlay, OnboardingView.
- **SearchCapture** is the command palette, and it both **creates and finds**. `parseInput()` strips `#tag`, a `for 2h` / `~30m` duration and natural-language dates off the title; the same overlay searches existing tasks, navigates views (`onNavigate`) and opens the chat (`onOpenChat`). It replaced the older capture-only `QuickCapture`, which no longer exists.
- **TrayMenu** renders in the tray popup only, never inside `<App />`. It carries its **own always-dark palette** (a local `C` object, not `T`) because the popup sits against the Windows taskbar whatever the app theme is — it is the one deliberate exception to the "all colours from `T`" rule.

### Backend (`backend/server.js`)

Single Express file. All routes, business logic, AI calls, and file I/O live here.

- **Bound to loopback**: `app.listen(PORT, BIND_HOST)` with `BIND_HOST = process.env.CLARITY_BIND || '127.0.0.1'`. The API has **no authentication of any kind**, so binding every interface put the whole task store on the local network. Override only for the documented ngrok flow — which forwards from this machine and therefore works against `127.0.0.1` anyway.
- **CORS allowlist**, not `*`: the Vite dev origins plus requests with **no `Origin` header** — which is what the packaged Electron renderer sends (verified: a `file://` page omits the header rather than sending `Origin: null`). An explicit `null` origin — a sandboxed iframe or `data:` URL — gets a 403.
- **Error middleware** honours `err.status`, defaulting to 500. On an open SSE stream it writes an error frame and ends instead of trying to set a status.
- **Data file**: `DATA_DIR/tasks.json` (default: `backend/data/tasks.json`). Readable via `readData()`, writable via `saveData(data)`. `readData()` distinguishes *missing* from *unparseable*: a corrupt file is moved aside as `tasks.corrupt-<ts>.json` and the newest parseable backup is restored, so a bad file can never be silently replaced by an empty store. `saveData()` writes through a temp file and renames, and refuses a payload with no `tasks` array.
- **Settings file**: `DATA_DIR/settings.json`. `readSettings()` merges with `DEFAULT_SETTINGS`.
- **Backups**: `DATA_DIR/backups/tasks-YYYY-MM-DD.json` **and** `profile-YYYY-MM-DD.json`, last 7 kept **per series** — one shared list would let a run of task backups evict every profile backup. Runs at startup and hourly.
- **Profile store** (`src/profile/`): `DATA_DIR/profile.json` + `DATA_DIR/journal.jsonl`, via `createProfileStore({ dataDir })`. Kept **out of `tasks.json` on purpose** — `DELETE /api/tasks/all` wipes the task store, and clearing a to-do list must not erase the user model. `profile.observed` is recomputable from tasks; `profile.understanding` is not, which is why the profile is backed up.
- **`src/profile/metrics.js` is pure** — no I/O, no model, no randomness — so it is unit-tested (`tests/metrics.test.js`). It is the **only** writer of `observed`; the model must never write that layer. Every metric carries `samples` and `enough`, and **a metric below `MIN_SAMPLES` is not a finding** — callers must not present a conclusion the sample size does not support.
- **`src/profile/brief.js` is the ONLY place an outbound prompt is composed.** `buildOutboundContext()` decides what may cross the device boundary; nothing else may reach for the journal, an insight's `evidence`, or a transcript when assembling a prompt. A local provider (`providerType === 'ollama'`) never leaves the machine, so it receives the fuller context; every other provider gets a derived brief capped at `DEFAULT_BRIEF_BUDGET` characters. The brief is **generated deterministically, not by a model**, so the description of the user cannot drift or embellish.
- **`GET /api/context/preview`** returns exactly what would be sent, as `parts` (included) and `withheld` (refused, with reasons). The Privacy pane in Settings renders it. A privacy claim that cannot be inspected is just a sentence.
- **Chat is persisted** to the journal as `exchange` entries and restored via `GET /api/chat/history`. It used to live only in React state and vanish with the panel. History is served locally and **never replayed to a cloud provider** — only the current exchange is sent.
- **`currentProfile()`** lazily computes the observed layer if it has never been built, so a fresh install does not send an empty brief while the history to derive it from sits on disk.
- **`src/profile/insights.js` — the understanding layer**, and the three rules it enforces in code rather than by convention: (1) **an insight with no citable `evidence` is refused** by `validateInsight`, so the assistant can never assert something it cannot show the basis for; (2) **a `user-rejected` insight is kept, never deleted**, and its `key` is blocked forever — `mergeInsights` will not re-derive a conclusion the user threw out; (3) an insight no longer supported goes **`stale`** rather than hardening into permanent truth. Derived insights are produced **deterministically from `observed`** — no model decides what is true about the user. Each carries a stable `key` so recomputing updates in place instead of duplicating.
- `POST /api/profile/insights/:id/reject` (with an optional `reason`, journalled as a `correction`) and `/confirm`. Rejected insights never reach the outbound brief — `describeUnderstanding` only passes `status === 'active'`.
- **AI providers**: `backend/src/llm/` — `OllamaProvider`, `OpenAIProvider` (also used for OpenRouter), `AnthropicProvider`. Selected via `createProvider(settings)`. All expose `ping()`, `listModels()`, `generate(prompt, opts)`, `generateJSON(prompt)`, and optionally `generateChat(system, messages, opts)`.
- **SSE streaming pattern**: all AI endpoints use `res.setHeader('Content-Type', 'text/event-stream')` and write `data: ${JSON.stringify({token})}\n\n`, then `data: ${JSON.stringify({done:true})}\n\n`, then `res.end()`. Errors write `data: ${JSON.stringify({error: msg})}\n\n`.

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

- **TOCTOU on AI writes**: after streaming completes, always call `const fresh = readData()` before writing subtasks/summaries — never use the data object captured before streaming began.
- **Date arithmetic**: use local date (not UTC) — `new Date()` then read `.getFullYear()/.getMonth()/.getDate()`. Never `new Date().toISOString().slice(0,10)` for today.
- **Toast deduplication**: `setToast(prev => prev?.message === message && prev?.type === type && !action ? prev : { message, type, action, actionLabel })` — prevents animation restart on rapid identical calls.
- **handleStatusChange** in App.jsx: wraps fetch in try/catch, shows toast on failure, rethrows. Returns `fresh` data from `loadData()`. Callers should catch if they need to recover.
- **loadData** in App.jsx: returns `fresh` (the API response) so callers can use it immediately without waiting for React state to update.
- **FocusMode key**: always render `<FocusMode key={liveTask.id} ...>` so timer state resets when the active task changes.
- **renderMarkdown** (WeeklySummaryView): uses function replacers `(_, g) => \`...\${g}...\`` — never string replacement patterns like `'$1'`, which JS interprets and breaks if AI output contains `$1`/`$&`.
- **One bundle serves both windows**: anything added to `main.jsx` — a provider, a global listener, an import with side effects — also runs inside the tray popup. Keep window-specific work behind the `isTray` branch, and remember that a heavy import added there is paid twice.
- **`dist/` is versioned on purpose** and Electron loads it at runtime (`getFrontendPath()`), so the app runs from a bare clone with no build step. After changing anything under `frontend/src/`, run `npm run build` in `frontend/` and commit the rebuilt `dist/` in the same commit — otherwise the app keeps shipping the old code while the source looks correct.

## Calendar integration

Place a `.ics` file at `DATA_DIR/calendar.ics`. The `GET /api/calendar/today` endpoint parses `VEVENT` blocks and returns today's events as `{ type: 'meeting', label, start, end }` (start/end in decimal hours). Used by `FocusView` for the `TimeBlockingStrip`.

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

Tasks get `aiData` merged in `rankedTasks` (App.jsx) and are sorted by `aiData.priority`.

## Git

- **Remote**: `princeraph/Personal-Work`
- **Production branch**: `main` — Clarity now lives there, under `projet-clarity/app/`
- **Author**: `git config user.email noreply@anthropic.com && git config user.name Claude`
- Work on a `claude/*` branch, then merge into `main`
- Scope commits to `projet-clarity/` — the repo hosts other, unrelated projects
