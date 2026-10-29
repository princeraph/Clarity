import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { moveTo } from '../../lib/rituels.js';
import { RITUAL_KEYS, readMark } from '../Rituels.jsx';

// « Someday » (2.7.0): what might be done one day, kept out of Today, the
// Inbox, the day's plan and the assistant's analysis. The library of « maybe »
// that made other lists grow forever lives here, apart, and is looked at on
// purpose — once a month, in the morning plan — not every day.
const API = 'http://localhost:3001/api';

export default function SomedayView({ tasks, onOpenDetail, onChanged }) {
  const { T } = useTheme();
  const { t, fmtDate } = useLocale();
  const [busy, setBusy] = useState(null);
  const list = tasks.filter(x => x.someday && x.status !== 'done' && !x.archived);
  const last = readMark(RITUAL_KEYS.review);

  async function bring(task, choice) {
    setBusy(task.id);
    try {
      await fetch(`${API}/tasks/${task.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(moveTo(choice, new Date())) });
      await onChanged?.(task, choice);
    } finally { setBusy(null); }
  }
  const small = { padding: '5px 10px', fontSize: 12, fontFamily: T.fontUI, borderRadius: T.r6, cursor: 'pointer', background: 'transparent', color: T.ink60, border: `1px solid ${T.hairline}` };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '36px 56px', fontFamily: T.fontUI, boxSizing: 'border-box' }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 8 }}>{t('someday.label')}</div>
      <h1 style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 500, letterSpacing: '-0.03em', color: T.ink }}>
        {t(list.length === 1 ? 'someday.countOne' : 'someday.count', { n: list.length })}
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 13.5, color: T.ink60, lineHeight: 1.6, maxWidth: 560 }}>
        {t('someday.body')}{' '}
        {last ? t('someday.lastReview', { date: fmtDate(new Date(last), { day: 'numeric', month: 'long' }) }) : t('someday.neverReviewed')}
      </p>
      {list.length === 0 ? (
        <p style={{ fontSize: 13.5, color: T.ink40 }}>{t('someday.empty')}</p>
      ) : list.map(task => (
        <div key={task.id} data-someday-task={task.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 4px', borderBottom: `1px solid ${T.hairlineSoft}`, opacity: busy === task.id ? 0.5 : 1 }}>
          <button type="button" onClick={() => onOpenDetail?.(task)} style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: T.fontUI }}>
            <div style={{ fontSize: 14, color: T.ink }}>{task.title}</div>
            {task.tags?.[0] && <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40, marginTop: 2 }}>{task.tags[0]}</div>}
          </button>
          <button type="button" data-choice="today" disabled={!!busy} onClick={() => bring(task, 'today')} style={small}>{t('ritual.today')}</button>
          <button type="button" data-choice="later" disabled={!!busy} onClick={() => bring(task, 'later')} style={small}>{t('someday.bringBack')}</button>
        </div>
      ))}
    </div>
  );
}
