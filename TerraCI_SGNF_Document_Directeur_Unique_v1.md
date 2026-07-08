# TerraCI × SGNF — Document Directeur Unique

**Version 1.3 — 8 juillet 2026 (après-midi)**

> Cette version fusionne la v1.0 (vision stratégique TerraCI + état des lieux SGNF du matin du 07/07) et la Fiche projet SGNF (journal opérationnel détaillé) en **une seule référence de pilotage**. Les deux documents séparés sont désormais obsolètes : ce fichier est la référence unique pour comprendre où en est le projet, ce qui a été décidé stratégiquement, et ce qu'il reste à faire. La référence technique détaillée (schéma, conventions, pièges connus) reste le dossier `docs/` du repo `sgfn-web`, consolidé en PDF dans `docs/pdf/Dossier_Passation_SGNF.pdf`.

---

## 1. Constat fondateur

Deux réalités coexistaient jusqu'ici dans deux corpus documentaires distincts :

- **TerraCI** : une vision — infrastructure numérique nationale de confiance pour le foncier ivoirien, extensible à l'UEMOA puis à l'Afrique. Documentation stratégique aboutie (Vision, Dossier Directeur, Master Plan, Constitution, Cahier des charges, Design System, Architecture), mais Livres VIII à XVII encore squelettiques.
- **SGNF / Mon Terrain** : une réalité en production — deux sites en ligne, un backend Supabase audité, des revenus modélisés et partiellement encaissables, des utilisateurs réels (chefferies, géomètres, commissaires, acquéreurs).

**Décision structurante : SGNF est le prototype vivant de TerraCI.** La stratégie n'est pas de démarrer TerraCI à côté de SGNF, mais de faire évoluer SGNF vers TerraCI, sans casser ce qui tourne. Le programme se situe donc entre les phases « Prototype » et « MVP » de la trajectoire TerraCI (Prototype → MVP → Pilote → National → UEMOA → Afrique).

---

## 2. Vision, mission, positionnement

**Vision.** Faire de TerraCI la plateforme numérique de référence du foncier en Côte d'Ivoire, puis en Afrique de l'Ouest.

**Mission.** Permettre qu'une parcelle soit identifiée, vérifiée, géolocalisée et sécurisée en quelques minutes, avec un niveau de confiance élevé et une expérience simple.

**Positionnement.** TerraCI n'est pas un portail d'annonces immobilières : c'est une infrastructure numérique de confiance. La marketplace n'est qu'un des produits de l'écosystème.

**Signature.** *TerraCI — Le foncier en toute confiance.*

**Valeurs.** Confiance · Sécurité · Transparence · Excellence · Innovation · Rigueur · Simplicité.

### Les 10 piliers (Constitution du projet)

1. **Confiance** — chaque information doit être vérifiable.
2. **Sécurité** — opérations tracées, horodatées, auditées.
3. **Simplicité** — parcours clairs et rapides.
4. **Transparence** — informations essentielles accessibles selon les droits.
5. **Interopérabilité** — API-first, échanges avec administrations et partenaires.
6. **Géomatique** — chaque parcelle représentée spatialement (PostGIS).
7. **Intelligence artificielle** — analyse documentaire, anomalies, Score de confiance.
8. **Performance** — architecture évolutive, cloud native.
9. **Gouvernance des données** — qualité, traçabilité, historique, conformité.
10. **Évolutivité** — nouveaux services sans remise en cause de l'architecture.

### Critères de décision produit

Tout choix produit doit satisfaire quatre critères : **Sécurité, Simplicité, Performance, Confiance.**

---

## 3. Écosystème produit cible et correspondance avec les acquis

| Produit TerraCI (vision) | Acquis SGNF (réalité au 07/07/2026 soir) | État |
|---|---|---|
| TerraCI Verify | `/verifier` — vérification QR ; verdict d'attestation de cession payant (60 000 FCFA) sauf la 1re attestation, gratuite | ✅ En production |
| TerraCI Market | Mon Terrain (monterrain.sgfn.ci) — pass 5 000 FCFA / 7 jours / 10 contacts | ✅ En production (v1) |
| TerraCI Docs | Coffre-fort documentaire, génération d'actes, versionnement, **tarification par palier des attestations de cession** | ✅ En production |
| TerraCI Maps | Carte foncière `/dashboard/carte`, itinéraires Google Maps | 🟡 Partiel |
| Passeport parcelle | Fiche lot + QR + attestations/certificats + historique de propriété | 🟡 Partiel (les briques `verifier_attestation()`/historique existent déjà, reste à assembler en écran unique) |
| Score TerraTrust | — | ⬜ À construire (v1 sans IA) |
| TerraCI Pro | 11 dossiers argumentaires partenaires rédigés (PDF) | 🟡 Matière prête, offre à structurer |
| TerraCI Collectivités | Rôles chefferie/commissaire opérationnels ; **nouveau rôle Propriétaire terrien** (ex chef de famille) séparé de la Chefferie village ; tarifs par chefferie amorcés (Ebimpe) | 🟡 Embryonnaire |
| TerraCI Analytics | Statistiques home, tableaux de bord par rôle | 🟡 Embryonnaire |
| TerraCI API | Edge functions internes ; aucune API publique | ⬜ À construire |
| TerraCI Mobile | Sites responsive ; scanner QR caméra | ⬜ APK/PWA à construire |
| TerraCI Home | sgfn.ci — site vitrine institutionnel | ✅ En production |

---

## 4. État des lieux SGNF (acquis consolidés)

### 4.1 En production

