import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, copyFileSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { createProvider } from './src/llm/index.js';
import { writeJSONAtomic } from './src/storage.js';
import { createProfileStore } from './src/profile/store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3001;
const VERSION = '1.2.0';

const DATA_DIR      = process.env.CLARITY_DATA_DIR || join(__dirname, 'data');
const DATA_FILE     = join(DATA_DIR, 'tasks.json');
const SETTINGS_FILE = join(DATA_DIR, 'settings.json');
const BACKUPS_DIR   = join(DATA_DIR, 'backups');

if (!existsSync(DATA_DIR))    mkdirSync(DATA_DIR,    { recursive: true });
if (!existsSync(BACKUPS_DIR)) mkdirSync(BACKUPS_DIR, { recursive: true });

// ─── Settings ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  providerType:       'ollama',
  llmEndpoint:        'http://localhost:11434',
  ollamaModel:        'gemma4:latest',
  tunnelSecret:       '',
  apiKey:             '',
  onboardingComplete: false,
};

function readSettings() {
  if (!existsSync(SETTINGS_FILE)) return { ...DEFAULT_SETTINGS };
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(s) { writeJSONAtomic(SETTINGS_FILE, s); }
function getProvider()   { return createProvider(readSettings()); }

// ─── Task store ───────────────────────────────────────────────────────────────

const emptyStore = () => ({ tasks: [], analysis: null, weeklySummary: null });

// A store is only usable if it parses AND carries a tasks array. `{}` or a
// half-written file must never be mistaken for "no tasks yet".
const isStore = (d) => !!d && typeof d === 'object' && Array.isArray(d.tasks);

// Newest backup that actually parses — the most recent file is not necessarily
// the most recent *good* one.
function newestGoodBackup() {
  let names = [];
  try {
    names = readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('tasks-') && f.endsWith('.json'))
      .sort();
  } catch { return null; }
  for (let i = names.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(readFileSync(join(BACKUPS_DIR, names[i]), 'utf8'));
      if (isStore(parsed)) return { name: names[i], data: parsed };
    } catch { /* try the one before it */ }
  }
  return null;
}

function readData() {
  if (!existsSync(DATA_FILE)) return emptyStore();   // first run — genuinely empty
  try {
    const parsed = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    if (!isStore(parsed)) throw new Error('no tasks array');
    return parsed;
  } catch (err) {
    // Unreadable, which is NOT the same as absent. Returning an empty store here
    // used to let the next save overwrite real tasks with nothing.
    const quarantine = join(DATA_DIR, `tasks.corrupt-${Date.now()}.json`);
    try {
      renameSync(DATA_FILE, quarantine);
      console.error(`[Clarity] tasks.json unreadable (${err.message}) — kept at ${quarantine}`);
    } catch (mvErr) {
      console.error(`[Clarity] tasks.json unreadable and could not be moved aside: ${mvErr.message}`);
    }
    const backup = newestGoodBackup();
    if (backup) {
      console.error(`[Clarity] restored from backup ${backup.name} (${backup.data.tasks.length} tasks)`);
      try { writeJSONAtomic(DATA_FILE, backup.data); } catch { /* served from memory regardless */ }
      return backup.data;
    }
    console.error('[Clarity] no usable backup — starting empty; the damaged file is kept above');
    return emptyStore();
  }
}

function saveData(data) {
  if (!isStore(data)) throw new Error('refusing to save a malformed task store');
  writeJSONAtomic(DATA_FILE, data);
}

function localDateStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function runDailyBackup() {
  if (!existsSync(DATA_FILE)) return;
  try { JSON.parse(readFileSync(DATA_FILE, 'utf8')); } catch { return; }
  const stamp = localDateStamp();
  const dest  = join(BACKUPS_DIR, `tasks-${stamp}.json`);
  if (!existsSync(dest)) {
    try { copyFileSync(DATA_FILE, dest); } catch {}
  }

  // The profile rides the same rotation. Its observed layer is recomputable,
  // but `understanding` accumulates from conversation and cannot be rebuilt
  // from anything — losing it is the one unrecoverable loss in the app.
  const profileFile = join(DATA_DIR, 'profile.json');
  if (existsSync(profileFile)) {
    const pDest = join(BACKUPS_DIR, `profile-${stamp}.json`);
    let parses = true;
    try { JSON.parse(readFileSync(profileFile, 'utf8')); } catch { parses = false; }
    if (parses && !existsSync(pDest)) {
      try { copyFileSync(profileFile, pDest); } catch {}
    }
  }

  // Trim each series to its own last 7 — one shared list would let a run of
  // task backups evict every profile backup.
  for (const prefix of ['tasks-', 'profile-']) {
    try {
      const files = readdirSync(BACKUPS_DIR)
        .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
        .sort();
      files.slice(0, Math.max(0, files.length - 7)).forEach(f => {
        try { unlinkSync(join(BACKUPS_DIR, f)); } catch {}
      });
    } catch {}
  }
}

// ─── Profile store ────────────────────────────────────────────────────────────

const profileStore = createProfileStore({ dataDir: DATA_DIR });

// Recompute the observed layer whenever the task set changes. Debounced with
// the same idea as scheduleAnalysis: a burst of edits should cost one pass.
let profileDebounce = null;
function scheduleProfileRecompute(tasks) {
  if (profileDebounce) clearTimeout(profileDebounce);
  profileDebounce = setTimeout(() => {
    try { profileStore.recompute(tasks); }
    catch (err) { console.error('[Clarity] profile recompute failed:', err.message); }
  }, 1000);
}

// ─── Recurring helpers ────────────────────────────────────────────────────────

function nextDeadline(deadline, recurring) {
  if (!deadline) return null;
  const d = new Date(deadline + 'T00:00:00');
  if (recurring === 'daily')   d.setDate(d.getDate() + 1);
  if (recurring === 'weekly')  d.setDate(d.getDate() + 7);
  if (recurring === 'monthly') d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function spawnRecurringTask(data, source) {
  const task = {
    id:           uuidv4(),
    title:        source.title,
    description:  source.description  || '',
    deadline:     nextDeadline(source.deadline, source.recurring),
    deliverable:  source.deliverable  || '',
    status:       'not_started',
    notes:        source.notes        || '',
    tags:         source.tags         || [],
    subtasks:     (source.subtasks || []).map(s => ({ ...s, done: false })),
    recurring:    source.recurring,
    timeTracked:  0,
    timerStarted: null,
    archived:     false,
    archivedAt:   null,
    createdAt:    new Date().toISOString(),
    updatedAt:    new Date().toISOString(),
  };
  data.tasks.push(task);
  return task;
}

// ─── AI analysis ──────────────────────────────────────────────────────────────

let isAnalyzing = false;
let analysisError = null;
let analysisDebounce = null;

async function runAnalysis(tasks) {
  if (!tasks.length || isAnalyzing) return;
  isAnalyzing = true;
  analysisError = null;
  console.log(`[AI] Analyzing ${tasks.length} task(s)...`);

  const taskList = tasks.map((t, i) =>
    `Task ${i + 1}:\nID: ${t.id}\nTitle: ${t.title}\nDescription: ${t.description || 'N/A'}\n` +
    `Deadline: ${t.deadline || 'None'}\nDeliverable: ${t.deliverable || 'N/A'}\nStatus: ${t.status}\n` +
    `Tags: ${t.tags?.join(', ') || 'None'}\nRecurring: ${t.recurring || 'none'}\n` +
    `Subtasks: ${t.subtasks?.length ? t.subtasks.map(s => `${s.done ? '[done]' : '[todo]'} ${s.title}`).join(', ') : 'None'}\n` +
    `Notes: ${t.notes || 'N/A'}`
  ).join('\n\n');

  const prompt = `You are a productivity assistant. Analyze these ${tasks.length} task(s) and return JSON.

TASKS:
${taskList}

Return ONLY this JSON:
{
  "whatToDoNext": "One specific action to take right now and why (2 sentences)",
  "overallInsight": "One observation about this workload or task relationships (1-2 sentences)",
  "taskAnalysis": [
    {
      "id": "exact task id",
      "priority": 1,
      "priorityLevel": "high",
      "reasoning": "Why this priority (2-3 sentences)",
      "actionPlan": ["Step 1", "Step 2", "Step 3"],
      "dependencies": ["ids of tasks that must be done before this"],
      "relatedTasks": ["ids of related tasks"],
      "relationshipNote": "How tasks connect, or empty string"
    }
  ]
}

Rules: priority 1 = do first. priorityLevel = high/medium/low. Include all ${tasks.length} tasks.`;

  try {
    const provider = getProvider();
    const analysis = await provider.generateJSON(prompt);
    if (analysis?.taskAnalysis) {
      const data = readData();
      data.analysis = { ...analysis, analyzedAt: new Date().toISOString() };
      saveData(data);
      analysisError = null;
      console.log('[AI] Analysis complete.');
    }
  } catch (err) {
    console.error('[AI] Analysis failed:', err.message);
    analysisError = err.message;
  } finally {
    isAnalyzing = false;
  }
}

function scheduleAnalysis(tasks) {
  const active = tasks.filter(t => !t.archived && t.status !== 'done');
  if (analysisDebounce) clearTimeout(analysisDebounce);
  analysisDebounce = setTimeout(() => runAnalysis(active), 800);
}

// ─── Express ──────────────────────────────────────────────────────────────────

// A rejected promise used to take the whole process down with it: Node aborts on
// an unhandled rejection, so one bad request ended the session for every window.
// A local single-user app is better off logging and staying up.
process.on('unhandledRejection', (reason) => {
  console.error('[Clarity] unhandled rejection:', reason?.stack || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Clarity] uncaught exception:', err?.stack || err);
});

const app = express();

// The API has no authentication of any kind, and it is about to hold a profile
// of the person using it. `origin: '*'` let any page in any browser read the
// whole task store; the allowlist covers the two origins Clarity actually uses —
// the Electron shell (loadFile, so no Origin header) and the Vite dev server.
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173', 'http://127.0.0.1:5173',
]);
app.use(cors({
  origin(origin, cb) {
    // No Origin: same-process fetches from the packaged app, and curl. Allowed —
    // the loopback bind below is what keeps those local.
    if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    const err = new Error('Origin not allowed');
    err.status = 403;
    cb(err);
  },
}));
app.use(express.json());

