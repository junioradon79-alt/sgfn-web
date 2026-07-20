# Design System SGNF — et Centre National de Pilotage du Foncier

Refonte du dashboard admin (`/dashboard`) et fondation réutilisable pour le reste
de la plateforme.

---

## 1. Le principe qui commande tout le reste

**L'écran ne montre que ce que la base contient.**

L'ancien dashboard admin affichait une carte de Côte d'Ivoire avec un taux de
couverture par district — `Abidjan 97 %`, `Yamoussoukro 90 %`… Ces chiffres
étaient **écrits en dur dans le code**. Aucune table `régions` n'existe.

La réalité, mesurée en base le 13/07/2026 :

| | |
|---|---|
| Lots | **898** — dont **1 seul géolocalisé** |
| Périmètres | **2**, aux mêmes coordonnées (Anyama · Ebimpé) |
| Attestations de cession | 90 émises, **87 délivrées** |
| Litiges · Paiements · Dossiers ADU | **0 · 0 · 0** |
| Journal d'audit | 5 035 entrées |

Un centre de pilotage national qui invente sa couverture territoriale est pire
qu'un écran vide : il donne confiance dans un chiffre faux. La refonte affiche
donc le **vrai** chiffre — `Couverture GPS : 0,1 %` — et en fait un des quatre
KPI. Le trou de couverture *est* l'information de pilotage : le registre existe,
sa projection au sol n'existe pas.

Corollaire pour la suite : **ne jamais remplir un composant avec des données
d'illustration.** Un zéro se conçoit (`EmptyState`), il ne se maquille pas.

---

## 2. Ce que l'écran répond, dans l'ordre

| # | Question du pilote | Composant |
|---|---|---|
| 1 | Où en est le patrimoine ? | `KpiRow` — 4 indicateurs |
| 2 | Où est-il, physiquement ? | **`TerritoryMap`** — composant principal |
| 3 | Qu'est-ce qui m'attend ? | `AlertCenter` · `ActivityCenter` |
| 4 | Que dois-je arbitrer ? | `WorkQueues` |

### Densité

| | Avant | Après |
|---|---|---|
| Blocs visibles | 8 | **4** |
| Widgets | ~20 | **9** |

Soit **−55 %**, au-delà de l'objectif de −40 %. Ce qui a disparu et où c'est parti :

- **Actions rapides** → dans la palette ⌘K et l'en-tête des panneaux concernés.
  Une action se déclenche au contact de la donnée qu'elle modifie, pas dans une
  grille de boutons décorrélée.
- **Classement des performances** → supprimé. Classer 2 lotissements n'est pas
  un classement.
- **Graphiques analytiques** (panneau dédié) → fondus dans les KPI
  (`Sparkline`) et dans l'`ActivityCenter` (histogramme 14 jours). Le chiffre
  donne le niveau, la courbe donne la direction : ils vont ensemble.
- **3 panneaux de registres** (litiges / ADU / paiements) → **1 panneau à
  onglets**. On les consulte l'un après l'autre, jamais ensemble.

---

## 3. Tokens

`src/app/globals.css`. **Additifs par construction** : aucune règle `body` ou
`*` n'est redéfinie, donc les ~25 pages existantes (écrites en couleurs fixes)
sont strictement inchangées. Les composants du DS peignent leur propre surface.

```
Surfaces   --background --card --elevated --inset
Texte      --foreground --muted-foreground --muted-2
Lignes     --border --border-strong --ring
Marque     --primary --primary-700 --accent --accent-subtle
Sémantique --success --warning --danger  (+ variantes -subtle)
Data-viz   --chart-1 … --chart-5
```

> **Refonte 18/07 — alignement sur le handoff design.** Toutes ces valeurs ont
> été remappées sur le paquet de handoff (`primary #0B4D88`, `accent #1E88E5`,
> neutres/sémantiques associés), en clair **et** en sombre. Deux tokens ajoutés :
> `--muted-2` (texte tertiaire) et `--primary-700` (hover/active du primary).
> L'architecture (custom properties + `@theme inline` + `.dark` scopé) est
> **inchangée** — seules les valeurs bougent, donc les ~25 pages en hex fixe ne
> sont pas affectées tant qu'elles n'ont pas migré.

Exposés à Tailwind via `@theme inline` — donc `bg-card`, `text-muted-foreground`,
`border-border` résolvent la variable **au point d'usage**, ce qui rend le mode
sombre gratuit.

### Typographie

Handoff : **Geist** en police principale (graisses 300–900), **Inter** en
secours. `--font-sans` **et** `--font-display` pointent sur le même stack
`"Geist", "Inter", system-ui, sans-serif` — Geist a remplacé Manrope le 18/07.
Chargées via Google Fonts. Les chiffres comparés utilisent `.tabular`
(`tabular-nums`).

