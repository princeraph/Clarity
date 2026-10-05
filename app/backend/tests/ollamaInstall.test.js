import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createServer } from 'http';
import { createOllamaInstaller, INSTALLER_URL, recommendedOllamaModel } from '../src/ollama/install.js';

const GB = 1024 ** 3;
let server, endpoint, work, ollama;   // ollama: what the fake Ollama does

beforeEach(async () => {
  work = mkdtempSync(join(tmpdir(), 'clarity-ollama-'));
  ollama = { up: false, pulled: [], pullError: null };
  server = createServer((req, res) => {
    if (!ollama.up) { req.socket.destroy(); return; }
    if (req.url === '/api/tags') { res.writeHead(200); return res.end('{"models":[]}'); }
    if (req.url === '/api/pull') {
      let body = ''; req.on('data', c => body += c); req.on('end', () => {
        const { model } = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
        if (ollama.pullError) return res.end(JSON.stringify({ error: ollama.pullError }) + '\n');
        const lines = [
          { status: 'pulling manifest' },
          { status: 'pulling a', digest: 'sha256:a', total: 1000, completed: 400 },
          { status: 'pulling b', digest: 'sha256:b', total: 500, completed: 500 },
          { status: 'pulling a', digest: 'sha256:a', total: 1000, completed: 1000 },
          { status: 'success' },
        ];
        ollama.pulled.push(model);
        res.end(lines.map(l => JSON.stringify(l)).join('\n') + '\n');
      });
      return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  endpoint = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  server.closeAllConnections?.();
  await new Promise(r => server.close(r));
  rmSync(work, { recursive: true, force: true });
});

// The installer comes from the Internet in real life; here, 3 KB of nothing.
const fetchImpl = (url, opts) => url === INSTALLER_URL
  ? Promise.resolve(new Response(new Uint8Array(3000), { headers: { 'content-length': '3000' } }))
  : fetch(url, opts);

function make(over = {}) {
  const calls = { verify: 0, install: 0, serve: 0, complete: [] };
  const exePath = join(work, 'ollama.exe');
  const inst = createOllamaInstaller({
    platform: 'win32', fetchImpl, endpoint, exePath, workDir: work, waitMs: 3000,
    verify: async () => { calls.verify++; return { ok: true, detail: 'Valid CN=Ollama Inc.' }; },
    // A real install puts ollama.exe in place and starts the server.
    install: async () => { calls.install++; writeFileSync(exePath, 'x'); ollama.up = true; },
    serve: () => { calls.serve++; ollama.up = true; },
    onComplete: (m) => { calls.complete.push(m); },
    ...over,
  });
  return { inst, calls, exePath };
}
const until = async (inst, states) => {
  for (let i = 0; i < 300; i++) {
    const s = inst.status().install;
    if (s && states.includes(s.state)) return s;
    await new Promise(r => setTimeout(r, 20));
  }
  throw new Error(JSON.stringify(inst.status()));
};

describe('installing Ollama for the person', () => {
  test('nothing installed: download, check the signature, install, pull — then switch', async () => {
    const { inst, calls } = make();
    expect(inst.start('gemma4:e2b')).toEqual({ ok: true });
    const s = await until(inst, ['done', 'error']);
    expect(s).toMatchObject({ state: 'done', received: 1500, total: 1500 });
    expect(calls).toMatchObject({ verify: 1, install: 1, serve: 0, complete: ['gemma4:e2b'] });
    expect(ollama.pulled).toEqual(['gemma4:e2b']);
    expect(readdirSync(work)).toEqual(['ollama.exe']);   // the installer file is gone
  });

  test('an installer whose signature is not Ollama’s is never run', async () => {
    const { inst, calls } = make({ verify: async () => ({ ok: false, detail: 'NotSigned' }) });
    inst.start('gemma4:e2b');
    const s = await until(inst, ['done', 'error']);
    expect(s.state).toBe('error');
    expect(s.error).toMatch(/signature is not valid.*NotSigned/);
    expect(calls.install).toBe(0);
    expect(readdirSync(work)).toEqual([]);
  });

  test('Ollama already running: nothing is installed, only the model is pulled', async () => {
    ollama.up = true;
    const { inst, calls } = make();
    inst.start('gemma4:e4b');
    expect((await until(inst, ['done', 'error'])).state).toBe('done');
    expect(calls).toMatchObject({ verify: 0, install: 0, serve: 0 });
    expect(ollama.pulled).toEqual(['gemma4:e4b']);
  });

  test('installed but not started: Clarity starts it', async () => {
    const { inst, calls, exePath } = make();
    writeFileSync(exePath, 'x');
    inst.start('gemma4:e2b');
    expect((await until(inst, ['done', 'error'])).state).toBe('done');
    expect(calls).toMatchObject({ install: 0, serve: 1 });
  }, 20000);

  test('an error from Ollama during the pull is reported', async () => {
    ollama.up = true; ollama.pullError = 'pull model manifest: file does not exist';
    const { inst, calls } = make();
    inst.start('gemma4:nope');
    const s = await until(inst, ['done', 'error']);
    expect(s.error).toMatch(/file does not exist/);
    expect(calls.complete).toEqual([]);
  });

  test('refuses outside Windows, a malformed model name, and a second run', async () => {
    expect(make({ platform: 'linux' }).inst.start('gemma4:e2b').code).toBe(501);
    const { inst } = make();
    expect(inst.start('gemma4:e2b; rm -rf /').code).toBe(400);
    expect(inst.start('../evil').code).toBe(400);
    inst.start('gemma4:e2b');
    expect(inst.start('gemma4:e2b').code).toBe(409);
    await until(inst, ['done', 'error']);
  });

  test('the larger model only with 16 GB of RAM', () => {
    expect(recommendedOllamaModel(8 * GB)).toBe('gemma4:e2b');
    expect(recommendedOllamaModel(15.4 * GB)).toBe('gemma4:e4b');
  });
});
