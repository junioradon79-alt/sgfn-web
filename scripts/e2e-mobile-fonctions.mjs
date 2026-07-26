/**
 * Contrôle des 4 fonctionnalités d'écriture ajoutées à l'app mobile.
 *
 * ⚠️ **Lecture seule, délibérément incomplète.** Il n'existe pas d'environnement
 * de test : ce script parle à la base de PRODUCTION. Il va donc jusqu'aux
 * boutons qui engagent (« Enregistrer », « Envoyer », « Confirmer le rejet »)
 * et **s'arrête là** — approuver une soumission appliquerait de vraies
 * attributions foncières, et enregistrer modifierait un vrai profil.
 *
 * Deux terrains :
 *   • `/apercu-mobile` — les écrans citoyen montés avec des données simulées.
 *     Ils sont inatteignables autrement : le seul compte de test est un
 *     administrateur, donc la coquille rend `AdminApp`.
 *   • `/app/` — parcours réel sur compte admin, pour prouver que les écrans
 *     s'ouvrent DANS l'app et ne partent plus vers le dashboard web.
 *
 *   MSYS_NO_PATHCONV=1 node scripts/e2e-mobile-fonctions.mjs
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const OUT = new URL("../.shots/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const chemin = (s) => new URL(`fonctions-${s}`, OUT).pathname.replace(/^\//, "");

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

/** Contraste WCAG mesuré sur les couleurs CALCULÉES, jamais estimé : une
 *  classe Tailwind inconnue ne lève aucune erreur, elle ne peint rien.
 *  ⚠️ Passée en FONCTION à `evaluate` : une chaîne y serait évaluée comme une
 *  expression et ne recevrait jamais l'élément. */
const CONTRASTE = (el) => {
  const lum = (c) => {
    const [r, g, b] = c.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const lire = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
  const st = getComputedStyle(el);
  let fond = st.backgroundColor;
  let p = el;
  while (p && (fond === "rgba(0, 0, 0, 0)" || fond === "transparent")) {
    p = p.parentElement;
    if (!p) break;
    fond = getComputedStyle(p).backgroundColor;
  }
  const a = lum(lire(st.color));
  const b = lum(lire(fond || "rgb(255,255,255)"));
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return { ratio: Math.round(ratio * 100) / 100, couleur: st.color, fond };
};

const browser = await chromium.launch({
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});
const page = await browser.newPage({ viewport: { width: 412, height: 900 } });

const erreurs = [];
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(m.text());
});
page.on("pageerror", (e) => erreurs.push(String(e)));

const corps = () => page.locator("body").innerText();

// ══ 1. Écrans citoyen, sur l'aperçu ═══════════════════════════════════════════
console.log(`\n▶ Écrans mobiles — aperçu (composants réels) — ${BASE}\n`);
await page.goto(`${BASE}/apercu-mobile/`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1500);

verifier("La route d'aperçu répond avec du contenu", (await corps()).includes("Aperçu"));

// ── Profil ──
await page.locator('[data-apercu="profil"]').click();
await page.waitForTimeout(700);
const surProfil = await corps();
verifier("Écran d'édition du profil rendu", /gérer mon profil/i.test(surProfil));
verifier(
  "E-mail et rôle affichés en lecture seule",
  /adresse e-mail/i.test(surProfil) &&
    /gérés par l'administration/i.test(surProfil.replace(/’/g, "'")),
);

const cadre = page.locator("[data-apercu-cadre]");
const champNom = cadre.locator('input[autocapitalize="words"]').first();
const champTel = cadre.locator('input[type="tel"]').first();
verifier("Champs nom et téléphone présents", (await champNom.count()) > 0 && (await champTel.count()) > 0);
verifier("Le nom est pré-rempli depuis le profil", (await champNom.inputValue()).length > 0);

const btnEnregistrer = cadre.getByRole("button", { name: /^enregistrer$/i }).first();
verifier("« Enregistrer » désactivé tant que rien n'a changé", await btnEnregistrer.isDisabled());
await champNom.fill("Konan Yao Bernard MODIFIÉ");
await page.waitForTimeout(300);
verifier("« Enregistrer » s'active dès qu'un champ change", !(await btnEnregistrer.isDisabled()));

