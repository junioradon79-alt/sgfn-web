/**
 * Le chef affiché sur un acte est celui qui était EN FONCTION À SA DATE.
 *
 * Défaut d'origine (29/07/2026) : `verifier_document` lisait
 * `autorites_coutumieres.chef`, c'est-à-dire le chef COURANT. L'APFC de
 * Koelea-Accor, délivrée le 10/02/2022 et signée par NANAN AFFA KOUACHY ALFRED,
 * s'affichait publiquement au nom de HOBI MONDON ATSIN PACOME — nommé par
 * l'arrêté 38/PA/SG/D1 du 12/05/2023, quinze mois plus tard.
 *
 * Ce script vérifie la page publique telle qu'un citoyen la voit, pas la base :
 * la requête SQL a déjà été contrôlée à l'application de la migration, et c'est
 * l'écran qui pouvait encore trahir le contenu (libellé « Chef » ambigu).
 *
 *   node scripts/e2e-chef-signataire-apfc.mjs
 *   E2E_BASE=https://sgfn.ci node scripts/e2e-chef-signataire-apfc.mjs
 *
 * ⚠️ Lecture seule — n'écrit rien, ne consomme aucun quota de vérification
 * (l'APFC est gratuite, cf. verification-qr : seules les cessions sont payantes).
 */
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const REF = "APFC-EBIMPE-2022-001";

const SIGNATAIRE = "NANAN AFFA KOUACHY ALFRED"; // chef à la délivrance (10/02/2022)
const CHEF_ACTUEL = "HOBI MONDON ATSIN PACOME"; // nommé le 12/05/2023 — ne doit PAS apparaître

const controles = [];
const noter = (ok, libelle, detail = "") =>
  controles.push({ ok, libelle, detail });

const browser = await chromium.launch({
  // Cf. mémoire « connectivite_dns_securise_chrome » : sans ces drapeaux
  // Chromium ne joint pas Supabase et la page se lit vide — ce qui ferait
  // passer les contrôles « absent » au vert pour une mauvaise raison.
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

const erreurs = [];
page.on("console", (m) => m.type() === "error" && erreurs.push(m.text()));
page.on("pageerror", (e) => erreurs.push(String(e)));

await page.goto(`${BASE}/verifier?ref=${encodeURIComponent(REF)}`, {
  waitUntil: "networkidle",
  timeout: 45000,
});
await page.waitForTimeout(4000);

// ⚠️ `innerText` rend le texte APRÈS transformation CSS : les libellés de cette
// fiche sont en `text-transform: uppercase`, et une comparaison sensible à la
// casse échoue sur un écran pourtant correct (piège déjà rencontré sur le relevé
// comptable). On normalise casse ET apostrophes (typographique vs droite).
const brut = await page.locator("body").innerText();
const texte = brut.replace(/[’ʼ]/g, "'");
const norm = (s) => s.replace(/[’ʼ]/g, "'").toLocaleUpperCase("fr-FR");
const contientLibelle = (s) => norm(texte).includes(norm(s));

// 1. La page a bien trouvé le document — sans quoi tout le reste est vide et
//    les contrôles d'absence passeraient au vert à tort.
noter(texte.includes(REF), "le document est trouvé", REF);

// 2. Le signataire historique est affiché.
noter(texte.includes(SIGNATAIRE), "le signataire de 2022 est affiché", SIGNATAIRE);

// 3. Le chef actuel n'apparaît nulle part sur cet acte.
noter(!texte.includes(CHEF_ACTUEL), "le chef nommé en 2023 n'apparaît pas", CHEF_ACTUEL);

// 4. Le libellé ne dit plus « Chef » tout court.
noter(contientLibelle("Chef signataire de l'acte"), "le libellé lève l'ambiguïté");

// 4 bis. Et l'ancien libellé « Chef » seul a bien disparu — sans quoi le
//        contrôle précédent passerait au vert avec les deux libellés à l'écran.
noter(!/^\s*CHEF\s*$/im.test(texte), "l'ancien libellé « Chef » seul a disparu");

// 5. La date de délivrance est bien celle de 2022 (garantit qu'on lit le bon acte).
noter(/10 f[ée]vrier 2022|2022-02-10|10\/02\/2022/i.test(texte), "date de délivrance 2022 affichée");

// 6. Aucune erreur console.
noter(erreurs.length === 0, "aucune erreur console", erreurs.slice(0, 3).join(" | "));

await page.screenshot({ path: ".shots/verifier-apfc-chef.png", fullPage: true });
await browser.close();

let echecs = 0;
for (const c of controles) {
  if (!c.ok) echecs++;
  console.log(`${c.ok ? "  ok" : "ECHEC"}  ${c.libelle}${c.detail ? `  — ${c.detail}` : ""}`);
}
console.log(`\n${controles.length - echecs}/${controles.length} contrôles`);
process.exit(echecs > 0 ? 1 : 0);
