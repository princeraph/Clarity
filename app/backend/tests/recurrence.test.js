import { describe, test, expect } from '@jest/globals';
import { nextDeadline, anchorDayOf } from '../src/recurrence.js';
import { rescheduleOverdue } from '../src/reschedule.js';

// Monthly used setMonth(+1), which overflows: 31 January → 3 March.
describe('monthly recurrence', () => {
  test('a short month clamps to its last day instead of skipping', () => {
    expect(nextDeadline('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextDeadline('2026-01-30', 'monthly')).toBe('2026-02-28');
    expect(nextDeadline('2026-01-29', 'monthly')).toBe('2026-02-28');
    expect(nextDeadline('2028-01-31', 'monthly')).toBe('2028-02-29');   // leap year
    expect(nextDeadline('2026-03-31', 'monthly')).toBe('2026-04-30');
    expect(nextDeadline('2026-08-31', 'monthly')).toBe('2026-09-30');
  });

  test('ordinary days and year end are unchanged', () => {
    expect(nextDeadline('2026-01-15', 'monthly')).toBe('2026-02-15');
    expect(nextDeadline('2026-12-31', 'monthly')).toBe('2027-01-31');
    expect(nextDeadline('2026-12-15', 'monthly')).toBe('2027-01-15');
  });

  test('the series returns to its day after a short month — no drift', () => {
    const chain = ['2026-01-31'];
    for (let i = 0; i < 4; i++) chain.push(nextDeadline(chain[chain.length - 1], 'monthly', 31));
    expect(chain).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });

  test('the anchor comes from recurrenceDay first, then the deadline', () => {
    expect(anchorDayOf({ deadline: '2026-02-28', recurrenceDay: 31 })).toBe(31);
    expect(anchorDayOf({ deadline: '2026-02-28' })).toBe(28);
    expect(anchorDayOf({ deadline: null })).toBe(null);
    expect(anchorDayOf({ deadline: '2026-02-28', recurrenceDay: 'x' })).toBe(28);
  });
});

describe('daily and weekly', () => {
  test('cross month and year ends', () => {
    expect(nextDeadline('2026-01-31', 'daily')).toBe('2026-02-01');
    expect(nextDeadline('2026-12-31', 'daily')).toBe('2027-01-01');
    expect(nextDeadline('2026-12-28', 'weekly')).toBe('2027-01-04');
  });
  test('no deadline, or an unreadable one, gives no next date', () => {
    expect(nextDeadline(null, 'monthly')).toBe(null);
    expect(nextDeadline('nope', 'monthly')).toBe(null);
  });
});

describe('auto-reschedule keeps the day of a monthly series', () => {
  test('an overdue monthly task moved to today still aims at its own day', () => {
    const now = new Date(2026, 1, 3, 9, 0);   // 3 February 2026
    const { tasks } = rescheduleOverdue([
      { id: 'rent', title: 'rent', status: 'not_started', recurring: 'monthly', deadline: '2026-01-31', history: [] },
      { id: 'once', title: 'once', status: 'not_started', recurring: 'none', deadline: '2026-01-31', history: [] },
    ], now);
    const rent = tasks.find(t => t.id === 'rent');
    expect(rent.deadline).toBe('2026-02-03');
    expect(rent.recurrenceDay).toBe(31);
    expect(nextDeadline(rent.deadline, 'monthly', anchorDayOf(rent))).toBe('2026-03-31');
    expect(tasks.find(t => t.id === 'once').recurrenceDay).toBeUndefined();
  });
});
