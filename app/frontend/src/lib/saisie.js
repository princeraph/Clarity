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

// La récurrence. Toujours introduite — « chaque », « tous les », « every » —
// jamais un adjectif seul : « Rédiger le rapport hebdo » ou « Daily standup »
// sont des titres, et « hebdo » ou « daily » avalés leur feraient perdre leur
// sens. Pour un jour, les noms complets seulement, pour la raison des
// abréviations françaises ci-dessus.
const JOURS_COMPLETS = Object.keys(JOURS).filter(j => j.length > 3);
const RE_RECUR_JOUR = new RegExp(`(?<![\\p{L}\\d])(?:every|each|chaque|tous\\s+les)\\s+(${JOURS_COMPLETS.join('|')})s?(?![\\p{L}\\d])`, 'iu');
const RE_RECUR = /(?<![\p{L}\d])(?:(?:every|each|chaque)\s+(day|week|month|jour|semaine|mois)|tous\s+les\s+(jours|mois)|toutes\s+les\s+(semaines))(?![\p{L}\d])/iu;
const PERIODE = { day: 'daily', jour: 'daily', jours: 'daily', week: 'weekly', semaine: 'weekly', semaines: 'weekly', month: 'monthly', mois: 'monthly' };

// « for 2h », « pour 45 min », « ~1.5h », et la forme française « 2h30 ».
const RE_DUREE_HM = /(?<![\p{L}\d])(?:for\s+|pour\s+|~)?(\d{1,2})\s*h\s*(\d{1,2})(?![\p{L}\d])/iu;
const RE_DUREE    = /(?<![\p{L}\d])(?:for\s+|pour\s+|~)(\d+(?:[.,]\d+)?)\s*(h(?:eures?|ours?)?|min(?:utes?)?|m)(?![\p{L}\d])/iu;
// Sans préfixe, l'unité doit être explicite : « 45 minutes » oui, « 45 m » non
// — « 45 m » est une distance au moins aussi souvent qu'une durée.
const RE_DUREE_NUE = /(?<![\p{L}\d])(\d+(?:[.,]\d+)?)\s*(heures?|hours?|minutes?|min)(?![\p{L}\d])/iu;

// ── L'heure ──────────────────────────────────────────────────────────────
// Introduite (« à 14h », « vers 9h », « at 3pm », « @ 15:30 ») ou écrite comme
// une heure (« 14:30 », « 2pm ») : toujours une heure. Nue (« 14h », « 9h30 »),
// c'est une heure à partir de 7 h et une durée en dessous — « réunion 9h » est
// un rendez-vous, « teaser 2h30 » un temps de travail (décidé le 15 octobre).
// Précédée de « pour », « for » ou « ~ », jamais une heure : c'est une durée.
const PAS_DUREE = String.raw`(?<!(?:pour|for)\s+)(?<!~\s*)`;
const RE_HEURE_INTRO = /(?<![\p{L}\d])(?:à|a|vers|at|@)\s*(\d{1,2})(?:\s*h\s*(\d{2})?|:(\d{2}))?\s*(am|pm)?(?![\p{L}\d])/iu;
const RE_HEURE_DEUX_POINTS = /(?<![\p{L}\d:])(\d{1,2}):(\d{2})\s*(am|pm)?(?![\p{L}\d:])/iu;
const RE_HEURE_AMPM = /(?<![\p{L}\d:])(\d{1,2})\s*(am|pm)(?![\p{L}\d])/iu;
const RE_HEURE_NUE = new RegExp(`${PAS_DUREE}(?<![\\p{L}\\d])(\\d{1,2})\\s*h\\s*(\\d{2})?(?![\\p{L}\\d])`, 'iu');
// La durée nue « 2h », sous le seuil de l'heure.
const RE_DUREE_H_NUE = new RegExp(`${PAS_DUREE}(?<![\\p{L}\\d])(\\d)\\s*h(?![\\p{L}\\d])`, 'iu');
const SEUIL_HEURE = 7;

