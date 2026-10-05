import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';

const API = 'http://localhost:3001/api';

// Mirrors MIN_SAMPLES in backend/src/profile/metrics.js. The backend already
// sends `enough` per metric — this is only used to phrase how far off a metric is.
const MIN_SAMPLES = 5;

function pct(n) { return `${Math.round(n * 100)}%`; }

function hourLabel(h) {
  if (h === null || h === undefined) return '—';
  return `${String(h).padStart(2, '0')}:00`;
}

// Indexed like Date#getDay(), 0 = Sunday. 4 January 2026 is a Sunday; the
// names themselves come from the locale.
const WEEK_FROM_SUNDAY = Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 4 + i));

// A finding worked out from measurements is stored with an English sentence —
// that sentence is also what a model is told, so the backend keeps it. The
// interface rebuilds it from the stable key and the same measurements, and
// falls back to the stored sentence only when it cannot (a model's suggestion
// you accepted, or a finding whose numbers have since gone).
function insightText(insight, o, t, fmtNumber) {
  const key = insight.key || '';
  const est = o?.estimation;
  if (key === 'observed:estimation:overall' && est?.medianRatio != null) {
    const which = { under: 'insight.estimation.under', accurate: 'insight.estimation.accurate', over: 'insight.estimation.over' }[est.bias];
    if (which) return t(which, { ratio: fmtNumber(est.medianRatio, 2) });
  }
  if (key.startsWith('observed:estimation:area:')) {
    const area = key.slice('observed:estimation:area:'.length);
    const v = est?.byArea?.[area];
    if (v?.medianRatio != null) return t('insight.estimation.area', { area, ratio: fmtNumber(v.medianRatio, 2) });
  }
  if (key.startsWith('observed:slippage:task:')) {
    const id = key.slice('observed:slippage:task:'.length);
    const c = (o?.slippage?.chronic || []).find(x => String(x.taskId) === id);
    if (c) return t('insight.slippage', { title: c.title, n: c.slips, days: c.totalDays });
  }
  if (key === 'observed:latency:overall' && o?.latency?.medianDaysToStart != null) {
    return t('insight.latency', { days: fmtNumber(o.latency.medianDaysToStart) });
  }
  if (key.startsWith('observed:abandonment:area:')) {
    const area = key.slice('observed:abandonment:area:'.length);
    const v = o?.abandonment?.rateByArea?.[area];
    if (v?.rate != null) return t('insight.abandonment', { area, pct: Math.round(v.rate * 100) });
  }
  if (key === 'observed:rhythm:peak' && o?.rhythm?.peakHour != null) {
    return t('insight.rhythm', { hour: String(o.rhythm.peakHour).padStart(2, '0') });
  }
  return insight.statement;
}

// ── Shared shells ─────────────────────────────────────────────────────────────

function Section({ title, note, children, T }) {
  return (
    <section style={{ marginBottom: 34 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.ink, letterSpacing: '-0.01em' }}>{title}</h2>
        {note && <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40 }}>{note}</span>}
      </div>
      {children}
    </section>
  );
}

// The component that keeps the whole panel honest: below the sample threshold a
// metric is shown as a count, never as a conclusion.
function NotEnough({ samples, what, T }) {
  const { t } = useLocale();
  return (
    <div style={{
      padding: '13px 15px', background: T.paperSubtle,
      border: `1px dashed ${T.hairline}`, borderRadius: T.r6,
      fontSize: 12.5, color: T.ink60, lineHeight: 1.5,
    }}>
      {t('patterns.notEnough', { what, samples, needed: MIN_SAMPLES })}
    </div>
  );
}

