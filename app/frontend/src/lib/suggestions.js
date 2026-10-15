// What Clarity proposes (1.9.0). Nothing here changes a task: each proposal
// says what « Confirm » would write, and the person decides. Pure — the clock
// is a parameter — so tools/verifier-suggestions.mjs can check every rule.
//
// Two sources:
//  - the assistant's analysis (aiData): a link, a level, a difficulty;
//  - two fixed rules, which need no assistant: « heavy blocker » and « move
//    down » (never « abandon »).
//
// Set aside, a proposal comes back when one of the tasks it is about changes,
// or after 60 days; « never » keeps it away.

import { LEVELS } from './ordre.js';

const DAY = 86400000;
export const RULES = {
  heavyMinutes: 120, heavyDifficulty: 4,       // a heavy task: 2 h or more, or difficulty 4+
  lightMinutes: 30,  lightDifficulty: 2,       // a light one: 30 min or less, or difficulty 2 or less
  draggedReports: 3, idleDays: 21,             // it drags: deadline moved 3 times, or untouched 21 days
  comeBackDays: 60,                            // « not now » lasts this long at most
};

/** What a task looked like: a change here brings back a proposal set aside. */
export const fingerprint = (t) => [t?.title || '', t?.deadline || '', t?.priority || '', t?.difficulty ?? ''].join('|');

const heavy = (t) => (t.difficulty ?? 0) >= RULES.heavyDifficulty || (t.estimatedDuration ?? 0) >= RULES.heavyMinutes;
const light = (t) => (t.difficulty != null && t.difficulty <= RULES.lightDifficulty) || (t.estimatedDuration != null && t.estimatedDuration > 0 && t.estimatedDuration <= RULES.lightMinutes);

function setAside(task, key, fp, now) {
  return (task.dismissed || []).some(d => d.key === key
    && (d.never || (d.fp === fp && now - Date.parse(d.at) < RULES.comeBackDays * DAY)));
}

/**
 * `tasks`: as App ranks them (each with `aiData` and `order`). Returns a Map
 * from task id to the proposals shown on that task.
 */
export function suggestionsFor(tasks, now = Date.now()) {
  const live = tasks.filter(t => t.status !== 'done' && !t.archived);
  const byId = new Map(tasks.map(t => [t.id, t]));
  const liveIds = new Set(live.map(t => t.id));
  // Existing links, both directions, any type: nothing is proposed twice.
  const joined = new Set();
  const out = new Map();
  for (const t of tasks) for (const l of t.links || []) { joined.add(`${t.id}|${l.to}`); joined.add(`${l.to}|${t.id}`); }
  const blocksOf = (id) => (byId.get(id)?.links || []).filter(l => l.type === 'blocks').map(l => l.to);
  const reaches = (from, to) => {           // is there a chain of « blocks » from → … → to?
    const seen = new Set(); const stack = [from];
    while (stack.length) { const id = stack.pop(); if (id === to) return true; if (seen.has(id)) continue; seen.add(id); stack.push(...blocksOf(id)); }
    return false;
  };

  for (const t of live) {
    const list = [];
    const add = (s) => { if (!setAside(t, s.key, s.fp, now)) list.push(s); };
    const fpT = fingerprint(t);
    const ai = t.aiData || {};

    // The assistant's links: on the task they start from.
    for (const l of ai.suggestedLinks || []) {
      const other = byId.get(l.to);
      if (!other || !liveIds.has(l.to) || l.to === t.id || joined.has(`${t.id}|${l.to}`)) continue;
      if (l.type === 'blocks' && reaches(l.to, t.id)) continue;     // it would close a loop
      const link = { to: l.to, type: l.type === 'related' ? 'related' : 'blocks', ...(l.type === 'related' ? {} : { strength: l.strength === 'soft' ? 'soft' : 'hard' }) };
      add({
        key: `link:${link.type}:${l.to}`, kind: 'link', taskId: t.id, other: l.to, link,
        fp: `${fpT}#${fingerprint(other)}`, why: l.why || '',
        apply: { taskId: t.id, patch: { links: [...(t.links || []), link] } },
      });
    }

    // A level and a difficulty, only where the person has not set one.
    if (!t.priority && LEVELS.includes(ai.suggestedLevel)) {
      add({ key: 'level', kind: 'level', taskId: t.id, value: ai.suggestedLevel, fp: fpT, why: ai.reasoning || '',
        apply: { taskId: t.id, patch: { priority: ai.suggestedLevel } } });
    }
    if (t.difficulty == null && Number.isInteger(ai.suggestedDifficulty) && ai.suggestedDifficulty >= 1 && ai.suggestedDifficulty <= 5) {
      add({ key: 'difficulty', kind: 'difficulty', taskId: t.id, value: ai.suggestedDifficulty, fp: fpT, why: '',
        apply: { taskId: t.id, patch: { difficulty: ai.suggestedDifficulty } } });
    }

    // Fixed rule: a heavy task holding up light ones.
    const holds = (t.links || []).filter(l => l.type === 'blocks' && (l.strength || 'hard') === 'hard' && liveIds.has(l.to)).map(l => byId.get(l.to));
    const lightHeld = holds.filter(light);
    if (heavy(t) && lightHeld.length) {
      add({
        key: 'heavy', kind: 'heavy', taskId: t.id,
        fp: fpT + '#' + lightHeld.map(fingerprint).join('#'),
        vars: { minutes: t.estimatedDuration || null, difficulty: t.difficulty ?? null, n: lightHeld.length },
        apply: { action: 'breakdown', taskId: t.id },
        alt: { taskId: t.id, patch: { links: (t.links || []).map(l => lightHeld.some(h => h.id === l.to) && l.type === 'blocks' ? { ...l, strength: 'soft' } : l) } },
      });
    }

    // Fixed rule: move down what drags, unblocks nothing, and costs.
    const reports = (t.history || []).filter(h => h?.type === 'deadline' && h.from && h.to && h.to > h.from).length;
    const idle = t.updatedAt ? Math.floor((now - Date.parse(t.updatedAt)) / DAY) : 0;
    const drags = reports >= RULES.draggedReports || idle >= RULES.idleDays;
    const unblocksNothing = !(t.order?.blocks?.length);
    const level = t.order?.level || t.priority || 'medium';
    const lower = LEVELS[LEVELS.indexOf(level) + 1];
    if (t.priority !== 'top' && drags && unblocksNothing && heavy(t) && lower) {
      add({
        key: 'lower', kind: 'lower', taskId: t.id, value: lower, fp: fpT,
        vars: { reports, days: idle, minutes: t.estimatedDuration || null, difficulty: t.difficulty ?? null },
        apply: { taskId: t.id, patch: { priority: lower } },
      });
    }

    if (list.length) out.set(t.id, list);
  }
  return out;
}

/** The task's `dismissed` list after setting `s` aside (now, or for good). */
export function dismissedAfter(task, s, now = Date.now(), never = false) {
  return [...(task.dismissed || []).filter(d => d.key !== s.key), { key: s.key, fp: s.fp, at: new Date(now).toISOString(), never }];
}
