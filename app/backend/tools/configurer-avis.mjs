// Points Clarity's "Give feedback" at a Google Form, by writing feedback.json.
//
// A Google Form receives answers at …/formResponse, one `entry.NNN` per
// question. Those numbers are not shown anywhere in the form editor; they sit in
// the public page, inside FB_PUBLIC_LOAD_DATA_. This reads them from there, so
// nobody has to dig through the page source by hand.
//
// The form needs four questions, titled (French or English, any case):
//   Note / Rating      — short answer. Receives "4/5", or nothing.
//   Message            — paragraph.    The comments, as headed sections.
//   Version            — short answer. Clarity's version.
//   Système / System   — short answer. e.g. "win32 10.0.22631".
// And may have up to four more, one per comment category (paragraphs):
//   Facilité d'utilisation / Usability
//   Bugs
//   Suggestions
//   Autres commentaires / Other comments
// A category with its own question is sent there; the others are combined
// into "Message". "Message" is needed for feedback to switch on — unless all
// four categories have their own question. Leave every question NOT required:
// an answer with no rating is normal, and Google refuses a response that
// leaves a required question empty.
//
// Usage: node tools/configurer-avis.mjs <public link of the form> [--essai]
//   the link is the one "Send" gives (…/viewform or forms.gle/…), not /edit.
//   --essai  print what was found, write nothing.
// Restart Clarity afterwards: the backend reads feedback.json when it starts.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'feedback.json');

// Question titles, compared without accents, case or trailing punctuation.
const TITLES = {
  rating:      ['note', 'rating'],
  message:     ['message'],
  usability:   ['facilite d\'utilisation', 'usability', 'ease of use'],
  bugs:        ['bugs', 'bug'],
  suggestions: ['suggestions', 'suggestion'],
  other:       ['autres commentaires', 'autre commentaire', 'other comments', 'other comment'],
  version:     ['version'],
  system:      ['systeme', 'system'],
};
// Optional: one question per comment category. Without it, the category goes into "Message".
export const CATEGORIES = ['usability', 'bugs', 'suggestions', 'other'];
const LABEL = {
  rating: 'Note', message: 'Message', version: 'Version', system: 'Système',
  usability: 'Facilité d’utilisation', bugs: 'Bugs', suggestions: 'Suggestions', other: 'Autres commentaires',
};
// FB_PUBLIC_LOAD_DATA_ item types that take free text.
const TEXT_TYPES = { 0: 'réponse courte', 1: 'paragraphe' };

const normalize = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[’‘ʼ`´]/g, '\'').replace(/\s+/g, ' ').replace(/[\s*:?.!]+$/u, '').trim();

/** Where every comment category will go, one line each — what the person reads before writing. */
export function routeSummary(fields) {
  return CATEGORIES.map(c => {
    const where = fields[c]
      ? `sa propre question (${fields[c]})`
      : fields.message ? `regroupée dans « Message » (${fields.message})` : 'nulle part — pas de question « Message »';
    return `${LABEL[c].padEnd(22)} → ${where}`;
  });
}

/** …/forms/d/e/<id>/viewform (or /u/0/ variants) → …/forms/d/e/<id>/formResponse */
export function responseUrlFrom(pageUrl, data) {
  const m = /\/forms\/(?:u\/\d+\/)?d\/e\/([\w-]+)/.exec(pageUrl || '');
  if (m) return `https://docs.google.com/forms/d/e/${m[1]}/formResponse`;
  // Some pages carry the path themselves.
  const own = Array.isArray(data) ? data.find(v => typeof v === 'string' && /^e\/[\w-]+\/formResponse$/.test(v)) : null;
  if (own) return `https://docs.google.com/forms/d/${own}`;
  return '';
}

/**
 * Reads a public form page. Pure — no network — so it is tested on a fixture.
 * Returns { config, found, warnings, title } or throws with a reason a person can act on.
 */
