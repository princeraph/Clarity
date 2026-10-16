import { useEffect, useMemo, useState } from 'react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { buildPlan, replan, needsReplan, nowAndNext, nextWorkday, toHHMM } from '../lib/journee.js';

// The realistic day, on Today (2.0.0). Clarity proposes a plan — what fits in
// the working hours, where, what does not fit and why — and the person
// accepts it. Accepted, it is kept apart (localStorage, this computer): no
// task is changed, except those moved to tomorrow. When a block overruns, the
// rest moves on its own and the page says so.
const API = 'http://localhost:3001/api';
const KEY = 'clarity-day-plan';
const LATER = 'clarity-day-plan-later';
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const minutesNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function DayPlan({ tasks, events, T, onReload, onOpenDetail, onPlan }) {
  const { t, fmtDuration } = useLocale();
  const [workday, setWorkday] = useState(null);
  const [profile, setProfile] = useState(null);
  const [nowMin, setNowMin] = useState(minutesNow);
  const [today, setToday] = useState(localDay);
  const [accepted, setAccepted] = useState(() => { const p = read(KEY); return p?.date === localDay() ? p : null; });
  const [later, setLater] = useState(() => read(LATER) === localDay());
  const [shift, setShift] = useState(0);

  useEffect(() => {
    const loadDay = () => fetch(`${API}/settings`).then(r => r.json()).then(s => setWorkday(s.workday)).catch(() => {});
    loadDay();
    fetch(`${API}/profile`).then(r => r.json()).then(setProfile).catch(() => {});
    window.addEventListener('clarity-workday', loadDay);
    const tick = setInterval(() => { setNowMin(minutesNow()); setToday(localDay()); }, 60000);
    return () => { window.removeEventListener('clarity-workday', loadDay); clearInterval(tick); };
  }, []);

  // The person's measured gap, by topic and overall, once there is enough of it.
  const estimation = useMemo(() => {
    const e = profile?.observed?.estimation;
    if (!e) return {};
    const byArea = Object.fromEntries(Object.entries(e.byArea || {}).filter(([, v]) => v?.enough).map(([k, v]) => [k, v.medianRatio]));
    return { overall: e.enough ? e.medianRatio : null, byArea };
  }, [profile]);
  const peakHour = profile?.observed?.rhythm?.enough ? profile.observed.rhythm.peakHour : null;
  const eventsMin = useMemo(() => (events || []).map(e => ({ start: Math.round(e.start * 60), end: Math.round(e.end * 60), label: e.label })), [events]);
  const args = workday && { tasks, today, nowMin, workday, events: eventsMin, estimation, peakHour };

  const preview = useMemo(() => (args && !accepted ? buildPlan(args) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, today, nowMin, workday, eventsMin, estimation, peakHour, accepted]);

  // A new day forgets yesterday's plan.
  useEffect(() => { if (accepted && accepted.date !== today) { setAccepted(null); write(KEY, null); } }, [today, accepted]);

  // The accepted plan moves when the day does.
  useEffect(() => {
    if (!accepted || !args) return;
    const done = new Set(tasks.filter(x => x.status === 'done').map(x => x.id));
    if (!needsReplan(accepted, nowMin, done)) return;
    const r = replan(accepted, args);
    const next = { ...r.plan, date: accepted.date };
    setAccepted(next); write(KEY, next);
    setShift(r.shift);   // 0 when the plan moved up: the old « moved by » goes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, nowMin, accepted]);

  const plan = accepted || preview;
  useEffect(() => { onPlan?.(accepted); }, [accepted, onPlan]);
  if (!workday || !plan) return null;

  const byId = new Map(tasks.map(x => [x.id, x]));
  const dur = (m) => fmtDuration(m);   // « 1 h 20 », not « 1,3 h »
  const work = plan.blocks.filter(b => b.kind === 'task' || b.kind === 'batch' || b.kind === 'fixed');
  const overflow = plan.overflow.filter(o => byId.get(o.taskId)?.status !== 'done' && byId.get(o.taskId)?.deadline <= today);
  const isWorkday = workday.days.includes(new Date().getDay());

  async function moveToTomorrow(ids) {
    const when = nextWorkday(today, workday.days);
    await Promise.all(ids.map(id => fetch(`${API}/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deadline: when }) }).catch(() => {})));
    onReload?.();
  }
  const accept = () => { const p = { ...preview, date: today }; setAccepted(p); write(KEY, p); setShift(0); };
  const redo = () => { setAccepted(null); write(KEY, null); setShift(0); setLater(false); write(LATER, null); };
  const putOff = () => { setLater(true); write(LATER, today); };

  const btn = (primary) => ({ padding: '6px 12px', fontSize: 12.5, fontFamily: T.fontUI, borderRadius: T.r6, cursor: 'pointer',
    ...(primary ? { background: T.ink, color: T.paper, border: 'none' } : { background: 'transparent', color: T.ink60, border: `1px solid ${T.hairline}` }) });
  const label = (b) => b.kind === 'batch'
    ? t('day.batch', { n: b.taskIds.length, titles: b.taskIds.map(id => byId.get(id)?.title).filter(Boolean).join(', ') })
    : byId.get(b.taskIds[0])?.title || '';

  // Not proposed yet today: one line, the person asks for it.
  if (!accepted && (later || !isWorkday)) {
    return (
      <div data-tour="day-plan" data-day-plan="idle" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.ink60 }}>
        <button type="button" data-act="prepare" onClick={() => { setLater(false); write(LATER, null); }} style={btn(false)}>{t('day.prepare')}</button>
        {!isWorkday && <span>{t('day.notWorkday')}</span>}
      </div>
    );
  }

  const { now, next } = accepted ? nowAndNext(accepted, nowMin) : { now: null, next: null };

  return (
    <section data-tour="day-plan" data-day-plan={accepted ? 'accepted' : 'preview'} style={{ border: `1px solid ${T.hairline}`, borderRadius: T.r10, padding: '14px 18px', background: T.paperSubtle }}>
      {accepted ? (
        <div data-now style={{ marginBottom: 10 }}>
          {now ? (
            <div style={{ fontSize: 15, color: T.ink }}>
              <span style={{ color: T.accentInk, fontWeight: 600 }}>{t('day.now')}</span> {label(now)} <span style={{ color: T.ink60 }}>{t('day.until', { time: toHHMM(now.end) })}</span>
            </div>
          ) : next ? (
            <div style={{ fontSize: 15, color: T.ink }}>
              <span style={{ color: T.accentInk, fontWeight: 600 }}>{t('day.nextAt', { time: toHHMM(next.start) })}</span> {label(next)}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: T.ink60 }}>{t('day.nothingLeft')}</div>
          )}
          {now && next && <div style={{ fontSize: 12.5, color: T.ink60, marginTop: 2 }}>{t('day.then', { title: label(next), time: toHHMM(next.start) })}</div>}
          {shift > 0 && <div role="status" data-shift style={{ fontSize: 12, color: T.warn, marginTop: 4 }}>{t('day.shifted', { time: dur(shift) })}</div>}
        </div>
      ) : (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.ink }}>{t('day.proposed')}</div>
          <div style={{ fontSize: 12.5, color: T.ink60, marginTop: 2 }}>
            {t('day.summary', { planned: dur(plan.planned), free: dur(plan.capacity) })}
            {plan.missing > 0 && <> · <span style={{ color: T.warn }}>{t('day.short', { time: dur(plan.missing) })}</span></>}
          </div>
        </div>
      )}

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {work.map(b => {
          const done = b.taskIds.every(id => byId.get(id)?.status === 'done');
          return (
            <li key={b.id} data-block={b.kind} style={{ display: 'grid', gridTemplateColumns: '92px 1fr auto', gap: 10, alignItems: 'baseline', fontSize: 13, padding: '3px 0', opacity: done ? 0.5 : 1 }}>
              <span style={{ fontFamily: T.fontMono, fontSize: 11.5, color: T.ink60 }}>{toHHMM(b.start)}–{toHHMM(b.end)}</span>
              <button type="button" onClick={() => b.taskIds[0] && onOpenDetail?.(byId.get(b.taskIds[0]))} style={{ textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: T.ink, fontSize: 13, fontFamily: T.fontUI, textDecoration: done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label(b)}{b.kind === 'fixed' && <span style={{ color: T.ink40 }}> · {t('day.fixed')}</span>}
              </button>
              <span data-duration style={{ fontFamily: T.fontMono, fontSize: 11, color: b.factor && b.factor !== 1 ? T.accentInk : T.ink40 }}>
                {b.factor && b.factor !== 1 ? t('day.corrected', { base: dur(b.base), minutes: dur(b.minutes), factor: String(b.factor).replace('.', ',') }) : dur(b.end - b.start)}
              </span>
            </li>
          );
        })}
        {!work.length && <li style={{ fontSize: 13, color: T.ink60 }}>{t('day.empty')}</li>}
      </ol>

      {overflow.length > 0 && (
        <div data-overflow style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.hairlineSoft}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: T.ink }}>{t('day.doesNotFit')}</span>
            {overflow.length > 1 && <button type="button" data-act="all-tomorrow" onClick={() => moveToTomorrow(overflow.map(o => o.taskId))} style={btn(false)}>{t('day.allTomorrow')}</button>}
          </div>
          {overflow.map(o => (
            <div key={o.taskId} data-overflow-row={o.reason === 'blocked' ? 'blocked' : 'full'} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 12.5, padding: '3px 0' }}>
              <span style={{ flex: 1, color: T.ink80 }}>{byId.get(o.taskId)?.title}</span>
              <span style={{ color: T.ink60 }}>{o.reason === 'blocked' ? t('day.blockedBy', { title: byId.get(o.by)?.title || '…' }) : t('day.full')}</span>
              <button type="button" data-act="tomorrow" onClick={() => moveToTomorrow([o.taskId])} style={{ ...btn(false), padding: '3px 8px', fontSize: 12 }}>{t('day.tomorrow')}</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {accepted ? (
          <button type="button" data-act="redo" onClick={redo} style={btn(false)}>{t('day.redo')}</button>
        ) : (
          <>
            <button type="button" data-act="accept" onClick={accept} style={btn(true)}>{t('day.accept')}</button>
            <button type="button" data-act="later" onClick={putOff} style={btn(false)}>{t('day.later')}</button>
          </>
        )}
      </div>
    </section>
  );
}
