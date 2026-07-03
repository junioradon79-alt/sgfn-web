# Fiche projet — SGNF & Mon Terrain

> Version consolidée au 03/07/2026 (nuit, suite) — remplace la version du 03/07 (nuit).

## Objectifs

### SGNF (sgfn-web)
Plateforme institutionnelle de gestion numérique du foncier ivoirien :
- Site vitrine institutionnel.
- Tableaux de bord par rôle (admin, propriétaire, opérateur, commissaire, chefferie…).
- Export statique Next.js déployé sur cPanel/Apache.

### Mon Terrain (monterrain-web)
Marketplace publique dédiée aux parcelles SGNF vérifiées :
- Dépôt Git indépendant. Sous-domaine cible : `monterrain.sgnf.ci`.
- Même backend Supabase que SGNF (projet `bvdzrhvbiglwrhzpmuwy`).

## Décisions d'architecture (rappel)

- Pass CinetPay **5 000 FCFA** · validité **7 jours** · **10 propriétaires** contactables · non remboursable.
- Consultation libre sans compte ; SGNF reste l'intermédiaire (aucune coordonnée publiée automatiquement — la mise en relation est **manuelle**, opérée par un admin depuis `/dashboard/contacts-marketplace`, avec une aide au contact WhatsApp).
- Éligibilité : lot avec attestation ou certificat au statut **delivree**. Les annonces n'expirent pas.
- Recherche guidée (Zone → Usage → Superficie → Budget).
- Localisation : coordonnées GPS **exactes privées** sur `lots` ; le public ne voit qu'un **cercle flou de 500 m** (coordonnées arrondies ~110 m côté base).
- 0 commission sur les ventes de lots ; le pass est un revenu SGNF intégral.

## État d'avancement — 03/07/2026 (nuit)

### Commits Git — FAIT ✅
Les deux repos sont à jour, plus rien en attente de commit sur les chantiers listés ci-dessous :
- sgfn-web : `fdc0a3a` (marketplace + mettre-en-vente), `907db8b` (scanner QR caméra), `cccc2f9` (espace admin contacts marketplace), `33bba7a` (lifting visuel dashboards), `94ed392` (badge paiements espace propriétaire), `4620265` (nav header + sidebar home).
- monterrain-web : `b5a30d0` (Supabase + carte + pass + contact), `5b058e5` (lifting visuel + logo header).

