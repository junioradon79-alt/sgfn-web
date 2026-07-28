// Preuve de bout en bout du correctif #18 : l'admin retire un constat de
// signature depuis le Coffre-fort documentaire.
//
// 🔴 Ce test ECRIT EN PRODUCTION (le dev server parle a la base de prod) et
// doit etre suivi IMMEDIATEMENT de la restauration exacte de l'etat capture.
// `annuler_signature_attestation` remet les colonnes a NULL : la date du
// constat d'origine est PERDUE, il faut la reecrire telle quelle.
//
// Ce qu'il prouve et que la lecture du code ne prouve pas : la pastille signee
// est bien devenue cliquable pour l'admin, la modale s'ouvre, et la RPC — qui
// n'etait appelee par AUCUN ecran depuis sa creation le 22/07 — fonctionne.
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
const DIR = join(tmpdir(), "sgnf-retrait-sig");
mkdirSync(DIR, { recursive: true });
/** L'attestation qui porte deux constats depuis le 23/07. */
const REFERENCE = "ATT-CESS-2026-00894";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
const steps = [];
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));

const step = async (name, fn) => {
  try { await fn(); steps.push({ name, ok: true }); }
  catch (e) { steps.push({ name, ok: false, error: String(e.message ?? e).slice(0, 240) }); }
};

/** La ligne du tableau qui porte notre reference. */
const ligne = () => page.locator("tr").filter({ hasText: REFERENCE });

await step("admin-ouvre-le-coffre-fort", async () => {
  await page.goto(`${BASE}/login/`, { waitUntil: "networkidle", timeout: 90000 });
  await page.locator('input[type="email"]').fill("manuel.admin@sgfn.ci");
  await page.locator('input[type="password"]').fill(PWD);
  await page.locator('button[type="submit"]').click();
  // Attendre la sortie EFFECTIVE de /login, jamais un delai fixe.
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
  await page.goto(`${BASE}/dashboard/documents/`, { waitUntil: "networkidle", timeout: 90000 });
  await ligne().first().waitFor({ timeout: 30000 });
  await page.screenshot({ path: join(DIR, "01-avant.png") });
});

/** Nombre de constats retirables sur la ligne — mesure de reference. */
const retirables = () =>
  ligne().first().getByRole("button", { name: /cliquer pour retirer ce constat/ }).count();
let avant = 0;

await step("la-pastille-signee-est-cliquable-pour-l-admin", async () => {
  // Controle POSITIF : avant le chantier, une pastille SIGNEE etait un simple
  // <span>. Si elle ne l'est pas, le reste du test ne prouverait rien.
  avant = await retirables();
  if (avant === 0) throw new Error("aucune pastille signee n'est cliquable — le retrait n'est pas offert");
});

await step("le-retrait-passe-par-une-confirmation", async () => {
  await ligne().first().getByRole("button", { name: /cliquer pour retirer ce constat/ }).first().click();
  await page.getByText("Retirer le constat de signature").waitFor({ timeout: 15000 });
  // La modale doit dire ce qui se perd — c'est ce qui distingue ce geste d'un
  // simple clic de constatation.
  const perte = await page.getByText(/date du constat d'origine est/).count();
  if (perte === 0) throw new Error("la modale n'annonce pas la perte de la date d'origine");
  await page.screenshot({ path: join(DIR, "02-modale.png") });
});

await step("le-retrait-est-REELLEMENT-enregistre", async () => {
  await page.getByRole("button", { name: "Retirer le constat" }).click();
  // La modale se referme, et la pastille redevient grise : le compteur des
  // signatures requises doit baisser.
  await page.getByText("Retirer le constat de signature").waitFor({ state: "hidden", timeout: 30000 });
  // 🔴 On mesure l'ECART, pas un etat absolu : « il reste au plus une pastille »
  // etait vrai avant comme apres sur une attestation a deux constats, et le
  // test se contredisait lui-meme. L'attente porte sur la valeur attendue,
  // plutot que sur un delai fixe qui course le rechargement de la liste.
  await page
    .locator("tr")
    .filter({ hasText: REFERENCE })
    .first()
    .getByRole("button", { name: /cliquer pour retirer ce constat/ })
    .nth(avant - 1)
    .waitFor({ state: "detached", timeout: 30000 });
  const apres = await retirables();
  if (apres !== avant - 1) {
    throw new Error(`constats retirables : ${avant} avant, ${apres} apres (attendu ${avant - 1})`);
  }
  await page.screenshot({ path: join(DIR, "03-apres.png") });
});

await step("aucune-erreur-affichee", async () => {
  const err = await page.locator("text=/Action reservee|introuvable|deja delivree/").count();
  if (err > 0) throw new Error("un refus serveur est affiche");
});

await page.close();
await browser.close();
console.log("\n=== E2E RETRAIT DE SIGNATURE ===");
console.log("base:", BASE, "| reference:", REFERENCE);
console.log(JSON.stringify(steps, null, 2));
console.log("erreurs page:", errors.length ? errors : "aucune");
console.log("captures:", DIR);
const echecs = steps.filter((s) => !s.ok).length;
console.log(`resultat: ${steps.length - echecs}/${steps.length}`);
console.log("\n⚠️  RESTAURER L'ETAT INITIAL MAINTENANT :");
console.log("   .\\scripts\\supabase-sql.ps1 -SqlFile .\\scripts\\restaurer-etat-e2e-prod.sql");
process.exit(echecs > 0 ? 1 : 0);
