import { useEffect, useMemo, useState } from 'react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { upcoming, addDays } from '../lib/avenir.js';
import { levelTone, shownLevel } from '../lib/niveaux.js';

// « Upcoming » on Today (2.1.0): the next seven days, one by one, with how
// full each one is. Replaces « Up next ». The figures come from lib/avenir.js.
const API = 'http://localhost:3001/api';
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function Upcoming({ tasks, onOpenDetail, onOpenDay }) {
  const { t, fmtDate, fmtDuration } = useLocale();
  const { T, isDark } = useTheme();
  const [workday, setWorkday] = useState(null);
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState({});
  const today = localDay();

  useEffect(() => {
    const load = () => fetch(`${API}/settings`).then(r => r.json()).then(s => setWorkday(s.workday)).catch(() => {});
    load();
    window.addEventListener('clarity-workday', load);
    fetch(`${API}/profile`).then(r => r.json()).then(setProfile).catch(() => {});
    fetch(`${API}/calendar/range?from=${addDays(today, 1)}&to=${addDays(today, 7)}`).then(r => r.ok ? r.json() : { events: [] })
      .then(d => {
        const by = {};
        for (const e of d.events || []) (by[e.date] ||= []).push({ start: Math.round(e.start * 60), end: Math.round(e.end * 60) });
        setEvents(by);
      }).catch(() => {});
    return () => window.removeEventListener('clarity-workday', load);
  }, [today]);

  const estimation = useMemo(() => {
    const e = profile?.observed?.estimation;
    if (!e) return {};
    return { overall: e.enough ? e.medianRatio : null, byArea: Object.fromEntries(Object.entries(e.byArea || {}).filter(([, v]) => v?.enough).map(([k, v]) => [k, v.medianRatio])) };
  }, [profile]);
  const days = upcoming({ tasks, today, workday, events, estimation });
  if (!days.length) return null;

  const dayName = (iso) => iso === addDays(today, 1) ? t('upcoming.tomorrow')
    : fmtDate(new Date(`${iso}T12:00:00`), { weekday: 'long', day: 'numeric' }).replace(/^./, c => c.toUpperCase());

  return (
    <section data-tour="upcoming" data-upcoming style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink60 }}>{t('upcoming.title')}</div>
      {days.map(d => (
        <div key={d.date} data-day={d.date} data-over={d.over ? '' : undefined}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, paddingBottom: 6, borderBottom: `1px solid ${T.hairlineSoft}` }}>
            <button type="button" onClick={() => onOpenDay?.(d.date)} style={{ background: 'transparent', border: 'none', padding: 0, cursor: onOpenDay ? 'pointer' : 'default', fontSize: 14, fontWeight: 500, color: T.ink, fontFamily: T.fontUI }}>{dayName(d.date)}</button>
            <span data-load style={{ fontSize: 12, color: d.over ? T.warn : T.ink60, fontFamily: T.fontUI }}>
              {!d.worked
                ? t(d.count === 1 ? 'upcoming.notWorkedOne' : 'upcoming.notWorked', { n: d.count, planned: fmtDuration(d.minutes) })
                : t(d.count === 1 ? 'upcoming.loadOne' : 'upcoming.load', { n: d.count, planned: fmtDuration(d.minutes), free: fmtDuration(d.capacity) })}
              {d.over && d.worked && <> · {t('upcoming.over', { time: fmtDuration(d.minutes - d.capacity) })}</>}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {d.tasks.map(task => {
              const s = shownLevel(task); const tone = levelTone(s.level, isDark);
              return (
                <button key={task.id} type="button" data-upcoming-task={task.id} data-level-bar={s.level} onClick={() => onOpenDetail?.(task)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', fontFamily: T.fontUI,
                  padding: '6px 10px', borderRadius: T.r6, border: 'none', background: tone.fill, color: tone.ink,
                  borderLeft: `3px ${s.inherited ? 'dashed' : 'solid'} ${tone.bar}`, fontSize: 13,
                }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                  {task.time && <span style={{ fontFamily: T.fontMono, fontSize: 11, opacity: 0.75 }}>{task.time}</span>}
                </button>
              );
            })}
            {d.more > 0 && <button type="button" onClick={() => onOpenDay?.(d.date)} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: T.accent, cursor: 'pointer', fontSize: 12.5, fontFamily: T.fontUI, padding: '2px 0' }}>{t('upcoming.more', { n: d.more })}</button>}
          </div>
        </div>
      ))}
    </section>
  );
}
