import { describe, test, expect } from '@jest/globals';
import { planSync, afterPush, keyOf } from '../src/sync/plan.js';

const T = h => `2026-10-13T${String(h).padStart(2, '0')}:00:00.000Z`;
const item = (id, h, data = { title: id }, kind = 'task') => [keyOf(kind, id), { kind, id, data, updatedAt: T(h) }];
const remote = (id, h, extra = {}, kind = 'task') => ({ kind, id, data: { title: `${id}@remote` }, deleted: false, updated_at: T(h), ...extra });
const NOW = new Date(T(20));

describe('sync plan', () => {
  test('first sync of a device with tasks: everything is sent', () => {
    const { push, apply } = planSync({ local: new Map([item('a', 9), item('b', 10)]) });
    expect(push.map(p => p.id).sort()).toEqual(['a', 'b']);
    expect(apply).toEqual([]);
  });

  test('a fresh device receives everything', () => {
    const { apply, push, nextKnown } = planSync({ local: new Map(), remote: [remote('a', 9), remote('b', 10)] });
    expect(apply.map(a => a.id)).toEqual(['a', 'b']);
    expect(push).toEqual([]);
    expect(nextKnown).toEqual({ 'task:a': T(9), 'task:b': T(10) });
  });

  test('newer wins, both ways', () => {
    const local = new Map([item('a', 12), item('b', 9)]);
    const known = { 'task:a': T(8), 'task:b': T(8) };
    const { apply, push } = planSync({ local, known, remote: [remote('a', 10), remote('b', 11)] });
    expect(apply.map(a => a.id)).toEqual(['b']);
    expect(push.map(p => p.id)).toEqual(['a']);
  });

  test('unchanged since last agreement: nothing moves', () => {
    const { apply, push } = planSync({ local: new Map([item('a', 8)]), known: { 'task:a': T(8) } });
    expect(apply).toEqual([]); expect(push).toEqual([]);
  });

  test('deleted here: a tombstone is sent', () => {
    const { push } = planSync({ local: new Map(), known: { 'task:a': T(8) }, now: NOW });
    expect(push).toEqual([{ kind: 'task', id: 'a', data: null, deleted: true, updated_at: NOW.toISOString() }]);
  });

  test('deleted elsewhere, untouched here: deleted here', () => {
    const { apply, nextKnown } = planSync({ local: new Map([item('a', 8)]), known: { 'task:a': T(8) }, remote: [remote('a', 11, { deleted: true, data: null })] });
    expect(apply).toEqual([{ kind: 'task', id: 'a', deleted: true }]);
    expect(nextKnown['task:a']).toBeUndefined();
  });

  test('deleted elsewhere, edited here after: the edit wins and goes back up', () => {
    const { apply, push } = planSync({ local: new Map([item('a', 12)]), known: { 'task:a': T(8) }, remote: [remote('a', 11, { deleted: true, data: null })] });
    expect(apply).toEqual([]);
    expect(push.map(p => [p.id, p.deleted])).toEqual([['a', false]]);
  });

  test('deleted here, edited elsewhere since we agreed: the edit comes back', () => {
    const { apply, push } = planSync({ local: new Map(), known: { 'task:a': T(8) }, remote: [remote('a', 11)], now: NOW });
    expect(apply.map(a => a.id)).toEqual(['a']);
    expect(push).toEqual([]);
  });

  test('journal: local trimming sends no tombstone; an explicit delete does, and is applied elsewhere', () => {
    const p1 = planSync({ local: new Map(), known: { 'journal:j1': T(8) }, now: NOW });
    expect(p1.push).toEqual([]);
    const p2 = planSync({ local: new Map(), known: { 'journal:j1': T(8) }, explicitDeletes: [{ kind: 'journal', id: 'j1' }], now: NOW });
    expect(p2.push.map(p => [p.id, p.deleted])).toEqual([['j1', true]]);
    const p3 = planSync({ local: new Map([item('j1', 8, {}, 'journal')]), known: { 'journal:j1': T(8) }, remote: [remote('j1', 11, { deleted: true, data: null }, 'journal')] });
    expect(p3.apply).toEqual([{ kind: 'journal', id: 'j1', deleted: true }]);
  });

  test('allowDeletes: false — nothing missing is sent as a deletion (recovered files)', () => {
    const { push } = planSync({ local: new Map(), known: { 'task:a': T(8), 'task:b': T(8) }, remote: [remote('a', 8)], now: NOW, allowDeletes: false });
    expect(push).toEqual([]);
  });

  test('two devices converge whatever the order', () => {
    // A and B both start from x@8; A edits at 10, B at 11.
    const base = { 'task:x': T(8) };
    const a = planSync({ local: new Map([item('x', 10, { v: 'A' })]), known: base });
    const b = planSync({ local: new Map([item('x', 11, { v: 'B' })]), known: base });
    // server keeps newest: B's row. A pulls it:
    const aAfter = planSync({ local: new Map([item('x', 10, { v: 'A' })]), known: afterPush(a.nextKnown, a.push), remote: [{ kind: 'task', id: 'x', data: { v: 'B' }, deleted: false, updated_at: T(11) }] });
    expect(aAfter.apply).toEqual([{ kind: 'task', id: 'x', data: { v: 'B' }, updated_at: T(11) }]);
    expect(b.push[0].data).toEqual({ v: 'B' });
  });

  test('a tombstone is never older than the version it deletes (clock behind)', () => {
    const behind = new Date(T(1));
    const { push } = planSync({ local: new Map(), known: { 'task:a': T(8) }, now: behind });
    expect(Date.parse(push[0].updated_at)).toBeGreaterThan(Date.parse(T(8)));
  });

  test('a known row pulled again (overlap) after a local delete is not resurrected', () => {
    const { apply, push } = planSync({ local: new Map(), known: { 'task:a': T(8) }, remote: [remote('a', 8)], now: NOW });
    expect(apply).toEqual([]);
    expect(push.map(p => [p.id, p.deleted])).toEqual([['a', true]]);
  });

  test('afterPush records agreements and forgets tombstones', () => {
    const k = afterPush({ 'task:a': T(8) }, [{ kind: 'task', id: 'a', deleted: true }, { kind: 'task', id: 'b', deleted: false, updated_at: T(9) }]);
    expect(k).toEqual({ 'task:b': T(9) });
  });
});