function Finding({ children, tone = 'neutral', samples, T }) {
  const { t } = useLocale();
  const accent = tone === 'warn' ? T.warn : tone === 'good' ? T.done : T.accent;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '3px 1fr', gap: 13,
      background: T.paperSubtle, border: `1px solid ${T.hairline}`,
      borderRadius: T.r6, overflow: 'hidden', marginBottom: 8,
    }}>
      <div style={{ background: accent }} />
      <div style={{ padding: '13px 15px 13px 0' }}>
        <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5 }}>{children}</div>
        {samples !== undefined && (
          <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40, marginTop: 5 }}>
            {t('patterns.fromNTasks', { n: samples })}
          </div>
        )}
      </div>
    </div>
  );
}

function Bar({ value, max, color, T }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: T.hairlineSoft, borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 3 }} />
    </div>
  );
}


// A belief, with the evidence behind it and the two verdicts that matter.
// Showing the basis is the point: a conclusion you cannot check is one you have
// to take on faith, which is exactly what this layer must not ask for.
function InsightCard({ insight, observed, onReject, onConfirm, busy, T }) {
  const { t, fmtNumber } = useLocale();
  const [showWhy, setShowWhy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const stale = insight.status === 'stale';

  return (
    <div style={{
      border: `1px solid ${T.hairline}`, borderRadius: T.r6,
      background: T.paperSubtle, padding: '13px 15px',
      display: 'flex', flexDirection: 'column', gap: 9,
      opacity: stale ? 0.62 : 1,
    }}>
      <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5 }}>{insightText(insight, observed, t, fmtNumber)}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40 }}>
          {t('patterns.confident', { pct: Math.round(insight.confidence * 100) })}
          {insight.source === 'elicited' && ` · ${t('patterns.youConfirmed')}`}
          {stale && ` · ${t('patterns.noLongerSupported')}`}
        </span>
        <button onClick={() => setShowWhy(w => !w)} style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontFamily: T.fontUI, fontSize: 11.5, color: T.accentInk, textDecoration: 'underline',
        }}>{showWhy ? t('patterns.hideBasis') : t('patterns.whyThink')}</button>
      </div>

      {showWhy && (
        <div style={{
          background: T.paper, border: `1px solid ${T.hairlineSoft}`, borderRadius: T.r6,
          padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {insight.evidence.map((e, i) => (
            <div key={i} style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink60, wordBreak: 'break-word' }}>
              {e.kind} · {e.ref}{e.note ? ` — ${e.note}` : ''}
            </div>
          ))}
        </div>
      )}

      {rejecting ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <input
            id={`reject-reason-${insight.id}`}
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder={t('patterns.rejectReasonPlaceholder')}
            style={{
              padding: '7px 10px', background: T.paper, border: `1px solid ${T.hairline}`,
              borderRadius: T.r6, fontSize: 12.5, color: T.ink, fontFamily: T.fontUI, outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 7 }}>
            <button disabled={busy} onClick={() => { onReject(insight, reason.trim() || null); setRejecting(false); }} style={{
              padding: '6px 12px', background: T.dangerSoft, color: T.danger,
              border: `1px solid ${T.dangerBorder}`, borderRadius: T.r6,
              fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer',
            }}>{t('patterns.rejectThis')}</button>
            <button onClick={() => setRejecting(false)} style={{
              padding: '6px 12px', background: 'transparent', color: T.ink60,
              border: `1px solid ${T.hairline}`, borderRadius: T.r6,
              fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer',
            }}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 7 }}>
          <button disabled={busy} onClick={() => setRejecting(true)} style={{
            padding: '5px 11px', background: 'transparent', color: T.ink60,
            border: `1px solid ${T.hairline}`, borderRadius: T.r6,
            fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer',
          }}>{t('patterns.thatsWrong')}</button>
          {stale && (
            <button disabled={busy} onClick={() => onConfirm(insight)} style={{
              padding: '5px 11px', background: 'transparent', color: T.ink60,
              border: `1px solid ${T.hairline}`, borderRadius: T.r6,
              fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer',
            }}>{t('patterns.stillTrue')}</button>
          )}
        </div>
      )}
    </div>
  );
}



