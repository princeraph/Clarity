import { useState, useEffect } from 'react';
import ApertureMark from './ApertureMark.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useAssistant, AssistantModels, formatSize } from './AssistantSetup.jsx';
import { parseInput } from '../lib/saisie.js';

const API = 'http://localhost:3001/api';

const SCREENS = [
  { key: 'welcome', footKey: 'onboarding.foot.welcome', ctaKey: 'onboarding.cta.start' },
  { key: 'local',   footKey: 'onboarding.foot.local',   ctaKey: 'onboarding.cta.continue' },
  { key: 'capture', footKey: 'onboarding.foot.capture', ctaKey: 'onboarding.cta.save' },
];

// Thin line trace in the header — the design uses growing dashes, not dots.
function LineTrace({ current, T }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: i === current ? 22 : 6, height: 2, borderRadius: 2,
          background: i === current ? T.ink : T.ink20,
          transition: 'all 200ms',
        }} />
      ))}
    </div>
  );
}

function SpecRow({ label, value, done, T }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 12px', background: T.paper, borderRadius: T.r6,
      border: `1px solid ${T.hairlineSoft}`,
    }}>
      <span style={{ color: T.ink60, fontSize: 13.5 }}>{label}</span>
      <span style={{
        fontFamily: T.fontMono, fontSize: 12.5, color: done ? T.done : T.ink,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {done && <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.done }} />}
        {value}
      </span>
    </div>
  );
}

function Pill({ label, value, subtle, T }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 9px', background: T.paper,
      border: `1px solid ${T.hairline}`, borderRadius: T.rPill,
      fontSize: 12, color: subtle ? T.ink60 : T.ink,
    }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink40 }}>{label}</span>
      <span>{value}</span>
    </span>
  );
}

function Cta({ label, onClick, disabled, T }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: T.fontUI, fontSize: 14, fontWeight: 500,
        color: T.paper, background: T.ink,
        border: 'none', padding: '11px 22px', borderRadius: T.r6,
        cursor: disabled ? 'not-allowed' : 'pointer', letterSpacing: '-0.005em',
        opacity: disabled ? 0.7 : 1,
      }}
    >{label}</button>
  );
}

