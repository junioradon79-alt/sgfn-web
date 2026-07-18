import { readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

// Balayage santé des PAGES DE MENU internes par rôle (au-delà des home).
// Pour chaque rôle : login (retry) une fois, puis visite chaque page de son menu
// (source : src/lib/navigation.ts) en capturant REST 4xx/5xx, erreurs console,
// rendu. Cible la prod par défaut ; E2E_BASE=http://localhost:3000 en local.

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const PWD = env.MANUEL_TEST_PASSWORD;
const BASE = process.env.E2E_BASE || "https://sgfn.ci";
const SHOT_DIR = join(tmpdir(), "sgnf-e2e-menus");
mkdirSync(SHOT_DIR, { recursive: true });

// Pages de menu par rôle (home exclus, déjà couverts). /messages omis (trivial).
const MENUS = {
  "manuel.admin@sgfn.ci": [
    "/dashboard/carte", "/dashboard/attributaires", "/dashboard/familles",
    "/dashboard/dossiers-adu", "/dashboard/geometres", "/dashboard/demandes-acquisition",
    "/dashboard/litiges", "/dashboard/concertation", "/dashboard/contacts-marketplace",
    "/dashboard/consultations-qr", "/dashboard/documents", "/dashboard/paiements",
  ],
  "manuel.chefferie@sgfn.ci": [
    "/lotissements", "/dashboard/litiges", "/dashboard/dossiers-adu",
    "/dashboard/documents", "/dashboard/concertation",
  ],
  "manuel.verificateur@sgfn.ci": [
    "/dashboard/carte", "/dashboard/attributaires", "/lotissements",
    "/dashboard/ia", "/dashboard/litiges", "/dashboard/dossiers-adu", "/dashboard/documents",
  ],
  "manuel.operateur@sgfn.ci": [
    "/lotissements", "/dashboard/attributaires", "/dashboard/demandes-acquisition",
    "/dashboard/concertation", "/dashboard/invitations", "/dashboard/documents",
  ],
  "manuel.proprietaire-terrien@sgfn.ci": [
    "/dashboard/mettre-en-vente", "/dashboard/litiges", "/dashboard/concertation", "/dashboard/documents",
  ],
  "manuel.geometre@sgfn.ci": [
    "/dashboard/missions", "/dashboard/demarches", "/dashboard/dossiers-adu",
    "/dashboard/carte", "/dashboard/documents", "/dashboard/ia",
  ],
  "manuel.acquereur@sgfn.ci": ["/dashboard/documents"],
};

const browser = await chromium.launch();

async function loginOnce(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector("#email", { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.fill("#email", email);
  await page.fill("#password", PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 25000 });
}
async function login(page, email) {
  for (let i = 1; i <= 3; i++) {
    try { await loginOnce(page, email); return true; }
    catch { if (i === 3) return false; await page.waitForTimeout(1500); }
  }
  return false;
}

const rows = [];
for (const [email, pages] of Object.entries(MENUS)) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const restErrors = [];
  const consoleErrors = [];
  page.on("response", async (resp) => {
    const u = resp.url();
    if (u.includes("/rest/v1/") && resp.status() >= 400) {
      let body = ""; try { body = (await resp.text()).slice(0, 100); } catch {}
      restErrors.push({ status: resp.status(), t: u.split("/rest/v1/")[1]?.split(/[?&]/)[0], body });
    }
    if (u.includes("/rest/v1/rpc/") && resp.status() >= 400) {
      restErrors.push({ status: resp.status(), rpc: u.split("/rpc/")[1]?.split(/[?&]/)[0] });
    }
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e.message).slice(0, 140)));

  const ok = await login(page, email);
  if (!ok) { rows.push({ email, page: "(login)", status: "LOGIN_FAIL" }); await page.close(); continue; }

  for (const path of pages) {
    restErrors.length = 0; consoleErrors.length = 0;
    let rec = { email: email.split("@")[0], page: path };
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(4500);
      const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
      rec.finalUrl = page.url().replace(BASE, "");
      rec.bodyLen = body.length;
      rec.rest = restErrors.slice();
      rec.console = consoleErrors.slice();
      rec.status = restErrors.length || consoleErrors.length ? "WARN" : "OK";
      if (rec.status === "WARN") {
        await page.screenshot({ path: `${SHOT_DIR}/${email.split("@")[0]}${path.replace(/\//g, "_")}.png`, fullPage: true });
      }
    } catch (err) {
      rec.status = "ERROR"; rec.error = String(err.message ?? err).slice(0, 140);
    }
    rows.push(rec);
  }
  await page.close();
}

await browser.close();
console.log("\n=== BALAYAGE PAGES DE MENU (" + BASE + ") ===");
let okN = 0, warnN = 0, errN = 0;
for (const r of rows) {
  if (r.status === "OK") { okN++; continue; } // n'imprime que les problèmes
  if (r.status === "WARN") warnN++; else errN++;
  console.log(`\n${r.status === "WARN" ? "⚠" : "✗"} [${r.status}] ${r.email} ${r.page} -> ${r.finalUrl ?? ""} (len=${r.bodyLen ?? "?"})`);
  if (r.rest?.length) console.log(`   REST: ${JSON.stringify(r.rest)}`);
  if (r.console?.length) console.log(`   console: ${JSON.stringify(r.console)}`);
  if (r.error) console.log(`   error: ${r.error}`);
}
console.log(`\n--- Résumé : ${okN} OK, ${warnN} WARN, ${errN} ERROR sur ${rows.length} pages ---`);
console.log(`Captures (problèmes) : ${SHOT_DIR}`);
process.exit(0);
