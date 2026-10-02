# Clarity — journal

Ce que le projet a traversé, dans l'ordre, avec les chiffres mesurés plutôt
qu'estimés. Trois fichiers se partagent le travail et ne se recouvrent pas :

- `README.md` — ce qu'est Clarity et comment le lancer
- `CONTRIBUTING.md` — les règles pour y toucher
- `BACKLOG.md` — ce qui reste ouvert
- **ce fichier** — ce qui a été fait, et ce que ça a appris

---

## État au 2 octobre 2026

    dépôt            princeraph/clarity (privé) · branche de production : main
    tests backend    218, en 10 suites — 1,5 s
    contrôles        4, déclarés dans app/qualite.json
    intégration      .github/workflows/ci.yml, verte
    build requis     aucun — frontend/dist/ est versionné, l'app tourne d'un clone nu

Les quatre contrôles, reproductibles tels quels :

```bash
cd app/backend  && npm install && npm test        # 218 tests
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

Les autres propositions de l'audit sont dans `BACKLOG.md` § 4, avec ce
qu'elles protègent réellement — l'une d'elles y est rétrogradée : un jeton d'API
ne protège pas contre un programme du même compte, qui lit les fichiers
directement.

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
