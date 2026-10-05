import { useState, useEffect } from 'react';
import { tagColor } from './TaskForm.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

const RECURRING_KEY = { daily: 'recur.daily', weekly: 'recur.weekly', monthly: 'recur.monthly' };

function daysUntil(deadline) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline + 'T00:00:00') - new Date()) / 86400000);
}

function CircleCheck({ done, focus, stale, T }) {
  const color = focus ? T.accent : stale ? T.warn : T.ink40;
  const size = T.taskCheckSize || 16;
  return (
    <div style={{
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
  const { T } = useTheme();
  const { t, fmtDate, fmtDuration } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [hov, setHov] = useState(false);
  const { aiData } = task;
  const days = daysUntil(task.deadline);
  const isOverdue  = days !== null && days < 0 && task.status !== 'done';
  const isUrgent   = days !== null && days >= 0 && days <= 3 && task.status !== 'done';
  const isDone     = task.status === 'done';
  const isFocus    = aiData?.priorityLevel === 'high' || aiData?.priority === 1;
  const isStale    = false; // could detect via createdAt age

  const subtasksDone  = task.subtasks?.filter(s => s.done).length || 0;
  const subtasksTotal = task.subtasks?.length || 0;
  const timeLabel     = fmtDuration(task.timeTracked);
  const timerRunning  = !!task.timerStarted;
  const [elapsedMin, setElapsedMin] = useState(0);

  useEffect(() => {
    if (!timerRunning || !task.timerStarted || task.status === 'done') { setElapsedMin(0); return; }
    const tick = () => setElapsedMin(Math.ceil((Date.now() - new Date(task.timerStarted).getTime()) / 60000));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [timerRunning, task.timerStarted, task.status]);
  const getTitle      = id => allTasks.find(t => t.id === id)?.title || id;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(e, task); } : undefined}
      style={{
        display: 'grid', gridTemplateColumns: `${T.taskCheckSize || 16}px 1fr auto`, alignItems: 'start', gap: 14,
        padding: `${T.taskPadV || 12}px ${T.taskPadH || 4}px`,
        borderBottom: `1px solid ${T.hairlineSoft}`,
        opacity: isDone ? 0.5 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {/* Check circle */}
      <button
        onClick={() => onStatusChange(task, isDone ? 'not_started' : 'done')}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}
        title={isDone ? t('task.markIncomplete') : t('task.markComplete')}
      >
        <CircleCheck done={isDone} focus={isFocus} T={T} />
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
        {(aiData?.reasoning || subtasksTotal > 0 || aiData?.actionPlan?.length) && (
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
                    <input type="checkbox" checked={s.done} onChange={() => onSubtaskToggle(task, s.id)}
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

            {aiData?.dependencies?.length > 0 && (
              <div style={{ padding: '10px 12px', background: T.paperSubtle, borderRadius: T.r6, border: `1px solid ${T.hairlineSoft}` }}>
                <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 }}>{t('task.mustCompleteFirst')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {aiData.dependencies.map(id => (
                    <span key={id} style={{ fontSize: 12, padding: '3px 9px', background: T.paperMuted, color: T.ink60, borderRadius: T.rPill, border: `1px solid ${T.hairline}` }}>
                      {getTitle(id)}
                    </span>
                  ))}
                </div>
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
        <select
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
