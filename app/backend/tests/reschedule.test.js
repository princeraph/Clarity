import { describe, test, expect } from '@jest/globals';
import { rescheduleOverdue, featuresOf, FEATURE_DEFAULTS } from '../src/reschedule.js';
import { computeSlippage } from '../src/profile/metrics.js';

// "Auto-reschedule stale tasks" was a toggle that saved nothing and did
// nothing. It now moves overdue, unfinished tasks to today — and those moves
// must not read as the person slipping their deadlines.
const NOW = new Date(2026, 9, 7, 9, 0);   // 7 October 2026, 09:00 local
const task = (over) => ({ id: over.id, title: over.id, status: 'not_started', history: [], ...over });

describe('auto-reschedule', () => {
  test('an overdue, unfinished task moves to today; nothing else moves', () => {
    const tasks = [
      task({ id: 'late', deadline: '2026-10-05', time: '10:30' }),
      task({ id: 'today', deadline: '2026-10-07' }),
      task({ id: 'later', deadline: '2026-10-20' }),
      task({ id: 'none' }),
      task({ id: 'done', deadline: '2026-10-01', status: 'done' }),
      task({ id: 'archived', deadline: '2026-10-01', archived: true }),
    ];
    const { tasks: next, moved } = rescheduleOverdue(tasks, NOW);
    expect(moved).toEqual(['late']);
    const late = next.find(t => t.id === 'late');
    expect(late.deadline).toBe('2026-10-07');
    expect(late.time).toBe('10:30');                       // the hour stays
    expect(late.history.at(-1)).toMatchObject({ type: 'deadline', from: '2026-10-05', to: '2026-10-07', auto: true });
    for (const id of ['today', 'later', 'none', 'done', 'archived']) {
      expect(next.find(t => t.id === id)).toBe(tasks.find(t => t.id === id));
    }
  });

  test('running it twice the same day moves nothing the second time', () => {
    const once = rescheduleOverdue([task({ id: 'a', deadline: '2026-10-01' })], NOW).tasks;
    expect(rescheduleOverdue(once, NOW).moved).toEqual([]);
  });

  test('its moves are not counted as the person slipping deadlines', () => {
    // A task left overdue for three days: three automatic moves, zero slips.
    let tasks = [task({ id: 'a', deadline: '2026-10-04' })];
    for (const day of [5, 6, 7]) tasks = rescheduleOverdue(tasks, new Date(2026, 9, day, 9)).tasks;
    expect(tasks[0].history.filter(h => h.auto)).toHaveLength(3);
    expect(computeSlippage(tasks).totalSlips).toBe(0);
    // A move the person made still counts.
    tasks[0].history.push({ at: NOW.toISOString(), type: 'deadline', from: '2026-10-07', to: '2026-10-10' });
    expect(computeSlippage(tasks).totalSlips).toBe(1);
  });
});

describe('the features section of Settings', () => {
  test('defaults until changed, and only booleans are read', () => {
    expect(featuresOf({})).toEqual(FEATURE_DEFAULTS);
    expect(featuresOf({ features: { autoReschedule: true, dailyPlan: 'no', unknown: true } }))
      .toEqual({ ...FEATURE_DEFAULTS, autoReschedule: true });
  });
});
