# SGNF – Architecture Technique

**Version :** 1.0
**Date de rédaction :** 04 juillet 2026
**Statut :** Document de référence — dossier de passation développeur

---

# 1. Vue d'ensemble

Le projet se compose de **deux dépôts Git indépendants**, partageant le **même backend Supabase** :

| Dépôt | Rôle | Domaine de production |
|---|---|---|
| `sgfn-web` (`c:\Dev\sgfn-web`) | Plateforme institutionnelle SGNF — tableaux de bord par rôle, gestion foncière, documents, vérification QR | `https://sgfn.ci` |
| `monterrain-web` (`c:\Dev\monterrain-web`) | Marketplace publique « Mon Terrain » — annonces de parcelles vérifiées | `https://monterrain.sgfn.ci` |

Le domaine cible du renommage SGFN→SGNF (`sgnf.ci`) **n'a jamais été activé en DNS** (seul `sgfn.ci` est enregistré et actif). Les deux sites tournent donc sur des sous-domaines de `sgfn.ci` en attendant une éventuelle migration future.

---

# 2. Stack technique

- **Framework** : Next.js 16.2.9 (App Router), React 19.2.4, TypeScript 5.
- **Style** : Tailwind CSS 4.
- **Backend** : Supabase (Postgres + Auth + Storage + Edge Functions Deno), projet unique `bvdzrhvbiglwrhzpmuwy` (région `eu-west-3`/Paris), partagé par les deux dépôts.
- **Documents PDF** : PDFMonkey (templates créés directement via son API), avec repli HTML embarqué en cas d'échec.
- **Email transactionnel** : Resend (domaine `sgfn.ci` vérifié).
- **Paiement en ligne** : CinetPay (code prêt côté edge functions, **secrets pas encore posés en prod** → inerte).
- **Cartographie** : Leaflet 1.9 / react-leaflet 5 (tuiles OpenStreetMap publiques).
- **QR codes** : `qrcode.react` (génération), `html5-qrcode` (scan caméra).
- **Mobile** : Capacitor 8 (Android) dans `sgfn-web` uniquement — enveloppe le même export statique (`webDir: "out"`).
- **Gestionnaire de paquets** : **pnpm exclusivement**. `npm install` échoue avec une erreur arborist à cause de la structure `node_modules` pnpm déjà en place.

---

# 3. Contrainte d'hébergement — décision structurante

**L'hébergement est un cPanel mutualisé PHP-only** (SafariCloud) : pas de section « Setup Node.js App », uniquement PHP/Perl/MultiPHP. **Impossible d'y exécuter un Next.js dynamique (serveur Node).**

Conséquence directe sur toute l'architecture applicative :

- `next.config.ts` force `output: "export"` en production → build 100 % statique (HTML/JS/CSS), déployé sur Apache.
- **`src/proxy.ts` (middleware Next.js) ne s'exécute JAMAIS en prod.** Il est présent dans le code mais totalement inerte — ne pas s'y fier pour une quelconque protection de route.
- **Toute la protection de `/dashboard` et le routage par rôle se font côté client** (React, dans `DashboardShell` et `dashboard/page.tsx`), jamais côté serveur/middleware.
- **La sécurité réelle des données repose entièrement sur le RLS Supabase.** Un visiteur non authentifié peut charger le HTML/JS des pages `/dashboard/*` (elles sont statiques et publiques au sens HTTP), mais ne peut lire aucune donnée protégée — c'est Postgres qui refuse, pas Next.js. Voir [04-DATABASE.md](04-DATABASE.md).

