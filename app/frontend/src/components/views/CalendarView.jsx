import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { levelTone, shownLevel } from '../../lib/niveaux.js';
import { layoutDay, plannedMinutes, toMin, breaksOf } from '../../lib/journee.js';
import { addDays } from '../../lib/avenir.js';
import TimeGrid from '../TimeGrid.jsx';

// The grid starts on Sunday. Names come from the locale, not from a list:
// 4 January 2026 is a Sunday, so the next seven days give the header in order.
const WEEK_FROM_SUNDAY = Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 4 + i));
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
const API = 'http://localhost:3001/api';
const MODE_KEY = 'clarity-calendar-mode';
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const mondayOf = (s) => addDays(s, -((fromIso(s).getDay() + 6) % 7));

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// A task as a chip: its level's soft color, the bar on the left (2.1.0).
function Chip({ task, onClick, T, isDark, small }) {
  const s = shownLevel(task); const tone = levelTone(s.level, isDark);
  return (
    <button type="button" onClick={onClick} data-chip-task={task.id} data-level-bar={s.level} style={{
      display: 'block', width: '100%', textAlign: 'left', fontSize: small ? 10.5 : 11.5, padding: small ? '2px 6px' : '3px 7px', borderRadius: 4,
      background: tone.fill, color: tone.ink, border: 'none', borderLeft: `3px ${s.inherited ? 'dashed' : 'solid'} ${tone.bar}`,
      cursor: 'pointer', fontFamily: T.fontUI, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      textDecoration: task.status === 'done' ? 'line-through' : 'none', opacity: task.status === 'done' ? 0.55 : 1,
    }}>{task.title}</button>
  );
}

