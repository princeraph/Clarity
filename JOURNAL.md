# Clarity — journal

Ce que le projet a traversé, dans l'ordre, avec les chiffres mesurés plutôt
qu'estimés. Trois fichiers se partagent le travail et ne se recouvrent pas :

- `README.md` — ce qu'est Clarity et comment le lancer
- `CONTRIBUTING.md` — les règles pour y toucher
- `BACKLOG.md` — ce qui reste ouvert
- **ce fichier** — ce qui a été fait, et ce que ça a appris

---

## État au 4 octobre 2026

    dépôt            princeraph/clarity (privé) · branche de production : main
    tests backend    233, en 11 suites — 1,5 s
    contrôles        4, déclarés dans app/qualite.json
    intégration      .github/workflows/ci.yml, verte
    build requis     aucun — frontend/dist/ est versionné, l'app tourne d'un clone nu

Les quatre contrôles, reproductibles tels quels :

```bash
cd app/backend  && npm install && npm test        # 233 tests
cd app          && node tools/verifier-paquet.mjs frontend/dist
cd app/frontend && node tools/verifier-locales.mjs    # 2 langues, 555 clés, 33 fichiers
cd app/frontend && node tools/verifier-saisie.mjs     # 23 cas, 2 langues
```

---

## Août 2026 — le projet n'était pas rangé

Clarity vivait dans un dépôt multi-projets, sous `projet-clarity/`. Le ranger a
cassé trois choses d'un coup, et c'est la leçon qui a le plus servi ensuite :

1. Six lanceurs Windows citaient `%USERPROFILE%\Personal-Work\projet-clarity\app`
   **en dur**. Ils se repèrent maintenant par rapport à eux-mêmes (`%~dp0`,
   `$PSScriptRoot`, `ScriptFullName`) — insensibles au renommage **et** au
   clonage ailleurs. Vérifier qu'un chemin absolu reste juste est plus faible que
   ne pas en avoir.
2. `CLAUDE.md` était à la racine et décrivait le dépôt entier alors qu'il ne
   parlait que de Clarity.
3. Les références de design étaient mêlées au code de l'application
   (`design-handoff/` depuis).

## 11–12 septembre — fermer les portes avant d'ajouter des pièces

La spécification et le code ne disaient pas la même chose ; la spec a été remise
d'accord avec le code, pas l'inverse. Puis six défauts qui n'attendaient qu'un
usage réel :

- une **seule** requête mal formée pouvait tuer le backend **et effacer les
  tâches** — le `PUT` acceptait n'importe quel corps et réécrivait le fichier ;
  il est désormais restreint aux champs que le client a le droit de changer
- le minuteur continuait après qu'on avait quitté la tâche, et se relançait seul
- l'API écoutait tout le réseau local — elle n'a **aucune authentification** et
  détient un profil personnel. Fermée à `localhost`, deux instances interdites
- Electron et electron-builder flottaient sans version figée
- un bouton « tout effacer » ne détruisait rien, et deux liens pointaient dans le vide
- vider ses tâches ne vidait pas ce qu'on en avait déduit

Les quinze tests du backend de l'époque ont été branchés sur la barrière : un
test qui ne tourne pas n'est pas un test.

**Le sélecteur de langue proposait huit langues et n'en implémentait aucune.**
Le vrai défaut n'était pas la traduction manquante : c'est que rien dans la
construction ne distinguait « traduit » de « prétend l'être ».
`verifier-locales.mjs` fait cette distinction et refuse une langue à moitié
faite. Deux langues complètes, 555 clés.

## 13 septembre — « le modèle local est lent » était une erreur de diagnostic

Mesuré sur la machine réelle, avec `gemma4` :

    chargement   ~9 000 ms
    écriture     66 à 95 jetons/s
    lecture      ~2 500 jetons/s

Le modèle n'est pas lent : **le chargement l'est**. À 80 jetons/s, neuf secondes
de chargement valent plus de 700 jetons écrits.

Quatre causes, dont une de mon fait :

1. `keep_alive` n'était jamais envoyé — Ollama décharge après cinq minutes
   d'inactivité, et Clarity s'utilise par à-coups : presque chaque requête
   repayait les neuf secondes.
2. **`num_ctx` était calculé par appel.** C'était ma correction, et la mesure
   l'a démentie : `num_ctx` fait partie du CHARGEMENT du modèle. Le faire varier
   évince le modèle résident et le recharge — 8 à 9 s, sur les appels mêmes
   qu'on voulait accélérer. Une seule valeur partout (8192).
3. Aucun préchauffage au démarrage.
4. La sortie demandée n'était bornée par rien : un paragraphe de raisonnement et
   un plan en trois étapes pour **chaque** tâche.

Re-mesuré après correction, même machine, même séquence de quatre appels :
**17,3 s de rechargements disparus**. La ligne « prompt long, sortie courte » —
la forme même de l'analyse — passe de 9 840 ms à 687 ms. Ce qui reste est du
vrai travail de génération, et aucun réglage n'y changera rien.

Les douze tâches candidates à « la prochaine » sont choisies par échéance, donc
par arithmétique — **jamais par un modèle**.

## 13 septembre — l'extraction

Clarity est sorti du dépôt multi-projets par `git subtree split`, avec son
historique complet. La raison est une raison de confidentialité, pas de
rangement : le dépôt d'origine est privé **parce qu'il contient des données
personnelles**. Y inviter un relecteur, c'est lui
donner tout ça. Ici, on peut ouvrir Clarity sans ouvrir le reste.

Le crochet `pre-push` du dépôt parent a refusé ce push, et à juste titre de son
point de vue : il ne lisait que la branche visée, jamais le distant. Pousser
Clarity vers `refs/heads/main` d'un **autre** dépôt lui ressemblait exactement à
un push vers son propre `main`. Il a donc passé cinq minutes à vérifier des
projets que l'opération ne touchait pas, puis refusé sur leur état. Corrigé là-bas.

## 17 septembre — l'installation, puis trois défauts enchaînés

**L'installation.** `setup.bat` annonçait « Setup complete! » après l'échec de
sa dernière étape : `generate-icon.js` appelle `rsvg-convert`, qui n'existe pas
sous Windows, et le conseil affiché parlait d'`apt-get`. Les icônes étaient déjà
versionnées — l'étape ne servait à rien. Pire, la même commande était la
**première** d'une chaîne `&&` dans `npm run setup` : rien ne s'installait du
tout. Les deux appels retirés, étapes renumérotées.

Plus net encore : l'installation **reconstruisait** `frontend/dist/`, un dossier
versionné exprès. Le dépôt devenait sale au premier `npm run setup`, et le
`git pull` suivant était refusé. Une préparation ne doit jamais régénérer un
artefact versionné.

**Le piège suivant était un retour à la ligne.** `dist/index.html` différait de
quatorze lignes sans qu'un octet de contenu ait changé. Une règle existait déjà
dans `.gitattributes` — `dist/** -text` — et visait juste, **dans la mauvaise
direction** : `-text` force la comparaison octet par octet, donc *fait surgir*
l'écart au lieu de l'absorber. J'ai d'abord soupçonné des sources en CRLF ;
le test l'a démenti avant que j'agisse dessus. `dist/index.html text eol=lf`.

**Les trois défauts enchaînés.** La mesure phare du profil — « vous finissez en
tant de fois le temps prévu » — était inatteignable, pour trois raisons qui se
tenaient en série :

1. **La durée estimée n'avait aucun champ dans le formulaire.** Rien dans
   l'interface ne permettait de renseigner ce que toute la chaîne attendait.
