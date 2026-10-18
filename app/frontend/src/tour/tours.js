// The guided tours: "take the tour" (any time, from Settings › About or the
// command list) and "show me where" after an update.
//
// A step points at a real element — `data-tour="<target>"` in the markup —
// never at pixel coordinates: the first tutorial placed its spotlight at fixed
// positions drawn for one window size, and on any other it lit up the wrong
// thing. A step may first move Clarity to a view or a Settings section; an
// `optional` step whose element is not on screen (no plan today, sidebar
// folded) is skipped instead of pointing at nothing.

export const TOUR_EVENT = 'clarity-tour';

/** Ask App to run a tour. `id` is 'discover' or 'whatsnew'. */
export function startTour(id, options = {}) {
  window.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: { id, ...options } }));
}

export const DISCOVER = [
  { key: 'welcome' },
  { key: 'today',    view: 'focus', target: 'today-header' },
  { key: 'plan',     view: 'focus', target: 'plan', optional: true },
  { key: 'list',     view: 'focus', target: 'today-list' },
  { key: 'capture',  view: 'focus', target: 'capture' },
  { key: 'nav',      target: 'nav' },
  { key: 'ask',      target: 'ask', optional: true },
  { key: 'topics',   target: 'topics', optional: true },
  { key: 'ai',       target: 'ai-status' },
  { key: 'settings', target: 'settings' },
].map(s => ({ ...s, titleKey: `tour.${s.key}.title`, bodyKey: `tour.${s.key}.body` }));

// What each version brought, and where it lives. Only what can be pointed at:
// a fix has no place on screen, it stays in the text of the update window.
export const WHATS_NEW = {
  '1.6.0': [
    { key: 'sync', settings: 'account', target: 'settings-account' },
  ],
  '1.6.2': [
    { key: 'capture', view: 'focus', target: 'capture' },
    { key: 'replay', settings: 'about', target: 'about-tour' },
    { key: 'check',  view: 'focus', target: 'today-list' },
  ],
  '1.7.0': [
    { key: 'keys',    view: 'focus', target: 'today-list' },
    { key: 'when',    view: 'focus', target: 'capture' },
    { key: 'weekly',  target: 'nav-weekly' },
  ],
  '1.8.0': [
    { key: 'levels', view: 'focus', target: 'today-list' },
    { key: 'links',  view: 'focus', target: 'today-list' },
    { key: 'graph',  target: 'nav-graph' },
  ],
  '1.9.0': [
    { key: 'suggest',      view: 'focus', target: 'today-list' },
    { key: 'suggestGraph', target: 'nav-graph' },
  ],
  '2.0.0': [
    { key: 'dayPlan', view: 'focus', target: 'day-plan' },
    { key: 'workday', settings: 'daily', target: 'workday' },
  ],
  '2.1.0': [
    { key: 'dayGrid', view: 'focus', target: 'day-plan' },
    { key: 'levels', view: 'focus', target: 'today-list' },
    { key: 'upcoming', view: 'focus', target: 'upcoming', optional: true },
    { key: 'calendarWeek', view: 'calendar', target: 'calendar-week' },
  ],
  '2.2.0': [
    { key: 'workdayFull', settings: 'daily', target: 'workday' },
    { key: 'planEdit', view: 'focus', target: 'day-plan' },
    { key: 'density', settings: 'appearance', target: 'density' },
  ],
  '2.3.0': [
    { key: 'reminders', view: 'focus', target: 'today-list' },
    { key: 'reminderSettings', settings: 'daily', target: 'reminders' },
  ],
  '2.4.0': [
    { key: 'dragOrder', view: 'focus', target: 'today-list' },
  ],
};

export function compareVersions(a, b) {
  const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * The steps for an update from `from` to `to`: every version after `from` up
 * to `to`, oldest first. An unknown `from` (a copy too old to have recorded
 * it) gets only the newest version's steps — not the whole history.
 */
export function whatsNewSteps(from, to) {
  const versions = Object.keys(WHATS_NEW)
    .filter(v => compareVersions(v, to) <= 0 && (from ? compareVersions(v, from) > 0 : true))
    .sort(compareVersions);
  const chosen = from ? versions : versions.slice(-1);
  return chosen.flatMap(v => WHATS_NEW[v].map(s => ({
    ...s, version: v,
    titleKey: `whatsNew.${s.key}.title`, bodyKey: `whatsNew.${s.key}.body`,
  })));
}

/** The newest version that has something to show, at or before `current`. */
export function latestWhatsNew(current) {
  return Object.keys(WHATS_NEW)
    .filter(v => compareVersions(v, current) <= 0)
    .sort(compareVersions)
    .at(-1) || null;
}
