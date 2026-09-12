// Stage 2b — the first place a *model* proposes conclusions about the person,
// rather than arithmetic deriving them from what was measured.
//
// That difference is the whole reason this file exists. A derived insight is
// reproducible: the same tasks give the same number, and the number is either
// above its sample threshold or it says nothing. A model's proposal has none of
// those properties. It can be fluent and wrong, it can cite evidence that does
// not exist, and it can say the same thing twice in different words.
//
// So a proposal is not an insight. It is a request to become one, and it is
// refused unless it passes here:
//
//   1. It cites evidence, and every citation RESOLVES — a task id that exists,
//      a journal entry that exists, a metric path that is really in the
//      observed layer. An unresolvable citation is the signature of an invented
//      one, and invented evidence is worse than no evidence: it looks checkable.
//   2. It is not something the user already threw out. Rejection is matched on
//      the normalised statement, so rewording does not get a refused idea back
//      in. Near-duplicates can still slip through; exact re-runs cannot.
//   3. Its confidence is capped. There is no sample count behind a model's
//      hunch, and showing "85% confident" for something with no arithmetic
//      behind it would be borrowing the authority of the measured layer.
//   4. Its `source` is set here, never read from the model. A proposal cannot
//      claim to be an observation.
//
// And then, having passed all of that, it still does not enter the profile.
// It waits for the user to accept it. That is the part that is not a
// safeguard but a design decision: the user chose "the model proposes, I
// approve" over "the model writes, I correct".

import { createHash } from 'crypto';
import { CATEGORIES, validateInsight } from './insights.js';

export const PROPOSAL_STATUSES = new Set(['pending', 'accepted', 'declined']);

// A model's confidence is not a measurement. Cap it below anything the observed
// layer can reach, so the two are never presented as equally grounded.
export const MAX_ELICITED_CONFIDENCE = 0.6;

// Bounded on both sides: one run cannot flood the queue, and the queue cannot
// grow without limit if the user never looks at it.
export const MAX_PROPOSALS_PER_RUN = 5;
export const MAX_PENDING = 12;

const EVIDENCE_KINDS = new Set(['task', 'journal', 'metric']);

// ─── identity ─────────────────────────────────────────────────────────────────

// Two statements that differ only in punctuation, casing or spacing are the
// same claim. Keying on the normalised form is what makes a decline stick when
// the model rephrases next week.
export function statementKey(statement) {
  const norm = String(statement)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return `elicited:${createHash('sha1').update(norm).digest('hex').slice(0, 12)}`;
}

// ─── evidence that actually resolves ──────────────────────────────────────────

// Walk a dotted path into the observed layer. `observed.estimation.medianRatio`
// must land on a value that exists — not undefined, not null.
function metricResolves(ref, observed) {
  if (!observed) return false;
  const parts = String(ref).split('.');
  let node = parts[0] === 'observed' ? observed : null;
  if (!node) return false;
  for (const p of parts.slice(1)) {
    if (node === null || typeof node !== 'object' || !(p in node)) return false;
    node = node[p];
  }
  return node !== undefined && node !== null;
}

/**
 * Check every citation against the real corpus.
 * Returns an array of human-readable problems — empty means all resolved.
 */
export function unresolvedEvidence(evidence, { taskIds, journalIds, observed } = {}) {
  const tasks = taskIds instanceof Set ? taskIds : new Set(taskIds || []);
  const journal = journalIds instanceof Set ? journalIds : new Set(journalIds || []);
  const bad = [];
  for (const e of Array.isArray(evidence) ? evidence : []) {
    if (!e || typeof e !== 'object') { bad.push('evidence entry is not an object'); continue; }
    if (!EVIDENCE_KINDS.has(e.kind)) { bad.push(`unknown evidence kind: ${e.kind}`); continue; }
    const ref = String(e.ref ?? '');
    if (e.kind === 'task'    && !tasks.has(ref))            bad.push(`cites task ${ref}, which does not exist`);
    if (e.kind === 'journal' && !journal.has(ref))          bad.push(`cites journal entry ${ref}, which does not exist`);
    if (e.kind === 'metric'  && !metricResolves(ref, observed)) bad.push(`cites metric ${ref}, which is not in the observed layer`);
  }
  return bad;
}

// ─── turning model output into proposals ──────────────────────────────────────

function clampConfidence(n) {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0.4;
  return Math.min(MAX_ELICITED_CONFIDENCE, Math.max(0.05, Math.round(v * 100) / 100));
}

/**
 * Normalise one raw object from the model into a proposal, or explain why it
 * cannot become one. Nothing here trusts the input: category, confidence,
 * source and status are all decided on this side.
 */
