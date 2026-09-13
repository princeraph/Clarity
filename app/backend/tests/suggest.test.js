import { describe, test, expect } from '@jest/globals';
import {
  mayInterrupt, makeQuietRule, isQuietActive, activeQuietRules, inQuietHours,
  countToday, lastDeliveryAt, DEFAULTS,
} from '../src/suggest/policy.js';
import { candidates, pick } from '../src/suggest/candidates.js';

const AT = (h, d = 13) => new Date(2026, 8, d, h, 0, 0);   // Sep 2026, local
const ago = (from, minutes) => new Date(from.getTime() - minutes * 60000).toISOString();

// ── The rule that outranks every other ────────────────────────────────────────

describe('a quiet rule beats everything Clarity might think is urgent', () => {
  const now = AT(10);

  test('"stop for a while" holds even with budget to spare', () => {
    const quiet = [makeQuietRule({ kind: 'duration', minutes: 120 }, { now })];
    const r = mayInterrupt({ now, quiet, sentToday: 0 });
    expect(r.allowed).toBe(false);
    expect(r.code).toBe('quiet-rule');
  });

  test('it lifts itself when the time is up', () => {
    const quiet = [makeQuietRule({ kind: 'duration', minutes: 60 }, { now })];
    expect(mayInterrupt({ now: AT(12), quiet }).allowed).toBe(true);
  });

  test('"until this is done" holds while the task is open', () => {
    const quiet = [makeQuietRule({ kind: 'untilTaskDone', taskId: 't1' }, { now })];
    const tasks = [{ id: 't1', status: 'in_progress', archived: false }];
    expect(mayInterrupt({ now, quiet, tasks }).allowed).toBe(false);
  });

  test('and lifts the moment it is done', () => {
    const quiet = [makeQuietRule({ kind: 'untilTaskDone', taskId: 't1' }, { now })];
    expect(mayInterrupt({ now, quiet, tasks: [{ id: 't1', status: 'done', archived: false }] }).allowed).toBe(true);
  });

  test('deleting the task lifts it too, rather than silencing Clarity forever', () => {
    // Otherwise the rule outlives its reason with nothing on screen to explain it.
    const quiet = [makeQuietRule({ kind: 'untilTaskDone', taskId: 'gone' }, { now })];
    expect(isQuietActive(quiet[0], { now, tasks: [] })).toBe(false);
  });

  test('but an unknown task list keeps quiet rather than guessing', () => {
    const rule = makeQuietRule({ kind: 'untilTaskDone', taskId: 't1' }, { now });
    expect(isQuietActive(rule, { now, tasks: null })).toBe(true);
  });

  test('"stop entirely" never expires on its own', () => {
    const quiet = [makeQuietRule({ kind: 'indefinite' }, { now })];
    expect(mayInterrupt({ now: AT(10, 30), quiet }).allowed).toBe(false);
  });

  test('refuses a rule it cannot honour', () => {
    expect(() => makeQuietRule({ kind: 'duration' })).toThrow(/minutes/);
    expect(() => makeQuietRule({ kind: 'untilTaskDone' })).toThrow(/taskId/);
    expect(() => makeQuietRule({ kind: 'whenever' })).toThrow(/unknown quiet kind/);
  });

  test('expired rules drop out of the active list', () => {
    const now = AT(10);
    const rules = [
      makeQuietRule({ kind: 'duration', minutes: 5 }, { now: AT(8) }),   // long gone
      makeQuietRule({ kind: 'indefinite' }, { now }),
    ];
    expect(activeQuietRules(rules, { now })).toHaveLength(1);
  });
});

// ── Night ─────────────────────────────────────────────────────────────────────

