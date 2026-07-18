import { readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

// Vérifie 2 corrections « embed lourd → 0 / troncature » :
//  • manuel.operateur (KONE MORIFERE, 849 lots) sur /dashboard/operateur
//  • manuel.verificateur (national, 1352 attributions) sur /dashboard/attributions
// E2E_BASE=http://localhost:3000 pour le build local.

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const PWD = env.MANUEL_TEST_PASSWORD;
const BASE = process.env.E2E_BASE || "https://sgfn.ci";
const SHOT_DIR = join(tmpdir(), "sgnf-e2e-audit-op-attr");
mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch();

async function run(email, path, tables) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const r = { email, path, rest: {}, consoleErrors: [] };
  page.on("response", async (resp) => {
    const u = resp.url();
    for (const t of tables) {
      if (u.includes(`/rest/v1/${t}?`) && !u.includes(`${t}_`)) {
        const acc = (r.rest[t] ??= { calls: 0, rows: 0, statuses: [] });
        acc.calls += 1; acc.statuses.push(resp.status());
        if (resp.ok()) { try { acc.rows += JSON.parse(await resp.text()).length; } catch {} }
      }
    }
  });
  page.on("pageerror", (e) => r.consoleErrors.push(String(e.message).slice(0, 200)));
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#email", { timeout: 30000 });
    await page.fill("#email", email);
    await page.fill("#password", PWD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 40000 });
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(9000);
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    r.url = page.url();
    r.tableRows = await page.locator("table tbody tr").count();
    r.bodySample = body.slice(0, 500);
    await page.screenshot({ path: `${SHOT_DIR}/${email.split("@")[0]}.png`, fullPage: true });
    r.status = "ok";
  } catch (err) {
    r.status = "error"; r.error = String(err.message ?? err);
    try { await page.screenshot({ path: `${SHOT_DIR}/${email.split("@")[0]}-FAIL.png`, fullPage: true }); } catch {}
  }
  await page.close();
  return r;
}

const results = [];
results.push(await run("manuel.operateur@sgfn.ci", "/dashboard/operateur", ["lots", "attributions"]));
results.push(await run("manuel.verificateur@sgfn.ci", "/dashboard/attributions", ["attributions"]));

await browser.close();
console.log("\n=== AUDIT OPÉRATEUR + ATTRIBUTIONS ===");
console.log(JSON.stringify(results, null, 2));
console.log(`\nCaptures : ${SHOT_DIR}`);
process.exit(0);
