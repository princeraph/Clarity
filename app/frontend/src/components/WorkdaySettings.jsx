import { useEffect, useState } from 'react';
import { useLocale } from '../contexts/LocaleContext.jsx';

// Settings › Day to day › Working hours (2.0.0): what the realistic day plans
// in (lib/journee.js). Saved field by field, like the switches above it.
const API = 'http://localhost:3001/api';
const DAYS = [1, 2, 3, 4, 5, 6, 0];   // Monday first

export default function WorkdaySettings({ T }) {
  const { t } = useLocale();
  const [w, setW] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/settings`).then(r => r.json()).then(s => setW(s.workday)).catch(() => {});
  }, []);

  async function save(change) {
    const next = { ...w, ...change };
    setW(next); setError('');
    try {
      const r = await fetch(`${API}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workday: next }) });
      if (!r.ok) { setError(t('workday.invalid')); return; }
      window.dispatchEvent(new Event('clarity-workday'));
    } catch { setError(t('workday.saveFailed')); }
  }

  if (!w) return null;
  const field = { padding: '6px 8px', fontSize: 13, fontFamily: T.fontMono, background: T.paper, color: T.ink, border: `1px solid ${T.hairline}`, borderRadius: T.r6 };
  const label = { fontSize: 12.5, color: T.ink60, minWidth: 90 };
  const hasBreak = w.breakStart !== null;

  return (
    <section data-tour="workday">
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: T.ink }}>{t('workday.title')}</h3>
        <div style={{ marginTop: 4, fontSize: 12.5, color: T.ink60, lineHeight: 1.5 }}>{t('workday.subtitle')}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={label}>{t('workday.hours')}</span>
          <input type="time" name="workday-start" value={w.start} onChange={e => save({ start: e.target.value })} style={field} />
          <span style={{ color: T.ink40 }}>–</span>
          <input type="time" name="workday-end" value={w.end} onChange={e => save({ end: e.target.value })} style={field} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={label}>{t('workday.break')}</span>
          {hasBreak ? (
            <>
              <input type="time" value={w.breakStart} onChange={e => save({ breakStart: e.target.value })} style={field} />
              <span style={{ color: T.ink40 }}>–</span>
              <input type="time" value={w.breakEnd} onChange={e => save({ breakEnd: e.target.value })} style={field} />
              <button type="button" onClick={() => save({ breakStart: null, breakEnd: null })} style={{ fontSize: 12, color: T.ink60, background: 'transparent', border: 'none', cursor: 'pointer' }}>{t('workday.noBreak')}</button>
            </>
          ) : (
            <button type="button" onClick={() => save({ breakStart: '12:00', breakEnd: '13:00' })} style={{ fontSize: 12, color: T.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>{t('workday.addBreak')}</button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={label}>{t('workday.days')}</span>
          {DAYS.map(d => {
            const on = w.days.includes(d);
            return (
              <button key={d} type="button" aria-pressed={on} onClick={() => save({ days: on ? w.days.filter(x => x !== d) : [...w.days, d].sort() })}
                style={{ width: 34, height: 28, fontSize: 12, borderRadius: T.r6, cursor: 'pointer', fontFamily: T.fontUI,
                  background: on ? T.ink : 'transparent', color: on ? T.paper : T.ink60, border: `1px solid ${T.hairline}` }}>
                {t(`workday.day${d}`)}
              </button>
            );
          })}
        </div>
        {error && <div role="alert" style={{ fontSize: 12, color: T.warn }}>{error}</div>}
      </div>
    </section>
  );
}
