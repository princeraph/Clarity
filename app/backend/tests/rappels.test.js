import { describe, test, expect } from '@jest/globals';
import { dueReminders, claimList, validReminder, validReminderSettings, remindersOf, pruneLog } from '../src/rappels.js';

const DAY = { start: '09:00', end: '18:00', breaks: [], days: [1, 2, 3, 4, 5] };
const FRI = (h, m = 0) => new Date(2026, 9, 16, h, m);          // Friday 16 October 2026
const T = (id, over = {}) => ({ id, title: id, status: 'not_started', ...over });
const keys = (list) => list.map(r => r.key);

describe('reminders', () => {
  test('a reminder is a local date and time that exists', () => {
    expect(validReminder('2026-10-16T14:30')).toBe(true);
    expect(validReminder(null)).toBe(true);
    expect(validReminder('2026-02-31T10:00')).toBe(false);
    expect(validReminder('2026-10-16 14:30')).toBe(false);
    expect(validReminder('2026-10-16T24:00')).toBe(false);
  });
  test('settings: defaults, and what is refused', () => {
    expect(remindersOf({})).toEqual({ before: 10, morning: true, blocks: true });
    expect(remindersOf({ reminders: { before: 7 } })).toEqual({ before: 10, morning: true, blocks: true });
    expect(validReminderSettings({ before: 30, morning: false })).toBeNull();
    expect(validReminderSettings({ before: 7 })).not.toBeNull();
    expect(validReminderSettings({ blocks: 'yes' })).not.toBeNull();
  });
  test('a task\'s own reminder: due at its time, not before, once', () => {
    const tasks = [T('a', { reminder: '2026-10-16T14:30' })];
    expect(dueReminders({ tasks, now: FRI(14, 29), settings: { reminders: { morning: false } } })).toEqual([]);
    const r = dueReminders({ tasks, now: FRI(14, 30), settings: { reminders: { morning: false } } });
    expect(keys(r)).toEqual(['task:a:2026-10-16T14:30']);
    expect(r[0].stale).toBe(false);
    expect(dueReminders({ tasks, now: FRI(15), settings: { reminders: { morning: false } }, log: { 'task:a:2026-10-16T14:30': 'x' } })).toEqual([]);
  });
  test('moved to another time: a new reminder', () => {
    const log = { 'task:a:2026-10-16T14:30': 'x' };
    expect(keys(dueReminders({ tasks: [T('a', { reminder: '2026-10-16T15:00' })], now: FRI(15), settings: { reminders: { morning: false } }, log }))).toEqual(['task:a:2026-10-16T15:00']);
  });
  test('more than 12 hours late (computer off): stale, given quietly', () => {
    const r = dueReminders({ tasks: [T('a', { reminder: '2026-10-15T08:00' })], now: FRI(10), settings: { reminders: { morning: false } } });
    expect(r[0].stale).toBe(true);
  });
  test('done or archived: no reminder', () => {
    const tasks = [T('a', { reminder: '2026-10-16T14:30', status: 'done' }), T('b', { reminder: '2026-10-16T14:30', archived: true })];
    expect(dueReminders({ tasks, now: FRI(15), settings: { reminders: { morning: false } } })).toEqual([]);
  });
  test('before a task with its hour: 10 minutes before by default, until it starts', () => {
    const tasks = [T('a', { deadline: '2026-10-16', time: '14:00' })];
    const s = { reminders: { morning: false } };
    expect(dueReminders({ tasks, now: FRI(13, 49), settings: s })).toEqual([]);
    expect(keys(dueReminders({ tasks, now: FRI(13, 50), settings: s }))).toEqual(['before:a:2026-10-16T14:00']);
    expect(dueReminders({ tasks, now: FRI(14, 0), settings: s })).toEqual([]);
    expect(keys(dueReminders({ tasks, now: FRI(13, 31), settings: { reminders: { before: 30, morning: false } } }))).toEqual(['before:a:2026-10-16T14:00']);
    expect(dueReminders({ tasks, now: FRI(13, 55), settings: { reminders: { before: 0, morning: false } } })).toEqual([]);
  });
  test('the morning summary: at the start of the working day, with what is due', () => {
    const tasks = [T('a', { deadline: '2026-10-16' }), T('b', { deadline: '2026-10-14' }), T('c', { deadline: '2026-10-20' })];
    const s = { workday: DAY };
    expect(dueReminders({ tasks, now: FRI(8, 59), settings: s })).toEqual([]);
    const r = dueReminders({ tasks, now: FRI(9, 0), settings: s });
    expect(r.map(x => [x.key, x.taskIds, x.late])).toEqual([['morning:2026-10-16', ['a', 'b'], 1]]);
  });
  test('… not on a day off, not with nothing due, not in the afternoon, not when turned off', () => {
    const tasks = [T('a', { deadline: '2026-10-17' })];
    expect(dueReminders({ tasks, now: new Date(2026, 9, 17, 10), settings: { workday: DAY } })).toEqual([]);
    expect(dueReminders({ tasks: [T('x', { deadline: '2026-10-20' })], now: FRI(9, 30), settings: { workday: DAY } })).toEqual([]);
    expect(dueReminders({ tasks: [T('a', { deadline: '2026-10-16' })], now: FRI(16), settings: { workday: DAY } })).toEqual([]);
    expect(dueReminders({ tasks: [T('a', { deadline: '2026-10-16' })], now: FRI(9, 30), settings: { workday: DAY, reminders: { morning: false } } })).toEqual([]);
  });
  test('… a day with its own hours starts at its own time', () => {
    const s = { workday: { ...DAY, byDay: { 5: { start: '10:30', end: '13:00', breaks: [] } } } };
    const tasks = [T('a', { deadline: '2026-10-16' })];
    expect(dueReminders({ tasks, now: FRI(10), settings: s })).toEqual([]);
    expect(keys(dueReminders({ tasks, now: FRI(10, 30), settings: s }))).toEqual(['morning:2026-10-16']);
  });
  test('the log keeps a week', () => {
    const now = FRI(12);
    expect(Object.keys(pruneLog({ old: new Date(2026, 9, 5).toISOString(), recent: new Date(2026, 9, 14).toISOString() }, now))).toEqual(['recent']);
  });
});

