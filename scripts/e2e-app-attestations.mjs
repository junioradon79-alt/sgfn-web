// Vérification navigateur des attestations dans l'app mobile (viewport téléphone).
//
// Ce que ce test défend, précisément : la table `ATTESTATIONS_PAR_ROLE` doit
// rester le miroir des gardes serveur. Une erreur ici ne casse aucune
// compilation — elle offre un bouton que le serveur refusera, après que
// quelqu'un a cru l'acte accompli. D'où le poids donné aux contrôles
// NÉGATIFS : ce qu'un rôle ne doit PAS voir compte autant que le reste.
//
// Rappel des gardes (relues en production le 28/07) :
//   generer_attestation_exceptionnelle → est_admin() seul
//   signer_attestation                 → admin/operateur : les 3 signatures
//                                        chefferie : la sienne, dans sa juridiction
//   marquer_attestation_delivree       → admin ou operateur
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
const DIR = join(tmpdir(), "sgnf-app-attestations");
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
  catch (e) { steps.push({ name, ok: false, error: String(e.message ?? e).slice(0, 220) }); }
};

// ── Chefferie : l'onglet dédié, et UNE SEULE signature actionnable ────────────
const p1 = await browser.newPage({ viewport: { width: 390, height: 844 } });
p1.on("pageerror", (e) => errors.push("chefferie: " + String(e.message).slice(0, 140)));

await step("chefferie-a-un-onglet-attestations", async () => {
  await login(p1, "manuel.chefferie@sgfn.ci");
  await p1.getByText("Saisir dans le registre").waitFor({ timeout: 60000 });
  await p1.getByText("Attestations", { exact: true }).first().click();
  // L'en-tête de l'onglet porte le mot « Attestations » ; on attend un élément
  // propre à l'écran plutôt que le libellé de l'onglet lui-même.
  await p1.getByText("À constater", { exact: false }).first().waitFor({ timeout: 30000 });
  await p1.screenshot({ path: join(DIR, "01-chefferie-attestations.png") });
});

await step("chefferie-voit-la-cloche-des-notifications", async () => {
  // Écran racine : sans cloche, ce rôle perd l'accès à ses notifications dès
  // qu'il est sur cet onglet. Le piège a déjà été rencontré sur SaisieScreen.
  await p1.getByLabel("Notifications").waitFor({ timeout: 15000 });
});

await step("chefferie-a-des-attestations-reelles", async () => {
  // Contrôle POSITIF : sans lui, un écran vide passerait tous les tests
  // négatifs ci-dessous. La production porte 49 attestations `generee` sur la
  // juridiction de ce compte.
  await p1.getByText(/ATT-CESS-/).first().waitFor({ timeout: 30000 });
});

await step("chefferie-ne-peut-constater-QUE-la-chefferie", async () => {
  const chefferie = await p1.getByText(/^Constater : Chefferie$/).count();
  if (chefferie === 0) throw new Error("aucun bouton « Constater : Chefferie » pour une chefferie");
  for (const interdit of ["Constater : Chef de famille", "Constater : Propriétaire terrien", "Constater : Opérateur"]) {
    const n = await p1.getByText(interdit, { exact: true }).count();
    if (n > 0) throw new Error(`signature hors ressort offerte à la chefferie : ${interdit}`);
  }
});

await step("chefferie-n-a-PAS-d-onglet-a-remettre", async () => {
  // 🔴 Compter « Enregistrer la remise » sur le filtre par défaut ne prouvait
  // RIEN : ce bouton n'y est jamais rendu, même pour un rôle qui a le droit.
  // L'assertion passait donc quel que soit le contenu de la table des rôles.
  // Ce qui est vérifiable, c'est que l'onglet lui-même n'existe pas — il n'est
  // rendu que si `actions.remise` est vrai.
  const onglet = await p1.getByRole("button", { name: /À remettre/ }).count();
  if (onglet > 0) throw new Error("l'onglet « À remettre » est offert à une chefferie");
});

await step("chefferie-ne-peut-remettre-AUCUNE-attestation-meme-complete", async () => {
  // Contre-épreuve par « Toutes » : même sur une attestation dont toutes les
  // signatures requises sont là, la remise ne doit pas apparaître.
  await p1.getByRole("button", { name: /Toutes/ }).click();
  await p1.getByText(/ATT-CESS-/).first().waitFor({ timeout: 20000 });
  const remise = await p1.getByText("Enregistrer la remise", { exact: true }).count();
  if (remise > 0) throw new Error("remise offerte à une chefferie (réservée admin/opérateur)");
  const generer = await p1.getByText("Générer par dérogation", { exact: true }).count();
  if (generer > 0) throw new Error("génération offerte à une chefferie (réservée aux admins)");
});
await p1.close();

