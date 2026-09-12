# Clarity — gestionnaire de tâches IA

Application de gestion de tâches **Electron + React** avec backend IA local,
pensée pour Windows d'abord.

| Chemin | Contenu |
|---|---|
| `app/` | Le code complet — `frontend/` (React + Vite), `backend/` (Express), `electron/` (shell) |
| `design-handoff/` | Références de design : 31 maquettes `.jsx`, jetons, spécimen typographique, plus son propre `CLAUDE.md` de conventions visuelles |
| `CLAUDE.md` | Spec technique : architecture, modèle de données, endpoints, invariants |

`design-handoff/` était auparavant dans `app/`, où rien ne le référençait :
`electron-builder` ne l'embarque pas (voir `files` et `extraResources` dans
`app/package.json`), et aucun module de l'application ne l'importe. Ce sont des
documents de conception, pas du code exécuté — ils vivent donc à côté de l'app,
pas dedans.

## Lancer l'app

```bash
cd app
npm run setup      # première fois : dépendances, build du frontend, icônes
npm start          # lance l'application Electron
```

En développement (rechargement à chaud) :

```bash
cd app/frontend && npm run dev     # serveur Vite sur :5173
cd app/backend  && node server.js  # API Express sur :3001
```

Sous Windows, `app/start.bat` fait la même chose en double-cliquant.

## Provenance

Le code vient de la branche aujourd'hui gelée sous
`archive/project-organization-app-wYkaf`, où il est resté non fusionné.
`CLAUDE.md` se trouvait à la racine du dépôt, où il décrivait
ce projet comme s'il documentait le dépôt entier ; il est maintenant à côté du
code qu'il décrit. Sa section « Git » et ses chemins ont été corrigés depuis :
elle pointe `main` et `projet-clarity/app/`.

## Ancêtre abandonné

Un dossier `project-organizer/` — version antérieure du même projet, avant sa
refonte en Clarity — existe encore sur les branches gelées
`archive/project-organization-app-SpYsE` (37 fichiers) et
`archive/project-organization-app-wYkaf` (17 fichiers). Il n'a **pas** été
rapatrié : Clarity le remplace intégralement. À récupérer sur ces branches si
besoin — elles sont gelées, on n'y pousse pas.
