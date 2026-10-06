import { useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useUpdates, updates } from '../updates.js';
import ApertureMark from './ApertureMark.jsx';

// The update, said in the middle of the screen: a new version as Clarity
// opens ("now" or "later"), its download, the seconds before Clarity closes
// to install it — and, at the next launch, that it is up to date.
export default function UpdateDialog() {
  const { t } = useLocale();
  const { T } = useTheme();
  const { state, updated, open } = useUpdates();

  const view = updated ? 'updated'
    : !open || !state ? null
    : state.phase === 'installing' ? 'installing'
    : state.phase === 'error' && state.wanted ? 'error'
    : state.wanted && state.phase === 'downloading' ? 'downloading'
    : 'offer';

  const dismiss = view === 'updated' ? updates.closeUpdated
    : view === 'installing' ? null
    : updates.later;

  useEffect(() => {
    if (!dismiss) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); dismiss(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dismiss]);

  if (!view) return null;

  const now = () => updates.now({ title: t('update.notice.title'), body: t('update.notice.body') });
  const news = t('update.news').split('\n').map(s => s.trim()).filter(Boolean);
  const primaryBtn = { padding: '10px 18px', fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit', color: T.paper, background: T.ink, border: 'none', borderRadius: T.r6, cursor: 'pointer' };
  const secondaryBtn = { padding: '10px 14px', fontSize: 13, color: T.ink60, background: 'transparent', border: 'none', borderRadius: T.r6, cursor: 'pointer', fontFamily: 'inherit' };
  const version = view === 'updated' ? updated.to : state.version;

  let title, body, content = null, actions = null;
  if (view === 'updated') {
    title = t('update.done.title');
    body = t('update.done.body', { version });
    if (news.length) {
      content = (
        <div style={{ textAlign: 'left', width: '100%', background: T.paperSubtle, border: `1px solid ${T.hairlineSoft}`, borderRadius: T.r10, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: T.ink60, marginBottom: 6 }}>{t('update.done.news')}</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {news.map(n => <li key={n} style={{ fontSize: 13, color: T.ink80, lineHeight: 1.45 }}>{n}</li>)}
          </ul>
        </div>
      );
    }
    actions = <button style={primaryBtn} onClick={updates.closeUpdated} autoFocus>{t('update.done.ok')}</button>;
  } else if (view === 'installing') {
    title = t('update.installing.title', { version });
    body = t('update.installing.body');
    content = <Progress T={T} indeterminate />;
  } else if (view === 'downloading') {
    title = t('update.title');
    body = t('update.downloading', { percent: state.percent || 0 });
    content = <Progress T={T} percent={state.percent || 0} />;
    actions = <button style={secondaryBtn} onClick={updates.later}>{t('update.later')}</button>;
  } else if (view === 'error') {
    title = t('update.title');
    body = t('update.error');
    actions = (
      <>
        <button style={secondaryBtn} onClick={updates.later}>{t('update.later')}</button>
        <button style={primaryBtn} onClick={now} autoFocus>{t('common.tryAgain')}</button>
      </>
    );
  } else {
    title = t('update.title');
    body = t(state.phase === 'ready' ? 'update.offerReady' : 'update.offer', { version });
    content = <div style={{ fontSize: 12, color: T.ink60, lineHeight: 1.45 }}>{t('update.laterHint')}</div>;
    actions = (
      <>
        <button style={secondaryBtn} onClick={updates.later}>{t('update.later')}</button>
        <button style={primaryBtn} onClick={now} autoFocus>{t('update.now')}</button>
      </>
    );
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(25,25,26,0.35)', zIndex: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: T.fontUI }}
      onClick={e => { if (e.target === e.currentTarget && dismiss) dismiss(); }}
    >
      <div role={view === 'installing' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="update-title" aria-describedby="update-body" style={{
        background: T.paper, borderRadius: T.r14, border: `1px solid ${T.hairline}`,
        boxShadow: '0 24px 60px rgba(25,25,26,0.15)',
        width: '100%', maxWidth: 420, padding: '28px 28px 22px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center',
        animation: 'fadeUp 0.15s ease-out',
      }}>
        <ApertureMark s={44} />
        <div>
          <h2 id="update-title" style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: T.ink }}>{title}</h2>
          <p id="update-body" aria-live="polite" style={{ margin: '6px 0 0', fontSize: 13.5, color: T.ink60, lineHeight: 1.5 }}>{body}</p>
        </div>
        {content}
        {actions && <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 4 }}>{actions}</div>}
      </div>
    </div>
  );
}

function Progress({ T, percent = 0, indeterminate = false }) {
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={indeterminate ? undefined : percent}
      style={{ width: '100%', height: 6, background: T.paperSubtle, border: `1px solid ${T.hairlineSoft}`, borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
      <div style={indeterminate
        ? { position: 'absolute', top: 0, bottom: 0, width: '35%', background: T.accent, borderRadius: 999, animation: 'clarityUpdateSlide 1.1s ease-in-out infinite' }
        : { height: '100%', width: `${percent}%`, background: T.accent, borderRadius: 999, transition: 'width 0.3s ease-out' }} />
    </div>
  );
}
