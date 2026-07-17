import { readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

// Smoke test post-fusion aménageur→opérateur : un ex-aménageur (désormais
// opérateur, câblé à une étude) se connecte et atterrit sur l'espace opérateur.
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const PWD = env.MANUEL_TEST_PASSWORD;
const BASE = process.env.E2E_BASE || "https://sgfn.ci";
const SHOT_DIR = join(tmpdir(), "sgnf-e2e-operateur");
mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch();
const results = [];
for (const email of ["manuel.operateur@sgfn.ci", "manuel.amenageur@sgfn.ci"]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const r = { email, errors: [] };
  page.on("pageerror", (e) => r.errors.push(String(e.message).slice(0, 160)));
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#email", { timeout: 30000 });
    await page.fill("#email", email);
    await page.fill("#password", PWD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 40000 });
    await page.waitForTimeout(4000);
    r.url = page.url();
    r.surOperateur = r.url.includes("/dashboard/operateur");
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    r.textLen = body.length;
    r.excerpt = body.slice(0, 160);
    await page.screenshot({ path: `${SHOT_DIR}/${email.split("@")[0]}.png`, fullPage: true });
    r.status = "ok";
  } catch (err) {
    r.status = "error"; r.error = String(err.message ?? err);
    try { await page.screenshot({ path: `${SHOT_DIR}/${email.split("@")[0]}-FAIL.png`, fullPage: true }); } catch {}
  }
  await page.close();
  results.push(r);
}
await browser.close();
console.log("\n=== SMOKE OPÉRATEUR (post-fusion) ===");
console.log(JSON.stringify(results, null, 2));
console.log(`Captures : ${SHOT_DIR}`);
process.exit(0);
