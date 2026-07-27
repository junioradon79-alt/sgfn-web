// Vérification navigateur de l'app mobile /app (viewport téléphone).
// Parcours : Landing → Signup (étape code) → Login réel (propriétaire terrien)
// → Accueil / Parcelles / Détail / Messages / Profil → thème sombre.
// Local par défaut (l'app /app n'est pas déployée) : E2E_BASE=http://localhost:3000.
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
// ⚠️ `manuel.proprietaire@sgfn.ci` (12 parcelles) et NON
// `manuel.proprietaire-terrien@sgfn.ci`, qui n'en possède plus aucune : l'étape
// « detail » ouvre une carte de parcelle, et échouait donc depuis que les
// données de ce compte ont changé — un échec sans rapport avec le code testé.
const EMAIL = process.env.E2E_EMAIL || "manuel.proprietaire@sgfn.ci";
const BASE = process.env.E2E_BASE || "http://localhost:3000";
const DIR = join(tmpdir(), "sgnf-app-mobile");
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
const steps = [];
const shot = async (name) => { await page.screenshot({ path: join(DIR, name) }); };
const step = async (name, fn) => {
  try { await fn(); steps.push({ name, ok: true }); }
  catch (e) { steps.push({ name, ok: false, error: String(e.message ?? e).slice(0, 160) }); }
};

await step("landing", async () => {
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByText("Connexion à mon espace").waitFor({ timeout: 60000 });
  await shot("01-landing.png");
});

await step("signup-code", async () => {
  await page.getByText("Créer un compte", { exact: true }).click();
  await page.getByText("Code d'invitation").first().waitFor({ timeout: 15000 });
  await shot("02-signup-code.png");
  await page.getByLabel("Retour").click(); // retour landing
  await page.getByText("Connexion à mon espace").waitFor({ timeout: 15000 });
});

await step("login-screen", async () => {
  await page.getByText("Connexion à mon espace").click();
  await page.locator('input[type="email"]').waitFor({ timeout: 15000 });
  await shot("03-login.png");
});

await step("login-submit", async () => {
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PWD);
  await page.locator('button[type="submit"]').click();
  await page.getByText("Mon patrimoine foncier").waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot("04-home.png");
});

await step("parcels", async () => {
  await page.getByText("Parcelles", { exact: true }).click();
  await page.getByText("Mes parcelles").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  await shot("05-parcels.png");
});

await step("detail", async () => {
  await page.getByText(/^Lot /).first().click();
  await page.getByText("Détail de la parcelle").waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500); // laisser le RPC de score répondre
  await shot("06-detail.png");
  await page.getByLabel("Retour").click();
});

await step("messages", async () => {
  await page.getByText("Messages", { exact: true }).click();
  await page.waitForTimeout(1200);
  await shot("07-messages.png");
});

await step("profile", async () => {
  await page.getByText("Profil", { exact: true }).click();
  await page.getByText("Thème sombre").waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  await shot("08-profile.png");
});

await step("dark", async () => {
  await page.getByLabel("Basculer le thème sombre").click();
  await page.waitForTimeout(700);
  await shot("09-profile-dark.png");
  await page.getByText("Accueil", { exact: true }).click();
  await page.waitForTimeout(1200);
  await shot("10-home-dark.png");
});

await browser.close();
console.log("\n=== E2E APP MOBILE /app ===");
console.log("base:", BASE, "| compte:", EMAIL);
console.log(JSON.stringify(steps, null, 2));
console.log("erreurs page:", errors.length ? errors : "aucune");
console.log("captures:", DIR);
