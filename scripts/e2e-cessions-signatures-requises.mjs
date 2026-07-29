// Les cessions de `/dashboard/validations` n'exigent plus trois signatures en
// dur : elles exigent ce que leur lotissement demande. Preuve de bout en bout,
// EN LECTURE SEULE (aucune écriture en production, aucun clic sur « Valider »).
//
// 🔴 LE FAUX VERT QUE CE SCRIPT EXISTE POUR TUER. Regarder l'écran ne suffit
// pas : si l'embed `lotissements(signatures_requises)` échouait en silence,
// `etatSignaturesCession` retomberait sur `SIGNATURES_PAR_DEFAUT`. On ne peut
// donc pas conclure d'une capture « c'est correct » — il faut montrer que
// l'écran CHANGE quand la règle disparaît. Ce script le fait en deux temps :
//
//   1. il inspecte la RÉPONSE PostgREST elle-même (la règle est-elle lue ?) ;
//   2. il REJOUE la page en amputant cette même réponse de
//      `signatures_requises` — mutation contrôlée, côté navigateur, la base
//      n'est pas touchée — et vérifie que la pastille « Opérateur » redevient
//      une signature en attente. Un contrôle qui ne distingue pas le correctif
//      de son repli ne prouve rien ; celui-ci les sépare.
//
//   node scripts/e2e-cessions-signatures-requises.mjs
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const PWD = env.MANUEL_TEST_PASSWORD;
const BASE = process.env.E2E_BASE || "http://localhost:3000";

// Sans ces drapeaux, Chromium résout Supabase en DNS-over-HTTPS et échoue
// (« Failed to fetch ») : la page se lirait vide et TOUS les contrôles
// d'absence passeraient au vert pour la mauvaise raison. Cf. mémoire projet
// « connectivite_dns_securise_chrome ».
const browser = await chromium.launch({
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
const steps = [];
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));

const step = async (name, fn) => {
  try { await fn(); steps.push({ name, ok: true }); }
  catch (e) { steps.push({ name, ok: false, error: String(e.message ?? e).slice(0, 240) }); }
};

const reponses = [];
page.on("response", async (r) => {
  if (!r.url().includes("/rest/v1/attestations_cession")) return;
  let corps = null;
  try { corps = await r.json(); } catch { /* corps vide */ }
  reponses.push({ url: r.url(), statut: r.status(), corps });
});

// `innerText` applique le `text-transform` CSS : on compare toujours en
// minuscules, espaces normalisés (piège déjà rencontré sur ce chantier).
const txt = async (loc) => (await loc.innerText()).toLowerCase().replace(/\s+/g, " ").trim();
const carte = () => page.locator("#cessions");

// ⚠️ Ancrer le motif au DÉBUT seulement. `SignaturesBadges` ajoute un
// « — non requise » en `sr-only` DANS la pastille quand le créneau n'est pas
// exigé : un `/^Opérateur$/` ne matche alors plus rien, et le contrôle échoue
// en annonçant « le créneau a disparu » alors qu'il est là, correctement éteint.
// (C'est ce qu'a rendu la première exécution de ce script.)
const pastille = (label) => carte().locator("span").filter({ hasText: new RegExp(`^${label}`) }).first();
/** Une pastille non requise, et elle seule, porte un `title` explicatif. */
const estNonRequise = async (loc) => {
  const t = await loc.getAttribute("title");
  return Boolean(t && t.toLowerCase().includes("non requise"));
};

await step("la chefferie ouvre ses validations", async () => {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector("#email", { timeout: 20000 });
  await page.fill("#email", "manuel.chefferie@sgfn.ci");
  await page.fill("#password", PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 60000 });
  await page.goto(`${BASE}/dashboard/validations`, { waitUntil: "networkidle", timeout: 90000 });
  await carte().getByText(/ATT-CESS-/).first().waitFor({ timeout: 30000 });
});

await step("CONTRÔLE POSITIF : la file n'est pas vide (50 cessions Koelea-Accor)", async () => {
  // Sans lui, chaque contrôle d'absence ci-dessous passerait sur un écran vide.
  const n = await carte().locator("li").count();
  if (n !== 50) throw new Error(`50 cessions attendues en production, ${n} rendues`);
});

await step("LA RÈGLE EST LUE : la réponse porte signatures_requises = [proprietaire, chefferie]", async () => {
  const avecCorps = reponses.filter((r) => Array.isArray(r.corps) && r.corps.length > 0);
  if (avecCorps.length === 0) throw new Error("aucune réponse cessions exploitable interceptée");
  const ligne = avecCorps.flatMap((r) => r.corps)[0];
  const requises = ligne?.lot?.ilots?.lotissements?.signatures_requises;
  if (!Array.isArray(requises)) {
    throw new Error(`l'embed n'a rien rendu (repli silencieux) : ${JSON.stringify(ligne?.lot)}`);
  }
  const attendu = ["chefferie", "proprietaire"];
  if (JSON.stringify([...requises].sort()) !== JSON.stringify(attendu)) {
    throw new Error(`signatures_requises inattendu : ${JSON.stringify(requises)}`);
  }
});

