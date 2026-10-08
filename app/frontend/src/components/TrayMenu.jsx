import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import ApertureMark from './ApertureMark.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { C, tasksAtHand, todayStr } from './glance.js';
import { parseInput } from '../lib/saisie.js';
import { useFeatures } from '../features.js';

const API = 'http://localhost:3001/api';
const PANEL_TASKS = 8;

// Kept for older imports: the palette lives in glance.js.
export { C };

// The "Today" panel — the laptop's answer to a phone's home-screen widget.
// A widget on the desktop would sit under the windows all day; this comes up
// over them, from the tray icon or Ctrl+Alt+Space anywhere, shows the day's
// tasks with their details, lets them be ticked off, and goes away when the
// person clicks elsewhere (electron/main.js).

const isToday = (iso) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

async function saveTask(id, patch) {
  try {
    const r = await fetch(`${API}/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    return r.ok;
  } catch { return false; }
}

function Check({ done, onToggle, label, size = 16 }) {
  return (
    <button type="button" role="checkbox" aria-checked={done} aria-label={label} onClick={onToggle} style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', padding: 0,
      border: `1.5px solid ${done ? C.accent : C.ink35}`, background: done ? C.accent : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#19191A', fontSize: size * 0.6, lineHeight: 1,
    }}>{done ? '✓' : ''}</button>
  );
}

function TaskRow({ task, dot, open, onOpen, onDone, onSubtask, t, fmtDuration, fmtHours }) {
  const subs = task.subtasks || [];
  const meta = [
    task.time,
    task.estimatedDuration ? (task.estimatedDuration >= 60 ? fmtHours(task.estimatedDuration) : fmtDuration(task.estimatedDuration)) : null,
    subs.length ? t('panel.subtasks', { done: subs.filter(s => s.done).length, total: subs.length }) : null,
    ...(task.tags || []).map(tag => `#${tag}`),
  ].filter(Boolean);
  const hasDetails = !!task.description || subs.length > 0;
  return (
    <div style={{ padding: '7px 0', borderTop: `1px solid ${C.divider}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ paddingTop: 1 }}>
          <Check done={false} onToggle={() => onDone(task)} label={t('panel.markDone', { title: task.title })} />
        </div>
        <button type="button" onClick={() => onOpen(open ? null : task.id)} aria-expanded={hasDetails ? open : undefined} style={{
          flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: C.ink90, overflow: 'hidden', textOverflow: open ? 'clip' : 'ellipsis', whiteSpace: open ? 'normal' : 'nowrap' }}>{task.title}</span>
          </div>
          {meta.length > 0 && (
            <div style={{ fontFamily: C.fontMono, fontSize: 10.5, color: C.ink40, marginTop: 3, paddingLeft: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.join(' · ')}</div>
          )}
        </button>
      </div>
      {open && (
        <div style={{ margin: '8px 0 2px 26px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {task.description && (
            <div style={{ fontSize: 12, color: C.ink78, lineHeight: 1.45, whiteSpace: 'pre-wrap', maxHeight: 110, overflowY: 'auto' }}>{task.description}</div>
          )}
          {subs.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Check size={13} done={!!s.done} onToggle={() => onSubtask(task, i)} label={s.title} />
              <span style={{ fontSize: 12, color: s.done ? C.ink40 : C.ink82, textDecoration: s.done ? 'line-through' : 'none' }}>{s.title}</span>
            </div>
          ))}
          <button type="button" onClick={() => window.clarity?.trayAction?.(`task:${task.id}`)} style={{
            alignSelf: 'flex-start', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 11.5, color: C.accent,
          }}>{t('panel.openTask')}</button>
        </div>
      )}
    </div>
  );
}

function Group({ label, tasks, dot, ...rest }) {
  if (!tasks.length) return null;
  return (
    <div style={{ padding: '10px 16px 4px' }}>
      <div style={{ fontFamily: C.fontMono, fontSize: 9.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: C.ink35, marginBottom: 2 }}>{label}</div>
      {tasks.map(task => <TaskRow key={task.id} task={task} dot={dot} open={rest.openId === task.id} {...rest} />)}
    </div>
  );
}

export default function TrayMenu() {
  const { t, fmtDate, fmtDuration, fmtHours } = useLocale();
  const [data, setData] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [justDone, setJustDone] = useState(null);
  const [pinned, setPinned] = useState(false);
  const [draft, setDraft] = useState('');
  const [addFailed, setAddFailed] = useState(false);
  const card = useRef(null);
  const input = useRef(null);
  const loadRef = useRef(() => {});   // the latest load(), for the 'shown' message
  const features = useFeatures();

  // Pinned: it stays open like a sticky note. Shown: up to date, and ready to
  // type a task — without waiting for the next refresh, which showed the tasks
  // of the last time it was open.
  useEffect(() => {
    window.clarity?.panel?.get().then(p => setPinned(!!p?.pinned)).catch(() => {});
    return window.clarity?.panel?.onShown(() => { loadRef.current(); input.current?.focus(); });
  }, []);
  async function togglePin() {
    const next = !pinned;
    setPinned(next);
    try { await window.clarity?.panel?.pin(next); } catch { setPinned(!next); }
  }

  // Adding from here — from anywhere, through Ctrl+Alt+Space — understood like
  // Ctrl+K in the app (lib/saisie.js), with the same Settings › Capture options.
  async function add() {
    const p = parseInput(draft, new Date(), { tags: features?.captureTags !== false, duration: features?.captureDuration !== false });
    if (!p.title.trim()) return;
    try {
      const r = await fetch(`${API}/tasks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: p.title, tags: p.tags, deadline: p.deadline || null, estimatedDuration: p.estimatedDuration || null }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setDraft(''); setAddFailed(false); load();
    } catch { setAddFailed(true); }
  }

  const load = useCallback(async () => {
    try {
      const resp = await fetch(`${API}/tasks`);
      if (!resp.ok) return;
      const body = await resp.json();
      setData({ tasks: Array.isArray(body.tasks) ? body.tasks : [], analysis: body.analysis });
    } catch { /* backend starting: next tick */ }
  }, []);

  useEffect(() => {
    loadRef.current = load;
    load();
    const onFocus = () => load();
    const onVisible = () => { if (!document.hidden) load(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    // Hidden or covered, it has nothing to show; it reloads when seen again.
    const iv = setInterval(() => { if (!document.hidden) load(); }, 4000);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisible); clearInterval(iv); };
  }, [load]);

  // The window is as tall as the card: an empty transparent band above it
  // would catch clicks meant for what is behind.
  useLayoutEffect(() => {
    if (!card.current || !window.clarity?.trayResize) return undefined;
    const send = () => window.clarity.trayResize(Math.ceil(card.current.getBoundingClientRect().height));
    send();
    const ro = new ResizeObserver(send);
    ro.observe(card.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') window.clarity?.trayAction?.('hide'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A tick by mistake is undone from here. Not for a recurring task: ticking it
  // already created the next one (backend/server.js), which undoing would not remove.
  async function done(task) {
    const entry = { id: task.id, title: task.title, from: task.status || 'not_started', undoable: !task.recurring || task.recurring === 'none' };
    setJustDone(entry);
    if (await saveTask(task.id, { status: 'done' })) load();
    setTimeout(() => setJustDone(j => (j === entry ? null : j)), 6000);
  }
  async function undo() {
    const entry = justDone;
    setJustDone(null);
    if (entry && await saveTask(entry.id, { status: entry.from })) load();
  }
  async function toggleSubtask(task, i) {
    const subtasks = (task.subtasks || []).map((s, k) => (k === i ? { ...s, done: !s.done } : s));
    setData(d => ({ ...d, tasks: d.tasks.map(x => (x.id === task.id ? { ...x, subtasks } : x)) }));
    if (!(await saveTask(task.id, { subtasks }))) load();
  }

  const act = (name) => () => window.clarity?.trayAction?.(name);
  const tasks = data?.tasks || [];
  const atHand = tasksAtHand(tasks, data?.analysis, PANEL_TASKS);
  const doneToday = tasks.filter(x => x.status === 'done' && isToday(x.updatedAt)).length;
  // What is still for today counts the late ones too: they are listed above the
  // day's own, and a count of 0 over a list of overdue tasks read as a mistake.
  const dueToday = tasks.filter(x => !x.archived && x.status !== 'done' && x.deadline && x.deadline <= todayStr()).length;
  const rowProps = { openId, onOpen: setOpenId, onDone: done, onSubtask: toggleSubtask, t, fmtDuration, fmtHours };
  const shown = atHand.overdue.length + atHand.today.length + atHand.next.length;
  const btn = { flex: 1, padding: '8px 10px', borderRadius: 6, fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer' };

  return (
    // The card is the whole window (electron/main.js: an opaque window of the
    // card's size), so no margin, no shadow drawn here — Windows draws its own.
    <div style={{ fontFamily: C.fontUI, background: C.cardBg }}>
      <div ref={card} style={{
        background: C.cardBg, border: `1px solid ${C.border}`, overflow: 'hidden',
      }}>
        {/* The header moves the panel (a window region Windows drags). */}
        <div style={{ padding: '12px 10px 10px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${C.divider}`, WebkitAppRegion: 'drag', cursor: 'grab' }}>
          <ApertureMark s={16} ink={C.ink90} accent={C.accent} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.ink90 }}>{t('panel.title')}</div>
            <div style={{ fontSize: 11.5, color: C.ink45, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontSize: 11, color: C.ink40, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t('panel.counts', { due: dueToday, done: doneToday })}
            </div>
          </div>
          <button type="button" onClick={togglePin} aria-pressed={pinned} title={t(pinned ? 'panel.unpin' : 'panel.pin')} aria-label={t(pinned ? 'panel.unpin' : 'panel.pin')} style={{
            WebkitAppRegion: 'no-drag', background: pinned ? C.tileBg : 'transparent', border: `1px solid ${pinned ? C.border : 'transparent'}`,
            borderRadius: 6, padding: '5px 6px', cursor: 'pointer', color: pinned ? C.accent : C.ink40, lineHeight: 0,
          }}>
            {/* A pin: outlined until pinned, filled once it is. */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 4h6l-1 6 4 4H6l4-4-1-6z" /><path d="M12 14v7" />
            </svg>
          </button>
          <button type="button" onClick={act('hide')} aria-label={t('common.close')} title={t('common.close')} style={{
            WebkitAppRegion: 'no-drag', background: 'transparent', border: 'none', padding: '4px 8px', cursor: 'pointer', color: C.ink40, fontSize: 14, lineHeight: 1,
          }}>✕</button>
        </div>

        <div style={{ padding: '10px 12px 4px' }}>
          <input
            ref={input}
            value={draft}
            onChange={e => { setDraft(e.target.value); setAddFailed(false); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder={t('panel.addPlaceholder')}
            aria-label={t('panel.add')}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit',
              color: C.ink90, background: C.tileBg, border: `1px solid ${addFailed ? 'oklch(0.68 0.16 25)' : C.border}`, borderRadius: 6, outline: 'none',
            }}
          />
          {addFailed && <div role="alert" style={{ fontSize: 11.5, color: 'oklch(0.75 0.14 25)', marginTop: 4 }}>{t('onboarding.addFailed')}</div>}
        </div>

        <div style={{ maxHeight: 420, overflowY: 'auto', paddingBottom: 6 }}>
          {data && shown === 0 && (
            <div style={{ padding: '18px 16px', fontSize: 13, color: C.ink45 }}>{t('panel.empty')}</div>
          )}
          <Group label={t('capture.overdue')} tasks={atHand.overdue} dot="oklch(0.68 0.16 25)" {...rowProps} />
          <Group label={t('time.today')} tasks={atHand.today} dot={C.accent} {...rowProps} />
          <Group label={t('wake.next')} tasks={atHand.next} dot={C.ink35} {...rowProps} />
        </div>

        {justDone && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px 6px 16px', fontSize: 12, color: C.ink78, borderTop: `1px solid ${C.divider}` }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('panel.done', { title: justDone.title })}</span>
            {justDone.undoable && (
              <button type="button" onClick={undo} style={{ background: 'transparent', border: 'none', padding: '2px 4px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, color: C.accent, flexShrink: 0 }}>{t('toast.undo')}</button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: `1px solid ${C.divider}` }}>
          <button type="button" onClick={act('open')} style={{ ...btn, background: C.ink90, border: 'none', color: '#19191A', fontWeight: 500 }}>{t('tray.openClarity')}</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 10px', gap: 8 }}>
          <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.ink30 }}>{t('panel.shortcut')}</span>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={act('quit')} style={{ background: 'transparent', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 11, color: C.ink35, cursor: 'pointer' }}>{t('tray.quitClarity')}</button>
        </div>
      </div>
    </div>
  );
}
