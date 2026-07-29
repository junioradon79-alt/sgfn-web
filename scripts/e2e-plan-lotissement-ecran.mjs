// Le plan de morcellement, du dépôt à la restitution — par l'écran réel.
//
//   node scripts/e2e-plan-lotissement-ecran.mjs
//
// ⚠️ CE SCRIPT ÉCRIT EN PRODUCTION. Il n'existe pas d'environnement de test sur
// ce projet : le navigateur, c'est la prod. Il dépose donc de vrais fichiers
// (préfixés « [E2E] » dans leur titre), puis les retire — et le dernier
// contrôle vérifie que la fiche est bien revenue à zéro plan. Si le script est
// interrompu au milieu, il reste au plus 3 documents « [E2E] » à supprimer
// depuis l'écran, plus 3 objets sous `plans-lotissement/`.
//
// ─────────────────────────────────────────────────────────────────────────────
// 🔴 LE FAUX VERT QUE CE FICHIER EXISTE POUR TUER
//
// Le lotissement ne porte AUCUN plan aujourd'hui. Une capture de la fiche
// montrerait donc « Aucun plan de morcellement déposé » — et afficherait
// exactement la même chose si la requête échouait, si la RLS refusait tout, ou
// si le composant n'était pas monté. Trois pannes, un seul écran. Une capture
// ne peut rien conclure ici.
//
// Le script sépare donc les cas :
//   · il DÉPOSE réellement, et vérifie que la ligne apparaît ;
//   · il inspecte la RÉPONSE PostgREST pour prouver que `nom_fichier` et
//     `type_mime` sont bien lus, et pas devinés depuis `url_fichier` ;
//   · il AMPUTE cette même réponse de `nom_fichier` (mutation côté navigateur,
//     la base n'est pas touchée) et vérifie que l'écran CHANGE — sans quoi
//     l'affichage correct ne prouvait pas que la colonne était lue ;
//   · il vérifie que le téléchargement rend le NOM D'ORIGINE, pas la clé de
//     stockage — c'est toute la promesse « conserver toutes les extensions » ;
//   · il rejoue la fiche sous l'opérateur du lotissement VOISIN, qui ne doit
//     rien voir : le scope se prouve par le voisin, pas par soi-même.
//
// ─────────────────────────────────────────────────────────────────────────────
// TROIS FORMATS, CHOISIS POUR CE QU'ILS PROUVENT
//   · .pdf  — aperçu navigateur, MIME connu, le cas du plan de Brignan ;
//   · .dwg  — CAO, MIME vide côté navigateur, aucun aperçu possible : c'est le
//             format que toute liste blanche aurait rejeté ;
//   · un nom À ESPACES, ACCENTS ET PARENTHÈSES (« Plan de Morcellement Brignan
//     Kakodji (Ebimpé 2020).pdf ») — le nom réel du fichier fourni par le user,
//     et trois pièges de clé de stockage d'un coup.
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const PWD = env.MANUEL_TEST_PASSWORD;
const BASE = process.env.E2E_BASE || "http://localhost:3000";

const BRIGNAN = "8820c6b8-8ced-468f-bbcc-b63542d79621";
const FICHE = `${BASE}/lotissements/${BRIGNAN}`;

// Sans ces drapeaux, Chromium résout Supabase en DNS-over-HTTPS et échoue
// (« Failed to fetch ») : la fiche se lirait vide et TOUS les contrôles
// d'absence passeraient au vert pour la mauvaise raison.
const browser = await chromium.launch({
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 1000 },
  acceptDownloads: true,
});
const steps = [];
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));

const step = async (name, fn) => {
  try { await fn(); steps.push({ name, ok: true }); }
  catch (e) { steps.push({ name, ok: false, error: String(e.message ?? e).slice(0, 300) }); }
};

// Réponses PostgREST sur `documents` : c'est là qu'on lit si la règle est lue.
const reponses = [];
page.on("response", async (r) => {
  if (!r.url().includes("/rest/v1/documents")) return;
  let corps = null;
  try { corps = await r.json(); } catch { /* corps vide (POST/DELETE) */ }
  reponses.push({ url: r.url(), statut: r.status(), methode: r.request().method(), corps });
});

