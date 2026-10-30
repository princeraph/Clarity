# Clarity — pour qui, et ce qu'on promet

Document interne, tenu à jour à **chaque version publiée** (règle dans
`CLAUDE.md`). Il sert à décider : quoi construire, quoi refuser, quoi écrire sur
la page publique. Ce qui est **mesuré** est séparé de ce qui est **supposé**.

Dernière mise à jour : 29 octobre 2026 (2.9.0).

## 1. La personne visée — validée par le propriétaire le 29 octobre 2026

Une personne **seule** (pas une équipe) qui a trop de choses en tête et veut
**finir sa journée**, pas gérer des projets :

- indépendant·e, étudiant·e, ou personne qui jongle travail et vie perso ;
- souvent anxieuse face à une liste qui ne fait que s'allonger, parfois TDAH ;
- sur PC Windows ;
- qui tient à ce que ses tâches restent chez elle.

Ce qu'elle doit pouvoir dire (phrase-cible, reprise d'un client de Motion) :

> « Chaque jour, je finis ce qui compte. Ma liste ne s'allonge plus. »

Ce qu'elle ne cherche pas : gestion de projet d'équipe, prise de notes de
réunion, documents partagés. C'est le terrain de Motion, ClickUp, Notion.

## 2. Ce qui distingue Clarity

