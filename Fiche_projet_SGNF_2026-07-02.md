# Fiche projet — SGNF & Mon Terrain

> Version consolidée au 03/07/2026 (soir) — remplace la version du 03/07 (nuit).

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
- **Grille tarifaire des actes payants fixée le 03/07** (montants réels + commissions SGNF) : attestation de cession, honoraires géomètre par démarche, vente terrain, litige. Détail complet dans `Grille_Tarifaire_SGNF_2026-07-03.md` et mémoire `grille_tarifaire_actes_payants`.
- **Nouvelle règle décidée (non codée)** : la consultation d'une attestation de cession via QR code devient payante (55 000 FCFA, dont 5 000 FCFA de commission SGNF), à la charge du vérificateur — n'entre en vigueur qu'avec l'activation de CinetPay.

## État d'avancement — 03/07/2026 (soir)

### Mise en ligne des deux sites — FAIT ✅

- **sgfn-web** déployé sur cPanel via `sgfn-deploy.tar.gz` (tar.gz obligatoire, jamais zip — casse les permissions Unix). `https://sgfn.ci` répond en HTTPS.
- **monterrain-web** déployé sur le sous-domaine `monterrain.sgfn.ci` (bug bloquant corrigé au passage : `output:"export"` échouait à 100% quand la marketplace a 0 annonce active — `generateStaticParams` retombe désormais sur un UUID nul).
- **Bug découvert et corrigé après coup** : le CTA marketplace sur la home sgfn-web pointait en dur vers l'ancien `monterrain.sgnf.ci` (constante `MARKETPLACE_URL` dans `HomeHeader.tsx`) — corrigé vers `monterrain.sgfn.ci`, les deux sites redéployés et revérifiés en prod.

### Scanner QR caméra — RÉSOLU ✅

