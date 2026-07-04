# SGNF – Conventions & pièges connus

**Version :** 1.0
**Date de rédaction :** 04 juillet 2026
**Statut :** Document de référence — dossier de passation développeur

---

# 1. Gestionnaire de paquets

**pnpm uniquement, sur les deux dépôts.** `npm install` échoue avec une erreur arborist à cause de la structure `node_modules` pnpm déjà en place. `monterrain-web` a en plus un `pnpm-workspace.yaml`/champ `pnpm.ignoredBuiltDependencies` (`sharp`, `unrs-resolver`) nécessaire pour que `pnpm build` réussisse.

---

# 2. Contraintes de l'export statique (`output: "export"`)

- **Jamais `cache: "no-store"` sur un `fetch`** : ça rend la route dynamique, ce qui est interdit en export statique et casse le build.
- **`generateStaticParams` ne doit jamais retourner une liste vide** si des routes dynamiques en dépendent (ex. `/annonces/[id]` sur monterrain-web) : à 0 annonce active, le build échouait purement et simplement. Un repli existe (UUID nul) mais il faut idéalement garder au moins une entrée réelle en prod.
- **`.next/cache` doit être purgé avant chaque build** si les données viennent de Supabase : un cache fetch persistant peut servir des réponses obsolètes entre deux builds (symptôme observé : coordonnées/données d'annonce absentes de `out/` alors qu'elles existent en base). `monterrain-web` a un script `prebuild` dédié (`node -e "require('fs').rmSync('.next/cache',...)"`) — toujours déployer via `pnpm build`, jamais `next build` seul.
- **PostgREST sérialise `numeric` en chaîne de caractères** (pas en nombre JS). Toute colonne `numeric` (ex. `lat_approx`/`lng_approx`) doit être convertie explicitement (`Number(...)` / helper `toNum()`) avant d'être passée à une lib qui attend un vrai nombre (ex. Leaflet).
- `next.config.ts` doit impérativement se terminer par `export default nextConfig;` — un oubli déjà rencontré rendait toute la config (dont `images.unoptimized`) silencieusement ignorée.

---

# 3. Déploiement

**Toujours livrer l'archive de déploiement en `.tar.gz`, jamais en `.zip`.** Un zip PowerShell (`Compress-Archive`) ne préserve pas les permissions Unix → dossiers extraits en 644 (non traversables) → 403 sur tout `/_next/` à l'extraction cPanel. Commande de référence :

```bash
tar -czf sgfn-deploy.tar.gz -C out .
```

Le script `scripts/make-zip.ps1` produit encore un zip cassé — ne pas s'y fier avant de l'avoir corrigé ou remplacé.

---

# 4. Règles métier à ne jamais réintroduire par erreur

- **Aucune commission SGNF sur une vente de lot.** Un bug appliquant 5 % par défaut (`ventes.taux_commission`) a déjà été corrigé — les commissions ne s'appliquent qu'aux paiements de **services** (honoraires, attestations, prestations, pass marketplace), jamais à `vente_terrain`.
- **Le modèle du pass marketplace est fixe : 5 000 FCFA / 7 jours / 10 propriétaires distincts contactables, non remboursable.** Ne pas le simplifier en paiement à l'acte (1 paiement = 1 contact) ni introduire de remboursement sans revalidation explicite.
- **CinetPay n'est pas forcément le fournisseur Mobile Money définitif** — le code est fonctionnel et prêt (`initier-paiement`/`confirmer-paiement`) mais présenté à l'origine comme une référence technique. Ne pas supposer que c'est un choix arrêté sans confirmation.
- **Aucune coordonnée (téléphone/email) n'est échangée automatiquement entre acheteur et propriétaire sur la marketplace** — SGNF reste systématiquement l'intermédiaire (mise en relation manuelle via `/dashboard/contacts-marketplace`, bouton WhatsApp comme seule automatisation acceptée).

---

# 5. Sécurité — fonctions et secrets

- **Ne jamais révoquer l'EXECUTE des helpers RLS** (`est_admin()`, `mon_groupe()`, `mon_attributaire_id()`, `mon_operateur_id()`, `peut_contacter()`, `suis_participant()`) — ce sont eux qui rendent les policies RLS fonctionnelles pour `authenticated`.
- **Ne pas déplacer `pg_net` hors du schéma `public`** sans chantier dédié — cassé, ça arrête tous les appels edge function déclenchés par trigger/cron (`sgfn_call_edge`).
- **Jamais de clé API ou secret collé en clair dans le code ou le chat.** Un incident réel (clé Anthropic exposée) a déjà eu lieu — clé révoquée, rotation faite sur les edge functions concernées. Les secrets se posent exclusivement via Supabase → Project Settings → Edge Functions → Secrets, par l'utilisateur lui-même.
- Avant de considérer un WARN d'advisor Supabase comme un bug : vérifier s'il ne s'agit pas d'un helper RLS ou d'une fonction publique volontaire (inscription, vérification QR) — voir la liste dans [04-DATABASE.md](04-DATABASE.md) §4.

---

# 6. Enum et nommage — vérité terrain vs anciens documents

L'enum `groupe_utilisateur` réel est : `admin, chefferie, proprietaire, operateur, acquereur, verificateur, agent_ia, geometre, commissaire, amenageur`. D'anciens documents de brief ont pu citer `super_admin` ou `amenageur_operateur` — **ces valeurs n'existent pas**, toujours vérifier contre `database.types.ts` ou un `list_tables`/`describe` réel plutôt que contre un document daté.

Plus généralement : **les mémoires/documents de session (dont ce dossier de passation) sont des observations à un instant T, pas un état vivant.** Avant d'agir sur une affirmation précise (nom de colonne, valeur d'enum, statut d'un secret), vérifier contre le code ou la base actuelle.

---

# 7. Régénération de `database.types.ts`

Après tout changement de schéma, de fonction ou d'edge function ajoutant une RPC : régénérer via le MCP Supabase (`generate_typescript_types`). Un oubli fréquent fait qu'un `supabase.rpc(...)` fraîchement ajouté ne type-check plus, forçant un cast `as unknown as` temporaire — à nettoyer dès que les types sont régénérés.

---

# 8. Voir aussi

- [03-ARCHITECTURE.md](03-ARCHITECTURE.md) — contexte complet de la contrainte d'export statique.
- [04-DATABASE.md](04-DATABASE.md) — schéma et fonctions référencées ci-dessus.
