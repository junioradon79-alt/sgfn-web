import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const BASE = "http://localhost:3000";
const SHOT = "C:/Users/DELL/AppData/Local/Temp/claude/c--Dev-sgfn-web/d59b41a7-c8cf-4338-a025-47c80c29d1ed/scratchpad/shots";
const REF = "ATT-CESS-2026-00319"; // attestation délivrée, lot sans annonce active
const NEW_EMAIL = `lead.${Date.now()}@sgfn.ci`; // sgfn.ci : domaine accepté par GoTrue (example.com rejeté)
const NEW_PWD = "Acquereur#Test2026";

const browser = await chromium.launch();
const out = {};
// Géolocalisation accordée : sinon getCurrentPosition ne rend jamais la main en
// headless et la vérification reste bloquée sur « loading ».
const ctxOpts = { viewport: { width: 1280, height: 1400 }, permissions: ["geolocation"], geolocation: { latitude: 5.35, longitude: -4.02 } };

// ── 1) Non connecté : l'invite s'affiche sur /verifier ──
{
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 140)); });
  await page.goto(`${BASE}/verifier/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("input", { timeout: 15000 });
  await page.locator("input").first().fill(REF);
  await page.getByRole("button", { name: /Vérifier/ }).click();
  // La 1re compilation de /verifier en dev peut dépasser 15 s → on attend le verdict.
  await page.getByText(/Document authentique|Document trouvé|consultation du verdict/i)
    .first().waitFor({ timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(2500); // laisse l'invite résoudre annonce_active
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  out.verdict_affiche = /Document authentique|Document trouvé|consultation du verdict/i.test(body);
  out.invite_visible = /Créer mon compte pour être prévenu|contacter le vendeur/i.test(body);
  out.antiphishing_visible = /ne vous demandera jamais d.argent ni vos papiers/i.test(body);
  await page.screenshot({ path: `${SHOT}/captage-1-verifier.png` });

  // ── 2) Clic CTA → /inscription?public=1&suivi=REF ──
  const cta = page.getByRole("link", { name: /Créer mon compte/ }).first();
  out.cta_present = (await cta.count()) > 0;
  if (out.cta_present) {
    await cta.click();
    await page.waitForURL("**/inscription**", { timeout: 15000 });
    await page.waitForTimeout(1500);
    out.inscription_url = page.url();
    out.suivi_dans_url = page.url().includes(`suivi=${REF}`);
    out.champ_email = await page.locator("#email").count();
    out.case_consentement = await page.locator('input[type="checkbox"]').count();
    out.pas_de_code = (await page.locator("#code").count()) === 0;
    await page.screenshot({ path: `${SHOT}/captage-2-inscription.png` });

    // ── 3) Remplir et créer le compte ──
    await page.fill("#nom", "Lead Test Acquéreur");
    await page.fill("#email", NEW_EMAIL);
    await page.fill("#password", NEW_PWD);
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /Créer mon compte/ }).click();
    await page.waitForTimeout(7000);
    out.apres_signup_url = page.url();
    const b2 = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    out.a_session = page.url().includes("/dashboard");
    out.ecran_confirmation = /lien de confirmation a été envoyé/i.test(b2);
    if (out.a_session) {
      await page.waitForTimeout(2000);
      const b3 = (await page.locator("body").innerText()).replace(/\s+/g, " ");
      out.dashboard_suivi_visible = /Mes terrains suivis/i.test(b3);
      out.parcelle_suivie_presente = /Pas encore en vente|En vente/i.test(b3);
    }
    await page.screenshot({ path: `${SHOT}/captage-3-dashboard.png` });
  }
  out.console_errors = errs.slice(0, 4);
  await page.close();
}

// ── 4) Connecté : l'invite NE s'affiche PAS ──
try {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#email");
  await page.waitForTimeout(1500);
  await page.fill("#email", "manuel.acquereur@sgfn.ci");
  await page.fill("#password", env.MANUEL_TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 25000 });
  await page.goto(`${BASE}/verifier/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("input", { timeout: 15000 });
  await page.locator("input").first().fill(REF);
  await page.getByRole("button", { name: /Vérifier/ }).click();
  await page.getByText(/Document authentique|Document trouvé/i).first().waitFor({ timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  out.connecte_verdict = /Document authentique|Document trouvé/i.test(body);
  out.connecte_invite_absente = !/Créer mon compte pour être prévenu|contacter le vendeur/i.test(body);
  await page.close();
} catch (e) {
  out.connecte_test_erreur = String(e.message ?? e).slice(0, 160);
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
process.exit(0);
