/**
 * Rail de paiement EN LIGNE — controle de l'INDISPONIBILITE de l'agregateur.
 *
 * Ce test ne prouve pas qu'un paiement aboutit : il ne peut pas. Les secrets
 * `CINETPAY_API_KEY` / `CINETPAY_SITE_ID` ne sont pas poses sur le projet
 * (16 secrets, aucun des deux), donc `initier-paiement` et
 * `payer-consultation-qr` s'arretent tous les deux sur un 503 avant meme
 * d'appeler CinetPay. C'est le critere de sortie deja inscrit au document
 * directeur, pas une decouverte.
 *
 * Ce qu'il prouve, et qui a une valeur propre :
 *
 *   1. Le refus est PROPRE : la fonction sort AVANT d'ecrire. Un 503 qui aurait
 *      deja bascule le paiement en `initie` laisserait une ligne mensongere,
 *      impossible a distinguer d'un paiement reellement parti chez
 *      l'agregateur. Le test relit la ligne apres l'appel pour le verifier.
 *   2. L'utilisateur n'est pas laisse sur un ecran mort : le bouton se
 *      deverrouille et un message s'affiche.
 *   3. Ce message est CELUI DU SERVEUR, et non un repli generique (dette #23,
 *      corrigee le 28/07 via `src/lib/invoke-edge.ts`). Ce point etait un
 *      simple constat lors de la premiere ecriture du fichier ; il est
 *      maintenant assert.
 *
 * Le jour ou les secrets seront poses, ce fichier deviendra rouge — et c'est
 * exactement ce qu'on veut : il faudra alors ecrire le vrai parcours de
 * paiement, qui n'existe pas encore.
 *
 * Exige la fixture :
 *   powershell> .\scripts\supabase-sql.ps1 -SqlFile .\scripts\preparer-etat-e2e-cinetpay.sql
 *   node scripts/e2e-cinetpay-indisponible.mjs
 *   powershell> .\scripts\supabase-sql.ps1 -SqlFile .\scripts\restaurer-etat-e2e-cinetpay.sql
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE || "http://localhost:3001";
const OUT = new URL("../.shots/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const chemin = (s) => new URL(`cinetpay-${s}`, OUT).pathname.replace(/^\//, "");

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const TITULAIRE = { email: "client.test@sgfn.ci", pwd: env.MANUEL_TEST_PASSWORD };
const PAIEMENT = "e2ec1000-0000-4000-8000-000000000001";

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

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Le poste sort en IPv6/NAT64 : un appel isole tombe parfois en timeout de
// connexion. On reessaie l'ouverture de session, jamais les controles.
let sess = null;
let authErr = null;
for (let essai = 1; essai <= 3; essai += 1) {
  try {
    const r = await sb.auth.signInWithPassword({ email: TITULAIRE.email, password: TITULAIRE.pwd });
    authErr = r.error;
    sess = r.data?.session ?? null;
    if (sess) break;
  } catch (e) {
    authErr = e;
  }
  if (essai < 3) await new Promise((r) => setTimeout(r, 1500));
}

console.log("\n── Fonction `initier-paiement` ──");
verifier("Connexion du titulaire", !!sess, authErr?.message ?? "");
if (!sess) {
  console.log("\n❌ Sans session, rien ne peut être prouvé. Arrêt.\n");
  process.exit(1);
}

const invoquer = async (slug, body, avecJeton = true) => {
  const headers = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" };
  if (avecJeton) headers.Authorization = `Bearer ${sess.access_token}`;
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${slug}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { status: r.status, corps: await r.json().catch(() => ({})) };
};

{
  const r = await invoquer("initier-paiement", { paiement_id: PAIEMENT }, false);
  verifier("Sans jeton → refus 401", r.status === 401, `HTTP ${r.status}`);
}

{
  const r = await invoquer("initier-paiement", { paiement_id: "00000000-0000-4000-8000-000000000000" });
  verifier("Paiement inexistant → refus", r.status >= 400, `HTTP ${r.status} · ${r.corps?.error ?? ""}`);
}

// Le controle central.
{
  const r = await invoquer("initier-paiement", { paiement_id: PAIEMENT });
  verifier("Agrégateur non configuré → 503", r.status === 503, `HTTP ${r.status}`);
  verifier(
    "Le motif est explicite, pas une erreur générique",
    /agr[ée]gateur de paiement non configur/i.test(r.corps?.error ?? ""),
    r.corps?.error ?? "(aucun message)",
  );
}

// La preuve que le refus est propre : la ligne n'a pas bouge. `initier-paiement`
// bascule le paiement en `initie` et pose `reference_externe` — mais SEULEMENT
// apres le controle des secrets. Si l'ordre etait inverse, on aurait ici un
// paiement marque comme parti chez un agregateur qui n'a jamais ete appele.
{
  const { data, error } = await sb
    .from("paiements")
    .select("statut, reference_externe")
    .eq("id", PAIEMENT)
    .single();
  verifier("Le paiement est relisible par son titulaire", !error && !!data, error?.message ?? "");
  verifier(
    "Le refus n'a rien écrit : statut toujours `en_attente`",
    data?.statut === "en_attente",
    `statut = ${data?.statut ?? "?"}`,
  );
  verifier(
    "Aucune référence d'agrégateur n'a été posée",
    data?.reference_externe == null,
    `reference_externe = ${data?.reference_externe ?? "(null)"}`,
  );
}

console.log("\n── Fonction `payer-consultation-qr` ──");
// Meme verrou, autre canal : la consultation QR a 60 000 F. Ce controle a
// d'abord ete ecrit en `status >= 400` sur un corps vide — il passait au vert
// sur « jeton_consultation requis », c'est-a-dire sur sa propre erreur de
// forme, sans jamais atteindre la branche CinetPay. On vise donc le jeton de
// la fixture et on exige le 503 exact.
{
  const r = await invoquer("payer-consultation-qr", {
    jeton_consultation: "e2e-jeton-controle-cinetpay",
  });
  verifier(
    "Le canal QR atteint le même verrou → 503",
    r.status === 503,
    `HTTP ${r.status} · ${r.corps?.error ?? ""}`,
  );
  verifier(
    "Le canal QR donne le même motif explicite",
    /agr[ée]gateur de paiement non configur/i.test(r.corps?.error ?? ""),
    r.corps?.error ?? "(aucun message)",
  );
}

// Et la contre-epreuve : un jeton inconnu doit etre refuse AUTREMENT (404), ce
// qui prouve que le 503 ci-dessus vient bien du verrou et non d'un refus
// indifferencie.
{
  const r = await invoquer("payer-consultation-qr", { jeton_consultation: "jeton-qui-n-existe-pas" });
  verifier(
    "Un jeton inconnu est refusé différemment (404), pas par le verrou",
    r.status === 404,
    `HTTP ${r.status} · ${r.corps?.error ?? ""}`,
  );
}

console.log("\n── Écran : ce que voit l'utilisateur ──");
const browser = await chromium.launch({
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const erreurs = [];
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(m.text());
});

await page.goto(`${BASE}/login/`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#email", { timeout: 30000 });
await page.fill("#email", TITULAIRE.email);
await page.fill("#password", TITULAIRE.pwd);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard**", { timeout: 25000 });

await page.goto(`${BASE}/dashboard/paiements/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
const corps = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
let body = await corps();
await page.screenshot({ path: chemin("avant.png"), fullPage: true });

verifier("Le titulaire voit son paiement en attente", /Contr[oô]le e2e CinetPay/i.test(body));

const payer = page.getByRole("button", { name: /^Payer$/ });
verifier("Le bouton « Payer » lui est offert", (await payer.count()) > 0);

if ((await payer.count()) > 0) {
  const urlAvant = page.url();
  await payer.first().click();
  await page.waitForTimeout(6000);
  body = await corps();
  await page.screenshot({ path: chemin("apres.png"), fullPage: true });

  verifier("Aucune redirection vers un agrégateur injoignable", page.url() === urlAvant, page.url());
  verifier(
    "Un message d'erreur est affiché à l'utilisateur",
    /erreur|indisponible|non configur|impossible/i.test(body),
  );
  verifier(
    "Le bouton se déverrouille (l'utilisateur n'est pas bloqué)",
    !(await payer.first().isDisabled()),
  );

  // Ce que le message dit VRAIMENT — dette #23, corrigee le 28/07.
  //
  // `supabase.functions.invoke` place les reponses non-2xx dans `res.error` et
  // laisse `res.data` a null. Le `res.data?.error` des composants ne pouvait
  // donc JAMAIS remonter le motif du serveur : l'utilisateur recevait toujours
  // le repli generique, precisement quand le message du serveur avait de la
  // valeur. Depuis `src/lib/invoke-edge.ts`, le motif est lu dans
  // `error.context`. Ce bloc etait un simple constat ; il est desormais une
  // exigence — c'est le test qui documentait la dette qui prouve sa correction.
  verifier(
    "Le motif du serveur atteint l'écran",
    /agr[ée]gateur de paiement non configur/i.test(body),
    body.match(/[^.]*(?:erreur|indisponible|non configur|impossible)[^.]*/i)?.[0]?.trim() ??
      "(aucun message trouvé)",
  );
  // Le controle jumeau : exiger le bon message ne suffit pas si le mauvais
  // s'affiche a cote (deux zones d'erreur, un etat residuel...).
  verifier(
    "Le repli générique a disparu de l'écran",
    !/Erreur lors de l'initialisation du paiement/i.test(body),
  );
}

const deborde = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
);
verifier("Aucun débordement horizontal", !deborde);

const bruit = erreurs.filter(
  (e) => !/favicon|DevTools|Fast Refresh|manifest|Download the React|503|Failed to load resource/i.test(e),
);
verifier("Aucune erreur console inattendue", bruit.length === 0, bruit.slice(0, 3).join(" | "));

await browser.close();
console.log("\n  🔴 La fixture est encore en base. Passer maintenant :");
console.log("     .\\scripts\\supabase-sql.ps1 -SqlFile .\\scripts\\restaurer-etat-e2e-cinetpay.sql");
console.log(`\n${ko === 0 ? "✅" : "❌"} ${ok}/${ok + ko} contrôles passés — captures dans .shots/\n`);
process.exit(ko === 0 ? 0 : 1);
