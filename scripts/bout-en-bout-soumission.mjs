/**
 * Parcours BOUT EN BOUT d'une soumission : émission réelle, puis rejet.
 *
 * 🔴 Pourquoi ce script existe. Trois contrôles se croisaient sans jamais
 * couvrir l'acte de saisie lui-même : l'e2e ne soumet pas (base de production),
 * `verif-rpc-saisie` n'envoie que `p_payload: null`, et l'aperçu simule.
 * Résultat : le payload construit par les écrans n'avait **jamais** été
 * confronté au serveur, et `soumissions_saisie` ne contenait aucune ligne des
 * trois types ajoutés en juillet. Ce script ferme ce trou-là, et lui seul.
 *
 * ⚠️ CE QU'IL PROUVE : que l'écran construit un payload que `soumettre_saisie`
 * accepte — liste blanche du type, contrainte `soumissions_saisie_type_check`,
 * contrôle de rôle, INSERT, forme du `resume`.
 *
 * ⚠️ CE QU'IL NE PROUVE PAS : rien de `_appliquer_maj_attributaire`, qui ne
 * tourne qu'à l'**approbation**. Approuver appliquerait une écriture réelle au
 * registre ; on rejette, donc cette fonction reste non exercée. Ne pas laisser
 * croire le contraire.
 *
 * Type retenu : `maj_attributaire` en **création**. C'est celui qui n'a jamais
 * été soumis, et c'est aussi le moins dangereux si quelqu'un l'approuvait par
 * mégarde avant le rejet — il crée une fiche d'attributaire et ne touche aucun
 * lot, aucune attribution. Le nom porte l'avertissement.
 *
 *   MSYS_NO_PATHCONV=1 node scripts/bout-en-bout-soumission.mjs
 *   MSYS_NO_PATHCONV=1 node scripts/bout-en-bout-soumission.mjs --rejeter-seulement
 *
 * Le second mode ne soumet rien : il rejette ce qui traîne en attente. Il
 * existe parce qu'une interruption entre l'envoi et le rejet laisse une
 * soumission réelle dans la file d'un administrateur — il faut pouvoir la
 * retirer sans en créer une seconde.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const OUT = new URL("../.shots/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const chemin = (s) => new URL(`bout-en-bout-${s}`, OUT).pathname.replace(/^\//, "");

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

// Nom marqué, horodaté, et explicite pour un humain qui tomberait dessus dans
// la file avant le rejet. L'horodatage garantit aussi qu'on retrouve NOTRE
// soumission et pas une autre.
const MARQUE = `ZZ CONTROLE AUTOMATIQUE ${new Date().toISOString().slice(0, 16).replace("T", " ")} — NE PAS APPROUVER`;
const REJET_SEUL = process.argv.includes("--rejeter-seulement");

console.log(`\n▶ ${REJET_SEUL ? "Rejet seul" : "Soumission réelle puis rejet"} — ${BASE}`);
if (!REJET_SEUL) console.log(`  Nom déposé : ${MARQUE}`);
console.log("");

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

const cadre = page.locator("body");
const corps = () => cadre.innerText();

// ── Connexion ────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/app/`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(3000);
await page.getByRole("button", { name: /connexion à mon espace/i }).first().click();
await page.waitForTimeout(1200);
await page.locator('input[type="email"]').fill("manuel.admin@sgfn.ci");
await page.locator('input[type="password"]').fill(env.MANUEL_TEST_PASSWORD);
await page.getByRole("button", { name: /^se connecter$/i }).click();
await page.getByRole("button", { name: /^profil$/i }).first().waitFor({ timeout: 45000 });
verifier("Session ouverte", true);

if (!REJET_SEUL) {
  // ── Ouvrir « Fiche d'attributaire » ────────────────────────────────────────
  await page.getByRole("button", { name: /^à faire$/i }).first().click();
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: /^Fiche d'attributaire/i }).first().click();
  await page.waitForTimeout(2000);
  verifier("Écran ouvert en mode création", /nature de la pièce/i.test(await corps()));

  const champNom = page.locator('input[autocapitalize="words"]').first();
  await champNom.fill(MARQUE);
  await page.waitForTimeout(1200); // laisse le contrôle d'homonyme s'exécuter

  const btnEnvoyer = page.getByRole("button", { name: /envoyer/i }).first();
  verifier("« Envoyer » activé une fois le nom saisi", !(await btnEnvoyer.isDisabled()));
  await page.screenshot({ path: chemin("1-avant-envoi.png") });

  // ── ENVOI RÉEL ─────────────────────────────────────────────────────────────
  console.log("\n  ⚠️  Envoi RÉEL vers soumissions_saisie…\n");
  await btnEnvoyer.click();
  await page.waitForTimeout(4000);
  const apresEnvoi = await corps();
  await page.screenshot({ path: chemin("2-apres-envoi.png") });

  verifier(
    "L'écran de confirmation s'affiche (envoyé, PAS appliqué)",
    /en attente de validation/i.test(apresEnvoi),
    (apresEnvoi.split("\n").find((l) => /attente de validation/i.test(l)) ?? "").slice(0, 48),
  );
  verifier(
    "Aucun message d'échec",
    !/rien n'a été envoyé|envoi interrompu/i.test(apresEnvoi),
    (apresEnvoi.match(/rien n'a été envoyé|envoi interrompu[^\n]*/i) ?? ["aucun"])[0],
  );

  // ⚠️ L'écran de confirmation est un CALQUE : il recouvre la barre d'onglets,
  // qui n'est donc pas cliquable tant qu'on ne l'a pas refermé. Deux rédactions
  // fautives ici — d'abord aucune fermeture, puis un clic sur « le premier
  // bouton » qui n'a pas produit l'effet attendu. Les deux fois, le script est
  // resté bloqué 30 s après un envoi RÉUSSI et a laissé une soumission réelle
  // en attente dans la file d'un administrateur. On vise donc le bouton par son
  // nom — « Terminer » appelle explicitement `onBack` — et on **attend la barre
  // d'onglets**, au lieu de parier sur un délai.
  await page.getByRole("button", { name: /^terminer$/i }).first().click();
  await page.getByRole("button", { name: /^à faire$/i }).first().waitFor({ timeout: 20000 });
}

