import { describe, test, expect } from '@jest/globals';
import {
  emptyThread, setBlocker, addNeed, toggleNeed, addOption, judgeOption,
  askCheckIn, answerCheckIn, resolveThread, muteThread,
  isDue, dueThreads, stalledTasks,
  BACKOFF_DAYS, MAX_UNANSWERED, STALL_DAYS,
} from '../src/threads/logic.js';

const T0 = new Date('2026-09-01T09:00:00.000Z');
const plus = (days, from = T0) => new Date(from.getTime() + days * 86400000);
const daysBetween = (a, b) => Math.round((Date.parse(a) - b.getTime()) / 86400000);

// ── Silence is an answer ──────────────────────────────────────────────────────

describe('an unanswered check-in backs off instead of repeating', () => {
  test('the gap grows 1 → 3 → 7 → 14', () => {
    let t = emptyThread('task-1', { now: T0 });
    const gaps = [];
    let at = T0;
    for (let i = 0; i < BACKOFF_DAYS.length - 1; i++) {
      t = askCheckIn(t, 'Still stuck?', { now: at });
      gaps.push(daysBetween(t.nextCheckIn, at));
      at = plus(1, at);
    }
    expect(gaps).toEqual(BACKOFF_DAYS.slice(1, BACKOFF_DAYS.length));
  });

  test('after four unanswered asks it parks itself and stops', () => {
    let t = emptyThread('task-1', { now: T0 });
    for (let i = 0; i < MAX_UNANSWERED; i++) t = askCheckIn(t, 'Still stuck?', { now: plus(i) });
    expect(t.state).toBe('parked');
    expect(t.nextCheckIn).toBeNull();
    expect(isDue(t, plus(365))).toBe(false);   // a year later, still silent
  });

  test('answering resets the backoff and wakes a parked thread', () => {
    let t = emptyThread('task-1', { now: T0 });
    for (let i = 0; i < MAX_UNANSWERED; i++) t = askCheckIn(t, 'Still stuck?', { now: plus(i) });
    expect(t.state).toBe('parked');

    t = answerCheckIn(t, 'Sorry — still waiting on the quote.', { now: plus(10) });
    expect(t.unanswered).toBe(0);
    expect(t.state).toBe('open');
    expect(daysBetween(t.nextCheckIn, plus(10))).toBe(BACKOFF_DAYS[0]);
  });

  test('the answer lands on the ask it belongs to, and the record is kept', () => {
    let t = emptyThread('task-1', { now: T0 });
    t = askCheckIn(t, 'What is in the way?', { now: plus(1) });
    t = answerCheckIn(t, 'I need the numbers from Bara.', { now: plus(2) });
    expect(t.checkIns).toHaveLength(1);
    expect(t.checkIns[0].asked).toBe('What is in the way?');
    expect(t.checkIns[0].answer).toBe('I need the numbers from Bara.');
    expect(t.checkIns[0].answeredAt).toBeTruthy();
  });

  test('a second ask does not overwrite the first answer', () => {
    let t = emptyThread('task-1', { now: T0 });
    t = askCheckIn(t, 'One?', { now: plus(1) });
    t = answerCheckIn(t, 'first answer', { now: plus(1) });
    t = askCheckIn(t, 'Two?', { now: plus(5) });
    t = answerCheckIn(t, 'second answer', { now: plus(5) });
    expect(t.checkIns.map(c => c.answer)).toEqual(['first answer', 'second answer']);
  });
});

describe('being told to stop is not the same as being ignored', () => {
  test('mute is recorded as the user’s instruction, not Clarity’s inference', () => {
    const t = muteThread(emptyThread('task-1', { now: T0 }), { now: T0 });
    expect(t.state).toBe('parked');
    expect(t.mutedByUser).toBe(true);
    expect(t.nextCheckIn).toBeNull();
  });

  test('a parked thread Clarity gave up on carries no such flag', () => {
    let t = emptyThread('task-1', { now: T0 });
    for (let i = 0; i < MAX_UNANSWERED; i++) t = askCheckIn(t, 'x', { now: plus(i) });
    expect(t.state).toBe('parked');
    expect(t.mutedByUser).toBeUndefined();
  });
});

// ── What the person tells us ──────────────────────────────────────────────────

