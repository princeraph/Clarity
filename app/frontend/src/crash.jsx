import React from 'react';
import { useLocale } from './contexts/LocaleContext.jsx';

// The window's side of crash reports. Errors go to the backend, which decides
// whether anything leaves (only with the person's yes) and what (never tasks):
// backend/src/crash/crash.js.

const API = 'http://localhost:3001/api';

export function reportWindowError(err) {
  try {
    fetch(`${API}/crash`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ where: 'window', message: String(err?.message || err).slice(0, 5000), stack: String(err?.stack || '').slice(0, 20000) }),
    }).catch(() => {});
  } catch { /* reporting must never be the next error */ }
}

export function watchWindowErrors() {
  window.addEventListener('error', (e) => reportWindowError(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => reportWindowError(e.reason));
}

function Broken() {
  const { t } = useLocale();
  return (
    <div role="alert" style={{
      height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
      fontFamily: '"Geist", system-ui, sans-serif', background: '#FAFAF7', color: '#19191A', padding: 32, textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 500 }}>{t('crash.broken.title')}</div>
      <div style={{ fontSize: 14, color: '#5F5F62', maxWidth: 420, lineHeight: 1.5 }}>{t('crash.broken.body')}</div>
      <button onClick={() => window.location.reload()} style={{
        marginTop: 6, padding: '10px 18px', fontSize: 14, fontWeight: 500, color: '#FAFAF7', background: '#19191A',
        border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
      }}>{t('crash.broken.reload')}</button>
    </div>
  );
}

// A render error used to leave a blank window — the worst thing a tester can
// see, and the one they cannot describe. Now a way out, and a report.
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { broken: false }; }
  static getDerivedStateFromError() { return { broken: true }; }
  componentDidCatch(err, info) {
    reportWindowError({ message: err?.message || String(err), stack: `${err?.stack || ''}\n${info?.componentStack || ''}` });
  }
  render() { return this.state.broken ? <Broken /> : this.props.children; }
}
