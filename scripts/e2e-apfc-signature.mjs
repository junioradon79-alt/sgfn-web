// Preuve de bout en bout du correctif #16 : la chefferie co-signe reellement
// une APFC depuis /dashboard/validations.
//
// 🔴 Ce test ECRIT EN PRODUCTION (le dev server parle a la base de prod). Il
// est concu pour etre suivi IMMEDIATEMENT du script de remise a l'etat
// initial : la table n'a aucun trigger, la remise a NULL restaure donc l'etat
// exact d'avant. Cf. la sequence dans le journal du 28/07.
//
// Ce qu'il prouve et que la simulation SQL ne prouvait pas : le CABLAGE. Un
// mauvais nom de RPC ou de parametre echouerait exactement comme le bug qu'on
// vient de corriger — silencieusement du point de vue de l'utilisateur.
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
const DIR = join(tmpdir(), "sgnf-apfc");
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const steps = [];
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));

const step = async (name, fn) => {
  try { await fn(); steps.push({ name, ok: true }); }
  catch (e) { steps.push({ name, ok: false, error: String(e.message ?? e).slice(0, 220) }); }
};

await step("chefferie-ouvre-les-validations", async () => {
  await page.goto(`${BASE}/login/`, { waitUntil: "networkidle", timeout: 90000 });
  await page.locator('input[type="email"]').fill("manuel.chefferie@sgfn.ci");
  await page.locator('input[type="password"]').fill(PWD);
  await page.locator('button[type="submit"]').click();
  // ⚠️ Attendre la SORTIE EFFECTIVE de /login, jamais un délai fixe : avec
  // `waitForTimeout(4000)` la navigation partait avant que la session soit
  // posée, et l'application renvoyait sur /login. Les assertions échouaient
  // alors en désignant l'écran des APFC, alors que le défaut était ici.
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
  await page.goto(`${BASE}/dashboard/validations/`, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByText(/Attestations de Propriété Foncière Coutumière/).waitFor({ timeout: 30000 });
  await page.screenshot({ path: join(DIR, "01-avant.png"), fullPage: true });
});

// 🔴 TOUT est scope sur la carte `#apfc`. Le bouton « Valider » existe aussi
// sur les 50 attestations de cession de la meme page : un `.first()` non scope
// aurait clique une CESSION — donc signe un vrai document de production a la
// place de celui qu'on teste, et sans que le test s'en apercoive.
const carteApfc = () => page.locator("#apfc");

/** Nombre de cessions en attente — mesure de reference du garde-fou. */
const cessionsEnAttente = () =>
  page.locator("#cessions").getByRole("button", { name: /Valider/ }).count();
let cessionsAvant = 0;

await step("l-apfc-est-bien-EN-ATTENTE-avant-le-clic", async () => {
  // Controle POSITIF indispensable : si elle etait deja validee, le test
  // suivant ne prouverait rien.
  const bouton = await carteApfc().getByRole("button", { name: /Valider/ }).count();
  if (bouton === 0) throw new Error("aucune APFC en attente — le test ne prouverait rien");
  const dejaValide = await carteApfc().getByText("Validé", { exact: true }).count();
  if (dejaValide > 0) throw new Error("l'APFC est deja validee avant le clic");
  cessionsAvant = await cessionsEnAttente();
});

await step("le-clic-enregistre-REELLEMENT-la-signature", async () => {
  await carteApfc().getByRole("button", { name: /Valider/ }).first().click();
  // La preuve : la pastille « Validé » remplace le bouton apres rechargement.
  await carteApfc().getByText("Validé", { exact: true }).waitFor({ timeout: 30000 });
  await page.screenshot({ path: join(DIR, "02-apres.png"), fullPage: true });
});

await step("aucun-message-d-erreur-affiche", async () => {
  const err = await page.getByText(/Signature non enregistrée/).count();
  if (err > 0) {
    const txt = await page.getByText(/Signature non enregistrée/).first().innerText();
    throw new Error(`erreur affichee : ${txt}`);
  }
});

await step("la-signature-chefferie-village-est-marquee", async () => {
  const badge = await carteApfc().getByText("Chefferie village").count();
  if (badge === 0) throw new Error("badge de signature « Chefferie village » absent");
});

await step("les-cessions-n-ont-PAS-ete-touchees", async () => {
  // 🔴 Garde-fou du test lui-meme : la file des cessions doit rester
  // EXACTEMENT de la meme taille.
  //
  // La version precedente exigeait seulement qu'elle soit non vide — sur une
  // file de 50 lignes, un clic egare en laissait 49, donc l'assertion passait.
  // Elle n'aurait pu echouer que sur une file d'exactement un element. On
  // compare donc a la mesure prise avant le clic.
  const cessionsApres = await cessionsEnAttente();
  if (cessionsApres !== cessionsAvant) {
    throw new Error(
      `la file des cessions a bouge : ${cessionsAvant} avant, ${cessionsApres} apres — le clic a porte sur une cession`,
    );
  }
  if (cessionsAvant === 0) {
    throw new Error("la file des cessions etait vide : ce garde-fou ne prouverait rien");
  }
});

await page.close();
await browser.close();
console.log("\n=== E2E APFC — co-signature chefferie ===");
console.log("base:", BASE);
console.log(JSON.stringify(steps, null, 2));
console.log("erreurs page:", errors.length ? errors : "aucune");
console.log("captures:", DIR);
const echecs = steps.filter((s) => !s.ok).length;
console.log(`resultat: ${steps.length - echecs}/${steps.length}`);
// Une erreur JS non rattrapée fait échouer la passe : l'afficher sans la
// compter laisserait une suite au vert sur un écran qui plante.
if (errors.length > 0) process.exitCode = 1;
console.log("\n⚠️  REMETTRE L'APFC A SON ETAT INITIAL MAINTENANT :");
console.log("   .\\scripts\\supabase-sql.ps1 -SqlFile .\\scripts\\restaurer-etat-e2e-prod.sql");
process.exit(echecs > 0 ? 1 : 0);
