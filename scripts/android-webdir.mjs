// Adapte le webdir EMBARQUÉ dans l'APK (android/app/src/main/assets/public),
// sans toucher au dossier out/ servi sur le web.
//
// Pourquoi : le build produit des fichiers plats (app.html, dashboard/profil.html)
// et les liens internes visent des URL en trailingSlash (/app/, /dashboard/profil/).
// Sur le web, .htaccess réécrit /app/ -> app.html. Dans la WebView Capacitor il n'y
// a pas de .htaccess : le serveur local mappe /app/ -> app/index.html. On crée donc
// la forme répertoire, et on fait pointer la racine (index.html) sur /app/ pour que
// l'APK démarre directement sur l'app mobile (et non la vitrine).
//
// Idempotent : à relancer après chaque `cap sync android` (qui réécrase les assets).

import { readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const PUBLIC = new URL("../android/app/src/main/assets/public/", import.meta.url);
const ROOT = PUBLIC.pathname.replace(/^\/([A-Za-z]:)/, "$1"); // Windows: /C:/... -> C:/...

// N'a pas de forme répertoire : racine, page d'erreur, offline (chargée telle quelle).
const SKIP = new Set(["index.html", "404.html", "offline.html"]);

let dirForms = 0;

/** Duplique chaque `X.html` en `X/index.html` (récursif), hors _next/ et SKIP racine. */
function walk(absDir, relDir) {
  for (const item of readdirSync(absDir)) {
    if (relDir === "" && item === "_next") continue; // assets, pas des pages
    const abs = join(absDir, item);
    const rel = relDir ? `${relDir}/${item}` : item;
    if (statSync(abs).isDirectory()) {
      walk(abs, rel);
    } else if (item.endsWith(".html")) {
      if (relDir === "" && SKIP.has(item)) continue;
      const base = item.slice(0, -".html".length);
      const destDir = join(absDir, base);
      const dest = join(destDir, "index.html");
      mkdirSync(destDir, { recursive: true });
      copyFileSync(abs, dest);
      dirForms++;
    }
  }
}

walk(ROOT, "");

// La racine de l'APK redirige vers l'app mobile (démarrage direct sur /app/).
const redirect = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="refresh" content="0;url=/app/">
<title>SGNF</title>
<style>html,body{margin:0;height:100%;background:#0D3B66}</style>
<script>location.replace('/app/');</script>
</head><body></body></html>`;
writeFileSync(join(ROOT, "index.html"), redirect, "utf8");

// Défense en profondeur : retirer le service worker du bundle natif. En natif,
// RegisterSW ne l'enregistre plus (détection Capacitor) ; on supprime en plus le
// fichier pour qu'aucune tentative n'aboutisse. Cf. incompatibilité SW × Capacitor.
let swRemoved = false;
const sw = join(ROOT, "sw.js");
if (existsSync(sw)) { rmSync(sw); swRemoved = true; }

console.log(
  `✓ webdir Android adapté — ${dirForms} formes répertoire créées, index.html -> /app/` +
    (swRemoved ? ", sw.js retiré" : "")
);
