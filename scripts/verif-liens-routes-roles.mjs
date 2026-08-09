// Contrôle STATIQUE de la garde de route par rôle. Deux propriétés :
//
//   1. Tout lien sortant d'un écran atteignable par un rôle mène à une route
//      que ce rôle peut ouvrir.
//   2. Aucune garde n'est inerte : une liste fermée dont une entrée couvre
//      tout `/dashboard/*` ne garde rien, et n'aurait évidemment aucun lien
//      mort — un contrôle qui ne vérifierait que la propriété 1 la déclarerait
//      saine.
//
// Pourquoi statique et pas au navigateur — la limite est assumée. Un balayage
// Playwright ne verrait que les liens RENDUS dans l'état où il a mis l'écran :
// les boutons « Signer » et « Examiner » de l'Espace Chefferie n'existent que
// si une file est non vide, et le lien « Mettre en vente » que pour un compte
// `chefferie` rattaché à une FAMILLE — deux états que la production ne sait pas
// produire à la demande. Un test navigateur aurait donc affiché « tout va
// bien » sur les liens morts qu'on cherche précisément. La lecture du code les
// voit tous, qu'ils soient rendus ce jour-là ou non.
//
// LA RÉGRESSION QU'IL DÉFEND (commit 385e414, partie en production) : la garde
// de route a été dérivée du MENU seul. Or `/dashboard/chefferie` pousse CINQ
// fois vers `/dashboard/validations`, absente de la liste chefferie : chaque
// clic sur « Signer » (APFC) ou « Examiner » (cessions à valider) renvoyait le
// chef de village à son accueil. Le défaut n'est pas le lien — c'est la garde.
//
// Usage : node scripts/verif-liens-routes-roles.mjs
// Sortie : 0 si les deux propriétés tiennent, 1 sinon (liste en fichier:ligne).

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RACINE, "src");
const NAV = join(SRC, "lib", "navigation.ts");
const source = readFileSync(NAV, "utf8");

// ── 1. Extraction des tables de `navigation.ts` ──────────────────────────────
// Le contrôle ne peut pas importer `routeAutorisee` : `navigation.ts` tire
// lucide-react. Il relit donc les tables et REJOUE la règle — telle qu'elle est
// écrite, y compris quand elle est fausse (cf. `DASHBOARD_EXACT`), faute de
// quoi son verdict porterait sur du code qui n'a jamais tourné.

/**
 * `optionnel` : rendre "" au lieu de lever quand la table n'existe pas encore.
 * C'est le cas de `ROUTES_HORS_MENU` sur tout commit antérieur au correctif, et
 * ce contrôle doit pouvoir tourner sur ces commits-là pour établir le défaut.
 */
function bloc(marqueur, ouvrant, fermant, optionnel = false) {
  const i = source.indexOf(marqueur);
  if (i === -1) {
    if (optionnel) return "";
    throw new Error(`navigation.ts : « ${marqueur} » introuvable.`);
  }
  const debut = source.indexOf(ouvrant, i);
  let n = 0;
  for (let k = debut; k < source.length; k++) {
    if (source[k] === ouvrant) n++;
    else if (source[k] === fermant) {
      n--;
      if (n === 0) return source.slice(debut, k + 1);
    }
  }
  throw new Error(`navigation.ts : bloc « ${marqueur} » non fermé.`);
}

const listesParRole = (texte) => {
  const out = {};
  for (const m of texte.matchAll(/(\w+)\s*:\s*\[([^\]]*)\]/g)) {
    out[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  }
  return out;
};

const ROLE_NAV_ORDER = listesParRole(bloc("const ROLE_NAV_ORDER", "{", "}"));
const blocHorsMenu = bloc("const ROUTES_HORS_MENU", "{", "}", true);
const ROUTES_HORS_MENU = listesParRole(blocHorsMenu);
const ROUTES_TOUJOURS_OUVERTES = [
  ...bloc("const ROUTES_TOUJOURS_OUVERTES", "[", "]").matchAll(/"([^"]+)"/g),
].map((x) => x[1]);

const corpsGarde = source.slice(source.indexOf("export function routeAutorisee")).slice(0, 1800);

/**
 * La garde compare-t-elle `/dashboard` en ÉGALITÉ dans le balayage de la liste,
 * ou en préfixe comme les autres entrées ? On le LIT dans le code plutôt que de
 * le supposer : c'est ce qui rend le rejeu fidèle sur un commit fautif.
 */
