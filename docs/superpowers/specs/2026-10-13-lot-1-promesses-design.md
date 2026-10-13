# Lot 1 (Clarity 1.7.0) — ce qui est promis marche

Validé le 13 octobre 2026 : approche « la confiance d'abord, le public ensuite »,
en quatre lots (1.7 promesses, 1.8 rappels, 1.9 ordre et mouvement, 2.0 prêt
public). Ce document décrit le premier.

## Pourquoi ce lot

L'inventaire du 13 octobre a trouvé des promesses que l'app affiche sans les
tenir, vérifiées dans le code :

- Réglages › Clavier annonce Espace (terminer), Entrée (ouvrir), Suppr
  (supprimer). Aucune des trois n'est branchée. Aucune navigation au clavier
  dans les listes.
- La vue « Bilan de la semaine » existe ; aucun lien, raccourci ni commande n'y
  mène.
- La saisie rapide ignore l'heure : « Appeler Marc 14h » garde « 14h » dans le
  titre. Une date écrite (« 12 oct. ») n'est pas comprise.
- Seule la suppression s'annule. Une coche, un archivage, une modification : non.
- Aucun aide-mémoire des raccourcis.

Ce sont les défauts que les testeurs touchent chaque jour. Petits, sûrs, et
chacun se vérifie seul.

## Hors périmètre

Rappels à l'heure (lot 2). Glisser-déposer, ordre manuel (lot 3). Touches j/k,
sélection multiple, actions groupées. Calendrier Google/Outlook.

## 1. Le clavier dans les listes

**Comportement.**

- Une carte de tâche prend le focus (Tab, clic, flèches). Le focus se voit :
  contour de la couleur d'accent, seulement au clavier (`:focus-visible`).
- ↓ / ↑ : carte suivante / précédente de la vue affichée, dans l'ordre de
  l'écran. Sans carte focalisée, ↓ prend la première.
- Espace : terminer / rouvrir (même chemin que le clic, animation comprise).
- Entrée : ouvrir le détail.
- Suppr : supprimer, avec l'annulation de 5 s qui existe déjà.
- Après une coche ou une suppression, le focus passe à la carte suivante :
  Espace, Espace, Espace termine une liste.
- Les touches lisent la configuration de Réglages › Clavier
  (`getShortcutKeys('complete' | 'detail' | 'delete')`) : une touche
  re-assignée marche, l'ancienne non.
- Inactif quand on tape (champ, zone de texte), quand une fenêtre est ouverte
  par-dessus, pendant la visite.

**Où** : Aujourd'hui, Boîte de réception, Quand je veux, page d'un sujet. Pas le
calendrier (grille, autre logique).

**Comment** : chaque carte porte `data-task-id` et `tabIndex={0}`. Un seul
écouteur dans App, qui part de `document.activeElement.closest('[data-task-id]')`.
Les cartes suivante/précédente se trouvent dans le DOM de `<main>` : aucun état
de sélection à tenir, rien à resynchroniser quand la liste change.

## 2. Le bilan de la semaine accessible

- Entrée « Bilan de la semaine » dans la barre latérale, après Tendances (icône
  propre, aussi dans la barre repliée).
- Commande dans Ctrl+K.
- Sans assistant, la vue le dit déjà et mène au réglage (`AiOfflineNotice`,
  bouton désactivé) : rien à changer.

## 3. La saisie comprend l'heure et les dates écrites

**Heure** → champ `time` (HH:MM), déjà dans le modèle.

| Écrit | Compris |
|---|---|
| `à 14h`, `à 14 h 30`, `vers 9h`, `at 3pm`, `at 15:30` | heure, toujours |
| `14:30`, `2pm`, `2:30pm` | heure, toujours |
| `pour 2h`, `for 2h`, `~2h` | durée, toujours (inchangé) |
| `14h`, `9h30` **nu** | heure si le nombre d'heures est ≥ 7 |
| `2h`, `2h30` **nu** | durée si < 7 (inchangé : « Monter le teaser 2h30 vendredi » reste 150 min) |