export function parseFormPage(html, pageUrl) {
  if (/\/forms\/d\/[\w-]+\/edit/.test(pageUrl || '')) {
    throw new Error('ce lien est celui de l’éditeur (/edit). Prenez le lien public : bouton « Envoyer » → icône lien.');
  }
  const m = /FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/.exec(html || '');
  if (!m) throw new Error('pas de formulaire Google dans cette page (FB_PUBLIC_LOAD_DATA_ introuvable). Le formulaire est-il public ?');
  let data;
  try { data = JSON.parse(m[1]); } catch { throw new Error('FB_PUBLIC_LOAD_DATA_ illisible — la page a peut-être changé de format.'); }

  const items = Array.isArray(data?.[1]?.[1]) ? data[1][1] : [];
  const fields = { rating: '', message: '', version: '', system: '' };
  const optional = {};   // categories found, written only when present
  const found = [];
  const warnings = [];
  for (const item of items) {
    const title = normalize(item?.[1]);
    // "Note" or "Note (sur 5)" — the word, then nothing or a non-letter.
    const key = Object.keys(TITLES).find(k => TITLES[k].some(w => title === w || (title.startsWith(w) && !/\p{L}/u.test(title[w.length]))));
    const entry = item?.[4]?.[0];
    if (!key || !Array.isArray(entry) || !Number.isInteger(entry[0])) continue;
    const target = CATEGORIES.includes(key) ? optional : fields;
    if (target[key]) { warnings.push(`deux questions « ${LABEL[key]} » — seule la première est utilisée.`); continue; }
    target[key] = `entry.${entry[0]}`;
    found.push({ field: key, title: item[1], entry: target[key], type: item[3], required: entry[2] === 1 });
    if (!(item[3] in TEXT_TYPES)) warnings.push(`« ${item[1]} » n’est pas une question à texte libre : Google refusera les réponses. Choisissez « Réponse courte » ou « Paragraphe ».`);
    if (entry[2] === 1 && key !== 'message') warnings.push(`« ${item[1]} » est obligatoire : un avis qui la laisse vide serait refusé. Décochez « Obligatoire ».`);
  }
  const allDedicated = CATEGORIES.every(c => optional[c]);
  for (const k of Object.keys(fields)) {
    if (fields[k] || (k === 'message' && allDedicated)) continue;
    warnings.push(`aucune question « ${LABEL[k]} » — ce champ ne sera pas envoyé.`);
  }
  // In the order the backend lists them: rating, message, the categories, version, system.
  const ordered = { rating: fields.rating, message: fields.message };
  for (const c of CATEGORIES) if (optional[c]) ordered[c] = optional[c];
  ordered.version = fields.version;
  ordered.system = fields.system;
  const formUrl = responseUrlFrom(pageUrl, data);
  if (!formUrl) throw new Error('adresse de réponse introuvable — donnez le lien …/forms/d/e/…/viewform.');
  return { config: { formUrl, fields: ordered }, found, warnings, title: typeof data?.[3] === 'string' ? data[3] : '' };
}

async function main() {
  const args = process.argv.slice(2);
  const link = args.find(a => !a.startsWith('--'));
  const dry = args.includes('--essai');
  if (!link) {
    console.error('Usage : node tools/configurer-avis.mjs <lien public du formulaire> [--essai]');
    process.exit(2);
  }
  let res;
  try { res = await fetch(link, { redirect: 'follow' }); }
  catch (err) { console.error(`ÉCHEC : impossible de joindre ${link} — ${err.message}`); process.exit(1); }
  if (/accounts\.google\.com/.test(res.url)) {
    console.error('ÉCHEC : le formulaire exige une connexion Google. Dans ses paramètres, décochez « Limiter à 1 réponse » et toute restriction à votre organisation.');
    process.exit(1);
  }
  if (!res.ok) { console.error(`ÉCHEC : la page a répondu ${res.status}.`); process.exit(1); }

  let parsed;
  try { parsed = parseFormPage(await res.text(), res.url); }
  catch (err) { console.error(`ÉCHEC : ${err.message}`); process.exit(1); }

  const { config, found, warnings, title } = parsed;
  console.log(`Formulaire : ${title || '(sans titre)'}`);
  console.log(`Réponses envoyées à : ${config.formUrl}`);
  for (const f of found) {
    console.log(`  ${LABEL[f.field].padEnd(22)} → ${f.entry}  (« ${f.title} », ${TEXT_TYPES[f.type] || `type ${f.type}`}${f.required ? ', obligatoire' : ''})`);
  }
  console.log('Où vont les commentaires :');
  for (const line of routeSummary(config.fields)) console.log(`  ${line}`);
  for (const w of warnings) console.log(`  attention : ${w}`);
  if (!config.fields.message && !CATEGORIES.every(c => config.fields[c])) {
    console.error('ÉCHEC : sans question « Message », les catégories sans question à elles resteraient sans destination et l’avis désactivé. Ajoutez « Message », ou une question pour chacune des quatre catégories. Rien n’a été écrit.');
    process.exit(1);
  }
  if (dry) { console.log('--essai : rien n’a été écrit.'); return; }
  writeFileSync(OUT, JSON.stringify(config, null, 2) + '\n');
  console.log(`Écrit : ${OUT}`);
  console.log('Relancez Clarity : le bouton « Donner un avis » apparaît dans le panneau latéral et dans Réglages → À propos.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
