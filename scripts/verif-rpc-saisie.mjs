/**
 * Contrôle du type de soumission `maj_attributaire` contre la base RÉELLE.
 *
 * 🛑 **N'écrit rien, par construction.** L'ordre des contrôles dans
 * `soumettre_saisie` est : authentification → **liste blanche des types** →
 * payload nul → rôle → INSERT. Un payload nul est donc rejeté *après* que le
 * type a été accepté et *avant* toute écriture : c'est la preuve que le
 * nouveau type passe, sans créer de soumission dans la file d'un vrai
 * administrateur.
 *
 * Le chemin passant n'est PAS exercé : il déposerait une vraie soumission, et
 * l'approuver modifierait un vrai attributaire du registre.
 *
 *   MSYS_NO_PATHCONV=1 node scripts/verif-rpc-saisie.mjs
 */
import { readFileSync } from "node:fs";
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

/** Une panne réseau n'est pas une réponse : on retente avant de conclure. */
async function appeler(args, tentatives = 3) {
  for (let i = 0; i < tentatives; i += 1) {
    const { error } = await anon.rpc("soumettre_saisie", args);
    if (error && /fetch failed|network|ENOTFOUND|ETIMEDOUT/i.test(error.message)) continue;
    return error;
  }
  return { message: "réseau indisponible après 3 tentatives", code: "RESEAU" };
}

console.log("\n▶ soumettre_saisie — nouveau type `maj_attributaire`\n");

// 1. En anonyme : refusé avant tout le reste.
{
  const err = await appeler({
    p_type: "maj_attributaire",
    p_lotissement_id: null,
    p_titre: null,
    p_payload: { nom: "Contrôle" },
    p_resume: null,
  });
  verifier(
    "Un appel anonyme est refusé",
    !!err && /authentification requise/i.test(err.message),
    err ? err.message.slice(0, 70) : "AUCUNE ERREUR — ANORMAL",
  );
}

const { error: eLogin } = await anon.auth.signInWithPassword({
  email: "manuel.admin@sgfn.ci",
  password: env.MANUEL_TEST_PASSWORD,
});
verifier("Session ouverte pour le contrôle", !eLogin, eLogin?.message ?? "");

if (!eLogin) {
  // 2. Le type est accepté par la liste blanche.
  //    ⚠️ On exige le message « Payload vide » : c'est ce qui distingue « le
  //    type est passé » de « le type a été rejeté ». Se contenter de « une
  //    erreur quelconque » ferait passer ce contrôle même si la migration
  //    n'avait jamais été appliquée.
  {
    const err = await appeler({
      p_type: "maj_attributaire",
      p_lotissement_id: null,
      p_titre: null,
      p_payload: null,
      p_resume: null,
    });
    verifier(
      "Le type `maj_attributaire` passe la liste blanche",
      !!err && /payload vide/i.test(err.message),
      err ? err.message.slice(0, 70) : "AUCUNE ERREUR — une soumission a pu être créée !",
    );
  }

  // 3. Un type inconnu reste refusé — la liste blanche n'a pas été ouverte.
  {
    const err = await appeler({
      p_type: "type_inexistant",
      p_lotissement_id: null,
      p_titre: null,
      p_payload: null,
      p_resume: null,
    });
    verifier(
      "Un type inconnu est toujours refusé",
      !!err && /type de soumission invalide/i.test(err.message),
      err ? err.message.slice(0, 70) : "AUCUNE ERREUR — ANORMAL",
    );
  }

  // 4. Les quatre types préexistants passent toujours : la réécriture de la
  //    fonction ne devait rien retirer.
  for (const t of ["maj_attributions", "creation_structure", "creation_lotissement", "modification_lotissement"]) {
    const err = await appeler({
      p_type: t,
      p_lotissement_id: null,
      p_titre: null,
      p_payload: null,
      p_resume: null,
    });
    verifier(
      `Le type préexistant \`${t}\` passe toujours`,
      !!err && /payload vide/i.test(err.message),
      err ? err.message.slice(0, 50) : "AUCUNE ERREUR",
    );
  }

  await anon.auth.signOut();
}

console.log("  🛑 Aucun chemin passant exercé : il créerait une vraie soumission.");
console.log(`\n${ko === 0 ? "✅" : "❌"} ${ok}/${ok + ko} contrôles passés\n`);
process.exit(ko === 0 ? 0 : 1);
