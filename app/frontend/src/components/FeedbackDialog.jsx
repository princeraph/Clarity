import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

const API = 'http://localhost:3001/api';
const MAX_MESSAGE = 5000;   // the backend refuses longer (src/feedback/feedback.js)

// Feedback from people testing Clarity. What leaves is decided by the backend —
// the rating, this message, the version and the system — and the dialog says so
// in one line, before anything is sent.
//
// mode 'prompt': Clarity asked on its own. "Later" and "Don't ask again" are
// answers, and so is closing the dialog (a snooze): otherwise a dismissed prompt
// would come back at the very next launch.
export default function FeedbackDialog({ mode = 'manual', onClose }) {
  const { t } = useLocale();
  const { T } = useTheme();
  const [rating, setRating]   = useState(null);
  const [message, setMessage] = useState('');
  const [phase, setPhase]     = useState('edit');   // edit | sending | sent | error
  const [errorKey, setErrorKey] = useState('feedback.error');
  const answered = useRef(false);
  const prompt = mode === 'prompt';

  async function answerPrompt(action) {
    answered.current = true;
    try {
      await fetch(`${API}/feedback/prompt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      });
    } catch { /* offline: it will simply ask again next time */ }
  }

  function close() {
    if (prompt && !answered.current && phase !== 'sent') answerPrompt('later');
    onClose();
  }

  async function send() {
    setPhase('sending');
    try {
      const resp = await fetch(`${API}/feedback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, message }),
      });
      if (!resp.ok) {
        setErrorKey(resp.status === 429 ? 'feedback.errorRate' : 'feedback.error');
        setPhase('error');
        return;
      }
      answered.current = true;   // the backend records it: never asked again
      setPhase('sent');
    } catch {
      setErrorKey('feedback.error');
      setPhase('error');
    }
  }

  useEffect(() => {
    if (phase !== 'sent') return undefined;
    const timer = setTimeout(onClose, 1800);
    return () => clearTimeout(timer);
  }, [phase, onClose]);

  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const canSend = (rating || message.trim()) && phase !== 'sending';

  const ratingBtn = (value, emoji, labelKey) => {
    const on = rating === value;
    return (
      <button
        type="button"
        onClick={() => setRating(on ? null : value)}
        aria-pressed={on}
        aria-label={t(labelKey)}
        title={t(labelKey)}
        style={{
          flex: 1, padding: '12px 0', fontSize: 22, lineHeight: 1,
          background: on ? T.accentSoft : T.paperSubtle,
          border: `1px solid ${on ? T.accent : T.hairline}`,
          borderRadius: T.r10, cursor: 'pointer',
          transition: 'background 0.1s, border-color 0.1s',
        }}
      >{emoji}</button>
    );
  };

  const secondaryBtn = { padding: '8px 12px', fontSize: 12.5, color: T.ink60, background: 'transparent', border: 'none', borderRadius: T.r6, cursor: 'pointer', fontFamily: 'inherit' };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(25,25,26,0.35)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: T.fontUI }}
      onClick={e => e.target === e.currentTarget && close()}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="feedback-title" style={{
        background: T.paper, borderRadius: T.r14,
        border: `1px solid ${T.hairline}`,
        boxShadow: '0 24px 60px rgba(25,25,26,0.15)',
        width: '100%', maxWidth: 420,
        animation: 'fadeUp 0.15s ease-out',
      }}>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 id="feedback-title" style={{ margin: 0, fontSize: 15.5, fontWeight: 500, color: T.ink }}>{t('feedback.title')}</h2>
            <button onClick={close} aria-label={t('common.close')} style={{ fontSize: 16, color: T.ink40, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>✕</button>
          </div>

          {phase === 'sent' ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 8, color: T.done }}>✓</div>
              <p style={{ fontSize: 15, fontWeight: 500, color: T.ink, margin: '0 0 4px' }}>{t('feedback.thanks')}</p>
              <p style={{ fontSize: 12.5, color: T.ink60, margin: 0 }}>{t('feedback.thanksBody')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {ratingBtn('up', '👍', 'feedback.up')}
                {ratingBtn('down', '👎', 'feedback.down')}
              </div>

              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={MAX_MESSAGE}
                rows={5}
                autoFocus
                placeholder={t('feedback.placeholder')}
                aria-label={t('feedback.messageLabel')}
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 96,
                  padding: '10px 12px', fontSize: 13.5, lineHeight: 1.5, color: T.ink,
                  background: T.paperSubtle, border: `1px solid ${T.hairline}`, borderRadius: T.r10,
                  fontFamily: T.fontUI, outline: 'none',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = T.accent; }}
                onBlur={e => { e.currentTarget.style.borderColor = T.hairline; }}
              />

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: T.ink60, lineHeight: 1.45 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>{t('feedback.whatIsSent')}</span>
              </div>

              {phase === 'error' && (
                <div role="alert" style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, border: `1px solid ${T.dangerBorder}`, borderRadius: T.r6, padding: '8px 10px' }}>
                  {t(errorKey)}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                {prompt && (
                  <>
                    <button style={secondaryBtn} onClick={() => { answerPrompt('later'); onClose(); }}>{t('feedback.later')}</button>
                    <button style={secondaryBtn} onClick={() => { answerPrompt('never'); onClose(); }}>{t('feedback.never')}</button>
                  </>
                )}
                <div style={{ flex: 1 }} />
                <button
                  onClick={send}
                  disabled={!canSend}
                  style={{
                    padding: '8px 16px', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                    color: T.paper, background: T.ink, border: 'none', borderRadius: T.r6,
                    cursor: canSend ? 'pointer' : 'not-allowed', opacity: canSend ? 1 : 0.4,
                  }}
                >{phase === 'sending' ? t('feedback.sending') : phase === 'error' ? t('common.tryAgain') : t('feedback.send')}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
