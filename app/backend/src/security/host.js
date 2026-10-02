// DNS rebinding guard.
//
// The API binds to loopback and has no authentication. Loopback alone does not
// stop a web page: a hostile domain can re-point its DNS at 127.0.0.1, and the
// browser then treats requests to it as same-origin — a same-origin GET carries
// no Origin header, which the CORS allowlist lets through. What the browser
// cannot fake is the Host header: it still names the hostile domain. So every
// request whose Host is not one of ours is refused before any route runs.
//
// Pure: no I/O, no Express — `isAllowedHost` is unit-tested on its own.
//
// No way to widen the list, on purpose. The first draft of this guard read
// extra hosts from CLARITY_ALLOWED_HOSTS "for the ngrok flow" — but Clarity's
// tunnel setting (`tunnelSecret`) is OUTBOUND, to reach an Ollama running
// elsewhere. Nothing ever exposes this API, which has no authentication and
// holds a personal profile. An escape hatch for a use that does not exist is
// only an invitation to create it.

export function allowedHosts(port) {
  return new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
}

export function isAllowedHost(hostHeader, hosts) {
  if (typeof hostHeader !== 'string' || hostHeader === '') return false;
  return hosts.has(hostHeader.trim().toLowerCase());
}

export function hostGuard(hosts) {
  return (req, res, next) => {
    if (isAllowedHost(req.headers.host, hosts)) return next();
    res.status(403).json({ error: 'Host not allowed' });
  };
}
