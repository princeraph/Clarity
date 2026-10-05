import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

// The built-in assistant, for someone who has no Ollama and no API key: pick a
// model, download it once, and Clarity switches to it by itself when the file
// is complete and verified (the backend does the switch, so it happens even if
// this screen was closed). Shared by Settings and the first-launch screens.

const API = 'http://localhost:3001/api';
const ACTIVE = ['resuming', 'downloading', 'verifying'];

export function formatSize(bytes, locale) {
  const gb = bytes / 1024 ** 3;
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: gb < 10 ? 1 : 0 });
  return gb >= 1 ? `${n.format(gb)} ${locale.startsWith('fr') ? 'Go' : 'GB'}`
                 : `${n.format(bytes / 1024 ** 2)} ${locale.startsWith('fr') ? 'Mo' : 'MB'}`;
}

/** Status from the backend, polled every second while a download runs. */
export function useAssistant({ onReady } = {}) {
  const [info, setInfo] = useState(null);
  const [startError, setStartError] = useState(null);
  const wasActive = useRef(false);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${API}/assistant`);
      if (r.ok) setInfo(await r.json());
    } catch {}
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const state = info?.download?.state;
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

  const start = useCallback(async (id) => {
    setStartError(null);
    try {
      const r = await fetch(`${API}/assistant/download`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      if (!r.ok) setStartError(await r.json().catch(() => ({ code: r.status })));
    } catch { setStartError({ code: 0 }); }
    refresh();
  }, [refresh]);

  const cancel = useCallback(async () => {
    try { await fetch(`${API}/assistant/cancel`, { method: 'POST' }); } catch {}
    refresh();
  }, [refresh]);

  const remove = useCallback(async (id) => {
    try { await fetch(`${API}/assistant/models/${id}`, { method: 'DELETE' }); } catch {}
    refresh();
  }, [refresh]);

  return { info, start, cancel, remove, refresh, startError };
}

function errorText(t, locale, startError, download) {
  if (startError) {
    if (startError.code === 507) {
      return t('assistant.error.disk', { needed: formatSize(startError.needed, locale), free: formatSize(startError.free, locale) });
    }
    return t('assistant.error.network');
  }
  if (download?.state === 'error') {
    return /damaged/.test(download.error || '') ? t('assistant.error.damaged') : t('assistant.error.network');
  }
  return null;
}

function Bar({ value, T }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: T.paperMuted, overflow: 'hidden' }}>
      <div style={{ width: `${Math.round(value * 100)}%`, height: '100%', background: T.accent, transition: 'width 0.4s' }} />
    </div>
  );
}

/**
 * The models, each with what can be done with it now.
 * `only` limits the list to one model (the first-launch screen shows the
 * recommended one). `onUse(file)` is called when an installed model is chosen.
 */
export function AssistantModels({ assistant, only = null, inUse = null, onUse = null }) {
  const { T } = useTheme();
  const { t, locale } = useLocale();
  const { info, start, cancel, remove, startError } = assistant;
  if (!info) return null;

  const dl = info.download;
  const busy = dl && ACTIVE.includes(dl.state);
  const ramGB = info.ramBytes / 1024 ** 3;
  const models = info.models.filter(m => !only || m.id === only);
  const error = errorText(t, locale, startError, dl);

  const btn = (primary) => ({
    padding: '7px 14px', borderRadius: T.r6, fontSize: 12.5, fontWeight: 500,
    fontFamily: T.fontUI, cursor: 'pointer',
    background: primary ? T.ink : T.paperSubtle, color: primary ? T.paper : T.ink80,
    border: primary ? 'none' : `1px solid ${T.hairline}`,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {models.map(m => {
        const mine = dl?.id === m.id;
        const downloading = mine && busy;
        const used = m.installed && inUse === m.file;
        const recommended = info.recommended === m.id;
        const tooBig = ramGB < m.minRamGB * 0.9;
        const left = m.size - (m.partial || 0);
        return (
          <div key={m.id} style={{
            padding: '12px 14px', borderRadius: T.r6,
            background: used ? T.accentSoft : T.paperSubtle,
            border: `1px solid ${used ? T.accent : T.hairline}`,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 500, color: used ? T.accentInk : T.ink }}>{t(`assistant.model.${m.id}`)}</span>
              <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink40 }}>{formatSize(m.size, locale)}</span>
              {recommended && !only && (
                <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.accentInk, padding: '2px 6px', background: T.accentSoft, borderRadius: 3, border: `1px solid ${T.accent}` }}>
                  {t('assistant.recommended')}
                </span>
              )}
              <span style={{ flex: 1 }} />
              {used && <span style={{ fontSize: 12, color: T.accentInk }}>✓ {t('assistant.inUse')}</span>}
              {m.installed && !used && onUse && (
                <button type="button" style={btn(false)} onClick={() => onUse(m.file)}>{t('assistant.use')}</button>
              )}
              {m.installed && !used && (
                <button type="button" style={{ ...btn(false), color: T.ink60 }} onClick={() => remove(m.id)}>{t('assistant.remove')}</button>
              )}
              {!m.installed && !downloading && (
                <button type="button" style={btn(true)} disabled={busy} onClick={() => start(m.id)}>
                  {m.partial ? t('assistant.resume', { size: formatSize(left, locale) }) : t('assistant.download', { size: formatSize(m.size, locale) })}
                </button>
              )}
              {downloading && dl.state === 'downloading' && (
                <button type="button" style={btn(false)} onClick={cancel}>{t('assistant.pause')}</button>
              )}
            </div>
            <div style={{ fontSize: 12, color: T.ink60, lineHeight: 1.5 }}>{t(`assistant.model.${m.id}.hint`)}</div>
            {tooBig && !m.installed && (
              <div style={{ fontSize: 12, color: T.warn }}>{t('assistant.ramLow', { ram: formatSize(info.ramBytes, locale) })}</div>
            )}
            {downloading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Bar value={dl.total ? dl.received / dl.total : 0} T={T} />
                <div style={{ fontSize: 12, color: T.ink60 }}>
                  {dl.state === 'resuming' ? t('assistant.resuming')
                    : dl.state === 'verifying' ? t('assistant.verifying')
                    : t('assistant.progress', { done: formatSize(dl.received, locale), total: formatSize(dl.total, locale) })}
                </div>
                <div style={{ fontSize: 12, color: T.ink40 }}>{t('assistant.keepUsing')}</div>
              </div>
            )}
          </div>
        );
      })}
      {error && <div style={{ fontSize: 12.5, color: T.danger }}>⚠ {error}</div>}
    </div>
  );
}
