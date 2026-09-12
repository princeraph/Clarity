import { describe, test, expect } from '@jest/globals';
import {
  toProposal, parseProposals, mergeProposals, statementKey,
  unresolvedEvidence, proposalToInsight, declinedInsight,
  MAX_ELICITED_CONFIDENCE, MAX_PENDING,
} from '../src/profile/elicitation.js';
import { addInsight, mergeInsights, deriveInsights, activeInsights } from '../src/profile/insights.js';
import { buildElicitationPrompt, metricPaths, NotLocalError } from '../src/profile/brief.js';
import { emptyProfile } from '../src/profile/store.js';

const corpus = {
  taskIds: new Set(['task-1', 'task-2']),
  journalIds: new Set(['j-1']),
  observed: { estimation: { medianRatio: 2, samples: 7, enough: true, bias: 'under' }, latency: { samples: 0 } },
};

const good = (over = {}) => ({
  category: 'blockers',
  statement: 'You avoid starting work you have not scoped.',
  confidence: 0.5,
  rationale: 'Three tasks sat untouched until their deadline moved.',
  evidence: [{ kind: 'task', ref: 'task-1', note: 'moved twice' }],
  ...over,
});

// ── The rule the whole stage rests on ─────────────────────────────────────────

describe('a citation that does not resolve is an invented one', () => {
  test('refuses a task id that does not exist', () => {
    const { error } = toProposal(good({ evidence: [{ kind: 'task', ref: 'task-999' }] }), corpus);
    expect(error).toMatch(/task-999.*does not exist/);
  });

  test('refuses a journal entry that does not exist', () => {
    const { error } = toProposal(good({ evidence: [{ kind: 'journal', ref: 'j-fake' }] }), corpus);
    expect(error).toMatch(/journal entry j-fake/);
  });

  test('refuses a metric path that is not in the observed layer', () => {
    const { error } = toProposal(good({ evidence: [{ kind: 'metric', ref: 'observed.focus.score' }] }), corpus);
    expect(error).toMatch(/not in the observed layer/);
  });

  test('accepts a metric path that really resolves', () => {
    const { proposal } = toProposal(good({ evidence: [{ kind: 'metric', ref: 'observed.estimation.medianRatio' }] }), corpus);
    expect(proposal.statement).toBeTruthy();
  });

  test('a path that exists but holds null does not count as resolved', () => {
    const bad = { observed: { rhythm: { peakHour: null } } };
    expect(unresolvedEvidence([{ kind: 'metric', ref: 'observed.rhythm.peakHour' }], bad)).toHaveLength(1);
  });

  test('refuses an evidence kind it does not know', () => {
    const { error } = toProposal(good({ evidence: [{ kind: 'vibes', ref: 'task-1' }] }), corpus);
    expect(error).toMatch(/unknown evidence kind/);
  });

  test('refuses a proposal citing nothing at all', () => {
    expect(toProposal(good({ evidence: [] }), corpus).error).toMatch(/at least one piece of evidence/);
  });
});

// ── What the model is not allowed to decide ───────────────────────────────────

describe('the model does not get to set its own authority', () => {
  test('confidence is capped below anything the measured layer can reach', () => {
    const { proposal } = toProposal(good({ confidence: 0.99 }), corpus);
    expect(proposal.confidence).toBe(MAX_ELICITED_CONFIDENCE);
  });

  test('a missing or absurd confidence still lands in range', () => {
    expect(toProposal(good({ confidence: undefined }), corpus).proposal.confidence).toBeLessThanOrEqual(MAX_ELICITED_CONFIDENCE);
    expect(toProposal(good({ confidence: -4 }), corpus).proposal.confidence).toBeGreaterThan(0);
  });

  test('a proposal cannot claim to be an observation', () => {
    const { proposal } = toProposal(good({ source: 'observed' }), corpus);
    expect(proposal.source).toBe('elicited');
  });

  test('a proposal cannot arrive pre-accepted', () => {
    const { proposal } = toProposal(good({ status: 'accepted' }), corpus);
    expect(proposal.status).toBe('pending');
  });

  test('refuses a category it does not recognise', () => {
    expect(toProposal(good({ category: 'diagnosis' }), corpus).error).toMatch(/unknown category/);
  });

  test('refuses an essay dressed up as one claim', () => {
    expect(toProposal(good({ statement: 'x'.repeat(241) }), corpus).error).toMatch(/too long/);
  });
});

