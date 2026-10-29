import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { quickChoices, snooze, fromStamp, stamp } from '../lib/rappels.js';

// Reminders (2.3.0). Three pieces:
//  - ReminderRow: the detail panel's « Remind me », quick choices or a time;
//  - ReminderSettings: Settings › Day to day › Reminders;
//  - ReminderToasts: asks the server every half minute what is due (it hands
//    each reminder over once), shows the system notification, and a card in
//    the window with what can be done: done, in 10 minutes, tomorrow, open.
//    The day plan's blocks are reminded from here too: the plan lives here.
const API = 'http://localhost:3001/api';
const isElectron = typeof window !== 'undefined' && !!window.clarity?.isElectron;
const put = (id, body) => fetch(`${API}/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const BLOCKS_DONE = 'clarity-block-reminded';

export function ReminderRow({ task, T, onSaved, onEdited }) {
  const { t, fmtDate } = useLocale();
  const [workday, setWorkday] = useState(null);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { fetch(`${API}/settings`).then(r => r.json()).then(s => setWorkday(s.workday)).catch(() => {}); }, []);
  const set = async (reminder) => {
    setError('');
    const r = await put(task.id, { reminder }).catch(() => null);
    if (!r?.ok) { setError(t('remind.saveFailed')); return; }
    onEdited?.(task, { reminder }); onSaved?.();
  };
  const when = (s) => { const d = fromStamp(s); return d ? `${fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })} ${s.slice(11)}` : s; };
  const pill = { padding: '4px 9px', borderRadius: T.rPill, fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer', background: 'transparent', color: T.ink80, border: `1px solid ${T.hairline}` };
  return (
    <div data-reminder-row>
      <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 }}>{t('remind.title')}</div>
      {task.reminder ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: T.ink }}>
          <span data-reminder-set>🔔 {when(task.reminder)}</span>
          <button type="button" data-act="remove-reminder" onClick={() => set(null)} style={{ ...pill, color: T.ink60 }}>{t('remind.remove')}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {quickChoices(new Date(), task, workday).map(c => (
            <button key={c.id} type="button" data-remind={c.id} title={when(c.at)} onClick={() => set(c.at)} style={pill}>{t(`remind.quick.${c.id}`)}</button>
          ))}
          <input aria-label={t('a11y.reminderAt')} type="datetime-local" name="reminder-at" value={custom} onChange={e => setCustom(e.target.value)}
            style={{ padding: '3px 6px', fontSize: 12, fontFamily: T.fontMono, background: T.paper, color: T.ink, border: `1px solid ${T.hairline}`, borderRadius: T.r6 }} />
          {custom && <button type="button" data-act="set-reminder" onClick={() => set(custom.slice(0, 16))} style={{ ...pill, background: T.ink, color: T.paper, border: 'none' }}>{t('remind.set')}</button>}
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: 12, color: T.warn, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

export function ReminderSettings({ T }) {
  const { t } = useLocale();
  const [r, setR] = useState(null);
  // Start with Windows, here too (tâche 4): a reminder is only given while
  // Clarity runs, and the switch used to live only under Startup, where nobody
  // setting a reminder would look. The same login item as Settings › Startup.
  const [login, setLogin] = useState(null);
  useEffect(() => { fetch(`${API}/settings`).then(x => x.json()).then(s => setR(s.reminders)).catch(() => {}); }, []);
  useEffect(() => { window.clarity?.loginItem?.get().then(setLogin).catch(() => {}); }, []);
  if (!r) return null;
  const save = (change) => {
    const next = { ...r, ...change }; setR(next);
    fetch(`${API}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reminders: next }) }).catch(() => {});
  };
  const label = { fontSize: 13, color: T.ink, flex: 1 };
  const row = { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' };
  const toggle = (k) => (
    <button type="button" role="switch" aria-checked={r[k]} aria-label={t(`remind.settings.${k}`)} data-toggle={k} onClick={() => save({ [k]: !r[k] })} style={{
      width: 34, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative', background: r[k] ? T.accent : T.ink20, flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: r[k] ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s ease' }} />
    </button>
  );
  return (
    <section data-tour="reminders">
      <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 500, color: T.ink }}>{t('remind.settings.title')}</h3>
      <div style={{ fontSize: 12.5, color: T.ink60, lineHeight: 1.5, marginBottom: 8 }}>{t('remind.settings.subtitle')}</div>
      <div style={row}>
        <span style={label}>{t('remind.settings.before')}</span>
        <select aria-label={t('remind.settings.before')} name="remind-before" value={r.before} onChange={e => save({ before: Number(e.target.value) })} style={{ padding: '4px 6px', fontSize: 12.5, fontFamily: T.fontUI, background: T.paper, color: T.ink, border: `1px solid ${T.hairline}`, borderRadius: T.r6 }}>
          {[0, 5, 10, 15, 30, 60].map(m => <option key={m} value={m}>{m ? t('remind.settings.minutesBefore', { n: m }) : t('remind.settings.never')}</option>)}
        </select>
      </div>
      <div style={row}><span style={label}>{t('remind.settings.morning')}</span>{toggle('morning')}</div>
      <div style={row}><span style={label}>{t('remind.settings.blocks')}</span>{toggle('blocks')}</div>
      {login?.supported && (
        <div style={row}>
          <span style={label}>{t('remind.settings.startup')}<span style={{ display: 'block', fontSize: 12, color: T.ink60 }}>{t('remind.settings.startupHint')}</span></span>
          <button type="button" role="switch" aria-checked={!!login.enabled} aria-label={t('remind.settings.startup')} data-toggle="startup"
            onClick={() => window.clarity.loginItem.set(!login.enabled).then(setLogin).catch(() => {})} style={{
            width: 34, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative', background: login.enabled ? T.accent : T.ink20, flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 2, left: login.enabled ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s ease' }} />
          </button>
        </div>
      )}
    </section>
  );
}

