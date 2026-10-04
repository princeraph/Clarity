import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useLocale, LANGUAGES } from '../../contexts/LocaleContext.jsx';
import ApertureMark from '../ApertureMark.jsx';

const API = 'http://localhost:3001/api';

const PROVIDERS = [
  { id: 'ollama',    label: 'Ollama',     hintKey: 'settings.provider.ollama' },
  { id: 'openai',    label: 'OpenAI',     hintKey: 'settings.provider.openai' },
  { id: 'anthropic', label: 'Anthropic',  hintKey: 'settings.provider.anthropic' },
  { id: 'openrouter',label: 'OpenRouter', hintKey: 'settings.provider.openrouter' },
];

const PRESET_MODELS = {
  openai:     ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
  anthropic:  ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openrouter: [],
  ollama:     [],
};

const DEFAULT_MODEL = {
  openai:     'gpt-4o-mini',
  anthropic:  'claude-haiku-4-5-20251001',
  openrouter: '',
  ollama:     'gemma4:latest',
};

const SECTIONS = [
  { id: 'appearance', labelKey: 'settings.section.appearance' },
  { id: 'ai',         labelKey: 'settings.section.ai' },
  { id: 'capture',    labelKey: 'settings.section.capture' },
  { id: 'suggestions', labelKey: 'settings.section.suggestions' },
  { id: 'privacy',    labelKey: 'settings.section.privacy' },
  { id: 'data',       labelKey: 'settings.section.data' },
  { id: 'keyboard',   labelKey: 'settings.section.keyboard' },
  { id: 'language',   labelKey: 'settings.section.language' },
  { id: 'about',      labelKey: 'settings.section.about' },
];

// Keys, not text. This list is evaluated when the module loads, long before a
// React component (and therefore useLocale) exists — calling t() here threw
// "t is not defined" and blanked the whole app.
const DEFAULT_SHORTCUTS = [
  { id: 'capture',   actionKey: 'settings.quickCapture',    keys: ['Ctrl', 'K'] },
  { id: 'chat',      actionKey: 'settings.kb.toggleChat',   keys: ['Ctrl', '/'] },
  { id: 'theme',     actionKey: 'settings.kb.toggleTheme',  keys: ['Ctrl', 'Shift', 'L'] },
  { id: 'settings',  actionKey: 'settings.title',           keys: ['Ctrl', ','] },
  { id: 'focus',     actionKey: 'settings.kb.focusView',    keys: ['Ctrl', '1'] },
  { id: 'tasks',     actionKey: 'tasks.allTasks',           keys: ['Ctrl', '2'] },
  { id: 'calendar',  actionKey: 'nav.calendar',             keys: ['Ctrl', '3'] },
  { id: 'graph',     actionKey: 'settings.kb.graphView',    keys: ['Ctrl', 'G'] },
  { id: 'dismiss',   actionKey: 'settings.kb.dismiss',      keys: ['Esc'] },
  { id: 'complete',  actionKey: 'task.markComplete',        keys: ['Space'] },
  { id: 'detail',    actionKey: 'menu.openDetail',          keys: ['\u21b5'] },
  { id: 'delete',    actionKey: 'settings.kb.deleteTask',   keys: ['Del'] },
];

function loadCustomShortcuts() {
  try {
    const s = localStorage.getItem('clarity-shortcuts');
    return s ? JSON.parse(s) : {};
  } catch { return {}; }
}

function saveCustomShortcuts(map) {
  try { localStorage.setItem('clarity-shortcuts', JSON.stringify(map)); } catch {}
}

function formatKeyEvent(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey)   parts.push('Alt');
  const k = e.key;
  if (k === ' ') parts.push('Space');
  else if (k === 'Escape') parts.push('Esc');
  else if (k === 'Enter')  parts.push('↵');
  else if (k === 'Delete') parts.push('Del');
  else if (k === 'Backspace') parts.push('Backspace');
  else if (k.length === 1) parts.push(k.toUpperCase());
  else parts.push(k);
  return parts;
}


const ACCENT_OPTIONS = [
  { name: 'Ink',   val: 'oklch(0.48 0.13 258)' },
  { name: 'Moss',  val: 'oklch(0.55 0.10 155)' },
  { name: 'Ember', val: 'oklch(0.62 0.13 40)' },
  { name: 'Plum',  val: 'oklch(0.50 0.12 320)' },
];

function Toggle({ on, onChange, T }) {
  return (
    <span onClick={() => onChange(!on)} style={{
      width: 32, height: 18, borderRadius: 999,
      background: on ? T.accent : T.ink20,
      position: 'relative', display: 'inline-block',
      cursor: 'pointer', transition: 'background 200ms', flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 16 : 2,
        width: 14, height: 14, borderRadius: '50%',
        background: T.paper, boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'left 200ms',
      }} />
    </span>
  );
}

function SettingRow({ label, hint, children, T }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 16, alignItems: 'center',
      padding: '12px 14px', background: T.paperSubtle, borderRadius: T.r6,
      border: `1px solid ${T.hairlineSoft}`,
    }}>
      <div style={{ fontSize: 13.5, color: T.ink }}>{label}</div>
      <div style={{ fontSize: 12.5, color: T.ink60, lineHeight: 1.45 }}>{hint || ''}</div>
      <div>{children}</div>
    </div>
  );
}

function KbdChip({ children, T }) {
  return (
    <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink60, padding: '2px 7px', background: T.paper, borderRadius: 4, border: `1px solid ${T.hairline}`, boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
      {children}
    </span>
  );
}

function FieldRow({ label, hint, T, children }) {
  return (
    <div style={{ padding: '14px 16px', background: T.paperSubtle, borderRadius: T.r6, border: `1px solid ${T.hairlineSoft}` }}>
      <label style={{ display: 'block', fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink60, marginBottom: 8 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ margin: '6px 0 0', fontSize: 11.5, color: T.ink60, fontFamily: T.fontMono }}>{hint}</p>}
    </div>
  );
}

function Section({ title, subtitle, T, children }) {
  return (
    <section>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: T.ink }}>{title}</h3>
        {subtitle && <div style={{ marginTop: 4, fontSize: 12.5, color: T.ink60, lineHeight: 1.5 }}>{subtitle}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </section>
  );
}