// Express 4 forwards a throw from a *sync* handler to the error middleware but
// silently drops a rejected promise from an async one — hence the wrapper.
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ── Version ───────────────────────────────────────────────────────────────────

app.get('/api/version', (req, res) => res.json({ version: VERSION }));

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/api/health', asyncRoute(async (req, res) => {
  try {
    const settings = readSettings();
    const provider = getProvider();
    const connected = await provider.ping();
    const models = connected ? await provider.listModels() : [];
    res.json({
      ollama: connected,           // kept for compatibility (means "AI connected")
      model: settings.ollamaModel,
      providerType: settings.providerType,
      endpoint: settings.llmEndpoint,
      analyzing: isAnalyzing,
      availableModels: models,
      version: VERSION,
    });
  } catch {
    res.json({ ollama: false, model: '', providerType: 'ollama', endpoint: '', analyzing: isAnalyzing, availableModels: [], version: VERSION });
  }
}));

// ── Settings ──────────────────────────────────────────────────────────────────

app.get('/api/settings', (req, res) => {
  const s = readSettings();
  res.json({
    ...s,
    tunnelSecret: s.tunnelSecret ? '••••••••' : '',
    apiKey:       s.apiKey       ? '••••••••' : '',
  });
});

app.post('/api/settings', (req, res) => {
  const current = readSettings();
  const { llmEndpoint, ollamaModel, tunnelSecret, providerType, apiKey, onboardingComplete } = req.body;
  if (llmEndpoint && providerType === 'ollama') {
    try { new URL(llmEndpoint); } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
  }
  const next = {
    ...current,
    ...(providerType        !== undefined && { providerType }),
    ...(llmEndpoint         !== undefined && { llmEndpoint }),
    ...(ollamaModel         !== undefined && { ollamaModel }),
    ...(tunnelSecret        !== undefined && tunnelSecret !== '••••••••' && { tunnelSecret }),
    ...(apiKey              !== undefined && apiKey       !== '••••••••' && { apiKey }),
    ...(onboardingComplete  !== undefined && { onboardingComplete }),
  };
  saveSettings(next);
  res.json({ ok: true });
});

