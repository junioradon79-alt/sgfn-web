/**
 * Contrôle de bout en bout de la PWA : ce que le service worker met vraiment en
 * cache, et ce que voit un utilisateur qui perd le réseau.
 *
 *   node scripts/pwa-verify.mjs                      # sur out/ servi en local
 *   E2E_BASE=https://sgfn.ci node scripts/pwa-verify.mjs
 *
 * Pourquoi ce script plutôt qu'une capture : les défauts du worker sont
 * invisibles à l'écran. Le pré-cache s'effondrait en silence en production
 * (`/login` répond 301 sur cet hôte, l'API Cache refuse une réponse redirigée,
 * et `addAll` étant atomique la totalité de l'app shell était abandonnée) —
 * l'application semblait pourtant parfaitement normale tant qu'on avait du
 * réseau. Seule l'inspection du cache le montre.
 *
 * ⚠️ Le worker exige un contexte sécurisé : `localhost` convient, une IP non.
 */
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE || "http://localhost:3100";

/** Doit rester synchronisé avec SHELL_ASSETS de `public/sw.js`. */
const SHELL_ATTENDU = [
  "/", "/login/", "/offline.html", "/manifest.json",
  "/logo-officiel.png", "/icons/icon-192.png", "/icons/icon-512.png",
];

const browser = await chromium.launch({
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});
const ctx = await browser.newContext();
const page = await ctx.newPage();

let echecs = 0;
const verdict = (ok, libelle, detail = "") => {
  if (!ok) echecs++;
  console.log(`${ok ? "  ok  " : " ÉCHEC"}  ${libelle}${detail ? `\n         ${detail}` : ""}`);
};

// ── 1. Enregistrement et activation ──────────────────────────────────────────
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 45000 });
const actif = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  return Boolean(reg?.active);
});
verdict(actif, "le service worker s'active");
if (!actif) { await browser.close(); process.exit(1); }

// Laisser le pré-cache se terminer (l'install n'est pas bloquante pour la page).
await page.waitForTimeout(4000);

// ── 2. Contenu réel du cache ─────────────────────────────────────────────────
const { nom, chemins } = await page.evaluate(async () => {
  const noms = await caches.keys();
  const nom = noms.find((n) => n.startsWith("sgnf-shell")) ?? null;
  if (!nom) return { nom: null, chemins: [] };
  const cache = await caches.open(nom);
  const reqs = await cache.keys();
  return { nom, chemins: reqs.map((r) => new URL(r.url).pathname) };
});

verdict(Boolean(nom), "un cache d'app shell existe", nom ?? "aucun cache trouvé");
for (const attendu of SHELL_ATTENDU) {
  verdict(chemins.includes(attendu), `pré-caché : ${attendu}`);
}

// ── 3. Bascule hors ligne ────────────────────────────────────────────────────
await ctx.setOffline(true);

// 3a. Une route pré-cachée doit encore s'afficher.
const login = await page.goto(`${BASE}/login/`, { waitUntil: "domcontentloaded" }).catch(() => null);
verdict(
  Boolean(login) && login.status() < 400,
  "hors ligne : /login/ est servi depuis le cache",
  login ? `statut ${login.status()}` : "navigation refusée",
);

// 3b. Une route jamais visitée doit tomber sur la page hors-ligne, pas sur
//     l'erreur réseau du navigateur.
await page.goto(`${BASE}/dashboard/litiges/`, { waitUntil: "domcontentloaded" }).catch(() => null);
const secours = await page.evaluate(() => document.body.innerText);
verdict(
  secours.includes("hors connexion"),
  "hors ligne : une route non cachée tombe sur offline.html",
  secours.slice(0, 80).replace(/\s+/g, " "),
);

// 3c. Le défaut corrigé : un asset absent du cache doit rendre une réponse, et
//     non faire échouer respondWith sur une TypeError.
const asset = await page.evaluate(() =>
  fetch("/icons/icon-96.png").then((r) => r.status).catch((e) => String(e)),
);
verdict(
  typeof asset === "number",
  "hors ligne : un asset non caché rend une réponse explicite",
  `→ ${asset}`,
);

await ctx.setOffline(false);

// ── 4. Manifeste : cohérence des captures déclarées ──────────────────────────
const manifeste = await page.evaluate(async () => (await fetch("/manifest.json")).json());
for (const s of manifeste.screenshots ?? []) {
  const [l, h] = s.sizes.split("x").map(Number);
  const reel = await page.evaluate(
    (src) =>
      new Promise((ok) => {
        const i = new Image();
        i.onload = () => ok([i.naturalWidth, i.naturalHeight]);
        i.onerror = () => ok(null);
        i.src = src;
      }),
    s.src,
  );
  verdict(
    Boolean(reel) && reel[0] === l && reel[1] === h,
    `capture ${s.src} au format déclaré ${s.sizes}`,
    reel ? `réel ${reel[0]}x${reel[1]}` : "fichier absent",
  );
}

await browser.close();
console.log(echecs ? `\n${echecs} contrôle(s) en échec.` : "\nTous les contrôles passent.");
process.exit(echecs ? 1 : 0);
