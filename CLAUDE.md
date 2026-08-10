# Clarity — AI Task Manager

Windows-first Electron + React task manager with a local AI backend. The app lives in `clarity/`.

**All development is on branch `claude/project-organization-app-wYkaf`** — check that out before making any changes.

## How to run

```bash
# From clarity/
npm run setup      # first time only — installs deps, builds frontend, generates icons
npm start          # launches Electron app

# During development (hot-reload)
cd frontend && npm run dev     # Vite dev server on :5173
cd backend  && node server.js  # Express API on :3001
```

Or on Windows: double-click `start.bat`.

## Architecture

```
clarity/
  frontend/   React (Vite) — src/App.jsx is the root
  backend/    Express — server.js is the single entry point
  electron/   Electron shell — preload.js + main.js
```

### Frontend

- **Theme system**: `useTheme()` → `T` object from `ThemeContext.jsx`. All colours come from `T.*` tokens — never hardcode colours. Key tokens: `T.ink`, `T.paper`, `T.paperSubtle`, `T.paperMuted`, `T.hairline`, `T.hairlineSoft`, `T.accent`, `T.accentSoft`, `T.accentInk`, `T.danger`, `T.dangerSoft`, `T.dangerBorder`, `T.done`, `T.warn`, `T.ink20/40/60/80`, `T.fontUI`, `T.fontMono`, `T.r6/r10/r14/rPill`.
- **API base**: `const API = 'http://localhost:3001/api'` — declared independently in each file (pre-existing pattern, do not consolidate).
- **localStorage keys**: `clarity-theme`, `clarity-accent`, `clarity-density`, `clarity-font`, `clarity-shortcuts`, `clarity-tutorialSeen`, `clarity-onboarding-done`, `clarity-userName`, `sidebar-collapsed`.
- **Views**: FocusView (home), TasksView, CalendarView, WeeklySummaryView, ArchiveView, HistoryView, GraphView, SettingsView.
- **Modals/overlays**: QuickCapture, TaskForm, TaskDetailPanel, ChatPanel, FocusMode, SchedulingPopover, ContextMenu, TutorialOverlay, OnboardingView.

### Backend (`backend/server.js`)

Single Express file. All routes, business logic, AI calls, and file I/O live here.

- **Data file**: `DATA_DIR/tasks.json` (default: `backend/data/tasks.json`). Readable via `readData()`, writable via `saveData(data)`.
- **Settings file**: `DATA_DIR/settings.json`. `readSettings()` merges with `DEFAULT_SETTINGS`.
- **Backups**: `DATA_DIR/backups/tasks-YYYY-MM-DD.json`, last 7 kept.
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

- **Active branch**: `claude/project-organization-app-wYkaf` — all Clarity work lives here
- **Remote**: `princeraph/Personal-Work`
- **Author**: `git config user.email noreply@anthropic.com && git config user.name Claude`
- When pushing: `git push -u origin claude/project-organization-app-wYkaf`
- `main` has only the initial commit — do not push Clarity work there
