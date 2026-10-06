// Feedback from people testing Clarity, posted to the owner's Google Form.
//
// Three rules, because this is a path out of the machine that the person did
// not configure themselves:
//
// 1. Off until configured. feedback.json ships empty; with no form URL, or
//    nowhere for the comments to go, the route says `enabled: false` and the
//    interface shows nothing — no button that leads to an error.
// 2. What leaves is fixed HERE, not by the caller: the star rating, the four
//    comments the person typed (ease of use, bugs, suggestions, other),
//    Clarity's version and the operating system. Exactly the form fields
//    feedback.json names — never a task, a setting, the profile or the journal.
//    buildPayload() is the only place the body is composed, and the tests
//    check its keys one by one.
// 3. Asking is rare and stoppable. The prompt comes once, after a week of use
//    and five finished tasks; "later" waits a week, "never" is final.
//
// The form may or may not have a question per comment category. One that has
// its own field (`usability`, `bugs`, `suggestions`, `other` in feedback.json)
// is sent there; the others are combined into `message` as headed sections, so
// a form with only rating/message/version/system keeps receiving everything.

export const MAX_MESSAGE = 5000;                   // per comment field
export const SEND_TIMEOUT_MS = 15000;
export const RATE_LIMIT = 5;                       // sends…
export const RATE_WINDOW_MS = 60 * 60 * 1000;      // …per hour
export const PROMPT_AFTER_DAYS = 7;
export const PROMPT_AFTER_DONE = 5;
export const SNOOZE_DAYS = 7;
export const PROMPT_STATES = ['pending', 'snoozed', 'done', 'never'];
export const PROMPT_ACTIONS = ['later', 'never', 'done'];

const DAY_MS = 24 * 60 * 60 * 1000;
export const STARS = 5;
// The comment categories, in the order the dialog shows them.
export const CATEGORIES = ['usability', 'bugs', 'suggestions', 'other'];
const FIELDS = ['rating', 'message', ...CATEGORIES, 'version', 'system'];
// Section headings in the combined message. French and fixed: they are for the
// owner reading the sheet, whatever language the tester uses.
export const CATEGORY_HEADINGS = {
  usability: 'Facilité d’utilisation',
  bugs: 'Bugs',
  suggestions: 'Suggestions',
  other: 'Autres commentaires',
};

export class FeedbackError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

/** A config as written by tools/configurer-avis.mjs; anything malformed reads as empty. */
export function normalizeConfig(raw) {
  const fields = {};
  for (const f of FIELDS) {
    const v = raw?.fields?.[f];
    fields[f] = typeof v === 'string' && /^entry\.\d+$/.test(v.trim()) ? v.trim() : '';
  }
  let formUrl = '';
  if (typeof raw?.formUrl === 'string' && raw.formUrl.trim()) {
    try {
      const u = new URL(raw.formUrl.trim());
      if (u.protocol === 'https:' || u.protocol === 'http:') formUrl = u.href;
    } catch { /* not a URL: stays off */ }
  }
  return { formUrl, fields };
}

/** True when every comment category has its own question: `message` is then not needed. */
const allDedicated = (config) => CATEGORIES.every(c => config.fields[c]);

/** On when there is a form, and somewhere for every comment category to go. */
export const isEnabled = (config) => !!(config.formUrl && (config.fields.message || allDedicated(config)));

/**
 * The categories that have no question of their own, as one text:
 * "Bugs :\n…\n\nSuggestions :\n…". Empty sections are left out.
 */
export function combineMessage(config, comments) {
  return CATEGORIES
    .filter(c => !config.fields[c] && comments[c])
    .map(c => `${CATEGORY_HEADINGS[c]} :\n${comments[c]}`)
    .join('\n\n');
}

/**
 * The form body. The ONLY place it is composed — the fields feedback.json
 * names, each from an argument named here; there is no parameter through which
 * anything else could arrive. A field the form does not have (empty id) is left
 * out, and its comment goes into the combined message instead.
 */
export function buildPayload(config, { rating, usability, bugs, suggestions, other, version, system }) {
  const comments = { usability, bugs, suggestions, other };
  const body = new URLSearchParams();
  const values = {
    rating: Number.isInteger(rating) ? `${rating}/${STARS}` : '',
    message: combineMessage(config, comments),
    ...comments,
    version, system,
  };
  for (const f of FIELDS) {
    if (config.fields[f]) body.append(config.fields[f], String(values[f] ?? ''));
  }
  return body;
}

