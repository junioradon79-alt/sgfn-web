import { readFileSync, writeFileSync } from "node:fs";

const original = readFileSync("scripts/generation-document.original.ts", "utf8");
const quittanceHtml = readFileSync("scripts/quittance-escaped.txt", "utf8");

const oldFn = `function gabaritInterne(titre: string): string {
  return \`<!DOCTYPE html><html><body><h1>\${titre}</h1><p>{{reference}} — document genere sans gabarit specifique (repli minimal)</p></body></html>\`;
}`;

const newFn = `const QUITTANCE_GABARIT = \`${quittanceHtml}\`;

function gabaritInterne(cfg: { titre: string; type_doc: string }): string {
  if (cfg.type_doc === "quittance") return QUITTANCE_GABARIT;
  return \`<!DOCTYPE html><html><body><h1>\${cfg.titre}</h1><p>{{reference}} — document genere sans gabarit specifique (repli minimal)</p></body></html>\`;
}`;

if (!original.includes(oldFn)) {
  console.error("ÉCHEC : la fonction gabaritInterne originale n'a pas été trouvée telle quelle.");
  process.exit(1);
}

let out = original.replace(oldFn, newFn);

const oldCall = "let html = (await chargerGabarit(cfg.template)) ?? gabaritInterne(cfg.titre);";
const newCall = "let html = (await chargerGabarit(cfg.template)) ?? gabaritInterne(cfg);";

if (!out.includes(oldCall)) {
  console.error("ÉCHEC : le site d'appel de gabaritInterne n'a pas été trouvé tel quel.");
  process.exit(1);
}
out = out.replace(oldCall, newCall);

// Bump du commentaire de version en tête de fichier
out = out.replace(
  "//  SGFN — Edge Function : GENERATION-DOCUMENT  (v21 : quittances de paiement)",
  "//  SGFN — Edge Function : GENERATION-DOCUMENT  (v24 : gabarit quittance mis en page)",
);

writeFileSync("scripts/generation-document.new.ts", out);
console.log("OK — nouveau fichier généré, taille:", out.length, "octets");
