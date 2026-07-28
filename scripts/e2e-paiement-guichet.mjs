/**
 * Ecran d'encaissement `/dashboard/paiements/` — cote navigateur.
 *
 * ⚠️ **Lecture seule, deliberement incomplete.** Ce script va jusqu'au bouton
 * « Creer » du formulaire de paiement et **s'arrete la**. Creer un paiement
 * puis le valider en production declenche un rendu PDFMonkey facture, un email
 * Resend au payeur et la consommation d'un numero de quittance qu'aucun
 * rollback ne rend.
 *
 * La chaine metier — creation, `valider_paiement_manuel`, ventilation,
 * invariant comptable, gardes de rejeu — est prouvee ailleurs, dans une
 * transaction annulee :
 *
 *   powershell> .\scripts\supabase-sql.ps1 -SqlFile .\scripts\e2e-paiement-guichet.sql
 *
 * Les deux se completent : le SQL prouve que la mecanique est juste, celui-ci
 * prouve que l'ecran y mene. Aucun des deux ne suffit seul — un mauvais nom de
 * RPC cote front echouerait silencieusement malgre un SQL vert.
 *
 *   node scripts/e2e-paiement-guichet.mjs
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE || "http://localhost:3001";
const OUT = new URL("../.shots/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const chemin = (s) => new URL(`paiement-${s}`, OUT).pathname.replace(/^\//, "");

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const ADMIN = { email: "manuel.admin@sgfn.ci", pwd: env.MANUEL_TEST_PASSWORD };

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

const browser = await chromium.launch({
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const erreurs = [];
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(m.text());
});
const corps = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();

// networkidle n'arrive jamais avec le HMR du serveur dev.
await page.goto(`${BASE}/login/`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#email", { timeout: 30000 });
await page.fill("#email", ADMIN.email);
await page.fill("#password", ADMIN.pwd);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard**", { timeout: 25000 });
verifier("Connexion de l'agent", true, page.url());

console.log("\n── Vue Registre ──");
await page.goto(`${BASE}/dashboard/paiements/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
let body = await corps();
await page.screenshot({ path: chemin("registre.png"), fullPage: true });

verifier("Le registre des transactions s'affiche", /Registre des transactions/i.test(body));
verifier(
  "L'etat vide est explicite",
  /Aucun paiement enregistre|Aucun paiement enregistré/i.test(body),
  "la base ne compte aucun paiement",
);

const boutonCreer = page.getByRole("button", { name: /Nouveau paiement/i });
verifier("Le bouton « Nouveau paiement » est offert a l'agent", (await boutonCreer.count()) > 0);

console.log("\n── Vue À valider (file de reconciliation) ──");
const ongletValider = page.getByRole("button", { name: /À valider/i });
verifier("L'onglet « À valider » existe", (await ongletValider.count()) > 0);

if ((await ongletValider.count()) > 0) {
  await ongletValider.first().click();
  await page.waitForTimeout(2500);
  body = await corps();
  await page.screenshot({ path: chemin("a-valider.png"), fullPage: true });

  // La vue est derivee de l'URL : c'est ce qui permet a la sous-entree de la
  // barre laterale d'ouvrir directement la file.
  verifier(
    "La bascule se reflete dans l'URL (?vue=reconciliation)",
    page.url().includes("vue=reconciliation"),
    page.url(),
  );
  verifier(
    "La file de validation manuelle est titree",
    /Paiements en attente de validation manuelle/i.test(body),
  );
  verifier("L'etat vide de la file est explicite", /Aucun paiement à valider|Aucun paiement a valider/i.test(body));
}

console.log("\n── Formulaire de paiement au guichet ──");
await page.goto(`${BASE}/dashboard/paiements/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
await page.getByRole("button", { name: /Nouveau paiement/i }).first().click();
await page.waitForTimeout(1500);
body = await corps();
await page.screenshot({ path: chemin("modale.png"), fullPage: true });

verifier("La modale « Nouveau paiement » s'ouvre", /Nouveau paiement/i.test(body));
verifier("Le type de paiement est demande", (await page.locator("#pay-type").count()) > 0);

// Le moyen decide du statut initial : `isMoyenManuel` (src/lib/paiements.ts)
// cree le paiement en `en_attente_validation` et non en `en_attente`. Tout le
// rail guichet tient a ce choix, donc on ne se contente pas de compter les
// champs : on ouvre la liste et on verifie que les DEUX moyens manuels y sont.
verifier("Le moyen de paiement est demande", (await page.locator("#pay-moyen").count()) > 0);

if ((await page.locator("#pay-moyen").count()) > 0) {
  await page.locator("#pay-moyen").click();
  await page.waitForTimeout(600);
  const options = (await page.locator('[role="option"]').allInnerTexts())
    .map((t) => t.trim())
    .filter(Boolean);
  verifier(
    "Les deux moyens de guichet sont proposés (espèces, virement)",
    options.some((o) => /esp[èe]ces/i.test(o)) && options.some((o) => /virement/i.test(o)),
    options.join(" · "),
  );
  // Refermer la liste sans changer la selection.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

const creer = page.getByRole("button", { name: /^Créer$/i });
verifier("Le bouton « Créer » est present", (await creer.count()) > 0);

// 🛑 ON NE CREE PAS : voir l'avertissement en tete de fichier.
console.log("  🛑 Création volontairement non déclenchée (base de production).");

const deborde = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
);
verifier("Aucun débordement horizontal", !deborde);

const bruit = erreurs.filter((e) => !/favicon|DevTools|Fast Refresh|manifest|Download the React/i.test(e));
verifier("Aucune erreur console", bruit.length === 0, bruit.slice(0, 3).join(" | "));

await browser.close();
console.log(`\n${ko === 0 ? "✅" : "❌"} ${ok}/${ok + ko} contrôles passés — captures dans .shots/\n`);
process.exit(ko === 0 ? 0 : 1);
