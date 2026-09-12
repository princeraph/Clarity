// The only place an outbound prompt is composed.
//
// Clarity's privacy posture is hybrid: raw evidence stays on the machine, and a
// cloud model receives a bounded, derived brief. That is a property of the code
// path, not of good intentions — so every prompt bound for a provider is built
// here, and nothing else is allowed to reach for the journal, an insight's
// evidence, or a chat transcript when assembling one.
//
// A local model (Ollama) never leaves the device, so the boundary does not
// apply to it and it gets the fuller picture.

import { MIN_SAMPLES } from './metrics.js';

export const DEFAULT_BRIEF_BUDGET = 1800;   // characters, ~450 tokens

// Fields of an Insight that may travel. `evidence` is deliberately absent:
// it names task ids and journal entries, which are the raw material.
const OUTBOUND_INSIGHT_FIELDS = ['statement', 'category', 'confidence'];

function pctString(n) { return `${Math.round(n * 100)}%`; }

// Turn the observed layer into plain statements. Deterministic — no model is
// used to describe the user, so the description cannot drift or embellish.
// A metric below its sample threshold produces NO statement at all.
export function describeObserved(observed) {
  if (!observed) return [];
  const out = [];

  const est = observed.estimation;
  if (est?.enough) {
    if (est.bias === 'under') out.push(`Work tends to take about ${est.medianRatio}× the time they estimate (median over ${est.samples} tasks).`);
    else if (est.bias === 'over') out.push(`They tend to over-allot time: work finishes in about ${est.medianRatio}× the estimate (${est.samples} tasks).`);
    else out.push(`Their time estimates are broadly accurate (median ${est.medianRatio}× over ${est.samples} tasks).`);

    const areas = Object.entries(est.byArea || {})
      .filter(([, v]) => v.enough && v.bias === 'under')
      .sort((a, b) => b[1].medianRatio - a[1].medianRatio)
      .slice(0, 3)
      .map(([area, v]) => `${area} (${v.medianRatio}×)`);
    if (areas.length) out.push(`Underestimates most in: ${areas.join(', ')}.`);
  }

  const slip = observed.slippage;
  if (slip?.enough) {
    out.push(`When a deadline moves, it moves by a median of ${slip.medianDaysPerSlip} days (${slip.tasksSlipped} tasks affected).`);
  }
  if (slip?.chronic?.length) {
    const names = slip.chronic.slice(0, 3).map(c => `"${c.title}" (${c.slips}×)`);
    out.push(`Repeatedly postponed: ${names.join(', ')}.`);
  }

  if (observed.latency?.enough) {
    out.push(`A task typically waits ${observed.latency.medianDaysToStart} days between being written down and being started.`);
  }

  const ab = observed.abandonment;
  if (ab?.enough) {
    const worst = Object.entries(ab.rateByArea || {})
      .filter(([, v]) => v.enough && v.rate >= 0.5)
      .sort((a, b) => b[1].rate - a[1].rate)
      .slice(0, 2)
      .map(([area, v]) => `${area} (${pctString(v.rate)})`);
    if (worst.length) out.push(`Often archives without finishing in: ${worst.join(', ')}.`);
  }

  if (observed.rhythm?.enough && observed.rhythm.peakHour !== null) {
    out.push(`Most active around ${String(observed.rhythm.peakHour).padStart(2, '0')}:00.`);
  }

  return out;
}

// Statements only, and only ones the user has not rejected.
export function describeUnderstanding(understanding) {
  if (!understanding) return [];
  const out = [];
  for (const [category, list] of Object.entries(understanding)) {
    for (const insight of Array.isArray(list) ? list : []) {
      if (!insight || insight.status !== 'active') continue;
      if (typeof insight.statement !== 'string' || !insight.statement.trim()) continue;
      out.push({ category, statement: insight.statement.trim(), confidence: insight.confidence });
    }
  }
  return out;
}

// Trim to a character budget on whole lines, so the brief never ends mid-fact.
function fitLines(lines, budget) {
  const kept = [];
  let used = 0;
  for (const line of lines) {
    if (used + line.length + 1 > budget) break;
    kept.push(line);
    used += line.length + 1;
  }
  return { kept, dropped: lines.length - kept.length };
}

export function buildProfileBrief(profile, { budget = DEFAULT_BRIEF_BUDGET } = {}) {
  const lines = [
    ...describeObserved(profile?.observed),
    ...describeUnderstanding(profile?.understanding).map(i => `${i.statement}`),
  ];
  if (!lines.length) return { text: '', lines: [], dropped: 0 };
  const { kept, dropped } = fitLines(lines, budget);
  return { text: kept.map(l => `- ${l}`).join('\n'), lines: kept, dropped };
}

function taskLines(tasks, analysis) {
  return (tasks || []).filter(t => !!t && !t.archived).map(t => {
    const ta = analysis?.taskAnalysis?.find(a => a.id === t.id);
    const status = String(t.status ?? 'not_started').replace('_', ' ');
    return `• [${status}] ${t.title ?? 'Untitled'}${ta ? ` | Priority #${ta.priority}` : ''}${t.deadline ? ` | Due ${t.deadline}` : ''}${t.tags?.length ? ` | Tags: ${t.tags.join(', ')}` : ''}`;
  });
}

/**
 * Compose the context for an outbound prompt, and say exactly what was included
 * and what was held back. `parts` is what the Settings preview renders, so the
 * user can see the boundary rather than be told about it.
 */
export function buildOutboundContext({
  profile, tasks, analysis,
  providerIsLocal = false,
  budget = DEFAULT_BRIEF_BUDGET,
} = {}) {
  const parts = [];

  const tLines = taskLines(tasks, analysis);
  parts.push({
    id: 'tasks',
    label: 'Your active tasks',
    included: true,
    detail: `${tLines.length} task${tLines.length === 1 ? '' : 's'} — title, status, due date and tags`,
    text: tLines.join('\n') || 'No tasks yet.',
  });

  const brief = buildProfileBrief(profile, { budget });
  parts.push({
    id: 'profile-brief',
    label: providerIsLocal ? 'What Clarity has learned about you' : 'A short profile summary',
    included: brief.lines.length > 0,
    detail: brief.lines.length
      ? `${brief.lines.length} statement${brief.lines.length === 1 ? '' : 's'}, capped at ${budget} characters${brief.dropped ? ` — ${brief.dropped} held back by the cap` : ''}`
      : `Nothing yet — a pattern needs ${MIN_SAMPLES} samples before it is stated`,
    text: brief.text,
  });

  // The three things that never cross, stated as data so the preview can show
  // them as refusals rather than omissions.
  const withheld = providerIsLocal ? [] : [
    { id: 'journal',     label: 'Your journal',            reason: 'Raw entries — what you said, and when — stay on this machine.' },
    { id: 'evidence',    label: 'Evidence behind findings', reason: 'The task ids and entries a conclusion was drawn from stay local; only the conclusion travels.' },
    { id: 'transcripts', label: 'Past conversations',       reason: 'Full chat history stays local. Only the current exchange is sent.' },
    { id: 'metrics',     label: 'Raw measurements',         reason: 'The underlying numbers stay local; the brief carries the plain-language finding.' },
  ];

  const text = parts
    .filter(p => p.included && p.text)
    .map(p => `${p.label}:\n${p.text}`)
    .join('\n\n');

  return { text, parts, withheld, providerIsLocal, budget, chars: text.length };
}
