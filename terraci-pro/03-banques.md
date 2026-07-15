# TerraCI Pro — Banques

**Statut :** brouillon de conception, 13/07/2026 — rien n'est codé, rien n'est validé commercialement.

## 1. Le besoin, tel que le dossier partenaire le formule déjà

`dossiers-partenaires/08-banques.md` (§3) : *« la vérification (`/verifier`) est publique et utilisable dès aujourd'hui, sans aucune intégration technique de votre part. Pour un volume important de dossiers de financement, une intégration API dédiée (vérification automatisée depuis votre système de gestion de prêts) est un sujet de partenariat à étudier ensemble. »*

Différence structurante avec les notaires : le dossier notaires reportait explicitement l'API à plus tard (« pour un usage plus soutenu... »), celui des banques la nomme **directement** comme le sujet. Une banque ne veut pas un meilleur tableau de bord humain — elle veut que son système de gestion de prêts vérifie automatiquement, sans qu'un chargé de dossier scanne quoi que ce soit à la main. **Le palier réellement demandé par ce métier est l'API, pas un compte pro plus confortable.**

Deux besoins concrets :
1. **Vérification automatisée à l'instruction du dossier** — appel programmatique au moment où le dossier de prêt est monté, pas un scan manuel.
2. **Alerte si le statut change après l'octroi du prêt** — un titre donné en garantie qui devient litigieux ou révoqué *après* le décaissement est un risque direct sur la créance ; la banque veut être notifiée, pas devoir revérifier périodiquement à la main.

## 2. Paliers proposés

| Palier | Pour qui | Ce qu'il inclut |
|---|---|---|
| **Découverte** (statu quo, gratuit) | Institution de petite taille, faible volume | Scan QR manuel, 1ʳᵉ consultation gratuite, 60 000 FCFA à l'unité au-delà — inchangé |
| **Pro Banque — Assisté** | Institution en attendant une intégration API, ou volume modéré | Même brique que « Pro Notaire Essentiel » : vérifications illimitées via dashboard, historique, alerte de changement de statut — sans intégration technique de leur côté |
| **Pro Banque — API** | Le palier réellement demandé par ce métier | Clé API, endpoint de vérification programmatique (même verdict que `/verifier`, appelable depuis leur système de gestion de prêts), webhook de notification si le statut d'un document suivi change, facturation à l'usage (nombre d'appels) plutôt qu'au forfait |

Le palier « Assisté » n'est pas un produit au rabais : c'est un vrai palier d'entrée pour une institution qui n'a pas encore l'intégration technique prête, ou qui n'en a simplement pas besoin (agence bancaire de petite taille, faible volume de dossiers adossés au foncier).

## 3. Ce que ce métier révèle : le palier API ne peut pas être improvisé ici

Le Document Directeur sépare déjà « TerraCI Pro » (Phase 3 pt.1) et « TerraCI API publique v1 » (Phase 3 pt.2) — le dossier banques montre que **pour ce métier précis, ce sont en réalité le même chantier**. Concevoir un vrai palier Pro Banque suppose de trancher d'abord une partie de l'API publique (authentification par clé, endpoint de lecture Verify, quotas) — pas seulement la fondation commune du §02 (compte + paiement récurrent).

Ce que ça implique concrètement, à documenter dans un futur chantier API dédié plutôt qu'ici :
- **Émission et rotation des clés API** — table `cles_api_partenaires` (métier, `abonnement_id`, clé, statut actif/révoqué, dernière rotation).
- **Rate limiting** — un appel API mal utilisé (boucle, bug d'intégration côté banque) ne doit pas dégrader `/verifier` pour le grand public. Nécessite une couche de quota par clé, absente aujourd'hui.
- **Facturation à l'usage** — si le prix est au nombre d'appels (§4), il faut compter chaque appel par clé, pas juste activer/désactiver un abonnement comme pour un palier « Assisté » à prix fixe.

## 4. Prix — hypothèse à valider, encore moins de donnée que pour les notaires

Aucune donnée marché disponible (comme pour les notaires). Deux différences structurantes à garder en tête pour quand cette donnée existera :
- **Moins de clients, tickets plus gros** — une poignée de banques actives sur le foncier ivoirien, contre potentiellement des dizaines d'études notariales. Le modèle de prix supporte mieux une négociation par institution qu'une grille publique unique.
- **Volume probablement irrégulier** — contrairement à une étude notariale (rythme régulier), le volume d'une banque dépend du cycle des dossiers de prêt immobilier, ce qui va plutôt vers un prix à l'usage (par appel API) que vers un forfait mensuel plat.

## 5. Ce qui existe déjà et peut être réutilisé

- Le verdict et sa donnée (`verifier_attestation()`/`verifier_document()`, Score de confiance, détection de scan anormal déjà citée dans le dossier) sont déjà là — le palier API ne change *pas* ce qui est vérifié, seulement le canal d'accès (appel programmatique plutôt que scan) et la facturation.
- Le point de sécurité le plus rassurant du dossier reste vrai pour l'API aussi : la donnée exposée est déjà **publique** via `/verifier` aujourd'hui (verdict, statut, litige) — une API ne crée pas une nouvelle catégorie de donnée sensible, elle change seulement le mode de livraison. Ça limite le risque de conformité par rapport à ce qu'on pourrait craindre a priori.
- La fondation commune du §02 (`abonnements_pro`, historique, alerte de changement de statut) sert telle quelle le palier « Assisté ».

## 6. Questions ouvertes — sans réponse pour l'instant, pas bloquant

Mêmes inconnues que pour les notaires (volume, interlocuteur), plus une question propre à ce métier : le palier « API » suppose de lancer au moins une tranche du chantier API publique (Phase 3 pt.2) — vaut-il mieux le cadrer maintenant en parallèle des autres métiers Pro, ou attendre que agences/promoteurs soient conçus pour voir si eux aussi réclament un vrai accès API (mutualiser la conception plutôt que la faire une fois pour les banques puis une fois pour d'autres) ?
