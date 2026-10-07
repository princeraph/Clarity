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
import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { writeJSONAtomic, quarantine, appendJSONL, readJSONL } from '../storage.js';
import { computeObserved } from './metrics.js';
import { deriveInsights, mergeInsights, setInsightStatus, addInsight, pushRecord } from './insights.js';
import { mergeProposals, proposalToInsight, declinedInsight } from './elicitation.js';

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
    // Stage 2b. What a model has SUGGESTED about the person and the user has
    // not answered yet. Kept apart from `understanding` on purpose: this list
    // is not believed, and nothing moves across without an explicit accept.
    proposals: [],
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
    proposals:     Array.isArray(p.proposals) ? p.proposals : [],
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

  // Recompute the observed layer from the task store, then fold what follows
  // from it into the understanding layer. Deterministic end to end — the model
  // writes neither layer. Insights the user rejected are blocked here, so a
  // recompute can never resurrect a conclusion they threw out.
  function recompute(tasks, opts = {}) {
    const profile = readProfile();
    profile.observed = computeObserved(tasks, opts);

    const merge = mergeInsights(profile.understanding, deriveInsights(profile.observed), { now: opts.now });
    profile.understanding = merge.understanding;
    if (merge.invalid.length) {
      log.error(`[Clarity] ${merge.invalid.length} derived insight(s) refused: ${merge.invalid.map(i => i.error).join('; ')}`);
    }

    saveProfile(profile);
    return profile;
  }

  // The user's verdict on a belief. A rejection is stored, not deleted — that
  // record is what keeps the conclusion from being derived again.
  function judgeInsight(id, status, { reason = null } = {}) {
    const profile = readProfile();
    const result = setInsightStatus(profile.understanding, id, status, { reason });
    if (!result.changed) return null;
    profile.understanding = result.understanding;
    saveProfile(profile);
    return result.insight;
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

  // "Clear history" in Settings › Privacy: the entries of these kinds leave the
  // journal for good. Everything else stays, and so does a line that does not
  // parse — deleting what cannot be read would be deleting blind.
  function removeEntries(kinds) {
    if (!existsSync(JOURNAL_FILE)) return 0;
    const lines = readFileSync(JOURNAL_FILE, 'utf8').split('\n').filter(Boolean);
    let removed = 0;
    const kept = lines.filter(line => {
      try {
        if (kinds.includes(JSON.parse(line).kind)) { removed++; return false; }
      } catch { /* unreadable: keep it */ }
      return true;
    });
    if (removed) {
      const tmp = `${JOURNAL_FILE}.tmp`;
      writeFileSync(tmp, kept.map(l => l + '\n').join(''));
      renameSync(tmp, JOURNAL_FILE);
    }
    return removed;
  }

  // ─── Proposals (Stage 2b) ───────────────────────────────────────────────────

  function addProposals(incoming) {
    const profile = readProfile();
    const merged = mergeProposals(profile, incoming);
    profile.proposals = merged.proposals;
    saveProfile(profile);
    return { pending: merged.proposals, added: merged.added, skipped: merged.skipped };
  }

  function readProposals() {
    return (readProfile().proposals || []).filter(p => p && p.status === 'pending');
  }

  // The only path from a suggestion to a belief. It runs on an explicit accept
  // and nowhere else — no recompute, no background pass, no model call reaches
  // this function.
  function acceptProposal(id, { now = new Date() } = {}) {
    const profile = readProfile();
    const proposal = (profile.proposals || []).find(p => p && p.id === id && p.status === 'pending');
    if (!proposal) return null;

    const result = addInsight(profile.understanding, proposalToInsight(proposal, { now }), { now });
    if (!result.added) return { error: result.error };

    profile.understanding = result.understanding;
    profile.proposals = profile.proposals.filter(p => p.id !== id);
    saveProfile(profile);
    return { insight: result.insight, proposal };
  }

  // Declining is not a delete. The statement is stored as rejected under its
  // own key, which is what stops the same idea coming back next week — the same
  // mechanism, and the same list, that blocks a re-derived observation.
  function declineProposal(id, { reason = null, now = new Date() } = {}) {
    const profile = readProfile();
    const proposal = (profile.proposals || []).find(p => p && p.id === id && p.status === 'pending');
    if (!proposal) return null;

    profile.understanding = pushRecord(profile.understanding, declinedInsight(proposal, { reason, now }));
    profile.proposals = profile.proposals.filter(p => p.id !== id);
    saveProfile(profile);
    return { proposal, reason };
  }

  return {
    PROFILE_FILE, JOURNAL_FILE,
    readProfile, saveProfile, recompute, judgeInsight,
    appendEntry, readEntries, removeEntries,
    addProposals, readProposals, acceptProposal, declineProposal,
  };
}
