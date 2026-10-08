#!/usr/bin/env node
/* Le paquet chargé par Electron est-il complet ?
 *
 *   node tools/verifier-paquet.mjs frontend/dist
 *
 * POURQUOI CE FICHIER EXISTE ICI
 * C'est une copie autonome du contrôle de liens du dépôt Personal-Work. Clarity
 * a été extrait dans son propre dépôt : un qualite.json qui appelait
 * ../../.github/qualite/… marchait dans le dépôt parent et nulle part ailleurs.
 * Un projet qui vit seul porte ses propres outils.
 *
 * CE QU'IL ATTRAPE. frontend/dist/ est versionné EXPRÈS — Electron le charge au
 * runtime, donc l'app doit tourner après un simple clone. Un dist/ à moitié
 * commité (le .js nouveau, le .html ancien, ou l'inverse) donne une fenêtre
 * blanche au démarrage, sans message, et rien d'autre ne le voit : ni le build,
 * ni les tests, qui ne regardent pas le paquet.
 *
 * CE QU'IL NE FAIT PAS. Il ne sort jamais sur le réseau : un contrôle qui dépend
 * d'un tiers échoue le jour où ce tiers est lent.
 *
 * CE QU'IL REFUSE AUSSI. Une ressource que la page CHARGE d'elle-même depuis
 * Internet — feuille de style, police, script, image. Clarity a longtemps tiré
 * ses polices de fonts.googleapis.com : chaque lancement envoyait l'adresse IP
 * de l'utilisateur à Google, sous un premier écran qui promet « no cloud, no
 * spying ». Rien ne le voyait, parce que ce contrôle ignorait les URL externes.
 * Il les compte maintenant comme des écarts. Un lien CLIQUABLE (<a href>) reste
 * permis : il ne part que si l'utilisateur le décide.
 *
 * PORTÉE : dépôt (appelé nommément par le qualite.json de chaque projet).
 */
import fs from 'node:fs';
import path from 'node:path';

/* `--tolere <motif>` déclare une absence VOULUE. Une page d'un autre projet, par
   exemple, référence huit images qui n'existent pas encore : chaque tuile les
   pose en première couche de fond avec un dégradé CSS en repli, et le README
   du dossier documente le nom de fichier attendu. C'est un état d'attente
   conçu, pas un lien cassé. La liste vit dans le qualite.json du projet — donc
   chez lui, et versionnée : une tolérance qu'on ne relit jamais devient un
   trou permanent. */
const argv = process.argv.slice(2);
const cibles = [], toleres = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--tolere') toleres.push(argv[++i]);
  else cibles.push(argv[i]);
}
if (!cibles.length) {
  console.error('usage : verifier-liens.mjs <dossier-ou-fichier> [...] [--tolere <motif>]');
  process.exit(2);
}
const MARQUE = '@@GLOBSTAR@@';
const regexToleres = toleres.map((g) => new RegExp('^' + g
  .replace(/[.+^${}()|[\]\\]/g, '\\$&')
  .replace(/\*\*/g, MARQUE).replace(/\*/g, '[^/]*').replaceAll(MARQUE, '.*') + '$'));
const tolere = (lien) => regexToleres.some((re) => re.test(lien));