// `innerText` applique le `text-transform` CSS : on compare toujours en
// minuscules, espaces normalisés (piège déjà rencontré sur ce dépôt).
const txt = async (loc) => (await loc.innerText()).toLowerCase().replace(/\s+/g, " ").trim();
// Ancre stable posée sur la Carte elle-même. Première version : « le div qui
// contient le titre » — elle attrapait la barre d'en-tête seule, si bien que
// tous les contrôles de contenu lisaient « plan de morcellement (3) » et rien
// d'autre, et échouaient en accusant le composant.
const carte = () => page.locator("#plan-lotissement");
const lignes = () => carte().locator("li");

const connecter = async (email) => {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector("#email", { timeout: 20000 });
  await page.fill("#email", email);
  await page.fill("#password", PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 60000 });
};

/**
 * Attend que la carte ait FINI de charger.
 *
 * 🔴 Sans cette attente, la purge comptait 0 ligne — non pas parce qu'il n'y en
 * avait aucune, mais parce que la liste n'était pas encore rendue. Elle se
 * déclarait donc terminée sur une carte vide, et le contrôle suivant découvrait
 * 4 plans. Un compte de zéro pris pendant un chargement ne dit rien : c'est la
 * même famille de faux vert que « l'écran affiche ce que j'attends » sur un
 * écran qui n'a rien reçu.
 */
const attendrePret = async () => {
  await carte().waitFor({ timeout: 60000 });
  await page.waitForFunction(
    () => {
      const c = document.querySelector("#plan-lotissement");
      return Boolean(c) && !c.innerText.includes("Chargement des plans");
    },
    null,
    { timeout: 60000 },
  );
};

const ouvrirFiche = async () => {
  await page.goto(FICHE, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("heading", { name: /Plan de morcellement/ }).waitFor({ timeout: 40000 });
  await attendrePret();
};

/** Dépose un fichier via le formulaire réel de l'écran. */
const deposer = async ({ nom, mime, octets, titre }) => {
  await page.getByRole("button", { name: /Déposer un plan/ }).click();
  await page.setInputFiles("#plan-fichier", {
    name: nom,
    mimeType: mime,
    buffer: Buffer.from(octets),
  });
  await page.fill("#plan-titre", titre);
  await page.getByRole("button", { name: /Déposer le plan/ }).click();
  // Le bouton d'ouverture du formulaire revient quand le dépôt a abouti.
  await page.getByRole("button", { name: /Déposer un plan/ }).waitFor({ timeout: 60000 });
  await attendrePret();
  await page.getByText(titre, { exact: false }).first().waitFor({ timeout: 20000 });
  // Un titre en double rendrait les locators de ligne ambigus (« strict mode
  // violation ») plus bas, et surtout signalerait une purge incomplète.
  const n = await lignes().filter({ hasText: titre }).count();
  if (n !== 1) throw new Error(`${n} lignes portent le titre « ${titre} » — purge incomplète ?`);
};

const NOM_PDF = "Plan de Morcellement Brignan Kakodji (Ebimpé 2020).pdf";
const NOM_DWG = "EBIMPE-2020-morcellement.dwg";
const NOM_SANS_EXT = "plan_sans_extension";

// Un PDF minimal mais VALIDE : le visualiseur du navigateur doit l'accepter,
// sinon l'aperçu échouerait pour une raison sans rapport avec le chantier.
const PDF_MINIMAL = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
  "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
  "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
  "trailer<</Root 1 0 R>>\n%%EOF\n", "latin1",
);

/**
 * Retire tout plan « [E2E] » encore présent. Rend le script REJOUABLE : une
 * interruption au milieu (c'est arrivé au premier essai) laisserait sinon des
 * documents derrière elle, et le contrôle d'état vide plus bas échouerait pour
 * une raison sans rapport avec le chantier.
 */
const purger = async () => {
  for (let i = 0; i < 12; i++) {
    const restants = lignes().filter({ hasText: "[E2E]" });
    if ((await restants.count()) === 0) return;
    // Compté AVANT le clic : le relire après pourrait déjà refléter la
    // suppression, et l'attente porterait alors sur un palier de trop.
    const avant = await lignes().count();
    await restants.first().getByRole("button", { name: /Retirer/ }).click();
    // On attend que le NOMBRE de lignes diminue, pas qu'un nœud précis se
    // détache : la liste est re-rendue entière après suppression, et le
    // locator filtré se réattache aussitôt à la ligne suivante — l'attente de
    // détachement expirait alors sur une purge pourtant en train de réussir.
    await page.waitForFunction(
      (avant) => document.querySelectorAll("#plan-lotissement li").length < avant,
      avant,
      { timeout: 40000 },
    );
    await attendrePret();
  }
  throw new Error("purge incomplète : des plans [E2E] subsistent");
};