2. **La saisie rapide (Ctrl+K) plantait à l'ouverture** — `ReferenceError: t is
   not defined`. Vérifié sur `main` avant ma modification : **le défaut était
   déjà livré**, Ctrl+K n'avait jamais pu s'ouvrir. Et le garde écrit pour
   attraper exactement ça était aveugle : son motif exigeait la parenthèse
   fermante sur la même ligne, donc un composant dont les props sont
   déstructurées sur plusieurs lignes n'était pas vu comme une fonction, et son
   corps était rattaché au voisin — qui, lui, avait le `useLocale()`. Le garde
   voyait un crochet et se taisait. Il rapportait « Aucun écart ». C'est la pire
   forme d'échec : celle qui annonce un succès.
3. **Le biais « over » ne disait jamais rien.** Des trois issues
   (`under`, `over`, juste), une seule était écrite.

Les trois corrigés, la boucle se ferme, mesurée de bout en bout : cinq tâches
estimées à 60 min et chronométrées produisent le constat attendu, avec sa
confiance et sa preuve. Avant : zéro constat sur les mêmes données.

**Et une erreur à moi que seuls les vrais tests ont attrapée.** Le champ
d'estimation portait `step="5"`. Les huit tests de conversion passaient tous.
Mais la validation HTML5 refuse une valeur non multiple du pas **et bloque
silencieusement l'envoi du formulaire** : saisir `2` (= 2 heures) ne faisait
rien du tout. Trouvé dans un vrai navigateur, contre un vrai backend, pas en
test. `step="any"`.

J'ai aussi perdu vingt minutes à croire la tuyauterie cassée en lisant
`understanding.insights` — un champ qui n'existe pas. `understanding` est
structuré **par catégorie** : `traits`, `drivers`, `blockers`, `strengths`,
`skills`, `context`.

## 18 septembre — le dépôt ne disait pas où il en était

Trois sessions de travail n'apparaissaient nulle part dans la documentation.
`README.md` a reçu ses prérequis manquants (Node 18+, Ollama, `gemma4`),
`CLAUDE.md` trois règles tirées des défauts ci-dessus, `BACKLOG.md` l'état réel.

## 1er octobre 2026 — la documentation ne décrivait plus ce dépôt

Le dépôt parent a supprimé son dossier `projet-clarity/`, retiré les deux
invariants qui le citaient et consigné le départ. Côté Clarity, sept endroits
décrivaient encore un monde disparu :

- `CLAUDE.md` affirmait que l'app vit dans `projet-clarity/app/` et que
  « le dépôt héberge plusieurs projets sans rapport » — faux, et trompeur pour
  un relecteur dès la troisième ligne
- `CLAUDE.md` décrivait encore `npm run setup` comme construisant le frontend et
  générant les icônes, deux étapes retirées la session d'avant
- `README.md` faisait pointer les chemins de `CLAUDE.md` vers `projet-clarity/app/`
- l'en-tête de `ci.yml` se déclarait « inerte », ce qu'il n'est plus
- `mesurer-modele.mjs` disait de se lancer depuis `projet-clarity/app/backend`
- `qualite.json` annonçait 203 tests là où il y en a 205
- **et `CONTRIBUTING.md` donnait une commande `git subtree pull` pour « remonter
  les corrections » vers le dépôt parent.** Celle-là n'était pas seulement
  périmée : la suivre recréerait Clarity dans le dépôt privé, annulant sans
  rien dire la seule raison de l'extraction. Remplacée par ce qu'elle était
  devenue — un avertissement.

Les mentions de `projet-clarity/` qui **racontent le passé** sont restées, parce
qu'elles sont exactes : l'extraction dans `BACKLOG.md`, les chemins en dur des
lanceurs dans `CONTRIBUTING.md`, et la note de `CLAUDE.md` qui explique pourquoi
l'historique d'avant l'extraction dit `projet-clarity/app/` là où ce dépôt dit
`app/`.

## 2 octobre 2026 — un audit extérieur, vérifié avant d'être appliqué

Un audit a relu le dépôt et livré un correctif pour trois défauts. Chacun a été
reproduit **avant** d'être corrigé :

- **N'importe quelle page web pouvait lire les tâches** (rebinding DNS). L'API
  écoute sur `127.0.0.1` et refuse les origines étrangères — mais un domaine
  hostile peut se faire pointer vers 127.0.0.1, ses requêtes deviennent alors
  de même origine, et un GET de même origine n'envoie pas d'`Origin`. Mesuré :
  `Host: evil.example:3001` → **200**. Corrigé par une liste de `Host` admis,
  avant toute route : **403**. Garde cassé exprès, un test échoue ; rétabli,
  13/13.
- **L'installateur aurait lancé le backend avec le Node de l'utilisateur** —
  donc, sur un PC normal, avec rien. Il prend maintenant le binaire d'Electron
  en mode Node.
- **L'installateur aurait livré le backend sans ses dépendances.** Reproduit
  avec l'ancienne disposition : `Cannot find package 'express'`. Le backend est
  désormais préparé à part, dépendances de production seules, et le script
  échoue si `express` manque ou si `jest` s'y glisse. Vérifié : ce paquet,
  lancé par le binaire d'Electron, sert `/api/tasks`.

Les deux derniers n'avaient jamais été vus pour une raison simple : aucun
installateur n'avait jamais été construit. Un emballage jamais essayé cache ses
défauts.

**Ce que l'audit n'avait pas vu, et qui était pire.** Son correctif gardait une
porte ouverte — une variable `CLARITY_ALLOWED_HOSTS` « pour le flux ngrok
documenté ». En remontant à ce flux : `app/README.md` disait de lancer
**`ngrok http 3001`**, c'est-à-dire de publier sur une URL publique l'API sans
authentification qui détient les tâches, le profil et le journal. Le même texte
confondait deux usages — le vrai réglage de tunnel sert à joindre un Ollama
**distant**, dans l'autre sens — et ne pouvait de toute façon pas marcher :
l'interface appelle `http://localhost:3001`, qui sur un téléphone est le
téléphone. La porte est retirée, la section réécrite pour le seul usage réel,
avec un avertissement : ne jamais tunneler le port 3001.

**Première construction réelle, sous Windows.** L'installateur a été produit —
`Clarity Setup 1.2.0.exe` — puis la commande a échoué à sa dernière étape :
`Cannot read properties of null (reading 'provider')`. La configuration
déclarait une publication des versions sur GitHub, sans dépôt que
`electron-builder` puisse retrouver depuis `app/`, et sans mise à jour
automatique pour s'en servir. Reproduit ici, corrigé par `"publish": null`, et
reconstruit jusqu'au bout. Dans le paquet obtenu, le backend lancé par le
binaire du paquet lui-même sert les tâches, refuse un Host étranger, et
n'embarque pas `jest`. Au passage : le dossier de sortie `dist-electron/` n'était
pas ignoré par git — cent mégaoctets prêts à être commités par erreur.

**Puis installé et lancé, sous Windows 11 Famille.** Reconstruit sans erreur,
installé « pour moi seul », ouvert. Windows dit quel programme tient le port
3001 : **`Clarity.exe`**, pas `node.exe`. La preuve est choisie exprès : ce PC a
Node installé, et sept `node.exe` d'autres programmes tournaient pendant le
test. « Aucun `node.exe` » n'aurait rien prouvé ; l'identité du processus qui
sert l'API, si. Le lancement empaqueté marche donc sans le Node de la machine.

Ce que ce test ne couvre pas, et qu'il faudra voir avant de confier
l'installateur à quelqu'un : un Windows vierge (SmartScreen sur un fichier
téléchargé, aucune trace de développement), et Electron 28, toujours en
place.

## 2 octobre, suite — Electron 44, et une seule Clarity à la fois

**Electron 28 → 44, electron-builder 24 → 26.** Seules 42 à 44 reçoivent encore
des correctifs. La liste officielle des changements cassants de 29 à 44 a été
croisée avec chaque API qu'utilise Clarity : aucune n'est touchée. Puis vérifié
plutôt que supposé, en lançant la **vraie** app (Playwright pilote Electron) sur
les deux versions, mêmes données :

    même écran principal, 8 tâches, 2 fenêtres, pont preload actif
    Ctrl+K « Tester Electron demain ~30m » → tâche créée, échéance le
    lendemain, 30 min — identique sur 28 et sur 44
    218 tests du backend, sur le Node 24 embarqué par Electron 44

Deux pièges, trouvés par la mesure :

- **Depuis Electron 42, `npm install` ne télécharge plus Electron** : le premier
  lancement s'en charge. `Clarity.vbs` lance en fenêtre cachée — ce premier
  lancement aurait duré une à deux minutes sans rien montrer. L'installation
  appelle maintenant `npx install-electron`, là où l'on voit ce qui se passe.
- **electron-builder 26 a recréé le défaut du matin.** Il jette toujours un
  `node_modules` placé à la racine d'un `extraResources`, quel que soit le
  filtre : le paquet n'avait plus `express`. Aucune erreur — le contrôle
  vérifiait le dossier préparé, qui était complet. Une entrée séparée pour
  `node_modules` corrige, et un nouveau contrôle `afterPack` inspecte **ce qui
  sera livré** : retiré exprès, la construction échoue et nomme les trois
  paquets manquants.

**Une seule Clarity à la fois.** L'app installée et la version dev
s'appelaient `Clarity` et `clarity`. Le verrou d'instance unique dépend du nom :
mesuré, les deux tournaient ensemble, et la seconde utilisait en silence le
backend de la première — jusqu'à ce qu'elle se ferme. Même nom maintenant : la
seconde s'efface (0 s, contre « toujours en vie après 20 s » avant). Les deux
raccourcis du bureau portaient aussi le même nom, `Clarity.lnk` : le dernier
installé remplaçait l'autre. Celui de la version dev s'appelle désormais
`Clarity (dev)`.

**`Update.bat` met à jour les deux versions** : fermer Clarity, tirer les
nouveautés, reconstruire, réinstaller en silence. Il se copie d'abord hors du
dépôt : `git pull` peut le remplacer pendant qu'il tourne, et cmd reprendrait
alors au milieu du nouveau fichier. **Pas encore essayé sous Windows.**

**Confirmé sous Windows 11 Famille** : Clarity installée ouverte, `start.bat`
lancé — aucune seconde fenêtre. Le verrou d'instance unique couvre désormais
les deux versions.

**`Update.bat` essayé sous Windows, trois fois.** Il va au bout : attend la
fermeture de Clarity, construit avec Electron 44.5.1, le contrôle `afterPack`
passe, réinstalle en silence. Le troisième lancement a montré un défaut :
« Already up to date », puis tout reconstruit quand même — plusieurs minutes
pour rien. Il retient maintenant le commit installé et s'arrête s'il n'y a rien
de neuf, avant même de demander de fermer Clarity. Confirmé : relancé sans
nouveauté, il s'arrête en quelques secondes.

**Electron 44 confirmé sous Windows** : boutons de fenêtre (réduire, agrandir,
fermer vers la zone de notification), fenêtre du plateau, instance unique.

**Polices embarquées — la promesse du premier écran devient vraie.** « No
accounts, no cloud, no spying », disait-il, pendant que `index.html` chargeait
ses polices depuis Google à chaque lancement. Remplacées par les mêmes familles,
graisses et sous-ensembles, livrés dans l'app (+~390 Ko dans `dist/`). Mesuré
dans la vraie app : Geist et Geist Mono chargées, **zéro requête** hors de
l'app et de son backend. Le contrôle du paquet ignorait jusqu'ici les URL
externes ; il refuse maintenant toute ressource chargée d'Internet — le lien
Google remis exprès, il échoue et le nomme.

**Et la mise à jour suivante a été refusée — par ma faute.** `Update.bat`
lançait `npm run build`, qui reconstruit `frontend/dist/` avant d'empaqueter.
C'est exactement ce que la règle « une installation ne régénère jamais un
fichier versionné » interdit, écrite ici le 17 septembre pour `setup.bat`. Sous
Windows, la reconstruction ne rend pas les octets commités de `index.html` : le
dossier restait « modifié » sans bruit, jusqu'au premier `git pull` qui touchait
ce fichier — celui des polices. `Update.bat` empaquette désormais `dist/` tel
quel (`npm run package`), et prévient si une mise à jour laisse un fichier suivi
modifié, au lieu de le laisser découvrir à la suivante.

