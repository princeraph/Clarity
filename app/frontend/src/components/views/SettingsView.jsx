import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useLocale, LANGUAGES } from '../../contexts/LocaleContext.jsx';
import { useFeatures, setFeature } from '../../features.js';
import ApertureMark from '../ApertureMark.jsx';
import { useAssistant, AssistantModels } from '../AssistantSetup.jsx';
import OllamaSetup from '../OllamaSetup.jsx';
import ConnectorAnimation from '../ConnectorAnimation.jsx';

const API = 'http://localhost:3001/api';

const PROVIDERS = [
  // First: the one that works for someone who has nothing else set up.
  { id: 'local',     labelKey: 'settings.provider.localLabel', hintKey: 'settings.provider.local' },
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
  { id: 'daily',      labelKey: 'settings.section.daily' },
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
  { nameKey: 'settings.accent.ink',   val: 'oklch(0.48 0.13 258)' },
  { nameKey: 'settings.accent.moss',  val: 'oklch(0.55 0.10 155)' },
  { nameKey: 'settings.accent.ember', val: 'oklch(0.62 0.13 40)' },
  { nameKey: 'settings.accent.plum',  val: 'oklch(0.50 0.12 320)' },
];

// Shortcuts are STORED with English key names (keysMatchEvent reads them), and
// only SHOWN in the interface language: "Maj", "Échap", "Suppr" on a French
// keyboard. Ctrl, letters and arrows read the same in both.
const KEY_LABEL = { Shift: 'kbd.shift', Space: 'kbd.space', Esc: 'kbd.esc', Del: 'kbd.del', Backspace: 'kbd.backspace' };

const DENSITIES = [
  { id: 'spacious', key: 'settings.density.spacious' },
  { id: 'balanced', key: 'settings.density.balanced' },
  { id: 'compact',  key: 'settings.density.compact' },
];

// The context preview arrives from the backend in English. Its parts and
// refusals carry stable ids and their numbers; the sentences are rebuilt here.
const WITHHELD_KEY = {
  journal:     { label: 'settings.preview.withheld.journal.label',     reason: 'settings.preview.withheld.journal.reason' },
  evidence:    { label: 'settings.preview.withheld.evidence.label',    reason: 'settings.preview.withheld.evidence.reason' },
  transcripts: { label: 'settings.preview.withheld.transcripts.label', reason: 'settings.preview.withheld.transcripts.reason' },
  metrics:     { label: 'settings.preview.withheld.metrics.label',     reason: 'settings.preview.withheld.metrics.reason' },
};

const MODE_NAME_KEY = {
  active:    'settings.suggest.modeName.active',
  daily:     'settings.suggest.modeName.daily',
  onRequest: 'settings.suggest.modeName.onRequest',
};

function previewPart(p, local, t) {
  if (p.id === 'tasks' && Number.isFinite(p.count)) {
    return {
      label: t('settings.preview.tasks.label'),
      detail: t(p.count === 1 ? 'settings.preview.tasks.detailOne' : 'settings.preview.tasks.detailMany', { n: p.count }),
    };
  }
  if (p.id === 'profile-brief' && Number.isFinite(p.statements)) {
    const label = t(local ? 'settings.preview.brief.labelLocal' : 'settings.preview.brief.labelRemote');
    if (!p.statements) return { label, detail: t('settings.preview.brief.empty', { n: p.minSamples }) };
    const base = t(p.statements === 1 ? 'settings.preview.brief.detailOne' : 'settings.preview.brief.detailMany', { n: p.statements, budget: p.budget });
    return { label, detail: p.dropped ? t('settings.preview.brief.detailDropped', { detail: base, n: p.dropped }) : base };
  }
  return { label: p.label, detail: p.detail };
}

// Why Clarity is staying quiet, from the verdict's code — the backend's
// `reason` is the English fallback for a code this build does not know.
function silenceReason(status, t, fmtDateTime) {
  const p = status.preferences || {};
  switch (status.code) {
    case 'quiet-rule': {
      const kind = status.rule?.kind;
      if (kind === 'indefinite') return t('settings.suggest.why.quietAlways');
      if (kind === 'duration')   return t('settings.suggest.why.quietUntil', { when: fmtDateTime(status.rule.until) });
      return t('settings.suggest.why.quietUntilDone');
    }
    case 'on-request':   return t('settings.suggest.why.onRequest');
    case 'daily-done':   return t('settings.suggest.why.dailyDone');
    case 'night':        return t('settings.suggest.why.night', { from: p.quietHours?.from ?? 22, to: p.quietHours?.to ?? 7 });
    case 'budget-zero':  return t('settings.suggest.why.budgetZero');
    case 'budget-spent': return t('settings.suggest.why.budgetSpent', { n: p.maxSuggestionsPerDay });
    case 'too-soon':     return t('settings.suggest.why.tooSoon', { n: status.waitMinutes });
    default:             return status.reason;
  }
}

