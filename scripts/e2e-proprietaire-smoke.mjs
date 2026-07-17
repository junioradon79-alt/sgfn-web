import { readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

// Smoke post-dépréciation `proprietaire` : le compte migré (→ proprietaire_terrien)
// atterrit sur l'espace propriétaire terrien et voit ses lots.
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const PWD = env.MANUEL_TEST_PASSWORD;
const BASE = process.env.E2E_BASE || "https://sgfn.ci";
const SHOT_DIR = join(tmpdir(), "sgnf-e2e-proprietaire-dep");
mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const r = { email: "manuel.proprietaire@sgfn.ci", errors: [] };
page.on("pageerror", (e) => r.errors.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#email", { timeout: 30000 });
  await page.fill("#email", r.email);
  await page.fill("#password", PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 40000 });
  await page.waitForTimeout(4500);
  r.url = page.url();
  r.surPT = r.url.includes("/dashboard/proprietaire-terrien");
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
  r.aMesLots = /MES LOTS/i.test(body);
  r.provisioning = /provisionnement/i.test(body);
  r.excerpt = body.slice(0, 180);
  await page.screenshot({ path: `${SHOT_DIR}/proprietaire.png`, fullPage: true });
  r.status = "ok";
} catch (err) {
  r.status = "error"; r.error = String(err.message ?? err);
  try { await page.screenshot({ path: `${SHOT_DIR}/proprietaire-FAIL.png`, fullPage: true }); } catch {}
}
await browser.close();
console.log("\n=== SMOKE EX-PROPRIÉTAIRE (→ propriétaire terrien) ===");
console.log(JSON.stringify(r, null, 2));
console.log(`Capture : ${SHOT_DIR}`);
process.exit(0);
