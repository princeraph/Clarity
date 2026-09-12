import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';

const API = 'http://localhost:3001/api';

// Mirrors MIN_SAMPLES in backend/src/profile/metrics.js. The backend already
// sends `enough` per metric — this is only used to phrase how far off a metric is.
const MIN_SAMPLES = 5;

function pct(n) { return `${Math.round(n * 100)}%`; }

function hourLabel(h) {
  if (h === null || h === undefined) return '—';
  return `${String(h).padStart(2, '0')}:00`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  return (
    <div style={{
      padding: '13px 15px', background: T.paperSubtle,
      border: `1px dashed ${T.hairline}`, borderRadius: T.r6,
      fontSize: 12.5, color: T.ink60, lineHeight: 1.5,
    }}>
      Not enough yet to say anything about {what} — {samples} of {MIN_SAMPLES} needed.
      Clarity would rather stay quiet than guess from a handful of tasks.
    </div>
  );
}

function Finding({ children, tone = 'neutral', samples, T }) {
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
            from {samples} task{samples === 1 ? '' : 's'}
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
function InsightCard({ insight, onReject, onConfirm, busy, T }) {
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
      <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5 }}>{insight.statement}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40 }}>
          {Math.round(insight.confidence * 100)}% confident
          {insight.source === 'elicited' && ' · you confirmed this'}
          {stale && ' · no longer supported'}
        </span>
        <button onClick={() => setShowWhy(w => !w)} style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontFamily: T.fontUI, fontSize: 11.5, color: T.accentInk, textDecoration: 'underline',
        }}>{showWhy ? 'hide the basis' : 'why does it think this?'}</button>
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
            placeholder="What is it getting wrong? (optional, but it learns from this)"
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
            }}>Reject this</button>
            <button onClick={() => setRejecting(false)} style={{
              padding: '6px 12px', background: 'transparent', color: T.ink60,
              border: `1px solid ${T.hairline}`, borderRadius: T.r6,
              fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 7 }}>
          <button disabled={busy} onClick={() => setRejecting(true)} style={{
            padding: '5px 11px', background: 'transparent', color: T.ink60,
            border: `1px solid ${T.hairline}`, borderRadius: T.r6,
            fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer',
          }}>That’s wrong</button>
          {stale && (
            <button disabled={busy} onClick={() => onConfirm(insight)} style={{
              padding: '5px 11px', background: 'transparent', color: T.ink60,
              border: `1px solid ${T.hairline}`, borderRadius: T.r6,
              fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer',
            }}>Still true</button>
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
          suggested · {Math.round(proposal.confidence * 100)}% · {proposal.category}
        </span>
        <button onClick={() => setShowWhy(w => !w)} style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontFamily: T.fontUI, fontSize: 11.5, color: T.accentInk, textDecoration: 'underline',
        }}>{showWhy ? 'hide what it looked at' : 'what did it look at?'}</button>
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
            placeholder="What is it getting wrong? (optional)"
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
            }}>Discard it</button>
            <button onClick={() => setDeclining(false)} style={{
              padding: '6px 12px', background: 'transparent', color: T.ink60,
              border: `1px solid ${T.hairline}`, borderRadius: T.r6,
              fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 7 }}>
          <button disabled={busy} onClick={() => onAccept(proposal)} style={{
            padding: '6px 13px', background: T.accentSoft, color: T.accentInk,
            border: `1px solid ${T.accent}`, borderRadius: T.r6,
            fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer', fontWeight: 500,
          }}>That’s right</button>
          <button disabled={busy} onClick={() => setDeclining(true)} style={{
            padding: '6px 13px', background: 'transparent', color: T.ink60,
            border: `1px solid ${T.hairline}`, borderRadius: T.r6,
            fontSize: 12, fontFamily: T.fontUI, cursor: 'pointer',
          }}>No, it isn’t</button>
        </div>
      )}
    </div>
  );
}

