/**
 * Contrôle des écrans de création de référentiels ajoutés le 22/07 :
 * chefferies, familles, opérateurs, commissaires de justice.
 *
 *   node scripts/e2e-referentiels.mjs
 *
 * Ce script **ouvre** les modales au lieu de photographier la page qui les
 * contient. La distinction n'est pas théorique : les portails Radix se rendent
 * dans `document.body` et sortaient autrefois du sous-arbre thémé, si bien
 * qu'une modale s'affichait en clair sur une page sombre sans qu'aucune capture
 * d'écran ne le montre (cf. mémoire « portails_radix_hors_sous_arbre_dark »).
 *
 * Il ne crée rien : les formulaires sont ouverts, mesurés, puis annulés.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE || "http://localhost:3100";
const OUT = new URL("../.shots/", import.meta.url);

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

mkdirSync(OUT, { recursive: true });
const chemin = (n) => new URL(`${n}.png`, OUT).pathname.replace(/^\//, "");

const browser = await chromium.launch({
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });

let echecs = 0;
const verdict = (ok, libelle, detail = "") => {
  if (!ok) echecs++;
  console.log(`${ok ? "  ok  " : " ÉCHEC"}  ${libelle}${detail ? ` — ${detail}` : ""}`);
};

await page.goto(`${BASE}/login/`, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForSelector("#email", { timeout: 20000 });
await page.fill("#email", "manuel.admin@sgfn.ci");
await page.fill("#password", env.MANUEL_TEST_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard**", { timeout: 30000 });
await page.waitForTimeout(6000);

/** Le fond de la modale doit suivre le thème : clair sur page claire, sombre sinon. */
async function controlerModale(nom, sombreAttendu) {
  const boite = page.locator('[role="dialog"]').first();
  await boite.waitFor({ state: "visible", timeout: 10000 });

  const { fond, titre } = await boite.evaluate((el) => {
    const parse = (c) => (c.match(/\d+/g) ?? []).slice(0, 3).map(Number);
    let n = el, bg = "rgba(0, 0, 0, 0)";
    while (n && bg === "rgba(0, 0, 0, 0)") { bg = getComputedStyle(n).backgroundColor; n = n.parentElement; }
    const [r, g, b] = parse(bg);
    return { fond: (r + g + b) / 3, titre: el.querySelector("h2, [data-slot=dialog-title]")?.textContent?.trim() ?? "" };
  });

  const estSombre = fond < 128;
  verdict(estSombre === sombreAttendu, `${nom} — fond ${estSombre ? "sombre" : "clair"}`, `« ${titre} », luminance ${Math.round(fond)}`);
  await page.screenshot({ path: chemin(`ref-${nom}-${sombreAttendu ? "sombre" : "clair"}`) });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
}

async function basculerTheme(vers) {
  const bouton = page.locator('header button[aria-label*="thème" i], header button[aria-label*="ombre" i]').first();
  if (!(await bouton.count())) return false;
  await bouton.click();
  await page.waitForTimeout(400);
  const item = page.getByRole("menuitem", { name: vers });
  if (!(await item.count())) { await page.keyboard.press("Escape"); return false; }
  await item.click();
  await page.waitForTimeout(1200);
  return true;
}

for (const sombre of [false, true]) {
  if (sombre) {
    const ok = await basculerTheme("Sombre");
    verdict(ok, "bascule en thème sombre");
    if (!ok) break;
  }

  // ── Chefferies et familles ────────────────────────────────────────────────
  // Les onglets portent les libellés métier : « Grandes familles », « Lignées »,
  // « Autorités coutumières » — pas les noms de tables.
  await page.goto(`${BASE}/dashboard/familles/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);

  for (const [onglet, nom] of [
    [/Grandes familles/i, "grande-famille"],
    [/Lignées/i, "famille"],
    [/Autorités coutumières/i, "chefferie"],
  ]) {
    await page.getByRole("button", { name: onglet }).first().click();
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: "Nouvelle" }).first().click();
    await controlerModale(nom, sombre);
  }

  // ── Référentiels (opérateurs, commissaires) ───────────────────────────────
  await page.goto(`${BASE}/dashboard/administration/?volet=referentiels`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);

  const nouveaux = page.getByRole("button", { name: "Nouveau" });
  verdict((await nouveaux.count()) === 2, "deux boutons « Nouveau » (opérateur, commissaire)", `${await nouveaux.count()} trouvé(s)`);

  await nouveaux.nth(0).click();
  await controlerModale("operateur", sombre);
  await nouveaux.nth(1).click();
  await controlerModale("commissaire", sombre);
}

await browser.close();

const pertinentes = erreurs.filter((e) => !/favicon|manifest|Download the React/i.test(e));
if (pertinentes.length) console.log(`\n⚠️  console :\n   ${pertinentes.slice(0, 6).join("\n   ")}`);
console.log(echecs ? `\n${echecs} contrôle(s) en échec.` : "\nTous les contrôles passent.");
process.exit(echecs ? 1 : 0);
