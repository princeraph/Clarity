// What of the profile travels, and how two copies combine. Pure.
//
// Two faults this file exists for (audit, 13 October):
//   - the profile was one last-write-wins object: signing in a second device
//     sent its (often empty) profile up as newer, and the first device's
//     accepted insights were replaced by nothing;
//   - insights derived from tasks (`source: 'observed'`) refresh their
//     `lastConfirmed` on every recompute, so the profile changed after every
//     apply and two devices sent it back and forth forever — each time also
//     re-running the AI analysis.
//
// So: observed insights do not travel (each device derives them from the same
// synced tasks) — except a rejection, which must block that insight everywhere.
// The fingerprint ignores fields that move without anyone acting. And applying
// a remote profile merges insight by insight instead of replacing.

export const CATEGORIES = ['traits', 'drivers', 'blockers', 'strengths', 'skills', 'context'];

const travels = i => !!i && (i.source !== 'observed' || i.status === 'user-rejected');
const idOf = i => i.key || i.id;

/** The part of profile.json that syncs. */
export function syncedPart(profile) {
  const u = profile?.understanding || {};
  const understanding = {};
  for (const c of CATEGORIES) understanding[c] = (Array.isArray(u[c]) ? u[c] : []).filter(travels);
  return {
    understanding,
    proposals: Array.isArray(profile?.proposals) ? profile.proposals : [],
    preferences: profile?.preferences && typeof profile.preferences === 'object' ? profile.preferences : {},
  };
}

/** Changes only when someone changed something. */
export function fingerprintOf(part) {
  const stable = i => ({ id: idOf(i), category: i.category, statement: i.statement, source: i.source, status: i.status, reason: i.reason ?? null });
  const u = {};
  for (const c of CATEGORIES) u[c] = (part.understanding?.[c] || []).map(stable).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return JSON.stringify({ u, p: (part.proposals || []).map(p => p.id).sort(), pref: part.preferences || {} });
}

// A rejection is final; otherwise the more recently confirmed copy wins.
function pick(a, b) {
  if (a.status === 'user-rejected') return a;
  if (b.status === 'user-rejected') return b;
  return Date.parse(b.lastConfirmed || 0) > Date.parse(a.lastConfirmed || 0) ? b : a;
}

/**
 * Merge a remote synced part into the local profile. Local observed insights
 * stay as they are; a remote rejection marks the local copy rejected.
 * Proposals and preferences: the remote copy, since it is the newer one.
 */
export function mergeProfile(local, remotePart) {
  const out = { ...local, understanding: { ...(local?.understanding || {}) } };
  for (const c of CATEGORIES) {
    const mine = Array.isArray(out.understanding[c]) ? out.understanding[c] : [];
    const theirs = Array.isArray(remotePart?.understanding?.[c]) ? remotePart.understanding[c] : [];
    const byId = new Map(mine.map(i => [idOf(i), i]));
    for (const r of theirs) {
      const id = idOf(r);
      byId.set(id, byId.has(id) ? pick(byId.get(id), r) : r);
    }
    out.understanding[c] = [...byId.values()];
  }
  if (Array.isArray(remotePart?.proposals)) out.proposals = remotePart.proposals;
  if (remotePart?.preferences && typeof remotePart.preferences === 'object') out.preferences = { ...(local?.preferences || {}), ...remotePart.preferences };
  return out;
}
