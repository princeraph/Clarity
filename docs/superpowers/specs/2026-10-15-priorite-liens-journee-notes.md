# Notes de conception — priorité, liens, journée réaliste (après le lot 1)

Décisions prises avec l'utilisateur les 13–15 octobre 2026, à transformer en
spécification au début du lot concerné. Ordre retenu (option A) : 1.7 lot 1
(promesses), 1.8 priorité et liens, puis journée réaliste, rappels, ordre et
mouvement, sortie publique.

## Ce qui existe (vérifié dans le code, 1.6.2)

L'analyse IA renvoie par tâche `priorityLevel` (high/medium/low), `dependencies`
(≤ 3), `relatedTasks` (≤ 3), `relationshipNote`. Le niveau ne sert qu'au badge
« Focus » ; les dépendances s'affichent dans le détail et le graphe ;
`relatedTasks` et `relationshipNote` nulle part. Tout est recalculé à chaque
analyse, rien n'est enregistré ni modifiable, rien sans assistant, et une tâche
bloquée ne recule pas.

## Priorité

- Six niveaux sur la tâche : Priorité absolue, Très haute, Haute, Moyenne,
  Basse, Très basse ; absent = l'IA décide. Marqueur coloré sur la carte.
- Réglé par : menu contextuel, détail, formulaire, saisie (`!1` … `!6`),
  connecteur.
- Le niveau de la personne passe toujours devant ; l'IA ordonne à l'intérieur
  d'un niveau. L'IA peut suggérer un niveau, jamais l'appliquer seule.

## Liens

- Deux types : « bloque / bloquée par » (orienté) et « liée à ».
- Enregistrés sur la tâche (stables, synchronisés, modifiables).
- Force d'un blocage : « impossible avant » ou « mieux avant ». L'IA justifie
  la force proposée.
- L'IA propose (Confirmer / Ignorer). **Ignorer = pas maintenant** : la
  suggestion revient si l'une des deux tâches change (texte, échéance, niveau)
  ou après 60 jours. « Jamais pour ces deux tâches » existe à part.
- Ajout manuel depuis le détail. Carte : « bloquée par 1 » / « débloque 2 ».
- Effets, calculés par du code pur et testé (pas par l'IA, marche sans elle) :
  tâche bloquée en dessous et jamais « à faire en premier » ; un bloquant hérite
  du niveau et de l'échéance de ce qu'il bloque (« hérité de Y », « avant le 18,
  pour Y ») ; « Y est débloquée » à la fin d'un bloquant ; cycles refusés.

## Temps et difficulté

- Durée : existe. Difficulté 1–5 à ajouter, estimée par l'IA si absente.
- « Bloquant trop lourd » : long et difficile, bloque du court → proposer de
  découper, ou de passer le lien en « mieux avant ».
- « Drop » = **descendre**, jamais abandonner : une tâche qui traîne, ne
  débloque rien et coûte cher est proposée plus bas.

## Graphe

Mouvement saccadé aujourd'hui. Mesurer la cause (calcul par image ? positions
remises à zéro à chaque rafraîchissement de 5 s ?) avant de corriger.

## Journée réaliste (ex-« Blocking »)

Ce qui fait perdre la journée, selon l'utilisateur : sous-estimer le temps, ne
pas savoir quoi faire ensuite, ne pas savoir quoi repousser ni quoi faire en
même temps. Réponse : pas une section de plus, mais Aujourd'hui qui devient le
plan de la journée.

- Durées corrigées par l'écart mesuré dans Tendances (biais d'estimation).
- Capacité de la journée → ce qui tient, ce qui descend (et pourquoi).
- Une seule « prochaine tâche », qui respecte les blocages.
- Regroupements « en même temps » : même sujet, tâches courtes, attentes.
- Proposé en aperçu, accepté par la personne ; se replace quand un bloc déborde.
- Risques nommés : plan qui casse dans la matinée, doublon avec Aujourd'hui,
  durées fausses — chacun a sa parade ci-dessus.
