# Lot E — ce que le propriétaire a trouvé en se servant de la 2.10.0 (30 octobre 2026)

Retours du propriétaire sur ses propres tâches, avec captures. Décisions prises
avec lui le 30 octobre. À faire en deux sessions : E1 puis E2.

## Constats (vérifiés dans le code le 30 oct.)

1. **Deux éditeurs de tâche.** Cliquer le *titre* d'une carte ouvre
   `TaskDetailPanel` (panneau à droite, où les sous-tâches s'ouvrent en page —
   2.8.0). Le bouton **Edit** ouvre `TaskForm` (formulaire centré), où une
   sous-tâche ne peut que se supprimer. Le propriétaire passait par Edit et n'a
   jamais vu la 2.8.0. `App.jsx` : `openEditTask` (l. ~519), `openDetail` (l. ~520).
2. **Passer d'une tâche à une autre** (page d'un sujet) ferme puis rouvre le
   panneau au lieu de remplacer son contenu.
3. **Le petit cercle** devant une tâche, dans la page d'un sujet
   (`TopicDetailView`, `TaskRow`), ouvre la tâche au lieu de la cocher.
4. **Tâches finies dans les sujets** : groupe « Done » dans `TopicDetailView`
   (l. ~242). Le propriétaire : leur place est History et Archive.
5. **History s'arrête au 10 octobre.** Rien n'est purgé par date : `HistoryView`
   ne montre que les tâches *encore* `done` ou archivées. Une tâche supprimée
   disparaît ; une tâche répétée (quotidienne) repasse à « à faire » et ses fins
   passées ne s'affichent jamais.
6. **« + New task » et Ctrl+K** ouvrent la même palette (`SearchCapture`) :
   Entrée ouvre le premier résultat de recherche, créer demande **Tab**.
   Personne ne le devine.
7. Le lot D existe mais n'a pas été trouvé : l'interface est en anglais
   (Plan my day / End my day en haut de Today, boîte « Quick », Someday dans la
   barre). Le doc de suivi les nommait en français sans dire où cliquer.

## E1 — une seule fenêtre de tâche (≈ 80 k jetons, Opus) — fait le 30 oct., voir JOURNAL

- **Une seule fenêtre de tâche, au centre** (modèle « aperçu » de Notion) :
  chaque champ se modifie sur place et s'enregistre seul. **Edit** et le clic
  sur la carte ouvrent cette fenêtre. `TaskForm` ne sert plus qu'à la création,
  ou disparaît s'il n'apporte plus rien — un seul éditeur, pas deux.
- **Une sous-tâche s'ouvre dans la même fenêtre**, à la place de la tâche, avec
  un fil « Self Teaching › Fitness Coaching » et une flèche retour (Échap = retour
  à la tâche). **Réponse du propriétaire (30 oct.) : les deux côte à côte**,
  dans la même fenêtre ; en écran étroit, la sous-tâche prend la place.
- **Cliquer une autre tâche** pendant qu'une est ouverte remplace le contenu
  sur place, sans fermer ni rouvrir.
- **Le petit cercle coche** la tâche, partout (sujet compris) ; seul le titre ouvre.
- Le style que le propriétaire aime : la carte centrée de la capture
  (« What needs doing? »).
- Décider ce que devient le panneau droit de la 2.8.0 et l'écran étroit (2.10.0) :
  la fenêtre centrale les remplace probablement.
- Pas d'ingénierie inverse de Notion : le comportement ci-dessus suffit.

## E2 — historique, sujets, création (≈ 60 k jetons) — fait le 30 oct., voir JOURNAL

- **Historique permanent** : chaque fin de tâche est inscrite (journal du
  serveur) et jamais effacée, y compris les tâches répétées et les tâches
  supprimées ensuite. History lit ce registre, mois par mois.
- **Sujets** : les tâches finies sortent de la page du sujet et des compteurs ;
  un lien « Voir les finies » mène à History filtré sur le sujet.
- **« + New task »** ouvre directement la création. **Ctrl+K** : dès qu'on tape,
  la première ligne devient « Créer « … » » et Entrée crée.

## Règle de fin de lot (nouvelle, 30 oct.)

Chaque lot se termine par deux lignes « **où cliquer** » pour le propriétaire,
dans la langue de son interface (anglais aujourd'hui). Une ligne du doc de
suivi n'est cochée qu'après sa vérification de 5 minutes.
