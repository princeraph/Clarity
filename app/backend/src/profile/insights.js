// The understanding layer: what Clarity believes about the person, as opposed
// to what it has measured.
//
// Three rules hold this together, and all three are enforced here rather than
// hoped for:
//
//   1. An insight with no citable evidence is refused. The assistant may not
//      assert something it cannot show you the basis for.
//   2. A rejected insight stays rejected. It is kept, not deleted, so the same
//      wrong conclusion is never re-derived next week.
//   3. An insight no longer supported by evidence goes stale rather than
//      hardening into permanent truth.
//
// Derived insights are produced deterministically from the observed layer — no
// model is involved in deciding what is true about someone. A model may later
// propose insights from conversation, but it arrives through the same gate.

import { MIN_SAMPLES } from './metrics.js';

export const CATEGORIES = new Set(['traits', 'drivers', 'blockers', 'strengths', 'skills', 'context']);
export const STATUSES   = new Set(['active', 'user-rejected', 'stale', 'superseded']);

// How long an insight may go without fresh supporting evidence before it is no
// longer presented as current.
export const STALE_AFTER_DAYS = 60;

// Latency above this is worth naming; below it, waiting a day or two to start
// something is just normal life.
const SLOW_START_DAYS = 5;
const HIGH_ABANDON_RATE = 0.5;

// ─── validation ───────────────────────────────────────────────────────────────

export function validateInsight(insight) {
  if (!insight || typeof insight !== 'object') return 'not an object';
  if (typeof insight.statement !== 'string' || !insight.statement.trim()) return 'statement is required';
  if (!CATEGORIES.has(insight.category)) return `unknown category: ${insight.category}`;
  if (insight.status !== undefined && !STATUSES.has(insight.status)) return `unknown status: ${insight.status}`;
  if (typeof insight.confidence !== 'number' || !(insight.confidence > 0 && insight.confidence <= 1))
    return 'confidence must be between 0 and 1';

  // The rule the whole layer exists for.
  if (!Array.isArray(insight.evidence) || insight.evidence.length === 0)
    return 'an insight must cite at least one piece of evidence';
  for (const e of insight.evidence) {
    if (!e || typeof e !== 'object') return 'evidence entries must be objects';
    if (typeof e.kind !== 'string' || !e.kind) return 'evidence needs a kind';
    if (typeof e.ref !== 'string' || !e.ref) return 'evidence needs a ref';
  }
  return null;
}

// ─── deriving from what was measured ──────────────────────────────────────────

// Sample size is the honest basis for confidence: five tasks is a hint, forty is
// a pattern. Capped below 1 — nothing here is certain.
function confidenceFor(samples) {
  if (!samples || samples < MIN_SAMPLES) return null;
  return Math.min(0.9, Math.round((0.45 + samples * 0.03) * 100) / 100);
}

function metric(ref, note) { return { kind: 'metric', ref, note }; }

/**
 * Insights that follow from the observed layer alone. Each carries a stable
 * `key` so re-deriving updates the existing entry instead of piling up copies.
 */
export function deriveInsights(observed) {
  if (!observed) return [];
  const out = [];
  const add = (key, category, statement, confidence, evidence) => {
    if (confidence === null) return;                 // below threshold — say nothing
    out.push({ key, category, statement, confidence, evidence, source: 'observed' });
  };

  const est = observed.estimation;
  if (est?.enough) {
    if (est.bias === 'under') {
      add('observed:estimation:overall', 'blockers',
        `Work takes about ${est.medianRatio}× longer than you plan for.`,
        confidenceFor(est.samples),
        [metric('observed.estimation.medianRatio', `${est.medianRatio}× median over ${est.samples} tasks`)]);
    } else if (est.bias === 'accurate') {
      add('observed:estimation:overall', 'strengths',
        `You estimate your time well — a median of ${est.medianRatio}× what you planned.`,
        confidenceFor(est.samples),
        [metric('observed.estimation.medianRatio', `${est.medianRatio}× median over ${est.samples} tasks`)]);
    }
    for (const [area, v] of Object.entries(est.byArea || {})) {
      if (!v.enough || v.bias !== 'under') continue;
      add(`observed:estimation:area:${area}`, 'blockers',
        `${area} work in particular runs about ${v.medianRatio}× your estimate.`,
        confidenceFor(v.samples),
        [metric(`observed.estimation.byArea.${area}`, `${v.medianRatio}× over ${v.samples} tasks`)]);
    }
  }

  for (const c of observed.slippage?.chronic || []) {
    add(`observed:slippage:task:${c.taskId}`, 'blockers',
      `"${c.title}" keeps being postponed — moved ${c.slips} times, ${c.totalDays} days in total.`,
      Math.min(0.9, 0.5 + c.slips * 0.1),
      [{ kind: 'task', ref: c.taskId, note: `${c.slips} deadline moves` }]);
  }

  const lat = observed.latency;
  if (lat?.enough && lat.medianDaysToStart >= SLOW_START_DAYS) {
    add('observed:latency:overall', 'traits',
      `Tasks tend to sit about ${lat.medianDaysToStart} days before you start them.`,
      confidenceFor(lat.samples),
      [metric('observed.latency.medianDaysToStart', `${lat.medianDaysToStart} days median over ${lat.samples} tasks`)]);
  }

  if (observed.abandonment?.enough) {
    for (const [area, v] of Object.entries(observed.abandonment.rateByArea || {})) {
      if (!v.enough || v.rate < HIGH_ABANDON_RATE) continue;
      add(`observed:abandonment:area:${area}`, 'context',
        `${Math.round(v.rate * 100)}% of ${area} tasks get archived without being finished.`,
        confidenceFor(v.samples),
        [metric(`observed.abandonment.rateByArea.${area}`, `${v.abandoned} of ${v.samples} abandoned`)]);
    }
  }

  const rhythm = observed.rhythm;
  if (rhythm?.enough && rhythm.peakHour !== null) {
    add('observed:rhythm:peak', 'traits',
      `You get most done around ${String(rhythm.peakHour).padStart(2, '0')}:00.`,
      confidenceFor(rhythm.samples),
      [metric('observed.rhythm.peakHour', `${rhythm.samples} recorded changes`)]);
  }

  return out;
}

