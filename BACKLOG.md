# Clarity — à traiter, pas encore fait

Deux demandes posées pendant le développement de l'étape 3, notées ici plutôt
que laissées à la mémoire d'une conversation.

---

## 1. Le modèle local est très lent

Constat de l'utilisateur : lenteur marquée dès qu'un prompt part ou qu'une
décision se prend. Pistes vérifiables dans le code, de la plus probable à la
moins, **aucune n'est encore mesurée** — le premier travail est de chronométrer,
pas de corriger au jugé.

1. **`keep_alive` n'est jamais envoyé.** Ollama décharge le modèle de la mémoire
   au bout de 5 minutes d'inactivité par défaut. Chaque prompt qui suit une pause
   paie donc le rechargement complet du modèle avant le premier jeton. Sur un
   usage par à-coups — ce qu'est Clarity — c'est le suspect numéro un, et
   `keep_alive: '30m'` dans `OllamaProvider` coûte une ligne.
2. **Aucun préchauffage au démarrage.** La première utilisation après le
   lancement paie toujours le chargement à froid. Un ping au démarrage le
   déplacerait hors du chemin critique.
3. **`generateJSON` ne diffuse pas** (`stream: false`). L'analyse et
   l'élicitation n'affichent rien jusqu'à la fin. Une partie de « c'est lent »
   est ici : le temps d'attente est réel mais l'absence de retour le double
   dans la perception.
4. **`num_predict: 1024` partout**, y compris là où la réponse attendue fait
   trois lignes de JSON. Le modèle a le droit de parler longtemps.
5. **`num_ctx` jamais fixé.** Le prompt d'analyse embarque toutes les tâches ;
   au-delà du contexte par défaut, Ollama retraite au lieu de réutiliser.
6. **Le modèle par défaut est `gemma4:latest`.** La taille du modèle domine tout
   le reste. Un modèle plus petit ou plus quantifié pour les appels structurés
   (analyse, découpage, élicitation) changerait l'ordre de grandeur, là où le
   chat peut garder le gros modèle.

Ordre de travail : mesurer d'abord (temps au premier jeton vs temps total, à
froid vs à chaud), puis 1 et 2, puis 3.

---

## 2. Partager le projet avec un ami informaticien

**À ne surtout pas faire : ajouter un collaborateur sur `princeraph/Personal-Work`.**

Ce dépôt est privé pour une raison précise, écrite dans son `CLAUDE.md` : il
contient la logistique du mariage et des coordonnées bancaires. Un collaborateur
ajouté ici y a accès, ainsi qu'à l'historique complet des autres projets. Le
partage doit porter sur Clarity seul.

Le dépôt a déjà fait exactement cette opération une fois, pour Bara et Laya :
extraction par `git subtree split` du seul chemin du projet vers
`princeraph/Business-Project`. C'est le modèle à suivre.

Esquisse, à valider avant exécution :

1. `git subtree split --prefix=projet-clarity -b export/clarity` — une branche
   qui ne contient que l'historique de Clarity, sans rien des autres projets.
2. Relire cette branche avant publication : vérifier qu'aucun fichier de données
   réelles (`backend/data/tasks.json`, une `settings.json` avec une clé d'API,
   un `.ics`) n'est dans l'historique. Un secret retiré au dernier commit reste
   dans les commits précédents.
3. Pousser vers un nouveau dépôt `princeraph/clarity`, privé, et y inviter l'ami.
4. Y porter ce qui rend le dépôt travaillable par quelqu'un d'autre : un README
   d'installation, `CONTRIBUTING`, la barrière de qualité (`qualite.json` existe
   déjà), et les tests — 121 aujourd'hui.
5. Décider du sens de retour : ses corrections arrivent par pull request sur
   `princeraph/clarity`, et sont ramenées ici par `git subtree pull`. À décider
   aussi : ce dépôt-ci reste-t-il la source de vérité, ou l'autre le devient-il.

Point ouvert : `frontend/dist/` est versionné exprès. Un contributeur externe
qui modifie `frontend/src/` doit reconstruire et committer `dist/` dans le même
commit, sinon l'app continue de servir l'ancien code. À écrire noir sur blanc
dans le `CONTRIBUTING`, c'est le piège le plus facile à tomber dedans.