/**
 * Validates what the interface sent: { rating: 1..5 | null, usability, bugs,
 * suggestions, other }. Returns the clean values or throws a 400. Anything
 * else in the input is ignored — it has no way into the payload anyway.
 */
export function validateInput(input) {
  const rating = input?.rating ?? null;
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= STARS)) {
    throw new FeedbackError(`rating must be a whole number from 1 to ${STARS}, or null`, 400, 'invalid-rating');
  }
  const out = { rating };
  for (const c of CATEGORIES) {
    const v = input?.[c] ?? '';
    if (typeof v !== 'string') throw new FeedbackError(`${c} must be a string`, 400, 'invalid-text');
    if (v.length > MAX_MESSAGE) throw new FeedbackError(`${c} is longer than ${MAX_MESSAGE} characters`, 400, 'too-long');
    out[c] = v.trim();
  }
  if (!rating && CATEGORIES.every(c => !out[c])) throw new FeedbackError('nothing to send', 400, 'empty');
  return out;
}

const doneCount = (tasks) => (tasks || []).filter(t => t?.status === 'done').length;

/**
 * Whether the app should ask on its own. Pure: `now` is passed in.
 * Due when the form is configured, the person has not answered or declined,
 * any snooze is over, and they have used Clarity long enough to have an opinion.
 */
export function isPromptDue({ enabled, settings, tasks, now }) {
  if (!enabled) return false;
  const state = settings?.feedbackPromptState || 'pending';
  if (state === 'done' || state === 'never') return false;
  if (state === 'snoozed') {
    const until = Date.parse(settings?.feedbackSnoozeUntil || '');
    if (Number.isFinite(until) && now.getTime() < until) return false;
  }
  const first = Date.parse(settings?.firstUseAt || '');
  if (!Number.isFinite(first) || now.getTime() - first < PROMPT_AFTER_DAYS * DAY_MS) return false;
  return doneCount(tasks) >= PROMPT_AFTER_DONE;
}

/** The settings fields an answer to the prompt changes. */
export function promptPatch(action, now) {
  if (action === 'later') {
    return { feedbackPromptState: 'snoozed', feedbackSnoozeUntil: new Date(now.getTime() + SNOOZE_DAYS * DAY_MS).toISOString() };
  }
  if (action === 'never') return { feedbackPromptState: 'never', feedbackSnoozeUntil: null };
  if (action === 'done')  return { feedbackPromptState: 'done', feedbackSnoozeUntil: null };
  throw new FeedbackError(`unknown action "${action}"`, 400, 'invalid-action');
}

export function createFeedback({
  config, fetchImpl = globalThis.fetch, now = () => new Date(),
  version = '', system = '', timeoutMs = SEND_TIMEOUT_MS,
  limit = RATE_LIMIT, windowMs = RATE_WINDOW_MS,
}) {
  const cfg = normalizeConfig(config);
  const sentAt = [];   // memory only: timestamps of successful sends

  return {
    enabled: isEnabled(cfg),

    isDue: (settings, tasks) => isPromptDue({ enabled: isEnabled(cfg), settings, tasks, now: now() }),

    /** Posts one response. Resolves { sent: true } or throws a FeedbackError. */
    async send(input) {
      if (!isEnabled(cfg)) throw new FeedbackError('feedback is not configured', 404, 'disabled');
      const clean = validateInput(input);
      const t = now().getTime();
      while (sentAt.length && t - sentAt[0] >= windowMs) sentAt.shift();
      if (sentAt.length >= limit) throw new FeedbackError('too many messages in the last hour', 429, 'rate-limited');

      const body = buildPayload(cfg, { ...clean, version, system });
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      let res;
      try {
        res = await fetchImpl(cfg.formUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: body.toString(),
          // A form that requires signing in answers with a redirect to Google's
          // login page — followed, that would end on a 200 and look like success.
          redirect: 'manual',
          signal: ctrl.signal,
        });
      } catch (err) {
        const timedOut = err?.name === 'AbortError';
        throw new FeedbackError(timedOut ? 'the form did not answer in time' : `could not reach the form: ${err?.message || err}`, 502, timedOut ? 'timeout' : 'unreachable');
      } finally {
        clearTimeout(timer);
      }
      if (res.status !== 200) {
        throw new FeedbackError(`the form answered ${res.status}`, 502, 'rejected');
      }
      sentAt.push(t);
      return { sent: true };
    },
  };
}
