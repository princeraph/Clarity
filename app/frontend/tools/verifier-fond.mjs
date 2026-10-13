// Quality gate: a press that starts inside a dialog and ends on its backdrop
// must not close it. This regressed once, shipped, and lost typed tasks.
import { createBackdropHandlers } from '../src/hooks/backdropHandlers.js';

let closed = 0;
const backdrop = {}, input = {};
const h = createBackdropHandlers(() => () => { closed++; });
const ev = (target, currentTarget) => ({ target, currentTarget });
const cases = [
  ['appui dans le champ, relâché sur le fond', () => { h.onMouseDown(ev(input, backdrop)); h.onClick(ev(backdrop, backdrop)); }, 0],
  ['appui et relâché sur le fond',              () => { h.onMouseDown(ev(backdrop, backdrop)); h.onClick(ev(backdrop, backdrop)); }, 1],
  ['appui sur le fond, relâché dans le champ',  () => { h.onMouseDown(ev(backdrop, backdrop)); h.onClick(ev(input, backdrop)); }, 0],
];
let bad = 0;
for (const [name, run, want] of cases) {
  closed = 0; run();
  if (closed !== want) { bad++; console.error(`ÉCART  ${name} : fermé ${closed} fois, attendu ${want}`); }
}
if (bad) process.exit(1);
console.log(`fond des fenêtres — ${cases.length} cas, aucun écart.`);