/* href, src, srcset, poster, content d'une meta og:image, et url() en CSS. */
const ATTRIBUTS = /\b(?:href|src|poster|data-src)\s*=\s*(["'])([^"']*)\1/gi;
const SRCSET = /\bsrcset\s*=\s*(["'])([^"']*)\1/gi;
const CSS_URL = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;

/* Ce que le navigateur va chercher tout seul : les url() d'une feuille de
   style, et src/href des balises qui chargent. <a> n'y est pas. */
const CHARGE = /<(?:link|script|img|source|iframe|video|audio|embed|object|track)\b[^>]*?\b(?:href|src|data)\s*=\s*(["'])([^"']*)\1/gi;
const internet = (u) => /^(?:https?:)?\/\//i.test(u.trim());

const externe = (u) =>
  !u || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(u) || u.startsWith('#') || u.startsWith('?');

const pagesDe = (cible) => {
  const st = fs.statSync(cible);
  if (st.isFile()) return [cible];
  const out = [];
  const marcher = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) marcher(p);
      else if (/\.(html?|css)$/i.test(e.name)) out.push(p);
    }
  };
  marcher(cible);
  return out;
};

const ecarts = [];
const sorties = [];
let pages = 0, liens = 0, toleresVus = 0;

for (const cible of cibles) {
  if (!fs.existsSync(cible)) {
    console.error(`ÉCHEC : « ${cible} » n'existe pas.`);
    process.exit(1);
  }
  for (const page of pagesDe(cible)) {
    pages++;
    /* On retire les <script> AVANT de chercher. Une application d'une seule
       page construit ses liens dans des gabarits — `href="${esc(url)}"` — et
       appelle `URL.createObjectURL`. Lus comme du HTML, ce sont des chemins
       nommés « ${esc(url)} » et « blob » qu'aucun fichier ne satisfera jamais.
       Quatre faux positifs sur un quiz, quatre sur un autre : de quoi
       faire abandonner le contrôle au premier passage. */
    /* Les COMMENTAIRES d'abord, les scripts ensuite, et cet ordre n'est pas
       cosmétique. Une page porte « Voir le bloc <script> en bas de
       page. » dans un commentaire : deux ouvertures pour une seule fermeture.
       Le retrait des scripts partait alors de la ligne 106 et allait jusqu'à
       la 328, avalant tout le corps de la page — liens compris. Le contrôle
       ne trouvait plus rien à vérifier et se déclarait vert, y compris sur un
       lien délibérément cassé pour l'éprouver. Un contrôle aveugle qui répond
       « tout va bien » est pire que pas de contrôle du tout. */
    const texte = fs.readFileSync(page, 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    for (const m of texte.matchAll(CHARGE)) if (internet(m[2])) sorties.push({ page, lien: m[2] });
    for (const m of texte.matchAll(CSS_URL)) if (internet(m[2])) sorties.push({ page, lien: m[2] });
    for (const m of texte.matchAll(/@import\s+(?:url\()?\s*["']?((?:https?:)?\/\/[^"')\s]+)/gi)) sorties.push({ page, lien: m[1] });
    const base = path.dirname(page);
    const refs = [];
    for (const m of texte.matchAll(ATTRIBUTS)) refs.push(m[2]);
    for (const m of texte.matchAll(CSS_URL)) refs.push(m[2]);
    for (const m of texte.matchAll(SRCSET))
      for (const part of m[2].split(',')) refs.push(part.trim().split(/\s+/)[0]);

    for (const brut of refs) {
      const u = brut.trim();
      if (externe(u)) continue;
      // Un gabarit non encore évalué n'est pas un chemin.
      if (u.includes('${') || u.includes('{{')) continue;
      if (tolere(u)) { toleresVus++; continue; }
      liens++;
      // On jette l'ancre et la requête : « page.html#section » vise page.html.
      const propre = decodeURIComponent(u.split('#')[0].split('?')[0]);
      if (!propre) continue;
      /* Un chemin absolu est relatif à la RACINE DU SITE PUBLIÉ, pas au dépôt.
         La racine publiée, c'est la cible qu'on nous a donnée. */
      const cibleFs = propre.startsWith('/')
        ? path.join(cible, propre.slice(1))
        : path.join(base, propre);
      if (!fs.existsSync(cibleFs))
        ecarts.push({ page, lien: u, attendu: path.relative(process.cwd(), cibleFs) });
    }
  }
}

console.log(`liens locaux — ${pages} page(s) lue(s) · ${liens} référence(s) locale(s)` +
            (toleresVus ? ` · ${toleresVus} absence(s) tolérée(s)` : ''));
if (sorties.length) {
  console.error(`\n${sorties.length} ressource(s) chargée(s) depuis Internet — le paquet doit tout porter :`);
  for (const e of sorties) console.error(`  ${e.page}\n      « ${e.lien} »`);
}
if (!ecarts.length && !sorties.length) { console.log('Aucune cible manquante, aucune ressource externe.'); process.exit(0); }
if (!ecarts.length) process.exit(1);
console.error(`\n${ecarts.length} cible(s) manquante(s) :`);
for (const e of ecarts)
  console.error(`  ${e.page}\n      « ${e.lien} » → ${e.attendu} (absent)`);
process.exit(1);