app.get('/api/backups', (req, res) => {
  try {
    const files = readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('tasks-') && f.endsWith('.json'))
      .sort().reverse()
      .map(f => ({ name: f, date: f.replace('tasks-', '').replace('.json', '') }));
    res.json({ backups: files });
  } catch { res.json({ backups: [] }); }
});

// ── Profile ───────────────────────────────────────────────────────────────────
//
// Local-only. Nothing here is ever composed into a prompt bound for a cloud
// provider — that path goes through the outbound-context builder, which reads a
// bounded brief rather than this route's output.

app.get('/api/profile', (req, res) => {
  const profile = profileStore.readProfile();
  // Recompute on first read so a fresh install has real numbers immediately,
  // rather than an empty panel until the next task edit.
  if (!profile.observed) {
    try { return res.json(profileStore.recompute(readData().tasks)); }
    catch (err) { console.error('[Clarity] first profile compute failed:', err.message); }
  }
  res.json(profile);
});

app.post('/api/profile/recompute', (req, res) => {
  const windowDays = Number.isFinite(req.body?.windowDays) ? req.body.windowDays : undefined;
  res.json(profileStore.recompute(readData().tasks, windowDays === undefined ? {} : { windowDays }));
});

app.get('/api/profile/journal', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  const kinds = typeof req.query.kinds === 'string' ? req.query.kinds.split(',') : null;
  res.json(profileStore.readEntries({ limit, kinds }));
});

// ── Tasks ─────────────────────────────────────────────────────────────────────

const VALID_STATUSES   = new Set(['not_started', 'in_progress', 'done']);
const VALID_RECURRINGS = new Set(['none', 'daily', 'weekly', 'monthly']);

// Shape check is not enough: 2026-13-45 matches the regex. Round-trip through a
// Date and require the fields to survive, so only real calendar days pass.
function isCalendarDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

// The only fields a client may set. Everything else on a task — timerStarted,
// timeTracked, archived, archivedAt, createdAt, id, history, updatedAt — is
// owned by the server and has its own endpoint where it can change at all.
const MUTABLE_FIELDS = [
  'title', 'description', 'deadline', 'time', 'estimatedDuration',
  'deliverable', 'status', 'notes', 'tags', 'subtasks', 'recurring',
];

function pickMutable(body) {
  const patch = {};
  for (const key of MUTABLE_FIELDS) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  if (typeof patch.title === 'string') patch.title = patch.title.trim();
  return patch;
}

// Field rules shared by create and update. The title rule is not here because
// it differs between the two: required on create, merely non-blank on update.
function validateFields(body, res) {
  // `status` is checked on presence, not truthiness. The old `if (body.status)`
  // let an explicit null through, and a null status crashes every later AI call.
  if (body.status !== undefined && !VALID_STATUSES.has(body.status))
    return res.status(400).json({ error: 'Invalid status' });
  if (body.recurring !== undefined && body.recurring !== null && !VALID_RECURRINGS.has(body.recurring))
    return res.status(400).json({ error: 'Invalid recurring value' });

  if (body.deadline !== undefined && body.deadline !== null && body.deadline !== '' && !isCalendarDate(body.deadline))
    return res.status(400).json({ error: 'Invalid date — use a real calendar day in YYYY-MM-DD' });
  if (body.time !== undefined && body.time !== null && body.time !== '' &&
      !(typeof body.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.time)))
    return res.status(400).json({ error: 'Invalid time — use HH:MM' });

  if (body.tags !== undefined && body.tags !== null &&
      !(Array.isArray(body.tags) && body.tags.every(t => typeof t === 'string')))
    return res.status(400).json({ error: 'Tags must be an array of strings' });
  if (body.subtasks !== undefined && body.subtasks !== null &&
      !(Array.isArray(body.subtasks) && body.subtasks.every(s => !!s && typeof s === 'object')))
    return res.status(400).json({ error: 'Subtasks must be an array of objects' });
  if (body.estimatedDuration !== undefined && body.estimatedDuration !== null &&
      !(typeof body.estimatedDuration === 'number' && Number.isFinite(body.estimatedDuration) && body.estimatedDuration >= 0))
    return res.status(400).json({ error: 'Estimated duration must be a positive number of minutes' });

  return null;
}

