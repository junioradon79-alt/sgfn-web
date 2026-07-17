import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const env = Object.fromEntries(
  readFileSync("C:/Dev/sgfn-web/.env.local", "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const BASE = "http://localhost:3001";
const SHOT_DIR = "C:/Users/DELL/AppData/Local/Temp/claude/c--Dev-sgfn-web/d59b41a7-c8cf-4338-a025-47c80c29d1ed/scratchpad/shots";
mkdirSync(SHOT_DIR, { recursive: true });

const CASES = [
  // Le cas NOUVEAU : propriétaire de 1er niveau sans famille (12 lots, 2 vendables).
  { email: "client.test@sgfn.ci", pwd: env.MANUEL_TEST_PASSWORD, tag: "pt-sans-famille" },
  // Le cas historique : chef de famille (famille Ako Djebe, APFC, sans lot propre).
  { email: "manuel.proprietaire-terrien@sgfn.ci", pwd: env.MANUEL_TEST_PASSWORD, tag: "pt-chef-famille" },
];

const browser = await chromium.launch();
const results = [];

for (const c of CASES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const erreurs = [];
  page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text().slice(0, 160)); });
  const r = { tag: c.tag, email: c.email };
  try {
    // networkidle n'arrive jamais avec le HMR du serveur dev.
    await page.goto(`${BASE}/login/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#email", { timeout: 30000 });
    await page.fill("#email", c.email);
    await page.fill("#password", c.pwd);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL("**/dashboard**", { timeout: 25000 });
    } catch {
      r.loginBody = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim().slice(0, 300);
      throw new Error(`login bloqué : ${r.loginBody}`);
    }
    await page.waitForTimeout(4000);
    r.url = page.url();

    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    r.provisioning = /Compte en cours de provisionnement/i.test(body);
    r.entete = body.slice(0, 120);

    r.apfcVisible = /Attestation de Propriété Foncière Coutumière/i.test(body);
    r.pvVisible = /PV de réunion de famille/i.test(body);

    // Boutons de vente des LIGNES de lot (#lots), pas le lien de la barre latérale.
    const boutonsLot = page.locator('#lots a[href*="mettre-en-vente"]');
    r.groupes = await page.locator('#lots button[aria-expanded]').count();
    r.boutonsVenteAvant = await boutonsLot.count();

    // Déplier le premier groupe
    const g1 = page.locator('#lots button[aria-expanded]').first();
    if (await g1.count()) {
      r.groupeLabel = (await g1.innerText()).replace(/\s+/g, " ").trim();
      if ((await g1.getAttribute("aria-expanded")) === "false") await g1.click();
      await page.waitForTimeout(800);
    }
    r.boutonsVenteApres = await boutonsLot.count();
    r.nonVendables = await page.getByTitle(/Attestation ou certificat|Lot du collectif|en litige|déjà vendu/).count();
    await page.screenshot({ path: `${SHOT_DIR}/${c.tag}.png`, fullPage: false });

    // Suivre un bouton « Mettre en vente » -> le formulaire doit s'ouvrir sur CE lot
    const btn = boutonsLot.first();
    if (await btn.count()) {
      const href = await btn.getAttribute("href");
      r.lotCible = href?.match(/lot=([0-9a-f-]+)/)?.[1] ?? null;
      await btn.click();
      await page.waitForURL("**/mettre-en-vente**", { timeout: 20000 });
      await page.waitForTimeout(4000);
      r.venteUrl = page.url();
      const select = page.locator("select").first();
      r.selectValue = await select.inputValue().catch(() => null);
      r.preselectionOk = !!r.lotCible && r.selectValue === r.lotCible;
      r.titrePrerempli = await page.locator('input[placeholder*="Lot résidentiel"]').inputValue().catch(() => null);
      const vbody = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
      r.eligibiliteAffichee = /éligible/i.test(vbody);
      await page.screenshot({ path: `${SHOT_DIR}/${c.tag}-vente.png`, fullPage: false });
    }
    r.consoleErrors = erreurs.slice(0, 3);
    r.status = "ok";
  } catch (err) {
    r.status = "ERREUR";
    r.error = String(err.message ?? err).slice(0, 300);
    try { await page.screenshot({ path: `${SHOT_DIR}/${c.tag}-FAIL.png`, fullPage: false }); } catch {}
  } finally {
    await page.close();
  }
  results.push(r);
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
process.exit(0);
