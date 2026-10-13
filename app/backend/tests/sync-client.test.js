import { describe, test, expect } from '@jest/globals';
import { createSyncClient, SyncError } from '../src/sync/client.js';

function fakeFetch(handler) {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, ...init, body: init.body ? JSON.parse(init.body) : undefined });
    const { status = 200, json } = await handler(url, init) || {};
    return { ok: status < 400, status, text: async () => (json === undefined ? '' : JSON.stringify(json)) };
  };
  f.calls = calls;
  return f;
}

describe('sync client', () => {
  test('sign-in by code: right endpoints, key always sent, token never before verify', async () => {
    const f = fakeFetch(url => url.includes('/verify') ? { json: { access_token: 'A', refresh_token: 'R' } } : { json: {} });
    const c = createSyncClient({ url: 'https://x', key: 'pk', fetchImpl: f });
    await c.sendCode('me@x.com');
    const s = await c.verifyCode('me@x.com', '123456');
    expect(s.access_token).toBe('A');
    expect(f.calls[0].url).toBe('https://x/auth/v1/otp');
    expect(f.calls[0].body).toEqual({ email: 'me@x.com', create_user: true });
    expect(f.calls[1].body).toEqual({ type: 'email', email: 'me@x.com', token: '123456' });
    expect(f.calls.every(c => c.headers.apikey === 'pk' && !c.headers.Authorization)).toBe(true);
  });

  test('pull pages by server cursor until a short page', async () => {
    let n = 0;
    const f = fakeFetch(() => { n++; return { json: n === 1 ? [{ id: 'a', synced_at: 's1' }, { id: 'b', synced_at: 's2' }] : [{ id: 'c', synced_at: 's3' }] }; });
    const c = createSyncClient({ url: 'https://x', key: 'pk', fetchImpl: f });
    const rows = await c.pull('T', 's0', { pageSize: 2 });
    expect(rows.map(r => r.id)).toEqual(['a', 'b', 'c']);
    expect(f.calls[1].url).toContain('synced_at=gt.s2');
    expect(f.calls[0].headers.Authorization).toBe('Bearer T');
  });

  test('push upserts in batches with merge-duplicates and the device name', async () => {
    const f = fakeFetch(() => ({ status: 201 }));
    const c = createSyncClient({ url: 'https://x', key: 'pk', fetchImpl: f });
    await c.push('T', [1, 2, 3].map(i => ({ kind: 'task', id: `t${i}`, data: {}, deleted: false, updated_at: 'u' })), { device: 'PC', batchSize: 2 });
    expect(f.calls.length).toBe(2);
    expect(f.calls[0].url).toContain('on_conflict=user_id,kind,id');
    expect(f.calls[0].headers.Prefer).toContain('merge-duplicates');
    expect(f.calls[0].body[0].device).toBe('PC');
  });

  test('errors are classified, network failure is "offline"', async () => {
    const c401 = createSyncClient({ url: 'https://x', key: 'pk', fetchImpl: fakeFetch(() => ({ status: 401, json: { msg: 'JWT expired' } })) });
    await expect(c401.pull('T')).rejects.toMatchObject({ code: 'unauthorized', status: 401 });
    const off = createSyncClient({ url: 'https://x', key: 'pk', fetchImpl: async () => { throw new Error('ENOTFOUND'); } });
    await expect(off.sendCode('a@b.c')).rejects.toBeInstanceOf(SyncError);
    await expect(off.sendCode('a@b.c')).rejects.toMatchObject({ code: 'offline' });
  });
});
