import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import ApertureMark from './ApertureMark.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { C, tasksAtHand, todayStr } from './glance.js';

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
  const card = useRef(null);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(`${API}/tasks`);
      if (!resp.ok) return;
      const body = await resp.json();
      setData({ tasks: Array.isArray(body.tasks) ? body.tasks : [], analysis: body.analysis });
    } catch { /* backend starting: next tick */ }
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    const iv = setInterval(load, 4000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(iv); };
  }, [load]);

  // The window is as tall as the card: an empty transparent band above it
  // would catch clicks meant for what is behind.
  useLayoutEffect(() => {
    if (!card.current || !window.clarity?.trayResize) return undefined;
    const send = () => window.clarity.trayResize(Math.ceil(card.current.getBoundingClientRect().height) + 16);
    send();
    const ro = new ResizeObserver(send);
    ro.observe(card.current);
    return () => ro.disconnect();
  }, [data]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') window.clarity?.trayAction?.('hide'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function done(task) {
    setJustDone(task.title);
    if (await saveTask(task.id, { status: 'done' })) load();
    setTimeout(() => setJustDone(j => (j === task.title ? null : j)), 2500);
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
  const dueToday = tasks.filter(x => !x.archived && x.status !== 'done' && x.deadline === todayStr()).length;
  const rowProps = { openId, onOpen: setOpenId, onDone: done, onSubtask: toggleSubtask, t, fmtDuration, fmtHours };
  const shown = atHand.overdue.length + atHand.today.length + atHand.next.length;
  const btn = { flex: 1, padding: '8px 10px', borderRadius: 6, fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer' };

  return (
    <div style={{ padding: 8, fontFamily: C.fontUI, background: 'transparent' }}>
      <div ref={card} style={{
        background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 10,
        boxShadow: '0 16px 48px rgba(0,0,0,0.48), 0 2px 8px rgba(0,0,0,0.24)', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${C.divider}` }}>
          <ApertureMark s={16} ink={C.ink90} accent={C.accent} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.ink90 }}>{t('panel.title')}</div>
            <div style={{ fontSize: 11.5, color: C.ink45, marginTop: 1 }}>
              {t('panel.subtitle', { date: fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }), due: dueToday, done: doneToday })}
            </div>
          </div>
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
          <div role="status" style={{ padding: '6px 16px', fontSize: 12, color: C.ink78, borderTop: `1px solid ${C.divider}` }}>{t('panel.done', { title: justDone })}</div>
        )}

        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: `1px solid ${C.divider}` }}>
          <button type="button" onClick={act('capture')} style={{ ...btn, background: C.tileBg, border: `1px solid ${C.border}`, color: C.ink90 }}>{t('panel.add')}</button>
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
