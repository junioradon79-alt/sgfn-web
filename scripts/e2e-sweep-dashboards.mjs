import { readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

// Balayage santé de TOUS les home dashboards par rôle. Pour chaque compte :
// login (avec retry, login CSR prod flaky) -> laisse le redirect de rôle opérer
// -> capture REST non-2xx, erreurs console, URL finale, extrait de contenu.
// Cible la prod par défaut ; E2E_BASE=http://localhost:3000 pour le local.

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const PWD = env.MANUEL_TEST_PASSWORD;
const BASE = process.env.E2E_BASE || "https://sgfn.ci";
const SHOT_DIR = join(tmpdir(), "sgnf-e2e-sweep");
mkdirSync(SHOT_DIR, { recursive: true });

const ACCOUNTS = [
  { email: "manuel.admin@sgfn.ci",              role: "admin",            attendu: "/dashboard" },
  { email: "manuel.chefferie@sgfn.ci",          role: "chefferie",        attendu: "/dashboard/chefferie" },
  { email: "manuel.proprietaire-terrien@sgfn.ci", role: "pt (famille)",   attendu: "/dashboard/proprietaire-terrien" },
  { email: "manuel.proprietaire@sgfn.ci",       role: "pt (attributaire)",attendu: "/dashboard/proprietaire-terrien" },
  { email: "manuel.operateur@sgfn.ci",          role: "operateur (849)",  attendu: "/dashboard/operateur" },
  { email: "manuel.amenageur@sgfn.ci",          role: "operateur (49)",   attendu: "/dashboard/operateur" },
  { email: "manuel.operateur-saisie@sgfn.ci",   role: "operateur_saisie", attendu: "/dashboard/saisie" },
  { email: "manuel.acquereur@sgfn.ci",          role: "acquereur",        attendu: "/dashboard/mon-achat" },
  { email: "manuel.verificateur@sgfn.ci",       role: "verificateur",     attendu: "/dashboard/commissaire" },
  { email: "manuel.geometre@sgfn.ci",           role: "geometre",         attendu: "/dashboard/geometre" },
  { email: "manuel.commissaire@sgfn.ci",        role: "commissaire (vide)", attendu: "/dashboard/commissaire" },
];

const browser = await chromium.launch();

async function loginOnce(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector("#email", { timeout: 20000 });
  await page.waitForTimeout(800); // hydratation
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

const results = [];
for (const acc of ACCOUNTS) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const restErrors = [];
  const consoleErrors = [];
  page.on("response", async (resp) => {
    const u = resp.url();
    if (u.includes("/rest/v1/") && resp.status() >= 400) {
      let body = ""; try { body = (await resp.text()).slice(0, 120); } catch {}
      restErrors.push({ status: resp.status(), url: u.split("/rest/v1/")[1]?.slice(0, 60), body });
    }
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e.message).slice(0, 160)));
  const r = { role: acc.role, email: acc.email };
  try {
    const ok = await login(page, acc.email);
    if (!ok) { r.status = "LOGIN_FAIL"; results.push(r); await page.close(); continue; }
    await page.waitForTimeout(7000); // redirect de rôle + chargement des données
    r.url = page.url().replace(BASE, "");
    r.attenduOk = r.url.startsWith(acc.attendu);
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    r.bodyLen = body.length;
    r.extrait = body.slice(0, 260);
    r.restErrors = restErrors;
    r.consoleErrors = consoleErrors;
    r.status = restErrors.length === 0 && consoleErrors.length === 0 ? "OK" : "WARN";
    await page.screenshot({ path: `${SHOT_DIR}/${acc.email.split("@")[0]}.png`, fullPage: true });
  } catch (err) {
    r.status = "ERROR"; r.error = String(err.message ?? err).slice(0, 160);
  }
  results.push(r);
  await page.close();
}

await browser.close();
console.log("\n=== BALAYAGE HOME DASHBOARDS (" + BASE + ") ===");
for (const r of results) {
  const flag = r.status === "OK" ? "✓" : r.status === "WARN" ? "⚠" : "✗";
  console.log(`\n${flag} [${r.status}] ${r.role} — ${r.email}`);
  if (r.url !== undefined) console.log(`   url=${r.url} attenduOk=${r.attenduOk} bodyLen=${r.bodyLen}`);
  if (r.restErrors?.length) console.log(`   REST 4xx/5xx: ${JSON.stringify(r.restErrors)}`);
  if (r.consoleErrors?.length) console.log(`   console: ${JSON.stringify(r.consoleErrors)}`);
  if (r.error) console.log(`   error=${r.error}`);
  if (r.extrait) console.log(`   « ${r.extrait} »`);
}
console.log(`\nCaptures : ${SHOT_DIR}`);
process.exit(0);