| Atout | Pourquoi ça compte | Statut |
|---|---|---|
| Privé et local : l'assistant tourne sur l'ordinateur | Sunsama et Motion sont dans le nuage | **Fait** (vérifié en CI : rien ne charge d'Internet) |
| Un plan du jour qui connaît votre vraie lenteur (écart mesuré estimation / temps réel) | Personne d'autre ne corrige les durées avec ses propres mesures | **Fait** depuis 2.0 ; utile seulement après 5 tâches chronométrées |
| Calme : Clarity se tait par défaut, une suggestion par jour au plus | Les avis de Sunsama louent l'absence de pression | **Fait** en 2.6.0 |
| Rituels : planifier le matin (avec « ça déborde »), terminer le soir, « Un jour » à part revu chaque mois, vider sa tête | C'est ce que les clients de Sunsama citent comme la cause du soulagement | **Fait** en 2.7.0 |
| Tâches rapides : un titre, une heure | Pour « courses 17h » sans remplir un formulaire | **Fait** en 2.7.0 |
| Une seule fenêtre de tâche, au centre, chaque champ modifié sur place | Le propriétaire passait par Edit et n'a jamais vu la 2.8.0 (lot E) | **Fait** en 2.11.0 |
| Sous-tâches en pages, à côté de leur tâche dans la même fenêtre ; « en faire une tâche » | Dessin du propriétaire, puis « les deux côte à côte » (30 oct.) | **Fait** en 2.8.0, dans la fenêtre centrale en 2.11.0 ; écran étroit (< 1 100 px) : la sous-tâche prend la place de la tâche |
| Sujets proposés pendant la frappe, Focus « Nouvelle séance » | Retours du propriétaire (29 oct.) | **Fait** en 2.9.0 |
| Rappels qui ne se perdent pas : manqués rattrapés en une carte, « Démarrer avec Windows » près des rappels | Tâche 4 du propriétaire | **Fait** en 2.10.0 |
| Agenda .ics lu comme un vrai export Google : réunions répétées, annulées, plusieurs jours | Tâche 5 | **Fait** en 2.10.0 |
| Historique permanent : chaque fin gardée, tâches répétées et supprimées comprises | History s'arrêtait au 10 oct. (lot E) | **Fait** en 2.12.0 |
| Créer en un geste : « New task » ouvre le formulaire, Ctrl+K crée sur Entrée | Personne ne devinait Tab (lot E) | **Fait** en 2.12.0 |
| Blocs de temps qui contiennent des tâches | Images de time blocking du propriétaire | **À faire** |

## 3. Écarts connus avec la cible

- **Pas de mobile ni de web.** La personne visée pense « courses à 17 h » loin
  de son PC. Plus grand trou. Cité dans l'avis Sunsama (« mobile, web, desktop »).
- **Installateur non signé** : Windows avertit à l'installation. Frein à une
  sortie publique. Décision du propriétaire (certificat).
- **Agenda Google** : pas encore relié. Repoussé par le propriétaire (29 oct.). Gratuit par le lien iCal privé ; la connexion Google complète est gratuite aussi mais demande une vérification Google avant un usage public.

## 4. Ce qu'il faudrait savoir pour mieux décider

| Question | Comment le savoir | Où en est-on |
|---|---|---|
| La cible est-elle la bonne ? | 3 à 5 testeurs dans la cible, 2 semaines d'usage quotidien | Pas commencé |
| Les gens reviennent-ils chaque jour ? | Le formulaire d'avis intégré ; demander aux testeurs | Formulaire en place, aucun chiffre ici |
| Le plan du jour est-il tenu ? | Part des tâches planifiées finies le jour même (calcul local, jamais envoyé) | Pas mesuré |
| Paieraient-ils, et combien ? | Question directe aux testeurs ; prix des concurrents ci-dessous | Pas demandé |

Prix des concurrents (publiés, à revérifier avant toute décision de prix) :
Sunsama ≈ 20 $ US/mois, Motion ≈ 19-34 $ US/mois — soit ≈ 28 et 26-47 $ CA
(1 $ US ≈ 1,38 $ CA). Non vérifié dans cette session.

## 5. Ce que dit la page publique

https://princeraph.github.io/clarity-releases/ (`app/release-site/`), copiée à
chaque publication. Depuis le 29 octobre 2026 (validé par le propriétaire) : « Finissez votre journée, pas votre liste. Clarity planifie votre journée dans vos vraies heures, vous dit quand elle déborde, et range le reste pour plus tard. Vos tâches restent sur votre ordinateur. » Part en ligne avec la prochaine version publiée.

Elle doit suivre la section 1 dès que la cible est validée. Elle ne promet que
ce qui est **Fait** dans la section 2 — jamais un « bientôt ».

## 6. Journal des décisions

| Date | Décision | Par |
|---|---|---|
| 29 oct. 2026 | Cible (section 1) : suivre Sunsama, pas Motion | Propriétaire (« ok cible ») |
| 29 oct. 2026 | Suggestions : une par jour par défaut | Propriétaire (« pushy »), fait en 2.6.0 |
| 29 oct. 2026 | Tâches ouvertes en deux panneaux latéraux (tâche, puis sous-tâche à côté ; une autre sous-tâche remplace la première), d'après le dessin du propriétaire | Propriétaire, option A — lot B |
| 29 oct. 2026 | Agenda Google repoussé ; lot B (deux panneaux) avant | Propriétaire |
| 29 oct. 2026 | Lot C′ publié en 2.9.0 | Propriétaire (« publish C ») |
| 29 oct. 2026 | Nouveau texte de la page de téléchargement | Propriétaire (« ok text ») |
| 29 oct. 2026 | Ordre : 6, 2, 5, 3, 4, 1, 7, 8 ; un lot par session | Propriétaire |
| 29 oct. 2026 | Tâche 2 (écran étroit) faite ; part avec la prochaine version | Propriétaire (« tache 2, go ») |
| 29 oct. 2026 | Tâche 5 : vrai .ics vérifié, réunions répétées désormais lues ; analyse locale à vérifier sur le PC | Propriétaire (« tâche 5 dans cette session ») |
| 29 oct. 2026 | Tâche 3 : la vraie fenêtre Electron vérifiée en CI (Linux) | Propriétaire (« tache 3 here ») |
| 29 oct. 2026 | Tâche 4 : rappels manqués rattrapés en une carte ; démarrage avec Windows proposé dans les rappels, éteint par défaut | Claude, sur « go for it » du propriétaire |
| 29 oct. 2026 | 2.10.0 publiée (tâches 2, 3, 4, 5) | Propriétaire (« publie la 2.10.0 ») |
| 30 oct. 2026 | Une seule fenêtre de tâche, centrée ; sous-tâche à côté dans la même fenêtre ; panneau droit de la 2.8.0 retiré | Propriétaire (« les deux côte à côte ») — lot E1 |
| 30 oct. 2026 | 2.11.0 publiée (lot E1) ; page publique inchangée | Propriétaire (« publish then lot E2 ») |
| 30 oct. 2026 | Lot E2 ; finies et archivées hors de la page d'un sujet, dans History | Propriétaire (décisions du 30 oct.) |
| 30 oct. 2026 | 2.12.0 publiée (lot E2) ; page publique inchangée | Propriétaire (« merge E2 when green, then publish ») |