**La cause exacte, puis la règle qui manquait.** Le `git diff` de l'utilisateur
montrait une seule ligne : `<div id="root"></div>` terminée par un CRLF, au
milieu d'un fichier en LF. Git sous Windows extrayait la **source**
`index.html` en CRLF, et vite recopiait cette ligne telle quelle. Source
désormais extraite en LF partout.

Le constat de fond : chaque défaut propre à Windows de cette journée a été
trouvé par l'utilisateur, en pleine mise à jour, parce que rien ne tournait
sous Windows avant lui. La CI a maintenant un job `windows` qui rejoue les
étapes d'`Update.bat`, vérifie qu'aucun fichier suivi ne bouge, installe en
silence, lance le backend installé (200, et 403 pour un Host étranger), et
reconstruit `dist/` pour s'assurer qu'il est identique au versionné. Ce dernier
contrôle a d'abord reproduit la ligne en CRLF de l'utilisateur, puis est passé
au vert avec la correction. Rien n'est plus fusionné dans `main` avant ce
vert.

**Essayé sur un Windows sans outils de développement.** Installateur
téléchargé par un lien — comme un vrai utilisateur le recevrait, donc avec
l'avertissement SmartScreen d'une app non signée —, sur une machine sans Node,
sans Ollama, sans Git. Les six points de la liste passés : avertissement
contourné par « Exécuter quand même », installation « pour moi seul », premier
écran d'accueil (pas de fenêtre blanche), IA affichée hors ligne sans plantage,
tâche conservée après « Quitter » et réouverture, puis conservée après
désinstallation et réinstallation. C'était le dernier essai prévu avant de
confier l'installateur à quelqu'un ; la seule réserve est la signature.

**`npm audit` : 3 failles → 0 dans ce qui est livré.** `body-parser` et `qs`
corrigés par `npm audit fix` et Express 4.22.3 (même version majeure). `uuid`,
lui, ne se corrigeait qu'en changeant de version majeure — il a été **retiré** :
Clarity ne s'en servait que pour fabriquer des identifiants, ce que Node fait
seul (`crypto.randomUUID()`, même format). Une dépendance de moins à surveiller.
Les deux contrôles d'empaquetage citaient `uuid` dans une liste écrite à la
main ; ils lisent maintenant celle de `backend/package.json`. Vérifié : 218
tests, paquet complet sans `uuid`, et une tâche créée dans la vraie app reçoit
un identifiant au bon format.

Les autres propositions de l'audit sont dans `BACKLOG.md` § 4, avec ce
qu'elles protègent réellement — l'une d'elles y est rétrogradée : un jeton d'API
ne protège pas contre un programme du même compte, qui lit les fichiers
directement.

## 4 octobre — « 2 sur 5 » : le chemin vers le premier constat

Le constat phare du profil exige cinq tâches à la fois estimées et
chronométrées. Un nouvel utilisateur voyait « 0 sur 5 nécessaires » noyé en bas
de page, sans savoir lesquelles de ses tâches en approchaient.

En regardant les vraies données, un cas sautait aux yeux : les 8 tâches de
démonstration ont du temps chronométré mais **aucune estimation** — elles
comptent pour zéro, et rien ne le disait. C'est sans doute le cas le plus
courant chez un vrai utilisateur aussi.

La vue Tendances s'ouvre maintenant, tant qu'il n'y a pas de constat, sur une
carte : « 2 sur 5 », une barre, pourquoi cinq, puis **les tâches ouvertes
estimées mais jamais chronométrées** — lancer leur chronomètre suffit. Les
tâches chronométrées sans estimation sont **comptées, jamais proposées** : une
estimation écrite après coup, le temps déjà au compteur, n'en est pas une ; elle
tirerait chaque rapport vers 1 et apprendrait à l'utilisateur qu'il estime
bien. La carte le dit, et dit pourquoi Clarity ne la demande pas.

Le calcul est au backend (`estimationPending`, `OBSERVED_VERSION` 3 pour
invalider les profils en cache), avec trois tests ; le filtre « ouverte » retiré
exprès, un test échoue. Vérifié dans la vraie app, en anglais et en français :
2 sur 5, les deux tâches à un chronomètre près, aucune erreur.

**Deux phrases fausses, vues par l'utilisateur sur sa propre machine** — dans le
cas que je n'avais pas essayé : rien d'estimé, rien de chronométré. « Pour les
autres : … » s'affichait sans aucune liste au-dessus, et l'encadré voisin
annonçait « quatre sur cinq attendent des données » en n'en listant plus que
trois, puisque l'estimation était passée dans la carte. La première phrase a
désormais une variante sans liste ; la seconde ne contient plus de nombre écrit
en toutes lettres, il est calculé à partir des lignes affichées. Vérifié dans ce
cas précis : trois tâches, rien de mesuré, en français.

**Quatorze chaînes restaient en anglais en français.** En corrigeant le
paragraphe de Tendances signalé, une recherche du même défaut en a trouvé
treize autres : le bandeau « No connection… », « + Add Task » (deux vues),
« AI Assistant », « Analysis updated », « ✓ API key is saved », la légende du
graphe, la phrase de saisie rapide « Capture “…” as a new task », l'exemple de
l'accueil, un « or »… Toutes écrites directement dans le JSX, donc invisibles
pour le vérificateur de locales, qui ne regarde que ce qui passe par `t()`.
Toutes traduites, et le vérificateur cherche maintenant ce texte-là aussi —
une phrase remise en dur exprès, il la nomme avec sa ligne. Vérifié dans la
vraie app en français : plus aucune des chaînes anglaises à l'écran.

(Un faux pas en route : un test de mutation remis en place avec `git checkout`
a effacé les traductions non encore commitées d'un fichier. Refaites aussitôt ;
les tests de mutation passent désormais uniquement par une copie de sauvegarde.)

**La clé d'API et le secret du tunnel sont chiffrés.** Ils étaient écrits en
clair dans `settings.json` : quiconque copiait ce fichier, ou une sauvegarde,
les lisait. Ils sont maintenant chiffrés par Windows (DPAPI), liés au compte de
l'utilisateur. Le backend ne peut pas le faire lui-même — il tourne comme un
processus enfant, en mode Node — alors il le demande au processus principal
d'Electron par le canal IPC de l'enfant. Une clé en clair laissée par une
ancienne version est chiffrée au premier démarrage. Rien ne change dans les
réglages.

Ce qui ne pouvait se vérifier qu'à moitié ici : cette machine n'a pas de
trousseau, et Electron y refuse de chiffrer — vérifié, le canal répond, et
l'app retombe proprement sur l'ancien comportement. Le chemin chiffré, lui,
est prouvé par la CI Windows, avec la vraie app installée : une ancienne clé en
clair migrée, une clé neuve enregistrée sans aucune trace en clair dans le
fichier, puis un redémarrage qui la relit. Douze tests nouveaux (233).

Et la CI Windows l'a fait échouer, à juste titre. Migration : bonne. Clé
neuve : aucune trace en clair. Mais après redémarrage, la clé revenait
**vide**. L'hypothèse, prouvée avant de toucher au code : `safeStorage` ne
chiffre pas avec DPAPI à chaque fois ; il chiffre avec une clé que Chromium
crée au premier lancement, protège par DPAPI, et n'écrit dans `Local State`
qu'une dizaine de secondes plus tard. Le test arrêtait l'app une seconde après
l'enregistrement, sur une installation jamais lancée : la clé n'existait que
dans la mémoire du processus tué. Avec 15 secondes d'attente, tout passait.
Chez l'utilisateur, Clarity a déjà tourné cent fois — la clé est sur disque.
Le test reproduit donc maintenant cette situation (un premier lancement
complet, Local State vérifié), puis arrête l'app **sans aucun délai** après
l'enregistrement : vert. La seule fenêtre restante — une installation neuve
tuée dans ses premières secondes pendant qu'on y enregistre une clé — est
nommée dans `CLAUDE.md` ; la clé reviendrait vide et serait simplement
ressaisie.

Au passage : le backend s'arrête désormais si le processus principal
disparaît. Un backend orphelin gardait le port 3001, et le lancement suivant
lui parlait sans le savoir.

---

## 5 octobre — l'IA pour qui n'a pas Ollama

Voies 2 et 3 du `BACKLOG.md` § 5, faites toutes les deux.

**Assistant intégré (voie 3).** Fournisseur `local` : un modèle GGUF lancé par
node-llama-cpp 3.22.1, dans un processus à part (`engineWorker.js`). Raison
mesurée : sur un processeur AMX, sous le Node d'Electron, le chargement tuait
le processus d'une instruction illégale — dans le backend, il emportait toutes
les routes, et rien ne relance le backend. Isolé, il fait échouer la requête
avec un message ; la suivante relance un moteur. Un chargement figé échoue
après 3 min au lieu de retenir la requête pour toujours.

Téléchargement depuis l'app : Gemma 4 E2B (2,6 Go) ou E4B (4,3 Go, conseillé
dès 16 Go de RAM), épinglés à une révision, sha256 vérifié avant usage, reprise
depuis le `.part`. Mesuré contre Hugging Face : 2,8 Go relus et vérifiés en
4,7 s, seuls les 5 Mo manquants retéléchargés. Clarity bascule seul sur
l'assistant quand le fichier est bon, fenêtre ouverte ou non.

Empaquetage : CPU + Vulkan seulement, CUDA retiré (540 Mo sous Windows) —
`verifier-empaquetage` exige un moteur et refuse CUDA.

**Ollama installé par Clarity (voie 2, Windows).** Installateur officiel,
exécuté seulement si sa signature Authenticode est valide et au nom d'Ollama ;
installation sans droits d'admin, démarrage, modèle tiré avec progression,
bascule.

