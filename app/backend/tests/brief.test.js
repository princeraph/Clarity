import { describe, test, expect } from '@jest/globals';
import {
  describeObserved, describeUnderstanding, buildProfileBrief, buildOutboundContext,
  DEFAULT_BRIEF_BUDGET,
} from '../src/profile/brief.js';
import { computeObserved } from '../src/profile/metrics.js';

// A string that must never reach a cloud provider. If it shows up in outbound
// text, something is reading raw material it has no business reading.
const CANARY = 'CANARY-PRIVATE-b7f2e1';

function profileWithSecrets() {
  return {
    observed: computeObserved(
      Array.from({ length: 6 }, (_, i) => ({
        id: `t${i}`, title: `Admin ${i}`, tags: ['admin'],
        estimatedDuration: 60, timeTracked: 120, status: 'done',
        archived: false, history: [], createdAt: '2026-09-01T09:00:00.000Z',
        updatedAt: '2026-09-05T09:00:00.000Z',
      })),
      { now: new Date('2026-09-10T00:00:00.000Z') },
    ),
    understanding: {
      traits: [{
        id: 'i1', category: 'traits', status: 'active', confidence: 0.8,
        statement: 'Works best in long uninterrupted blocks',
        // Evidence is raw material and must not travel.
        evidence: [{ kind: 'journal', ref: CANARY, note: CANARY }],
      }],
      blockers: [{
        id: 'i2', category: 'blockers', status: 'user-rejected', confidence: 0.9,
        statement: `A rejected conclusion mentioning ${CANARY}`,
        evidence: [],
      }],
      drivers: [], strengths: [], skills: [], context: [],
    },
    preferences: {},
  };
}

// ── The boundary ──────────────────────────────────────────────────────────────

describe('buildOutboundContext — the device boundary', () => {
  const tasks = [{ id: 'a', title: 'Write proposal', status: 'in_progress', tags: ['work'], archived: false }];

  test('a cloud provider never receives evidence, journal refs, or rejected insights', () => {
    const ctx = buildOutboundContext({ profile: profileWithSecrets(), tasks, providerIsLocal: false });
    expect(ctx.text).not.toContain(CANARY);
    expect(JSON.stringify(ctx.parts)).not.toContain(CANARY);
  });

  test('a rejected insight is withheld even though it is in the profile', () => {
    const ctx = buildOutboundContext({ profile: profileWithSecrets(), tasks, providerIsLocal: false });
    expect(ctx.text).not.toContain('A rejected conclusion');
    expect(ctx.text).toContain('long uninterrupted blocks');   // the active one does travel
  });

  test('a local model is not withheld from — the boundary does not apply', () => {
    const ctx = buildOutboundContext({ profile: profileWithSecrets(), tasks, providerIsLocal: true });
    expect(ctx.withheld).toHaveLength(0);
  });

  test('cloud output names what it held back, so the preview can show refusals', () => {
    const ctx = buildOutboundContext({ profile: profileWithSecrets(), tasks, providerIsLocal: false });
    expect(ctx.withheld.map(w => w.id).sort()).toEqual(['evidence', 'journal', 'metrics', 'transcripts']);
    for (const w of ctx.withheld) expect(w.reason.length).toBeGreaterThan(10);
  });

  test('an empty profile still produces a usable context and says why it is thin', () => {
    const ctx = buildOutboundContext({ profile: null, tasks, providerIsLocal: false });
    const brief = ctx.parts.find(p => p.id === 'profile-brief');
    expect(brief.included).toBe(false);
    expect(brief.detail).toMatch(/5 samples|needs/);
    expect(ctx.text).toContain('Write proposal');   // tasks still go
  });

  test('survives a malformed profile without throwing', () => {
    for (const p of [undefined, {}, { understanding: null }, { observed: 'nonsense' }]) {
      expect(() => buildOutboundContext({ profile: p, tasks, providerIsLocal: false })).not.toThrow();
    }
  });
});

// ── The budget ────────────────────────────────────────────────────────────────

describe('buildProfileBrief — the budget', () => {
  test('never exceeds the budget, and drops whole lines rather than truncating a fact', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: `i${i}`, status: 'active', confidence: 0.5,
      statement: `Statement number ${i} padded out to a realistic length so the budget actually bites`,
    }));
    const profile = { observed: null, understanding: { traits: many, drivers: [], blockers: [], strengths: [], skills: [], context: [] } };
    const brief = buildProfileBrief(profile, { budget: 300 });
    expect(brief.text.length).toBeLessThanOrEqual(300);
    expect(brief.dropped).toBeGreaterThan(0);
    // Every kept line is whole: no line ends mid-word from a hard slice.
    for (const line of brief.text.split('\n')) expect(line.startsWith('- Statement number')).toBe(true);
  });

  test('the default budget is bounded, not "whatever fits today"', () => {
    expect(DEFAULT_BRIEF_BUDGET).toBeLessThanOrEqual(2000);
  });
});

// ── Describing without a model ────────────────────────────────────────────────

describe('describeObserved', () => {
  test('says nothing about a metric below its sample threshold', () => {
    const observed = computeObserved([
      { id: 'a', title: 'x', estimatedDuration: 60, timeTracked: 300, tags: ['x'], archived: false, history: [], createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
    ], { now: new Date('2026-09-05T00:00:00.000Z') });
    const lines = describeObserved(observed);
    expect(lines.join(' ')).not.toMatch(/estimate/i);
  });

  test('states an under-estimate once there is enough data', () => {
    const observed = computeObserved(
      Array.from({ length: 6 }, (_, i) => ({
        id: `t${i}`, title: `t${i}`, tags: ['admin'], estimatedDuration: 60, timeTracked: 120,
        archived: false, history: [], createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z',
      })),
      { now: new Date('2026-09-05T00:00:00.000Z') },
    );
    expect(describeObserved(observed).join(' ')).toMatch(/2× the time they estimate/);
  });

  test('handles a null observed layer', () => {
    expect(describeObserved(null)).toEqual([]);
  });
});

describe('describeUnderstanding', () => {
  test('returns active insights only', () => {
    const u = {
      traits: [
        { status: 'active', statement: 'keep me' },
        { status: 'user-rejected', statement: 'drop me' },
        { status: 'stale', statement: 'drop me too' },
        { status: 'active', statement: '   ' },
        null,
      ],
    };
    const got = describeUnderstanding(u).map(i => i.statement);
    expect(got).toEqual(['keep me']);
  });
});