await step("l'OPÉRATEUR n'est plus réclamé : pastille en pointillés, marquée « non requise »", async () => {
  const op = pastille("Opérateur");
  if ((await op.count()) === 0) throw new Error("le créneau Opérateur a disparu de l'écran");
  if (!(await estNonRequise(op))) {
    throw new Error(`l'Opérateur est encore présenté comme attendu (title=${await op.getAttribute("title")})`);
  }
});

await step("CONTRE-CONTRÔLE : le chef de famille, lui, reste EN ATTENTE (orange)", async () => {
  // Si le composant peignait tout en « non requis », le contrôle précédent
  // passerait au vert sans rien prouver.
  const cf = pastille("Chef de famille");
  if ((await cf.count()) === 0) throw new Error("le créneau « Chef de famille » a disparu");
  if (await estNonRequise(cf)) throw new Error("le chef de famille est marqué non requis");
  const classe = (await cf.getAttribute("class")) ?? "";
  if (!classe.includes("warning")) throw new Error(`pastille non orange : ${classe}`);
});

await step("CONTRE-CONTRÔLE : le chef de village est EXIGÉ et en attente — c'est ce qui arme le bouton", async () => {
  const cv = pastille("Chef de village");
  if ((await cv.count()) === 0) throw new Error("le créneau « Chef de village » a disparu");
  if (await estNonRequise(cv)) throw new Error("le chef de village est marqué non requis");
});

await step("le signataire s'appelle « Chef de village », jamais « Chefferie »", async () => {
  const t = await txt(carte());
  if (!t.includes("chef de village")) throw new Error("le créneau « Chef de village » est absent");
  // « Chefferie » seul ne dit pas laquelle des deux autorités a signé.
  if (/\bchefferie\b/.test(t)) throw new Error("« Chefferie » désigne encore un signataire ici");
});

await step("le décompte et les boutons portent sur les 50 cessions réellement dues", async () => {
  const boutons = await carte().getByRole("button", { name: /valider/i }).count();
  if (boutons !== 50) throw new Error(`50 boutons « Valider » attendus, ${boutons} rendus`);
  const nonRequise = await carte().getByText("Non requise", { exact: true }).count();
  if (nonRequise !== 0) throw new Error(`${nonRequise} cession(s) marquées « Non requise » à tort`);
  const t = await txt(carte());
  if (!t.includes("50")) throw new Error(`la pastille de compte n'affiche pas 50 : …${t.slice(0, 200)}`);
});

// ══ PREUVE PAR MUTATION ═════════════════════════════════════════════════════
// On ampute la réponse PostgREST de `signatures_requises` — exactement ce qui
// arriverait si l'embed était retiré du `select` ou refusé. Le repli du module
// doit alors redemander l'opérateur. Si l'écran ne bouge PAS, c'est que rien de
// ce qui précède ne dépendait de la règle, et les contrôles ci-dessus ne
// valaient rien.
await step("MUTATION : sans signatures_requises, l'Opérateur redevient une signature en attente", async () => {
  await page.route("**/rest/v1/attestations_cession*", async (route) => {
    const reponse = await route.fetch();
    let corps;
    try { corps = await reponse.json(); } catch { await route.fulfill({ response: reponse }); return; }
    if (Array.isArray(corps)) {
      for (const l of corps) {
        const lotissement = l?.lot?.ilots?.lotissements;
        if (lotissement) delete lotissement.signatures_requises;
      }
    }
    await route.fulfill({ response: reponse, json: corps });
  });
  await page.reload({ waitUntil: "networkidle", timeout: 90000 });
  await carte().getByText(/ATT-CESS-/).first().waitFor({ timeout: 30000 });

  const op = pastille("Opérateur");
  if ((await op.count()) === 0) throw new Error("le créneau Opérateur a disparu sous mutation");
  if (await estNonRequise(op)) {
    throw new Error(
      "l'écran affiche la MÊME chose sans la règle : les contrôles précédents ne prouvaient rien",
    );
  }
  const classe = (await op.getAttribute("class")) ?? "";
  if (!classe.includes("warning")) {
    throw new Error(`sous mutation, l'Opérateur devrait redevenir orange : ${classe}`);
  }
});

await step("MUTATION : la règle rétablie, l'écran revient à l'état correct", async () => {
  await page.unroute("**/rest/v1/attestations_cession*");
  await page.reload({ waitUntil: "networkidle", timeout: 90000 });
  await carte().getByText(/ATT-CESS-/).first().waitFor({ timeout: 30000 });
  const op = pastille("Opérateur");
  if (!(await estNonRequise(op))) {
    throw new Error(`retour à l'état correct non observé (title=${await op.getAttribute("title")})`);
  }
});

await step("aucune erreur console", async () => {
  if (errors.length) throw new Error(errors.join(" | "));
});

await page.screenshot({ path: ".shots/cessions-signatures-requises.png", fullPage: false });
await browser.close();
for (const s of steps) console.log(`  ${s.ok ? "ok " : "KO "} ${s.name}${s.ok ? "" : `  — ${s.error}`}`);
const ok = steps.filter((s) => s.ok).length;
console.log(`\n${ok}/${steps.length} contrôles`);
process.exit(ok === steps.length ? 0 : 1);