describe('blockers and needs', () => {
  test('stating a blocker moves the thread to blocked and stamps when', () => {
    const t = setBlocker(emptyThread('task-1', { now: T0 }), 'Waiting on the landlord', { now: T0 });
    expect(t.state).toBe('blocked');
    expect(t.blocker.text).toBe('Waiting on the landlord');
    expect(t.blocker.since).toBe(T0.toISOString());
  });

  test('restating the same blocker keeps the original date', () => {
    let t = setBlocker(emptyThread('task-1', { now: T0 }), 'Waiting on the landlord', { now: T0 });
    t = setBlocker(t, 'Waiting on the landlord', { now: plus(9) });
    expect(t.blocker.since).toBe(T0.toISOString());   // blocked for 9 days, not freshly blocked
  });

  test('a different blocker restarts the clock', () => {
    let t = setBlocker(emptyThread('task-1', { now: T0 }), 'Waiting on the landlord', { now: T0 });
    t = setBlocker(t, 'Now waiting on the bank', { now: plus(9) });
    expect(t.blocker.since).toBe(plus(9).toISOString());
  });

  test('clearing the blocker unblocks the thread', () => {
    let t = setBlocker(emptyThread('task-1', { now: T0 }), 'Waiting', { now: T0 });
    t = setBlocker(t, '   ', { now: plus(1) });
    expect(t.blocker).toBeNull();
    expect(t.state).toBe('open');
  });

  test('needs can be added and ticked off', () => {
    let t = addNeed(emptyThread('task-1', { now: T0 }), 'The quote from the printer', { now: T0 });
    expect(t.needs).toHaveLength(1);
    t = toggleNeed(t, t.needs[0].id, { now: plus(1) });
    expect(t.needs[0].done).toBe(true);
  });

  test('empty text is ignored rather than stored as a blank need', () => {
    expect(addNeed(emptyThread('task-1', { now: T0 }), '   ', { now: T0 }).needs).toHaveLength(0);
  });
});

// ── Ways forward ──────────────────────────────────────────────────────────────

describe('options', () => {
  test('records whether a way forward came from the person or was suggested', () => {
    let t = addOption(emptyThread('task-1', { now: T0 }), { text: 'Split it in two', source: 'suggested' }, { now: T0 });
    t = addOption(t, { text: 'Just ask Bara directly', source: 'user' }, { now: T0 });
    expect(t.options.map(o => o.source)).toEqual(['suggested', 'user']);
  });

  test('an unknown source is not trusted — it falls back to user', () => {
    const t = addOption(emptyThread('task-1', { now: T0 }), { text: 'x', source: 'observed' }, { now: T0 });
    expect(t.options[0].source).toBe('user');
  });

  test('the same option is not added twice', () => {
    let t = addOption(emptyThread('task-1', { now: T0 }), { text: 'Split it in two' }, { now: T0 });
    t = addOption(t, { text: '  split IT in two ' }, { now: T0 });
    expect(t.options).toHaveLength(1);
  });

  test('choosing one moves the thread, and the reason is kept', () => {
    let t = addOption(emptyThread('task-1', { now: T0 }), { text: 'Split it in two' }, { now: T0 });
    t = judgeOption(t, t.options[0].id, 'chosen', { note: 'smallest first step', now: plus(1) });
    expect(t.state).toBe('moving');
    expect(t.options[0].note).toBe('smallest first step');
  });

  test('ruling one out keeps it — "we tried that" is the useful part', () => {
    let t = addOption(emptyThread('task-1', { now: T0 }), { text: 'Ask for an extension' }, { now: T0 });
    t = judgeOption(t, t.options[0].id, 'ruled-out', { note: 'already used one', now: plus(1) });
    expect(t.options).toHaveLength(1);
    expect(t.options[0].status).toBe('ruled-out');
    expect(t.options[0].note).toBe('already used one');
  });

  test('refuses a status it does not know', () => {
    const t = addOption(emptyThread('task-1', { now: T0 }), { text: 'x' }, { now: T0 });
    expect(() => judgeOption(t, t.options[0].id, 'maybe')).toThrow(/unknown option status/);
  });
});

// ── Due ───────────────────────────────────────────────────────────────────────

