// The window's key (2.5.0). Electron makes a random key at every start, gives
// it to the backend (CLARITY_API_TOKEN) and to its windows (preload), which
// send it with every call (X-Clarity-Token). Any other caller — a web page in
// a browser, a program of another user — is refused, even one that gets past
// the Host guard and CORS. Without the variable (development, tests) there is
// no key to check.
//
// Left open: the AI connector's own routes (they have their own token), and
// health and version, which the connector reads to know Clarity is running.
import { timingSafeEqual } from 'node:crypto';

const OPEN = [/^\/connector\/v1\//, /^\/health$/, /^\/version$/];

export function sameKey(given, expected) {
  const a = Buffer.from(String(given || '')), b = Buffer.from(String(expected || ''));
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

/** Express middleware for /api: `token` is the expected key, or '' for none. */
export function tokenGuard(token) {
  return (req, res, next) => {
    if (!token || req.method === 'OPTIONS' || OPEN.some(re => re.test(req.path))) return next();
    if (sameKey(req.get('x-clarity-token'), token)) return next();
    res.status(401).json({ error: 'This request does not come from Clarity', code: 'unauthorized' });
  };
}