// ── Admin : par « À faire », avec la génération ───────────────────────────────
const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
p2.on("pageerror", (e) => errors.push("admin: " + String(e.message).slice(0, 140)));

await step("admin-trouve-la-file-dans-a-faire", async () => {
  await login(p2, "manuel.admin@sgfn.ci");
  await p2.getByText("Centre National de Pilotage").waitFor({ timeout: 60000 });
  await p2.getByText("À faire", { exact: true }).first().click();
  await p2.getByText("Signatures à constater", { exact: true }).waitFor({ timeout: 20000 });
  await p2.screenshot({ path: join(DIR, "02-admin-files.png") });
});

await step("admin-n-a-PAS-d-onglet-attestations", async () => {
  // Décision d'architecture : l'admin passe par « À faire », là où se trouve
  // déjà le compteur que son geste fait bouger. Un 5e onglet aurait séparé
  // l'acte de sa conséquence — c'est le raisonnement déjà tenu pour la saisie.
  const onglets = await p2.locator("nav").getByText("Attestations", { exact: true }).count();
  if (onglets > 0) throw new Error("un onglet « Attestations » est apparu dans la barre admin");
});

await step("admin-ouvre-les-attestations", async () => {
  await p2.getByText("Signatures à constater", { exact: true }).click();
  await p2.getByText(/ATT-CESS-/).first().waitFor({ timeout: 30000 });
  await p2.screenshot({ path: join(DIR, "03-admin-attestations.png") });
});

await step("admin-voit-la-generation-par-derogation", async () => {
  await p2.getByText("Générer par dérogation", { exact: true }).waitFor({ timeout: 15000 });
});

await step("admin-ouvre-la-generation-et-le-motif-est-garde", async () => {
  await p2.getByText("Générer par dérogation", { exact: true }).click();
  await p2.getByText("Lotissement", { exact: true }).first().waitFor({ timeout: 20000 });
  await p2.screenshot({ path: join(DIR, "04-admin-generation.png") });
});
await p2.close();

// ── Opérateur : ouvert le 28/07, mais BORNÉ à son parc ───────────────────────
// Deux comptes rattachés à deux opérateurs différents : l'un porte les 51
// attestations, l'autre n'en a aucune. C'est le cloisonnement lui-même qui est
// vérifié ici, sur données réelles.
const p6 = await browser.newPage({ viewport: { width: 390, height: 844 } });
p6.on("pageerror", (e) => errors.push("operateur: " + String(e.message).slice(0, 140)));

await step("operateur-atteint-les-attestations", async () => {
  await login(p6, "manuel.amenageur@sgfn.ci");
  await p6.getByText("Attestations", { exact: true }).first().waitFor({ timeout: 60000 });
  await p6.getByText(/ATT-CESS-/).first().waitFor({ timeout: 30000 });
  await p6.screenshot({ path: join(DIR, "11-operateur.png") });
});

await step("operateur-a-la-remise-mais-PAS-la-derogation", async () => {
  // `marquer_attestation_delivree` l'autorise ; `generer_attestation_exceptionnelle`
  // est `est_admin()` seul.
  const onglet = await p6.getByRole("button", { name: /À remettre/ }).count();
  if (onglet === 0) throw new Error("l'onglet « À remettre » manque a un role qui a le droit de remise");
  const generer = await p6.getByText("Générer par dérogation", { exact: true }).count();
  if (generer > 0) throw new Error("génération offerte a un opérateur (réservée aux admins)");
});

await step("operateur-n-a-PAS-la-saisie-du-registre", async () => {
  // `soumettre_saisie` ne lui accorde aucun formulaire.
  const saisie = await p6.getByText("Saisir dans le registre").count();
  if (saisie > 0) throw new Error("la saisie du registre est offerte a un opérateur");
});
await p6.close();

