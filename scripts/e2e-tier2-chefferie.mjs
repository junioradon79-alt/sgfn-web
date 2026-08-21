// Vérification navigateur du portage "Tier 2" (APFC + AAL) côté mobile
// chefferie, sur le modèle des scripts scripts/e2e-app-*.mjs du dépôt.
//
// ✅ Déployé depuis le 21/08/2026 (commit 9c0f586, poussé sur master). Ce
// portage (`ProApp.tsx`, `roles.ts`, `AttestationsScreen.tsx`,
// `useValidationsChefferie.ts`) fait désormais partie de ce que `sgfn.ci`
// sert sur le WEB — vérifié 9/9 contre la prod le jour du commit. Cible
// locale par défaut ci-dessous, mais `E2E_BASE=https://sgfn.ci node
// scripts/e2e-tier2-chefferie.mjs` est maintenant le bon choix pour vérifier
// directement contre la production — `.env.local` pointe de toute façon le
// serveur local vers le MÊME projet Supabase que la prod, donc les données
// lues sont déjà les données réelles des deux côtés.
//
// ⚠️ Ce que ce déploiement NE couvre PAS : l'APK Android n'a pas été
// reconstruite depuis le 28/07 (1.4.0) — une chefferie sur l'app installée
// ne voit ni APFC ni AAL tant qu'une nouvelle APK n'est pas produite.
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
const EMAIL = "manuel.chefferie@sgfn.ci";
const BASE = process.env.E2E_BASE || "http://localhost:3000";
const DIR = join(tmpdir(), "sgnf-tier2-chefferie");
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
page.on("response", async (resp) => {
  const u = resp.url();
  if (u.includes("/rest/v1/") && resp.status() >= 400) {
    let body = ""; try { body = (await resp.text()).slice(0, 200); } catch {}
    errors.push(`REST ${resp.status()}: ${u.split("/rest/v1/")[1]?.slice(0, 80)} — ${body}`);
  }
});

const steps = [];
// Garde contre une capture de page blanche (signature d'un `page.goto` raté) :
// vérifie qu'il y a du texte rendu avant d'accepter la capture.
const shot = async (name) => {
  await page.screenshot({ path: join(DIR, name) });
  const texte = (await page.locator("body").innerText()).trim();
  if (texte.length < 20) throw new Error(`Page blanche détectée sur ${name} (texte=${JSON.stringify(texte)})`);
};
const step = async (name, fn) => {
  try { await fn(); steps.push({ name, ok: true }); }
  catch (e) { steps.push({ name, ok: false, error: String(e.message ?? e).slice(0, 300) }); }
};

await step("login", async () => {
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByText("Connexion à mon espace").click();
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PWD);
  await page.locator('button[type="submit"]').click();
  await page.getByText("Saisir dans le registre").waitFor({ timeout: 60000 });
  await shot("01-accueil-saisie.png");
});

await step("ouvrir-onglet-attestations", async () => {
  await page.getByText("Attestations", { exact: true }).click();
  await page.waitForTimeout(1500);
  await shot("02-attestations.png");
});

await step("section-apfc-presente", async () => {
  await page.getByText("APFC — à co-signer", { exact: true }).waitFor({ timeout: 20000 });
});

await step("section-aal-presente", async () => {
  await page.getByText("Attribution de lot — à signer", { exact: true }).waitFor({ timeout: 20000 });
});

await step("apfc-carte-visible", async () => {
  // La seule APFC de production (Ebimpe) a déjà sa signature chef de village
  // posée (la signature CVGFR, elle, manque toujours — sans effet ici, la
  // chefferie mobile n'appelle que p_signature: "chef_village") : elle doit
  // donc apparaître avec le badge "Validé", pas de bouton actionnable.
  await page.getByText("APFC-EBIMPE-2022-001").waitFor({ timeout: 20000 });
});

