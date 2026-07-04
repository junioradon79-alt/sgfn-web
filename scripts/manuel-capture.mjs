import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "manuel-utilisateur", "screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = "https://sgfn.ci";
const PASSWORD = process.env.MANUEL_TEST_PASSWORD;
if (!PASSWORD) {
  console.error("Variable d'environnement MANUEL_TEST_PASSWORD manquante.");
  process.exit(1);
}
const VIEWPORT = { width: 1440, height: 900 };

// Pages exclusives par rôle : { path, name }
const ROLE_PAGES = {
  admin: [
    { path: "/dashboard", name: "accueil-global" },
    { path: "/dashboard/invitations", name: "invitations" },
    { path: "/dashboard/contacts-marketplace", name: "contacts-marketplace" },
    { path: "/dashboard/paiements", name: "paiements" },
    // Pages partagées, capturées une seule fois ici
    { path: "/dashboard/documents", name: "documents" },
    { path: "/dashboard/messages", name: "messages" },
    { path: "/dashboard/lots", name: "lots" },
    { path: "/dashboard/attributaires", name: "attributaires" },
    { path: "/dashboard/attributions", name: "attributions" },
  ],
  operateur: [
    { path: "/dashboard/operateur", name: "accueil" },
    { path: "/dashboard/mettre-en-vente", name: "mettre-en-vente" },
    { path: "/dashboard/lotissements", name: "lotissements" },
  ],
  proprietaire: [
    { path: "/dashboard/proprietaire", name: "accueil" },
    { path: "/dashboard/mettre-en-vente", name: "mettre-en-vente" },
    { path: "/dashboard/documents", name: "documents" },
  ],
  commissaire: [
    { path: "/dashboard/commissaire", name: "accueil" },
    { path: "/dashboard/litiges", name: "litiges" },
  ],
  verificateur: [{ path: "/dashboard/ia", name: "sgnf-ai" }],
  geometre: [
    { path: "/dashboard/carte", name: "carte" },
    { path: "/dashboard/lotissements", name: "lotissements" },
    { path: "/dashboard/lots", name: "lots" },
  ],
  chefferie: [
    { path: "/dashboard/chefferie", name: "accueil" },
    { path: "/dashboard/familles", name: "familles" },
    { path: "/dashboard/concertation", name: "concertation" },
  ],
  amenageur: [{ path: "/dashboard/acquisition", name: "acquisition" }],
};

const browser = await chromium.launch();
const report = [];

// Capture de la page de connexion (non authentifiée)
{
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT_DIR, "commun-login.png") });
  report.push({ role: "commun", page: "login", status: "ok" });
  await page.close();
}

for (const [role, pages] of Object.entries(ROLE_PAGES)) {
  const email = `manuel.${role}@sgfn.ci`;
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.fill("#email", email);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 15000 });

    for (const { path: p, name } of pages) {
      try {
        await page.goto(`${BASE_URL}${p}`, { waitUntil: "networkidle", timeout: 20000 });
        // laisser le temps aux données Supabase (client-side) de se charger
        await page.waitForTimeout(1500);
        const file = path.join(OUT_DIR, `${role}-${name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        report.push({ role, page: name, status: "ok" });
        console.log(`[OK] ${role} — ${p}`);
      } catch (err) {
        report.push({ role, page: name, status: "error", error: String(err.message ?? err) });
        console.error(`[ERREUR] ${role} — ${p}:`, err.message ?? err);
      }
    }
  } catch (err) {
    report.push({ role, page: "login", status: "error", error: String(err.message ?? err) });
    console.error(`[ERREUR] connexion ${role}:`, err.message ?? err);
  } finally {
    await context.close();
  }
}

await browser.close();

console.log("\n--- Résumé ---");
console.table(report);

const failed = report.filter((r) => r.status !== "ok");
if (failed.length > 0) {
  console.error(`\n${failed.length} capture(s) en échec.`);
  process.exit(1);
}
