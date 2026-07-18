import { readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

// Vérifie les fixes LOT 2 : LotissementDetail (Brignan, .in géant → jointure) et
// saisie (Brignan, embed lourd → à plat). E2E_BASE=http://localhost:3000 = local.

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const PWD = env.MANUEL_TEST_PASSWORD;
const BASE = process.env.E2E_BASE || "https://sgfn.ci";
const BRIGNAN = "8820c6b8-8ced-468f-bbcc-b63542d79621";
const SHOT_DIR = join(tmpdir(), "sgnf-e2e-saisie-lotdetail");
mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch();

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#email", { timeout: 30000 });
  await page.fill("#email", email);
  await page.fill("#password", PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 40000 });
}

const results = [];

// ── 1. LotissementDetail (Brignan) ──
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const r = { tag: "lotissement-detail-brignan", rest: {}, consoleErrors: [] };
  page.on("response", async (resp) => {
    const u = resp.url();
    for (const t of ["lots", "attributions"]) {
      if (u.includes(`/rest/v1/${t}?`) && !u.includes(`${t}_`)) {
        const acc = (r.rest[t] ??= { calls: 0, rows: 0, statuses: [] });
        acc.calls += 1; acc.statuses.push(resp.status());
        if (resp.ok()) { try { acc.rows += JSON.parse(await resp.text()).length; } catch {} }
      }
    }
  });
  page.on("pageerror", (e) => r.consoleErrors.push(String(e.message).slice(0, 200)));
  try {
    await login(page, "manuel.verificateur@sgfn.ci");
    await page.goto(`${BASE}/lotissements/${BRIGNAN}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(8000);
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    r.url = page.url();
    r.tableRows = await page.locator("table tbody tr").count();
    // Un nom d'attributaire connu de Brignan doit apparaître (preuve : .in() ne casse plus)
    r.aAttributaire = /ASSANDE ACHI THOMAS|MOUSSO|KONE MORIFERE/i.test(body);
    await page.screenshot({ path: `${SHOT_DIR}/lotissement-brignan.png`, fullPage: true });
    r.status = "ok";
  } catch (err) { r.status = "error"; r.error = String(err.message ?? err); }
  await page.close();
  results.push(r);
}

// ── 2. Saisie (sélection Brignan) ──
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const r = { tag: "saisie-brignan", rest: {}, consoleErrors: [] };
  page.on("response", async (resp) => {
    const u = resp.url();
    for (const t of ["lots", "attributions"]) {
      if (u.includes(`/rest/v1/${t}?`) && !u.includes(`${t}_`)) {
        const acc = (r.rest[t] ??= { calls: 0, rows: 0, statuses: [] });
        acc.calls += 1; acc.statuses.push(resp.status());
        if (resp.ok()) { try { acc.rows += JSON.parse(await resp.text()).length; } catch {} }
      }
    }
  });
  page.on("pageerror", (e) => r.consoleErrors.push(String(e.message).slice(0, 200)));
  try {
    await login(page, "manuel.operateur-saisie@sgfn.ci");
    await page.goto(`${BASE}/dashboard/saisie`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);
    // Sélectionner Brignan : tente un <select>, sinon un élément cliquable contenant le nom.
    let selected = false;
    const sel = page.locator("select").first();
    if (await sel.count()) {
      try { await sel.selectOption({ label: /Brignan/i }); selected = true; } catch {}
      if (!selected) { try { await sel.selectOption({ value: BRIGNAN }); selected = true; } catch {} }
    }
    if (!selected) {
      const opt = page.getByText(/Brignan Kakodji/i).first();
      if (await opt.count()) { await opt.click(); selected = true; }
    }
    r.selected = selected;
    await page.waitForTimeout(7000);
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    r.url = page.url();
    r.tableRows = await page.locator("table tbody tr").count();
    r.bodyHasLot = /Lot\s*\d/.test(body);
    await page.screenshot({ path: `${SHOT_DIR}/saisie-brignan.png`, fullPage: true });
    r.status = "ok";
  } catch (err) { r.status = "error"; r.error = String(err.message ?? err); }
  await page.close();
  results.push(r);
}

await browser.close();
console.log("\n=== AUDIT LOT 2 : LotissementDetail + Saisie ===");
console.log(JSON.stringify(results, null, 2));
console.log(`\nCaptures : ${SHOT_DIR}`);
process.exit(0);
