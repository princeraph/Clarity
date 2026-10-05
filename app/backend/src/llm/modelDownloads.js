// Getting the built-in assistant's model onto the machine: 3 to 5 GB, over
// whatever connection a friend has, possibly closed halfway through.
//
// What it guarantees:
// - a download that stops (closed app, lost Wi-Fi, Cancel) resumes where it
//   was, from the `.part` file, instead of starting over;
// - nothing becomes a usable model before its sha256 matches the catalog, so a
//   truncated or altered file is never loaded;
// - the URLs are fixed here, pinned to a revision — nothing a request sends can
//   point the backend at another address.

import { createWriteStream, createReadStream, existsSync, statSync, renameSync, rmSync, mkdirSync, statfsSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { totalmem } from 'os';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const GB = 1024 ** 3;

// Measured on 5 October, 4-core CPU without GPU (BACKLOG): E2B loads in 5 s and
// links six tasks in 38 s, with a missed or reversed link now and then; E4B
// takes 8 s and 58 s, and got every link right. Both Apache-2.0.
export const CATALOG = [
  {
    id: 'gemma-4-e2b',
    file: 'gemma-4-E2B-it-Q4_0.gguf',
    url: 'https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF/resolve/b4243c156154b6dca9324415f8c7ccc098b4aed1/gemma-4-E2B-it-Q4_0.gguf',
    size: 2841481184,
    sha256: '8e30dff3ac4c8434c49a7036fa15564bdbb6044e42bf04550bf1a096ad7e6a52',
    minRamGB: 8,
  },
  {
    id: 'gemma-4-e4b',
    file: 'gemma-4-E4B-it-Q4_0.gguf',
    url: 'https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/b8093469224f83f5c38f691eb906c380e9e63114/gemma-4-E4B-it-Q4_0.gguf',
    size: 4590807392,
    sha256: 'a555b900214b477d8880e7832e0b8925e139b0159640036b09fe472b6f2097f2',
    minRamGB: 16,
  },
];

// Room left after the model is written: the system needs space too, and a disk
// filled to the last byte breaks more than Clarity.
export const DISK_MARGIN = 1 * GB;

/** The best model this machine can run comfortably — the larger one only with
 *  16 GB, since it holds about 6 GB while answering. */
export function recommend(ramBytes = totalmem(), catalog = CATALOG) {
  const ramGB = ramBytes / GB;
  const fitting = catalog.filter(m => ramGB >= m.minRamGB * 0.9);   // "16 GB" machines report ~15.4
  return (fitting.at(-1) || catalog[0]).id;
}

export function freeBytes(dir) {
  try { const s = statfsSync(dir); return s.bavail * s.bsize; }
  catch { return null; }   // unknown: the download is not refused for it
}

async function hashFile(path, hash) {
  await pipeline(createReadStream(path), async function* (src) { for await (const c of src) hash.update(c); });
}

export function createDownloader({ modelsDir, catalog = CATALOG, fetchImpl = fetch, onComplete = () => {}, freeSpace = freeBytes }) {
  let current = null;   // { id, state, received, total, error, controller }

  const entry = id => catalog.find(m => m.id === id);
  const finalPath = m => join(modelsDir, m.file);
  const partPath = m => join(modelsDir, `${m.file}.part`);

  function status() {
    return {
      download: current && {
        id: current.id, state: current.state, received: current.received,
        total: current.total, error: current.error,
      },
      models: catalog.map(m => ({
        id: m.id, file: m.file, size: m.size, minRamGB: m.minRamGB,
        installed: existsSync(finalPath(m)),
        partial: existsSync(partPath(m)) ? statSync(partPath(m)).size : 0,
      })),
    };
  }

  async function run(m, controller) {
    const part = partPath(m);
    const hash = createHash('sha256');
    let have = existsSync(part) ? statSync(part).size : 0;
    if (have > m.size) { rmSync(part); have = 0; }
    if (have) {
      // The hash must cover the whole file, so the part already on disk is
      // read back first. A few seconds for 3 GB, against hours to re-download.
      current.state = 'resuming';
      await hashFile(part, hash);
    }
    current.received = have;
    current.state = 'downloading';

    if (have < m.size) {
      const resp = await fetchImpl(m.url, {
        headers: have ? { Range: `bytes=${have}-` } : {},
        signal: controller.signal,
      });
      if (have && resp.status === 200) {
        // The server ignored the range and sent the whole file: start over
        // rather than append a second copy after the first part.
        await resp.body?.cancel().catch(() => {});
        rmSync(part);
        return run(m, controller);
      }
      if (!(resp.ok || resp.status === 206)) throw new Error(`HTTP ${resp.status}`);
      const out = createWriteStream(part, { flags: have ? 'a' : 'w' });
      await pipeline(Readable.fromWeb(resp.body), async function* (src) {
        for await (const chunk of src) {
          hash.update(chunk);
          current.received += chunk.length;
          yield chunk;
        }
      }, out);
    }

    current.state = 'verifying';
    const digest = hash.digest('hex');
    if (digest !== m.sha256) {
      // A file that does not match is never kept: resuming from it would only
      // produce another file that does not match.
      rmSync(part, { force: true });
      throw new Error('The downloaded file is damaged — it has been removed. Try again.');
    }
    renameSync(part, finalPath(m));
    current.state = 'done';
    onComplete(m);
  }

  return {
    status,

    /** Starts in the background; status() reports progress. */
    start(id) {
      const m = entry(id);
      if (!m) return { error: 'Unknown model', code: 400 };
      if (current && ['resuming', 'downloading', 'verifying'].includes(current.state)) {
        return { error: 'A download is already running', code: 409 };
      }
      if (existsSync(finalPath(m))) { onComplete(m); return { ok: true, already: true }; }
      mkdirSync(modelsDir, { recursive: true });
      const have = existsSync(partPath(m)) ? statSync(partPath(m)).size : 0;
      const free = freeSpace(modelsDir);
      if (free !== null && free < m.size - have + DISK_MARGIN) {
        return { error: 'Not enough disk space', code: 507, needed: m.size - have + DISK_MARGIN, free };
      }
      const controller = new AbortController();
      current = { id, state: 'downloading', received: have, total: m.size, error: null, controller };
      const mine = current;
      run(m, controller).catch(err => {
        if (current !== mine) return;
        // Cancel keeps the .part: the next start resumes from it.
        mine.state = controller.signal.aborted ? 'cancelled' : 'error';
        mine.error = controller.signal.aborted ? null : (err.message || String(err));
      });
      return { ok: true };
    },

    cancel() {
      if (!current || !['resuming', 'downloading'].includes(current.state)) return false;
      current.controller.abort();
      return true;
    },

    /** Frees the disk: the model and any partial download of it. */
    remove(id) {
      const m = entry(id);
      if (!m) return false;
      if (current?.id === id && ['resuming', 'downloading', 'verifying'].includes(current.state)) return false;
      rmSync(finalPath(m), { force: true });
      rmSync(partPath(m), { force: true });
      return true;
    },
  };
}
