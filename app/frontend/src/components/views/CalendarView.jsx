import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarView({ rankedTasks, onEdit, onAddTask }) {
  const { t } = useLocale();
  const { T } = useTheme();
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const cells = buildCalendar(year, month);

  const tasksByDay = {};
  for (const task of rankedTasks) {
    if (!task.deadline) continue;
    const d = new Date(task.deadline + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!tasksByDay[day]) tasksByDay[day] = [];
      tasksByDay[day].push(task);
    }
  }

  const noDeadline = rankedTasks.filter(t => !t.deadline && t.status !== 'done');

  const navBtn = {
    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: T.r6, background: T.paperSubtle, border: `1px solid ${T.hairline}`,
    color: T.ink60, cursor: 'pointer',
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '36px 56px', fontFamily: T.fontUI, boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 8 }}>{t('nav.calendar')}</div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500, letterSpacing: '-0.03em', color: T.ink }}>
            {MONTHS[month]} {year}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onAddTask && (
            <button onClick={() => onAddTask({})} style={{
              ...navBtn, width: 'auto', padding: '0 14px', fontSize: 12.5, fontFamily: T.fontUI,
              background: T.ink, color: T.paper, border: 'none', fontWeight: 500,
            }}>+ Add Task</button>
          )}
          <button onClick={prevMonth} style={navBtn}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={nextMonth} style={navBtn}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }} style={{
            ...navBtn, width: 'auto', padding: '0 12px', fontSize: 12, fontFamily: T.fontMono,
          }}>{t('time.today')}</button>
        </div>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontFamily: T.fontMono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink40, padding: '6px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 1, background: T.hairline,
        border: `1px solid ${T.hairline}`, borderRadius: T.r10, overflow: 'hidden',
      }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} style={{ background: T.paper, minHeight: 88 }} />;
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const isPast  = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const dayTasks = tasksByDay[day] || [];

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          return (
            <div
              key={i}
              style={{ background: T.paper, minHeight: 88, padding: 6, opacity: isPast && !isToday ? 0.45 : 1, position: 'relative' }}
              onDoubleClick={() => onAddTask?.({ deadline: dateStr })}
              title={onAddTask ? 'Double-click to add task on this day' : undefined}
            >
              <div style={{
                width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', marginBottom: 4,
                background: isToday ? T.ink : 'transparent',
                color: isToday ? T.paper : T.ink60,
                fontFamily: T.fontMono, fontSize: 11.5, fontWeight: isToday ? 600 : 400,
              }}>{day}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {dayTasks.slice(0, 3).map(task => (
                  <button key={task.id} onClick={() => onEdit(task)} style={{
                    display: 'flex', alignItems: 'center', gap: 4, width: '100%',
                    textAlign: 'left', fontSize: 10, padding: '2px 5px', borderRadius: 3,
                    background: T.paperSubtle, color: T.ink80,
                    border: `1px solid ${T.hairlineSoft}`, cursor: 'pointer', fontFamily: T.fontUI,
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</span>
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <div style={{ fontSize: 10, color: T.ink40, paddingLeft: 5, fontFamily: T.fontMono }}>+{dayTasks.length - 3}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* No-deadline tasks */}
      {noDeadline.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 10.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink40, marginBottom: 10 }}>
            {t('detail.noDeadline')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {noDeadline.map(task => (
              <button key={task.id} onClick={() => onEdit(task)} style={{
                fontSize: 12.5, padding: '5px 12px', borderRadius: T.rPill,
                background: T.paperSubtle, color: T.ink60,
                border: `1px solid ${T.hairline}`, cursor: 'pointer', fontFamily: T.fontUI,
              }}>{task.title}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