// Validation du mot de passe — aucune requête, tout est refusé côté écran.
const mdps = cadre.locator('input[autocomplete="new-password"]');
const btnMdp = cadre.getByRole("button", { name: /mettre à jour le mot de passe/i }).first();
verifier("« Mettre à jour le mot de passe » désactivé si les champs sont vides", await btnMdp.isDisabled());
await mdps.nth(0).fill("court");
await mdps.nth(1).fill("court");
await btnMdp.click();
await page.waitForTimeout(400);
verifier("Un mot de passe trop court est refusé", /au moins 8 caractères/i.test(await corps()));
await mdps.nth(0).fill("motdepasse123");
await mdps.nth(1).fill("motdepasse456");
await btnMdp.click();
await page.waitForTimeout(400);
verifier("Deux mots de passe différents sont refusés", /ne correspondent pas/i.test(await corps()));
await page.screenshot({ path: chemin("profil.png") });

// ── Signalement ──
await page.locator('[data-apercu="signalement"]').click();
await page.waitForTimeout(700);
const surSignalement = await corps();
verifier("Écran de signalement rendu", /signaler un problème/i.test(surSignalement));
verifier(
  "Les objets fréquents sont proposés en pastilles",
  /occupation illégale/i.test(surSignalement) &&
    /bornage contesté/i.test(surSignalement) &&
    /double attribution/i.test(surSignalement),
);
const btnEnvoyer = cadre.getByRole("button", { name: /envoyer|transmettre/i }).first();
verifier("Envoi désactivé tant qu'aucun objet n'est choisi", await btnEnvoyer.isDisabled());
await cadre.getByRole("button", { name: /^autre$/i }).first().click();
await page.waitForTimeout(400);
verifier(
  "« Autre » ouvre la saisie libre",
  (await cadre.locator('input[placeholder*="Précisez"]').count()) > 0,
);
verifier("Envoi encore désactivé tant que le champ libre est vide", await btnEnvoyer.isDisabled());
await cadre.getByRole("button", { name: /occupation illégale/i }).first().click();
await page.waitForTimeout(400);
verifier("Choisir un objet active l'envoi", !(await btnEnvoyer.isDisabled()));
await page.screenshot({ path: chemin("signalement.png") });
console.log("  🛑 Envoi volontairement non déclenché (base de production).");

// ── Notifications ──
await page.locator('[data-apercu="notifications"]').click();
await page.waitForTimeout(700);
const surNotifs = await corps();
verifier("Écran Notifications rendu", /notifications/i.test(surNotifs));
verifier("Le nombre de non-lues est annoncé", /2\s*nouvelle/i.test(surNotifs), (surNotifs.match(/\d+\s*nouvelle\w*/i) || [""])[0]);

// Contrastes sur les deux thèmes — c'est ici qu'une classe fantôme se voit.
//
// ⚠️ Le seuil n'est PAS assoupli pour faire passer le test. On mesure d'abord
// le plancher du design system lui-même — `--muted-foreground` sur le canvas,
// le texte secondaire le plus pâle que le DS assume — puis on exige que rien
// ne soit pire. En thème clair ce plancher vaut ~4,48:1, donc sous AA : c'est
// un fait du DS, antérieur à ce chantier et commun aux 309 usages du jeton.
// Le test signale l'écart au lieu de le masquer, et échoue dès qu'un élément
// descend SOUS ce plancher — ce qui est le vrai signe d'une régression.
for (const theme of ["clair", "sombre"]) {
  if (theme === "sombre") {
    await page.getByRole("button", { name: /thème sombre/i }).click();
    await page.waitForTimeout(600);
  }

  // ⚠️ La sonde s'insère DANS le cadre, pas dans `body` : le thème sombre est
  // porté par un ancêtre `.dark`, une sonde posée à la racine mesurerait
  // toujours le thème clair (piège déjà rencontré avec les portails Radix).
  // Fond `inset` et non `background` : c'est la surface la plus contrastante
  // sur laquelle le DS pose légitimement du texte secondaire.
  const plancherDS = await cadre.evaluate((hote) => {
    const sonde = document.createElement("span");
    sonde.className = "text-muted-foreground bg-inset";
    sonde.textContent = "sonde";
    hote.appendChild(sonde);
    const st = getComputedStyle(sonde);
    const lire = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
    const lum = (c) =>
      c
        .map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        })
        .reduce((acc, v, i) => acc + [0.2126, 0.7152, 0.0722][i] * v, 0);
    const a = lum(lire(st.color));
    const b = lum(lire(st.backgroundColor));
    sonde.remove();
    return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
  });

  const cibles = await cadre.locator("div,span,p").filter({ hasText: /.+/ }).all();
  let pire = { ratio: 99, texte: "" };
  let mesures = 0;
  for (const el of cibles.slice(0, 60)) {
    const txt = (await el.innerText().catch(() => "")).trim();
    if (!txt || txt.length > 60) continue;
    const taille = await el.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    const enfants = await el.evaluate((e) => e.children.length);
    if (enfants > 0 || taille >= 18) continue;
    const m = await el.evaluate(CONTRASTE);
    mesures += 1;
    if (m.ratio < pire.ratio) pire = { ratio: m.ratio, texte: txt.slice(0, 30) };
  }

  const seuil = Math.min(4.5, plancherDS);
  verifier(
    `Contraste en thème ${theme} — rien sous le plancher du DS (${plancherDS}:1)`,
    mesures > 0 && pire.ratio >= seuil - 0.01,
    `${mesures} mesures, pire ${pire.ratio}:1 sur « ${pire.texte} »` +
      (plancherDS < 4.5 ? ` · ⚠️ le DS lui-même est sous AA (4,5:1)` : ""),
  );
}
await page.screenshot({ path: chemin("notifications.png") });