await step("l'admin ouvre la fiche du lotissement Brignan Kakodji", async () => {
  await connecter("manuel.admin@sgfn.ci");
  page.on("dialog", (d) => d.accept());
  await ouvrirFiche();
});

await step("PURGE PRÉALABLE : aucun résidu d'une exécution précédente", async () => {
  await purger();
});

await step("CONTRÔLE POSITIF : l'écran part d'un état vide EXPLICITE (et non d'une panne)", async () => {
  // Le seul moment où « aucun plan » et « lecture cassée » se ressemblent. On
  // exige donc que la requête ait bien eu lieu ET répondu 200 : sans cela, tous
  // les contrôles suivants raisonneraient sur un écran mort.
  const lectures = reponses.filter((r) => r.methode === "GET" && r.url.includes("lotissement_id"));
  if (lectures.length === 0) throw new Error("aucune lecture de `documents` interceptée — le composant n'a pas requêté");
  if (!lectures.some((r) => r.statut === 200)) {
    throw new Error(`la lecture a échoué (statuts ${lectures.map((r) => r.statut).join(",")})`);
  }
  const t = await txt(carte());
  if (!t.includes("aucun plan de morcellement déposé")) {
    throw new Error(`état de départ inattendu : ${t.slice(0, 160)}`);
  }
});

await step("DÉPÔT 1/3 — PDF au nom accentué, à espaces et à parenthèses", async () => {
  await deposer({ nom: NOM_PDF, mime: "application/pdf", octets: PDF_MINIMAL, titre: "[E2E] Plan PDF" });
});

await step("DÉPÔT 2/3 — .dwg (CAO) : le format qu'une liste blanche aurait refusé", async () => {
  // MIME vide : c'est ce que le navigateur annonce réellement pour un .dwg.
  await deposer({ nom: NOM_DWG, mime: "", octets: Buffer.alloc(2048, 7), titre: "[E2E] Plan DWG" });
});

await step("DÉPÔT 3/3 — fichier SANS extension : accepté, et la clé reste valide", async () => {
  await deposer({ nom: NOM_SANS_EXT, mime: "", octets: Buffer.alloc(64, 3), titre: "[E2E] Sans extension" });
});

await step("les 3 formats coexistent — le compteur de la carte affiche (3)", async () => {
  const titre = await txt(page.getByRole("heading", { name: /Plan de morcellement/ }));
  if (!titre.includes("(3)")) throw new Error(`compteur inattendu : « ${titre} »`);
});

await step("LA RÈGLE EST LUE : la réponse porte nom_fichier ET type_mime, pas seulement url_fichier", async () => {
  const lignes = reponses
    .filter((r) => r.methode === "GET" && Array.isArray(r.corps))
    .flatMap((r) => r.corps)
    .filter((l) => l && typeof l === "object" && "nom_fichier" in l);
  if (lignes.length === 0) throw new Error("aucune ligne `documents` exploitable interceptée");
  const pdf = lignes.find((l) => l.nom_fichier === NOM_PDF);
  if (!pdf) {
    throw new Error(`nom d'origine absent de la réponse : ${lignes.map((l) => l.nom_fichier).join(" | ")}`);
  }
  if (pdf.type_mime !== "application/pdf") throw new Error(`type_mime rendu = ${pdf.type_mime}`);
  // La clé de stockage est normalisée : le nom accentué NE DOIT PAS s'y trouver.
  if (pdf.url_fichier.includes("Ebimpé") || pdf.url_fichier.includes(" ") || pdf.url_fichier.includes("(")) {
    throw new Error(`la clé de stockage porte le nom d'origine (espaces/accents) : ${pdf.url_fichier}`);
  }
  if (!pdf.url_fichier.startsWith(`plans-lotissement/${BRIGNAN}/`)) {
    throw new Error(`préfixe de stockage inattendu : ${pdf.url_fichier}`);
  }
});

