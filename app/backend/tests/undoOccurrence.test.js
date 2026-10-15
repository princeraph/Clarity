import { describe, test, expect } from '@jest/globals';
import { untouchedOccurrence, isUndoOfRecurring } from '../src/undoOccurrence.js';

const at = '2026-10-15T10:00:00.000Z';
const fresh = (over = {}) => ({ id: 'n', status: 'not_started', archived: false, timeTracked: 0, timerStarted: null, createdAt: at, updatedAt: at, ...over });

describe('undo of a finished recurring task', () => {
  test('a fresh occurrence is removed with the undo', () => {
    expect(untouchedOccurrence(fresh())).toBe(true);
    expect(untouchedOccurrence(fresh({ updatedAt: '2026-10-15T10:00:01.200Z' }))).toBe(true);   // spawned across a second
  });

  test.each([
    ['started',  { status: 'in_progress' }],
    ['finished', { status: 'done' }],
    ['archived', { archived: true }],
    ['timed',    { timeTracked: 12 }],
    ['running',  { timerStarted: at }],
    ['edited',   { history: [{ type: 'title' }] }],
    ['changed later', { updatedAt: '2026-10-16T08:00:00.000Z' }],
  ])('an occurrence %s since is someone\'s work, and stays', (_, over) => {
    expect(untouchedOccurrence(fresh(over))).toBe(false);
  });

  test('only done → not done, on a recurring task, counts as an undo', () => {
    const rec = { recurring: 'weekly' };
    expect(isUndoOfRecurring({ status: 'done' }, { status: 'not_started' }, rec)).toBe(true);
    expect(isUndoOfRecurring({ status: 'done' }, { status: 'in_progress' }, rec)).toBe(true);
    expect(isUndoOfRecurring({ status: 'done' }, { title: 'x' }, rec)).toBe(false);
    expect(isUndoOfRecurring({ status: 'not_started' }, { status: 'in_progress' }, rec)).toBe(false);
    expect(isUndoOfRecurring({ status: 'done' }, { status: 'not_started' }, { recurring: 'none' })).toBe(false);
    expect(untouchedOccurrence(undefined)).toBe(false);
  });
});
