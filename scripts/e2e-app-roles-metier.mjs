// Vérification navigateur des rôles métier ouverts à l'app (viewport téléphone).
//
// Ce que ce test défend, précisément : `operateur_saisie` et `chefferie` sont
// autorisés EN BASE à soumettre dans le registre (garde de `soumettre_saisie`),
// mais tombaient dans l'expérience citoyen — les écrans de saisie leur étaient
// inaccessibles. Il vérifie donc qu'ils atteignent la saisie, ET qu'ils
// n'atteignent QUE ce que le serveur leur accorde : offrir un formulaire que la
// base refuse ferait remplir une fiche entière pour rien.
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
const DIR = join(tmpdir(), "sgnf-app-roles");
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

const step = async (name, fn) => {
  try { await fn(); steps.push({ name, ok: true }); }
  catch (e) { steps.push({ name, ok: false, error: String(e.message ?? e).slice(0, 200) }); }
};

// ── Opérateur de saisie ───────────────────────────────────────────────────────
// Trois formulaires : attribuer un lot, fiche d'attributaire, nouveau
// lotissement. Pas « fiche de lotissement » — celle-là est réservée aux
// chefferies par `soumettre_saisie`.
const p1 = await browser.newPage({ viewport: { width: 390, height: 844 } });
p1.on("pageerror", (e) => errors.push("saisie: " + String(e.message).slice(0, 140)));

await step("operateur-saisie-atteint-la-saisie", async () => {
  await login(p1, "manuel.operateur-saisie@sgfn.ci");
  await p1.getByText("Saisir dans le registre").waitFor({ timeout: 60000 });
  await p1.screenshot({ path: join(DIR, "01-saisie-accueil.png") });
});

await step("operateur-saisie-voit-ses-3-formulaires", async () => {
  for (const libelle of ["Attribuer un lot", "Fiche d'attributaire", "Nouveau lotissement"]) {
    const n = await p1.getByText(libelle, { exact: true }).count();
    if (n === 0) throw new Error(`formulaire absent : ${libelle}`);
  }
});

await step("operateur-saisie-n-a-PAS-la-fiche-lotissement", async () => {
  // Réservée à la chefferie côté serveur. L'afficher enverrait droit dans le mur.
  const n = await p1.getByText("Fiche de lotissement", { exact: true }).count();
  if (n > 0) throw new Error("« Fiche de lotissement » offerte alors que le serveur la refuse");
});

await step("operateur-saisie-ne-voit-pas-le-cockpit", async () => {
  const cockpit = await p1.getByText("Centre National de Pilotage").count();
  if (cockpit > 0) throw new Error("cockpit national visible par un opérateur de saisie");
  const aFaire = await p1.getByText("Files nationales à traiter").count();
  if (aFaire > 0) throw new Error("files nationales visibles par un opérateur de saisie");
});

await step("operateur-saisie-ouvre-un-formulaire", async () => {
  await p1.getByText("Attribuer un lot", { exact: true }).click();
  await p1.getByText("Choisir le lotissement").waitFor({ timeout: 20000 });
  await p1.screenshot({ path: join(DIR, "02-saisie-formulaire.png") });
});

await step("operateur-saisie-garde-notifications-et-messages", async () => {
  // Sans cloche sur l'écran racine, ces rôles n'auraient AUCUN accès à leurs
  // notifications : seuls HomeScreen (citoyen) et PilotageScreen (admin) en
  // portaient une.
  await p1.getByLabel("Retour").first().click();
  await p1.getByLabel("Notifications").waitFor({ timeout: 15000 });
  await p1.getByText("Messages", { exact: true }).click();
  await p1.waitForTimeout(800);
  await p1.screenshot({ path: join(DIR, "03-saisie-messages.png") });
});
await p1.close();

// ── Chefferie ─────────────────────────────────────────────────────────────────
const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
p2.on("pageerror", (e) => errors.push("chefferie: " + String(e.message).slice(0, 140)));

await step("chefferie-atteint-la-saisie", async () => {
  await login(p2, "manuel.chefferie@sgfn.ci");
  await p2.getByText("Saisir dans le registre").waitFor({ timeout: 60000 });
  await p2.screenshot({ path: join(DIR, "04-chefferie-accueil.png") });
});

