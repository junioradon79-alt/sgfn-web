# SGNF – Design System

**Version :** 1.1 — palette réalignée sur le handoff du 18/07/2026
**Statut :** En évolution

> **Deux documents, deux usages.** Celui-ci fixe les *règles* (palette,
> typographie, principes). [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) décrit la
> *mise en œuvre* du Centre National de Pilotage — composants réels
> (`src/components/ds/`), anatomie des tuiles, pièges rencontrés. Commencer
> ici, poursuivre là-bas avant d'écrire un composant.

---

# 1. Objectif

Le Design System de SGNF définit les règles graphiques et ergonomiques de la plateforme.

Il garantit une interface cohérente, moderne et homogène sur l'ensemble des écrans.

---

# 2. Principes

Chaque écran doit respecter les principes suivants :

* Simplicité
* Lisibilité
* Cohérence
* Rapidité
* Accessibilité
* Responsive Design

---

# 3. Identité visuelle

Le logo SGNF constitue l'élément central de l'identité graphique.

Toutes les interfaces doivent respecter cette identité.

---

# 4. Palette de couleurs

> **Source de vérité : `src/app/globals.css`.** Les valeurs ci-dessous en sont le
> reflet documentaire — en cas de doute, c'est le fichier qui fait foi. Palette
> alignée sur le handoff design du 18/07/2026 (refonte livrée les 19-20/07,
> voir §4.1 du Document Directeur).

| Rôle | Jeton | Clair | Sombre | Utilisation |
| --- | --- | --- | --- | --- |
| Principale | `--primary` | `#0B4D88` | `#0B4D88` | Boutons principaux, liens, onglet actif |
| Principale (survol) | `--primary-700` | `#083A68` | `#083A68` | État survol/actif du principal |
| Accent | `--accent` | `#1E88E5` | `#1E88E5` | Mise en évidence, graphiques |
| Succès | `--success` | `#16A34A` | `#16A34A` | Validation, confirmation |
| Alerte | `--warning` | `#D97706` | `#D97706` | Alertes légères, seuils |
| Danger | `--danger` | `#DC2626` | `#DC2626` | Erreurs, pastilles de file d'attente |

**Neutres** — ce sont elles, et non les couleurs de marque, qui changent entre
les deux thèmes :

| Rôle | Jeton | Clair | Sombre |
| --- | --- | --- | --- |
| Fond de page | `--background` | `#F6F8FB` | `#0B1524` |
| Surface (cartes) | `--card` | `#FFFFFF` | `#111E30` |
| Creux, rails | `--inset` | `#F3F6FB` | `#0E1A2B` |
| Bordure | `--border` | `#E6ECF4` | `#213348` |
| Texte principal | `--foreground` | `#0F172A` | `#EAF1FB` |
| Texte secondaire | `--muted-foreground` | `#64748B` | `#93A6C0` |
| Texte tertiaire | `--muted-2` | `#94A3B8` | `#63788F` |

⚠️ **Ne jamais écrire une couleur en dur** (`bg-white`, `text-slate-700`, `#fff`)
dans un composant : elle ne suivra pas le thème et restera claire sur fond
sombre. C'est le défaut le plus fréquent de la base — 179 occurrences ont dû
être converties sur le seul écran Saisie. Toujours passer par les jetons.

---

# 5. Typographie

Police principale :

Geist

Police secondaire :

Inter

---

# 6. Composants

Les composants officiels de SGNF sont :

* SGNFButton
* SGNFCard
* SGNFBadge
* SGNFInput
* SGNFTable
* SGNFModal
* SGNFAlert
* SGNFStatCard
* SGNFPageHeader

Aucun composant ne doit être dupliqué.

---

# 7. Icônes

Bibliothèque officielle :

Lucide React

---

# 8. Espacements

Les espacements suivent une grille de 8 px.

Exemples :

* 8 px
* 16 px
* 24 px
* 32 px
* 48 px
* 64 px

---

# 9. Boutons

Deux variantes sont disponibles :

* Primary
* Secondary

Les variantes supplémentaires devront être validées avant leur ajout.

---

# 10. Responsive

Tous les écrans devront être compatibles :

* Desktop
* Tablette
* Mobile

Le mobile n'est jamais une option.

---

# 11. Philosophie

L'interface SGNF doit inspirer :

* la confiance ;
* la simplicité ;
* le professionnalisme.

Chaque écran doit permettre à un utilisateur d'accomplir sa tâche avec un minimum d'effort.