- **sgfn.ci** — plateforme institutionnelle : tableaux de bord pour 8+ rôles (admin, propriétaire, opérateur, commissaire, chefferie, géomètre, vérificateur, aménageur…). Export statique Next.js sur cPanel/Apache.
- **monterrain.sgfn.ci** — marketplace publique des parcelles vérifiées. Dépôt Git indépendant, même backend Supabase (`bvdzrhvbiglwrhzpmuwy`).
- Vérification QR : parcours amont libre (scan, identification du document) ; verdict d'attestation de cession payant **sauf pour la 1re attestation** (gratuite, cohérent avec sa délivrance) — **60 000 FCFA dont 50 000 pour la chefferie concernée et 10 000 de commission SGNF** à partir de la 2e. Certificats de vente et APFC gratuits. Consultation payée valable 24 h. Paiement manuel au guichet (code `CQR-XXXXXX`) en attendant les secrets CinetPay.
- **Tarification par palier de la délivrance d'une attestation de cession** (codée et testée le 07/07 au soir) : 1re gratuite, 2e = forfait national 30 000 FCFA (20 000 chefferie + 10 000 SGNF), 3e et suivantes = tarif variable par chefferie (montant + commission s'additionnent — ex. Chefferie d'Ebimpe = 380 000 FCFA). Nouvel écran « Créer une cession » sur `/dashboard/lots`.
- Coffre-fort documentaire, génération automatique de documents (edge function, sécurisée depuis le 07/07 soir), quittances PDF, notifications email (Resend), scanner QR caméra, manuel utilisateur PDF.
- Table `tarifs` en base, **désormais branchée au formulaire `/dashboard/paiements`** (07/07 soir) — la saisie n'est plus totalement libre, les montants/commissions par type de démarche sont pré-remplis et validés.
- Dossier de passation développeur (27 pages, `docs/pdf/Dossier_Passation_SGNF.pdf`) — référence pour toute reprise du projet.
- **Rôle « Propriétaire terrien »** (nuit du 07 au 08/07) : le sous-rôle « chef de famille », jusqu'ici confondu avec la Chefferie (chef de village), devient un rôle formel à part entière (`groupe_utilisateur.proprietaire_terrien`), avec son propre tableau de bord `/dashboard/proprietaire-terrien`. **Coexistence permanente avec l'ancien modèle** — les comptes existants (Koelea-Accor Revu / N'CHO KOUTOUAN JULES) restent sous `groupe='chefferie'` indéfiniment ; seules les nouvelles familles/lotissements utilisent le nouveau rôle. Terminologie « Ayant droit » renommée en affichage « Propriétaire terrien » partout dans l'appli. **Déployé en production et validé par test fonctionnel e2e au navigateur le 08/07 après-midi** (nouveau rôle + non-régression chefferie/village — voir §10).

### 4.2 Décisions d'architecture actées

- Consultation marketplace libre sans compte ; SGNF reste l'intermédiaire — mise en relation **manuelle** par un admin (`/dashboard/contacts-marketplace`, aide WhatsApp). Aucune coordonnée publiée automatiquement.
- Éligibilité annonce : lot avec attestation ou certificat au statut `delivree`. Annonces sans expiration.
- Recherche guidée : Zone → Usage → Superficie → Budget.
- Confidentialité GPS : coordonnées exactes privées ; le public voit un **cercle flou de 500 m** (arrondi ~110 m côté base).
- **0 commission** sur les ventes de lots via la marketplace ; le pass est un revenu SGNF intégral.
- Stack : Next.js (export statique) + Supabase (Postgres/RLS, edge functions, storage) + CinetPay + Resend. Gestionnaire de paquets : **pnpm** exclusivement.
- Tarification des attestations de cession : voir §4.1 — modèle à 3 paliers (gratuit / forfait national / variable par chefferie), remplace l'ancien tarif unique 100 000–150 000 FCFA fixé le 03/07 (jamais utilisé en pratique).

### 4.3 Dette technique et risques ouverts (au 08/07 matin)

| # | Sujet | Gravité | Détail |
|---|---|---|---|
| 1 | **Front non déployé — rôle Propriétaire terrien** | 🔴 | `sgfn-deploy-proprietaire-terrien.tar.gz` généré (build propre, 125 pages) mais pas encore uploadé sur cPanel — tant que ce n'est pas fait, la nouvelle route `/dashboard/proprietaire-terrien` et les libellés renommés restent invisibles en prod (la DB/RLS, elle, est déjà en place). |
| 2 | **Secrets CinetPay absents** | 🔴 Bloquant revenus | Bloque le paiement en ligne du pass, les scénarios F/G des tests paiements et le paywall QR en ligne. |
| 3 | Pivot plans CAD → DXF | 🟡 | Commit `25a91cc` non testé en réel (rendu blanc DWG contourné). |
| 4 | **Leaked password protection — bloqué** | 🟡 | Pas un simple toggle Dashboard : tentative via l'API management le 07/07 soir → `402 Payment Required`, nécessite un plan **Supabase Pro** (projet actuellement sur plan Free). |
| 5 | Modale « Créer une cession », formulaire paiements, écran Propriétaire terrien | 🟡 | Codés, testés côté serveur (RPC/SQL direct), front déployé (cessions/paiements) ou en attente (Propriétaire terrien) mais **jamais testés en navigateur réel**. |
| 6 | Webhook rebuild monterrain-web | 🟡 | Republication à la mise en ligne d'une annonce. |
| 7 | Photos d'annonces | 🟡 | Schéma + upload + galerie à créer. |
| 8 | Comptes et tarifs chefferies réels | 🟡 | N'CHO KOUTOUAN JULES, NANAN AFFA KOUACHY ALFRED à provisionner ; seule la Chefferie d'Ebimpe a un tarif palier-3 configuré dans `tarifs_attestation_chefferie` — les autres bloqueront la délivrance d'une 3e attestation tant qu'un tarif n'est pas fixé. Bornage/demande ACD toujours sans montant dans `tarifs`. |
| 9 | Flux d'invitation incomplet pour Chefferie/Propriétaire terrien | 🟡 | La table `invitations` n'a pas de colonnes `famille_id`/`autorite_coutumiere_id` — un compte invité avec l'un de ces rôles atterrit sans lien, rattachement manuel obligatoire via `/dashboard/familles` après coup. Différé (choix explicite du 07/07 soir). |
| 10 | `concertation/page.tsx` — routage participants | 🟡 | Sélection auto des participants « chef de famille » d'un lotissement vérifie `groupe==='proprietaire'` (mauvais rôle) sans filtrer par `famille_id` — sur-sélectionne des profils non liés. Bug apparenté à celui corrigé dans `lots_read_scope`, laissé de côté. |
| 11 | Différés | ⚪ | Mobile Money définitif, SMS, APK Android, transition `generee → delivree`, achat libre-service acquéreur. |

**Risques soldés depuis la v1.1 (soir du 07/07)** — pour mémoire, ne sont plus des risques ouverts :

- Faille de sécurité `generation-document` (garde `HOOK_SECRET` inerte) — auditée puis **corrigée et déployée**, testée en réel (voir §10).
- Grille tarifaire non branchée à l'UI paiements — **branchée**.
- Front non déployé (cessions par palier, grille tarifaire) — **`sgfn-deploy-cessions-paliers.tar.gz` uploadé sur cPanel**. Le travail correspondant a aussi été commité en git à la reprise de session (5 commits, jusque-là non versionné) : sécurité `generation-document`, tarification par palier, grille tarifaire, fusion documentaire, et le fix `familles.lignee` (colonne disparue, cassait silencieusement la vue Chef de famille et la génération de documents — edge function redéployée en v31).
- Confusion Chefferie / Chef de famille — diagnostiquée précisément (compte de test mal câblé, flux d'invitation et libellés en cause) puis traitée à la racine par le nouveau rôle Propriétaire terrien (voir ligne 1 ci-dessus pour le déploiement front restant).

---

## 5. Arbitrages stratégiques (à trancher, dans cet ordre)

### A1 — Architecture de marque

**Recommandation : architecture à deux niveaux.**
- **SGNF** reste la marque institutionnelle et back-office (crédibilité auprès des chefferies, commissaires, administrations ; le domaine sgfn.ci est en ligne et connu des utilisateurs).
- **TerraCI** devient la marque produit grand public et commerciale, coiffant progressivement Mon Terrain (→ TerraCI Market), la vérification (→ TerraCI Verify), etc.
- Aucun renommage de ce qui fonctionne ; la migration de marque se fait produit par produit, au rythme des refontes.

*Alternative écartée : renommage global immédiat (risque de confusion utilisateurs, coût DNS/SEO/impression, aucun gain court terme).*

### A2 — Positionnement institutionnel

Deux voies possibles, qui conditionnent toute la Phase 3 :
- **Voie privée** : plateforme de confiance privée, revenus autonomes (pass, paywall QR, actes, abonnements Pro, API). Rapide, indépendante, mais plafond de légitimité pour le passage national.
- **Voie partenariale** : rapprochement avec les services cadastraux / collectivités / ministères, jusqu'à une éventuelle délégation. Plus lent, mais seul chemin crédible vers le statut d'infrastructure nationale visé par la Constitution TerraCI.

**Recommandation : voie privée assumée en Phases 0–2, ouverture des démarches institutionnelles dès la Phase 2 (avec les preuves du pilote), décision formelle en Phase 3.**

### A3 — Doctrine documentaire

Les Livres VIII–XVII sont rédigés **en rétro-documentant SGNF**, pas en théorie :
- Livre VIII (Base de données) : généré à ~80 % depuis le schéma Supabase existant.
- Livre IX (API) : dérivé des edge functions et de la future API publique.
- Livre X (Sécurité) : consolidation des audits déjà menés (advisors, RLS, `generation-document`).
- Livres XIII–XIV (Business/Marketing) : à partir de la grille tarifaire réelle (y compris le nouveau modèle à paliers) et des dossiers partenaires.

**Doctrine des trois couches de connaissance** — pour éviter les doublons, chaque fait a **un seul foyer** ; les autres couches y renvoient sans le recopier :
- **Graphe de code** (`graphify-out/`, généré par `graphify update .`, hors dépôt) — le *comment* : structure, dépendances, qui-appelle-quoi. Jamais rédigé à la main ; par conséquent **ce document ne décrit pas la forme du code**, seulement les *décisions* d'architecture.
- **Ce document** (versionné, partageable) — le *pourquoi* : décisions durables, règles métier, arbitrages, roadmap, modèle économique, risques.
- **Mémoire agent** (`memory/`, hors dépôt) — le *où on en est* : état opératoire et pièges de reprise (emplacement des mots de passe test, `tar.gz` et non `zip`, « pas encore testé en navigateur », bug latent dans tel fichier).

Règle d'aiguillage (s'arrêter au premier oui) : déductible du code → **graphe** ; décision qu'un humain doit lire → **ce document** ; détail de reprise utile à l'agent seul → **mémoire**. Le §10 (journal opérationnel) ne conserve que les **résultats et décisions** ; le détail d'exécution vit en mémoire et renvoie ici.

### A4 — Doctrine technique de scalabilité

Le monolithe Supabase actuel est **conservé** jusqu'à la fin du pilote multi-sites. Aucune migration d'architecture (microservices, infra dédiée) avant que la traction ne la justifie par des chiffres. Décision de réévaluation planifiée en Phase 4.

---

## 6. Feuille de route consolidée

### Phase 0 — Consolidation (juillet 2026, 2–4 semaines)

*Objectif : zéro faille connue, revenus encaissables en ligne de bout en bout.*

1. 🔴 Uploader `sgfn-deploy-proprietaire-terrien.tar.gz` sur cPanel — **priorité absolue**, seul point rouge purement mécanique restant.
2. 🔴 Poser les secrets CinetPay (`CINETPAY_API_KEY`/`CINETPAY_SITE_ID`) — active pass marketplace en ligne, scénarios F/G, paywall QR électronique.
3. 🟡 Tester en navigateur la modale « Créer une cession », le formulaire paiements branché sur `tarifs`, et le nouvel espace Propriétaire terrien — seule la logique serveur a été validée jusqu'ici pour les trois.
4. 🟡 Tester le pivot DXF en réel (upload + conversion + aperçu non blanc).
5. 🟡 Provisionner les tarifs des chefferies au-delà d'Ebimpe dans `tarifs_attestation_chefferie` ; chiffrer bornage + demande ACD dans `tarifs`.
6. 🟡 Tests E2E des parcours marketplace et paiements après pose des secrets.
7. 🟡 Combler le flux d'invitation Chefferie/Propriétaire terrien (colonnes `famille_id`/`autorite_coutumiere_id` sur `invitations`) et le bug de routage `concertation/page.tsx` (voir §4.3, points 9-10).
8. ⬜ *Leaked password protection* — reporté, bloqué par le plan Supabase Free (voir §4.3).

**Critères de sortie :** les 2 points rouges du §4.3 (front Propriétaire terrien, secrets CinetPay) soldés ; un paiement CinetPay réel encaissé sur chaque canal (pass, consultation QR, acte, attestation de cession) ; la modale cessions et l'espace Propriétaire terrien validés en usage réel.

### Phase 1 — SGNF devient le MVP TerraCI (T3 2026)

*Objectif : matérialiser les deux différenciateurs de la vision sur la base existante.*

1. **Arbitrage A1 (marque)** acté et documenté.
2. **Passeport parcelle v1** : écran unique conforme au Livre VI — identifiant, QR, informations générales, propriétaire(s), documents, chronologie, géométrie, vérifications. Assemblage de briques existantes — une partie de la donnée (historique de propriété par rang, statut de la cession en cours) est déjà exposée par `verifier_attestation()` et la page `/dashboard/lots`, ce qui facilite l'assemblage.
3. **Score de confiance v1 — sans IA** : score sur règles calculable en SQL (complétude du dossier, statut des documents, géométrie présente, cohérence attributaire, absence de litige connu). Affiché sur le Passeport et les annonces. L'IA (Livre sur le Score TerraTrust) est explicitement reportée en V2.
4. Marketplace maturité : photos d'annonces, webhook/procédure de rebuild, parcours d'acquisition en libre-service, transition `generee → delivree` tranchée.
5. Comptes chefferies réels provisionnés, avec leurs tarifs de 3e attestation le cas échéant.

**Critères de sortie :** chaque lot vérifié dispose d'un Passeport avec Score ; une annonce avec photos publiée et rebuild automatique ; premier acquéreur en libre-service.

### Phase 2 — Pilote multi-sites (T4 2026)

*Objectif : prouver la réplicabilité du modèle au-delà de Koelea-Accor et Brignan Kakodji.*

1. Onboarder **2 à 3 nouveaux lotissements/chefferies** — test réel de la multi-tenancy (données, RLS, processus humains de mise en relation manuelle, capacité admin, tarifs de cession par chefferie).
2. Mobile : **PWA d'abord** (coût minimal, installable), APK Android ensuite si le besoin est confirmé.
3. Notifications SMS + fournisseur Mobile Money définitif.
4. Mesure systématique des **indicateurs stratégiques** (voir §7) — base du dossier institutionnel et investisseurs.
5. Lancement des premières démarches institutionnelles exploratoires (A2).

**Critères de sortie :** 3+ lotissements actifs ; tableau de bord des indicateurs alimenté sur un trimestre plein ; revenus mensuels récurrents documentés.

### Phase 3 — Ouverture professionnelle (S1 2027)

*Objectif : activer TerraCI Pro, l'API et l'ancrage institutionnel.*

1. **TerraCI Pro** : transformer les 11 dossiers argumentaires partenaires en offres d'abonnement (géomètres, notaires, banques, promoteurs, agences), conformément au Livre XIII.
2. **API publique v1** : OpenAPI, clés partenaires, versionnement, endpoints lecture Verify + Parcelles. Pilier interopérabilité et 4e source de revenus.
3. **TerraCI Analytics** : tableaux de bord institutionnels pour collectivités et chefferies.
4. **Décision formelle A2** (voie privée vs partenariale) sur la base des résultats du pilote.
5. Rédaction des Livres VIII–X par rétro-documentation (A3).

**Critères de sortie :** premiers abonnés Pro payants ; première clé API partenaire active ; position institutionnelle actée.

### Phase 4 — National puis régional (S2 2027 →)

1. Réévaluation d'architecture (A4) : montée en gamme Supabase vs migration vers l'architecture cible du Livre VII (modular monolith → services). Décision par les chiffres.
2. Financement : levée de fonds ou partenariat public-privé selon l'issue de A2.
3. Déploiement national, puis — et seulement après — extension UEMOA.

---

## 7. Modèle économique consolidé

### Revenus actuels (implémentés)

| Canal | Montant | Répartition | Statut |
|---|---|---|---|
| Pass marketplace | 5 000 FCFA / 7 j / 10 contacts | 100 % SGNF | En prod (paiement manuel, en ligne dès secrets CinetPay) |
| Consultation QR attestation (2e et suivantes ; la 1re est gratuite) | 60 000 FCFA | 50 000 chefferie + 10 000 SGNF | Déployé serveur, front à uploader |
| **Délivrance attestation de cession — 2e** | 30 000 FCFA | 20 000 chefferie + 10 000 SGNF | Codé et testé serveur le 07/07 soir, front à tester |
| **Délivrance attestation de cession — 3e et suivantes** | Variable par chefferie (ex. Ebimpe : 380 000) | Montant chefferie + commission SGNF | Codé et testé serveur le 07/07 soir ; seule Ebimpe configurée |
| Autres actes payants (grille du 03/07 : transmission, entérinement chefferie, mutation acquéreur, levée de litige) | Selon `Grille_Tarifaire_SGNF_2026-07-03.md` | Montants réels + commissions SGNF | Table `tarifs`, branchée à l'UI paiements le 07/07 soir |
| Commission sur ventes marketplace | 0 | — | Décision actée |

### Revenus cibles (vision, Livre XIII)

- Abonnements Pro (géomètres, notaires, banques, promoteurs) — Phase 3.
- API partenaires — Phase 3.
- Services premium / Analytics institutionnels — Phases 3–4.

---

## 8. Indicateurs stratégiques (Constitution TerraCI, à instrumenter dès la Phase 2)

- Délai moyen de vérification d'une parcelle.
- Nombre de transactions/consultations sécurisées.
- Taux de dossiers complets.
- Disponibilité de la plateforme.
- Satisfaction des utilisateurs.
- **Ajouts SGNF** : revenus par canal, nombre de lotissements actifs, délai de mise en relation marketplace, part des paiements en ligne vs guichet, **répartition des attestations de cession par palier (1re/2e/3e+) et nombre de chefferies avec un tarif palier-3 configuré**.

---

## 9. Principes techniques permanents

- Security by Design & Privacy by Design ; RLS systématique ; toute alerte advisor Supabase traitée.
- Centralisation des constantes métier (pass, tarifs) — surveiller la duplication front / edge functions.
- `pnpm build` obligatoire avant tout déploiement (pas de CI/CD à ce stade) ; **jamais `npm install`** (structure `node_modules` pnpm incompatible, erreur arborist).
- Multi-statement SQL Supabase : un `execute_sql` ne renvoie que le dernier résultat — CTE ou appels séparés.
- À fort trafic : fournisseur de tuiles OSM dédié (MapTiler/Stadia) au lieu du serveur public.
- Toute reprise du projet commence par `docs/README.md`, puis le Dossier de Passation, puis ce document.
- Documentation systématique, tests des parcours critiques, journalisation des opérations sensibles.
- **Leçon du 07/07 soir** : une règle métier peut être dupliquée dans deux mécanismes indépendants (un trigger applicatif *et* une contrainte SQL comme un index unique partiel) — corriger l'un sans vérifier l'autre laisse un bug latent invisible à la lecture de code. Toujours valider une action par un test réel de bout en bout, pas uniquement par une revue de la logique.

---

## 10. Journal opérationnel détaillé (annexe)

> Historique granulaire des sessions, conservé pour la traçabilité. Les sections 1 à 9 ci-dessus reflètent déjà l'état consolidé — cette annexe explique *comment* on y est arrivé.

### Session du 07/07/2026 (matin)

#### Consultation QR payante — implémentée et déployée

Décision équipe du jour : la consultation du verdict d'une **attestation de cession** via `/verifier` coûte **60 000 FCFA** (50 000 chefferie concernée + 10 000 commission SGNF) — remplace les 55 000/5 000 du 03/07. Tout le parcours amont reste libre (scan, saisie, identification du document : type + référence affichés gratuitement) ; seul le verdict est bloqué. Certificats de vente et APFC restent gratuits.

Implémentation complète, testée en réel de bout en bout (7 scénarios serveur validés puis fixtures nettoyées) :

- **DB** : table `consultations_qr` (montants historisés par ligne, jeton secret porteur + code court `CQR-XXXXXX`, RLS admin-only — vérifiée aveugle et inerte à la clé anon). Migrations dans `supabase/migrations/`.
- **Edge fns** : `verification-qr` v15 (verdict bloqué côté serveur, réutilisation de la consultation tant qu'elle n'est pas payée, consultation payée valable 24 h), `payer-consultation-qr` (initiation CinetPay, 503 propre tant que les secrets manquent), `confirmer-consultation-qr` (webhook, même modèle que `confirmer-paiement`). Les trois déployées.
- **Front** : écran « consultation payante » sur `/verifier`, page admin `/dashboard/consultations-qr` (Marquer payée / Annuler) + entrée Sidebar, constantes dans `src/lib/consultation-qr.ts`, `database.types.ts` régénéré.
- **En attendant CinetPay** : paiement manuel au guichet — le vérificateur communique son code `CQR-…`, l'admin marque la consultation payée.

**Bug préexistant corrigé au passage** : la branche APFC de la RPC `verifier_document()` référençait `familles.lignee`, colonne disparue (devenue `lignee_id`, auto-référence) → toute vérification QR d'APFC échouait en erreur depuis le refactor familles. Corrigé par migration (`20260707_fix_verifier_document_lignee.sql`).

**Nouvel outillage** : `scripts/supabase-sql.ps1` — exécute du SQL sur la prod via l'API de management (token CLI lu dans le Credential Manager, contournement réseau NAT64 + `--ssl-no-revoke`). Remplace le MCP Supabase quand il n'est pas disponible.

#### Audit sécurité `generation-document`

Vulnérabilité confirmée avec preuve en direct : la garde de l'edge function `if (HOOK_SECRET && req.headers.get("x-hook-secret") !== HOOK_SECRET)` ne s'exécutait jamais car **aucun secret `HOOK_SECRET` n'existait** dans le projet. Seule protection réelle : `verify_jwt = true`, satisfaite par la clé anon publique. Preuve live : avec la seule clé anon → `200 "Table ignoree"` (garde franchie). Impact : un appelant anonyme pouvait forcer une (re)génération, écraser un document, insérer une ligne `documents`, basculer un statut à `delivree`. Patch v29 préparé mais non déployé ce matin-là, en attente de confirmer le rôle envoyé par le trigger `sgfn_call_edge` — **résolu le soir même, voir plus bas**.

#### Upload de plans : pivot vers DXF

Contournement du rendu blanc DWG : le modal d'upload (`UploadPlanModal.tsx`) n'accepte plus que le format `.dxf`. Commit `25a91cc`, pas encore testé en réel.

### Session du 07/07/2026 (soir)

#### Sécurité `generation-document` — corrigé et déployé

**Correctif** : lecture de la définition de `sgfn_call_edge()` (via `scripts/supabase-sql.ps1`, décodage du claim `role` du JWT stocké dans le secret vault `sgfn_edge_bearer` — **rôle réel = `anon`**, pas `service_role` comme l'hypothèse initiale le supposait). Solution retenue : secret `HOOK_SECRET` posé (edge fn secret + vault Postgres `sgfn_hook_secret`), `sgfn_call_edge()` modifiée pour envoyer le header `x-hook-secret` en plus du Bearer existant (inchangé), edge function `generation-document` v29 déployée avec la garde *fail-closed* (`x-hook-secret` OU JWT `service_role`).

**Testé en réel post-déploiement** : clé anon seule (sans `x-hook-secret`) → `401` (faille colmatée) ; génération réelle via `regenerer_document()` → `200`, PDF régénéré normalement (flux légitime intact, zéro régression). Détail complet en mémoire (`audit_generation_document_auth`).

#### Grille tarifaire branchée sur `/dashboard/paiements`

La table `tarifs` (créée le 06/07) est désormais consommée par le formulaire « Nouveau paiement ». Deux bugs réels corrigés au passage, pas juste une saisie libre :

- `commission_sgfn` avait un défaut colonne codé en dur à 10 000 FCFA, silencieusement faux pour `transmission` (30-50k), `enterinement_chefferie`/`mutation_acquereur` (50k) — corrigé pour lire la grille tarifaire par type de démarche.
- Les démarches `bornage`/`demande_acd` (montant pas encore fixé) étaient exclues du sélecteur par un filtre qui écartait toute démarche sans `montant_honoraires` — le staff ne pouvait tout simplement pas créer ces paiements. Filtre retiré, champ devient éditable avec message d'aide.
- Validation de fourchette au submit (erreur si le montant sort de la grille officielle).

`pnpm build`/typecheck/lint propres. Non testé en navigateur.

#### Tarification par palier des attestations de cession + écran « Créer une cession »

Nouvelle politique produit : le prix d'une attestation de cession dépend désormais du rang de propriété sur le lot — 1re gratuite (inchangé), 2e = forfait national 30 000 FCFA, 3e et suivantes = tarif variable par chefferie. Il n'existait **aucune interface** pour créer une « cession » (2e transfert et suivants) avant ce soir — seule la 1re attestation (automatique) fonctionnait de bout en bout.

**Livré** :

- Migration `supabase/migrations/20260707_cessions_tarification_par_palier.sql` : nouvelle table `tarifs_attestation_chefferie` (seedée pour la Chefferie d'Ebimpe), tarif `delivrance_attestation_cession` repurposé pour le palier 2, nouvelle RPC `SECURITY DEFINER` `creer_cession(lot, acquéreur, date, observation, moyen)` — seul point d'écriture possible pour un compte `operateur` (RLS de `cessions`/`attributions`/`paiements` est admin-only).
- **2 bugs latents corrigés**, découverts uniquement en testant réellement une 3e cession (ni la revue de code ni un agent de planification dédié ne les avaient anticipés) : le trigger `bloquer_double_cession()` **et** un index unique séparé (`uniq_cession_active`) bloquaient tous les deux *toute* cession au-delà de la 2e, pour toujours, car rien ne repassait une cession à `'solde'` après paiement. Sans ce correctif double, le palier 3+ n'aurait jamais été atteignable en prod.
- Exception QR : la consultation de la 1re attestation devient gratuite (`verifier_attestation()` expose un flag `gratuite`), `verification-qr` déployée en conséquence.
- Front : nouvelle modale « Créer une cession » sur `/dashboard/lots` (bouton dans les actions du tableau, prévisualisation du montant avant confirmation).

**Testé en réel de bout en bout** (SQL direct sur un vrai lot de Koelea-Accor, chefferie Ebimpe, fixtures entièrement nettoyées ensuite) : 2e cession → 30 000 FCFA, paiement validé → attestation générée et livrée (chaîne complète y compris le nouveau `x-hook-secret`), cession soldée ; 3e cession sur le même lot → 380 000 FCFA (365k + 15k Ebimpe) ; QR gratuit sur la 1re attestation, toujours 60 000 FCFA sur la 2e.

La modale elle-même n'a pas été testée en navigateur (pas d'outil browser disponible cette session) — seule la RPC a été validée. Nouveau tar.gz `sgfn-deploy-cessions-paliers.tar.gz` généré, remplace `sgfn-deploy.tar.gz` et `sgfn-deploy-grille-tarifaire.tar.gz`. Détail complet en mémoire (`tarification_paliers_cession`).

### Session du 07 au 08/07/2026 (nuit — reprise de session)

#### Rattrapage git et déploiement

Tout le travail de la soirée du 07/07 (sécurité `generation-document`, tarification par palier, grille tarifaire) était resté **non commité** malgré son déploiement réel — corrigé en 5 commits à la reprise. `sgfn-deploy-cessions-paliers.tar.gz` confirmé uploadé sur cPanel par le user.

#### Comptes de test réinitialisés

Les 8 comptes `manuel.*@sgfn.ci` (un par métier) réinitialisés avec un mot de passe commun généré aléatoirement, posé via `auth.users.encrypted_password` (pgcrypto `crypt()`/`gen_salt('bf')`) faute de connaître l'ancien secret `MANUEL_TEST_PASSWORD` (volontairement retiré du dépôt lors d'une session antérieure).

#### Confusion Chefferie / Chef de famille — diagnostiquée puis traitée à la racine

En testant les comptes métiers, le user a remarqué que « Chefferie » et « Chef de famille » restaient confondus. Investigation (agent Explore + vérifications directes en base) : le modèle de données distingue bien les deux (`familles`/`autorites_coutumieres`, `profiles.famille_id`/`autorite_coutumiere_id`), mais le compte de test `manuel.chefferie@sgfn.ci` n'était câblé que sur `famille_id` (jamais testé la vue village) et le flux d'invitation ne permettait pas de choisir l'entité à la création. Nouveau compte `manuel.chefvillage@sgfn.ci` créé (lié à la Chefferie d'Ebimpe) pour combler l'écart de test. Deux bugs actifs découverts au passage :

