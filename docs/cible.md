# Clarity — pour qui, et ce qu'on promet

Document interne, tenu à jour à **chaque version publiée** (règle dans
`CLAUDE.md`). Il sert à décider : quoi construire, quoi refuser, quoi écrire sur
la page publique. Ce qui est **mesuré** est séparé de ce qui est **supposé**.

Dernière mise à jour : 29 octobre 2026 (2.6.0).

## 1. La personne visée — HYPOTHÈSE, pas encore validée

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
| Rituels : planifier le matin, bilan du soir, liste « Un jour » à part | C'est ce que les clients de Sunsama citent comme la cause du soulagement | **À faire** (lot D) |

## 3. Écarts connus avec la cible

- **Pas de mobile ni de web.** La personne visée pense « courses à 17 h » loin
  de son PC. Plus grand trou. Cité dans l'avis Sunsama (« mobile, web, desktop »).
- **Installateur non signé** : Windows avertit à l'installation. Frein à une
  sortie publique. Décision du propriétaire (certificat).
- **Agenda Google** : pas encore relié (lot E, par lien iCal privé d'abord).

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
chaque publication. Aujourd'hui : « Un gestionnaire de tâches personnel, avec un
assistant IA qui tourne sur votre ordinateur. Vos tâches restent chez vous. »

Elle doit suivre la section 1 dès que la cible est validée. Elle ne promet que
ce qui est **Fait** dans la section 2 — jamais un « bientôt ».

## 6. Journal des décisions

| Date | Décision | Par |
|---|---|---|
| 29 oct. 2026 | Cible proposée (section 1) : suivre Sunsama, pas Motion | Proposition, en attente du propriétaire |
| 29 oct. 2026 | Suggestions : une par jour par défaut | Propriétaire (« pushy »), fait en 2.6.0 |
| 29 oct. 2026 | Tâches ouvertes en deux panneaux latéraux (tâche, puis sous-tâche à côté ; une autre sous-tâche remplace la première), d'après le dessin du propriétaire | Propriétaire, option A — lot B |