function validateCreate(body, res) {
  if (!body || typeof body !== 'object')
    return res.status(400).json({ error: 'Invalid request body' });
  if (!body.title?.trim())
    return res.status(400).json({ error: 'Title is required' });
  return validateFields(body, res);
}

// A partial update carries only what changed, so demanding a title on every call
// — as the single shared validator used to — rejected honest edits with a 400.
function validateUpdate(body, res) {
  if (!body || typeof body !== 'object')
    return res.status(400).json({ error: 'Invalid request body' });
  if (body.title !== undefined && !String(body.title ?? '').trim())
    return res.status(400).json({ error: 'Title cannot be empty' });
  return validateFields(body, res);
}

app.get('/api/tasks', (req, res) => {
  const data = readData();
  res.json({
    tasks:         data.tasks.filter(t => !t.archived),
    archivedTasks: data.tasks.filter(t =>  t.archived),
    analysis:      data.analysis,
    weeklySummary: data.weeklySummary,
    analyzing:     isAnalyzing,
    analysisError: analysisError,
  });
});

app.post('/api/tasks', (req, res) => {
  if (validateCreate(req.body, res)) return;
  const data = readData();
  const now = new Date().toISOString();
  const task = {
    id:                uuidv4(),
    title:             req.body.title?.trim()       || 'Untitled',
    description:       req.body.description?.trim() || '',
    deadline:          req.body.deadline            || null,
    time:              req.body.time                || null,
    estimatedDuration: req.body.estimatedDuration   || null,
    deliverable:       req.body.deliverable?.trim() || '',
    status:            req.body.status              || 'not_started',
    notes:             req.body.notes?.trim()       || '',
    tags:              Array.isArray(req.body.tags)     ? req.body.tags     : [],
    subtasks:          Array.isArray(req.body.subtasks) ? req.body.subtasks : [],
    recurring:         req.body.recurring           || 'none',
    timeTracked:       0,
    timerStarted:      null,
    archived:          false,
    archivedAt:        null,
    history:           [{ at: now, type: 'created' }],
    createdAt:         now,
    updatedAt:         now,
  };
  data.tasks.push(task);
  saveData(data);
  scheduleAnalysis(data.tasks);
  scheduleProfileRecompute(data.tasks);
  res.json({ task, analyzing: true });
});

app.put('/api/tasks/:id', (req, res) => {
  if (validateUpdate(req.body, res)) return;
  const data = readData();
  const idx = data.tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });

  const prev = data.tasks[idx];
  // Spreading the raw body let a client overwrite anything on the task, including
  // the fields the timer and archive endpoints own. Only the whitelist gets in.
  const patch = pickMutable(req.body);
  const at = new Date().toISOString();
  const newEntries = [];
  if (patch.status !== undefined && patch.status !== prev.status)
    newEntries.push({ at, type: 'status', from: prev.status, to: patch.status });
  if (patch.deadline !== undefined && patch.deadline !== prev.deadline)
    newEntries.push({ at, type: 'deadline', from: prev.deadline, to: patch.deadline });
  if (patch.tags !== undefined) {
    const sortedPrev = [...(prev.tags || [])].sort();
    const sortedNext = [...(patch.tags || [])].sort();
    if (sortedPrev.join(',') !== sortedNext.join(','))
      newEntries.push({ at, type: 'area', from: sortedPrev[0] || null, to: sortedNext[0] || null });
  }
  const history = [...(prev.history || []), ...newEntries].slice(-200);
  const updated = { ...prev, ...patch, id: req.params.id, updatedAt: at, history };
  data.tasks[idx] = updated;

  // Spawn next occurrence when recurring task is marked done — guard against double-click
  if (patch.status === 'done' && prev.status !== 'done' && updated.recurring && updated.recurring !== 'none') {
    const next = nextDeadline(updated.deadline, updated.recurring);
    const alreadySpawned = data.tasks.some(t =>
      t.title === updated.title && t.deadline === next && t.recurring === updated.recurring && t.status !== 'done'
    );
    if (!alreadySpawned) spawnRecurringTask(data, updated);
  }

  saveData(data);
  scheduleAnalysis(data.tasks);
  scheduleProfileRecompute(data.tasks);
  res.json({ task: data.tasks[idx], analyzing: true });
});

