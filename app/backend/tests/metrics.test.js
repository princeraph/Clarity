import { describe, test, expect } from '@jest/globals';
import {
  computeEstimation, computeSlippage, computeLatency,
  computeAbandonment, computeRhythm, computeLoad, computeObserved,
  MIN_SAMPLES,
} from '../src/profile/metrics.js';

// ── Builders ──────────────────────────────────────────────────────────────────

let seq = 0;
function task(over = {}) {
  seq++;
  return {
    id: `t${seq}`, title: `Task ${seq}`,
    description: '', deadline: null, time: null,
    estimatedDuration: null, deliverable: '',
    status: 'not_started', notes: '', tags: [], subtasks: [],
    recurring: 'none', timeTracked: 0, timerStarted: null,
    archived: false, archivedAt: null,
    history: [], createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z',
    ...over,
  };
}
const slip = (from, to, at = '2026-09-02T10:00:00.000Z') => ({ at, type: 'deadline', from, to });
const statusAt = (at, to) => ({ at, type: 'status', from: 'not_started', to });

// ── Estimation ────────────────────────────────────────────────────────────────

describe('computeEstimation', () => {
  test('ignores tasks with no estimate or no tracked time', () => {
    const r = computeEstimation([
      task({ estimatedDuration: 60, timeTracked: 0 }),   // never timed
      task({ estimatedDuration: null, timeTracked: 90 }), // never estimated
      task({ estimatedDuration: 0, timeTracked: 90 }),    // zero estimate → no ratio
    ]);
    expect(r.samples).toBe(0);
    expect(r.medianRatio).toBeNull();
  });

  test('a never-timed task must not read as a huge over-estimate', () => {
    // The naive version treats timeTracked 0 as "finished instantly".
    const r = computeEstimation([
      task({ estimatedDuration: 60, timeTracked: 0 }),
      task({ estimatedDuration: 60, timeTracked: 60 }),
    ]);
    expect(r.samples).toBe(1);
    expect(r.medianRatio).toBe(1);
    expect(r.bias).toBeNull(); // still below MIN_SAMPLES
  });

  test('flags consistent under-estimation once there is enough data', () => {
    const tasks = Array.from({ length: MIN_SAMPLES }, () =>
      task({ estimatedDuration: 60, timeTracked: 120, tags: ['admin'] }));
    const r = computeEstimation(tasks);
    expect(r.samples).toBe(MIN_SAMPLES);
    expect(r.medianRatio).toBe(2);
    expect(r.bias).toBe('under');
    expect(r.enough).toBe(true);
    expect(r.byArea.admin.bias).toBe('under');
  });

  test('withholds a verdict below the sample threshold', () => {
    const tasks = Array.from({ length: MIN_SAMPLES - 1 }, () =>
      task({ estimatedDuration: 60, timeTracked: 180 }));
    const r = computeEstimation(tasks);
    expect(r.medianRatio).toBe(3);   // the number is still computed
    expect(r.bias).toBeNull();       // but no conclusion is drawn from it
    expect(r.enough).toBe(false);
  });

  test('near-1 ratios read as accurate, not as a bias', () => {
    const tasks = Array.from({ length: MIN_SAMPLES }, () =>
      task({ estimatedDuration: 100, timeTracked: 105 }));
    expect(computeEstimation(tasks).bias).toBe('accurate');
  });
});

// ── Slippage ──────────────────────────────────────────────────────────────────

describe('computeSlippage', () => {
  test('counts only deadlines moved later', () => {
    const r = computeSlippage([
      task({ history: [slip('2026-09-10', '2026-09-15')] }),  // +5, a slip
      task({ history: [slip('2026-09-20', '2026-09-12')] }),  // pulled earlier
      task({ history: [slip(null, '2026-09-12')] }),          // first set
      task({ history: [slip('2026-09-12', null)] }),          // cleared
    ]);
    expect(r.tasksSlipped).toBe(1);
    expect(r.totalSlips).toBe(1);
    expect(r.medianDaysPerSlip).toBe(5);
  });

  test('accumulates repeated slips on one task and marks it chronic', () => {
    const t = task({
      title: 'Tax return',
      history: [
        slip('2026-09-01', '2026-09-08'),
        slip('2026-09-08', '2026-09-15'),
        slip('2026-09-15', '2026-09-22'),
      ],
    });
    const r = computeSlippage([t]);
    expect(r.totalSlips).toBe(3);
    expect(r.chronic).toHaveLength(1);
    expect(r.chronic[0].title).toBe('Tax return');
    expect(r.chronic[0].totalDays).toBe(21);
  });

  test('two slips is not yet chronic', () => {
    const t = task({ history: [slip('2026-09-01', '2026-09-02'), slip('2026-09-02', '2026-09-03')] });
    expect(computeSlippage([t]).chronic).toHaveLength(0);
  });

  test('survives malformed history entries', () => {
    const t = task({ history: [null, { type: 'deadline' }, slip('nonsense', 'also-bad'), slip('2026-09-01', '2026-09-03')] });
    const r = computeSlippage([t]);
    expect(r.totalSlips).toBe(1);
    expect(r.medianDaysPerSlip).toBe(2);
  });
});

// ── Latency ───────────────────────────────────────────────────────────────────

