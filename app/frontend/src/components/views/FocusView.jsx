import { useState, useEffect } from 'react';
import TaskCard from '../TaskCard.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import AiOfflineNotice from '../AiOfflineNotice.jsx';
import TimeBlockingStrip from '../TimeBlockingStrip.jsx';

const API = 'http://localhost:3001/api';

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return 'focus.greeting.morning';
  if (h < 17) return 'focus.greeting.afternoon';
  return 'focus.greeting.evening';
}

function getUserName() {
  try { return localStorage.getItem('clarity-userName') || ''; } catch { return ''; }
}

function StatPill({ label, value, accent, T }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '6px 12px',
      border: `1px solid ${T.hairline}`,
      borderRadius: T.rPill,
      background: T.paper,
      fontFamily: T.fontUI,
    }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 13, fontWeight: 500, color: accent || T.ink }}>{value}</span>
      <span style={{ fontSize: 12, color: T.ink60 }}>{label}</span>
    </span>
  );
}

function TaskGroup({ title, subtitle, muted, children, T }) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: Math.round((T.listGap || 26) / 2.5) }}>
        <h3 style={{ margin: 0, fontSize: T.sectionTitleSize || 13.5, fontWeight: 500, color: muted ? T.ink60 : T.ink, letterSpacing: '-0.005em' }}>
          {title}
        </h3>
        {subtitle && (
          <span style={{ fontFamily: T.fontMono, fontSize: 10.5, letterSpacing: '0.06em', color: T.ink40 }}>
            {subtitle}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
    </section>
  );
}

