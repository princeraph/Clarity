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

// ─── Elicitation (Stage 2b) ───────────────────────────────────────────────────
//
// Asking a model to form beliefs about the person is a different act from
// asking it to summarise their week, and it is held to a different rule:
//
//   ELICITATION RUNS ON A LOCAL MODEL ONLY.
//
// Not because a hosted model would do it worse, but because of what it needs to
// do it at all. A proposal must cite evidence that resolves, so the model has
// to see the raw material — journal entries in the user's own words, task ids.
// That is precisely what the preview promises never leaves the machine. Sending
// it anyway and calling it hybrid would make the promise decorative.
//
// So the boundary decides the feature: no local model, no elicitation. The
// refusal is explicit and says why, rather than quietly producing a thinner
// result the user cannot distinguish from a thorough one.

export class NotLocalError extends Error {
  constructor() {
    super('Elicitation needs a local model — it reads raw journal entries, which never leave this machine.');
    this.status = 409;
    this.code = 'provider-not-local';
  }
}

// Leaf paths of the observed layer that hold a real value. These are what a
// proposal may cite as metric evidence, so the model is told the exact set
// rather than left to guess at path names and have every citation refused.
export function metricPaths(observed, { prefix = 'observed', depth = 3 } = {}) {
  const out = [];
  const walk = (node, path, left) => {
    if (node === null || node === undefined) return;
    if (typeof node !== 'object' || Array.isArray(node)) { out.push(path); return; }
    if (left === 0) return;
    for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`, left - 1);
  };
  walk(observed, prefix, depth);
  return out;
}

/**
 * The catalogue of things a proposal is allowed to cite. Without it the model
 * invents plausible-looking ids, every one of them fails to resolve, and the
 * whole run is refused for a reason that looks like the model's fault rather
 * than the prompt's.
 */
export function evidenceCatalogue({ tasks = [], journal = [], observed = null } = {}) {
  const taskLines = tasks.filter(Boolean).slice(0, 60)
    .map(t => `  task ${t.id} — "${t.title ?? 'Untitled'}"`);
  const journalLines = journal.filter(Boolean).slice(0, 60)
    .map(e => `  journal ${e.id} — ${e.kind}, ${String(e.at).slice(0, 10)}${e.text ? `: ${String(e.text).slice(0, 200)}` : ''}`);
  const metricLines = metricPaths(observed).slice(0, 60).map(p => `  metric ${p}`);
  return { taskLines, journalLines, metricLines };
}

const ELICIT_INSTRUCTIONS = `You are helping someone understand their own working patterns.

Propose at most ${'${MAX}'} things you believe about this person that they may not have said outright. Aim for what would change how they plan their week, not flattery and not a restatement of the numbers.

Hard rules:
- Every proposal MUST cite evidence from the catalogue below, copying the ref EXACTLY. A proposal whose citation does not resolve is discarded.
- Do not propose anything already listed under what is known.
- Say nothing about health, mood, relationships or finances unless the person raised it themselves in a journal entry.
- If the material does not support a proposal, return fewer. An empty list is a valid and useful answer.

Return ONLY a JSON array, no prose, no markdown:
[{"category":"traits|drivers|blockers|strengths|skills|context","statement":"one sentence, second person","confidence":0.1-0.6,"rationale":"why you think so","evidence":[{"kind":"task|journal|metric","ref":"exact ref from the catalogue","note":"what it shows"}]}]`;

/**
 * Compose the elicitation prompt. Every piece of user data in it comes from
 * this file, like every other outbound prompt.
 */
export function buildElicitationPrompt({
  profile, tasks = [], journal = [], analysis = null,
  providerIsLocal = false, maxProposals = 5,
} = {}) {
  if (!providerIsLocal) throw new NotLocalError();

  const known = describeUnderstanding(profile?.understanding)
    .map(i => `- ${i.statement}`);
  const measured = describeObserved(profile?.observed).map(l => `- ${l}`);
  const { taskLines, journalLines, metricLines } = evidenceCatalogue({
    tasks, journal, observed: profile?.observed,
  });

  const sections = [
    ELICIT_INSTRUCTIONS.replace('${MAX}', String(maxProposals)),
    `What has been measured:\n${measured.join('\n') || '- Nothing yet — too little recorded to measure anything.'}`,
    `Already known (do not repeat):\n${known.join('\n') || '- Nothing yet.'}`,
    `Their tasks:\n${taskLines.join('\n') || '  none'}`,
    `What they have said (their own words):\n${journalLines.join('\n') || '  nothing recorded'}`,
    `Evidence catalogue — copy a ref exactly or the proposal is discarded:\n${
      [...taskLines, ...journalLines, ...metricLines].join('\n') || '  nothing citable yet'}`,
  ];

  return { text: sections.join('\n\n'), citable: taskLines.length + journalLines.length + metricLines.length };
}

// ─── Follow-up options (Stage 3) ──────────────────────────────────────────────
//
// Suggesting a way FORWARD is a different act from concluding something about
// the person, and it is held to a looser rule on purpose. An option is a thing
// to try; being wrong about it costs an idea the user discards. A belief about
// who they are, being wrong costs their trust — which is why that path needs an
// approval gate and this one does not.
//
// So options may come from any provider. What travels is the task, the blocker
// in the person's own words, and what has already been ruled out — the same
// shape as the current chat exchange, which the preview already says is sent.
// The journal, the evidence behind findings and past transcripts stay put.

export function buildOptionsPrompt({ task, thread, profile, providerIsLocal = false, max = 4 } = {}) {
  const ruledOut = (thread?.options || [])
    .filter(o => o.status === 'ruled-out')
    .map(o => `- ${o.text}${o.note ? ` (${o.note})` : ''}`);
  const alreadyThere = (thread?.options || [])
    .filter(o => o.status !== 'ruled-out')
    .map(o => `- ${o.text}`);
  const needs = (thread?.needs || []).filter(n => !n.done).map(n => `- ${n.text}`);

  // The brief, not the raw profile: a suggestion is better for knowing the
  // person tends to underestimate, and no better for knowing which task proved it.
  const brief = buildProfileBrief(profile, { budget: 600 });

  const sections = [
    `Someone is stuck on one task. Propose at most ${max} concrete next moves — each one small enough to start today.

Rules:
- Do not repeat anything already listed or already ruled out.
- No pep talk, no restating the problem back. Moves only.
- If the real answer is "drop this task" or "ask someone", say that.

Return ONLY a JSON array of strings: ["first move", "second move"]`,
    `Task: ${task?.title ?? 'Untitled'}${task?.deadline ? ` (due ${task.deadline})` : ''}`,
    task?.description ? `Description: ${String(task.description).slice(0, 400)}` : null,
    thread?.blocker?.text ? `What they say is in the way: ${thread.blocker.text}` : 'They have not said what is in the way.',
    needs.length ? `What they say they need:\n${needs.join('\n')}` : null,
    alreadyThere.length ? `Already on the list — do not repeat:\n${alreadyThere.join('\n')}` : null,
    ruledOut.length ? `Already ruled out — do not suggest again:\n${ruledOut.join('\n')}` : null,
    brief.text ? `About how this person works:\n${brief.text}` : null,
  ].filter(Boolean);

  return { text: sections.join('\n\n'), providerIsLocal };
}

/** Parse whatever came back into a clean list of option strings. */
export function parseOptions(raw, { max = 4 } = {}) {
  let list = raw;
  if (typeof list === 'string') {
    const m = list.match(/\[[\s\S]*\]/);
    if (!m) return [];
    try { list = JSON.parse(m[0]); } catch { return []; }
  }
  if (list && !Array.isArray(list) && Array.isArray(list.options)) list = list.options;
  if (!Array.isArray(list)) return [];
  return list
    .map(o => typeof o === 'string' ? o : (o && typeof o.text === 'string' ? o.text : ''))
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, max);
}
