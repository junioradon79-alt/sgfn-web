/**
 * Produit les deux captures déclarées par `public/manifest.json`, affichées par
 * l'invite d'installation de la PWA (Chrome Android, écran « Installer SGNF »).
 *
 *   node scripts/pwa-screenshots.mjs
 *
 * Trois exigences que ce script existe pour tenir :
 *
 * 1. **Les dimensions doivent correspondre au manifeste au pixel près.** Chrome
 *    ignore silencieusement une capture dont la taille réelle diffère du champ
 *    `sizes` — d'où une capture au format du viewport, jamais `fullPage`, qui
 *    produirait une image de hauteur imprévisible.
 * 2. **Aucune donnée nominative.** Ces fichiers partent dans `public/`, donc
 *    versionnés et servis publiquement. On photographie le Centre National de
 *    Pilotage, qui n'expose que des agrégats — pas un registre d'attributaires.
 *    Le contrôle reste visuel : relire les PNG produits avant de commiter.
 * 3. Les dashboards chargent après le montage ; sans attente on photographie
 *    des squelettes.
 *
 * ⚠️ Sous Git Bash, préfixer par `MSYS_NO_PATHCONV=1`. Cf. `e2e-shot.mjs`.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const OUT = new URL("../public/screenshots/", import.meta.url);

/** Doit rester synchronisé avec le tableau `screenshots` de `manifest.json`. */
const FORMATS = [
  { nom: "desktop", width: 1400, height: 900 },
  { nom: "mobile", width: 390, height: 844 },
];

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

mkdirSync(OUT, { recursive: true });

// Chromium résout Supabase via DNS-over-HTTPS et échoue ici (« Failed to fetch »).
// Cf. mémoire projet « connectivite_dns_securise_chrome ».
const browser = await chromium.launch({
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});

const erreurs = [];

for (const { nom, width, height } of FORMATS) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (e) => erreurs.push(`${nom}: ${e}`));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector("#email", { timeout: 20000 });
  await page.fill("#email", "manuel.admin@sgfn.ci");
  await page.fill("#password", env.MANUEL_TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 25000 });
  await page.waitForTimeout(9000);

  // La carte du Pilotage charge ses tuiles bien après le reste : sans cette
  // attente le fond de plan reste un rectangle gris au milieu de la capture.
  // Leaflet marque chaque tuile servie d'une classe `leaflet-tile-loaded`.
  const tuiles = page.locator(".leaflet-tile-loaded");
  if (await page.locator(".leaflet-container").count()) {
    await tuiles
      .first()
      .waitFor({ state: "attached", timeout: 20000 })
      .catch(() => console.log(`${nom} : aucune tuile chargée — fond de plan gris`));
    await page.waitForTimeout(2500); // laisser les tuiles voisines arriver
  }

  const chemin = new URL(`${nom}.png`, OUT).pathname.replace(/^\//, "");
  await page.screenshot({ path: chemin });

  const reel = await page.evaluate(() => [window.innerWidth, window.innerHeight]);
  console.log(`${nom.padEnd(8)} → public/screenshots/${nom}.png  (${reel[0]}×${reel[1]})`);

  await page.close();
}

await browser.close();

if (erreurs.length) {
  console.log(`\n⚠️  erreurs page :\n   ${erreurs.join("\n   ")}`);
  process.exit(1);
}
console.log("\nRelire les deux PNG avant commit : ils seront servis publiquement.");