await step("chefferie-voit-la-fiche-lotissement-et-elle-seule", async () => {
  const fiche = await p2.getByText("Fiche de lotissement", { exact: true }).count();
  if (fiche === 0) throw new Error("« Fiche de lotissement » absente pour une chefferie");
  for (const interdit of ["Attribuer un lot", "Fiche d'attributaire", "Nouveau lotissement"]) {
    const n = await p2.getByText(interdit, { exact: true }).count();
    if (n > 0) throw new Error(`formulaire réservé aux opérateurs de saisie offert : ${interdit}`);
  }
});

await step("chefferie-ne-voit-pas-le-cockpit", async () => {
  const cockpit = await p2.getByText("Centre National de Pilotage").count();
  if (cockpit > 0) throw new Error("cockpit national visible par une chefferie");
});
await p2.close();

// ── Non-régression : un citoyen reste citoyen ────────────────────────────────
const p3 = await browser.newPage({ viewport: { width: 390, height: 844 } });
p3.on("pageerror", (e) => errors.push("citoyen: " + String(e.message).slice(0, 140)));
await step("citoyen-non-regression", async () => {
  await login(p3, "manuel.proprietaire-terrien@sgfn.ci");
  await p3.getByText("Mon patrimoine foncier").waitFor({ timeout: 60000 });
  const saisie = await p3.getByText("Saisir dans le registre").count();
  if (saisie > 0) throw new Error("un citoyen voit la saisie du registre");
});
await p3.close();

// ── Le cas que la production ne sait pas produire ─────────────────────────────
// Une chefferie sans juridiction : les deux comptes réels ne permettent pas de
// l'atteindre (l'un est rattaché, l'autre est inactif). Sans ce passage par
// l'aperçu, le garde-fou serait du code jamais exercé.
const p4 = await browser.newPage({ viewport: { width: 430, height: 900 } });
p4.on("pageerror", (e) => errors.push("apercu: " + String(e.message).slice(0, 140)));

// ⚠️ Toutes les assertions ci-dessous sont scopées à `[data-apercu-cadre]`, le
// cadre « téléphone ». Le menu de l'aperçu porte lui-même des libellés
// identiques à ceux des écrans (« Fiche de lotissement »…) : une recherche sur
// la page entière les compterait et ferait échouer le test alors que l'écran
// est correct.
const cadre = () => p4.locator("[data-apercu-cadre]");

await step("apercu-chefferie-sans-juridiction-est-bloquee", async () => {
  await p4.goto(`${BASE}/apercu-mobile`, { waitUntil: "networkidle", timeout: 90000 });
  await p4.getByText("Chefferie non rattachée").click();
  await cadre().getByText("Compte non rattaché").waitFor({ timeout: 20000 });
  // Le garde-fou doit RETIRER la saisie, pas seulement afficher un avis à côté.
  const encoreOfferte = await cadre().getByText("Fiche de lotissement", { exact: true }).count();
  if (encoreOfferte > 0) throw new Error("la saisie reste offerte à une chefferie non rattachée");
  await p4.screenshot({ path: join(DIR, "05-chefferie-bloquee.png") });
});

await step("apercu-accueil-saisie-operateur", async () => {
  await p4.getByText("Accueil « Saisie » (opérateur)").click();
  await cadre().getByText("Saisir dans le registre").waitFor({ timeout: 20000 });
  const fiche = await cadre().getByText("Fiche de lotissement", { exact: true }).count();
  if (fiche > 0) throw new Error("« Fiche de lotissement » offerte à un opérateur de saisie");
  // Contrôle positif : sans lui, un écran vide passerait le test ci-dessus.
  const attribuer = await cadre().getByText("Attribuer un lot", { exact: true }).count();
  if (attribuer === 0) throw new Error("l'écran ne montre aucun formulaire — le test ne prouverait rien");
  await p4.screenshot({ path: join(DIR, "06-saisie-accueil.png") });
});
await p4.close();

await browser.close();
console.log("base:", BASE);
console.log(JSON.stringify(steps, null, 2));
console.log("erreurs page:", errors.length ? errors : "aucune");
console.log("captures:", DIR);
const echecs = steps.filter((s) => !s.ok).length;
console.log(`resultat: ${steps.length - echecs}/${steps.length}`);
process.exit(echecs > 0 ? 1 : 0);
