// The six priority levels as they look (1.8.0; 2.1.0 makes them seen). Order
// and meaning live in lib/ordre.js; this is only how each one is drawn and
// named. Pure, so tools/verifier-niveaux.mjs checks the contrast of every
// color in both themes without a window.
//
// Each level has a hue and a chroma. From them, per theme:
//   bar  — the edge of a card or block: 3:1 against the page at least
//   fill — the soft background of a block in the day plan or the calendar
//   wash — the lighter tint of an « Absolute » card in a list
//   ink  — text on the fill
// `weight` is how thick its bar is (px): the higher the level, the thicker.
// `labelled`: its name is written on the card, not left to the color.
const LEVELS = {
  top:       { hue: 25,  chroma: 0.20,  light: 0.55, dark: 0.72, weight: 4, key: 'level.top',      labelled: true },
  very_high: { hue: 45,  chroma: 0.17,  light: 0.58, dark: 0.75, weight: 4, key: 'level.veryHigh', labelled: true },
  high:      { hue: 75,  chroma: 0.13,  light: 0.60, dark: 0.80, weight: 3, key: 'level.high' },
  medium:    { hue: 250, chroma: 0.12,  light: 0.55, dark: 0.72, weight: 3, key: 'level.medium' },
  low:       { hue: 250, chroma: 0.05,  light: 0.58, dark: 0.66, weight: 2, key: 'level.low' },
  very_low:  { hue: 250, chroma: 0.015, light: 0.62, dark: 0.60, weight: 2, key: 'level.veryLow' },
};

const ok = (l, c, h) => `oklch(${l} ${Math.round(c * 1000) / 1000} ${h})`;

/** The colors of a level in a theme: { bar, fill, wash, ink }. */
export function levelTone(level, isDark = false) {
  const v = LEVELS[level] || LEVELS.medium;
  return isDark
    ? { bar: ok(v.dark, v.chroma, v.hue), fill: ok(0.31, Math.min(0.06, v.chroma * 0.4), v.hue), wash: ok(0.235, Math.min(0.04, v.chroma * 0.3), v.hue), ink: ok(0.93, Math.min(0.03, v.chroma * 0.2), v.hue) }
    : { bar: ok(v.light, v.chroma, v.hue), fill: ok(0.945, Math.min(0.045, v.chroma * 0.3), v.hue), wash: ok(0.975, Math.min(0.02, v.chroma * 0.15), v.hue), ink: ok(0.30, Math.min(0.08, v.chroma * 0.5), v.hue) };
}

/** What is not one task in the day: a calendar event, a break, a group of small tasks. */
export function kindTone(kind, isDark = false) {
  const [hue, chroma] = kind === 'event' ? [70, 0.03] : kind === 'batch' ? [235, 0.06] : [250, 0.005];
  return isDark
    ? { bar: ok(0.66, chroma * 2, hue), fill: ok(kind === 'break' ? 0.24 : 0.29, chroma, hue), ink: ok(0.92, chroma / 2, hue) }
    : { bar: ok(0.60, chroma * 2, hue), fill: ok(kind === 'break' ? 0.965 : 0.94, chroma, hue), ink: ok(0.30, chroma, hue) };
}

// As read since 1.8: `color` (the light bar) and the name; plus weight and label.
export const LEVEL_STYLE = Object.fromEntries(Object.entries(LEVELS).map(([id, v]) => [id, {
  color: ok(v.light, v.chroma, v.hue), key: v.key, weight: v.weight, labelled: !!v.labelled,
}]));
export const LEVEL_IDS = Object.keys(LEVEL_STYLE);

/**
 * The level a task shows: the one it is ordered by (lib/ordre.js) — its own,
 * else the assistant's, else medium — dashed when it is inherited from a task
 * it blocks rather than its own.
 */
export function shownLevel(task) {
  const level = LEVELS[task?.order?.level] ? task.order.level : (LEVELS[task?.priority] ? task.priority : 'medium');
  return { level, inherited: !!task?.order?.inheritedFrom && level !== task?.priority };
}
