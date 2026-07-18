import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const PWD = env.MANUEL_TEST_PASSWORD;
const BASE = process.env.E2E_BASE || "https://sgfn.ci";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

async function login() {
  for (let i = 1; i <= 3; i++) {
    try {
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForSelector("#email", { timeout: 20000 });
      await page.waitForTimeout(800);
      await page.fill("#email", "manuel.admin@sgfn.ci");
      await page.fill("#password", PWD);
      await page.click('button[type="submit"]');
      await page.waitForURL("**/dashboard**", { timeout: 25000 });
      return true;
    } catch { await page.waitForTimeout(1500); }
  }
  return false;
}

await login();
await page.waitForTimeout(9000); // useAdminOverview
// Extraire la zone KPI (section aria-label="Indicateurs clés")
let kpi = "";
try { kpi = (await page.locator('section[aria-label="Indicateurs clés"]').innerText()).replace(/\s+/g, " ").trim(); } catch {}
const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
console.log("=== KPI ROW (admin) ===");
console.log(kpi || "(section KPI non trouvée)");
console.log("\n=== extrait body (alertes/files) ===");
console.log(body.slice(0, 1200));
await browser.close();
process.exit(0);