const p7 = await browser.newPage({ viewport: { width: 390, height: 844 } });
p7.on("pageerror", (e) => errors.push("operateur2: " + String(e.message).slice(0, 140)));
await step("operateur-d-un-AUTRE-parc-ne-voit-aucune-attestation", async () => {
  // 🔴 Le cloisonnement, sur données réelles : ce compte est rattaché au
  // lotissement qui ne porte AUCUNE attestation. Il ne doit donc voir aucune
  // des 51 de l'autre opérateur. Sans cette étape, une policy non scopée
  // passerait inaperçue.
  await login(p7, "manuel.operateur@sgfn.ci");
  await p7.getByText("Attestations", { exact: true }).first().waitFor({ timeout: 60000 });
  await p7.waitForTimeout(3000);
  const fuite = await p7.getByText(/ATT-CESS-/).count();
  if (fuite > 0) throw new Error(`fuite : cet opérateur voit ${fuite} attestation(s) hors de son parc`);
  await p7.getByRole("button", { name: /Toutes/ }).click();
  await p7.waitForTimeout(1500);
  const fuite2 = await p7.getByText(/ATT-CESS-/).count();
  if (fuite2 > 0) throw new Error(`fuite sous « Toutes » : ${fuite2} attestation(s) hors parc`);
  await p7.screenshot({ path: join(DIR, "12-operateur-autre-parc.png") });
});
await p7.close();

// ── Contrôles négatifs : les rôles SANS droit sur les attestations ────────────
const p3 = await browser.newPage({ viewport: { width: 390, height: 844 } });
p3.on("pageerror", (e) => errors.push("op-saisie: " + String(e.message).slice(0, 140)));
await step("operateur-saisie-n-a-aucun-acces-aux-attestations", async () => {
  // `operateur_saisie` est dans la coquille métier mais n'a AUCUN droit sur
  // les attestations — à ne pas confondre avec `operateur`, qui a les droits
  // RPC mais aucune visibilité RLS (et reste donc hors de l'écran).
  await login(p3, "manuel.operateur-saisie@sgfn.ci");
  await p3.getByText("Saisir dans le registre").waitFor({ timeout: 60000 });
  const onglet = await p3.getByText("Attestations", { exact: true }).count();
  if (onglet > 0) throw new Error("« Attestations » offert à un opérateur de saisie");
});
await p3.close();

const p4 = await browser.newPage({ viewport: { width: 390, height: 844 } });
p4.on("pageerror", (e) => errors.push("citoyen: " + String(e.message).slice(0, 140)));
await step("citoyen-non-regression", async () => {
  await login(p4, "manuel.proprietaire-terrien@sgfn.ci");
  await p4.getByText("Mon patrimoine foncier").waitFor({ timeout: 60000 });
  const n = await p4.getByText("Attestations", { exact: true }).count();
  if (n > 0) throw new Error("un citoyen voit l'écran des attestations");
});
await p4.close();

// ── Les états que la production ne sait pas produire ──────────────────────────
// Les 51 attestations réelles sont TOUTES sur un lotissement à deux signatures
// requises, et 49 n'en portent aucune : ni la remise, ni la pastille « non
// requise », ni le cas révoqué n'existent en base. Sans l'aperçu, ce sont des
// branches de code jamais exercées.
const p5 = await browser.newPage({ viewport: { width: 430, height: 900 } });
p5.on("pageerror", (e) => errors.push("apercu: " + String(e.message).slice(0, 140)));

// ⚠️ Tout est scopé au cadre « téléphone » : le menu de l'aperçu porte des
// libellés identiques à ceux des écrans, et une recherche sur la page entière
// les compterait.
const cadre = () => p5.locator("[data-apercu-cadre]");

await step("apercu-admin-filtre-par-defaut-sur-a-constater", async () => {
  await p5.goto(`${BASE}/apercu-mobile`, { waitUntil: "networkidle", timeout: 90000 });
  await p5.getByText("Attestations (admin)").click();
  await cadre().getByText(/ATT-CESS-/).first().waitFor({ timeout: 20000 });
  // L'écran s'ouvre sur ce qui attend un geste, pas sur le stock : une
  // attestation déjà complète (00413) ne doit PAS être là, une incomplète si.
  const complete = await cadre().getByText(/ATT-CESS-2026-00413/).count();
  if (complete > 0) throw new Error("une attestation déjà signée apparaît dans « À constater »");
  const incomplete = await cadre().getByText(/ATT-CESS-2026-00412/).count();
  if (incomplete === 0) throw new Error("l'attestation incomplète n'apparaît pas dans « À constater »");
  // Une signature non requise s'affiche en pointillés plutôt que de passer
  // pour manquante — le lotissement à deux signatures est le cas réel.
  const nonRequise = await cadre().getByText(/non requise/).count();
  if (nonRequise === 0) throw new Error("aucune signature « non requise » affichée");
  await p5.screenshot({ path: join(DIR, "05-apercu-admin-a-constater.png") });
});

