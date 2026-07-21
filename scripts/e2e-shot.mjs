/**
 * Contrôle visuel d'un écran : capture clair / sombre / mobile, plus les deux
 * défauts qu'on ne voit pas sur une capture — erreurs console et débordement
 * horizontal.
 *
 * Outillage de la refonte design (handoff du 18/07) : chaque écran migré passe
 * par ici avant commit.
 *
 *   node scripts/e2e-shot.mjs --compte=admin --route=/dashboard --nom=pilotage
 *   node scripts/e2e-shot.mjs --compte=geometre --route=/dashboard/geometre
 *
 * Par défaut le serveur local ; E2E_BASE pour viser ailleurs. Les captures
 * atterrissent dans .shots/ (non suivi).
 *
 * ⚠️ Sous Git Bash, préfixer par `MSYS_NO_PATHCONV=1` : sinon `/dashboard` est
 * réécrit en chemin Windows avant d'atteindre Node. PowerShell n'a pas ce
 * travers.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    // Découpe sur le PREMIER « = » seulement : une route peut porter un
    // paramètre (`--route=/dashboard/administration?volet=roles`).
    const bare = a.replace(/^--/, "");
    const i = bare.indexOf("=");
    return i === -1 ? [bare, true] : [bare.slice(0, i), bare.slice(i + 1)];
  }),
);

const compte = args.compte ?? "admin";
const route = args.route ?? "/dashboard";
const nom = args.nom ?? compte;
const BASE = process.env.E2E_BASE || "http://localhost:3000";
const OUT = new URL("../.shots/", import.meta.url);

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
const chemin = (suffixe) => new URL(`${nom}-${suffixe}.png`, OUT).pathname.replace(/^\//, "");

// Chromium résout Supabase via DNS-over-HTTPS et échoue ici (« Failed to fetch »)
// alors que Node, qui passe par le résolveur de l'OS, joint le même hôte. Ce
// n'est pas un défaut de l'application — sans ces drapeaux, l'écran se
// photographie vide. Cf. mémoire projet « connectivite_dns_securise_chrome ».
const browser = await chromium.launch({
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

const erreurs = [];
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(m.text());
});
page.on("pageerror", (e) => erreurs.push(String(e)));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForSelector("#email", { timeout: 20000 });
await page.fill("#email", `manuel.${compte}@sgfn.ci`);
await page.fill("#password", env.MANUEL_TEST_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard**", { timeout: 25000 });

if (route !== "/dashboard") await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
// Les dashboards chargent leurs données après le montage : sans cette attente
// on photographie des squelettes.
await page.waitForTimeout(9000);

await page.screenshot({ path: chemin("clair"), fullPage: true });

const toggle = page.locator('header button[aria-label*="ombre" i], header button[aria-label*="thème" i]').first();
if (await toggle.count()) {
  await toggle.click();
  await page.waitForTimeout(500);
  const sombre = page.getByRole("menuitem", { name: "Sombre" });
  if (await sombre.count()) await sombre.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: chemin("sombre"), fullPage: true });
} else {
  console.log("(pas de bascule de thème sur cet écran — capture sombre ignorée)");
}

await page.setViewportSize({ width: 390, height: 900 });
await page.waitForTimeout(1200);
await page.screenshot({ path: chemin("mobile"), fullPage: true });

const debordement = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);

console.log(`écran        : ${nom} (${route}, compte manuel.${compte})`);
console.log(`captures     : .shots/${nom}-{clair,sombre,mobile}.png`);
console.log(`débordement  : ${debordement} px${debordement > 0 ? "  ⚠️ le body défile latéralement" : ""}`);
console.log(`console      : ${erreurs.length ? erreurs.slice(0, 8).join("\n               ") : "aucune erreur"}`);

await browser.close();
process.exit(debordement > 0 || erreurs.length > 0 ? 1 : 0);
