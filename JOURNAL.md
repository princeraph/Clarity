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
rangement : le dépôt d'origine est privé **parce qu'il contient la logistique
d'un mariage et des coordonnées bancaires**. Y inviter un relecteur, c'est lui
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

---

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
