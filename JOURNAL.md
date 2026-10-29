# Clarity — journal

Ce que le projet a traversé, dans l'ordre, avec les chiffres mesurés plutôt
qu'estimés. Trois fichiers se partagent le travail et ne se recouvrent pas :

- `README.md` — ce qu'est Clarity et comment le lancer
- `CONTRIBUTING.md` — les règles pour y toucher
- `BACKLOG.md` — ce qui reste ouvert
- **ce fichier** — ce qui a été fait, et ce que ça a appris

---


Avant la 2.1.0 (août → 16 octobre 2026) : `docs/journal-archive.md`. Ne
l’ouvrir que pour une question précise, par `grep -n`.

## 2.1.0 — Les niveaux se voient, le plan en grille horaire (16 octobre 2026)

**Changé.**
- **Niveaux** : barre de couleur sur chaque tâche (plus épaisse quand le niveau
  est haut, en pointillé s'il est hérité). « Priorité absolue » et « Très haute »
  sont écrits. Les cartes Absolue sont teintées. Le niveau figure aussi sur les
  nœuds du graphe.
- **Plan du jour** : grille horaire verticale, blocs proportionnels à leur durée,
  avec rendez-vous, pause et trait de maintenant.
- **À venir** remplace « Ensuite » : 7 jours, avec la charge de chaque jour et
  les jours trop pleins en orange.
- **Calendrier** : vue semaine (par défaut) ; mois en couleurs de niveau.
- **Serveur** : `/api/calendar/range` ; heures UTC ramenées à l'heure locale.

**Pourquoi.** Demande du 16 octobre : niveaux trop discrets, « Ensuite » sans
dates, plan présenté comme une simple liste. Captures d'agenda « time blocking »
en référence.

**Vérifié.**
- `verifier-niveaux` : 116 contrôles de contraste (barre ≥ 3:1, texte ≥ 7:1, clair
  et sombre).
- `verifier-a-venir` : 17 cas.
- `verifier-journee` : 43 cas, dont 8 pour la grille.
- Mutations : chaque règle a été cassée sur copie, et le contrôle l'a vue.
- `tests/calendrier.test.js` : 6 tests ; backend : 493 tests au total.
- Navigateur (`essai-navigateur-2.1.cjs`), tout vert : grille, hauteurs,
  débordement, barres, À venir, semaine, mois, sombre, graphe.

**Reste.**
- 2.2 : pauses multiples, heures par jour, plan modifiable (glisser, épingler,
  durée, retirer, ajouter).
- Pas vérifié : un vrai fichier .ics sur plusieurs jours ; les répétitions
  (RRULE) ne sont toujours pas lues.

## 2.2.0 — Au quotidien entièrement modifiable, le plan à sa main, la densité visible (17 octobre 2026)

**Changé.**
- **Réglages › Au quotidien** :
  - jusqu'à 6 pauses, chacune avec un nom facultatif ;
  - « Mêmes heures tous les jours » ou « Heures par jour », chaque jour avec ses heures et ses pauses ;
  - l'ancienne pause unique est reprise sans rien perdre.
- **Plan du jour** :
  - glisser un bloc l'épingle à une autre heure (pas de 5 min) ;
  - un clic sur un bloc donne : plus tôt, plus tard (aussi Alt + ↑/↓), heure épinglée, durée (« Garder comme estimation » possible), retirer du jour, défaire un groupe ;
  - sous la grille : ajouter une tâche ou une pause, changer les heures pour aujourd'hui seulement, « Pas aujourd'hui » avec « Remettre » ;
  - « Refaire » demande s'il faut garder les changements ou repartir de zéro ;
  - un bloc épinglé n'est jamais déplacé quand la journée déborde ; s'il est dépassé, c'est dit.
- **Densité** :
  - elle ne changeait que les cartes de tâches (environ 5 px), et rien dans Réglages : on croyait qu'elle ne faisait rien ;
  - elle touche maintenant la grille du jour, la semaine, À venir, la barre latérale et les cartes ;
  - Réglages › Apparence montre un aperçu immédiat.

**Pourquoi.** Retour du 17 octobre : impossible d'ajouter des pauses ou de régler les heures selon le jour ; la densité semblait ne rien faire ; « go 2.2 ».

**Vérifié.**
- `verifier-journee` : 60 cas (17 nouveaux : pauses multiples, heures par jour, épingle, durée, retirer, ajouter, pause du jour, groupe défait, débordement avec épingle). Chaque règle a été cassée sur copie, et le contrôle l'a vue.
- `tests/workday.test.js` : 21 tests ; serveur : 503 tests au total.
- Navigateur (`essai-navigateur-2.2.cjs`) tout vert : réglages complets, glisser-déposer réel à la souris, clavier, plan accepté puis refait, densité compacte (aperçu et grille).

**Reste.**
- Pas vérifié sous Windows à la main (glisser au pavé tactile).
- Les champs d'heure suivent le format du système (12 h sur un Windows en anglais).

## 2.3.0 — Les rappels (17 octobre 2026)

**Changé.**
- **« Me le rappeler »** dans le détail d'une tâche : dans 1 h, ce soir, prochain matin (selon les heures du jour), 15 min avant (si la tâche a son heure), ou une date et heure précises. La carte de la tâche montre 🔔 et l'heure.
- **Rappels automatiques** (Réglages › Au quotidien › Rappels) : avant une tâche qui a son heure (10 min par défaut, de 0 à 60) ; résumé du jour au début des heures ; annonce de chaque bloc du plan accepté.
- **Livraison** : notification Windows (un clic ouvre Clarity sur la tâche) et carte dans la fenêtre avec Fait / Dans 10 min / Demain / Ouvrir. Les cartes survivent à un rechargement, sans doublon.
- **Le serveur décide ce qui est dû** (`src/rappels.js`) et note chaque rappel donné (`reminderLog`, une semaine) : jamais deux fois, même après un redémarrage. Plus de 12 h de retard (ordinateur éteint) : noté, pas donné.
- Remplace l'ancienne notification d'échéance, qui revenait à chaque lancement.

**Pourquoi.** Lot « rappels » choisi le 17 octobre, premier des trois.

**Vérifié.**
- `tests/rappels.test.js` : 11 tests (échéance, une seule fois, déplacé = nouveau, retard, terminé, avant l'heure, résumé du matin, jour non travaillé, heures du jour, journal).
- `verifier-rappels` : 9 cas.
- Serveur : 514 tests.
- Navigateur (`essai-navigateur-2.3.cjs`) tout vert : résumé, « bientôt », rappel posé depuis le détail, échu, Dans 10 min, Fait, bloc du plan une seule fois, réglages, refus d'une date impossible.
- Corrigé en route : un bloc était noté « donné » avant le chargement des tâches, donc jamais montré.

**Reste.**
- Pas vérifié sous Windows : le clic sur la notification système (Electron) qui ouvre la tâche.
- Les rappels ne partent que si Clarity tourne (fenêtre ou icône près de l'horloge).

## 2.4.0 — L'ordre à la main, et des cartes qui bougent (18 octobre 2026)

**Changé.**
- **Glisser une tâche** dans Boîte de réception (et les listes d'Aujourd'hui : « Pour aujourd'hui », « En retard ») : elle suit la souris, les autres lui font de la place. Au clavier : Alt + ↑/↓.
- **Ce que veut dire un dépôt** (`dropPlan`, lib/ordre.js) :
  - un rang pour chaque tâche du niveau, dans le nouvel ordre ;
  - déposée parmi les tâches d'un autre niveau, la tâche prend ce niveau, et le message le dit ;
  - une tâche qui en attend une autre reste après elle, et le message le dit ;
  - « Annuler » remet tout comme avant.
- **L'ordre** (lib/ordre.js) : le rang donné à la main passe avant le rang de l'assistant, mais jamais au-dessus d'un niveau ni d'un blocage. Une tâche nouvelle mène encore son niveau.
- **Mouvement** : quand l'ordre change, pour quelque raison que ce soit, chaque carte glisse de son ancienne place à la nouvelle (FLIP). Désactivé si le système demande moins d'animations.
- **Serveur** : champ `rank` (nombre ou null), validé.

**Pourquoi.** Lot « ordre et mouvement », deuxième des trois choisis le 17 octobre.

**Vérifié.**
- `verifier-ordre` : 36 cas (12 nouveaux). Mutations : chaque règle a été cassée sur copie et le contrôle l'a vue. Une condition s'est révélée inutile : retirée.
- Serveur : 514 tests.
- Navigateur (`essai-navigateur-2.4.cjs`), tout vert :
  - glisser à la souris, avec la place qui s'ouvre ;
  - rangs enregistrés, Annuler ;
  - changement de niveau, blocage respecté, Alt + ↑ ;
  - cartes animées, listes d'Aujourd'hui.

**Reste.**
- Glisser au pavé tactile sous Windows : pas vérifié à la main.
- La liste filtrée par une recherche se glisse aussi : les tâches cachées du même niveau gardent leur rang.

## 2.5.0 — Prête pour d'autres que nous : sécurité, import, aide, accessibilité (18 octobre 2026)

**Changé.**
- **Clé de la fenêtre** (`backend/src/security/jeton.js`) :
  - Electron tire une clé au hasard à chaque démarrage et la donne au serveur (`CLARITY_API_TOKEN`) et aux fenêtres (preload) ;
  - toute requête vers `/api` doit la porter (`X-Clarity-Token`) ;
  - restent ouverts : les routes du connecteur IA (qui ont leur propre jeton), `/health` et `/version` ;
  - sans clé (développement, tests) : rien n'est vérifié.
- **Politique de sécurité (CSP)** dans la page : scripts de l'app seulement, appels vers le serveur local seulement, rien chargé d'Internet.
- **Import** (Réglages › Données) : export Clarity, export CSV de Todoist (sa priorité 1 devient Très haute ; une date en toutes lettres va dans la note), tout CSV avec une colonne « titre », ou une liste (une tâche par ligne, « [x] » = terminée). Un aperçu d'abord ; ce qui existe déjà n'est pas importé deux fois ; 2 000 au plus, 5 Mo au plus.
- **Aide** (Réglages › Aide) : 9 questions fréquentes, et la visite.
- **Accessibilité** (axe-core, WCAG 2.1 A/AA, 8 écrans, clair et sombre) : de 5 règles graves à 0.
  - Chaque champ et chaque interrupteur ont un nom.
  - Textes secondaires renforcés : `ink60` passe de 3,9:1 à ≥ 4,5:1 et `ink40` de 2,2:1 à ≥ 4,5:1 ; l'orange d'alerte et le vert sont plus sombres en clair.
  - 255 éléments en défaut de contraste au départ, 0 à la fin.
- **CI Windows** : une clé fixe par exécution, envoyée à chaque appel.

**Pourquoi.** Lot « sortie publique », troisième des trois choisis le 17 octobre.

**Vérifié.**
- Tests serveur : 534 (11 pour la clé, 9 pour l'import).
- Audit axe : aucun écart grave.
- Navigateur (`essai-navigateur-2.5.cjs`) tout vert :
  - sans clé : 401, et une page sans clé n'obtient rien ;
  - avec la clé : tout passe ;
  - CSP présente et jamais déclenchée ;
  - import Todoist avec aperçu et doublon détecté ;
  - Aide.
- Page construite chargée en `file://` : affichée, aucun blocage CSP.

**Reste (décisions et preuves hors de portée de la session).**
- **Signature du code** : Windows SmartScreen avertit tant que l'installateur n'est pas signé. Il faut choisir un certificat : Azure Trusted Signing (environ 10 $/mois) ou un certificat classique (200 à 400 $/an). Décision et achat : propriétaire.
- **Synchronisation entre deux PC** : pas éprouvée sur deux vraies machines.
- **Electron** : clé et CSP vérifiées dans le navigateur, et par la CI pour le serveur. La fenêtre Electron elle-même n'a pas été ouverte à la main.

## CI : règles du dépôt privé (29 octobre 2026)

**Changé.**
- `qualité` ne part plus à chaque envoi de branche : push sur `main` seulement (si `app/` ou les workflows changent), ou à la main.
- Le job `windows` ne tourne qu'à la main : c'est la vérification d'une branche avant fusion. Fusion en avance rapide, donc `main` reçoit le commit déjà vérifié ; le push sur `main` relance Linux seul.
- `ancienne-version` à la main, case « ancienne » cochée : il teste la version publiée, pas le commit.
- Délais des jobs ramenés à la mesure : `windows` 60 → 30 min, `ancienne-version` 25 → 15 min.
- Coût écrit en tête de `ci.yml` : ≈ 290 min/mois, publications comprises.

**Pourquoi.** Clarity redevient privé le 1er novembre ; chaque minute comptera dans le quota partagé (épuisé le 8 octobre), Windows double.

**Vérifié.** Durées mesurées sur la CI du 15 octobre (controles 1 min, windows 7,5 min, ancienne-version 3 min). YAML relu : déclencheurs et conditions des trois jobs. Passage lancé à la main sur la branche, puis push sur `main` : voir l'état dans le compte rendu de la session.

**Reste.** Passer le dépôt en privé le 1er novembre (réglage GitHub, propriétaire).

## 2.6.0 — Lot A : les corrections du 29 octobre

**Changé.**
- Réglages s'ouvre sur Compte (Apparence était codé en dur).
- Boîte de réception : l'animation des cartes (FLIP) mesurait par rapport à la fenêtre, pas à la liste ; après un défilement, chaque rafraîchissement de 5 s faisait glisser toutes les cartes. Mesuré : 84 glissements en 11 s avant, 0 après. Un rafraîchissement sans changement ne redessine plus rien.
- Sujets : « perso » = « Perso » (le serveur range une étiquette sous l'orthographe déjà utilisée, `src/topics.js`) ; le compteur ne compte que les tâches à faire ; renommer (fusionne avec un sujet existant) et retirer un sujet, les tâches restent. `updatedAt` posé sur chaque tâche touchée, sinon la synchro ne l'enverrait pas.
- Sous-tâches modifiables dans le panneau : titre, notes, date, ajout en ligne, suppression. Le panneau d'un sujet n'ouvre plus la fenêtre complète.
- « Clarity suggère » plus calme : une par jour par défaut (au lieu de 6) ; un profil resté sur les anciens réglages passe au nouveau, un réglage choisi reste ; jamais par-dessus une fenêtre ouverte ; après une tâche terminée ; notification Windows seulement si Clarity n'est pas au premier plan ; dans le panneau, une suggestion à la fois, figée tant qu'il est ouvert. Le mode se choisit enfin dans Réglages › Suggestions.

**Vérifié.**
- Serveur : 550 tests (16 nouveaux).
- Contrôles du frontend : tous verts.
- Navigateur (`essai-navigateur-2.6.cjs`) : 24 vérifications vertes. L'essai a trouvé un défaut : deux sous-tâches tapées vite, la seconde effaçait la première ; corrigé.
- Mutations : l'ancien FLIP (84 glissements), l'ancien compteur de sujet et l'ancienne page de Réglages sont vus par l'essai. Le contrôle de Réglages ne voyait rien au départ : il lisait un texte présent sur toutes les pages ; resserré, puis revu contre la bonne ligne (la remise à zéro en quittant Réglages, pas l'état initial).
- Les essais 2.4 (glisser) et 2.5 (clé, import, aide) rejoués : verts. Le 2.5 a trouvé un défaut de ce lot : la route d'import lisait `data` au lieu de `r.data`, chaque import échouait. Corrigé avant publication ; aucun test serveur ne le voyait.
- Nouveautés 2.6.0 : « Des sujets en ordre », « Clarity, plus discrète » (visite vérifiée, 38 étapes).

**Reste.** Glisser au pavé tactile et notification Windows : pas vérifiés à la main.

## 2.7.0 — Lot D : les rituels du jour (29 octobre 2026)

**Changé.**
- **Planifier ma journée** (proposé le matin, jamais imposé) : ce qui reste d'avant → aujourd'hui / demain / plus tard / un jour ; aujourd'hui, avec la capacité (estimations corrigées par l'écart mesuré, contre les heures de travail encore libres) et « ça déborde » ; des tâches sans date à tirer vers aujourd'hui ; une fois par mois, « Un jour ».
- **Terminer ma journée** : ce qui est fait, puis une place pour ce qui ne l'est pas.
- **Tâches rapides** (`quick`) : « courses 17h » depuis Aujourd'hui ; ni niveau ni difficulté ; hors analyse, suggestions et fils de suivi ; leur propre liste.
- **Un jour** (`someday`) : page à part, hors d'Aujourd'hui, de la Boîte de réception, du plan, des sujets, des compteurs, de l'analyse et du report automatique. Depuis le détail ou le clic droit.
- **Vider sa tête** : tout écrire, une ligne par tâche (la grammaire de saisie garde jours, heures, sujets), trier, créer.
- `lib/rituels.js` pur, `verifier-rituels.mjs` (26 cas) dans `qualite.json` et la CI.

**Pourquoi.** Cible validée (« finir sa journée ») ; c'est ce que les avis Sunsama citent.

**Vérifié.**
- Serveur : 553 tests (3 nouveaux : « Un jour » et tâches rapides ne reviennent ni en suggestion, ni en tâche bloquée, ni en report).
- Navigateur (`essai-navigateur-2.7.cjs`) : vert. Mutations : sans le filtre « Un jour », sans « ça déborde » → 3 écarts vus. 2.4 et 2.6 rejoués : verts.

**Reste.** Blocs de temps contenant des tâches (images 6 à 8) : pas fait. Les marques « plan fait / journée terminée » sont par appareil (localStorage), pas synchronisées.

## 2.8.0 — Lot B : une sous-tâche, une page (29 octobre 2026)

**Changé.**
- Cliquer une sous-tâche ouvre sa page à droite ; la tâche glisse à gauche (option A choisie par le propriétaire, d'après son dessin). Une autre sous-tâche remplace la page ; Échap ferme la sous-tâche, puis la tâche.
- Une sous-tâche a désormais date, niveau, statut, difficulté, titre, notes. `done` reste lu partout ; `status` le suit (`lib/sousTaches.js`).
- « En faire une tâche » : nouvelle tâche avec tout ce qu'avait la sous-tâche, les sujets de sa tâche, un lien « liée à » vers elle.
- Sélecteurs de niveau et de difficulté réutilisés (`onChange`), pas recopiés.

**Vérifié.**
- `verifier-sous-taches.mjs` : 15 cas, dans `qualite.json` et la CI.
- Navigateur `essai-navigateur-2.8.cjs` : vert. Mutation (la tâche ne glisse plus) : 2 écarts vus. 2.4, 2.6 (adapté : la sous-tâche s'ouvre en page), 2.7 : verts. Serveur : 553 tests.

**Reste.** Écran étroit (< 1100 px) : les deux panneaux mangent la liste ; pas traité.

## 2.9.0 — Lot C′ : sujets proposés, nouvelle séance (29 octobre 2026)

**Changé.**
- Étiquettes : pendant la frappe, les sujets qui existent sont proposés (formulaire et Ctrl+K « #pe » → #Perso). Un sujet connu tapé garde son orthographe. Choisir une proposition dans Ctrl+K fait de la ligne une nouvelle tâche.
- Focus : la séance dépassée, « Nouvelle séance » relance le compte (séance 2…) ; le temps suivi n'est pas touché.
- Formulaire : Échap le ferme où que soit le curseur (avant, seulement si le curseur était dedans — vu par l'essai).
- `suggestTopics`, `knownSpelling` (`lib/sujets.js`) ; `verifier-sujets.mjs` (10 cas).

**Vérifié.** Essai navigateur 2.9 vert ; 2.4, 2.6, 2.7, 2.8 verts ; serveur 553 tests ; tous les vérificateurs verts. CI Windows verte avant publication.

**Reste.** Blocs de temps contenant des tâches ; écran étroit.

## Tâche 2 — écran étroit (29 octobre 2026, non publiée)

**Changé.**
- Fenêtre de moins de 1 100 px : la page d'une sous-tâche se pose par-dessus celle de sa tâche, qui reste au bord droit. Avant, la tâche glissait à gauche et les deux pages (720 px) mangeaient la liste. Au-delà de 1 100 px, rien ne change (2.8.0).
- Le fil « tâche › Sous-tâches » en haut de la sous-tâche devient un bouton « ‹ » qui ramène à la tâche — seul chemin visible quand la tâche est cachée dessous. Échap fait toujours la même chose.
- `hooks/useNarrow.js` (`NARROW_BELOW = 1100`, suit le redimensionnement).

**Vérifié.** Essai navigateur `essai-navigateur-etroit.cjs` : 10 contrôles verts (1000 px, retour, 1400 px, rétrécir sous-tâche ouverte, Échap). Mutation (la tâche glisse encore en étroit) : 4 écarts vus. 2.8 vert. Serveur : 553 tests. Vérificateur de langues : aucun écart.

**Reste.** Part avec la prochaine version publiée (pas de publication seule, minutes CI). Blocs de temps.

## Tâche 5 — vérifications restées ouvertes (29 octobre 2026, non publiée)

**Vrai fichier .ics : mesuré, cinq défauts.** Fixture façon export Agenda Google (`tests/fixtures/google-export.ics` : CRLF, lignes pliées, fuseau, alarme dans l'événement, séries, exception, annulé). Lecteur d'avant, semaine du 2 novembre :
- titre long plié sur deux lignes → coupé (« …carte d'ass ») ; `\,` affiché tel quel ;
- événement `STATUS:CANCELLED` affiché ;
- fin de semaine au chalet (ven. 20 h → dim. 12 h) : samedi et dimanche absents ;
- **toute réunion répétée (RRULE) invisible après sa première occurrence** — le pire : une réunion hebdomadaire n'apparaissait jamais dans le plan du jour.

**Changé** (`src/calendrier.js`, toujours pur) : dépliage, échappements, alarmes ignorées, annulés retirés, plusieurs jours (chaque jour sa part), séries DAILY/WEEKLY/MONTHLY/YEARLY avec INTERVAL, COUNT, UNTIL, BYDAY (dont « 2e mardi », « dernier vendredi »), BYMONTHDAY, BYMONTH, EXDATE, occurrence déplacée ou annulée (RECURRENCE-ID). Toujours non lus : événements journée entière (choix : un congé ne bloque pas d'heures) ; heure TZID prise telle quelle (fuseau du calendrier supposé = celui du PC).

**Vérifié.** `tests/calendrier.test.js` : 14 tests (8 neufs). Mutation (sans dépliage ni séries) : 6 échecs. Serveur : 561 tests.

**Analyse par le modèle local : toujours pas vérifiée.** Installer Ollama dans la session a été refusé (script externe). Reste à regarder sur le PC du propriétaire : lancer l'analyse avec quelques tâches, vérifier que chaque carte reçoit une phrase et un plan.

## Tâche 3 — la vraie fenêtre Electron, en CI (29 octobre 2026, non publiée)

**Pourquoi.** Tout passait par Chromium ou par l'API ; la fenêtre Electron elle-même (preload, clé, CSP sous `file://`, notification système) n'avait jamais été ouverte que par une personne (reste de la 2.3 et de la 2.5).

**Changé.** `app/tools/essai-electron.cjs` lance `electron .` comme `npm start`, backend compris, dans un dossier de données jetable, et pilote la fenêtre (Playwright `_electron`). Dans `controles` (Linux, xvfb, `--no-sandbox`), après le contrôle de `dist/`. Notifications et liens sortants enregistrés au lieu d'être montrés (pas de démon de notification ni de navigateur sur un runner).

**Vérifié, 19 contrôles verts** :
- page en `file://`, pont `window.clarity`, aucun accès à Node depuis la page ;
- clé tirée au hasard, 401 sans elle, la page la joint à chaque appel ;
- CSP présente, script injecté refusé, rien d'autre refusé ;
- rappel échu → notification qui nomme la tâche → clic → la tâche s'ouvre ;
- glisser à la souris met Gamma en haut, rang enregistré ;
- `location.href` vers le web refusé, lien confié au navigateur du système.
Mutation (le preload ne donne plus la clé) : 3 écarts puis arrêt. Étape CI rejouée en local telle quelle : verte, aucun fichier suivi modifié.

**Trouvé en route.** `POST /api/tasks` ignore `reminder` : seul `PUT` le prend (le panneau fait ainsi, donc rien de cassé pour l'utilisateur ; l'essai fait de même).

**Reste.** Coût CI : `controles` ≈ 1 → 3 min (estimé, à remesurer au premier passage). Toujours à la main sous Windows : vraie bulle de notification Windows, glisser au pavé tactile.

## Tâche 4 — rappels même fenêtre fermée (29 octobre 2026, non publiée)

**Lu avant d'écrire.** Démarrer avec Windows existait déjà (`--background` : fenêtre cachée, qui réclame les rappels). Deux vrais trous :
- **Un rappel manqué disparaissait.** Plus de 12 h de retard (PC éteint, Clarity fermée) : noté « donné », jamais montré.
- **L'interrupteur de démarrage** était rangé sous Réglages › Démarrage, loin des rappels qui en dépendent, et éteint par défaut.

**Changé.**
- `claimList` (`backend/src/rappels.js`, pur) : les rappels de tâche manqués dans la dernière semaine reviennent en **une seule** carte « Pendant que Clarity était fermée » (pas une rafale au démarrage) ; un seul manqué → la carte ouvre sa tâche. Plus d'une semaine : toujours muet.
- Réglages › Rappels : « Démarrer avec Windows » (même entrée de démarrage que Réglages › Démarrage), visible là où on règle les rappels.

**Vérifié.** `tests/rappels.test.js` : 16 (5 neufs). Mutation (manqués rendus muets) : 3 échecs. `essai-electron.cjs` : 22 contrôles, dont rappel manqué → notification à part + carte. Serveur : 566. Langues : aucun écart.

**Reste.** Le démarrage avec Windows reste éteint par défaut : l'allumer d'office serait décider à la place de la personne. Sur Linux, l'interrupteur n'apparaît pas (non pris en charge).

## 2.10.0 — publication des tâches 2, 3, 4, 5 (29 octobre 2026)

Version, `update.news` (deux langues), `docs/cible.md` (section 2 : rappels et .ics **Fait** en 2.10.0 ; décision). Page de téléchargement : texte validé le 29 oct., part avec cette version. CI branche verte (Windows compris) avant fusion.

## Ce que ce journal n'a pas le droit de cacher

Les quatre points ouverts sont dans `BACKLOG.md` § 4, et aucun n'est masqué ici :
pas de lanceur de tests côté frontend, `generateJSON` qui ne diffuse pas,
l'installateur NSIS jamais produit, et le biais par domaine qui ne rapporte que
`under`.

Deux habitudes expliquent la plupart des corrections ci-dessus, et méritent
d'être nommées parce qu'elles ont démenti trois de mes propres hypothèses :

**Mesurer avant d'affirmer.** `num_ctx`, les sources en CRLF, la tuyauterie du
profil — trois fois j'avais tort, et c'est la mesure qui l'a dit, pas la
relecture.

**Casser le garde pour voir s'il mord.** Un contrôle qui n'a jamais échoué n'a
jamais rien prouvé. Deux des défauts de cette liste étaient masqués par le garde
même qui devait les attraper.