// ── Parsing whatever the model actually returned ──────────────────────────────

describe('parseProposals survives real model output', () => {
  test('pulls the array out of surrounding prose', () => {
    const raw = `Sure! Here you go:\n${JSON.stringify([good()])}\nHope that helps.`;
    expect(parseProposals(raw, corpus).proposals).toHaveLength(1);
  });

  test('prose with no array yields nothing, not an exception', () => {
    const { proposals, refused } = parseProposals('I could not find any patterns.', corpus);
    expect(proposals).toHaveLength(0);
    expect(refused[0].error).toMatch(/no JSON array/);
  });

  test('unparseable JSON is reported, not thrown', () => {
    expect(() => parseProposals('[{"statement": ', corpus)).not.toThrow();
    expect(parseProposals('[{"statement": ', corpus).refused).toHaveLength(1);
  });

  test('accepts {proposals: [...]} as well as a bare array', () => {
    expect(parseProposals({ proposals: [good()] }, corpus).proposals).toHaveLength(1);
  });

  test('keeps the good ones and reports the bad ones from the same reply', () => {
    const { proposals, refused } = parseProposals(
      [good(), good({ evidence: [{ kind: 'task', ref: 'nope' }] })], corpus);
    expect(proposals).toHaveLength(1);
    expect(refused).toHaveLength(1);
  });
});

// ── The queue ─────────────────────────────────────────────────────────────────

describe('the pending queue', () => {
  const profileWith = (over = {}) => ({ ...emptyProfile(), ...over });

  test('rewording does not get a declined idea back in', () => {
    const p = toProposal(good(), corpus).proposal;
    const profile = profileWith();
    profile.understanding.blockers = [declinedInsight(p, { reason: 'not true' })];

    const reworded = toProposal(good({ statement: '  YOU avoid starting work you have not scoped!! ' }), corpus).proposal;
    expect(reworded.key).toBe(p.key);
    const merged = mergeProposals(profile, [reworded]);
    expect(merged.added).toHaveLength(0);
    expect(merged.skipped[0].why).toMatch(/rejected this before/);
  });

  test('does not re-propose something already believed', () => {
    const p = toProposal(good(), corpus).proposal;
    const profile = profileWith();
    profile.understanding = addInsight(profile.understanding, proposalToInsight(p)).understanding;
    expect(mergeProposals(profile, [p]).skipped[0].why).toMatch(/already in your profile/);
  });

  test('does not queue the same thing twice', () => {
    const p = toProposal(good(), corpus).proposal;
    const profile = profileWith({ proposals: [p] });
    expect(mergeProposals(profile, [p]).skipped[0].why).toMatch(/already waiting/);
  });

  test('the queue has a ceiling, and says so rather than dropping silently', () => {
    const pending = Array.from({ length: MAX_PENDING }, (_, i) =>
      toProposal(good({ statement: `Statement number ${i}.` }), corpus).proposal);
    const profile = profileWith({ proposals: pending });
    const extra = toProposal(good({ statement: 'One more thing entirely.' }), corpus).proposal;
    const merged = mergeProposals(profile, [extra]);
    expect(merged.added).toHaveLength(0);
    expect(merged.skipped[0].why).toMatch(/queue is full/);
  });

  test('one run cannot flood the queue', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      toProposal(good({ statement: `Distinct claim ${i}.` }), corpus).proposal);
    expect(mergeProposals(profileWith(), many).added.length).toBeLessThanOrEqual(5);
  });
});

// ── The gate itself ───────────────────────────────────────────────────────────