await step("le nom d'origine est affiché à l'écran, extension comprise", async () => {
  const t = await txt(carte());
  if (!t.includes(NOM_PDF.toLowerCase())) throw new Error("le nom d'origine du PDF n'est pas affiché");
  if (!t.includes(NOM_DWG.toLowerCase())) throw new Error("le nom d'origine du DWG n'est pas affiché");
});

await step("le .dwg est annoncé comme NON prévisualisable — pas comme une erreur", async () => {
  const t = await txt(carte());
  if (!t.includes("aperçu indisponible dans le navigateur")) {
    throw new Error("le DWG ne porte pas la mention d'aperçu indisponible");
  }
  if (t.includes("format non autorisé") || t.includes("non accepté")) {
    throw new Error("l'écran présente le DWG comme refusé alors qu'il est accepté");
  }
});

await step("le fichier sans extension est étiqueté « sans extension », pas rejeté", async () => {
  const t = await txt(carte());
  if (!t.includes("sans extension")) throw new Error("l'étiquette « sans extension » manque");
});

await step("TÉLÉCHARGEMENT FIDÈLE : le fichier redescend sous son nom d'origine", async () => {
  const ligne = lignes().filter({ hasText: "[E2E] Plan DWG" });
  const [dl] = await Promise.all([
    // Sur échec, on remonte le message AFFICHÉ plutôt qu'un simple timeout : la
    // première version de ce contrôle a expiré 60 s sans rien dire, alors que
    // la carte portait la cause à l'écran (préflight CORS de l'edge function).
    page.waitForEvent("download", { timeout: 60000 }).catch(async (e) => {
      const banniere = carte().getByRole("alert");
      const motif = (await banniere.count()) > 0 ? await txt(banniere.first()) : "(aucun message à l'écran)";
      throw new Error(`aucun téléchargement déclenché — l'écran dit : ${motif} [${e.message.slice(0, 80)}]`);
    }),
    ligne.getByRole("button", { name: /Télécharger/ }).click(),
  ]);
  const propose = dl.suggestedFilename();
  if (propose !== NOM_DWG) {
    throw new Error(`nom proposé « ${propose} » au lieu de « ${NOM_DWG} » (la clé de stockage a fuité)`);
  }
});

await step("APERÇU : le PDF s'ouvre dans la page, le DWG n'a même pas de bouton d'aperçu", async () => {
  const lignePdf = lignes().filter({ hasText: "[E2E] Plan PDF" });
  await lignePdf.getByRole("button", { name: /Aperçu/ }).click();
  await page.locator("iframe").first().waitFor({ timeout: 40000 });

  const ligneDwg = lignes().filter({ hasText: "[E2E] Plan DWG" });
  if ((await ligneDwg.getByRole("button", { name: /Aperçu/ }).count()) !== 0) {
    // Le MIME observé est nommé : c'est lui qui a démasqué le défaut
    // (`image/vnd.dwg` est bien préfixé « image/ » sans être affichable).
    const dwg = reponses
      .filter((r) => r.methode === "GET" && Array.isArray(r.corps))
      .flatMap((r) => r.corps)
      .find((l) => l && l.nom_fichier === NOM_DWG);
    throw new Error(
      `un bouton d'aperçu est proposé sur le DWG (type_mime = ${JSON.stringify(dwg?.type_mime)}), ` +
      "que le navigateur ne sait pas afficher",
    );
  }
});

mkdirSync(new URL("../.shots/", import.meta.url), { recursive: true });
await step("captures REGARDÉES : la carte peuplée, puis le formulaire de dépôt", async () => {
  // La barre d'AppShell est `sticky` : sur une capture d'ÉLÉMENT, elle se
  // compose par-dessus l'en-tête de la carte et masque « Plan de morcellement
  // (3) » ainsi que le bouton de dépôt. On la fige le temps du cliché — c'est
  // un artefact de capture, pas un défaut de mise en page.
  await page.addStyleTag({ content: "*{position:static !important}" });
  await carte().scrollIntoViewIfNeeded();
  await carte().screenshot({ path: ".shots/plan-lotissement-carte.png" });

  await page.getByRole("button", { name: /Déposer un plan/ }).click();
  await page.waitForSelector("#plan-fichier", { timeout: 20000 });
  await carte().screenshot({ path: ".shots/plan-lotissement-depot.png" });
  await page.getByRole("button", { name: /^Annuler$/ }).click();
  await page.reload({ waitUntil: "networkidle", timeout: 120000 });
  await attendrePret();
});

