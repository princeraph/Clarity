// Installing Ollama for someone who would rather not open a terminal — Windows,
// where Clarity's friends are. One call does what the Ollama docs ask a person
// to do by hand: download the installer, run it, start the server, pull a model.
//
// Trust: the installer comes from the one address Ollama publishes, and is run
// only if Windows says its Authenticode signature is valid AND names Ollama.
// "Latest" changes with every release, so there is no fixed hash to pin — the
// publisher's signature is what stays the same. Nothing in a request can change
// the address; the model name is checked against Ollama's own naming.
//
// It installs per user (Ollama's installer needs no admin rights) and never
// touches an Ollama that is already running.

import { createWriteStream, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir, totalmem } from 'os';
import { spawn, execFile } from 'child_process';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

export const INSTALLER_URL = 'https://ollama.com/download/OllamaSetup.exe';
export const ENDPOINT = 'http://localhost:11434';
const GB = 1024 ** 3;

// Ollama's names for the two models the built-in assistant also offers.
export function recommendedOllamaModel(ramBytes = totalmem()) {
  return ramBytes / GB >= 16 * 0.9 ? 'gemma4:e4b' : 'gemma4:e2b';
}

export const MODEL_NAME = /^[a-z0-9][a-z0-9._-]{0,63}(:[a-z0-9][a-z0-9._-]{0,63})?$/;

export function ollamaExePath(env = process.env) {
  return join(env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe');
}

/** Windows' own verdict on the file's signature. */
export function verifySignature(file) {
  return new Promise((resolve) => {
    const script = '$s = Get-AuthenticodeSignature -LiteralPath $env:CLARITY_FILE; "$($s.Status)|$($s.SignerCertificate.Subject)"';
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
      { env: { ...process.env, CLARITY_FILE: file }, windowsHide: true, timeout: 60000 },
      (err, stdout) => {
        if (err) return resolve({ ok: false, detail: err.message });
        const [status, subject = ''] = String(stdout).trim().split('|');
        resolve({ ok: status === 'Valid' && /ollama/i.test(subject), detail: `${status} ${subject}`.trim() });
      });
  });
}

/** Ollama's installer is Inno Setup: these are its documented silent switches. */
export function runInstaller(file) {
  return new Promise((resolve, reject) => {
    const p = spawn(file, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-'], { windowsHide: true });
    const timer = setTimeout(() => { p.kill(); reject(new Error('installer timed out')); }, 15 * 60000);
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.on('exit', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`installer exited with ${code}`)); });
  });
}

export function startServer(exe) {
  const p = spawn(exe, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true });
  p.on('error', () => {});
  p.unref();
}

export function createOllamaInstaller({
  platform = process.platform,
  fetchImpl = fetch,
  endpoint = ENDPOINT,
  exePath = ollamaExePath(),
  workDir = tmpdir(),
  verify = verifySignature,
  install = runInstaller,
  serve = startServer,
  waitMs = 60000,
  onComplete = () => {},
} = {}) {
  let current = null;   // { state, model, received, total, error, controller }
  const ACTIVE = ['downloading', 'verifying', 'installing', 'starting', 'pulling'];

  async function reachable() {
    try { return (await fetchImpl(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(2000) })).ok; }
    catch { return false; }
  }

  async function waitForServer(signal) {
    const until = Date.now() + waitMs;
    while (Date.now() < until) {
      if (signal.aborted) throw signal.reason;
      if (await reachable()) return true;
      await new Promise(r => setTimeout(r, 1000));
    }
    return false;
  }

  async function download(signal) {
    const file = join(workDir, 'clarity-OllamaSetup.exe');
    const resp = await fetchImpl(INSTALLER_URL, { signal });
    if (!resp.ok) throw new Error(`installer download: HTTP ${resp.status}`);
    current.total = Number(resp.headers.get('content-length')) || 0;
    current.received = 0;
    await pipeline(Readable.fromWeb(resp.body), async function* (src) {
      for await (const c of src) { current.received += c.length; yield c; }
    }, createWriteStream(file));
    return file;
  }

  // Ollama reports each layer separately ({digest, total, completed}); the sum
  // is what the person wants to see.
  async function pull(model, signal) {
    const resp = await fetchImpl(`${endpoint}/api/pull`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: true }), signal,
    });
    if (!resp.ok) throw new Error(`pull: HTTP ${resp.status}`);
    const layers = new Map();
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of resp.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines.filter(Boolean)) {
        let msg; try { msg = JSON.parse(line); } catch { continue; }
        if (msg.error) throw new Error(`pull: ${msg.error}`);
        if (msg.digest && msg.total) layers.set(msg.digest, { total: msg.total, completed: msg.completed || 0 });
        current.total = [...layers.values()].reduce((s, l) => s + l.total, 0);
        current.received = [...layers.values()].reduce((s, l) => s + l.completed, 0);
        if (msg.status === 'success') return;
      }
    }
    throw new Error('pull: Ollama closed the connection before the model was complete');
  }

  async function run(model, controller) {
    const { signal } = controller;
    if (!(await reachable())) {
      if (!existsSync(exePath)) {
        current.state = 'downloading';
        const file = await download(signal);
        try {
          current.state = 'verifying';
          const sig = await verify(file);
          console.log(`[ollama] installer signature: ${sig.detail}`);
          if (!sig.ok) throw new Error(`The Ollama installer's signature is not valid (${sig.detail}) — it was not run.`);
          current.state = 'installing';
          await install(file);
        } finally {
          rmSync(file, { force: true });
        }
      }
      current.state = 'starting';
      // The installer usually starts Ollama itself; if not, Clarity does.
      if (!(await waitForServer(AbortSignal.any([signal, AbortSignal.timeout(10000)])).catch(() => false))) {
        if (!existsSync(exePath)) throw new Error('Ollama is not where its installer puts it.');
        serve(exePath);
        if (!(await waitForServer(signal))) throw new Error('Ollama was installed but does not answer.');
      }
    }
    current.state = 'pulling';
    current.received = 0; current.total = 0;
    await pull(model, signal);
    current.state = 'done';
    await onComplete(model);
  }

  return {
    supported: platform === 'win32',

    /** Is an Ollama answering right now — whatever provider Clarity uses. */
    running: reachable,

    status() {
      return {
        supported: platform === 'win32',
        installed: existsSync(exePath),
        install: current && { state: current.state, model: current.model, received: current.received,
                              total: current.total, error: current.error },
      };
    },

    start(model) {
      if (platform !== 'win32') return { error: 'Installing Ollama from Clarity is only available on Windows', code: 501 };
      if (!MODEL_NAME.test(model)) return { error: 'Invalid model name', code: 400 };
      if (current && ACTIVE.includes(current.state)) return { error: 'An installation is already running', code: 409 };
      const controller = new AbortController();
      current = { state: 'starting', model, received: 0, total: 0, error: null, controller };
      const mine = current;
      run(model, controller).catch(err => {
        if (current !== mine) return;
        mine.state = controller.signal.aborted ? 'cancelled' : 'error';
        mine.error = controller.signal.aborted ? null : (err?.message || String(err));
      });
      return { ok: true };
    },

    cancel() {
      // The installer itself is not interrupted: half an installation is worse than a whole one.
      if (!current || !['downloading', 'pulling', 'starting'].includes(current.state)) return false;
      current.controller.abort();
      return true;
    },
  };
}