### Supabase (backend commun) — FAIT ✅
- Tables marketplace : `jetons_marketplace`, `annonces_marketplace`, `demandes_contact` + enum `type_paiement::pass_marketplace`.
- Éligibilité contrôlée en base (`est_lot_eligible_marketplace`, CHECK sur l'annonce) — 16 lots éligibles.
- Triggers : quota/validité du jeton à chaque demande de contact ; activation auto du jeton (+7 j) quand le paiement passe `confirme` (agnostique du PSP).
- RLS : lecture publique des annonces actives ; propriétaire lit ses annonces ; admin lit/écrit `demandes_contact` + lit `jetons_marketplace`/`annonces_marketplace` (migration `marketplace_admin_contacts_rls`, 02/07 soir) ; autres écritures via `service_role` uniquement.
- Vue publique `annonces_publiques` (join lot, type de document, coords arrondies).
- Edge functions : `acheter-pass-marketplace` (v3), `demande-contact` (v2, avec notif admins), `publier-annonce` (v2, coords GPS), `statut-pass` — toutes testées end-to-end.
- Audit du 02/07 : 2 bugs corrigés avant prod (enum `moyen_paiement` sans `mobile_money` ; `montant_reverse` colonne générée), index FK ajoutés, policy RLS optimisée (initplan).

### Mon Terrain (monterrain-web) — FAIT ✅
- Annonces réelles Supabase (SSG au build) sur accueil / liste / fiche / recherche guidée.
- Carte OpenStreetMap (Leaflet) sur chaque fiche avec cercle de flou 500 m — confidentialité vérifiée dans l'export.
- Page `/pass` (achat CinetPay) + `/pass/retour` (validation, référence copiable).
- Flux de contact complet sur la fiche : pass détecté (localStorage) ou saisi, message, quota affiché, doublon bloqué, notification email mise en file pour chaque admin SGNF.
- Script `prebuild` qui purge le cache Next (données toujours fraîches au build). Déployer via `pnpm build` uniquement.
- **Lifting visuel** (02/07 soir) : badges d'icônes en dégradé (vert/terracotta) sur accueil, fiche annonce, pass, comment-ça-marche ; miniatures d'annonces en dégradé ; header avec logo complet (pastille + wordmark 3D) en grand sur l'accueil, chevauchant volontairement le bandeau vert du hero, version compacte sur les autres pages.

### SGNF (sgfn-web) — FAIT ✅
- UI « Mettre en vente » (`/dashboard/mettre-en-vente`) : lots éligibles du propriétaire, formulaire d'annonce, double carte (point exact privé / aperçu flou acheteur), publication ou brouillon.
- CTA « Mettre en vente » dans l'espace propriétaire.
- **Scanner QR caméra** (`/verifier`, 02/07 soir) : bouton « Scanner avec la caméra » (lib `html5-qrcode`), extraction de référence (texte brut ou URL de deep link), déclenche la vérification existante. Testé en localhost/Playwright ; **test réel sur téléphone toujours non concluant** (cause indéterminée, à reprendre).
- **Espace admin « Contacts Mon Terrain »** (`/dashboard/contacts-marketplace`, 02/07 soir) : liste des demandes de contact, statut modifiable (nouvelle/traitée/transmise/close), coordonnées acheteur/propriétaire copiables, bouton « Contacter via WhatsApp » (lien `wa.me` pré-rempli) pour relayer la mise en relation. Testé en conditions réelles avec le user.
- **Lifting visuel des dashboards** (02/07 soir) : badges d'icônes en dégradé + jauges circulaires (`RadialGauge`, `KpiCard` — nouveaux composants réutilisables) sur le dashboard admin et les espaces propriétaire/opérateur/commissaire/paiements/litiges. Validé par le user.
- **Espace propriétaire — visibilité des paiements** (03/07 nuit) : 4e carte KPI « Total payé » + badge d'alerte ambre sous le titre (« N paiement(s) en attente de votre part », cliquable vers la section) quand un paiement électronique reste à la charge du propriétaire — la section « Mes paiements » était auparavant enterrée en bas de page.
- **Lifting home institutionnelle** (03/07 nuit) : la nav (À propos, Chiffres, Fonctionnalités, Processus, FAQ, Contact) est passée du sidebar au header (horizontale, visible dès `lg`) ; « Métiers partenaires » retiré de la nav (déjà couvert par le filtre « Pour qui ? ») ; ordre des CTA inversé (« Ouvrir la plateforme » puis « Mon Terrain — marketplace ») ; le sidebar ne garde que « Pour qui ? », remonté en tête et aligné au pixel avec le logo du header.
- `database.types.ts` régénéré (types marketplace).

### Chantier paiements SGNF — TERMINÉ ✅ (03/07 nuit)

Test du parcours client sur tous les scénarios de transaction (attestation, honoraires, vente comptant/échelonnée, paiement électronique, validation manuelle, reçu, vue propriétaire), en conditions réelles via l'appli (localhost, même backend Supabase que la prod).

- **8 scénarios sur 10 validés** : attestation de cession, honoraires géomètre, vente comptant, vente échelonnée (3 échéances), paiement « Autre », validation manuelle, téléchargement de reçu, vue propriétaire. Détail complet dans la mémoire `test_parcours_paiements`.
- **F/G (paiement électronique CinetPay) restent à tester**, bloqués tant que les secrets CinetPay ne sont pas posés.
- **2 bugs de production trouvés et corrigés en direct** (migrations déjà appliquées sur `bvdzrhvbiglwrhzpmuwy`) :
  1. Le trigger d'audit `enregistrer_audit()` (10 tables dont `paiements`, `ventes`, `lots`) n'était pas `SECURITY DEFINER` → toute écriture via l'appli avec un vrai compte (non service-role) échouait avec une violation RLS sur `journal_audit`. Resté invisible car aucune donnée de paiement n'avait jamais été créée via l'interface auparavant (tables 100% vides avant ce test).
  2. Le calcul de `ventes.montant_paye` ne sommait que les échéances → une **vente au comptant** (sans échéance) restait bloquée à `montant_paye=0` malgré un paiement confirmé en totalité. Corrigé pour compter aussi les paiements directs.
- **Gap produit repéré (non corrigé, à trancher)** : `/dashboard/acquisition` ne permet que « Manifester un intérêt » (message) — aucune UI ne permet à un acquéreur de déclencher lui-même un achat ; c'est le staff qui crée `ventes`+`paiements` manuellement. Autre point à trancher : aucune fonction en base ne fait passer une attestation de `generee` à `delivree` après paiement — semble être une action manuelle distincte (remise du document), à confirmer.
- Fixtures de test **nettoyées** après le test (ventes/échéances/certificats/démarche supprimés, attestation et lots 36/23 remis dans leur état d'origine) — base revenue à l'identique d'avant test.
- **Cause racine des coupures réseau identifiée** : le DNS sécurisé de Chrome, incompatible avec le réseau IPv6-only/NAT64 du user, causait les `Failed to fetch` récurrents (pas un problème Supabase ni applicatif). Désactivé dans `chrome://settings/security`.

### Déploiement sgfn-web — package prêt, upload cPanel restant ⚠️

`pnpm build` exécuté (36 pages statiques, `out/` régénéré) puis **`sgfn-deploy.tar.gz` (13,7 Mo) généré via `tar -czf` à la racine du repo**, prêt à envoyer. Contient tout le site à jour (lifting home + dashboards + badge propriétaire). **`.tar.gz` obligatoire, pas `.zip`** : `scripts/make-zip.ps1` (basé sur `System.IO.Compression.ZipArchive`) ne préserve pas les permissions Unix → dossiers extraits en 644 (non traversables) → 403 sur tout `/_next/` à l'extraction cPanel (incident déjà vécu, cf. mémoire `deploiement_et_stats_publiques`) ; permissions vérifiées correctes dans ce tar.gz (dossiers 755, fichiers 644). **Reste à faire manuellement** : upload du tar.gz sur cPanel (Gestionnaire de fichiers → extraction directe, pas de zip intermédiaire) — vérifier d'abord que l'accès `sgfn.ci:2083` fonctionne (timeout constaté le 02/07, cf. `chrome://settings/security` ou tester `https://sgfn.ci/cpanel`). Le tar.gz est gitignoré, jamais commité.

## Feuille de route (ordonnée)

1. **Mettre en ligne sgfn-web** : uploader `sgfn-deploy.zip` (déjà prêt) sur cPanel et extraire — vérifier d'abord que l'accès `sgfn.ci:2083` fonctionne (sinon tester `https://sgfn.ci/cpanel`).
2. **Secrets** : poser `CINETPAY_API_KEY` / `CINETPAY_SITE_ID` / `RESEND_API_KEY` (+ `MARKETPLACE_RETURN_URL` si différent) dans les secrets Edge Functions Supabase, puis tester les scénarios F/G (paiement électronique) et un achat réel (petit montant sandbox CinetPay si disponible).
3. **Déploiement** `monterrain.sgnf.ci` : package `out/` + `.htaccess` (trailingSlash), création du sous-domaine cPanel.
4. **Reprendre le test réel du scanner QR caméra** sur téléphone (cause de l'échec précédent non identifiée).
5. **Webhook / procédure de rebuild** de monterrain-web à la publication d'annonce (les annonces étant figées au build).
6. **Quittances PDF** professionnelles (le téléchargement fonctionne mais génère un gabarit minimal de repli, pas un document mis en page).
7. **Photos d'annonces** (schéma + upload storage + galerie fiche) — amélioration produit.
8. Trancher le gap produit acquisition (achat en libre-service par l'acquéreur) et la transition `generee → delivree` des attestations.
9. Reprise des chantiers différés : fournisseur Mobile Money définitif, notifications SMS, APK Android.

## Recommandations (inchangées + nouvelles)
- Centraliser les constantes métier (PASS déjà centralisé dans `lib/pass.ts` côté front — dupliqué dans l'edge fn : à surveiller).
- Tests E2E des parcours marketplace et paiements après pose des secrets.
- Documenter les API Supabase et politiques RLS.
- CI/CD : à défaut, respecter strictement `pnpm build` (prebuild purge le cache Next).
- À fort trafic : fournisseur de tuiles OSM dédié (MapTiler/Stadia) au lieu du serveur public.
- Ce repo utilise **pnpm** (pas npm) — `npm install` échoue avec une erreur arborist à cause de la structure `node_modules` pnpm.
