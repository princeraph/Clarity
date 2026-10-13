import { describe, test, expect } from '@jest/globals';
import { secretField, MASK } from '../src/security/secretField.js';

// Switching provider cleared the key field; saving sent '' and erased the
// stored key. Empty must keep, only null clears.
describe('what a settings value does to a stored secret', () => {
  test('absent, empty, blank, masked or not a string: keep the stored one', () => {
    for (const v of [undefined, '', '   ', MASK, 42, {}, []]) expect(secretField(v)).toEqual({ set: false });
  });
  test('a typed value replaces it, trimmed', () => {
    expect(secretField(' sk-new ')).toEqual({ set: true, value: 'sk-new' });
  });
  test('null clears it, on purpose', () => {
    expect(secretField(null)).toEqual({ set: true, value: '' });
  });
});
