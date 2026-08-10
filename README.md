# Clarity — gestionnaire de tâches IA

Application de gestion de tâches **Electron + React** avec backend IA local,
pensée pour Windows d'abord.

| Chemin | Contenu |
|---|---|
| `app/` | Le code complet — `frontend/` (React + Vite), `backend/` (Express), `electron/` (shell) |
| `CLAUDE.md` | Spec technique : architecture, modèle de données, endpoints, invariants |

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

Le code vient de la branche `claude/project-organization-app-wYkaf`, où il est
resté non fusionné. `CLAUDE.md` se trouvait à la racine du dépôt, où il décrivait
ce projet comme s'il documentait le dépôt entier ; il est maintenant à côté du
code qu'il décrit.

Deux points de sa section « Git » sont désormais faux : le développement ne se
fait plus sur `claude/project-organization-app-wYkaf`, et les chemins qu'elle
donne (`clarity/`) sont devenus `projet-clarity/app/`.

## Ancêtre abandonné

Un dossier `project-organizer/` — version antérieure du même projet, avant sa
refonte en Clarity — existe encore sur les branches
`claude/project-organization-app-SpYsE` (37 fichiers) et
`claude/project-organization-app-wYkaf` (17 fichiers). Il n'a **pas** été
rapatrié : Clarity le remplace intégralement. À récupérer sur ces branches si
besoin.
