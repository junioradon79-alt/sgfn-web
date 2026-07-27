// Vérification navigateur de l'expérience acquéreur sur /app (viewport téléphone).
//
// Ce que ce test défend : un acquéreur n'a le plus souvent AUCUNE attribution
// — les quatre comptes de la production n'en ont aucune — si bien que son
// onglet « Parcelles », qui lit les attributions, lui restait entièrement vide.
// Il suit pourtant de vrais terrains (captage QR). Le test vérifie que ses
// suivis apparaissent, sur des données réelles : `manuel.acquereur@sgfn.ci` en
// a deux en base.
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
const DIR = join(tmpdir(), "sgnf-app-acquereur");
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
const steps = [];
const errors = [];

const step = async (name, fn) => {
  try { await fn(); steps.push({ name, ok: true }); }
  catch (e) { steps.push({ name, ok: false, error: String(e.message ?? e).slice(0, 200) }); }
};

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));

await step("acquereur-connexion", async () => {
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByText("Connexion à mon espace").click();
  await page.locator('input[type="email"]').fill("manuel.acquereur@sgfn.ci");
  await page.locator('input[type="password"]').fill(PWD);
  await page.locator('button[type="submit"]').click();
  await page.getByText("Parcelles", { exact: true }).waitFor({ timeout: 60000 });
});

await step("acquereur-voit-ses-terrains-suivis", async () => {
  await page.getByText("Parcelles", { exact: true }).click();
  await page.getByText("Vous suivez ces terrains sans en être propriétaire.").waitFor({ timeout: 20000 });
  // Données réelles : deux suivis, tous deux sur « Koelea-Accor revu ».
  const cartes = await page.getByText("Koelea-Accor revu").count();
  if (cartes < 2) throw new Error(`attendu au moins 2 terrains suivis, vu ${cartes}`);
  await page.screenshot({ path: join(DIR, "01-suivis.png") });
});

await step("acquereur-le-compteur-dit-les-suivis-et-non-zero-parcelle", async () => {
  // Le sous-titre disait « 0 parcelle » à quelqu'un qui suit deux terrains.
  const entete = await page.getByText(/terrains? suivis?/i).count();
  if (entete === 0) throw new Error("l'en-tête ne mentionne pas les terrains suivis");
});

await step("acquereur-le-titre-ne-dit-PAS-mes-parcelles", async () => {
  // Il ne possède rien : titrer « Mes parcelles » au-dessus de terrains
  // seulement suivis laisserait croire à une propriété. Sujet foncier.
  const titre = await page.getByText("Mes parcelles", { exact: true }).count();
  if (titre > 0) throw new Error("« Mes parcelles » affiché à un compte qui ne possède aucune parcelle");
});

await step("acquereur-pas-de-filtres-sans-parcelle-possedee", async () => {
  // Les chips filtrent les parcelles possédées : sans aucune, elles n'ont rien
  // à filtrer et ne doivent pas occuper le haut de l'écran.
  const chip = await page.getByText("Toutes", { exact: true }).count();
  if (chip > 0) throw new Error("les filtres de statut s'affichent sans aucune parcelle possédée");
});

await step("acquereur-etat-non-vendu-annonce", async () => {
  const pasEnVente = await page.getByText("Pas encore en vente").count();
  if (pasEnVente < 2) throw new Error("l'état de mise en vente n'est pas affiché sur les suivis");
});
await page.close();

// ── Non-régression : qui possède des parcelles garde sa liste et ses filtres ──
// ⚠️ `manuel.proprietaire@sgfn.ci` (12 parcelles), et NON
// `manuel.proprietaire-terrien@sgfn.ci` qui n'en possède aucune — ce dernier
// affiche légitimement l'état vide, et le prendre pour témoin ferait échouer un
// test sur le comportement attendu.
const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
p2.on("pageerror", (e) => errors.push("pt: " + String(e.message).slice(0, 140)));
await step("proprietaire-avec-parcelles-non-regression", async () => {
  await p2.goto(`${BASE}/app`, { waitUntil: "networkidle", timeout: 90000 });
  await p2.getByText("Connexion à mon espace").click();
  await p2.locator('input[type="email"]').fill("manuel.proprietaire@sgfn.ci");
  await p2.locator('input[type="password"]').fill(PWD);
  await p2.locator('button[type="submit"]').click();
  await p2.getByText("Parcelles", { exact: true }).waitFor({ timeout: 60000 });
  await p2.getByText("Parcelles", { exact: true }).click();
  // Il possède de vraies parcelles : les filtres doivent rester là.
  await p2.getByText("Toutes", { exact: true }).waitFor({ timeout: 20000 });
  // Et il ne suit rien : la section des suivis ne doit pas apparaître.
  const suivis = await p2.getByText("Vous suivez ces terrains sans en être propriétaire.").count();
  if (suivis > 0) throw new Error("section « terrains suivis » affichée sans aucun suivi");
  await p2.screenshot({ path: join(DIR, "02-proprietaire-parcelles.png") });
});
await p2.close();

// ── L'état « en vente » n'existe sur aucun suivi réel : exercé via l'aperçu ──
const p3 = await browser.newPage({ viewport: { width: 430, height: 900 } });
p3.on("pageerror", (e) => errors.push("apercu: " + String(e.message).slice(0, 140)));
await step("apercu-etat-en-vente", async () => {
  await p3.goto(`${BASE}/apercu-mobile`, { waitUntil: "networkidle", timeout: 90000 });
  await p3.getByText("Terrains suivis (acquéreur)").click();
  const cadre = p3.locator("[data-apercu-cadre]");
  await cadre.getByText("En vente — voir l'annonce").waitFor({ timeout: 20000 });
  // Contrôle positif : les deux états coexistent bien sur le même écran.
  const pasEnVente = await cadre.getByText("Pas encore en vente").count();
  if (pasEnVente === 0) throw new Error("l'état « pas encore en vente » a disparu de l'écran");
  await p3.screenshot({ path: join(DIR, "03-apercu-en-vente.png") });
});
await p3.close();

await browser.close();
console.log("base:", BASE);
console.log(JSON.stringify(steps, null, 2));
console.log("erreurs page:", errors.length ? errors : "aucune");
console.log("captures:", DIR);
const echecs = steps.filter((s) => !s.ok).length;
console.log(`resultat: ${steps.length - echecs}/${steps.length}`);
process.exit(echecs > 0 ? 1 : 0);