const SAVE_ERROR_KEY = {
  'invalid-url':   'settings.saveError.invalidUrl',
  'invalid-model': 'settings.saveError.invalidModel',
  'store-failed':  'settings.saveError.storeFailed',
};

// A real switch: it was a clickable <span>, out of reach of the keyboard and
// silent to a screen reader.
function Toggle({ on, onChange, T, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label} onClick={() => onChange(!on)} style={{
      width: 32, height: 18, borderRadius: 999, border: 'none', padding: 0,
      background: on ? T.accent : T.ink20,
      position: 'relative', display: 'inline-block', verticalAlign: 'middle',
      cursor: 'pointer', transition: 'background 200ms', flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 16 : 2,
        width: 14, height: 14, borderRadius: '50%',
        background: T.paper, boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'left 200ms',
      }} />
    </button>
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
        {ctx.parts.map(raw => ({ ...raw, ...previewPart({ ...raw, budget: ctx.budget }, local, t) })).map(p => (
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
              <span style={{ fontSize: 13, color: T.ink }}>{WITHHELD_KEY[w.id] ? t(WITHHELD_KEY[w.id].label) : w.label}</span>
              <span style={{ fontSize: 12, color: T.ink40 }}> — {WITHHELD_KEY[w.id] ? t(WITHHELD_KEY[w.id].reason) : w.reason}</span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <button onClick={() => setOpen(o => !o)} style={{
          padding: '7px 14px', background: 'transparent',
          border: `1px solid ${T.hairline}`, borderRadius: T.r6,
          fontSize: 12.5, color: T.ink60, cursor: 'pointer', fontFamily: T.fontUI,
        }}>{open ? t('settings.hideExactText') : t('settings.showExactText')}</button>
      </div>

      {open && (
        <pre style={{
          margin: 0, padding: '13px 15px', maxHeight: 320, overflow: 'auto',
          background: T.paperSubtle, border: `1px solid ${T.hairline}`, borderRadius: T.r6,
          fontFamily: T.fontMono, fontSize: 11.5, lineHeight: 1.6, color: T.ink80,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>{ctx.text || t('settings.previewNothing')}</pre>
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
                  {keys.map((k, i) => <KbdChip key={i} T={T}>{KEY_LABEL[k] ? t(KEY_LABEL[k]) : k}</KbdChip>)}
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
                >{t('settings.keyboard.reset')}</button>
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
  const { t, fmtDateTime } = useLocale();
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
          : `${t('settings.suggest.silent')} ${silenceReason(status, t, fmtDateTime)}`}
      </div>

      <Section title={t('settings.suggest.budget')} subtitle={t('settings.suggest.budgetHint')} T={T}>
        <FieldRow label={t('settings.suggest.mode')} hint={t(`settings.suggest.mode.${p.suggestionMode || 'active'}`)} T={T}>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>{t(MODE_NAME_KEY[p.suggestionMode || 'active'] || MODE_NAME_KEY.active)}</span>
        </FieldRow>
        <FieldRow label={t('settings.suggest.perDay')} hint={t('settings.suggest.perDayHint')} T={T}>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>
            {status.sentToday} / {p.maxSuggestionsPerDay}
          </span>
        </FieldRow>
        <FieldRow label={t('settings.suggest.gap')} hint={t('settings.suggest.gapHint')} T={T}>
          <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>{t('settings.suggest.gapValue', { n: p.minGapMinutes })}</span>
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
                : r.kind === 'duration' ? t('settings.suggest.rule.until', { when: fmtDateTime(r.until) })
                : t('settings.suggest.rule.untilDone')}
              {/* locales-ok: the person's own words, echoed back as typed */}
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

// What an assistant asked for, in words. An action this build does not know
// still gets a line, so the list never hides a call.
const CONNECTOR_ACTION_KEY = {
  overview:   'settings.connector.action.overview',
  list:       'settings.connector.action.list',
  read:       'settings.connector.action.read',
  add:        'settings.connector.action.add',
  status:     'settings.connector.action.status',
  wayForward: 'settings.connector.action.wayForward',
  update:     'settings.connector.action.update',
  subtask:    'settings.connector.action.subtask',
  archive:    'settings.connector.action.archive',
  restore:    'settings.connector.action.restore',
  delete:     'settings.connector.action.delete',
  timer:      'settings.connector.action.timer',
};

// Lets Claude Desktop (or any app that speaks MCP) see and update the tasks.
// Off until the person downloads the file: the token lives only inside it, so
// downloading IS turning it on, and every new download replaces the last one.
function ConnectorSettings({ T }) {
  const { t, fmtDate } = useLocale();
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  // One click in the app: Clarity opens Claude Desktop's install dialog itself,
  // or, when Windows cannot, shows the file and the one step left in Claude.
  // 'opened' | 'manualFound' | 'manualNotFound' | null
  const [outcome, setOutcome] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmReconnect, setConfirmReconnect] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manual, setManual] = useState(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${API}/connector`);
      if (r.ok) setInfo(await r.json());
    } catch {}
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // Only while connected, and only while this page is mounted: the list of
  // calls is the one thing here that changes on its own.
  const enabled = !!info?.enabled;
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  // Saved but not opened (no handler found by Windows): the manual steps show.
  const INSTALL_OUTCOME = (r) => (r?.opened ? 'opened' : r?.claudeFound ? 'manualFound' : 'manualNotFound');

  async function installInClaude() {
    try {
      const r = await window.clarity.connector.install();
      if (r?.error) setError(true);
      else setOutcome(INSTALL_OUTCOME(r));
    } catch { setError(true); }
    await refresh();
    setBusy(false);
  }

  async function download() {
    setBusy(true); setError(false); setConfirmReconnect(false); setManual(null); setOutcome(null);
    if (window.clarity?.connector) return installInClaude();
    try {
      const r = await fetch(`${API}/connector/bundle`, { method: 'POST' });
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Clarity.mcpb';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch { setError(true); }
    await refresh();
    setBusy(false);
  }

  async function disable() {
    setBusy(true); setError(false); setConfirmReconnect(false);
    try {
      const r = await fetch(`${API}/connector/disable`, { method: 'POST' });
      if (!r.ok) throw new Error();
      setDownloaded(false); setManual(null);
    } catch { setError(true); }
    await refresh();
    setBusy(false);
  }

  async function showManual() {
    setBusy(true); setError(false); setCopied(false);
    try {
      const r = await fetch(`${API}/connector/manual`, { method: 'POST' });
      if (!r.ok) throw new Error();
      setManual(await r.json());
    } catch { setError(true); }
    await refresh();
    setBusy(false);
  }

  async function copyManual() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(manual, null, 2));
      setCopied(true);
    } catch { setError(true); }
  }

  function when(at) {
    const mins = Math.floor((Date.now() - new Date(at).getTime()) / 60000);
    if (!Number.isFinite(mins)) return '';
    if (mins < 1) return t('time.justNow');
    if (mins < 60) return t('time.minutesAgo', { n: mins });
    if (mins < 24 * 60) return t('time.hoursAgo', { n: Math.floor(mins / 60) });
    return fmtDate(at);
  }

  const btn = (primary) => ({
    padding: '7px 14px', borderRadius: T.r6, fontSize: 12.5, fontWeight: 500,
    fontFamily: T.fontUI, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
    background: primary ? T.ink : T.paperSubtle, color: primary ? T.paper : T.ink80,
    border: primary ? 'none' : `1px solid ${T.hairline}`,
  });
  const card = {
    padding: '12px 14px', borderRadius: T.r6, background: T.paperSubtle,
    border: `1px solid ${T.hairlineSoft}`, display: 'flex', flexDirection: 'column', gap: 10,
  };

  if (!info) return <div style={{ fontSize: 12.5, color: T.ink40 }}>{t('settings.checking')}</div>;

  const activity = (info.activity || []).slice(0, 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* What leaves, said before the button that makes it leave. */}
      <div style={{
        padding: '13px 15px', borderRadius: T.r6, background: T.paperSubtle,
        border: `1px solid ${T.warn}`, display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 5, background: T.warn }} />
        <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.55 }}>
          <strong>{t('settings.connector.privacyTitle')}</strong> {t('settings.connector.privacyShared')} {t('settings.connector.privacyKept')} {t('settings.connector.privacyOff')}
        </div>
      </div>

      {!enabled ? (
        <div style={card}>
          {/* Shown before the button: what the click will do, then what to do in Claude. */}
          <ConnectorAnimation />
          <div>
            <button type="button" disabled={busy} onClick={download} style={btn(true)}>
              {busy ? t('settings.connector.preparing') : t('settings.connector.connect')}
            </button>
          </div>
          <div style={{ fontSize: 12, color: T.ink60, lineHeight: 1.5 }}>{t('settings.connector.needsDesktop')}</div>
        </div>
      ) : (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 12, color: T.success, padding: '3px 9px', borderRadius: T.r6,
              background: T.successSoft, border: `1px solid ${T.successBorder}`,
            }}>✓ {info.issuedAt ? t('settings.connector.connectedSince', { date: fmtDate(info.issuedAt) }) : t('settings.connector.connected')}</span>
            <span style={{ flex: 1 }} />
            <button type="button" disabled={busy} onClick={() => setConfirmReconnect(true)} style={btn(false)}>{t('settings.connector.reconnect')}</button>
            <button type="button" disabled={busy} onClick={disable} style={{ ...btn(false), color: T.danger }}>{t('settings.connector.disconnect')}</button>
          </div>
          {confirmReconnect && (
            <div style={{
              padding: '10px 12px', borderRadius: T.r6, background: T.paper,
              border: `1px solid ${T.warn}`, display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5 }}>{t('settings.connector.reconnectWarn')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" disabled={busy} onClick={download} style={btn(true)}>{t('settings.connector.reconnectConfirm')}</button>
                <button type="button" onClick={() => setConfirmReconnect(false)} style={btn(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}
          {info.canWake && (
            <div style={{ fontSize: 12, color: T.ink60, lineHeight: 1.5 }}>{t('settings.connector.canWake')}</div>
          )}
          <div>
            <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
              {t('settings.connector.activity')}
            </div>
            {activity.length === 0 ? (
              <div style={{ fontSize: 12.5, color: T.ink40 }}>{t('settings.connector.noActivity')}</div>
            ) : activity.map((a, i) => (
              <div key={`${a.at}-${i}`} style={{
                display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 0',
                borderBottom: i < activity.length - 1 ? `1px solid ${T.hairlineSoft}` : 'none',
              }}>
                <span style={{ fontSize: 12.5, color: T.ink }}>
                  {CONNECTOR_ACTION_KEY[a.action] ? t(CONNECTOR_ACTION_KEY[a.action]) : t('settings.connector.action.other')}
                </span>
                <span style={{ fontSize: 12, color: T.ink40 }}>· {when(a.at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(outcome === 'manualFound' || outcome === 'manualNotFound') && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>
            {outcome === 'manualFound' ? t('settings.connector.manualTitle') : t('settings.connector.notFoundTitle')}
          </div>
          <div style={{ fontSize: 12.5, color: T.ink80, lineHeight: 1.5 }}>
            {outcome === 'manualFound' ? t('settings.connector.manualBody') : t('settings.connector.notFoundBody')}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => window.clarity?.connector?.showFile()} style={btn(true)}>{t('settings.connector.showFile')}</button>
            {outcome === 'manualFound'
              ? <button type="button" onClick={() => window.clarity?.connector?.openClaude()} style={btn(false)}>{t('settings.connector.openClaude')}</button>
              : <button type="button" onClick={() => window.clarity?.connector?.getClaude()} style={btn(false)}>{t('settings.connector.getClaude')}</button>}
          </div>
          <div style={{ fontSize: 12.5, color: T.ink60, lineHeight: 1.5 }}>{t('settings.connector.openedAsk')}</div>
        </div>
      )}

      {outcome === 'opened' && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>{t('settings.connector.openedTitle')}</div>
          <div style={{ fontSize: 12.5, color: T.ink80, lineHeight: 1.5 }}>{t('settings.connector.openedInstall')}</div>
          <div style={{ fontSize: 12.5, color: T.ink80, lineHeight: 1.5 }}>{t('settings.connector.openedAsk')}</div>
          <div>
            <button type="button" onClick={() => setHelpOpen(o => !o)} style={{
              padding: 0, background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 12.5, color: T.ink60, fontFamily: T.fontUI,
            }}>{helpOpen ? '▾' : '▸'} {t('settings.connector.helpTitle')}</button>
          </div>
          {helpOpen && (
            <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: T.ink80, lineHeight: 1.5 }}>
              <li>{t('settings.connector.help1')}</li>
              <li>{t('settings.connector.help2')}</li>
              <li>{t('settings.connector.help3')}</li>
            </ul>
          )}
        </div>
      )}

      {downloaded && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>{t('settings.connector.stepsTitle')}</div>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: T.ink80, lineHeight: 1.5 }}>
            <li>{t('settings.connector.step1')}</li>
            <li>{t('settings.connector.step2')}</li>
            <li>{t('settings.connector.step3')}</li>
          </ol>
          <div style={{ fontSize: 12.5, color: T.ink60, lineHeight: 1.5 }}>{t('settings.connector.thenAsk')}</div>
        </div>
      )}

      {error && <div style={{ fontSize: 12.5, color: T.danger }}>⚠ {t('settings.connector.error')}</div>}

      <div>
        <button type="button" onClick={() => setAdvancedOpen(o => !o)} style={{
          padding: 0, background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: 12.5, color: T.ink60, fontFamily: T.fontUI,
        }}>{advancedOpen ? '▾' : '▸'} {t('settings.connector.advanced')}</button>
      </div>
      {advancedOpen && (
        <div style={card}>
          <div style={{ fontSize: 12, color: T.ink60, lineHeight: 1.5 }}>{t('settings.connector.advancedHint')}</div>
          {!manual ? (
            <div>
              <button type="button" disabled={busy} onClick={showManual} style={btn(false)}>{t('settings.connector.showManual')}</button>
            </div>
          ) : (
            <>
              <pre style={{
                margin: 0, padding: '12px 14px', maxHeight: 260, overflow: 'auto',
                background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: T.r6,
                fontFamily: T.fontMono, fontSize: 11.5, lineHeight: 1.6, color: T.ink80,
                whiteSpace: 'pre-wrap', wordBreak: 'break-all', userSelect: 'text',
              }}><code>{JSON.stringify(manual, null, 2)}</code></pre>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button type="button" onClick={copyManual} style={btn(false)}>{t('settings.connector.copy')}</button>
                {copied && <span style={{ fontSize: 12, color: T.success }}>✓ {t('settings.connector.copied')}</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// "Start Clarity with Windows": only where Electron says it can do it. Shows
// what the system reports back after each change, never what was asked for.
function StartWithSystem({ T }) {
  const { t } = useLocale();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const li = window.clarity?.loginItem;
    if (!li) return;
    li.get().then(s => { if (!cancelled) setState(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!state?.supported) return null;

  async function change(v) {
    if (busy) return;
    setBusy(true);
    try { setState(await window.clarity.loginItem.set(v)); } catch {}
    setBusy(false);
  }

  return (
    <Section title={t('settings.startup.title')} T={T}>
      <SettingRow label={t('settings.startup.label')} hint={t('settings.startup.hint')} T={T}>
        <Toggle on={!!state.enabled} onChange={change} T={T} label={t('settings.startup.label')} />
      </SettingRow>
      <WakeSummarySetting T={T} />
    </Section>
  );
}

// Settings › Day to day › Planning, saved (src/features.js). These switches
// used to be state of this screen only: saved nowhere, read by nothing, back
// to their defaults at every launch. "Smart area detection" had
// nothing behind it at all and is gone (BACKLOG.md).
function FeatureSettings({ T, onTasksChanged }) {
  const { t } = useLocale();
  const features = useFeatures();
  const [moved, setMoved] = useState(0);
  if (!features) return null;

  async function change(key, v) {
    const answer = await setFeature(key, v);
    if (answer?.rescheduled) { setMoved(answer.rescheduled); onTasksChanged?.(); }
  }

  return (
    <Section title={t('settings.daily.planning')} subtitle={t('settings.daily.planningHint')} T={T}>
      <SettingRow label={t('settings.dailyPlanStrip')} hint={t('settings.showAiGeneratedDailyPlan')} T={T}>
        <Toggle on={features.dailyPlan} onChange={v => change('dailyPlan', v)} T={T} label={t('settings.dailyPlanStrip')} />
      </SettingRow>
      <SettingRow label={t('settings.autoRescheduleStaleTasks')} hint={t('settings.moveOverdueTasksAutomatically')} T={T}>
        <Toggle on={features.autoReschedule} onChange={v => change('autoReschedule', v)} T={T} label={t('settings.autoRescheduleStaleTasks')} />
      </SettingRow>
      {moved > 0 && features.autoReschedule && (
        <div role="status" style={{ fontSize: 12.5, color: T.ink60, padding: '0 14px' }}>{t('settings.rescheduledNow', { count: moved })}</div>
      )}
    </Section>
  );
}

// One saved switch of src/features.js, in a settings row.
function FeatureRow({ k, label, hint, T }) {
  const { t } = useLocale();
  const features = useFeatures();
  if (!features) return null;
  return (
    <SettingRow label={t(label)} hint={t(hint)} T={T}>
      <Toggle on={features[k]} onChange={v => setFeature(k, v)} T={T} label={t(label)} />
    </SettingRow>
  );
}

// Crash reports (backend/src/crash/crash.js): the switch, what it sends, and
// the last reports that left — so "what was sent" is never a matter of trust.
function CrashSettings({ T }) {
  const { t, fmtDateTime } = useLocale();
  const features = useFeatures();
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let live = true;
    fetch(`${API}/crash`).then(r => (r.ok ? r.json() : null)).then(b => { if (live) setInfo(b); }).catch(() => {});
    return () => { live = false; };
  }, [features?.crashReports]);
  if (!info?.available || !features) return null;   // no form configured: nothing could be sent
  return (
    <>
      <SettingRow label={t('settings.crashReports')} hint={t('settings.crashReportsHint')} T={T}>
        <Toggle on={features.crashReports} onChange={v => { setFeature('crashReports', v); setFeature('crashAsked', true); }} T={T} label={t('settings.crashReports')} />
      </SettingRow>
      {info.recent?.length > 0 && (
        <div style={{ padding: '10px 14px', background: T.paperSubtle, borderRadius: T.r6, border: `1px solid ${T.hairlineSoft}` }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: T.ink60, marginBottom: 6 }}>{t('settings.crashRecent')}</div>
          {info.recent.map(r => (
            <div key={r.at + r.message} style={{ fontSize: 12, color: T.ink60, padding: '2px 0', display: 'flex', gap: 10 }}>
              <span style={{ fontFamily: T.fontMono, flexShrink: 0 }}>{fmtDateTime(r.at)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.message}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// "Clear history": the conversations leave the journal for good, after a
// second click that says so.
function ClearChatHistory({ T }) {
  const { t } = useLocale();
  const [phase, setPhase] = useState('idle');   // idle | confirm | done | error
  async function clear() {
    try {
      const r = await fetch(`${API}/chat/history`, { method: 'DELETE' });
      setPhase(r.ok ? 'done' : 'error');
    } catch { setPhase('error'); }
  }
  const btn = { padding: '8px 16px', background: 'transparent', border: `1px solid ${T.hairline}`, borderRadius: T.r6, fontSize: 13, color: T.ink60, cursor: 'pointer', fontFamily: T.fontUI };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      {phase === 'confirm' ? (
        <>
          <button style={{ ...btn, color: T.danger, borderColor: T.dangerBorder }} onClick={clear}>{t('settings.privacy.clearConfirm')}</button>
          <button style={{ ...btn, border: 'none' }} onClick={() => setPhase('idle')}>{t('common.cancel')}</button>
        </>
      ) : (
        <button style={btn} onClick={() => setPhase('confirm')}>{t('settings.privacy.clearHistory')}</button>
      )}
      {phase === 'done' && <span role="status" style={{ fontSize: 12.5, color: T.ink60 }}>{t('settings.privacy.cleared')}</span>}
      {phase === 'error' && <span role="alert" style={{ fontSize: 12.5, color: T.danger }}>{t('settings.privacy.clearFailed')}</span>}
    </div>
  );
}

// Settings › Data › Storage, measured (the screen printed "18.4 MB").
function StorageInfo({ T }) {
  const { t, fmtNumber } = useLocale();
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let live = true;
    fetch(`${API}/storage`).then(r => (r.ok ? r.json() : null)).then(b => { if (live) setInfo(b); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const size = !info ? '—'
    : info.bytes < 1024 * 1024 ? t('settings.sizeKB', { n: fmtNumber(info.bytes / 1024, 0) })
    : t('settings.sizeMB', { n: fmtNumber(info.bytes / (1024 * 1024), 1) });
  return (
    <>
      <SettingRow label={t('settings.dataDirectory')} hint="" T={T}>
        <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink60, wordBreak: 'break-all' }}>{info?.dir || '—'}</span>
      </SettingRow>
      <SettingRow label={t('settings.databaseSize')} hint={t('settings.dataSizeHint')} T={T}>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>{size}</span>
      </SettingRow>
    </>
  );
}

// The card shown when the computer wakes from sleep (WakeCard.jsx): on unless
// turned off, here or from the card's own "Don't show again".
function WakeSummarySetting({ T }) {
  const { t } = useLocale();
  const [on, setOn] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/settings`).then(r => r.json())
      .then(s => { if (!cancelled) setOn(s.wakeSummary !== false); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function change(v) {
    setOn(v);
    try {
      const r = await fetch(`${API}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wakeSummary: v }) });
      if (!r.ok) setOn(!v);
    } catch { setOn(!v); }
  }

  if (on === null) return null;
  return (
    <SettingRow label={t('settings.wake.label')} hint={t('settings.wake.hint')} T={T}>
      <Toggle on={on} onChange={change} T={T} label={t('settings.wake.label')} />
    </SettingRow>
  );
}

function PageHeader({ section: sLabel, title, T }) {
  const { t } = useLocale();
  return (
    <header>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 6 }}>
        {t('settings.pageEyebrow', { section: sLabel })}
      </div>
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500, letterSpacing: '-0.03em', color: T.ink }}>{title}</h1>
    </header>
  );
}

const EXPORT_STATUS_KEY = { not_started: 'status.notStarted', in_progress: 'status.inProgress', done: 'status.done' };

// `t` is passed in: this runs outside any component, and the file is read in
// the interface language like everything else.
async function triggerExport(fmt, t) {
  const statusLabel = s => EXPORT_STATUS_KEY[s] ? t(EXPORT_STATUS_KEY[s]) : s.replace('_', ' ');
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
      content = tasks.map(task => {
        const lines = [`## ${task.title}`];
        if (task.description) lines.push(`\n${task.description}`);
        if (task.deadline) lines.push(`\n**${t('export.doc.due')}** ${task.deadline}`);
        if (task.status) lines.push(`**${t('export.doc.status')}** ${statusLabel(task.status)}`);
        if (task.tags?.length) lines.push(`**${t('export.doc.tags')}** ${task.tags.join(', ')}`);
        if (task.subtasks?.length) {
          lines.push(`\n**${t('export.doc.subtasks')}**`);
          task.subtasks.forEach(s => lines.push(`- [${s.done ? 'x' : ' '}] ${s.title}`));
        }
        return lines.join('\n');
      }).join('\n\n---\n\n');
      filename = 'clarity-export.md';
      mime     = 'text/markdown';
    } else {
      content = tasks.map(task => {
        const lines = [task.title];
        if (task.description) lines.push(task.description);
        if (task.deadline) lines.push(`${t('export.doc.due')} ${task.deadline}`);
        if (task.status) lines.push(`${t('export.doc.status')} ${statusLabel(task.status)}`);
        if (task.tags?.length) lines.push(`${t('export.doc.tags')} ${task.tags.join(', ')}`);
        if (task.subtasks?.length) {
          lines.push(t('export.doc.subtasks'));
          task.subtasks.forEach(s => lines.push(`  [${s.done ? 'x' : ' '}] ${s.title}`));
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

export default function SettingsView({ onSaved, onFeedback = null, initialSection = 'appearance' }) {
  const { T, isDark, themeMode, setThemeMode, accent, setAccent, density, setDensity, font, setFont } = useTheme();
  const { t, locale, setLocale, fmtDate } = useLocale();
  const [form, setForm] = useState({
    providerType: 'ollama',
    llmEndpoint: 'http://localhost:11434',
    ollamaModel: 'gemma4:latest',
    tunnelSecret: '',
    keepAlive: '30m',
    apiKey: '',
    localModel: '',
  });
  const [apiKeySet, setApiKeySet] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [health, setHealth] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState(initialSection);
  const [backups, setBackups] = useState([]);
  const [userName, setUserName] = useState(() => {
    try { return localStorage.getItem('clarity-userName') || ''; } catch { return ''; }
  });


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
            localModel:   s.localModel   || '',
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

  // A finished download switches the backend to the built-in assistant on its
  // own; the form follows, so a later Save does not switch it back.
  const assistant = useAssistant({
    onReady: async () => {
      try {
        const s = await (await fetch(`${API}/settings`)).json();
        setForm(f => ({ ...f, providerType: s.providerType, localModel: s.localModel || '' }));
      } catch {}
      setStatus({ type: 'success', message: t('assistant.ready') });
      onSaved?.();
    },
  });

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
        setStatus({ type: 'error', message: SAVE_ERROR_KEY[err.code] ? t(SAVE_ERROR_KEY[err.code]) : t('settings.saveFailed') });
      }
    } catch {
      setStatus({ type: 'error', message: t('error.backendUnreachable') });
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
  const isLocal = activeProvider === 'local';
  // The backend uses the chosen model, or else the last one installed (by name).
  const installedFiles = (assistant.info?.models || []).filter(m => m.installed).map(m => m.file).sort();
  const localInUse = installedFiles.includes(form.localModel) ? form.localModel : installedFiles.at(-1) || null;
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
                {DENSITIES.map(({ id: opt, key: optKey }) => {
                  const active = density === opt;
                  return (
                    <button key={opt} onClick={() => setDensity(opt)} style={{
                      padding: '6px 14px', borderRadius: 4, fontSize: 12.5,
                      background: active ? T.paper : 'transparent',
                      color: active ? T.ink : T.ink60,
                      fontWeight: active ? 500 : 400,
                      boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                      cursor: 'pointer', fontFamily: T.fontUI, border: 'none',
                    }}>{t(optKey)}</button>
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
                      key={c.nameKey}
                      title={t(c.nameKey)}
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
                  { id: 'system', label: t('settings.font.system'), sample: t('settings.fontSystem') },
                  { id: 'serif',  label: t('settings.font.serif'),  sample: t('settings.fontSerif') },
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

        ) : section === 'daily' ? (
          // What Clarity does with the days, and on this computer. These sat
          // under "AI assistant", where nobody looks for "start with Windows":
          // a setting is looked for by what it changes, not by what runs it.
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <PageHeader section={t('settings.section.daily')} title={t('settings.daily.title')} T={T} />
            <FeatureSettings T={T} onTasksChanged={onSaved} />
            <StartWithSystem T={T} />
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
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: activeProvider === p.id ? T.accentInk : T.ink }}>{p.labelKey ? t(p.labelKey) : p.label}</div>
                      <div style={{ fontSize: 12, color: activeProvider === p.id ? T.accentInk : T.ink60, marginTop: 2, opacity: 0.85 }}>{t(p.hintKey)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Section>

            {isLocal && (
              <Section title={t('assistant.title')} subtitle={t('assistant.hint')} T={T}>
                <AssistantModels assistant={assistant} inUse={localInUse} onUse={file => set('localModel', file)} />
              </Section>
            )}

            {!isLocal && (
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
                  hint={isOllama ? t('settings.ai.ollamaNotConnected') : activeProvider === 'openrouter' ? t('settings.ai.openrouterExample') : ''}
                  T={T}
                >
                  <input
                    value={form.ollamaModel}
                    onChange={e => set('ollamaModel', e.target.value)}
                    placeholder={DEFAULT_MODEL[activeProvider] || t('settings.ai.modelPlaceholder')}
                    style={field}
                  />
                </FieldRow>
              )}
            </Section>
            )}

            {!isOllama && !isLocal && (
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
              <OllamaSetup onReady={async () => {
                try {
                  const s = await (await fetch(`${API}/settings`)).json();
                  setForm(f => ({ ...f, providerType: s.providerType, ollamaModel: s.ollamaModel, llmEndpoint: s.llmEndpoint }));
                  const h = await (await fetch(`${API}/health`)).json();
                  setHealth(h);
                  if (h.availableModels?.length) setOllamaModels(h.availableModels);
                } catch {}
                setStatus({ type: 'success', message: t('ollama.install.done') });
                onSaved?.();
              }} />
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

            <Section title={t('settings.connector.title')} subtitle={t('settings.connector.hint')} T={T}>
              <ConnectorSettings T={T} />
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
              {saving ? t('common.saving') : t('settings.save')}
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
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>{t('settings.none')}</span>
              </SettingRow>
            </Section>

            <Section title={t('settings.capture.parsing')} subtitle={t('settings.capture.parsingHint')} T={T}>
              <FeatureRow k="capturePreview" label="settings.showParsePreview" hint="settings.displayParsedFieldsBelowInput" T={T} />
              <FeatureRow k="captureTags" label="settings.autoAssignArea" hint="settings.detectAndApplyAreaFrom" T={T} />
              <FeatureRow k="captureDuration" label="settings.parseDuration" hint="settings.extractTimeEstimatesFromText" T={T} />
            </Section>

            <Section title={t('settings.capture.after')} T={T}>
              <SettingRow label={t('settings.onSave')} hint={t('settings.whatHappensAfterSaving')} T={T}>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>{t('settings.closeAndReturn')}</span>
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

            <Section title={t('settings.privacy.diagnostics')} T={T}>
              <p style={{ margin: 0, fontSize: 13, color: T.ink60, lineHeight: 1.55 }}>{t('settings.privacy.nothingSent')}</p>
              <CrashSettings T={T} />
            </Section>

            <Section title={t('settings.privacy.conversation')} T={T}>
              <FeatureRow k="convHistory" label="settings.conversationHistory" hint="settings.aiRemembersContextAcrossSessions" T={T} />
              <ClearChatHistory T={T} />
            </Section>
          </div>

        ) : section === 'data' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <PageHeader section={t('settings.section.data')} title={t('settings.section.data')} T={T} />

            <Section title={t('settings.data.storage')} T={T}>
              <StorageInfo T={T} />
            </Section>

            <Section title={t('settings.data.backup')} subtitle={t('settings.data.backupHint')} T={T}>
              <SettingRow label={t('settings.autoBackup')} hint={t('settings.createDailySnapshots')} T={T}>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>{t('settings.alwaysOn')}</span>
              </SettingRow>
              <SettingRow label={t('settings.backupFrequency')} hint="" T={T}>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>{t('form.daily')}</span>
              </SettingRow>
              <SettingRow label={t('settings.keepLast')} hint={t('settings.olderSnapshotsAreRemovedAutomatically')} T={T}>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>{t('settings.nSnapshots', { n: 7 })}</span>
              </SettingRow>
            </Section>

            {backups.length > 0 && (
              <Section title={t('settings.data.backupFiles')} T={T}>
                {backups.map(b => (
                  <div key={b.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '10px 14px', background: T.paperSubtle, borderRadius: T.r6, border: `1px solid ${T.hairlineSoft}` }}>
                    <div>
                      <span style={{ fontSize: 13.5, color: T.ink }}>{fmtDate(b.date + 'T00:00:00', { day: 'numeric', month: 'long', year: 'numeric' }) || b.date}</span>
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
                  onClick={() => triggerExport('json', t)}
                  style={{
                    padding: '9px 18px', background: T.paperSubtle, border: `1px solid ${T.hairline}`,
                    borderRadius: T.r6, fontSize: 13, color: T.ink60, cursor: 'pointer', fontFamily: T.fontUI,
                  }}>JSON</button>
                <button
                  onClick={() => triggerExport('md', t)}
                  style={{
                    padding: '9px 18px', background: T.paperSubtle, border: `1px solid ${T.hairline}`,
                    borderRadius: T.r6, fontSize: 13, color: T.ink60, cursor: 'pointer', fontFamily: T.fontUI,
                  }}>{t('export.markdown')}</button>
                <button
                  onClick={() => triggerExport('txt', t)}
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
                [t('settings.about.version'), health?.version || '—', null],
                [t('settings.data.storage'), t('tray.onDevice'), t('settings.about.storedIn')],
                [t('settings.about.providers'), 'Ollama · OpenAI · Anthropic · OpenRouter', null],
                [t('settings.about.platform'), window.navigator.platform || t('time.unknown'), null],
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

            {onFeedback && (
              <Section title={t('settings.about.feedbackTitle')} subtitle={t('settings.about.feedbackBody')} T={T}>
                <div>
                  <button onClick={onFeedback} style={{
                    padding: '8px 16px', fontSize: 13, fontWeight: 500, fontFamily: T.fontUI,
                    color: T.paper, background: T.ink, border: 'none', borderRadius: T.r6, cursor: 'pointer',
                  }}>{t('feedback.give')}</button>
                </div>
              </Section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
