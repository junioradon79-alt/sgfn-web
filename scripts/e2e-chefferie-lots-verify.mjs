import { readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

// Vérifie que la Chefferie (chef de village, Ebimpe) voit bien ses lots sur
// /dashboard/lots après le correctif « embed à plat » (le gros embed imbriqué
// depuis lots timeoutait à 8 s → 0 lot). Cible la prod par défaut ;
// E2E_BASE=http://localhost:3000 pour tester le build LOCAL (correctif non déployé).

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const PWD = env.MANUEL_TEST_PASSWORD;
const BASE = process.env.E2E_BASE || "https://sgfn.ci";
const SHOT_DIR = join(tmpdir(), "sgnf-e2e-chefferie-lots");
mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const r = { base: BASE, rest: {}, consoleErrors: [] };

// La pagination .range() émet PLUSIEURS requêtes par table : on cumule les
// lignes et on garde le pire statut.
page.on("response", async (resp) => {
  const u = resp.url();
  for (const t of ["lots", "attributions", "attestations_cession"]) {
    if (u.includes(`/rest/v1/${t}?`) && !u.includes(`${t}_`)) {
      const acc = (r.rest[t] ??= { calls: 0, rows: 0, statuses: [] });
      acc.calls += 1;
      acc.statuses.push(resp.status());
      if (resp.ok()) { try { acc.rows += JSON.parse(await resp.text()).length; } catch {} }
      else { try { acc.body = (await resp.text()).slice(0, 200); } catch {} }
    }
  }
});
page.on("pageerror", (e) => r.consoleErrors.push(String(e.message).slice(0, 200)));

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#email", { timeout: 30000 });
  await page.fill("#email", "manuel.chefferie@sgfn.ci");
  await page.fill("#password", PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 40000 });

  await page.goto(`${BASE}/dashboard/lots`, { waitUntil: "domcontentloaded", timeout: 60000 });
  // laisse les 3 requêtes à plat se résoudre + le rendu
  await page.waitForTimeout(9000);

  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
  r.url = page.url();
  r.aucunLot = body.includes("Aucun lot enregistré");
  // Compteur « LOTS AFFICHÉS » : lire le nombre juste après le libellé.
  const m = body.match(/LOTS AFFICH[ÉE]S\s+([\d\s]+)/i);
  r.lotsAffiches = m ? m[1].replace(/\s/g, "") : null;
  // Compte des lignes du tableau (chaque ligne a « Lot <n> »).
  r.tableRows = await page.locator("table tbody tr").count();
  // Lots affichant un attributaire réel vs placeholder (preuve que la pagination
  // des attributions n'a pas tronqué → sinon des lots occupés seraient « Non… »).
  r.lignesSansAttributaire = await page.locator("table tbody tr", { hasText: /Non visible pour votre rôle|Non attribué/ }).count();
  r.lignesAvecAttributaire = r.tableRows - r.lignesSansAttributaire;
  await page.screenshot({ path: `${SHOT_DIR}/chefferie-lots.png`, fullPage: true });
  r.status = "ok";
} catch (err) {
  r.status = "error"; r.error = String(err.message ?? err);
  try { await page.screenshot({ path: `${SHOT_DIR}/chefferie-lots-FAIL.png`, fullPage: true }); } catch {}
}

await browser.close();
console.log("\n=== VÉRIF CHEFFERIE /dashboard/lots ===");
console.log(JSON.stringify(r, null, 2));
console.log(`\nCaptures : ${SHOT_DIR}`);
process.exit(0);
