# Clarity — à traiter, pas encore fait

Deux demandes posées pendant le développement de l'étape 3, notées ici plutôt
que laissées à la mémoire d'une conversation.

Ce fichier ne garde que **ce qui n'est pas réglé** — § 4. Ce qui a été fait, et
ce que ça a appris, est dans `JOURNAL.md`.

---

## 1. ~~Le modèle local est très lent~~ — fait, et mesuré sur la vraie machine

Mesure du 13/09 (gemma4, machine de l'utilisateur) :

    chargement   ~9 000 ms
    écriture     66 à 95 jetons/s
    lecture      ~2 500 jetons/s

**Le modèle n'est pas lent. Le chargement l'est.** À 80 jetons/s, neuf secondes
de chargement valent plus de 700 jetons écrits : tant qu'un rechargement traîne
dans le tableau, rien d'autre ne compte.

Ce qui a été corrigé :

1. **`keep_alive` n'était jamais envoyé.** Ollama décharge après cinq minutes
   d'inactivité, et Clarity s'utilise par à-coups : presque chaque requête
   repayait les neuf secondes. Réglable (Réglages → Assistant IA → Connexion).
2. **`num_ctx` doit être CONSTANT.** Première version : calculé par appel, pour
   éviter que Ollama ne coupe silencieusement le début d'un prompt trop long.
   La mesure a montré que c'était pire que le mal — `num_ctx` fait partie du
   CHARGEMENT du modèle, pas de la requête. Le faire varier évince le modèle
   résident et le recharge : 8 à 9 secondes constatées, sur les appels mêmes
   qu'on voulait accélérer. Une seule valeur partout (8192), assez grande pour
   le plus gros prompt que Clarity compose.
3. **Aucun préchauffage.** La première question de la session payait le
   chargement pendant qu'on regardait un spinner. Fait au démarrage, avec le
   même `num_ctx` que les appels réels — sinon le premier vrai appel recharge
   ce que le préchauffage vient de charger.
4. **La sortie demandée n'était bornée par rien.** L'analyse réclamait un
   paragraphe de raisonnement et un plan en trois étapes pour CHAQUE tâche.
   Une phrase et deux étapes maintenant, sur les douze tâches qui pourraient
   plausiblement être « la prochaine » — choisies par échéance, donc par
   arithmétique, jamais par un modèle.
5. **`num_predict` valait 3072 partout**, y compris pour trois lignes de JSON.

Avec les chiffres mesurés, une analyse après une pause : ~22 s → ~9 s à dix
tâches, ~34 s → ~11 s à vingt, ~57 s → ~11 s à quarante. Une réponse de chat
après une pause : ~10 s → moins d'une seconde.

### Vérifié après correction (même machine, 13/09)

                              avant              après
    à froid            11 277 ms load      6 794 ms load   (normal)
    court, chaud            7 ms                6 ms
    prompt long         8 922 ms load  ←reload  6 ms
    sortie longue       8 350 ms load  ←reload  2 ms

17,3 s de rechargements disparus sur cette seule séquence de quatre appels. La
ligne « prompt long, sortie courte » — la forme même de l'analyse — passe de
9 840 ms à 687 ms.

Ce qui reste est du vrai travail de génération : écrire 400 jetons à ~60 j/s
prend 6,8 s, et aucun réglage n'y changera rien. Les trois appels non diffusés
qui subsistent (analyse, élicitation, pistes d'un fil) sont désormais bornés à
840, 700 et 300 jetons, et affichent tous un indicateur pendant l'attente —
l'analyse tourne en plus en arrière-plan, sans rien bloquer. Diffuser
`generateJSON` reste possible, mais ne gagnerait plus que de la perception.

**`backend/tools/mesurer-modele.mjs`** sépare chargement, lecture et écriture,
et signale explicitement un rechargement survenu alors que le modèle aurait dû
rester chaud — c'est le poste le plus cher et le plus facile à ne pas voir.

Reste possible si ça gêne encore : `generateJSON` ne diffuse toujours pas, donc
l'attente de l'analyse n'a aucun retour à l'écran. À 80 jetons/s ça fait une
dizaine de secondes muettes.

---

## 2. Partager le projet avec un ami informaticien — FAIT

Ce dépôt EST le résultat. `princeraph/clarity`, privé, extrait de
`princeraph/Personal-Work` par `git subtree split --prefix=projet-clarity`.
Reste à inviter l'ami dans Settings → Collaborators.

**Pourquoi l'extraction plutôt qu'un collaborateur sur Personal-Work :** ce
dépôt-là est privé pour une raison précise — il contient la logistique du
mariage et des coordonnées bancaires. Un collaborateur y a accès, ainsi qu'à
l'historique complet des autres projets. Le partage devait porter sur Clarity
seul, et c'est le modèle déjà appliqué une fois pour Bara et Laya vers
`princeraph/Business-Project`.

**L'audit d'historique, avant publication.** 177 chemins distincts, 35 commits.
Aucun motif de secret (`sk-`, `sk-ant-`, `ghp_`, `AKIA`, clé privée). Aucun
fichier de données réelles : `tasks.json`, `settings.json`, `profile.json`,
`journal`, `.ics`, `threads.json`, `suggestions.json` n'ont jamais été commités
— seul `seed-tasks.json`, qui est de la démo. Un secret retiré au dernier commit
reste dans les précédents : c'est pourquoi l'audit porte sur l'historique
entier, pas sur l'arbre de travail.

**Trois choses cassaient pour quiconque clone ailleurs, corrigées avant
publication plutôt que documentées :**

1. Six scripts Windows pointaient en dur vers
   `%USERPROFILE%\Personal-Work\projet-clarity\app`. Ils se repèrent
   maintenant par rapport à eux-mêmes (`%~dp0`, `$PSScriptRoot`,
   `ScriptFullName`), ce qui marche dans les deux dépôts.
2. L'invariant correspondant visait la mauvaise propriété : il vérifiait qu'un
   chemin en dur restait *juste*, il refuse désormais *tout chemin absolu*.
3. `qualite.json` appelait `../../.github/qualite/`, hors du dossier. Le
   contrôle vit maintenant dans `app/tools/verifier-paquet.mjs` — un projet qui
   vit seul porte ses propres outils.

**Ce qui voyage avec l'extraction :** `.github/workflows/ci.yml`, inerte dans
Personal-Work (GitHub ne lit les workflows qu'à la racine d'un dépôt) et actif
ici. Elle relance le build du frontend et compare `dist/`, parce qu'un `dist/`
à moitié commité fait tourner l'app sur l'ancien code pendant que la revue lit
le nouveau. Plus `CONTRIBUTING.md`, qui ouvre sur cette règle-là précisément.

**Source de vérité : ce dépôt.** Le sens de retour vers Personal-Work est
décrit en fin de `CONTRIBUTING.md` (`git subtree pull`). Les corrections de
l'ami arrivent par pull request ici.

---

## 3. La boucle du profil ne pouvait pas se fermer — FAIT

Les étapes 2b, 3 et 4 — élicitation, fils de suivi, suggestions — reposent
toutes sur le profil, et le profil sur ses métriques. La métrique phare, le
biais d'estimation, exige par tâche une **estimation** ET un **temps mesuré**,
sur cinq tâches (`MIN_SAMPLES`). Trois défauts en série empêchaient d'y
arriver, chacun invisible seul.

**1. Aucun champ pour l'estimation.** `estimatedDuration` n'apparaissait pas une
seule fois dans `TaskForm.jsx`. La seule entrée était la syntaxe `~2h` de la
saisie rapide. Le champ existe maintenant (nombre + unité), entre Récurrence et
Livrable.

**2. La saisie rapide ne comprenait que l'anglais** — et plantait à
l'ouverture. `SearchCapture` appelait `t()` dix-sept fois sans `useLocale()` :
Ctrl+K levait « t is not defined » dans la version publiée. Le contrôle des
locales, fait pour attraper exactement ça, ne le voyait pas : son motif exigeait
la parenthèse fermante des paramètres sur la même ligne, et ce composant
destructure ses props sur deux. Son corps était donc rattaché à la fonction
précédente, qui a le hook. **Le trou se masquait lui-même et le contrôle
annonçait « aucun écart ».** Il compte les parenthèses maintenant.

**3. Une des trois issues du biais ne disait jamais rien.** `estimationBias`
rend `under`, `accurate` ou `over` ; `deriveInsights` traitait les deux
premières. Quelqu'un qui met de la marge dans ses estimations (ratio ≤ 0,80)
pouvait chronométrer cinquante tâches et voir un profil vide à jamais — la
confusion même que `MIN_SAMPLES` existe pour éviter, réintroduite un étage plus
haut. Les tests avaient le même angle mort, ce qui explique qu’il soit passé
inaperçu.

**Mesuré de bout en bout**, cinq tâches estimées à 60 min et chronométrées :

```
timer start → stop        timeTracked = 1 min
×5                        samples=5, enough=true, bias=over
constat                   traits | « You finish in about 0.02× the time you
                          plan » | confiance 0,6 | preuve
                          observed.estimation.medianRatio
```

Avant la correction : zéro constat sur les mêmes données.

**Piège de lecture, pour la prochaine session.** `understanding` est structuré
**par catégorie** — `traits`, `drivers`, `blockers`, `strengths`, `skills`,
`context`. Il n'y a pas de tableau `insights`. J'ai cru la tuyauterie cassée
pendant vingt minutes en lisant un champ qui n'existe pas.

---

## 4. Ce qui reste ouvert

**Pas de lanceur de tests côté frontend.** `splitEstimate` / `joinEstimate`
(`TaskForm.jsx`) sont vérifiées, pas gardées. Les deux contrôles maison
(`verifier-locales.mjs`, `verifier-saisie.mjs`) couvrent leur domaine, mais rien
ne teste un composant React. À décider si ça vaut la dépendance.

**`generateJSON` ne diffuse toujours pas.** Les trois appels non diffusés
(analyse, élicitation, pistes d'un fil) sont bornés à 840, 700 et 300 jetons et
affichent tous un indicateur. À ~80 jetons/s, ça fait une dizaine de secondes
muettes. Perception seulement.

**L'installateur n'a jamais été produit.** `npm run build` lance
`electron-builder` avec une configuration NSIS présente dans `package.json`,
jamais exécutée. C'est ce qui rendrait Clarity installable sans environnement de
développement. Le 2 octobre, deux défauts qui l'auraient livré cassé ont été
corrigés sans lui (backend lancé avec le Node du système, dépendances du backend
exclues — voir `JOURNAL.md`). Le même jour, **construit pour la première fois sous Windows**, installé et
lancé : le port 3001 est tenu par `Clarity.exe`, pas par `node.exe` — le
backend tourne sur le Node d'Electron. Reste, **avant de le confier à
quelqu'un** : l'essayer sur un Windows vierge (machine virtuelle — Windows
Famille n'a pas Windows Sandbox), et monter Electron d'abord.

**Le biais par domaine ne rapporte que `under`.** `deriveInsights` filtre
`v.bias !== 'under'` dans sa boucle `byArea`, là où le global couvre désormais
les trois cas. Volontaire pour l'instant — les blocages par domaine sont les
actionnables — mais l'asymétrie est à assumer ou à lever.

### Proposés par l'audit du 2 octobre, pas encore faits

Classés par ce qu'ils protègent réellement, pas par l'étiquette de l'audit.

**Electron 28 n'est plus maintenu** (Chromium sans correctifs). À monter avant
toute diffusion. Le risque immédiat est réduit — l'app ne charge que ses propres
fichiers, navigation verrouillée — mais il ne doit pas partir chez quelqu'un
d'autre. Demande un essai à la main sous Windows (deux fenêtres, plateau,
instance unique, notifications) : à faire avec la construction de
l'installateur, pas avant.

**La clé d'API cloud est en clair dans `settings.json`.** Réel, mais à mesurer :
seuls les fournisseurs cloud en ont une, et l'usage par défaut est Ollama, sans
clé. La correction (`safeStorage`, la clé tenue par le processus principal) est
propre et coûte 2–3 h. Avant de vendre, oui ; pas urgent pour l'usage actuel.

**Un jeton d'API par lancement.** L'audit le classe « High » contre « n'importe
quel processus local ». C'est surévalué : un programme qui tourne sous le même
compte lit `%APPDATA%\Clarity\data\tasks.json` directement, jeton ou pas. Ce que
le jeton protège vraiment, c'est l'accès depuis un **autre compte Windows** de
la même machine — le port 3001 leur est ouvert. Cas réel sur un PC partagé, rare
sinon. Coût : ~50 appels `fetch` dans 15 fichiers, plus un jeton dans l'URL des
sauvegardes. À faire si Clarity vise des postes partagés.

**Montrer la progression vers le premier constat.** Un nouvel utilisateur voit
une vue Motifs vide tant qu'il n'a pas cinq tâches estimées et chronométrées.
Une carte « 2 sur 5 » coûte une à deux heures et ne touche que le frontend.
C'est le moins cher des quatre et le seul qui change l'expérience.