### Mode sombre : scopé, pas global

La classe `.dark` est posée **sur la racine de chaque écran migré** — `AppShell`
pour les dashboards, `VitrineShell` pour la page publique, la racine de
`LoginPage` pour la connexion — jamais sur `<html>`.

C'est ce qui permet de livrer le mode sombre aujourd'hui sans auditer les 25
autres pages : elles restent en clair, quoi que choisisse l'utilisateur.
Vérifié au navigateur — aucune fuite de thème sur `/dashboard/lots`.

⚠️ **Conséquence pour les tests.** Ouvrir Playwright avec `colorScheme: "dark"`
ne noircit **pas** `document.body` : le fond de page reste celui du thème clair,
puisque la classe est plus bas dans l'arbre. Mesurer la racine de l'écran
(`main`, le shell), jamais `body` — sinon on conclut à tort que le mode sombre
ne marche pas.

Quand les autres pages auront migré, il suffira de remonter la classe d'un cran.

**Comportement de la marque en sombre (refonte 18/07).** Par fidélité au
handoff, `--primary` (`#0B4D88`), `--accent` (`#1E88E5`) et les sémantiques
restent **identiques en clair et en sombre** ; seuls neutres et surfaces
basculent. `--primary-foreground` repasse en **blanc** en sombre — le primary
reste un bleu foncé, sur lequel le blanc passe AA. *(Décision antérieure
supersédée : le primary ne bascule plus sur `#5AA9D6` en sombre.)* Seules les
couleurs de data-viz (`--chart-*`) sont éclaircies en sombre pour rester
lisibles : le handoff ne les spécifie pas, donc la fidélité n'y contraint rien.

---

## 4. Composants

### `src/components/ds/` — primitives réutilisables

shadcn/ui (style *new-york*), écrit à la main sur **Radix + Lucide**.

> ⚠️ Le dossier s'appelle `ds/` et non `ui/` **volontairement** : `ui/` contient
> déjà `Badge.tsx` et `Input.tsx`, et Windows a un système de fichiers
> insensible à la casse — un `badge.tsx` shadcn les aurait **écrasés**.

`button` · `card` · `badge` · `dialog` · `sheet` · `dropdown-menu` · `select` ·
`input` · `label` · `tabs` · `tooltip` · `scroll-area` · `separator` ·
`skeleton` · `command` (palette ⌘K) · `empty-state` · `animated-number` ·
`spark` · `data-grid`

**`spark.tsx`** — `Sparkline`, `CompositionBar`, `BarSeries` en **SVG natif**.
Pas de Recharts : à cette échelle une dépendance de ~100 ko coûterait plus que
le code qu'elle remplace, et les couleurs viennent des tokens `--chart-*` (donc
le mode sombre est gratuit là aussi).

**`data-grid.tsx`** — le tableau de référence : tri (`aria-sort`), recherche,
densité, en-tête collant, états vide/chargement, navigation clavier.
Tri et filtre **en mémoire**, sur un jeu déjà borné. Les registres complets
(900 lots) gardent leurs pages dédiées, qui filtrent côté serveur — ce composant
ne doit pas devenir un prétexte à tout charger dans le navigateur.

### `src/components/pilotage/` — l'écran

`AppShell` · `AppSidebar` · `AppHeader` · `CommandPalette` · `KpiRow` ·
`TerritoryMap` (+ `TerritoryCanvas`) · `AlertCenter` · `ActivityCenter` ·
`WorkQueues` · `AduDialog`

---

## 5. Carte — le composant principal

`TerritoryMap` occupe la plus grande surface : c'est la seule vue qui répond à
« où ? », et le foncier est d'abord une question de lieu.

- **Leaflet réel** (le projet le maîtrise déjà : 4 cartes en production),
  chargé en `dynamic(ssr: false)` — l'app est exportée en statique.
- Fonds **Plan** (OSM) / **Satellite** (Esri). En `.dark`, les tuiles sont
  inversées par filtre CSS pour ne pas percer un trou blanc dans l'écran.
- Rayon des marqueurs en **√(nb de lots)** : c'est l'aire du disque qui doit
  être proportionnelle à la quantité, pas son rayon.