function AnalysisBanner({ state, time, onReanalyze, T }) {
  const { t } = useLocale();
  const [hovReanalyze, setHovReanalyze] = useState(false);

  if (state === 'analyzing') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', marginBottom: 0,
        background: T.paperSubtle, borderRadius: T.r6,
        border: `1px solid ${T.hairline}`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, flexShrink: 0,
          animation: 'timerPulse 1.4s ease-in-out infinite' }} />
        <span style={{ fontSize: 12.5, color: T.ink60 }}>{t('focus.analyzing')}</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        background: T.dangerSoft, borderRadius: T.r6,
        border: `1px solid ${T.dangerBorder}`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.danger, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 12.5, color: T.danger }}>{t('focus.analysisFailed')}</span>
        {onReanalyze && (
          <button
            onClick={onReanalyze}
            onMouseEnter={() => setHovReanalyze(true)}
            onMouseLeave={() => setHovReanalyze(false)}
            style={{
              fontSize: 12.5, color: hovReanalyze ? T.ink : T.danger,
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', padding: 0, flexShrink: 0,
            }}
          >{t('common.tryAgain')}</button>
        )}
      </div>
    );
  }

  // stale
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      background: T.paperSubtle, borderRadius: T.r6,
      border: `1px solid ${T.hairline}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.warn, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 12.5, color: T.ink60 }}>
        {t('focus.analysisUpdated')}{' '}
        <span style={{ color: T.ink80, fontWeight: 500 }}>{time}</span>
      </span>
      {onReanalyze && (
        <button
          onClick={onReanalyze}
          onMouseEnter={() => setHovReanalyze(true)}
          onMouseLeave={() => setHovReanalyze(false)}
          style={{
            fontSize: 12.5, color: hovReanalyze ? T.ink : T.ink60,
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', padding: 0, flexShrink: 0,
          }}
        >{t('focus.reanalyze')}</button>
      )}
    </div>
  );
}

function relativeTime(iso, t) {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t('time.justNow');
  if (mins < 60) return t('time.minutesAgo', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('time.hoursAgo', { n: hrs });
  return t('time.daysAgo', { n: Math.floor(hrs / 24) });
}

// Follow-ups that are due, and tasks that look stuck enough to deserve one.
//
// Deliberately PULL, not push: this sits on a page you chose to open, and
// nothing here interrupts you or counts against the follow-up back-off. Deciding
// when Clarity is allowed to interrupt is its own problem, with its own budget,
// and it is not this component’s to solve.
function FollowUpsDue({ tasks, onOpenDetail, T }) {
  const { t } = useLocale();
  const [due, setDue] = useState([]);
  const [stalled, setStalled] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`${API}/threads`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (live && d) { setDue(d.due || []); setStalled((d.stalled || []).slice(0, 3)); } })
      .catch(() => {});
    return () => { live = false; };
  }, [tasks.length]);

  if (dismissed || (!due.length && !stalled.length)) return null;
  const byId = new Map(tasks.map(t => [t.id, t]));
  const open = (id) => { const t = byId.get(id); if (t) onOpenDetail?.(t); };

  const line = (key, title, detail, action) => (
    <div key={key} onClick={action} style={{
      display: 'flex', gap: 10, alignItems: 'baseline', padding: '7px 0',
      cursor: 'pointer', borderTop: `1px solid ${T.hairlineSoft}`,
    }}>
      <span style={{ fontSize: 13, color: T.ink, flex: 1 }}>{title}</span>
      <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40 }}>{detail}</span>
    </div>
  );

  return (
    <div style={{
      marginBottom: 24, padding: '14px 16px', background: T.paperSubtle,
      border: `1px solid ${T.hairline}`, borderRadius: T.r10,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink60 }}>
          {t('followups.worthAWord')}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setDismissed(true)} style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40,
        }}>{t('followups.notNow')}</button>
      </div>

      {due.map(row => line(
        row.taskId,
        byId.get(row.taskId)?.title ?? t('followups.aTask'),
        row.blocker ? t('followups.blockedBy', { what: row.blocker.text.slice(0, 48) }) : t('followups.dueForUpdate'),
        () => open(row.taskId),
      ))}

      {stalled.map(s => line(`s-${s.taskId}`, s.title, s.why, () => open(s.taskId)))}
    </div>
  );
}

export default function FocusView({ rankedTasks, analysis, stats, analyzing, analysisError, health, onAddTask, onAcceptAiTask, onViewTasks, onOpenSettings, onOpenChat, ...handlers }) {
  const { T } = useTheme();
  const { t, fmtDate } = useLocale();
  const userName = getUserName();
  const [calendarBlocks, setCalendarBlocks] = useState([]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${API}/calendar/today`, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : { events: [] })
      .then(d => setCalendarBlocks(d.events || []))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  const activeTasks = rankedTasks.filter(t => t.status !== 'done');
  const doneTasks   = rankedTasks.filter(t => t.status === 'done');
  const focusTasks  = activeTasks.filter(t => t.aiData?.priority === 1).slice(0, 1);
  const quickTasks  = activeTasks.filter(t => !focusTasks.includes(t)).slice(0, 4);
  const lateTasks   = activeTasks.filter(t => {
    if (!t.deadline) return false;
    const d = Math.ceil((new Date(t.deadline + 'T00:00:00') - new Date()) / 86400000);
    return d < 0;
  });

  const _d = new Date();
  const todayISO = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
  const taskBlocks = rankedTasks
    .filter(t => t.deadline === todayISO && t.time && t.status !== 'done')
    .map(t => {
      const [h, m] = t.time.split(':').map(Number);
      const start = h + m / 60;
      const end = start + ((t.estimatedDuration || 60) / 60);
      return { type: 'focus', label: t.title, start, end };
    });
  const timelineBlocks = [...taskBlocks, ...calendarBlocks].sort((a, b) => a.start - b.start);

  const now = new Date();
  const dateStr = fmtDate(now, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      padding: '36px 56px 0',
      display: 'flex', flexDirection: 'column', gap: 28,
      boxSizing: 'border-box',
      fontFamily: T.fontUI,
    }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 8 }}>
            {dateStr}
          </div>
          <h1 style={{ margin: 0, fontSize: 38, fontWeight: 500, letterSpacing: '-0.035em', color: T.ink, lineHeight: 1.1 }}>
            {t(greetingKey())}{userName ? `, ${userName}` : ''}.
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <StatPill label={t('focus.stat.total')} value={stats.total} T={T} />
          {stats.inProgress > 0 && <StatPill label={t('focus.stat.inProgress')} value={stats.inProgress} T={T} />}
          {stats.done > 0 && <StatPill label={t('focus.stat.done')} value={stats.done} accent={T.done} T={T} />}
          {stats.overdue > 0 && <StatPill label={t('focus.stat.overdue')} value={stats.overdue} accent={T.warn} T={T} />}
        </div>
      </header>

      {/* Time blocking strip */}
      <TimeBlockingStrip blocks={timelineBlocks} />

      {/* AI Plan strip */}
      {analysis?.whatToDoNext && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 16,
          padding: '14px 18px',
          background: T.accentSoft,
          border: `1px solid ${T.hairline}`,
          borderRadius: T.r10,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            border: `1.5px solid ${T.accentInk}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.accent }} />
          </div>
          <div style={{ fontSize: 14, color: T.accentInk, lineHeight: 1.5 }}>
            {analysis.whatToDoNext}
            {analysis.overallInsight && (
              <span style={{ display: 'block', fontSize: 12.5, color: T.accentInk, opacity: 0.65, marginTop: 3 }}>
                {analysis.overallInsight}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onAcceptAiTask?.(analysis.whatToDoNext)} style={{
              fontFamily: T.fontUI, fontSize: 12.5, fontWeight: 500,
              color: T.paper, background: T.ink,
              border: 'none', padding: '7px 14px', borderRadius: T.r6,
              cursor: 'pointer',
            }}>{t('focus.accept')}</button>
            <button onClick={() => onAddTask?.({ title: analysis.whatToDoNext })} style={{
              fontFamily: T.fontUI, fontSize: 12.5, fontWeight: 400,
              color: T.accentInk, background: 'transparent',
              border: `1px solid ${T.accent}`, padding: '6px 12px', borderRadius: T.r6,
              cursor: 'pointer',
            }}>{t('focus.editAndAdd')}</button>
          </div>
        </div>
      )}

      {/* AI offline hint */}
      {!health.ollama && stats.total > 0 && !analysis && (
        <AiOfflineNotice health={health} onOpenSettings={onOpenSettings} />
      )}

      {/* Analyzing / analysis staleness banner */}
      {analyzing ? (
        <AnalysisBanner state="analyzing" T={T} />
      ) : analysisError ? (
        <AnalysisBanner state="error" T={T} onReanalyze={handlers.onReanalyze} />
      ) : analysis?.analyzedAt && (
        <AnalysisBanner state="stale" time={relativeTime(analysis.analyzedAt, t)} T={T} onReanalyze={handlers.onReanalyze} />
      )}

      <FollowUpsDue tasks={handlers.allTasks || []} onOpenDetail={handlers.onOpenDetail} T={T} />

      {/* Task groups */}
      {activeTasks.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: T.groupGap || 28, paddingBottom: 48 }}>
          {focusTasks.length > 0 && (
            <TaskGroup title={t('focus.firstFocus')} subtitle={t('focus.topPriority')} T={T}>
              {focusTasks.map(task => <TaskCard key={task.id} task={task} {...handlers} />)}
            </TaskGroup>
          )}

          {quickTasks.length > 0 && (
            <TaskGroup title={t('focus.upNext')} subtitle={t('focus.nTasks', { n: quickTasks.length })} T={T}>
              {quickTasks.map(task => <TaskCard key={task.id} task={task} {...handlers} />)}
            </TaskGroup>
          )}

          {lateTasks.length > 0 && (
            <TaskGroup title={t('focus.overdue')} subtitle={t('focus.needsAttention')} muted T={T}>
              {lateTasks.map(task => <TaskCard key={task.id} task={task} {...handlers} />)}
            </TaskGroup>
          )}

          {doneTasks.length > 0 && (
            <TaskGroup title={t('focus.completed')} subtitle={t('focus.nDoneToday', { n: doneTasks.length })} muted T={T}>
              {doneTasks.slice(0, 3).map(task => <TaskCard key={task.id} task={task} {...handlers} />)}
              {doneTasks.length > 3 && (
                <button onClick={onViewTasks} style={{
                  fontSize: 12.5, color: T.ink60, background: 'transparent', border: 'none',
                  cursor: 'pointer', textAlign: 'left', padding: '8px 4px', fontFamily: T.fontUI,
                }}>+{doneTasks.length - 3} more — view all tasks</button>
              )}
            </TaskGroup>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, paddingTop: 64, paddingBottom: 48, textAlign: 'center' }}>
          {/* Calendar illustration */}
          <svg width="96" height="80" viewBox="0 0 96 80" fill="none">
            <rect x="14" y="16" width="68" height="56" rx="6" fill={T.paperSubtle} stroke={T.hairline} strokeWidth="1.2" />
            <rect x="14" y="16" width="68" height="18" rx="6" fill={T.paperMuted} />
            <rect x="14" y="28" width="68" height="6" fill={T.paperMuted} />
            {[0,1,2,3,4,5,6].map(i => (
              <rect key={i} x={22 + i * 9} y={42} width="5" height="5" rx="1.5" fill={i === 3 ? T.accentSoft : T.hairline} stroke={i === 3 ? T.accent : 'none'} strokeWidth="1" />
            ))}
            {[0,1,2,3,4,5,6].map(i => (
              <rect key={i} x={22 + i * 9} y={54} width="5" height="5" rx="1.5" fill={T.hairline} />
            ))}
            <circle cx="75" cy="10" r="8" fill="oklch(0.94 0.05 65)" stroke="oklch(0.78 0.10 65)" strokeWidth="1.2" />
            <path d="M75 4v-2M75 18v2M81 6l1.4-1.4M67.6 17.4L66.2 18.8M83 10h2M68 10h-2" stroke="oklch(0.68 0.10 65)" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: T.ink }}>{t('focus.emptyTitle')}</h2>
          <p style={{ margin: 0, fontSize: 14.5, color: T.ink60, lineHeight: 1.6, maxWidth: 380 }}>
            {t('focus.emptyBody')}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onOpenChat} style={{
              fontFamily: T.fontUI, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              padding: '9px 16px', borderRadius: T.r6,
              background: T.accent, color: T.paper, border: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              {t('focus.askToPlan')}
              <span style={{ fontFamily: T.fontMono, fontSize: 10, opacity: 0.7, background: 'rgba(255,255,255,0.15)', padding: '2px 5px', borderRadius: 3 }}>Ctrl+/</span>
            </button>
            <button onClick={onViewTasks} style={{
              fontFamily: T.fontUI, fontSize: 13, fontWeight: 400, cursor: 'pointer',
              padding: '9px 16px', borderRadius: T.r6,
              background: 'transparent', color: T.ink60, border: `1px solid ${T.hairline}`,
            }}>{t('focus.browseUpcoming')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