- `familles.lignee` (colonne disparue lors du passage à `lignee_id`) référencée dans 2 endroits oubliés lors du fix du 07/07 matin (`chefferie/page.tsx` et `generation-document` v29, déployée) — cassait silencieusement la vue Chef de famille et la génération de documents liés à une famille. **Corrigé et déployé** (edge function v31, commit `acf513f`).
- `concertation/page.tsx` : routage des participants « chef de famille » par lotissement vérifie `groupe==='proprietaire'` au lieu du bon rôle, sans filtrer par `famille_id` — laissé de côté (voir §4.3).

**Décision produit qui en a découlé** : le sous-rôle « chef de famille » devient un rôle formel `proprietaire_terrien`, distinct de « chefferie » (chef de village). Précision cruciale donnée par le user en cours de route : **pas une migration globale** — le cas de Koelea-Accor Revu (N'CHO KOUTOUAN JULES) reste indéfiniment sous l'ancien modèle `groupe='chefferie'`, seules les nouvelles familles/lotissements utiliseront le nouveau rôle. Coexistence permanente attendue, caractéristique de la gestion foncière ivoirienne (chaque lotissement peut avoir un régime coutumier différent).

**Livré** (planifié en Plan Mode avec un agent dédié, vérifié en base à chaque étape, 3 commits `d902621`/`2d8f0c0`/`5bd7813`) :

- Nouvelle valeur d'enum `proprietaire_terrien` + 7 policies RLS mises à jour en **additif pur** (`apfc_read`, `attributions_read`, `dossiers_read`, les 3 `pv_reunions_famille*`, `lots_read_scope`). Cette dernière avait un vrai bug (branche famille_id gardée par `mon_groupe()='proprietaire'` au lieu de `'chefferie'`/`'proprietaire_terrien'`) — N'CHO KOUTOUAN JULES ne voyait jusqu'ici aucun lot personnel dans son espace ; corrigé en branche additive.
- `ChefFamilleView` extraite de `chefferie/page.tsx` vers 3 fichiers partagés (`src/components/dashboard/chefferie/`) — une seule implémentation, réutilisée par l'ancien `/dashboard/chefferie` et le nouveau `/dashboard/proprietaire-terrien`. `ChefVillageView` et le comportement legacy inchangés.
- `ROLE_HOME`, `Sidebar.tsx`, libellés de rôle dans 5 fichiers, `DesignerChefFamilleModal` (assigne désormais `proprietaire_terrien` par défaut aux nouvelles désignations, sans jamais rétrograder un compte `chefferie` existant).
- Renommage d'affichage « Ayant droit » → « Propriétaire terrien » dans 5 fichiers (l'enum `qualite_attribution.ayant_droit` reste inchangé en base) ; « Propriétaire / Ayant-droit » (rôle `proprietaire`, différent) simplifié en « Propriétaire ».

