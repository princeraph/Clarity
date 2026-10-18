import { describe, test, expect } from '@jest/globals';
import { tokenGuard, sameKey } from '../src/security/jeton.js';

const run = (token, { path = '/tasks', method = 'GET', key } = {}) => {
  let passed = false, status = null;
  const req = { path, method, get: (h) => (h.toLowerCase() === 'x-clarity-token' ? key : undefined) };
  const res = { status(s) { status = s; return this; }, json() { return this; } };
  tokenGuard(token)(req, res, () => { passed = true; });
  return passed ? 'next' : status;
};

describe('the window\'s key', () => {
  test('no key set (development, tests): everything passes', () => { expect(run('')).toBe('next'); });
  test('the right key passes', () => { expect(run('k3y', { key: 'k3y' })).toBe('next'); });
  test.each([[undefined], [''], ['k3'], ['k3y '], ['K3Y']])('a wrong or missing key (%p) is refused', (key) => {
    expect(run('k3y', { key })).toBe(401);
  });
  test('a write without the key is refused too', () => { expect(run('k3y', { method: 'POST', path: '/settings' })).toBe(401); });
  test('the connector\'s routes, health and version stay open', () => {
    expect(run('k3y', { path: '/connector/v1/tasks' })).toBe('next');
    expect(run('k3y', { path: '/health' })).toBe('next');
    expect(run('k3y', { path: '/version' })).toBe('next');
    expect(run('k3y', { path: '/healthx' })).toBe(401);
  });
  test('a browser\'s preflight is not asked for the key', () => { expect(run('k3y', { method: 'OPTIONS' })).toBe('next'); });
  test('sameKey: equal length and content only', () => {
    expect(sameKey('abc', 'abc')).toBe(true);
    expect(sameKey('', '')).toBe(false);
    expect(sameKey('abcd', 'abc')).toBe(false);
  });
});
