import { PriorityRow, DifficultyRow, LinksSection } from './PriorityLinks.jsx';
import { ReminderRow } from './Rappels.jsx';
import TaskSuggestions from './TaskSuggestions.jsx';
import { useState, useEffect, useRef } from 'react';
import FollowUp from './FollowUp.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { localDay } from './glance.js';
import useEscape from '../hooks/useEscape.js';
import useNarrow from '../hooks/useNarrow.js';
import { LEVEL_STYLE } from '../lib/niveaux.js';
import { SUB_STATUSES, subtaskStatus, withSubtask, promote } from '../lib/sousTaches.js';
import { topicsOf, knownSpelling } from '../lib/sujets.js';

const API = 'http://localhost:3001/api';
const newId = () => (globalThis.crypto?.randomUUID?.() || `st-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);


const STATUS_KEY = { not_started: 'status.notStarted', in_progress: 'status.inProgress', done: 'status.done' };

function historyLabel(h, t, fmtDate) {
  if (h.type === 'created')  return t('detail.history.created');
  if (h.type === 'status')   return t('detail.history.status', { to: STATUS_KEY[h.to] ? t(STATUS_KEY[h.to]) : h.to });
  if (h.type === 'deadline') return h.to
    ? t('detail.history.deadlineSet', { date: fmtDate(h.to + 'T00:00:00') })
    : t('detail.history.deadlineRemoved');
  if (h.type === 'area')     return h.to ? t('detail.history.movedTo', { area: h.to }) : t('detail.history.removedFromArea');
  return h.type;
}

// A subtask, as a line of its task (2.8.0): tick it, or click it to open it
// as a page of its own beside the task (SubtaskPanel). Another click on
// another subtask replaces the page. In 2.6.0 it opened inline; the owner's
// drawing asked for a page beside the task, as Notion's side peek does.
function SubtaskCard({ subtask: s, task, onToggle, onOpen, open, T }) {
  const { fmtDate } = useLocale();
  const [hov, setHov] = useState(false);
  const meta = [s.dueDate ? fmtDate(s.dueDate + 'T00:00:00', { day: 'numeric', month: 'short' }) : null].filter(Boolean).join(' · ');
  return (
    <div
      data-subtask-id={s.id} data-open={open ? '' : undefined}
      onClick={() => onOpen?.(s.id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer',
        background: open ? T.paper : T.paperSubtle, borderRadius: T.r6,
        border: `1px solid ${open ? T.accent : hov ? T.hairline : T.hairlineSoft}`,
        transition: 'border-color 0.1s',
      }}
    >
      <span
        data-check
        onClick={e => { e.stopPropagation(); onToggle?.(task, s.id); }}
        style={{
          width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
          background: s.done ? T.done : 'transparent',
          border: `1.5px solid ${s.done ? T.done : T.ink40}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
      >
        {s.done && <span style={{ color: T.paper, fontSize: 8, lineHeight: 1 }}>✓</span>}
      </span>
      <span style={{ flex: 1, fontSize: 13, color: s.done ? T.ink40 : T.ink, textDecoration: s.done ? 'line-through' : 'none', lineHeight: 1.4 }}>{s.title}</span>
      {s.priority && <span style={{ width: 8, height: 8, borderRadius: 2, background: LEVEL_STYLE[s.priority]?.color, flexShrink: 0 }} />}
      {meta && <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40 }}>{meta}</span>}
      <span aria-hidden="true" style={{ color: open ? T.accent : T.ink40, fontSize: 12 }}>›</span>
    </div>
  );
}