Vérifié en base après coup : les 3 comptes existants (N'CHO KOUTOUAN JULES, `manuel.chefferie@sgfn.ci`, `manuel.chefvillage@sgfn.ci`) inchangés. `pnpm build` propre (125 pages), typecheck/lint sans régression (hors dette de lint préexistante, non aggravée). Nouveau tar.gz `sgfn-deploy-proprietaire-terrien.tar.gz` généré — **reste à uploader sur cPanel**. Détail complet en mémoire (`conflation_chefferie_chef_famille`).

### Session du 08/07/2026 (après-midi)

**Propriétaire terrien déployé en production.** L'archive du chantier de la nuit restait à uploader ; un rebuild frais a été généré (`sgfn-deploy-proprietaire-terrien-rebuild.tar.gz`, permissions Unix vérifiées 755/644), extrait sur cPanel par le user, et le déploiement confirmé en direct sur `https://sgfn.ci` (home, route `/dashboard/proprietaire-terrien` et assets `/_next/` en 200 ; l'asset servi correspond bien au nouveau build, pas à un cache). Anciennes archives de déploiement supprimées et `.gitignore` corrigé (`sgfn-deploy*.tar.gz` — l'ancien motif ratait les noms avec tiret).

**Test fonctionnel e2e réel — concluant.** Backend prouvé en SQL (enum `proprietaire_terrien` présent, les 7 policies additives bien en place, branche corrigée de `lots_read_scope` vérifiée). Compte de démonstration créé pour le nouveau rôle (`manuel.proprietaire-terrien@sgfn.ci`, rattaché à une vraie famille avec données). Login navigateur des 3 comptes (Playwright, `scripts/e2e-pt-verify.mjs`, commité) : `proprietaire_terrien` atterrit sur son espace et rend `ChefFamilleView` avec ses PV/APFC réels ; `chefferie` (chef de famille) et `chefvillage` (chef de village) inchangés — **non-régression confirmée**. Deux bugs de production réparés au passage sur `manuel.chefvillage`, qui ne pouvait plus se connecter du tout (identité `email` manquante + colonnes de tokens à `NULL` → GoTrue renvoyait 500). Mot de passe test de nouveau sauvegardé (`.env.local`). Détail complet en mémoire (`conflation_chefferie_chef_famille`).

**Doctrine documentaire précisée** (§A3) : après l'ajout de Graphify (graphe de connaissance du code) au projet, formalisation de la répartition en trois couches (graphe de code / ce document / mémoire agent) pour éviter les doublons — un fait, un seul foyer.

### État d'avancement — 06/07/2026

#### Audit de sécurité de suivi & fondations tarifaires

Un audit de suivi des advisors Supabase a révélé une alerte ERROR absente des audits précédents : la vue `annonces_publiques`, apparue avec la marketplace, était en SECURITY DEFINER — elle contournait le RLS de `lots` et `certificats_vente` pour n'importe quel appelant, y compris `anon`. Corrigée par migration (`fix_annonces_publiques_security_definer_view`) : policy RLS étroite `lots_marketplace_public_read`, nouvelle fonction dédiée `type_document_annonce(uuid)`, vue recréée avec `security_invoker = on`. Vérifié par test en rôle `anon` : comportement inchangé, ERROR disparu des advisors.

Au passage, la table `tarifs` a été créée en base (une ligne par `type_demarche`, RLS lecture-authenticated/écriture-admin), peuplée avec les montants réels de la grille du 03/07. `bornage`/`demande_acd`/`autre` restent `actif=false`. `database.types.ts` régénéré.

Nettoyage : branche Git obsolète `fix/home-stats-supabase` supprimée.

#### Dossier de passation développeur

Le squelette `docs/` (créé le 27/06, resté vide) a été entièrement rédigé : architecture technique, base de données, feuille de route, conventions/pièges connus. Consolidé en PDF imprimable (`docs/pdf/Dossier_Passation_SGNF.pdf`, 27 pages).

#### Dossiers argumentaires partenaires

Un dossier par métier (11 profils de `/metiers-partenaires`) dans `dossiers-partenaires/`, centré sur les bénéfices, distinguant ce qui fonctionne déjà sans compte (QR, marketplace) de ce qui dépend d'un rôle applicatif existant.

#### Bug invitations propriétaire/acquéreur — corrigé

La contrainte `invitations_check` exigeait un `attributaire_id` pour ces deux rôles, mais le formulaire admin ne le collectait pas. Corrigé côté front (sélecteur conditionnel) et côté DB (le trigger `handle_new_user()` ne recopiait pas `attributaire_id`/`commissaire_id` de l'invitation vers le profil créé à l'inscription). Au passage : page `/login` redesignée (panneau « J'ai un code d'invitation » distinct du formulaire de connexion).

#### Petites retouches UI

Bouton « Ouvrir la plateforme » → « Accéder à la plateforme » (4 occurrences). Espacement du header mobile de la home corrigé.

#### Bouton Itinéraire — Carte foncière

Popup de chaque lotissement positionné (`/dashboard/carte`) : lien direct vers Google Maps Directions.

#### Upload et aperçu de plans DWG/BAK — bloqué

Un géomètre peut téléverser un plan AutoCAD (`.dwg`/`.bak`) rattaché à un lot depuis le Coffre-fort Documentaire. Conversion en aperçu PNG via CloudConvert : pipeline fonctionnel mais le PNG généré à partir d'un vrai plan réel ressort blanc/vide. Cause probable : références externes (Xrefs) non incluses, ou géométrie blanche sur fond noir non inversée à l'export. D'où le pivot vers DXF-only tenté le 07/07 matin.

### Chantiers précédents (03/07, toujours d'actualité)

Mise en ligne des deux sites, scanner QR caméra, manuel utilisateur PDF, quittance PDF pro, notifications email (Resend), grille tarifaire fixée, chantier paiements (8/10 scénarios validés) : voir `docs/02-ROADMAP.md` pour le détail complet.

---

*Document directeur v1.2 — mis à jour le 08/07/2026 au matin (nouveau rôle Propriétaire terrien, rattrapage git/déploiement, comptes de test). v1.1 établie le 07/07/2026 au soir, fusionne la v1.0 et la Fiche projet SGNF (désormais obsolète, conservée pour l'historique Git uniquement). À réviser à chaque fin de phase, arbitrage stratégique (A1–A4), ou session de travail notable. Référence technique : `docs/` du repo `sgfn-web`.*
