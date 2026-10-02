# Clarity — gestionnaire de tâches IA

Application de gestion de tâches **Electron + React** avec backend IA local,
pensée pour Windows d'abord.

| Chemin | Contenu |
|---|---|
| `app/` | Le code complet — `frontend/` (React + Vite), `backend/` (Express), `electron/` (shell) |
| `design-handoff/` | Références de design : 31 maquettes `.jsx`, jetons, spécimen typographique, plus son propre `CLAUDE.md` de conventions visuelles |
| `CLAUDE.md` | Spec technique : architecture, modèle de données, endpoints, invariants |
| `CONTRIBUTING.md` | Les règles pour y toucher — dont celle qui casse le plus vite : `dist/` se recommite avec `src/` |
| `JOURNAL.md` | Ce qui a été fait et mesuré, session par session — le point d'entrée pour une relecture |
| `BACKLOG.md` | Ce qui reste ouvert, sans rien cacher |

`design-handoff/` était auparavant dans `app/`, où rien ne le référençait :
`electron-builder` ne l'embarque pas (voir `files` et `extraResources` dans
`app/package.json`), et aucun module de l'application ne l'importe. Ce sont des
documents de conception, pas du code exécuté — ils vivent donc à côté de l'app,
pas dedans.

## Prérequis

**Node.js 18+** et **[Ollama](https://ollama.com)** avec un modèle chargé. Sans
Ollama, l'app démarre, les tâches se créent et s'éditent normalement, mais tout
ce qui passe par le modèle reste muet : analyse, suggestions, fils de suivi,
« Demander à Clarity ». En bas de la barre latérale, la pastille verte passe
alors au gris et le texte devient « IA hors ligne — toucher pour corriger » :
c'est le premier endroit à regarder si l'IA ne répond pas, et un clic y mène
directement aux réglages.

```bash
ollama pull gemma4:latest     # le modèle attendu par défaut
ollama serve                  # écoute sur http://localhost:11434
```

Un autre modèle, ou un fournisseur distant (OpenAI, Anthropic, OpenRouter), se
règle dans Réglages → *Assistant IA* sans toucher au code.

## Lancer l'app

```bash
cd app
npm run setup      # première fois : dépendances des trois paquets
npm start          # lance l'application Electron
```

En développement (rechargement à chaud) :

```bash
cd app/frontend && npm run dev     # serveur Vite sur :5173
cd app/backend  && node server.js  # API Express sur :3001
```

Sous Windows, `app/start.bat` fait la même chose en double-cliquant.

### Deux façons de lancer Clarity — un seul jeu de tâches

| | **Clarity** (installée) | **Clarity (dev)** |
|---|---|---|
| Ce que c'est | L'app produite par `npm run build`, installée par `Clarity Setup x.y.z.exe` | L'app lancée depuis ce dossier (`start.bat`, `Clarity.vbs`) |
| Pour quoi | L'usage de tous les jours | Essayer une modification du code |
| Se met à jour | `app/Update.bat` — met à jour les deux | `git pull` suffit |

Les deux lisent **les mêmes tâches** (`%APPDATA%\Clarity\data`) et **ne tournent
jamais en même temps** : lancer l'une pendant que l'autre est ouverte ramène
simplement la fenêtre déjà ouverte. `Update.bat` demande de fermer Clarity, tire
les nouveautés, reconstruit l'installateur et réinstalle en silence — vos tâches
ne sont pas touchées, elles vivent hors du dossier d'installation.

**Pas d'étape de build à l'installation, et c'est voulu.** `frontend/dist/` est
versionné : l'app tourne depuis un clone nu. Le reconstruire à l'installation ne
produirait rien de neuf, mais salirait un dossier suivi par git — et le prochain
`git pull` serait refusé. Qui modifie `frontend/src/` reconstruit avec
`npm run build:frontend` et commite `dist/` dans le même commit.

## Provenance

Le code vient de la branche aujourd'hui gelée sous
`archive/project-organization-app-wYkaf`, où il est resté non fusionné.
`CLAUDE.md` se trouvait à la racine du dépôt, où il décrivait
ce projet comme s'il documentait le dépôt entier ; il est maintenant à côté du
code qu'il décrit. Sa section « Git » et ses chemins pointent ce dépôt-ci et
`app/`.

## Ancêtre abandonné

Un dossier `project-organizer/` — version antérieure du même projet, avant sa
refonte en Clarity — existe encore sur les branches gelées
`archive/project-organization-app-SpYsE` (37 fichiers) et
`archive/project-organization-app-wYkaf` (17 fichiers). Il n'a **pas** été
rapatrié : Clarity le remplace intégralement. À récupérer sur ces branches si
besoin — elles sont gelées, on n'y pousse pas.
