/**
 * Controles du helper `src/lib/invoke-edge.ts` (dette #23).
 *
 * Pourquoi un test a ce niveau plutot qu'un test d'ecran de plus : les cinq
 * appels `functions.invoke` de l'application partagent desormais UNE fonction.
 * C'est elle qui porte toute la logique, et plusieurs de ses branches sont
 * inatteignables depuis un navigateur — un corps non-JSON, une page d'erreur
 * HTML de la plateforme, une coupure reseau. Le parcours reel est verifie par
 * `e2e-cinetpay-indisponible.mjs`, qui exerce l'ecran `/dashboard/paiements`
 * de bout en bout ; ce fichier-ci couvre ce que ce parcours ne peut pas
 * atteindre.
 *
 *   node scripts/e2e-invoke-edge.mjs
 *
 * Aucune dependance, aucun acces reseau, aucune ecriture : le client Supabase
 * est simule. Node >= 22 (le fichier .ts est importe tel quel, les types sont
 * effaces a la volee).
 */
import { invokeEdge } from "../src/lib/invoke-edge.ts";

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

const REPLI = "Repli générique.";

/** Client simule renvoyant l'erreur telle que supabase-js la construit. */
const clientEnErreur = (reponse) => ({
  functions: {
    invoke: async () => ({
      data: null, // ← la cause de la dette : `data` est TOUJOURS null en erreur
      error: Object.assign(new Error("Edge Function returned a non-2xx status code"), {
        name: "FunctionsHttpError",
        context: reponse,
      }),
    }),
  },
});

const clientOk = (data) => ({ functions: { invoke: async () => ({ data, error: null }) } });

console.log("\n── La cause de la dette ──");
{
  // Le controle qui explique tout le reste : sur une reponse non-2xx,
  // supabase-js laisse `data` a null. Tout code de la forme
  // `res.data?.error ?? "message par defaut"` affiche donc le repli, toujours.
  const client = clientEnErreur(new Response(JSON.stringify({ error: "Motif du serveur" }), { status: 503 }));
  const brut = await client.functions.invoke("x", { body: {} });
  verifier("`data` est null alors que le serveur a bien envoyé un motif", brut.data === null);
  verifier("Le motif n'est lisible que dans `error.context`", !!brut.error.context);
}

console.log("\n── Le motif du serveur remonte ──");
{
  const r = await invokeEdge(
    clientEnErreur(new Response(JSON.stringify({ error: "Agrégateur de paiement non configuré" }), { status: 503 })),
    "initier-paiement",
    {},
    REPLI,
  );
  verifier("Corps `{ error }` → motif du serveur", r.error === "Agrégateur de paiement non configuré", r.error);
  verifier("`data` reste null en erreur", r.data === null);
}

{
  // `analyser-document-ia` nomme son champ `erreur`, pas `error`.
  const r = await invokeEdge(
    clientEnErreur(new Response(JSON.stringify({ ok: false, erreur: "Document illisible" }), { status: 422 })),
    "analyser-document-ia",
    {},
    REPLI,
  );
  verifier("Corps `{ erreur }` → motif du serveur", r.error === "Document illisible", r.error);
}

{
  const r = await invokeEdge(
    clientEnErreur(new Response("Non autorise", { status: 401 })),
    "generation-document",
    {},
    REPLI,
  );
  verifier("Corps en texte brut court → remonté tel quel", r.error === "Non autorise", r.error);
}

console.log("\n── Le repli reprend la main quand il n'y a rien d'exploitable ──");
{
  const r = await invokeEdge(
    clientEnErreur(new Response(JSON.stringify({ code: 42 }), { status: 500 })),
    "x",
    {},
    REPLI,
  );
  verifier("JSON sans champ de message → repli", r.error === REPLI, r.error);
}

{
  const r = await invokeEdge(
    clientEnErreur(new Response("<!doctype html><html><body>502 Bad Gateway</body></html>", { status: 502 })),
    "x",
    {},
    REPLI,
  );
  verifier("Page HTML de la plateforme → repli, jamais du HTML à l'écran", r.error === REPLI, r.error);
}

{
  const r = await invokeEdge(
    clientEnErreur(new Response("x".repeat(5000), { status: 500 })),
    "x",
    {},
    REPLI,
  );
  verifier("Trace technique très longue → repli", r.error === REPLI, `${r.error?.length ?? 0} caractères`);
}

{
  const r = await invokeEdge(
    clientEnErreur(new Response(JSON.stringify({ error: "   " }), { status: 500 })),
    "x",
    {},
    REPLI,
  );
  verifier("Message vide ou blanc → repli", r.error === REPLI, r.error);
}

{
  // supabase-js peut aussi lever (coupure reseau, preflight CORS refuse).
  const client = { functions: { invoke: async () => { throw new TypeError("Failed to fetch"); } } };
  const r = await invokeEdge(client, "x", {}, REPLI);
  verifier("`invoke` qui lève (réseau, CORS) → repli, pas de crash", r.error === REPLI, r.error);
}

{
  const client = {
    functions: { invoke: async () => ({ data: null, error: new Error("boum") }) },
  };
  const r = await invokeEdge(client, "x", {}, REPLI);
  verifier("Erreur sans `context` → repli", r.error === REPLI, r.error);
}

console.log("\n── Les cas 2xx ──");
{
  // Une fonction peut repondre 200 en signalant un echec metier dans le corps.
  const r = await invokeEdge(clientOk({ error: "Lot déjà en vente" }), "publier-annonce", {}, REPLI);
  verifier("200 portant `{ error }` → échec métier remonté", r.error === "Lot déjà en vente", r.error);
  verifier("…et `data` est neutralisé", r.data === null);
}

{
  const r = await invokeEdge(clientOk({ payment_url: "https://checkout/x" }), "initier-paiement", {}, REPLI);
  verifier("Succès → `data` intact", r.data?.payment_url === "https://checkout/x");
  verifier("Succès → `error` null", r.error === null);
}

{
  // `null` est une reponse 2xx valide : ne pas la confondre avec une erreur.
  const r = await invokeEdge(clientOk(null), "x", {}, REPLI);
  verifier("Réponse vide → pas d'erreur inventée", r.error === null && r.data === null);
}

console.log("\n── Lecture du corps ──");
{
  // Le corps d'une Response ne se lit qu'une fois. Le helper travaille sur une
  // copie pour pouvoir retomber sur `.text()` quand `.json()` echoue : si la
  // copie n'etait pas faite, ce cas renverrait le repli au lieu du texte.
  const reponse = new Response("Service momentanément indisponible", { status: 503 });
  const r = await invokeEdge(clientEnErreur(reponse), "x", {}, REPLI);
  verifier(
    "JSON invalide → repli sur le texte brut (la copie a préservé le corps)",
    r.error === "Service momentanément indisponible",
    r.error,
  );
}

console.log(`\n${ko === 0 ? "✅" : "❌"} ${ok}/${ok + ko} contrôles passés\n`);
process.exit(ko === 0 ? 0 : 1);