await step("apercu-admin-voit-la-remise-quand-les-signatures-sont-completes", async () => {
  // Cet état n'existe sur AUCUNE des 51 attestations réelles : sans l'aperçu,
  // le bouton de remise serait du code jamais affiché.
  await cadre().getByRole("button", { name: /À remettre/ }).click();
  await cadre().getByText(/ATT-CESS-2026-00413/).waitFor({ timeout: 15000 });
  const remise = await cadre().getByText("Enregistrer la remise", { exact: true }).count();
  if (remise === 0) throw new Error("la remise n'apparaît pas alors que les signatures requises sont complètes");
  const derog = await cadre().getByText(/Générée par dérogation/).count();
  if (derog === 0) throw new Error("la mention de dérogation n'apparaît pas");
  await p5.screenshot({ path: join(DIR, "06-apercu-admin-a-remettre.png") });
});

await step("apercu-admin-toutes-montre-delivree-et-revoquee", async () => {
  await cadre().getByRole("button", { name: /Toutes/ }).click();
  await cadre().getByText(/ATT-CESS-2026-00120/).waitFor({ timeout: 15000 });
  const revoque = await cadre().getByText("Révoquée", { exact: true }).count();
  if (revoque === 0) throw new Error("l'état révoqué n'apparaît pas");
  const delivree = await cadre().getByText("Délivrée", { exact: true }).count();
  if (delivree === 0) throw new Error("l'état délivré n'apparaît pas");
  // 🔴 Une attestation révoquée ne doit offrir AUCUN geste : le serveur la
  // refuse (« Cette attestation est revoquee »). On se scope sur la CARTE via
  // son `data-testid` : la version précédente prenait `.last()` d'un
  // `locator("div")`, c'est-à-dire la div feuille qui ne contient que la
  // référence — elle n'a aucun enfant, donc le compte valait 0 par
  // construction, y compris sur une attestation qui portait bel et bien
  // deux boutons.
  const carteRevoquee = cadre().locator('[data-testid="attestation-apc-at-5"]');
  await carteRevoquee.waitFor({ timeout: 10000 });
  const boutons = await carteRevoquee.getByText(/^Constater :/).count();
  if (boutons > 0) throw new Error("une attestation révoquée offre encore un constat de signature");
  // Contre-épreuve : le MÊME locator, sur une attestation signable, doit
  // trouver des boutons. Sans elle, l'assertion ci-dessus resterait
  // satisfaisable à vide.
  const carteSignable = cadre().locator('[data-testid="attestation-apc-at-1"]');
  const boutonsSignable = await carteSignable.getByText(/^Constater :/).count();
  if (boutonsSignable === 0) {
    throw new Error("le locator de carte ne trouve aucun bouton sur une attestation signable — l'assertion sur la révoquée ne prouverait rien");
  }
  await p5.screenshot({ path: join(DIR, "07-apercu-admin-toutes.png") });
});

await step("apercu-chefferie-compteurs-bornes-a-son-ressort", async () => {
  // 🔴 Le cœur du correctif : les compteurs mesurent ce que CE rôle peut
  // faire. `apc-at-6` a DÉJÀ la signature de la chefferie et attend le chef de
  // famille — elle doit donc sortir de « À constater » pour une chefferie, et
  // y rester pour un admin. Un compteur aveugle au rôle laisserait la pastille
  // d'une chefferie pleine après qu'elle a fait tout son travail.
  await p5.getByText("Attestations (chefferie)").click();
  await cadre().getByText(/ATT-CESS-/).first().waitFor({ timeout: 20000 });
  const dejaFaite = await cadre().getByText(/ATT-CESS-2026-00450/).count();
  if (dejaFaite > 0) {
    throw new Error("une attestation déjà constatée par la chefferie reste dans « À constater »");
  }
  await p5.getByText("Attestations (admin)").click();
  await cadre().getByText(/ATT-CESS-/).first().waitFor({ timeout: 20000 });
  const vueAdmin = await cadre().getByText(/ATT-CESS-2026-00450/).count();
  if (vueAdmin === 0) {
    throw new Error("l'admin ne voit pas une attestation qui attend encore le chef de famille");
  }
});

await step("apercu-chefferie-est-bornee-a-sa-signature", async () => {
  await p5.getByText("Attestations (chefferie)").click();
  await cadre().getByText(/ATT-CESS-/).first().waitFor({ timeout: 20000 });
  const remise = await cadre().getByText("Enregistrer la remise", { exact: true }).count();
  if (remise > 0) throw new Error("remise offerte à la chefferie dans l'aperçu");
  const chefFamille = await cadre().getByText("Constater : Chef de famille", { exact: true }).count();
  if (chefFamille > 0) throw new Error("signature du chef de famille offerte à la chefferie");
  // Contrôle positif : l'écran n'est pas simplement vide.
  const sien = await cadre().getByText(/^Constater : Chefferie$/).count();
  if (sien === 0) throw new Error("la chefferie ne peut constater aucune signature — le test ne prouverait rien");
  await p5.screenshot({ path: join(DIR, "08-apercu-chefferie.png") });
});