// Saves one line of the first screen as a task, understood the way the quick
// capture understands it (lib/saisie.js). Returns the task, or null.
async function addTask(text) {
  const p = parseInput(text);
  if (!p.title.trim()) return null;
  try {
    const r = await fetch(`${API}/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: p.title, tags: p.tags, deadline: p.deadline || null, estimatedDuration: p.estimatedDuration || null }),
    });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// The last screen. It used to be a picture of a capture box — "Try it now",
// then "Save", and nothing was saved: the person landed on an empty Today.
// Now it is the real thing, and what is typed here is what Clarity starts from.
function FirstCapture({ T, t, added, setAdded, draft, setDraft, cta }) {
  const { fmtDate, fmtDuration, fmtHours } = useLocale();
  const [failed, setFailed] = useState(false);
  const p = parseInput(draft);
  const understood = p.tags.length > 0 || p.deadline || p.estimatedDuration;

  async function add() {
    if (!draft.trim()) return;
    const task = await addTask(draft);
    if (!task) { setFailed(true); return; }
    setFailed(false);
    setAdded(list => [...list, task.task || task]);
    setDraft('');
  }

  return (
    <div style={{ width: '100%', maxWidth: 600 }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 12, textAlign: 'center' }}>{t('onboarding.tryItNow')}</div>
      <h2 style={{ margin: '0 0 10px', fontSize: 28, fontWeight: 500, letterSpacing: '-0.03em', textAlign: 'center', lineHeight: 1.15 }}>
        {t('onboarding.captureTitle')}
      </h2>
      <p style={{ margin: '0 auto 24px', maxWidth: 480, textAlign: 'center', fontSize: 14, color: T.ink60, lineHeight: 1.5 }}>{t('onboarding.captureHelp')}</p>
      <div style={{
        background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 14,
        boxShadow: '0 24px 60px -20px rgba(25,25,26,0.18)', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, boxShadow: `0 0 0 4px ${T.accentSoft}`, flexShrink: 0 }} />
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder={t('onboarding.sample.input')}
            aria-label={t('onboarding.captureTitle')}
            style={{ flex: 1, fontSize: 18, color: T.ink, letterSpacing: '-0.01em', border: 'none', outline: 'none', background: 'transparent', fontFamily: T.fontUI }}
          />
          <button onClick={add} disabled={!draft.trim()} style={{
            fontFamily: T.fontUI, fontSize: 12.5, padding: '6px 12px', borderRadius: T.r6, cursor: draft.trim() ? 'pointer' : 'default',
            border: `1px solid ${T.hairline}`, background: T.paperSubtle, color: draft.trim() ? T.ink : T.ink40,
          }}>{t('onboarding.add')}</button>
        </div>
        {understood && (
          <div style={{ padding: '10px 22px', borderTop: `1px solid ${T.hairlineSoft}`, background: T.paperSubtle, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink40, marginRight: 4 }}>{t('onboarding.parsed')}</span>
            {p.deadline && <Pill label={t('onboarding.when')} value={fmtDate(p.deadline + 'T00:00:00', { weekday: 'long', day: 'numeric', month: 'long' })} T={T} />}
            {p.tags.map(tag => <Pill key={tag} label={t('capture.area')} value={tag} T={T} />)}
            {p.estimatedDuration && <Pill label={t('onboarding.duration')} value={p.estimatedDuration >= 60 ? fmtHours(p.estimatedDuration) : fmtDuration(p.estimatedDuration)} T={T} />}
          </div>
        )}
        {added.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: '8px 22px 12px', borderTop: `1px solid ${T.hairlineSoft}` }}>
            {added.map(task => (
              <li key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 14, color: T.ink80 }}>
                <span aria-hidden="true" style={{ color: T.done }}>✓</span>
                <span style={{ flex: 1 }}>{task.title}</span>
                {task.deadline && <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink40 }}>{fmtDate(task.deadline + 'T00:00:00')}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {failed && <div role="alert" style={{ marginTop: 10, fontSize: 13, color: T.danger, textAlign: 'center' }}>{t('onboarding.addFailed')}</div>}
      <div style={{ textAlign: 'center', marginTop: 28 }}>
        {cta}
        <div style={{ marginTop: 10, fontFamily: T.fontMono, fontSize: 11, color: T.ink40 }}>
          {t('onboarding.captureHint')}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingView({ onComplete }) {
  const { t, locale } = useLocale();
  const { T } = useTheme();
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [added, setAdded] = useState([]);    // tasks saved on the last screen
  const [draft, setDraft] = useState('');
  // This screen used to announce "llama-3 8b · 4.2 GB" on every machine,
  // installed or not. It now says what is there, and offers the download when
  // nothing is — which can run while the person carries on.
  const [health, setHealth] = useState(null);
  const refreshHealth = () => fetch(`${API}/health`).then(r => r.json()).then(setHealth).catch(() => {});
  useEffect(() => { refreshHealth(); }, []);
  const assistant = useAssistant({ onReady: refreshHealth });
  const ready = !!health?.ollama;
  const recommended = assistant.info?.models.find(m => m.id === assistant.info.recommended);
  const installed = assistant.info?.models.filter(m => m.installed).at(-1);
  const shownModel = installed || recommended;

  async function finish() {
    setCompleting(true);
    // A line typed but not yet added is what the person meant to keep.
    if (draft.trim()) await addTask(draft);
    try {
      await fetch(`${API}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingComplete: true }),
      });
    } catch {}
    onComplete();
  }

  const isLast = step === SCREENS.length - 1;
  const s = SCREENS[step];
  const advance = isLast ? finish : () => setStep(n => n + 1);
  const ctaLabel = isLast && completing ? t('onboarding.opening')
    : isLast ? t(added.length || draft.trim() ? 'onboarding.cta.open' : 'onboarding.cta.skip')
    : t(s.ctaKey);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: T.paper, color: T.ink, fontFamily: T.fontUI,
      display: 'grid', gridTemplateRows: 'auto 1fr auto',
      padding: '40px 56px', boxSizing: 'border-box',
    }}>
      {/* Header: mark + line trace */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ApertureMark s={20} />
          <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em' }}>clarity</span>
        </div>
        <LineTrace current={step} T={T} />
      </header>

      {/* Center: screen content */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div key={step} style={{ animation: 'fadeUp 0.22s ease-out', width: '100%', display: 'flex', justifyContent: 'center' }}>

          {step === 0 && (
            <div style={{ textAlign: 'center', maxWidth: 460 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
                <ApertureMark s={88} />
              </div>
              <h1 style={{ margin: 0, fontSize: 44, fontWeight: 500, letterSpacing: '-0.04em', color: T.ink, lineHeight: 1.05 }}>
                {t('onboarding.headline')}
              </h1>
              <p style={{ margin: '20px 0 36px', fontSize: 15.5, color: T.ink60, lineHeight: 1.55 }}>
                {t('onboarding.welcomeBody')}
              </p>
              <Cta label={ctaLabel} onClick={advance} disabled={completing} T={T} />
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center', maxWidth: 920, width: '100%' }}>
              <div>
                <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 12 }}>{t('onboarding.onYourMachine')}</div>
                <h2 style={{ margin: 0, fontSize: 34, fontWeight: 500, letterSpacing: '-0.035em', lineHeight: 1.1 }}>
                  {t('onboarding.localTitle')}
                </h2>
                <p style={{ margin: '18px 0 28px', fontSize: 15, color: T.ink80, lineHeight: 1.55 }}>
                  {t('onboarding.localBody')}
                </p>
                <Cta label={ctaLabel} onClick={advance} disabled={completing} T={T} />
              </div>
              <div style={{
                background: T.paperSubtle, borderRadius: T.r14, padding: 28,
                border: `1px solid ${T.hairline}`,
                display: 'flex', flexDirection: 'column', gap: 18,
              }}>
                <div style={{
                  display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8,
                  padding: '6px 12px', background: T.paper,
                  border: `1px solid ${T.hairline}`, borderRadius: T.rPill,
                  fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.10em',
                  textTransform: 'uppercase', color: T.ink60,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.done }} />
                  {t('onboarding.onDeviceModel', { model: ready ? health.model : t('onboarding.modelPending') })}
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <SpecRow label={t('onboarding.storage')}       value="%APPDATA%\Clarity" T={T} />
                  {shownModel && <SpecRow label={t('onboarding.modelSize')} value={formatSize(shownModel.size, locale)} T={T} />}
                  <SpecRow label={t('onboarding.networkCalls')} value="0" done T={T} />
                  <SpecRow label={t('onboarding.cloudSync')}    value={t('onboarding.off')} T={T} />
                </div>
                {health && !ready && recommended && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <p style={{ margin: 0, fontSize: 13, color: T.ink80, lineHeight: 1.5 }}>{t('onboarding.assistantOffer')}</p>
                    <AssistantModels assistant={assistant} only={recommended.id} />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <FirstCapture T={T} t={t} added={added} setAdded={setAdded} draft={draft} setDraft={setDraft}
              cta={<Cta label={ctaLabel} onClick={advance} disabled={completing} T={T} />} />
          )}

        </div>
      </div>

      {/* Footer: step label + counter */}
      <footer style={{
        fontFamily: T.fontMono, fontSize: 10.5, letterSpacing: '0.10em',
        textTransform: 'uppercase', color: T.ink40,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{t(s.footKey)}</span>
        <span>{step + 1} / {SCREENS.length}</span>
      </footer>
    </div>
  );
}
