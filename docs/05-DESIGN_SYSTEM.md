# SGNF – Design System

**Version :** 1.2 — fusion de la référence consolidée (site sgfn.ci + dépôt) dans le doc de règles
**Statut :** En évolution
**Dernière mise à jour :** 21/07/2026

> **Deux documents, deux usages.** Celui-ci fixe les *règles* (palette,
> typographie, tokens, principes, specs de composants). [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)
> décrit la *mise en œuvre* du Centre National de Pilotage — composants réels
> (`src/components/ds/`), anatomie des tuiles, pièges rencontrés. Commencer
> ici, poursuivre là-bas avant d'écrire un composant.
>
> **Source de vérité du code :** `src/app/globals.css` (tokens Tailwind v4) et
> `src/components/ui/`. En cas de doute, c'est le fichier qui fait foi ; ce
> document en est le reflet documentaire, aligné sur le handoff design (refonte
> 18/07) et le Document Directeur Unique v1.

---

# 1. Objectif & principes

Le Design System de SGNF définit les règles graphiques et ergonomiques de la
plateforme, pour une interface cohérente, moderne et homogène sur l'ensemble des
écrans.

Le site et le produit partagent une même conviction : **« la confiance se prouve,
elle ne s'affirme pas »**. Chaque choix visuel doit rendre l'information
*vérifiable* et *lisible*, jamais décorative.

Principes directeurs :

* **Simplicité** — chaque écran permet d'accomplir sa tâche avec un minimum d'effort.
* **Lisibilité** — hiérarchie claire, densité maîtrisée.
* **Cohérence** — un composant, un seul endroit ; aucun doublon.
* **Précision** — le foncier « gouverné avec précision » ; sobriété institutionnelle.
* **Traçabilité** — statuts, historiques et signaux visibles (badges, points pulsés, scores de confiance).
* **Rapidité, Accessibilité, Responsive** — le mobile n'est jamais une option.

**Corollaire de rigueur (cf. `DESIGN_SYSTEM.md` §1) :** l'écran ne montre que ce
que la base contient. Ne jamais remplir un composant avec des données
d'illustration ; un zéro se conçoit (`EmptyState`), il ne se maquille pas.

---

# 2. Identité & marques

Le logo SGNF (`logo-embleme.png`) constitue l'élément central de l'identité
graphique. Toutes les interfaces respectent cette identité.

**Deux marques coexistantes**, sans se remplacer (arbitrage A1, Document
Directeur §5) :

* **SGNF** — institutionnel, bleu régalien. État, collectivités, professionnels du foncier.
* **TerraCI Market** — grand public / commercial : navy + vert + or.

⚠️ Ne pas mélanger les deux palettes dans un même écran. TerraCI est réservé au
marché grand public (`monterrain.sgfn.ci`).

---

# 3. Palette de couleurs

> **Source de vérité : `src/app/globals.css`.** Palette alignée sur le handoff
> design du 18/07/2026 (refonte livrée les 19-20/07, voir §4.1 du Document
> Directeur).

## 3.1 Palette de marque SGNF (`brand-*`)

| Rôle | Jeton | Hex | Utilisation |
| --- | --- | --- | --- |
| Principale | `brand-primary` | `#0B4D88` | Bleu régalien — actions primaires, en-têtes, identité |
| Action / accent | `brand-secondary` · `brand-accent` | `#1E88E5` | Liens, focus, accents |
| Succès | `brand-success` | `#16A34A` | Succès, disponibilité |
| Canvas | `brand-bg` | `#F6F8FB` | Arrière-plan global |
| Texte | `brand-text` | `#0F172A` | Texte principal (encre) |

`theme-color` du navigateur : **adaptative**, définie dans `src/app/layout.tsx` —
`#F6F8FB` en clair, `#0B1524` en sombre. Ce sont les deux canvas `--background`
et non la couleur de marque : la barre système prolonge la page, elle ne la
surmonte pas. Une valeur unique laissait la barre claire sur un écran sombre.

