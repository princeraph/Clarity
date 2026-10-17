import { describe, test, expect } from '@jest/globals';
import { workdayOf, validWorkday, upgradeWorkday, WORKDAY_DEFAULTS } from '../src/workday.js';

describe('the working day', () => {
  test('defaults: 9 to 6, break 12 to 1, Monday to Friday', () => {
    expect(workdayOf({})).toEqual(WORKDAY_DEFAULTS);
    expect(WORKDAY_DEFAULTS).toEqual({ start: '09:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00', label: '' }], days: [1, 2, 3, 4, 5] });
  });
  test('a saved day, completed by the defaults', () => {
    expect(workdayOf({ workday: { start: '08:30', days: [1, 2, 3, 4] } })).toEqual({ ...WORKDAY_DEFAULTS, start: '08:30', days: [1, 2, 3, 4] });
  });
  test('no break is allowed', () => { expect(validWorkday({ breaks: [] })).toBeNull(); });
  test('the 2.0 shape is still read: one break, or none', () => {
    expect(upgradeWorkday({ start: '08:00', breakStart: '12:30', breakEnd: '13:00' })).toEqual({ start: '08:00', breaks: [{ start: '12:30', end: '13:00', label: '' }] });
    expect(upgradeWorkday({ breakStart: null, breakEnd: null })).toEqual({ breaks: [] });
    expect(workdayOf({ workday: { breakStart: '12:00', breakEnd: '12:45' } }).breaks).toEqual([{ start: '12:00', end: '12:45', label: '' }]);
  });
  test('several breaks, named', () => {
    expect(validWorkday({ breaks: [{ start: '10:30', end: '10:45', label: 'Café' }, { start: '12:00', end: '13:00', label: 'Déjeuner' }, { start: '16:00', end: '16:15' }] })).toBeNull();
  });
  test('hours of their own on some days', () => {
    expect(validWorkday({ byDay: { 5: { start: '09:00', end: '13:00', breaks: [] }, 1: { start: '08:00', end: '17:00', breaks: [{ start: '11:30', end: '12:15' }] } } })).toBeNull();
  });
  test.each([
    ['ends before it starts', { start: '18:00', end: '09:00' }],
    ['a time that is not one', { start: '9h' }],
    ['a break outside the day', { breakStart: '19:00', breakEnd: '20:00' }],
    ['half a break', { breakStart: null }],
    ['a break with one end', { breaks: [{ start: '12:00' }] }],
    ['two breaks that overlap', { breaks: [{ start: '12:00', end: '13:00' }, { start: '12:30', end: '13:30' }] }],
    ['seven breaks', { breaks: Array.from({ length: 7 }, (_, i) => ({ start: `1${i}:00`, end: `1${i}:10` })) }],
    ['a label too long', { breaks: [{ start: '12:00', end: '13:00', label: 'x'.repeat(41) }] }],
    ['a day of its own that ends before it starts', { byDay: { 5: { start: '13:00', end: '09:00' } } }],
    ['a day of its own with a break outside it', { byDay: { 5: { start: '09:00', end: '12:00', breaks: [{ start: '12:00', end: '13:00' }] } } }],
    ['a day that does not exist in byDay', { byDay: { 8: { start: '09:00', end: '12:00' } } }],
    ['no day worked', { days: [] }],
    ['a day that does not exist', { days: [1, 9] }],
    ['the same day twice', { days: [1, 1] }],
  ])('refused: %s', (_, w) => { expect(validWorkday(w)).not.toBeNull(); });
  test('a broken saved day falls back to the defaults rather than breaking the plan', () => {
    expect(workdayOf({ workday: { start: '18:00', end: '09:00' } })).toEqual(WORKDAY_DEFAULTS);
  });
});