describe('missed while Clarity was closed (tâche 4)', () => {
  const titleOf = (id) => ({ a: 'Appeler la banque', b: 'Payer le loyer', c: 'Vieux' })[id] || '';
  const now = FRI(10);
  const claim = (tasks) => claimList(dueReminders({ tasks, now, settings: { reminders: { morning: false } } }), titleOf, now);
  test('one card for every reminder missed, not a burst', () => {
    const r = claim([T('a', { reminder: '2026-10-15T08:00' }), T('b', { reminder: '2026-10-14T17:00' })]);
    expect(r.map(x => x.kind)).toEqual(['missed']);
    expect(r[0].taskIds).toEqual(['b', 'a']);
    expect(r[0].titles).toEqual(['Payer le loyer', 'Appeler la banque']);
    expect(r[0].taskId).toBeUndefined();
  });
  test('one missed: the card opens that task', () => {
    const r = claim([T('a', { reminder: '2026-10-15T08:00' })]);
    expect(r[0]).toMatchObject({ kind: 'missed', taskId: 'a', title: 'Appeler la banque' });
  });
  test('beside a reminder due now, which keeps its own card', () => {
    const r = claim([T('a', { reminder: '2026-10-15T08:00' }), T('b', { reminder: '2026-10-16T09:55' })]);
    expect(r.map(x => [x.kind, x.taskId])).toEqual([['task', 'b'], ['missed', 'a']]);
  });
  test('more than a week old: still quiet', () => {
    expect(claim([T('c', { reminder: '2026-10-05T08:00' })])).toEqual([]);
  });
  test('given once: the log holds every missed key', () => {
    const due = dueReminders({ tasks: [T('a', { reminder: '2026-10-15T08:00' })], now, settings: { reminders: { morning: false } } });
    const log = Object.fromEntries(due.map(r => [r.key, now.toISOString()]));
    expect(claimList(dueReminders({ tasks: [T('a', { reminder: '2026-10-15T08:00' })], now, settings: { reminders: { morning: false } }, log }), titleOf, now)).toEqual([]);
  });
});