const DASHBOARD_EXACT = corpsGarde.includes('base === "/dashboard"');

// Empreinte : les tables lues ici doivent être celles que la garde consulte.
// Une table déclarée mais ignorée par `routeAutorisee` serait un piège — le
// contrôle la lirait, la garde ne l'appliquerait pas, et le verdict virerait au
// vert sur des liens toujours morts à l'écran.
const exigences = ["ROLE_NAV_ORDER[groupe]", "ROUTES_TOUJOURS_OUVERTES"];
if (blocHorsMenu) exigences.push("ROUTES_HORS_MENU[groupe]");
for (const attendu of exigences) {
  if (!corpsGarde.includes(attendu)) {
    console.error(
      `✗ routeAutorisee a changé de forme : « ${attendu} » n'y figure plus.\n` +
        "  Ce contrôle rejoue la règle de navigation.ts ; il refuse de rejouer une règle périmée.",
    );
    process.exit(1);
  }
}

// ── 2. La règle, rejouée ─────────────────────────────────────────────────────
const normaliser = (c) => {
  const s = c.split("?")[0].split("#")[0];
  return s.length > 1 ? s.replace(/\/+$/, "") : s;
};
const couvre = (base, chemin) => chemin === base || chemin.startsWith(base + "/");

function routeAutorisee(groupe, chemin) {
  const order = ROLE_NAV_ORDER[groupe];
  if (!order) return true;
  const route = normaliser(chemin);
  if (route === "/dashboard") return true;
  if (ROUTES_TOUJOURS_OUVERTES.some((b) => couvre(b, route))) return true;
  if ((ROUTES_HORS_MENU[groupe] ?? []).some((b) => couvre(b, route))) return true;
  return order.some((href) => {
    const base = normaliser(href);
    if (DASHBOARD_EXACT && base === "/dashboard") return route === base;
    return couvre(base, route);
  });
}

// ── 3. Écrans atteignables par un rôle ───────────────────────────────────────
// Entrées = les routes de sa liste + celles ouvertes à tous + ses routes hors
// menu, chacune avec les `page.tsx` de ses SOUS-routes (`/lotissements` couvre
// `/lotissements/[id]`). `/dashboard` est exclu des entrées : les huit rôles à
// liste fermée ont tous un `ROLE_HOME`, et la page d'aiguillage les redirige
// avant d'avoir rendu le cockpit national.

function pagesSous(route) {
  const dir = join(SRC, "app", normaliser(route).replace(/^\//, ""));
  if (!existsSync(dir)) return [];
  const out = [];
  const pile = [dir];
  while (pile.length) {
    const d = pile.pop();
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) pile.push(p);
      else if (e === "page.tsx") out.push(p);
    }
  }
  return out;
}

function resoudre(spec, depuis) {
  let base;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(depuis), spec);
  else return null;
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    if (existsSync(base + ext)) return base + ext;
  }
  return null;
}

// `navigation.ts` est EXCLU du balayage : ses `href` sont des déclarations
// d'items de MENU, filtrées par `visibleNavItems` avec exactement la même liste
// fermée que `routeAutorisee`. Les compter serait un faux positif systématique
// — ils décrivent le menu de tous les rôles, pas les liens d'un écran.
const EXCLUS = new Set([NAV.replace(/\\/g, "/")]);

function fermetureDesImports(entrees) {
  const vus = new Set();
  const pile = [...entrees];
  while (pile.length) {
    const f = pile.pop();
    if (!f) continue;
    const cle = f.replace(/\\/g, "/");
    if (vus.has(cle) || EXCLUS.has(cle)) continue;
    vus.add(cle);
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/from\s+"([^"]+)"/g)) {
      const t = resoudre(m[1], f);
      if (t) pile.push(t);
    }
    for (const m of src.matchAll(/import\(\s*"([^"]+)"\s*\)/g)) {
      const t = resoudre(m[1], f);
      if (t) pile.push(t);
    }
  }
  return vus;
}