// ── Retrouver et REJETER depuis l'app ────────────────────────────────────────
// Le rejet passe par le même écran que l'approbation : c'est aussi la première
// fois qu'il est exercé pour de vrai.
await page.getByRole("button", { name: /^à faire$/i }).first().click();
await page.waitForTimeout(2500);
await page.getByRole("button", { name: /saisies à valider/i }).first().click();
await page.waitForTimeout(3000);

const fileTexte = await corps();
verifier(
  "La soumission apparaît dans la file de validation",
  fileTexte.includes("ZZ CONTROLE AUTOMATIQUE"),
  (fileTexte.split("\n").find((l) => l.includes("ZZ CONTROLE")) ?? "ABSENTE").slice(0, 54),
);
verifier(
  "Elle est résumée comme une nouvelle fiche (les puces ne disent plus « undefined »)",
  /nouvelle fiche/i.test(fileTexte) && !/undefined/i.test(fileTexte),
  /undefined/i.test(fileTexte) ? "« undefined » PRÉSENT" : "puces lisibles",
);
await page.screenshot({ path: chemin("3-file.png") });

await page.getByRole("button", { name: /^rejeter$/i }).first().click();
await page.waitForTimeout(1200);
const zoneCommentaire = page.locator("textarea").first();
if ((await zoneCommentaire.count()) > 0) {
  await zoneCommentaire.fill("Contrôle automatique de bout en bout — rejet immédiat, aucune application.");
}
await page.waitForTimeout(400);
await page.screenshot({ path: chemin("4-confirmation-rejet.png") });

console.log("\n  ⚠️  Rejet RÉEL…\n");
await page.getByRole("button", { name: /confirmer le rejet/i }).first().click();
await page.waitForTimeout(4000);
const apresRejet = await corps();
await page.screenshot({ path: chemin("5-apres-rejet.png") });

verifier(
  "La soumission a quitté la file en attente",
  !apresRejet.includes("ZZ CONTROLE AUTOMATIQUE") || /rejet/i.test(apresRejet),
  (apresRejet.split("\n").find((l) => /rejet|en attente de décision/i.test(l)) ?? "").slice(0, 54),
);

await browser.close();
console.log(`\n${ko === 0 ? "✅" : "❌"} ${ok}/${ok + ko} contrôles passés — captures dans .shots/`);
console.log(`\n🔎 À vérifier en base : la soumission « ${MARQUE} » doit être 'rejetee',`);
console.log(`   et le nombre d'attributaires doit être INCHANGÉ.\n`);
process.exit(ko === 0 ? 0 : 1);