**Trois défauts trouvés en essayant pour de vrai** sur l'analyse en français :
réponse en anglais (« écris dans la langue des tâches » ne suffit pas au petit
modèle — la langue est désormais nommée), « Start T4 » dans le texte (les
T-noms sont remplacés par les titres), et une réponse coupée (le plafond de
jetons, deviné, est désormais dérivé des bornes du schéma).

**Interface.** « Assistant intégré » en tête des fournisseurs. Le message
« IA indisponible » ne dit plus `ollama serve` à quelqu'un qui n'a jamais
installé Ollama : il mène à la page IA des Réglages. L'écran d'accueil
n'annonce plus « llama-3 8b · 4,2 Go » sur toutes les machines.

**Preuve en CI Windows**, dans l'app installée : moteur chargé (0,9 s),
discussion et pistes par l'assistant intégré, puis Ollama installé et
interrogé. Le premier essai a bloqué 5 min : le modèle de test de 1 Mo
n'acceptait que 128 jetons de contexte. Remplacé par SmolLM2-135M.
Le vrai défaut était ailleurs, et il aurait touché de vrais PC : sur le runner
à 2 cœurs, llama.cpp lançait plus de fils que de cœurs, et ses fils attendent
en tournant — un jeton toutes les 13 à 26 s. À 1 ou 2 fils : 25 jetons en 1 s.
Le moteur prend désormais au plus autant de fils que de cœurs logiques.

    tests backend    275, en 16 suites

---

## 5 octobre — Clarity parle à Claude