function enHeure(h, mn, ampm) {
  let heures = parseInt(h, 10);
  const minutes = mn == null ? 0 : parseInt(mn, 10);
  if (ampm) {
    if (heures < 1 || heures > 12) return null;
    heures = (heures % 12) + (/^p/i.test(ampm) ? 12 : 0);
  }
  if (!(heures >= 0 && heures <= 23 && minutes >= 0 && minutes <= 59)) return null;
  return `${String(heures).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// ── Les dates écrites ────────────────────────────────────────────────────
// « 12 oct. », « le 12 octobre », « Oct 12th », « 12/10 », « le 12 ». Sans
// année : la prochaine fois que cette date revient — passée cette année, l'an
// prochain. Une date impossible (31 février) reste dans le titre.
const MOIS = {
  janvier: 1, janv: 1, january: 1, jan: 1,
  février: 2, fevrier: 2, févr: 2, fevr: 2, fév: 2, fev: 2, february: 2, feb: 2,
  mars: 3, march: 3, mar: 3,
  avril: 4, avr: 4, april: 4, apr: 4,
  mai: 5, may: 5,
  juin: 6, june: 6, jun: 6,
  juillet: 7, juil: 7, july: 7, jul: 7,
  août: 8, aout: 8, august: 8, aug: 8,
  septembre: 9, september: 9, sept: 9, sep: 9,
  octobre: 10, october: 10, oct: 10,
  novembre: 11, november: 11, nov: 11,
  décembre: 12, decembre: 12, december: 12, déc: 12, dec: 12,
};
const NOMS_MOIS = parLongueur(Object.keys(MOIS));
const MOIS_RE = `(${NOMS_MOIS.join('|')})\\.?`;
const ORDINAL = '(?:er|st|nd|rd|th)?';
const RE_DATE_JOUR_MOIS = new RegExp(`(?<![\\p{L}\\d])(?:le\\s+)?(\\d{1,2})${ORDINAL}\\s+${MOIS_RE}(?:\\s+(\\d{4}))?(?![\\p{L}\\d])`, 'iu');
const RE_DATE_MOIS_JOUR = new RegExp(`(?<![\\p{L}\\d])${MOIS_RE}\\s+(\\d{1,2})${ORDINAL}(?:,?\\s+(\\d{4}))?(?![\\p{L}\\d])`, 'iu');
const RE_DATE_CHIFFRES = /(?<![\p{L}\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?(?![\p{L}\d/])/iu;
// Suivi d'un mois, ce n'est pas « le 12 » seul : « le 31 février » impossible
// doit rester entier, pas devenir « février » et le 31 du mois prochain.
const RE_DATE_JOUR_SEUL = new RegExp(`(?<![\\p{L}\\d])(?:le|the)\\s+(\\d{1,2})(?:er|st|nd|rd|th)?(?![\\p{L}\\d:/]|\\s*h(?![\\p{L}])|\\s+(?:${NOMS_MOIS.join('|')})(?![\\p{L}]))`, 'iu');

function dateEcrite(jour, mois, annee, maintenant) {
  const j = parseInt(jour, 10), m = parseInt(mois, 10);
  let a = annee ? parseInt(annee, 10) : maintenant.getFullYear();
  if (annee && annee.length === 2) a += 2000;
  const valide = (y) => { const d = new Date(y, m - 1, j); return d.getMonth() === m - 1 && d.getDate() === j ? d : null; };
  let d = valide(a);
  if (!d) return null;                                   // 31 février, 29 février d'une année non bissextile
  const aujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  if (!annee && d < aujourdhui) d = valide(a + 1);
  return d ? dateISO(d) : null;
}

function prochainJourDuMois(jour, maintenant) {
  const j = parseInt(jour, 10);
  if (j < 1 || j > 31) return null;
  for (let k = 0; k < 13; k++) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() + k, j);
    if (d.getDate() !== j) continue;                    // le 31 d'un mois de 30 jours
    const aujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
    if (d >= aujourdhui) return dateISO(d);
  }
  return null;
}

// ── La priorité (1.8.0) : « !1 » (priorité absolue) … « !6 » (très basse) ──
// Collé à rien : « Partie 1!1 », « !!! » ou « !7 » restent dans le titre.
const RE_PRIORITE = /(?<![\p{L}\d!])!([1-6])(?![\p{L}\d!])/u;
const PRIORITES = ['top', 'very_high', 'high', 'medium', 'low', 'very_low'];

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
// `dateOrder` : comment lire « 12/10 » — 'dmy' (12 octobre, français) ou 'mdy'
// (10 décembre, anglais) ; la langue de l'interface choisit.
/** How « 12/10 » reads in this interface language. */
export function dateOrderFor(locale) { return String(locale || '').toLowerCase().startsWith('en') ? 'mdy' : 'dmy'; }

export function parseInput(texte, maintenant = new Date(), { tags = true, duration = true, dateOrder = 'dmy' } = {}) {
  const etiquettes = new Set();
  let echeance = null;
  let duree = null;
  let recurrence = 'none';
  let heure = null;
  let priorite = null;
  let titre = String(texte ?? '');
  titre = titre.replace(RE_PRIORITE, (_, n) => { priorite = PRIORITES[Number(n) - 1]; return ''; });

  if (tags) titre = titre.replace(/#([\p{L}\d-]+)/gu, (_, e) => { etiquettes.add(e.toLowerCase()); return ''; }).trim();

  // L'heure avant la durée : « à 14h30 » n'est pas une durée de 14 h 30.
  for (const re of [RE_HEURE_INTRO, RE_HEURE_DEUX_POINTS, RE_HEURE_AMPM, RE_HEURE_NUE]) {
    if (heure !== null) break;
    titre = titre.replace(re, (...m) => {
      let h;
      if (re === RE_HEURE_INTRO) {
        if (m[2] === undefined && m[3] === undefined && !m[4] && !/h/i.test(m[0])) return m[0];   // « à 3 » : un nombre, pas une heure
        h = enHeure(m[1], m[2] ?? m[3], m[4]);
      } else if (re === RE_HEURE_DEUX_POINTS) h = enHeure(m[1], m[2], m[3]);
      else if (re === RE_HEURE_AMPM) h = enHeure(m[1], null, m[2]);
      else {
        if (parseInt(m[1], 10) < SEUIL_HEURE) return m[0];
        h = enHeure(m[1], m[2], null);
      }
      if (h === null) return m[0];
      heure = h;
      return '';
    });
  }

  // Ordre important : la forme « 2h30 » avant la forme à unité, sinon « 2h »
  // est consommé et « 30 » reste collé au titre.
  for (const re of duration ? [RE_DUREE_HM, RE_DUREE, RE_DUREE_NUE, RE_DUREE_H_NUE] : []) {
    if (duree !== null) break;
    titre = titre.replace(re, (...m) => {
      if (re === RE_DUREE_HM) {
        const h = parseInt(m[1], 10), mn = parseInt(m[2], 10);
        if (mn > 59) return m[0];          // « 3h70 » n'est pas une durée
        duree = h * 60 + mn;
        return '';
      }
      const v = re === RE_DUREE_H_NUE ? enMinutes(m[1], 'h') : enMinutes(m[1], m[2]);
      if (v === null) return m[0];
      duree = v;
      return '';
    });
  }

  // Avant les dates : « tous les lundis » laisse « lundi », que la suite
  // transforme en prochaine occurrence.
  titre = titre.replace(RE_RECUR_JOUR, (_, jour) => { recurrence = 'weekly'; return ` ${jour} `; });
  if (recurrence === 'none') {
    titre = titre.replace(RE_RECUR, (_, a, b, c) => { recurrence = PERIODE[(a || b || c).toLowerCase()]; return ''; });
  }

  // Les dates écrites avant les mots (« demain », « lundi ») : une date précise
  // dit plus qu'un mot relatif.
  titre = titre.replace(RE_DATE_JOUR_MOIS, (tout, j, mois, a) => {
    const d = dateEcrite(j, MOIS[mois.toLowerCase()], a, maintenant);
    if (!d || echeance) return tout;
    echeance = d; return '';
  });
  if (!echeance) titre = titre.replace(RE_DATE_MOIS_JOUR, (tout, mois, j, a) => {
    const d = dateEcrite(j, MOIS[mois.toLowerCase()], a, maintenant);
    if (!d) return tout;
    echeance = d; return '';
  });
  if (!echeance) titre = titre.replace(RE_DATE_CHIFFRES, (tout, x, y, a) => {
    const [j, mo] = dateOrder === 'mdy' ? [y, x] : [x, y];
    const d = dateEcrite(j, mo, a, maintenant);
    if (!d) return tout;
    echeance = d; return '';
  });
  if (!echeance) titre = titre.replace(RE_DATE_JOUR_SEUL, (tout, j) => {
    const d = prochainJourDuMois(j, maintenant);
    if (!d) return tout;
    echeance = d; return '';
  });

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

  // Une répétition compte à partir d'une échéance : sans date, la première
  // est pour aujourd'hui (c'est aussi ce que fait le connecteur).
  if (recurrence !== 'none' && !echeance) echeance = dateISO(maintenant);

  titre = titre.replace(/\s{2,}/g, ' ').trim();
  return { title: titre, tags: [...etiquettes], deadline: echeance, time: heure, estimatedDuration: duree, recurring: recurrence, priority: priorite };
}