// The subtask's own page (2.8.0), beside its task: title, date, level,
// status, difficulty, notes — what a task has — and « Make it a task ». Text
// is saved on leaving the field; the rest on the click. The fields keep their
// own copy while it is open, so the 5-second refresh never overwrites typing.
// Esc closes this page first, then the task's.
// Lot E1: the subtask's page sits beside its task inside the same centred
// window (the owner's choice, 30 October); in a narrow window it takes the
// task's place, with the path back above it.
export const SUB_PANEL_WIDTH = 380;
const TASK_WIDTH = 600;
function SubtaskPanel({ task, subtask: s, onChange, onRemove, onPromote, onClose, side, T }) {
  const { t } = useLocale();
  useEscape(onClose);
  const [draft, setDraft] = useState({ title: s.title, notes: s.notes || '' });
  const [promoting, setPromoting] = useState(false);
  const commit = (k) => {
    const v = k === 'title' ? draft.title.trim() : draft.notes;
    if (k === 'title' && !v) { setDraft(d => ({ ...d, title: s.title })); return; }
    if ((s[k] ?? '') !== v) onChange({ [k]: v });
  };
  const status = subtaskStatus(s);
  const field = {
    width: '100%', boxSizing: 'border-box', padding: '7px 9px',
    background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: T.r6,
    fontSize: 13, color: T.ink, fontFamily: T.fontUI, outline: 'none',
  };
  const label = { fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 6 };
  const pill = (on) => ({
    padding: '5px 10px', fontSize: 12, fontFamily: T.fontUI, borderRadius: T.rPill, cursor: 'pointer',
    background: on ? T.ink : T.paperSubtle, color: on ? T.paper : T.ink60, border: `1px solid ${on ? T.ink : T.hairline}`,
  });
  return (
    <div data-subtask-panel={s.id} role="dialog" aria-label={s.title} style={{
      flex: side ? `0 0 ${SUB_PANEL_WIDTH}px` : '1 1 auto', minWidth: 0,
      background: T.paper, borderLeft: side ? `1px solid ${T.hairline}` : 'none',
      display: 'flex', flexDirection: 'column', fontFamily: T.fontUI, animation: 'fadeUp 0.12s ease-out',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.hairlineSoft}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button data-action="back-to-task" onClick={onClose} aria-label={t('detail.backToTask')} style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 12, color: T.ink40, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: T.fontUI, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span aria-hidden="true">← </span>{task.title} <span aria-hidden="true">›</span> {s.title}
        </button>
        <button onClick={onClose} aria-label={t('common.close')} style={{ fontSize: 15, color: T.ink40, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <input data-field="subtask-title" aria-label={t('detail.subtaskTitle')} value={draft.title}
          onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} onBlur={() => commit('title')}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          style={{ ...field, fontSize: 17, fontWeight: 500, border: '1px solid transparent', padding: '4px 6px', marginLeft: -6 }} />
        <div>
          <div style={label}>{t('detail.subtaskDue')}</div>
          <input type="date" data-field="subtask-due" value={s.dueDate || ''}
            onChange={e => onChange({ dueDate: e.target.value || null })}
            style={{ ...field, width: 'auto', fontFamily: T.fontMono, fontSize: 12 }} />
        </div>
        <PriorityRow task={s} T={T} onChange={onChange} />
        <div>
          <div style={label}>{t('detail.status')}</div>
          <div role="radiogroup" aria-label={t('detail.status')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SUB_STATUSES.map(st => (
              <button key={st} type="button" role="radio" aria-checked={status === st} data-status={st}
                onClick={() => onChange({ status: st })} style={pill(status === st)}>{t(STATUS_KEY[st])}</button>
            ))}
          </div>
        </div>
        <DifficultyRow task={s} T={T} onChange={onChange} />
        <div>
          <div style={label}>{t('detail.subtaskNotes')}</div>
          <textarea data-field="subtask-notes" aria-label={t('detail.subtaskNotes')} placeholder={t('detail.subtaskNotesPlaceholder')}
            value={draft.notes} rows={6} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} onBlur={() => commit('notes')}
            style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
        </div>
      </div>
      <div style={{ padding: '12px 18px', borderTop: `1px solid ${T.hairlineSoft}`, display: 'flex', gap: 8 }}>
        <button data-action="promote-subtask" disabled={promoting}
          onClick={async () => { setPromoting(true); try { await onPromote(); } finally { setPromoting(false); } }}
          style={{ flex: 1, padding: '8px 12px', background: T.ink, color: T.paper, border: 'none', borderRadius: T.r6, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: T.fontUI }}>
          {t('detail.subtaskPromote')}
        </button>
        <button onClick={onRemove} style={{ padding: '8px 12px', background: 'transparent', border: `1px solid ${T.hairline}`, borderRadius: T.r6, fontSize: 12.5, color: T.danger, cursor: 'pointer', fontFamily: T.fontUI }}>
          {t('detail.subtaskRemove')}
        </button>
      </div>
    </div>
  );
}

// « Add subtask », in place: a line to type in, Enter adds and keeps the line
// open for the next one. It used to open the full task form.
function AddSubtask({ onAdd, T, t }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  if (!open) return (
    <button
      data-action="add-subtask"
      onClick={() => setOpen(true)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 4px', marginTop: 4, cursor: 'pointer',
        fontSize: 12.5, color: T.ink40,
        background: 'transparent', border: 'none', fontFamily: T.fontUI,
      }}
    >
      <span style={{ fontSize: 14 }}>+</span>
      <span>{t('detail.addSubtask')}</span>
    </button>
  );
  return (
    <input
      autoFocus data-field="new-subtask" aria-label={t('detail.addSubtask')}
      placeholder={t('detail.newSubtaskPlaceholder')}
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter' && value.trim()) { onAdd(value.trim()); setValue(''); }
        if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); setValue(''); }
      }}
      onBlur={() => { if (value.trim()) onAdd(value.trim()); setOpen(false); setValue(''); }}
      style={{
        width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '7px 10px',
        background: T.paper, border: `1px solid ${T.accent}`, borderRadius: T.r6,
        fontSize: 13, color: T.ink, fontFamily: T.fontUI, outline: 'none',
      }}
    />
  );
}

