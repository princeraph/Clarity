import { useState, useEffect } from 'react';
import { tagColor } from './TaskForm.jsx';
import { LEVEL_STYLE, levelTone, shownLevel } from '../lib/niveaux.js';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

const RECURRING_KEY = { daily: 'recur.daily', weekly: 'recur.weekly', monthly: 'recur.monthly' };

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function daysUntil(deadline) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline + 'T00:00:00') - new Date()) / 86400000);
}

// Tasks ticked in the last moments. The list moves a finished task to another
// group, which mounts a new card: the bounce is remembered here, not in the
// card, so it plays where the task lands.
const justTicked = new Map();
const TICK_MS = 900;
function recentlyTicked(id) {
  const at = justTicked.get(id);
  return at != null && Date.now() - at < TICK_MS;
}

function CircleCheck({ done, focus, stale, pop, T }) {
  const color = focus ? T.accent : stale ? T.warn : T.ink40;
  const size = T.taskCheckSize || 16;
  return (
    <div className={pop ? 'clarity-check-pop' : undefined} style={{
      transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
      transform: done ? 'scale(1)' : undefined,
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      border: `1.5px solid ${done ? T.done : color}`,
      background: done ? T.done : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {done && (
        <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2">
          <polyline points="2 5 4.5 7.5 8 3"/>
        </svg>
      )}
    </div>
  );
}

export default function TaskCard({ task, allTasks, onEdit, onDelete, onArchive, onStatusChange, onSubtaskToggle, onTimerStart, onTimerStop, onOpenDetail, onContextMenu }) {
  const { T, isDark } = useTheme();
  const { t, fmtDate, fmtDuration } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [hov, setHov] = useState(false);
  // Shown done from the click, not from the server's answer a moment later.
  const [ticking, setTicking] = useState(false);
  useEffect(() => { setTicking(false); }, [task.status]);
  const { aiData } = task;
  const days = daysUntil(task.deadline);
  const isOverdue  = days !== null && days < 0 && task.status !== 'done';
  const isUrgent   = days !== null && days >= 0 && days <= 3 && task.status !== 'done';
  const isDone     = task.status === 'done';
  const isFocus    = aiData?.priorityLevel === 'high' || aiData?.priority === 1;
  const isStale    = false; // could detect via createdAt age

  const subtasksDone  = task.subtasks?.filter(s => s.done).length || 0;
  const subtasksTotal = task.subtasks?.length || 0;
  const timeLabel     = Math.round(task.timeTracked) >= 1 ? fmtDuration(task.timeTracked) : '';
  const timerRunning  = !!task.timerStarted;
  const [elapsedMin, setElapsedMin] = useState(0);

  useEffect(() => {
    if (!timerRunning || !task.timerStarted || task.status === 'done') { setElapsedMin(0); return; }
    const tick = () => setElapsedMin(Math.ceil((Date.now() - new Date(task.timerStarted).getTime()) / 60000));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [timerRunning, task.timerStarted, task.status]);
  const getTitle      = id => (allTasks || []).find(t => t.id === id)?.title || id;
  // The level, seen (2.1.0): a bar on the left — thicker the higher, dashed
  // when inherited —, the name of the two highest, a tint for « Absolute ».
  const shown = shownLevel(task);
  const tone  = levelTone(shown.level, isDark);
  const lvl   = LEVEL_STYLE[shown.level];
  const tinted = shown.level === 'top' && !shown.inherited && !isDone;

  return (
    <div
      className="clarity-card clarity-task"
      data-task-id={task.id}
      tabIndex={0}
      aria-label={task.title}
      aria-description={t(lvl.key)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(e, task); } : undefined}
      style={{
        display: 'grid', gridTemplateColumns: `${T.taskCheckSize || 16}px 1fr auto`, alignItems: 'start', gap: T.taskGap || 14,
        position: 'relative',
        padding: `${T.taskPadV || 12}px ${T.taskPadH || 4}px ${T.taskPadV || 12}px ${(T.taskPadH || 4) + 10}px`,
        borderBottom: `1px solid ${T.hairlineSoft}`,
        opacity: isDone ? 0.5 : 1,
        background: hov ? (tinted ? tone.fill : T.paperSubtle) : (tinted ? tone.wash : 'transparent'),
        borderRadius: T.r6,
        transition: 'opacity 0.3s ease, background-color 0.15s ease',
        '--focus-ring': T.accent,
      }}
    >
      <span data-level={task.priority || undefined} data-level-bar={shown.level} data-inherited={shown.inherited ? '' : undefined} aria-hidden="true" style={{
        position: 'absolute', left: 0, top: 7, bottom: 7, width: 0,
        borderLeft: `${lvl.weight}px ${shown.inherited ? 'dashed' : 'solid'} ${tone.bar}`,
        borderRadius: 2, opacity: isDone ? 0.5 : 1,
      }} />
      {/* Check circle */}
      <button
        data-check
        onClick={async () => {
          if (isDone) { onStatusChange(task, 'not_started'); return; }
          justTicked.set(task.id, Date.now());
          setTicking(true);
          const r = await onStatusChange(task, 'done');
          if (r === false) { justTicked.delete(task.id); setTicking(false); }
        }}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}
        title={isDone ? t('task.markIncomplete') : t('task.markComplete')}
      >
        <CircleCheck done={isDone || ticking} focus={isFocus} pop={(isDone || ticking) && recentlyTicked(task.id)} T={T} />
      </button>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span
            onClick={onOpenDetail ? () => onOpenDetail(task) : undefined}
            style={{
              fontSize: T.taskTitleSize || 14.5, color: T.ink,
              fontWeight: isFocus ? 500 : 400,
              letterSpacing: '-0.005em',
              textDecoration: isDone ? 'line-through' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              cursor: onOpenDetail ? 'pointer' : 'default',
            }}
          >{task.title}</span>
          {lvl.labelled && !isDone && (
            <span data-level-label={shown.level} style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.01em', flexShrink: 0,
              color: tone.ink, background: tone.fill, border: `1px solid ${tone.bar}`,
              padding: '1px 7px', borderRadius: T.rPill, borderStyle: shown.inherited ? 'dashed' : 'solid',
            }}>{t(lvl.key)}</span>
          )}
          {isFocus && !isDone && (
            <span style={{
              fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: T.accentInk,
              padding: '2px 6px', background: T.accentSoft, borderRadius: 3,
              flexShrink: 0,
            }}>{t('task.focus')}</span>
          )}
          {task.recurring && task.recurring !== 'none' && (
            <span style={{
              fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.06em',
              color: T.ink60, flexShrink: 0,
            }}>{RECURRING_KEY[task.recurring] ? t(RECURRING_KEY[task.recurring]) : task.recurring}</span>
          )}
        </div>

        {task.description && (
          <p style={{ fontSize: 12.5, color: T.ink60, lineHeight: 1.5, margin: 0 }}>
            {task.description}
          </p>
        )}

        {/* Tags */}
        {task.tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {task.tags.map(tag => {
              const c = tagColor(tag);
              return (
                <span key={tag} style={{
                  fontSize: 10.5, padding: '2px 7px', borderRadius: T.rPill,
                  background: T.paperSubtle, color: T.ink60,
                  border: `1px solid ${T.hairline}`,
                  fontFamily: T.fontMono, letterSpacing: '0.04em',
                }}>
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        {/* Meta row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          {task.deadline && (
            <span style={{
              fontFamily: T.fontMono, fontSize: 11,
              color: isOverdue ? T.warn : isUrgent ? T.warn : T.ink60,
            }}>
              {fmtDate(task.deadline + 'T00:00:00')}
              {days !== null && (
                <span style={{ marginLeft: 5, color: isOverdue ? T.warn : T.ink40 }}>
                  {isOverdue ? t('due.overdueDays', { n: Math.abs(days) }) : days === 0 ? t('due.today') : t('due.inDays', { n: days })}
                </span>
              )}
            </span>
          )}

          {subtasksTotal > 0 && (
            <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>
              {t('task.subtaskCount', { done: subtasksDone, total: subtasksTotal })}
            </span>
          )}

          {task.status !== 'done' && (onTimerStart || onTimerStop) && (
            <button
              onClick={() => timerRunning ? onTimerStop?.(task.id) : onTimerStart?.(task.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: T.fontMono, fontSize: 10.5,
                padding: '2px 8px', borderRadius: T.rPill,
                background: timerRunning ? T.accentSoft : T.paperSubtle,
                color: timerRunning ? T.accentInk : T.ink60,
                border: `1px solid ${timerRunning ? T.accent : T.hairline}`,
                cursor: 'pointer',
              }}
            >
              {timerRunning
                ? <><span style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, animation: 'timerPulse 1.5s ease-in-out infinite', flexShrink: 0 }} /> {t('task.timerRunning', { time: fmtDuration(elapsedMin) })}</>
                : <>{timeLabel ? t('task.timeLogged', { time: timeLabel }) : t('task.track')}</>
              }
            </button>
          )}

          {aiData?.priority && (
            <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40 }}>
              #{aiData.priority}
            </span>
          )}

          {/* Its reminder (2.3.0): the hour, and the day when it is not today. */}
          {task.reminder && !isDone && (
            <span data-chip="reminder" title={t('remind.title')} style={chip(T, T.ink60)}>🔔 {task.reminder.slice(11)}{task.reminder.slice(0, 10) !== localToday() ? ` · ${fmtDate(task.reminder.slice(0, 10) + 'T00:00:00', { day: 'numeric', month: 'short' })}` : ''}</span>
          )}
          {/* Links (lib/ordre.js): what holds this one up, what it holds up,
              and what it inherited for it. */}
          {task.status !== 'done' && task.order?.blockedBy?.length > 0 && (
            <span data-chip="blocked" title={task.order.blockedBy.map(getTitle).join(', ')} style={chip(T, task.order.blocked ? T.warn : T.ink60)}>
              {t(task.order.blocked ? 'links.blockedBy' : 'links.betterAfter', { n: task.order.blockedBy.length })}
            </span>
          )}
          {task.status !== 'done' && task.order?.blocks?.length > 0 && (
            <span data-chip="unblocks" title={task.order.blocks.map(getTitle).join(', ')} style={chip(T, T.ink60)}>
              {t('links.unblocks', { n: task.order.blocks.length })}
            </span>
          )}
          {task.status !== 'done' && task.order?.inheritedFrom && (
            <span data-chip="inherited" style={chip(T, LEVEL_STYLE[task.order.level]?.color || T.ink60)}>
              {t('links.inherited', { level: t(LEVEL_STYLE[task.order.level]?.key || 'level.medium'), title: getTitle(task.order.inheritedFrom) })}
            </span>
          )}
          {task.status !== 'done' && task.suggestions?.length > 0 && onOpenDetail && (
            <button type="button" data-chip="suggest" onClick={() => onOpenDetail(task)} title={t('propose.chipTitle')} style={{ ...chip(T, T.accentInk), background: T.accentSoft, cursor: 'pointer' }}>
              ✦ {task.suggestions.length}
            </button>
          )}
          {task.status !== 'done' && task.order?.deadlineFor && (
            <span data-chip="before" style={chip(T, T.warn)}>
              {t('links.before', { date: fmtDate(task.order.deadline + 'T00:00:00'), title: getTitle(task.order.deadlineFor) })}
            </span>
          )}
        </div>

        {/* Subtask progress bar */}
        {subtasksTotal > 0 && (
          <div style={{ height: 2, background: T.hairline, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: T.accent,
              borderRadius: 99, width: `${(subtasksDone / subtasksTotal) * 100}%`,
              transition: 'width 0.3s',
            }} />
          </div>
        )}

        {/* Expand toggle */}
        {!!(aiData?.reasoning || subtasksTotal > 0 || aiData?.actionPlan?.length) && (
          <button
            onClick={() => setExpanded(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11.5, color: T.ink40, background: 'transparent',
              border: 'none', cursor: 'pointer', padding: 0, fontFamily: T.fontUI,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transition: 'transform 0.15s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            {expanded ? t('task.lessDetail') : t('task.moreDetail')}
          </button>
        )}

        {/* Expanded */}
        {expanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeUp 0.15s ease-out' }}>
            {subtasksTotal > 0 && (
              <div style={{ padding: '10px 12px', background: T.paperSubtle, borderRadius: T.r6, border: `1px solid ${T.hairlineSoft}` }}>
                <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 }}>{t('task.subtasks')}</div>
                {task.subtasks.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', cursor: 'pointer' }}>
                    <input aria-label={t('a11y.subtaskDone')} type="checkbox" checked={s.done} onChange={() => onSubtaskToggle(task, s.id)}
                      style={{ accentColor: T.accent }} />
                    <span style={{ fontSize: 12.5, color: s.done ? T.ink40 : T.ink, textDecoration: s.done ? 'line-through' : 'none' }}>
                      {s.title}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {aiData?.actionPlan?.length > 0 && (
              <div style={{ padding: '10px 12px', background: T.paperSubtle, borderRadius: T.r6, border: `1px solid ${T.hairlineSoft}` }}>
                <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 }}>{t('task.actionPlan')}</div>
                <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {aiData.actionPlan.map((step, i) => (
                    <li key={i} style={{ fontSize: 12.5, color: T.ink60, display: 'flex', gap: 8 }}>
                      <span style={{ color: T.accent, fontWeight: 600, flexShrink: 0 }}>{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {aiData?.reasoning && (
              <div style={{ padding: '10px 12px', background: T.accentSoft, borderRadius: T.r6, border: `1px solid ${T.hairline}` }}>
                <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.accentInk, marginBottom: 6 }}>{t('task.whyPriority')}</div>
                <p style={{ fontSize: 12.5, color: T.accentInk, lineHeight: 1.6, margin: 0, opacity: 0.85 }}>{aiData.reasoning}</p>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Action buttons — appear on hover */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 3,
        opacity: hov ? 1 : 0, transition: 'opacity 0.15s',
      }}>
        <select aria-label={t('a11y.status')}
          value={task.status}
          onChange={e => onStatusChange(task, e.target.value)}
          style={{
            fontFamily: T.fontMono, fontSize: 10.5, padding: '3px 7px',
            background: T.paperSubtle, border: `1px solid ${T.hairline}`,
            borderRadius: T.r6, color: T.ink60, cursor: 'pointer',
            marginBottom: 4,
          }}
        >
          <option value="not_started">{t('status.notStarted')}</option>
          <option value="in_progress">{t('status.inProgress')}</option>
          <option value="done">{t('status.done')}</option>
        </select>
        <button onClick={() => onEdit(task)} style={actionBtn(T)}>{t('common.edit')}</button>
        <button onClick={() => onArchive(task.id)} style={actionBtn(T)}>{t('common.archive')}</button>
        <button onClick={() => onDelete(task.id)} style={{ ...actionBtn(T), color: T.danger }}>{t('common.delete')}</button>
      </div>
    </div>
  );
}

function actionBtn(T) {
  return {
    fontFamily: T.fontUI, fontSize: 11.5, padding: '3px 9px',
    background: T.paperSubtle, border: `1px solid ${T.hairline}`,
    borderRadius: T.r6, color: T.ink60, cursor: 'pointer',
    textAlign: 'center', whiteSpace: 'nowrap',
  };
}

function chip(T, color) {
  return {
    fontFamily: T.fontMono, fontSize: 10.5, padding: '1px 7px', borderRadius: T.rPill,
    border: `1px solid ${T.hairline}`, color, whiteSpace: 'nowrap',
    maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis',
  };
}
