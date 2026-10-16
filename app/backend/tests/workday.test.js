import { describe, test, expect } from '@jest/globals';
import { workdayOf, validWorkday, WORKDAY_DEFAULTS } from '../src/workday.js';

describe('the working day', () => {
  test('defaults: 9 to 6, break 12 to 1, Monday to Friday', () => {
    expect(workdayOf({})).toEqual(WORKDAY_DEFAULTS);
    expect(WORKDAY_DEFAULTS).toEqual({ start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00', days: [1, 2, 3, 4, 5] });
  });
  test('a saved day, completed by the defaults', () => {
    expect(workdayOf({ workday: { start: '08:30', days: [1, 2, 3, 4] } })).toEqual({ ...WORKDAY_DEFAULTS, start: '08:30', days: [1, 2, 3, 4] });
  });
  test('no break is allowed', () => { expect(validWorkday({ breakStart: null, breakEnd: null })).toBeNull(); });
  test.each([
    ['ends before it starts', { start: '18:00', end: '09:00' }],
    ['a time that is not one', { start: '9h' }],
    ['a break outside the day', { breakStart: '19:00', breakEnd: '20:00' }],
    ['half a break', { breakStart: null }],
    ['no day worked', { days: [] }],
    ['a day that does not exist', { days: [1, 9] }],
    ['the same day twice', { days: [1, 1] }],
  ])('refused: %s', (_, w) => { expect(validWorkday(w)).not.toBeNull(); });
  test('a broken saved day falls back to the defaults rather than breaking the plan', () => {
    expect(workdayOf({ workday: { start: '18:00', end: '09:00' } })).toEqual(WORKDAY_DEFAULTS);
  });
});
