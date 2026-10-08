import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import ApertureMark from './ApertureMark.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { C, tasksAtHand } from './glance.js';

const API = 'http://localhost:3001/api';
const AUTO_CLOSE_MS = 2 * 60 * 1000;

function Group({ label, tasks, dot, t }) {
  if (!tasks.length) return null;
  return (
    <div style={{ padding: '10px 18px 4px' }}>
      <div style={{ fontFamily: C.fontMono, fontSize: 9.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: C.ink35, marginBottom: 6 }}>{label}</div>
      {tasks.map(task => (
        <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', border: `1.5px solid ${dot}`, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: C.ink82, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
          {task.time && <span style={{ fontFamily: C.fontMono, fontSize: 10.5, color: C.ink35, flexShrink: 0 }}>{task.time}</span>}
          {task.status === 'in_progress' && <span title={t('status.inProgress')} style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, flexShrink: 0 }} />}
        </div>
      ))}
    </div>
  );
}

// The card shown when the computer wakes from sleep (electron/main.js decides
// when). It never takes the focus, closes itself after two minutes if the
// pointer never came over it, and can be turned off from here.
export default function WakeCard() {
  const { t } = useLocale();
  const [data, setData] = useState(null);
  const card = useRef(null);
  const hovered = useRef(false);
  const wake = window.clarity?.wake;

  useEffect(() => {
    fetch(`${API}/tasks`).then(r => (r.ok ? r.json() : null)).then(body => {
      if (!body) { wake?.close(); return; }
      const atHand = tasksAtHand(body.tasks || [], body.analysis);
      if (!atHand.total) { wake?.close(); return; }   // nothing to do: say nothing
      setData({ ...atHand, advice: body.analysis?.whatToDoNext || '' });
    }).catch(() => wake?.close());
    const timer = setTimeout(() => { if (!hovered.current) wake?.close(); }, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [wake]);

  // The window is the card (electron/main.js: opaque, of the card's height).
  useLayoutEffect(() => {
    if (data && card.current) wake?.ready(Math.ceil(card.current.getBoundingClientRect().height));
  }, [data, wake]);

  async function hideForGood() {
    try {
      await fetch(`${API}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wakeSummary: false }) });
    } catch { /* it will simply show again next time */ }
    wake?.close();
  }

  if (!data) return null;
  const linkBtn = { background: 'transparent', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 12, color: C.ink45, cursor: 'pointer' };

  return (
    <div style={{ fontFamily: C.fontUI, background: C.cardBg }}>
      <div
        ref={card}
        onMouseEnter={() => { hovered.current = true; }}
        style={{ background: C.cardBg, border: `1px solid ${C.border}`, overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 12px 10px 18px', borderBottom: `1px solid ${C.divider}` }}>
          <ApertureMark s={16} ink={C.ink90} accent={C.accent} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: C.ink90 }}>{t('wake.title')}</div>
            <div style={{ fontSize: 11.5, color: C.ink45, marginTop: 1 }}>{t('wake.remaining', { count: data.total })}</div>
          </div>
          <button onClick={() => wake?.close()} aria-label={t('common.close')} title={t('common.close')}
            style={{ background: 'transparent', border: 'none', color: C.ink40, fontSize: 14, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>

        {data.advice && (
          <div style={{ margin: '12px 18px 2px', padding: '9px 11px', background: C.tileBg, borderRadius: 6 }}>
            <div style={{ fontFamily: C.fontMono, fontSize: 9.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: C.ink35, marginBottom: 4 }}>{t('wake.advice')}</div>
            <div style={{ fontSize: 12.5, color: C.ink78, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{data.advice}</div>
          </div>
        )}

        <Group label={t('capture.overdue')} tasks={data.overdue} dot="oklch(0.68 0.16 25)" t={t} />
        <Group label={t('time.today')} tasks={data.today} dot={C.accent} t={t} />
        <Group label={t('wake.next')} tasks={data.next} dot={C.ink35} t={t} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px 14px', marginTop: 6, borderTop: `1px solid ${C.divider}` }}>
          <button onClick={hideForGood} title={t('wake.hideHint')} style={linkBtn}>{t('wake.hide')}</button>
          <div style={{ flex: 1 }} />
          <button onClick={() => window.clarity?.trayAction?.('open')}
            style={{ padding: '7px 14px', fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', color: '#19191A', background: C.ink90, border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            {t('tray.openClarity')}
          </button>
        </div>
      </div>
    </div>
  );
}
