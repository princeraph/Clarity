import { useState, useEffect, useCallback, useRef } from 'react';
import { ThemeProvider, useTheme } from './contexts/ThemeContext.jsx';
import TitleBar from './components/TitleBar.jsx';
import Sidebar from './components/Sidebar.jsx';
import FocusView from './components/views/FocusView.jsx';
import TasksView from './components/views/TasksView.jsx';
import CalendarView from './components/views/CalendarView.jsx';
import ArchiveView from './components/views/ArchiveView.jsx';
import WeeklySummaryView from './components/views/WeeklySummaryView.jsx';
import SettingsView from './components/views/SettingsView.jsx';
import TaskForm from './components/TaskForm.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import ExportModal from './components/ExportModal.jsx';
import SearchCapture from './components/SearchCapture.jsx';
import TopicDetailView from './components/views/TopicDetailView.jsx';
import TaskDetailPanel from './components/TaskDetailPanel.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import OnboardingView from './components/OnboardingView.jsx';
import HistoryView from './components/views/HistoryView.jsx';
import GraphView from './components/views/GraphView.jsx';
import PatternsView from './components/views/PatternsView.jsx';
import FocusMode from './components/FocusMode.jsx';
import SchedulingPopover from './components/SchedulingPopover.jsx';
import TutorialOverlay from './components/TutorialOverlay.jsx';
import SuggestionCard from './components/SuggestionCard.jsx';
import FeedbackDialog from './components/FeedbackDialog.jsx';
import UpdateDialog from './components/UpdateDialog.jsx';
import { useUpdates } from './updates.js';
import { useLocale } from './contexts/LocaleContext.jsx';

const API = 'http://localhost:3001/api';
const isElectron = !!window.clarity?.isElectron;

const DEFAULT_SHORTCUT_KEYS = {
  capture:  ['Ctrl', 'K'],
  chat:     ['Ctrl', '/'],
  theme:    ['Ctrl', 'Shift', 'L'],
  settings: ['Ctrl', ','],
  focus:    ['Ctrl', '1'],
  tasks:    ['Ctrl', '2'],
  calendar: ['Ctrl', '3'],
  graph:    ['Ctrl', 'G'],
};

function getShortcutKeys(id) {
  try {
    const custom = JSON.parse(localStorage.getItem('clarity-shortcuts') || '{}');
    return custom[id] || DEFAULT_SHORTCUT_KEYS[id] || [];
  } catch { return DEFAULT_SHORTCUT_KEYS[id] || []; }
}

function keysMatchEvent(e, keys) {
  const hasCtrl  = keys.includes('Ctrl');
  const hasShift = keys.includes('Shift');
  const hasAlt   = keys.includes('Alt');
  const mainKey  = keys.find(k => !['Ctrl', 'Shift', 'Alt'].includes(k));
  if (!mainKey) return false;
  if (hasCtrl  !== (e.ctrlKey || e.metaKey)) return false;
  if (hasShift !== e.shiftKey)  return false;
  if (hasAlt   !== e.altKey)    return false;
  const ek = e.key;
  if (mainKey === 'Space')     return ek === ' ';
  if (mainKey === 'Esc')       return ek === 'Escape';
  if (mainKey === '↵')         return ek === 'Enter';
  if (mainKey === 'Del')       return ek === 'Delete';
  if (mainKey === 'Backspace') return ek === 'Backspace';
  return ek.toUpperCase() === mainKey.toUpperCase() || ek === mainKey;
}

function ToastUndoBtn({ onClick, label, T }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        fontSize: 12.5, fontWeight: 500, padding: 0, flexShrink: 0,
        color: hov ? T.paper : `${T.paper}e6`,
        fontFamily: 'inherit',
      }}
    >{label}</button>
  );
}

