# TerraCI Pro — Promoteurs immobiliers

**Statut :** brouillon de conception, 13-14/07/2026 — rien n'est codé, rien n'est validé commercialement.

## 1. Le besoin, tel que le dossier partenaire le formule déjà

`dossiers-partenaires/03-promoteurs-immobiliers.md` (§3) : *« Un accès de suivi dédié à vos programmes (tableau de bord ventes/paiements par programme) est un point de partenariat à cadrer selon l'ampleur de votre activité. »*

Troisième forme de besoin différente des trois métiers précédents : ni volume de vérifications (notaires/banques), ni volume de publication (agences) — un **tableau de bord agrégé par programme immobilier**. Le suivi de vente/paiement lot par lot existe déjà (§2 du dossier : statut de vente, échéancier, quittance PDF) ; ce qui manque, c'est la vue d'ensemble sur un programme entier (potentiellement des dizaines de lots), pas lot par lot.

## 2. Ce métier recoupe directement ce qu'on vient de construire ce soir

C'est la connexion la plus concrète des quatre métiers avec du travail déjà livré : le dashboard analytique chefferie construit plus tôt dans cette session (Territoire, Actes délivrés, Recettes perçues, Alertes — composition + tendance 30j, scopé par `autorite_coutumiere_id`) répond exactement au même besoin qu'un promoteur, juste scopé différemment. Un « programme » correspond en base à un ou plusieurs `lotissements` rattachés à un `operateur_id` — la même mécanique de scoping que `autorite_coutumiere_id`, avec le même trou vérifié ce soir :

```sql
select tablename, policyname from pg_policies
where tablename in ('attestations_cession','litiges','repartitions_paiement')
and qual ilike '%operateur%';
→ 0 ligne
```

**Aucune policy RLS ne donne au rôle `operateur` (le rôle aménageur/promoteur existant) accès à ces trois tables** — exactement le même trou que celui trouvé et corrigé pour la chefferie ce soir, jamais corrigé pour l'opérateur. Un « Pro Promoteur » n'est donc pas un nouveau chantier isolé : c'est en grande partie la réplication du pattern déjà construit (`Kpi`/`CompositionBar`/`Sparkline`, hook mono-fetch scopé, policies RLS jointes via lot→îlot→lotissement), rescopée sur `lotissements.operateur_id = mon_operateur_id()` au lieu de `autorite_coutumiere_id = ma_chefferie_id()`.

## 3. Paliers proposés

| Palier | Pour qui | Ce qu'il inclut |
|---|---|---|
| **Découverte** (statu quo, gratuit) | Rôle `operateur` actuel — déjà en production, comme géomètre | Gestion lot par lot (attributions, cessions, paiements individuels), comme aujourd'hui |
| **Pro Promoteur — Programme** | Promoteur avec un programme actif suivi | Tableau de bord agrégé par programme (composition des lots, actes délivrés, recettes perçues, alertes — même gabarit que le Centre de pilotage/chefferie), scopé à ses propres lotissements |
| **Pro Promoteur — Multi-programmes** | Promoteur gérant plusieurs programmes/opérateurs sous une même structure | Tout Programme + vue consolidée inter-programmes, export mensuel |

Contrairement aux notaires/banques, la base (rôle `operateur`) est déjà un service gratuit établi — le palier Pro n'ajoute rien au cœur du métier (structurer un lotissement, attribuer des lots), il ajoute une couche de pilotage par-dessus. C'est plus proche d'un vrai « add-on SaaS » que d'un changement de tarification d'un service existant, contrairement au cas notaires (où le service de base — la vérification — devient payant au-delà d'un seuil).

## 4. Prix — hypothèse à valider, axe différent des trois autres métiers

Toujours aucune donnée de marché disponible. Mais la nature du produit (un outil de pilotage, pas un volume d'appels/annonces/vérifications) suggère un axe de prix différent : par nombre de lots actifs suivis dans le tableau de bord, ou par palier de taille de programme, plutôt qu'à l'usage (banques) ou au forfait plat (notaires).

## 5. Ce qui manque vraiment pour construire ça

1. **La même fondation technique que le §02** (paiement récurrent, modèle de compte pro) — commune aux quatre métiers, rien de spécifique ici.
2. **La même RLS manquante que celle corrigée pour la chefferie ce soir**, à réappliquer pour `operateur` (cf. §2) — mécaniquement la même migration, un rôle différent.
3. **Notion de « programme »** : aujourd'hui un `operateur_id` est rattaché directement à un `lotissement` — s'il faut regrouper plusieurs lotissements sous un même « programme » nommé (au-delà d'un simple opérateur = un lotissement), une table `programmes` (nom, operateur_id, lotissements rattachés) serait à créer. À vérifier si un opérateur gère aujourd'hui déjà plusieurs lotissements ou si c'est 1:1 dans les faits.

## 6. Questions ouvertes — sans réponse pour l'instant, pas bloquant

Mêmes inconnues que les trois métiers précédents (volume réel, interlocuteur). La question sur le multi-lotissement a une réponse factuelle dès aujourd'hui : les deux seuls lotissements réels en base ont chacun un `operateur_id` distinct (Koelea-Accor Revu → GUINA KEKE THIERRY, Brignan Kakodji → Koné Morifère) — **c'est du 1:1 dans les faits actuels**, pas du multi-lotissement par opérateur. Le palier « Multi-programmes » (§3) reste donc une anticipation, pas un besoin déjà observé sur les données réelles — à garder comme palier futur plutôt qu'à construire en premier.
