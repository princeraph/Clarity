import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';

const API = 'http://localhost:3001/api';

const DAYS_HEADER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const TIME_QUICK  = ['09:00', '10:00', '12:00', '14:00', '17:00'];

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Shift so week starts Monday
  const startOffset = (firstDay + 6) % 7;
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function fmt2(n) { return String(n).padStart(2, '0'); }

function toISODate(year, month, day) {
  return `${year}-${fmt2(month + 1)}-${fmt2(day)}`;
}

export default function SchedulingPopover({ task, anchorX, anchorY, onClose, onSaved }) {
  const { T } = useTheme();
  const ref  = useRef(null);
  const today = new Date();

  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(task.deadline || null);
  const [selectedTime, setSelectedTime] = useState(task.time || null);
  const [recur, setRecur] = useState(task.recurring || 'none');
  const [saving, setSaving] = useState(false);
  const [pos, setPos] = useState({ x: anchorX, y: anchorY });

  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  useEffect(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      x: anchorX + r.width > window.innerWidth  ? Math.max(8, anchorX - r.width)  : anchorX,
      y: anchorY + r.height > window.innerHeight ? Math.max(8, anchorY - r.height) : anchorY,
    });
  }, [anchorX, anchorY]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  const weeks = buildCalendar(year, month);

  const monthName = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  function pickQuick(label) {
    const d = new Date();
    if (label === 'Today') {
      setSelectedDate(toISODate(d.getFullYear(), d.getMonth(), d.getDate()));
      setYear(d.getFullYear()); setMonth(d.getMonth());
    } else if (label === 'Tomorrow') {
      d.setDate(d.getDate() + 1);
      setSelectedDate(toISODate(d.getFullYear(), d.getMonth(), d.getDate()));
      setYear(d.getFullYear()); setMonth(d.getMonth());
    } else if (label === 'Next week') {
      d.setDate(d.getDate() + (8 - d.getDay()));
      setSelectedDate(toISODate(d.getFullYear(), d.getMonth(), d.getDate()));
      setYear(d.getFullYear()); setMonth(d.getMonth());
    } else if (label === 'Someday') {
      setSelectedDate(null);
      // Don't navigate — no specific date chosen
    }
  }

  async function handleSchedule() {
    setSaving(true);
    try {
      const resp = await fetch(`${API}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deadline: selectedDate || null, time: selectedTime || null, recurring: recur }),
      });
      if (!resp.ok) throw new Error();
      onSaved?.();
      onClose();
    } catch {
      // keep popover open so user can retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 310, background: 'rgba(25,25,26,0.12)' }}>
      <div
        ref={ref}
        style={{
          position: 'absolute',
          left: pos.x, top: pos.y,
          width: 320,
          background: T.paper,
          border: `1px solid ${T.hairline}`,
          borderRadius: T.r14,
          boxShadow: '0 20px 56px -12px rgba(25,25,26,0.22), 0 4px 12px rgba(25,25,26,0.08)',
          overflow: 'hidden',
          fontFamily: T.fontUI,
          animation: 'fadeUp 0.1s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px 12px',
          borderBottom: `1px solid ${T.hairlineSoft}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink40 }}>
            Schedule task
          </span>
          <button onClick={onClose} style={{ fontSize: 12.5, color: T.ink40, background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px' }}>✕</button>
        </div>

        {/* Quick picks */}
        <div style={{ padding: '12px 18px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Today', 'Tomorrow', 'Next week', 'Someday'].map(q => {
            const tomorrowIso = (() => { const d = new Date(); d.setDate(d.getDate()+1); return toISODate(d.getFullYear(), d.getMonth(), d.getDate()); })();
            const todayIso = toISODate(today.getFullYear(), today.getMonth(), today.getDate());
            const matchesSelected = (q === 'Today' && selectedDate === todayIso) ||
              (q === 'Tomorrow' && selectedDate === tomorrowIso) ||
              (q === 'Someday' && !selectedDate);
            const sub = q === 'Today' ? today.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
                      : q === 'Tomorrow' ? (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }); })()
                      : '';
            return (
              <button
                key={q}
                onClick={() => pickQuick(q)}
                style={{
                  fontFamily: T.fontUI, fontSize: 12, cursor: 'pointer',
                  padding: '5px 10px', borderRadius: T.rPill,
                  background: matchesSelected ? T.ink : T.paperSubtle,
                  color: matchesSelected ? T.paper : T.ink80,
                  border: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 500 }}>{q}</span>
                {sub && <span style={{ fontFamily: T.fontMono, fontSize: 9.5, opacity: 0.6 }}>{sub}</span>}
              </button>
            );
          })}
        </div>

        {/* Calendar */}
        <div style={{ padding: '4px 18px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>{monthName}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['‹', prevMonth], ['›', nextMonth]].map(([ch, fn]) => (
                <button key={ch} onClick={fn} style={{
                  fontSize: 13, color: T.ink60, background: 'transparent',
                  border: `1px solid ${T.hairline}`, borderRadius: T.r6,
                  width: 24, height: 24, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: T.fontUI,
                }}>{ch}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {DAYS_HEADER.map(d => (
              <div key={d} style={{ textAlign: 'center', fontFamily: T.fontMono, fontSize: 9.5, color: T.ink40, letterSpacing: '0.06em', padding: '0 0 4px' }}>{d}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
              {week.map((day, di) => {
                if (!day) return <div key={di} />;
                const iso = toISODate(year, month, day);
                const isToday    = year === todayY && month === todayM && day === todayD;
                const isPast     = new Date(iso) < new Date(toISODate(todayY, todayM, todayD));
                const isSelected = selectedDate === iso;
                return (
                  <div
                    key={di}
                    onClick={() => !isPast && setSelectedDate(iso)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      height: 28, borderRadius: T.r6,
                      background: isSelected ? T.ink : 'transparent',
                      cursor: isPast ? 'default' : 'pointer',
                    }}
                    onMouseEnter={e => { if (!isPast && !isSelected) e.currentTarget.style.background = T.paperSubtle; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{
                      fontSize: 12.5,
                      fontWeight: isSelected ? 600 : isToday ? 500 : 400,
                      color: isSelected ? T.paper : isPast ? T.ink20 : isToday ? T.accent : T.ink,
                      textDecoration: isToday && !isSelected ? `underline solid ${T.accent}` : 'none',
                      textUnderlineOffset: 3,
                    }}>{day}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Time picker */}
        <div style={{ padding: '10px 18px', borderTop: `1px solid ${T.hairlineSoft}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink40, minWidth: 36 }}>Time</span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 }}>
            {TIME_QUICK.map(tm => (
              <button key={tm} onClick={() => setSelectedTime(t => t === tm ? null : tm)} style={{
                fontFamily: T.fontMono, fontSize: 11, cursor: 'pointer',
                padding: '4px 7px', borderRadius: T.r6,
                background: selectedTime === tm ? T.accentSoft : T.paperSubtle,
                color: selectedTime === tm ? T.accentInk : T.ink60,
                border: `1px solid ${selectedTime === tm ? T.accent : T.hairline}`,
              }}>{tm}</button>
            ))}
          </div>
        </div>

        {/* Recurrence */}
        <div style={{ padding: '10px 18px', borderTop: `1px solid ${T.hairlineSoft}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink40, minWidth: 36 }}>Repeat</span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {[['none', 'None'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([val, label]) => (
              <button key={val} onClick={() => setRecur(val)} style={{
                fontFamily: T.fontUI, fontSize: 12, cursor: 'pointer',
                padding: '4px 9px', borderRadius: T.rPill,
                background: recur === val ? T.ink : T.paperSubtle,
                color: recur === val ? T.paper : T.ink60,
                border: 'none',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 18px 14px', borderTop: `1px solid ${T.hairlineSoft}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{
            fontFamily: T.fontUI, fontSize: 13, color: T.ink60,
            background: 'transparent', border: `1px solid ${T.hairline}`,
            padding: '7px 14px', borderRadius: T.r6, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSchedule} disabled={saving} style={{
            fontFamily: T.fontUI, fontSize: 13, fontWeight: 500,
            color: T.paper, background: T.ink, border: 'none',
            padding: '7px 14px', borderRadius: T.r6, cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}>{saving ? 'Saving…' : 'Schedule'}</button>
        </div>
      </div>
    </div>
  );
}