app.delete('/api/tasks/all', (req, res) => {
  const data = readData();
  data.tasks = [];
  data.analysis = null;
  saveData(data);
  res.json({ success: true });
});

app.delete('/api/tasks/:id', (req, res) => {
  const data = readData();
  data.tasks = data.tasks.filter(t => t.id !== req.params.id);
  if (data.analysis?.taskAnalysis) {
    data.analysis.taskAnalysis = data.analysis.taskAnalysis.filter(a => a.id !== req.params.id);
  }
  saveData(data);
  scheduleAnalysis(data.tasks);
  scheduleProfileRecompute(data.tasks);
  res.json({ success: true });
});

app.post('/api/tasks/:id/archive', (req, res) => {
  const data = readData();
  const task = data.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  task.archived = true; task.archivedAt = new Date().toISOString(); task.updatedAt = new Date().toISOString();
  if (data.analysis?.taskAnalysis) {
    data.analysis.taskAnalysis = data.analysis.taskAnalysis.filter(a => a.id !== req.params.id);
  }
  saveData(data); scheduleAnalysis(data.tasks);
  scheduleProfileRecompute(data.tasks);
  res.json({ task });
});

app.post('/api/tasks/:id/restore', (req, res) => {
  const data = readData();
  const task = data.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  task.archived = false; task.archivedAt = null; task.updatedAt = new Date().toISOString();
  saveData(data); scheduleAnalysis(data.tasks);
  scheduleProfileRecompute(data.tasks);
  res.json({ task });
});

// ── Timer ─────────────────────────────────────────────────────────────────────

app.post('/api/tasks/:id/timer/start', (req, res) => {
  const data = readData();
  const task = data.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.timerStarted) return res.json({ task }); // already running
  task.timerStarted = new Date().toISOString();
  task.updatedAt = new Date().toISOString();
  saveData(data);
  res.json({ task });
});

app.post('/api/tasks/:id/timer/stop', (req, res) => {
  const data = readData();
  const task = data.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.timerStarted) {
    const elapsed = Math.min(Math.ceil((Date.now() - new Date(task.timerStarted).getTime()) / 60000), 1440);
    task.timeTracked = (task.timeTracked || 0) + elapsed;
    task.timerStarted = null;
    task.updatedAt = new Date().toISOString();
    saveData(data);
  }
  res.json({ task });
});

// ── Analyze ───────────────────────────────────────────────────────────────────

app.post('/api/analyze', (req, res) => {
  const data = readData();
  const active = data.tasks.filter(t => !t.archived && t.status !== 'done');
  if (!active.length) return res.json({ message: 'No active tasks' });
  scheduleAnalysis(data.tasks);
  scheduleProfileRecompute(data.tasks);
  res.json({ analyzing: true });
});

// ── Weekly summary (streaming) ────────────────────────────────────────────────

