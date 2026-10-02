import { describe, test, expect } from '@jest/globals';
import { allowedHosts, isAllowedHost, hostGuard } from '../src/security/host.js';

describe('DNS rebinding guard', () => {
  const hosts = allowedHosts(3001);

  test.each(['127.0.0.1:3001', 'localhost:3001', 'LOCALHOST:3001', '[::1]:3001'])('allows %s', h => {
    expect(isAllowedHost(h, hosts)).toBe(true);
  });

  test.each([
    'evil.example:3001',          // the rebinding case: hostile name, our port
    'localhost',                  // no port — never sent by our own client
    '127.0.0.1:5173',             // right host, wrong port
    'localhost:3001.evil.example',
    '',
    undefined,
  ])('refuses %p', h => {
    expect(isAllowedHost(h, hosts)).toBe(false);
  });

  test('the list cannot be widened — a tunnel host is refused', () => {
    expect(isAllowedHost('abc.ngrok.app', allowedHosts(3001, 'abc.ngrok.app'))).toBe(false);
  });

  test('middleware answers 403 and never calls the route', () => {
    let status, called = false;
    const res = { status(s) { status = s; return this; }, json() { return this; } };
    hostGuard(hosts)({ headers: { host: 'evil.example:3001' } }, res, () => { called = true; });
    expect(status).toBe(403);
    expect(called).toBe(false);
  });

  test('middleware lets our own host through', () => {
    let called = false;
    hostGuard(hosts)({ headers: { host: 'localhost:3001' } }, {}, () => { called = true; });
    expect(called).toBe(true);
  });
});
