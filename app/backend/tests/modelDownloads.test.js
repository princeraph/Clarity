import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createServer } from 'http';
import { createHash, randomBytes } from 'crypto';
import { createDownloader, recommend, CATALOG } from '../src/llm/modelDownloads.js';

const GB = 1024 ** 3;
const body = randomBytes(256 * 1024);
const sha256 = createHash('sha256').update(body).digest('hex');

let server, base, dir, requests, mode;
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'clarity-dl-'));
  requests = []; mode = 'normal';
  server = createServer((req, res) => {
    requests.push(req.headers.range || null);
    const m = /bytes=(\d+)-/.exec(req.headers.range || '');
    if (mode === 'slow') {   // sends a little, then waits: something to cancel
      res.writeHead(200, { 'Content-Length': body.length });
      res.write(body.subarray(0, 1024));
      return;
    }
    if (m && mode !== 'ignore-range') {
      const from = Number(m[1]);
      res.writeHead(206, { 'Content-Range': `bytes ${from}-${body.length - 1}/${body.length}` });
      return res.end(body.subarray(from));
    }
    res.writeHead(200, { 'Content-Length': body.length });
    res.end(body);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  server.closeAllConnections?.();
  await new Promise(r => server.close(r));
  rmSync(dir, { recursive: true, force: true });
});

const model = (over = {}) => ({ id: 'mini', file: 'mini.gguf', url: `${base}/mini.gguf`, size: body.length, sha256, minRamGB: 1, ...over });
const until = async (dl, states) => {
  for (let i = 0; i < 200; i++) {
    const d = dl.status().download;
    if (d && states.includes(d.state)) return d;
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error(`never reached ${states}: ${JSON.stringify(dl.status().download)}`);
};

describe('model download', () => {
  test('downloads, checks the hash, and only then makes the model usable', async () => {
    const done = [];
    const dl = createDownloader({ modelsDir: dir, catalog: [model()], onComplete: m => done.push(m.id) });
    expect(dl.start('mini')).toEqual({ ok: true });
    const d = await until(dl, ['done', 'error']);
    expect(d).toMatchObject({ state: 'done', received: body.length, total: body.length });
    expect(readFileSync(join(dir, 'mini.gguf')).equals(body)).toBe(true);
    expect(existsSync(join(dir, 'mini.gguf.part'))).toBe(false);
    expect(done).toEqual(['mini']);
    expect(dl.status().models[0].installed).toBe(true);
  });

  test('resumes from the part already on disk instead of starting over', async () => {
    writeFileSync(join(dir, 'mini.gguf.part'), body.subarray(0, 100000));
    const dl = createDownloader({ modelsDir: dir, catalog: [model()] });
    dl.start('mini');
    expect((await until(dl, ['done', 'error'])).state).toBe('done');
    expect(requests).toEqual(['bytes=100000-']);
    expect(readFileSync(join(dir, 'mini.gguf')).equals(body)).toBe(true);
  });

  test('a server that ignores the range does not leave a doubled file', async () => {
    mode = 'ignore-range';
    writeFileSync(join(dir, 'mini.gguf.part'), body.subarray(0, 100000));
    const dl = createDownloader({ modelsDir: dir, catalog: [model()] });
    dl.start('mini');
    expect((await until(dl, ['done', 'error'])).state).toBe('done');
    expect(readFileSync(join(dir, 'mini.gguf')).equals(body)).toBe(true);
  });

  test('a file whose hash does not match is removed, never installed', async () => {
    const dl = createDownloader({ modelsDir: dir, catalog: [model({ sha256: '0'.repeat(64) })] });
    dl.start('mini');
    const d = await until(dl, ['done', 'error']);
    expect(d.state).toBe('error');
    expect(d.error).toMatch(/damaged/);
    expect(existsSync(join(dir, 'mini.gguf'))).toBe(false);
    expect(existsSync(join(dir, 'mini.gguf.part'))).toBe(false);
  });

  test('cancel keeps what was downloaded, and the next start resumes from it', async () => {
    mode = 'slow';
    const dl = createDownloader({ modelsDir: dir, catalog: [model()] });
    dl.start('mini');
    for (let i = 0; i < 200 && !(dl.status().download.received > 0); i++) await new Promise(r => setTimeout(r, 10));
    expect(dl.cancel()).toBe(true);
    expect((await until(dl, ['cancelled', 'error'])).state).toBe('cancelled');
    expect(dl.status().models[0].partial).toBe(1024);
    mode = 'normal';
    dl.start('mini');
    expect((await until(dl, ['done', 'error'])).state).toBe('done');
    expect(requests.at(-1)).toBe('bytes=1024-');
    expect(readFileSync(join(dir, 'mini.gguf')).equals(body)).toBe(true);
  });

  test('refuses an unknown model, a second download, and a full disk', async () => {
    mode = 'slow';
    const dl = createDownloader({ modelsDir: dir, catalog: [model(), model({ id: 'other', file: 'other.gguf' })] });
    expect(dl.start('nope').code).toBe(400);
    dl.start('mini');
    expect(dl.start('other').code).toBe(409);
    dl.cancel();
    const full = createDownloader({ modelsDir: dir, catalog: [model()], freeSpace: () => 1000 });
    expect(full.start('mini').code).toBe(507);
  });

  test('the catalog only points at pinned revisions, with a hash for each file', () => {
    for (const m of CATALOG) {
      expect(m.url).toMatch(/^https:\/\/huggingface\.co\/.+\/resolve\/[0-9a-f]{40}\//);
      expect(m.url.endsWith(m.file)).toBe(true);
      expect(m.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('which model for this machine', () => {
  test('the larger model only with 16 GB of RAM', () => {
    expect(recommend(8 * GB)).toBe('gemma-4-e2b');
    expect(recommend(15.4 * GB)).toBe('gemma-4-e4b');   // what a "16 GB" laptop reports
    expect(recommend(32 * GB)).toBe('gemma-4-e4b');
    expect(recommend(4 * GB)).toBe('gemma-4-e2b');      // below everything: still the smallest
  });
});