- **Les deux périmètres partagent les mêmes coordonnées** (le point du village
  d'Ebimpé). Les superposer les rendrait tous deux incliquables ; les décaler
  inventerait une position. → un marqueur **par lieu**, et le volet latéral liste
  les périmètres qui s'y trouvent (`grouperParLieu`).

---

## 6. Animation

`src/lib/motion.ts` — trois règles :

1. Le mouvement **informe**, il ne décore pas.
2. Une seule famille de courbes (`EASE`) ; `spring` réservé à ce que
   l'utilisateur manipule.
3. Rien au-delà de **400 ms**.

L'accessibilité est traitée **en amont** : `AppShell` monte un
`<MotionConfig reducedMotion="user">`, donc chaque variant est automatiquement
neutralisé si l'OS demande « moins d'animations ». Aucun composant ne re-teste
`prefers-reduced-motion`.

---

## 7. Données

`useAdminOverview` — **source unique**. Toute la page en dérive ; aucun composant
ne requête la base pour son compte. Deux chiffres d'un même écran ne peuvent donc
pas se contredire, et le coût réseau est payé une fois.

Le chargement/dérivation vit dans `chargerOverview()`, fonction **pure de
module** (hors React) : testable sans monter un arbre.

`useBadgeCounts` — les pastilles rouges « à faire ». Un seul appel alimente la
barre latérale **et** l'`AlertCenter` : le même chiffre ne peut pas diverger
selon l'endroit où il s'affiche. Règle inchangée
(`lib/agence-actions.ts::actionAgenceRequise`) : **rouge = c'est à nous de
jouer**, jamais « on attend le client ».

---

## 8. Non-régression

- **Navigation** : `src/lib/navigation.ts` centralise items, rôles et pastilles.
  L'ancienne `Sidebar` et la nouvelle le consomment — une permission n'existe
  qu'à **un seul endroit**. Périmètre d'accès **identique** à l'existant : mêmes
  `href`, `roles`, `adminHide`, `badgeKey`. Seul le regroupement en sections est
  nouveau.
- **Redirection par rôle** (`ROLE_HOME`) : inchangée.
- **Création de dossier ADU** : mêmes champs, même insertion, même `cree_par`.
- **Journal d'audit** : le détail avant/après reste accessible au clic — c'est
  la valeur probante du journal.
- Les 25 autres pages `/dashboard/*` gardent leur chrome historique.

### Bugs trouvés au navigateur (invisibles au typecheck et au lint)

1. **Double shell.** `DashboardShell` sortait sur `pathname === "/dashboard"`,
   mais `trailingSlash: true` fait que `usePathname()` renvoie `/dashboard/`.
   → **deux barres latérales et deux en-têtes empilés**. Corrigé en normalisant
   la barre oblique finale.
2. **Histogramme invisible.** `BarSeries` utilisait `items-end` : sans
   étirement, les colonnes prennent la hauteur de leur contenu, et la hauteur
   en `%` des barres se résout contre 0. → `items-stretch` + `h-full`.
3. Espace mangée par une coupure de ligne JSX dans le bandeau de couverture.
4. **Débordement de 13 px sur la vitrine à 390 px** (20/07). Le groupe d'actions
   de l'en-tête ne cédait jamais de place : le bouton « Demander une démo »
   restait affiché à toute largeur. Les media queries du handoff tranchaient
   déjà — **liens de nav et « Se connecter » masqués ≤ 1180 px, appel à
   l'action ≤ 480 px**. Quand une maquette porte des media queries, les lire :
   elles répondent aux questions responsive qu'on croit devoir trancher soi-même.

*(La carte semblait aussi cassée — 0 tuile chargée. C'était le DNS à froid du
réseau NAT64 du poste, pas le code : dès le 2ᵉ chargement, 15 tuiles peintes.)*

**Deux faux positifs de test, coûteux en temps :**

- Un `<div role="alert">` **vide** est présent en permanence — c'est
  l'annonceur de route de Next.js. Un `waitForSelector('[role="alert"]')` rend
  la main immédiatement et `.first()` attrape ce div, jamais le vrai message.
  → cibler le nœud réel (`p[role="alert"]`).
- `trailingSlash: true` fait rendre les `<Link>` en `/contact/` : un sélecteur
  `a[href="/contact"]` ne matche rien. → `a[href^="/contact"]`.

---

## 9. État

`tsc --noEmit` ✅ · `eslint` ✅ (0 erreur introduite) · `next build` ✅ (144 pages)
· vérifié au navigateur : clair, sombre, mobile 390 px, ⌘K, zéro erreur JS, zéro
débordement horizontal.

> ⚠️ **Erreur ESLint préexistante**, hors périmètre :
> `src/app/dashboard/lots/page.tsx:760` — `react-hooks/set-state-in-effect`.
> Présente sur le code committé (vérifié par `git stash`), non introduite ici.

### Suite

- Migrer les autres pages `/dashboard/*` sur le DS, puis remonter `.dark` sur `<html>`.
  *(Surfaces publiques faites : Site Vitrine et `/login` sont sur les jetons depuis le 20/07 — il ne reste que les `/dashboard/*` legacy.)*
- Brancher les recettes quand CinetPay sera activé (le KPI et l'onglet Paiements
  sont prêts et se remplissent seuls).
- Géolocaliser les 897 lots restants — c'est ce que l'écran réclame en premier.