describe('the night guard', () => {
  test('a window that wraps midnight is inside at both ends', () => {
    expect(inQuietHours(23)).toBe(true);
    expect(inQuietHours(3)).toBe(true);
    expect(inQuietHours(6)).toBe(true);
    expect(inQuietHours(7)).toBe(false);
    expect(inQuietHours(14)).toBe(false);
  });

  test('a window inside one day behaves normally', () => {
    const w = { from: 13, to: 14 };
    expect(inQuietHours(13, w)).toBe(true);
    expect(inQuietHours(14, w)).toBe(false);
    expect(inQuietHours(2, w)).toBe(false);
  });

  test('nobody is prompted at 3am, even with everything else clear', () => {
    expect(mayInterrupt({ now: AT(3), sentToday: 0 }).code).toBe('night');
  });

  test('an empty window disables the guard rather than silencing everything', () => {
    expect(inQuietHours(3, { from: 0, to: 0 })).toBe(false);
  });
});

// ── The budget ────────────────────────────────────────────────────────────────

describe('the interruption budget', () => {
  const now = AT(10);

  test('allows the first one of the day', () => {
    const r = mayInterrupt({ now, sentToday: 0 });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(DEFAULTS.maxSuggestionsPerDay);
  });

  test('stops at the limit', () => {
    const r = mayInterrupt({ now, sentToday: DEFAULTS.maxSuggestionsPerDay, lastSentAt: ago(now, 999) });
    expect(r.allowed).toBe(false);
    expect(r.code).toBe('budget-spent');
  });

  test('a budget of zero means silence, and says so', () => {
    expect(mayInterrupt({ now, preferences: { maxSuggestionsPerDay: 0 } }).code).toBe('budget-zero');
  });

  test('honours the minimum gap, and says how long is left', () => {
    const r = mayInterrupt({ now, sentToday: 1, lastSentAt: ago(now, 30) });
    expect(r.allowed).toBe(false);
    expect(r.code).toBe('too-soon');
    expect(r.waitMinutes).toBe(60);
  });

  test('allows it once the gap has passed', () => {
    expect(mayInterrupt({ now, sentToday: 1, lastSentAt: ago(now, 91) }).allowed).toBe(true);
  });

  test('on-request mode never volunteers', () => {
    expect(mayInterrupt({ now, preferences: { suggestionMode: 'onRequest' } }).code).toBe('on-request');
  });

  test('daily mode allows exactly one', () => {
    const p = { suggestionMode: 'daily' };
    expect(mayInterrupt({ now, preferences: p, sentToday: 0 }).allowed).toBe(true);
    expect(mayInterrupt({ now, preferences: p, sentToday: 1 }).code).toBe('daily-done');
  });

  test('an unknown mode falls back to the default instead of failing open or shut', () => {
    expect(mayInterrupt({ now, preferences: { suggestionMode: 'whenever' }, sentToday: 0 }).allowed).toBe(true);
  });

  test('the most specific refusal is the one reported', () => {
    // Quiet rule AND spent budget AND night: the person is told about the rule
    // they set, not about a limit they never touched.
    const quiet = [makeQuietRule({ kind: 'indefinite' }, { now: AT(3) })];
    expect(mayInterrupt({ now: AT(3), quiet, sentToday: 99 }).code).toBe('quiet-rule');
  });
});

describe('counting deliveries', () => {
  test('a day is local, not UTC', () => {
    const now = AT(10, 13);
    const log = [
      { at: AT(9, 13).toISOString() },
      { at: AT(23, 12).toISOString() },   // yesterday evening
    ];
    expect(countToday(log, now)).toBe(1);
  });

  test('ignores unparseable entries rather than throwing', () => {
    expect(countToday([{ at: 'nonsense' }, null, { at: AT(9).toISOString() }], AT(10))).toBe(1);
  });

  test('finds the most recent delivery regardless of order', () => {
    const log = [{ at: AT(9).toISOString() }, { at: AT(11).toISOString() }, { at: AT(10).toISOString() }];
    expect(lastDeliveryAt(log)).toBe(AT(11).toISOString());
  });

  test('no deliveries means no last delivery', () => {
    expect(lastDeliveryAt([])).toBeNull();
  });
});

// ── What is worth saying ──────────────────────────────────────────────────────

