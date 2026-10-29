// Topics (2.6.0). A topic is a tag, and nothing else: the sidebar lists every
// tag in use. Two things went wrong with that.
//
// 1. « perso » and « Perso » were two topics. A tag is now compared trimmed and
//    without case, and a new tag takes the spelling the store already uses —
//    so the second spelling never gets in.
// 2. A topic could not be renamed or removed: it existed as long as one task
//    carried it. renameTopic (which merges, when the new name is already a
//    topic) and removeTopic rewrite the tags of every task, archived included.
//    Removing a topic never removes a task.
//
// Pure: no I/O. server.js reads, applies, saves.

export const topicKey = (tag) => String(tag).trim().toLocaleLowerCase();

// The spelling the store uses for each topic: the most frequent one, the first
// met on a tie.
export function spellings(tasks) {
  const counts = new Map();   // key → Map(spelling → n)
  for (const t of tasks) for (const tag of t.tags || []) {
    const s = String(tag).trim();
    if (!s) continue;
    const k = topicKey(s);
    if (!counts.has(k)) counts.set(k, new Map());
    const m = counts.get(k);
    m.set(s, (m.get(s) || 0) + 1);
  }
  const out = new Map();
  for (const [k, m] of counts) {
    let best = null, n = -1;
    for (const [s, c] of m) if (c > n) { best = s; n = c; }
    out.set(k, best);
  }
  return out;
}

// A task's tags as they should be stored: trimmed, no empty one, no two that
// differ only by case, each in the spelling already in use elsewhere.
export function canonicalTags(tags, known = new Map()) {
  if (!Array.isArray(tags)) return tags;
  const seen = new Set();
  const out = [];
  for (const tag of tags) {
    const s = String(tag).trim();
    if (!s) continue;
    const k = topicKey(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(known.get(k) || s);
  }
  return out;
}

// Every task carrying `from` (any case) carries `to` instead, once. Returns the
// number of tasks changed. `to` already a topic: the two merge. Each changed
// task gets `at` as updatedAt: sync sends only what is newer than it last saw,
// so a rename without it would never reach the other computer.
export function renameTopic(tasks, from, to, at = new Date().toISOString()) {
  const kFrom = topicKey(from);
  const name = String(to).trim();
  let changed = 0;
  for (const t of tasks) {
    if (!(t.tags || []).some(tag => topicKey(tag) === kFrom)) continue;
    t.tags = canonicalTags(t.tags.map(tag => (topicKey(tag) === kFrom ? name : tag)));
    t.updatedAt = at;
    changed++;
  }
  return changed;
}

export function removeTopic(tasks, name, at = new Date().toISOString()) {
  const k = topicKey(name);
  let changed = 0;
  for (const t of tasks) {
    const before = (t.tags || []).length;
    t.tags = (t.tags || []).filter(tag => topicKey(tag) !== k);
    if (t.tags.length !== before) { t.updatedAt = at; changed++; }
  }
  return changed;
}
