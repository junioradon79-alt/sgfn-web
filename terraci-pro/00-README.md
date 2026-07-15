# TerraCI Pro — Conception

**Démarré le :** 13 juillet 2026
**Statut :** en cours de conception (Phase 3 du Document Directeur, engagée en avance sur les Phases 0-2)

## Pourquoi ce dossier existe

Le Document Directeur (`TerraCI_SGNF_Document_Directeur_Unique_v1.md`, §6 Phase 3) prévoit de « transformer les 11 dossiers argumentaires partenaires en offres d'abonnement, conformément au Livre XIII ». Or le Livre XIII (Business Model) ne fait que 18 lignes — deux listes à puces, aucun montant, aucune offre décrite. Ce dossier est l'endroit où cette conception se fait réellement, métier par métier, avant de remonter en synthèse dans le Livre XIII.

Ces documents sont **internes** (hypothèses de prix, dépendances techniques, arbitrages) — à ne jamais confondre avec `dossiers-partenaires/`, qui reste volontairement sans tarif et destiné à être envoyé tel quel à un prospect.

## Constat de départ (13/07)

Sur les 5 métiers ciblés par TerraCI Pro (géomètres, notaires, banques, promoteurs, agences) :

- **Géomètres** : rôle applicatif complet déjà en production, accès gratuit par invitation — ce n'est pas un candidat Pro, c'est déjà un service rendu gratuitement pour faire fonctionner le registre.
- **Notaires, banques, agences, promoteurs** : aucun accès dédié aujourd'hui. Chaque dossier argumentaire le formule déjà dans son propre langage : notaires demandent un « accès dédié » pour un « volume important de vérifications » avec « historique consolidé » ; banques demandent une « intégration API dédiée » pour vérifier depuis leur système de gestion de prêts. **Concevoir TerraCI Pro et concevoir l'API publique (Phase 3 pt.2) sont la même conversation vue sous deux angles.**
- Aucune infrastructure de paiement **récurrent** (abonnement) n'existe dans le produit — CinetPay est branché pour des paiements ponctuels (pass marketplace, actes, ventes), jamais pour un prélèvement mensuel/annuel récurrent. C'est une dépendance technique réelle, pas un détail.

## Méthode

Un métier à la fois, jusqu'à une offre concrète (paliers + périmètre fonctionnel + hypothèse de prix à valider), avant de passer au suivant. Le premier métier sert de gabarit pour les suivants — mais chaque métier garde ses propres mécaniques (le besoin d'un notaire n'est pas celui d'une banque).

## Ordre de traitement cette semaine

1. **Notaires** — [01-notaires.md](01-notaires.md) (brouillon fait, 13/07 — prix non validé, pas de donnée marché disponible)
2. **Fondation technique commune** — [02-fondation-technique.md](02-fondation-technique.md) (brouillon fait, 13/07) : paiement récurrent (CinetPay à vérifier), modèle de compte pro, historique + alerte de changement de statut — sert tous les métiers, pas seulement les notaires
3. **Banques** — [03-banques.md](03-banques.md) (brouillon fait, 13/07) : révèle que pour ce métier, le palier Pro réellement demandé *est* une tranche de l'API publique (Phase 3 pt.2), pas juste un compte pro plus confortable — les deux chantiers convergent ici
4. **Agences immobilières** — [04-agences-immobilieres.md](04-agences-immobilieres.md) (brouillon fait, 13/07) : besoin différent des deux premiers métiers — volume de *publication* (mandats), pas de vérification ; révèle une tension à trancher avec le modèle d'intermédiation manuelle déjà acté (§4.2 du Document Directeur)
5. **Promoteurs immobiliers** — [05-promoteurs.md](05-promoteurs.md) (brouillon fait, 14/07) : troisième forme de besoin (tableau de bord agrégé par programme, pas un volume) — recoupe directement le dashboard analytique chefferie construit dans cette même session (même trou RLS confirmé pour le rôle `operateur`, même pattern de composants réutilisable)
6. Synthèse commune → remontée dans le Livre XIII (hors dépôt `sgfn-web`, dans le corpus TerraCI)

## Les 4 métiers, vus ensemble

Chaque métier a fait remonter une forme de besoin différente — ce n'est pas un hasard, ça structure ce qui reste à faire :

| Métier | Ce qu'il paie vraiment | Recoupe |
|---|---|---|
| Notaires | Volume de vérifications + historique/alerte | Fondation commune (§02) |
| Banques | Accès API programmatique | API publique v1 (Phase 3 pt.2) |
| Agences | Volume de publication (mandats) | Tension avec le modèle d'intermédiation marketplace déjà acté |
| Promoteurs | Pilotage agrégé par programme | Dashboard analytique chefferie déjà livré ce soir |

Aucun des quatre ne partage la même mécanique de facturation (forfait, à l'usage, au volume d'annonces, par taille de programme) — la fondation commune (§02) ne doit donc pas imposer un seul modèle de prix, seulement un modèle de compte capable de les porter tous.
