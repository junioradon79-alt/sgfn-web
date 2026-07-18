import { readFileSync } from "node:fs";
import { chromium } from "playwright";

// Diagnostic ciblé du « login CSR flaky » : rejoue N connexions dans un contexte
// NEUF à chaque fois (aucune session résiduelle) et capture, pour chaque essai, le
// mode exact d'un éventuel échec — statut du POST GoTrue (/auth/v1/token), URL
// finale, apparition de l'alerte d'erreur, requêtes réseau échouées. But : trancher
// « artefact réseau/environnement » vs « bug applicatif de redirection ».
// Cible la prod par défaut ; E2E_BASE=http://localhost:3000 pour le build local.

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const PWD = env.MANUEL_TEST_PASSWORD;
const BASE = process.env.E2E_BASE || "https://sgfn.ci";
const EMAIL = process.env.E2E_EMAIL || "manuel.chefferie@sgfn.ci";
const N = Number(process.env.E2E_N || 8);

const browser = await chromium.launch();
const results = [];

for (let i = 1; i <= N; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const r = { essai: i, authPost: null, authMs: null, redirect: false, url: null, erreurAffichee: false, failed: [] };

  // Capture le POST d'auth GoTrue et sa latence.
  const authStart = {};
  page.on("request", (req) => { if (req.url().includes("/auth/v1/token")) authStart[req.url()] = Date.now(); });
  page.on("response", (resp) => {
    const u = resp.url();
    if (u.includes("/auth/v1/token")) {
      r.authPost = resp.status();
      const s = authStart[u]; if (s) r.authMs = Date.now() - s;
    }
  });
  page.on("requestfailed", (req) => {
    r.failed.push(`${req.failure()?.errorText ?? "?"} ${req.url().slice(0, 80)}`);
  });

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#email", { timeout: 30000 });
    await page.fill("#email", EMAIL);
    await page.fill("#password", PWD);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL("**/dashboard**", { timeout: 20000 });
      r.redirect = true;
    } catch {
      r.redirect = false;
    }
    r.url = page.url();
    // L'alerte d'erreur applicative (mauvais identifiants / échec réseau capté par le code).
    r.erreurAffichee = await page.locator('[role="alert"]').count() > 0;
    if (r.erreurAffichee) r.texteErreur = (await page.locator('[role="alert"]').first().innerText()).slice(0, 120);
  } catch (e) {
    r.exception = String(e.message).slice(0, 160);
  }

  results.push(r);
  await ctx.close();
  process.stdout.write(`essai ${i}: redirect=${r.redirect} authPost=${r.authPost} authMs=${r.authMs} err=${r.erreurAffichee}\n`);
}

await browser.close();

const ok = results.filter((r) => r.redirect).length;
console.log("\n=== DIAG LOGIN FLAKY ===");
console.log(JSON.stringify({ base: BASE, email: EMAIL, essais: N, redirections_ok: ok }, null, 2));
for (const r of results) {
  if (!r.redirect) console.log("ÉCHEC:", JSON.stringify(r));
}
console.log(`\nBilan: ${ok}/${N} redirections réussies.`);
