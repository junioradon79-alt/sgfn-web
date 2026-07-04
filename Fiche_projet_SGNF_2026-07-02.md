# Fiche projet — SGNF & Mon Terrain

> Version consolidée au 04/07/2026 (soir) — remplace la version du 03/07 (soir).
>
> ⚠️ Cette fiche reste un journal de session. La référence technique à jour et détaillée est désormais le dossier **`docs/`** du repo `sgfn-web` (README, architecture, roadmap, base de données, conventions) — voir aussi `docs/pdf/Dossier_Passation_SGNF.pdf` pour une version imprimable consolidée.

## Objectifs

### SGNF (sgfn-web)

Plateforme institutionnelle de gestion numérique du foncier ivoirien :

- Site vitrine institutionnel — **en ligne sur `https://sgfn.ci`**.
- Tableaux de bord par rôle (admin, propriétaire, opérateur, commissaire, chefferie, géomètre, vérificateur, aménageur…).
- Export statique Next.js déployé sur cPanel/Apache.

### Mon Terrain (monterrain-web)

Marketplace publique dédiée aux parcelles SGNF vérifiées :

- Dépôt Git indépendant. **En ligne sur `https://monterrain.sgfn.ci`** (le domaine cible `sgnf.ci` n'a jamais été activé en DNS — à migrer plus tard si le domaine est un jour acheté/délégué).
- Même backend Supabase que SGNF (projet `bvdzrhvbiglwrhzpmuwy`).

## Décisions d'architecture (rappel)

- Pass CinetPay **5 000 FCFA** · validité **7 jours** · **10 propriétaires** contactables · non remboursable.
- Consultation libre sans compte ; SGNF reste l'intermédiaire (aucune coordonnée publiée automatiquement — la mise en relation est **manuelle**, opérée par un admin depuis `/dashboard/contacts-marketplace`, avec une aide au contact WhatsApp).
- Éligibilité : lot avec attestation ou certificat au statut **delivree**. Les annonces n'expirent pas.
- Recherche guidée (Zone → Usage → Superficie → Budget).
- Localisation : coordonnées GPS **exactes privées** sur `lots` ; le public ne voit qu'un **cercle flou de 500 m** (coordonnées arrondies ~110 m côté base).
- 0 commission sur les ventes de lots via la marketplace ; le pass est un revenu SGNF intégral.
- Grille tarifaire des actes payants fixée le 03/07 (montants réels + commissions SGNF). Détail complet dans `Grille_Tarifaire_SGNF_2026-07-03.md`.
- Consultation d'une attestation de cession via QR payante (55 000 FCFA, dont 5 000 FCFA de commission SGNF), à la charge du vérificateur — décidée, **pas codée** (attend CinetPay).

## État d'avancement — 04/07/2026 (soir)

### Dossier de passation développeur — TERMINÉ ✅

Le squelette `docs/` (créé le 27/06, resté vide) a été entièrement rédigé : architecture technique, base de données, feuille de route, conventions/pièges connus. Consolidé en PDF imprimable (`docs/pdf/Dossier_Passation_SGNF.pdf`, 27 pages, régénérable via `node scripts/build-dossier-passation-pdf.mjs`). C'est désormais la référence à jour pour reprendre le projet — cette fiche continue d'exister comme journal de session plus granulaire.

### Dossiers argumentaires partenaires — TERMINÉ ✅

Un dossier par métier (11 profils de `/metiers-partenaires`) dans `dossiers-partenaires/`, centré sur les bénéfices (sans tarifs), distinguant ce qui fonctionne déjà sans compte (QR, marketplace) de ce qui dépend d'un rôle applicatif existant. PDF générés (`node scripts/build-dossiers-partenaires-pdf.mjs`).

### Bug invitations propriétaire/acquéreur — CORRIGÉ ✅

La contrainte `invitations_check` exigeait un `attributaire_id` pour ces deux rôles, mais le formulaire admin ne le collectait pas (erreur Postgres brute affichée). Corrigé à deux niveaux :

- Front (`dashboard/invitations`) : sélecteur d'attributaire conditionnel.
- **DB** : le trigger `handle_new_user()` ne recopiait pas `attributaire_id`/`commissaire_id` de l'invitation vers le profil créé à l'inscription — corrigé par migration, actif immédiatement en prod (sans déploiement frontend).

Au passage : page `/login` redesignée (panneau « J'ai un code d'invitation » distinct du formulaire de connexion) pour éviter la confusion observée (un acquéreur invité s'était trompé de page).

### Petites retouches UI — TERMINÉES ✅

Bouton « Ouvrir la plateforme » → « Accéder à la plateforme » (4 occurrences). Espacement du header mobile de la home corrigé (logo collé au bouton menu, manque de `justify-between`).

### Bouton Itinéraire — Carte foncière — TERMINÉ ✅

Popup de chaque lotissement positionné (`/dashboard/carte`) : lien direct vers Google Maps Directions depuis la position de l'utilisateur. Aucune dépendance ajoutée.

### Upload et aperçu de plans DWG/BAK — EN COURS ⚠️ (bloqué)

Un géomètre peut téléverser un plan AutoCAD (`.dwg`/`.bak`) rattaché à un lot depuis le Coffre-fort Documentaire (nouveau bouton, nouvelle table de policies RLS, nouveau bucket path `plans-cad/`). La conversion en aperçu PNG passe par **CloudConvert** (compte créé et clé posée par l'utilisateur, `CLOUDCONVERT_API_KEY`).

**Pipeline entièrement fonctionnel** (upload, edge function `convertir-plan-cad`, stockage, affichage) mais **le PNG généré à partir d'un vrai plan réel ressort blanc/vide**. Plusieurs paramètres de conversion testés (calque Model, zoom extents, fond noir) sans effet mesurable — cause probable : références externes (Xrefs) non incluses dans le fichier, ou géométrie en couleur blanche sur fond noir AutoCAD non inversée à l'export. **En attente** : vérifier côté utilisateur si le plan contient des Xrefs, tester avec un DWG sans référence externe.

### Chantiers précédents (03/07, toujours d'actualité)

- Mise en ligne des deux sites, scanner QR caméra, manuel utilisateur PDF, quittance PDF pro, notifications email (Resend), grille tarifaire fixée, chantier paiements (8/10 scénarios validés) : voir version précédente de cette fiche / `docs/02-ROADMAP.md` pour le détail complet, rien de nouveau à signaler dessus aujourd'hui.

## Feuille de route (ordonnée)

1. **Résoudre le rendu blanc des plans DWG** — diagnostiquer Xrefs/couleurs avec l'utilisateur, sinon envisager une conversion DWG→PDF intermédiaire ou un moteur alternatif.
2. **Secrets CinetPay** (`CINETPAY_API_KEY`/`CINETPAY_SITE_ID`) : débloque le paiement électronique réel du pass marketplace, les scénarios F/G du test paiements, et à terme le paywall QR.
3. **Implémenter la grille tarifaire côté UI** : valeurs par défaut dans le formulaire démarches/paiements au lieu de saisie libre ; chiffrer bornage + demande ACD.
4. **Paywall consultation QR** (attestation de cession, 55 000 FCFA) — dépend du point 2.
5. **Webhook / procédure de rebuild** de monterrain-web à la publication d'une annonce.
6. **Photos d'annonces** (schéma + upload storage + galerie fiche).
7. Trancher le gap produit acquisition (achat en libre-service par l'acquéreur) et la transition `generee → delivree` des attestations.
8. Reprise des chantiers différés : fournisseur Mobile Money définitif, notifications SMS, APK Android.
9. **Point de sécurité à auditer** : incohérence `HOOK_SECRET`/`Authorization: Bearer` sur `generation-document`.
10. Provisionner les comptes chefferie réels (N'CHO KOUTOUAN JULES, NANAN AFFA KOUACHY ALFRED).

## Recommandations (inchangées + nouvelles)

- Centraliser les constantes métier (PASS déjà centralisé dans `lib/pass.ts` côté front — dupliqué dans l'edge fn : à surveiller). Idem pour la future grille tarifaire.
- Tests E2E des parcours marketplace et paiements après pose des secrets CinetPay.
- CI/CD : à défaut, respecter strictement `pnpm build` (prebuild purge le cache Next côté monterrain-web).
- À fort trafic : fournisseur de tuiles OSM dédié (MapTiler/Stadia) au lieu du serveur public.
- Ce repo utilise **pnpm** (pas npm) — `npm install` échoue avec une erreur arborist à cause de la structure `node_modules` pnpm.
- Pour toute reprise du projet, commencer par `docs/README.md` plutôt que cette fiche.
