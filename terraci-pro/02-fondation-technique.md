# TerraCI Pro — Fondation technique commune

**Statut :** brouillon de conception, 13/07/2026 — rien n'est codé.

Ce document ne parle plus d'un métier en particulier : il couvre ce qui sera nécessaire quel que soit le métier Pro (notaires, banques, agences, promoteurs), pour éviter de reconstruire la même brique 4 fois. À lire après [01-notaires.md](01-notaires.md), qui est le cas d'usage qui a fait remonter ces besoins.

## 1. Paiement récurrent — tranché (14/07)

CinetPay est intégré aujourd'hui pour des paiements **ponctuels** (pass marketplace 7 jours, attestation, vente) : le client paie, un webhook confirme, terminé. Aucun mécanisme ne prélève automatiquement un abonné chaque mois/année.

**Confirmé par l'utilisateur (14/07) : CinetPay supporte le prélèvement récurrent.** On peut donc concevoir la facturation des abonnements Pro sur l'agrégateur déjà en place, cohérent avec l'existant.

**Nuance qui change la donne technique** : CinetPay **ne sera pas le seul agrégateur branché au SaaS** — un second agrégateur est prévu, sans que son périmètre soit encore précisé (paiements ponctuels vs récurrents, quel métier/marché). Conséquence directe : `repartitions_paiement` et tout le pipeline de ventilation (`ventiler_paiement()`) sont aujourd'hui pensés pour un agrégateur unique (aucune colonne `agregateur` sur `paiements`) — cette hypothèse ne tiendra plus dès qu'un second agrégateur sera branché, abonnement Pro ou pas. À traiter comme un chantier d'infrastructure paiement à part entière, pas comme un détail de la fondation TerraCI Pro : quel agrégateur pour quel flux, comment les deux coexistent dans `paiements`/`repartitions_paiement`, avant de coder la facturation récurrente Pro dessus.

**Action concrète avant de coder l'abonnement Pro** : clarifier avec l'utilisateur le périmètre du second agrégateur (quels flux, à quelle échéance) pour éviter de construire la facturation récurrente Pro sur une hypothèse mono-agrégateur qui sera fausse sous peu.

## 2. Modèle de compte professionnel — tranché (14/07)

Deux façons de représenter « ce compte a un abonnement Pro » étaient sur la table :

- Option A — nouveau `groupe_utilisateur` par métier (`notaire`, `banque`…), sur le modèle de `geometre`/`commissaire`. Cohérent avec l'existant, mais un rôle applicatif dans ce projet porte aujourd'hui une sémantique métier forte (accès à des écrans dédiés, RLS spécifique) — un notaire Pro n'a pas besoin d'écrans différents des autres visiteurs de `/verifier`, juste d'un statut différent sur le *même* usage.
- Option B — table `abonnements_pro` indépendante des rôles (`profil_id`, `metier`, `palier`, `statut`, `debut`, `fin`), rattachée à n'importe quel compte existant (`acquereur`, `verificateur`, ou un compte créé sans rôle métier particulier). Le paywall de `/verifier` et du futur Passeport consulte cette table plutôt que le groupe : *« ce profil a un abonnement actif → pas de paywall, historique activé »*. Plus simple à étendre (ajouter un métier = une ligne de config, pas une migration d'enum), et ne mélange pas « ce que je peux faire dans l'app » (rôle) avec « ce que je paie » (abonnement).

**Décision confirmée par l'utilisateur : Option B.** Table `abonnements_pro` indépendante des rôles applicatifs, quel que soit le métier (notaire, banque, agence, promoteur). Conséquence directe pour l'implémentation à venir :

- Migration : `abonnements_pro (id, profil_id, metier, palier, statut, debut, fin)`, RLS scopée sur `profil_id = auth.uid()` (+ lecture admin).
- Tout paywall/gate Pro (`/verifier`, futur Passeport, tableau de bord « Historique de mes vérifications ») doit interroger cette table plutôt que `mon_groupe()` — nouvelle fonction `mon_abonnement_pro_actif(metier)` du même esprit que `ma_chefferie_id()`/`mon_operateur_id()` déjà utilisées ailleurs dans le projet, pour ne pas dupliquer la requête à chaque écran.
- `suivis_documents` (§3) référence `abonnement_id`, pas `profil_id` directement — cohérent avec ce choix.

## 3. Historique + alerte de changement de statut — généralisable, pas propre aux notaires

Les banques demandent la même chose que les notaires dans leur propre langage (« historique consultable », détection de fraude). Une seule brique sert les deux :

- **Table `suivis_documents`** : `abonnement_id`, `type_document`, `reference`, `cree_le`. Chaque vérification faite par un compte Pro y ajoute une ligne (ou une case à cocher « suivre ce document » après consultation).
- **Détection de changement** : un trigger sur `attestations_cession`/`certificats_vente` (mise à jour de `statut`) vérifie s'il existe une ligne `suivis_documents` pour la référence modifiée, et enfile une notification — même mécanique de dispatch que la fondation WhatsApp déjà posée (`notifications` + edge `envoyer-whatsapp`), qui est générique sur la forme (table de file + edge d'envoi) même si son déclenchement actuel est spécifique au tunnel d'acquisition.
- **Tableau de bord "Historique de mes vérifications"** : une page scopée à un `abonnement_id`, dans l'esprit du Centre de pilotage admin (mono-hook, une seule source de vérité par écran) mais côté lecture seule pour le compte Pro.

## 4. Ce qui ne dépend d'aucune de ces briques et peut avancer tout de suite

- Le périmètre fonctionnel par palier (déjà fait pour les notaires, à répliquer pour banques/agences/promoteurs) ne dépend pas du choix CinetPay ni du modèle de compte — c'est indépendant, on peut avancer sur les 3 autres métiers sans attendre.
- La question de prix reste ouverte partout (cf. §6 de `01-notaires.md`) — pas la peine de la retrancher métier par métier tant qu'aucune donnée terrain n'existe.

## 5. Ordre logique avant tout code

1. ~~Trancher CinetPay récurrent~~ — fait (§1, 14/07) : CinetPay supporte le récurrent, mais un second agrégateur arrive → clarifier son périmètre avant de coder la facturation Pro dessus.
2. ~~Valider option A vs B du modèle de compte~~ — fait (§2, 14/07) : Option B, table `abonnements_pro` indépendante des rôles.
3. Concevoir banques/agences/promoteurs sur le même gabarit que notaires (périmètre fonctionnel), en parallèle si besoin.
4. Clarifier le périmètre du second agrégateur (§1) avant de coder la facturation récurrente.
5. Alors seulement : migration DB (`abonnements_pro`, `suivis_documents`) + écrans.