// A proposal is not a finding, and must not look like one. Findings on this
// page are arithmetic; this is a model's guess about a person, which is a
// different kind of claim and carries a different kind of wrongness. Hence the
// dashed edge, the lower confidence ceiling, and the fact that it asks rather
// than states.
function ProposalCard({ proposal, onAccept, onDecline, busy, T }) {
  const { t } = useLocale();
  const [showWhy, setShowWhy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <div style={{
      border: `1px dashed ${T.accent}`, borderRadius: T.r6,
      background: T.paperSubtle, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5 }}>{proposal.statement}</div>

      {proposal.rationale && (
        <div style={{ fontSize: 12.5, color: T.ink60, lineHeight: 1.5, fontStyle: 'italic' }}>
          {proposal.rationale}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40 }}>
          {t('patterns.suggested')} · {Math.round(proposal.confidence * 100)}% · {t(`patterns.category.${proposal.category}`)}
        </span>
        <button onClick={() => setShowWhy(w => !w)} style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontFamily: T.fontUI, fontSize: 11.5, color: T.accentInk, textDecoration: 'underline',
        }}>{showWhy ? t('patterns.hideLookedAt') : t('patterns.whatLookedAt')}</button>
      </div>

      {showWhy && (
        <div style={{
          background: T.paper, border: `1px solid ${T.hairlineSoft}`, borderRadius: T.r6,
          padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {proposal.evidence.map((e, i) => (
            <div key={i} style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink60, wordBreak: 'break-word' }}>
              {e.kind} · {e.ref}{e.note ? ` \u2014 ${e.note}` : ''}
            </div>
          ))}
        </div>
      )}

      {declining ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <input
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder={t('patterns.declineReasonPlaceholder')}
            style={{
              padding: '7px 10px', background: T.paper, border: `1px solid ${T.hairline}`,
              borderRadius: T.r6, fontSize: 12.5, color: T.ink, fontFamily: T.fontUI, outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 7 }}>
            <button disabled={busy} onClick={() => { onDecline(proposal, reason.trim() || null); setDeclining(false); }} style={{
              padding: '6px 12px', background: T.dangerSoft, color: T.danger,
              border: `1px solid ${T.dangerBorder}`, borderRadius: T.r6,
              fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer',
            }}>{t('patterns.discard')}</button>
            <button onClick={() => setDeclining(false)} style={{
              padding: '6px 12px', background: 'transparent', color: T.ink60,
              border: `1px solid ${T.hairline}`, borderRadius: T.r6,
              fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer',
            }}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 7 }}>
          <button disabled={busy} onClick={() => onAccept(proposal)} style={{
            padding: '6px 13px', background: T.accentSoft, color: T.accentInk,
            border: `1px solid ${T.accent}`, borderRadius: T.r6,
            fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer', fontWeight: 500,
          }}>{t('patterns.thatsRight')}</button>
          <button disabled={busy} onClick={() => setDeclining(true)} style={{
            padding: '6px 13px', background: 'transparent', color: T.ink60,
            border: `1px solid ${T.hairline}`, borderRadius: T.r6,
            fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer',
          }}>{t('patterns.notRight')}</button>
        </div>
      )}
    </div>
  );
}

