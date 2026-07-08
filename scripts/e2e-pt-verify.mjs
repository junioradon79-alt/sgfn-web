import { readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const PWD = env.MANUEL_TEST_PASSWORD;
const BASE = "https://sgfn.ci";
const SHOT_DIR = join(tmpdir(), "sgnf-e2e-proprietaire-terrien");
mkdirSync(SHOT_DIR, { recursive: true });

const CASES = [
  { email: "manuel.proprietaire-terrien@sgfn.ci", expect: "/dashboard/proprietaire-terrien", tag: "proprietaire-terrien" },
  { email: "manuel.chefferie@sgfn.ci", expect: "/dashboard/chefferie", tag: "chefferie-famille" },
  { email: "manuel.chefvillage@sgfn.ci", expect: "/dashboard/chefferie", tag: "chefferie-village" },
];

const browser = await chromium.launch();
const results = [];

for (const c of CASES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const r = { email: c.email, tag: c.tag, expect: c.expect };
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill("#email", c.email);
    await page.fill("#password", PWD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 20000 });
    // laisse le composant client faire la redirection ROLE_HOME
    try { await page.waitForURL(`**${c.expect}**`, { timeout: 8000 }); } catch {}
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500); // laisse charger les données (lots, PV…)
    r.url = page.url();
    r.landedOk = r.url.includes(c.expect);
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    r.provisioning = /Compte en cours de provisionnement|n.est pas encore rattach/i.test(body);
    r.textLen = body.length;
    r.excerpt = body.slice(0, 220);
    const shot = `${SHOT_DIR}/e2e-${c.tag}.png`;
    await page.screenshot({ path: shot, fullPage: true });
    r.screenshot = shot;
    r.status = "ok";
    console.log(`[OK] ${c.email} -> ${r.url} | landedOk=${r.landedOk} | provisioning=${r.provisioning}`);
  } catch (err) {
    r.status = "error";
    r.error = String(err.message ?? err);
    try { const shot = `${SHOT_DIR}/e2e-${c.tag}-FAIL.png`; await page.screenshot({ path: shot, fullPage: true }); r.screenshot = shot; } catch {}
    console.error(`[ERREUR] ${c.email}:`, r.error);
  } finally {
    await page.close();
  }
  results.push(r);
}

await browser.close();
console.log("\n=== RÉSUMÉ ===");
for (const r of results) {
  console.log(`\n• ${r.tag} (${r.email})`);
  console.log(`  status=${r.status} url=${r.url ?? "—"} landedOk=${r.landedOk ?? "—"} provisioning=${r.provisioning ?? "—"}`);
  if (r.excerpt) console.log(`  extrait: ${r.excerpt}`);
  if (r.screenshot) console.log(`  capture: ${r.screenshot}`);
  if (r.error) console.log(`  erreur: ${r.error}`);
}
process.exit(0);