describe('candidates are triggered by arithmetic, not opinion', () => {
  const now = AT(12, 13);
  const task = (over = {}) => ({
    id: 't1', title: 'A task', status: 'not_started', archived: false,
    deadline: null, history: [], createdAt: AT(9, 1).toISOString(), updatedAt: AT(9, 1).toISOString(), ...over,
  });

  test('a due check-in outranks everything — the person agreed to be asked', () => {
    const tasks = [task({ id: 'a', deadline: '2026-09-01' }), task({ id: 'b' })];
    const threads = { b: { taskId: 'b', state: 'blocked', nextCheckIn: AT(9, 13).toISOString(),
                           blocker: { text: 'waiting on the quote', since: AT(9, 10).toISOString() } } };
    const list = candidates({ tasks, threads, now });
    expect(list[0].kind).toBe('check-in');
    expect(list[0].because.code).toBe('blocked-since');
  });

  test('a parked thread is not raised — it parked for a reason', () => {
    const threads = { a: { taskId: 'a', state: 'parked', nextCheckIn: AT(9, 1).toISOString() } };
    const list = candidates({ tasks: [task({ id: 'a' })], threads, now });
    expect(list.some(c => c.kind === 'check-in')).toBe(false);
  });

  test('overdue is measured from the end of the day, not its start', () => {
    const todayStr = '2026-09-13';
    expect(candidates({ tasks: [task({ deadline: todayStr })], now }).some(c => c.kind === 'overdue')).toBe(false);
  });

  test('done and archived tasks are never raised', () => {
    const tasks = [task({ id: 'a', status: 'done', deadline: '2026-09-01' }),
                   task({ id: 'b', archived: true, deadline: '2026-09-01' })];
    expect(candidates({ tasks, now })).toHaveLength(0);
  });

  test('one interruption per task, at its strongest reason', () => {
    // Overdue AND idle AND chronically slipped — still one line, the overdue one.
    const tasks = [task({ id: 'a', deadline: '2026-09-01', updatedAt: AT(9, 1).toISOString() })];
    const observed = { slippage: { chronic: [{ taskId: 'a', title: 'A task', slips: 3, totalDays: 21 }] } };
    const list = candidates({ tasks, observed, now });
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe('overdue');
  });

  test('a chronic slipper that no longer exists is not raised', () => {
    const observed = { slippage: { chronic: [{ taskId: 'gone', title: 'Ghost', slips: 5, totalDays: 40 }] } };
    expect(candidates({ tasks: [], observed, now })).toHaveLength(0);
  });

  test('every candidate carries the fact that triggered it', () => {
    const tasks = [task({ deadline: '2026-09-01' })];
    for (const c of candidates({ tasks, now })) {
      expect(c.because).toBeTruthy();
      expect(typeof c.because.code).toBe('string');
    }
  });
});

describe('pick — saying it twice is how you get muted', () => {
  const now = AT(12, 13);
  const list = [
    { kind: 'overdue', taskId: 'a', priority: 90, title: 'A' },
    { kind: 'stalled', taskId: 'b', priority: 40, title: 'B' },
  ];

  test('takes the strongest when nothing was said recently', () => {
    expect(pick(list, { log: [], now }).taskId).toBe('a');
  });

  test('skips one raised in the last few days', () => {
    const log = [{ kind: 'overdue', taskId: 'a', at: AT(12, 12).toISOString() }];
    expect(pick(list, { log, now }).taskId).toBe('b');
  });

  test('raises it again once enough time has passed', () => {
    const log = [{ kind: 'overdue', taskId: 'a', at: AT(12, 1).toISOString() }];
    expect(pick(list, { log, now }).taskId).toBe('a');
  });

  test('a different reason about the same task is still a new thing to say', () => {
    const log = [{ kind: 'stalled', taskId: 'a', at: AT(12, 12).toISOString() }];
    expect(pick(list, { log, now }).taskId).toBe('a');
  });

  test('nothing left to say returns nothing, not a repeat', () => {
    const log = list.map(c => ({ kind: c.kind, taskId: c.taskId, at: AT(12, 12).toISOString() }));
    expect(pick(list, { log, now })).toBeNull();
  });
});
