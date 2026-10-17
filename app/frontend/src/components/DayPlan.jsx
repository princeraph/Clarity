import { useEffect, useMemo, useState } from 'react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { buildPlan, replan, needsReplan, nowAndNext, nextWorkday, toHHMM, layoutDay, breaksOf, hoursOf } from '../lib/journee.js';
import { SelectedPanel, PlanTools } from './DayPlanEdit.jsx';
import { shownLevel } from '../lib/niveaux.js';
import TimeGrid from './TimeGrid.jsx';

// The realistic day, on Today (2.0.0). Clarity proposes a plan — what fits in
// the working hours, where, what does not fit and why — and the person
// accepts it. Accepted, it is kept apart (localStorage, this computer): no
// task is changed, except those moved to tomorrow. When a block overruns, the
// rest moves on its own and the page says so. 2.1.0: drawn as a time grid —
// hours down the side, each block as tall as it lasts, in its level's color.
const API = 'http://localhost:3001/api';
const KEY = 'clarity-day-plan';
const LATER = 'clarity-day-plan-later';
const EDITS = 'clarity-day-edits';     // 2.2.0: the person's changes to today's plan
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const minutesNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function DayPlan({ tasks, events, T, onReload, onOpenDetail, onPlan, onMode }) {
  const { t, fmtDuration } = useLocale();
  const [workday, setWorkday] = useState(null);
  const [profile, setProfile] = useState(null);
  const [nowMin, setNowMin] = useState(minutesNow);
  const [today, setToday] = useState(localDay);
  const [accepted, setAccepted] = useState(() => { const p = read(KEY); return p?.date === localDay() ? p : null; });
  const [later, setLater] = useState(() => read(LATER) === localDay());
  const [shift, setShift] = useState(0);
  const [edits, setEdits] = useState(() => { const e = read(EDITS); return e?.date === localDay() ? e : { date: localDay() }; });
  const [selectedId, setSelectedId] = useState(null);
  const [askRedo, setAskRedo] = useState(false);

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
  // Today's hours: the day's own (Settings › Day to day), or changed for today only.
  const dayHours = useMemo(() => {
    if (!workday) return null;
    const [y, m, d] = today.split('-').map(Number);
    const own = hoursOf(workday, new Date(y, m - 1, d).getDay());
    if (!own && !edits.hours) return null;
    const base = own || { start: '09:00', end: '18:00', breaks: [], days: workday.days };
    return { ...base, ...(edits.hours?.start && { start: edits.hours.start }), ...(edits.hours?.end && edits.hours.end > (edits.hours.start || base.start) && { end: edits.hours.end }) };
  }, [workday, today, edits.hours]);
  const args = dayHours && { tasks, today, nowMin, workday: dayHours, events: eventsMin, estimation, peakHour, edits };

  const preview = useMemo(() => (args && !accepted ? buildPlan({ ...args, order: edits.order ? fullOrder(edits.order) : null }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, today, nowMin, dayHours, eventsMin, estimation, peakHour, accepted, edits]);

  // An order for buildPlan must name every task it may place: the ones given
  // first, then what was added to today, then the rest in the usual order.
  function fullOrder(first, e = edits) {
    const seen = new Set(first);
    const live = tasks.filter(x => x.status !== 'done' && !x.archived).map(x => x.id);
    return [...first, ...(e.included || []).filter(id => !seen.has(id)), ...live.filter(id => !seen.has(id) && !(e.included || []).includes(id))];
  }
  // Every change by hand: kept for the day; an accepted plan is rebuilt with it,
  // in its own order.
  function change(diff) {
    const e = { ...edits, ...diff, date: today };
    setEdits(e); write(EDITS, e);
    if (accepted && args) {
      const order = e.order ? fullOrder(e.order, e) : fullOrder(workIds(accepted), e);
      const next = { ...buildPlan({ ...args, edits: e, order }), date: today };
      setAccepted(next); write(KEY, next);
    }
  }
  const workIds = (p) => [...p.blocks].filter(b => b.kind === 'task' || b.kind === 'batch' || b.kind === 'fixed').sort((a, b) => a.start - b.start).flatMap(b => b.taskIds);

  // A new day forgets yesterday's plan, and yesterday's changes.
  useEffect(() => { if (accepted && accepted.date !== today) { setAccepted(null); write(KEY, null); } }, [today, accepted]);
  useEffect(() => { if (edits.date !== today) { setEdits({ date: today }); write(EDITS, null); } }, [today, edits.date]);

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
  const isWorkdayNow = !!dayHours;
  const mode = !workday || !plan ? null : (!accepted && (later || !isWorkdayNow)) ? 'idle' : 'grid';
  useEffect(() => { onMode?.(mode); }, [mode, onMode]);
  if (!workday) return null;
  if (!plan) {
    // A day not worked: nothing planned, but it can be asked for today only.
    return (
      <div data-tour="day-plan" data-day-plan="idle" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.ink60 }}>
        <button type="button" data-act="prepare" onClick={() => change({ hours: { start: workday.start, end: workday.end } })} style={{ padding: '6px 12px', fontSize: 12.5, fontFamily: T.fontUI, borderRadius: T.r6, cursor: 'pointer', background: 'transparent', color: T.ink60, border: `1px solid ${T.hairline}` }}>{t('day.prepare')}</button>
        <span>{t('day.notWorkday')}</span>
      </div>
    );
  }

  const byId = new Map(tasks.map(x => [x.id, x]));
  const dur = (m) => fmtDuration(m);   // « 1 h 20 », not « 1,3 h »
  const work = plan.blocks.filter(b => b.kind === 'task' || b.kind === 'batch' || b.kind === 'fixed');
  const overflow = plan.overflow.filter(o => byId.get(o.taskId)?.status !== 'done' && byId.get(o.taskId)?.deadline <= today);
  const isWorkday = isWorkdayNow;

  async function moveToTomorrow(ids) {
    const when = nextWorkday(today, workday.days);
    await Promise.all(ids.map(id => fetch(`${API}/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deadline: when }) }).catch(() => {})));
    onReload?.();
  }
  const accept = () => { const p = { ...preview, date: today }; setAccepted(p); write(KEY, p); setShift(0); };
  const hasEdits = Object.keys(edits).some(k => k !== 'date' && edits[k] && (!Array.isArray(edits[k]) || edits[k].length) && (typeof edits[k] !== 'object' || Object.keys(edits[k]).length));
  const redo = (fresh) => {
    setAccepted(null); write(KEY, null); setShift(0); setLater(false); write(LATER, null); setAskRedo(false); setSelectedId(null);
    if (fresh) { setEdits({ date: today }); write(EDITS, null); }
  };
  // Alt + ↑ / ↓, or « Earlier » / « Later »: one place up or down in the day.
  function nudge(item, dir) {
    const ids = item.taskIds || [item.taskId];
    const order = workIds(plan).filter(id => !ids.includes(id));
    const firstAt = workIds(plan).indexOf(ids[0]);
    // Move past one whole block, not one task of a group.
    const blocksOrder = [...plan.blocks].filter(b => b.kind === 'task' || b.kind === 'batch' || b.kind === 'fixed').sort((a, b) => a.start - b.start);
    const bi = blocksOrder.findIndex(b => b.taskIds.includes(ids[0]));
    const target = blocksOrder[bi + dir];
    if (!target) return;
    const anchor = dir < 0 ? order.indexOf(target.taskIds[0]) : order.indexOf(target.taskIds.at(-1)) + 1;
    order.splice(anchor < 0 ? Math.max(0, firstAt) : anchor, 0, ...ids);
    const pins = { ...(edits.pins || {}) }; ids.forEach(id => delete pins[id]);
    change({ order, pins });
  }
  const drop = (item, start) => change({ pins: { ...(edits.pins || {}), [item.taskId]: Math.max(0, Math.min(24 * 60 - 5, start)) } });
  const keepEstimate = async (id, minutes) => {
    await fetch(`${API}/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estimatedDuration: minutes }) }).catch(() => {});
    onReload?.();
  };
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

  // The grid: the plan's blocks, the calendar's events, the breaks.
  const items = [
    ...plan.blocks.map(b => {
      const done = b.taskIds.length > 0 && b.taskIds.every(id => byId.get(id)?.status === 'done');
      if (b.kind === 'event') return { id: b.id, kind: 'event', title: b.label, start: b.start, end: b.end };
      if (b.kind === 'pause') return { id: b.id, kind: 'pause', title: t('day.break'), start: b.start, end: b.end };
      if (b.kind === 'batch') return { id: b.id, kind: 'batch', taskIds: b.taskIds, title: label(b), start: b.start, end: b.end, done,
        sub: b.taskIds.map(id => ({ id, title: byId.get(id)?.title || '', done: byId.get(id)?.status === 'done' })) };
      const task = byId.get(b.taskIds[0]);
      const shown = shownLevel(task);
      return { id: b.id, kind: b.kind, taskId: b.taskIds[0], taskIds: b.taskIds, pinned: !!b.pinned, title: (task?.title || '') + (b.kind === 'fixed' ? ` · ${t('day.fixed')}` : ''),
        level: shown.level, inherited: shown.inherited, start: b.start, end: b.end, done,
        detail: b.factor && b.factor !== 1 ? t('day.corrected', { base: dur(b.base), minutes: dur(b.minutes), factor: String(b.factor).replace('.', ',') }) : null };
    }),
    ...breaksOf(dayHours).map((b, i) => ({ id: `break-${i}`, kind: 'break', ...b, title: b.label || t('day.break') })),
  ];
  const grid = layoutDay({ items, workday: dayHours });
  const selected = grid.items.find(i => i.id === selectedId) || null;
  // Not counted for today yet (even if the plan fills a gap with it): adding one
  // puts it with today's tasks, ahead of what is only filling.
  const candidates = tasks.filter(x => x.status !== 'done' && !x.archived && !(x.deadline && x.deadline.slice(0, 10) <= today)
    && !(edits.included || []).includes(x.id) && !(edits.excluded || []).includes(x.id)).slice(0, 40);
  const excludedTasks = (edits.excluded || []).map(id => byId.get(id)).filter(Boolean);
  const pinnedOver = plan.blocks.filter(b => b.pinned && nowMin >= b.end && b.taskIds.some(id => byId.get(id)?.status !== 'done'));
  const actions = (
    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
      {accepted ? (
        <button type="button" data-act="redo" onClick={() => (hasEdits ? setAskRedo(true) : redo(false))} style={btn(false)}>{t('day.redo')}</button>
      ) : (
        <>
          <button type="button" data-act="accept" onClick={accept} style={btn(true)}>{t('day.accept')}</button>
          <button type="button" data-act="later" onClick={putOff} style={btn(false)}>{t('day.later')}</button>
        </>
      )}
    </div>
  );

  return (
    <section data-tour="day-plan" data-day-plan={accepted ? 'accepted' : 'preview'} style={{ border: `1px solid ${T.hairline}`, borderRadius: T.r10, padding: '14px 18px 12px', background: T.paperSubtle }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        {accepted ? (
          <div data-now>
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
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: T.ink }}>{t('day.proposed')}</div>
            <div style={{ fontSize: 12.5, color: T.ink60, marginTop: 2 }}>
              {t('day.summary', { planned: dur(plan.planned), free: dur(plan.capacity) })}
              {plan.missing > 0 && <> · <span style={{ color: T.warn }}>{t('day.short', { time: dur(plan.missing) })}</span></>}
            </div>
          </div>
        )}
        {actions}
      </div>

      {work.length > 0 || grid.items.length > 0 ? (
        <TimeGrid testId="day" from={grid.from} to={grid.to} onOpen={(id) => onOpenDetail?.(byId.get(id))}
          onSelect={(it) => setSelectedId(cur => (cur === it.id ? null : it.id))} onDrag={drop} onNudge={nudge} selectedId={selectedId}
          columns={[{ key: today, items: grid.items, nowMin }]} />
      ) : null}
      {askRedo && (
        <div data-redo-ask role="group" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, fontSize: 12.5, color: T.ink80 }}>
          <span>{t('day.redoAsk')}</span>
          <button type="button" data-act="redo-keep" onClick={() => redo(false)} style={btn(true)}>{t('day.redoKeep')}</button>
          <button type="button" data-act="redo-fresh" onClick={() => redo(true)} style={btn(false)}>{t('day.redoFresh')}</button>
        </div>
      )}
      {pinnedOver.length > 0 && (
        <div role="status" data-pinned-over style={{ fontSize: 12, color: T.warn, marginTop: 8 }}>
          {pinnedOver.map(b => `« ${byId.get(b.taskIds[0])?.title} » — ${t('day.pinnedOver')}`).join(' · ')}
        </div>
      )}
      {selected && (
        <SelectedPanel key={selected.id} block={selected} task={byId.get(selected.taskId)} edits={edits} edit={change} onNudge={nudge}
          onOpen={(id) => onOpenDetail?.(byId.get(id))} onClose={() => setSelectedId(null)} onKeepEstimate={keepEstimate} T={T} />
      )}
      <PlanTools candidates={candidates} excludedTasks={excludedTasks} hours={dayHours} edits={edits} edit={change} T={T} />
      {!work.length && <div style={{ fontSize: 13, color: T.ink60, marginTop: 6 }}>{t('day.empty')}</div>}

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

    </section>
  );
}
