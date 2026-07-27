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
// ⚠️ Deux pièges cumulés, tous deux sondés. `/notifications/i` matche la
// pastille de NAVIGATION, présente en permanence — vrai avec l'écran Profil
// affiché. Et un motif sur « n nouvelle(s) » matche l'écran « Saisies à
// valider », dont le résumé dit « 2 nouvelle(s), 1 réassign. ». On sort donc
// du texte : `aria-label="Non lue"` n'existe QUE dans `NotificationsScreen`
// (une seule occurrence dans tout `src/`), et l'état vide a son propre libellé.
const pastillesNonLues = await cadre.locator('[aria-label="Non lue"]').count();
verifier(
  "Écran Notifications rendu",
  pastillesNonLues > 0 || /aucune notification/i.test(surNotifs),
  `${pastillesNonLues} pastille(s) « non lue »`,
);
verifier("Le nombre de non-lues est annoncé", /2\s*nouvelle/i.test(surNotifs), (surNotifs.match(/\d+\s*nouvelle\w*/i) || [""])[0]);

// ── Gel juridique : un lot verrouillé se voit et bloque l'envoi ──
//
// 🔴 Le défaut d'origine : `lots.verrouille` n'était chargé nulle part, si bien
// qu'un lot sous gel juridique se présentait comme n'importe quel autre et
// pouvait être réattribué d'un pouce. 6 lots sont dans cet état en production.
// La base le refuse désormais à l'approbation ; ce contrôle-ci porte sur ce que
// l'opérateur VOIT, qui est l'autre moitié de la correction.
await page.locator('[data-apercu="saisie-lot"]').click();
await page.waitForTimeout(700);
await cadre.getByRole("button", { name: /brignan extension/i }).first().click();
await page.waitForTimeout(900);
const listeLots = await cadre.innerText();
verifier(
  "Un lot sous gel juridique est signalé dès la liste",
  /gel juridique/i.test(listeLots) && listeLots.includes("🔒"),
  (listeLots.split("\n").find((l) => l.includes("🔒")) ?? "aucune ligne verrouillée").slice(0, 46),
);

// 🔴 Il ne suffit PAS de mesurer le bouton sur un lot fraîchement ouvert : il
// y est désactivé sur TOUT lot, gelé ou non, tant qu'aucune cible n'est
// choisie. Sondé — retirer la garde `!lot.verrouille` laissait le contrôle
// vert. On choisit donc une cible d'abord, puis on compare les deux lots :
// c'est l'écart entre eux qui prouve quelque chose, pas l'état isolé.
const etatApresCible = async (nomLot) => {
  await cadre.getByRole("button", { name: nomLot }).first().click();
  await page.waitForTimeout(900);
  await cadre.getByRole("button", { name: /^libre$/i }).first().click();
  await page.waitForTimeout(500);
  const texte = await cadre.innerText();
  const desactive = await cadre.getByRole("button", { name: /envoyer/i }).first().isDisabled();
  await cadre.locator("button").first().click(); // retour à la liste des lots
  await page.waitForTimeout(800);
  return { texte, desactive };
};

const lotGele = await etatApresCible(/🔒/);
const lotNormal = await etatApresCible(/^Lot 142/);

verifier(
  "Cible « Libre » choisie : un lot gelé reste refusé, un lot normal passe",
  /sous gel juridique/i.test(lotGele.texte) &&
    lotGele.desactive &&
    !lotNormal.desactive,
  `gelé → ${lotGele.desactive ? "refusé" : "ACCEPTÉ"} ` +
    `(avertissement ${/sous gel juridique/i.test(lotGele.texte) ? "présent" : "ABSENT"}), ` +
    `normal → ${lotNormal.desactive ? "REFUSÉ" : "accepté"}`,
);
await page.screenshot({ path: chemin("lot-gel-juridique.png") });