Le manifeste PWA (`public/manifest.json`) ne sait pas s'adapter au thème : il
porte `theme_color: #0B4D88` (marque, pour la vignette du lanceur Android) et
`background_color: #F6F8FB` (canvas clair, pour que l'écran de démarrage
enchaîne sans à-coup sur l'application).

## 3.2 Palette TerraCI (marque commerciale)

| Jeton | Hex | Utilisation |
| --- | --- | --- |
| `terraci-navy` | `#0F2B52` | Base foncée TerraCI Market |
| `terraci-green` | `#1E9E5A` | Vert principal |
| `terraci-green-light` | `#3FBE72` | Vert clair / accents |
| `terraci-gold` | `#F0B429` | Or — mise en avant, valeur |

## 3.3 Tokens sémantiques (design system, shadcn-compatible)

Les composants peignent leur surface via ces jetons (`bg-background`,
`text-foreground`, `bg-primary`, `text-success`…), jamais via des hex figés —
c'est la condition du thème clair/sombre. Exposés à Tailwind via `@theme inline`,
donc `bg-card`, `text-muted-foreground`, `border-border` résolvent la variable
**au point d'usage**, ce qui rend le mode sombre gratuit.

**Marque (identique clair/sombre — fidélité handoff)**

| Rôle | Jeton | Hex |
| --- | --- | --- |
| Principale | `--primary` | `#0B4D88` |
| Principale (survol/actif) | `--primary-700` | `#083A68` |
| Texte sur principale | `--primary-foreground` | `#FFFFFF` |
| Accent | `--accent` | `#1E88E5` |
| Accent subtil | `--accent-subtle` | `#EAF2FB` (clair) · `#152A44` (sombre) |

**Sémantique d'état**

| Rôle | Jeton | Couleur | Fond subtil (clair) | Fond subtil (sombre) |
| --- | --- | --- | --- | --- |
| Succès | `--success` | `#16A34A` | `#E7F6EE` | `#10251C` |
| Alerte | `--warning` | `#D97706` | `#FBF0E1` | `#2A1F0E` |
| Danger | `--danger` | `#DC2626` | `#FBEBEB` | `#2A1416` |

**Neutres — ce sont elles, et non la marque, qui changent entre les thèmes**

| Rôle | Jeton | Clair | Sombre |
| --- | --- | --- | --- |
| Fond de page | `--background` | `#F6F8FB` | `#0B1524` |
| Surface (cartes) | `--card` | `#FFFFFF` | `#111E30` |
| Élévé (popover/menu) | `--elevated` | `#FFFFFF` | `#16223A` |
| Creux, rails | `--inset` | `#F3F6FB` | `#0E1A2B` |
| Bordure | `--border` | `#E6ECF4` | `#213348` |
| Bordure marquée | `--border-strong` | `#DCE5F0` | `#2C4159` |
| Focus (ring) | `--ring` | `#1E88E5` | `#1E88E5` |
| Texte principal | `--foreground` | `#0F172A` | `#EAF1FB` |
| Texte secondaire | `--muted-foreground` | `#64748B` | `#93A6C0` |
| Texte tertiaire | `--muted-2` | `#94A3B8` | `#63788F` |

**Data-viz (5 teintes distinctes, éclaircies en sombre)**

| Jeton | Clair | Sombre |
| --- | --- | --- |
| `--chart-1` | `#0B4D88` | `#5AA9D6` |
| `--chart-2` | `#1E88E5` | `#8EC5E3` |
| `--chart-3` | `#16A34A` | `#34D399` |
| `--chart-4` | `#D97706` | `#FBBF24` |
| `--chart-5` | `#7C3AED` | `#A78BFA` |

⚠️ **Ne jamais écrire une couleur en dur** (`bg-white`, `text-slate-700`, `#fff`)
dans un composant : elle ne suivra pas le thème et restera claire sur fond
sombre. C'est le défaut le plus fréquent de la base — 179 occurrences ont dû être
converties sur le seul écran Saisie. Toujours passer par les jetons.

## 3.4 Mode sombre : scopé, pas global

La classe `.dark` est posée **sur la racine de chaque écran migré** (`AppShell`,
`VitrineShell`, racine de `LoginPage`) — jamais sur `<html>`. C'est ce qui permet
de livrer le mode sombre sans auditer les pages non migrées : elles restent en
clair. Par fidélité au handoff, la marque et les sémantiques restent identiques
en clair et en sombre ; seuls neutres et surfaces basculent. Détails, pièges de
test et data-viz : voir [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §3.

---

# 4. Typographie

* **Police principale :** **Geist** (graisses 300–900).
* **Secours :** **Inter**, puis `system-ui, sans-serif`.
* **Stacks :** `--font-sans` **et** `--font-display` pointent sur le même stack
  `"Geist", "Inter", system-ui, sans-serif` (Geist a remplacé Manrope le 18/07).
  Titres `h1–h6` en `font-display`. Chargées via Google Fonts.
* **Corps :** hérite de `--font-sans` via `body`, `-webkit-font-smoothing: antialiased`, `text-wrap: pretty`.

**Échelle indicative (Tailwind)**

| Niveau | Classe | Graisse | Usage |
| --- | --- | --- | --- |
| Display / H1 | `text-4xl`+ | 700–900 | Titres de hero |
| H2 section | `text-2xl` / `text-3xl` | 700 | Titres de section |
| Titre carte | `text-lg` | 600 | En-tête de panneau |
| Corps | `text-base` | 400–500 | Texte courant |
| Secondaire | `text-sm` | 400 | Sous-titres, légendes |
| Micro | `text-xs` | 600 | Badges, méta |

**Chiffres comparés :** utilitaire `.tabular` (`tabular-nums`) — obligatoire dès
qu'on compare des montants ou aligne des colonnes.

---

# 5. Rayons, ombres, espacements & focus

**Rayon** — base `--radius: 0.75rem`.

| Jeton | Calcul | ≈ | Usage type |
| --- | --- | --- | --- |
| `radius-sm` | `radius − 4px` | 8px | Inputs (`rounded-md`) |
| `radius-md` | `radius − 2px` | 10px | — |
| `radius-lg` | `radius` | 12px | Boutons (`rounded-xl`) |
| `radius-xl` | `radius + 4px` | 16px | — |
| `radius-2xl` | `radius + 10px` | 22px | Cartes (`rounded-2xl`) |

Badges : `rounded-full`.

**Ombres**

| Jeton | Usage |
| --- | --- |
| `shadow-panel` | Cartes, panneaux au repos |
| `shadow-float` | Popovers, menus, éléments flottants |

En sombre, les deux passent en noir opaque pour rester visibles.

**Espacements** — grille de **8 px** : 8 · 16 · 24 · 32 · 48 · 64.

**Focus visible (accessibilité)** — `outline: 3px solid rgba(30,136,229,0.38);
outline-offset: 3px;` sur tout `*:focus-visible`.

---

# 6. Composants

Composants officiels (aucun doublon autorisé). Les primitives réutilisables
vivent dans `src/components/ds/` (shadcn/ui style *new-york*, sur Radix +
Lucide) ; les composants historiques dans `src/components/ui/`. Anatomie
détaillée et inventaire complet : [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §4.

## 6.1 Bouton (`SGNFButton`)

* **Variantes :** `primary` · `secondary` · `danger` · `ghost`.
* **Tailles :** `sm` (`px-3 py-2 text-sm`) · `md` (`px-5 py-3 text-base`) · `lg` (`px-6 py-4 text-lg`).
* **Base :** `rounded-xl font-semibold transition duration-200 shadow-sm`, `disabled:opacity-50 disabled:cursor-not-allowed`.

| Variante | Repos | Hover | Texte |
| --- | --- | --- | --- |
| primary | `bg-blue-700` | `bg-blue-800` | blanc |
| secondary | `bg-slate-200` | `bg-slate-300` | `slate-900` |
| danger | `bg-red-600` | `bg-red-700` | blanc |
| ghost | transparent | `bg-slate-100` | `slate-700` |

> 🔧 **Dette connue :** ces variantes utilisent des couleurs Tailwind figées et
> ne suivent donc **pas** le thème sombre. Cible : migrer vers les jetons
> sémantiques (`bg-primary` / `hover:bg-primary-700`), comme le fait déjà `Badge`.

## 6.2 Carte (`SGNFCard`)

`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm`. En-tête optionnel :
titre `text-lg font-semibold`, sous-titre `text-sm text-slate-500`.

## 6.3 Champ (`Input`)

Fond `#F8FAFC`, bordure `slate-300`, `rounded-md`, `px-3 py-2`. Focus : bordure
`#0D3B66` + `ring-2 ring-[#0D3B66]/10`. Erreur : bordure/ring `#EF4444` + message
`text-xs`. (Consommateurs restants = pages publiques claires ; non migré à dessein.)

## 6.4 Badge de statut (`Badge`) — modèle de référence tokens

Pastille `rounded-full border px-2.5 py-0.5 text-xs font-semibold` + point pulsé
(`animate-ping`). Entièrement piloté par les jetons sémantiques → suit clair/sombre.

| Statut | Couleur | Fond | Bordure |
| --- | --- | --- | --- |
| `disponible` | `text-success` | `bg-success-subtle` | `border-success/25` |
| `attribue` | `text-accent` | `bg-accent-subtle` | `border-accent/25` |
| `en_validation` | `text-warning` | `bg-warning-subtle` | `border-warning/25` |
| `litige` | `text-danger` | `bg-danger-subtle` | `border-danger/25` |
| `neutre` | `text-muted-foreground` | `bg-inset` | `border-border` |

## 6.5 Autres composants officiels

`SGNFTable` · `SGNFModal` · `SGNFAlert` · `SGNFStatCard` · `SGNFPageHeader`, plus
les primitives `ds/` (`dialog`, `sheet`, `dropdown-menu`, `select`, `tabs`,
`tooltip`, `command` (palette ⌘K), `empty-state`, `animated-number`, `spark`,
`data-grid`…).

---

# 7. Icônes

Bibliothèque officielle : **Lucide React**.

---

# 8. Mouvement & animations

Deux niveaux :

* **Site vitrine (CSS, `globals.css`)** — trois animations, toutes neutralisées
  par `prefers-reduced-motion` :

  | Classe | Effet | Timing |
  | --- | --- | --- |
  | `.reveal` | fondu + montée (16px) | `0.6s cubic-bezier(.22,.61,.36,1)` |
  | `.floaty` | flottement vertical (−10px) | `5s ease-in-out infinite` |
  | `.pulse-dot` | pulsation d'opacité | `2.4s ease-in-out infinite` |

* **Application (`src/lib/motion.ts`)** — trois règles : le mouvement informe (ne
  décore pas) ; une seule famille de courbes (`EASE`, `spring` réservé au
  manipulé) ; rien au-delà de **400 ms**. `AppShell` monte
  `<MotionConfig reducedMotion="user">` → accessibilité traitée en amont.

Transitions d'interaction standard : `transition duration-200`.

---

# 9. Cas particuliers

**Cartographie (Leaflet)** — en `.dark`, les tuiles sont inversées par filtre CSS
(`invert(1) hue-rotate(180deg) brightness .94 contrast .86`) et les
contrôles/attribution repassent sur les jetons (`elevated`, `foreground`,
`accent`) pour éviter le halo blanc. `TerritoryMap` est le composant principal du
pilotage — détails carto : [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §5.

---

# 10. Responsive

Tous les écrans sont compatibles Desktop / Tablette / Mobile. **Le mobile n'est
jamais une option.** Quand une maquette porte des media queries, les lire : elles
tranchent les questions responsive (ex. handoff vitrine : liens de nav et « Se
connecter » masqués ≤ 1180 px, appel à l'action ≤ 480 px).

---

# 11. Règles d'usage (à respecter)

1. **Peindre via les jetons sémantiques**, jamais via des hex en dur — condition du thème clair/sombre.
2. **Ne jamais poser `.dark` sur `<html>`** : le mode sombre reste scopé au sous-arbre applicatif.
3. **SGNF ≠ TerraCI** : pas de mélange des deux palettes dans un même écran.
4. **Contraste AA** : blanc sur `primary` (#0B4D88) passe AA en clair comme en sombre ; vérifier tout nouveau couple.
5. **Respecter `prefers-reduced-motion`** : ne pas ajouter d'animation qui échappe aux garde-fous globaux.
6. **Aucun doublon de composant** ; toute variante supplémentaire doit être validée avant ajout.
7. **L'écran ne montre que ce que la base contient** : pas de donnée d'illustration.

---

*Fusion réalisée à partir de l'analyse du site sgfn.ci et du dépôt `sgfn-web`.
Références code : `src/app/globals.css`, `src/components/ui/{SGNFButton,SGNFCard,Input,Badge}.tsx`,
`src/app/layout.tsx`. Mise en œuvre détaillée : `docs/DESIGN_SYSTEM.md`.*
