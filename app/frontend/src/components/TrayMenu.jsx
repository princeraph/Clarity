import { useState, useEffect } from 'react';
import ApertureMark from './ApertureMark.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

const API = 'http://localhost:3001/api';

// Always-dark palette — the tray popup lives against the Windows taskbar,
// which is dark regardless of the app theme. Values mirror system-tray.jsx.
const C = {
  cardBg:      'rgba(28, 28, 34, 0.98)',
  border:      'rgba(255,255,255,0.10)',
  divider:     'rgba(255,255,255,0.07)',
  tileBg:      'rgba(255,255,255,0.05)',
  hoverBg:     'rgba(255,255,255,0.06)',
  ink90:       'rgba(255,255,255,0.90)',
  ink82:       'rgba(255,255,255,0.82)',
  ink78:       'rgba(255,255,255,0.78)',
  ink45:       'rgba(255,255,255,0.45)',
  ink40:       'rgba(255,255,255,0.40)',
  ink35:       'rgba(255,255,255,0.35)',
  ink30:       'rgba(255,255,255,0.30)',
  kbdBg:       'rgba(255,255,255,0.06)',
  kbdBorder:   'rgba(255,255,255,0.08)',
  accent:      'oklch(0.68 0.13 258)',
  fontUI:      '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  fontMono:    '"Geist Mono", ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace',
};

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nextTaskLabel(task, t, fmtDate) {
  if (!task) return null;
  if (task.time) return task.time;
  if (task.deadline) {
    const today = todayStr();
    if (task.deadline < today) return t('capture.overdue');
    if (task.deadline === today) return t('time.today');
    return fmtDate(task.deadline + 'T00:00:00');
  }
  return null;
}

function ActionRow({ icon, label, kbd, muted, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '9px 18px', cursor: 'pointer',
        background: hov ? C.hoverBg : 'transparent',
      }}
    >
      <span style={{ fontSize: 12, color: muted ? C.ink30 : C.ink40, width: 14, textAlign: 'center' }}>{icon}</span>
      <span style={{ fontSize: 13, color: muted ? C.ink45 : C.ink78, flex: 1 }}>{label}</span>
      {kbd && (
        <span style={{
          fontFamily: C.fontMono, fontSize: 10, color: C.ink30,
          padding: '2px 5px', background: C.kbdBg, borderRadius: 3,
          border: `1px solid ${C.kbdBorder}`,
        }}>{kbd}</span>
      )}
    </div>
  );
}

export default function TrayMenu() {
  const { t, fmtDate, fmtDuration } = useLocale();
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const resp = await fetch(`${API}/tasks`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (alive) setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      } catch {}
    }
    load();
    // Refresh whenever the popup regains focus (reopened) or on a light interval
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    const iv = setInterval(load, 4000);
    return () => { alive = false; window.removeEventListener('focus', onFocus); clearInterval(iv); };
  }, []);

  const remaining = tasks.filter(t => t.status !== 'done');
  const doneToday = tasks.filter(t => t.status === 'done' && isToday(t.updatedAt)).length;
  const focusLeftMin = remaining.reduce((sum, t) => sum + (t.estimatedDuration || 0), 0);

  const nextTask = [...remaining].sort((a, b) => {
    const ad = a.deadline || '9999-99-99';
    const bd = b.deadline || '9999-99-99';
    if (ad !== bd) return ad < bd ? -1 : 1;
    const at = a.time || '99:99';
    const bt = b.time || '99:99';
    return at < bt ? -1 : at > bt ? 1 : 0;
  })[0] || null;

  const stats = [
    { value: String(doneToday),          label: t('focus.stat.done') },
    { value: String(remaining.length),   label: t('tray.remaining') },
    { value: fmtDuration(Math.max(0, focusLeftMin || 0)), label: t('tray.focusLeft') },
  ];

  const act = (name) => () => window.clarity?.trayAction?.(name);

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      background: 'transparent', fontFamily: C.fontUI,
      padding: 8, boxSizing: 'border-box',
    }}>
      <div style={{
        width: '100%',
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        boxShadow: '0 16px 48px rgba(0,0,0,0.48), 0 2px 8px rgba(0,0,0,0.24)',
        overflow: 'hidden',
      }}>
        {/* Today summary header */}
        <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${C.divider}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <ApertureMark s={16} ink={C.ink90} accent={C.accent} />
            <span style={{ fontSize: 13, fontWeight: 500, color: C.ink90 }}>clarity</span>
            <span style={{
              marginLeft: 'auto', fontFamily: C.fontMono, fontSize: 9.5, letterSpacing: '0.10em',
              textTransform: 'uppercase', color: C.ink35,
            }}>{t('tray.onDevice')}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {stats.map(s => (
              <div key={s.label} style={{ padding: '8px 10px', background: C.tileBg, borderRadius: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: C.ink90, letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontFamily: C.fontMono, fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.ink35, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Next task */}
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.divider}` }}>
          <div style={{ fontFamily: C.fontMono, fontSize: 9.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: C.ink35, marginBottom: 8 }}>{t('tray.upNext')}</div>
          {nextTask ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', border: `1.5px solid ${C.accent}`, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: C.ink82, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextTask.title}</span>
              {nextTaskLabel(nextTask, t, fmtDate) && (
                <span style={{ fontFamily: C.fontMono, fontSize: 10.5, color: C.ink35, flexShrink: 0 }}>{nextTaskLabel(nextTask, t, fmtDate)}</span>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: C.ink45 }}>{t('tray.nothingLeft')}</div>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ padding: '6px 0' }}>
          <ActionRow icon="⊕" label={t('tray.quickCapture')} kbd="Ctrl+K" onClick={act('capture')} />
          <ActionRow icon="◎" label={t('tray.openClarity')}   kbd=""       onClick={act('open')} />
          <ActionRow icon="◷" label={t('tray.viewToday')}     kbd="Ctrl+1" onClick={act('today')} />
          <ActionRow icon="⊙" label={t('tray.askClarity')}    kbd="Ctrl+/" onClick={act('chat')} />
          <div style={{ height: 1, background: C.divider, margin: '4px 0' }} />
          <ActionRow icon="✕" label={t('tray.quitClarity')} muted onClick={act('quit')} />
        </div>
      </div>
    </div>
  );
}
