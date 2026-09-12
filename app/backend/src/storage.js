// Durable file helpers shared by the task store and the profile store.
//
// Extracted rather than duplicated: the task store learned the hard way that a
// plain writeFileSync truncates the file when the process dies mid-write, and
// the profile is the one file in Clarity that cannot be recomputed from
// anything else.

import { readFileSync, writeFileSync, renameSync, existsSync, appendFileSync } from 'fs';

// Write to a sibling temp file, then rename. Rename is atomic on the same
// filesystem, so a reader sees either the old file or the new one — never half.
export function writeJSONAtomic(file, payload) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(payload, null, 2));
  renameSync(tmp, file);
}

// Move a damaged file out of the way instead of deleting or overwriting it.
// Returns the path it was moved to, or null if it could not be moved.
export function quarantine(file, label = 'corrupt') {
  const dest = `${file}.${label}-${Date.now()}`;
  try { renameSync(file, dest); return dest; }
  catch { return null; }
}

// Append one JSON object as a line. Append is the only write that is safe
// without locking when more than one thing may be writing.
export function appendJSONL(file, obj) {
  appendFileSync(file, JSON.stringify(obj) + '\n');
}

// Read a JSONL file, skipping any line that does not parse. A crash during
// append can leave the final line torn; that must cost one entry, not the file.
export function readJSONL(file, { limit = Infinity } = {}) {
  if (!existsSync(file)) return { entries: [], skipped: 0 };
  let text = '';
  try { text = readFileSync(file, 'utf8'); } catch { return { entries: [], skipped: 0 }; }

  const lines = text.split('\n');
  const entries = [];
  let skipped = 0;
  // Walk backwards so `limit` keeps the most recent entries, not the oldest.
  for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    try { entries.push(JSON.parse(line)); }
    catch { skipped++; }
  }
  entries.reverse();
  return { entries, skipped };
}