// Notes, written in place. The panel used to show `description` under the
// heading « Notes », read-only — while the form's Notes field wrote `notes`,
// which the panel never displayed. Nowhere could a note be written and seen.
// Saved as you type (after a pause) and on leaving the field; the 5-second
// refresh never overwrites what is being typed.
// Lot E1: every field of the task is edited where it is shown and saved when
// it is left — the window is the editor. The form used to be a second one,
// reached by « Edit », where subtasks could only be deleted.
function TaskFields({ task, allTasks, onSaved, onEdited, onStatusChange, T }) {
  const { t } = useLocale();
  const [draft, setDraft] = useState({
    title: task.title || '', description: task.description || '',
    topic: task.tags?.[0] || '', estimate: task.estimatedDuration ? String(task.estimatedDuration) : '',
  });
  const [error, setError] = useState('');
  // A refresh that brings a field changed elsewhere is taken, unless it is
  // the one being typed in.
  const editing = useRef(null);
  useEffect(() => {
    setDraft(d => ({
      title: editing.current === 'title' ? d.title : task.title || '',
      description: editing.current === 'description' ? d.description : task.description || '',
      topic: editing.current === 'topic' ? d.topic : task.tags?.[0] || '',
      estimate: editing.current === 'estimate' ? d.estimate : task.estimatedDuration ? String(task.estimatedDuration) : '',
    }));
  }, [task.title, task.description, task.tags?.[0], task.estimatedDuration]);

  async function save(patch) {
    setError('');
    try {
      const r = await fetch(`${API}/tasks/${task.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      if (!r.ok) throw new Error();
      onSaved?.();
      onEdited?.(task, patch);
    } catch { setError(t('detail.fieldSaveFailed')); }
  }
  function commit(k) {
    editing.current = null;
    if (k === 'title') {
      const v = draft.title.trim();
      if (!v) { setDraft(d => ({ ...d, title: task.title })); return; }
      if (v !== task.title) save({ title: v });
    } else if (k === 'description') {
      if (draft.description !== (task.description || '')) save({ description: draft.description });
    } else if (k === 'topic') {
      const typed = draft.topic.trim();
      const v = typed ? knownSpelling(typed, topicsOf(allTasks).map(x => x.tag)) : '';
      if (v === (task.tags?.[0] || '')) { setDraft(d => ({ ...d, topic: v })); return; }
      const rest = (task.tags || []).slice(1).filter(x => x !== v);
      save({ tags: v ? [v, ...rest] : rest });
    } else if (k === 'estimate') {
      const n = Math.round(Number(draft.estimate));
      const v = draft.estimate.trim() && n > 0 ? n : null;
      if (v !== (task.estimatedDuration ?? null)) save({ estimatedDuration: v });
    }
  }
  const bind = (k) => ({
    value: draft[k],
    onFocus: () => { editing.current = k; },
    onChange: e => setDraft(d => ({ ...d, [k]: e.target.value })),
    onBlur: () => commit(k),
  });
  const enterLeaves = { onKeyDown: e => { if (e.key === 'Enter') e.currentTarget.blur(); } };
  const label = { fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40 };
  const field = {
    boxSizing: 'border-box', padding: '5px 8px', minWidth: 0,
    background: 'transparent', border: '1px solid transparent', borderRadius: T.r6,
    fontSize: 13, color: T.ink, fontFamily: T.fontUI, outline: 'none',
  };
  const focusRing = { onFocusCapture: e => { e.target.style.borderColor = T.hairline; e.target.style.background = T.paper; }, onBlurCapture: e => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent'; } };
  const topicsId = `topics-${task.id}`;
  return (
    <div {...focusRing} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input data-field="title" aria-label={t('form.title')} {...bind('title')} {...enterLeaves}
        style={{ ...field, fontSize: 21, fontWeight: 500, letterSpacing: '-0.02em', padding: '4px 8px', marginLeft: -8 }} />
      {error && <div role="alert" style={{ fontSize: 12, color: T.danger }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 4, alignItems: 'center' }}>
        <span style={label}>{t('detail.status')}</span>
        <select data-field="status" aria-label={t('detail.status')} value={task.status}
          onChange={e => onStatusChange(task, e.target.value)} style={{ ...field, cursor: 'pointer', justifySelf: 'start' }}>
          {['not_started', 'in_progress', 'done'].map(st => <option key={st} value={st}>{t(STATUS_KEY[st])}</option>)}
        </select>
        <span style={label}>{t('detail.topic')}</span>
        <input data-field="topic" aria-label={t('detail.topic')} list={topicsId} placeholder={t('detail.noTopic')} {...bind('topic')} {...enterLeaves} style={field} />
        <datalist id={topicsId}>{topicsOf(allTasks).map(x => <option key={x.tag} value={x.tag} />)}</datalist>
        <span style={label}>{t('detail.deadline')}</span>
        <input type="date" data-field="deadline" aria-label={t('a11y.deadline')} value={task.deadline || ''}
          onChange={e => save({ deadline: e.target.value || null })}
          style={{ ...field, fontFamily: T.fontMono, fontSize: 12.5, justifySelf: 'start' }} />
        <span style={label}>{t('detail.estimateMinutes')}</span>
        <input type="number" min="1" step="5" data-field="estimate" aria-label={t('detail.estimateMinutes')} placeholder="—" {...bind('estimate')} {...enterLeaves}
          style={{ ...field, width: 90, fontFamily: T.fontMono, fontSize: 12.5 }} />
      </div>
      <textarea data-field="description" aria-label={t('form.description')} placeholder={t('detail.descriptionPlaceholder')} rows={2} {...bind('description')}
        style={{ ...field, resize: 'vertical', lineHeight: 1.6, fontSize: 13.5, color: T.ink80, marginLeft: -8 }} />
    </div>
  );
}

function NotesEditor({ task, onSaved, T, t }) {
  const [value, setValue] = useState(task.notes || '');
  const [state, setState] = useState('idle');   // idle | saving | saved | error
  const dirty = useRef(false);
  const timer = useRef(null);
  const lastSaved = useRef(task.notes || '');

  // Another task opened: start from its notes.
  useEffect(() => {
    clearTimeout(timer.current);
    dirty.current = false;
    lastSaved.current = task.notes || '';
    setValue(task.notes || '');
    setState('idle');
  }, [task.id]);
  // Changed elsewhere (form, assistant) while nothing is being typed here.
  useEffect(() => {
    if (!dirty.current && (task.notes || '') !== lastSaved.current) {
      lastSaved.current = task.notes || '';
      setValue(task.notes || '');
    }
  }, [task.notes]);
  // Closed mid-sentence (Escape, ✕): what was typed is sent, not dropped.
  const pending = useRef(null);
  pending.current = { id: task.id, value };
  useEffect(() => () => {
    clearTimeout(timer.current);
    const { id, value: v } = pending.current;
    if (dirty.current && v !== lastSaved.current) {
      fetch(`${API}/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: v }) })
        .then(() => onSaved?.()).catch(() => {});
    }
  }, []);

  async function save(text) {
    clearTimeout(timer.current);
    if (text === lastSaved.current) { dirty.current = false; return; }
    setState('saving');
    try {
      const resp = await fetch(`${API}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: text }),
      });
      if (!resp.ok) throw new Error();
      lastSaved.current = text;
      dirty.current = false;
      setState('saved');
      onSaved?.();
    } catch {
      setState('error');
    }
  }

  return (
    <div>
      <textarea
        value={value}
        placeholder={t('detail.notesPlaceholder')}
        onChange={e => {
          const v = e.target.value;
          setValue(v); dirty.current = true; setState('idle');
          clearTimeout(timer.current);
          timer.current = setTimeout(() => save(v), 800);
        }}
        onBlur={() => save(value)}
        rows={4}
        style={{
          width: '100%', boxSizing: 'border-box', resize: 'vertical',
          minHeight: 66, padding: '10px 12px',
          background: T.paperSubtle, borderRadius: T.r6,
          border: `1px solid ${state === 'error' ? T.dangerBorder : T.hairlineSoft}`,
          fontSize: 13.5, color: T.ink, lineHeight: 1.65, fontFamily: T.fontUI,
          outline: 'none',
        }}
      />
      <div style={{ minHeight: 16, marginTop: 4, fontSize: 11.5, color: state === 'error' ? T.danger : T.ink40, fontFamily: T.fontUI }}>
        {state === 'saving' ? t('common.saving') : state === 'saved' ? t('detail.notesSaved') : state === 'error' ? t('detail.notesSaveFailed') : ''}
      </div>
    </div>
  );
}

export default function TaskDetailPanel({ task, allTasks, onClose, onEdit, onArchive, onDelete, onStatusChange, onSubtaskToggle, onTimerStart, onTimerStop, onSaved, onEdited, onFocusMode, onSomeday, onPromoted, onOutside }) {
  const [openSub, setOpenSub] = useState(null);   // the subtask open beside the task (2.8.0)
  useEscape(onClose);
  // Another task opened in place: its own subtask was not asked for.
  useEffect(() => { setOpenSub(null); }, [task.id]);
  const { T } = useTheme();
  const { t, fmtDate: fmtLocaleDate, dateLocale, fmtDuration } = useLocale();
  const [breaking, setBreaking] = useState(false);
  const [breakdownText, setBreakdownText] = useState('');
  const [breakdownError, setBreakdownError] = useState('');
  const breakdownAbortRef = useRef(null);

  useEffect(() => () => breakdownAbortRef.current?.abort(), []);

  async function handleBreakdown() {
    setBreaking(true);
    setBreakdownText('');
    setBreakdownError('');
    const controller = new AbortController();
    breakdownAbortRef.current = controller;
    try {
      const resp = await fetch(`${API}/tasks/${task.id}/breakdown`, { method: 'POST', signal: controller.signal });
      if (!resp.ok || !resp.body) throw new Error('Request failed');
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done || controller.signal.aborted) { reader.cancel(); break; }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) setBreakdownText(prev => prev + data.token);
            if (data.done)  { onSaved?.(); setBreaking(false); setBreakdownText(''); }
            // The server's sentence is English; a known failure has a code,
            // anything else is a provider message shown as the detail it is.
            if (data.error) {
              setBreakdownError(data.code === 'unparseable' ? t('detail.breakdownUnparseable') : t('detail.aiError', { detail: data.error }));
              setBreaking(false);
            }
          } catch {}
        }
      }
      // Guard: stream closed cleanly without a {done:true} SSE frame (e.g. server EOF)
      setBreaking(false);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setBreakdownError(t('detail.aiUnreachable'));
        setBreaking(false);
      }
    }
  }

  const { aiData } = task;

  // Live timer elapsed display
  const timerRunning = !!task.timerStarted;
  const [elapsedSec, setElapsedSec] = useState(() =>
    task.timerStarted ? Math.floor((Date.now() - new Date(task.timerStarted).getTime()) / 1000) : 0
  );
  // Reset when task changes (panel stays mounted but task prop switches)
  useEffect(() => {
    setElapsedSec(task.timerStarted ? Math.floor((Date.now() - new Date(task.timerStarted).getTime()) / 1000) : 0);
  }, [task.id, task.timerStarted]);
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - new Date(task.timerStarted).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, task.timerStarted]);

  function fmtElapsed(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
  }

  function fmtTracked(minutes) {
    if (!minutes || minutes < 0) return null;
    return fmtDuration(Math.ceil(minutes));
  }

  const subtasksDone  = task.subtasks?.filter(s => s.done).length || 0;
  const subtasksTotal = task.subtasks?.length || 0;

  const getTitle = id => allTasks.find(t => t.id === id)?.title || id;
  const sub = openSub ? (task.subtasks || []).find(x => x.id === openSub) : null;
  const narrow = useNarrow();
  // Wide: the subtask's page opens beside the task, in the same window.
  // Narrow: it takes the task's place; its path and Esc lead back.
  const sideBySide = !!sub && !narrow;
  const subOver = !!sub && narrow;
  const frameRef = useRef(null);
  // A click outside the window closes it — unless that click opened another
  // task (App decides: onOutside), or the press began inside the window.
  useEffect(() => {
    let downInside = false;
    const down = e => { downInside = !!frameRef.current?.contains(e.target); };
    const click = e => {
      if (downInside || frameRef.current?.contains(e.target) || !e.target.isConnected) return;
      // A toast's « Undo », a menu, another dialog: not a click on the page.
      if (e.target.closest?.('[data-keeps-window], [role="dialog"], [role="status"], [role="alertdialog"]')) return;
      onOutside?.();
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('click', click);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('click', click); };
  }, [onOutside]);
  async function promoteSub(id) {
    const plan = promote({ ...task, subtasks: currentSubtasks() }, id);
    if (!plan) return;
    try {
      const r = await fetch(`${API}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plan.task) });
      if (!r.ok) throw new Error('Server error');
      const { task: created } = await r.json();
      setOpenSub(null);
      await saveSubtasks(plan.parentSubtasks);
      onPromoted?.(created);
    } catch { setSubtaskError(t('detail.subtaskSaveFailed')); }
  }

  // Subtasks are saved whole, as the form does: PUT { subtasks }. Two typed
  // in a row used to lose the first: the second change started from the list
  // as it was before the first save came back. The last list sent is the base
  // until the refresh brings it back.
  const [subtaskError, setSubtaskError] = useState('');
  const sentSubtasks = useRef(null);
  const currentSubtasks = () => sentSubtasks.current ?? task.subtasks ?? [];
  useEffect(() => {
    if (sentSubtasks.current && JSON.stringify(sentSubtasks.current) === JSON.stringify(task.subtasks || [])) sentSubtasks.current = null;
  }, [task.subtasks]);
  async function saveSubtasks(subtasks) {
    sentSubtasks.current = subtasks;
    setSubtaskError('');
    try {
      const resp = await fetch(`${API}/tasks/${task.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtasks }),
      });
      if (!resp.ok) throw new Error('Server error');
      onSaved?.();
    } catch {
      sentSubtasks.current = null;
      setSubtaskError(t('detail.subtaskSaveFailed'));
    }
  }

  const historyEvents = task.history || [];
  const fmtTime = iso => new Date(iso).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });
  const fmtDate = iso => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return fmtTime(iso);
    return fmtLocaleDate(d) + ' ' + fmtTime(iso);
  };

  return (
    <>
      {/* A veil, not a wall: clicks go through it, so another task's title
          behind the window opens that task in place (lot E1). */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, top: 32, zIndex: 90, background: T.ink, opacity: 0.06, pointerEvents: 'none' }} />
      <div ref={frameRef} data-task-window role="dialog" aria-label={task.title} style={{
        // Centred by margins: the opening animation owns `transform`.
        position: 'fixed', top: 'max(56px, 9vh)', left: 0, right: 0, marginInline: 'auto',
        height: 'min(780px, calc(100vh - max(56px, 9vh) - 24px))',
        width: sideBySide ? TASK_WIDTH + SUB_PANEL_WIDTH : TASK_WIDTH, maxWidth: 'calc(100vw - 32px)',
        transition: 'width 0.16s ease',
        background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: T.r14,
        boxShadow: '0 24px 64px rgba(25,25,26,0.16), 0 2px 8px rgba(25,25,26,0.06)',
        display: 'flex', overflow: 'hidden', zIndex: 91,
        animation: 'fadeUp 0.14s ease-out', boxSizing: 'border-box', fontFamily: T.fontUI,
      }}>
      {!subOver && (
      <div data-detail-panel={task.id} style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '14px 22px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: T.ink40,
          }}>{t('detail.title')}</span>
          <button onClick={onClose} aria-label={t('common.close')} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: T.ink40, fontSize: 13, lineHeight: 1, padding: '2px 4px',
          }}>✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 22px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          <TaskFields key={task.id} task={task} allTasks={allTasks} onSaved={onSaved} onEdited={onEdited} onStatusChange={onStatusChange} T={T} />

          <div>
            <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 }}>{t('detail.notes')}</div>
            <NotesEditor key={task.id} task={task} onSaved={onSaved} T={T} t={t} />
          </div>

          {/* Recurrence — next to the deadline it counts from. It sat at the bottom,
              under the follow-up, where nobody found it. */}
          <div>
            <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 }}>{t('detail.recurrence')}</div>
            <select aria-label={t('detail.recurrence')}
              value={task.recurring || 'none'}
              onChange={async e => {
                const recurring = e.target.value;
                try {
                  const resp = await fetch(`${API}/tasks/${task.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    // A repeat counts from a deadline: without one, the first is today.
                    body: JSON.stringify(recurring !== 'none' && !task.deadline ? { recurring, deadline: localDay(new Date()) } : { recurring }),
                  });
                  if (!resp.ok) throw new Error();
                  onSaved?.();
                  onEdited?.(task, recurring !== 'none' && !task.deadline ? { recurring, deadline: null } : { recurring });
                } catch {}
              }}
              style={{
                fontFamily: T.fontMono, fontSize: 12.5, color: T.ink60,
                background: T.paperSubtle, border: `1px solid ${T.hairline}`,
                borderRadius: T.r6, padding: '5px 10px', cursor: 'pointer',
              }}
            >
              <option value="none">{t('recur.none')}</option>
              <option value="daily">{t('recur.daily')}</option>
              <option value="weekly">{t('recur.weekly')}</option>
              <option value="monthly">{t('recur.monthly')}</option>
            </select>
          </div>

          <TaskSuggestions key={task.id} task={task} allTasks={allTasks} T={T} onSaved={onSaved} onEdited={onEdited} onBreakdown={handleBreakdown} />
          <PriorityRow task={task} T={T} onSaved={onSaved} onEdited={onEdited} />
          <DifficultyRow task={task} T={T} onSaved={onSaved} onEdited={onEdited} />
          <ReminderRow task={task} T={T} onSaved={onSaved} onEdited={onEdited} />
          <LinksSection task={task} allTasks={allTasks} T={T} onSaved={onSaved} />

          {/* Subtasks — expandable cards */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40 }}>{t('task.subtasks')}</div>
              <button
                onClick={handleBreakdown}
                disabled={breaking}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 11, color: breaking ? T.ink40 : T.accentInk,
                  background: T.accentSoft, border: `1px solid ${T.hairline}`,
                  borderRadius: T.rPill, padding: '3px 9px', cursor: breaking ? 'default' : 'pointer',
                  fontFamily: T.fontUI, opacity: breaking ? 0.7 : 1,
                }}
              >
                {breaking ? (
                  <><span style={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${T.accent}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />{t('detail.working')}</>
                ) : t('detail.breakDown')}
              </button>
            </div>

            {subtaskError && (
              <div role="alert" style={{ marginBottom: 8, padding: '6px 10px', background: T.dangerSoft, border: `1px solid ${T.dangerBorder}`, borderRadius: T.r6, fontSize: 12, color: T.danger }}>{subtaskError}</div>
            )}
            {breakdownError && (
              <div style={{ marginBottom: 8, padding: '6px 10px', background: T.dangerSoft, border: `1px solid ${T.dangerBorder}`, borderRadius: T.r6, fontSize: 12, color: T.danger, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{breakdownError}</span>
                <button onClick={() => setBreakdownError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.danger, fontSize: 13, padding: 0 }}>✕</button>
              </div>
            )}

            {breaking && breakdownText && (
              <div style={{ marginBottom: 8, padding: '8px 10px', background: T.paperSubtle, border: `1px solid ${T.hairline}`, borderRadius: T.r6, fontSize: 11.5, color: T.ink60, fontFamily: T.fontMono, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>
                {breakdownText}
                <span style={{ display: 'inline-block', width: 2, height: 12, background: T.accent, marginLeft: 2, verticalAlign: 'middle', animation: 'clarityBlink 1s steps(2) infinite' }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {task.subtasks?.map(s => (
                <SubtaskCard key={s.id} subtask={s} task={task} onToggle={onSubtaskToggle} T={T}
                  open={openSub === s.id} onOpen={(id) => setOpenSub(cur => (cur === id ? null : id))} />
              ))}
            </div>
            <AddSubtask T={T} t={t}
              onAdd={(title) => saveSubtasks([...currentSubtasks(), { id: newId(), title, notes: '', dueDate: null, done: false }])} />
          </div>

          {/* Follow-up thread — why it has not happened, which is the part anyone can help with */}
          <FollowUp task={task} />

          {/* Activity log */}
          <div>
            <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 }}>{t('detail.activity')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {historyEvents.length > 0 ? [...historyEvents].reverse().map((h, i) => (
                <div key={`${h.at}-${h.type}-${i}`} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40, minWidth: 64, flexShrink: 0 }}>{fmtDate(h.at)}</span>
                  <span style={{ fontSize: 12.5, color: h.type === 'status' && h.to === 'done' ? T.done : T.ink60 }}>{historyLabel(h, t, fmtLocaleDate)}</span>
                </div>
              )) : task.createdAt ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40, minWidth: 64 }}>{fmtTime(task.createdAt)}</span>
                  <span style={{ fontSize: 12.5, color: T.ink60 }}>{t('detail.history.created')}</span>
                </div>
              ) : null}
              {aiData?.priority && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40, minWidth: 64 }}>{t('detail.ai')}</span>
                  <span style={{ fontSize: 12.5, color: T.accentInk }}>{t('detail.priorityAssigned', { n: aiData.priority })}</span>
                </div>
              )}
            </div>
          </div>

          {/* AI Reasoning */}
          {aiData?.reasoning && (
            <div style={{
              padding: '14px 16px', background: T.accentSoft,
              borderRadius: T.r10, border: `1px solid ${T.hairline}`,
            }}>
              <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 }}>{t('detail.whyAiPriority')}</div>
              <p style={{ margin: 0, fontSize: 13, color: T.accentInk, lineHeight: 1.65, opacity: 0.9 }}>
                {aiData.reasoning}
              </p>
            </div>
          )}

          {/* Action Plan */}
          {aiData?.actionPlan?.length > 0 && (
            <div>
              <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 }}>{t('detail.aiActionPlan')}</div>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {aiData.actionPlan.map((step, i) => (
                  <li key={i} style={{
                    display: 'flex', gap: 10, padding: '8px 10px',
                    background: T.paperSubtle, borderRadius: T.r6,
                    border: `1px solid ${T.hairlineSoft}`,
                  }}>
                    <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.accent, fontWeight: 600, flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Timer */}
          <div>
            <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 }}>{t('detail.timer')}</div>
            {timerRunning ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', background: T.paperSubtle,
                borderRadius: T.r6, border: `1px solid ${T.hairlineSoft}`,
              }}>
                <span style={{ position: 'relative', flexShrink: 0 }}>
                  <span style={{ display: 'block', width: 7, height: 7, borderRadius: '50%', background: T.warn, animation: 'timerPulse 1.4s ease-in-out infinite' }} />
                  <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `1px solid ${T.warn}`, opacity: 0.35 }} />
                </span>
                <span style={{ flex: 1, fontFamily: T.fontMono, fontSize: 13, fontWeight: 500, color: T.ink }}>
                  {fmtElapsed(elapsedSec)}
                </span>
                <button
                  onClick={() => onTimerStop?.(task.id)}
                  style={{
                    fontSize: 12, color: T.ink60, background: 'transparent',
                    border: 'none', cursor: 'pointer', fontFamily: T.fontUI, padding: 0,
                  }}
                >{t('detail.stop')}</button>
              </div>
            ) : (
              <div
                onClick={() => onTimerStart?.(task.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: T.paperSubtle,
                  borderRadius: T.r6, border: `1px solid ${T.hairlineSoft}`,
                  cursor: 'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.background = T.paperMuted}
                onMouseLeave={e => e.currentTarget.style.background = T.paperSubtle}
              >
                <span style={{ fontSize: 12, color: T.ink60 }}>▶</span>
                <span style={{ fontSize: 13, color: T.ink60 }}>{t('detail.startTimer')}</span>
              </div>
            )}
            {task.timeTracked > 0 && (
              <div style={{ marginTop: 6, fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>
                {t('detail.trackedTotal', { time: fmtTracked(task.timeTracked) })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px', borderTop: `1px solid ${T.hairlineSoft}`,
          display: 'flex', gap: 8, flexShrink: 0,
        }}>
          <button
            onClick={() => onStatusChange(task, task.status === 'done' ? 'not_started' : 'done')}
            style={{
              flex: 1, padding: '8px 12px',
              background: T.ink, border: 'none',
              borderRadius: T.r6, fontSize: 12.5, fontWeight: 500,
              color: T.paper, cursor: 'pointer', fontFamily: T.fontUI,
            }}
          >
            {task.status === 'done' ? t('detail.markIncomplete') : t('detail.markComplete')}
          </button>
          {onFocusMode && task.status !== 'done' && (
            <button onClick={() => { onFocusMode(task); onClose(); }} style={{
              padding: '8px 12px', background: 'transparent',
              border: `1px solid ${T.hairline}`, borderRadius: T.r6,
              fontSize: 12.5, color: T.accentInk, cursor: 'pointer', fontFamily: T.fontUI,
            }}>{t('task.focus')}</button>
          )}
          {onSomeday && task.status !== 'done' && (
            <button data-action="someday" onClick={() => onSomeday(task, !task.someday)} style={{
              padding: '8px 12px', background: 'transparent',
              border: `1px solid ${T.hairline}`, borderRadius: T.r6,
              fontSize: 12.5, color: T.ink60, cursor: 'pointer', fontFamily: T.fontUI,
            }}>{t(task.someday ? 'someday.bringBack' : 'someday.put')}</button>
          )}
          <button onClick={() => onDelete(task.id)} style={{
            padding: '8px 12px', background: 'transparent',
            border: `1px solid ${T.hairline}`, borderRadius: T.r6,
            fontSize: 12.5, color: T.ink60, cursor: 'pointer', fontFamily: T.fontUI,
          }}>{t('common.delete')}</button>
        </div>
      </div>
      )}
      {sub && (
        <SubtaskPanel key={sub.id} task={task} subtask={sub} T={T} side={!narrow}
          onClose={() => setOpenSub(null)}
          onChange={(patch) => saveSubtasks(withSubtask(currentSubtasks(), sub.id, patch))}
          onRemove={() => { setOpenSub(null); saveSubtasks(currentSubtasks().filter(x => x.id !== sub.id)); }}
          onPromote={() => promoteSub(sub.id)} />
      )}
      </div>
    </>
  );
}
