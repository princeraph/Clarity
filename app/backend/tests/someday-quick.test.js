import { describe, test, expect } from '@jest/globals';
import { candidates } from '../src/suggest/candidates.js';
import { stalledTasks } from '../src/threads/logic.js';
import { rescheduleOverdue } from '../src/reschedule.js';

// 2.7.0: « Someday » is parked on purpose and a quick task is too small to
// chase. Neither may come back as an interruption, a stalled task, or a
// deadline pulled to today.
const NOW = new Date(2026, 9, 29, 12, 0);
const old = new Date(2026, 8, 1).toISOString();
const task = (over) => ({ id: over.id, title: over.id, status: 'not_started', archived: false, history: [],
  deadline: '2026-10-01', createdAt: old, updatedAt: old, ...over });

describe('Someday and quick tasks stay quiet', () => {
  const tasks = [task({ id: 'normal' }), task({ id: 'someday', someday: true }), task({ id: 'quick', quick: true })];

  test('no suggestion about them', () => {
    const ids = candidates({ tasks, now: NOW }).map(c => c.taskId);
    expect(ids).toContain('normal');
    expect(ids).not.toContain('someday');
    expect(ids).not.toContain('quick');
  });

  test('never listed as stalled', () => {
    const ids = stalledTasks(tasks, { now: NOW }).map(s => s.taskId);
    expect(ids).toContain('normal');
    expect(ids).not.toContain('someday');
    expect(ids).not.toContain('quick');
  });

  test('auto-reschedule leaves a Someday task where it is', () => {
    const { moved } = rescheduleOverdue(tasks, NOW);
    expect(moved).toContain('normal');
    expect(moved).not.toContain('someday');
  });
});
