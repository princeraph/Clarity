import { useEffect, useState } from 'react';
import { useLocale } from '../contexts/LocaleContext.jsx';

// Settings › Day to day › Working hours (2.0.0; 2.2.0: several breaks, and
// hours that may differ by day). What the realistic day plans in
// (lib/journee.js). Saved field by field; a day that cannot be (a break
// outside the hours, two breaks that overlap) is said, and not saved.
const API = 'http://localhost:3001/api';
const DAYS = [1, 2, 3, 4, 5, 6, 0];   // Monday first
const MAX_BREAKS = 6;
const f = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// The 2.0 shape, read as 2.2.
const upgrade = (w) => {
  if (!w || Array.isArray(w.breaks)) return w;
  const { breakStart, breakEnd, ...rest } = w;
  return { ...rest, breaks: breakStart && breakEnd ? [{ start: breakStart, end: breakEnd, label: '' }] : [] };
};

// One set of hours: start, end, breaks. Outside the settings component, so
// that typing an hour does not rebuild (and unfocus) the field.
function Hours({ h, put, name, T, t }) {
  const field = { padding: '5px 7px', fontSize: 13, fontFamily: T.fontMono, background: T.paper, color: T.ink, border: `1px solid ${T.hairline}`, borderRadius: T.r6 };
  const label = { fontSize: 12.5, color: T.ink60, minWidth: 90 };
  const link = { fontSize: 12, color: T.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: T.fontUI };
  const breaks = h.breaks || [];
  const setBreak = (i, change) => put({ ...h, breaks: breaks.map((x, j) => (j === i ? { ...x, ...change } : x)) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={label}>{t('workday.hours')}</span>
        <input type="time" name={`${name}-start`} value={h.start} onChange={e => put({ ...h, start: e.target.value })} style={field} />
        <span style={{ color: T.ink40 }}>–</span>
        <input type="time" name={`${name}-end`} value={h.end} onChange={e => put({ ...h, end: e.target.value })} style={field} />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ ...label, paddingTop: 6 }}>{t('workday.breaks')}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {breaks.map((b, i) => (
            <div key={i} data-break={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <input type="time" name={`${name}-break-${i}-start`} value={b.start} onChange={e => setBreak(i, { start: e.target.value })} style={field} />
              <span style={{ color: T.ink40 }}>–</span>
              <input type="time" name={`${name}-break-${i}-end`} value={b.end} onChange={e => setBreak(i, { end: e.target.value })} style={field} />
              <input type="text" key={`${i}-${b.label || ''}`} name={`${name}-break-${i}-label`} defaultValue={b.label || ''} maxLength={40} placeholder={t('workday.breakLabel')}
                onBlur={e => e.target.value !== (b.label || '') && setBreak(i, { label: e.target.value })}
                style={{ ...field, fontFamily: T.fontUI, width: 130 }} />
              <button type="button" data-act="remove-break" aria-label={t('workday.removeBreak')} title={t('workday.removeBreak')}
                onClick={() => put({ ...h, breaks: breaks.filter((_, j) => j !== i) })}
                style={{ ...link, color: T.ink40, fontSize: 16, lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>
          ))}
          {breaks.length < MAX_BREAKS && (
            <button type="button" data-act="add-break" onClick={() => {
              // An hour after the last break ends (or at noon), 15 minutes.
              const last = breaks.at(-1);
              const [hh, mm] = (last ? last.end : '11:00').split(':').map(Number);
              const s = Math.min(hh * 60 + mm + 60, 22 * 60);
              put({ ...h, breaks: [...breaks, { start: f(s), end: f(s + 15), label: '' }] });
            }} style={{ ...link, alignSelf: 'flex-start', paddingTop: breaks.length ? 0 : 6 }}>{t('workday.addBreak')}</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkdaySettings({ T }) {
  const { t } = useLocale();
  const [w, setW] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/settings`).then(r => r.json()).then(s => setW(upgrade(s.workday))).catch(() => {});
  }, []);

  async function save(next) {
    setW(next); setError('');
    try {
      const r = await fetch(`${API}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workday: next }) });
      if (!r.ok) { setError(t('workday.invalid')); return; }
      window.dispatchEvent(new Event('clarity-workday'));
    } catch { setError(t('workday.saveFailed')); }
  }
  if (!w) return null;

  const perDay = !!w.byDay;
  const label = { fontSize: 12.5, color: T.ink60, minWidth: 90 };
  const seg = (on) => ({ padding: '5px 12px', fontSize: 12.5, fontFamily: T.fontUI, cursor: 'pointer', border: 'none', borderRadius: 4,
    background: on ? T.paper : 'transparent', color: on ? T.ink : T.ink60, boxShadow: on ? `0 0 0 1px ${T.hairline}` : 'none' });
  const common = { start: w.start, end: w.end, breaks: w.breaks || [] };
  const copy = () => ({ ...common, breaks: common.breaks.map(b => ({ ...b })) });

  const toggleDay = (d) => {
    const on = w.days.includes(d);
    const days = on ? w.days.filter(x => x !== d) : [...w.days, d].sort();
    if (!perDay) return save({ ...w, days });
    const byDay = { ...w.byDay };
    if (on) delete byDay[d]; else byDay[d] = copy();
    save({ ...w, days, byDay });
  };
  const setMode = (each) => {
    if (each === perDay) return;
    if (each) save({ ...w, byDay: Object.fromEntries(w.days.map(d => [d, copy()])) });
    else { const { byDay, ...rest } = w; save(rest); }
  };

  return (
    <section data-tour="workday" data-mode={perDay ? 'per-day' : 'same'}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: T.ink }}>{t('workday.title')}</h3>
        <div style={{ marginTop: 4, fontSize: 12.5, color: T.ink60, lineHeight: 1.5 }}>{t('workday.subtitle')}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={label}>{t('workday.days')}</span>
          {DAYS.map(d => {
            const on = w.days.includes(d);
            return (
              <button key={d} type="button" data-day={d} aria-pressed={on} onClick={() => toggleDay(d)}
                style={{ width: 34, height: 28, fontSize: 12, borderRadius: T.r6, cursor: 'pointer', fontFamily: T.fontUI,
                  background: on ? T.ink : 'transparent', color: on ? T.paper : T.ink60, border: `1px solid ${T.hairline}` }}>
                {t(`workday.day${d}`)}
              </button>
            );
          })}
        </div>
        <div role="group" style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: T.r6, background: T.paperSubtle, border: `1px solid ${T.hairline}`, width: 'fit-content' }}>
          <button type="button" data-act="same-hours" aria-pressed={!perDay} onClick={() => setMode(false)} style={seg(!perDay)}>{t('workday.sameEveryDay')}</button>
          <button type="button" data-act="per-day" aria-pressed={perDay} onClick={() => setMode(true)} style={seg(perDay)}>{t('workday.perDay')}</button>
        </div>
        {!perDay ? (
          <Hours h={common} name="workday" T={T} t={t} put={(h) => save({ ...w, ...h })} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {DAYS.filter(d => w.days.includes(d)).map(d => (
              <div key={d} data-own-day={d} style={{ paddingLeft: 12, borderLeft: `2px solid ${T.hairline}` }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, marginBottom: 6 }}>{t(`workday.dayLong${d}`)}</div>
                <Hours h={w.byDay[d] || common} name={`workday-${d}`} T={T} t={t} put={(h) => save({ ...w, byDay: { ...w.byDay, [d]: h } })} />
              </div>
            ))}
          </div>
        )}
        {error && <div role="alert" style={{ fontSize: 12, color: T.warn }}>{error}</div>}
      </div>
    </section>
  );
}
