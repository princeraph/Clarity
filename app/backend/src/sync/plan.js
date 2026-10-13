// The sync decision, pure: what this device must apply from the server, and
// what it must send. No I/O, no clock (`now` is passed in) — so every conflict
// rule below is a test, not a hope.
//
// Three inputs:
//   local   Map "kind:id" → { kind, id, data, updatedAt }  — what is on disk now
//   known   { "kind:id": updatedAt }  — what this device and the server last
//           agreed on. It is what tells "deleted here" from "never seen here".
//   remote  rows changed on the server since the last pull
//
// Rules:
//   - the newer `updatedAt` wins (the server applies the same rule, so two
//     devices converge whatever order their writes arrive in);
//   - a deletion travels as a tombstone, never as an absence;
//   - deleted here vs edited elsewhere since we last agreed: the edit wins.
//     Losing a deletion costs a click; losing an edit costs what was written.
//   - the journal is not deleted by absence (it is trimmed locally, and
//     trimming one device must not erase another's) — only by an explicit
//     deletion ("clear conversation history"), passed in as `explicitDeletes`;
//   - `allowDeletes: false` sends no tombstone for anything found missing: set
//     when this device's files were just recovered from damage or a backup, so
//     a local loss is never broadcast to the other devices as a deletion.

export const keyOf = (kind, id) => `${kind}:${id}`;
const ms = t => { const n = Date.parse(t); return Number.isNaN(n) ? 0 : n; };
const APPEND_ONLY = new Set(['journal']);

export function planSync({ local, known = {}, remote = [], now = new Date(), allowDeletes = true, explicitDeletes = [] }) {
  const apply = [];          // { kind, id, data } | { kind, id, deleted: true }
  const push = [];           // { kind, id, data, deleted, updated_at }
  const nextKnown = { ...known };
  const handled = new Set();
  const explicit = new Set(explicitDeletes.map(d => keyOf(d.kind, d.id)));

  for (const r of remote) {
    const k = keyOf(r.kind, r.id);
    const mine = local.get(k);
    const rT = ms(r.updated_at), lT = mine ? ms(mine.updatedAt) : null, kT = known[k] ? ms(known[k]) : null;
    handled.add(k);

    if (r.deleted) {
      if (!mine) { delete nextKnown[k]; continue; }
      if (APPEND_ONLY.has(r.kind)) { apply.push({ kind: r.kind, id: r.id, deleted: true }); delete nextKnown[k]; continue; }
      const editedHereSince = lT > rT && (kT == null || lT > kT);
      if (editedHereSince) push.push(row(mine));                 // edit beats deletion
      else { apply.push({ kind: r.kind, id: r.id, deleted: true }); delete nextKnown[k]; }
      continue;
    }
    // Absent here, and the server holds nothing newer than what we already had:
    // it was deleted here. (Pulls overlap by design, so a row we know comes back.)
    // Cleared here on purpose (history clear), and back in the pull overlap.
    if (!mine && !r.deleted && explicit.has(k)) { push.push(tombstone(r.kind, r.id, r.updated_at, now)); continue; }
    if (!mine && kT != null && rT <= kT) {
      if (!APPEND_ONLY.has(r.kind) && allowDeletes) push.push(tombstone(r.kind, r.id, known[k], now));
      continue;
    }
    if (!mine || lT < rT) { apply.push({ kind: r.kind, id: r.id, data: r.data, updated_at: r.updated_at }); nextKnown[k] = r.updated_at; }
    else if (lT > rT) push.push(row(mine));
    else nextKnown[k] = r.updated_at;
  }

  for (const [k, mine] of local) {
    if (handled.has(k)) continue;
    if (!known[k] || ms(mine.updatedAt) > ms(known[k])) push.push(row(mine));
  }

  for (const d of explicitDeletes) {
    const k = keyOf(d.kind, d.id);
    if (local.has(k) || handled.has(k)) continue;
    handled.add(k);
    push.push(tombstone(d.kind, String(d.id), known[k], now));
  }

  for (const k of Object.keys(known)) {
    if (!allowDeletes) break;
    if (local.has(k) || handled.has(k)) continue;
    const kind = k.slice(0, k.indexOf(':'));
    if (APPEND_ONLY.has(kind)) continue;
    push.push(tombstone(kind, k.slice(kind.length + 1), known[k], now));
  }

  return { apply, push, nextKnown };
}

// Never older than the version it deletes: a device whose clock runs behind
// would otherwise send a tombstone the server ranks below the live row.
function tombstone(kind, id, knownAt, now) {
  return { kind, id, data: null, deleted: true, updated_at: new Date(Math.max(now.getTime(), ms(knownAt) + 1)).toISOString() };
}

function row(item) {
  return { kind: item.kind, id: item.id, data: item.data, deleted: false, updated_at: item.updatedAt };
}

/** After the server accepted `pushed`, record the agreement. */
export function afterPush(nextKnown, pushed) {
  const out = { ...nextKnown };
  for (const p of pushed) {
    const k = keyOf(p.kind, p.id);
    if (p.deleted) delete out[k]; else out[k] = p.updated_at;
  }
  return out;
}