Testé et confirmé fonctionnel sur téléphone réel via `https://sgfn.ci/verifier` (l'hypothèse HTTPS était la bonne — bloqué auparavant en localhost/HTTP).

### Manuel utilisateur PDF — LIVRÉ ✅

`sgfn-web/manuel-utilisateur/Manuel_Utilisateur_SGNF.pdf` (gitignored) : guide pas-à-pas avec captures d'écran réelles, 8 rôles couverts (admin, opérateur, propriétaire, commissaire, vérificateur, géomètre, chefferie, aménageur). 8 comptes de test `manuel.*@sgfn.ci` gardés actifs pour régénération future.

### Quittance de paiement — PDF professionnel — TERMINÉ ✅

La quittance (edge function `generation-document`, v26) génère désormais un vrai `.pdf` mis en page aux couleurs SGNF, via un template **PDFMonkey créé directement par API** (id `ea7baf50-0341-4ccb-be53-4e2701b7e87d`), avec repli HTML embarqué si PDFMonkey échoue. Contenu : montant total, payeur, contact, nature du paiement, moyen, référence, QR de vérification — **sans** détail commission SGNF (info interne non affichée au payeur). Testé en conditions réelles (paiement confirmé → PDF 116 Ko généré et vérifié visuellement).

### Notifications email (Resend) — TERMINÉ ✅

Domaine `sgfn.ci` vérifié dans Resend (DNS ajoutés en cPanel : DKIM `resend._domainkey`, MX + SPF sur `send.sgfn.ci`, sans toucher aux enregistrements existants). Secret `RESEND_API_KEY` posé côté Supabase. **Testé réel** : les 12 notifications en attente sont parties (`{"ok":true,"envoyees":12,"echecs":0}`), cron `*/10 min` opérationnel pour la suite.

### Grille tarifaire des actes payants — FIXÉE ✅ (implémentation UI à faire)

Montants réels donnés par le user le 03/07 (voir tableau ci-dessus). Reste : monter le formulaire `dashboard/paiements`/démarches avec ces montants par défaut, chiffrer bornage et demande ACD, trancher l'ajout d'une vraie table `tarifs` en base (aujourd'hui tout est saisi manuellement paiement par paiement), et implémenter le paywall QR une fois CinetPay branché.

### Chantier paiements SGNF — TERMINÉ ✅ (test parcours, 02–03/07)

- **8 scénarios sur 10 validés** en conditions réelles (attestation, honoraires, vente comptant/échelonnée, paiement « Autre », validation manuelle, reçu, vue propriétaire).
- **F/G (paiement électronique CinetPay) restent à tester**, bloqués tant que les secrets CinetPay ne sont pas posés.
- 2 bugs de production trouvés et corrigés en direct (trigger d'audit non `SECURITY DEFINER` ; calcul `montant_paye` incomplet sur vente comptant).
- **Gap produit repéré (non corrigé, à trancher)** : `/dashboard/acquisition` ne permet que « Manifester un intérêt » — aucune UI ne permet à un acquéreur de déclencher lui-même un achat ; le staff crée `ventes`+`paiements` manuellement. Autre point à trancher : la transition `generee → delivree` d'une attestation semble être une action manuelle distincte (remise du document physique/numérique), à confirmer.
- Cause racine des coupures réseau du user identifiée et réglée (DNS sécurisé Chrome incompatible réseau IPv6-only/NAT64).

### Supabase (backend commun) — FAIT ✅

- Tables marketplace : `jetons_marketplace`, `annonces_marketplace`, `demandes_contact` + enum `type_paiement::pass_marketplace`.
- Éligibilité contrôlée en base (`est_lot_eligible_marketplace`) ; RLS en place ; vue publique `annonces_publiques`.
- Edge functions marketplace testées end-to-end : `acheter-pass-marketplace`, `demande-contact`, `publier-annonce`, `statut-pass`.
- Edge function `envoyer-notifications` (Resend) et `generation-document` (v26, PDFMonkey) opérationnelles en prod.

### Mon Terrain (monterrain-web) — FAIT ✅

- Annonces réelles Supabase (SSG au build), carte OSM floutée 500 m, page `/pass`, flux de contact complet, lifting visuel (badges dégradé, header logo).
- Pipeline de build statique repris de sgfn-web (`scripts/create-out.js` + `.htaccess`).

### SGNF (sgfn-web) — FAIT ✅

- UI « Mettre en vente », espace admin « Contacts Mon Terrain », lifting visuel dashboards + home institutionnelle (nav header horizontale), badge paiements en attente espace propriétaire.
- `database.types.ts` régénéré (types marketplace).

## Feuille de route (ordonnée)

1. **Secrets CinetPay** (`CINETPAY_API_KEY`/`CINETPAY_SITE_ID`) : débloque le paiement électronique réel du pass marketplace, les scénarios F/G du test paiements, et à terme le paywall QR.
2. **Implémenter la grille tarifaire côté UI** : valeurs par défaut dans le formulaire démarches/paiements au lieu de saisie libre ; chiffrer bornage + demande ACD.
3. **Paywall consultation QR** (attestation de cession, 55 000 FCFA) — dépend du point 1, chantier dédié (session/jeton de consultation, edge function).
4. **Webhook / procédure de rebuild** de monterrain-web à la publication d'une annonce (les annonces sont figées au build statique).
5. **Photos d'annonces** (schéma + upload storage + galerie fiche) — amélioration produit.
6. Trancher le gap produit acquisition (achat en libre-service par l'acquéreur) et la transition `generee → delivree` des attestations.
7. Reprise des chantiers différés : fournisseur Mobile Money définitif, notifications SMS (passerelle générique déjà en place dans `rappels-echeances`, attend `SMS_API_URL`/`SMS_API_KEY`), APK Android.
8. **Point de sécurité à auditer** : incohérence entre le garde `HOOK_SECRET`/`x-hook-secret` de `generation-document` et ce qu'envoie réellement le trigger DB (`Authorization: Bearer`) — probablement `HOOK_SECRET` jamais configuré, endpoint protégé seulement par `verify_jwt` (satisfiable avec la clé anon publique).

## Recommandations (inchangées + nouvelles)

- Centraliser les constantes métier (PASS déjà centralisé dans `lib/pass.ts` côté front — dupliqué dans l'edge fn : à surveiller). Idem pour la future grille tarifaire.
- Tests E2E des parcours marketplace et paiements après pose des secrets CinetPay.
- Documenter les API Supabase et politiques RLS.
- CI/CD : à défaut, respecter strictement `pnpm build` (prebuild purge le cache Next côté monterrain-web).
- À fort trafic : fournisseur de tuiles OSM dédié (MapTiler/Stadia) au lieu du serveur public.
- Ce repo utilise **pnpm** (pas npm) — `npm install` échoue avec une erreur arborist à cause de la structure `node_modules` pnpm.
