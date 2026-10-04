// Secrets in settings.json — the cloud API key and the tunnel secret — used to
// sit there in plain text: anyone who copied the file, or a backup of it, could
// read them. They are now encrypted with the operating system's own store
// (DPAPI on Windows, the Keychain on macOS), tied to the user's account.
//
// The backend cannot do that itself. It runs as a child process with Electron's
// binary in plain-Node mode, and `safeStorage` only exists in Electron's main
// process. So the main process does the cryptography and the backend asks for
// it over the child-process IPC channel (`process.send`). The backend stays the
// only owner of settings.json; the shell only encrypts and decrypts strings.
//
// Without that channel — `node server.js` during development — nothing can be
// encrypted. Secrets are then stored as before, in plain text, and an already
// encrypted one is left untouched rather than lost or downgraded.
//
// Pure apart from the injected `box` and `proc`: tested without Electron.

export const SECRET_FIELDS = ['apiKey', 'tunnelSecret'];

const isEnc = v => !!v && typeof v === 'object' && typeof v.enc === 'string';

// Request/response over the IPC channel to Electron's main process.
// Returns null when there is no channel (plain `node server.js`).
export function ipcBox(proc = process, { timeoutMs = 5000 } = {}) {
  if (typeof proc.send !== 'function') return null;
  let seq = 0;
  const pending = new Map();
  proc.on('message', m => {
    if (m?.type !== 'secret:reply') return;
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    clearTimeout(p.timer);
    if (m.ok) p.resolve(m.data); else p.reject(new Error(m.error || 'secret operation failed'));
  });
  const call = (op, data) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`secret ${op} timed out`)); }, timeoutMs);
    timer.unref?.();
    pending.set(id, { resolve, reject, timer });
    try { proc.send({ type: 'secret', op, id, data }); }
    catch (e) { clearTimeout(timer); pending.delete(id); reject(e); }
  });
  return {
    available: () => call('available'),
    encrypt: s => call('encrypt', s),
    decrypt: s => call('decrypt', s),
  };
}

// The box to use, or null if the shell says it cannot encrypt (Linux without a
// keyring, for instance) or does not answer.
export async function probeBox(proc = process) {
  const box = ipcBox(proc);
  if (!box) return null;
  try { return (await box.available()) === true ? box : null; }
  catch { return null; }
}

export function createSecretStore(box, { log = () => {} } = {}) {
  let runtime = {};   // field → plain text, held in memory only

  return {
    get encrypting() { return !!box; },

    // At startup: decrypt what is stored, and report whether the file still
    // holds a plain-text secret that should now be encrypted (migration).
    async load(raw) {
      runtime = {};
      let plainLeft = false;
      for (const f of SECRET_FIELDS) {
        const v = raw?.[f];
        if (isEnc(v)) {
          if (!box) { runtime[f] = ''; continue; }
          try { runtime[f] = await box.decrypt(v.enc); }
          catch (e) {
            // Unreadable: another user's or another machine's copy. The key is
            // simply absent; the user enters it again. Never crash on it.
            runtime[f] = '';
            log(`[secrets] could not decrypt ${f}: ${e.message}`);
          }
        } else if (typeof v === 'string') {
          runtime[f] = v;
          if (v && box) plainLeft = true;
        }
      }
      return { needsMigration: plainLeft };
    },

    // What the rest of the backend sees: plain values, from memory.
    view(raw) {
      const out = { ...raw };
      for (const f of SECRET_FIELDS) {
        if (f in runtime) out[f] = runtime[f];
        else out[f] = typeof raw?.[f] === 'string' ? raw[f] : '';
      }
      return out;
    },

    // What goes into settings.json.
    async toFile(next, raw) {
      const out = { ...next };
      for (const f of SECRET_FIELDS) {
        const value = typeof next[f] === 'string' ? next[f] : '';
        if (box) {
          out[f] = value ? { enc: await box.encrypt(value) } : '';
        } else if (!value && isEnc(raw?.[f])) {
          out[f] = raw[f];   // cannot decrypt it here, so never overwrite it with nothing
        } else {
          out[f] = value;    // development without the shell: plain text, as before
        }
        runtime[f] = value;
      }
      return out;
    },

    clear() { runtime = {}; },
  };
}
