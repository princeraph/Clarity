import { useEffect, useState } from 'react';
import { useLocale } from '../contexts/LocaleContext.jsx';

const API = 'http://localhost:3001/api';

// Settings › Account: sign in with a code sent by e-mail, then tasks follow the
// person across devices. Opt-in — signed out, nothing leaves this computer.
// Signing out keeps every task here and deletes nothing anywhere.
const ERROR_KEY = {
  offline: 'sync.err.offline', 'rate-limited': 'sync.err.rateLimited', 'invalid-email': 'sync.err.email',
  'invalid-code': 'sync.err.code', rejected: 'sync.err.code', unauthorized: 'sync.err.code', server: 'sync.err.server',
};

export default function SyncAccount({ T }) {
  const { t, fmtDateTime } = useLocale();
  const [status, setStatus] = useState(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email');     // email | code
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    try { setStatus(await (await fetch(`${API}/sync/status`)).json()); } catch { /* backend restarting */ }
  }
  useEffect(() => { refresh(); const id = setInterval(refresh, 10000); return () => clearInterval(id); }, []);

  async function post(path, body) {
    setBusy(true); setError('');
    try {
      const r = await fetch(`${API}/sync/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(t(ERROR_KEY[j.code] || 'sync.err.generic')); return null; }
      return j;
    } catch { setError(t('sync.err.offline')); return null; }
    finally { setBusy(false); refresh(); }
  }

  const btn = (primary) => ({
    padding: '9px 16px', borderRadius: T.r6, cursor: busy ? 'default' : 'pointer', fontSize: 13, fontWeight: 500, fontFamily: T.fontUI,
    background: primary ? T.ink : 'transparent', color: primary ? T.paper : T.ink80,
    border: primary ? 'none' : `1px solid ${T.hairline}`, opacity: busy ? 0.6 : 1,
  });
  const input = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: T.r6, fontSize: 14, color: T.ink, fontFamily: T.fontUI, outline: 'none' };
  const box = { padding: '18px 20px', background: T.paperSubtle, borderRadius: T.r10, border: `1px solid ${T.hairlineSoft}`, display: 'flex', flexDirection: 'column', gap: 12 };
  const note = { margin: 0, fontSize: 12.5, color: T.ink60, lineHeight: 1.6 };

  if (!status) return <div style={{ color: T.ink60, fontSize: 13 }}>{t('settings.loading')}</div>;

  if (status.signedIn) {
    const when = status.at ? fmtDateTime(new Date(status.at)) : null;
    return (
      <div style={box}>
        <div style={{ fontSize: 14, color: T.ink }}>{t('sync.signedInAs')} <strong style={{ fontWeight: 500 }}>{status.email}</strong></div>
        <div style={{ fontSize: 12.5, color: status.ok === false ? T.danger : T.ink60 }}>
          {status.running ? t('sync.running')
            : status.ok === false ? t(ERROR_KEY[status.error] || 'sync.err.generic')
            : when ? t('sync.lastSync', { when }) : t('sync.notYet')}
        </div>
        {error && <div style={{ fontSize: 12.5, color: T.danger }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button disabled={busy} style={btn(true)} onClick={() => post('now')}>{t('sync.syncNow')}</button>
          <button disabled={busy} style={btn(false)} onClick={() => { if (window.confirm(t('sync.signOutConfirm'))) post('sign-out'); }}>{t('sync.signOut')}</button>
        </div>
        <p style={note}>{t('sync.whatTravels')}</p>
      </div>
    );
  }

  return (
    <div style={box}>
      <p style={{ ...note, color: T.ink80, fontSize: 13.5 }}>{t('sync.pitch')}</p>
      {step === 'email' ? (
        <form onSubmit={async e => { e.preventDefault(); if (await post('send-code', { email })) setStep('code'); }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="email" required autoComplete="email" placeholder={t('sync.emailPlaceholder')} value={email} onChange={e => setEmail(e.target.value)} style={input} />
          <div><button type="submit" disabled={busy || !email.trim()} style={btn(true)}>{busy ? t('sync.sending') : t('sync.sendCode')}</button></div>
        </form>
      ) : (
        <form onSubmit={async e => { e.preventDefault(); const r = await post('verify', { email, code }); if (r?.signedIn) { setCode(''); setStep('email'); } }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: T.ink80 }}>{t('sync.codeSent', { email })}</div>
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="123456" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            style={{ ...input, fontFamily: T.fontMono, fontSize: 20, letterSpacing: 6, maxWidth: 220 }} autoFocus />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" disabled={busy || code.length < 6} style={btn(true)}>{busy ? t('sync.checking') : t('sync.signIn')}</button>
            <button type="button" disabled={busy} style={btn(false)} onClick={() => post('send-code', { email })}>{t('sync.resend')}</button>
            <button type="button" disabled={busy} style={btn(false)} onClick={() => { setStep('email'); setCode(''); setError(''); }}>{t('sync.otherEmail')}</button>
          </div>
        </form>
      )}
      {error && <div style={{ fontSize: 12.5, color: T.danger }}>{error}</div>}
      <p style={note}>{t('sync.privacy')}</p>
    </div>
  );
}