// ─── merging ──────────────────────────────────────────────────────────────────

const daysSince = (iso, now) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Infinity : (now.getTime() - t) / 86400000;
};

function flatten(understanding) {
  const all = [];
  for (const cat of CATEGORIES) {
    for (const i of (understanding?.[cat] || [])) if (i) all.push(i);
  }
  return all;
}

function regroup(list) {
  const out = {};
  for (const cat of CATEGORIES) out[cat] = [];
  for (const i of list) (out[i.category] ? out[i.category] : out.traits).push(i);
  return out;
}

/**
 * Fold freshly derived insights into the stored ones.
 *
 * The important behaviours, in order of how much they matter:
 *   - a `user-rejected` entry blocks its key from ever coming back;
 *   - a known key is updated in place, never duplicated;
 *   - a stored insight whose key is no longer derived goes `stale`;
 *   - anything failing validation is dropped and reported, not stored.
 */
export function mergeInsights(understanding, incoming, { now = new Date() } = {}) {
  const stored = flatten(understanding);
  const byKey = new Map(stored.filter(i => i.key).map(i => [i.key, i]));
  const nowISO = now.toISOString();

  const rejectedKeys = new Set(stored.filter(i => i.status === 'user-rejected' && i.key).map(i => i.key));

  let added = 0, refreshed = 0, blocked = 0;
  const invalid = [];
  const seenKeys = new Set();

  for (const cand of incoming) {
    const err = validateInsight({ ...cand, status: 'active' });
    if (err) { invalid.push({ statement: cand?.statement, error: err }); continue; }

    if (cand.key && rejectedKeys.has(cand.key)) { blocked++; continue; }   // rule 2
    if (cand.key) seenKeys.add(cand.key);

    const existing = cand.key ? byKey.get(cand.key) : null;
    if (existing) {
      existing.statement     = cand.statement;
      existing.confidence    = cand.confidence;
      existing.evidence      = cand.evidence;
      existing.category      = cand.category;
      existing.lastConfirmed = nowISO;
      if (existing.status === 'stale') existing.status = 'active';
      refreshed++;
    } else {
      stored.push({
        id: `ins-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        key: cand.key ?? null,
        category: cand.category,
        statement: cand.statement,
        confidence: cand.confidence,
        source: cand.source || 'inferred',
        evidence: cand.evidence,
        firstSeen: nowISO,
        lastConfirmed: nowISO,
        status: 'active',
        supersededBy: null,
      });
      added++;
    }
  }

  // Rule 3 — no longer derived, or not reconfirmed in a long time.
  let staled = 0;
  for (const i of stored) {
    if (i.status !== 'active') continue;
    const noLongerDerived = i.source === 'observed' && i.key && !seenKeys.has(i.key);
    const tooOld = daysSince(i.lastConfirmed, now) > STALE_AFTER_DAYS;
    if (noLongerDerived || tooOld) { i.status = 'stale'; staled++; }
  }

  return { understanding: regroup(stored), added, refreshed, staled, blocked, invalid };
}

// ─── user verdicts ────────────────────────────────────────────────────────────

// Rejection is kept, never deleted — that record is what stops the same
// conclusion being re-derived. The reason is worth more than the rejection.
export function setInsightStatus(understanding, id, status, { reason = null, now = new Date() } = {}) {
  if (!STATUSES.has(status)) throw new Error(`unknown status: ${status}`);
  const list = flatten(understanding);
  const target = list.find(i => i.id === id);
  if (!target) return { understanding, changed: false };

  target.status = status;
  if (status === 'user-rejected') {
    target.rejectedAt = now.toISOString();
    target.rejectedReason = reason;
  } else if (status === 'active') {
    target.lastConfirmed = now.toISOString();
    target.rejectedAt = null;
    target.rejectedReason = null;
  }
  return { understanding: regroup(list), changed: true, insight: target };
}

export function activeInsights(understanding) {
  return flatten(understanding).filter(i => i.status === 'active');
}
