#!/usr/bin/env node
// Refuse une grammaire de saisie rapide qui régresse.
//
// POURQUOI CE FICHIER EXISTE
// `parseInput` décide de trois choses d'un coup — le titre, l'échéance, la
// durée — et se trompe SILENCIEUSEMENT : un mot avalé du titre ne provoque
// aucune erreur, il disparaît. Le pire cas n'est pas « ça n'a pas marché »,
// c'est « ça a marché sur autre chose que ce que je voulais ».
//
// Il n'y a pas de lanceur de tests côté frontend dans ce dépôt. Plutôt que
// d'en introduire un pour une fonction, ce contrôle suit le modèle déjà posé
// par verifier-locales.mjs : un script node, lancé par qualite.json et par la
// CI, qui rend 1 au premier écart.

import { parseInput } from '../src/lib/saisie.js';

// Un mardi, pour que « la prochaine occurrence » soit vérifiable.
const MARDI = new Date(2026, 8, 15, 10, 0, 0);   // 2026-09-15

const cas = [
  // ── anglais : tout ce qui marchait doit continuer ────────────────────────
  ['Ship the report for 2h tomorrow',   { title: 'Ship the report', deadline: '2026-09-16', estimatedDuration: 120 }],
  ['Call Ana ~30min today',             { title: 'Call Ana',        deadline: '2026-09-15', estimatedDuration: 30 }],
  ['Review deck for 45 minutes friday', { title: 'Review deck',     deadline: '2026-09-18', estimatedDuration: 45 }],
  ['Plan sprint monday',                { title: 'Plan sprint',     deadline: '2026-09-21', estimatedDuration: null }],

  // ── français : ce que ce fichier ajoute ──────────────────────────────────
  ['Rendre le rapport pour 2h demain',  { title: 'Rendre le rapport', deadline: '2026-09-16', estimatedDuration: 120 }],
  ['Appeler Ana pour 30 min demain',    { title: 'Appeler Ana',       deadline: '2026-09-16', estimatedDuration: 30 }],
  ['Monter le teaser 2h30 vendredi',    { title: 'Monter le teaser',  deadline: '2026-09-18', estimatedDuration: 150 }],
  ['Relire le devis 45 minutes lundi',  { title: 'Relire le devis',   deadline: '2026-09-21', estimatedDuration: 45 }],
  ["Ranger le bureau aujourd'hui",      { title: 'Ranger le bureau',  deadline: '2026-09-15', estimatedDuration: null }],
  ['Ranger le bureau aujourd’hui',      { title: 'Ranger le bureau',  deadline: '2026-09-15', estimatedDuration: null }],
  ['Préparer la réunion après-demain',  { title: 'Préparer la réunion', deadline: '2026-09-17', estimatedDuration: null }],
  ['Sortir les poubelles ce soir',      { title: 'Sortir les poubelles', deadline: '2026-09-15', estimatedDuration: null }],
  ['Étalonner le plan pour 1,5h jeudi', { title: 'Étalonner le plan', deadline: '2026-09-17', estimatedDuration: 90 }],

  // ── la prochaine occurrence, jamais aujourd'hui ──────────────────────────
  // Un mardi, « mardi » veut dire dans huit jours. Sinon la tâche naît en
  // retard, ce que personne n'écrit jamais volontairement.
  ['Point équipe mardi',                { title: 'Point équipe',    deadline: '2026-09-22', estimatedDuration: null }],

  // ── mots qui ne DOIVENT PAS être avalés ──────────────────────────────────
  // C'est la raison pour laquelle les abréviations françaises sont absentes
  // de la grammaire : « mer » et « dim » sont des mots courants.
  ['Aller à la mer',                    { title: 'Aller à la mer',  deadline: null, estimatedDuration: null }],
  ['Baisser la lumière dim',            { title: 'Baisser la lumière dim', deadline: null, estimatedDuration: null }],
  ['Acheter 45 m de câble',             { title: 'Acheter 45 m de câble', deadline: null, estimatedDuration: null }],
  ['Marcher jusqu’au marché',           { title: 'Marcher jusqu’au marché', deadline: null, estimatedDuration: null }],
  ['Lire Demainland',                   { title: 'Lire Demainland', deadline: null, estimatedDuration: null }],
  ['Corriger le bug 3h70',              { title: 'Corriger le bug 3h70', deadline: null, estimatedDuration: null }],

  // ── étiquettes, accents compris ──────────────────────────────────────────
  ['Rendre le devis #privé #urgent demain',
   { title: 'Rendre le devis', tags: ['privé', 'urgent'], deadline: '2026-09-16', estimatedDuration: null }],

  // ── rien à analyser ──────────────────────────────────────────────────────
  ['Réfléchir',                         { title: 'Réfléchir', deadline: null, estimatedDuration: null }],
  ['',                                  { title: '', deadline: null, estimatedDuration: null }],
];

const ecarts = [];
for (const [entree, attendu] of cas) {
  const r = parseInput(entree, MARDI);
  for (const [champ, valeur] of Object.entries(attendu)) {
    const obtenu = champ === 'tags' ? JSON.stringify(r.tags) : r[champ];
    const vise   = champ === 'tags' ? JSON.stringify(valeur) : valeur;
    if (obtenu !== vise) {
      ecarts.push(`« ${entree} » → ${champ} = ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(vise)}`);
    }
  }
}

console.log(`saisie rapide — ${cas.length} cas, 2 langue(s)`);
if (ecarts.length) {
  console.error(`\n${ecarts.length} écart(s) :`);
  for (const e of ecarts) console.error('  ' + e);
  process.exit(1);
}
console.log('Aucun écart.');
