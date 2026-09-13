# Clarity — à traiter, pas encore fait

Deux demandes posées pendant le développement de l'étape 3, notées ici plutôt
que laissées à la mémoire d'une conversation.

---

## 1. ~~Le modèle local est très lent~~ — fait

Mesuré, corrigé, vérifié. Ce qui a été trouvé, dans l'ordre de ce que ça coûtait :

1. **La sortie demandée grandissait avec la liste.** L'analyse réclamait deux ou
   trois phrases de raisonnement et un plan en trois étapes pour CHAQUE tâche,
   en un seul appel non diffusé : environ 2000 jetons de sortie à vingt tâches,
   soit plus de deux minutes à vitesse locale typique, sans rien à l'écran.
   Un modèle local passe son temps à ÉCRIRE, pas à lire. Désormais : une phrase
   et deux étapes par tâche, et seules les douze tâches qui pourraient
   plausiblement être « la prochaine » sont envoyées.
2. **`num_ctx` n'était jamais fixé.** Au-delà du contexte par défaut (2048 pour
   beaucoup de modèles), Ollama ne proteste pas : il coupe le DÉBUT du prompt.
   Le prompt d'analyse dépassait 2048 jetons vers quinze tâches — le modèle ne
   voyait donc plus les plus anciennes, en plus d'être lent. Calculé par appel
   maintenant, plancher 2048, plafond 8192.
3. **`keep_alive` n'était jamais envoyé.** Ollama décharge le modèle après cinq
   minutes d'inactivité ; Clarity s'utilise par à-coups, donc presque chaque
   requête payait un rechargement complet avant son premier jeton. Réglable
   (Réglages → Assistant IA → Connexion), 30 min par défaut.
4. **`num_predict` valait 3072 partout**, y compris là où la réponse fait trois
   lignes de JSON. Chaque appel le dimensionne maintenant à ce qu'il attend.
5. **Aucun préchauffage.** La première question de la session payait le
   chargement pendant que la personne regardait un spinner. Fait au démarrage,
   en silence, et sans empêcher l'app de démarrer s'il échoue.

Gain calculé sur l'analyse, à 15 jetons/s : 28 % à dix tâches, 57 % à vingt,
78 % à quarante — plus les 8 à 15 secondes de rechargement évitées par rafale.

**`backend/tools/mesurer-modele.mjs`** mesure sur la vraie machine : Ollama
renvoie ses propres chronos, donc rien n'est estimé. Il sépare chargement,
lecture et écriture, ce qui dit tout de suite lequel des trois fait mal.

Reste possible si c'est encore lent : `generateJSON` ne diffuse toujours pas
(l'attente est réelle, mais l'absence de retour la double dans la perception),
et un modèle plus petit pour les appels structurés changerait l'ordre de
grandeur là où le chat peut garder le gros.

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
