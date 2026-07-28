/**
 * Parcours VENDEUR de la place de marché (TerraCI Market).
 *
 * Ce que couvre le script, et pourquoi il est coupé en deux passes :
 *
 *   1. PASSE DE LECTURE (par défaut) — n'écrit rien.
 *      Elle contrôle l'écran `/dashboard/mettre-en-vente/` et surtout la
 *      GARDE d'éligibilité, côté serveur, en appelant réellement l'edge
 *      function `publier-annonce` avec des cas qu'elle doit refuser. Les
 *      refus sortent AVANT la moindre écriture (cf. index.ts:89-92), donc
 *      la base n'est pas touchée.
 *
 *   2. PASSE D'ÉCRITURE (`--ecriture`) — écrit en PRODUCTION.
 *      Elle exige que `scripts/preparer-etat-e2e-marketplace.sql` ait été
 *      passé (il promeut UNE attestation `generee` → `delivree`, la seule
 *      façon de rendre un lot éligible). Elle publie un BROUILLON, vérifie
 *      que la section Photos se déverrouille, puis rend la main.
 *      `scripts/restaurer-etat-e2e-marketplace.sql` doit suivre.
 *
 * 🛑 Le passage en statut `active` n'est volontairement PAS exercé. Il
 *    déclenche `trg_notif_annonce_active_suivis`, qui enfile de vrais emails
 *    Resend vers les suiveurs du lot et pose `suivis_parcelle.notifie_le`
 *    — un suiveur prévenu pour une annonce de test ne le serait plus jamais
 *    pour la vraie. Le lot retenu n'a aucun suiveur aujourd'hui, mais faire
 *    dépendre l'innocuité d'un test d'un compteur qui peut changer entre
 *    deux passages n'est pas une garantie. Cette transition se vérifie à la
 *    main, en connaissance de cause.
 *
 *   node scripts/e2e-marketplace-vendeur.mjs
 *   node scripts/e2e-marketplace-vendeur.mjs --ecriture
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const ECRITURE = process.argv.includes("--ecriture");
const BASE = process.env.E2E_BASE || "http://localhost:3001";
const OUT = new URL("../.shots/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const chemin = (s) => new URL(`market-${s}`, OUT).pathname.replace(/^\//, "");

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

// Compte vendeur : profil `proprietaire_terrien` lié à l'attributaire
// AKE AMAFIN NICODEME, qui détient les lots de la fixture.
const VENDEUR = { email: "client.test@sgfn.ci", pwd: env.MANUEL_TEST_PASSWORD };

// Lot de la fixture — attestation ATT-CESS-2026-00848, AUCUN suiveur.
const LOT_FIXTURE = "04942aad-029e-4ad3-b2ec-21945cd4898a";
// Lot détenu par un AUTRE attributaire (N'CHO OHOUO BONIFACE) : sert au
// contrôle de non-appartenance.
const LOT_AUTRUI = "41a2bf6f-4609-4d8f-b75d-73211b559c02";

let ok = 0;
let ko = 0;
const verifier = (libelle, condition, detail = "") => {
  if (condition) {
    ok += 1;
    console.log(`  ✅ ${libelle}${detail ? ` — ${detail}` : ""}`);
  } else {
    ko += 1;
    console.log(`  ❌ ${libelle}${detail ? ` — ${detail}` : ""}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────
//  A. La garde serveur de `publier-annonce`
//
//  Passer par l'edge function directement, et pas par l'écran : quand aucun
//  lot n'est éligible, le formulaire ne s'affiche pas du tout, donc l'écran
//  ne peut RIEN prouver sur la garde. C'est précisément le cas aujourd'hui.
// ─────────────────────────────────────────────────────────────────────────
console.log("\n── Garde serveur `publier-annonce` ──");

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Le poste de travail sort en IPv6/NAT64 et la resolution tombe parfois en
// timeout de connexion (UND_ERR_CONNECT_TIMEOUT) sur un appel isole. On reessaie
// donc l'ouverture de session, sinon un alea reseau se lit comme un echec de
// test. Les CONTROLES eux-memes ne sont pas reessayes : un refus doit rester un
// refus du premier coup.
let sess = null;
let authErr = null;
for (let essai = 1; essai <= 3; essai += 1) {
  try {
    const r = await sb.auth.signInWithPassword({ email: VENDEUR.email, password: VENDEUR.pwd });
    authErr = r.error;
    sess = r.data?.session ?? null;
    if (sess) break;
  } catch (e) {
    authErr = e;
  }
  if (essai < 3) await new Promise((r) => setTimeout(r, 1500));
}
verifier("Connexion du vendeur en tant que client API", !!sess, authErr?.message ?? "");
if (!sess) {
  console.log("\n❌ Sans session, les contrôles de garde ne prouveraient rien. Arrêt.\n");
  process.exit(1);
}

const appeler = async (body) => {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/publier-annonce`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sess.access_token}`,
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, corps: await r.json().catch(() => ({})) };
};

const baseAnnonce = { titre: "Contrôle e2e — ne pas diffuser", prix: 1000, usage: "habitation" };

// Sans jeton : 401. La fonction ne doit pas être ouverte.
{
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/publier-annonce`, {
    method: "POST",
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ ...baseAnnonce, lot_id: LOT_FIXTURE }),
  });
  verifier("Sans jeton d'authentification → refus", r.status === 401, `HTTP ${r.status}`);
}

// Corps incomplet : 400 avant tout contrôle métier.
{
  const r = await appeler({ lot_id: LOT_FIXTURE, prix: 1000 });
  verifier("Titre absent → refus 400", r.status === 400, `HTTP ${r.status}`);
}

// Prix négatif : 400.
{
  const r = await appeler({ ...baseAnnonce, lot_id: LOT_FIXTURE, prix: -1 });
  verifier("Prix négatif → refus 400", r.status === 400, `HTTP ${r.status}`);
}

// Lot d'un AUTRE attributaire (N'CHO OHOUO BONIFACE) : 403.
//
// ⚠️ Ce contrôle ne vaut que dans la passe d'écriture. Sans fixture, AUCUNE
// attestation n'est `delivree` : la fonction refuserait ce lot de toute façon,
// faute de document, et le vert ne dirait rien de la garde de propriété. La
// fixture délivre les DEUX lots, l'un à chaque attributaire — c'est seulement
// là que le refus ne peut plus s'expliquer que par l'appartenance.
{
  const r = await appeler({ ...baseAnnonce, lot_id: LOT_AUTRUI });
  verifier(
    ECRITURE
      ? "Lot d'un autre attributaire, pourtant délivré → refus 403"
      : "Lot d'un autre attributaire → refus 403 (motif non discriminant sans fixture)",
    r.status === 403,
    `HTTP ${r.status} · ${r.corps?.error ?? ""}`,
  );
}

// Lot inexistant : 404.
{
  const r = await appeler({ ...baseAnnonce, lot_id: "00000000-0000-0000-0000-000000000000" });
  verifier("Lot inexistant → refus 404", r.status === 404, `HTTP ${r.status}`);
}

// ─────────────────────────────────────────────────────────────────────────
//  B. L'écran vendeur
// ─────────────────────────────────────────────────────────────────────────
console.log("\n── Écran /dashboard/mettre-en-vente/ ──");

const browser = await chromium.launch({
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const erreurs = [];
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(m.text());
});

// networkidle n'arrive jamais avec le HMR du serveur dev.
await page.goto(`${BASE}/login/`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#email", { timeout: 30000 });
await page.fill("#email", VENDEUR.email);
await page.fill("#password", VENDEUR.pwd);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard**", { timeout: 25000 });
verifier("Connexion du vendeur à l'écran", true, page.url());

await page.goto(`${BASE}/dashboard/mettre-en-vente/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
const corps = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
let body = await corps();
await page.screenshot({ path: chemin("vendeur.png"), fullPage: true });

verifier("L'écran s'ouvre sur TerraCI Market", /TerraCI Market/i.test(body));
verifier("La règle d'éligibilité est énoncée", /attestation ou le certificat est délivré/i.test(body));

// Le KPI « Lots éligibles » est lu dans le DOM, pas déduit du texte global.
const kpiEligibles = await page
  .locator("text=Lots éligibles")
  .locator("xpath=ancestor::*[self::div][1]/..")
  .innerText()
  .catch(() => "");
const nbEligibles = Number((kpiEligibles.match(/(\d+)/) ?? [])[1] ?? NaN);
const formulaireOuvert = (await page.locator("#lot").count()) > 0;

if (!ECRITURE) {
  // État attendu AUJOURD'HUI : aucune attestation n'est au statut `delivree`,
  // donc aucun lot n'est éligible et l'écran doit le dire franchement.
  verifier("Aucun lot éligible (état réel de la base)", nbEligibles === 0, `KPI = ${nbEligibles}`);
  verifier("L'état vide est affiché, pas un écran muet", /Aucun lot éligible pour le moment/i.test(body));
  verifier("Le formulaire reste fermé sans lot éligible", !formulaireOuvert);
} else {
  // ───────────────────────────────────────────────────────────────────────
  //  C. Passe d'écriture — exige la fixture
  // ───────────────────────────────────────────────────────────────────────
  console.log("\n── Passe d'écriture (production) ──");
  verifier("La fixture rend au moins un lot éligible", nbEligibles >= 1, `KPI = ${nbEligibles}`);
  verifier("Le formulaire s'ouvre", formulaireOuvert);

  if (formulaireOuvert) {
    await page.locator("#lot").click();
    await page.waitForTimeout(400);
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(1200);
    body = await corps();

    verifier("Le document foncier est annoncé comme délivré", /éligible/i.test(body));
    const titre = await page.locator("#titre").inputValue().catch(() => "");
    verifier("Le titre est prérempli depuis le lot", titre.trim().length > 0, titre);

    // Photos verrouillées tant que rien n'est enregistré.
    verifier(
      "Photos verrouillées avant enregistrement",
      /Enregistrez d'abord l'annonce|Enregistrez d’abord l’annonce/i.test(body),
    );

    await page.fill("#prix", "12000000");
    await page.fill("#description", "Annonce de contrôle e2e — brouillon, non diffusée.");

    // BROUILLON, jamais « active » : voir l'avertissement en tête de fichier.
    await page.locator('input[type="radio"]').first().check();
    await page.waitForTimeout(300);
    const bouton = page.getByRole("button", { name: /Enregistrer le brouillon/i });
    verifier("Le bouton bascule sur « Enregistrer le brouillon »", (await bouton.count()) > 0);

    await bouton.first().click();
    await page.waitForTimeout(6000);
    body = await corps();
    await page.screenshot({ path: chemin("brouillon.png"), fullPage: true });
    verifier("Le brouillon est enregistré", /Brouillon enregistré/i.test(body), body.slice(0, 120));

    // La preuve que l'annonce existe vraiment : la section Photos se déverrouille.
    verifier(
      "Photos déverrouillées après enregistrement",
      !/Enregistrez d'abord l'annonce|Enregistrez d’abord l’annonce/i.test(body),
    );
  }
}

const deborde = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
);
verifier("Aucun débordement horizontal", !deborde);

const bruit = erreurs.filter((e) => !/favicon|DevTools|Fast Refresh|manifest|Download the React/i.test(e));
verifier("Aucune erreur console", bruit.length === 0, bruit.slice(0, 3).join(" | "));

await browser.close();
if (ECRITURE) {
  console.log("\n  🔴 La production a été écrite. Passer maintenant :");
  console.log("     .\\scripts\\supabase-sql.ps1 -SqlFile .\\scripts\\restaurer-etat-e2e-marketplace.sql");
}
console.log(`\n${ko === 0 ? "✅" : "❌"} ${ok}/${ok + ko} contrôles passés — captures dans .shots/\n`);
process.exit(ko === 0 ? 0 : 1);