describe('what is due', () => {
  test('not due before its time', () => {
    expect(isDue(emptyThread('task-1', { now: T0 }), plus(0.5))).toBe(false);
  });
  test('due once the date passes', () => {
    expect(isDue(emptyThread('task-1', { now: T0 }), plus(2))).toBe(true);
  });
  test('a resolved thread is never due', () => {
    expect(isDue(resolveThread(emptyThread('task-1', { now: T0 }), { now: T0 }), plus(99))).toBe(false);
  });
  test('picks only the due ones out of a set', () => {
    const threads = {
      a: emptyThread('a', { now: T0 }),
      b: emptyThread('b', { now: plus(30) }),
      c: resolveThread(emptyThread('c', { now: T0 }), { now: T0 }),
    };
    expect(dueThreads(threads, plus(2)).map(t => t.taskId)).toEqual(['a']);
  });
});

// ── Which tasks deserve a thread ──────────────────────────────────────────────

describe('stalledTasks — not every task is a conversation', () => {
  const task = (over = {}) => ({
    id: 't', title: 'A task', status: 'not_started', archived: false,
    deadline: null, history: [], createdAt: T0.toISOString(), updatedAt: T0.toISOString(), ...over,
  });
  const slip = (from, to) => ({ at: T0.toISOString(), type: 'deadline', from, to });

  test('a task touched yesterday is not stalled', () => {
    expect(stalledTasks([task({ updatedAt: plus(-1, plus(5)).toISOString() })], { now: plus(5) })).toHaveLength(0);
  });

  test('silence past the threshold counts', () => {
    const out = stalledTasks([task()], { now: plus(STALL_DAYS + 1) });
    expect(out).toHaveLength(1);
    expect(out[0].why).toMatch(/untouched for \d+ days/);
  });

  test('two postponements count even if it was touched today', () => {
    const out = stalledTasks(
      [task({ updatedAt: plus(5).toISOString(), history: [slip('2026-09-10', '2026-09-20'), slip('2026-09-20', '2026-09-30')] })],
      { now: plus(5) });
    expect(out[0].why).toBe('postponed 2 times');
  });

  // Seen in the onboarding: a task due today, created in the evening, came up
  // as "past its deadline". Date.parse read the date as midnight UTC.
  test('a task due today is not overdue, at any hour of the day', () => {
    for (const hour of [0, 9, 20, 23]) {
      const evening = new Date(2026, 9, 7, hour, 30);
      const out = stalledTasks([task({ deadline: '2026-10-07', updatedAt: evening.toISOString() })], { now: evening });
      expect(out).toHaveLength(0);
    }
    const nextDay = new Date(2026, 9, 8, 0, 30);
    expect(stalledTasks([task({ deadline: '2026-10-07', updatedAt: nextDay.toISOString() })], { now: nextDay })[0].code).toBe('overdue');
  });

  test('moves made by auto-reschedule are not postponements', () => {
    const auto = (from, to) => ({ ...slip(from, to), auto: true });
    const out = stalledTasks(
      [task({ updatedAt: plus(5).toISOString(), history: [auto('2026-09-10', '2026-09-11'), auto('2026-09-11', '2026-09-12')] })],
      { now: plus(5) });
    expect(out.filter(o => o.code === 'postponed')).toHaveLength(0);
  });

  test('a deadline pulled earlier is not a postponement', () => {
    const out = stalledTasks(
      [task({ updatedAt: plus(5).toISOString(), history: [slip('2026-09-20', '2026-09-10')] })],
      { now: plus(5) });
    expect(out).toHaveLength(0);
  });

  test('overdue and unfinished counts', () => {
    const out = stalledTasks([task({ updatedAt: plus(5).toISOString(), deadline: '2026-09-02' })], { now: plus(5) });
    expect(out[0].why).toMatch(/past its deadline/);
  });

  test('done and archived tasks are left alone', () => {
    expect(stalledTasks([
      task({ id: 'a', status: 'done' }),
      task({ id: 'b', archived: true }),
    ], { now: plus(99) })).toHaveLength(0);
  });

  test('a task that already has a thread is not offered again', () => {
    const out = stalledTasks([task({ id: 'x' })], { now: plus(99), hasThread: id => id === 'x' });
    expect(out).toHaveLength(0);
  });

  test('most stuck first', () => {
    const out = stalledTasks([
      task({ id: 'quiet', updatedAt: T0.toISOString() }),
      task({ id: 'slipped', updatedAt: plus(20).toISOString(), history: [slip('2026-09-10', '2026-09-20'), slip('2026-09-20', '2026-09-30')] }),
    ], { now: plus(20) });
    expect(out[0].taskId).toBe('slipped');
  });
});
