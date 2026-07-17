import { readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

// Vérifie la refonte DS + le scope de l'espace Commissaire/Vérificateur.
// Cible la prod par défaut ; E2E_BASE=http://localhost:3000 pour le local.
//
//  • manuel.verificateur → vue NATIONALE peuplée (liste, filtres, modal dossier).
//  • manuel.commissaire  → non rattaché → ÉTAT VIDE scopé.

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const PWD = env.MANUEL_TEST_PASSWORD;
const BASE = process.env.E2E_BASE || "https://sgfn.ci";
const SHOT_DIR = join(tmpdir(), "sgnf-e2e-commissaire");
mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch();
const results = [];

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#email", { timeout: 30000 });
  await page.fill("#email", email);
  await page.fill("#password", PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 40000 });
  try { await page.waitForURL("**/dashboard/commissaire**", { timeout: 15000 }); } catch {}
  await page.waitForTimeout(4000); // charge la RPC registre + litiges
}

// ── Cas 1 : vérificateur (national, peuplé) ──────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const r = { tag: "verificateur", restLots: [], consoleErrors: [] };
  page.on("response", async (resp) => {
    if (resp.url().includes("/rest/v1/rpc/registre_supervision")) {
      const e = { status: resp.status() };
      if (!resp.ok()) { try { e.body = (await resp.text()).slice(0, 300); } catch {} }
      else { try { e.rows = JSON.parse(await resp.text()).length; } catch {} }
      r.rpc = e;
    }
  });
  page.on("pageerror", (e) => r.consoleErrors.push(String(e.message).slice(0, 200)));
  try {
    await login(page, "manuel.verificateur@sgfn.ci");
    await page.waitForSelector("#registre", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    r.url = page.url();
    r.hasRegistre = body.includes("Registre des lots");
    r.hasHero = /LOTS SOUS SUPERVISION/i.test(body);
    // Vérificateur = menu national : doit garder Attributaires / Attributions.
    r.menuNationalIntact = body.includes("Attributaires") && body.includes("Attributions");
    await page.screenshot({ path: `${SHOT_DIR}/verificateur-01-overview.png`, fullPage: true });
    const firstLot = page.locator("#registre button").filter({ hasText: /Îlot/ }).first();
    r.hasLotRow = (await firstLot.count()) > 0;
    if (r.hasLotRow) {
      await firstLot.click();
      await page.waitForTimeout(2500);
      const mb = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
      r.modalOpened = mb.includes("Dossier foncier");
      r.modalHasHistory = mb.includes("Historique de propriété");
      await page.screenshot({ path: `${SHOT_DIR}/verificateur-02-dossier.png`, fullPage: true });
    }
    r.status = "ok";
  } catch (err) {
    r.status = "error"; r.error = String(err.message ?? err);
    try { await page.screenshot({ path: `${SHOT_DIR}/verificateur-FAIL.png`, fullPage: true }); } catch {}
  }
  await page.close();
  results.push(r);
}

// ── Cas 2 : commissaire non rattaché (état vide scopé) ───────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const r = { tag: "commissaire" };
  try {
    await login(page, "manuel.commissaire@sgfn.ci");
    await page.waitForTimeout(2000);
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    const sidebar = (await page.locator("nav, aside").allInnerTexts()).join(" ");
    r.url = page.url();
    r.emptyState = body.includes("Aucun lotissement sous votre supervision");
    r.leakeNational = body.includes("Registre foncier national"); // ne doit PAS apparaître
    // Menu resserré : les pages « registre » nationales ne doivent PLUS y être.
    r.menuSansRegistreNational = !/Attributaires|Attributions/.test(sidebar);
    r.menuASupervision = /Supervision/.test(sidebar);
    await page.screenshot({ path: `${SHOT_DIR}/commissaire-empty.png`, fullPage: true });
    r.status = "ok";
  } catch (err) {
    r.status = "error"; r.error = String(err.message ?? err);
    try { await page.screenshot({ path: `${SHOT_DIR}/commissaire-FAIL.png`, fullPage: true }); } catch {}
  }
  await page.close();
  results.push(r);
}

await browser.close();
console.log("\n=== VÉRIFICATION ESPACE COMMISSAIRE / VÉRIFICATEUR ===");
console.log(JSON.stringify(results, null, 2));
console.log(`\nCaptures : ${SHOT_DIR}`);
process.exit(0);
