# Documentation SGNF

**Dernière mise à jour :** 04 juillet 2026

Ce dossier est le **point d'entrée de référence pour reprendre le projet** — que ce soit après une pause ou en tant que nouveau développeur. Il documente l'état réel du code et de la base au moment de sa rédaction ; en cas de doute, vérifier contre le code/la base plutôt que de faire confiance aveuglément à un document daté.

---

## 1. Le projet en une phrase

SGNF (anciennement SGFN) numérise la gestion foncière d'un lotissement ivoirien (Kouéléa-Accor, village Ébimpé, commune d'Anyama) : tableaux de bord par rôle, documents officiels dématérialisés, vérification QR publique, paiements, et une marketplace publique associée (« Mon Terrain »).

Deux dépôts Git, un seul backend Supabase :

- `sgfn-web` → `https://sgfn.ci` (plateforme institutionnelle ; domaine cible du rebranding `sgnf.ci` pas encore activé en DNS)
- `monterrain-web` → `https://monterrain.sgfn.ci` (marketplace)

## 2. Par où commencer

1. Lire **[03-ARCHITECTURE.md](03-ARCHITECTURE.md)** en premier — la contrainte d'hébergement (cPanel PHP-only → export statique → sécurité 100 % RLS) conditionne quasiment toutes les décisions techniques du projet.
2. Lire **[02-ROADMAP.md](02-ROADMAP.md)** pour savoir ce qui est fait, testé, et ce qui reste en priorité.
3. Consulter **[04-DATABASE.md](04-DATABASE.md)** avant de toucher au schéma Supabase ou aux policies RLS.
4. Consulter **[06-CODING_STANDARDS.md](06-CODING_STANDARDS.md)** avant de builder/déployer — plusieurs pièges y ont déjà cassé la prod (zip vs tar.gz, cache Next, npm vs pnpm).
5. **[05-DESIGN_SYSTEM.md](05-DESIGN_SYSTEM.md)** pour toute nouvelle interface (palette, composants officiels).
6. **[01-VISION.md](01-VISION.md)** pour le positionnement produit si besoin de contexte stratégique.

## 3. Démarrage rapide (dev local)

```bash
pnpm install         # jamais npm install — casse sur ce repo
pnpm dev             # sgfn-web : http://localhost:3000
```

`monterrain-web` tourne sur le port 3100 (`pnpm dev` y lance `next dev -p 3100`).

Nécessite un `.env.local` avec `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (backend partagé, projet Supabase `bvdzrhvbiglwrhzpmuwy`) — sans ces variables, le site build/tourne mais sans accès aux données.

## 4. Autres documents utiles (hors `docs/`)

- `Fiche_projet_SGNF_2026-07-02.md` (racine du repo) — journal de session plus granulaire sur la période 02-03/07/2026, utile pour retrouver le détail d'une décision récente. Son contenu factuel a été repris et daté dans `02-ROADMAP.md`.
- `Grille_Tarifaire_SGNF_2026-07-03.md` (racine du repo, non commité) — grille tarifaire complète des actes payants.

## 5. Index complet

| Fichier | Contenu |
| --- | --- |
| [01-VISION.md](01-VISION.md) | Mission, vision, valeurs, positionnement produit |
| [02-ROADMAP.md](02-ROADMAP.md) | État d'avancement détaillé + feuille de route priorisée |
| [03-ARCHITECTURE.md](03-ARCHITECTURE.md) | Stack, contrainte d'hébergement, rôles/routage, edge functions, déploiement |
| [04-DATABASE.md](04-DATABASE.md) | Schéma Supabase par domaine, RLS, fonctions/triggers clés |
| [05-DESIGN_SYSTEM.md](05-DESIGN_SYSTEM.md) | Palette, typographie, composants officiels |
| [06-CODING_STANDARDS.md](06-CODING_STANDARDS.md) | Conventions, règles métier à ne pas casser, pièges déjà rencontrés |