// Shows exactly what would be sent to the AI provider, before anything is sent.
// A claim about privacy that cannot be inspected is just a sentence; this is the
// same composition the chat endpoint uses, rendered.
function OutboundPreview({ T }) {
  const { t } = useLocale();
  const [ctx, setCtx] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`${API}/context/preview`);
        if (!resp.ok) throw new Error();
        const json = await resp.json();
        if (!cancelled) setCtx(json);
      } catch { if (!cancelled) setError(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) return <div style={{ fontSize: 12.5, color: T.ink60 }}>{t('error.backendUnreachable')}</div>;
  if (!ctx) return <div style={{ fontSize: 12.5, color: T.ink40 }}>{t('settings.checking')}</div>;

  const local = ctx.providerIsLocal;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        padding: '13px 15px', borderRadius: T.r6,
        background: local ? T.accentSoft : T.paperSubtle,
        border: `1px solid ${local ? T.hairline : T.warn}`,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 5,
          background: local ? T.done : T.warn }} />
        <div style={{ fontSize: 13, color: local ? T.accentInk : T.ink, lineHeight: 1.55 }}>
          {local ? (
            <><strong>{t('settings.privacy.localTitle')}</strong> {t('settings.privacy.localBody', { provider: ctx.providerType })}</>
          ) : (
            <><strong>{t('settings.privacy.remoteTitle', { chars: ctx.chars, provider: ctx.providerType })}</strong> {t('settings.privacy.remoteBody')}</>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ctx.parts.map(p => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: 10, alignItems: 'baseline' }}>
            <span style={{ fontFamily: T.fontMono, fontSize: 12, color: p.included ? T.done : T.ink40 }}>
              {p.included ? '✓' : '–'}
            </span>
            <div>
              <span style={{ fontSize: 13, color: T.ink }}>{p.label}</span>
              <span style={{ fontSize: 12, color: T.ink40 }}> — {p.detail}</span>
            </div>
          </div>
        ))}
        {ctx.withheld.map(w => (
          <div key={w.id} style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: 10, alignItems: 'baseline' }}>
            <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.danger }}>✕</span>
            <div>
              <span style={{ fontSize: 13, color: T.ink }}>{w.label}</span>
              <span style={{ fontSize: 12, color: T.ink40 }}> — {w.reason}</span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <button onClick={() => setOpen(o => !o)} style={{
          padding: '7px 14px', background: 'transparent',
          border: `1px solid ${T.hairline}`, borderRadius: T.r6,
          fontSize: 12.5, color: T.ink60, cursor: 'pointer', fontFamily: T.fontUI,
        }}>{open ? 'Hide the exact text' : t('settings.showExactText')}</button>
      </div>

      {open && (
        <pre style={{
          margin: 0, padding: '13px 15px', maxHeight: 320, overflow: 'auto',
          background: T.paperSubtle, border: `1px solid ${T.hairline}`, borderRadius: T.r6,
          fontFamily: T.fontMono, fontSize: 11.5, lineHeight: 1.6, color: T.ink80,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>{ctx.text || '(nothing)'}</pre>
      )}
    </div>
  );
}