Le seuil 7 est un choix (voir « À décider »). Une heure invalide (« 25h »,
« 14h75 ») reste dans le titre.

**Dates écrites** → `deadline`.

- `12 oct`, `12 oct.`, `12 octobre`, `le 12 octobre`, `Oct 12`, `October 12th`.
- `12/10` : jour/mois en français, mois/jour en anglais (langue de l'interface,
  passée au parseur).
- `le 12` seul : le prochain 12 du mois.
- Sans année : la prochaine occurrence — passée cette année, l'an prochain.
  Une date impossible (31 février) reste dans le titre.

**Partout où l'on saisit** : Ctrl+K, panneau du jour, accueil (même parseur,
`lib/saisie.js`). L'aperçu de la saisie montre l'heure comme il montre la date.

## 4. Annuler

Le toast porte déjà une action (« Annuler »). On l'étend :

| Geste | Toast | Annuler fait |
|---|---|---|
| Terminer (clic, Espace, menu) | « Terminée · Annuler » | remet l'état d'avant |
| Archiver | « Archivée · Annuler » | restaure (route existante) |
| Modifier (formulaire, panneau de détail) | « Modifiée · Annuler » | renvoie les valeurs d'avant, champs changés seulement |

**Tâche récurrente.** La terminer crée l'occurrence suivante (identifiant
déterministe). L'annuler doit la retirer, sinon il en reste deux. Côté serveur :
une tâche récurrente qui repasse de « terminée » à « pas terminée » supprime
l'occurrence qu'elle a créée **si celle-ci n'a pas été touchée** (pas commencée,
pas modifiée). Touchée, elle reste — on ne détruit pas un travail. Le panneau du
jour, qui refusait d'annuler une récurrente pour cette raison, l'accepte alors.

## 5. L'aide-mémoire des raccourcis

- `?` (hors saisie) l'ouvre ; aussi depuis Ctrl+K et un lien dans Réglages ›
  Clavier. Échap ferme.
- Trois groupes : Partout (Ctrl+K, Ctrl+/, Ctrl+Alt+Espace…), Dans une liste
  (↑↓, Espace, Entrée, Suppr), Dans la saisie (Entrée, Ctrl+Entrée, Échap).
- Lit les touches configurées : il dit ce qui marche, pas ce qui marchait.

## 6. Nouveautés montrées sur place

`WHATS_NEW['1.7.0']` : la barre latérale (bilan), la liste (clavier), le bouton
Nouvelle tâche (heure et date dans la saisie). `update.news` FR/EN. Le
vérificateur de la visite couvre les nouvelles étapes.

## Vérification

- `verifier-saisie.mjs` : chaque ligne des tableaux ci-dessus, dans les deux
  langues, plus les cas existants inchangés. Mutation : remettre l'ancien
  comportement fait échouer.
- Backend (Jest) : annuler une récurrente retire l'occurrence intacte, garde
  une occurrence modifiée.
- Navigateur (Chromium, vrai backend) : Espace×3 termine trois tâches ; Entrée
  ouvre ; Suppr puis Annuler ; touche re-assignée ; chaque Annuler ; `?` ;
  bilan atteint depuis la barre. Écrit dans le dépôt cette fois
  (`app/frontend/tools/`), pour ne plus dépendre d'un brouillon de session.
- Barrière complète, CI verte (Windows compris) avant fusion.

## À décider à la relecture

1. **Seuil de l'heure nue** : `14h` = heure, `2h` = durée, coupure à 7 h.
   Alternative : une heure nue n'est jamais une heure (il faut « à 14h »).
   Recommandé : le seuil — « réunion 9h » est l'usage courant.
2. **`12/10` selon la langue de l'interface** — ou toujours jour/mois.
   Recommandé : selon la langue.