await step("apercu-libelle-signataire-suit-le-lotissement", async () => {
  // « Chef de famille » sur un lotissement d'une seule lignée (Koelea-Accor
  // revu), « Propriétaire terrien » quand il en couvre plusieurs (Brignan).
  // La règle vit dans `@/lib/signatures-attestation`, partagée avec le web.
  await p5.getByText("Attestations (admin)").click();
  await cadre().getByText(/ATT-CESS-/).first().waitFor({ timeout: 20000 });
  const chefFamille = await cadre().getByText(/Chef de famille/).count();
  const proprioTerrien = await cadre().getByText(/Propriétaire terrien/).count();
  if (chefFamille === 0) throw new Error("« Chef de famille » absent (lotissement à famille unique)");
  if (proprioTerrien === 0) throw new Error("« Propriétaire terrien » absent (lotissement multi-familles)");
});

await step("apercu-chefferie-non-rattachee-est-expliquee", async () => {
  await p5.getByText("Attestations — compte sans juridiction").click();
  await cadre().getByText("Compte non rattaché").waitFor({ timeout: 20000 });
  // Le panneau doit REMPLACER la liste, pas s'afficher à côté d'un écran vide
  // qui se lirait « rien à signer ».
  const filtres = await cadre().getByText("À constater", { exact: false }).count();
  if (filtres > 0) throw new Error("les filtres restent affichés à une chefferie non rattachée");
  await p5.screenshot({ path: join(DIR, "09-apercu-bloquee.png") });
});

await step("apercu-operateur-sans-perimetre-est-explique", async () => {
  // Cas RÉEL (1 des 3 comptes), mais inatteignable par connexion : ce compte
  // n'est pas un compte de test. Le panneau doit nommer l'OPÉRATEUR, pas la
  // chefferie — un message générique renverrait chercher le mauvais
  // rattachement auprès de l'administration.
  await p5.getByText("Attestations — opérateur sans périmètre").click();
  await cadre().getByText("Compte non rattaché").waitFor({ timeout: 20000 });
  const bonTexte = await cadre().getByText(/rattaché à aucun opérateur/).count();
  if (bonTexte === 0) throw new Error("le panneau ne nomme pas l'opérateur");
  const mauvaisTexte = await cadre().getByText(/rattaché à aucune chefferie/).count();
  if (mauvaisTexte > 0) throw new Error("le panneau parle de chefferie a un opérateur");
});

await step("apercu-operateur-a-les-trois-signatures-et-la-remise", async () => {
  await p5.getByText("Attestations (opérateur)").click();
  await cadre().getByText(/ATT-CESS-/).first().waitFor({ timeout: 20000 });
  // Comme l'admin sur le papier : il tient le document.
  const chefFamille = await cadre().getByText("Constater : Chef de famille", { exact: true }).count();
  if (chefFamille === 0) throw new Error("l'opérateur ne peut pas constater la signature du chef de famille");
  const generer = await cadre().getByText("Générer par dérogation", { exact: true }).count();
  if (generer > 0) throw new Error("génération offerte a un opérateur dans l'aperçu");
});

await step("apercu-generation-exige-un-motif-de-10-caracteres", async () => {
  await p5.getByText("Générer par dérogation").click();
  await cadre().getByText("Lotissement", { exact: true }).first().waitFor({ timeout: 20000 });
  await cadre().getByText("Brignan Extension").click();
  await cadre().getByText(/Lot /).first().click();
  await cadre().getByText(/Dossier incomplet/).waitFor({ timeout: 20000 });
  // Le serveur refuse en dessous de 10 caractères ; l'écran doit le dire AVANT
  // l'envoi plutôt que de laisser partir un refus.
  await cadre().getByText(/Encore \d+ caractère/).waitFor({ timeout: 10000 });
  await p5.screenshot({ path: join(DIR, "10-apercu-generation.png") });
});
await p5.close();

await browser.close();
console.log("\n=== E2E ATTESTATIONS /app ===");
console.log("base:", BASE);
console.log(JSON.stringify(steps, null, 2));
console.log("erreurs page:", errors.length ? errors : "aucune");
console.log("captures:", DIR);
const echecs = steps.filter((s) => !s.ok).length;
console.log(`resultat: ${steps.length - echecs}/${steps.length}`);
process.exit(echecs > 0 ? 1 : 0);