await step("MUTATION : privée de `nom_fichier`, la carte CHANGE (elle lisait bien la colonne)", async () => {
  // N'intercepter que les LECTURES : un POST/DELETE amputé n'aurait aucun sens,
  // et une requête annulée par la navigation fait échouer `fulfill` (« Route is
  // already handled ») — ce qui tuait le processus au premier essai, avant même
  // le nettoyage. Toute la manipulation est enveloppée : sur une course, on
  // laisse simplement passer la requête d'origine.
  await page.route("**/rest/v1/documents*", async (route) => {
    if (route.request().method() !== "GET") { await route.continue().catch(() => {}); return; }
    try {
      const reponse = await route.fetch();
      let corps;
      try { corps = await reponse.json(); } catch { await route.fulfill({ response: reponse }); return; }
      if (Array.isArray(corps)) for (const l of corps) { if (l) l.nom_fichier = null; }
      await route.fulfill({ response: reponse, json: corps });
    } catch {
      await route.continue().catch(() => {});
    }
  });
  await ouvrirFiche();
  const t = await txt(carte());
  if (t.includes(NOM_PDF.toLowerCase())) {
    throw new Error("le nom d'origine s'affiche ENCORE sans la colonne : l'écran ne la lisait pas");
  }
  // Le DWG doit alors perdre son extension : sans nom_fichier, plus rien ne la
  // porte — la preuve que l'étiquette venait de la colonne et non de l'url.
  if (!t.includes("sans extension")) {
    throw new Error("sous mutation, l'étiquette d'extension n'a pas changé : elle vient d'ailleurs");
  }
});

await step("MUTATION LEVÉE : la carte revient à l'état correct", async () => {
  await page.unroute("**/rest/v1/documents*");
  await ouvrirFiche();
  const t = await txt(carte());
  if (!t.includes(NOM_PDF.toLowerCase())) throw new Error("retour à l'état correct non observé");
});

await step("SCOPE — l'opérateur du lotissement VOISIN ne voit aucun plan de Brignan", async () => {
  // manuel.amenageur = opérateur de Koelea-Accor. Il a le droit d'ouvrir la
  // fiche (lotissements est lisible), pas de lire les pièces de Brignan.
  await page.context().clearCookies();
  await connecter("manuel.amenageur@sgfn.ci");
  await ouvrirFiche();
  const t = await txt(carte());
  if (!t.includes("aucun plan de morcellement déposé")) {
    throw new Error(`l'opérateur voisin voit quelque chose : ${t.slice(0, 200)}`);
  }
  if (t.includes("déposer un plan")) {
    throw new Error("l'action de dépôt est proposée à un non-admin");
  }
});

await step("SCOPE POSITIF — l'opérateur de Brignan, lui, voit bien les 3 plans", async () => {
  // Le contre-contrôle du précédent : sans lui, une carte cassée pour tout le
  // monde passerait pour un scope réussi.
  await page.context().clearCookies();
  await connecter("manuel.operateur@sgfn.ci");
  await ouvrirFiche();
  const titre = await txt(page.getByRole("heading", { name: /Plan de morcellement/ }));
  if (!titre.includes("(3)")) throw new Error(`l'opérateur du parc devrait voir 3 plans : « ${titre} »`);
  const t = await txt(carte());
  if (t.includes("déposer un plan")) throw new Error("l'action de dépôt est proposée à l'opérateur");
});

await step("NETTOYAGE : l'admin retire les 3 plans déposés", async () => {
  await page.context().clearCookies();
  await connecter("manuel.admin@sgfn.ci");
  await ouvrirFiche();
  await purger();
});

await step("NETTOYAGE VÉRIFIÉ : la fiche est revenue à zéro plan", async () => {
  await ouvrirFiche();
  const t = await txt(carte());
  if (!t.includes("aucun plan de morcellement déposé")) {
    throw new Error(`des plans subsistent : ${t.slice(0, 200)}`);
  }
});

await step("aucune erreur console", async () => {
  if (errors.length) throw new Error(errors.join(" | "));
});

await browser.close();
for (const s of steps) console.log(`  ${s.ok ? "ok " : "KO "} ${s.name}${s.ok ? "" : `  — ${s.error}`}`);
const ok = steps.filter((s) => s.ok).length;
console.log(`\n${ok}/${steps.length} contrôles`);
process.exit(ok === steps.length ? 0 : 1);