export function toProposal(raw, corpus = {}, { now = new Date() } = {}) {
  if (!raw || typeof raw !== 'object') return { error: 'not an object' };

  const statement = typeof raw.statement === 'string' ? raw.statement.trim() : '';
  if (!statement) return { error: 'statement is required' };
  if (statement.length > 240) return { error: 'statement is too long to be one claim' };
  if (!CATEGORIES.has(raw.category)) return { error: `unknown category: ${raw.category}` };

  const evidence = (Array.isArray(raw.evidence) ? raw.evidence : [])
    .filter(e => e && typeof e === 'object')
    .map(e => ({
      kind: String(e.kind ?? ''),
      ref: String(e.ref ?? ''),
      note: typeof e.note === 'string' ? e.note.slice(0, 200) : '',
    }));
  if (!evidence.length) return { error: 'a proposal must cite at least one piece of evidence' };

  const unresolved = unresolvedEvidence(evidence, corpus);
  if (unresolved.length) return { error: unresolved.join('; ') };

  const proposal = {
    id: `prop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    key: statementKey(statement),
    category: raw.category,
    statement,
    confidence: clampConfidence(raw.confidence),
    // Why the model thinks so, in its words — shown to the user, never treated
    // as evidence. Evidence is the list above, and only that list.
    rationale: typeof raw.rationale === 'string' ? raw.rationale.trim().slice(0, 400) : '',
    evidence,
    source: 'elicited',            // set here — never read from the model
    status: 'pending',
    proposedAt: now.toISOString(),
  };

  // Belt and braces: it must also satisfy the rule every insight satisfies,
  // since accepting it is what turns it into one.
  const err = validateInsight({ ...proposal, status: 'active' });
  if (err) return { error: err };

  return { proposal };
}

/**
 * Parse a model's JSON reply into proposals, dropping and reporting anything
 * that does not pass. A model that returns prose, or an object where an array
 * was asked for, yields zero proposals rather than an exception.
 */
export function parseProposals(raw, corpus = {}, opts = {}) {
  let list = raw;
  if (typeof list === 'string') {
    const match = list.match(/\[[\s\S]*\]/);
    if (!match) return { proposals: [], refused: [{ error: 'no JSON array in the reply' }] };
    try { list = JSON.parse(match[0]); }
    catch (err) { return { proposals: [], refused: [{ error: `unparseable JSON: ${err.message}` }] }; }
  }
  if (list && !Array.isArray(list) && Array.isArray(list.proposals)) list = list.proposals;
  if (!Array.isArray(list)) return { proposals: [], refused: [{ error: 'reply was not a list of proposals' }] };

  const proposals = [];
  const refused = [];
  for (const item of list) {
    const { proposal, error } = toProposal(item, corpus, opts);
    if (error) refused.push({ statement: item?.statement, error });
    else proposals.push(proposal);
  }
  return { proposals, refused };
}

// ─── the queue ────────────────────────────────────────────────────────────────

function flattenUnderstanding(understanding) {
  const all = [];
  for (const cat of CATEGORIES) for (const i of (understanding?.[cat] || [])) if (i) all.push(i);
  return all;
}

/**
 * Fold new proposals into the pending queue.
 *
 * Blocked, in order: anything the user already rejected, anything already
 * believed, anything already queued, and anything past the queue cap. Each
 * exclusion is reported rather than silently dropped — a proposal that vanished
 * without explanation is indistinguishable from one that was never made.
 */
export function mergeProposals(profile, incoming, { maxPending = MAX_PENDING } = {}) {
  const pending = (profile.proposals || []).filter(p => p && p.status === 'pending');
  const believed = flattenUnderstanding(profile.understanding);

  const rejectedKeys = new Set(believed.filter(i => i.status === 'user-rejected' && i.key).map(i => i.key));
  const activeKeys   = new Set(believed.filter(i => i.status === 'active' && i.key).map(i => i.key));
  const queuedKeys   = new Set(pending.map(p => p.key));

  const accepted = [];
  const skipped = [];
  for (const p of incoming.slice(0, MAX_PROPOSALS_PER_RUN)) {
    if (rejectedKeys.has(p.key)) { skipped.push({ statement: p.statement, why: 'you rejected this before' }); continue; }
    if (activeKeys.has(p.key))   { skipped.push({ statement: p.statement, why: 'already in your profile' }); continue; }
    if (queuedKeys.has(p.key))   { skipped.push({ statement: p.statement, why: 'already waiting for you' }); continue; }
    if (pending.length + accepted.length >= maxPending) {
      skipped.push({ statement: p.statement, why: 'the queue is full — answer the waiting ones first' });
      continue;
    }
    queuedKeys.add(p.key);
    accepted.push(p);
  }

  return { proposals: [...pending, ...accepted], added: accepted, skipped };
}

/**
 * Accepting is the ONLY path from a proposal to a belief. It returns the
 * insight to be merged; it does not write anything itself.
 */
export function proposalToInsight(proposal, { now = new Date() } = {}) {
  return {
    key: proposal.key,
    category: proposal.category,
    statement: proposal.statement,
    confidence: proposal.confidence,
    evidence: proposal.evidence,
    source: 'elicited',
    acceptedAt: now.toISOString(),
  };
}

/**
 * Declining records a rejection under the proposal's key, using the same
 * mechanism that blocks a re-derived observation. That is deliberate: one
 * rejection list, one rule, whether the idea came from arithmetic or a model.
 */
export function declinedInsight(proposal, { reason = null, now = new Date() } = {}) {
  const at = now.toISOString();
  return {
    id: `ins-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    key: proposal.key,
    category: proposal.category,
    statement: proposal.statement,
    confidence: proposal.confidence,
    source: 'elicited',
    evidence: proposal.evidence,
    firstSeen: at,
    lastConfirmed: at,
    status: 'user-rejected',
    rejectedAt: at,
    rejectedReason: reason,
    supersededBy: null,
  };
}
