/**
 * Contrôle du relevé comptable imprimable (/dashboard/comptabilite).
 *
 * Vérifie ce qu'une capture d'écran seule ne montre pas :
 *  - que les filtres (période, postes de dépenses, sections) recalculent bien
 *    les KPI et pas seulement l'affichage des listes ;
 *  - que le rendu **media=print** existe et diffère de l'écran (chrome masqué,
 *    en-tête de relevé présent) — c'est le seul moyen de voir ce qui sortira
 *    de l'imprimante sans imprimer ;
 *  - la pagination réelle du document via un export PDF Playwright ;
 *  - les erreurs console et le débordement horizontal.
 *
 *   MSYS_NO_PATHCONV=1 node scripts/e2e-releve-comptable.mjs
 *
 * Par défaut le serveur local ; E2E_BASE pour viser ailleurs. Sorties dans
 * .shots/ (non suivi). Lecture seule : aucune dépense/apport n'est créé.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const OUT = new URL("../.shots/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const chemin = (s) => new URL(`releve-${s}`, OUT).pathname.replace(/^\//, "");

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

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

// Cf. mémoire projet « connectivite_dns_securise_chrome » : sans ces drapeaux,
// Chromium résout Supabase en DoH et l'écran se photographie vide.
const browser = await chromium.launch({
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

const erreurs = [];
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(m.text());
});
page.on("pageerror", (e) => erreurs.push(String(e)));

console.log(`\n▶ Relevé comptable — ${BASE}\n`);

await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForSelector("#email", { timeout: 20000 });
await page.fill("#email", "manuel.admin@sgfn.ci");
await page.fill("#password", env.MANUEL_TEST_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard**", { timeout: 25000 });

await page.goto(`${BASE}/dashboard/comptabilite`, { waitUntil: "networkidle" });
await page.waitForTimeout(9000);

// ── 1. L'écran est bien monté et porte ses sections ──
const texte = () => page.locator("main").innerText();
const t0 = await texte();
verifier("Écran chargé (titre Comptabilité)", t0.includes("Comptabilité"));
verifier("Section Recettes présente", /Recettes \(\d+\)/.test(t0));
verifier("Section Dépenses présente", /Dépenses \(\d+\)/.test(t0));
verifier("Section Apports présente", /Apports \(\d+\)/.test(t0));
// ⚠️ `innerText` applique les CSS de casse : ce titre est en `uppercase`, il
// ressort « RÉCAPITULATIF ». Tous les tests de texte ici sont donc insensibles
// à la casse — sinon le contrôle échoue sur un écran parfaitement correct.
verifier("Récapitulatif présent", /récapitulatif/i.test(t0));
verifier("Bouton Imprimer présent", (await page.getByRole("button", { name: "Imprimer" }).count()) > 0);

await page.screenshot({ path: chemin("ecran-clair.png"), fullPage: true });

// ── 2. Les filtres recalculent réellement les agrégats ──
const soldeAffiche = async () => {
  const bloc = page.locator("dl").last();
  return (await bloc.innerText()).replace(/\s+/g, " ");
};
const recapTout = await soldeAffiche();

// Période « Ce mois » : le libellé de période doit cesser de dire « toutes périodes ».
await page.getByRole("button", { name: "Ce mois", exact: true }).click();
await page.waitForTimeout(700);
const tMois = await texte();
verifier(
  "Filtre période applique un intervalle daté",
  /récapitulatif — du \d{2}\/\d{2}\/\d{4} au \d{2}\/\d{2}\/\d{4}/i.test(tMois),
  (tMois.match(/récapitulatif — [^\n]+/i) || [""])[0],
);

// Décocher tous les postes doit vider les dépenses (et donc leur total).
await page.getByRole("button", { name: "Ce trimestre", exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Tout décocher", exact: true }).click();
await page.waitForTimeout(700);
const tSansPostes = await texte();
verifier("Décocher tous les postes vide la section Dépenses", /Dépenses \(0\)/.test(tSansPostes));

// Réactiver, puis exclure une section entière du relevé.
await page.getByRole("button", { name: "Tout cocher", exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Apports", exact: true }).click();
await page.waitForTimeout(700);
const tSansApports = await texte();
verifier(
  "Décocher la section Apports la retire du relevé",
  !/Apports \(\d+\)/.test(tSansApports) && tSansApports.includes("Section exclue du relevé"),
);

// Retour à l'état complet.
await page.getByRole("button", { name: "Réinitialiser", exact: true }).click();
await page.waitForTimeout(800);
const recapRetour = await soldeAffiche();
verifier("Réinitialiser restaure le récapitulatif d'origine", recapRetour === recapTout, recapRetour);

// ── 3. Débordement horizontal ──
const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
verifier("Aucun débordement horizontal (1600 px)", !deborde);

// ── 4. Le rendu d'impression ──
await page.emulateMedia({ media: "print" });
await page.waitForTimeout(600);
const tPrint = await page.locator("body").innerText();
verifier("En-tête de relevé visible à l'impression", tPrint.includes("SGNF — Relevé comptable"));
verifier("Période imprimée sur le document", /Période\s*:/.test(tPrint));
verifier("Mention « Document interne, non opposable »", tPrint.includes("non opposable"));
verifier("Barre de filtres masquée à l'impression", !tPrint.includes("Postes de dépenses"));
verifier("Bouton Imprimer masqué à l'impression", !/\bImprimer\b/.test(tPrint));

// La barre latérale et l'en-tête applicatif ne doivent pas sortir sur papier.
const chromeVisible = await page.evaluate(() => {
  const aside = document.querySelector("aside");
  const header = document.querySelector("header.sticky");
  const visible = (el) => !!el && getComputedStyle(el).display !== "none";
  return { aside: visible(aside), header: visible(header) };
});
verifier("Barre latérale masquée à l'impression", !chromeVisible.aside);
verifier("En-tête applicatif masqué à l'impression", !chromeVisible.header);

await page.screenshot({ path: chemin("apercu-print.png"), fullPage: true });
await page.pdf({ path: chemin("document.pdf"), format: "A4", printBackground: true, margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" } });

// ── 5. Console ──
const bruit = erreurs.filter((e) => !/favicon|Download the React DevTools/i.test(e));
verifier("Aucune erreur console", bruit.length === 0, bruit.slice(0, 3).join(" | "));

await browser.close();

console.log(`\n${ko === 0 ? "✅" : "❌"} ${ok}/${ok + ko} contrôles passés — captures dans .shots/\n`);
process.exit(ko === 0 ? 0 : 1);
