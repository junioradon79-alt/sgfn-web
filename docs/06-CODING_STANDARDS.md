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

# 5 bis. Migrations — règles permanentes (depuis le 30/07/2026)

Le schéma `public` naissait ouvert à `anon` : toute table créée y recevait `INSERT/UPDATE/DELETE`, toute fonction y recevait `EXECUTE`. La cause a été retirée, et **deux dispositifs actifs gardent désormais la porte**. Ces règles ne sont pas des conseils : les enfreindre casse un DDL ou déclenche une alerte horaire.

**① Toute migration créant une fonction non publique dans `public` écrit :**

```sql
revoke execute on function public.ma_fonction(...) from public, anon;
```

**Au pluriel, les deux.** PostgreSQL a un défaut **câblé en dur** qui accorde `EXECUTE` à `PUBLIC` sur les fonctions ; `alter default privileges` n'y peut rien. Un `revoke … from anon` seul paraît réussir et ne ferme rien. Une RPC volontairement publique reçoit un grant **nommé** (`grant execute … to anon`), jamais un grant `PUBLIC`, pour que l'intention reste lisible dans `proacl`.

**② Une table publique légitime exige son grant explicite :**

```sql
grant select on public.ma_table_publique to anon;
```

⚠️ **La RLS filtre les LIGNES ; le grant SQL autorise l'ACCÈS À LA TABLE. Il faut les deux.** Avant le 30/07 le grant tombait tout seul, d'où l'habitude — désormais fausse — de croire qu'écrire la policy suffit à ouvrir l'accès.

**③ Ouvrir une fonction à `anon` demande DEUX gestes** : le grant nommé, **et** l'ajout de la signature à la ligne de base de `controle_exposition_anon()` (`supabase/migrations/20260730040000`, `…050000`). Sinon le job cron `securite-exposition-anon` lève toutes les heures.

**④ Créer les fonctions sous `postgres`.** L'event trigger `evt_fonctions_neuves_fermees_a_anon` exécute un `revoke … from public` sur chaque `CREATE FUNCTION` dans `public`. Sous un autre propriétaire, ce revoke échoue et **annule le DDL** — le message parle de privilèges, jamais d'event trigger. Sortie de secours : `scripts/desarmer-event-trigger.sql` (`set event_triggers = off` rend `42501` sur cette base).

**⑤ Ne jamais assouplir le contrôle horaire « par précaution »** avant une opération risquée : c'est lui qui détecte l'erreur. Il a servi de filet à l'installation de PostGIS.

**⑥ PostGIS : qualifier le type** — `extensions.geometry(Polygon, 4326)`, jamais `geometry(...)` nu. L'extension vit dans `extensions` et **n'est pas relocalisable** : le schéma s'est choisi une seule fois, une reprise serait destructive.

## Constater un droit — les outils qui mentent

- **Une ACL se constate sur `pg_proc.proacl` / `pg_class.relacl`**, jamais sur `has_function_privilege` / `has_table_privilege` seuls, ni sur la présence de l'instruction dans la migration. « Plus aucune mention de `anon` » passe au vert alors que le droit vient de `PUBLIC`.
- **Un grant de colonne est invisible au niveau table.** `has_table_privilege('anon','lotissements','SELECT')` rend **false** pendant que `anon` en lit huit colonnes. Le niveau colonne se lit dans `pg_attribute.attacl` ou `information_schema.column_privileges`.
- **Le seul contrôle qui ne ment pas est d'emprunter le rôle** : `set local request.jwt.claims = '…'` puis `set local role …`, en transaction annulée. ⚠️ `reset role` ne réinitialise **pas** les revendications JWT.

## Mesurer sans écrire

- 🔴 **Une transaction par identité.** Une campagne d'emprunt de rôle **en lot** rend des chiffres faux — l'identité ne varie pas, ou le plan est hissé et tout rend 0 — **et elle passe au vert**. Toujours relever un témoin (`auth.uid()`) *à l'intérieur* de la transaction.
- ⭐ **Distinguer un refus de garde d'une garde franchie sans rien écrire** : sous `set transaction read only`, un refus rend `P0001` avec son message, une garde franchie rend `25006 cannot execute INSERT in a read-only transaction`.
- ⚠️ **Une garde qui vaut NULL ne refuse rien.** `not (x = 'y')` avec `x` NULL vaut NULL et **exclut** la ligne. Utiliser `coalesce(…, false)`. Ce défaut a produit plusieurs failles réelles ici.

---

# 6. Enum et nommage — vérité terrain vs anciens documents

L'enum `groupe_utilisateur` réel compte **14 valeurs** (relevé en base le 30/07/2026) : `admin, chefferie, proprietaire_terrien, proprietaire, operateur, operateur_saisie, acquereur, verificateur, agent_ia, geometre, commissaire, amenageur, comptable, collaborateur`.

⚠️ **Ce document lui-même en portait une liste fausse jusqu'au 30/07** — il en annonçait 10, oubliant `proprietaire_terrien`, `operateur_saisie`, `comptable` et `collaborateur`. C'est l'illustration exacte de ce que la section met en garde de faire.

D'anciens documents de brief ont pu citer `super_admin` ou `amenageur_operateur` — **ces valeurs n'existent pas**. `proprietaire` est **déprécié** au profit de `proprietaire_terrien`, et `amenageur` a été **fusionné** dans `operateur` : les deux survivent dans l'enum sans être attribués.

⚠️ **Une valeur d'enum ne dit rien du stock.** Au 30/07, **5 des 14 groupes n'ont aucun profil** (`comptable`, `collaborateur`, `agent_ia`, `amenageur`, `proprietaire`) : tout comportement les concernant est **invérifiable en production**, et une policy écrite pour eux ne peut pas être testée. Compter les lignes avant de conclure qu'un rôle « ne voit rien ».

Toujours vérifier contre `database.types.ts` ou la base réelle plutôt que contre un document daté.

Plus généralement : **les mémoires/documents de session (dont ce dossier de passation) sont des observations à un instant T, pas un état vivant.** Avant d'agir sur une affirmation précise (nom de colonne, valeur d'enum, statut d'un secret), vérifier contre le code ou la base actuelle.

---

# 7. Régénération de `database.types.ts`

Après tout changement de schéma, de fonction ou d'edge function ajoutant une RPC : régénérer via le MCP Supabase (`generate_typescript_types`). Un oubli fréquent fait qu'un `supabase.rpc(...)` fraîchement ajouté ne type-check plus, forçant un cast `as unknown as` temporaire — à nettoyer dès que les types sont régénérés.

---

# 8. Voir aussi

- [03-ARCHITECTURE.md](03-ARCHITECTURE.md) — contexte complet de la contrainte d'export statique.
- [04-DATABASE.md](04-DATABASE.md) — schéma et fonctions référencées ci-dessus.