app.post('/api/weekly-summary', asyncRoute(async (req, res) => {
  const data = readData();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const active = data.tasks.filter(t => !t.archived);
  const fmt = ts => ts.length ? ts.map(t => `• ${t.title}${t.deadline ? ` (due ${t.deadline})` : ''}`).join('\n') : 'None.';

  const prompt = `You are a personal productivity coach. Write a warm, motivating weekly review.

COMPLETED THIS WEEK:\n${fmt(active.filter(t => t.status === 'done' && (t.history || []).some(h => h.type === 'status' && h.to === 'done' && new Date(h.at) >= weekAgo)))}
IN PROGRESS:\n${fmt(active.filter(t => t.status === 'in_progress'))}
NOT YET STARTED:\n${fmt(active.filter(t => t.status === 'not_started'))}

Write a review with these sections:
## This Week
## In Motion
## Insight
## Next Week

Be direct, warm, under 250 words.`;

  let fullContent = '';
  try {
    const provider = getProvider();
    for await (const token of provider.generate(prompt, { temperature: 0.7 })) {
      fullContent += token;
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
    const freshData = readData();
    freshData.weeklySummary = { content: fullContent, generatedAt: new Date().toISOString() };
    saveData(freshData);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  }
  res.end();
}));

// ── Chat (streaming) ──────────────────────────────────────────────────────────

app.post('/api/chat', asyncRoute(async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    // Everything that touches the request or the store lives inside the try.
    // Built above it, a malformed body threw past Express and killed the process.
    const body     = req.body && typeof req.body === 'object' ? req.body : {};
    const message  = typeof body.message === 'string' ? body.message : String(body.message ?? '');
    const history  = Array.isArray(body.history) ? body.history : [];
    const data     = readData();

    const taskContext = data.tasks.filter(t => !!t && !t.archived).map(t => {
      const ta = data.analysis?.taskAnalysis?.find(a => a.id === t.id);
      // Stores poisoned before the status guard landed still hold nulls here.
      const status = String(t.status ?? 'not_started').replace('_', ' ');
      return `• [${status}] ${t.title ?? 'Untitled'}${ta ? ` | Priority #${ta.priority}` : ''}${t.deadline ? ` | Due ${t.deadline}` : ''}${t.tags?.length ? ` | Tags: ${t.tags.join(', ')}` : ''}`;
    }).join('\n') || 'No tasks yet.';

    const systemPrompt = `You are a productivity coach inside Clarity, a personal task manager. Be concise, warm, and actionable. Refer to specific tasks by name when relevant.

Current tasks:
${taskContext}${data.analysis?.whatToDoNext ? `\n\nAI recommendation: ${data.analysis.whatToDoNext}` : ''}`;

    // Build messages array from history + new message
    const messages = [
      ...history
        .filter(h => !!h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
        .slice(-8),
      { role: 'user', content: message },
    ];

    const provider = getProvider();
    const stream = provider.generateChat
      ? provider.generateChat(systemPrompt, messages, { temperature: 0.7 })
      : provider.generate(`${systemPrompt}\n\nUser: ${message}\nAssistant:`, { temperature: 0.7 });

    for await (const token of stream) {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  }
  res.end();
}));

// ── Subtask breakdown (streaming) ─────────────────────────────────────────────

app.post('/api/tasks/:id/breakdown', asyncRoute(async (req, res) => {
  const data = readData();
  const task = data.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const existingDone = (task.subtasks || []).filter(s => s.done);
  const existingTodo = (task.subtasks || []).filter(s => !s.done);
  const existingNote = existingTodo.length
    ? `\n\nExisting incomplete subtasks (keep unless clearly superseded):\n${existingTodo.map(s => `- ${s.title}`).join('\n')}`
    : '';

  const prompt = `Break this task into 3–6 concrete, actionable subtasks (each ≤2 hours).

Task: ${task.title}${task.description ? `\nDescription: ${task.description}` : ''}${existingNote}

Return ONLY a JSON array — no markdown, no commentary:
[{"title":"Subtask title","notes":"Optional one-line detail"}]`;

  try {
    const provider = getProvider();
    let fullContent = '';
    for await (const token of provider.generate(prompt)) {
      fullContent += token;
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
    const jsonMatch = fullContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const newSubtasks = JSON.parse(jsonMatch[0]).map(s => ({
        id: uuidv4(), title: s.title?.trim() || 'Subtask', notes: s.notes?.trim() || '', done: false,
      }));
      // Re-read before writing to avoid overwriting concurrent task edits made during streaming
      const fresh = readData();
      const idx = fresh.tasks.findIndex(t => t.id === req.params.id);
      if (idx !== -1) {
        const freshDone = (fresh.tasks[idx].subtasks || []).filter(s => s.done);
        // Preserve completed subtasks; replace incomplete ones with AI-generated plan
        fresh.tasks[idx].subtasks = [...freshDone, ...newSubtasks];
        fresh.tasks[idx].updatedAt = new Date().toISOString();
        saveData(fresh);
      }
      res.write(`data: ${JSON.stringify({ done: true, subtasks: newSubtasks })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Could not parse subtasks from AI response' })}\n\n`);
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  }
  res.end();
}));

// ── Calendar today ────────────────────────────────────────────────────────────

app.get('/api/calendar/today', (req, res) => {
  const icsPath = join(DATA_DIR, 'calendar.ics');
  if (!existsSync(icsPath)) return res.json({ events: [], source: null });
  try {
    const icsText = readFileSync(icsPath, 'utf8');
    const _now = new Date();
    const todayStr = `${_now.getFullYear()}${String(_now.getMonth()+1).padStart(2,'0')}${String(_now.getDate()).padStart(2,'0')}`;
    const events = [];
    const blocks = icsText.split('BEGIN:VEVENT').slice(1);
    for (const block of blocks) {
      const summary  = (block.match(/^SUMMARY:(.+)$/m) || [])[1]?.trim();
      const dtstart  = (block.match(/^DTSTART[^:]*:(.+)$/m) || [])[1]?.trim();
      const dtend    = (block.match(/^DTEND[^:]*:(.+)$/m) || [])[1]?.trim();
      if (!summary || !dtstart) continue;
      const dateOnly = dtstart.replace(/T.*/, '');
      if (dateOnly !== todayStr) continue;
      const toHour = s => {
        const t = s.includes('T') ? s.split('T')[1] : null;
        if (!t) return null;
        return parseInt(t.slice(0, 2), 10) + parseInt(t.slice(2, 4), 10) / 60;
      };
      const start = toHour(dtstart);
      if (start !== null) {
        const end = toHour(dtend) ?? start + 1;
        events.push({ type: 'meeting', label: summary, start, end });
      }
    }
    res.json({ events, source: 'ics' });
  } catch { res.json({ events: [], source: null }); }
});

// ── Export ────────────────────────────────────────────────────────────────────

app.get('/api/export', (req, res) => {
  const data = readData();
  res.json({ exportedAt: new Date().toISOString(), ...data });
});

// Last in the chain, so it sees anything a route threw or handed to next().
// Without it an error reached Express's default handler and, for async routes,
// nothing at all.
app.use((err, req, res, next) => {
  console.error(`[Clarity] ${req.method} ${req.originalUrl} failed:`, err?.stack || err);
  if (res.headersSent) {
    // An SSE stream is already open — report inside the stream and close it.
    try { res.write(`data: ${JSON.stringify({ error: err?.message || 'Internal error' })}\n\n`); } catch {}
    return res.end();
  }
  res.status(err?.status || 500).json({ error: err?.message || 'Internal error' });
});

const BACKUP_INTERVAL_MS = 60 * 60 * 1000;

// Loopback only. `app.listen(PORT)` binds every interface, so the whole task
// store was readable by anything on the same network — no auth, no TLS. The
// escape hatch stays for the documented ngrok flow, which forwards from this
// machine and therefore still reaches 127.0.0.1 without opening the port.
const BIND_HOST = process.env.CLARITY_BIND || '127.0.0.1';

const server = app.listen(PORT, BIND_HOST, () => {
  const s = readSettings();
  console.log(`[Clarity v${VERSION}] Backend on ${BIND_HOST}:${PORT} | Provider: ${s.providerType} | Endpoint: ${s.llmEndpoint}`);
  runDailyBackup();
  // Once at startup was not enough: a machine left running for days never took a
  // second snapshot, so the day's work had no backup behind it.
  setInterval(runDailyBackup, BACKUP_INTERVAL_MS).unref();
});

// Failing to bind is fatal, not survivable. The uncaughtException handler above
// exists so a bad *request* cannot kill the process — but applied to a startup
// bind failure it left a live process with no listener, which looks to the
// Electron shell exactly like a backend that is merely slow to start.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Clarity] port ${PORT} is already in use — another Clarity backend is probably running.`);
  } else {
    console.error('[Clarity] server failed to start:', err.message);
  }
  process.exit(1);
});