Vercel a été envisagé puis écarté (compte payant + DNS + GitHub non souhaités pour l'instant par le porteur de projet). Si l'hébergement change un jour vers une plateforme Node, ce choix d'architecture (statique + RLS) devra être réévalué mais n'est pas bloquant pour continuer à livrer en l'état.

---

# 4. Rôles utilisateurs et routage

Colonne `profiles.groupe` (enum Postgres `groupe_utilisateur`), valeurs exactes :

```
admin, chefferie, proprietaire, operateur, acquereur, verificateur, agent_ia, geometre, commissaire, amenageur
```

⚠️ Piège fréquent dans les anciens documents de brief : `super_admin` n'existe pas (= `admin`), `amenageur_operateur` n'existe pas non plus (ce sont deux valeurs distinctes `amenageur` et `operateur`).

Le routage post-connexion (`src/app/dashboard/page.tsx`, table `ROLE_HOME`) :

| Rôle | Espace |
|---|---|
| `proprietaire` | `/dashboard/proprietaire` |
| `acquereur`, `amenageur` | `/dashboard/acquisition` |
| `operateur` | `/dashboard/operateur` |
| `commissaire`, `verificateur` | `/dashboard/commissaire` |
| `chefferie` | `/dashboard/chefferie` |
| `admin`, `geometre`, `agent_ia` | reste sur le dashboard admin (`/dashboard`) |

Le mapping `acquereur`/`amenageur` → acquisition et le fait que `admin`/`geometre`/`agent_ia` partagent le même dashboard sont des choix par défaut, pas explicitement validés métier à l'origine — à confirmer si un doute produit se pose dessus.

---

# 5. Structure des dossiers (sgfn-web)

```
src/
  app/                  routes Next.js (App Router), voir liste complète ci-dessous
    dashboard/          espaces par rôle (proprietaire, operateur, commissaire, chefferie, acquisition, admin...)
  components/           design system (SGFNButton, SGFNCard, KpiCard, RadialGauge...) + dashboard/ + ui/ + home/
  contexts/, hooks/      useProfile (résout profiles.groupe), providers/
  lib/                  paiements.ts (labels/formatage), metiers.ts, theme.ts, supabase.ts
  utils/supabase/       client Supabase (browser)
  types/
scripts/                 create-out.js (assemblage out/), manuel-*.mjs (génération manuel PDF, gitignorés),
                         build-generation-document.mjs (réinjecte quittance.html dans le TS de l'edge fn)
supabase/                quasiment vide localement — les edge functions ne sont PAS versionnées ici,
                         elles vivent uniquement côté cloud (gérées via MCP Supabase)
android/                 projet Capacitor (Android uniquement)
manuel-utilisateur/      PDF + captures du manuel utilisateur (gitignoré, contient des données prod réelles)
public/.htaccess         routing Apache (mappe /route → route.html, sert les fichiers réels)
```

`monterrain-web` a une structure Next.js standard équivalente, sans Capacitor ni dashboard (site public uniquement : accueil, `/recherche`, `/annonces`, `/annonces/[id]`, `/pass`, `/pass/retour`, `/comment-ca-marche`).

⚠️ **Le dossier `supabase/functions/` n'existe pas dans le dépôt.** Toutes les edge functions ont été écrites et déployées directement via le MCP Supabase, sans être versionnées en local. Pour lire ou modifier leur code, il faut passer par les outils MCP Supabase (`get_edge_function`, `deploy_edge_function`), pas par le filesystem du repo.

---

# 6. Edge Functions (Supabase, projet `bvdzrhvbiglwrhzpmuwy`)

État au 04/07/2026 — toutes `ACTIVE` :

| Fonction | JWT requis | Rôle |
|---|---|---|
| `generation-document` (v27) | oui | Génère les PDF (attestation, certificat, APFC, quittance) via PDFMonkey + repli HTML, appelée par trigger DB (`sgfn_call_edge`) |
| `telecharger-document` | oui | Sert une URL signée service_role pour un document généré/délivré, après vérif du jeton appelant |
| `verification-qr` (v13) | non | Vérifie une attestation/certificat/APFC par référence ou jeton QR, journalise le scan dans `scans_qr` |
| `initier-paiement` | oui | Crée un paiement + checkout CinetPay (**503 tant que les secrets `CINETPAY_API_KEY`/`CINETPAY_SITE_ID` ne sont pas posés**) |
| `confirmer-paiement` | non | Webhook CinetPay réel (revérifie via l'API `check`, ne fait jamais confiance au body), délègue à `marquer_paiement_recu` |
| `webhook-mobile-money` | non | **Désactivée volontairement** (410) — gardée comme référence de code pour un futur fournisseur Mobile Money |
| `rappels-echeances` | oui | Cron quotidien 7h — rappels d'échéance J-3/jour J/retard, email + SMS (SMS no-op, secrets absents) |
| `envoyer-notifications` | oui | Consomme `notifications_a_envoyer` (canal email) via Resend, appelée par cron `*/10 min` |
| `agent-ia-ingestion`, `analyser-document-ia`, `agent` | oui/non | Fonctions IA (Claude) — extraction encore partiellement simulée côté `dashboard/ia`, voir [02-ROADMAP.md](02-ROADMAP.md) |
| `acheter-pass-marketplace` | non | Achat du pass contact marketplace (5000 FCFA/7j/10 contacts), crée paiement + jeton |
| `demande-contact` | non | Décrémente un jeton actif, notifie les admins SGNF |
| `publier-annonce` | oui | Propriétaire publie/édite une annonce (vérifie l'éligibilité du lot) |
| `statut-pass` | non | Consultation publique du statut d'un jeton (sans PII) |

**Point de sécurité identifié, non corrigé** : `generation-document` a un garde `HOOK_SECRET` attendu sur le header `x-hook-secret`, mais le trigger DB (`sgfn_call_edge`) envoie en réalité un `Authorization: Bearer <secret vault>`. Les deux mécanismes ne correspondent pas — `HOOK_SECRET` n'est probablement jamais vérifié en pratique, l'endpoint n'étant alors protégé que par `verify_jwt` (satisfiable avec la clé anon publique). Risque théorique : forcer la régénération d'un document avec des données arbitraires pour un id/référence existant (upsert). À auditer et corriger.

---

# 7. Déploiement

Aucun serveur Node en prod — déploiement = build statique + upload manuel cPanel.

1. `pnpm build` → `next build` puis `scripts/create-out.js` qui assemble `out/` (HTML, `_next/static`, contenu de `public/`, `.htaccess`).
2. Archiver le **contenu** de `out/` en **`.tar.gz`** :
   ```bash
   tar -czf sgfn-deploy.tar.gz -C out .
   ```
3. Upload + extraction manuelle via le Gestionnaire de fichiers cPanel (pas de SSH disponible sur cet hébergement).

⚠️ **Piège critique, déjà rencontré en prod : ne JAMAIS livrer en `.zip`.** Un zip créé par `Compress-Archive` (PowerShell) ne préserve pas les permissions Unix → les dossiers extraits sortent en `644` (sans bit exécution) → **403 Forbidden sur tout `/_next/`** (page sans CSS/JS). Symptôme distinctif : un fichier inexistant sous `/_next/` renvoie 403 et non 404 = dossier non traversable.

Le script `scripts/make-zip.ps1` (référencé par `npm run deploy` dans `package.json`) **produit encore ce zip cassé** — ne pas l'utiliser tel quel, ou le corriger/remplacer par un vrai pipeline tar.gz avant de faire confiance à `npm run deploy`.

**Variables d'environnement au build** : `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` (`.env.local`) sont figées dans le bundle JS au moment du build. Un build sans elles = site déployé sans accès Supabase.

`monterrain-web` suit exactement le même pipeline (`create-out.js` + `.htaccess` repris de `sgfn-web`), avec une contrainte supplémentaire : en `output:"export"`, si la marketplace a **0 annonce active**, `generateStaticParams` échoue à générer les pages `/annonces/[id]` → le build casse. Un repli existe (retombe sur un UUID nul) mais il faut idéalement toujours garder ≥1 annonce active en prod.

---

# 8. Application mobile (Capacitor)

`sgfn-web` uniquement. `capacitor.config.json` : `appId: "ci.sgfn.app"`, `webDir: "out"` (même export statique que le web). Générer l'APK :

```bash
pnpm build:mobile   # next build → out/ → cap sync android
pnpm cap:open       # ouvre Android Studio → Build → Generate Signed APK
```

Prérequis non encore réunis : Android Studio installé, keystore généré (`keytool -genkey -alias sgfn -keystore android/sgfn-release.jks`), icônes 192×192/512×512 dans `public/icons/`. Chantier explicitement reporté par le porteur de projet, à ne relancer que sur demande.

⚠️ Ne jamais renommer `appId`/keystore par cohérence avec le renommage SGFN→SGNF : cela publierait une **nouvelle** app Android, pas une mise à jour.

---

# 9. Voir aussi

- [02-ROADMAP.md](02-ROADMAP.md) — état d'avancement détaillé et priorités restantes.
- [04-DATABASE.md](04-DATABASE.md) — schéma Supabase, RLS, fonctions clés.
- [06-CODING_STANDARDS.md](06-CODING_STANDARDS.md) — conventions et pièges connus.
- `Fiche_projet_SGNF_2026-07-02.md` (racine du repo) — journal de session plus granulaire, utile pour l'historique récent.