describe('computeLatency', () => {
  test('measures creation to first in_progress', () => {
    const t = task({
      createdAt: '2026-09-01T09:00:00.000Z',
      history: [statusAt('2026-09-04T09:00:00.000Z', 'in_progress')],
    });
    expect(computeLatency([t]).medianDaysToStart).toBe(3);
  });

  test('uses the first start, not a later one', () => {
    const t = task({
      createdAt: '2026-09-01T09:00:00.000Z',
      history: [
        statusAt('2026-09-10T09:00:00.000Z', 'in_progress'),
        statusAt('2026-09-03T09:00:00.000Z', 'in_progress'),
      ],
    });
    expect(computeLatency([t]).medianDaysToStart).toBe(2);
  });

  test('excludes tasks never started rather than scoring them as infinite', () => {
    const r = computeLatency([task({ history: [] }), task({ history: [statusAt('2026-09-02T09:00:00.000Z', 'in_progress')] })]);
    expect(r.samples).toBe(1);
  });
});

// ── Abandonment ───────────────────────────────────────────────────────────────

describe('computeAbandonment', () => {
  test('counts archived-and-not-done, never archived-after-done', () => {
    const r = computeAbandonment([
      task({ archived: true, status: 'not_started' }),
      task({ archived: true, status: 'done' }),     // finished, then filed away
      task({ archived: false, status: 'not_started' }),
    ]);
    expect(r.count).toBe(1);
    expect(r.rate).toBe(round3(1 / 3));
  });

  test('reports per-area rate with its sample size', () => {
    const tasks = [
      ...Array.from({ length: 4 }, () => task({ tags: ['side'], archived: true, status: 'not_started' })),
      task({ tags: ['side'] }),
    ];
    const r = computeAbandonment(tasks);
    expect(r.rateByArea.side.rate).toBe(0.8);
    expect(r.rateByArea.side.samples).toBe(5);
    expect(r.rateByArea.side.enough).toBe(true);
  });
});

const round3 = n => Math.round(n * 100) / 100;

// ── Rhythm ────────────────────────────────────────────────────────────────────

describe('computeRhythm', () => {
  test('buckets status changes by local hour and weekday', () => {
    const at = new Date(2026, 8, 7, 14, 30);            // Mon 7 Sep 2026, 14:30 local
    const t = task({ history: [statusAt(at.toISOString(), 'in_progress')] });
    const r = computeRhythm([t]);
    expect(r.samples).toBe(1);
    expect(r.hours[14]).toBe(1);
    expect(r.weekdays[at.getDay()]).toBe(1);
    expect(r.peakHour).toBe(14);
  });

  test('reports no session length — there is no session data on disk to use', () => {
    expect(computeRhythm([task()])).not.toHaveProperty('medianSessionMinutes');
  });
});

// ── Load ──────────────────────────────────────────────────────────────────────

describe('computeLoad', () => {
  const now = new Date(2026, 8, 12, 10, 0);            // Sat 12 Sep 2026, local
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const offset = (n) => ymd(new Date(2026, 8, 12 + n));

  test('separates overdue from due-this-week and sums only the latter', () => {
    const r = computeLoad([
      task({ deadline: offset(-2), estimatedDuration: 30 }),
      task({ deadline: offset(3),  estimatedDuration: 60 }),
      task({ deadline: offset(4),  estimatedDuration: 90 }),
      task({ deadline: offset(30), estimatedDuration: 999 }),
    ], now);
    expect(r.overdue).toBe(1);
    expect(r.dueNext7Days).toBe(2);
    expect(r.committedMinutes).toBe(150);
    expect(r.openTasks).toBe(4);
  });

  test('done and archived tasks are not load', () => {
    const r = computeLoad([
      task({ status: 'done', deadline: offset(1) }),
      task({ archived: true, deadline: offset(1) }),
      task({ deadline: offset(1) }),
    ], now);
    expect(r.openTasks).toBe(1);
    expect(r.dueNext7Days).toBe(1);
  });

  test('a deadline today counts as due, not overdue', () => {
    expect(computeLoad([task({ deadline: offset(0) })], now).overdue).toBe(0);
    expect(computeLoad([task({ deadline: offset(0) })], now).dueNext7Days).toBe(1);
  });
});

// ── Entry point ───────────────────────────────────────────────────────────────

describe('computeObserved', () => {
  test('returns a complete shape for an empty store without throwing', () => {
    const r = computeObserved([]);
    expect(r.tasksConsidered).toBe(0);
    for (const k of ['estimation', 'slippage', 'latency', 'abandonment', 'rhythm', 'load']) {
      expect(r).toHaveProperty(k);
    }
    expect(r.estimation.enough).toBe(false);
  });

  test('tolerates junk in the task array', () => {
    expect(() => computeObserved([null, undefined, {}, task()])).not.toThrow();
  });

  test('the window excludes stale tasks but load still sees everything open', () => {
    const now = new Date(2026, 8, 12);
    const old = task({ createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' });
    const recent = task({ createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' });
    const r = computeObserved([old, recent], { now, windowDays: 90 });
    expect(r.tasksConsidered).toBe(1);
    expect(r.load.openTasks).toBe(2);
  });

  test('windowDays 0 means all of history', () => {
    const old = task({ createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' });
    expect(computeObserved([old], { windowDays: 0 }).tasksConsidered).toBe(1);
  });
});