// The way to a first finding, shown until there is one. Estimation is the
// metric the profile leads with, and a new user used to see a bare "0 of 5"
// with no idea which of their tasks were close. Now: how far along, which open
// tasks need only a timer to count, and — counted, never offered as a to-do —
// how many timed tasks lack an estimate, since one added afterwards would bias
// the result toward "you estimate well".
function EstimationProgress({ est, T }) {
  const { t } = useLocale();
  const n = Math.min(est.samples, MIN_SAMPLES);
  const p = est.pending || { notTimedCount: 0, notTimed: [], notEstimatedCount: 0 };
  return (
    <div style={{
      padding: '15px 16px', background: T.paperSubtle,
      border: `1px solid ${T.hairline}`, borderRadius: T.r6,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 24, fontWeight: 500, color: T.ink, lineHeight: 1 }}>
          {t('patterns.progress.count', { n, needed: MIN_SAMPLES })}
        </span>
        <span style={{ fontSize: 12.5, color: T.ink60 }}>{t('patterns.progress.unit')}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${MIN_SAMPLES}, 1fr)`, gap: 4 }}
           role="img" aria-label={t('patterns.progress.count', { n, needed: MIN_SAMPLES })}>
        {Array.from({ length: MIN_SAMPLES }, (_, i) => (
          <div key={i} style={{ height: 6, borderRadius: 3, background: i < n ? T.accent : T.hairline }} />
        ))}
      </div>
      <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.55 }}>
        {t('patterns.progress.why', { needed: MIN_SAMPLES })}
      </div>
      {p.notTimedCount > 0 && (
        <div>
          <div style={{ fontSize: 12.5, color: T.ink80, marginBottom: 6 }}>{t('patterns.progress.closest')}</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {p.notTimed.map(x => (
              <li key={x.taskId} style={{ fontSize: 12.5, color: T.ink60, lineHeight: 1.45 }}>{x.title}</li>
            ))}
          </ul>
          {p.notTimedCount > p.notTimed.length && (
            <div style={{ fontSize: 11.5, color: T.ink40, marginTop: 4 }}>
              {t('patterns.progress.andMore', { n: p.notTimedCount - p.notTimed.length })}
            </div>
          )}
        </div>
      )}
      {/* "For the rest" only reads right under a list; without one it pointed at nothing. */}
      <div style={{ fontSize: 12.5, color: T.ink60, lineHeight: 1.55 }}>
        {t(p.notTimedCount > 0 ? 'patterns.progress.how' : 'patterns.progress.howFirst')}
      </div>
      {p.notEstimatedCount > 0 && (
        <div style={{ fontSize: 11.5, color: T.ink40, lineHeight: 1.55 }}>
          {t('patterns.progress.timedOnly', { n: p.notEstimatedCount })}
        </div>
      )}
    </div>
  );
}

// When nothing is measurable yet, five identical "not enough" boxes read as a
// broken page. Say it once, and say what would change it — the metrics depend
// on things the app records as you use it, not on waiting.
function NothingYet({ o, T }) {
  const { t } = useLocale();
  const rows = [
    { on: o.rhythm.samples > 0,      what: t('patterns.nothing.rhythm'),   needs: t('patterns.nothing.rhythmHow') },
    { on: o.latency.samples > 0,     what: t('patterns.nothing.latency'),  needs: t('patterns.nothing.latencyHow') },
    { on: o.slippage.totalSlips > 0, what: t('patterns.nothing.slippage'), needs: t('patterns.nothing.slippageHow') },
  ];
  // The count is computed, never written into the sentence: it said "four of
  // five" in words, and went on saying it after one of the four moved out.
  const waiting = rows.filter(r => !r.on);
  return (
    <Section title={t('patterns.notMeasurable')} note={t('patterns.notMeasurableNote', { n: waiting.length })} T={T}>
      <div style={{
        padding: '14px 16px', background: T.paperSubtle,
        border: `1px solid ${T.hairline}`, borderRadius: T.r6,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.55 }}>
          {t('patterns.nothing.body')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {waiting.map(r => (
            <div key={r.what} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12, alignItems: 'baseline' }}>
              <span style={{ fontSize: 12.5, color: T.ink80 }}>{r.what}</span>
              <span style={{ fontSize: 12.5, color: T.ink60, lineHeight: 1.5 }}>{r.needs}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function PatternsView() {
  const { T } = useTheme();
  const { t, fmtDateTime, fmtDate, fmtHours } = useLocale();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [eliciting, setEliciting] = useState(false);
  const [elicitNote, setElicitNote] = useState(null);

  async function load() {
    try {
      const resp = await fetch(`${API}/profile`);
      if (!resp.ok) throw new Error(t('patterns.couldNotLoad'));
      setProfile(await resp.json());
      setError(null);
    } catch {
      setError(t('error.backendUnreachable'));
    }
  }

  async function recompute() {
    setBusy(true);
    try {
      const resp = await fetch(`${API}/profile/recompute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (resp.ok) { setProfile(await resp.json()); setError(null); }
    } catch {
      setError(t('error.backendUnreachable'));
    } finally { setBusy(false); }
  }

  async function judge(insight, verdict, reason) {
    setBusy(true);
    try {
      await fetch(`${API}/profile/insights/${insight.id}/${verdict}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      await load();
    } catch {
      setError(t('error.backendUnreachable'));
    } finally { setBusy(false); }
  }

  async function loadProposals() {
    try {
      const resp = await fetch(`${API}/profile/proposals`);
      if (resp.ok) setProposals((await resp.json()).proposals || []);
    } catch { /* the page still works without them */ }
  }

  // Ask the model to look. It cannot write anything: whatever comes back lands
  // in the pending queue, and only a click moves it into the profile.
  async function elicit() {
    setEliciting(true);
    setElicitNote(null);
    try {
      const resp = await fetch(`${API}/profile/elicit`, { method: 'POST' });
      const body = await resp.json().catch(() => ({}));
      // The backend's sentences are English. 409 is its one deliberate refusal
      // (no local model); anything else is "could not run".
      if (!resp.ok) { setElicitNote(resp.status === 409 ? t('patterns.needsLocal') : t('patterns.cannotRun')); return; }
      setProposals(body.pending || []);
      if (!body.added?.length) {
        // Silence has several causes and they are not interchangeable — a model
        // that found nothing is not the same as one whose every citation failed.
        const why = (body.noteCode === 'nothing-citable' ? t('patterns.nothingToWorkFrom') : body.note)
          || (body.refused?.length ? t('patterns.unsupported')
          : body.skipped?.length ? t('patterns.nothingNew')
          : t('patterns.foundNothing'));
        setElicitNote(why);
      }
    } catch {
      setElicitNote(t('error.backendUnreachable'));
    } finally { setEliciting(false); }
  }

  async function judgeProposal(proposal, verdict, reason) {
    setBusy(true);
    try {
      const resp = await fetch(`${API}/profile/proposals/${proposal.id}/${verdict}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (resp.ok) setProposals((await resp.json()).pending || []);
      await load();
    } catch {
      setError(t('error.backendUnreachable'));
    } finally { setBusy(false); }
  }

  useEffect(() => { load(); loadProposals(); }, []);

  const o = profile?.observed;

  // Active first, then stale. Rejected insights are kept on disk but never
  // shown again — the point of rejecting one is not to see it.
  const insights = useMemo(() => {
    const all = Object.values(profile?.understanding || {}).flat().filter(Boolean);
    const rank = { active: 0, stale: 1 };
    return all
      .filter(i => i.status === 'active' || i.status === 'stale')
      .sort((a, b) => (rank[a.status] - rank[b.status]) || (b.confidence - a.confidence));
  }, [profile]);

  // Areas worth showing: those with a real sample behind them, worst first.
  const estimationAreas = useMemo(() => {
    if (!o?.estimation?.byArea) return [];
    return Object.entries(o.estimation.byArea)
      .map(([area, v]) => ({ area, ...v }))
      .sort((a, b) => (b.medianRatio ?? 0) - (a.medianRatio ?? 0));
  }, [o]);

  const abandonAreas = useMemo(() => {
    if (!o?.abandonment?.rateByArea) return [];
    return Object.entries(o.abandonment.rateByArea)
      .map(([area, v]) => ({ area, ...v }))
      .filter(v => v.abandoned > 0)
      .sort((a, b) => b.rate - a.rate);
  }, [o]);

  const wrap = { height: '100%', overflowY: 'auto', padding: '36px 56px', fontFamily: T.fontUI, boxSizing: 'border-box' };

  if (error && !profile) {
    return <div style={wrap}><div style={{ color: T.ink60, fontSize: 13.5 }}>{error}</div></div>;
  }
  if (!o) {
    return <div style={wrap}><div style={{ color: T.ink40, fontSize: 13.5 }}>{t('patterns.loading')}</div></div>;
  }

  // Nothing the app itself recorded. Tasks may exist, but none carry a timing,
  // a status change or a rescheduling — the three things every metric below reads.
  const nothingRecorded =
    o.estimation.samples === 0 && o.latency.samples === 0 &&
    o.rhythm.samples === 0 && o.slippage.totalSlips === 0;

  const maxHour = Math.max(...o.rhythm.hours, 1);
  const maxWeekday = Math.max(...o.rhythm.weekdays, 1);

  return (
    <div style={wrap}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 8 }}>
          {t('patterns.fromNTasks', { n: o.tasksConsidered })} · {o.windowDays > 0 ? t('patterns.lastNDays', { n: o.windowDays }) : t('patterns.allHistory')}
        </div>
        <h1 style={{ margin: 0, fontSize: 38, fontWeight: 500, letterSpacing: '-0.035em', color: T.ink }}>{t('nav.patterns')}</h1>
        <p style={{ margin: '10px 0 0', fontSize: 13.5, color: T.ink60, maxWidth: '62ch', lineHeight: 1.6 }}>
          {t('patterns.intro')}
        </p>
        {o.windowFellBack && (
          <p style={{
            margin: '12px 0 0', fontSize: 12.5, color: T.ink60, lineHeight: 1.55,
            padding: '10px 13px', background: T.paperSubtle,
            border: `1px solid ${T.hairline}`, borderRadius: T.r6, maxWidth: '62ch',
          }}>
            {t('patterns.windowFellBack', { n: o.windowDaysRequested })}
          </p>
        )}
      </div>

      {/* ── The way to a first finding, until there is one. First on the page:
             for a new user it is the only thing here they can act on today. ── */}
      {!o.estimation.enough && (
        <Section title={t('patterns.progress.title')} T={T}>
          <EstimationProgress est={o.estimation} T={T} />
        </Section>
      )}

      <Section
        title={t('patterns.askSection')}
        note={proposals.length ? t('patterns.nWaiting', { n: proposals.length }) : t('patterns.askingNotTelling')}
        T={T}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {proposals.map(p => (
            <ProposalCard
              key={p.id} proposal={p} busy={busy} T={T}
              onAccept={pr => judgeProposal(pr, 'accept')}
              onDecline={(pr, reason) => judgeProposal(pr, 'decline', reason)}
            />
          ))}

          {!proposals.length && (
            <div style={{
              padding: '13px 15px', background: T.paperSubtle,
              border: `1px dashed ${T.hairline}`, borderRadius: T.r6,
              fontSize: 12.5, color: T.ink60, lineHeight: 1.55,
            }}>
              {t('patterns.askEmpty')}
            </div>
          )}

          {elicitNote && (
            <div style={{
              padding: '11px 14px', background: T.paperMuted,
              border: `1px solid ${T.hairline}`, borderRadius: T.r6,
              fontSize: 12.5, color: T.ink60, lineHeight: 1.55,
            }}>{elicitNote}</div>
          )}

          <div>
            <button onClick={elicit} disabled={eliciting} style={{
              padding: '7px 14px', background: 'transparent',
              border: `1px solid ${T.hairline}`, borderRadius: T.r6,
              fontSize: 12.5, color: eliciting ? T.ink40 : T.ink,
              fontFamily: T.fontUI, cursor: eliciting ? 'default' : 'pointer',
            }}>{eliciting ? t('thread.thinking') : t('patterns.askClarity')}</button>
            <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40, marginTop: 6 }}>
              {t('patterns.localOnly')}
            </div>
          </div>
        </div>
      </Section>

      {insights.length > 0 && (
        <Section
          title={t('patterns.conclusions')}
          note={t('patterns.conclusionsNote', { n: insights.length })}
          T={T}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {insights.map(i => (
              <InsightCard key={i.id} insight={i} observed={o} busy={busy} T={T}
                onReject={(ins, reason) => judge(ins, 'reject', reason)}
                onConfirm={(ins) => judge(ins, 'confirm')} />
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: T.ink40, marginTop: 10, lineHeight: 1.55 }}>
            {t('patterns.conclusionsFooter')}
          </p>
        </Section>
      )}

      {/* ── Load: the only thing about right now ── */}
      <Section title={t('patterns.rightNow')} T={T}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10 }}>
          {[
            { k: t('patterns.open'), v: o.load.openTasks },
            { k: t('patterns.dueThisWeek'), v: o.load.dueNext7Days },
            { k: t('patterns.overdue'), v: o.load.overdue, tone: o.load.overdue > 0 ? T.danger : null },
            { k: t('patterns.plannedThisWeek'), v: fmtHours(Math.round(o.load.committedMinutes / 60) * 60) },
          ].map(s => (
            <div key={s.k} style={{
              background: T.paperSubtle, border: `1px solid ${T.hairline}`,
              borderRadius: T.r6, padding: '14px 15px',
            }}>
              <div style={{ fontFamily: T.fontMono, fontSize: 24, fontWeight: 500, color: s.tone || T.ink, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 11.5, color: T.ink40, marginTop: 6 }}>{s.k}</div>
            </div>
          ))}
        </div>
      </Section>

      {nothingRecorded ? <NothingYet o={o} T={T} /> : (<>
      {/* ── Estimation ── */}
      {o.estimation.enough && (
      <Section title={t('patterns.estimation')} note={t('patterns.estimationNote', { n: o.estimation.samples })} T={T}>
          <>
            <Finding tone={o.estimation.bias === 'under' ? 'warn' : 'good'} samples={o.estimation.samples} T={T}>
              {o.estimation.bias === 'under' && t('patterns.biasUnder', { ratio: o.estimation.medianRatio })}
              {o.estimation.bias === 'over' && t('patterns.biasOver', { ratio: o.estimation.medianRatio })}
              {o.estimation.bias === 'accurate' && t('patterns.biasAccurate', { ratio: o.estimation.medianRatio })}
            </Finding>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
              {estimationAreas.map(a => (
                <div key={a.area} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 76px', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontSize: 12.5, color: T.ink80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.area}</div>
                  <Bar value={a.medianRatio ?? 0} max={Math.max(2, ...estimationAreas.map(x => x.medianRatio ?? 0))}
                    color={a.bias === 'under' ? T.warn : a.bias === 'accurate' ? T.done : T.accent} T={T} />
                  <div style={{ fontFamily: T.fontMono, fontSize: 11.5, color: a.enough ? T.ink60 : T.ink40, textAlign: 'right' }}>
                    {a.medianRatio}× {!a.enough && <span title={t('patterns.onlyNTasks', { n: a.samples })}>·{a.samples}</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
      </Section>
      )}

      {/* ── Slippage ── */}
      <Section title={t('patterns.slippage')} note={o.slippage.totalSlips ? t('patterns.slippageNote', { slips: o.slippage.totalSlips, tasks: o.slippage.tasksSlipped }) : null} T={T}>
        {o.slippage.totalSlips === 0 ? (
          <Finding tone="good" T={T}>{t('patterns.noSlips')}</Finding>
        ) : (
          <>
            {o.slippage.enough && (
              <Finding tone="warn" samples={o.slippage.tasksSlipped} T={T}>
                {t('patterns.slipMedian', { days: o.slippage.medianDaysPerSlip })}
              </Finding>
            )}
            {o.slippage.chronic.length > 0 && (
              <div style={{ marginTop: o.slippage.enough ? 14 : 0 }}>
                <div style={{ fontFamily: T.fontMono, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 }}>
                  {t('patterns.movedThrice')}
                </div>
                {o.slippage.chronic.map(c => (
                  <div key={c.taskId} style={{
                    display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline',
                    padding: '9px 0', borderBottom: `1px solid ${T.hairlineSoft}`,
                  }}>
                    <span style={{ fontSize: 13, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                    <span style={{ fontFamily: T.fontMono, fontSize: 11.5, color: T.warn, whiteSpace: 'nowrap' }}>
                      {c.slips}× · {t('patterns.daysLater', { days: c.totalDays })}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {!o.slippage.enough && o.slippage.chronic.length === 0 && (
              <NotEnough samples={o.slippage.tasksSlipped} what={t('patterns.what.deadlines')} T={T} />
            )}
          </>
        )}
      </Section>

      {/* ── Time to start ── */}
      <Section title={t('patterns.latency')} T={T}>
        {!o.latency.enough ? (
          <NotEnough samples={o.latency.samples} what={t('patterns.what.starting')} T={T} />
        ) : (
          <Finding samples={o.latency.samples} T={T}>
            {t('patterns.latencyBody', { days: o.latency.medianDaysToStart })}
          </Finding>
        )}
      </Section>

      </>)}

      {/* ── Abandonment ── */}
      <Section title={t('patterns.abandonment')} note={t('patterns.abandonmentNote', { n: o.abandonment.count })} T={T}>
        {!o.abandonment.enough ? (
          <NotEnough samples={o.abandonment.samples} what={t('patterns.what.abandon')} T={T} />
        ) : abandonAreas.length === 0 ? (
          <Finding tone="good" T={T}>{t('patterns.noAbandoned')}</Finding>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {abandonAreas.map(a => (
              <div key={a.area} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 76px', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 12.5, color: T.ink80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.area}</div>
                <Bar value={a.rate} max={1} color={T.danger} T={T} />
                <div style={{ fontFamily: T.fontMono, fontSize: 11.5, color: a.enough ? T.ink60 : T.ink40, textAlign: 'right' }}>
                  {pct(a.rate)} {!a.enough && <span>·{a.samples}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Rhythm ── */}
      {!nothingRecorded && (
      <Section title={t('patterns.rhythm')} note={o.rhythm.enough ? t('patterns.rhythmNote', { hour: hourLabel(o.rhythm.peakHour) }) : null} T={T}>
        {!o.rhythm.enough ? (
          <NotEnough samples={o.rhythm.samples} what={t('patterns.what.rhythm')} T={T} />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64, marginBottom: 6 }}>
              {o.rhythm.hours.map((n, h) => (
                <div key={h} title={`${hourLabel(h)} — ${n}`} style={{
                  flex: 1, height: `${Math.max(2, (n / maxHour) * 100)}%`,
                  background: h === o.rhythm.peakHour ? T.accent : T.hairline,
                  borderRadius: 2, minHeight: 2,
                }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.fontMono, fontSize: 10, color: T.ink40, marginBottom: 18 }}>
              <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {o.rhythm.weekdays.map((n, d) => (
                <div key={d} style={{ flex: 1, textAlign: 'center' }}>
                  <Bar value={n} max={maxWeekday} color={d === o.rhythm.peakWeekday ? T.accent : T.hairline} T={T} />
                  <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.ink40, marginTop: 5 }}>{fmtDate(WEEK_FROM_SUNDAY[d], { weekday: 'short' }).replace('.', '')}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>
      )}

      <div style={{
        marginTop: 34, paddingTop: 16, borderTop: `1px solid ${T.hairlineSoft}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40 }}>
          {t('patterns.computedHere')} · {fmtDateTime(o.computedAt)}
        </span>
        <button onClick={recompute} disabled={busy} style={{
          padding: '6px 13px', background: 'transparent',
          border: `1px solid ${T.hairline}`, borderRadius: T.r6,
          fontSize: 12, color: busy ? T.ink40 : T.ink60,
          fontFamily: T.fontUI, cursor: busy ? 'default' : 'pointer',
        }}>{busy ? t('patterns.recomputing') : t('patterns.recompute')}</button>
      </div>
    </div>
  );
}
