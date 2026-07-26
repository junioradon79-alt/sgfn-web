/**
 * Contrôle de l'ouverture d'un échange depuis l'app mobile (`/app.html`).
 *
 * ⚠️ **Lecture seule, délibérément incomplète.** Il n'existe pas
 * d'environnement de test : ce script parle à la base de PRODUCTION. Il va
 * donc jusqu'au bouton « Envoyer » et **s'arrête là** — envoyer créerait une
 * vraie conversation et un vrai message dans la boîte d'un vrai utilisateur.
 * La dernière étape se vérifie à la main, sur l'appareil.
 *
 * Ce qu'il prouve malgré tout : le point d'entrée existe, l'écran s'ouvre, la
 * liste des destinataires se remplit (donc la policy `peut_contacter` laisse
 * passer quelque chose), le choix d'un destinataire bascule vers la rédaction,
 * et le bouton d'envoi n'est actif qu'avec un message non vide.
 *
 *   MSYS_NO_PATHCONV=1 node scripts/e2e-mobile-nouveau-message.mjs
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const OUT = new URL("../.shots/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const chemin = (s) => new URL(`mobile-${s}`, OUT).pathname.replace(/^\//, "");

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

const browser = await chromium.launch({
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});
// Format téléphone : l'app se dessine dans une colonne de 480 px au plus.
const page = await browser.newPage({ viewport: { width: 412, height: 900 } });

const erreurs = [];
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(m.text());
});
page.on("pageerror", (e) => erreurs.push(String(e)));

console.log(`\n▶ App mobile — ouvrir un échange — ${BASE}\n`);

// ⚠️ En développement la route est `/app/` ; `app.html` n'existe que dans
// l'export statique (et c'est ce nom-là que charge la WebView Capacitor).
const route = BASE.includes("localhost") ? "/app/" : "/app.html";
await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);

// Connexion par le flux interne de l'app (Landing → Connexion).
await page.getByRole("button", { name: /connexion à mon espace/i }).first().click();
await page.waitForTimeout(1200);
await page.locator('input[type="email"]').fill("manuel.admin@sgfn.ci");
await page.locator('input[type="password"]').fill(env.MANUEL_TEST_PASSWORD);
await page.getByRole("button", { name: /^se connecter$/i }).click();
await page.waitForTimeout(9000);

const corps = () => page.locator("body").innerText();
// La preuve d'une session ouverte, c'est la barre d'onglets — pas le titre de
// l'écran d'accueil, qui diffère selon le rôle (Pilotage pour un admin,
// Accueil pour un citoyen) et changera encore.
// Attente explicite : sur un compte admin, la barre n'apparaît qu'une fois le
// cockpit national chargé. Un `count()` immédiat après un `waitForTimeout`
// fixe conclut à tort que la session n'est pas ouverte.
let barrePresente = true;
try {
  await page.getByRole("button", { name: /^profil$/i }).first().waitFor({ timeout: 30000 });
} catch {
  barrePresente = false;
}
verifier("Session ouverte dans l'app (barre d'onglets présente)", barrePresente);

// ── Onglet Messages ──
await page.getByRole("button", { name: /^messages$/i }).first().click();
await page.waitForTimeout(2500);
// ⚠️ Ne PAS tester `/messages/i` sur le corps : la barre d'onglets contient
// « Messages » sur TOUS les écrans, le contrôle passerait même si l'onglet
// était cassé. On cible le titre de l'écran lui-même, qui n'existe qu'ici.
const titreMessages = page.locator("div").filter({ hasText: /^Messages$/ }).first();
verifier(
  "Écran Messages affiché (titre propre à l'écran)",
  (await titreMessages.count()) > 0 &&
    /vos échanges avec les agents/i.test(await corps()),
);

const bouton = page.getByRole("button", { name: /nouveau message|écrire un message/i }).first();
verifier("Point d'entrée « Nouveau message » présent", (await bouton.count()) > 0);
await page.screenshot({ path: chemin("messages.png") });

// ── Écran de rédaction ──
await bouton.click();
await page.waitForTimeout(3500);
const surRedaction = await corps();
verifier(
  "Écran de rédaction ouvert",
  /à qui souhaitez-vous écrire/i.test(surRedaction),
  (surRedaction.match(/Nouveau message[\s\S]{0,60}/i) || [""])[0].replace(/\n/g, " · ").slice(0, 70),
);

const champRecherche = page.getByPlaceholder(/rechercher un correspondant/i);
verifier("Champ de recherche présent", (await champRecherche.count()) > 0);

// La liste vient de la policy `peut_contacter` : un compte admin voit du monde.
const nbContacts = await page.locator("button").filter({ hasText: /administration|propriétaire|acquéreur|géomètre|chefferie|opérateur/i }).count();
verifier("Des destinataires sont proposés", nbContacts > 0, `${nbContacts} entrée(s)`);
await page.screenshot({ path: chemin("destinataires.png") });

if (nbContacts > 0) {
  await page.locator("button").filter({ hasText: /administration|propriétaire|acquéreur|géomètre|chefferie|opérateur/i }).first().click();
  await page.waitForTimeout(1200);
  const surEcriture = await corps();
  verifier("Le choix d'un destinataire ouvre la rédaction", /votre message/i.test(surEcriture));
  verifier("Champ objet facultatif présent", /objet/i.test(surEcriture));

  const envoyer = page.getByRole("button", { name: /^envoyer$/i }).first();
  verifier("Bouton Envoyer désactivé tant que le message est vide", await envoyer.isDisabled());

  await page.locator("textarea").fill("Message de contrôle — non envoyé.");
  await page.waitForTimeout(400);
  verifier("Bouton Envoyer actif dès qu'un message est saisi", !(await envoyer.isDisabled()));
  await page.screenshot({ path: chemin("redaction.png") });

  // 🛑 ON N'ENVOIE PAS : la base est celle de production.
  console.log("  🛑 Envoi volontairement non déclenché (base de production).");
}

const deborde = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
);
verifier("Aucun débordement horizontal (412 px)", !deborde);

const bruit = erreurs.filter((e) => !/favicon|DevTools|Fast Refresh|manifest/i.test(e));
verifier("Aucune erreur console", bruit.length === 0, bruit.slice(0, 3).join(" | "));

await browser.close();
console.log(`\n${ko === 0 ? "✅" : "❌"} ${ok}/${ok + ko} contrôles passés — captures dans .shots/\n`);
process.exit(ko === 0 ? 0 : 1);
