import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

const API = 'http://localhost:3001/api';
const MAX_MESSAGE = 5000;   // per field; the backend refuses longer (src/feedback/feedback.js)
const STARS = [1, 2, 3, 4, 5];
const STAR_PATH = 'M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.45 6.2 20.5l1.1-6.47L2.6 9.45l6.5-.95z';

// The four comment fields, in the order the backend combines them. Literal
// keys, so the locale check can see every one of them.
const CATEGORIES = [
  { id: 'usability',   label: 'feedback.usability',   hint: 'feedback.usabilityHint' },
  { id: 'bugs',        label: 'feedback.bugs',        hint: 'feedback.bugsHint' },
  { id: 'suggestions', label: 'feedback.suggestions', hint: 'feedback.suggestionsHint' },
  { id: 'other',       label: 'feedback.other',       hint: null },
];
const EMPTY_COMMENTS = { usability: '', bugs: '', suggestions: '', other: '' };

// Feedback from people testing Clarity. What leaves is decided by the backend —
// the stars, these four comments, the version and the system — and the dialog
// says so in one line, before anything is sent. Everything is optional: a
// rating alone, or a single field, is enough.
//
// mode 'prompt': Clarity asked on its own. "Later" and "Don't ask again" are
// answers, and so is closing the dialog (a snooze): otherwise a dismissed prompt
// would come back at the very next launch.
export default function FeedbackDialog({ mode = 'manual', onClose }) {
  const { t } = useLocale();
  const { T } = useTheme();
  const [rating, setRating]   = useState(null);     // 1..5, or null
  const [hover, setHover]     = useState(null);     // preview while the pointer is over a star
  const [comments, setComments] = useState(EMPTY_COMMENTS);
  const starRefs = useRef([]);
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
        body: JSON.stringify({ rating, ...comments }),
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

  const hasText = CATEGORIES.some(c => comments[c.id].trim());
  const canSend = (rating || hasText) && phase !== 'sending';

  const starLabel = (n) => (n === 1 ? t('feedback.starOne') : t('feedback.starMany', { n }));

  // A radio group: one tab stop (the chosen star, else the first), arrows move
  // AND choose, Home/End jump, Delete clears. Clicking the chosen star again
  // clears it too — the rating is optional, so it must be possible to undo.
  function pickStar(n, focus) {
    setRating(n);
    if (focus) starRefs.current[(n || 1) - 1]?.focus();
  }
  function onStarKey(e) {
    const current = rating || 0;
    let next;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(5, current + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(1, current - 1);
    else if (e.key === 'Home') next = 1;
    else if (e.key === 'End') next = 5;
    else if (e.key === 'Delete' || e.key === 'Backspace') next = null;
    else return;
    e.preventDefault();
    pickStar(next, true);
  }
  // Focus lands on the stars first: the quickest answer there is.
  useEffect(() => { starRefs.current[0]?.focus(); }, []);

  const shown = hover ?? rating ?? 0;
  const tabStop = rating || 1;

  // Each field starts at three rows and grows with what is typed, up to a cap.
  const grow = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 220)}px`;
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
        width: '100%', maxWidth: 460, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
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
              <p style={{ margin: 0, fontSize: 12.5, color: T.ink60, lineHeight: 1.45 }}>{t('feedback.optional')}</p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  role="radiogroup"
                  aria-label={t('feedback.ratingLabel')}
                  onMouseLeave={() => setHover(null)}
                  style={{ display: 'flex', gap: 2 }}
                >
                  {STARS.map(n => {
                    const checked = rating === n;
                    const filled = n <= shown;
                    return (
                      <button
                        key={n}
                        ref={el => { starRefs.current[n - 1] = el; }}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        aria-label={starLabel(n)}
                        title={checked ? t('feedback.starClear') : starLabel(n)}
                        tabIndex={n === tabStop ? 0 : -1}
                        onClick={() => pickStar(checked ? null : n, false)}
                        onKeyDown={onStarKey}
                        onMouseEnter={() => setHover(n)}
                        style={{
                          padding: 4, lineHeight: 0, background: 'transparent', border: 'none',
                          borderRadius: T.r6, cursor: 'pointer',
                        }}
                      >
                        <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block', transition: 'transform 0.08s', transform: hover === n ? 'scale(1.1)' : 'none' }}>
                          <path d={STAR_PATH} fill={filled ? T.warn : 'none'} stroke={filled ? T.warn : T.ink40} strokeWidth="1.5" strokeLinejoin="round" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
                <span aria-hidden="true" style={{ fontSize: 12.5, color: shown ? T.ink80 : T.ink40 }}>
                  {shown ? starLabel(shown) : t('feedback.ratingLabel')}
                </span>
              </div>

              {CATEGORIES.map(c => (
                <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label htmlFor={`feedback-${c.id}`} style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>{t(c.label)}</label>
                  {c.hint && <span id={`feedback-${c.id}-hint`} style={{ fontSize: 12, color: T.ink60, lineHeight: 1.4 }}>{t(c.hint)}</span>}
                  <textarea
                    id={`feedback-${c.id}`}
                    aria-describedby={c.hint ? `feedback-${c.id}-hint` : undefined}
                    value={comments[c.id]}
                    onChange={e => { setComments(prev => ({ ...prev, [c.id]: e.target.value })); grow(e.currentTarget); }}
                    maxLength={MAX_MESSAGE}
                    rows={3}
                    style={{
                      width: '100%', boxSizing: 'border-box', resize: 'vertical', marginTop: 3,
                      padding: '8px 10px', fontSize: 13.5, lineHeight: 1.45, color: T.ink,
                      background: T.paperSubtle, border: `1px solid ${T.hairline}`, borderRadius: T.r10,
                      fontFamily: T.fontUI, outline: 'none',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = T.accent; }}
                    onBlur={e => { e.currentTarget.style.borderColor = T.hairline; }}
                  />
                </div>
              ))}

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
