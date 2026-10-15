// The six priority levels as they look (1.8.0). Order and meaning live in
// lib/ordre.js; this is only how each one is drawn and named.
export const LEVEL_STYLE = {
  top:       { color: 'oklch(0.58 0.21 25)',  key: 'level.top' },
  very_high: { color: 'oklch(0.66 0.18 45)',  key: 'level.veryHigh' },
  high:      { color: 'oklch(0.74 0.15 75)',  key: 'level.high' },
  medium:    { color: 'oklch(0.66 0.11 250)', key: 'level.medium' },
  low:       { color: 'oklch(0.70 0.04 250)', key: 'level.low' },
  very_low:  { color: 'oklch(0.78 0.01 250)', key: 'level.veryLow' },
};
export const LEVEL_IDS = Object.keys(LEVEL_STYLE);
