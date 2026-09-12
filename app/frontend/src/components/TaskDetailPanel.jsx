import { useState, useEffect, useRef } from 'react';
import FollowUp from './FollowUp.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

const API = 'http://localhost:3001/api';


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

function daysUntil(deadline) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline + 'T00:00:00') - new Date()) / 86400000);
}

function TDPill({ label, value, accent, T }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 8px',
      background: accent ? T.accentSoft : T.paperSubtle,
      border: `1px solid ${accent ? T.accent : T.hairline}`,
      borderRadius: T.rPill, fontSize: 11.5,
      color: accent ? T.accentInk : T.ink80,
    }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: accent ? T.accentInk : T.ink40, opacity: 0.75 }}>{label}</span>
      {value}
    </span>
  );
}

function SubtaskCard({ subtask: s, task, onToggle, onOpen, T }) {
  const { t, fmtDate } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [hov, setHov] = useState(false);

  return (
    <div
      style={{
        background: T.paperSubtle, borderRadius: T.r6,
        border: `1px solid ${T.hairlineSoft}`,
        overflow: 'hidden',
        transition: 'border-color 0.1s',
        borderColor: hov && !expanded ? T.hairline : T.hairlineSoft,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* Header row — always visible */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 12px', cursor: 'pointer',
        }}
      >
        {/* Check circle */}
        <span
          onClick={e => { e.stopPropagation(); onToggle?.(task, s.id); }}
          style={{
            width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
            background: s.done ? T.done : 'transparent',
            border: `1.5px solid ${s.done ? T.done : T.ink40}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {s.done && <span style={{ color: T.paper, fontSize: 8, lineHeight: 1 }}>✓</span>}
        </span>
        <span style={{
          flex: 1, fontSize: 13, color: s.done ? T.ink40 : T.ink,
          textDecoration: s.done ? 'line-through' : 'none',
          lineHeight: 1.4,
        }}>{s.title}</span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke={T.ink40} strokeWidth="2.5"
          style={{ flexShrink: 0, transition: 'transform 0.15s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: `1px solid ${T.hairlineSoft}` }}>
          <div style={{ paddingTop: 10, fontSize: 12.5, color: T.ink40, lineHeight: 1.5 }}>
            {s.notes || <span style={{ fontStyle: 'italic' }}>{t('detail.noNotes')}</span>}
          </div>
          {s.dueDate && (
            <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>
              {t('detail.due')}: {fmtDate(s.dueDate + 'T00:00:00')}
            </div>
          )}
          <button
            onClick={() => onOpen?.(task)}
            style={{
              alignSelf: 'flex-start', padding: '5px 12px',
              background: T.paper, border: `1px solid ${T.hairline}`,
              borderRadius: T.r6, fontSize: 12, color: T.ink60,
              cursor: 'pointer', fontFamily: T.fontUI,
            }}
          >{t('detail.openInEditor')}</button>
        </div>
      )}
    </div>
  );
}

export default function TaskDetailPanel({ task, allTasks, onClose, onEdit, onArchive, onDelete, onStatusChange, onSubtaskToggle, onTimerStart, onTimerStop, onSaved, onFocusMode }) {
  const { T } = useTheme();
  const { t, fmtDate: fmtLocaleDate, dateLocale } = useLocale();
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');
  const [newDeadline, setNewDeadline] = useState(task.deadline || '');
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
            if (data.error) { setBreakdownError(data.error); setBreaking(false); }
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

  useEffect(() => { setNewDeadline(task.deadline || ''); }, [task.id]);

  const { aiData } = task;
  const days = daysUntil(task.deadline);

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
    if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${Math.ceil(minutes % 60)}m`;
    return `${Math.ceil(minutes)}m`;
  }
  const isOverdue = days !== null && days < 0 && task.status !== 'done';
  const isUrgent  = days !== null && days >= 0 && days <= 3 && task.status !== 'done';

  const subtasksDone  = task.subtasks?.filter(s => s.done).length || 0;
  const subtasksTotal = task.subtasks?.length || 0;

  const getTitle = id => allTasks.find(t => t.id === id)?.title || id;

  async function handleReschedule() {
    setRescheduleError('');
    try {
      const resp = await fetch(`${API}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deadline: newDeadline || null }),
      });
      if (!resp.ok) throw new Error('Server error');
      onSaved?.();
      setRescheduling(false);
    } catch {
      setRescheduleError(t('detail.deadlineSaveFailed'));
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
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
      <div style={{
        position: 'fixed', top: 32, right: 0, bottom: 0, width: 360,
        background: T.paper,
        borderLeft: `1px solid ${T.hairline}`,
        display: 'flex', flexDirection: 'column',
        zIndex: 91,
        animation: 'slideIn 0.18s ease-out',
        boxSizing: 'border-box',
        fontFamily: T.fontUI,
      }}>
        {/* Header row 1: label + close */}
        <div style={{
          padding: '14px 18px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: T.ink40,
          }}>{t('detail.title')}</span>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: T.ink40, fontSize: 13, lineHeight: 1, padding: '2px 4px',
          }}>✕</button>
        </div>

        {/* Header row 2: task title */}
        <div style={{
          padding: '10px 18px 10px',
          borderBottom: `1px solid ${T.hairline}`,
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: 15.5, fontWeight: 500, letterSpacing: '-0.02em',
            color: T.ink, lineHeight: 1.35,
          }}>{task.title}</div>
        </div>

        {/* Header row 3: meta pills */}
        <div style={{
          padding: '10px 18px',
          display: 'flex', flexWrap: 'wrap', gap: 6,
          borderBottom: `1px solid ${T.hairlineSoft}`,
          flexShrink: 0,
        }}>
          {task.deadline && (
            <TDPill
              label={t('detail.due')}
              value={fmtLocaleDate(task.deadline + 'T00:00:00')}
              accent={true}
              T={T}
            />
          )}
          {task.timeTracked > 0 && (
            <TDPill
              label={t('detail.tracked')}
              value={task.timeTracked >= 60
                ? `${Math.floor(task.timeTracked / 60)}h ${task.timeTracked % 60}m`
                : `${task.timeTracked}m`}
              accent={false}
              T={T}
            />
          )}
          {task.tags?.[0] && (
            <TDPill
              label={t('detail.topic')}
              value={task.tags[0]}
              accent={false}
              T={T}
            />
          )}
          {aiData?.priority && (
            <TDPill
              label={t('detail.priority')}
              value={`#${aiData.priority}`}
              accent={true}
              T={T}
            />
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Notes / Description */}
          <div>
            <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 }}>{t('detail.notes')}</div>
            <div style={{
              minHeight: 66, padding: '10px 12px',
              background: T.paperSubtle, borderRadius: T.r6,
              border: `1px solid ${T.hairlineSoft}`,
              fontSize: 13.5, color: task.description ? T.ink : T.ink40,
              lineHeight: 1.65,
            }}>
              {task.description || 'No notes yet.'}
            </div>

            {/* Deadline reschedule inline */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 }}>{t('detail.deadline')}</div>
              {rescheduling ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {rescheduleError && (
                    <div style={{ fontSize: 11.5, color: T.danger }}>{rescheduleError}</div>
                  )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={e => setNewDeadline(e.target.value)}
                    autoFocus
                    style={{
                      flex: 1, padding: '7px 10px',
                      background: T.paper, border: `1px solid ${T.hairline}`,
                      borderRadius: T.r6, fontSize: 13, color: T.ink, fontFamily: T.fontUI,
                    }}
                  />
                  <button onClick={handleReschedule} style={{
                    padding: '7px 12px', background: T.ink, border: 'none',
                    borderRadius: T.r6, fontSize: 12, color: T.paper, cursor: 'pointer', fontFamily: T.fontUI,
                  }}>{t('common.save')}</button>
                  <button onClick={() => { setRescheduling(false); setRescheduleError(''); }} style={{
                    padding: '7px 12px', background: T.paperSubtle, border: `1px solid ${T.hairline}`,
                    borderRadius: T.r6, fontSize: 12, color: T.ink60, cursor: 'pointer', fontFamily: T.fontUI,
                  }}>✕</button>
                </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {task.deadline ? (
                    <span style={{ fontFamily: T.fontMono, fontSize: 12.5, color: isOverdue ? T.warn : isUrgent ? T.warn : T.ink }}>
                      {fmtLocaleDate(task.deadline + 'T00:00:00', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {days !== null && (
                        <span style={{ marginLeft: 8, color: isOverdue ? T.warn : T.ink40 }}>
                          {isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? '· today' : `· in ${days}d`}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12.5, color: T.ink40 }}>{t('detail.noDeadline')}</span>
                  )}
                  <button
                    onClick={() => { setNewDeadline(task.deadline || ''); setRescheduling(true); }}
                    style={{
                      fontSize: 11.5, color: T.accent, background: 'transparent', border: 'none',
                      cursor: 'pointer', fontFamily: T.fontUI, padding: '2px 0',
                    }}
                  >
                    {task.deadline ? t('detail.reschedule') : t('detail.setDate')}
                  </button>
                </div>
              )}
            </div>
          </div>

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
                <SubtaskCard key={s.id} subtask={s} task={task} onToggle={onSubtaskToggle} onOpen={onEdit} T={T} />
              ))}
            </div>
            <button
              onClick={() => onEdit(task)}
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
          </div>

          {/* Follow-up thread — why it has not happened, which is the part anyone can help with */}
          <FollowUp task={task} />

          {/* Recurrence */}
          <div>
            <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 }}>{t('detail.recurrence')}</div>
            <select
              value={task.recurring || 'none'}
              onChange={async e => {
                const recurring = e.target.value;
                try {
                  const resp = await fetch(`${API}/tasks/${task.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recurring }),
                  });
                  if (!resp.ok) throw new Error();
                  onSaved?.();
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
                  <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40, minWidth: 64 }}>AI</span>
                  <span style={{ fontSize: 12.5, color: T.accentInk }}>Priority #{aiData.priority} assigned</span>
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

          {/* Dependencies */}
          {aiData?.dependencies?.length > 0 && (
            <div>
              <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 }}>{t('task.mustCompleteFirst')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {aiData.dependencies.map(id => (
                  <div key={id} style={{
                    padding: '8px 12px', background: T.paperSubtle,
                    border: `1px solid ${T.hairlineSoft}`, borderRadius: T.r6,
                    fontSize: 13, color: T.ink60,
                  }}>{getTitle(id)}</div>
                ))}
              </div>
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
                Tracked: {fmtTracked(task.timeTracked)}
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
          <button onClick={() => onDelete(task.id)} style={{
            padding: '8px 12px', background: 'transparent',
            border: `1px solid ${T.hairline}`, borderRadius: T.r6,
            fontSize: 12.5, color: T.ink60, cursor: 'pointer', fontFamily: T.fontUI,
          }}>{t('common.delete')}</button>
        </div>
      </div>
    </>
  );
}