// 🔴 Étape séparée de "apfc-carte-visible" ci-dessus (et non enregistrée à
// l'intérieur de son callback) : si l'englobante lève avant d'atteindre cette
// assertion, celle-ci doit tout de même apparaître dans le rapport, au rouge —
// pas disparaître du tableau `steps` comme si elle n'avait jamais existé.
await step("apfc-badge-valide-present", async () => {
  const valide = await page.getByText("Validé", { exact: true }).count();
  if (valide === 0) throw new Error("badge Validé absent");
});

await step("aal-vide", async () => {
  // 0 ligne en production au 17/08/2026 : l'état vide doit s'afficher.
  await page.getByText("Aucune Attestation d'Attribution de Lot en attente.").waitFor({ timeout: 20000 });
});

await step("cessions-toujours-la", async () => {
  await page.getByText("Cessions — Niveau 1", { exact: true }).waitFor({ timeout: 20000 });
  await shot("03-attestations-scroll.png");
});

await step("badge-onglet-coherent", async () => {
  // 🔴 Assertion réelle, pas une capture qui reste verte quoi qu'il arrive :
  // le badge numérique de l'onglet "Attestations" (TabBar, bas d'écran) doit
  // correspondre à la somme cessions + APFC actionnables + AAL actionnables.
  // Les deux derniers valent 0 dans l'état de production connu (étapes
  // ci-dessus : l'unique APFC a déjà sa signature chef de village posée
  // (0 actionnable côté chefferie mobile), l'AAL est vide) —
  // le badge doit donc être EXACTEMENT égal au chiffre du chip "À constater",
  // qui compte les mêmes cessions (cf. `AttestationsScreen`, onglet `signer`).
  const chipTexte = await page.locator("button", { hasText: "À constater" }).first().innerText();
  const chipMatch = chipTexte.match(/(\d+)\s*$/);
  if (!chipMatch) throw new Error(`chip "À constater" illisible : ${JSON.stringify(chipTexte)}`);
  const attenduCessions = Number(chipMatch[1]);

  const badgeSpan = page.locator("nav button", { hasText: "Attestations" }).locator(".tabular");
  const badgeCount = await badgeSpan.count();
  const badgeTexte = badgeCount > 0 ? (await badgeSpan.innerText()).trim() : "0";

  if (attenduCessions > 0 && badgeCount === 0) {
    throw new Error(
      `badge Attestations absent alors que ${attenduCessions} cession(s) attendent une signature`,
    );
  }
  if (attenduCessions === 0 && badgeCount > 0) {
    throw new Error(
      `badge Attestations affiché (${badgeTexte}) alors qu'aucune cession n'attend de signature ` +
        `(APFC et AAL valent 0 en production)`,
    );
  }
  if (badgeTexte !== "99+" && Number(badgeTexte) !== attenduCessions) {
    throw new Error(
      `badge Attestations = ${badgeTexte}, attendu ${attenduCessions} (APFC et AAL valent 0 en production)`,
    );
  }

  await shot("04-tabbar.png");
});

await browser.close();
console.log("\n=== E2E TIER2 CHEFFERIE (APFC + AAL mobile) ===");
console.log("base:", BASE, "| compte:", EMAIL);
console.log(JSON.stringify(steps, null, 2));
console.log("erreurs page/console:", errors.length ? errors : "aucune");
console.log("captures:", DIR);
const echecs = steps.filter((s) => !s.ok).length;
console.log(`resultat: ${steps.length - echecs}/${steps.length}`);
// 🔴 Une étape en échec — ou une erreur JS/REST non rattrapée — doit sortir en
// échec. `console.log` seul (l'ancien comportement) laissait `EXIT CODE = 0`
// même avec 5 étapes sur 9 en échec : le script ne prouvait rien à la CI ni à
// un enchaînement de commandes. Même convention que
// `e2e-app-attestations.mjs`.
process.exit(echecs > 0 || errors.length > 0 ? 1 : 0);
