import { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { setFeature } from '../features.js';

// Asked once: may Clarity send crash reports? Off until the answer is yes, and
// the answer can be changed in Settings › Privacy. Says exactly what leaves —
// the same list backend/src/crash/crash.js enforces.
export default function CrashConsent({ onClose }) {
  const { t } = useLocale();
  const { T } = useTheme();
  const yesRef = useRef(null);
  useEffect(() => { yesRef.current?.focus(); }, []);

  async function answer(yes) {
    await setFeature('crashReports', yes);
    await setFeature('crashAsked', true);
    onClose();
  }

  // Closing without answering is not a "no" said forever: it asks again next launch.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const btn = { padding: '9px 16px', fontSize: 13, fontFamily: 'inherit', borderRadius: T.r6, cursor: 'pointer' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(25,25,26,0.35)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: T.fontUI }}>
      <div role="dialog" aria-modal="true" aria-labelledby="crash-title" aria-describedby="crash-body" style={{
        background: T.paper, borderRadius: T.r14, border: `1px solid ${T.hairline}`,
        boxShadow: '0 24px 60px rgba(25,25,26,0.15)', width: '100%', maxWidth: 440, padding: '24px 26px 20px',
        animation: 'fadeUp 0.15s ease-out',
      }}>
        <h2 id="crash-title" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: T.ink }}>{t('crash.ask.title')}</h2>
        <p id="crash-body" style={{ margin: '8px 0 12px', fontSize: 13.5, color: T.ink80, lineHeight: 1.55 }}>{t('crash.ask.body')}</p>
        <ul style={{ margin: '0 0 12px', paddingLeft: 18, listStyle: 'disc', fontSize: 13, color: T.ink60, lineHeight: 1.55 }}>
          <li>{t('crash.ask.sent')}</li>
          <li>{t('crash.ask.never')}</li>
        </ul>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: T.ink40 }}>{t('crash.ask.change')}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button style={{ ...btn, background: 'transparent', border: 'none', color: T.ink60 }} onClick={() => answer(false)}>{t('crash.ask.no')}</button>
          <button ref={yesRef} style={{ ...btn, fontWeight: 500, background: T.ink, color: T.paper, border: 'none' }} onClick={() => answer(true)}>{t('crash.ask.yes')}</button>
        </div>
      </div>
    </div>
  );
}
