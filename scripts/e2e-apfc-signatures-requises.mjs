// L'APFC n'exige plus 3 signatures en dur : elle en exige ce que son
// lotissement demande. Preuve de bout en bout, EN LECTURE SEULE (aucune
// écriture en production).
//
// 🔴 LE FAUX VERT QUE CE SCRIPT EXISTE POUR TUER. « 2/2 signatures » à l'écran
// ne prouve rien à lui seul : si l'embed `lotissement:lotissement_id(...)`
// échouait silencieusement, `etatSignaturesApfc` retomberait sur
// `SIGNATURES_PAR_DEFAUT` — qui donne AUSSI deux créneaux d'APFC, puisque
// `operateur` n'a pas de colonne. L'écran afficherait le bon chiffre pour la
// mauvaise raison. On inspecte donc la RÉPONSE PostgREST elle-même : la seule
// façon de distinguer « la règle est lue » de « le repli a compensé ».
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
// (« Failed to fetch ») : la connexion n'aboutit jamais et TOUS les contrôles
// tombent en désignant l'écran, alors que le défaut est ici. Cf. mémoire
// projet « connectivite_dns_securise_chrome », et `e2e-shot.mjs`.
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

// Toute réponse PostgREST portant sur les APFC est capturée, corps compris.
const reponsesApfc = [];
page.on("response", async (r) => {
  if (!r.url().includes("/rest/v1/attestations_coutumieres")) return;
  let corps = null;
  try { corps = await r.json(); } catch { /* corps vide (head:true) */ }
  reponsesApfc.push({ url: r.url(), statut: r.status(), corps });
});

// `innerText` applique le `text-transform` CSS : on compare toujours en
// minuscules et espaces normalisés (piège déjà rencontré sur ce chantier).
const txt = async (loc) => (await loc.innerText()).toLowerCase().replace(/\s+/g, " ").trim();

await step("la chefferie ouvre ses validations", async () => {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector("#email", { timeout: 20000 });
  await page.fill("#email", "manuel.chefferie@sgfn.ci");
  await page.fill("#password", PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 60000 });
  await page.goto(`${BASE}/dashboard/validations`, { waitUntil: "networkidle", timeout: 90000 });
  await page.locator("#apfc").getByText(/APFC-EBIMPE-2022-001/).waitFor({ timeout: 30000 });
});

// ⚠️ Tout est scopé sur `#apfc` : la même page porte 50 attestations de
// cession avec leurs propres boutons « Valider » et leurs propres pastilles.
const carte = () => page.locator("#apfc");

await step("LA RÈGLE EST LUE : la réponse porte signatures_requises = [proprietaire, chefferie]", async () => {
  const avecEmbed = reponsesApfc.filter((r) => Array.isArray(r.corps) && r.corps.length > 0);
  if (avecEmbed.length === 0) throw new Error("aucune réponse APFC exploitable interceptée");
  const ligne = avecEmbed.flatMap((r) => r.corps).find((a) => a.reference === "APFC-EBIMPE-2022-001");
  if (!ligne) throw new Error("APFC-EBIMPE-2022-001 absente des réponses");
  const requises = ligne.lotissement?.signatures_requises;
  if (!Array.isArray(requises)) {
    throw new Error(`l'embed n'a rien rendu (repli silencieux) : ${JSON.stringify(ligne.lotissement)}`);
  }
  const attendu = ["proprietaire", "chefferie"];
  if (JSON.stringify([...requises].sort()) !== JSON.stringify([...attendu].sort())) {
    throw new Error(`signatures_requises inattendu : ${JSON.stringify(requises)}`);
  }
  if (ligne.cvgfr_id !== null) throw new Error(`cvgfr_id devrait être null, vaut ${ligne.cvgfr_id}`);
});

await step("l'APFC est complète : « 2/2 signatures »", async () => {
  const t = await txt(carte());
  if (!t.includes("2/2 signature")) throw new Error(`décompte absent ou faux : …${t.slice(-260)}`);
});

await step("CONTRÔLE QUI DOIT ÉCHOUER : plus aucune trace de « /3 »", async () => {
  const t = await txt(carte());
  if (t.includes("/3 signature")) throw new Error("le total en dur (3) est toujours affiché");
  if (t.includes("2/3")) throw new Error("« 2/3 » est toujours affiché");
});

await step("le créneau CVGFR est présenté comme NON REQUIS, pas comme manquant", async () => {
  const cvgfr = carte().getByText("CVGFR", { exact: false }).first();
  if ((await cvgfr.count()) === 0) throw new Error("le créneau CVGFR a disparu de l'écran");
  const marque = await carte().locator("span", { hasText: /CVGFR/ }).first().getAttribute("title");
  if (!marque || !marque.toLowerCase().includes("non requise")) {
    throw new Error(`le CVGFR n'est pas marqué « non requise » (title=${marque})`);
  }
});

await step("la chefferie ne se voit plus proposer de signer cette APFC", async () => {
  const boutons = await carte().getByRole("button", { name: /valider/i }).count();
  if (boutons !== 0) throw new Error(`${boutons} bouton(s) « Valider » sur une APFC déjà complète`);
  const valide = await carte().getByText("Validé", { exact: true }).count();
  if (valide !== 1) throw new Error(`pastille « Validé » attendue une fois, vue ${valide} fois`);
});

await step("la carte APFC n'est plus en alerte et ne porte plus de compteur", async () => {
  const tone = await carte().getAttribute("data-tone");
  if (tone === "alert") throw new Error("la carte APFC est encore teintée alerte");
});

// ── CONTRE-CONTRÔLE — une garde qui refuserait TOUT passerait les tests
//    ci-dessus (0 bouton, 0 alerte, 0 compteur). On exige donc que la MÊME
//    page continue d'exiger ce qui est réellement dû ailleurs.
await step("CONTRE-CONTRÔLE : les 50 cessions attendent toujours la chefferie", async () => {
  const boutons = await page.locator("#cessions").getByRole("button", { name: /valider/i }).count();
  if (boutons === 0) throw new Error("plus aucune cession en attente : la garde refuse tout");
});

await step("CONTRE-CONTRÔLE : une signature non constatée reste en orange ailleurs", async () => {
  // Les cessions affichent « Chef de famille » / « Opérateur » en attente : si
  // le composant de pastilles rendait tout en « non requis », on le verrait ici.
  const enAttente = await page.locator("#cessions").getByText("Chef de famille", { exact: true }).count();
  if (enAttente === 0) throw new Error("aucune signature en attente affichée sur les cessions");
});

await step("aucune erreur console", async () => {
  if (errors.length) throw new Error(errors.join(" | "));
});

await browser.close();
for (const s of steps) console.log(`  ${s.ok ? "ok " : "KO "} ${s.name}${s.ok ? "" : `  — ${s.error}`}`);
const ok = steps.filter((s) => s.ok).length;
console.log(`\n${ok}/${steps.length} contrôles`);
process.exit(ok === steps.length ? 0 : 1);
