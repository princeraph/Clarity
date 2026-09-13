# Clarity — à traiter, pas encore fait

Deux demandes posées pendant le développement de l'étape 3, notées ici plutôt
que laissées à la mémoire d'une conversation.

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

**`backend/tools/mesurer-modele.mjs`** sépare chargement, lecture et écriture,
et signale explicitement un rechargement survenu alors que le modèle aurait dû
rester chaud — c'est le poste le plus cher et le plus facile à ne pas voir.

Reste possible si ça gêne encore : `generateJSON` ne diffuse toujours pas, donc
l'attente de l'analyse n'a aucun retour à l'écran. À 80 jetons/s ça fait une
dizaine de secondes muettes.

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
