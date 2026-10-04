import { describe, test, expect } from '@jest/globals';
import { EventEmitter } from 'events';
import { createSecretStore, ipcBox, probeBox, SECRET_FIELDS } from '../src/security/secrets.js';

// A stand-in for Electron's safeStorage: reversible, and obviously not the input.
const box = {
  encrypt: async s => Buffer.from(s.split('').reverse().join('')).toString('base64'),
  decrypt: async s => Buffer.from(s, 'base64').toString().split('').reverse().join(''),
};
const TEMOIN = 'sk-TEMOIN-ne-doit-jamais-etre-ecrit-en-clair';

describe('secret store, with the shell able to encrypt', () => {
  test('a secret written to the file is never in plain text', async () => {
    const s = createSecretStore(box);
    await s.load({});
    const file = await s.toFile({ providerType: 'openai', apiKey: TEMOIN, tunnelSecret: '' }, {});
    expect(JSON.stringify(file)).not.toContain(TEMOIN);
    expect(file.apiKey).toHaveProperty('enc');
    expect(file.tunnelSecret).toBe('');
    expect(file.providerType).toBe('openai');
  });

  test('round trip: what was saved is read back after a restart', async () => {
    const file = await createSecretStore(box).toFile({ apiKey: TEMOIN, tunnelSecret: 'tun' }, {});
    const restarted = createSecretStore(box);
    await restarted.load(file);
    const view = restarted.view(file);
    expect(view.apiKey).toBe(TEMOIN);
    expect(view.tunnelSecret).toBe('tun');
  });

  test('a plain-text secret from an older version asks to be migrated', async () => {
    const s = createSecretStore(box);
    expect((await s.load({ apiKey: TEMOIN })).needsMigration).toBe(true);
    expect((await createSecretStore(box).load({ apiKey: '' })).needsMigration).toBe(false);
  });

  test('an undecryptable secret reads as absent, without throwing', async () => {
    const broken = { ...box, decrypt: async () => { throw new Error('wrong user'); } };
    const logs = [];
    const s = createSecretStore(broken, { log: m => logs.push(m) });
    await s.load({ apiKey: { enc: 'xxx' } });
    expect(s.view({ apiKey: { enc: 'xxx' } }).apiKey).toBe('');
    expect(logs.join(' ')).toMatch(/could not decrypt apiKey/);
  });
});

describe('secret store, without the shell (node server.js)', () => {
  test('stores plain text, as before', async () => {
    const s = createSecretStore(null);
    await s.load({});
    expect((await s.toFile({ apiKey: 'k' }, {})).apiKey).toBe('k');
  });

  test('never erases a secret it cannot decrypt', async () => {
    const raw = { apiKey: { enc: 'chiffre' } };
    const s = createSecretStore(null);
    await s.load(raw);
    expect(s.view(raw).apiKey).toBe('');
    const file = await s.toFile({ ...s.view(raw), ollamaModel: 'x' }, raw);
    expect(file.apiKey).toEqual({ enc: 'chiffre' });
  });

  test('covers exactly the two secrets', () => {
    expect(SECRET_FIELDS).toEqual(['apiKey', 'tunnelSecret']);
  });
});

describe('IPC to the Electron main process', () => {
  // A fake child-process side: whatever is sent is answered like main.js does.
  function fakeProc(handler) {
    const proc = new EventEmitter();
    proc.send = m => setImmediate(() => proc.emit('message', { type: 'secret:reply', id: m.id, ...handler(m) }));
    return proc;
  }

  test('no channel → no box', async () => {
    expect(ipcBox({})).toBeNull();
    expect(await probeBox({})).toBeNull();
  });

  test('requests and replies are matched by id', async () => {
    const b = ipcBox(fakeProc(m => ({ ok: true, data: `${m.op}:${m.data}` })));
    const [a, c] = await Promise.all([b.encrypt('x'), b.decrypt('y')]);
    expect(a).toBe('encrypt:x');
    expect(c).toBe('decrypt:y');
  });

  test('a shell that cannot encrypt yields no box — never a silent plain-text one', async () => {
    expect(await probeBox(fakeProc(() => ({ ok: true, data: false })))).toBeNull();
    expect(await probeBox(fakeProc(() => ({ ok: false, error: 'unavailable' })))).toBeNull();
  });

  test('an error from the shell rejects', async () => {
    const b = ipcBox(fakeProc(() => ({ ok: false, error: 'boom' })));
    await expect(b.encrypt('x')).rejects.toThrow('boom');
  });

  test('a shell that never answers times out', async () => {
    const proc = new EventEmitter(); proc.send = () => {};
    const b = ipcBox(proc, { timeoutMs: 20 });
    await expect(b.encrypt('x')).rejects.toThrow(/timed out/);
  });
});
