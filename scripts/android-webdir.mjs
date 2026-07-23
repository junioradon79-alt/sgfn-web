// Adapte le webdir EMBARQUÉ dans l'APK (android/app/src/main/assets/public),
// sans toucher au dossier out/ servi sur le web. À relancer après chaque
// `cap sync android` (qui réécrase les assets). Cf. `npm run android:prepare`.
//
// Capacitor sert les assets locaux (https://localhost) par interception native.
// 🔴 IMPORTANT (constaté sur appareil) : son serveur local NE résout PAS les URL
// en dossier — une requête vers `/app/` ne renvoie pas `app/index.html`, elle
// retombe sur le `index.html` racine. Rediriger `index.html` vers `/app/` créait
// donc une BOUCLE (/ → /app/ → index.html racine → /app/ …) = écran blanc.
// On redirige donc vers le FICHIER PLAT `/app.html`, que Capacitor sert en direct.

import { join } from "node:path";
import { writeFileSync, rmSync, existsSync } from "node:fs";

const PUBLIC = new URL("../android/app/src/main/assets/public/", import.meta.url);
const ROOT = PUBLIC.pathname.replace(/^\/([A-Za-z]:)/, "$1"); // Windows: /C:/… → C:/…

// La racine de l'APK démarre directement sur l'app mobile (fichier plat /app.html).
const redirect = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="refresh" content="0;url=/app.html">
<title>SGNF</title>
<style>html,body{margin:0;height:100%;background:#0D3B66}</style>
<script>location.replace('/app.html');</script>
</head><body></body></html>`;
writeFileSync(join(ROOT, "index.html"), redirect, "utf8");

// Défense en profondeur : retirer le service worker du bundle natif (RegisterSW ne
// l'enregistre plus en natif ; le fetch() d'un SW contourne l'interception Capacitor).
let swRemoved = false;
const sw = join(ROOT, "sw.js");
if (existsSync(sw)) { rmSync(sw); swRemoved = true; }

console.log(`✓ webdir Android adapté — index.html → /app.html` + (swRemoved ? ", sw.js retiré" : ""));