// When nothing is measurable yet, five identical "not enough" boxes read as a
// broken page. Say it once, and say what would change it — the metrics depend
// on things the app records as you use it, not on waiting.
function NothingYet({ o, T }) {
  const rows = [
    { on: o.estimation.samples > 0, what: 'How long things really take',
      needs: 'Set a duration on a task, then run the timer on it. Clarity compares the two.' },
    { on: o.rhythm.samples > 0, what: 'When you actually work',
      needs: 'Move a task to In progress or Done. The time of that change is the signal.' },
    { on: o.latency.samples > 0, what: 'How long before you start',
      needs: 'Same — it measures from writing a task down to first moving it to In progress.' },
    { on: o.slippage.totalSlips > 0, what: 'Deadlines you moved',
      needs: 'Change a deadline to a later date. Nothing to report until you do.' },
  ];
  return (
    <Section title="Not measurable yet" note="four of five need data the app has not seen" T={T}>
      <div style={{
        padding: '14px 16px', background: T.paperSubtle,
        border: `1px solid ${T.hairline}`, borderRadius: T.r6,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.55 }}>
          Clarity measures what you do in the app, not what your task list looks like. None of
          the tasks it can see have been timed, started, or rescheduled here — so there is
          genuinely nothing to report. It fills in as you work, without anything being rebuilt.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.filter(r => !r.on).map(r => (
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
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [eliciting, setEliciting] = useState(false);
  const [elicitNote, setElicitNote] = useState(null);

  async function load() {
    try {
      const resp = await fetch(`${API}/profile`);
      if (!resp.ok) throw new Error('Could not load');
      setProfile(await resp.json());
      setError(null);
    } catch {
      setError('Could not reach the backend.');
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
      setError('Could not reach the backend.');
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
      setError('Could not reach the backend.');
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
      if (!resp.ok) { setElicitNote(body.error || 'Clarity could not run that just now.'); return; }
      setProposals(body.pending || []);
      if (!body.added?.length) {
        // Silence has several causes and they are not interchangeable — a model
        // that found nothing is not the same as one whose every citation failed.
        const why = body.note
          || (body.refused?.length ? 'It suggested things it could not back up with your own data, so they were discarded.'
          : body.skipped?.length ? 'Nothing new — what it came up with, you have already seen or answered.'
          : 'It did not find anything it could support yet.');
        setElicitNote(why);
      }
    } catch {
      setElicitNote('Could not reach the backend.');
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
      setError('Could not reach the backend.');
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
    return <div style={wrap}><div style={{ color: T.ink40, fontSize: 13.5 }}>Reading your history…</div></div>;
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
          from {o.tasksConsidered} task{o.tasksConsidered === 1 ? '' : 's'} · {o.windowDays > 0 ? `last ${o.windowDays} days` : 'all of your history'}
        </div>
        <h1 style={{ margin: 0, fontSize: 38, fontWeight: 500, letterSpacing: '-0.035em', color: T.ink }}>Patterns</h1>
        <p style={{ margin: '10px 0 0', fontSize: 13.5, color: T.ink60, maxWidth: '62ch', lineHeight: 1.6 }}>
          What Clarity has noticed from your own history — deadlines you moved, time you tracked against what you
          planned, what you started and what you let go. Everything below is measured, not guessed, and no AI
          produces it. The one exception is <em>Clarity wants to check something</em>, which is a model asking —
          and nothing there enters your profile until you say so.
        </p>
        {o.windowFellBack && (
          <p style={{
            margin: '12px 0 0', fontSize: 12.5, color: T.ink60, lineHeight: 1.55,
            padding: '10px 13px', background: T.paperSubtle,
            border: `1px solid ${T.hairline}`, borderRadius: T.r6, maxWidth: '62ch',
          }}>
            Nothing you worked on falls inside the last {o.windowDaysRequested} days, so this covers
            everything instead. Recent work would normally be weighted on its own.
          </p>
        )}
      </div>

      <Section
        title="Clarity wants to check something"
        note={proposals.length ? `${proposals.length} waiting on you` : 'a model asking, not telling'}
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
              Everything above is arithmetic. This is the one place a model gets to form an opinion about you —
              and it only ever <strong>asks</strong>. Whatever it suggests sits here until you accept it, and
              anything you turn down never comes back.
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
            }}>{eliciting ? 'Thinking\u2026' : 'Ask Clarity what it notices'}</button>
            <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.ink40, marginTop: 6 }}>
              runs on your local model — nothing is sent anywhere
            </div>
          </div>
        </div>
      </Section>

      {insights.length > 0 && (
        <Section
          title="What Clarity thinks this means"
          note={`${insights.length} conclusion${insights.length === 1 ? '' : 's'} · each one you can throw out`}
          T={T}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {insights.map(i => (
              <InsightCard key={i.id} insight={i} busy={busy} T={T}
                onReject={(ins, reason) => judge(ins, 'reject', reason)}
                onConfirm={(ins) => judge(ins, 'confirm')} />
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: T.ink40, marginTop: 10, lineHeight: 1.55 }}>
            Most of these are worked out from the measurements below, with no model involved. Any marked
            <em> you confirmed this</em> came from a suggestion you accepted. Rejecting one is permanent either
            way: it will not be worked out, or suggested, again.
          </p>
        </Section>
      )}

      {/* ── Load: the only thing about right now ── */}
      <Section title="Right now" T={T}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10 }}>
          {[
            { k: 'Open', v: o.load.openTasks },
            { k: 'Due this week', v: o.load.dueNext7Days },
            { k: 'Overdue', v: o.load.overdue, tone: o.load.overdue > 0 ? T.danger : null },
            { k: 'Planned this week', v: `${Math.round(o.load.committedMinutes / 60)}h` },
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
      <Section title="How well you estimate" note={`${o.estimation.samples} task${o.estimation.samples === 1 ? '' : 's'} both estimated and timed`} T={T}>
        {!o.estimation.enough ? (
          <NotEnough samples={o.estimation.samples} what="your estimating" T={T} />
        ) : (
          <>
            <Finding tone={o.estimation.bias === 'under' ? 'warn' : 'good'} samples={o.estimation.samples} T={T}>
              {o.estimation.bias === 'under' && <>Work takes you about <b>{o.estimation.medianRatio}×</b> as long as you plan for.</>}
              {o.estimation.bias === 'over' && <>You finish in about <b>{o.estimation.medianRatio}×</b> your estimate — you plan more time than you need.</>}
              {o.estimation.bias === 'accurate' && <>Your estimates land close: a median of <b>{o.estimation.medianRatio}×</b> what you planned.</>}
            </Finding>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
              {estimationAreas.map(a => (
                <div key={a.area} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 76px', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontSize: 12.5, color: T.ink80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.area}</div>
                  <Bar value={a.medianRatio ?? 0} max={Math.max(2, ...estimationAreas.map(x => x.medianRatio ?? 0))}
                    color={a.bias === 'under' ? T.warn : a.bias === 'accurate' ? T.done : T.accent} T={T} />
                  <div style={{ fontFamily: T.fontMono, fontSize: 11.5, color: a.enough ? T.ink60 : T.ink40, textAlign: 'right' }}>
                    {a.medianRatio}× {!a.enough && <span title={`only ${a.samples} tasks`}>·{a.samples}</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      {/* ── Slippage ── */}
      <Section title="Deadlines you moved" note={o.slippage.totalSlips ? `${o.slippage.totalSlips} across ${o.slippage.tasksSlipped} task${o.slippage.tasksSlipped === 1 ? '' : 's'}` : null} T={T}>
        {o.slippage.totalSlips === 0 ? (
          <Finding tone="good" T={T}>You have not pushed a deadline back in this window.</Finding>
        ) : (
          <>
            {o.slippage.enough && (
              <Finding tone="warn" samples={o.slippage.tasksSlipped} T={T}>
                When you move a deadline, you move it by a median of <b>{o.slippage.medianDaysPerSlip} days</b>.
              </Finding>
            )}
            {o.slippage.chronic.length > 0 && (
              <div style={{ marginTop: o.slippage.enough ? 14 : 0 }}>
                <div style={{ fontFamily: T.fontMono, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink40, marginBottom: 8 }}>
                  Moved three times or more
                </div>
                {o.slippage.chronic.map(c => (
                  <div key={c.taskId} style={{
                    display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline',
                    padding: '9px 0', borderBottom: `1px solid ${T.hairlineSoft}`,
                  }}>
                    <span style={{ fontSize: 13, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                    <span style={{ fontFamily: T.fontMono, fontSize: 11.5, color: T.warn, whiteSpace: 'nowrap' }}>
                      {c.slips}× · {c.totalDays}d later
                    </span>
                  </div>
                ))}
              </div>
            )}
            {!o.slippage.enough && o.slippage.chronic.length === 0 && (
              <NotEnough samples={o.slippage.tasksSlipped} what="how you handle deadlines" T={T} />
            )}
          </>
        )}
      </Section>

      {/* ── Time to start ── */}
      <Section title="How long before you start" T={T}>
        {!o.latency.enough ? (
          <NotEnough samples={o.latency.samples} what="your starting habits" T={T} />
        ) : (
          <Finding samples={o.latency.samples} T={T}>
            A task waits a median of <b>{o.latency.medianDaysToStart} days</b> between being written down and being started.
          </Finding>
        )}
      </Section>

      </>)}

      {/* ── Abandonment ── */}
      <Section title="What you let go" note={`${o.abandonment.count} archived without finishing`} T={T}>
        {!o.abandonment.enough ? (
          <NotEnough samples={o.abandonment.samples} what="what you abandon" T={T} />
        ) : abandonAreas.length === 0 ? (
          <Finding tone="good" T={T}>Nothing archived unfinished in this window.</Finding>
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
      <Section title="When you actually work" note={o.rhythm.enough ? `busiest around ${hourLabel(o.rhythm.peakHour)}` : null} T={T}>
        {!o.rhythm.enough ? (
          <NotEnough samples={o.rhythm.samples} what="your working rhythm" T={T} />
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
                  <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.ink40, marginTop: 5 }}>{WEEKDAYS[d]}</div>
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
          Computed on this machine · nothing sent anywhere · {new Date(o.computedAt).toLocaleString()}
        </span>
        <button onClick={recompute} disabled={busy} style={{
          padding: '6px 13px', background: 'transparent',
          border: `1px solid ${T.hairline}`, borderRadius: T.r6,
          fontSize: 12, color: busy ? T.ink40 : T.ink60,
          fontFamily: T.fontUI, cursor: busy ? 'default' : 'pointer',
        }}>{busy ? 'Recomputing…' : 'Recompute'}</button>
      </div>
    </div>
  );
}
