// Topics, as the screen shows them (2.6.0). A topic is a tag; « perso » and
// « Perso » are the same one — the server also stores them in one spelling
// (backend/src/topics.js), this keeps tasks saved before that together.

export const topicKey = (tag) => String(tag ?? '').trim().toLocaleLowerCase();

export const hasTopic = (task, topic) => (task.tags || []).some(tag => topicKey(tag) === topicKey(topic));

// One entry per topic, in the most frequent spelling, with the count of what is
// still to do: a finished task no longer weighs on the topic it belongs to.
export function topicsOf(tasks) {
  const byKey = new Map();
  for (const t of tasks || []) for (const tag of t.tags || []) {
    const s = String(tag).trim();
    if (!s) continue;
    const k = topicKey(s);
    if (!byKey.has(k)) byKey.set(k, { spellings: new Map(), open: 0 });
    const e = byKey.get(k);
    e.spellings.set(s, (e.spellings.get(s) || 0) + 1);
    if (t.status !== 'done' && !t.archived) e.open++;
  }
  return [...byKey.values()].map(e => {
    let tag = null, n = -1;
    for (const [s, c] of e.spellings) if (c > n) { tag = s; n = c; }
    return { tag, count: e.open };
  });
}

// While a tag is typed (2.9.0): the existing topics that match, so « per »
// offers « Perso » instead of starting « perso » beside it. Starts-with first,
// then contains; none already on the task; at most `max`.
export function suggestTopics(typed, known, exclude = [], max = 6) {
  const q = topicKey(String(typed || '').replace(/^#/, ''));
  if (!q) return [];
  const taken = new Set(exclude.map(topicKey));
  const pool = [...new Set(known)].filter(k => !taken.has(topicKey(k)) && topicKey(k) !== q);
  const starts = pool.filter(k => topicKey(k).startsWith(q));
  const inside = pool.filter(k => !topicKey(k).startsWith(q) && topicKey(k).includes(q));
  return [...starts, ...inside].slice(0, max);
}

/** A typed tag in the spelling already used, if it is a known topic. */
export function knownSpelling(typed, known) {
  const k = topicKey(String(typed || '').replace(/^#/, ''));
  return known.find(x => topicKey(x) === k) || null;
}