// ── 4. Liens sortants ────────────────────────────────────────────────────────
// Formes littérales seulement. `href={p.href}` est invisible ici — mais l'objet
// qui porte `href: "/dashboard/validations"` est capté par le motif `href:`, et
// c'est ainsi que ressortent les cinq liens de l'Espace Chefferie.
const MOTIFS = [
  /href=\{?\s*"(\/[^"]*)"/g,
  /href:\s*"(\/[^"]*)"/g,
  /router\.(?:push|replace)\(\s*"(\/[^"]*)"/g,
  /router\.(?:push|replace)\(\s*`(\/[^`$]*)/g,
  /href=\{?\s*`(\/[^`$]*)/g,
  /href:\s*`(\/[^`$]*)/g,
  /window\.location\.(?:href\s*=|assign\()\s*"(\/[^"]*)"/g,
];

function liensSortants(fichier) {
  const src = readFileSync(fichier, "utf8");
  const lignes = src.split("\n");
  const out = [];
  for (const motif of MOTIFS) {
    for (const m of src.matchAll(motif)) {
      const ligne = src.slice(0, m.index).split("\n").length;
      out.push({ cible: m[1], ligne, texte: (lignes[ligne - 1] ?? "").trim().slice(0, 120) });
    }
  }
  return out;
}

// ── 5. Verdict ───────────────────────────────────────────────────────────────
const roles = Object.keys(ROLE_NAV_ORDER).sort();
if (roles.length === 0) {
  console.error("✗ Aucune liste fermée lue dans ROLE_NAV_ORDER : l'extraction a échoué.");
  process.exit(1);
}

console.log(`Garde de route — ${roles.length} rôles à liste fermée`);
console.log(
  `  /dashboard comparé en ${DASHBOARD_EXACT ? "ÉGALITÉ" : "PRÉFIXE"} dans le balayage de liste\n`,
);

// Propriété n°2 — traitée d'abord, parce qu'un rôle sans garde n'a évidemment
// aucun lien mort : le constater après coup laisserait croire à un sans-faute.
let inertes = 0;
if (!DASHBOARD_EXACT) {
  for (const role of roles) {
    if (ROLE_NAV_ORDER[role].some((h) => normaliser(h) === "/dashboard")) {
      console.log(
        `  ✗ ${role.padEnd(22)} sa liste porte "/dashboard", comparé en PRÉFIXE : la garde est INERTE.` +
          "\n      Ce rôle ouvre tout /dashboard/*, administration comprise.",
      );
      inertes++;
    }
  }
}

// Propriété n°1
let morts = 0;
let liensExamines = 0;

for (const role of roles) {
  const routes = [
    ...new Set([
      ...ROLE_NAV_ORDER[role].filter((r) => r !== "/dashboard"),
      ...ROUTES_TOUJOURS_OUVERTES,
      ...(ROUTES_HORS_MENU[role] ?? []),
    ]),
  ];
  const pages = routes.flatMap(pagesSous);
  const fichiers = fermetureDesImports(pages);

  const trouves = [];
  for (const f of [...fichiers].sort()) {
    for (const l of liensSortants(f)) {
      // Seul `/dashboard/*` est gardé (`DashboardShell` n'enveloppe que lui) :
      // un lien vers `/lotissements` ou vers la vitrine n'est jamais refusé.
      if (!l.cible.startsWith("/dashboard")) continue;
      liensExamines++;
      if (routeAutorisee(role, l.cible)) continue;
      trouves.push({ fichier: f.replace(RACINE + "\\", "").replace(/\\/g, "/"), ...l });
    }
  }

  if (trouves.length === 0) {
    console.log(
      `  ✓ ${role.padEnd(22)} ${pages.length} pages, ${fichiers.size} fichiers — aucun lien mort`,
    );
    continue;
  }
  morts += trouves.length;
  console.log(`  ✗ ${role.padEnd(22)} ${trouves.length} lien(s) mort(s) :`);
  for (const t of trouves) {
    console.log(`      ${t.cible}`);
    console.log(`        ${t.fichier}:${t.ligne}   ${t.texte}`);
  }
}

// Contrôle positif : sans lui, une extraction cassée (zéro fichier balayé)
// passerait pour un sans-faute. Le seuil est bas exprès — il ne mesure rien, il
// prouve seulement que le balayage a eu lieu.
if (liensExamines < 20) {
  console.error(
    `\n✗ Seulement ${liensExamines} liens /dashboard examinés : le balayage n'a pas eu lieu.`,
  );
  process.exit(1);
}

console.log(
  `\n${liensExamines} liens /dashboard examinés — ${morts} mort(s), ${inertes} garde(s) inerte(s).`,
);
process.exit(morts > 0 || inertes > 0 ? 1 : 0);
