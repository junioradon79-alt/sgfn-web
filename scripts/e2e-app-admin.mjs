// Vérification navigateur de l'expérience Admin sur /app (viewport téléphone).
// Login manuel.admin → Pilotage (KPIs nationaux) → À faire → Périmètres →
// Messages → Profil (Administration) → thème sombre. + contrôle de non-régression
// citoyen : manuel.proprietaire-terrien retombe sur l'app citoyen.
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
const BASE = process.env.E2E_BASE || "http://localhost:3000";
const DIR = join(tmpdir(), "sgnf-app-admin");
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
const steps = [];
const errors = [];

async function login(page, email) {
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByText("Connexion à mon espace").click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PWD);
  await page.locator('button[type="submit"]').click();
}

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
const step = async (name, fn) => {
  try { await fn(); steps.push({ name, ok: true }); }
  catch (e) { steps.push({ name, ok: false, error: String(e.message ?? e).slice(0, 160) }); }
};
const shot = (n) => page.screenshot({ path: join(DIR, n) });

await step("admin-login-pilotage", async () => {
  await login(page, "manuel.admin@sgfn.ci");
  await page.getByText("Centre National de Pilotage").waitFor({ timeout: 60000 });
  await page.waitForTimeout(3000); // laisser useAdminOverview charger le cockpit
  await shot("01-pilotage.png");
});

await step("admin-files", async () => {
  await page.getByText("À faire", { exact: true }).first().click();
  await page.getByText("Files nationales à traiter").waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await shot("02-files.png");
});

await step("admin-perimetres", async () => {
  await page.getByText("Pilotage", { exact: true }).click();
  await page.getByText("Périmètres").first().click();
  await page.getByText(/triés par volume/).waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await shot("03-perimetres.png");
  await page.getByLabel("Retour").click();
});

await step("admin-messages", async () => {
  await page.getByText("Messages", { exact: true }).click();
  await page.waitForTimeout(1000);
  await shot("04-messages.png");
});

await step("admin-profile-dark", async () => {
  await page.getByText("Profil", { exact: true }).click();
  // `.first()` : le rôle s'affiche deux fois sur cet écran (en-tête + ligne
  // « Rôle » de la fiche) depuis 9021f71, ce qui faisait échouer l'assertion en
  // mode strict — sans que rien ne soit cassé à l'écran.
  await page.getByText("Administration").first().waitFor({ timeout: 15000 });
  await shot("05-profile.png");
  await page.getByLabel("Basculer le thème sombre").click();
  await page.waitForTimeout(600);
  await page.getByText("Pilotage", { exact: true }).click();
  await page.waitForTimeout(1500);
  await shot("06-pilotage-dark.png");
});

await page.close();

// Non-régression citoyen : le propriétaire terrien ne doit PAS voir le cockpit.
const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
page2.on("pageerror", (e) => errors.push("citizen: " + String(e.message).slice(0, 140)));
await step("citizen-non-regression", async () => {
  await login(page2, "manuel.proprietaire-terrien@sgfn.ci");
  await page2.getByText("Mon patrimoine foncier").waitFor({ timeout: 60000 });
  const cockpit = await page2.getByText("Centre National de Pilotage").count();
  if (cockpit > 0) throw new Error("le citoyen voit le cockpit admin");
  await page2.screenshot({ path: join(DIR, "07-citizen.png") });
});
await page2.close();

await browser.close();
console.log("\n=== E2E APP ADMIN /app ===");
console.log("base:", BASE);
console.log(JSON.stringify(steps, null, 2));
console.log("erreurs page:", errors.length ? errors : "aucune");
console.log("captures:", DIR);
