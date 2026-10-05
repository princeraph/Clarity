import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import AiOfflineNotice from '../AiOfflineNotice.jsx';

const API = 'http://localhost:3001/api';

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMarkdown(text, T) {
  return escapeHtml(text)
    .replace(/^## (.+)$/gm,   (_, g) => `<h3 style="font-size:14px;font-weight:500;color:${T.ink};margin:20px 0 8px">${g}</h3>`)
    .replace(/^• (.+)$/gm,    (_, g) => `<li style="font-size:13.5px;color:${T.ink80};margin:4px 0 4px 12px">${g}</li>`)
    .replace(/\*\*(.+?)\*\*/g,(_, g) => `<strong style="color:${T.ink};font-weight:500">${g}</strong>`)
    .replace(/\n\n/g, '<br/>')
    .replace(/\n/g, ' ');
}

export default function WeeklySummaryView({ weeklySummary, health, onRefresh, onOpenSettings }) {
  const { t, fmtDate } = useLocale();
  const { T } = useTheme();
  const [generating, setGenerating] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function generate() {
    setGenerating(true);
    setStreamedText('');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const resp = await fetch(`${API}/weekly-summary`, { method: 'POST', signal: controller.signal });
      if (!resp.ok || !resp.body) throw new Error();
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done || controller.signal.aborted) { reader.cancel(); break; }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) setStreamedText(prev => prev + data.token);
            if (data.done) { await onRefresh(); setGenerating(false); }
            if (data.error) { setStreamedText(t('weekly.error', { detail: data.error })); setGenerating(false); }
          } catch {}
        }
      }
      setGenerating(false);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setStreamedText(t('weekly.noProvider'));
        setGenerating(false);
      }
    }
  }

  const displayText = generating ? streamedText : weeklySummary?.content || '';
  const generatedAt = weeklySummary?.generatedAt;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '36px 56px', fontFamily: T.fontUI, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, gap: 16 }}>
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 8 }}>
            {t('weekly.title')}
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500, letterSpacing: '-0.03em', color: T.ink }}>
            {generatedAt
              ? t('weekly.generated', { date: fmtDate(generatedAt, { weekday: 'long', month: 'short', day: 'numeric' }) })
              : t('weekly.subtitle')}
          </h1>
        </div>
        <button
          onClick={generate}
          disabled={generating || !health.ollama}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', background: T.ink, border: 'none',
            borderRadius: T.r6, fontSize: 13.5, fontWeight: 500,
            color: T.paper, cursor: generating || !health.ollama ? 'not-allowed' : 'pointer',
            opacity: !health.ollama ? 0.4 : 1, fontFamily: T.fontUI,
          }}
        >
          {generating ? (
            <>
              <span style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${T.paper}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              {t('weekly.generating')}
            </>
          ) : (
            <>{weeklySummary ? t('weekly.regenerate') : t('weekly.generate')}</>
          )}
        </button>
      </div>

      {!health.ollama && (
        <AiOfflineNotice health={health} onOpenSettings={onOpenSettings} style={{ marginBottom: 24 }} />
      )}

      {displayText ? (
        <div style={{
          padding: '20px 24px', background: T.paperSubtle,
          borderRadius: T.r10, border: `1px solid ${T.hairline}`,
          fontSize: 13.5, lineHeight: 1.7, color: T.ink80,
        }}>
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(displayText, T) }} />
          {generating && (
            <span style={{ display: 'inline-block', width: 2, height: 16, background: T.accent, marginLeft: 4, verticalAlign: 'middle', animation: 'clarityBlink 1s steps(2) infinite' }} />
          )}
        </div>
      ) : !generating && (
        <div style={{ textAlign: 'center', paddingTop: 64 }}>
          <div style={{
            width: 52, height: 52, borderRadius: T.r10,
            background: T.paperSubtle, border: `1px solid ${T.hairline}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.ink40} strokeWidth="1.6">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <p style={{ fontSize: 13.5, color: T.ink60 }}>{t('weekly.noSummary')}</p>
          <p style={{ fontSize: 12, color: T.ink40, marginTop: 4 }}>{t('weekly.clickGenerate')}</p>
        </div>
      )}
    </div>
  );
}