function KeyboardSection({ T }) {
  const { t } = useLocale();
  const [customMap, setCustomMap] = useState(loadCustomShortcuts);
  const [capturing, setCapturing] = useState(null); // shortcut id being captured

  function startCapture(id) { setCapturing(id); }

  function handleCaptureKey(e, id) {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') { setCapturing(null); return; }
    if (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) return;
    const parts = formatKeyEvent(e);
    const next = { ...customMap, [id]: parts };
    setCustomMap(next);
    saveCustomShortcuts(next);
    setCapturing(null);
  }

  function resetShortcut(id) {
    const next = { ...customMap };
    delete next[id];
    setCustomMap(next);
    saveCustomShortcuts(next);
  }

  const shortcuts = DEFAULT_SHORTCUTS.map(s => ({
    ...s,
    keys: customMap[s.id] || s.keys,
    isCustom: !!customMap[s.id],
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <PageHeader section={t('settings.section.keyboard')} title={t('settings.keyboard.title')} T={T} />

      <Section title={t('settings.keyboard.shortcuts')} subtitle={t('settings.keyboard.hint')} T={T}>
        {shortcuts.map(({ id, actionKey, keys, isCustom }) => (
          <div
            key={id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: T.paperSubtle,
              borderRadius: T.r6,
              border: `1px solid ${capturing === id ? T.accent : T.hairlineSoft}`,
              transition: 'border-color 0.15s',
            }}
          >
            <span style={{ fontSize: 13.5, color: T.ink }}>{t(actionKey)}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {capturing === id ? (
                <div
                  autoFocus
                  tabIndex={0}
                  onKeyDown={e => handleCaptureKey(e, id)}
                  onBlur={() => setCapturing(null)}
                  ref={el => el?.focus()}
                  style={{
                    padding: '4px 10px', borderRadius: T.r6,
                    background: T.accentSoft, border: `1px solid ${T.accent}`,
                    fontSize: 12, color: T.accentInk, fontFamily: T.fontMono,
                    outline: 'none', whiteSpace: 'nowrap', cursor: 'text',
                  }}
                >{t('settings.keyboard.pressKey')}</div>
              ) : (
                <div
                  onClick={() => startCapture(id)}
                  style={{
                    display: 'flex', gap: 4, cursor: 'pointer',
                    padding: '2px 4px', borderRadius: T.r6,
                  }}
                  title={t('settings.keyboard.clickToRemap')}
                  onMouseEnter={e => e.currentTarget.style.background = T.paperMuted}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {keys.map((k, i) => <KbdChip key={i} T={T}>{k}</KbdChip>)}
                </div>
              )}
              {isCustom && (
                <button
                  onClick={() => resetShortcut(id)}
                  title={t('settings.keyboard.resetDefault')}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: 10.5, color: T.ink40, fontFamily: T.fontMono, padding: 0,
                  }}
                >reset</button>
              )}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

// What Clarity is allowed to interrupt for, and the off switch.
//
// The status line is the point of this pane: it reports the live verdict from
// the same function the suggester uses, so a person who notices Clarity has
// gone quiet is told which of their own settings did it — rather than left to
// wonder whether the feature is broken.
function SuggestionSettings({ T }) {
  const { t } = useLocale();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/suggestions/status`);
      if (r.ok) setStatus(await r.json());
    } catch { setStatus(null); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function lift(id) {
    setBusy(true);
    try { await fetch(`${API}/suggestions/quiet/${id}`, { method: 'DELETE' }); await load(); }
    catch {} finally { setBusy(false); }
  }

  if (!status) return <div style={{ fontSize: 12.5, color: T.ink40 }}>{t('settings.checking')}</div>;

  const p = status.preferences || {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <PageHeader section={t('settings.section.suggestions')} title={t('settings.suggest.title')} T={T} />

      <div style={{
        padding: '14px 16px', borderRadius: T.r6,
        background: status.allowed ? T.accentSoft : T.paperSubtle,
        border: `1px solid ${status.allowed ? T.hairline : T.warn}`,
        fontSize: 13, color: status.allowed ? T.accentInk : T.ink, lineHeight: 1.55,
      }}>
        {status.allowed
          ? t('settings.suggest.allowed', { n: status.remaining })
          : `${t('settings.suggest.silent')} ${status.reason}`}
      </div>

      <Section title={t('settings.suggest.budget')} subtitle={t('settings.suggest.budgetHint')} T={T}>
        <FieldRow label={t('settings.suggest.mode')} hint={t(`settings.suggest.mode.${p.suggestionMode || 'active'}`)} T={T}>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>{p.suggestionMode || 'active'}</span>
        </FieldRow>
        <FieldRow label={t('settings.suggest.perDay')} hint={t('settings.suggest.perDayHint')} T={T}>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>
            {status.sentToday} / {p.maxSuggestionsPerDay}
          </span>
        </FieldRow>
        <FieldRow label={t('settings.suggest.gap')} hint={t('settings.suggest.gapHint')} T={T}>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>{p.minGapMinutes} min</span>
        </FieldRow>
        <FieldRow label={t('settings.suggest.night')} hint={t('settings.suggest.nightHint')} T={T}>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>
            {String(p.quietHours?.from ?? 22).padStart(2, '0')}:00 → {String(p.quietHours?.to ?? 7).padStart(2, '0')}:00
          </span>
        </FieldRow>
      </Section>

      <Section title={t('settings.suggest.quietRules')} subtitle={t('settings.suggest.quietRulesHint')} T={T}>
        {!status.quiet?.length ? (
          <div style={{ fontSize: 12.5, color: T.ink40 }}>{t('settings.suggest.noQuiet')}</div>
        ) : status.quiet.map(r => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
            borderBottom: `1px solid ${T.hairlineSoft}`,
          }}>
            <span style={{ flex: 1, fontSize: 13, color: T.ink }}>
              {r.kind === 'indefinite' ? t('settings.suggest.rule.always')
                : r.kind === 'duration' ? t('settings.suggest.rule.until', { when: new Date(r.until).toLocaleString() })
                : t('settings.suggest.rule.untilDone')}
              {r.reason && <span style={{ color: T.ink40 }}> — {r.reason}</span>}
            </span>
            <button disabled={busy} onClick={() => lift(r.id)} style={{
              padding: '5px 11px', background: 'transparent', color: T.ink60,
              border: `1px solid ${T.hairline}`, borderRadius: T.r6,
              fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer',
            }}>{t('settings.suggest.lift')}</button>
          </div>
        ))}
      </Section>
    </div>
  );
}

function PageHeader({ section: sLabel, title, T }) {
  return (
    <header>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
        Settings · {sLabel}
      </div>
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500, letterSpacing: '-0.03em', color: T.ink }}>{title}</h1>
    </header>
  );
}

async function triggerExport(fmt) {
  try {
    const resp = await fetch(`${API}/export`);
    if (!resp.ok) return;
    const data = await resp.json();
    const tasks = data.tasks || [];
    let content, filename, mime;

    if (fmt === 'json') {
      content  = JSON.stringify({ tasks }, null, 2);
      filename = 'clarity-export.json';
      mime     = 'application/json';
    } else if (fmt === 'md') {
      content = tasks.map(t => {
        const lines = [`## ${t.title}`];
        if (t.description) lines.push(`\n${t.description}`);
        if (t.deadline) lines.push(`\n**Due:** ${t.deadline}`);
        if (t.status) lines.push(`**Status:** ${t.status.replace('_', ' ')}`);
        if (t.tags?.length) lines.push(`**Tags:** ${t.tags.join(', ')}`);
        if (t.subtasks?.length) {
          lines.push('\n**Subtasks:**');
          t.subtasks.forEach(s => lines.push(`- [${s.done ? 'x' : ' '}] ${s.title}`));
        }
        return lines.join('\n');
      }).join('\n\n---\n\n');
      filename = 'clarity-export.md';
      mime     = 'text/markdown';
    } else {
      content = tasks.map(t => {
        const lines = [t.title];
        if (t.description) lines.push(t.description);
        if (t.deadline) lines.push(`Due: ${t.deadline}`);
        if (t.status) lines.push(`Status: ${t.status.replace('_', ' ')}`);
        if (t.tags?.length) lines.push(`Tags: ${t.tags.join(', ')}`);
        if (t.subtasks?.length) {
          lines.push('Subtasks:');
          t.subtasks.forEach(s => lines.push(`  [${s.done ? 'x' : ' '}] ${s.title}`));
        }
        return lines.join('\n');
      }).join('\n\n----------\n\n');
      filename = 'clarity-export.txt';
      mime     = 'text/plain';
    }

    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {}
}

export default function SettingsView({ onSaved }) {
  const { T, isDark, themeMode, setThemeMode, accent, setAccent, density, setDensity, font, setFont } = useTheme();
  const { t, locale, setLocale } = useLocale();
  const [form, setForm] = useState({
    providerType: 'ollama',
    llmEndpoint: 'http://localhost:11434',
    ollamaModel: 'gemma4:latest',
    tunnelSecret: '',
    keepAlive: '30m',
    apiKey: '',
  });
  const [apiKeySet, setApiKeySet] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [health, setHealth] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('appearance');
  const [backups, setBackups] = useState([]);
  const [userName, setUserName] = useState(() => {
    try { return localStorage.getItem('clarity-userName') || ''; } catch { return ''; }
  });

  const [aiToggles, setAiToggles] = useState({
    dailyPlan: true, autoReschedule: false, smartArea: true, convHistory: true,
  });
  const [captureToggles, setCaptureToggles] = useState({
    parsePreview: true, autoArea: true, detectRecur: true, parseDuration: false, chime: false,
  });
  const [privacyToggles, setPrivacyToggles] = useState({
    anonUsage: false, crashReports: false, perfMetrics: false, storeHistory: true, useHistory: true,
  });
  const [backupToggles, setBackupToggles] = useState({ autoBackup: true });

  useEffect(() => {
    async function load() {
      try {
        const [sr, hr, br] = await Promise.all([
          fetch(`${API}/settings`),
          fetch(`${API}/health`),
          fetch(`${API}/backups`),
        ]);
        if (sr.ok) {
          const s = await sr.json();
          const isSet = s.apiKey === '••••••••';
          setApiKeySet(isSet);
          setEditingKey(!isSet);
          setForm(f => ({
            ...f,
            providerType: s.providerType || 'ollama',
            llmEndpoint:  s.llmEndpoint  || 'http://localhost:11434',
            ollamaModel:  s.ollamaModel  || '',
            tunnelSecret: s.tunnelSecret || '',
            keepAlive:    s.keepAlive    || '30m',
            apiKey:       isSet ? '' : (s.apiKey || ''),
          }));
        }
        if (hr.ok) {
          const h = await hr.json();
          setHealth(h);
          if (h.availableModels?.length) setOllamaModels(h.availableModels);
        }
        if (br.ok) {
          const b = await br.json();
          setBackups(b.backups || []);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  function set(key, value) { setForm(f => ({ ...f, [key]: value })); setStatus(null); }

  function handleProviderChange(pid) {
    set('providerType', pid);
    if (DEFAULT_MODEL[pid]) set('ollamaModel', DEFAULT_MODEL[pid]);
    if (pid === 'ollama') set('llmEndpoint', 'http://localhost:11434');
    // Reset key state when switching provider
    setApiKeySet(false);
    setEditingKey(true);
    set('apiKey', '');
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const payload = { ...form };
      // Send masked sentinel if key is set and user hasn't changed it
      if (apiKeySet && !editingKey) payload.apiKey = '••••••••';
      const resp = await fetch(`${API}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (resp.ok) {
        setStatus({ type: 'success', message: t('settings.saved') });
        if (form.apiKey) { setApiKeySet(true); setEditingKey(false); }
        onSaved?.();
      } else {
        const err = await resp.json().catch(() => ({}));
        setStatus({ type: 'error', message: err.error || 'Failed to save.' });
      }
    } catch {
      setStatus({ type: 'error', message: 'Could not reach the backend.' });
    }
    setSaving(false);
  }

  const field = {
    width: '100%', padding: '8px 10px',
    background: T.paper, border: `1px solid ${T.hairline}`,
    borderRadius: T.r6, fontSize: 13.5, color: T.ink,
    fontFamily: T.fontUI, outline: 'none', boxSizing: 'border-box',
  };

  const activeProvider = form.providerType;
  const isOllama = activeProvider === 'ollama';
  const presetModels = PRESET_MODELS[activeProvider] || [];

  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: '232px 1fr', overflow: 'hidden', fontFamily: T.fontUI }}>
      {/* Settings sidebar */}
      <aside style={{ background: T.paperSubtle, borderRight: `1px solid ${T.hairline}`, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 4, boxSizing: 'border-box', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px', marginBottom: 16 }}>
          <ApertureMark s={20} />
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>{t('settings.title')}</span>
        </div>
        {SECTIONS.map(({ id, labelKey }) => (
          <button key={id} onClick={() => setSection(id)} style={{
            padding: '7px 10px', borderRadius: T.r6, width: '100%', textAlign: 'left',
            background: section === id ? T.paper : 'transparent',
            boxShadow: section === id ? `inset 0 0 0 1px ${T.hairline}` : 'none',
            fontSize: 13.5, color: section === id ? T.ink : T.ink80,
            fontWeight: section === id ? 500 : 400,
            border: 'none', cursor: 'pointer', fontFamily: T.fontUI,
          }}>{t(labelKey)}</button>
        ))}
      </aside>

      {/* Content */}
      <main style={{ padding: '36px 56px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
        {loading ? (
          <div style={{ color: T.ink60, fontSize: 13.5 }}>{t('settings.loading')}</div>
        ) : section === 'appearance' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <PageHeader section={t('settings.section.appearance')} title={t('settings.section.appearance')} T={T} />

            <Section title={t('settings.theme')} subtitle={t('settings.themeHint')} T={T}>
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { id: 'light', label: t('settings.themeLight'), previewBg: '#FAFAF7', previewInk: '#19191A', ring: true },
                  { id: 'dark',  label: t('settings.themeDark'),  previewBg: '#16161A', previewInk: '#F4F3EE' },
                  { id: 'auto',  label: t('settings.themeAuto'),  previewBg: 'linear-gradient(90deg, #FAFAF7 50%, #16161A 50%)', previewInk: null },
                ].map(opt => {
                  const active = themeMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setThemeMode(opt.id)}
                      style={{
                        width: 132, padding: 12, borderRadius: T.r10,
                        background: T.paperSubtle,
                        border: `1px solid ${active ? T.ink : T.hairline}`,
                        cursor: active ? 'default' : 'pointer',
                        display: 'flex', flexDirection: 'column', gap: 10,
                        fontFamily: T.fontUI, transition: 'border-color 0.15s',
                      }}
                    >
                      <div style={{
                        height: 60, borderRadius: 6,
                        background: opt.previewBg,
                        boxShadow: opt.ring ? `inset 0 0 0 1px ${T.hairline}` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                      }}>
                        {opt.previewInk && (
                          <ApertureMark s={26} ink={opt.previewInk} accent={T.accent} />
                        )}
                        {opt.id === 'auto' && (
                          <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.ink40, letterSpacing: '0.05em' }}>AUTO</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, color: T.ink }}>{opt.label}</span>
                        {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.ink, flexShrink: 0 }} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title={t('settings.density')} subtitle={t('settings.densityHint')} T={T}>
              <div style={{
                display: 'inline-flex', padding: 3,
                background: T.paperSubtle, borderRadius: T.r6,
                border: `1px solid ${T.hairline}`, width: 'fit-content',
              }}>
                {['Spacious', 'Balanced', 'Compact'].map(opt => {
                  const active = density === opt.toLowerCase();
                  return (
                    <button key={opt} onClick={() => setDensity(opt.toLowerCase())} style={{
                      padding: '6px 14px', borderRadius: 4, fontSize: 12.5,
                      background: active ? T.paper : 'transparent',
                      color: active ? T.ink : T.ink60,
                      fontWeight: active ? 500 : 400,
                      boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                      cursor: 'pointer', fontFamily: T.fontUI, border: 'none',
                    }}>{opt}</button>
                  );
                })}
              </div>
            </Section>

            <Section title={t('settings.accent')} subtitle={t('settings.accentHint')} T={T}>
              <div style={{ display: 'flex', gap: 10 }}>
                {ACCENT_OPTIONS.map(c => {
                  const active = accent === c.val;
                  return (
                    <div
                      key={c.name}
                      title={c.name}
                      onClick={() => setAccent(c.val)}
                      style={{
                        width: 36, height: 36, borderRadius: T.rPill,
                        background: c.val,
                        boxShadow: active ? `0 0 0 2px ${T.paper}, 0 0 0 4px ${T.ink}` : 'none',
                        cursor: 'pointer', flexShrink: 0,
                        transition: 'box-shadow 0.15s',
                      }}
                    />
                  );
                })}
              </div>
            </Section>

            <Section title={t('settings.typography')} subtitle={t('settings.typographyHint')} T={T}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { id: 'geist',  label: 'Geist',     sample: t('settings.fontGeist') },
                  { id: 'system', label: 'System UI',  sample: t('settings.fontSystem') },
                  { id: 'serif',  label: 'Serif',      sample: t('settings.fontSerif') },
                ].map(opt => {
                  const active = font === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setFont(opt.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '11px 14px', textAlign: 'left',
                        background: active ? T.accentSoft : T.paperSubtle,
                        border: `1px solid ${active ? T.accent : T.hairline}`,
                        borderRadius: T.r6, cursor: 'pointer',
                        fontFamily: T.fontUI,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: active ? T.accentInk : T.ink }}>{opt.label}</div>
                        <div style={{ fontSize: 12, color: T.ink60, marginTop: 2 }}>{opt.sample}</div>
                      </div>
                      {active && (
                        <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.accentInk, padding: '2px 6px', background: T.accentSoft, borderRadius: 3, border: `1px solid ${T.accent}` }}>{t('settings.active')}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Section>
          </div>

        ) : section === 'ai' ? (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <PageHeader section={t('settings.section.ai')} title={t('settings.ai.title')} T={T} />

            <Section title={t('settings.ai.provider')} subtitle={t('settings.ai.providerHint')} T={T}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 14px', textAlign: 'left',
                      background: activeProvider === p.id ? T.accentSoft : T.paperSubtle,
                      border: `1px solid ${activeProvider === p.id ? T.accent : T.hairline}`,
                      borderRadius: T.r6, cursor: 'pointer', transition: 'all 0.1s',
                    }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      border: `1.5px solid ${activeProvider === p.id ? T.accent : T.ink40}`,
                      background: activeProvider === p.id ? T.accent : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {activeProvider === p.id && (
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.paper }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: activeProvider === p.id ? T.accentInk : T.ink }}>{p.label}</div>
                      <div style={{ fontSize: 12, color: activeProvider === p.id ? T.accentInk : T.ink60, marginTop: 2, opacity: 0.85 }}>{t(p.hintKey)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Section>

            <Section title={t('settings.ai.model')} T={T}>
              {presetModels.length > 0 ? (
                <FieldRow label={t('settings.model')} T={T}>
                  <div style={{ position: 'relative' }}>
                    <select value={form.ollamaModel} onChange={e => set('ollamaModel', e.target.value)}
                      style={{ ...field, appearance: 'none', paddingRight: 28, cursor: 'pointer' }}>
                      {presetModels.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: T.ink40, pointerEvents: 'none', fontSize: 10 }}>▾</span>
                  </div>
                </FieldRow>
              ) : isOllama && ollamaModels.length > 0 ? (
                <FieldRow label={t('settings.model')} hint={t('settings.modelsInstalledInYourLocal')} T={T}>
                  <div style={{ position: 'relative' }}>
                    <select value={form.ollamaModel} onChange={e => set('ollamaModel', e.target.value)}
                      style={{ ...field, appearance: 'none', paddingRight: 28, cursor: 'pointer' }}>
                      {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: T.ink40, pointerEvents: 'none', fontSize: 10 }}>▾</span>
                  </div>
                </FieldRow>
              ) : (
                <FieldRow
                  label={t('settings.model')}
                  hint={isOllama ? 'Ollama not connected — type model name manually.' : activeProvider === 'openrouter' ? 'e.g. mistralai/mistral-7b-instruct' : ''}
                  T={T}
                >
                  <input
                    value={form.ollamaModel}
                    onChange={e => set('ollamaModel', e.target.value)}
                    placeholder={DEFAULT_MODEL[activeProvider] || 'model-name'}
                    style={field}
                  />
                </FieldRow>
              )}
            </Section>

            {!isOllama && (
              <Section title={t('settings.ai.apiKey')} subtitle={t('settings.ai.apiKeyHint', { provider: PROVIDERS.find(p => p.id === activeProvider)?.label })} T={T}>
                <FieldRow label={t('settings.secretKey')} T={T}>
                  {apiKeySet && !editingKey ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        flex: 1, padding: '8px 10px',
                        background: T.successSoft, border: `1px solid ${T.successBorder}`,
                        borderRadius: T.r6, fontSize: 13, color: T.success,
                        fontFamily: T.fontUI,
                      }}>
                        ✓ {t('settings.apiKeySaved')}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setEditingKey(true); set('apiKey', ''); }}
                        style={{
                          padding: '8px 14px', background: T.paperSubtle,
                          border: `1px solid ${T.hairline}`, borderRadius: T.r6,
                          fontSize: 12.5, color: T.ink60, cursor: 'pointer', fontFamily: T.fontUI,
                        }}
                      >{t('settings.ai.replace')}</button>
                    </div>
                  ) : (
                    <input
                      type="password"
                      value={form.apiKey}
                      onChange={e => set('apiKey', e.target.value)}
                      placeholder="sk-..."
                      autoComplete="new-password"
                      style={field}
                    />
                  )}
                </FieldRow>
              </Section>
            )}

            {isOllama && (
              <Section title={t('settings.ai.connection')} T={T}>
                <FieldRow label={t('settings.ollamaEndpoint')} hint={t('settings.defaultHttpLocalhost11434')} T={T}>
                  <input type="url" value={form.llmEndpoint} onChange={e => set('llmEndpoint', e.target.value)}
                    placeholder="http://localhost:11434" style={field} />
                </FieldRow>
                <FieldRow label={t('settings.tunnelSecret')} hint={t('settings.bearerTokenForNgrokSsh')} T={T}>
                  <input type="password" value={form.tunnelSecret} onChange={e => set('tunnelSecret', e.target.value)}
                    placeholder={t('settings.ai.tunnelPlaceholder')} style={field} />
                </FieldRow>
                {/* The trade is stated, because it is a real one: speed now, or
                    the RAM back sooner. */}
                <FieldRow label={t('settings.keepAlive')} hint={t('settings.keepAliveHint')} T={T}>
                  <select value={form.keepAlive} onChange={e => set('keepAlive', e.target.value)} style={{
                    fontFamily: T.fontMono, fontSize: 12.5, color: T.ink60,
                    background: T.paperSubtle, border: `1px solid ${T.hairline}`,
                    borderRadius: T.r6, padding: '5px 10px', cursor: 'pointer',
                  }}>
                    <option value="30m">{t('settings.keepAlive.30m')}</option>
                    <option value="2h">{t('settings.keepAlive.2h')}</option>
                    <option value="-1">{t('settings.keepAlive.forever')}</option>
                    <option value="0">{t('settings.keepAlive.never')}</option>
                  </select>
                </FieldRow>
              </Section>
            )}

            <Section title={t('settings.ai.features')} subtitle={t('settings.ai.featuresHint')} T={T}>
              <SettingRow label={t('settings.dailyPlanStrip')} hint={t('settings.showAiGeneratedDailyPlan')} T={T}>
                <Toggle on={aiToggles.dailyPlan} onChange={v => setAiToggles(t => ({ ...t, dailyPlan: v }))} T={T} />
              </SettingRow>
              <SettingRow label={t('settings.autoRescheduleStaleTasks')} hint={t('settings.moveOverdueTasksAutomatically')} T={T}>
                <Toggle on={aiToggles.autoReschedule} onChange={v => setAiToggles(t => ({ ...t, autoReschedule: v }))} T={T} />
              </SettingRow>
              <SettingRow label={t('settings.smartAreaDetection')} hint={t('settings.autoAssignTasksToAreas')} T={T}>
                <Toggle on={aiToggles.smartArea} onChange={v => setAiToggles(t => ({ ...t, smartArea: v }))} T={T} />
              </SettingRow>
              <SettingRow label={t('settings.conversationHistory')} hint={t('settings.aiRemembersContextAcrossSessions')} T={T}>
                <Toggle on={aiToggles.convHistory} onChange={v => setAiToggles(t => ({ ...t, convHistory: v }))} T={T} />
              </SettingRow>
            </Section>

            {status && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5,
                padding: '12px 16px', borderRadius: T.r6,
                background: status.type === 'success' ? T.successSoft : T.dangerSoft,
                color: status.type === 'success' ? T.success : T.danger,
                border: `1px solid ${status.type === 'success' ? T.successBorder : T.dangerBorder}`,
              }}>
                {status.type === 'success' ? '✓' : '⚠'} {status.message}
              </div>
            )}

            <button type="submit" disabled={saving} style={{
              padding: '11px 0', background: T.ink, border: 'none',
              borderRadius: T.r6, fontSize: 13.5, fontWeight: 500,
              color: T.paper, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1, fontFamily: T.fontUI,
            }}>
              {saving ? 'Saving…' : t('settings.save')}
            </button>
          </form>

        ) : section === 'capture' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <PageHeader section={t('settings.section.capture')} title={t('settings.section.capture')} T={T} />

            <Section title={t('settings.capture.shortcut')} subtitle={t('settings.capture.shortcutHint')} T={T}>
              <SettingRow label={t('settings.quickCapture')} hint="" T={T}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <KbdChip T={T}>Ctrl</KbdChip>
                  <KbdChip T={T}>K</KbdChip>
                </div>
              </SettingRow>
            </Section>

            <Section title={t('settings.capture.defaults')} T={T}>
              <SettingRow label={t('settings.defaultArea')} hint={t('settings.whereNewTasksGo')} T={T}>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>{t('nav.inbox')}</span>
              </SettingRow>
              <SettingRow label={t('settings.defaultDueDate')} hint={t('settings.appliedToNewCaptures')} T={T}>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>None</span>
              </SettingRow>
            </Section>

            <Section title={t('settings.capture.parsing')} subtitle={t('settings.capture.parsingHint')} T={T}>
              <SettingRow label={t('settings.showParsePreview')} hint={t('settings.displayParsedFieldsBelowInput')} T={T}>
                <Toggle on={captureToggles.parsePreview} onChange={v => setCaptureToggles(t => ({ ...t, parsePreview: v }))} T={T} />
              </SettingRow>
              <SettingRow label={t('settings.autoAssignArea')} hint={t('settings.detectAndApplyAreaFrom')} T={T}>
                <Toggle on={captureToggles.autoArea} onChange={v => setCaptureToggles(t => ({ ...t, autoArea: v }))} T={T} />
              </SettingRow>
              <SettingRow label={t('settings.detectRecurrence')} hint={t('settings.parseEveryMondayEtc')} T={T}>
                <Toggle on={captureToggles.detectRecur} onChange={v => setCaptureToggles(t => ({ ...t, detectRecur: v }))} T={T} />
              </SettingRow>
              <SettingRow label={t('settings.parseDuration')} hint={t('settings.extractTimeEstimatesFromText')} T={T}>
                <Toggle on={captureToggles.parseDuration} onChange={v => setCaptureToggles(t => ({ ...t, parseDuration: v }))} T={T} />
              </SettingRow>
            </Section>

            <Section title={t('settings.capture.after')} T={T}>
              <SettingRow label={t('settings.onSave')} hint={t('settings.whatHappensAfterSaving')} T={T}>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>{t('settings.closeAndReturn')}</span>
              </SettingRow>
              <SettingRow label={t('settings.captureChime')} hint={t('settings.playASoundOnSave')} T={T}>
                <Toggle on={captureToggles.chime} onChange={v => setCaptureToggles(t => ({ ...t, chime: v }))} T={T} />
              </SettingRow>
            </Section>
          </div>

        ) : section === 'suggestions' ? (
          <SuggestionSettings T={T} />

        ) : section === 'privacy' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <PageHeader section={t('settings.section.privacy')} title={t('settings.section.privacy')} T={T} />

            <Section
              title={t('settings.privacy.whatGetsSent')}
              subtitle={t('settings.privacy.whatGetsSentHint')}
              T={T}
            >
              <OutboundPreview T={T} />
            </Section>

            <Section title={t('settings.privacy.diagnostics')} subtitle={t('settings.privacy.diagnosticsHint')} T={T}>
              <SettingRow label={t('settings.anonymousUsageData')} hint={t('settings.appFeatureUsageNoTask')} T={T}>
                <Toggle on={privacyToggles.anonUsage} onChange={v => setPrivacyToggles(t => ({ ...t, anonUsage: v }))} T={T} />
              </SettingRow>
              <SettingRow label={t('settings.crashReports')} hint={t('settings.automaticErrorReporting')} T={T}>
                <Toggle on={privacyToggles.crashReports} onChange={v => setPrivacyToggles(t => ({ ...t, crashReports: v }))} T={T} />
              </SettingRow>
              <SettingRow label={t('settings.performanceMetrics')} hint={t('settings.latencyAndRenderingStats')} T={T}>
                <Toggle on={privacyToggles.perfMetrics} onChange={v => setPrivacyToggles(t => ({ ...t, perfMetrics: v }))} T={T} />
              </SettingRow>
            </Section>

            <Section title={t('settings.privacy.conversation')} T={T}>
              <SettingRow label={t('settings.storeHistory')} hint={t('settings.keepChatHistoryBetweenSessions')} T={T}>
                <Toggle on={privacyToggles.storeHistory} onChange={v => setPrivacyToggles(t => ({ ...t, storeHistory: v }))} T={T} />
              </SettingRow>
              <SettingRow label={t('settings.useHistoryToImprovePlans')} hint={t('settings.letAiReferencePastConversations')} T={T}>
                <Toggle on={privacyToggles.useHistory} onChange={v => setPrivacyToggles(t => ({ ...t, useHistory: v }))} T={T} />
              </SettingRow>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <button style={{
                  padding: '8px 16px',
                  background: 'transparent', border: `1px solid ${T.hairline}`,
                  borderRadius: T.r6, fontSize: 13, color: T.ink60,
                  cursor: 'pointer', fontFamily: T.fontUI,
                }}>{t('settings.privacy.clearHistory')}</button>
              </div>
            </Section>
          </div>

        ) : section === 'data' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <PageHeader section={t('settings.section.data')} title={t('settings.section.data')} T={T} />

            <Section title={t('settings.data.storage')} T={T}>
              <SettingRow label={t('settings.dataDirectory')} hint={t('settings.localStoragePath')} T={T}>
                <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink60 }}>APPDATA/Clarity/data/</span>
              </SettingRow>
              <SettingRow label={t('settings.databaseSize')} hint={t('settings.approximate')} T={T}>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>18.4 MB</span>
              </SettingRow>
            </Section>

            <Section title={t('settings.data.backup')} subtitle={t('settings.data.backupHint')} T={T}>
              <SettingRow label={t('settings.autoBackup')} hint={t('settings.createDailySnapshots')} T={T}>
                <Toggle on={backupToggles.autoBackup} onChange={v => setBackupToggles(t => ({ ...t, autoBackup: v }))} T={T} />
              </SettingRow>
              <SettingRow label={t('settings.backupFrequency')} hint="" T={T}>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>{t('form.daily')}</span>
              </SettingRow>
              <SettingRow label={t('settings.keepLast')} hint={t('settings.olderSnapshotsAreRemovedAutomatically')} T={T}>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>7 snapshots</span>
              </SettingRow>
            </Section>

            {backups.length > 0 && (
              <Section title={t('settings.data.backupFiles')} T={T}>
                {backups.map(b => (
                  <div key={b.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '10px 14px', background: T.paperSubtle, borderRadius: T.r6, border: `1px solid ${T.hairlineSoft}` }}>
                    <div>
                      <span style={{ fontSize: 13.5, color: T.ink }}>{b.date}</span>
                      <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink40, marginLeft: 10 }}>{b.name}</span>
                    </div>
                    <a href={`${API}/backups/${b.name}`} download={b.name} style={{
                      fontSize: 12, color: T.accent, textDecoration: 'none', fontFamily: T.fontUI,
                    }}>{t('settings.data.download')}</a>
                  </div>
                ))}
              </Section>
            )}

            <Section title={t('settings.data.export')} subtitle={t('settings.data.exportHint')} T={T}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => triggerExport('json')}
                  style={{
                    padding: '9px 18px', background: T.paperSubtle, border: `1px solid ${T.hairline}`,
                    borderRadius: T.r6, fontSize: 13, color: T.ink60, cursor: 'pointer', fontFamily: T.fontUI,
                  }}>JSON</button>
                <button
                  onClick={() => triggerExport('md')}
                  style={{
                    padding: '9px 18px', background: T.paperSubtle, border: `1px solid ${T.hairline}`,
                    borderRadius: T.r6, fontSize: 13, color: T.ink60, cursor: 'pointer', fontFamily: T.fontUI,
                  }}>{t('export.markdown')}</button>
                <button
                  onClick={() => triggerExport('txt')}
                  style={{
                    padding: '9px 18px', background: T.paperSubtle, border: `1px solid ${T.hairline}`,
                    borderRadius: T.r6, fontSize: 13, color: T.ink60, cursor: 'pointer', fontFamily: T.fontUI,
                  }}>{t('settings.data.plainText')}</button>
                <button disabled style={{
                  padding: '9px 18px', background: T.paperSubtle, border: `1px solid ${T.hairline}`,
                  borderRadius: T.r6, fontSize: 13, color: T.ink40, cursor: 'not-allowed', fontFamily: T.fontUI,
                }}>CSV</button>
              </div>
            </Section>

            <Section title={t('settings.data.danger')} T={T}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => {
                    if (!confirm(t('settings.data.confirmDeleteAll'))) return;
                    try {
                      const r = await fetch(`${API}/tasks/all`, { method: 'DELETE' });
                      if (r.ok) window.location.reload();
                    } catch {}
                  }}
                  style={{
                    padding: '9px 18px', background: 'transparent',
                    border: `1px solid ${T.dangerBorder}`,
                    borderRadius: T.r6, fontSize: 13,
                    color: T.danger, cursor: 'pointer', fontFamily: T.fontUI,
                  }}>{t('settings.data.deleteAll')}</button>
                <button
                  onClick={async () => {
                    // This used to confirm and then merely reload, deleting nothing.
                    // The wording now matches what actually happens, backups included.
                    if (!confirm(t('settings.data.confirmReset'))) return;
                    try {
                      const r = await fetch(`${API}/reset`, { method: 'POST' });
                      if (r.ok) window.location.reload();
                      else alert(t('settings.data.resetFailed'));
                    } catch {
                      alert(t('settings.data.resetUnreachable'));
                    }
                  }}
                  style={{
                    padding: '9px 18px', background: T.danger,
                    border: 'none', borderRadius: T.r6, fontSize: 13,
                    color: T.paper, cursor: 'pointer', fontFamily: T.fontUI, fontWeight: 500,
                  }}>{t('settings.data.reset')}</button>
              </div>
            </Section>
          </div>

        ) : section === 'keyboard' ? (
          <KeyboardSection T={T} />

        ) : section === 'language' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <PageHeader section={t('settings.section.language')} title={t('settings.language.title')} T={T} />

            <div style={{
              padding: '14px 16px', background: T.accentSoft, borderRadius: T.r6,
              border: `1px solid ${T.hairline}`, fontSize: 13, color: T.accentInk, lineHeight: 1.55,
            }}>
              {t('settings.language.banner')}
            </div>

            <Section title={t('settings.language.yourName')} subtitle={t('settings.language.yourNameHint')} T={T}>
              <div style={{ padding: '14px 16px', background: T.paperSubtle, borderRadius: T.r6, border: `1px solid ${T.hairlineSoft}` }}>
                <input
                  type="text"
                  value={userName}
                  onChange={e => {
                    setUserName(e.target.value);
                    try { localStorage.setItem('clarity-userName', e.target.value); } catch {}
                  }}
                  placeholder={t('settings.language.namePlaceholder')}
                  style={{
                    width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                    background: T.paper, border: `1px solid ${T.hairline}`,
                    borderRadius: T.r6, fontSize: 13.5, color: T.ink,
                    fontFamily: T.fontUI, outline: 'none',
                  }}
                />
                {userName && (
                  <div style={{ marginTop: 8, fontSize: 12, color: T.ink60, fontFamily: T.fontMono }}>
                    {t('settings.namePreview')} <span style={{ color: T.ink }}>{t('focus.greeting.morning')}, {userName}.</span>
                  </div>
                )}
              </div>
            </Section>

            <Section title={t('settings.language.interface')} subtitle={t('settings.language.interfaceHint')} T={T}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {LANGUAGES.map(lang => {
                  const active = locale === lang.id;
                  return (
                    <button
                      key={lang.id}
                      onClick={() => {
                        setLocale(lang.id);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', textAlign: 'left',
                        background: active ? T.accentSoft : T.paperSubtle,
                        border: `1px solid ${active ? T.accent : T.hairlineSoft}`,
                        borderRadius: T.r6, cursor: 'pointer', fontFamily: T.fontUI,
                      }}
                    >
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{lang.flag}</span>
                      <span style={{ flex: 1, fontSize: 13.5, color: active ? T.accentInk : T.ink, fontWeight: active ? 500 : 400 }}>{lang.label}</span>
                      {active && <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? T.accent : T.ink, flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            </Section>
          </div>

        ) : (
          /* About */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <PageHeader section={t('settings.section.about')} title={t('settings.about.title')} T={T} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
              <ApertureMark s={56} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: T.ink }}>Clarity</div>
                <div style={{ fontSize: 13, color: T.ink60, marginTop: 3 }}>{t('settings.about.tagline')}</div>
              </div>
            </div>

            <Section title={t('settings.about.system')} T={T}>
              {[
                ['Version', '1.2.0', null],
                [t('settings.data.storage'), t('tray.onDevice'), t('settings.about.storedIn')],
                ['AI providers', 'Ollama · OpenAI · Anthropic · OpenRouter', null],
                ['Platform', window.navigator.platform || 'Unknown', null],
              ].map(([label, value, hint]) => (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, alignItems: 'start', padding: '12px 14px', background: T.paperSubtle, borderRadius: T.r6, border: `1px solid ${T.hairlineSoft}` }}>
                  <span style={{ fontSize: 13.5, color: T.ink }}>{label}</span>
                  <div>
                    <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.ink80 }}>{value}</span>
                    {hint && <div style={{ fontSize: 11.5, color: T.ink60, marginTop: 3, fontFamily: T.fontMono }}>{hint}</div>}
                  </div>
                </div>
              ))}
            </Section>
          </div>
        )}
      </main>
    </div>
  );
}