Un connecteur MCP : Claude Desktop (ou toute appli d'IA qui parle MCP) lit et
met à jour les tâches — « par quoi je commence ? », ajouter, cocher, proposer
une piste. Réglages → Assistant IA → « Connecter à Claude Desktop » télécharge
une extension `.mcpb` ; un double-clic l'installe dans Claude.

- **Éteint par défaut, révocable.** Le jeton n'existe en clair que dans le
  fichier remis ; Clarity n'en garde que l'empreinte SHA-256. Reconnecter ou
  déconnecter rend l'ancienne extension inutilisable — vérifié.
- **Ce qui sort est borné côté Clarity**, pas par l'appelant : titres,
  statuts, dates, étiquettes, descriptions coupées à 300 caractères, pistes.
  Jamais les notes, le journal, les réponses aux points d'étape ni le profil.
- **Pas besoin que Clarity soit ouvert** : fermé, le connecteur le lance en
  arrière-plan (`--background` : icône près de l'horloge, aucune fenêtre).
  Nouvelle option « Lancer Clarity au démarrage de Windows », éteinte par défaut.
- Serveur MCP sans dépendance (un fichier), manifeste validé par l'outil
  officiel `mcpb`, zip vérifié par `unzip -t`. CI Windows : conversation MCP
  complète avec l'app installée, puis Clarity fermé et réveillé par le
  connecteur.

Ce que ça ne fait pas : claude.ai, ChatGPT ou le téléphone, qui tournent dans
le cloud et ne peuvent pas joindre un Clarity installé sur un PC — voie 4
(« Clarity Cloud ») du BACKLOG.

---

## 6 octobre — livrer Clarity à des amis

- **Mises à jour automatiques.** L'app installée cherche une nouvelle version
  dans le dépôt public `clarity-releases` (installateurs seulement), la
  télécharge en arrière-plan et propose « Mise à jour prête · Redémarrer ».
  Publier = changer la version dans `app/package.json` et fusionner dans
  `main` ; le workflow `publication` fait le reste (un tag poussé depuis la
  session est refusé). La version ne vit plus qu'à cet endroit.
- **Page de téléchargement** (GitHub Pages) avec une animation qui montre les
  quatre étapes, avertissement SmartScreen compris — l'installateur n'est pas
  signé. Animation aussi dans Réglages pour connecter Claude Desktop.
- **Avis des testeurs** : invitation après 7 jours et 5 tâches terminées, et
  « Donner un avis » à tout moment. Part vers un Google Form : la note, le
  message, la version, le système — jamais les tâches. Rien n'est envoyé
  sans un clic sur « Envoyer ».
- **Connecteur Claude** : la détection de Claude Desktop affirmait qu'il était
  absent chez quelqu'un qui l'avait (une seule clé de registre regardée) ;
  elle ne bloque plus jamais. Sept actions de plus pour Claude.
- Un test d'invariant (« chaque route qui écrit recalcule le profil ») ne
  voyait plus les écritures déplacées dans des fonctions partagées — 287 tests
  devenus 284 sans alerte. Il suit désormais les appels ; vérifié en retirant
  un recalcul sur copie.
- **1.3.1 : l'épingle Windows.** La fenêtre et le raccourci de l'installateur
  ne portaient pas la même identité Windows (AppUserModelID) : l'épingle
  sautait à chaque fermeture ou mise à jour. Un test garde les deux égales.
  La première publication de 1.3.1 a échoué : `gh release view` sort en 1
  quand la version n'existe pas encore, et PowerShell en faisait le code de
  l'étape. La 1.3.0 existait déjà, d'où l'absence d'alerte au premier essai.
- **1.3.2 : la mise à jour se voit.** Retour de test : un clic sur la pastille
  fermait Clarity, l'installation se faisait en silence, et rien ne disait
  ensuite que c'était fait. Désormais une fenêtre au centre annonce la
  version dès l'ouverture (« maintenant » ou « plus tard »), montre le
  téléchargement, prévient que Clarity va se fermer — une notification Windows
  couvre les secondes sans fenêtre — et le lancement suivant dit « Clarity est
  à jour », avec les nouveautés (`update.news` dans les langues, à réécrire à
  chaque version). L'installateur reste silencieux : visible, l'assistant NSIS
  ferait cliquer sur ses pages et un « Terminer ». Logique dans
  `electron/updateFlow.js`, testée sans Electron.
- **1.3.3 : la fenêtre pendant l'installation.** Retour de test de 1.3.2 : la
  mise à jour 1.3.1 → 1.3.2 n'a toujours rien montré pendant que Clarity était
  fermé — normal, elle exécutait le code de 1.3.1. Leçon : une app ne peut pas
  corriger sa propre mise à jour, seulement la suivante. Ce qui s'exécute
  pendant l'installation, c'est l'installateur de la NOUVELLE version : c'est
  lui qui se montre désormais (`build/installer.nsh` : `SetSilent normal` en
  mise à jour, aucune page, pas de « Terminer », Clarity relancé), même si
  l'app demande le silence. Une fenêtre PowerShell lancée par l'installateur
  avait d'abord été envisagée, puis abandonnée : elle passait par un
  contournement de la stratégie d'exécution. La CI Windows rejoue une vraie
  mise à jour et exige la fenêtre, la fermeture sans clic, et Clarity rouvert.
  Les puces des nouveautés manquaient : un `<ul>` en flex perd ses puces.
- **1.3.4 : l'installateur parle la langue de Clarity.** Il embarquait déjà
  toutes les langues (réglage par défaut d'electron-builder) et suivait celle
  de Windows, d'où l'anglais sur la CI. Il suit désormais la langue choisie
  dans Clarity, que l'app écrit dans `locale.txt` (dossier du profil) à chaque
  lancement et changement ; sans ce fichier — première installation — celle
  de Windows, l'anglais à défaut. Même décalage d'une version que pour la
  fenêtre : la mise à jour vers 1.3.4 ne trouve pas encore le fichier (1.3.3
  ne l'écrivait pas) et suit Windows ; les suivantes suivront Clarity. Un
  test lie les trois fichiers ; la CI rejoue une mise à jour sur un Windows
  anglais avec Clarity en français et exige une fenêtre « Installation de ».
- **1.3.5 : la première langue est celle de l'ordinateur.** Relu avant
  l'envoi aux amis : sans choix enregistré, Clarity démarrait toujours en
  anglais — après une page et un installateur en français. Il suit désormais
  les langues du système, l'anglais à défaut ; un choix fait dans Réglages
  reste prioritaire. Vérifié dans le navigateur pour fr-FR, fr-CA, en-US et
  de-DE (anglais).
- **1.3.6 : le résumé au réveil.** Demande : quand l'ordinateur sort de veille
  ou de veille prolongée, une petite fenêtre avec les tâches du moment, qu'on
  peut désactiver. Une carte en bas à droite (`WakeCard.jsx`) : en retard,
  aujourd'hui, ensuite (cinq au plus), le conseil de la dernière analyse,
  « Ouvrir Clarity », « Ne plus afficher ». Elle attend que la session soit
  déverrouillée — affichée au réveil même, elle attendrait derrière l'écran
  de verrouillage —, ne prend jamais le focus, se ferme seule après deux
  minutes si on ne l'a pas survolée, et ne s'affiche pas s'il n'y a rien à
  faire. Réglage `wakeSummary` (affiché sauf `false`), dans Réglages ›
  Assistant IA › Démarrage. Ne marche que si Clarity tourne en arrière-plan.
  La fenêtre est taillée à la carte : plus haute, sa partie transparente
  capterait les clics destinés au bureau derrière elle.
- **1.3.7 : les fonctions de l'assistant IA enregistrées et branchées.**
  Retour de test : « Replanifier automatiquement les tâches oubliées »
  revenait éteint à chaque lancement. La cause était pire qu'un oubli
  d'enregistrement : les quatre interrupteurs n'étaient lus par rien, et la
  replanification n'existait pas. Ils sont enregistrés (`features` dans
  settings.json), le bandeau et l'historique obéissent, la replanification
  déplace une tâche en retard à aujourd'hui (heure conservée) au lancement,
  à l'activation et toutes les 30 minutes. Ses déplacements sont marqués
  `auto` et exclus des glissements d'échéance du profil — sinon une tâche
  oubliée trois jours comptait trois glissements ; `OBSERVED_VERSION` passe
  à 4. « Détection automatique du sujet » est retirée. Douze autres
  interrupteurs factices relevés dans BACKLOG § 7. `Toggle` devient un vrai
  interrupteur (`role="switch"`), atteignable au clavier.
- **1.3.8 : plus aucun réglage factice.** Les douze autres interrupteurs, et
  trois valeurs affichées en dur, traités un par un (BACKLOG § 7) : branchés
  quand la fonction existait, retirés sinon, avec une phrase vraie à la
  place. « Effacer l'historique des conversations » n'avait aucune action ;
  il efface désormais les conversations du journal, et elles seules. Couper
  l'historique empêche aussi de l'écrire. « 18,4 Mo » est remplacé par la
  taille mesurée.
- **1.3.9 : un premier lancement qui montre la valeur.** Parcouru comme un
  nouveau venu, profil vide. Le dernier écran, « Essayez maintenant », était
  une image : « Enregistrer » n'enregistrait rien, et on arrivait sur un
  Aujourd'hui vide, avec « IA hors ligne » en orange. C'est maintenant une vraie
  saisie (plusieurs tâches, comprises comme Ctrl+K) ; pendant le téléchargement
  de l'assistant, la barre latérale et la carte le disent ; le téléchargement
  fini lance l'analyse des tâches déjà notées ; le bandeau rouge « L'analyse a
  échoué » ne double plus la carte quand il n'y a pas d'IA. Le tutoriel
  promettait ce que l'app ne fait pas (« l'IA extrait la personne », « un plan
  chaque matin », « groupé par énergie ») : réécrit sur ce qui existe.
  Trouvé en passant : une tâche due aujourd'hui apparaissait « en retard » le
  soir — `Date.parse('2026-10-07')` est minuit UTC. Comparée en jour local,
  testée sous trois fuseaux, et la régression vérifiée.
- **1.4.0 : les rapports de plantage.** Demandés une fois, après les premières
  secondes d'usage ; désactivés tant que la personne n'a pas dit oui, et rien
  n'est même écrit tant qu'ils le sont. Ils passent par le formulaire des
  avis, avec leur propre quota (3/h). Ce qui part : où (fenêtre, application,
  service), le message, la pile d'appels, la version, le système — le dossier
  de l'utilisateur et les courriels effacés (`src/crash/crash.js`, le seul
  endroit qui compose le rapport). Sources : erreurs non rattrapées du
  service, réponses 500 (motif de la route, sans identifiants), erreurs de la
  fenêtre, du processus Electron, une fenêtre qui plante, et le service qui
  s'arrête — ce dernier écrit dans la file par Electron et envoyé au lancement
  suivant. Une erreur de rendu affiche désormais « Recharger » au lieu d'une
  fenêtre blanche. Réglages › Confidentialité montre les derniers rapports
  envoyés. Vérifié de bout en bout contre un faux formulaire local.

## 7 octobre — le panneau « Aujourd'hui »

Demande : sur le laptop, l'équivalent du widget Todoist du téléphone. Une
question a tranché la forme : le widget du téléphone marche parce que l'écran
d'accueil est vu toute la journée ; le bureau d'un laptop est presque toujours
couvert de fenêtres. Un widget de bureau y serait invisible. D'où un panneau
qui vient **par-dessus** les fenêtres, à la demande : un clic sur l'icône près
de l'horloge, ou Ctrl+Alt+Espace de n'importe où (`globalShortcut` ; si une
autre app a pris la combinaison, le journal le dit et l'icône reste). Il
remplace l'ancien menu de l'icône : en retard, aujourd'hui, ensuite (huit au
plus), chaque tâche avec heure, durée, sous-tâches et sujets ; on coche sans
ouvrir l'app, on déplie pour la description et les sous-tâches (cochables),
« Ouvrir dans Clarity » mène à la fiche. Fenêtre taillée à la carte, fermée
au clic ailleurs ou par Échap. La sélection des tâches est partagée avec la
carte du réveil (`components/glance.js`). Le panneau Widgets de Windows
(Win+W) reste possible plus tard, mais exige une app empaquetée et signée.

**1.5.1, retour de test.** Le panneau doit se déplacer, s'ouvrir sans passer
par l'icône, et « Ctrl+K ne marche pas ». Ctrl+K marchait — dans la fenêtre de
Clarity seulement ; c'est le tutoriel et l'accueil qui promettaient « depuis
n'importe où ». Corrigé dans le texte, et le panneau a désormais son propre
champ d'ajout : Ctrl+Alt+Espace puis on tape, de n'importe quelle fenêtre.
Le panneau se déplace par son en-tête et garde sa place (`panel.json`) ;
épinglé, il reste ouvert comme une note ; sinon il se ferme au clic ailleurs.
Clic droit sur Clarity dans la barre des tâches : « Panneau Aujourd'hui »
(liste de raccourcis Windows, dans la langue choisie).

**1.5.2, retour de test.** Déplacé, le panneau revenait étiré sur toute la
largeur de l'écran, et pâle : Windows redimensionne une fenêtre transparente
sans cadre qu'on fait glisser selon la mise à l'échelle de l'écran, et le code
de hauteur gardait cette largeur. Largeur verrouillée (380 px, min = max, et
corrigée à chaque redimensionnement), fond opaque. Un clic sur l'icône pour
fermer le rouvrait : le clic retire d'abord le focus au panneau, qui se cache,
puis le clic le rouvrait — ignoré s'il vient de se cacher. Clic droit sur
l'icône : le menu Windows habituel (panneau, ouvrir, quitter). Épinglé, le
panneau n'est plus « toujours devant » : une note parmi les fenêtres, que
Ctrl+Alt+Espace ramène au premier plan.

**1.5.3, « encore des bugs ».** Relu entier, et conduit dans un vrai Electron
(Playwright, sous Xvfb), le panneau en avait encore sept :

- **Épinglé, l'icône ne le fermait jamais.** Le clic sur l'icône lui retire le
  focus avant d'arriver ; la 1.5.2 le voyait alors « derrière » et le ramenait
  devant. La perte de focus est maintenant datée : un panneau qui l'avait il y
  a moins d'une demi-seconde était devant, et le clic le ferme.
- **La fenêtre restait transparente**, carte dessinée à l'intérieur. C'est
  elle que Windows étire. Elle est maintenant opaque, de la taille exacte de la
  carte, largeur et hauteur verrouillées — la carte du réveil aussi, pour la
  même raison.
- **Chaque déplacement fait par le code était enregistré** comme un
  déplacement de la personne, et le panneau dérivait d'une ouverture à l'autre.
  Seul un glisser (`will-move`) est mémorisé.
- **Épinglé, « Ouvrir Clarity » le cachait.** Une note épinglée reste ; seuls
  ✕ et Échap la rangent.
- **« Pour aujourd'hui : 0 » au-dessus de tâches en retard.** Le compte inclut
  le retard, qui est aussi pour aujourd'hui.
- **Une tâche cochée par erreur disparaissait sans retour.** « Annuler » pendant
  six secondes — sauf pour une tâche récurrente, dont la suivante est déjà
  créée.
- **À l'ouverture, il montrait les tâches de la fois d'avant**, jusqu'au
  rafraîchissement suivant (4 s). Il recharge maintenant à chaque ouverture.

Deux à côté. La carte du réveil disait « Tâches en cours : 4 » pour quatre
tâches non terminées, dont une seule en cours. Et une demande du 7 octobre
était restée sans suite : le démarrage avec Windows, le résumé au réveil, le
plan du jour et la replanification n'avaient rien à faire sous « Assistant
IA ». Ils ont leur onglet, « Au quotidien » ; « Assistant IA » ne règle plus
que le moteur.

Vérifié dans Electron : taille refusée quand on tente de l'étirer, ouverture et
fermeture par l'icône épinglé ou non, Échap, déplacement par le code non
enregistré, annuler (qui rend le statut d'avant, « en cours » compris), la
carte du réveil à la hauteur exacte de sa fenêtre, l'interrupteur de
replanification toujours actif après relance depuis son nouvel onglet, un
parcours complet (accueil, Ctrl+K, réglages, panneau) sans erreur JavaScript. Pas vérifiable sans Windows : le glisser réel sur un écran
mis à l'échelle et la liste de raccourcis de la barre des tâches.

---

## 8 octobre — la récurrence, partout où l'on ajoute une tâche

« Il n'y a pas de récurrence dans les outils. » Elle existait — formulaire,
fiche d'une tâche — mais nulle part où l'on ajoute vite. Les outils que Claude
appelle (`clarity_add_task`, `clarity_update_task`) ne la connaissaient pas, et
la saisie rapide non plus : « tous les lundis » finissait dans le titre.

- **Connecteur 1.1.0.** `recurring` à l'ajout et à la modification ; une tâche
  répétée sans échéance commence aujourd'hui (une répétition compte à partir
  d'une date) ; cochée, la réponse dit quand tombe la suivante. Une extension
  déjà installée garde l'ancien serveur : il faut la reconnecter.
- **Saisie rapide.** « chaque/tous les/every » + jour, semaine, mois, ou un nom
  de jour complet. Jamais un adjectif seul : « Daily standup » et « rapport
  hebdo » sont des titres. Dix cas de plus dans `verifier-saisie.mjs`.
- **Deux défauts trouvés en chemin.** La suivante d'une tâche répétée perdait
  son heure et sa durée. Et l'aperçu du connecteur datait « aujourd'hui » en
  UTC : le soir, à Montréal, les tâches du jour y étaient « en retard ». Le
  test qui le garde tourne dans son propre processus — Jest donne à chaque
  test une copie de `process.env`, et changer `TZ` dedans ne changeait rien :
  le premier jet passait aussi sur l'ancien code.

Vérifié : connecteur de bout en bout (ajout répété, coche, suivante une semaine
plus tard, arrêt), et dans Electron les trois champs de saisie.

**1.5.5, retour de test.** « La récurrence ne doit pas passer par Claude. »
Elle existait dans l'app, mais là où personne ne regarde : le formulaire
complet (qu'aucun bouton de la vue Aujourd'hui n'ouvre) et le bas de la fiche,
sous le suivi. La fenêtre d'ajout — le geste de tous les jours — n'en avait
pas. Elle a maintenant une rangée « Une seule fois · Chaque jour · Chaque
semaine · Chaque mois », que « tous les lundis » coche tout seul et qu'un clic
remplace ; dans la fiche, la récurrence est remontée sous l'échéance.

« Accepter » une suggestion ajoutait la tâche, mais le bandeau restait : il ne
change qu'à la prochaine analyse, et sans assistant il n'y en a pas. Une
suggestion acceptée ou ajoutée est maintenant rangée, mémorisée par ses mots ;
la suivante s'affiche. Au passage, deux lectures de la même réponse
`{ task, analyzing }` comme si c'était la tâche : « Accepter » mettait dans la
liste une tâche sans identifiant ni titre, et Ctrl+Entrée n'ouvrait jamais
la tâche ajoutée.

Vérifié dans Electron, suggestion simulée : acceptée, elle disparaît et ne
revient pas à la relance ; « Chaque semaine » cliqué, Ctrl+Entrée enregistre
la tâche (hebdomadaire, pour aujourd'hui) et ouvre sa fiche, où la récurrence
se change.

**1.5.6.** « Les dernières demandes s'accumulent. » Claude liste les tâches
avant chaque changement et archive une tâche par appel : quatre archivages
faisaient quatre lignes identiques, et la liste gardait l'historique de la
connexion précédente après « Reconnecter ». Une suite de la même demande tient
maintenant sur une ligne avec son nombre ; trois lignes visibles, le reste
derrière « Afficher les N autres » ; une reconnexion vide la liste (testé).

**1.5.7.** « Je dois fermer et rouvrir Clarity pour voir une mise à jour. »
La recherche se faisait au lancement, puis toutes les six heures — et une
version trouvée en route n'allumait que la pastille. Or fermer la fenêtre ne
quitte pas Clarity : il reste près de l'horloge, et le « lancement » n'arrive
qu'à un redémarrage. Maintenant : toutes les 30 minutes, et chaque fois que la
fenêtre revient (au plus toutes les 10 minutes), avec la fenêtre de mise à
jour ; une version déjà téléchargée en arrière-plan est proposée au retour
sans repartir de zéro. Un bouton dans Réglages › À propos et une entrée au
clic droit de l'icône la cherchent tout de suite. Trois tests de plus dans
`updateFlow.test.js`.

---

## 13 octobre — deux défauts restés ouverts depuis l'audit de septembre

**La récurrence mensuelle sautait un mois.** `setMonth(+1)` garde le jour et
déborde : une tâche due le 31 janvier revenait le 3 mars, février sauté — le
loyer, la facture, le bilan de fin de mois, soit justement les tâches
mensuelles qu'on a. Borner au dernier jour du mois court ne suffit pas : 31
janv. → 28 févr. → 28 mars, et la série ne revient jamais au 31. Elle retient
donc son jour (`recurrenceDay`) et chaque occurrence le vise, borné à la
longueur de son mois : 31 janv. → 28 févr. → 31 mars → 30 avr. → 31 mai.
Un déplacement à la main fixe un nouveau jour ; un report automatique, non.
`src/recurrence.js`, pur, 7 tests ; remettre l'ancien `setMonth` en fait
échouer 3.

**Changer de fournisseur effaçait la clé d'API.** Un seul emplacement sert à
tous les fournisseurs, et l'écran vidait le champ au changement : l'envoi
portait `apiKey: ''`, que le serveur écrivait par-dessus la vraie clé. Même
chose avec « Remplacer » puis Enregistrer sans rien taper. Mesuré sur un vrai
serveur, avant : clé enregistrée → changement → `''`. Après : la clé reste ;
seul `null` efface, exprès. L'écran n'envoie plus qu'une clé tapée et dit
« laisser vide pour garder la clé enregistrée ». `src/security/secretField.js`,
3 tests.

    tests backend    412, en 27 suites
    contrôles        les 4 de qualite.json, verts

---

## 13 octobre, suite — neuf retours de testeur, 1.5.9

- **Échap ne fermait rien, nulle part.** La fenêtre de mise à jour, même
  invisible, écoutait Échap en phase de capture et l'avalait : sans vue,
  `dismiss` retombait sur `updates.later`. Écoute limitée à la fenêtre
  affichée. Trouvé en pilotant l'app, pas en relisant.
- **La saisie se fermait en sélectionnant du texte.** Un clic va à l'ancêtre
  commun de l'appui et du relâchement : appui dans le champ, relâché hors de la
  boîte → le fond. `useBackdropClose` exige que l'appui commence sur le fond ;
  cinq boîtes. Le brouillon de saisie rapide survit à une fermeture
  accidentelle (Échap, lui, annule).
- **Notes impossibles à écrire.** Le panneau affichait `description` sous le
  titre « Notes », en lecture seule ; le champ Notes du formulaire écrivait
  `notes`, jamais affiché. Notes éditables sur place, enregistrées après une
  pause, à la sortie du champ et à la fermeture.
- **« Boîte de réception » ouvrait un sujet.** Même vue que la liste d'un
  sujet, filtre gardé. `goTo('tasks')` le vide.
- **Pas d'ajout depuis un sujet** → bouton « Ajouter une tâche à ce sujet » ;
  le formulaire ne s'intitule plus « Modifier » quand il reçoit des valeurs.
- **Tâche taguée introuvable.** Un tag tapé sans Entrée était jeté à
  l'enregistrement ; idem sous-tâche. Gardés. (Un `onBlur` essayé d'abord
  décalait le formulaire et faisait rater le clic sur « Ajouter » — retiré.)
- **Plan du jour sans « Ignorer »** → ajouté, même mécanisme qu'Accepter.
- **Textes IA en anglais.** Langue devinée sur les titres. Clarity envoie
  `uiLanguage` ; analyse, bilan, chat et découpage l'utilisent ; changer de
  langue relance l'analyse.
- **Pas de fluidité** → transition entre vues, entrée des cartes, fondu des
  fonds, retour au clic ; coupé si Windows demande moins d'animations.
  `fill-mode: backwards` exprès : un `transform` resté actif aurait recalé tout
  `position: fixed` intérieur.

Vérifié dans Chromium sur un vrai backend : 14 contrôles, tous verts.

    tests backend    415, en 28 suites

---

## 13 octobre, fin — l'Inbox qui ne montrait pas tout, et la preuve des mises à jour

**Les badges comptaient autre chose que leur page.** « Aujourd'hui » portait
le total de toutes les tâches, terminées comprises, au-dessus d'une page qui
en liste cinq. La boîte de réception comptait les terminées qu'elle masque,
son titre aussi. « Quand je veux » ouvrait la même liste qu'elle. Une tâche
ajoutée depuis la dernière analyse se rangeait sous toutes les classées — en
bas d'une longue liste, elle semblait perdue. Chaque badge compte ce que sa
page liste ; « Quand je veux » = sans date ; les nouvelles en tête jusqu'à
leur classement ; « Voir les N tâches » sur Aujourd'hui. Vérifié dans
Chromium : 8 ouvertes, 8 cartes, badge 8 ; nouvelle tâche en premier.

**Une copie ancienne rejoint-elle la dernière version ?** Job CI
`ancienne-version` : installe la 1.3.0 publiée (la plus ancienne qui sait se
mettre à jour), la laisse chercher et télécharger seule, installe par-dessus
sans désinstaller. Mesuré : 1.3.0 → 1.5.9, 163 Mo, tâche témoin conservée.
Premier passage rouge à tort — le test prenait `temp-Clarity-Setup.exe`, le
fichier en cours d'écriture ; il attend maintenant le fichier final.

Limite qui ne se contourne pas : une copie d'avant 1.3.0 n'a aucun code qui
cherche une mise à jour. Une installation par-dessus, une fois. Avant 1.3.1,
Réglages affichait « 1.2.0 » en dur : une copie qui l'affiche peut être une
1.3.0, qui se met à jour seule.

---

## 13 octobre — la synchro par compte (1.6.0)

Demandée : retrouver ses tâches sur ses autres ordinateurs, et que l'amie
testeuse ait les siennes. Option retenue : un compte en ligne (Supabase,
projet dédié au Canada), connexion par code à 6 chiffres reçu par e-mail,
sans mot de passe. Facultative : sans compte, rien ne quitte l'ordinateur.

**La base** : une table `records`, une ligne par élément (tâche, fil,
profil, journal), lisible et modifiable par son seul propriétaire ; un
déclencheur garde l'édition la plus récente et estampille le curseur de
lecture côté serveur ; les suppressions voyagent en pierres tombales.
Vérifié sur la vraie base, deux comptes fictifs, tout annulé ensuite : modif
plus ancienne ignorée, B ne lit ni n'écrit A, anonyme refusé, envoi en lot
dont une ligne est plus ancienne — ignorée sans casser le lot.

**Le moteur** (`src/sync/`) : un plan pur (quoi appliquer, quoi envoyer), un
client HTTPS sans SDK, une orchestration fichiers ↔ lignes. Deux appareils
simulés contre un faux serveur aux mêmes règles. Trois défauts trouvés par
ces tests, aucun par la relecture :
- une suppression datée « maintenant » sur une machine dont l'horloge
  retarde était plus vieille que la version supprimée — ignorée par le
  serveur. Elle est désormais toujours postérieure à ce qu'elle supprime ;
- le profil réécrit son horodatage à chaque recalcul : deux appareils se le
  seraient renvoyé sans fin. Il compte comme modifié sur son contenu seul ;
- les lectures se chevauchent de deux minutes (le serveur peut valider ses
  écritures dans le désordre) : une tâche supprimée ici, relue, ressuscitait.

Ce qui ne voyage jamais : settings.json (clé d'API, choix de la machine), la
couche `observed` et l'analyse IA, recalculées sur chaque appareil. Le jeton
de session est chiffré comme la clé d'API. Une remise à zéro efface aussi
`sync.json`, sinon la connexion suivante lirait chaque tâche comme supprimée
et viderait le compte. Avant la première synchro, `presync-<date>.json`.

Pas prouvé d'ici : l'aller-retour réel avec le serveur d'authentification —
le mandataire de la session refuse supabase.co. À essayer sur deux
ordinateurs réels.

---

## 13 octobre, soir — audit complet, 1.6.1

Quatre relectures parallèles (synchro, serveur, interface, Electron/CI), chaque
défaut reproduit par un script avant d'être corrigé. Un défaut annoncé et non
reproduit n'a pas été touché.

**Une régression que j'avais livrée.** La fenêtre qui se fermait quand une
sélection à la souris finissait hors du cadre (corrigée en 1.5.9) revenait
dès 1.5.9 : le crochet `useBackdropClose` armait la fermeture au lieu de la
désarmer, et ma vérification avait lu la mauvaise ligne. Corrigé, et gardé
désormais par `frontend/tools/verifier-fond.mjs` dans la barrière et la CI —
qui échoue bien si l'on remet le défaut.

Synchro — neuf défauts, dont trois pouvaient vider un compte :
- un fichier local illisible valait « tout supprimé » sur tous les appareils.
  La passe s'arrête désormais ;
- une réinitialisation pendant une passe envoyait la suppression de chaque
  tâche. La passe en cours est annulée et n'écrit plus rien ;
- juste après une récupération (fichier abîmé, sauvegarde), aucune
  suppression ne part ; au-delà de la moitié de ce qui est synchronisé, la
  passe refuse, sauf après « Supprimer toutes les tâches » ;
- un second appareil écrasait le profil du premier : fusion, renvoyée dans
  la même passe ; un rejet l'emporte toujours ;
- effacer l'historique ici l'efface ailleurs ; un jeton refusé dit « session
  expirée », pas « code faux » ; une tâche récurrente terminée sur deux
  appareils ne crée plus deux occurrences (identifiant déterministe).

Serveur : écritures des réglages en file (deux à la fois s'écrasaient) ; un
champ non textuel bloquait l'analyse pour toujours ; réinitialisation
complète ; lignes Ollama coupées en deux ; flux abandonnés par le client sans
écriture ; rapports de plantage arrivés pendant l'envoi conservés.

Interface — vérifié dans un navigateur, pas seulement relu : archive
supprimée deux fois puis annulée ; note écrasée par le formulaire ouvert
avant elle ; tâches du jour absentes d'Aujourd'hui ; « terminées
aujourd'hui » qui comptait tout ; Échap (le panneau du dessus seulement) ;
tutoriel illisible en sombre ; pluriels réglés une fois dans `t()` ; états
vides qui proposaient un bouton sans effet.

Electron/CI : la publication attend la CI verte (elle partait en même
temps) ; jamais une version plus ancienne marquée « latest », brouillon
vérifié ; la CI lit le paquet livré (electron-updater, app-update.yml) ; la
version arrivée par mise à jour doit démarrer et servir la tâche témoin ; le
service qui s'arrête est relancé, puis un dialogue au troisième arrêt ; un
arrêt de Windows n'est plus un plantage ; `setup.bat` dit quand il échoue.

Mesuré : 450 tests backend, 4 contrôles, 31 tests de synchro dont 10 issus
de l'audit.

---

## 13 octobre, nuit — guider plutôt qu'annoncer (1.6.2)

Demandé : l'app ne montrait ni où une mise à jour avait changé quelque chose,
ni comment s'en servir, et rien ne permettait de « faire le tour ».

**Le tutoriel visait des pixels.** Ses cinq étapes éclairaient des rectangles
écrits en dur (`top: 114, left: 20`…), dessinés pour une seule taille de
fenêtre : à toute autre, barre repliée ou densité changée, la lumière tombait à
côté. Il ne se relançait pas. Remplacé par `TourOverlay` : chaque étape nomme un
élément (`data-tour`), Clarity va d'abord à la bonne vue ou au bon réglage, la
lumière glisse d'un élément à l'autre et suit la fenêtre redimensionnée ; une
étape facultative dont l'élément n'est pas affiché (pas de plan sans assistant,
barre repliée) est sautée au lieu de pointer le vide. Clavier : ← → Échap.
Relançable depuis Réglages › À propos et la liste des commandes (Ctrl+K) ; à la
fin, retour là où l'on était.

**Les nouveautés montrées sur place.** La fenêtre « Clarity est à jour » propose
« Montrer où » : une visite des seuls changements qui ont une place à l'écran,
pour chaque version entre l'ancienne et la nouvelle (`WHATS_NEW` dans
`tour/tours.js`). Une copie trop ancienne pour savoir d'où elle vient ne voit
que la dernière.

Aussi : un bouton « Nouvelle tâche » visible en haut de la barre latérale (on
ne pouvait ajouter depuis Aujourd'hui qu'en connaissant Ctrl+K) ; la coche se
remplit et se dessine dès le clic, avant la réponse du serveur ; l'accueil ne
dit plus « aucun compte, aucune synchro » depuis que la synchro existe.

Un défaut trouvé par le test, pas par la relecture : une visite lancée depuis
Réglages › À propos ramenait sur Apparence — App ne savait pas quelle page des
Réglages était ouverte. Corrigé ; le retirer refait échouer le scénario.

`tools/verifier-visite.mjs` (barrière et CI) : chaque élément visé existe dans
les sources, chaque texte dans les deux langues — clés calculées, invisibles
pour `verifier-locales` —, et le choix des versions. Trois défauts plantés dans
une copie, trois refus ; le premier jeu de cas laissait passer une comparaison
de versions en texte (« 1.6.10 » < « 1.6.2 »), cas ajouté.

Vérifié dans Chromium sur un vrai backend, 43 contrôles, trois passages verts :
1280×820 puis 1000×660 barre repliée, agrandie en pleine visite (écart de la
lumière ≤ 1 px), mise à jour simulée 1.6.1 → 1.6.2, coche avant la réponse.
Pas vérifié : dans Electron sous Windows — la CI Windows installe et démarre,
elle ne parcourt pas la visite.

    tests backend    450, en 31 suites
    contrôles        5 de qualite.json, verts

---

## 15 octobre — ce qui est promis marche (1.7.0)

Premier des lots décidés le 13 (spécification :
`docs/superpowers/specs/2026-10-13-lot-1-promesses-design.md`). Des promesses
affichées sans être tenues, vérifiées dans le code avant d'être corrigées.

- **Le clavier dans les listes.** Réglages › Clavier annonçait Espace, Entrée,
  Suppr ; rien n'y répondait. ↑ ↓ passent d'une carte à l'autre (les cartes à
  l'écran, dans leur ordre : aucun état de sélection à tenir), Espace termine
  et passe à la suivante, Entrée ouvre, Suppr supprime. Les touches viennent de
  Réglages : une touche remplacée marche, l'ancienne non. Contour visible au
  clavier seulement. Les raccourcis vivent dans `src/shortcuts.js`, partagé.
- **Annuler** une coche, un archivage, une modification (formulaire ; échéance
  et répétition dans le détail — pas la note, enregistrée en continu, qui
  ferait une notification par pause de frappe). Une tâche répétée terminée a
  déjà créé la suivante : l'annuler la retire si personne n'y a touché
  (`src/undoOccurrence.js`, 9 tests). Le panneau du jour, qui refusait
  d'annuler une répétée pour cette raison, l'accepte.
- **La saisie comprend l'heure et les dates écrites.** « à 14h », « vers 9h »,
  « 3pm », « 14:30 » ; nue, une heure à partir de 7 h (« réunion 9h ») et une
  durée en dessous (« 2h » devient une durée, « 2h30 » l'était déjà) — décidé
  avec l'utilisateur. « le 12 octobre », « Oct 12th », « 12/10 » (jour/mois en
  français, mois/jour en anglais), « le 12 ». Sans année : la prochaine fois.
  35 cas nouveaux, dont 9 qui ne doivent RIEN avaler (« 14h75 », « Meet at 3 »,
  « 45/60 », « le 31 février »). Un premier jet transformait « le 31 février »
  en « février » dû le 31 octobre : attrapé par ces cas.
- **Le bilan de la semaine** avait une vue et aucun chemin : entrée dans la
  barre latérale et dans Ctrl+K. Au passage, Tendances ne s'allumait jamais
  comme page active.
- **Aide-mémoire** : `?`, Ctrl+K ou Réglages › Clavier ; il lit les touches
  configurées.
- « Montrer où » couvre la 1.7.0 ; chaque entrée de la barre latérale porte
  désormais son repère (`nav-<id>`), que le vérificateur de la visite connaît.

Vérifié dans Chromium sur un vrai backend :
`frontend/tools/essai-navigateur-1.7.cjs`, 28 contrôles, verts sur quatre
passages — écrit dans le dépôt cette fois, pas dans un brouillon de session.
Hors CI (il faut Playwright et deux serveurs) ; la façon de le lancer est en
tête du fichier. Mutation : le seuil de l'heure à 0 fait échouer 5 cas.

    tests backend    459, en 32 suites
    contrôles        5 de qualite.json, verts

Décisions pour la suite (priorité à six niveaux, liens enregistrés, durée et
difficulté, graphe fluide, journée réaliste) :
`docs/superpowers/specs/2026-10-15-priorite-liens-journee-notes.md`.

---

## 15 octobre, suite — priorité et liens, les fondations (1.8.0)

Spécification : `docs/superpowers/specs/2026-10-15-1.8-priorite-liens-design.md`.
Décidé avec l'utilisateur : sans niveau choisi, l'IA décide (son haut / moyen /
bas ramené à l'échelle) ; deux versions — ici ce qui marche sans IA, la 1.9
ajoutera les suggestions.

**Ce qui existait** : l'analyse calculait déjà, pour chaque tâche, un niveau à
trois crans, des dépendances et des tâches liées — recalculés à chaque fois,
jamais enregistrés, invisibles sans assistant, et sans effet sur l'ordre ; les
tâches liées ne s'affichaient nulle part.

- **Six niveaux** (`priority`), réglés dans le détail, au clic droit, dans le
  formulaire, à la saisie (`!1` … `!6`) et depuis Claude (connecteur 1.2.0).
- **Difficulté** 1–5 (`difficulty`), même chemins sauf la saisie.
- **Liens** (`links`), écrits une fois sur la tâche d'où ils partent :
  « bloque » (impossible avant / mieux avant) et « liée à ». Le serveur refuse
  une cible inconnue et toute boucle, à toute profondeur ; supprimer une tâche
  retire les liens qui la visent et date le changement pour la synchro
  (`src/links.js`, 11 tests).
- **L'ordre** (`frontend/src/lib/ordre.js`, pur) : bloquée en dessous ; niveau
  effectif = le sien, ou celui de l'IA, ou Moyenne, relevé au plus haut de ce
  qu'elle bloque ; échéance effective idem ; puis rang de l'IA. « À faire en
  premier » = la première non bloquée — c'était « celle que l'IA classe 1 », et
  sans IA la case restait vide. `tools/verifier-ordre.mjs`, 24 cas, dans la
  barrière et la CI ; quatre règles cassées dans une copie, quatre refus — dont
  un qu'aucun cas ne voyait d'abord (une tâche terminée transmettait encore son
  niveau), cas ajouté.
- **L'analyse IA** reçoit le niveau, la difficulté et les liens de la personne,
  avec la règle de ne jamais passer outre son niveau.
- **Le graphe** : il repartait de zéro dès qu'une tâche changeait (un titre, un
  minuteur, la synchro) et ne se redessinait qu'une image sur trois. Positions
  gardées, nouvelle bulle posée près de ce à quoi elle est liée, chaque image
  dessinée, vrais liens tracés (plein / tirets / points ; les dépendances de
  l'IA en pâle). Mesuré dans Chromium, ancien code puis nouveau : 19 → 52
  positions par seconde ; pendant une modification, 20 instants sur 65 en
  mouvement → 0. Écart à la spécification : le dessin passe toujours par React
  à chaque image plutôt que par le DOM directement — mesuré suffisant, et une
  réécriture de 600 lignes de moins.

Vérifié dans Chromium sur un vrai backend :
`frontend/tools/essai-navigateur-1.8.cjs`, 26 contrôles, vert sur trois
passages ; le scénario 1.7 rejoué, vert. Les deux scénarios répondent d'avance
aux questions qui s'ouvrent seules (rapport de plantage à 8 s, avis à 20 s),
qui couvraient la fenêtre en plein test.

    tests backend    471, en 33 suites
    contrôles        6 de qualite.json, verts

---

## 15 octobre, soir — l'IA propose (1.9.0)

Spécification : `docs/superpowers/specs/2026-10-15-1.9-ia-propose-design.md`
(retenus : propositions dans le détail, ✦ sur la carte, pointillé dans le
graphe ; seuils fixes).

- **L'analyse** ne rend plus `dependencies` / `relatedTasks` /
  `relationshipNote` (calculés, jamais confirmables, en partie jamais
  affichés) mais `suggestedLinks` (≤ 2, avec une raison), `suggestedLevel`
  (six crans), `suggestedDifficulty`. Un garde-fou existant a mordu au premier
  jet : douze longues tâches et leur plus longue réponse ne tenaient plus dans
  le contexte du modèle local. Raison des liens bornée à 50 caractères, le
  « pourquoi » du niveau reprend `reasoning` : ça tient (3 467 jetons au plus).
  Noms inconnus, liens vers soi, valeurs hors échelle : jetés, pas devinés.
- **Les propositions** (`frontend/src/lib/suggestions.js`, pur) : lien, niveau,
  difficulté venus de l'analyse — jamais sur ce que la personne a décidé, ni
  entre deux tâches déjà liées, ni s'il fermait une boucle ; et deux règles
  fixes, sans IA : « bloquant trop lourd » (2 h ou difficulté 4, retenant du
  30 min ou difficulté 2) et « faire descendre » (repoussée 3 fois ou
  intouchée 21 jours, ne débloque rien, coûte ; jamais une Priorité absolue
  choisie ; un cran, jamais l'abandon).
- **Pas maintenant / Jamais pour ça**, enregistrés sur la tâche (`dismissed`,
  synchronisé) avec l'empreinte des tâches : la proposition revient si l'une
  change ou après 60 jours ; « jamais » la tient à l'écart.
  `tools/verifier-suggestions.mjs`, 26 cas aux seuils, barrière et CI ; cinq
  règles cassées dans une copie, cinq refus.
- **À l'écran** : ✦ et nombre sur la carte, bloc « Clarity suggère » dans le
  détail (Confirmer passe par l'annulation de 1.7), pointillé de couleur dans
  le graphe à la place des dépendances pâles de 1.8. Clés de texte en
  `propose.*` : `suggest.*` appartenait déjà aux suggestions proactives.
- **Trouvé en regardant l'écran** : un « 0 » orphelin sous une carte dont
  l'analyse rend un plan vide (`{a || b || list.length && …}`), défaut
  antérieur. Corrigé, et le scénario le vérifie dans les deux sens.

Vérifié dans Chromium sur un vrai backend, analyse injectée :
`frontend/tools/essai-navigateur-1.9.cjs`, 16 contrôles, verts ; scénarios
1.8 et 1.7 rejoués, verts. Pas vérifié : une vraie analyse par le modèle local
avec le nouveau schéma — la session n'a pas de modèle ; à regarder sur le PC
au premier passage de l'analyse.

    tests backend    476, en 33 suites
    contrôles        7 de qualite.json, verts

---

## 16 octobre — la journée réaliste (2.0.0)

Spécification : `docs/superpowers/specs/2026-10-16-2.0-journee-realiste-design.md`
(retenus : plan enregistré à part, heures 9–18 / pause 12–13 / lun–ven
réglables, aperçu à accepter). Ce qui faisait perdre la journée, selon
l'utilisateur : sous-estimer le temps, ne pas savoir quoi faire ensuite, ne
pas savoir quoi repousser ni quoi faire ensemble.

- **Heures de travail** (`backend/src/workday.js`, 11 tests) : réglées dans
  Réglages › Au quotidien, vérifiées par le serveur (fin après début, pause
  dans la journée, au moins un jour) ; une valeur abîmée retombe sur les
  défauts plutôt que de casser le plan.
- **Le plan** (`frontend/src/lib/journee.js`, pur) : capacité = heures −
  pause − rendez-vous (.ics) − heures fixées − ce qui est passé ; durée =
  estimation (ou d'après la difficulté, ou 30 min) × l'écart mesuré du sujet
  ou général (borné ×0,5–×3) ; placement dans l'ordre de la 1.8, autour de ce
  qui est pris, difficiles à l'heure de pointe (Tendances › rythme), petites
  tâches du jour en un bloc, même sujet à la suite, jamais avant un bloquant ;
  ce qui ne tient pas, avec la raison (journée pleine / bloquée par X) et
  « Demain » (jour travaillé suivant).
- **Accepté**, enregistré à part (localStorage de ce poste) : « Maintenant :
  X, jusqu'à … », « Ensuite : … », la frise montre les blocs. Il bouge seul :
  un bloc fini sans la tâche, cinq minutes passées, pousse la suite ; une tâche
  finie en avance libère son temps.
- `tools/verifier-journee.mjs`, 35 cas, barrière et CI ; neuf règles cassées
  dans une copie, neuf refus.

Trouvé en testant, pas en relisant :
- un bloc « en cours » à l'horloge restait en place alors que celui d'avant
  n'était pas fini — la personne y était encore. Un bloc n'est en cours que si
  tout ce qui le précède est terminé ;
- terminer la tâche en cours ne libérait pas son temps (seul un bloc futur le
  faisait) ;
- le plan se décalait à la minute exacte de fin — cinq minutes de grâce ;
- « 1,3 h » au lieu de « 1 h 20 » ; un « décalé de … » resté affiché après
  que le plan était remonté.

Vérifié dans Chromium sur un vrai backend, horloge du navigateur pilotée
(9 h → 10 h 25) et écart mesuré injecté : `frontend/tools/essai-navigateur-2.0.cjs`,
19 contrôles, verts ; scénarios 1.7, 1.8, 1.9 rejoués, verts. Pas vérifié :
les rendez-vous d'un vrai .ics dans le plan (le test passe par les
rendez-vous simulés de `verifier-journee`).

    tests backend    487, en 34 suites
    contrôles        8 de qualite.json, verts

---

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

## Lot C′ (sur la branche, pas publié) — sujets proposés, nouvelle séance (29 octobre 2026)

**Changé.**
- Étiquettes : pendant la frappe, les sujets qui existent sont proposés (formulaire et Ctrl+K « #pe » → #Perso). Un sujet connu tapé garde son orthographe. Choisir une proposition dans Ctrl+K fait de la ligne une nouvelle tâche.
- Focus : la séance dépassée, « Nouvelle séance » relance le compte (séance 2…) ; le temps suivi n'est pas touché.
- Formulaire : Échap le ferme où que soit le curseur (avant, seulement si le curseur était dedans — vu par l'essai).
- `suggestTopics`, `knownSpelling` (`lib/sujets.js`) ; `verifier-sujets.mjs` (10 cas).

**Vérifié.** Essai navigateur 2.9 vert ; 2.4, 2.6, 2.7, 2.8 verts ; serveur 553 tests ; tous les vérificateurs verts. Pas de CI Windows lancée : pas publié.

**Reste.** Publier (version 2.9.0, nouveautés) sur décision du propriétaire.

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
