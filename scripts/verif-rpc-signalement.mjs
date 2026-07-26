/**
 * Contrôle de la RPC `signaler_probleme_parcelle` contre la base RÉELLE.
 *
 * 🛑 **N'écrit rien, par construction.** Les deux cas exercés sont ceux où la
 * fonction *refuse* :
 *   • un `lot_id` tiré au hasard ne peut correspondre à aucune attribution, la
 *     garde fail-closed lève avant le `insert` ;
 *   • un objet vide est rejeté avant le `insert` lui aussi.
 * Le cas passant (un lot réellement détenu) n'est PAS exercé : il créerait un
 * vrai dossier de litige dans la file de l'administration.
 *
 *   MSYS_NO_PATHCONV=1 node scripts/verif-rpc-signalement.mjs
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

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

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

console.log("\n▶ RPC signaler_probleme_parcelle — garde fail-closed\n");

// 1. En anonyme : le droit d'exécution a été révoqué pour `anon`.
//
// ⚠️ On exige la SIGNATURE du refus, pas « une erreur quelconque » : un
// `TypeError: fetch failed` (coupure réseau, DNS sécurisé) satisferait un
// simple `!!error` et le contrôle passerait au vert sans avoir rien prouvé.
{
  let tentative = null;
  for (let i = 0; i < 3 && !tentative; i += 1) {
    const { error } = await anon.rpc("signaler_probleme_parcelle", {
      p_lot_id: randomUUID(),
      p_objet: "Contrôle",
      p_description: null,
    });
    // Une panne réseau n'est pas une réponse : on retente.
    if (error && /fetch failed|network|ENOTFOUND|ETIMEDOUT/i.test(error.message)) continue;
    tentative = { error };
  }
  const err = tentative?.error;
  const refus =
    !!err && (err.code === "42501" || /permission denied|not find the function|does not exist/i.test(err.message));
  verifier(
    "Un appel anonyme est refusé (EXECUTE révoqué pour anon)",
    refus,
    !tentative
      ? "réseau indisponible après 3 tentatives — NON CONCLUANT"
      : err
        ? `${err.code ?? ""} ${err.message}`.trim().slice(0, 80)
        : "aucune erreur — la fonction est exécutable en ANONYME !",
  );
}

// 2. Connecté : la fonction existe et refuse un lot qui n'est pas le nôtre.
const { error: eLogin } = await anon.auth.signInWithPassword({
  email: "manuel.admin@sgfn.ci",
  password: env.MANUEL_TEST_PASSWORD,
});
verifier("Session ouverte pour le contrôle", !eLogin, eLogin?.message ?? "");

if (!eLogin) {
  {
    const { error } = await anon.rpc("signaler_probleme_parcelle", {
      p_lot_id: randomUUID(),
      p_objet: "Contrôle — ne doit jamais aboutir",
      p_description: null,
    });
    verifier(
      "Un lot non rattaché est refusé (garde fail-closed)",
      !!error && /rattaché/i.test(error.message),
      error ? error.message.slice(0, 70) : "AUCUNE ERREUR — la garde ne protège pas !",
    );
  }
  {
    const { error } = await anon.rpc("signaler_probleme_parcelle", {
      p_lot_id: randomUUID(),
      p_objet: "   ",
      p_description: null,
    });
    verifier(
      "Un objet vide est refusé",
      !!error && /objet/i.test(error.message),
      error ? error.message.slice(0, 70) : "AUCUNE ERREUR — ANORMAL",
    );
  }
  await anon.auth.signOut();
}

console.log("  🛑 Le cas passant n'est pas exercé : il créerait un vrai litige.");
console.log(`\n${ko === 0 ? "✅" : "❌"} ${ok}/${ok + ko} contrôles passés\n`);
process.exit(ko === 0 ? 0 : 1);
