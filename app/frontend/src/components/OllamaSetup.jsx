import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { formatSize } from './AssistantSetup.jsx';

// "Install Ollama for me" — Windows only, shown when Ollama does not answer.
// The backend downloads the installer, checks Ollama's signature, installs per
// user, starts it, pulls the model, then switches Clarity to it.

const API = 'http://localhost:3001/api';
const ACTIVE = ['downloading', 'verifying', 'installing', 'starting', 'pulling'];

export default function OllamaSetup({ onReady }) {
  const { T } = useTheme();
  const { t, locale } = useLocale();
  const [info, setInfo] = useState(null);
  const [startError, setStartError] = useState(null);
  const wasActive = useRef(false);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  const refresh = useCallback(async () => {
    try { const r = await fetch(`${API}/ollama/install`); if (r.ok) setInfo(await r.json()); } catch {}
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const state = info?.install?.state;
  useEffect(() => {
    if (!ACTIVE.includes(state)) {
      if (wasActive.current && state === 'done') readyRef.current?.();
      wasActive.current = false;
      return;
    }
    wasActive.current = true;
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [state, refresh]);

  // Nothing to install: not Windows, or an Ollama already answers (and was not
  // just installed here — then the "ready" line stays until the page changes).
  if (!info?.supported || (info.running && !info.install)) return null;

  async function start() {
    setStartError(null);
    try {
      const r = await fetch(`${API}/ollama/install`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: info.recommended }),
      });
      if (!r.ok) setStartError(true);
    } catch { setStartError(true); }
    refresh();
  }
  async function cancel() {
    try { await fetch(`${API}/ollama/install/cancel`, { method: 'POST' }); } catch {}
    refresh();
  }

  const inst = info.install;
  const busy = inst && ACTIVE.includes(inst.state);
  const sized = inst?.total ? { done: formatSize(inst.received, locale), total: formatSize(inst.total, locale) } : null;
  const line = !inst ? null
    : inst.state === 'downloading' ? (sized ? t('ollama.install.downloading', sized) : t('ollama.install.downloadingNoSize'))
    : inst.state === 'pulling' ? (sized ? t('ollama.install.pulling', { ...sized, model: inst.model }) : t('ollama.install.pullingNoSize', { model: inst.model }))
    : ['verifying', 'installing', 'starting', 'done'].includes(inst.state) ? t(`ollama.install.${inst.state}`)
    : null;
  const error = startError ? t('ollama.install.error')
    : inst?.state === 'error' ? (/signature/.test(inst.error || '') ? t('ollama.install.badSignature') : t('ollama.install.error'))
    : null;

  return (
    <div style={{
      padding: '12px 14px', borderRadius: T.r6, background: T.paperSubtle,
      border: `1px solid ${T.hairline}`, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: T.ink }}>{t('ollama.install.title')}</div>
      <div style={{ fontSize: 12, color: T.ink60, lineHeight: 1.5 }}>{t('ollama.install.hint', { model: info.recommended })}</div>
      {busy || inst?.state === 'done' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sized && busy && (
            <div style={{ height: 6, borderRadius: 3, background: T.paperMuted, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(100 * inst.received / inst.total)}%`, height: '100%', background: T.accent, transition: 'width 0.4s' }} />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 12, color: inst.state === 'done' ? T.success : T.ink60 }}>{line}</span>
            {['downloading', 'pulling', 'starting'].includes(inst.state) && (
              <button type="button" onClick={cancel} style={{
                padding: '6px 12px', borderRadius: T.r6, fontSize: 12.5, fontFamily: T.fontUI, cursor: 'pointer',
                background: T.paperSubtle, color: T.ink80, border: `1px solid ${T.hairline}`,
              }}>{t('ollama.install.cancel')}</button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <button type="button" onClick={start} style={{
            padding: '7px 14px', borderRadius: T.r6, fontSize: 12.5, fontWeight: 500, fontFamily: T.fontUI,
            cursor: 'pointer', background: T.ink, color: T.paper, border: 'none',
          }}>{t('ollama.install.button', { model: info.recommended })}</button>
        </div>
      )}
      {error && <div style={{ fontSize: 12.5, color: T.danger }}>⚠ {error}</div>}
    </div>
  );
}
