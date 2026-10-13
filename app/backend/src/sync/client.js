// Talks to the Clarity sync project over plain HTTPS — Supabase's Auth
// (GoTrue) and REST (PostgREST) endpoints. No SDK: five calls, all visible
// here, and `fetch` is injected so every one of them is testable offline.
//
// The publishable key is public by design: it only identifies the project.
// What a request may touch is decided by the signed-in user's token and the
// row-level rules on `records` (only your own rows, newest edit wins).

export const SYNC_URL = process.env.CLARITY_SYNC_URL || 'https://mynkhbqchkvdubhlydit.supabase.co';
export const SYNC_KEY = process.env.CLARITY_SYNC_KEY || 'sb_publishable_LMoXV_Fx2UvdsbpP6YxwJg_d7W54BDH';

export class SyncError extends Error {
  constructor(code, message, status) { super(message || code); this.code = code; this.status = status; }
}

export function createSyncClient({ url = SYNC_URL, key = SYNC_KEY, fetchImpl = globalThis.fetch } = {}) {
  async function call(path, { method = 'GET', body, token, headers = {}, timeoutMs = 20000 } = {}) {
    let resp;
    try {
      resp = await fetchImpl(`${url}${path}`, {
        method,
        headers: {
          apikey: key,
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new SyncError('offline', err?.message || 'network unreachable');
    }
    const text = await resp.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!resp.ok) {
      const msg = json?.msg || json?.message || json?.error_description || json?.error || text || `HTTP ${resp.status}`;
      const code = resp.status === 401 || resp.status === 403 ? 'unauthorized'
        : resp.status === 429 ? 'rate-limited'
        : resp.status >= 500 ? 'server' : 'rejected';
      throw new SyncError(code, String(msg).slice(0, 300), resp.status);
    }
    return json;
  }

  return {
    /** Send a 6-digit sign-in code by e-mail. Creates the account on first use. */
    sendCode: (email) => call('/auth/v1/otp', { method: 'POST', body: { email, create_user: true } }),

    /** Exchange the code for a session { access_token, refresh_token, expires_at, user }. */
    verifyCode: (email, code) => call('/auth/v1/verify', { method: 'POST', body: { type: 'email', email, token: code } }),

    /** A fresh session from the refresh token (tokens rotate: keep the new one). */
    // GoTrue answers a revoked, expired or already-used refresh token with 400
    // (refresh_token_not_found / _already_used). That is not a wrong code and
    // not a passing failure: the session is over and must end visibly.
    refresh: (refreshToken) => call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refreshToken } })
      .catch(err => {
        if (err instanceof SyncError && (err.status === 400 || err.status === 401 || err.status === 403)) throw new SyncError('session-expired', err.message, err.status);
        throw err;
      }),

    signOut: (token) => call('/auth/v1/logout', { method: 'POST', token }).catch(() => null),

    /** Rows changed since `since` (server time), oldest first, in pages. */
    async pull(token, since, { pageSize = 500 } = {}) {
      const rows = [];
      let cursor = since || '1970-01-01T00:00:00Z';
      for (let page = 0; page < 200; page++) {
        const q = `/rest/v1/records?select=kind,id,data,deleted,updated_at,synced_at`
          + `&synced_at=gt.${encodeURIComponent(cursor)}&order=synced_at.asc&limit=${pageSize}`;
        const batch = await call(q, { token });
        rows.push(...batch);
        if (batch.length < pageSize) break;
        cursor = batch[batch.length - 1].synced_at;
      }
      return rows;
    },

    /** Upsert rows. The server keeps the newer updated_at on conflict. */
    async push(token, rows, { device, batchSize = 200 } = {}) {
      for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize).map(r => ({ ...r, device: device || null }));
        await call('/rest/v1/records?on_conflict=user_id,kind,id', {
          method: 'POST', token, body: chunk,
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        });
      }
    },
  };
}