describe('nothing reaches the profile unaccepted', () => {
  test('a proposal is not an insight until it is accepted', () => {
    const profile = emptyProfile();
    const p = toProposal(good(), corpus).proposal;
    profile.proposals = mergeProposals(profile, [p]).proposals;

    expect(profile.proposals).toHaveLength(1);
    expect(activeInsights(profile.understanding)).toHaveLength(0);

    profile.understanding = addInsight(profile.understanding, proposalToInsight(p)).understanding;
    expect(activeInsights(profile.understanding)).toHaveLength(1);
  });

  test('accepting one proposal does not stale the measured findings', () => {
    // The trap: mergeInsights reads `incoming` as the complete derived set and
    // stales every observation missing from it. Accepting must not go through it.
    const observed = {
      version: 2,
      estimation: { enough: true, bias: 'under', medianRatio: 2, samples: 8, byArea: {} },
      slippage: { chronic: [] }, latency: { enough: false }, abandonment: { enough: false },
      rhythm: { enough: false, peakHour: null },
    };
    let understanding = mergeInsights(emptyProfile().understanding, deriveInsights(observed)).understanding;
    const before = activeInsights(understanding).length;
    expect(before).toBeGreaterThan(0);

    const p = toProposal(good(), corpus).proposal;
    understanding = addInsight(understanding, proposalToInsight(p)).understanding;

    expect(activeInsights(understanding)).toHaveLength(before + 1);
  });

  test('accepting something already rejected is refused', () => {
    const p = toProposal(good(), corpus).proposal;
    let understanding = emptyProfile().understanding;
    understanding.blockers = [declinedInsight(p, { reason: 'no' })];
    const result = addInsight(understanding, proposalToInsight(p));
    expect(result.added).toBe(false);
    expect(result.error).toMatch(/rejected before/);
  });

  test('a declined proposal keeps its evidence, so the record stays checkable', () => {
    const p = toProposal(good(), corpus).proposal;
    const rec = declinedInsight(p, { reason: 'wrong about me' });
    expect(rec.status).toBe('user-rejected');
    expect(rec.rejectedReason).toBe('wrong about me');
    expect(rec.evidence).toEqual(p.evidence);
  });
});

// ── The prompt ────────────────────────────────────────────────────────────────

describe('the elicitation prompt', () => {
  const tasks = [{ id: 'task-1', title: 'Write the proposal', archived: false, status: 'not_started' }];
  const journal = [{ id: 'j-1', kind: 'exchange', at: '2026-09-01T10:00:00.000Z', text: 'I keep putting this off' }];

  test('refuses to build for a provider that is not local', () => {
    expect(() => buildElicitationPrompt({ profile: emptyProfile(), tasks, journal, providerIsLocal: false }))
      .toThrow(NotLocalError);
  });

  test('names the refusal well enough to show the user', () => {
    try { buildElicitationPrompt({ providerIsLocal: false }); }
    catch (err) {
      expect(err.status).toBe(409);
      expect(err.message).toMatch(/local model/);
    }
  });

  test('lists the refs the model may cite, so citations can resolve', () => {
    const { text, citable } = buildElicitationPrompt({
      profile: emptyProfile(), tasks, journal, providerIsLocal: true });
    expect(text).toContain('task task-1');
    expect(text).toContain('journal j-1');
    expect(citable).toBeGreaterThan(0);
  });

  test('metricPaths skips nulls and never walks forever', () => {
    const paths = metricPaths({ estimation: { medianRatio: 2, bias: null }, deep: { a: { b: { c: 1 } } } });
    expect(paths).toContain('observed.estimation.medianRatio');
    expect(paths).not.toContain('observed.estimation.bias');
    expect(paths.every(p => p.split('.').length <= 4)).toBe(true);
  });

  test('tells the model what is already known, so it does not repeat it', () => {
    const profile = emptyProfile();
    profile.understanding.traits = [{
      id: 'i1', key: 'k', category: 'traits', statement: 'You work best late at night.',
      confidence: 0.8, status: 'active', evidence: [{ kind: 'metric', ref: 'x' }],
    }];
    const { text } = buildElicitationPrompt({ profile, tasks, journal, providerIsLocal: true });
    expect(text).toContain('You work best late at night.');
    expect(text).toMatch(/do not repeat/i);
  });
});

describe('statementKey', () => {
  test('ignores casing, punctuation and spacing', () => {
    expect(statementKey('You avoid deep work.')).toBe(statementKey('  you AVOID   deep work!!! '));
  });
  test('separates genuinely different claims', () => {
    expect(statementKey('You avoid deep work.')).not.toBe(statementKey('You enjoy deep work.'));
  });
});
