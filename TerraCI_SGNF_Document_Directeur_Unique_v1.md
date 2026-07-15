# TerraCI × SGNF — Document Directeur Unique

**Version 1.18 — 15 juillet 2026**

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
| TerraCI Pro | 11 dossiers argumentaires partenaires rédigés (PDF) ; **premier persona Pro prototypé en avance (14-15/07) : Géomètre-Expert** — registre, portefeuille de missions hors registre SGNF, document PV de bornage généré/QR-vérifiable, dashboard dédié | 🟡 1er persona en prototype fonctionnel, offre commerciale (tarifs, abonnement) à structurer |
| TerraCI Collectivités | Rôles chefferie/commissaire opérationnels ; **nouveau rôle Propriétaire terrien** (ex chef de famille) séparé de la Chefferie village ; tarifs par chefferie amorcés (Ebimpe) | 🟡 Embryonnaire |
| TerraCI Analytics | Statistiques home, tableaux de bord par rôle ; **dashboard analytics chefferie livré et déployé en avance (13-14/07)** (composition du territoire, actes, recettes, alertes) | 🟡 1er dashboard institutionnel livré (chefferie), à généraliser aux autres rôles |
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
- **Tunnel d'acquisition complet — DÉPLOYÉ (10/07).** Parcours de bout en bout : l'acquéreur engage une demande → l'agence « Crée la vente » (comptant/échelonné) → paiement du lot (guichet ou en ligne) → au solde, **Certificat de vente émis + bascule automatique de la propriété** → « Facture l'attestation » (uniquement après solde) → paiement → attestation générée. La **répartition automatique des paiements** (Propriétaire/Chefferie/SGNF + frais agrégateur) et les écrans de config (frais agrégateur, tarifs 3e attestation) sont en prod. RPC clés : `creer_vente`, `encaisser_vente_guichet`, `creer_paiement_echeance_suivante`, `facturer_attestation_demande`.
- **Espace acquéreur « grand public » (10/07)** : page d'accueil guidée **`/dashboard/mon-achat`** — parcours visuel en 4 étapes (Demande → Payer → Propriétaire → Attestation), une seule action à la fois en gros bouton, vocabulaire simple (« Payer mon terrain », « Voir mon certificat »), pensée pour un public peu à l'aise avec le numérique. Le registre de vérification devient « Trouver un terrain ». Côté agence, **signal visuel « à faire »** : badge rouge chiffré au menu + bandeau/pastilles rouges sur les cartes actionnables (logique partagée `src/lib/agence-actions.ts`).
- **Registre de vérification acquéreur** (`/dashboard/acquisition`, « Trouver un terrain ») : lots attribués ayant une attestation, CTA « Vérifier » (QR + lien payant), « Engager l'acquisition ».
- **Infra de paiement en ligne CinetPay entièrement codée et déployée** (edge fns `initier-paiement`/`confirmer-paiement`, page `/paiements/retour`, ventilation automatique) — fonctionnelle dès l'ajout des 2 secrets `CINETPAY_API_KEY`/`CINETPAY_SITE_ID`.
- **Fondation notifications WhatsApp Cloud API — codée et déployée, INERTE (10/07).** Table `notifications` (file durable), triggers d'enfilement sur les événements du tunnel routés **par destinataire concerné** (règle de plateforme : chacun sur son propre numéro `profiles.telephone`, jamais un numéro central), edge `envoyer-whatsapp` fail-closed. S'active dès l'approbation des modèles Meta + pose des 2 secrets `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`.
- Coffre-fort documentaire, génération automatique de documents (edge function, sécurisée depuis le 07/07 soir), quittances PDF, notifications email (Resend), scanner QR caméra (accessible en un tap depuis un bouton dédié sur la page d'accueil depuis le 11/07, ouvre la caméra directement — pertinent pour l'app mobile Capacitor qui partage cette même page d'accueil), manuel utilisateur PDF.
- Table `tarifs` en base, **désormais branchée au formulaire `/dashboard/paiements`** (07/07 soir) — la saisie n'est plus totalement libre, les montants/commissions par type de démarche sont pré-remplis et validés.
- Dossier de passation développeur (27 pages, `docs/pdf/Dossier_Passation_SGNF.pdf`) — référence pour toute reprise du projet.
- **Rôle « Propriétaire terrien »** (nuit du 07 au 08/07) : le sous-rôle « chef de famille », jusqu'ici confondu avec la Chefferie (chef de village), devient un rôle formel à part entière (`groupe_utilisateur.proprietaire_terrien`), avec son propre tableau de bord `/dashboard/proprietaire-terrien`. **Coexistence permanente avec l'ancien modèle** — les comptes existants (Koelea-Accor Revu / N'CHO KOUTOUAN JULES) restent sous `groupe='chefferie'` indéfiniment ; seules les nouvelles familles/lotissements utilisent le nouveau rôle. Terminologie « Ayant droit » renommée en affichage « Propriétaire terrien » partout dans l'appli. **Déployé en production et validé par test fonctionnel e2e au navigateur le 08/07 après-midi** (nouveau rôle + non-régression chefferie/village — voir §10).
- **Score de confiance v1 — sans IA (13/07).** Phase 1 point 3 : `calculer_score_confiance(lot_id)` (5 critères × 20 pts — géométrie, cohérence attributaire, absence de litige, statut des documents, complétude du dossier, détail réservé au dashboard admin) et `score_confiance_lot(lot_id)` (total seul, exécutable sans connexion, injecté dans `verifier_attestation()`/`verifier_document()`). Affiché via `RadialGauge` sur `/dashboard/lots` (fiche détail, jauge + 5 sous-scores) et `/verifier` (verdict de vérification QR, attestation de cession et certificat de vente — pas l'APFC, document de lotissement). Le score suit le même chemin de paywall que le reste des champs de l'attestation. Marketplace différée (pas de Passeport parcelle pour l'instant). Testé sur données réelles (lot avec attestation délivrée → 70/100, lot avec attribution non entérinée et dossier incomplet → 30/100, lot libre → 20/100) et vérifié en navigateur.
- **Passeport parcelle v1 (13/07).** Phase 1 point 2 : nouvelle route publique `/passeport?ref=<référence document>` — écran unique par lot (identifiant, informations générales, propriétaire actuel, documents, chronologie de propriété, géométrie floutée ~500 m, compteur de vérifications, QR partageable, score de confiance). Construite en réutilisant le composant `VerifierForm` de `/verifier` (extrait vers `src/components/verification/`, prop `mode`) : même state machine fetch/paywall/paiement CinetPay, donc même paywall que `/verifier` (consultation payante dès la 2e attestation) sans nouvelle surface de sécurité. `verifier_attestation()`/`verifier_document()` (branche certificat_vente) étendues avec `lat_approx`/`lng_approx`/`nb_verifications` + parité des champs lot/lotissement/propriétaire entre les deux branches — l'APFC reste hors scope (document de lotissement, pas d'un lot). Lien « Voir le Passeport public » ajouté sur `/dashboard/lots`. Marketplace non couverte (aucun QR propre au lot, chantier séparé). Testé en base (rollback sur certificat de vente) et en navigateur (non-régression `/verifier`, paywall vérifié sur une attestation payante réelle).
- **Espace Géomètre-Expert — premier persona TerraCI Pro, prototype fonctionnel construit en 3 sessions (13-15/07) et DÉPLOYÉ.** Objectif : que ce métier pilote à terme l'ensemble de son activité depuis le SaaS, pas seulement un accès gratuit au registre. Construit : registre `geometres_experts` (numéro d'ordre, cabinet, contact), assignation de dossiers ADU et de démarches de bornage liées au registre SGNF, **portefeuille de missions libre** (`missions_geometre` — clients/lots hors registre SGNF, lot optionnel) avec **document PV de bornage généré, QR-vérifiable et payant-gratuit selon le même modèle que les attestations** (réutilise intégralement le pipeline générique `generation-document`/`verifier_document`), workflow de 3 signatures (demandeur/géomètre/autorité) avant remise. Dashboard dédié `/dashboard/geometre` **migré sur le Design System du Centre de pilotage admin** (15/07 — sobre, professionnel, cohérent avec le reste de la plateforme plutôt qu'un style ad hoc) avec panneau à onglets (missions/dossiers ADU/démarches) et sidebar réorganisée (Centre de pilotage/Espace Géomètre/Mes missions en tête). **Limite connue** : le compte de démonstration (`manuel.geometre`) est rattaché à une fiche registre créée manuellement pour le rendez-vous du 15/07 — **le parcours d'auto-inscription/onboarding d'un vrai géomètre-expert (création de sa propre fiche registre) reste à construire** avant d'ouvrir ce persona à de vrais clients payants.
- **Dashboard analytics chefferie — Phase 3 du doc directeur (TerraCI Analytics) lancée en avance, LIVRÉ ET DÉPLOYÉ (13-14/07).** Composition du territoire, actes délivrés, recettes, alertes — premier tableau de bord institutionnel par rôle, avant la Phase 3 planifiée en S1 2027 (voir §6). Corrige au passage une RLS chefferie manquante sur 3 tables.
- **Anti-double-attribution de dossier ADU + UI d'édition de statut (14/07).** Trigger `bloquer_double_adu` empêche qu'un même dossier ADU soit attribué deux fois ; `/dashboard/dossiers-adu` gagne un écran d'édition du statut. Fait suite au recoupement du cahier des charges dashboards partenaires avec l'existant (la majorité y figurait déjà sous d'autres noms).
- **Module « Opérateur de saisie » (maker-checker) — COMPLET (étapes 1-5) et DÉPLOYÉ EN PROD (11/07).** Nouveau rôle `groupe_utilisateur.operateur_saisie` dédié à la mise à jour de la base (attributions + création de lotissements/îlots/lots, y compris nouvelle autorité coutumière/opérateur/famille), soit à la main, soit par import d'un template Excel simplifié. Workflow de **double validation** : l'opérateur soumet un diff résolu (RPC `soumettre_saisie` → table `soumissions_saisie`, file + journal), **un admin approuve** (`approuver_soumission`, applique réellement avec historique préservé et garde-fou anti-attestation via GUC `sgnf.skip_free_attestation`) **ou rejette** (`rejeter_soumission` + motif). Front `/dashboard/saisie` : l'opérateur ne voit que ce module, aperçu du diff classé avant soumission (saisie manuelle ou import Excel, cumulables) ; l'admin a une file de validation + **pastille de rappel** au menu. Toutes les étapes livrées, committées (`72b633e`/`7d56d21`/`57cc2f3`/`8cdd4a6`) et testées e2e au navigateur/Playwright. Généralise le travail manuel des Guides de Répartition. Reste : le mode d'emploi du module (format pas encore choisi).

### 4.2 Décisions d'architecture actées

- Consultation marketplace libre sans compte ; SGNF reste l'intermédiaire — mise en relation **manuelle** par un admin (`/dashboard/contacts-marketplace`, aide WhatsApp). Aucune coordonnée publiée automatiquement.
- Éligibilité annonce : lot avec attestation ou certificat au statut `delivree`. Annonces sans expiration.
- Recherche guidée : Zone → Usage → Superficie → Budget.
- Confidentialité GPS : coordonnées exactes privées ; le public voit un **cercle flou de 500 m** (arrondi ~110 m côté base).
- **0 commission** sur les ventes de lots via la marketplace ; le pass est un revenu SGNF intégral.
- Stack : Next.js (export statique) + Supabase (Postgres/RLS, edge functions, storage) + CinetPay + Resend. Gestionnaire de paquets : **pnpm** exclusivement.
- Tarification des attestations de cession : voir §4.1 — modèle à 3 paliers (gratuit / forfait national / variable par chefferie), remplace l'ancien tarif unique 100 000–150 000 FCFA fixé le 03/07 (jamais utilisé en pratique).

### 4.3 Dette technique et risques ouverts (au 12/07)

| # | Sujet | Gravité | Détail |
|---|---|---|---|
| 1 | **Activation des notifications WhatsApp** | 🟡 | Fondation déployée et **inerte**. Manque : l'approbation des modèles Meta (`sgnf_action_agence`, `sgnf_acquereur_etape`, ~24-48h) + les 2 secrets edge `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`. Aussi : **6 profils/18 sans numéro `telephone` valide** (marqués `ignore` à l'envoi) → prévoir le téléphone obligatoire à l'inscription. |
| 2 | **Secrets CinetPay absents** | 🔴 Bloquant revenus | Toute l'infra en ligne est codée **et déployée** (edge fns, ventilation) ; il ne manque que 2 secrets edge `CINETPAY_API_KEY`/`CINETPAY_SITE_ID`. Un bug latent du webhook (`marquer_paiement_recu`) a été corrigé le 09/07. Un bug CORS latent bloquant tout appel `initier-paiement` depuis un vrai navigateur a aussi été corrigé le 11/07 (voir §10) — sans lui, poser les secrets n'aurait pas suffi. Sans secrets : paiement en ligne (pass, attestation, vente) et paywall QR indisponibles. |
| 3 | Pivot plans CAD → DXF | 🟡 | Commit `25a91cc` non testé en réel (rendu blanc DWG contourné). |
| 4 | ~~Leaked password protection — bloqué~~ **RÉSOLU (10/07 soir)** | ✅ | Le user est passé au plan **Supabase Pro** ; `password_hibp_enabled` activé via l'API management (HTTP 200), alerte disparue des security advisors. Voir §10. |
| 5 | ~~Modale « Créer une cession », formulaire paiements, écran Propriétaire terrien — jamais testés en navigateur réel~~ **RÉSOLU (11/07)** | ✅ | Propriétaire terrien testé e2e navigateur dès le 08/07 (voir §10) ; modale de cession et formulaire paiements vérifiés en navigateur le 11/07 (Playwright contre prod, sans soumettre) — préremplissages et calculs de tarif conformes au code, aucun bug. |
| 6 | ~~Webhook rebuild monterrain-web~~ **RÉSOLU (11/07)** | ✅ | Export statique cPanel sans SSH/FTP : pas de rebuild automatique possible (automatisation du déploiement explicitement déclinée par le user). À la place : suivi `marketplace_etat_site` + pastille admin (Sidebar + bandeau Contacts Mon Terrain) qui signale qu'une republication est due. |
| 7 | ~~Photos d'annonces~~ **RÉSOLU (11/07)** | ✅ | Table `photos_annonces` + bucket public `annonces-photos`, upload/suppression sur « Mettre en vente », photo de couverture + galerie sur monterrain-web. |
| 8 | Tarifs chefferies réels au-delà d'Ebimpe | 🟡 | Seule la Chefferie d'Ebimpe a un tarif palier-3 dans `tarifs_attestation_chefferie` — les autres bloquent la 3e attestation tant qu'un tarif n'est pas fixé (**un écran admin de config existe désormais** sur `/dashboard/paiements`, à déployer). Bornage/demande ACD toujours sans montant dans `tarifs`. |
| 9 | ~~Flux d'invitation incomplet pour Chefferie/Propriétaire terrien~~ **RÉSOLU (11/07)** | ✅ | `invitations` a désormais `famille_id`/`autorite_coutumiere_id`, formulaire conditionnel selon le rôle, `handle_new_user()` recopie vers `profiles`. |
| 10 | ~~`concertation/page.tsx` — routage participants~~ **RÉSOLU (11/07)** | ✅ | Auto-sélection corrigée pour matcher `autorite_coutumiere_id`/`famille_id` réels du lotissement au lieu d'un mauvais rôle sans filtre. |
| 11 | Différés | ⚪ | Mobile Money définitif, SMS, APK Android, achat libre-service acquéreur (~~transition `generee → delivree`~~ **résolue le 13/07**, voir §10). |
| 12 | ~~Module Opérateur de saisie — à déployer + compléter~~ **RÉSOLU (11/07)** | ✅ | Étapes 4 (import Excel) et 5 (création de structure + nouvelles entités) codées et testées e2e (`8cdd4a6`) ; module complet **déployé en prod** le 11/07. Reste seulement le mode d'emploi (hors dette technique). |
| 14 | ~~Onboarding self-service géomètre-expert absent~~ **RÉSOLU (15/07)** | ✅ | Demande publique `/devenir-geometre` → validation admin sur `/dashboard/geometres` (approuver/rejeter) → invitation `groupe=geometre` auto-générée avec `geometre_id` → inscription via `/inscription` (flux existant, inchangé) → compte lié automatiquement à la fiche registre, zéro intervention manuelle admin. Table `demandes_inscription_geometre`, RPC `demander_inscription_geometre`/`approuver_demande_geometre`/`rejeter_demande_geometre`. Testé de bout en bout (demande anon → approbation admin → inscription → `profiles.geometre_id` lié), fixtures nettoyées. |
| 13 | ~~Succession chefferie/lignée Ako Djebe (Koelea-Accor Revu)~~ **Successeurs identifiés, comptes en attente d'activation (12/07)** | 🟡 | **N'Cho Koutouan Jules** (chef de la lignée Ako Djebe, grande famille Beuh, propriétaire terrien de Koelea-Accor Revu) est **décédé depuis environ un an**. Successeur confirmé : **N'Cho Ohouo Boniface** (déjà attributaire connu, 4 lots sur Koelea-Accor Revu + 106 sur Brignan Kakodji), rôle tranché **`proprietaire_terrien`** (migration de la lignée). **Invitation créée (code `SGNF-UR2BEKPJ`, expire 19/07)**. **Nanan Affa Kouachy Alfred** (signataire historique de l'APFC-EBIMPE-2022-001) n'est plus chef du village d'Ebimpe ; successeur confirmé : **Mondon Atsin Pacome**, personne entièrement nouvelle pour le système (aucun profil/attributaire préexistant), rôle **`chefferie`**. **Invitation créée (code `SGNF-6EW6XNSY`, expire 19/07)**. Dans les deux cas : reste à transmettre le code, attendre l'inscription (`/inscription`), puis finaliser côté Boniface (désignation manuelle via `/dashboard/familles`, `familles.chef_profile_id` étant un FK unique) — côté Mondon Atsin Pacome, l'inscription seule suffit (`autorite_coutumiere_id` posé par l'invitation, recopié automatiquement à l'inscription, apparition automatique dans la liste des chefs d'Ebimpe), seul le texte cosmétique `autorites_coutumieres.chef` restera à corriger à la main. Statuer aussi sur les profils dormants de Jules/le texte legacy de Nanan Affa. Piste « Ossepe Cho » (texte libre incohérent dans `familles.chef_de_famille`) toujours inexpliquée. Détail complet en mémoire agent. |

**Risques soldés depuis la v1.1 (soir du 07/07)** — pour mémoire, ne sont plus des risques ouverts :

- Faille de sécurité `generation-document` (garde `HOOK_SECRET` inerte) — auditée puis **corrigée et déployée**, testée en réel (voir §10).
- Grille tarifaire non branchée à l'UI paiements — **branchée**.
- Front non déployé (cessions par palier, grille tarifaire) — **`sgfn-deploy-cessions-paliers.tar.gz` uploadé sur cPanel**. Le travail correspondant a aussi été commité en git à la reprise de session (5 commits, jusque-là non versionné) : sécurité `generation-document`, tarification par palier, grille tarifaire, fusion documentaire, et le fix `familles.lignee` (colonne disparue, cassait silencieusement la vue Chef de famille et la génération de documents — edge function redéployée en v31).
- Confusion Chefferie / Chef de famille — diagnostiquée précisément (compte de test mal câblé, flux d'invitation et libellés en cause) puis traitée à la racine par le nouveau rôle Propriétaire terrien, **déployé en prod et validé e2e au navigateur le 08/07 après-midi**.
- Bug latent `marquer_paiement_recu` (webhook CinetPay, `CASE` renvoyant du `text` non casté vers l'enum `statut_paiement`) — **corrigé le 09/07** avant toute activation de l'agrégateur.
- **Front du tunnel acquéreur non déployé + UI du flux vente à coder** — **soldé le 10/07** : le tunnel complet (demande → vente → certificat → attestation + répartition) est codé, déployé et **vérifié en prod** ; l'espace acquéreur a été repensé « grand public » (page guidée « Mon achat ») et l'agence dotée d'un signal « à faire » (badge + pastilles rouges). 3 commits `0105535`/`af11a06`/`e740b89`.
- **Leaked password protection — bloqué (plan Free)** — **soldé le 10/07 soir** : upgrade **Supabase Pro**, `password_hibp_enabled` activé et confirmé (advisors). Le plan Pro débloque aussi les sauvegardes quotidiennes (7 j) et la non-mise-en-pause du projet ; PITR décliné (coût). Voir §10.
- **Module Opérateur de saisie non déployé** — **soldé le 11/07** : étapes 4-5 (import Excel, création de structure + nouvelles entités) codées, testées e2e, module complet déployé en prod.
- **Modale cession / formulaire paiements jamais testés en navigateur** — **soldé le 11/07** : vérifiés en prod (Playwright, sans soumettre), calculs de tarif et préremplissages conformes, 0 bug.
- **Flux d'invitation Chefferie/Propriétaire terrien incomplet + bug de routage `concertation/page.tsx`** — **soldés le 11/07** : `invitations` porte désormais le rattachement dès la création, auto-sélection des participants corrigée (voir §10).
- **Webhook rebuild monterrain-web + photos d'annonces (dette #6/#7)** — **soldés le 11/07** : suivi de reconstruction du site (pastille admin) + photos d'annonces (upload, bucket public, galerie) — voir §10.
- **Bug CORS latent sur 5 edge functions appelées via `functions.invoke()`** (`publier-annonce`, `initier-paiement`, `acheter-pass-marketplace`, `statut-pass`, `demande-contact`) — **corrigé le 11/07** : `Access-Control-Allow-Headers` n'incluait pas `x-client-info`, envoyé par défaut par le client Supabase JS navigateur → tout appel depuis un vrai navigateur échouait en préflight CORS avant même d'atteindre la fonction. Jamais détecté avant car les tests précédents étaient scriptés (pas de CORS hors navigateur) ou volontairement non-soumis. Voir §10.
- **Faille critique — groupe auto-attribuable via `signUp()`** — **corrigée le 15/07** : `handle_new_user()` dérivait `profiles.groupe` des métadonnées envoyées par le client, sans vérifier d'invitation ; comme `est_admin()` ne teste que `groupe='admin'`, n'importe qui pouvait s'auto-attribuer un compte admin via un appel API direct (hors UI). Corrigé : le groupe est désormais toujours lu depuis la ligne `invitations` en base. Trouvée en concevant l'onboarding self-service géomètre (dette #14, voir §4.3) et corrigée avant de continuer. Migration `20260715100000_fix_handle_new_user_groupe_from_invitation.sql`.
- **RLS `dossiers_adu` trop large pour le groupe géomètre** — **corrigée le 15/07** : `dossiers_read` accordait la lecture de toute la table à quiconque avait `groupe='geometre'` (pas seulement ses dossiers assignés), contrairement à `missions_geometre`/`pv_bornage`. Resserré via `mon_geometre_id()` avant d'ouvrir l'inscription à de vrais géomètres externes. Migration `20260715103000_tighten_dossiers_adu_geometre_rls.sql`.

---

## 5. Arbitrages stratégiques (à trancher, dans cet ordre)

### A1 — Architecture de marque ✅ TRANCHÉ (13/07/2026)

**Décision actée : architecture à deux niveaux.**
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

1. ~~Uploader `sgfn-deploy-proprietaire-terrien.tar.gz` sur cPanel~~ — **fait le 08/07** (voir §10).
2. 🔴 Poser les secrets CinetPay (`CINETPAY_API_KEY`/`CINETPAY_SITE_ID`) — active pass marketplace en ligne, scénarios F/G, paywall QR électronique. **Seul point rouge bloquant restant.**
3. ~~Tester en navigateur la modale « Créer une cession », le formulaire paiements branché sur `tarifs`, et le nouvel espace Propriétaire terrien~~ — **fait** (Propriétaire terrien le 08/07, cession/paiements le 11/07 — voir §4.3).
4. 🟡 Tester le pivot DXF en réel (upload + conversion + aperçu non blanc).
5. 🟡 Provisionner les tarifs des chefferies au-delà d'Ebimpe dans `tarifs_attestation_chefferie` ; chiffrer bornage + demande ACD dans `tarifs`.
6. 🟡 Tests E2E des parcours marketplace et paiements après pose des secrets.
7. ~~Combler le flux d'invitation Chefferie/Propriétaire terrien~~ et ~~le bug de routage `concertation/page.tsx`~~ — **fait le 11/07** (voir §4.3, points 9-10).
8. ⬜ *Leaked password protection* — ~~reporté, bloqué par le plan Supabase Free~~ **fait, voir §4.3 point 4** (ligne conservée pour l'historique de la Phase 0, à retirer à la prochaine révision).

**Critères de sortie :** secrets CinetPay posés ; un paiement CinetPay réel encaissé sur chaque canal (pass, consultation QR, acte, attestation de cession). *(Front Propriétaire terrien/cession/paiements et leaked password protection : soldés, voir §4.3.)*

### Phase 1 — SGNF devient le MVP TerraCI (T3 2026)

*Objectif : matérialiser les deux différenciateurs de la vision sur la base existante.*

1. ~~Arbitrage A1 (marque) acté et documenté~~ — **fait (13/07)** : architecture à deux niveaux (SGNF institutionnel/back-office, TerraCI grand public), voir §5.
2. ~~Passeport parcelle v1~~ — **fait (13/07)**, voir §4.1. Écran unique conforme au Livre VI (identifiant, QR, informations générales, propriétaire(s), documents, chronologie, géométrie, vérifications), atteint via la référence d'un document existant (`/passeport?ref=...`) — même paywall que `/verifier`, aucune nouvelle surface de sécurité/paiement. Marketplace non couverte (pas de QR propre au lot).
3. ~~Score de confiance v1 — sans IA~~ — **fait (13/07)**, voir §4.1. Score sur règles calculable en SQL (5 critères × 20 pts : géométrie, cohérence attributaire, absence de litige, statut des documents, complétude du dossier). Affiché sur `/dashboard/lots` et `/verifier` (le Passeport n'existant pas encore, la marketplace reste différée). L'IA (Livre sur le Score TerraTrust) reste explicitement reportée en V2.
4. Marketplace maturité : photos d'annonces, webhook/procédure de rebuild, parcours d'acquisition en libre-service ; ~~transition `generee → delivree` tranchée~~ **fait (13/07)** — voir §10, la remise physique devient une confirmation admin distincte de la génération du PDF.
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

1. **TerraCI Pro** : transformer les 11 dossiers argumentaires partenaires en offres d'abonnement (géomètres, notaires, banques, promoteurs, agences), conformément au Livre XIII. ~~Géomètre-expert~~ **1er persona prototypé en avance (14-15/07), onboarding self-service livré (15/07)** — voir §4.1 ; reste : offre commerciale (tarifs/abonnement), puis les autres personas (notaires, banques, promoteurs, agences).
2. **API publique v1** : OpenAPI, clés partenaires, versionnement, endpoints lecture Verify + Parcelles. Pilier interopérabilité et 4e source de revenus.
3. **TerraCI Analytics** : tableaux de bord institutionnels pour collectivités et chefferies. **1er dashboard (chefferie) livré en avance (13-14/07)** — voir §4.1 ; reste à généraliser aux autres rôles institutionnels.
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
| **Vente d'un lot (tunnel acquéreur, comptant/échelonné)** | Prix négocié | Propriétaire 100 % · SGNF 0 % · frais agrégateur absorbés par l'acquéreur | Base en prod (`creer_vente`, Certificat de vente au solde), front à faire |
| Commission sur ventes marketplace | 0 | — | Décision actée |

**Répartition automatique** (depuis le 09/07) : chaque paiement confirmé est ventilé automatiquement (`repartitions_paiement`) entre Propriétaire / Chefferie / Commission SGNF. Les **frais agrégateur** (montant fixe configurable, paiements en ligne uniquement) sont **déduits de la commission SGNF** pour les attestations et **absorbés par l'acquéreur** pour les ventes de lots. La **propriété d'un lot bascule au Certificat de vente** (vente soldée), l'attestation de cession venant après.

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

### Session du 09/07/2026

Grosse session centrée sur le **parcours Acquéreur** et le **modèle de paiement**. Tout le travail base est en production (6 migrations `20260709_*`) et testé e2e en rollback ; **le front du tunnel n'est pas encore déployé**.

**Registre acquéreur mis en ligne.** La refonte de `/dashboard/acquisition` (commit `a7fb488` : d'un catalogue de lots libres à un registre de vérification — RPC `lots_verifiables`, CTA « Vérifier » avec QR + lien payant) était commitée et sa base en prod, mais le front servait encore l'ancien bundle. Diagnostic live (le HTML servi datait de la veille), rebuild + `tar.gz`, extraction cPanel par le user, puis confirmation que `sgfn.ci` sert le nouveau chunk. **Piège noté** : le `.htaccess` du site a un catch-all qui renvoie `index.html` (HTTP 200, `text/html`) pour tout chemin absent — vérifier un déploiement au seul code 200 est trompeur ; regarder le `content-type` et le `Last-Modified`.

**Tunnel « Demande d'acquisition ».** Maillon entre la vérification et la cession : l'acquéreur « Engage l'acquisition » (table `demandes_acquisition` + RPC `creer_demande_acquisition`, ouvre un fil de messagerie), l'agence pilote une file de demandes à statuts et « Convertit », l'acquéreur voit son attestation. Commits `45dd55f` (base + file agence + conversion) et `59d2180` (encaissement guichet → attestation). L'acquéreur est rattaché à son `attributaire` (`profiles.attributaire_id`) → il retrouve son attestation dans « Mon espace ». Testé e2e en SQL en transaction annulée (le MCP Supabase honore BEGIN/ROLLBACK ; `pg_net` = aucun appel edge réel sur rollback).

**Paiement en ligne + bug webhook corrigé.** L'infra CinetPay était déjà entièrement codée **et déployée** (edge fns `initier-paiement`/`confirmer-paiement` actives, page `/paiements/retour`) — seuls manquent les secrets `CINETPAY_API_KEY`/`CINETPAY_SITE_ID`. Bug latent trouvé et corrigé : `marquer_paiement_recu` (appelée par le webhook) plantait (`CASE` renvoyant du `text` non casté vers l'enum `statut_paiement`, ERROR 42804) — jamais déclenché car CinetPay inactif, mais aurait cassé la 1re confirmation en ligne. Front « Payer en ligne » ajouté au tunnel + UI admin des tarifs 3e attestation par chefferie sur `/dashboard/paiements`. Commits `8a79041`, `ea2c5d9`.

**Reséquencement majeur — la propriété bascule à la VENTE, plus à la cession.** Décision structurante actée avec le user : le tunnel acquéreur est une **revente réelle**. Trois voies de paiement : (1) **prix du lot** (vente comptant/échelonné) → **Propriétaire** (titulaire actuel, SGNF 0 %, SGNF enregistre le flux) ; (2) **attestation** → **Chefferie + Commission SGNF** ; (3) **frais agrégateur**. La propriété **ne bascule qu'au Certificat de vente** (vente soldée) ; l'attestation devient une étape séparée, après. Les attributions originelles (opérateur rang 1‑2, propriétaire terrien rang 1) restent administratives. Implémenté et testé e2e en rollback :
- `creer_vente` + réécriture des triggers `ventes` : échéances à la création, **certificat + bascule de propriété au solde** (`trg_ventes_soldee`). Comptant → solde immédiat ; échelonné (3×2M) → certificat seulement à la dernière échéance. Commit `e11a984`.
- **Répartition automatique** (`repartitions_paiement` + trigger `ventiler_paiement`) : vente → Propriétaire 100 % + frais agrégateur absorbés par l'acquéreur ; attestation → Chefferie + Commission SGNF, frais agrégateur **déduits de la commission SGNF**. Frais = **montant fixe configurable** (défaut 0), paiements en ligne uniquement. Commit `e11a984`.
- **Découplage de l'attestation** : `facturer_attestation_cession` facture le titulaire actuel selon son palier **sans re-transférer la propriété**. `creer_cession` reste pour la cession manuelle admin. Commit `c36f6c7`.
- **UI Paiements** : config admin du frais agrégateur + ventilation dépliable par paiement (Propriétaire/Chefferie/SGNF/Agrégateur). Commit `4c46c19`.

**Reste (chantier tunnel UI, non commencé) :** rendre le flux vente cliquable de bout en bout — lier `demandes_acquisition.vente_id`, enrichir la vue agence, remplacer côté agence « Convertir en cession »/« Encaisser » (devenus obsolètes) par « Créer la vente » puis « Facturer l'attestation » **après vente soldée** (garde-fou indispensable : sinon on facturerait le vendeur), côté acquéreur « Payer le lot » → Certificat de vente. Puis **déployer le front** (tar.gz à jour) et **activer CinetPay** (2 secrets edge).

### Session du 09 au 10/07/2026 (reprise « tunnel vente »)

**Tunnel de vente câblé de bout en bout, déployé et vérifié en prod.** Migration `20260709_vente_tunnel_wiring.sql` : `demandes_acquisition.vente_id` (posé par `creer_vente`), vue `demandes_acquisition_agence` enrichie (état vente/certificat/paiement), et 3 RPC `SECURITY DEFINER` — `encaisser_vente_guichet` (l'opérateur encaisse au guichet ; `valider_paiement_manuel` était admin-only via RLS), `creer_paiement_echeance_suivante` (échelonné, agence ou acquéreur), `facturer_attestation_demande` (**garde de séquence : exige la vente soldée** avant de facturer, sinon on facturerait le vendeur). L'encaissement guichet de l'attestation réutilise `encaisser_demande_acquisition`. Front agence refait en 3 phases (Créer la vente → Encaisser le lot → Facturer/Encaisser l'attestation), `ConvertModal` retiré. Testé e2e en rollback (JWT admin simulé) : vente comptant → solde → **CERT-VENTE émis + attribution rang 2 acquéreur** → attestation générée + répartitions ventilées. Commit `0105535`.

**Espace acquéreur repensé « grand public » + signal « à faire » agence.** Constat du user (concepteur lui-même) : le suivi de l'achat était noyé dans le registre. Décision : **page d'accueil dédiée `/dashboard/mon-achat`** — ruban visuel 4 étapes, une action à la fois en gros bouton, mots simples, zéro jargon (« cession »/« échéance » masqués), pensée pour un public peu lettré. Le registre devient « Trouver un terrain ». Côté agence, pour **ne rien rater** : logique partagée `src/lib/agence-actions.ts`, **badge rouge chiffré** au menu (rafraîchi après action via event `sgnf:refresh-badges`), **bandeau + pastilles rouges** sur les cartes actionnables, remontées en tête. Commit `af11a06`. **Déployé sur cPanel** (build → tar.gz → extraction), vérifié : home 200, asset `/_next/static` **200** (pas de 403), route `/dashboard/mon-achat` 200.

**Fondation notifications WhatsApp (inerte, prête pour Meta).** Règle de plateforme actée : **chaque événement notifie le(s) utilisateur(s) concerné(s) sur SON propre numéro** (`profiles.telephone`), jamais un numéro central ; applicable à tous les rôles/modules. Migration `20260710_notifications_foundation.sql` : table `notifications` (file durable), helper `destinataires_agence_lot` (= périmètre `da_agence_read`), triggers `AFTER INSERT` (demandes/ventes/certificats/attestations) qui enfilent une notif par destinataire, **tous protégés par des gardes d'exception** (jamais bloquant pour une vente), dispatch → edge `envoyer-whatsapp`. Edge déployée **fail-closed** (503 sans `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` → notif reste `en_attente`). Testé e2e en rollback : chaque étape route la bonne notif (agence 6 = admins+opérateur+chefferie / acquéreur 1). Commit `e740b89`. Reste (côté user) : approbation des modèles Meta (~24-48h) + pose des 2 secrets ; **6 profils/18 sans numéro** → téléphone à rendre obligatoire à l'inscription.

**Guide grand public « Acheter mon terrain » (manuel acquéreur).** Page autonome publique `/guide-achat` (hors layout `/dashboard`, aucune donnée privée) : timeline visuelle à 4 étapes calquée sur le ruban de « Mon achat », reproductions fidèles des vrais boutons (couleurs/icônes identiques), vocabulaire simple en « je », zéro jargon — pensée pour une audience peu lettrée. Bouton **« Imprimer / Enregistrer en PDF »** (`window.print()` + CSS `@media print` scopé, couleurs conservées via `print-color-adjust: exact`) : une seule source pour l'écran et le papier. Liens « Comment ça marche ? » ajoutés sur `/dashboard/mon-achat`. Vérifié au navigateur (Playwright, export statique) : rendus mobile/desktop/impression OK. Commit `4f29cb8`.

**Réconciliation du Guide de Répartition Brignan Kakodji (« ACTU1AB »).** Le fichier Excel déposé par le user s'est révélé être une vraie correction de terrain (pas un simple remplissage) : diff calculé lot par lot (guide parsé vs état base) → 325 lots inchangés, **55 nouvelles attributions**, **428 réassignations** (majoritairement des échanges impliquant l'opérateur KONE MORIFERE), **13 remises à `libre`** (cohérentes avec la nouvelle feuille récap « PARCELLES NON ATTRIBUEES »), **1 lot manquant créé** (trou de séquence îlot 36/lot 285), **2 nouveaux attributaires** (DJEKOU AGBADOU BLAISE, N'CHO KOUACHY BENOIT — ce dernier en réalité déjà existant en base, retrouvé sans doublon). Garde-fou : vérifié **0 activité réelle** (demande/vente/cession/attestation) sur ce lotissement avant d'autoriser l'opération. Trigger `trg_gen_attestation_gratuite` désactivé puis réactivé (0 attestation parasite créée). **Testé en `rollback` puis rejoué en `commit`**, revérifié par requête indépendante post-commit. Résultat : 849 lots, 809 attributions actuelles, 40 libres, 15 attributaires. Ajustements complémentaires le jour même : attribution de N'CHO KOUTOUAN JULES → **N'CHO OHOUO BONIFACE** (identité déjà existante en base, uniquement pour Kakodji — ses 2 lots sur Koelea-Accor revu non touchés), téléphones ajoutés pour KONE MORIFERE et DJEKOU AGBADOU BLAISE. Opération 100 % base de données (API management Supabase), aucun commit git associé.

### Session du 10/07/2026 (soir — Supabase Pro + module Opérateur de saisie)

**Passage à Supabase Pro → protection mots de passe fuités activée.** Le user a souscrit le plan Pro. Débloque `password_hibp_enabled` (HaveIBeenPwned) qui était en `402 Payment Required` sur Free : activé via l'API management (PATCH `config/auth`, HTTP 200), confirmé par relecture + disparition de l'alerte des security advisors (0 ERROR de sécurité). Le Pro apporte aussi les **sauvegardes quotidiennes** (7 j, déjà présentes) et la **non-mise-en-pause** du projet ; **PITR décliné** (~100 $/mois + add-on compute). Reste sur le Pro de base (dette #4 soldée).

**Durcissement FK-index / RLS (suivi de l'audit du 29/06).** Les features livrées du 07 au 10/07 avaient réintroduit le même drift : 12 clés étrangères sans index de couverture (`demandes_acquisition`, `familles`, `tarifs`, `paiements`…) + 6 policies RLS avec `auth.uid()` réévalué ligne par ligne (`lots_read_scope`, `da_agence_read`, `notif_read`…). Corrigé par migration `20260710_harden_fk_indexes_rls_initplan` (12 `CREATE INDEX` + `ALTER POLICY` enveloppant `auth.uid()` en `(select auth.uid())`, logique préservée). Vérifié via advisors : les 18 alertes ciblées ont disparu. Commit `31f3ec2`.

**Réconciliation Guide Kakodji « ACTU1A ».** Fichier déposé 2 h après ACTU1AB (ne pas se fier au nom sans le « B » — vérifier la date). Diff très propre : 808 inchangés, **13 nouvelles attributions** (les 13 lots laissés en attente par ACTU1AB, tous à N'CHO KOUACHY BENOIT), **1 remise à `libre`** (73/644, quitté par KONE MORIFERE), 0 réassignation. Testé rollback puis commit, revérifié indépendamment. Résultat : 849 lots, **821 attributions actuelles, 28 libres**. Trigger d'attestation neutralisé (0 attestation parasite) — **consigne du user : ne pas générer d'attestation de cession pour l'instant**. 100 % base, aucun commit git.

**Module « Opérateur de saisie » (maker-checker) — étapes 1-3.** Nouveau module du SaaS pour renseigner les mises à jour de la base sans passer par une réconciliation manuelle. Cadrage décidé avec le user : rôle `operateur_saisie` isolé (ne voit que son module), template Excel simplifié dédié (à venir), **aperçu du diff obligatoire**, **double validation admin** (maker-checker), résolution d'attributaire par recherche + création explicite (jamais silencieuse), création de structure via formulaire séparé, **pas de génération d'attestation de cession**, audit des soumissions.

- **Étape 1 (DB, `72b633e`)** : enum `operateur_saisie` (migration séparée, façon `proprietaire_terrien`) ; table `soumissions_saisie` (file d'attente + journal) ; RPC `soumettre_saisie` / `approuver_soumission` (admin) / `rejeter_soumission` + helpers d'application révoqués ; **garde-fou GUC `sgnf.skip_free_attestation`** ajouté au trigger `trg_creer_attestation_gratuite` (retour anticipé si `on`, défaut inchangé) — remplace le « disable trigger » manuel des backfills, sans DDL/lock, réutilisable. Application pilotée par l'état cible (résiliente à un diff périmé entre soumission et approbation), historique préservé (`actuel=false` + `rang+1`). Testée en rollback sur données réelles + types régénérés.
- **Étape 2 (front saisie, `7d56d21`)** : page `/dashboard/saisie` + lib partagée `src/lib/saisie.ts` (contrat payload/diff). Sélection lotissement → modifs lot par lot (attribuer existant/nouveau, ou remettre libre) → aperçu du diff classé → soumission. Sidebar : item réservé, `operateur_saisie` ne voit que ce module, `ROLE_HOME` → `/dashboard/saisie`.
- **Étape 3 (validation admin, `57cc2f3`)** : composant `FileValidation` (file des soumissions en attente, détail du diff résolu au moment de la validation, Approuver/Rejeter + motif, historique) ; 2e onglet dépendant du rôle ; **pastille de rappel** rouge sur le menu admin (count `en_attente`, event `sgnf:refresh-badges`).
- Vérifié **e2e au navigateur** : cycle complet soumettre → valider → approuver (appliqué en base réelle puis revert) + soumettre → rejeter (motif stocké, 0 changement) ; **compte test `manuel.operateur-saisie@sgfn.ci` créé** (insert `auth.users`/`identities` direct, groupe posé par `handle_new_user`) → sidebar réduite au seul module, pas de badge (maker). Reste (à cette date) : étapes 4 (import Excel) et 5 (création de structure) — **livrées le lendemain, voir ci-dessous**.

### Session du 11/07/2026

**Module « Opérateur de saisie » complété (étapes 4-5) et DÉPLOYÉ EN PROD.** Commit unique `8cdd4a6` : import Excel (`src/lib/saisie-import.ts` en logique pure + `ImportExcel.tsx`, modèle `.xlsx` téléchargeable, résolution d'attributaires groupée avec rapprochement auto ou création explicite, jamais silencieuse) — alimente **exactement le même** contrat `mods`/`nouveaux` que la saisie manuelle, donc zéro nouveau code serveur ; création de structure (`CreationStructure.tsx`, formulaire séparé, le contrat DB était déjà posé à l'étape 1) avec option de créer une nouvelle autorité coutumière/opérateur/famille en même temps qu'un nouveau lotissement (migration `20260711_operateur_saisie_nouvelles_entites.sql`). Testé e2e (Playwright, serveur dev local contre la vraie base prod) : import Excel (nouvelle attribution, réassignation, remise libre, nouvel attributaire) → aperçu du diff exact → soumis → rejeté volontairement, 0 effet de bord confirmé en base indépendamment ; création de structure avec 3 nouvelles entités → cycle rejeter (0 ligne créée) **puis cycle approuver réel** (lotissement + autorité + opérateur + famille + îlot + lot créés et correctement liés par FK, vérifié, puis nettoyé manuellement). Build régénéré, `sgfn-deploy.tar.gz` recréé et **uploadé sur cPanel par le user** — module fonctionnellement complet et en ligne. Reste : le mode d'emploi du module (format pas encore choisi).

**Vérification navigateur de deux chantiers déployés mais jamais testés côté front.** Modale « Créer une cession » (`/dashboard/lots`) et formulaire « Nouveau paiement » (`/dashboard/paiements`) : testés en prod via Playwright (connecté `manuel.admin`, sans jamais soumettre, donc aucune donnée réelle créée). Résultat : la modale de cession affiche exactement 30 000 FCFA (20 000 chefferie + 10 000 commission) pour une 2e attestation, conforme au code ; le formulaire paiements affiche la bonne grille tarifaire et charge ses listes sans erreur pour les 3 types testés. Aucun bug trouvé. Solde la dette #5 (voir §4.3).

**Accès direct au scan QR depuis la page d'accueil.** Demande du user : rendre le scan « déjà visible » dès l'ouverture de l'app, pour éviter de construire une app mobile dédiée séparée juste pour ça. Contexte clé : l'app mobile (Capacitor, voir dette #11 « Différés ») empaquette ce même export statique (`webDir: out`, pas de `server.url`) — la page d'accueil de l'app mobile **est** `src/app/page.tsx`. Ajout d'un bouton « Vérifier un QR code » dans le hero (visible sans scroll) pointant vers `/verifier?scan=1`, nouveau paramètre qui ouvre la caméra automatiquement (au lieu d'un clic supplémentaire sur « Scanner avec la caméra »). Vérifié en navigateur (viewport mobile, caméra simulée) : le tap ouvre directement un flux vidéo actif. Committé (`be9e792`), déployé en prod. Ceci ne remplace pas le lecteur QR **natif** encore demandé pour l'app mobile (voir dette #11) — c'est un accès plus visible au scanner web existant.

**Skill design tiers installé et revu.** `ui-ux-pro-max` (base UI/UX locale : styles, palettes, typographie, guidelines UX, charts) installé depuis un dépôt GitHub tiers non vérifié par Anthropic. Revue de sécurité à la demande du user : SKILL.md est de la pure documentation, les 3 scripts Python (1741 lignes) n'utilisent que la stdlib (aucun réseau, `subprocess`, `eval`/`exec`, `pickle`/`base64`), la seule écriture disque (`--persist`) est protégée contre la traversée de chemin. Jugé sain.

**Flux d'invitation Chefferie/Propriétaire terrien complété + bug de routage `concertation/page.tsx` corrigé (dette #9 et #10).** Migration `20260711_invitations_famille_autorite.sql` : `invitations` gagne `autorite_coutumiere_id`/`famille_id` (FK), nouvelle version de `invitations_check` (le volet chefferie/proprietaire_terrien est scopé à `statut='en_attente'` pour ne pas invalider l'historique — 1 invitation `chefferie` déjà `utilisee` du 03/07, conflatée à l'époque) ; `handle_new_user()` recopie les 2 champs vers `profiles`. Formulaire `/dashboard/invitations` : sélecteur conditionnel (autorité pour `chefferie`, famille pour `proprietaire_terrien` — les nouvelles invitations `chefferie` sont désormais toujours pour un chef de village, jamais un chef de famille). **Root cause du bug concertation** : la requête `profiles` de `concertation/page.tsx` ne sélectionnait même pas `autorite_coutumiere_id`/`famille_id` (un commentaire dans le code l'admettait) — l'auto-sélection des participants d'un lotissement retombait sur un mauvais rôle (`groupe==='proprietaire'`, sans rapport) sans filtrer par famille. Corrigé pour matcher `autorite_coutumiere_id`/`famille_id` réels. **Vérifié en navigateur** (Playwright, dev local, backend prod réel) : formulaire conditionnel + soumission réelle (créée puis révoquée) ; concertation sur Koelea-Accor revu auto-sélectionne désormais correctement N'CHO KOUTOUAN JULES (jamais sélectionné avant), exclut les comptes « Propriétaire » sans rapport. `database.types.ts` régénéré, `pnpm build` propre. Committé (`2a64573`) et **déployé en prod**.

**Photos d'annonces + suivi de reconstruction du site (dette #7 et #6).** Migration `20260711_marketplace_photos_et_suivi_site.sql` : table `photos_annonces` (RLS propriétaire/admin, trigger qui republie l'annonce active à chaque ajout/retrait de photo) + bucket public `annonces-photos` (RLS d'écriture scopée au propriétaire via le préfixe de chemin) ; `annonces_publiques` recréée avec `photo_couverture` ; nouvelle vue publique `photos_annonces_publiques`. Front sgfn-web : gestionnaire de photos (upload/suppression, 8 max, 5 Mo) intégré à `/dashboard/mettre-en-vente`. Front monterrain-web : `AnnonceCard` affiche la couverture, la fiche annonce affiche une galerie cliquable. Pour la dette #6 (republication à la mise en ligne), l'automatisation du déploiement avait déjà été explicitement déclinée par le user (export statique cPanel, pas de SSH/FTP) — à la place, une table `marketplace_etat_site` + une pastille admin (Sidebar + bandeau sur Contacts Mon Terrain, bouton « Marquer comme reconstruit ») signalent qu'une republication est due, sans automatiser le rebuild lui-même.

**Bug CORS latent découvert et corrigé sur 5 edge functions.** En testant le upload de photos via un vrai navigateur (Playwright, pas de soumission scriptée), `publier-annonce` a échoué en préflight CORS : `Access-Control-Allow-Headers` n'incluait pas `x-client-info`, un header que le client Supabase JS ajoute par défaut à tout appel `functions.invoke()`. Vérification faite sur toutes les fonctions appelées via `functions.invoke()` dans les deux dépôts : `initier-paiement`, `acheter-pass-marketplace`, `statut-pass` et `demande-contact` avaient exactement le même défaut (seule `analyser-document-ia` l'avait déjà correctement configuré). Les 5 fonctions redéployées avec le header complet. Ce bug n'avait jamais été détecté car les tests précédents de ces flux étaient soit scriptés (curl/Node, hors CORS), soit volontairement non-soumis en navigateur (cession, paiements) — il aurait bloqué silencieusement l'activation de CinetPay (dette #2) une fois les secrets posés. Vérifié en navigateur (dev local, création réelle d'une annonce brouillon puis upload/suppression d'une photo test, nettoyé après coup).

**Revue des 89 warnings sécurité Supabase (demandée par le user).** Triage complet : 87 sont `*_security_definer_function_executable` — pattern déjà validé dans une session précédente (les RPC traversent le RLS volontairement, avec leurs propres vérifications internes). 1 était nouveau et introduit le jour même : `public_bucket_allows_listing` sur `annonces-photos` (la policy `annonces_photos_public_read` permettait de lister tout le bucket) — supprimée (l'URL publique d'un objet ne consulte pas cette policy, et le front ne fait jamais `.list()`). Le dernier, `extension_in_public` (`pg_net`), a été creusé en détail : ses fonctions (`net.http_post`, etc., utilisées par `sgfn_call_edge` pour les webhooks/notifications) vivent déjà dans le schéma `net` dédié — le risque réel est donc faible, c'est surtout l'enregistrement de l'extension qui est classé `public`. **Décision : ne pas toucher.** `pg_net` a `extrelocatable=false` (confirmé en base) : `ALTER EXTENSION ... SET SCHEMA` échouerait, et le contourner exige un hack catalogue (`UPDATE pg_extension SET extrelocatable=true`) que Supabase ne recommande que via un ticket support (cf. leur procédure documentée pour PostGIS, même contrainte). Vu le risque réel faible et l'usage en production (webhooks + notifications, background worker), le jeu n'en vaut pas la chandelle sans l'accompagnement de Supabase. **89 → 88 warnings.** Au passage, 3 warnings performance `unindexed_foreign_keys` corrigés (FK ajoutées le jour même sur `invitations` et `marketplace_etat_site`, index manquants). Le reste du backlog performance (216 `multiple_permissive_policies` + 65 `unused_index`) est pré-existant, déjà documenté, non traité.

### Session du 12/07/2026

**Clarification de la dette #8 (comptes chefferies réels) — succession non résolue.** Vérification en base (SQL direct via MCP Supabase) des deux personnes citées dans l'ancienne dette #8 : N'Cho Koutouan Jules a bien un profil (`groupe=chefferie`, créé le 30/06) mais **jamais activé** (aucune connexion, aucun email envoyé) ; Nanan Affa Kouachy Alfred n'a **aucun** profil, son nom vit seulement en texte libre dans `autorites_coutumieres.chef`. Le user a alors précisé le contexte réel : N'Cho Koutouan Jules, chef de la lignée Ako Djebe (grande famille Beuh, propriétaire terrien de Koelea-Accor Revu), est **décédé depuis environ un an** ; Nanan Affa Kouachy Alfred, ancien chef du village d'Ebimpe et signataire de l'APFC-EBIMPE-2022-001 de Koelea-Accor Revu, **n'est plus chef aujourd'hui**. Ancienne dette #8 scindée : le volet tarifs reste seul sous ce numéro, le volet comptes/personnes devient la nouvelle dette #13 (voir §4.3) — les deux successions réelles restent à confirmer par le user avant toute action en base. Incohérence relevée au passage : `familles.chef_de_famille` (Ako Djebe) porte le texte libre « Ossepe Cho », sans profil lié — successeur potentiel de N'Cho Koutouan Jules, jamais confirmé.

### Session du 13/07/2026 (soir)

#### Remise physique d'une attestation distincte de la génération du PDF (Phase 1 pt.4 tranché)

Décision : `attestations_cession.statut = 'delivree'` ne doit plus signifier « le PDF a été produit » mais « le document a été physiquement remis au bénéficiaire ». L'edge function `generation-document` basculait ce statut automatiquement dès le rendu PDFMonkey réussi (`flipStatutDelivree: true`), conflant les deux faits — le KPI « Actes délivrés » du Centre de pilotage comptait donc des PDF générés, pas des remises réelles. `flipStatutDelivree` passe à `false` pour `attestations_cession` (certificats de vente et attestations coutumières inchangés, hors périmètre de la demande). Nouvelle colonne `delivree_le` + RPC admin-only `marquer_attestation_delivree(p_id)` (n'accepte la transition que depuis `'generee'`) ; bouton correspondant dans le Coffre-fort documentaire, visible uniquement sur les lignes « Générée ». Edge function redéployée (v32). Effet de bord assumé et accepté : les 386 attestations déjà basculées par l'ancien automatisme restent `delivree` (pas de backfill) — le KPI retrouve un sens réel uniquement pour les attestations générées à partir de maintenant.

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

#### Espace Géomètre-Expert — 1er persona TerraCI Pro (13-15/07)

Trois sessions consécutives, déclenchées par un rendez-vous avec un géomètre-expert potentiel client (rdv du 15/07 matin) :

- **13-14/07 — fondations.** Registre `geometres_experts`, assignation de dossiers ADU et de démarches de bornage au registre existant, dashboard `/dashboard/geometre`, score de confiance géométrie affiné. Testé e2e Playwright, déployé.
- **14/07 soir — question stratégique posée à l'utilisateur** : quels éléments constitutifs du métier de géomètre-expert en Côte d'Ivoire ajouter pour qu'à terme ce persona pilote toute son activité depuis le SaaS ? Sur 12 blocs identifiés, l'utilisateur choisit les 2 plus structurants : **PV de bornage généré** (document QR-vérifiable) et **portefeuille multi-clients** (missions hors registre SGNF). Nouvelle table `missions_geometre` (portefeuille libre, lot optionnel — délibérément séparée de `demarches`, admin-centrique, pour zéro risque de régression) ; `pv_bornage` réutilise intégralement le pipeline générique existant (`generer_qr_token()`/`sgfn_trigger_generation()`/`generation-document`/`verifier_document()`). **Bug latent découvert** : `generer_qr_token()` échoue sur `gen_random_bytes` non qualifié pour un tout nouvel appel plpgsql (fonctionne pourtant pour les tables existantes, cause exacte non élucidée) — contourné sans toucher à la fonction partagée. **Incident opérationnel** : un déploiement d'edge function avec un contenu placeholder a temporairement cassé `generation-document` en prod (tous types de documents), corrigé en quelques secondes.
- **15/07 — réorganisation puis refonte visuelle.** Sidebar du rôle géomètre réordonnée (Centre de pilotage/Espace Géomètre/Mes missions en tête) via un ordre personnalisé par rôle (`ROLE_NAV_ORDER`). Puis, à la demande explicite de l'utilisateur (« épuré, professionnel, environnement serein »), les 3 pages exclusives au géomètre sont migrées sur le **Design System construit pour le Centre de pilotage admin** (`ds/`+`pilotage/`, voir §4.1 refonte du 13/07) plutôt que d'inventer un nouveau style — `AppShell`/`AppHeader`/`CommandPalette` généralisés pour être réutilisables hors de l'écran admin. Deux bugs latents trouvés et corrigés au passage : le nouveau shell shufflait l'ordre de sidebar personnalisé (corrigé par un mode liste plate), et `useProfile()` était le seul hook du projet sans garde anti-réponse-tardive (corrigé par précaution). **Découverte tierce, hors code** : en vérifiant, incohérence remontée par l'utilisateur sur `/dashboard/lots` (statut « Attribué » visible mais attributaire « Non attribué ») — root cause : RLS asymétrique entre `lots` (lecture ouverte à tous) et `attributions` (lecture restreinte, géomètre/aménageur exclus). Décision utilisateur : garder la restriction, corriger l'affichage pour ne plus laisser croire qu'un lot attribué est libre.
- Compte de démonstration `manuel.geometre` rattaché en dur à une fiche registre pour le rdv — **limite connue, voir dette #14**.

### Chantiers précédents (03/07, toujours d'actualité)

Mise en ligne des deux sites, scanner QR caméra, manuel utilisateur PDF, quittance PDF pro, notifications email (Resend), grille tarifaire fixée, chantier paiements (8/10 scénarios validés) : voir `docs/02-ROADMAP.md` pour le détail complet.

---

*Document directeur v1.17 — mis à jour le 15/07/2026 (**Espace Géomètre-Expert, 1er persona TerraCI Pro prototypé** — registre, dossiers ADU, démarches bornage, portefeuille de missions hors registre + PV de bornage QR-vérifiable, dashboard migré sur le Design System admin, sidebar réordonnée par rôle ; nouvelle dette #14 : onboarding self-service géomètre absent ; **dashboard analytics chefferie** (TerraCI Analytics, Phase 3 lancée en avance) et **anti-double-attribution ADU** rattrapés au passage — voir §4.1 et §10 pour le détail des 13-15/07). v1.16 — mis à jour le 13/07/2026 au soir (**transition `generee → delivree` tranchée** — Phase 1 pt.4 : la remise physique d'une attestation de cession devient une confirmation admin distincte de la génération du PDF ; `flipStatutDelivree: false` pour `attestations_cession` dans `generation-document` v32, RPC `marquer_attestation_delivree`, bouton dans le Coffre-fort documentaire ; dette #11 partiellement soldée. *(Versions v1.11 à v1.15, bumpées plus tôt le 13/07 pour A1/Passeport parcelle/Score de confiance/métadonnées cadastrales/réconciliation Koelea-Accor, n'ont pas été journalisées ici individuellement — voir mémoire agent pour le détail de session.)*). v1.10 — mis à jour le 11/07/2026 (**revue des 89 warnings sécurité Supabase** — pattern SECURITY DEFINER confirmé accepté, policy de listing public du bucket photos supprimée, `pg_net`/`extension_in_public` creusé et intentionnellement laissé en l'état — `extrelocatable=false`, fonctions déjà dans le schéma `net`, fix nécessite un ticket support Supabase ; 3 index FK manquants ajoutés ; 89 → 88 warnings). v1.9 le 11/07/2026 (**photos d'annonces + suivi de reconstruction du site** — dette #6/#7 soldées, migration `marketplace_photos_et_suivi_site` ; **bug CORS latent corrigé sur 5 edge functions** — `publier-annonce`, `initier-paiement`, `acheter-pass-marketplace`, `statut-pass`, `demande-contact`, découvert en testant via un vrai navigateur, pertinent pour la dette #2 CinetPay ; commits `c2bda5b`/`11487a1`). v1.8 le 11/07/2026 (**flux d'invitation Chefferie/Propriétaire terrien complété + bug de routage `concertation/page.tsx` corrigé** — dette #9/#10 soldées, commit `2a64573`, vérifié en navigateur). v1.7 le 11/07/2026 (**module « Opérateur de saisie » complet et déployé en prod** — étapes 4-5 committées `8cdd4a6`, dette #12 soldée ; modale de cession et formulaire paiements **vérifiés en navigateur réel**, dette #5 soldée ; **bouton « Vérifier un QR code » ajouté en page d'accueil** — ouverture caméra directe via `?scan=1`, committé `be9e792`, déployé ; skill design tiers `ui-ux-pro-max` installé et revu sain ; Phase 0 nettoyée de deux points déjà soldés depuis le 08/07 mais jamais retirés de la feuille de route). v1.6 le 10/07/2026 au soir (passage **Supabase Pro** → protection mots de passe fuités activée, dette #4 soldée ; durcissement FK-index/RLS de suivi — commit `31f3ec2` ; réconciliation Guide Kakodji « ACTU1A » — 821 attributions sur 849 lots, 28 libres ; **nouveau module « Opérateur de saisie » maker-checker** — étapes 1-3 codées/testées e2e/committées `72b633e`/`7d56d21`/`57cc2f3`, pas encore déployé, dette #12). v1.5 le 10/07/2026 (guide grand public « Acheter mon terrain » — page `/guide-achat` + PDF imprimable ; réconciliation du Guide de Répartition Brignan Kakodji « ACTU1AB » — 809 attributions actuelles sur 849 lots, testée en rollback puis rejouée en commit, aucune attestation parasite). v1.4 le 10/07/2026 (tunnel de vente câblé de bout en bout, déployé et vérifié en prod ; espace acquéreur « grand public » repensé — page guidée « Mon achat » ; signal « à faire » agence — badge + pastilles rouges ; fondation notifications WhatsApp Cloud API codée et déployée, inerte en attente du setup Meta). v1.3 le 09/07/2026 au soir (tunnel Acquéreur : demande d'acquisition, paiement en ligne + correctif du webhook CinetPay, reséquencement vente → Certificat de vente → attestation, répartition automatique des paiements + frais agrégateur — base en production, front à déployer et UI du flux vente à coder). v1.2 le 08/07/2026 (nouveau rôle Propriétaire terrien, rattrapage git/déploiement, comptes de test). v1.1 établie le 07/07/2026 au soir, fusionne la v1.0 et la Fiche projet SGNF (désormais obsolète, conservée pour l'historique Git uniquement). À réviser à chaque fin de phase, arbitrage stratégique (A1–A4), ou session de travail notable. Référence technique : `docs/` du repo `sgfn-web`.*
