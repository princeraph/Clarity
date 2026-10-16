#!/usr/bin/env node
// The level colors (lib/niveaux.js, 2.1.0), checked in both themes: a bar
// stands out from the page (3:1, WCAG 1.4.11), text on a block reads (7:1),
// two neighbouring levels do not look alike, and the higher the level, the
// thicker its bar. Plus which level a card shows. Pure math, no window.
import { levelTone, kindTone, LEVEL_IDS, LEVEL_STYLE, shownLevel } from '../src/lib/niveaux.js';

let bad = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { bad++; console.log(`ÉCART ${msg}`); } };

// oklch(L C H) → linear sRGB (Björn Ottosson's OKLab), clamped to the gamut.
function oklch(s) {
  const [L, C, H] = s.match(/oklch\(([^)]+)\)/)[1].trim().split(/\s+/).map(Number);
  const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s_,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s_,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s_,
  ].map(v => Math.min(1, Math.max(0, v)));
  return { rgb, lab: [L, a, b] };
}
const hex = (h) => ({ rgb: [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) });
const parse = (s) => (s.startsWith('#') ? hex(s) : oklch(s));
const lum = (s) => { const [r, g, b] = parse(s).rgb; return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (x, y) => { const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p); return (a + 0.05) / (b + 0.05); };
const dist = (x, y) => { const [p, q] = [oklch(x).lab, oklch(y).lab]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

const THEMES = {
  clair:  { dark: false, pages: ['#FAFAF7', '#F4F3EE', '#FFFFFF'], ink: '#19191A' },
  sombre: { dark: true,  pages: ['#16161A', '#1C1C20', '#1E1E22'], ink: '#F4F3EE' },
};

for (const [name, th] of Object.entries(THEMES)) {
  LEVEL_IDS.forEach((id, i) => {
    const c = levelTone(id, th.dark);
    for (const p of th.pages) ok(contrast(c.bar, p) >= 3, `${name} · ${id} : barre sur ${p} ${contrast(c.bar, p).toFixed(2)}:1 (< 3)`);
    ok(contrast(c.bar, c.fill) >= 3, `${name} · ${id} : barre sur son fond ${contrast(c.bar, c.fill).toFixed(2)}:1 (< 3)`);
    ok(contrast(c.ink, c.fill) >= 7, `${name} · ${id} : texte sur fond ${contrast(c.ink, c.fill).toFixed(2)}:1 (< 7)`);
    ok(contrast(th.ink, c.wash) >= 7, `${name} · ${id} : texte de la page sur la teinte ${contrast(th.ink, c.wash).toFixed(2)}:1 (< 7)`);
    ok(contrast(th.ink, c.fill) >= 7, `${name} · ${id} : texte de la page sur le fond ${contrast(th.ink, c.fill).toFixed(2)}:1 (< 7)`);
    if (i > 0) ok(dist(c.bar, levelTone(LEVEL_IDS[i - 1], th.dark).bar) >= 0.04, `${name} · ${id} et ${LEVEL_IDS[i - 1]} se ressemblent trop (${dist(c.bar, levelTone(LEVEL_IDS[i - 1], th.dark).bar).toFixed(3)})`);
  });
  for (const k of ['event', 'batch', 'break']) {
    const c = kindTone(k, th.dark);
    ok(contrast(c.ink, c.fill) >= 7, `${name} · ${k} : texte sur fond ${contrast(c.ink, c.fill).toFixed(2)}:1 (< 7)`);
    if (k !== 'break') ok(contrast(c.bar, c.fill) >= 2, `${name} · ${k} : barre sur fond ${contrast(c.bar, c.fill).toFixed(2)}:1 (< 2)`);
  }
}

// Thicker as it climbs; only the two highest carry their name.
LEVEL_IDS.forEach((id, i) => { if (i > 0) ok(LEVEL_STYLE[id].weight <= LEVEL_STYLE[LEVEL_IDS[i - 1]].weight, `${id} a une barre plus épaisse que ${LEVEL_IDS[i - 1]}`); });
ok(LEVEL_IDS.filter(id => LEVEL_STYLE[id].labelled).join() === 'top,very_high', 'seuls Absolue et Très haute portent leur nom');

// Which level a card shows.
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} : ${JSON.stringify(a)} au lieu de ${JSON.stringify(b)}`);
eq(shownLevel({ priority: 'high', order: { level: 'high', inheritedFrom: null } }), { level: 'high', inherited: false }, 'son propre niveau, plein');
eq(shownLevel({ priority: 'low', order: { level: 'top', inheritedFrom: 'b' } }), { level: 'top', inherited: true }, 'hérité d\'une tâche qu\'elle bloque : en pointillé');
eq(shownLevel({ order: { level: 'very_high', inheritedFrom: 'b' } }), { level: 'very_high', inherited: true }, 'sans niveau, hérité : en pointillé');
eq(shownLevel({ order: { level: 'low', inheritedFrom: null } }), { level: 'low', inherited: false }, 'le niveau de l\'assistant, plein');
eq(shownLevel({}), { level: 'medium', inherited: false }, 'rien : moyenne');
eq(shownLevel({ priority: 'top', order: { level: 'top', inheritedFrom: 'b' } }), { level: 'top', inherited: false }, 'hérite de ce qu\'elle a déjà : son niveau, plein');

console.log(bad ? `${bad} écart(s) sur ${n}` : `niveaux : ${n} vérifications, tout est vert`);
process.exit(bad ? 1 : 0);
