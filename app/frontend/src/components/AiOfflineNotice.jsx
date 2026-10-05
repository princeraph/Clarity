import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';

// What to say when the AI is not there. It used to tell everyone to run
// `ollama serve` — a command, for a program most people have never installed.
// Ollama is still the default setting on a fresh install, so that is exactly
// what a friend trying Clarity saw first. Now the first way out is the one that
// needs nothing: the assistant built into Clarity.

const CLOUD = { openai: 'OpenAI', anthropic: 'Anthropic', openrouter: 'OpenRouter' };

export default function AiOfflineNotice({ health, onOpenSettings, style }) {
  const { T } = useTheme();
  const { t } = useLocale();
  const provider = health?.providerType || 'ollama';

  const link = (label) => (
    <button onClick={onOpenSettings} style={{
      fontSize: 12.5, color: T.accent, background: 'transparent', fontWeight: 500,
      border: 'none', cursor: 'pointer', padding: 0, fontFamily: T.fontUI,
    }}>{label}</button>
  );

  let body;
  if (CLOUD[provider]) {
    body = <>{t('ai.offline.cloud', { provider: CLOUD[provider] })} {link(t('ai.offline.settings'))}</>;
  } else if (provider === 'local') {
    body = <>{t('ai.offline.localNoModel')} {link(t('ai.offline.localCta'))}</>;
  } else {
    body = (
      <>
        {t('ai.offline.builtIn')} {link(t('ai.offline.builtInCta'))}
        <span style={{ display: 'block', marginTop: 4, color: T.ink40 }}>{t('ai.offline.ollamaHint')}</span>
      </>
    );
  }

  return (
    <div style={{
      padding: '14px 18px', background: T.paperSubtle,
      border: `1px solid ${T.hairline}`, borderRadius: T.r10,
      display: 'flex', alignItems: 'flex-start', gap: 12, ...style,
    }}>
      <span style={{ color: T.warn, fontSize: 16, lineHeight: 1.3 }}>⚠</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: T.ink }}>{t('focus.aiOffline')}</p>
        <p style={{ margin: '3px 0 0', fontSize: 12.5, color: T.ink60, lineHeight: 1.5 }}>{body}</p>
      </div>
    </div>
  );
}
