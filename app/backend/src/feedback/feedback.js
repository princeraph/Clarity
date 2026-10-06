// Feedback from people testing Clarity, posted to the owner's Google Form.
//
// Three rules, because this is a path out of the machine that the person did
// not configure themselves:
//
// 1. Off until configured. feedback.json ships empty; with no form URL or no
//    message field, the route says `enabled: false` and the interface shows
//    nothing — no button that leads to an error.
// 2. What leaves is fixed HERE, not by the caller: the rating, the message the
//    person typed, Clarity's version and the operating system. Exactly those
//    four form fields — never a task, a setting, the profile or the journal.
//    buildPayload() is the only place the body is composed, and the tests
//    check its keys one by one.
// 3. Asking is rare and stoppable. The prompt comes once, after a week of use
//    and five finished tasks; "later" waits a week, "never" is final.

export const MAX_MESSAGE = 5000;
export const SEND_TIMEOUT_MS = 15000;
export const RATE_LIMIT = 5;                       // sends…
export const RATE_WINDOW_MS = 60 * 60 * 1000;      // …per hour
export const PROMPT_AFTER_DAYS = 7;
export const PROMPT_AFTER_DONE = 5;
export const SNOOZE_DAYS = 7;
export const PROMPT_STATES = ['pending', 'snoozed', 'done', 'never'];
export const PROMPT_ACTIONS = ['later', 'never', 'done'];

const DAY_MS = 24 * 60 * 60 * 1000;
const FIELDS = ['rating', 'message', 'version', 'system'];
// What lands in the sheet: readable there, and the same in both languages.
const RATING_TEXT = { up: '👍', down: '👎' };

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

export const isEnabled = (config) => !!(config.formUrl && config.fields.message);

/**
 * The form body. The ONLY place it is composed — four fields at most, each
 * from an argument named here; there is no parameter through which anything
 * else could arrive. A field the form does not have (empty id) is left out.
 */
export function buildPayload(config, { rating, message, version, system }) {
  const body = new URLSearchParams();
  const values = { rating: RATING_TEXT[rating] || '', message, version, system };
  for (const f of FIELDS) {
    if (config.fields[f]) body.append(config.fields[f], String(values[f] ?? ''));
  }
  return body;
}

/** Validates what the interface sent. Returns the clean { rating, message } or throws a 400. */
export function validateInput(input) {
  const rating = input?.rating ?? null;
  if (rating !== null && rating !== 'up' && rating !== 'down') {
    throw new FeedbackError('rating must be "up", "down" or null', 400, 'invalid-rating');
  }
  const message = input?.message ?? '';
  if (typeof message !== 'string') throw new FeedbackError('message must be a string', 400, 'invalid-message');
  if (message.length > MAX_MESSAGE) throw new FeedbackError(`message is longer than ${MAX_MESSAGE} characters`, 400, 'too-long');
  const trimmed = message.trim();
  if (!trimmed && !rating) throw new FeedbackError('nothing to send', 400, 'empty');
  return { rating, message: trimmed };
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
      const { rating, message } = validateInput(input);
      const t = now().getTime();
      while (sentAt.length && t - sentAt[0] >= windowMs) sentAt.shift();
      if (sentAt.length >= limit) throw new FeedbackError('too many messages in the last hour', 429, 'rate-limited');

      const body = buildPayload(cfg, { rating, message, version, system });
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
