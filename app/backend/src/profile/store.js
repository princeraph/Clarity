// The user profile: what Clarity knows about the person using it.
//
// Kept in its own file rather than inside tasks.json for three reasons.
// DELETE /api/tasks/all wipes the task store, and clearing your to-do list must
// not erase who you are. The two have different write rhythms. And "this file
// never leaves the device" is a rule that can be enforced and audited only if
// the file has an edge.
//
// The `observed` layer is always recomputable from tasks. `understanding` is
// not — it accumulates from conversation and can never be rebuilt — which is
// why profile.json joins the backup rotation.

import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { writeJSONAtomic, quarantine, appendJSONL, readJSONL } from '../storage.js';
import { computeObserved } from './metrics.js';

export const PROFILE_VERSION = 1;

export const JOURNAL_KINDS = new Set([
  'observation',   // a metric crossed a threshold worth remembering
  'exchange',      // the user explained something (raw text — stays local)
  'suggestion',    // what was suggested, and what became of it
  'checkin',       // a follow-up and its result
  'correction',    // the user rejected an insight
]);

export function emptyProfile() {
  return {
    version: PROFILE_VERSION,
    updatedAt: new Date().toISOString(),
    observed: null,                 // filled by recompute()
    understanding: {
      traits: [], drivers: [], blockers: [], strengths: [], skills: [], context: [],
    },
    preferences: {
      suggestionMode: 'active',     // active | daily | onRequest
      quiet: [],
      maxSuggestionsPerDay: 6,      // the interruption budget
      minGapMinutes: 90,
      tone: '',
      offLimits: [],
    },
  };
}

// A profile is usable only if it parses and carries the containers everything
// else assumes. A bare `{}` must not pass as "no profile yet" — that would let
// a later save overwrite a real profile with an empty one.
function isProfile(p) {
  return !!p && typeof p === 'object'
    && !!p.understanding && typeof p.understanding === 'object'
    && !!p.preferences && typeof p.preferences === 'object';
}

// Merge forward so a profile written by an older version gains new keys rather
// than tripping the shape check on load.
function withDefaults(p) {
  const base = emptyProfile();
  return {
    ...base, ...p,
    understanding: { ...base.understanding, ...(p.understanding || {}) },
    preferences:   { ...base.preferences,   ...(p.preferences   || {}) },
  };
}

export function createProfileStore({ dataDir, log = console }) {
  const PROFILE_FILE = join(dataDir, 'profile.json');
  const JOURNAL_FILE = join(dataDir, 'journal.jsonl');

  function readProfile() {
    if (!existsSync(PROFILE_FILE)) return emptyProfile();
    try {
      const parsed = JSON.parse(readFileSync(PROFILE_FILE, 'utf8'));
      if (!isProfile(parsed)) throw new Error('missing understanding/preferences');
      return withDefaults(parsed);
    } catch (err) {
      // Unreadable is not the same as absent. Keep the bytes — `understanding`
      // may be in there and cannot be rebuilt from anything else.
      const kept = quarantine(PROFILE_FILE, 'corrupt');
      log.error(`[Clarity] profile.json unreadable (${err.message})${kept ? ` — kept at ${kept}` : ''}`);
      return emptyProfile();
    }
  }

  function saveProfile(profile) {
    if (!isProfile(profile)) throw new Error('refusing to save a malformed profile');
    writeJSONAtomic(PROFILE_FILE, { ...profile, updatedAt: new Date().toISOString() });
  }

  // Recompute the observed layer from the task store. Deterministic, and the
  // only writer of `observed` — the model never touches it.
  function recompute(tasks, opts = {}) {
    const profile = readProfile();
    profile.observed = computeObserved(tasks, opts);
    saveProfile(profile);
    return profile;
  }

  function appendEntry(entry) {
    if (!entry || !JOURNAL_KINDS.has(entry.kind)) {
      throw new Error(`unknown journal kind: ${entry?.kind}`);
    }
    const row = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      ...entry,
    };
    appendJSONL(JOURNAL_FILE, row);
    return row;
  }

  function readEntries({ limit = 200, kinds = null } = {}) {
    // Read a generous slice, then filter — filtering before the limit would
    // return fewer than `limit` matches whenever other kinds are interleaved.
    const { entries, skipped } = readJSONL(JOURNAL_FILE, { limit: kinds ? limit * 10 : limit });
    const filtered = kinds ? entries.filter(e => kinds.includes(e.kind)) : entries;
    return { entries: filtered.slice(-limit), skipped };
  }

  return {
    PROFILE_FILE, JOURNAL_FILE,
    readProfile, saveProfile, recompute,
    appendEntry, readEntries,
  };
}
