import { chromium } from "playwright";

const BASE_URL = "https://sgfn.ci";
const PASSWORD = process.env.MANUEL_TEST_PASSWORD;
if (!PASSWORD) {
  console.error("Variable d'environnement MANUEL_TEST_PASSWORD manquante.");
  process.exit(1);
}

const ROLES = ["admin", "operateur", "proprietaire", "commissaire", "geometre", "chefferie", "amenageur", "verificateur"];

const browser = await chromium.launch();
const results = [];

for (const role of ROLES) {
  const email = `manuel.${role}@sgfn.ci`;
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.fill("#email", email);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    results.push({ role, email, status: "ok", url: page.url() });
    console.log(`[OK] ${email} -> ${page.url()}`);
  } catch (err) {
    results.push({ role, email, status: "error", error: String(err.message ?? err) });
    console.error(`[ERREUR] ${email}:`, err.message ?? err);
  } finally {
    await page.close();
  }
}

await browser.close();
console.table(results);

if (results.some((r) => r.status !== "ok")) process.exit(1);
