// La grammaire de la saisie rapide — « Rendre le rapport #travail pour 2h demain ».
//
// POURQUOI CE FICHIER EXISTE
// Cette grammaire vivait en littéraux anglais dans SearchCapture.jsx : `for`,
// `hours`, `today`, `monday`. L'interface, elle, se traduit. Une personne qui
// utilise Clarity en français tapait donc dans une boîte française une phrase
// que seul l'anglais comprenait — et `estimatedDuration` n'avait AUCUNE autre
// entrée dans l'app avant que le formulaire n'en reçoive une. Le biais
// d'estimation du profil, qui exige une estimation et un temps mesuré sur cinq
// tâches, restait donc hors d'atteinte par construction.
//
// LES DEUX LANGUES SONT ACTIVES EN PERMANENCE, indépendamment de la locale
// choisie. Deux raisons : rien de ce qui marchait avant ne peut casser, et
// quelqu'un qui pense dans les deux langues — le cas ici — n'a pas à se
// souvenir dans laquelle l'app est réglée.

// ── Ce qui est volontairement ABSENT ────────────────────────────────────────
// Les abréviations françaises de jours (lun, mar, MER, jeu, ven, sam, DIM).
// « mer » et « dim » sont des mots français courants : « aller à la mer »
// deviendrait une échéance au mercredi, avec le mot avalé au passage. Un
// analyseur qui mange un mot du titre sans le dire est pire que pas
// d'analyseur. Les noms complets n'ont pas ce défaut.
//
// Les abréviations anglaises (mon, tue, sun…) sont conservées telles quelles :
// elles étaient là avant, et les retirer casserait une saisie qui marche.
// Elles portent le même risque (« get some sun »), mais c'est un défaut
// existant, pas un que ce fichier introduit — à traiter séparément.

// Jour de la semaine → index JS (0 = dimanche).
export const JOURS = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0,
  mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0,
  lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0,
};

// Mot → nombre de jours à partir d'aujourd'hui.
export const RELATIFS = {
  today: 0, tonight: 0, tomorrow: 1,
  // Les deux apostrophes : celle du clavier (') et la typographique (’). Une
  // seule des deux, et la moitié des saisies passe à côté sans rien dire.
  "aujourd'hui": 0, 'aujourd’hui': 0,
  'ce soir': 0, demain: 1, 'après-demain': 2, 'apres-demain': 2,
};

const echapper = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Les plus longs d'abord : sans ça « demain » l'emporterait sur « après-demain »
// et laisserait « après- » dans le titre.
const parLongueur = mots => [...mots].sort((a, b) => b.length - a.length).map(echapper);

const MOTS_DATE = parLongueur([...Object.keys(RELATIFS), ...Object.keys(JOURS)]);
const RE_DATE = new RegExp(`(?<![\\p{L}\\d])(${MOTS_DATE.join('|')})(?![\\p{L}\\d])`, 'giu');

// « for 2h », « pour 45 min », « ~1.5h », et la forme française « 2h30 ».
const RE_DUREE_HM = /(?<![\p{L}\d])(?:for\s+|pour\s+|~)?(\d{1,2})\s*h\s*(\d{1,2})(?![\p{L}\d])/iu;
const RE_DUREE    = /(?<![\p{L}\d])(?:for\s+|pour\s+|~)(\d+(?:[.,]\d+)?)\s*(h(?:eures?|ours?)?|min(?:utes?)?|m)(?![\p{L}\d])/iu;
// Sans préfixe, l'unité doit être explicite : « 45 minutes » oui, « 45 m » non
// — « 45 m » est une distance au moins aussi souvent qu'une durée.
const RE_DUREE_NUE = /(?<![\p{L}\d])(\d+(?:[.,]\d+)?)\s*(heures?|hours?|minutes?|min)(?![\p{L}\d])/iu;

function enMinutes(nombre, unite) {
  const n = parseFloat(String(nombre).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return /^h/i.test(unite) ? Math.round(n * 60) : Math.round(n);
}

function dateISO(d) {
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const jr = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mo}-${jr}`;
}

// `maintenant` est un paramètre, jamais un new Date() caché : c'est ce qui rend
// l'analyseur vérifiable sans attendre mardi.
// `options` : les réglages de Réglages › Saisie. Un réglage éteint laisse le
// texte tel quel — « #travail » ou « 2h » restent dans le titre — plutôt que de
// l'avaler sans rien en faire.
export function parseInput(texte, maintenant = new Date(), { tags = true, duration = true } = {}) {
  const etiquettes = new Set();
  let echeance = null;
  let duree = null;
  let titre = String(texte ?? '');

  if (tags) titre = titre.replace(/#([\p{L}\d-]+)/gu, (_, e) => { etiquettes.add(e.toLowerCase()); return ''; }).trim();

  // Ordre important : la forme « 2h30 » avant la forme à unité, sinon « 2h »
  // est consommé et « 30 » reste collé au titre.
  for (const re of duration ? [RE_DUREE_HM, RE_DUREE, RE_DUREE_NUE] : []) {
    if (duree !== null) break;
    titre = titre.replace(re, (...m) => {
      if (re === RE_DUREE_HM) {
        const h = parseInt(m[1], 10), mn = parseInt(m[2], 10);
        if (mn > 59) return m[0];          // « 3h70 » n'est pas une durée
        duree = h * 60 + mn;
        return '';
      }
      const v = enMinutes(m[1], m[2]);
      if (v === null) return m[0];
      duree = v;
      return '';
    });
  }

  titre = titre.replace(RE_DATE, (_, mot) => {
    if (echeance) return '';
    const cle = mot.toLowerCase();
    if (cle in RELATIFS) {
      const d = new Date(maintenant);
      d.setDate(d.getDate() + RELATIFS[cle]);
      echeance = dateISO(d);
    } else {
      const cible = JOURS[cle];
      const d = new Date(maintenant);
      // Toujours la PROCHAINE occurrence : « lundi » un lundi veut dire dans
      // huit jours, pas aujourd'hui — sinon une tâche naît déjà en retard.
      d.setDate(d.getDate() + (((cible - maintenant.getDay() + 7) % 7) || 7));
      echeance = dateISO(d);
    }
    return '';
  });

  titre = titre.replace(/\s{2,}/g, ' ').trim();
  return { title: titre, tags: [...etiquettes], deadline: echeance, estimatedDuration: duree };
}
