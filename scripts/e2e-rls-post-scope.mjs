// Vérifie qu'après le scoping RLS des rôles grand public :
//  1. le dossier foncier (LotDetailModal) d'un propriétaire affiche toujours la
//     chaîne de propriété (attributions + noms d'attributaires en imbriqué) ;
//  2. un rôle métier (géomètre) n'a rien perdu.
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const BASE = "http://localhost:3001";
const SHOT = "C:/Users/DELL/AppData/Local/Temp/claude/c--Dev-sgfn-web/d59b41a7-c8cf-4338-a025-47c80c29d1ed/scratchpad/shots";
const browser = await chromium.launch();

async function login(page, email) {
  await page.goto(`${BASE}/login/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#email");
  await page.waitForTimeout(2000);
  await page.fill("#email", email);
  await page.fill("#password", env.MANUEL_TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 30000 });
  await page.waitForTimeout(4000);
}

// ── 1. Dossier foncier d'un propriétaire terrien ──
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 150)); });
  await login(page, "client.test@sgfn.ci");
  // Ne déplier que si replié — un groupe unique s'ouvre déjà tout seul.
  const g = page.locator('#lots button[aria-expanded]').first();
  if ((await g.getAttribute("aria-expanded")) === "false") {
    await g.click();
    await page.waitForTimeout(600);
  }
  // 1re ligne de lot -> ouvre le dossier
  await page.locator('#lots button[title="Voir le dossier foncier du lot"]').first().click();
  await page.waitForTimeout(3500);
  const modal = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("── Dossier foncier (proprietaire_terrien) ──");
  console.log("  modal ouvert      :", /Dossier foncier/i.test(modal));
  console.log("  chaîne de propriété:", /Propriétaire d.origine|Ayant-droit|Acquéreur|Opérateur/i.test(modal));
  console.log("  nom d'attributaire :", /AKE AMAFIN NICODEME/i.test(modal));
  console.log("  score de confiance :", /score|confiance/i.test(modal));
  console.log("  erreurs console    :", errs.length ? errs : "aucune");
  await page.screenshot({ path: `${SHOT}/dossier-foncier-post-rls.png` });
  await page.close();
}

// ── 2. Rôle métier : géomètre ──
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 150)); });
  await login(page, "manuel.geometre@sgfn.ci");
  console.log("\n── Rôle métier : géomètre ──");
  console.log("  atterrissage :", page.url().replace(BASE, ""));
  await page.goto(`${BASE}/dashboard/lots/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log("  /dashboard/lots vide ? :", /Aucun lot|aucun r.sultat/i.test(body));
  console.log("  extrait :", body.slice(200, 420));
  console.log("  erreurs console :", errs.length ? errs.slice(0, 2) : "aucune");
  await page.screenshot({ path: `${SHOT}/geometre-lots-post-rls.png` });
  await page.close();
}

await browser.close();
process.exit(0);
