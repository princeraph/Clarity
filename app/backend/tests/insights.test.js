import { describe, test, expect } from '@jest/globals';
import {
  validateInsight, deriveInsights, mergeInsights, setInsightStatus,
  activeInsights, CATEGORIES, STALE_AFTER_DAYS,
} from '../src/profile/insights.js';
import { computeObserved } from '../src/profile/metrics.js';

const emptyUnderstanding = () => ({
  traits: [], drivers: [], blockers: [], strengths: [], skills: [], context: [],
});

const good = (over = {}) => ({
  category: 'traits', statement: 'Works late', confidence: 0.6,
  evidence: [{ kind: 'metric', ref: 'observed.rhythm.peakHour' }],
  ...over,
});

function tasksWith(n, over = {}) {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`, title: `Task ${i}`, tags: ['admin'], status: 'done',
    estimatedDuration: 60, timeTracked: 120, archived: false, history: [],
    createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-05T09:00:00.000Z',
    ...over,
  }));
}

// ── Rule 1: no evidence, no insight ───────────────────────────────────────────

describe('validateInsight', () => {
  test('refuses an insight with no evidence', () => {
    expect(validateInsight(good({ evidence: [] }))).toMatch(/at least one piece of evidence/);
    expect(validateInsight(good({ evidence: undefined }))).toMatch(/evidence/);
  });

  test('refuses evidence that does not point at anything', () => {
    expect(validateInsight(good({ evidence: [{ kind: 'metric' }] }))).toMatch(/ref/);
    expect(validateInsight(good({ evidence: [{ ref: 'x' }] }))).toMatch(/kind/);
    expect(validateInsight(good({ evidence: ['a string'] }))).toMatch(/objects/);
  });

  test('refuses an unknown category, a blank statement, an impossible confidence', () => {
    expect(validateInsight(good({ category: 'vibes' }))).toMatch(/category/);
    expect(validateInsight(good({ statement: '   ' }))).toMatch(/statement/);
    expect(validateInsight(good({ confidence: 0 }))).toMatch(/confidence/);
    expect(validateInsight(good({ confidence: 1.5 }))).toMatch(/confidence/);
  });

  test('accepts a well-formed insight', () => {
    expect(validateInsight(good())).toBeNull();
  });
});

// ── Deriving ──────────────────────────────────────────────────────────────────

describe('deriveInsights', () => {
  test('says nothing when the metric is below its sample threshold', () => {
    const observed = computeObserved(tasksWith(2), { now: new Date('2026-09-10T00:00:00Z') });
    expect(deriveInsights(observed)).toEqual([]);
  });

  test('derives an under-estimation insight with a metric reference', () => {
    const observed = computeObserved(tasksWith(8), { now: new Date('2026-09-10T00:00:00Z') });
    const got = deriveInsights(observed);
    const overall = got.find(i => i.key === 'observed:estimation:overall');
    expect(overall.category).toBe('blockers');
    expect(overall.statement).toMatch(/2× longer/);
    expect(overall.evidence[0].ref).toBe('observed.estimation.medianRatio');
    expect(overall.source).toBe('observed');
  });

  test('every derived insight passes its own validator', () => {
    const observed = computeObserved(tasksWith(8), { now: new Date('2026-09-10T00:00:00Z') });
    for (const i of deriveInsights(observed)) expect(validateInsight(i)).toBeNull();
  });

  test('confidence rises with sample size but never reaches certainty', () => {
    const few  = deriveInsights(computeObserved(tasksWith(6),  { now: new Date('2026-09-10T00:00:00Z') }));
    const many = deriveInsights(computeObserved(tasksWith(40), { now: new Date('2026-09-10T00:00:00Z') }));
    const c = (list) => list.find(i => i.key === 'observed:estimation:overall').confidence;
    expect(c(many)).toBeGreaterThan(c(few));
    expect(c(many)).toBeLessThan(1);
  });

  test('accurate estimation is a strength, not a blocker', () => {
    const observed = computeObserved(tasksWith(8, { estimatedDuration: 100, timeTracked: 102 }), { now: new Date('2026-09-10T00:00:00Z') });
    const overall = deriveInsights(observed).find(i => i.key === 'observed:estimation:overall');
    expect(overall.category).toBe('strengths');
  });

  test('handles a null observed layer', () => {
    expect(deriveInsights(null)).toEqual([]);
  });
});

// ── Rule 2: a rejected conclusion never comes back ────────────────────────────

describe('mergeInsights', () => {
  const observed = computeObserved(tasksWith(8), { now: new Date('2026-09-10T00:00:00Z') });
  const derived = deriveInsights(observed);

  test('adds on first merge, updates in place on the second — never duplicates', () => {
    const first = mergeInsights(emptyUnderstanding(), derived, { now: new Date('2026-09-10T00:00:00Z') });
    expect(first.added).toBe(derived.length);

    const second = mergeInsights(first.understanding, derived, { now: new Date('2026-09-11T00:00:00Z') });
    expect(second.added).toBe(0);
    expect(second.refreshed).toBe(derived.length);
    expect(activeInsights(second.understanding)).toHaveLength(derived.length);
  });

  test('a rejected insight is never re-derived, no matter how many merges', () => {
    let u = mergeInsights(emptyUnderstanding(), derived, { now: new Date('2026-09-10T00:00:00Z') }).understanding;
    const target = activeInsights(u).find(i => i.key === 'observed:estimation:overall');

    u = setInsightStatus(u, target.id, 'user-rejected', { reason: 'I was learning a new tool that month' }).understanding;

    for (let i = 0; i < 3; i++) {
      const r = mergeInsights(u, derived, { now: new Date('2026-09-12T00:00:00Z') });
      u = r.understanding;
      expect(r.blocked).toBeGreaterThan(0);
    }
    expect(activeInsights(u).some(i => i.key === 'observed:estimation:overall')).toBe(false);
  });

  test('a rejection is kept rather than deleted, along with its reason', () => {
    let u = mergeInsights(emptyUnderstanding(), derived, { now: new Date('2026-09-10T00:00:00Z') }).understanding;
    const target = activeInsights(u).find(i => i.key === 'observed:estimation:overall');
    u = setInsightStatus(u, target.id, 'user-rejected', { reason: 'not true, that was one bad month' }).understanding;

    const all = Object.values(u).flat();
    const kept = all.find(i => i.id === target.id);
    expect(kept).toBeDefined();
    expect(kept.status).toBe('user-rejected');
    expect(kept.rejectedReason).toBe('not true, that was one bad month');
  });

  test('anything failing validation is reported and not stored', () => {
    const r = mergeInsights(emptyUnderstanding(), [
      good({ evidence: [] }),
      good({ category: 'nonsense' }),
      good({ key: 'ok:1' }),
    ], { now: new Date() });
    expect(r.added).toBe(1);
    expect(r.invalid).toHaveLength(2);
    expect(r.invalid[0].error).toMatch(/evidence/);
  });
});

// ── Rule 3: unsupported beliefs go stale ──────────────────────────────────────

describe('staleness', () => {
  const observed = computeObserved(tasksWith(8), { now: new Date('2026-09-10T00:00:00Z') });
  const derived = deriveInsights(observed);

  test('an insight no longer derived goes stale instead of lingering as true', () => {
    let u = mergeInsights(emptyUnderstanding(), derived, { now: new Date('2026-09-10T00:00:00Z') }).understanding;
    // The pattern disappears: nothing is derived any more.
    const r = mergeInsights(u, [], { now: new Date('2026-09-11T00:00:00Z') });
    expect(r.staled).toBe(derived.length);
    expect(activeInsights(r.understanding)).toHaveLength(0);
  });

  test('a stale insight revives if the pattern returns', () => {
    let u = mergeInsights(emptyUnderstanding(), derived, { now: new Date('2026-09-10T00:00:00Z') }).understanding;
    u = mergeInsights(u, [], { now: new Date('2026-09-11T00:00:00Z') }).understanding;
    const back = mergeInsights(u, derived, { now: new Date('2026-09-12T00:00:00Z') });
    expect(activeInsights(back.understanding)).toHaveLength(derived.length);
  });

  test('an insight not reconfirmed for a long time goes stale on its own', () => {
    const u = mergeInsights(emptyUnderstanding(), derived, { now: new Date('2026-01-01T00:00:00Z') }).understanding;
    const later = new Date(Date.parse('2026-01-01T00:00:00Z') + (STALE_AFTER_DAYS + 5) * 86400000);
    const r = mergeInsights(u, [], { now: later });
    expect(r.staled).toBeGreaterThan(0);
  });
});

// ── Verdicts ──────────────────────────────────────────────────────────────────

describe('setInsightStatus', () => {
  test('confirming a stale insight makes it current again', () => {
    let u = mergeInsights(emptyUnderstanding(), [good({ key: 'k1' })], { now: new Date() }).understanding;
    const id = activeInsights(u)[0].id;
    u = setInsightStatus(u, id, 'stale').understanding;
    expect(activeInsights(u)).toHaveLength(0);
    u = setInsightStatus(u, id, 'active').understanding;
    expect(activeInsights(u)).toHaveLength(1);
  });

  test('an unknown id changes nothing', () => {
    const u = emptyUnderstanding();
    expect(setInsightStatus(u, 'nope', 'user-rejected').changed).toBe(false);
  });

  test('an unknown status is refused outright', () => {
    expect(() => setInsightStatus(emptyUnderstanding(), 'x', 'maybe')).toThrow(/unknown status/);
  });

  test('every category survives a round trip through merge', () => {
    const incoming = [...CATEGORIES].map((category, n) => good({ category, key: `k${n}`, statement: `About ${category}` }));
    const r = mergeInsights(emptyUnderstanding(), incoming, { now: new Date() });
    expect(r.added).toBe(CATEGORIES.size);
    for (const cat of CATEGORIES) expect(r.understanding[cat]).toHaveLength(1);
  });
});
