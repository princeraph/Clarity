// Points Clarity's "Give feedback" at a Google Form, by writing feedback.json.
//
// A Google Form receives answers at …/formResponse, one `entry.NNN` per
// question. Those numbers are not shown anywhere in the form editor; they sit in
// the public page, inside FB_PUBLIC_LOAD_DATA_. This reads them from there, so
// nobody has to dig through the page source by hand.
//
// The form needs four questions, titled (French or English, any case):
//   Note / Rating      — short answer. Receives 👍, 👎 or nothing.
//   Message            — paragraph.    What the person typed.
//   Version            — short answer. Clarity's version.
//   Système / System   — short answer. e.g. "win32 10.0.22631".
// Only "Message" is needed for feedback to switch on. Leave the others NOT
// required: an answer with no rating is normal, and Google refuses a response
// that leaves a required question empty.
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
  rating:  ['note', 'rating'],
  message: ['message'],
  version: ['version'],
  system:  ['systeme', 'system'],
};
const LABEL = { rating: 'Note', message: 'Message', version: 'Version', system: 'Système' };
// FB_PUBLIC_LOAD_DATA_ item types that take free text.
const TEXT_TYPES = { 0: 'réponse courte', 1: 'paragraphe' };

const normalize = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[\s*:?.!]+$/u, '').trim();

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
  const found = [];
  const warnings = [];
  for (const item of items) {
    const title = normalize(item?.[1]);
    // "Note" or "Note (👍 / 👎)" — the word, then nothing or a non-letter.
    const key = Object.keys(TITLES).find(k => TITLES[k].some(w => title === w || (title.startsWith(w) && !/\p{L}/u.test(title[w.length]))));
    const entry = item?.[4]?.[0];
    if (!key || !Array.isArray(entry) || !Number.isInteger(entry[0])) continue;
    if (fields[key]) { warnings.push(`deux questions « ${LABEL[key]} » — seule la première est utilisée.`); continue; }
    fields[key] = `entry.${entry[0]}`;
    found.push({ field: key, title: item[1], entry: fields[key], type: item[3], required: entry[2] === 1 });
    if (!(item[3] in TEXT_TYPES)) warnings.push(`« ${item[1]} » n’est pas une question à texte libre : Google refusera les réponses. Choisissez « Réponse courte » ou « Paragraphe ».`);
    if (entry[2] === 1 && key !== 'message') warnings.push(`« ${item[1]} » est obligatoire : un avis sans note serait refusé. Décochez « Obligatoire ».`);
  }
  for (const k of Object.keys(fields)) {
    if (!fields[k]) warnings.push(`aucune question « ${LABEL[k]} » — ce champ ne sera pas envoyé.`);
  }
  const formUrl = responseUrlFrom(pageUrl, data);
  if (!formUrl) throw new Error('adresse de réponse introuvable — donnez le lien …/forms/d/e/…/viewform.');
  return { config: { formUrl, fields }, found, warnings, title: typeof data?.[3] === 'string' ? data[3] : '' };
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
    console.log(`  ${LABEL[f.field].padEnd(8)} → ${f.entry}  (« ${f.title} », ${TEXT_TYPES[f.type] || `type ${f.type}`}${f.required ? ', obligatoire' : ''})`);
  }
  for (const w of warnings) console.log(`  attention : ${w}`);
  if (!config.fields.message) {
    console.error('ÉCHEC : sans question « Message », l’avis resterait désactivé. Rien n’a été écrit.');
    process.exit(1);
  }
  if (dry) { console.log('--essai : rien n’a été écrit.'); return; }
  writeFileSync(OUT, JSON.stringify(config, null, 2) + '\n');
  console.log(`Écrit : ${OUT}`);
  console.log('Relancez Clarity : le bouton « Donner un avis » apparaît dans le panneau latéral et dans Réglages → À propos.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