const deborde = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
);
verifier("Aucun débordement horizontal (412 px)", !deborde);

// ══ 2. Parcours réel dans l'app, compte admin ═════════════════════════════════
console.log(`\n▶ App mobile — parcours réel (compte admin)\n`);
await page.goto(`${BASE}/app/`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(3000);
await page.getByRole("button", { name: /connexion à mon espace/i }).first().click();
await page.waitForTimeout(1200);
await page.locator('input[type="email"]').fill("manuel.admin@sgfn.ci");
await page.locator('input[type="password"]').fill(env.MANUEL_TEST_PASSWORD);
await page.getByRole("button", { name: /^se connecter$/i }).click();

let connecte = true;
try {
  await page.getByRole("button", { name: /^profil$/i }).first().waitFor({ timeout: 45000 });
} catch {
  connecte = false;
}
verifier("Session ouverte dans l'app", connecte);

if (connecte) {
  // ── Le profil s'édite DANS l'app ──
  const urlAvant = page.url();
  await page.getByRole("button", { name: /^profil$/i }).first().click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /gérer mon profil/i }).first().click();
  await page.waitForTimeout(1800);
  verifier(
    "« Gérer mon profil » ouvre l'écran DANS l'app (plus de sortie vers le web)",
    page.url() === urlAvant && /coordonnées et mot de passe/i.test(await corps()),
    page.url().replace(BASE, ""),
  );
  await page.screenshot({ path: chemin("app-profil.png") });

  // Le retour ramène bien au profil, pas ailleurs.
  await page.locator("button").first().click();
  await page.waitForTimeout(1200);
  verifier("Le retour ramène à l'écran Profil", /se déconnecter/i.test(await corps()));

  // ── La file des saisies s'ouvre DANS l'app ──
  await page.getByRole("button", { name: /^à faire$/i }).first().click();
  await page.waitForTimeout(2000);
  const surFiles = await corps();
  verifier("Onglet « À faire » affiché", /saisies à valider/i.test(surFiles));

  const urlFiles = page.url();
  await page.getByRole("button", { name: /saisies à valider/i }).first().click();
  await page.waitForTimeout(2500);
  verifier(
    "« Saisies à valider » ouvre la file DANS l'app (plus de sortie vers le web)",
    page.url() === urlFiles && !/dashboard/i.test(page.url()),
    page.url().replace(BASE, ""),
  );
  await page.screenshot({ path: chemin("app-soumissions.png") });
  console.log("  🛑 Aucune approbation ni rejet déclenché (dossiers fonciers réels).");
}

const bruit = erreurs.filter((e) => !/favicon|DevTools|Fast Refresh|manifest|404/i.test(e));
verifier("Aucune erreur console", bruit.length === 0, bruit.slice(0, 3).join(" | "));

await browser.close();
console.log(`\n${ko === 0 ? "✅" : "❌"} ${ok}/${ok + ko} contrôles passés — captures dans .shots/\n`);
process.exit(ko === 0 ? 0 : 1);