// The cards outlive the component: the server hands each reminder over once,
// so a card lost to a re-render (the window rebuilding a branch) is lost for good.
let kept = (() => { try { return JSON.parse(sessionStorage.getItem('clarity-reminder-cards') || '[]'); } catch { return []; } })();

export function ReminderToasts({ tasks, onOpenTask, onGoToday }) {
  const { t } = useLocale();
  const { T } = useTheme();
  const [cards, setCardsState] = useState(() => kept);
  const setCards = (fn) => setCardsState(cur => {
    kept = typeof fn === 'function' ? fn(cur) : fn;
    try { sessionStorage.setItem('clarity-reminder-cards', JSON.stringify(kept)); } catch {}
    return kept;
  });
  const settings = useRef({ reminders: { blocks: true }, workday: null });
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const tickRef = useRef(null);
  const loaded = tasks.length > 0;
  // Once the tasks are there, look at once: a block starting now should not wait half a minute.
  useEffect(() => { if (loaded) tickRef.current?.(); }, [loaded]);

  useEffect(() => {
    const loadSettings = () => fetch(`${API}/settings`).then(r => r.json()).then(s => { settings.current = s; }).catch(() => {});
    loadSettings();
    window.addEventListener('clarity-workday', loadSettings);
    const notify = (title, body, taskId) => { if (isElectron) { try { window.clarity.showNotification(title, body, taskId); } catch {} } };
    const textOf = (r) => {
      if (r.kind === 'morning') return { title: t('remind.morningTitle'), body: t(r.taskIds.length === 1 ? 'remind.morningOne' : 'remind.morning', { n: r.taskIds.length, titles: r.titles.slice(0, 3).join(', ') }) };
      if (r.kind === 'before') return { title: t('remind.beforeTitle'), body: t('remind.before', { title: r.title, time: r.startsAt ? new Date(r.startsAt).toTimeString().slice(0, 5) : '' }) };
      // Missed while Clarity was closed (tâche 4): one card for all of them.
      if (r.kind === 'missed') return { title: t('remind.missedTitle'), body: t(r.taskIds.length === 1 ? 'remind.missedOne' : 'remind.missed', { n: r.taskIds.length, titles: r.titles.slice(0, 3).join(', ') }) };
      if (r.kind === 'block') return { title: t('remind.blockTitle'), body: t('remind.block', { title: r.title, time: r.until }) };
      return { title: t('remind.taskTitle'), body: r.title };
    };
    const show = (list) => {
      for (const r of list) { const x = textOf(r); notify(x.title, x.body, r.taskId); }
      if (list.length) setCards(cur => [...cur, ...list.map(r => ({ ...r, ...textOf(r) }))].slice(-4));
    };
    async function tick() {
      try {
        const r = await fetch(`${API}/reminders/claim`, { method: 'POST' });
        if (r.ok) show((await r.json()).reminders || []);
      } catch {}
      // The plan's blocks: when one starts (within 2 minutes), once.
      if (settings.current.reminders?.blocks !== false) try {
        const plan = JSON.parse(localStorage.getItem('clarity-day-plan') || 'null');
        const now = new Date();
        const today = stamp(now).slice(0, 10);
        if (!plan || plan.date !== today) return;
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const given = JSON.parse(localStorage.getItem(BLOCKS_DONE) || '{}');
        const due = plan.blocks.filter(b => (b.kind === 'task' || b.kind === 'batch' || b.kind === 'fixed') && nowMin >= b.start && b.start + 2 > nowMin && !given[`${today}:${b.id}:${b.start}`]);
        // Not before the tasks are loaded: a block would be noted as given, unseen.
        if (!due.length || !tasksRef.current.length) return;
        const byId = new Map(tasksRef.current.map(x => [x.id, x]));
        const live = due.filter(b => b.taskIds.some(id => byId.get(id) && byId.get(id).status !== 'done'));
        const keep = Object.fromEntries(Object.entries(given).filter(([k]) => k.startsWith(today)));
        for (const b of due) keep[`${today}:${b.id}:${b.start}`] = 1;
        localStorage.setItem(BLOCKS_DONE, JSON.stringify(keep));
        const pad = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        show(live.map(b => ({ key: `block:${b.id}`, kind: 'block', taskId: b.kind === 'batch' ? undefined : b.taskIds[0], title: b.taskIds.map(id => byId.get(id)?.title).filter(Boolean).join(', '), until: pad(b.end) })));
      } catch {}
    }
    tickRef.current = tick;
    tick();
    const id = setInterval(tick, 30000);
    return () => { clearInterval(id); window.removeEventListener('clarity-workday', loadSettings); };
  }, [t]);

  if (!cards.length) return null;
  const close = (key) => setCards(cur => cur.filter(c => c.key !== key));
  const act = async (c, what) => {
    close(c.key);
    if (what === 'open') return c.taskId ? onOpenTask?.(c.taskId) : onGoToday?.();
    if (!c.taskId) return;
    if (what === 'done') await put(c.taskId, { status: 'done' }).catch(() => {});
    else await put(c.taskId, { reminder: snooze(new Date(), what, settings.current.workday) }).catch(() => {});
  };
  const b = (primary) => ({ padding: '4px 9px', fontSize: 12, fontFamily: T.fontUI, borderRadius: T.r6, cursor: 'pointer',
    ...(primary ? { background: T.ink, color: T.paper, border: 'none' } : { background: 'transparent', color: T.ink80, border: `1px solid ${T.hairline}` }) });
  return (
    <div aria-live="polite" style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 900, display: 'flex', flexDirection: 'column', gap: 8, width: 340, maxWidth: 'calc(100vw - 36px)' }}>
      {cards.map(c => (
        <div key={c.key} data-reminder-card={c.kind} role="status" className="clarity-card" style={{ background: T.panel, border: `1px solid ${T.hairline}`, borderRadius: T.r10, padding: '12px 14px', boxShadow: '0 8px 28px rgba(0,0,0,0.16)', fontFamily: T.fontUI }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span aria-hidden="true">🔔</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: T.ink60 }}>{c.title}</div>
              <div style={{ fontSize: 13.5, color: T.ink, marginTop: 2 }}>{c.body}</div>
            </div>
            <button type="button" aria-label={t('remind.dismiss')} onClick={() => close(c.key)} style={{ background: 'transparent', border: 'none', color: T.ink40, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {c.taskId && <button type="button" data-act="done" onClick={() => act(c, 'done')} style={b(true)}>{t('remind.done')}</button>}
            {c.taskId && <button type="button" data-act="soon" onClick={() => act(c, 'soon')} style={b(false)}>{t('remind.soon')}</button>}
            {c.taskId && <button type="button" data-act="tomorrow" onClick={() => act(c, 'tomorrow')} style={b(false)}>{t('remind.tomorrow')}</button>}
            <button type="button" data-act="open" onClick={() => act(c, 'open')} style={b(false)}>{t(c.taskId ? 'remind.open' : 'remind.seeToday')}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
