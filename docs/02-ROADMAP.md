# SGNF – État d'avancement & feuille de route

**Version :** 1.1
**Date de rédaction :** 04 juillet 2026
**Dernière confrontation à la production :** 28 juillet 2026
**Statut :** Document de référence — dossier de passation développeur

> ⚠️ **Ce document est un instantané du 04/07 ; le §4 avait dérivé.** Le 28/07, six points de la feuille de route ont été confrontés au dépôt et à la base de production : cinq étaient **déjà soldés** sans avoir été rayés, et le point 10 prescrivait une action devenue **fausse** (provisionner des comptes pour deux personnes qui ont depuis été remplacées, dont une décédée). Corrigés ci-dessous. **La source de vérité pour la dette ouverte est le §4.3 du `TerraCI_SGNF_Document_Directeur_Unique_v1.md`**, tenu à jour à chaque livraison ; ce fichier-ci ne doit servir qu'en complément.

---

# 1. État des lieux — ce qui est en ligne

- **`sgfn-web`** déployé et répond en HTTPS sur `https://sgfn.ci`.
- **`monterrain-web`** déployé et répond en HTTPS sur `https://monterrain.sgfn.ci` (le domaine cible du rebranding `sgnf.ci` n'a jamais été activé en DNS — à migrer plus tard si un jour acheté/pointé).
- Les deux sites sont des exports statiques Next.js sur cPanel/Apache, backend Supabase commun. Voir [03-ARCHITECTURE.md](03-ARCHITECTURE.md).

---

# 2. Fonctionnalités livrées et testées en conditions réelles

## Cœur métier foncier

Référentiel lotissements/îlots/lots (895 lots), attributaires (39), attributions, hiérarchie familiale complète (grandes familles → lignées → collectifs d'ayants-droit → PV de réunion de famille), désignation coutumière (chef de famille, chef de village).

## Espaces par rôle (tous construits, routés automatiquement à la connexion)

Admin/agent (le plus riche), propriétaire, opérateur (rémunéré en lots en nature), commissaire/vérificateur (supervision lecture seule), acquisition (acquéreur/aménageur — « manifester un intérêt »), chefferie (deux vues selon chef de famille ou chef de village).

**Gap produit connu, non tranché** : `/dashboard/acquisition` ne permet que de manifester un intérêt — aucune UI ne permet à un acquéreur de déclencher lui-même un achat. C'est le staff qui crée `ventes`+`paiements` manuellement depuis `/dashboard/paiements`.

## Documents & vérification QR

Coffre-fort documentaire (attestations de cession, PV de famille, documents génériques) branché sur les vraies tables. Génération PDF via PDFMonkey (attestation navy, certificat de vente émeraude, APFC brique, quittance) avec repli HTML. Scanner QR caméra web testé fonctionnel sur téléphone réel (`/verifier`, HTTPS obligatoire pour `getUserMedia`). Détection de clones QR (alertes admin sur scans anormaux).

**Argument sécurité à valoriser côté commercial/pitch** : le QR encode une URL HTTPS standard (pas de format propriétaire, aucune app à installer), le verdict est toujours calculé côté serveur, le jeton de vérification (32 caractères) est distinct de la référence imprimée — donc pas de risque de forger un faux QR à partir d'un document légitime.

## Paiements

Workflow complet testé de bout en bout le 02-03/07/2026 : **8 scénarios sur 10 validés en conditions réelles** (attestation, honoraires géomètre, vente comptant, vente échelonnée, paiement « Autre », validation manuelle, téléchargement reçu, vue propriétaire). Deux bugs de production trouvés et corrigés pendant ce test (voir [04-DATABASE.md](04-DATABASE.md) §5).

**F/G (paiement électronique CinetPay) restent à tester** — bloqués tant que les secrets `CINETPAY_API_KEY`/`CINETPAY_SITE_ID` ne sont pas posés en prod (503 attendu en attendant).

## Marketplace « Mon Terrain »

Chantier complet : tables + RLS + edge functions (achat pass, demande de contact, publication d'annonce), front branché sur les vraies données Supabase (SSG), carte OpenStreetMap floutée (cercle 500 m sur les annonces, coordonnées exactes jamais exposées), page pass (5000 FCFA/7j/10 contacts), flux de contact complet testé end-to-end, espace admin « Contacts Mon Terrain » avec bouton WhatsApp pour fluidifier la mise en relation (manuelle par design, SGNF reste l'intermédiaire).

## Notifications & manuel utilisateur

Notifications email opérationnelles (Resend, domaine `sgfn.ci` vérifié, testé réel : 12/12 envoyées). Manuel utilisateur PDF livré (8 rôles, captures réelles, `manuel-utilisateur/Manuel_Utilisateur_SGNF.pdf`, gitignoré) avec 8 comptes de test `manuel.*@sgfn.ci` gardés actifs pour régénération future.

## Lifting visuel

Dashboards, home institutionnelle (nav horizontale + sidebar simplifiée), espace propriétaire (badge paiements en attente + KPI total payé), branding Mon Terrain propre.

---

# 3. Grille tarifaire — fixée, pas encore implémentée en UI

Montants réels validés le 03/07/2026 (détail complet dans `Grille_Tarifaire_SGNF_2026-07-03.md`, racine du repo) :

| Acte | Montant | Commission SGNF |
| --- | --- | --- |
| Attestation de cession | 100 000 – 150 000 FCFA | 10 000 FCFA |
| Vente de terrain | — | Aucune |
| Entérinement chefferie (APFC) | 550 000 FCFA | 50 000 FCFA |
| Mutation acquéreur | 550 000 FCFA | 50 000 FCFA |
| Transmission | 300 000 – 500 000 FCFA | 30 000 – 50 000 FCFA |
| Levée de litige | 110 000 FCFA | 10 000 FCFA |
| Bornage / demande ACD | à valider | à valider |
| Consultation QR payante (attestation de cession) | 60 000 FCFA (dont 50 000 pour la chefferie) | 10 000 FCFA |

La **consultation QR payante** est une règle nouvelle et importante : le payeur devient le vérificateur (pas le propriétaire), modèle *pay-per-view*, portée limitée à l'attestation de cession pour l'instant. **Implémentée et déployée le 07/07/2026** (montants réajustés le même jour : 60 000/50 000/10 000 au lieu des 55 000/5 000 initiaux) : verdict bloqué côté serveur (`verification-qr` v15 + table `consultations_qr`), paiement en ligne prêt mais en 503 tant que les secrets CinetPay ne sont pas posés, validation manuelle admin via `/dashboard/consultations-qr` en attendant. Détail dans `Grille_Tarifaire_SGNF_2026-07-03.md` §4.

~~Aucune table `tarifs` n'existe en base — tout est aujourd'hui saisi manuellement paiement par paiement.~~ **Périmé.** Vérifié en production le 28/07 : la table `tarifs` existe et porte **9 lignes, dont 6 actives** (`delivrance_attestation_cession`, `transmission`, `enterinement_chefferie`, `mutation_acquereur`, `levee_litige`, `signature_attribution_lot`), branchées sur `/dashboard/paiements`. Restent `actif=false` avec des montants **NULL** : `bornage`, `demande_acd`, `autre` — décision métier en attente (dette #8 du document directeur).

---

# 4. Feuille de route ordonnée

1. **Secrets CinetPay** (`CINETPAY_API_KEY`/`CINETPAY_SITE_ID`, posés par l'utilisateur uniquement) — débloque le paiement électronique réel du pass marketplace, les scénarios F/G du test paiements, et à terme le paywall QR.
2. ~~**Implémenter la grille tarifaire côté UI**~~ — **FAIT** : la table `tarifs` alimente les valeurs par défaut du formulaire démarches/paiements, et un écran admin permet de les modifier. **Reste** : chiffrer `bornage` et `demande_acd`, toujours `actif=false` et à montant NULL — c'est une décision métier, pas du code.
3. ~~**Paywall consultation QR**~~ — **FAIT le 07/07/2026** (60 000 FCFA : 50 000 chefferie + 10 000 SGNF). Seul le paiement en ligne reste conditionné au point 1 (les edge fns `payer-consultation-qr`/`confirmer-consultation-qr` s'activeront d'elles-mêmes à la pose des secrets CinetPay).
4. ~~**Webhook/procédure de rebuild** de `monterrain-web` à la publication d'une annonce~~ — **traité le 11/07** (dette #6), mais **pas** par un webhook : l'automatisation du déploiement (FTP/SSH) avait été explicitement déclinée. Solution retenue : un **signal**, pas une automatisation — table `marketplace_etat_site` (`derniere_reconstruction`, valeur en base : `2026-07-11`), pastille rouge en sidebar et bandeau sur `/dashboard/contacts-marketplace` dès qu'une annonce active est publiée après la dernière reconstruction. Le rebuild reste **manuel et assumé comme tel**. La contrainte SSG de fond, elle, demeure : une annonce n'apparaît qu'au prochain déploiement.
5. ~~**Photos d'annonces** (schéma + upload storage + galerie fiche)~~ — **FAIT le 11/07** (dette #7), les trois volets. **Revérifié en production le 28/07** : table `photos_annonces` (2 policies RLS), trigger `trg_photos_annonces_touch`, vue `photos_annonces_publiques`, colonne `photo_couverture` sur `annonces_publiques`, bucket public `annonces-photos` — tous présents. Front : `_PhotosAnnonce.tsx` (upload/suppression, 8 photos, 5 Mo) côté sgfn-web, `AnnonceCard` + `AnnoncePhotos.tsx` côté monterrain-web. Commits `c2bda5b` et `11487a1`. ⚠️ La fonctionnalité est **livrée mais dormante** : 0 photo et 0 objet dans le bucket, car aucun vendeur ne peut publier tant qu'aucune attestation n'est `delivree` (dette #22 du document directeur) — l'absence de photo n'est donc **pas** un symptôme de panne.
6. **Trancher deux gaps produit** : (a) achat en libre-service par l'acquéreur depuis `/dashboard/acquisition` (aujourd'hui staff-only) ; (b) la transition `generee → delivree` d'une attestation semble être une action manuelle séparée (remise du document physique/numérique) — à confirmer.
7. **Chantiers différés** : fournisseur Mobile Money définitif (CinetPay n'est qu'une référence technique fonctionnelle, pas un choix arrêté), notifications SMS (passerelle générique déjà en place dans `rappels-echeances`, attend `SMS_API_URL`/`SMS_API_KEY`), APK Android release (builds debug validés jusqu'à la **1.3.2 / versionCode 18**, testée sur appareil réel le 27/07/2026 ; reste keystore + icônes correctement dimensionnées — voir [03-ARCHITECTURE.md](03-ARCHITECTURE.md) §8). ⚠️ L'app mobile n'est **ni déployée ni distribuée** : `/app` attend le déploiement web, et l'APK ne circule qu'en debug, de la main à la main. ~~Lecteur QR natif mobile~~ **FAIT le 15/07/2026** (`@capacitor-mlkit/barcode-scanning`) — reste un test de scan réel sur téléphone à faire par l'utilisateur.
8. ~~**Audit de sécurité à mener** : incohérence `HOOK_SECRET`/`Authorization: Bearer` sur `generation-document`~~ — **audité, corrigé et déployé le 07/07**. Le soupçon était fondé et pire que décrit : le secret `HOOK_SECRET` n'existait pas, donc la garde `if (HOOK_SECRET && …)` court-circuitait et **ne s'exécutait jamais** — la fonction était atteignable avec la seule clé anon publique. Garde réécrite *fail-closed*. **Revérifiée le 28/07 sur la production, pas sur la doc** : v67 déployée, garde présente au caractère près dans le bundle servi, attaque d'origine rejouée → **401**, et chemin légitime prouvé → **200** sans produire de document. Voir la mémoire agent `audit_generation_document_auth`.
9. **Backlog RLS non urgent** : consolidation des ~165 `multiple_permissive_policies`, purge des ~75 index inutilisés au cas par cas (voir [04-DATABASE.md](04-DATABASE.md) §4). ~~Activation de la protection mots de passe compromis~~ — **FAIT le 10/07** (passage en plan Pro), et vérifié **fonctionnellement** le 28/07 plutôt que sur le drapeau de configuration : une inscription avec un mot de passe connu des fuites est refusée en `422 weak_password`, motif `pwned`.
10. **Provisionner les comptes des autorités réelles** — ⚠️ **l'énoncé d'origine est caduc et ne doit pas être exécuté tel quel** : il nommait `N'CHO KOUTOUAN JULES` et `NANAN AFFA KOUACHY ALFRED`, or **les deux ont été remplacés depuis** (le premier est décédé). État vérifié en base le 28/07 :
    - **Lignée Ako Djebe — RÉGLÉ le 16/07** : `N'CHO KOUTOUAN JULES` est `actif=false` ; son successeur `N'CHO OHOUO BONIFACE` est provisionné et `actif=true` (rôle `proprietaire_terrien`, 110 lots).
    - **Chefferie d'Ebimpe — TOUJOURS EN ATTENTE** : `NANAN AFFA KOUACHY ALFRED` a pour successeur **`MONDON ATSIN PACOME`**, dont l'invitation `SGFN-6EW6XNSY` (groupe `chefferie`) a **expiré le 19/07 sans jamais être activée**. Elle doit être **réémise** — la succession ne se débloquera pas d'elle-même. Idem pour `SGFN-SBCRRAP3` (expirée le 18/07), qui est une invitation de test (`ZZTEST invitation famille`) et peut être supprimée. Ce sont les **deux seules** invitations `en_attente` de la base, et les deux sont périmées.
    - 🔴 Ne **jamais** corriger le signataire historique de l'APFC-EBIMPE-2022-001 : Nanan Affa en reste l'auteur légitime.
11. **Fusionner/nettoyer `Fiche_projet_SGNF_2026-07-02.md`** (racine du repo, journal de session) une fois ce dossier `docs/` adopté comme référence à jour — éviter que les deux dérivent en parallèle.

---

# 5. État du dépôt au moment de la rédaction (04/07/2026)

Mise à jour du 04/07/2026 (soir) : tous les fichiers listés ci-dessous ont depuis été committés.

- `Grille_Tarifaire_SGNF_2026-07-03.md` — la grille tarifaire elle-même, référencée ci-dessus.
- `scripts/build-generation-document.mjs`, `scripts/build-quittance-literal.mjs`, `scripts/generation-document.new.ts`, `scripts/quittance.html` — outillage de génération du template de quittance PDF (voir [03-ARCHITECTURE.md](03-ARCHITECTURE.md) §6, edge fn `generation-document`). Fonctionnels, utilisés pour livrer la quittance PDF v27 en prod.
- `scripts/manuel-capture.mjs`, `scripts/manuel-pdf.mjs`, `scripts/manuel-signup.mjs`, `scripts/manuel-verify-login.mjs` — génération du manuel utilisateur PDF. Le mot de passe de test, auparavant en clair dans le code, est désormais lu depuis la variable d'environnement `MANUEL_TEST_PASSWORD` (le script échoue explicitement si elle est absente) — le exporter avant exécution : `export MANUEL_TEST_PASSWORD='...'` (valeur réelle communiquée hors dépôt).

`monterrain-web` a un working tree propre (rien en attente).

Le dossier `.claude/` (config locale de l'outillage Claude Code — permissions, launch.json) reste volontairement non versionné et a été ajouté au `.gitignore` : ce n'est pas un artefact du projet, seulement de la configuration locale à la machine du développeur.

---

# 6. Voir aussi

- [01-VISION.md](01-VISION.md) — mission et positionnement produit.
- [03-ARCHITECTURE.md](03-ARCHITECTURE.md) — pourquoi certains choix (statique, RLS, tar.gz) sont contraints par l'hébergement.
- [04-DATABASE.md](04-DATABASE.md) — schéma et audit sécurité détaillés.
- `Fiche_projet_SGNF_2026-07-02.md` (racine) et `Grille_Tarifaire_SGNF_2026-07-03.md` (racine) — documents de travail antérieurs, dont ce fichier reprend et met à jour le contenu.