export default function CalendarView({ rankedTasks, onEdit, onAddTask, onOpenDetail, focus }) {
  const { t, fmtDate } = useLocale();
  const { T, isDark } = useTheme();
  const today = new Date();
  const todayIso = iso(today);
  const [mode, setMode] = useState(() => { try { return localStorage.getItem(MODE_KEY) === 'month' ? 'month' : 'week'; } catch { return 'week'; } });
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayIso));
  const [workday, setWorkday] = useState(null);
  const [events, setEvents] = useState([]);
  const open = (task) => (onOpenDetail || onEdit)?.(task);

  // « Upcoming » › a day: the week that holds it.
  useEffect(() => { if (focus?.date) { setMode('week'); setWeekStart(mondayOf(focus.date)); } }, [focus]);
  useEffect(() => { try { localStorage.setItem(MODE_KEY, mode); } catch {} }, [mode]);
  useEffect(() => { fetch(`${API}/settings`).then(r => r.json()).then(s => setWorkday(s.workday)).catch(() => {}); }, []);
  useEffect(() => {
    if (mode !== 'week') return;
    const ctrl = new AbortController();
    fetch(`${API}/calendar/range?from=${weekStart}&to=${addDays(weekStart, 6)}`, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : { events: [] }).then(d => setEvents(d.events || [])).catch(() => {});
    return () => ctrl.abort();
  }, [mode, weekStart]);

  function prev() {
    if (mode === 'week') return setWeekStart(w => addDays(w, -7));
    if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1);
  }
  function next() {
    if (mode === 'week') return setWeekStart(w => addDays(w, 7));
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
  }
  function goToday() { setYear(today.getFullYear()); setMonth(today.getMonth()); setWeekStart(mondayOf(todayIso)); }

  const navBtn = {
    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: T.r6, background: T.paperSubtle, border: `1px solid ${T.hairline}`,
    color: T.ink60, cursor: 'pointer',
  };
  const seg = (on) => ({ padding: '0 12px', height: 26, fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer', border: 'none',
    background: on ? T.ink : 'transparent', color: on ? T.paper : T.ink60, borderRadius: T.r6 });

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekGrid = useMemo(() => {
    if (mode !== 'week') return null;
    // Today's accepted plan draws today, as on Today.
    let plan = null;
    try { const p = JSON.parse(localStorage.getItem('clarity-day-plan') || 'null'); if (p?.date === todayIso) plan = p; } catch {}
    const byId = new Map(rankedTasks.map(x => [x.id, x]));
    const inPlan = new Set(plan ? plan.blocks.flatMap(b => b.taskIds) : []);
    const columns = week.map(date => {
      const due = rankedTasks.filter(x => x.deadline?.slice(0, 10) === date && !x.archived);
      const items = [];
      for (const e of events.filter(e => e.date === date)) items.push({ id: `ev-${e.label}-${e.start}`, kind: 'event', title: e.label, start: Math.round(e.start * 60), end: Math.round(e.end * 60) });
      const worked = !!workday && workday.days.includes(fromIso(date).getDay());
      if (worked) breaksOf(workday).forEach((b, i) => items.push({ id: `br-${i}`, kind: 'break', title: t('day.break'), ...b }));
      if (date === todayIso && plan) {
        for (const b of plan.blocks.filter(b => b.kind !== 'event')) {
          const first = byId.get(b.taskIds[0]); const s = shownLevel(first);
          items.push(b.kind === 'batch'
            ? { id: b.id, kind: 'batch', title: t('day.batchShort', { n: b.taskIds.length }), start: b.start, end: b.end, sub: b.taskIds.map(id => ({ id, title: byId.get(id)?.title || '', done: byId.get(id)?.status === 'done' })) }
            : { id: b.id, kind: 'task', taskId: b.taskIds[0], title: first?.title || '', level: s.level, inherited: s.inherited, start: b.start, end: b.end, done: first?.status === 'done' });
        }
      }
      for (const x of due.filter(x => x.time && !inPlan.has(x.id))) {
        const s = shownLevel(x); const start = toMin(x.time);
        items.push({ id: `t-${x.id}`, kind: 'task', taskId: x.id, title: x.title, level: s.level, inherited: s.inherited, start, end: Math.min(24 * 60, start + plannedMinutes(x).minutes), done: x.status === 'done' });
      }
      return { date, worked, allDay: due.filter(x => !x.time && !inPlan.has(x.id)), laid: layoutDay({ items, workday }) };
    });
    const from = Math.min(...columns.map(c => c.laid.from)), to = Math.max(...columns.map(c => c.laid.to));
    return { columns, from, to };
  }, [mode, week, rankedTasks, events, workday, todayIso, t]);

  const title = mode === 'week'
    ? `${fmtDate(fromIso(week[0]), { day: 'numeric', month: 'short' })} – ${fmtDate(fromIso(week[6]), { day: 'numeric', month: 'short', year: 'numeric' })}`
    : capitalize(fmtDate(new Date(year, month, 1), { month: 'long', year: 'numeric' }));

  const cells = buildCalendar(year, month);
  const tasksByDay = {};
  for (const task of rankedTasks) {
    if (!task.deadline) continue;
    const d = new Date(task.deadline.slice(0, 10) + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() === month) (tasksByDay[d.getDate()] ||= []).push(task);
  }
  const noDeadline = rankedTasks.filter(t => !t.deadline && t.status !== 'done');

  return (
    <div data-calendar={mode} style={{ height: '100%', overflowY: 'auto', padding: '36px 56px', fontFamily: T.fontUI, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 8 }}>{t('nav.calendar')}</div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500, letterSpacing: '-0.03em', color: T.ink }}>{title}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div role="group" style={{ display: 'flex', gap: 2, padding: 2, borderRadius: T.r6, border: `1px solid ${T.hairline}`, background: T.paperSubtle }}>
            <button type="button" data-mode="week" aria-pressed={mode === 'week'} onClick={() => setMode('week')} style={seg(mode === 'week')}>{t('calendar.week')}</button>
            <button type="button" data-mode="month" aria-pressed={mode === 'month'} onClick={() => setMode('month')} style={seg(mode === 'month')}>{t('calendar.month')}</button>
          </div>
          {onAddTask && (
            <button onClick={() => onAddTask({})} style={{
              ...navBtn, width: 'auto', padding: '0 14px', fontSize: 12.5, fontFamily: T.fontUI,
              background: T.ink, color: T.paper, border: 'none', fontWeight: 500,
            }}>{t('tasks.addButton')}</button>
          )}
          <button onClick={prev} aria-label={t('calendar.prev')} style={navBtn}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={next} aria-label={t('calendar.next')} style={navBtn}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button onClick={goToday} style={{ ...navBtn, width: 'auto', padding: '0 12px', fontSize: 12, fontFamily: T.fontMono }}>{t('time.today')}</button>
        </div>
      </div>

      {mode === 'week' && weekGrid && (
        <div data-tour="calendar-week" style={{ border: `1px solid ${T.hairline}`, borderRadius: T.r10, background: T.paper, overflow: 'hidden' }}>
          <TimeGrid testId="week" from={weekGrid.from} to={weekGrid.to} px={0.75}
            onOpen={(id) => { const x = rankedTasks.find(r => r.id === id); if (x) open(x); }}
            columns={weekGrid.columns.map(c => {
              const isToday = c.date === todayIso;
              const d = fromIso(c.date);
              return {
                key: c.date, items: c.laid.items, shaded: !c.worked, nowMin: isToday ? today.getHours() * 60 + today.getMinutes() : null,
                header: (
                  <div data-week-day={c.date} onDoubleClick={() => onAddTask?.({ deadline: c.date })} style={{ padding: '8px 6px', borderLeft: `1px solid ${T.hairlineSoft}`, minHeight: 64, height: '100%', boxSizing: 'border-box', background: c.worked ? 'transparent' : T.paperMuted }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontFamily: T.fontMono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink40 }}>{fmtDate(d, { weekday: 'short' }).replace('.', '')}</span>
                      <span style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 12.5, fontWeight: 600,
                        background: isToday ? T.accent : 'transparent', color: isToday ? T.paper : T.ink }}>{d.getDate()}</span>
                    </div>
                    <div aria-label={t('calendar.allDay')} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {c.allDay.slice(0, 3).map(x => <Chip key={x.id} task={x} small onClick={() => open(x)} T={T} isDark={isDark} />)}
                      {c.allDay.length > 3 && <span style={{ fontSize: 10.5, color: T.ink40, fontFamily: T.fontMono, paddingLeft: 4 }}>+{c.allDay.length - 3}</span>}
                    </div>
                  </div>
                ),
              };
            })} />
        </div>
      )}

      {mode === 'month' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {WEEK_FROM_SUNDAY.map(day => fmtDate(day, { weekday: 'short' }).replace('.', '')).map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontFamily: T.fontMono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink40, padding: '6px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 1, background: T.hairline,
            border: `1px solid ${T.hairline}`, borderRadius: T.r10, overflow: 'hidden',
          }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} style={{ background: T.paperSubtle, minHeight: 96 }} />;
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isPast  = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const dayTasks = tasksByDay[day] || [];
              const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
              return (
                <div key={i} data-month-day={dateStr}
                  style={{ background: T.paper, minHeight: 96, padding: 6, opacity: isPast && !isToday ? 0.5 : 1, position: 'relative' }}
                  onDoubleClick={() => onAddTask?.({ deadline: dateStr })}
                  title={onAddTask ? t('calendar.doubleClickToAdd') : undefined}
                >
                  <div style={{
                    width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%', marginBottom: 4,
                    background: isToday ? T.accent : 'transparent',
                    color: isToday ? T.paper : T.ink60,
                    fontFamily: T.fontMono, fontSize: 11.5, fontWeight: isToday ? 600 : 400,
                  }}>{day}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {dayTasks.slice(0, 3).map(task => <Chip key={task.id} task={task} small onClick={() => open(task)} T={T} isDark={isDark} />)}
                    {dayTasks.length > 3 && <div style={{ fontSize: 10, color: T.ink40, paddingLeft: 5, fontFamily: T.fontMono }}>+{dayTasks.length - 3}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {noDeadline.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 10.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink40, marginBottom: 10 }}>
            {t('detail.noDeadline')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {noDeadline.map(task => <div key={task.id} style={{ maxWidth: 260 }}><Chip task={task} onClick={() => open(task)} T={T} isDark={isDark} /></div>)}
          </div>
        </div>
      )}
    </div>
  );
}
