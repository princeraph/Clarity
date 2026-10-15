import { describe, test, expect } from '@jest/globals';
import { validPriority, validDifficulty, normalizeLinks, wouldCycle, removeLinksTo } from '../src/links.js';

const blocks = (to, strength) => ({ to, type: 'blocks', ...(strength ? { strength } : {}) });

describe('priority and difficulty', () => {
  test('the six levels, or none', () => {
    for (const p of ['top', 'very_high', 'high', 'medium', 'low', 'very_low', null]) expect(validPriority(p)).toBe(true);
    for (const p of ['urgent', 1, '', undefined]) expect(validPriority(p)).toBe(false);
  });
  test('difficulty 1 to 5, whole numbers', () => {
    for (const d of [1, 3, 5, null]) expect(validDifficulty(d)).toBe(true);
    for (const d of [0, 6, 2.5, '3']) expect(validDifficulty(d)).toBe(false);
  });
});

describe('links', () => {
  test('normalized: blocks default to hard, duplicates dropped, stamped by the person', () => {
    const out = normalizeLinks([blocks('b'), blocks('b'), { to: 'c', type: 'related' }], 'a', 'T');
    expect(out).toEqual([
      { to: 'b', type: 'blocks', strength: 'hard', by: 'user', at: 'T' },
      { to: 'c', type: 'related', by: 'user', at: 'T' },
    ]);
  });
  test.each([
    ['not a list', 'x'],
    ['a link to itself', [blocks('a')]],
    ['an unknown type', [{ to: 'b', type: 'causes' }]],
    ['an unknown strength', [blocks('b', 'medium')]],
    ['no target', [{ type: 'blocks' }]],
  ])('refused: %s', (_, links) => { expect(normalizeLinks(links, 'a')).toBeNull(); });
  test('null clears', () => { expect(normalizeLinks(null, 'a')).toEqual([]); });

  test('a loop of « blocks », at any depth, is refused', () => {
    const tasks = [{ id: 'a', links: [] }, { id: 'b', links: [blocks('c')] }, { id: 'c', links: [blocks('a', 'soft')] }];
    expect(wouldCycle(tasks, 'a', [blocks('b')])).toBe(true);          // a → b → c → a
    expect(wouldCycle(tasks, 'a', [{ to: 'b', type: 'related' }])).toBe(false);   // « related » has no direction
    expect(wouldCycle(tasks, 'b', [blocks('c')])).toBe(false);
  });

  test('deleting a task removes the links that point at it, and dates the change for the sync', () => {
    const tasks = [{ id: 'a', links: [blocks('x'), blocks('y')], updatedAt: 'old' }, { id: 'b', links: [blocks('y')], updatedAt: 'old' }];
    expect(removeLinksTo(tasks, 'x', 'NOW')).toBe(1);
    expect(tasks[0]).toEqual({ id: 'a', links: [{ to: 'y', type: 'blocks' }], updatedAt: 'NOW' });
    expect(tasks[1].updatedAt).toBe('old');
  });
});
