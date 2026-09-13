import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

const API = 'http://localhost:3001/api';

/**
 * An unasked-for interruption, and the two things that make one bearable:
 * it says WHY it interrupted, and the way to stop it is in the same card as
 * the suggestion itself — not buried three panes deep in Settings, discovered
 * only by someone annoyed enough to go looking.
 */
export default function SuggestionCard({ suggestion, onClose, onOpenTask }) {
  const { T } = useTheme();
  const { t, fmtDate } = useLocale();
  const [quieting, setQuieting] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!suggestion) return null;
  const b = suggestion.because || {};

  // The trigger, in words. Every one of these is arithmetic the app can show,
  // never "Clarity thinks" — an interruption has to justify itself.
  const why =
    b.code === 'overdue-days'      ? t('suggest.why.overdue', { days: b.days })
  : b.code === 'blocked-since'     ? t('suggest.why.blocked', { what: b.text, since: fmtDate(b.since) })
  : b.code === 'check-in-due'      ? t('suggest.why.checkIn')
  : b.code === 'postponed-n-times' ? t('suggest.why.postponed', { times: b.times, days: b.days })
  : b.code === 'idle-days'         ? t('suggest.why.idle', { days: b.days })
  : '';

  async function respond(outcome) {
    setBusy(true);
    try { await fetch(`${API}/suggestions/${suggestion.id}/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome }) }); }
    catch { /* the card closes either way — never trap someone behind a failed request */ }
    finally { setBusy(false); onClose?.(); }
  }

  async function goQuiet(spec) {
    setBusy(true);
    try { await fetch(`${API}/suggestions/quiet`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(spec) }); }
    catch {}
    finally { setBusy(false); await respond('dismissed'); }
  }

  const btn = (tone) => ({
    padding: '6px 12px', borderRadius: T.r6, fontSize: 12, fontFamily: T.fontUI,
    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
    ...(tone === 'primary'
      ? { background: T.accentSoft, color: T.accentInk, border: `1px solid ${T.accent}` }
      : { background: 'transparent', color: T.ink60, border: `1px solid ${T.hairline}` }),
  });

  return (
    <div style={{
      position: 'fixed', right: 20, bottom: 20, width: 330, zIndex: 200,
      background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: T.r10,
      boxShadow: '0 8px 28px rgba(0,0,0,0.13)', padding: '15px 17px',
      display: 'flex', flexDirection: 'column', gap: 10, fontFamily: T.fontUI,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em',
                       textTransform: 'uppercase', color: T.ink40, flex: 1 }}>
          {t('suggest.label')}
        </span>
        <button onClick={() => respond('dismissed')} style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          color: T.ink40, fontSize: 15, lineHeight: 1,
        }}>×</button>
      </div>

      <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.45 }}>{suggestion.title}</div>
      {why && <div style={{ fontSize: 12.5, color: T.ink60, lineHeight: 1.5 }}>{why}</div>}

      {quieting ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, color: T.ink60 }}>{t('suggest.quietFor')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button disabled={busy} style={btn()} onClick={() => goQuiet({ kind: 'duration', minutes: 120 })}>{t('suggest.quiet2h')}</button>
            <button disabled={busy} style={btn()} onClick={() => goQuiet({ kind: 'duration', minutes: 60 * 24 })}>{t('suggest.quietToday')}</button>
            <button disabled={busy} style={btn()} onClick={() => goQuiet({ kind: 'untilTaskDone', taskId: suggestion.taskId })}>{t('suggest.quietUntilDone')}</button>
            <button disabled={busy} style={btn()} onClick={() => goQuiet({ kind: 'indefinite' })}>{t('suggest.quietAlways')}</button>
          </div>
          <button onClick={() => setQuieting(false)} style={{ ...btn(), alignSelf: 'flex-start' }}>{t('common.cancel')}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button disabled={busy} style={btn('primary')}
                  onClick={() => { onOpenTask?.(suggestion.taskId); respond('acted'); }}>{t('suggest.open')}</button>
          <button disabled={busy} style={btn()} onClick={() => respond('snoozed')}>{t('suggest.notNow')}</button>
          <button disabled={busy} style={btn()} onClick={() => setQuieting(true)}>{t('suggest.stopAsking')}</button>
        </div>
      )}
    </div>
  );
}
