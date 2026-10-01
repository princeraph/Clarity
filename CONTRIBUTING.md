# Contribuer à Clarity

Ce dépôt a été extrait de `princeraph/Personal-Work` par `git subtree split`,
pour qu'on puisse travailler sur Clarity sans hériter des autres projets — dont
certains contiennent des documents personnels qui n'ont rien à faire ici.

L'historique reprend au rangement du dépôt (10 août 2026). Ce qui précède vit
sur les branches `archive/*` de Personal-Work et n'a pas été repris : rien n'y
concerne le Clarity actuel, qui est une refonte.

---

## Ce qui casse le plus vite, et se voit le moins

### `frontend/dist/` est versionné EXPRÈS

Electron le charge au runtime (`electron/main.js`), donc l'application doit
tourner après un simple clone, sans étape de build. Ce n'est pas un oubli de
`.gitignore`.

**Conséquence : après toute modification de `frontend/src/`, reconstruire et
committer `dist/` dans le MÊME commit.**

```bash
cd app/frontend && npm run build     # puis git add dist/
```

Sans ça, l'application continue de servir l'ancien code pendant que la revue lit
le nouveau. La CI le vérifie — elle reconstruit et compare — mais mieux vaut ne
pas découvrir ça dans une pull request.

### Les scripts Windows se repèrent tout seuls

`start.bat`, `Update.bat`, `Seed.bat`, `setup.bat`, `Clarity.vbs`,
`Create-Desktop-Shortcut.ps1` utilisent `%~dp0`, `$PSScriptRoot` ou
`ScriptFullName`. **Ne jamais y remettre un chemin absolu** : ils ont vécu avec
`%USERPROFILE%\Personal-Work\projet-clarity\app` en dur, ce qui les cassait
silencieusement chez quiconque clonait ailleurs. C'est précisément ce que
l'extraction de ce dépôt rendait fatal.

### Deux fenêtres, un seul bundle

Electron ouvre la fenêtre principale ET la popup de la barre des tâches depuis
le même build Vite, distinguées par `#tray` dans l'URL. Tout ce qu'on ajoute à
`main.jsx` — un provider, un écouteur global, un import à effet de bord —
tourne aussi dans la popup, et un import lourd est payé deux fois.

---

## Lancer

```bash
cd app
npm run setup      # première fois : dépendances, build du frontend, icônes
npm start          # lance Electron

# en développement
cd app/frontend && npm run dev      # Vite sur :5173
cd app/backend  && node server.js   # Express sur :3001
```

Sous Windows : double-cliquer `app/start.bat`.

L'IA tourne en local via [Ollama](https://ollama.com) (`ollama serve`). Sans
lui, l'app fonctionne — elle affiche « AI is offline » et tout ce qui ne demande
pas de modèle continue de marcher.

---

## Avant de pousser

```bash
cd app/backend  && npm test                          # 204 tests
cd app/frontend && node tools/verifier-locales.mjs   # les deux langues
cd app          && node tools/verifier-paquet.mjs frontend/dist
```

La CI lance exactement ça, plus la reconstruction de `dist/`.

---

## Trois règles de conception qui ne sont pas négociables

Elles sont détaillées dans `CLAUDE.md`, avec leurs tests. Elles ne sont pas des
préférences de style : chacune existe parce qu'on a expédié son contraire et
que ça s'est mal passé.

1. **Un constat sans preuve citable est refusé.** `src/profile/insights.js`
   n'accepte aucune conclusion sur la personne sans `evidence` qui résout —
   un id de tâche qui existe, une entrée de journal qui existe, un chemin de
   métrique réellement présent. Une preuve inventée est pire qu'aucune : elle a
   l'air vérifiable.

2. **Un modèle propose, il ne conclut pas.** Une proposition n'entre dans le
   profil que par un clic de l'utilisateur (`POST /api/profile/proposals/:id/accept`).
   Rien d'autre n'écrit dans `understanding`.

3. **Une règle de silence l'emporte sur tout**, y compris une échéance dépassée
   (`src/suggest/policy.js`). Et demander s'il faut parler ne coûte jamais de
   budget — sinon la journée se vide pendant que Clarity reste muette.

Une métrique sous `MIN_SAMPLES` n'est pas un constat : elle s'affiche comme un
comptage, jamais comme une conclusion.

---

## Style

- **Aucune couleur en dur** dans le frontend : tout vient des jetons `T.*` de
  `ThemeContext`. L'exception délibérée est `TrayMenu`, qui a sa propre palette
  toujours sombre parce qu'il s'affiche contre la barre des tâches.
- **Aucune chaîne en dur non plus** : tout passe par `t('clé')`, et
  `verifier-locales.mjs` refuse une clé absente de l'un des deux dictionnaires.
  Une constante de module porte des clés, jamais du texte — sinon le libellé est
  figé au chargement et ne suit pas le changement de langue.
- Les commentaires disent **pourquoi**, pas quoi. Un commentaire qui paraphrase
  la ligne suivante est du bruit ; celui qui explique le défaut qu'on évite vaut
  dix lignes de documentation.

---

## Le lien avec Personal-Work est coupé — et doit le rester

Ce dépôt est la source de vérité pour Clarity, et la **seule**. Personal-Work a
supprimé son dossier `projet-clarity/`, retiré les deux invariants qui le
citaient et consigné le départ dans son README. Il n'y a plus rien à
synchroniser.

Une version précédente de ce fichier donnait ici une commande
`git subtree pull --prefix=projet-clarity` pour « remonter les corrections ».
**Ne pas la relancer.** Elle recréerait le dossier, donc le projet, dans un
dépôt privé qui contient la logistique d'un mariage et des coordonnées
bancaires — ce dont l'extraction visait précisément à sortir Clarity, pour
qu'on puisse l'ouvrir à un relecteur sans ouvrir le reste. Reprendre la
synchronisation annulerait ça sans rien dire.

L'historique d'avant l'extraction reste lisible des deux côtés : il est complet
ici, et Personal-Work en garde sa part. Aucun des deux dépôts ne dépend plus de
l'autre.