function AppInner() {
  const { t } = useLocale();
  const { T, isDark, toggleTheme } = useTheme();
  const [data, setData]         = useState({ tasks: [], archivedTasks: [], analysis: null, weeklySummary: null, analyzing: false, analysisError: null });
  const [health, setHealth]     = useState({ ollama: false, model: '', analyzing: false });
  const [view, setView]         = useState('focus');
  // Which Settings page opens. "The AI isn't available" leads straight to the
  // AI page — landing on Appearance would leave the person to find it.
  const [settingsSection, setSettingsSection] = useState('appearance');
  const openAiSettings = () => { setSettingsSection('ai'); setView('settings'); };
  useEffect(() => { if (view !== 'settings') setSettingsSection('appearance'); }, [view]);
  const [activeArea, setActiveArea] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showChat, setShowChat]   = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [detailTask, setDetailTask]   = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [scheduling, setScheduling] = useState(null); // { task, x, y }
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      const onboardingDone = localStorage.getItem('clarity-onboarding-done');
      const tutorialSeen   = localStorage.getItem('clarity-tutorialSeen');
      return !!onboardingDone && !tutorialSeen;
    } catch { return false; }
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [focusTask, setFocusTask] = useState(null);
  const [toast, setToast]       = useState(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [saving, setSaving]     = useState(false);
  const [hiddenTaskIds, setHiddenTaskIds] = useState(new Set());
  const notifiedDeadlines  = useRef(new Set());
  const pendingDeleteTimers = useRef(new Map());
  const loadErrorShown      = useRef(false);
  const toastTimer          = useRef(null);
  const toastActionRef      = useRef(null);

  const showToast = useCallback((message, type = 'success', action = null, actionLabel = null) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastActionRef.current = action;
    // Deduplicate: only re-render if message or type changed (avoids animation restart on rapid same-message calls)
    setToast(prev =>
      prev?.message === message && prev?.type === type && !action
        ? prev
        : { message, type, action, actionLabel }
    );
    const delay = action ? 5000 : 3500;
    toastTimer.current = setTimeout(() => { toastActionRef.current = null; setToast(null); }, delay);
  }, []);

  const dismissToast = useCallback((runAction = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const action = toastActionRef.current;
    toastActionRef.current = null;
    setToast(null);
    if (runAction && action) action();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const resp = await fetch(`${API}/tasks`);
      if (resp.ok) {
        const fresh = await resp.json();
        loadErrorShown.current = false;
        setData(fresh);
        setDetailTask(prev => {
          if (!prev) return null;
          return fresh.tasks.find(t => t.id === prev.id)
              || fresh.archivedTasks?.find(t => t.id === prev.id)
              || null;
        });
        return fresh;
      }
    } catch {
      if (!loadErrorShown.current) {
        loadErrorShown.current = true;
        showToast(t('toast.lostConnection'), 'error');
      }
    }
  }, [showToast]);

  const checkHealth = useCallback(async () => {
    try {
      const resp = await fetch(`${API}/health`);
      if (resp.ok) setHealth(await resp.json());
    } catch { setHealth({ ollama: false, model: '', analyzing: false }); }
  }, []);

  const checkOnboarding = useCallback(async () => {
    try {
      const resp = await fetch(`${API}/settings`);
      if (resp.ok) {
        const s = await resp.json();
        if (!s.onboardingComplete) setShowOnboarding(true);
      }
    } catch {}
  }, []);

  const checkDeadlines = useCallback((tasks) => {
    if (!isElectron) return;
    const now = new Date();
    tasks.filter(t => t.deadline && t.status !== 'done' && !t.archived).forEach(task => {
      const deadline = new Date(task.deadline + 'T00:00:00');
      const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      const key = `${task.id}-${task.deadline}`;
      if ((daysLeft === 1 || daysLeft === 0) && !notifiedDeadlines.current.has(key)) {
        notifiedDeadlines.current.add(key);
        window.clarity.showNotification(t('notify.deadlineTitle'),
          t(daysLeft === 0 ? 'notify.dueToday' : 'notify.dueTomorrow', { title: task.title }));
      }
    });
  }, [t]);

  useEffect(() => {
    loadData();
    checkHealth();
    checkOnboarding();
    const dataInterval   = setInterval(loadData, 5000);
    const healthInterval = setInterval(checkHealth, 10000);
    return () => { clearInterval(dataInterval); clearInterval(healthInterval); };
  }, [loadData, checkHealth, checkOnboarding]);

  useEffect(() => {
    if (data.tasks.length) checkDeadlines(data.tasks);
  }, [data.tasks, checkDeadlines]);

  useEffect(() => {
    function goOnline()  { setIsOnline(true);  loadData(); }
    function goOffline() { setIsOnline(false); }
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, [loadData]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      if (keysMatchEvent(e, getShortcutKeys('capture')))  { e.preventDefault(); setShowCapture(c => !c); }
      if (keysMatchEvent(e, getShortcutKeys('chat')))     { e.preventDefault(); setShowChat(c => !c); }
      if (keysMatchEvent(e, getShortcutKeys('theme')))    { e.preventDefault(); toggleTheme(); }
      if (keysMatchEvent(e, getShortcutKeys('focus')))    { e.preventDefault(); setView('focus'); }
      if (keysMatchEvent(e, getShortcutKeys('tasks')))    { e.preventDefault(); setView('tasks'); }
      if (keysMatchEvent(e, getShortcutKeys('calendar'))) { e.preventDefault(); setView('calendar'); }
      if (keysMatchEvent(e, getShortcutKeys('graph')))    { e.preventDefault(); setView('graph'); }
      if (keysMatchEvent(e, getShortcutKeys('settings'))) { e.preventDefault(); setView('settings'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleTheme]);

  // System tray commands (forwarded from the Electron tray popup)
  useEffect(() => {
    if (!window.clarity?.onTrayCommand) return;
    const off = window.clarity.onTrayCommand(action => {
      if (action === 'capture')   setShowCapture(true);
      else if (action === 'chat') setShowChat(true);
      else if (action === 'today') setView('focus');
    });
    return off;
  }, []);

  // ── Task handlers ───────────────────────────────────────────────────────────

  async function handleSaveTask(taskData) {
    setSaving(true);
    try {
      const isEdit = !!editingTask?.id;
      const resp = await fetch(isEdit ? `${API}/tasks/${editingTask.id}` : `${API}/tasks`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      if (!resp.ok) throw new Error();
      setShowForm(false);
      setEditingTask(null);
      await loadData();
      showToast(isEdit ? t('toast.taskUpdated') : t('toast.taskAdded'));
    } catch { showToast(t('toast.saveFailed'), 'error'); }
    finally { setSaving(false); }
  }

  function handleDeleteTask(taskId) {
    if (detailTask?.id === taskId) setDetailTask(null);
    setContextMenu(null);
    setHiddenTaskIds(prev => new Set([...prev, taskId]));

    const timeoutId = setTimeout(async () => {
      pendingDeleteTimers.current.delete(taskId);
      try {
        const resp = await fetch(`${API}/tasks/${taskId}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error();
      } catch {
        setHiddenTaskIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
        showToast(t('toast.deleteFailed'), 'error');
      }
      await loadData();
    }, 5000);
    pendingDeleteTimers.current.set(taskId, timeoutId);

    showToast(t('toast.deleted'), 'success', () => {
      const tid = pendingDeleteTimers.current.get(taskId);
      if (tid) { clearTimeout(tid); pendingDeleteTimers.current.delete(taskId); }
      setHiddenTaskIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
    });
  }

  async function handleArchive(taskId) {
    // Cancel any pending delete for this task before archiving
    const tid = pendingDeleteTimers.current.get(taskId);
    if (tid) {
      clearTimeout(tid);
      pendingDeleteTimers.current.delete(taskId);
      setHiddenTaskIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
    }
    await fetch(`${API}/tasks/${taskId}/archive`, { method: 'POST' });
    if (detailTask?.id === taskId) setDetailTask(null);
    await loadData();
    showToast(t('toast.archived'));
  }

  async function handleRestore(taskId) {
    await fetch(`${API}/tasks/${taskId}/restore`, { method: 'POST' });
    await loadData();
    showToast(t('toast.restored'));
  }

  async function handleStatusChange(task, status) {
    try {
      const resp = await fetch(`${API}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // Send only what changed — the server owns timers, archive flags and
        // createdAt, and `task` also carries the client-only aiData.
        body: JSON.stringify({ status }),
      });
      if (!resp.ok) throw new Error();
      const fresh = await loadData();
      if (status === 'done' && task.recurring && task.recurring !== 'none') {
        const freq = { daily: 'recurFreq.daily', weekly: 'recurFreq.weekly', monthly: 'recurFreq.monthly' }[task.recurring];
        showToast(t('toast.recurringCreated', { freq: freq ? t(freq) : task.recurring }));
      }
      return fresh;
    } catch {
      showToast(t('toast.statusFailed'), 'error');
      throw new Error('status update failed');
    }
  }

  async function handleSubtaskToggle(task, subtaskId) {
    const subtasks = task.subtasks.map(s => s.id === subtaskId ? { ...s, done: !s.done } : s);
    try {
      await fetch(`${API}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtasks }),
      });
      await loadData();
    } catch { showToast(t('toast.subtaskFailed'), 'error'); }
  }

  async function handleTimerStart(taskId) {
    await fetch(`${API}/tasks/${taskId}/timer/start`, { method: 'POST' });
    await loadData();
  }

  async function handleTimerStop(taskId) {
    await fetch(`${API}/tasks/${taskId}/timer/stop`, { method: 'POST' });
    await loadData();
    showToast(t('toast.timeLogged'));
  }

  async function handleReanalyze() {
    showToast(t('toast.reanalyzing'));
    try {
      await fetch(`${API}/analyze`, { method: 'POST' });
    } catch {
      showToast(t('toast.reanalyzeFailed'), 'error');
    }
  }

  async function handleAcceptAiTask(title) {
    if (!title) return;
    try {
      const resp = await fetch(`${API}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, status: 'not_started' }),
      });
      if (resp.ok) {
        // Not `t`: that name is the translator, and shadowing it here is how a
        // toast ends up calling a task object.
        const created = await resp.json();
        setData(d => ({ ...d, tasks: [...d.tasks, created] }));
        showToast(t('toast.quickAdded', { title: title.slice(0, 40) }));
      }
    } catch {
      showToast(t('toast.addFailed'), 'error');
    }
  }

  function openAddTask(defaults = {}) { setEditingTask(Object.keys(defaults).length ? defaults : null); setShowForm(true); }
  function openEditTask(task)  { setEditingTask(task); setShowForm(true); setDetailTask(null); }
  function openDetail(task)    { setDetailTask(task); setContextMenu(null); }

  // Ask the backend whether it has anything to say. The decision — budget,
  // quiet rules, the hour — lives entirely on that side; this only asks.
  //
  // Two rules hold this to the interruption budget rather than around it:
  // nothing is asked while a card is already up (two at once is not a budget,
  // it is a pile), and nothing is asked during onboarding. And the request is
  // the SAME one that spends budget, so polling can never quietly drain the
  // day: a refusal costs nothing, a delivery costs exactly one.
  const suggestionRef = useRef(null);
  suggestionRef.current = suggestion;
  useEffect(() => {
    if (showOnboarding) return undefined;
    let live = true;
    const ask = async () => {
      if (!live || suggestionRef.current) return;
      try {
        const resp = await fetch(`${API}/suggestions/next`, { method: 'POST' });
        if (!resp.ok) return;
        const body = await resp.json();
        if (!live || !body.suggestion) return;
        setSuggestion(body.suggestion);
        try { window.clarity?.showNotification?.('Clarity', body.suggestion.title); } catch {}
      } catch { /* offline: try again next tick */ }
    };
    const first = setTimeout(ask, 45000);       // not the instant the app opens
    const timer = setInterval(ask, 5 * 60000);
    return () => { live = false; clearTimeout(first); clearInterval(timer); };
  }, [showOnboarding]);

  // Feedback from testers. Whether it is on, and whether it is time to ask (a
  // week of use, five finished tasks, "later", "never"), is the backend's call;
  // this only decides WHEN to show it: at most once per launch, never over
  // onboarding, the tutorial or another open dialog.
  const [feedbackEnabled, setFeedbackEnabled] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState(null);   // null | 'manual' | 'prompt'
  const closeFeedback = useCallback(() => setFeedbackMode(null), []);
  const openFeedback = useCallback(() => setFeedbackMode('manual'), []);
  const feedbackAsked = useRef(false);
  const busyRef = useRef(false);
  const updateWindow = useUpdates();
  busyRef.current = showOnboarding || showTutorial || showForm || showCapture || showChat || showExport
    || !!focusTask || !!detailTask || !!suggestion || !!feedbackMode
    || updateWindow.open || !!updateWindow.updated;
  useEffect(() => {
    let live = true;
    fetch(`${API}/feedback`).then(r => (r.ok ? r.json() : null))
      .then(body => { if (live && body) setFeedbackEnabled(!!body.enabled); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (showOnboarding || showTutorial) return undefined;
    let live = true;
    const ask = async () => {
      if (!live || feedbackAsked.current || busyRef.current) return;
      try {
        const resp = await fetch(`${API}/feedback`);
        if (!resp.ok) return;
        const body = await resp.json();
        if (!live) return;
        setFeedbackEnabled(!!body.enabled);
        if (!body.prompt?.due) { feedbackAsked.current = true; return; }
        if (busyRef.current) return;          // due, but something is open: next tick
        feedbackAsked.current = true;
        setFeedbackMode('prompt');
      } catch { /* backend not up yet: next tick */ }
    };
    const first = setTimeout(ask, 20000);       // let the person start working first
    const timer = setInterval(ask, 60000);
    return () => { live = false; clearTimeout(first); clearInterval(timer); };
  }, [showOnboarding, showTutorial]);

  function openContextMenu(e, task) { setContextMenu({ task, x: e.clientX, y: e.clientY }); }
  function openScheduling(task, x, y) { setScheduling({ task, x, y }); setContextMenu(null); }
  function enterFocusMode(task) { setFocusTask(task); setDetailTask(null); setContextMenu(null); }

  async function handleFocusDone(task) {
    let fresh;
    try {
      fresh = await handleStatusChange(task, 'done');
    } catch {
      return; // toast already shown by handleStatusChange
    }
    const liveTasks = fresh?.tasks ?? rankedTasks;
    const remaining = liveTasks.filter(t => t.id !== task.id && t.status !== 'done' && !hiddenTaskIds.has(t.id));
    setFocusTask(remaining[0] || null);
  }

  // ── Derived data ────────────────────────────────────────────────────────────

  const rankedTasks = [...data.tasks]
    .filter(t => !hiddenTaskIds.has(t.id))
    .map(task => ({
      ...task,
      aiData: data.analysis?.taskAnalysis?.find(a => a.id === task.id) || null,
    }))
    .sort((a, b) => {
      if (a.aiData && b.aiData) return a.aiData.priority - b.aiData.priority;
      if (a.aiData) return -1;
      if (b.aiData) return 1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

  const taskHandlers = {
    onEdit:          openEditTask,
    onDelete:        handleDeleteTask,
    onArchive:       handleArchive,
    onStatusChange:  handleStatusChange,
    onSubtaskToggle: handleSubtaskToggle,
    onTimerStart:    handleTimerStart,
    onTimerStop:     handleTimerStop,
    onOpenDetail:    openDetail,
    onContextMenu:   openContextMenu,
    onFocusMode:     enterFocusMode,
    allTasks:        data.tasks,
  };

  const stats = {
    total:      data.tasks.length,
    inProgress: data.tasks.filter(t => t.status === 'in_progress').length,
    done:       data.tasks.filter(t => t.status === 'done').length,
    overdue:    (() => { const s = new Date(); s.setHours(0,0,0,0); return data.tasks.filter(t => t.deadline && new Date(t.deadline + 'T00:00:00') < s && t.status !== 'done').length; })(),
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {suggestion && (
        <SuggestionCard
          suggestion={suggestion}
          onClose={() => setSuggestion(null)}
          onOpenTask={(id) => { const task = data.tasks.find(t => t.id === id); if (task) openDetail(task); }}
        />
      )}
      {showOnboarding && <OnboardingView onComplete={() => {
        setShowOnboarding(false);
        try { localStorage.setItem('clarity-onboarding-done', '1'); } catch {}
        setShowTutorial(true);
      }} />}
      <TitleBar isDark={isDark} toggleTheme={toggleTheme} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          view={view} setView={setView} health={health}
          analyzing={data.analyzing} onAddTask={openAddTask}
          onChat={() => setShowChat(true)} onExport={() => setShowExport(true)}
          onFeedback={feedbackEnabled ? openFeedback : null}
          onReanalyze={handleReanalyze}
          onOpenSettings={() => setView('settings')}
          onOpenAiSettings={openAiSettings}
          taskCount={data.tasks.length} archivedCount={data.archivedTasks.length}
          allTasks={data.tasks}
          activeArea={activeArea}
          onAreaClick={tag => { setActiveArea(tag); setView('topic-detail'); }}
        />

        <main style={{ flex: 1, overflow: 'hidden', background: T.paper }}>
          {view === 'focus' && (
            <FocusView rankedTasks={rankedTasks} analysis={data.analysis} stats={stats}
              analyzing={data.analyzing} analysisError={data.analysisError} health={health} {...taskHandlers}
              onAddTask={openAddTask} onAcceptAiTask={handleAcceptAiTask} onViewTasks={() => setView('calendar')}
              onOpenSettings={openAiSettings} onReanalyze={handleReanalyze}
              onOpenChat={() => setShowChat(true)} />
          )}
          {view === 'tasks' && (
            <TasksView rankedTasks={rankedTasks} analyzing={data.analyzing}
              {...taskHandlers} onAddTask={openAddTask}
              activeArea={activeArea} onClearArea={() => setActiveArea('')} />
          )}
          {view === 'calendar' && (
            <CalendarView rankedTasks={rankedTasks} onEdit={openEditTask} onAddTask={openAddTask} />
          )}
          {view === 'archive' && (
            <ArchiveView archivedTasks={data.archivedTasks} onRestore={handleRestore} onDelete={handleDeleteTask} onAddTask={openAddTask} />
          )}
          {view === 'weekly' && (
            <WeeklySummaryView weeklySummary={data.weeklySummary} health={health} onRefresh={loadData} onOpenSettings={openAiSettings} />
          )}
          {view === 'settings' && (
            <SettingsView key={settingsSection} initialSection={settingsSection}
              onFeedback={feedbackEnabled ? openFeedback : null}
              onSaved={() => { checkHealth(); showToast(t('toast.settingsSaved')); }} />
          )}
          {view === 'history' && (
            <HistoryView
              tasks={data.tasks}
              archivedTasks={data.archivedTasks}
              onRestore={handleRestore}
            />
          )}
          {view === 'graph' && (
            <GraphView rankedTasks={rankedTasks} onOpenDetail={openDetail} />
          )}
          {view === 'patterns' && (
            <PatternsView />
          )}
          {view === 'topic-detail' && (
            <TopicDetailView
              topic={activeArea}
              allTasks={data.tasks}
              archivedTasks={data.archivedTasks}
              onOpenDetail={openDetail}
              onBack={() => setView('focus')}
            />
          )}
        </main>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div style={{
          position: 'fixed', top: 32, left: 0, right: 0, zIndex: 190,
          background: T.danger, color: T.paper,
          padding: '8px 16px', textAlign: 'center',
          fontSize: 12.5, fontFamily: T.fontUI,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          {t('app.offline')}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 200,
          minWidth: 280, maxWidth: 440,
          borderRadius: T.r10,
          fontFamily: T.fontUI,
          background: toast.type === 'error' ? T.danger : T.ink,
          boxShadow: '0 8px 24px rgba(25,25,26,0.18), 0 1px 4px rgba(25,25,26,0.10)',
          animation: 'toastIn 0.2s ease-out',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ flex: 1, fontSize: 13, color: T.paper }}>
              {toast.message}
            </span>
            {toast.action && (
              <ToastUndoBtn onClick={() => dismissToast(true)} label={toast.actionLabel ?? t('toast.undo')} T={T} />
            )}
            <button onClick={() => dismissToast(false)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: `${T.paper}66`, fontSize: 13, padding: '0 2px', lineHeight: 1,
              flexShrink: 0,
            }}>✕</button>
          </div>
          {/* Progress bar */}
          <div style={{ height: 2, background: 'rgba(255,255,255,0.12)', position: 'relative' }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, height: '100%',
              background: 'rgba(255,255,255,0.50)',
              animation: `toastProgress ${toast.action ? '5s' : '3.5s'} linear forwards`,
            }} />
          </div>
        </div>
      )}

      {/* Modals */}
      {/* Focus mode — full-window overlay */}
      {focusTask && (() => {
        const liveTask = rankedTasks.find(t => t.id === focusTask.id) || focusTask;
        const activeTasks = rankedTasks.filter(t => t.status !== 'done' && t.id !== focusTask.id);
        return (
          <FocusMode
            key={liveTask.id}
            task={liveTask}
            nextTask={activeTasks[0] || null}
            onDone={handleFocusDone}
            onSkip={() => setFocusTask(activeTasks[0] || null)}
            onExit={() => setFocusTask(null)}
            onTimerStart={handleTimerStart}
            onTimerStop={handleTimerStop}
            onSubtaskToggle={handleSubtaskToggle}
          />
        );
      })()}

      {showCapture && (
        <SearchCapture
          allTasks={data.tasks}
          onClose={() => setShowCapture(false)}
          onSaved={loadData}
          onSavedAndOpen={task => { loadData(); setDetailTask(task); }}
          onOpenTask={task => { setDetailTask(task); }}
          onNavigate={v => setView(v)}
          onOpenChat={() => setShowChat(true)}
        />
      )}
      {showForm && (
        <TaskForm task={editingTask} onSave={handleSaveTask}
          onClose={() => { setShowForm(false); setEditingTask(null); }} saving={saving} />
      )}
      {showChat   && <ChatPanel onClose={() => setShowChat(false)} taskCount={data.tasks.length} />}
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {feedbackMode && <FeedbackDialog mode={feedbackMode} onClose={closeFeedback} />}
      <UpdateDialog />
      {detailTask && (
        <TaskDetailPanel
          task={detailTask}
          allTasks={data.tasks}
          onClose={() => setDetailTask(null)}
          onEdit={openEditTask}
          onArchive={handleArchive}
          onDelete={handleDeleteTask}
          onStatusChange={handleStatusChange}
          onSubtaskToggle={handleSubtaskToggle}
          onTimerStart={handleTimerStart}
          onTimerStop={handleTimerStop}
          onSaved={loadData}
          onFocusMode={enterFocusMode}
        />
      )}
      {contextMenu && (
        <ContextMenu
          task={contextMenu.task}
          x={contextMenu.x}
          y={contextMenu.y}
          allTasks={data.tasks}
          onClose={() => setContextMenu(null)}
          onEdit={openEditTask}
          onArchive={handleArchive}
          onDelete={handleDeleteTask}
          onStatusChange={handleStatusChange}
          onOpenDetail={openDetail}
          onSaved={loadData}
          onFocusMode={enterFocusMode}
          onSchedule={openScheduling}
        />
      )}
      {scheduling && (
        <SchedulingPopover
          task={scheduling.task}
          anchorX={scheduling.x}
          anchorY={scheduling.y}
          onClose={() => setScheduling(null)}
          onSaved={() => { loadData(); setScheduling(null); }}
        />
      )}
      {showTutorial && (
        <TutorialOverlay onDone={() => setShowTutorial(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