// Contrastes sur les deux thèmes — c'est ici qu'une classe fantôme se voit.
//
// ⚠️ Le seuil n'est PAS assoupli pour faire passer le test. On mesure d'abord
// le plancher du design system lui-même — `--muted-foreground` sur le canvas,
// le texte secondaire le plus pâle que le DS assume — puis on exige que rien
// ne soit pire. En thème clair ce plancher vaut 4,39:1, donc sous AA : c'est
// un fait du DS, antérieur à ce chantier et commun aux 309 usages du jeton.
// Le test signale l'écart au lieu de le masquer, et échoue dès qu'un élément
// descend SOUS ce plancher — ce qui est le vrai signe d'une régression.
//
// 🔴 La mesure porte sur TOUS les écrans de l'aperçu, pas seulement celui qui
// se trouvait affiché : la première version ne mesurait que les Notifications,
// laissant profil et signalement capturés mais jamais contrôlés. La liste est
// lue depuis la page elle-même (`[data-apercu]`), donc tout écran ajouté plus
// tard à l'aperçu entre automatiquement dans le contrôle.
const ecransApercu = await page.locator("[data-apercu]").evaluateAll((els) =>
  els.map((e) => e.getAttribute("data-apercu")),
);

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

  let pire = { ratio: 99, texte: "", ecran: "" };
  let mesures = 0;
  const sousAA = [];

  for (const nom of ecransApercu) {
    await page.locator(`[data-apercu="${nom}"]`).click();
    await page.waitForTimeout(500);
    const cibles = await cadre.locator("div,span,p").filter({ hasText: /.+/ }).all();
    for (const el of cibles.slice(0, 80)) {
      const txt = (await el.innerText().catch(() => "")).trim();
      // 🔴 Plus de coupure à 60 caractères. Elle écartait silencieusement TOUS
      // les textes d'aide — exactement ceux que ce chantier a corrigés pour un
      // défaut de contraste. Sondé : un texte à 2,83:1 (71 caractères) n'était
      // pas mesuré, et le contrôle annonçait « rien sous le plancher » avec ce
      // texte à l'écran. Le filtre `enfantsTextuels` ci-dessous suffit à écarter
      // les conteneurs, qui étaient la vraie raison d'être de cette limite.
      if (!txt) continue;
      const infos = await el.evaluate((e) => ({
        taille: parseFloat(getComputedStyle(e).fontSize),
        // ⚠️ On ne compte que les enfants PORTEURS DE TEXTE. Écarter tout nœud
        // ayant un enfant quelconque laissait échapper les pastilles dès
        // qu'elles gagnaient un point décoratif — c'est-à-dire exactement les
        // éléments qu'on venait de corriger pour un défaut de contraste.
        enfantsTextuels: [...e.children].filter((c) => (c.textContent || "").trim()).length,
      }));
      // Un nœud dont un enfant porte le texte mesurerait la couleur héritée ;
      // au-delà de 18 px, AA n'exige plus que 3:1 et la règle change.
      if (infos.enfantsTextuels > 0 || infos.taille >= 18) continue;
      const m = await el.evaluate(CONTRASTE);
      mesures += 1;
      if (m.ratio < 4.5 - 0.01) sousAA.push({ ratio: m.ratio, texte: txt.slice(0, 40), ecran: nom });
      if (m.ratio < pire.ratio) pire = { ratio: m.ratio, texte: txt.slice(0, 26), ecran: nom };
    }
  }

  // ⚠️ Ceci n'est PAS un contrôle AA, et son libellé ne doit pas le laisser
  // croire. Le seuil est le plancher que le design system assume lui-même
  // (`--muted-foreground` sur `inset`), qui vaut 4,39:1 en thème clair — donc
  // sous AA. C'est un fait du DS, antérieur à ce chantier et commun à ses ~309
  // usages ; le rôle du test est de détecter une RÉGRESSION sous ce plancher.
  const seuil = Math.min(4.5, plancherDS);
  verifier(
    `Contraste thème ${theme} — aucune régression sous le plancher du DS (${plancherDS}:1)`,
    mesures > 0 && pire.ratio >= seuil - 0.01,
    `${mesures} mesures sur ${ecransApercu.length} écrans, pire ${pire.ratio}:1 sur ` +
      `« ${pire.texte} » (${pire.ecran})`,
  );

  // Rapporté séparément, jamais confondu avec le contrôle ci-dessus : combien
  // d'éléments sont réellement sous AA. Informatif — la décision de vivre avec
  // le plancher du DS est un choix produit — mais dorénavant chiffré et nommé,
  // plutôt que dissous dans un seuil assoupli.
  if (sousAA.length > 0) {
    const pires = [...sousAA].sort((a, b) => a.ratio - b.ratio).slice(0, 3);
    console.log(
      `  ⚠️  ${sousAA.length}/${mesures} élément(s) sous AA (4,5:1) en thème ${theme} — ` +
        pires.map((p) => `${p.ratio}:1 « ${p.texte} » (${p.ecran})`).join(" · "),
    );
  }
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
  // ⚠️ L'URL seule ne prouve RIEN : si le callback devenait un no-op, elle ne
  // changerait pas davantage et le contrôle resterait vert sur un bouton mort.
  // On exige donc aussi que l'écran soit réellement peint.
  const surSoumissions = await corps();
  verifier(
    "« Saisies à valider » ouvre la file DANS l'app (plus de sortie vers le web)",
    page.url() === urlFiles &&
      !/dashboard/i.test(page.url()) &&
      /en attente de décision/i.test(surSoumissions),
    page.url().replace(BASE, ""),
  );
  await page.screenshot({ path: chemin("app-soumissions.png") });
  console.log("  🛑 Aucune approbation ni rejet déclenché (dossiers fonciers réels).");

  // ── Saisir dans le registre : les 4 écrans s'ouvrent DANS l'app ──
  //
  // 🔴 Ce câblage n'est vérifiable QU'ICI. `/apercu-mobile` monte les écrans
  // isolément, jamais `AdminApp` ni `FilesScreen` : une entrée qui n'ouvrirait
  // rien s'y verrait parfaitement rendue. On exige donc, pour chacune, un
  // repère de CONTENU propre à l'écran atteint — l'URL ne bouge jamais dans
  // une app à page unique, elle ne prouve rien.
  await page.locator("button").first().click();
  await page.waitForTimeout(1200);

  // 🔴 Chaque repère doit être ABSENT de `FilesScreen`, sinon il est déjà vrai
  // avant le clic. `AdminApp` rend la liste sous `{!overlay && …}` : si le clic
  // n'ouvrait rien, la liste resterait à l'écran, et un repère qui matche l'un
  // de ses sous-titres passerait au vert sur un bouton mort. C'est exactement
  // ce qui se produisait pour « Fiche d'attributaire », dont le sous-titre de
  // liste — « Créer une fiche, ou corriger une fiche existante » — contenait le
  // « corriger une fiche » que le test cherchait. Démontré par sonde.
  //
  // Ils doivent aussi se distinguer ENTRE EUX : « Fiche de lotissement » et
  // « Nouveau lotissement » partageaient « nom du lotissement » et
  // « superficie », si bien qu'une inversion du câblage des deux entrées
  // passait le contrôle.
  //
  // ⚠️ Ne jamais viser un `placeholder` : il ne fait pas partie de
  // `innerText`. Première rédaction fautive ici — l'écran s'ouvrait bien.
  const SAISIES = [
    // Sous-titre de l'écran ; la liste dit « Désigner un attributaire… ».
    ["Attribuer un lot", /choisir le lotissement/i],
    // Libellé de champ ; la liste ne nomme aucune pièce d'identité.
    ["Fiche d'attributaire", /nature de la pièce/i],
    // Avertissement propre à l'écran de fiche.
    ["Fiche de lotissement", /cette fiche décrit un lotissement/i],
    // Avertissement propre à la coquille ; le sous-titre « Fiche seule, sans
    // îlot ni lot » serait inutilisable : c'est mot pour mot le détail affiché
    // par l'entrée de liste.
    ["Nouveau lotissement", /la fiche du lotissement seulement/i],
  ];

  verifier(
    "Section « Saisir dans le registre » présente dans « À faire »",
    /saisir dans le registre/i.test(await corps()),
  );

  for (const [libelle, attendu] of SAISIES) {
    const entree = page.getByRole("button", { name: new RegExp(`^${libelle}`, "i") }).first();
    if ((await entree.count()) === 0) {
      verifier(`« ${libelle} » ouvre son écran dans l'app`, false, "entrée introuvable");
      continue;
    }
    await entree.click();
    await page.waitForTimeout(2200);
    const vu = await corps();
    verifier(
      `« ${libelle} » ouvre son écran dans l'app`,
      attendu.test(vu) && page.url() === urlFiles,
      (vu.split("\n").find((l) => l.trim().length > 3) ?? "").slice(0, 48),
    );
    // Retour par la flèche de la barre de titre, pour revenir à la liste.
    await page.locator("button").first().click();
    await page.waitForTimeout(1400);
  }
  await page.screenshot({ path: chemin("app-saisie.png") });
  console.log("  🛑 Aucune soumission envoyée (elle irait dans une vraie file).");

  // ── L'état de lecture des notifications n'appartient qu'à SON compte ──
  //
  // C'est la propriété qui compte vraiment : un même téléphone sert souvent à
  // plusieurs comptes, et hériter de l'état d'autrui masquerait des
  // notifications jamais vues. L'aperçu ne peut pas la prouver — il passe
  // `lues` en prop littérale sans jamais toucher au stockage.
  const AUTRE = "sgnf.notifs-lues.00000000-1111-2222-3333-444444444444";
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify(["intrus-1", "intrus-2"])), AUTRE);

  // ⚠️ La boucle ci-dessus s'est déjà refermée sur « À faire », calque fermé et
  // barre d'onglets visible. Un retour de plus cliquerait la première entrée de
  // la liste et rouvrirait un calque — c'est ce qui faisait disparaître
  // l'onglet Pilotage et échouer la suite.
  await page.getByRole("button", { name: /^pilotage$/i }).first().click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /^notifications$/i }).first().click();
  await page.waitForTimeout(1800);

  const cles = await page.evaluate((prefixe) => {
    const out = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefixe)) out[k] = localStorage.getItem(k);
    }
    return out;
  }, "sgnf.notifs-lues.");

  const noms = Object.keys(cles);
  verifier(
    "La clé d'un autre compte n'est ni lue ni modifiée",
    cles[AUTRE] === JSON.stringify(["intrus-1", "intrus-2"]),
    cles[AUTRE] ?? "(clé disparue !)",
  );
  // 🔴 `every()` seul est VACUEMENT vrai : si l'app n'écrivait jamais aucune
  // clé, `noms` ne contiendrait que celle plantée par le test six lignes plus
  // haut — qui satisfait le motif — et l'assertion passerait au vert sur une
  // fonctionnalité entièrement morte. On exige donc qu'une clé AUTRE que
  // l'intruse existe, et c'est elle qu'on vérifie.
  const ecrites = noms.filter((k) => k !== AUTRE);
  verifier(
    "L'état de lecture est bien nominatif (clé propre au compte connecté)",
    ecrites.length > 0 && ecrites.every((k) => /^sgnf\.notifs-lues\.[0-9a-f-]{36}$/i.test(k)),
    ecrites.length === 0
      ? "aucune clé écrite par l'app (l'intruse ne compte pas)"
      : `${ecrites.length} clé(s) : ${ecrites.map((k) => k.replace("sgnf.notifs-lues.", "").slice(0, 8)).join(", ")}`,
  );
  await page.evaluate((k) => localStorage.removeItem(k), AUTRE);
}

// ⚠️ `404` n'est plus filtré en bloc : il avalait aussi les
// « Failed to load resource: 404 » d'un endpoint applicatif réellement
// manquant. Seules les ressources dont l'absence est attendue en dev sont
// écartées, et elles le sont par leur NOM, pas par leur code.
const bruit = erreurs.filter((e) => !/favicon|DevTools|Fast Refresh|manifest|apple-touch-icon/i.test(e));
verifier("Aucune erreur console", bruit.length === 0, bruit.slice(0, 3).join(" | "));

await browser.close();
console.log(`\n${ko === 0 ? "✅" : "❌"} ${ok}/${ok + ko} contrôles passés — captures dans .shots/\n`);
process.exit(ko === 0 ? 0 : 1);
