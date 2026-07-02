# Fiche projet — SGNF & Mon Terrain

> Version consolidée au 02/07/2026 (soir) — remplace la fiche du 02/07 matin.

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
- Consultation libre sans compte ; SGNF reste l'intermédiaire (aucune coordonnée publiée).
- Éligibilité : lot avec attestation ou certificat au statut **delivree**. Les annonces n'expirent pas.
- Recherche guidée (Zone → Usage → Superficie → Budget).
- Localisation : coordonnées GPS **exactes privées** sur `lots` ; le public ne voit qu'un **cercle flou de 500 m** (coordonnées arrondies ~110 m côté base).
- 0 commission sur les ventes de lots ; le pass est un revenu SGNF intégral.

## État d'avancement — 02/07/2026 (soir)

### Supabase (backend commun) — FAIT ✅
- Tables marketplace : `jetons_marketplace`, `annonces_marketplace`, `demandes_contact` + enum `type_paiement::pass_marketplace`.
- Éligibilité contrôlée en base (`est_lot_eligible_marketplace`, CHECK sur l'annonce) — 16 lots éligibles.
- Triggers : quota/validité du jeton à chaque demande de contact ; activation auto du jeton (+7 j) quand le paiement passe `confirme` (agnostique du PSP).
- RLS : lecture publique des annonces actives ; propriétaire lit ses annonces ; écritures via `service_role` uniquement.
- Vue publique `annonces_publiques` (join lot, type de document, coords arrondies).
- Edge functions : `acheter-pass-marketplace` (v3), `demande-contact` (v2, avec notif admins), `publier-annonce` (v2, coords GPS), `statut-pass` — toutes testées end-to-end.
- Audit du 02/07 : 2 bugs corrigés avant prod (enum `moyen_paiement` sans `mobile_money` ; `montant_reverse` colonne générée), index FK ajoutés, policy RLS optimisée (initplan).

### Mon Terrain (monterrain-web) — Phases 1-4 logicielles FAITES ✅
- Annonces réelles Supabase (SSG au build) sur accueil / liste / fiche / recherche guidée.
- Carte OpenStreetMap (Leaflet) sur chaque fiche avec cercle de flou 500 m — confidentialité vérifiée dans l'export.
- Page `/pass` (achat CinetPay) + `/pass/retour` (validation, référence copiable).
- Flux de contact complet sur la fiche : pass détecté (localStorage) ou saisi, message, quota affiché, doublon bloqué, notification email mise en file pour chaque admin SGNF.
- Script `prebuild` qui purge le cache Next (données toujours fraîches au build). Déployer via `pnpm build` uniquement.

### SGNF (sgfn-web) — FAIT ✅
- UI « Mettre en vente » (`/dashboard/mettre-en-vente`) : lots éligibles du propriétaire, formulaire d'annonce, double carte (point exact privé / aperçu flou acheteur), publication ou brouillon.
- CTA « Mettre en vente » dans l'espace propriétaire.
- `database.types.ts` régénéré (types marketplace).

### Non fait / bloquants externes ⚠️
- Secrets edge : `CINETPAY_API_KEY`, `CINETPAY_SITE_ID` (achat pass), `RESEND_API_KEY` (envoi des emails — la file `notifications_a_envoyer` se remplit déjà).
- Déploiement `monterrain.sgnf.ci` (build → `out/` + `.htaccess`).
- Commits Git : le travail du 02/07 est **non commité** dans les deux repos.
- Une annonce de démonstration (lot 33, 500 m², Abidjan) est en base — à retirer au lancement.

## Feuille de route (ordonnée)

1. **Commits Git** des deux repos (sgfn-web : mettre-en-vente + types ; monterrain-web : Supabase + carte + pass + contact).
2. **Secrets** : poser `CINETPAY_API_KEY` / `CINETPAY_SITE_ID` / `RESEND_API_KEY` (+ `MARKETPLACE_RETURN_URL` si différent) dans les secrets Edge Functions Supabase, puis test d'achat réel (petit montant sandbox CinetPay si disponible).
3. **Déploiement** `monterrain.sgnf.ci` : package `out/` + `.htaccess` (trailingSlash), création du sous-domaine cPanel.
4. **Espace admin SGNF — demandes de contact** : vue de gestion (`demandes_contact` : nouvelle → traitée → transmise → close) pour opérer la mise en relation.
5. **Webhook / procédure de rebuild** de monterrain-web à la publication d'annonce (les annonces étant figées au build).
6. **Quittances PDF** professionnelles (chantier paiements).
7. **Photos d'annonces** (schéma + upload storage + galerie fiche) — amélioration produit.
8. Reprise des chantiers différés : fournisseur Mobile Money définitif, notifications SMS, APK Android.

## Recommandations (inchangées + nouvelles)
- Centraliser les constantes métier (PASS déjà centralisé dans `lib/pass.ts` côté front — dupliqué dans l'edge fn : à surveiller).
- Tests E2E des parcours marketplace après pose des secrets.
- Documenter les API Supabase et politiques RLS.
- CI/CD : à défaut, respecter strictement `pnpm build` (prebuild purge le cache Next).
- À fort trafic : fournisseur de tuiles OSM dédié (MapTiler/Stadia) au lieu du serveur public.
