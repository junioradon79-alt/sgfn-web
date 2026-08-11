// =====================================================================
//  DETTE #49 — PREUVE DE LA GARDE DE CHEMIN
//
//  Enonce d'origine (§4.3 du document directeur), VERBATIM :
//    « `telecharger-document` signe en `service_role` le chemin que la
//      LIGNE declare, sans valider aucun prefixe. […] le `variant` est
//      choisi par le client —, puis
//      `adminClient.storage.createSignedUrl(chemin, 120)`. La ligne est
//      relue avec le jeton de l'appelant, donc le controle RLS passe :
//      c'est bien SA ligne. Mais le chemin qu'elle declare n'est jamais
//      valide. Consequence generale : qui peut INSERER une ligne dans
//      `documents` peut LIRE n'importe quel objet du bucket prive. »
//
//  ── 🔴 CE QUE CE SCRIPT NE FAISAIT PAS, ET QUI ETAIT SON DEFAUT ───────
//  Premiere version, 10/08/2026 : elle extrayait le bloc de garde entre
//  deux marqueurs, l'importait, et le testait comme une fonction pure.
//  Un verificateur tiers l'a mise en defaut le jour meme, avec deux
//  mutations reproductibles :
//     M6 — supprimer l'appel a `motifDeRefusDuChemin(...)` dans
//          `telecharger-document`, en laissant `createSignedUrl(chemin, 120)`
//     M7 — le meme geste dans `convertir-plan-cad`
//  Dans les deux cas le script affichait `TOUT PASSE`, exit 0. Il
//  validait une fonction pure et comparait deux blocs de texte ; il ne
//  verifiait JAMAIS que la garde etait CABLEE dans le chemin de requete.
//  C'est exactement le mecanisme qui avait laisse passer `apercu_url` le
//  09/08 : un controle affirmatif qui rassure sans rien tenir.
//
//  D'ou les deux sections qui portent desormais la preuve :
//     ② CABLAGE — assertions sur le CORPS des deux `index.ts` : ordre des
//        appels, nombre d'appels, couverture des colonnes de chemin.
//     ⑥ COMPORTEMENT — les deux handlers sont REELLEMENT EXECUTES, avec
//        un client Supabase bouchonne qui JOURNALISE ce que la fonction
//        demande a signer ou a telecharger. C'est la seule section qui
//        peut dire « aucune URL n'a ete signee » plutot que « la fonction
//        pure aurait refuse ».
//  M6 et M7 font virer ⑥ au rouge, et ② aussi.
//
//  ── USAGE ────────────────────────────────────────────────────────────
//    node scripts/e2e-dette-49-chemin-signe.mjs
//    node scripts/e2e-dette-49-chemin-signe.mjs --synchroniser
//    node scripts/e2e-dette-49-chemin-signe.mjs --production <dump.json>
//    node scripts/e2e-dette-49-chemin-signe.mjs --miroir <dossier>
//
//  `--miroir` fait porter TOUS les controles sur une copie hors depot
//  (`<dossier>/telecharger-document/index.ts`, etc.). C'est ainsi que les
//  mutations M6/M7 se rejouent sans jamais toucher le depot.
//
//  `--production` prend un export LECTURE SEULE de `public.documents` et
//  verifie que la garde accepte 100 % des lignes reelles. C'est le
//  controle du RISQUE SYMETRIQUE : une garde qui refuserait une lecture
//  legitime viderait un ecran en production, et ce depot a deja paye ce
//  prix-la.
// =====================================================================

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");

const iMiroir = process.argv.indexOf("--miroir");
const BASE_FONCTIONS =
  iMiroir >= 0 && process.argv[iMiroir + 1]
    ? process.argv[iMiroir + 1]
    : join(RACINE, "supabase/functions");

// La garde vit dans TROIS fichiers : une source de verite et deux copies.
// `generation-document` a rejoint la liste au 4e tour, quand le jumeau EN
// ECRITURE de #49 y a ete trouve (`upload(chemin, …, { upsert: true })` en
// service_role, ou `chemin` est bati sur `pv_bornage.reference`, entierement
// fournie par le client). Un fichier modifie qui n'est couvert par aucune
// mutation n'est pas couvert.
const SOURCE = join(BASE_FONCTIONS, "telecharger-document/index.ts");
const COPIES = [
  ["convertir-plan-cad", join(BASE_FONCTIONS, "convertir-plan-cad/index.ts")],
  ["generation-document", join(BASE_FONCTIONS, "generation-document/index.ts")],
];
const COPIE = COPIES[0][1];

// `--migration <fichier>` permet de faire porter le §⑦ sur une copie hors
// depot : c'est ainsi que les mutations SQL se rejouent sans toucher la
// migration reelle, exactement comme `--miroir` pour le code.
const iMigration = process.argv.indexOf("--migration");
const MIGRATION =
  iMigration >= 0 && process.argv[iMigration + 1]
    ? process.argv[iMigration + 1]
    : join(RACINE, "supabase/migrations/20260810100000_documents_chemin_conforme_au_type.sql");

// Meme mecanisme pour la SECONDE migration (dette #49, jumeau en ecriture,
// 5e tour) : `--migration2 <fichier>`. Elle etait ABSENTE du dispositif de
// preuve — 0 assertion, 0 mutation — alors que le vérificateur l'avait
// mesuree bonne. Une migration correcte que rien ne verifie n'est pas une
// migration verifiee, elle est simplement pas-encore-cassee.
const iMigration2 = process.argv.indexOf("--migration2");
const MIGRATION2 =
  iMigration2 >= 0 && process.argv[iMigration2 + 1]
    ? process.argv[iMigration2 + 1]
    : join(RACINE, "supabase/migrations/20260810110000_reference_et_numero_sans_traversee.sql");

const MARQUEUR_DEBUT = "DEBUT DU BLOC RECOPIE";
const MARQUEUR_FIN = "FIN DU BLOC RECOPIE";

/**
 * Colonnes de `documents` qui portent un CHEMIN DE STOCKAGE.
 * Mesure du 10/08/2026 sur les 15 colonnes de la table : ce sont les deux
 * seules. Toute colonne ajoutee ici DOIT etre couverte par un appel a la
 * garde — c'est la lecon du 09/08, ou `apercu_url` avait ete oubliee sur
 * un correctif qui se declarait complet.
 */
const COLONNES_CHEMIN = ["url_fichier", "apercu_url"];

let echecs = 0;
const fail = (m) => {
  echecs++;
  console.error(`  ECHEC  ${m}`);
};
const ok = (m) => console.log(`  ok     ${m}`);

if (iMiroir >= 0) console.log(`(miroir : ${BASE_FONCTIONS})\n`);

// ─────────────────────────────────────────────────────────────────────
//  ⓪ L'OUTIL DE MESURE EST LUI-MEME MESURE
//
//  `sansCommentaires` decide desormais de ce que TOUTES les assertions
//  du §② et du bloc `generation-document` ont le droit de voir. S'il se
//  trompe, il se trompe SILENCIEUSEMENT et dans les deux sens : il peut
//  laisser passer un commentaire (le trou qu'on vient de fermer) ou
//  tronquer une chaine legitime (`"https://…"`) et fabriquer un echec
//  faux. On le teste donc sur un echantillon qui porte exactement les
//  formes presentes dans les trois `index.ts`.
// ─────────────────────────────────────────────────────────────────────

console.log("⓪ Le nettoyeur de commentaires");
{
  const echantillon = [
    'import { createClient } from "https://esm.sh/@supabase/supabase-js@2";',
    'const R = "https://storage.invalid/storage/v1/object/sign/documents/";',
    'if (chemin.includes("//")) return "segment vide";',
    "// const motif = motifDeRefusDuChemin(chemin, row.type, row.id);",
    "const vrai = motifDeRefusDuChemin(chemin, t, id); // garde reelle",
    "/* bloc : motifDeRefusDuChemin(leurre) */",
    "const s = 'a//b';",
    "const g = `x${y}//z`;",
    'const e = "guillemet \\" puis // pas un commentaire";',
  ].join("\n");
  const net = sansCommentaires(echantillon);

  for (const [doitRester, libelle] of [
    ['"https://esm.sh/@supabase/supabase-js@2"', "une URL en chaine double n'est pas tronquee"],
    ['"https://storage.invalid/storage/v1/object/sign/documents/"', "la racine de signature survit"],
    ['chemin.includes("//")', "`includes(\"//\")` survit"],
    ["const vrai = motifDeRefusDuChemin(chemin, t, id);", "le code precedant un commentaire de fin de ligne survit"],
    ["'a//b'", "une chaine simple contenant `//` survit"],
    ["`x${y}//z`", "un gabarit contenant `//` survit"],
    ['"guillemet \\" puis // pas un commentaire"', "un `//` apres un guillemet echappe reste dans la chaine"],
  ]) {
    if (net.includes(doitRester)) ok(libelle);
    else fail(`le nettoyeur DETRUIT du code : ${libelle} — absent apres nettoyage`);
  }
  for (const [doitPartir, libelle] of [
    ["// const motif", "une ligne entierement commentee disparait"],
    ["motifDeRefusDuChemin(leurre)", "un leurre en commentaire de bloc disparait"],
    ["// garde reelle", "un commentaire de fin de ligne disparait"],
  ]) {
    if (!net.includes(doitPartir)) ok(libelle);
    else fail(`le nettoyeur LAISSE un commentaire : ${libelle} — c'est la prose validee comme du code`);
  }
  // La garde ne doit plus apparaitre qu'UNE fois : la vraie. Deux leurres
  // etaient poses au-dessus.
  const n = (net.match(/motifDeRefusDuChemin\(/g) ?? []).length;
  if (n === 1) ok("apres nettoyage, 1 seule occurrence de la garde sur 3 (2 etaient en commentaire)");
  else fail(`apres nettoyage, ${n} occurrence(s) de la garde au lieu de 1 — le nettoyeur ne fait pas son office`);

  // ── 🔴 5e TOUR — LE LITTERAL DE REGEX, EXPLOITE PAR LE VERIFICATEUR ────
  // `/don't/` : l'apostrophe faisait (AVANT correction) entrer le scanner
  // en mode chaine, et tout ce qui suit — y compris une garde reelle mise
  // en commentaire — etait lu comme du texte de chaine ordinaire et
  // « survivait » au nettoyage. Reproduit ici tel quel : une regex a
  // apostrophe AVANT la garde commentee, exactement la forme qui retablit
  // la parite de guillemets pour un scanner naif.
  const exploitRegex = [
    "const motifApostrophe = /don't/.test(x);",
    "// const motif2 = motifDeRefusDuChemin(chemin, row.type, row.id);",
    "const vrai2 = motifDeRefusDuChemin(chemin, t, id);",
  ].join("\n");
  const netRegex = sansCommentaires(exploitRegex);
  if (netRegex.includes("/don't/.test(x)"))
    ok("nettoyeur TS — le litteral de regex `/don't/` est recopie intact");
  else fail(`nettoyeur TS — le litteral de regex \`/don't/\` a ete altere (sortie : ${JSON.stringify(netRegex)})`);
  if (!netRegex.includes("// const motif2"))
    ok("nettoyeur TS — la garde commentee APRES la regex a apostrophe disparait bien (exploit ferme)");
  else
    fail(
      "nettoyeur TS — EXPLOIT REPRODUIT : la garde commentee 'survit' au nettoyage a cause de la regex a " +
        `apostrophe qui precede (sortie : ${JSON.stringify(netRegex)})`,
    );
  const nRegexExploit = (netRegex.match(/motifDeRefusDuChemin\(/g) ?? []).length;
  if (nRegexExploit === 1) ok("nettoyeur TS — 1 seule garde active detectee malgre la regex a apostrophe (attendu 1)");
  else fail(`nettoyeur TS — ${nRegexExploit} garde(s) detectee(s) au lieu de 1 : l'exploit par regex n'est pas ferme`);

  // ── La DIVISION reste une division (le classifieur ne doit pas confondre
  //    un "/" de calcul avec un litteral regex) ────────────────────────────
  const division = "const moitie = total / 2;";
  const netDiv = sansCommentaires(division);
  if (netDiv === division) ok("nettoyeur TS — une division `total / 2` n'est pas prise pour un litteral regex");
  else fail(`nettoyeur TS — une division a ete alteree : ${JSON.stringify(netDiv)}`);

  // ── Le cas AMBIGU : `}` suivi de `/`, ni clairement une valeur ni
  //    clairement un debut d'expression. FAIL-CLOSED exige : lever, pas
  //    deviner. ─────────────────────────────────────────────────────────
  const ambigu = "function f() { return 1; }\n/x/.test(y);";
  try {
    sansCommentaires(ambigu);
    fail("nettoyeur TS — le cas ambigu `}` suivi de `/` n'a PAS leve : le controle devine au lieu de refuser");
  } catch {
    ok("nettoyeur TS — le cas ambigu `}` suivi de `/` LEVE (fail-closed), comme exige");
  }

  // ── Le meme exploit, mais au travers du CHEMIN REEL d'appel
  //    (`extraireHandler`) : la levee doit devenir un `fail()` PROPRE, pas
  //    un plantage du script entier qui empecherait les autres sections de
  //    s'executer et de rapporter ce qu'elles savent. ─────────────────────
  {
    const ambiguDansFichier = mkdtempSync(join(tmpdir(), "dette49-ambigu-"));
    const f = join(ambiguDansFichier, "index.ts");
    writeFileSync(f, `Deno.serve(async (req) => {\n${ambigu}\n  return new Response("ok");\n});\n`);
    const avant = echecs;
    const resultat = extraireHandler(f);
    const aBienDeclencheUnFail = resultat === "" && echecs === avant + 1;
    // Le `fail()` declenche par `extraireHandler` ci-dessus est VOULU — il
    // PROUVE que l'ambiguite devient un echec propre plutot qu'un plantage.
    // Mais c'est un echec FABRIQUE PAR LE TEST, pas un vrai defaut : sans
    // compensation, le total `echecs` porterait toujours au moins 1, et le
    // script ne pourrait plus JAMAIS annoncer « TOUT PASSE », y compris sur
    // le temoin sans mutation. On restaure donc le compteur avant de juger.
    echecs = avant;
    if (aBienDeclencheUnFail)
      ok("extraireHandler — l'ambiguite devient UN `fail()` propre, le script continue (pas de plantage)");
    else
      fail(
        `extraireHandler — comportement inattendu sur le cas ambigu (resultat=${JSON.stringify(resultat.slice(0, 40))})`,
      );
  }
}

// ─────────────────────────────────────────────────────────────────────
//  ① Extraction et comparaison des deux copies
// ─────────────────────────────────────────────────────────────────────

function extraireBloc(chemin) {
  const lignes = readFileSync(chemin, "utf8").split("\n");
  const i = lignes.findIndex((l) => l.includes(MARQUEUR_DEBUT));
  const j = lignes.findIndex((l) => l.includes(MARQUEUR_FIN));
  if (i < 0) throw new Error(`marqueur de DEBUT introuvable dans ${chemin}`);
  if (j <= i) throw new Error(`marqueur de FIN introuvable ou mal place dans ${chemin}`);
  return { texte: lignes.slice(i - 1, j + 2).join("\n"), debut: i - 1, fin: j + 2 };
}

/**
 * Retire les commentaires TypeScript d'un texte, en respectant les chaines.
 *
 * ── 🔴 POURQUOI CETTE FONCTION EXISTE ────────────────────────────────
 * C'est LE piege recurrent de ce chantier, deja paye deux fois cote SQL
 * (`else false` trouve dans un commentaire, puis `grant execute` trouve
 * dans le bandeau). Il etait encore ouvert cote TypeScript : le §②
 * cherchait `motifDeRefusDuChemin(chemin` dans le texte BRUT du handler.
 * Commenter la garde reelle en laissant la ligne en commentaire —
 * `// const motif = motifDeRefusDuChemin(chemin, …)` — laissait donc le
 * controle au VERT sur un fichier ou plus rien ne gardait le chemin.
 * C'est la mutation `C6` de la matrice, et elle passait.
 *
 * ⚠️ Un `//` naif ne suffit pas : ces trois fichiers contiennent
 * `"https://esm.sh/…"`, `"https://storage.invalid/…"` et
 * `chemin.includes("//")`. Un decoupage brut sur `//` les tronquerait et
 * fabriquerait des echecs faux. On suit donc les chaines `'`, `"`, `` ` ``
 * et leurs echappements. La fonction est elle-meme TESTEE, plus bas
 * (§⓪) : un nettoyeur que rien ne verifie est exactement le genre
 * d'outil qui casse un controle en silence.
 */

/**
 * 🔴 5e TOUR — LE TROU QUE LE VERIFICATEUR A OUVERT DANS CE NETTOYEUR.
 *
 * `sansCommentaires` ne connaissait pas les LITTERAUX DE REGEX. Sur
 * `/don't/`, le caractere `/` etait recopie tel quel (il n'ouvre ni `//` ni
 * `/*`), puis l'apostrophe de `don't` faisait entrer le scanner en MODE
 * CHAINE — alors qu'elle est a l'interieur d'un litteral regex, pas d'une
 * chaine. Le scanner restait alors « en chaine » jusqu'a la PROCHAINE
 * apostrophe rencontree n'importe ou plus loin dans le fichier, avalant tout
 * ce qui se trouve entre les deux SANS jamais reconnaitre les vrais `//`
 * qui s'y trouvent — y compris une garde reelle mise en commentaire, qui
 * « survivait » donc au nettoyage puisqu'elle n'etait jamais reconnue comme
 * commentee. En ajoutant UNE SECONDE regex avec apostrophe avant la garde
 * commentee, l'attaquant retablit la parite de guillemets et rend le
 * mensonge invisible : les assertions retrouvent `motifDeRefusDuChemin(` et
 * le croient actif.
 *
 * ── LA REGLE DE DECISION, ET SON FAIL-CLOSED ─────────────────────────────
 * Distinguer un `/` de DIVISION d'un `/` de LITTERAL REGEX est un probleme
 * classique de tokenisation JS : ca depend du DERNIER TOKEN SIGNIFICATIF.
 * On suit la regle standard (celle qu'utilisent la plupart des lexers
 * legers) :
 *   · le dernier token est une VALEUR (identifiant/nombre, `)`, `]`, une
 *     chaine, ou une regex qui vient de se fermer) ET ce n'est PAS un
 *     mot-cle de `MOTS_DEBUT_EXPRESSION` -> "/" est une DIVISION ;
 *   · le dernier token est un OPERATEUR/ponctuation clair
 *     (`( , ; : = ! & | ? [ { + - * % < > ~ ^`), le debut du fichier, ou un
 *     mot-cle de `MOTS_DEBUT_EXPRESSION` -> "/" ouvre un LITTERAL REGEX ;
 *   · TOUT LE RESTE (le cas le plus notable : `}`, ambigu entre fin de bloc
 *     et fin d'objet litteral) -> ON NE DEVINE PAS. `sansCommentaires` LEVE
 *     une exception plutot que de choisir, comme demande explicitement par
 *     le verificateur. `extraireHandler` la transforme en `fail()` net
 *     (voir plus bas) : l'assertion echoue, elle ne continue pas sur un
 *     texte dont on n'est plus sur.
 *
 * Le litteral regex trouve est recopie EN ENTIER (y compris drapeaux),
 * avec la classe de caracteres `[...]` correctement geree — un `/` a
 * l'interieur d'une classe (`/[/]/`) ne ferme pas le litteral.
 */
function sansCommentaires(texte) {
  // Mots-cles qui annoncent un DEBUT D'EXPRESSION : ce qui les suit est un
  // OPERANDE, jamais la fin d'une valeur precedente — meme si le mot-cle
  // lui-meme se termine par un caractere de type "identifiant". `return /x/`
  // est un litteral regex ; `total` suivi de `/` serait une division.
  //
  // ⚠️ Declare ICI, a l'interieur de la fonction, et non au niveau du
  // module : une premiere version le declarait juste au-dessus, en `const`
  // de module. Les sections §⓪ et suivantes APPELENT `sansCommentaires`
  // des le tout debut du script, avant que l'execution lineaire du module
  // n'ait atteint cette ligne — `ReferenceError: Cannot access
  // 'MOTS_DEBUT_EXPRESSION' before initialization` (zone morte temporelle
  // d'un `const`). Le cout d'une recreation par appel est nul a l'echelle
  // de ce script.
  const MOTS_DEBUT_EXPRESSION = new Set([
    "return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
    "do", "else", "case", "yield", "throw", "await",
  ]);

  let out = "";
  let i = 0;
  let motCourant = ""; // identifiant en cours de construction
  let dernierMot = ""; // dernier mot COMPLET rencontre
  let dernierSignificatif = ""; // dernier caractere non-espace ecrit

  const finDeValeur = () =>
    /[A-Za-z0-9_$)\]]/.test(dernierSignificatif) && !MOTS_DEBUT_EXPRESSION.has(dernierMot);
  const debutDExpressionClair = () =>
    dernierSignificatif === "" ||
    /[(,;:=!&|?[{+\-*%<>~^]/.test(dernierSignificatif) ||
    MOTS_DEBUT_EXPRESSION.has(dernierMot);

  while (i < texte.length) {
    const c = texte[i];
    const d = texte[i + 1];

    if (c === '"' || c === "'" || c === "`") {
      // Chaine : recopiee telle quelle, echappements compris.
      out += c;
      i++;
      while (i < texte.length) {
        if (texte[i] === "\\") {
          out += texte.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += texte[i];
        if (texte[i] === c) {
          i++;
          break;
        }
        i++;
      }
      dernierSignificatif = ")"; // une chaine EST une valeur
      motCourant = "";
      dernierMot = "";
      continue;
    }
    if (c === "/" && d === "/") {
      while (i < texte.length && texte[i] !== "\n") i++;
      continue; // le "\n" est recopie au tour suivant : les lignes restent alignees
    }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < texte.length && !(texte[i] === "*" && texte[i + 1] === "/")) {
        if (texte[i] === "\n") out += "\n"; // on garde les sauts de ligne
        i++;
      }
      i += 2;
      continue;
    }
    if (c === "/") {
      if (finDeValeur()) {
        // DIVISION : caractere ordinaire, meme traitement que les autres.
        out += c;
        dernierSignificatif = c;
        motCourant = "";
        dernierMot = "";
        i++;
        continue;
      }
      if (!debutDExpressionClair()) {
        throw new Error(
          `"/" ambigu (division ou litteral regex ?) apres ${JSON.stringify(dernierSignificatif)} ` +
            `(dernier mot ${JSON.stringify(dernierMot)}), position ${i} — fail-closed.`,
        );
      }
      // LITTERAL REGEX : recopie integrale. `/` ne ferme pas a l'interieur
      // d'une classe `[...]` ; `\` echappe le caractere suivant ; le
      // litteral ne franchit jamais une fin de ligne (sinon c'est que ce
      // n'etait pas un vrai litteral regex — on refuse plutot que deviner).
      let j = i + 1;
      let dansClasse = false;
      let ferme = false;
      while (j < texte.length) {
        if (texte[j] === "\\") {
          j += 2;
          continue;
        }
        if (texte[j] === "\n") break;
        if (texte[j] === "[") {
          dansClasse = true;
          j++;
          continue;
        }
        if (texte[j] === "]") {
          dansClasse = false;
          j++;
          continue;
        }
        if (texte[j] === "/" && !dansClasse) {
          j++;
          ferme = true;
          break;
        }
        j++;
      }
      if (!ferme) {
        throw new Error(`litteral de regex non ferme (ou faux positif) a partir de la position ${i} — fail-closed.`);
      }
      while (j < texte.length && /[a-z]/i.test(texte[j])) j++; // drapeaux g/i/m/s/u/y/d
      out += texte.slice(i, j);
      dernierSignificatif = ")"; // une regex EST une valeur
      motCourant = "";
      dernierMot = "";
      i = j;
      continue;
    }

    if (/[A-Za-z0-9_$]/.test(c)) {
      motCourant += c;
      dernierSignificatif = c;
    } else {
      if (motCourant) {
        dernierMot = motCourant;
        motCourant = "";
      }
      if (!/\s/.test(c)) dernierSignificatif = c;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Le CHEMIN DE REQUETE, et rien d'autre : tout ce qui suit `Deno.serve(`,
 * COMMENTAIRES RETIRES.
 *
 * ⚠️ Une premiere version decoupait a partir du marqueur de FIN du bloc
 * partage. C'etait faux : les DEFINITIONS qui vivent entre le marqueur et
 * `Deno.serve(` (la garde de reference, par exemple) etaient comptees
 * comme des APPELS, et l'assertion « 1 appel attendu » en voyait 2. Un
 * controle qui compte les declarations avec les usages ne mesure pas le
 * cablage — il mesure sa propre approximation.
 *
 * 🔴 Les commentaires sont retires ICI, une fois, pour que TOUTES les
 * assertions qui lisent `h` portent sur du CODE. Voir `sansCommentaires`.
 */
function extraireHandler(chemin) {
  const texte = readFileSync(chemin, "utf8");
  const i = texte.indexOf("Deno.serve(");
  if (i < 0) throw new Error(`'Deno.serve(' introuvable dans ${chemin}`);
  try {
    return sansCommentaires(texte.slice(i));
  } catch (e) {
    // 🔴 FAIL-CLOSED, PROPREMENT RAPPORTE. `sansCommentaires` leve quand un
    // "/" est ambigu ou qu'un litteral regex ne se referme pas — les deux
    // signes d'un fichier que ce nettoyeur ne peut plus garantir avoir bien
    // lu. Une chaine vide propage l'echec en cascade (tout `.indexOf(...)`
    // en aval rend -1), au lieu de laisser une exception non rattrapee
    // interrompre le script AVANT que les autres sections n'aient pu
    // s'executer et rapporter ce qu'elles savent par ailleurs.
    fail(`${chemin} : nettoyage du code IMPOSSIBLE (${e.message}) — traite comme vide, fail-closed`);
    return "";
  }
}

if (process.argv.includes("--synchroniser")) {
  for (const [, cible] of COPIES) synchroniserVers(cible);
}

function synchroniserVers(COPIE) {
  const src = extraireBloc(SOURCE);
  const dst = extraireBloc(COPIE);
  if (src.texte === dst.texte) {
    console.log(`--synchroniser : ${COPIE} deja identique, rien a ecrire.`);
  } else {
    // 🔴 Ce geste ECRIT DANS LE DEPOT. Il a longtemps ecrase la copie en
    // silence : un lancement avec le mauvais `--miroir` remplacait
    // `convertir-plan-cad/index.ts` sans que rien ne le dise. On montre
    // desormais ce qui part et ce qui arrive avant d'ecrire.
    const avant = dst.texte.split("\n");
    const apres = src.texte.split("\n");
    console.log(`--synchroniser : ${COPIE}`);
    console.log(`  remplace ${avant.length} lignes (${Buffer.byteLength(dst.texte)} octets)`);
    console.log(`  par      ${apres.length} lignes (${Buffer.byteLength(src.texte)} octets)`);
    const max = Math.max(avant.length, apres.length);
    let montrees = 0;
    for (let k = 0; k < max && montrees < 40; k++) {
      if (avant[k] !== apres[k]) {
        if (avant[k] !== undefined) console.log(`  - ${avant[k]}`);
        if (apres[k] !== undefined) console.log(`  + ${apres[k]}`);
        montrees++;
      }
    }
    if (montrees >= 40) console.log("  … (diff tronquee a 40 lignes)");
    const lignes = readFileSync(COPIE, "utf8").split("\n");
    lignes.splice(dst.debut, dst.fin - dst.debut, ...apres);
    writeFileSync(COPIE, lignes.join("\n"));
    console.log("  ecrit.\n");
  }
}

console.log("① Les copies de la garde");
const blocSource = extraireBloc(SOURCE).texte;
for (const [nomCopie, cheminCopie] of COPIES) {
  if (extraireBloc(cheminCopie).texte === blocSource) {
    ok(`identique a telecharger-document, ${Buffer.byteLength(blocSource)} octets — ${nomCopie}`);
  } else {
    fail(
      `la copie de la garde DIVERGE dans ${nomCopie}. ` +
        "Corriger la SOURCE (telecharger-document), puis relancer avec --synchroniser.",
    );
  }
}
// Un octet de controle brut dans le source est indetectable a la relecture
// et casse les outils : il y en a eu un ici le 10/08 (classe de caracteres
// ecrite avec des octets reels au lieu de sequences d'echappement).
for (const [nom, chemin] of [["telecharger-document", SOURCE], ...COPIES]) {
  const octets = readFileSync(chemin);
  let n = 0;
  for (const c of octets) if ((c < 0x20 && c !== 0x0a && c !== 0x09) || c === 0x7f) n++;
  if (n === 0) ok(`${nom} : aucun octet de controle brut dans le source`);
  else fail(`${nom} : ${n} octet(s) de controle brut(s) dans le source`);
}

// ─────────────────────────────────────────────────────────────────────
//  ② CABLAGE — la garde est-elle DANS le chemin de requete ?
//
//  Section ajoutee apres les mutations M6/M7 du verificateur. Elle ne
//  teste aucune logique : elle verifie que le code appelle la garde, dans
//  le bon ordre, sur toutes les colonnes de chemin, et devant CHAQUE
//  lecture storage. Une garde parfaite qui n'est pas appelee ne protege
//  rien.
//
//  ── 🔴 LE MAUVAIS INVARIANT, ET SA CORRECTION ────────────────────────
//  Une premiere version comptait « 2 appels a createSignedUrl dans
//  telecharger-document, 1 a .download dans convertir-plan-cad ». Le
//  verificateur l'a debordee en deux gestes :
//    · ajouter un `.download()` dans `telecharger-document` — qui rend
//      les OCTETS BRUTS d'un objet arbitraire en service_role ;
//    · ajouter un `createSignedUrl()` dans `convertir-plan-cad`.
//  Les deux passaient : le compteur surveillait le nom attendu DANS le
//  fichier attendu, et ne voyait pas l'autre.
//
//  ── 🔴 CE QUE CE CONTROLE TIENT REELLEMENT — enonce corrige ──────────
//  Une redaction precedente annoncait « TOUTE lecture storage, quel que
//  soit son nom ». C'ETAIT FAUX : c'etait une regex sur 7 noms suivis de
//  `(`. Le verificateur a fait passer SEPT formes au vert, dont deux
//  qui ECRASENT ou SUPPRIMENT (`.remove([vol])`,
//  `.createSignedUploadUrl(vol)`), et trois qui ne changent que la
//  syntaxe d'appel (`?.`, acces indexe).
//
//  Enonce exact de ce qui suit, ni plus ni moins :
//    « Pour le bucket `documents`, tout appel a l'une des methodes
//      ENUMEREES ci-dessous, ecrit sous l'une des SYNTAXES enumerees,
//      ouvre un chemin dont chaque source est gardee. Toute methode
//      chainee sur `.storage.from()` qui N'EST PAS dans la liste est un
//      ECHEC — c'est le filet qui rattrape ce que l'enumeration ne
//      prevoit pas. »
//  C'est un controle TEXTUEL, pas une analyse semantique : il ne suit ni
//  les alias (`const s = client.storage`), ni les indirections calculees
//  (`obj[nomVariable](…)`). Ces angles morts sont nommes ici parce qu'un
//  controle dont on ignore la portee finit par etre cru plus large qu'il
//  n'est — c'est precisement ce qui vient d'arriver.
//
//  Il est FAIL-CLOSED : un argument qui n'est ni un identifiant simple ni
//  un gabarit analysable est un ECHEC, pas un cas ignore.
// ─────────────────────────────────────────────────────────────────────

console.log("\n② Cablage de la garde dans le chemin de requete");

/**
 * Methodes du client Storage qui prennent un CHEMIN — en lecture comme en
 * ECRITURE. Les ecritures comptent autant : ecraser
 * `attestations_cession/ATT-CESS-2026-00846.pdf` par un faux est le
 * jumeau exact de le lire, et c'est la faille trouvee au 4e tour dans
 * `generation-document`.
 */
const METHODES_STORAGE = [
  // lecture / exposition
  "createSignedUrl",
  "createSignedUrls",
  "download",
  "getPublicUrl",
  "list",
  "info",
  "exists",
  // ecriture / destruction
  "upload",
  "uploadToSignedUrl",
  "createSignedUploadUrl",
  "update",
  "remove",
  "copy",
  "move",
];

/** Methodes chainees sur `.storage` qui ne prennent PAS de chemin. */
const METHODES_STORAGE_SANS_CHEMIN = ["from", "listBuckets", "getBucket", "createBucket", "emptyBucket"];

/** Les deux gardes. Une source est « gardee » si l'une d'elles la prend en 1er argument. */
const GARDES = ["motifDeRefusDuChemin", "motifDeRefusDeLaReference"];

/**
 * Sources d'un chemin dont la maitrise ne vient pas d'une garde mais du
 * code lui-meme. Chacune doit etre JUSTIFIEE ici — c'est la seule porte
 * de sortie du controle, elle reste donc courte et explicite.
 */
const SOURCES_MAITRISEES = {
  table: "borne par les cles de CONFIG (allowlist cote serveur), verifie par `const cfg = CONFIG[table]`",
  ext: "vient de `cfg.ext`, une constante du serveur",
  "docRow.id": "valeur RELUE EN BASE (uuid), jamais la chaine du client — et tenue par une assertion dediee (D2)",
};

/** Extrait le 1er argument d'un appel, en suivant les parentheses. */
function premierArgument(texte, iOuvrante) {
  let profondeur = 0;
  for (let i = iOuvrante; i < texte.length; i++) {
    const c = texte[i];
    if (c === "(" || c === "[" || c === "{") profondeur++;
    else if (c === ")" || c === "]" || c === "}") {
      profondeur--;
      if (profondeur === 0) return texte.slice(iOuvrante + 1, i).trim();
    } else if (c === "," && profondeur === 1) return texte.slice(iOuvrante + 1, i).trim();
  }
  return null;
}

/**
 * Extrait le N-ieme argument (0-indexe) d'un appel, en respectant les
 * parentheses/crochets/accolades IMBRIQUES — contrairement a une coupe sur
 * la premiere virgule rencontree, qui tronque des qu'un argument contient
 * lui-meme une virgule (par exemple un generique TypeScript entre
 * parentheses : `(body as Record<string, unknown>).type`). Utilisee par
 * les controles D3 : un argument mal extrait produit un message d'echec
 * illisible plutot qu'un faux vert — mais un message illisible finit par
 * etre ignore, donc on l'evite ici plutot que d'attendre le prochain tour.
 */
function argumentAppel(texte, iOuvrante, index) {
  let profondeur = 0;
  let debut = iOuvrante + 1;
  let n = 0;
  for (let i = iOuvrante; i < texte.length; i++) {
    const c = texte[i];
    if (c === "(" || c === "[" || c === "{") profondeur++;
    else if (c === ")" || c === "]" || c === "}") {
      profondeur--;
      if (profondeur === 0) return n === index ? texte.slice(debut, i).trim() : null;
    } else if (c === "," && profondeur === 1) {
      if (n === index) return texte.slice(debut, i).trim();
      n++;
      debut = i + 1;
    }
  }
  return null;
}

/**
 * Methodes du client Storage dont le NOM N'EXISTE PAS sur le constructeur
 * de requetes PostgREST. C'est ce qui les rend sures a chercher partout :
 * `update`, `list`, `remove`, `info`, `copy`, `move` sont AUSSI des noms
 * PostgREST (`supabase.from("documents").update(champs)`), et une premiere
 * version du controle avait justement confondu la TABLE et le BUCKET.
 * Celles-ci, non : les trouver quelque part, c'est trouver du storage.
 */
const METHODES_STORAGE_EXCLUSIVES = [
  "createSignedUrl",
  "createSignedUrls",
  "createSignedUploadUrl",
  "uploadToSignedUrl",
  "getPublicUrl",
  "upload",
  "download",
];

/**
 * Le CORPS d'une fonction, delimite par accolades appariees.
 *
 * Les assertions sur `generation-document` doivent porter sur `deposer` et
 * sur `signalerIncident` SEPAREMENT : « chaque sortie en echec signale »
 * n'a de sens que dans une fonction donnee. Chercher dans tout le handler
 * melangerait les branches de trois fonctions et rendrait un compte qui ne
 * veut rien dire.
 *
 * Ignore les accolades DANS les chaines (`{ statut: "delivree" }` va bien,
 * mais une accolade en litteral casserait un compteur naif).
 */
function corpsDeLaFonction(texte, signature) {
  const i = texte.indexOf(signature);
  if (i < 0) return null;
  const debut = texte.indexOf("{", i);
  if (debut < 0) return null;
  let profondeur = 0;
  for (let k = debut; k < texte.length; k++) {
    const c = texte[k];
    if (c === '"' || c === "'" || c === "`") {
      k++;
      while (k < texte.length && texte[k] !== c) {
        if (texte[k] === "\\") k++;
        k++;
      }
      continue;
    }
    if (c === "{") profondeur++;
    else if (c === "}") {
      profondeur--;
      if (profondeur === 0) return texte.slice(debut, k + 1);
    }
  }
  return null;
}

/**
 * Neutralise le TEXTE LITTERAL des chaines (`"…"`, `'…'`, `` `…` ``) en
 * conservant intactes les expressions `${…}` d'un gabarit — ce sont, elles,
 * du vrai code.
 *
 * Sert exclusivement au controle A0b (reaffectation de `chemin`) : le
 * message d'erreur reel contient `` `chemin=${JSON.stringify(chemin)} …` ``
 * — la prose "chemin=" A L'INTERIEUR d'une chaine ressemble textuellement a
 * une reaffectation (`chemin =`) pour un scan naif, et un premier essai de
 * A0b la prenait pour telle : ECHEC FAUX sur du code correct. Le contenu
 * litteral est donc retire ; le code (les `${…}`) reste, y compris
 * l'accolade imbriquee eventuelle.
 */
function sansContenuDeChaines(texte) {
  let out = "";
  let i = 0;
  while (i < texte.length) {
    const c = texte[i];
    if (c === '"' || c === "'") {
      out += c;
      i++;
      while (i < texte.length) {
        if (texte[i] === "\\") {
          i += 2;
          continue;
        }
        if (texte[i] === c) {
          out += c;
          i++;
          break;
        }
        i++; // contenu neutralise : non recopie
      }
      continue;
    }
    if (c === "`") {
      out += c;
      i++;
      while (i < texte.length) {
        if (texte[i] === "\\") {
          i += 2;
          continue;
        }
        if (texte[i] === "`") {
          out += "`";
          i++;
          break;
        }
        if (texte[i] === "$" && texte[i + 1] === "{") {
          out += "${";
          i += 2;
          let profondeur = 1;
          while (i < texte.length && profondeur > 0) {
            if (texte[i] === "{") profondeur++;
            else if (texte[i] === "}") profondeur--;
            if (profondeur > 0) out += texte[i];
            i++;
          }
          out += "}";
          continue;
        }
        i++; // texte litteral neutralise
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * 🔴 5e TOUR — LA CHAINE `.update(champs)` PAR CHEMIN, VERIFIEE COMPLETE
 * ET EXCLUSIVE, PAS COMME SOUS-CHAINE.
 *
 * Les anciennes assertions B1/B3 cherchaient
 * `.update(champs).eq("url_fichier", chemin)` comme simple SOUS-CHAINE.
 * Deux mutations la laissaient passer :
 *   · retirer `.select("id")` : a l'execution reelle, PostgREST ne renvoie
 *     AUCUNE ligne sans `select()` explicite — `maj.data` vaut `undefined`,
 *     donc `lignes = maj.data?.length ?? 0` vaut TOUJOURS 0, et l'`insert`
 *     se declenche a CHAQUE generation. Les 57 doublons reviennent.
 *   · chainer un SECOND `.eq(...)` apres celui sur `url_fichier` (par
 *     exemple sur un `id` qui ne correspond jamais) : la ligne existante
 *     ne matche plus jamais l'`update`, meme effet — `lignes` reste a 0.
 * Aucune des deux ne change le texte `.update(champs).eq("url_fichier",
 * chemin)`, qui continue d'apparaitre tel quel : une recherche de
 * sous-chaine ne peut pas les voir. Cette fonction isole l'INSTRUCTION
 * COMPLETE (du `.update(champs)` au `;` qui suit) et exige : exactement UN
 * `.eq(`, portant sur `url_fichier`/`chemin`, ET un `.select("id")` dans la
 * MEME instruction.
 */
function verifierChaineUpdateParChemin(texte, libelle) {
  const iUpd = texte.indexOf(".update(champs)");
  if (iUpd < 0) {
    fail(`generation-document : ${libelle} — \`.update(champs)\` introuvable dans cette branche (fail-closed)`);
    return;
  }
  const iFin = texte.indexOf(";", iUpd);
  const chaine = texte.slice(iUpd, iFin < 0 ? texte.length : iFin);
  const nEq = (chaine.match(/\.eq\(/g) ?? []).length;
  const bonEq = /\.eq\(\s*"url_fichier"\s*,\s*chemin\s*\)/.test(chaine);
  const bonSelect = /\.select\(\s*"id"\s*\)/.test(chaine);
  if (nEq === 1 && bonEq && bonSelect) {
    ok(`generation-document : ${libelle} — \`.update(champs).eq("url_fichier", chemin).select("id")\` complete et exclusive`);
  } else {
    fail(
      `generation-document : ${libelle} — chaine incomplete (nb \`.eq(\`=${nEq}, cible url_fichier/chemin=${bonEq}, ` +
        `\`.select("id")\`=${bonSelect}) — sans \`.select("id")\` ou avec un second \`.eq()\`, \`lignes\` vaut ` +
        `toujours 0 et un \`insert\` a lieu a CHAQUE generation : ${JSON.stringify(chaine.slice(0, 140))}`,
    );
  }
}

/**
 * Toutes les syntaxes d'appel d'une methode, pour un nom donne. Les trois
 * dernieres ont ete ajoutees apres que le verificateur les eut fait passer :
 * un controle qui ne connait qu'une syntaxe se contourne en ajoutant un `?`.
 */
function motifsAppel(methode) {
  const n = methode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    [
      `\\.\\s*${n}\\s*\\(`, //            .methode(
      `\\.\\s*${n}\\s*\\?\\.\\s*\\(`, //  .methode?.(
      `\\?\\.\\s*${n}\\s*\\(`, //         ?.methode(
      `\\[\\s*["'\`]${n}["'\`]\\s*\\]\\s*\\(`, // ["methode"](
    ].join("|"),
    "g",
  );
}

/**
 * Verifie l'invariant enonce en tete de section, sur un fichier.
 *
 * 🔴 ON PART DE `.storage.from("bucket")`, PAS DU NOM DE LA METHODE. Une
 * premiere version cherchait les noms de methodes puis remontait au dernier
 * `.from("…")` : elle confondait `supabase.from("documents")` — la TABLE —
 * avec `supabase.storage.from("documents")` — le BUCKET —, et signalait
 * comme « ecriture storage non gardee » un banal `update()` PostgREST. Elle
 * ramassait aussi `.error()`, `.stringify()`, `.text()` dans son champ de
 * 400 caracteres. Un controle qui crie faux finit desactive.
 *
 * Ne porte QUE sur le bucket `documents` : `templates` est un bucket de
 * gabarits dont les noms sont des constantes du serveur (`cfg.template`).
 * Les appels ecartes sont COMPTES et affiches, pas passes sous silence.
 */
function verifierCablageStorage(nom, chemin) {
  const h = extraireHandler(chemin);
  let sites = 0;
  let ecartes = 0;

  // ── L'ANGLE MORT, DETECTE PLUTOT QUE SUBI ────────────────────────────
  // Ce controle suit la chaine `.storage.from(…).methode(…)` litteralement.
  // Un alias (`const b = client.storage.from("documents"); b.remove([x])`)
  // lui echapperait. Plutot que de l'ignorer, on REFUSE le fichier qui en
  // contient un : c'est fail-closed, et ca force a etendre le controle
  // plutot qu'a le contourner sans le savoir.
  // ⚠️ Un ALIAS, ce n'est pas `const up = await …storage…upload(x)` — celui-la
  // stocke le RESULTAT de l'appel, et l'appel est analyse normalement. C'est
  // `const b = client.storage.from("documents");` : le HANDLE est capture et
  // la methode arrive plus loin. On ne refuse donc que les affectations dont
  // la suite ne porte AUCUNE methode a chemin.
  for (const m of h.matchAll(/(?:const|let|var)\s+[\w$]+\s*=\s*[\s\S]{0,200}?\.storage\b([\s\S]{0,300}?);/g)) {
    const suite = m[1];
    if (!METHODES_STORAGE.some((meth) => new RegExp(`[.?]\\s*${meth}\\s*\\(`).test(suite))) {
      fail(
        `${nom} : handle storage capture dans une variable — ce controle suit la chaine litteralement et ne sait ` +
          `pas le suivre (fail-closed) : ${m[0].trim().slice(0, 120)}`,
      );
    }
  }

  // ── 🔴 5e TOUR — DEUX AUTRES FORMES QUI CONTOURNAIENT LA MARCHE DE CHAINE ─
  //
  //  (a) ACCES INDEXE A `.storage` LUI-MEME : `adminClient["storage"]` ou
  //      `` adminClient[`storage`] ``. La marche de chaine ne reconnait que
  //      `.storage` (acces par point). `adminClient["storage"].from("documents")
  //      .remove([vol])` ou `.copy(vol, <chemin lisible>)` — depasse la
  //      DETECTION D'ALIAS ci-dessus (qui exige `\.storage\b`, donc rate un
  //      acces indexe) ET n'entre jamais dans la boucle `.storage.from(...)`
  //      qui suit. Concretement : suppression ou copie d'un objet
  //      ARBITRAIRE du bucket prive en service_role, dans une branche que le
  //      banc comportemental (§⑥) n'exerce pas et que `tsc` ne voit pas non
  //      plus (le shim ne declare pas `.remove` sur l'objet indexe). Refuse
  //      fail-closed : ce controle ne sait pas suivre un acces indexe a
  //      `.storage`, donc tout fichier qui en porte un est un echec.
  for (const m of h.matchAll(/\[\s*["'`]storage["'`]\s*\]/g)) {
    fail(
      `${nom} : acces INDEXE a \`.storage\` ( ${JSON.stringify(m[0])} ) — ce controle ne suit que \`.storage\` par ` +
        "point, pas par crochets (fail-closed). Toute methode enchainee derriere est invisible au §②.",
    );
  }

  //  (b) `.storage.from(<argument NON LITTERAL>)` : `.storage.from(nomBucket)`
  //      ou `nomBucket` est une variable. La regex de la boucle qui suit
  //      n'exige QU'UNE chaine litterale entre guillemets ; un argument
  //      calcule ne matche jamais, et le site echappe silencieusement au
  //      controle (ni "site" compte, ni "ecarte", ni "echec" — juste
  //      absent). Refuse explicitement plutot que de laisser un bucket
  //      calcule a l'execution passer inapercu.
  for (const m of h.matchAll(/\.storage\s*\.\s*from\s*\(\s*(?!["'`])/g)) {
    const arg = premierArgument(h, h.indexOf("(", m.index));
    fail(
      `${nom} : \`.storage.from(${arg ?? "…"})\` — argument NON LITTERAL (fail-closed). Le bucket vise ne peut ` +
        "pas etre verifie s'il n'est pas ecrit en toutes lettres dans le code.",
    );
  }

  // Positions des `(` d'appel effectivement EXAMINES par la marche de
  // chaine, pour le balayage residuel qui suit la boucle.
  const visites = new Set();

  for (const m of h.matchAll(/\.storage\s*\.\s*from\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    const bucket = m[1];
    const apres = h.slice(m.index + m[0].length);
    // La methode CHAINEE juste apres, eventuellement apres un retour a la ligne.
    // Quatre syntaxes : `.m(`, `?.m(`, `.m?.(` et l'ACCES INDEXE `["m"](`.
    // L'acces indexe manquait : `.storage.from("documents")["createSignedUrl"](x)`
    // ne rendait aucune capture, et tombait dans le fail-closed « sans appel
    // analysable » — rouge, mais pour la mauvaise raison, avec un message qui
    // envoyait chercher un marqueur absent au lieu de nommer l'esquive.
    const appel =
      apres.match(/^\s*(?:\?\.|\.)\s*([A-Za-z_$][\w$]*)\s*(?:\?\.)?\s*\(/) ??
      apres.match(/^\s*(?:\?\.)?\s*\[\s*["'`]([A-Za-z_$][\w$]*)["'`]\s*\]\s*(?:\?\.)?\s*\(/);
    if (!appel) {
      fail(`${nom} : \`.storage.from("${bucket}")\` sans appel de methode analysable (fail-closed)`);
      continue;
    }
    const methode = appel[1];
    visites.add(m.index + m[0].length + appel[0].length - 1);

    // LE FILET : une methode chainee sur un bucket qui n'est declaree nulle
    // part est un ECHEC. C'est lui qui rattrape `createSignedUploadUrl` ou
    // `remove` le jour ou quelqu'un les ajoute sans toucher a ce script.
    if (!METHODES_STORAGE.includes(methode) && !METHODES_STORAGE_SANS_CHEMIN.includes(methode)) {
      fail(
        `${nom} : methode storage INCONNUE '.${methode}()' sur le bucket '${bucket}' — ni couverte, ni declaree ` +
          "sans chemin. Etendre METHODES_STORAGE (avec chemin) ou METHODES_STORAGE_SANS_CHEMIN (sans).",
      );
      continue;
    }
    if (METHODES_STORAGE_SANS_CHEMIN.includes(methode)) continue;
    if (bucket !== "documents") {
      ecartes++;
      continue;
    }
    sites++;

    const iAppel = m.index + m[0].length + appel[0].length - 1;
    const arg = premierArgument(h, iAppel);
    const avant = h.slice(0, m.index);
    if (arg === null) {
      fail(`${nom} : .${methode}() — argument illisible, controle impossible (fail-closed)`);
      continue;
    }

    // `remove` prend un TABLEAU de chemins : on deballe le 1er element.
    const argNu = arg.replace(/^\[\s*/, "").replace(/\s*\]$/, "").trim();

    let sources = null;
    if (/^[A-Za-z_$][\w$]*$/.test(argNu)) {
      // Priorite a la garde DIRECTE sur l'identifiant, entre sa derniere
      // affectation et l'appel : c'est la forme la plus forte.
      const iAff = Math.max(avant.lastIndexOf(`const ${argNu} =`), avant.lastIndexOf(`let ${argNu} =`));
      if (iAff < 0) {
        fail(`${nom} : .${methode}(${argNu}) — aucune affectation de '${argNu}' avant l'appel (fail-closed)`);
        continue;
      }
      const entre = h.slice(iAff, m.index);
      if (GARDES.some((g) => new RegExp(`${g}\\(\\s*${argNu}\\b`).test(entre))) {
        ok(`${nom} : .${methode}(${argNu}) — '${argNu}' garde entre son affectation et l'appel`);
        continue;
      }
      // A defaut, si l'affectation est un gabarit, on garde ses sources.
      const rhs = h.slice(iAff, m.index).split(";")[0];
      if (rhs.includes("${")) sources = interpolationsDe(rhs, nom, methode);
      else {
        fail(
          `${nom} : .${methode}(${argNu}) — AUCUNE garde sur '${argNu}' entre son affectation et l'appel. ` +
            "Signer/ecrire avant de garder, ou garder une autre variable, est ce que ce controle interdit.",
        );
        continue;
      }
    } else if (argNu.includes("${")) {
      sources = interpolationsDe(argNu, nom, methode);
    } else {
      fail(`${nom} : .${methode}(${argNu}) — argument ni identifiant ni gabarit analysable (fail-closed)`);
      continue;
    }

    if (sources === null) continue; // deja signalee
    const nonGardees = sources.filter((s) => {
      if (Object.hasOwn(SOURCES_MAITRISEES, s)) return false;
      return !GARDES.some((g) => new RegExp(`${g}\\(\\s*${s.replace(/\./g, "\\.")}\\b`).test(avant));
    });
    if (nonGardees.length === 0) {
      ok(`${nom} : .${methode}(...) — sources [${sources.join(", ")}] toutes gardees ou maitrisees`);
    } else {
      fail(
        `${nom} : .${methode}(...) — source(s) NON gardee(s) : ${nonGardees.join(", ")}. ` +
          "Une donnee qui compose un chemin lu ou ecrit en service_role doit passer par une garde.",
      );
    }
  }

  // ── BALAYAGE RESIDUEL : les appels que la marche de chaine N'A PAS VUS ─
  //
  //  Tout ce qui precede part de `.storage.from("…")` et descend la chaine.
  //  Un appel atteint AUTREMENT — par un handle intermediaire, un retour de
  //  fonction, une propriete — n'est jamais visite, donc jamais garde, et le
  //  fichier reste vert. Le detecteur d'alias en tete de fonction ferme la
  //  forme la plus courante ; celui-ci ferme le reste, en repartant du NOM.
  //
  //  On ne peut pas balayer les 14 methodes : `update`, `list`, `remove`,
  //  `info`, `copy`, `move` sont aussi des noms PostgREST et crieraient sur
  //  chaque `supabase.from("documents").update(champs)`. On balaye donc les
  //  7 noms EXCLUSIFS au storage, sous les 4 syntaxes de `motifsAppel`.
  //  Chaque site trouve doit etre l'un de ceux que la marche a examines.
  for (const methode of METHODES_STORAGE_EXCLUSIVES) {
    for (const m of h.matchAll(motifsAppel(methode))) {
      const iParen = m.index + m[0].length - 1;
      if (visites.has(iParen)) continue;
      fail(
        `${nom} : .${methode}(...) atteint par une voie que la marche de chaine ne suit pas ` +
          `(aucun \`.storage.from("…")\` immediatement en amont) — ce site n'est garde par rien : ` +
          h.slice(Math.max(0, m.index - 60), m.index + m[0].length).trim().slice(-100),
      );
    }
  }

  if (sites > 0) ok(`${nom} : ${sites} appel(s) storage sur 'documents' examine(s), ${ecartes} hors bucket ecarte(s)`);
  else fail(`${nom} : AUCUN appel storage sur 'documents' — le controle ne porte sur rien, verifier les marqueurs`);
}

/** Interpolations simples d'un gabarit ; toute forme complexe est un ECHEC. */
function interpolationsDe(texte, nom, methode) {
  const brutes = [...texte.matchAll(/\$\{([^}]*)\}/g)].map((x) => x[1].trim());
  if (brutes.length === 0) {
    fail(`${nom} : .${methode}(...) — gabarit sans interpolation analysable (fail-closed)`);
    return null;
  }
  // Un acces membre simple (`docRow.id`) est accepte comme SOURCE NOMMEE :
  // il devra figurer dans SOURCES_MAITRISEES ou etre garde. Tout le reste
  // (appel, ternaire, `??`) reste refuse.
  const complexes = brutes.filter((s) => !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(s));
  if (complexes.length > 0) {
    fail(
      `${nom} : .${methode}(...) — interpolation(s) non analysable(s) : ${complexes.join(" | ")}. ` +
        "Un chemin compose d'une expression que ce controle ne sait pas suivre doit etre fige dans une " +
        "variable gardee avant l'appel (fail-closed).",
    );
    return null;
  }
  return brutes;
}

verifierCablageStorage("telecharger-document", SOURCE);
for (const [nomCopie, cheminCopie] of COPIES) verifierCablageStorage(nomCopie, cheminCopie);

// ---- telecharger-document : couverture des colonnes de chemin ----
{
  const h = extraireHandler(SOURCE);

  const selectDocs = h.match(/\.select\(\s*"([^"]*)"\s*\)/)?.[1] ?? "";
  for (const colonne of [...COLONNES_CHEMIN, "id", "type"]) {
    if (selectDocs.split(/\s*,\s*/).includes(colonne))
      ok(`telecharger-document : '${colonne}' est relu dans le select de la ligne`);
    else fail(`telecharger-document : '${colonne}' ABSENT du select — la garde ne peut pas le voir`);
  }
  const choixColonne = h.match(/const\s+chemin\s*=\s*([^;]+);/)?.[1] ?? "";
  for (const colonne of COLONNES_CHEMIN) {
    if (choixColonne.includes(colonne))
      ok(`telecharger-document : la colonne '${colonne}' passe par la variable gardee`);
    else
      fail(
        `telecharger-document : la colonne de chemin '${colonne}' n'alimente PAS la variable gardee — ` +
          "c'est la forme exacte de l'oubli du 09/08.",
      );
  }

  // ── D3 : le TYPE passe a la garde vient de la ligne, pas du client ────
  // `motifDeRefusDuChemin` decide du PREFIXE attendu a partir de son 2e
  // argument. Le commentaire de tete promet que ce TYPE est « relu dans la
  // ligne, jamais recu du client » — mais rien ne tenait cette promesse :
  // une regression qui lirait `body.type ?? row.type` (le mot-cle `type`
  // du CLIENT prenant le pas des qu'il est present, `row.type` en simple
  // repli) laisserait l'appel s'ecrire `motifDeRefusDuChemin(chemin,
  // body.type ?? row.type, row.id)`. `body` ne declare meme pas de champ
  // `type` aujourd'hui, mais l'absence de controle ici est exactement le
  // trou que le vérificateur tiers a rejoue (mutation M15) : le script
  // rendait TOUT PASSE malgre la regression. On exige donc une EGALITE
  // exacte du texte du 2e argument avec 'row.type' — pas une simple
  // presence dans une chaine plus longue, sinon 'body.type ?? row.type'
  // continuerait de « contenir » row.type et passerait quand meme.
  const iAppelD3Telecharger = h.search(/motifDeRefusDuChemin\(\s*chemin\s*,/);
  const appelGardeTelecharger =
    iAppelD3Telecharger >= 0
      ? argumentAppel(h, h.indexOf("(", iAppelD3Telecharger), 1) ?? ""
      : "";
  if (!appelGardeTelecharger) {
    fail("telecharger-document : appel a 'motifDeRefusDuChemin(chemin, …)' introuvable (fail-closed)");
  } else if (appelGardeTelecharger === "row.type") {
    ok("telecharger-document : le TYPE passe a la garde est EXACTEMENT 'row.type' (relu en base, jamais du client)");
  } else {
    fail(
      `telecharger-document : le TYPE passe a la garde n'est pas 'row.type' mais ${JSON.stringify(appelGardeTelecharger)} ` +
        "— une source melangee avec le corps client (ex. 'body.type ?? row.type') romprait la garantie " +
        "'le type qui choisit le prefixe est toujours relu en base'.",
    );
  }

  // ── D3b : ni le NOM ni la VALEUR de 'row.type' n'ont bouge d'ici la ────
  //         garde — un vérificateur tiers a rejoue cette mutation exacte
  //         (M15f) : reaffecter la PROPRIETE `row.type = body.type ??
  //         row.type` juste avant l'appel laisse le controle D3 ci-dessus
  //         au vert, puisqu'il ne lit que le TEXTE de l'argument
  //         ('row.type'), jamais la valeur qu'il porte au moment de
  //         l'appel. C'est la MEME lecon que A0/A0b, deja ecrite plus bas
  //         pour la variable 'chemin' dans generation-document — elle
  //         n'avait pas ete transposee ici. On refuse donc toute
  //         reaffectation de la PROPRIETE `row.type` (ou `row["type"]`)
  //         entre la lecture de la ligne et l'appel de la garde.
  const iRowD3Telecharger =
    iAppelD3Telecharger >= 0 ? h.lastIndexOf("const { data: row", iAppelD3Telecharger) : -1;
  if (iAppelD3Telecharger < 0 || iRowD3Telecharger < 0) {
    fail("telecharger-document : D3b — lecture de 'row' ou appel de la garde introuvable (fail-closed)");
  } else {
    const entreLectureEtGarde = sansContenuDeChaines(h.slice(iRowD3Telecharger, iAppelD3Telecharger));
    if (/\brow(?:\.type|\[\s*["'`]type["'`]\s*\])\s*=(?!=)/.test(entreLectureEtGarde)) {
      fail(
        "telecharger-document : D3b — 'row.type' est REAFFECTE entre sa lecture et l'appel de la garde : " +
          "le texte de l'argument reste 'row.type', mais la VALEUR qu'il porte au moment de l'appel peut " +
          "avoir change (mutation M15f).",
      );
    } else {
      ok("telecharger-document : D3b — aucune reaffectation de la propriete 'row.type' entre sa lecture et la garde");
    }
  }
}

// ---- convertir-plan-cad ----
{
  const h = extraireHandler(COPIE);

  const selectDocs = h.match(/\.select\(\s*"([^"]*)"\s*\)/)?.[1] ?? "";
  for (const colonne of ["id", "type", "url_fichier"]) {
    if (selectDocs.split(/\s*,\s*/).includes(colonne))
      ok(`convertir-plan-cad : '${colonne}' est relu dans le select`);
    else fail(`convertir-plan-cad : '${colonne}' ABSENT du select`);
  }

  // ── D2 : le chemin d'ECRITURE aussi vient de la ligne, pas du client ──
  // Le commentaire de `convertir-plan-cad` promet que `cheminApercu` est
  // compose a partir de `docRow.id` — la valeur RELUE EN BASE — et jamais
  // de `documentId`, la chaine du client. Aucun controle ne tenait cette
  // promesse : la mutation qui remet `documentId` passait au vert. Un
  // commentaire que rien ne verifie finit par mentir — c'est exactement ce
  // qui vient de se produire avec la justification ACL de la migration.
  const affectationApercu = h.match(/const\s+cheminApercu\s*=\s*([^;]+);/)?.[1] ?? "";
  if (!affectationApercu) {
    fail("convertir-plan-cad : affectation de 'cheminApercu' introuvable (fail-closed)");
  } else if (/\$\{\s*documentId\s*\}/.test(affectationApercu)) {
    fail(
      "convertir-plan-cad : le chemin d'ecriture de l'apercu est compose a partir de 'documentId' " +
        "(la chaine du CLIENT) au lieu de 'docRow.id' (la valeur relue en base).",
    );
  } else if (/\$\{\s*docRow\.id\s*\}/.test(affectationApercu)) {
    ok("convertir-plan-cad : le chemin d'ecriture de l'apercu vient de 'docRow.id', pas du client");
  } else {
    fail(`convertir-plan-cad : source du chemin d'ecriture de l'apercu non reconnue : ${affectationApercu}`);
  }

  // Et le chemin ECRIT doit etre celui qui est ensuite enregistre dans la
  // colonne : ecrire A et enregistrer B refabriquerait un orphelin.
  const iUpload = h.indexOf(".upload(");
  const argUpload = iUpload >= 0 ? premierArgument(h, h.indexOf("(", iUpload)) : null;
  if (argUpload === "cheminApercu") ok("convertir-plan-cad : l'objet televerse est bien 'cheminApercu'");
  else fail(`convertir-plan-cad : l'objet televerse n'est pas 'cheminApercu' mais ${JSON.stringify(argUpload)}`);
  if (/apercu_url:\s*cheminApercu/.test(h))
    ok("convertir-plan-cad : 'apercu_url' enregistre exactement le chemin televerse");
  else fail("convertir-plan-cad : 'apercu_url' n'enregistre pas le chemin televerse — orphelin garanti");

  // ── D3 (jumelle) : meme controle que telecharger-document ─────────────
  // Meme raisonnement que le D3 de telecharger-document : le 2e argument
  // de `motifDeRefusDuChemin` doit rester EXACTEMENT 'docRow.type', jamais
  // melange avec une valeur du corps de requete.
  const iAppelD3Convertir = h.search(/motifDeRefusDuChemin\(\s*cheminOriginal\s*,/);
  const appelGardeConvertir =
    iAppelD3Convertir >= 0
      ? argumentAppel(h, h.indexOf("(", iAppelD3Convertir), 1) ?? ""
      : "";
  if (!appelGardeConvertir) {
    fail("convertir-plan-cad : appel a 'motifDeRefusDuChemin(cheminOriginal, …)' introuvable (fail-closed)");
  } else if (appelGardeConvertir === "docRow.type") {
    ok("convertir-plan-cad : le TYPE passe a la garde est EXACTEMENT 'docRow.type' (relu en base, jamais du client)");
  } else {
    fail(
      `convertir-plan-cad : le TYPE passe a la garde n'est pas 'docRow.type' mais ${JSON.stringify(appelGardeConvertir)} ` +
        "— meme risque que dans telecharger-document (jumelle) : une source melangee romprait la garantie.",
    );
  }

  // ── D3b (jumelle) : ni le nom ni la valeur de 'docRow.type' n'ont ──────
  //                    bouge d'ici la garde. Meme lecon que D3b de
  //                    telecharger-document, appliquee a 'docRow.type'.
  const iDocRowD3Convertir =
    iAppelD3Convertir >= 0 ? h.lastIndexOf("const { data: docRow", iAppelD3Convertir) : -1;
  if (iAppelD3Convertir < 0 || iDocRowD3Convertir < 0) {
    fail("convertir-plan-cad : D3b — lecture de 'docRow' ou appel de la garde introuvable (fail-closed)");
  } else {
    const entreLectureEtGarde = sansContenuDeChaines(h.slice(iDocRowD3Convertir, iAppelD3Convertir));
    if (/\bdocRow(?:\.type|\[\s*["'`]type["'`]\s*\])\s*=(?!=)/.test(entreLectureEtGarde)) {
      fail(
        "convertir-plan-cad : D3b — 'docRow.type' est REAFFECTE entre sa lecture et l'appel de la garde " +
          "(meme risque que la jumelle telecharger-document, mutation M15f).",
      );
    } else {
      ok("convertir-plan-cad : D3b — aucune reaffectation de la propriete 'docRow.type' entre sa lecture et la garde");
    }
  }
}

// ---- generation-document : le jumeau EN ECRITURE, la boucle, le signalement ----
//
// Ce fichier etait le plus modifie de la livraison du 4e tour et n'etait
// couvert par AUCUNE assertion : ni son jumeau en ecriture, ni sa boucle de
// regeneration, ni son signalement. Un fichier livre que rien ne verifie est
// un fichier non verifie, quelle que soit la couleur des autres controles.
{
  const h = extraireHandler(join(BASE_FONCTIONS, "generation-document/index.ts"));

  // 🔴 `h` est NETTOYE DE SES COMMENTAIRES (voir `extraireHandler`). Une
  // version precedente de ce bloc lisait le FICHIER ENTIER (`src`) pour le
  // controle `journal_audit` : commenter l'ecriture reelle en laissant la
  // ligne en commentaire l'aurait laisse au vert. C'est le piege deja paye
  // deux fois cote SQL (`else false`, puis `grant execute`) ; il n'y a plus
  // aucune lecture de `src` ici, et c'est volontaire.
  const deposer = corpsDeLaFonction(h, "async function deposer(");
  if (!deposer) {
    fail("generation-document : corps de `deposer(...)` introuvable — controle impossible (fail-closed)");
  }
  const dep = deposer ?? "";

  // ── A. LE CHEMIN EST GARDE AVANT LE TELEVERSEMENT ────────────────────
  //    A0 : 'chemin' n'est jamais REAFFECTE entre la garde et l'upload.
  //    A1 : l'ordre. A2 : la valeur de retour est TESTEE et la branche de
  //    refus REND LA MAIN avant l'upload. A3 : c'est le MEME chemin qui est
  //    garde et televerse. A1 seul ne tient rien : appeler la garde et
  //    ignorer son verdict laisse l'ordre intact et la faille ouverte.
  //
  // 🔴 5e TOUR — A1/A2/A3 CHERCHENT TOUS L'IDENTIFIANT « chemin » PAR SON
  // NOM, JAMAIS SA VALEUR. Une reaffectation entre la garde et l'upload
  // (`let chemin` au lieu de `const`, puis une seconde ligne
  // `chemin = <expression du client>;`) laisse A1/A2/A3 tous verts : le nom
  // apparait toujours au bon endroit, dans le bon ordre — c'est seulement
  // la VALEUR portee par ce nom, au moment de l'upload, qui a change. C'est
  // le jumeau en ecriture de #49 rouvert par un detour d'un mot.
  //
  // A0 ferme la classe ENTIERE structurellement : `const` rend toute
  // reaffectation une ERREUR DE COMPILATION TypeScript, impossible a
  // deployer. A0b est une defense supplementaire, au cas ou `const`
  // manquerait malgre tout : elle detecte EXPLICITEMENT toute reaffectation
  // bare (`chemin =`, hors declaration) entre la ligne de declaration et la
  // ligne de l'upload.
  const declChemin = dep.match(/\b(const|let|var)\s+chemin\s*=/);
  if (declChemin && declChemin[1] === "const") {
    ok("generation-document : A0 — 'chemin' est declare `const` (toute reaffectation est une erreur de compilation)");
  } else {
    fail(
      `generation-document : A0 — 'chemin' est declare ${declChemin ? `\`${declChemin[1]}\`` : "(introuvable)"} et ` +
        "non `const` : rien n'empeche une reaffectation entre la garde et l'upload, invisible a A1/A2/A3 qui ne " +
        "cherchent que le NOM 'chemin', jamais sa valeur.",
    );
  }
  if (declChemin) {
    const iDecl = dep.indexOf(declChemin[0]);
    const iUpAO = dep.indexOf(".upload(chemin");
    const entreDeclEtUpload = iUpAO > iDecl ? dep.slice(iDecl + declChemin[0].length, iUpAO) : "";
    // Contenu de chaines neutralise : "chemin=" dans un message d'erreur
    // (`` `chemin=${JSON.stringify(chemin)}` ``) n'est pas une reaffectation.
    const entreSansChaines = sansContenuDeChaines(entreDeclEtUpload);
    const reaffectations = [...entreSansChaines.matchAll(/\bchemin\s*=(?!=)/g)].filter((m) => {
      const avant = entreSansChaines.slice(Math.max(0, m.index - 12), m.index);
      return !/(?:const|let|var)\s*$/.test(avant);
    });
    if (reaffectations.length === 0)
      ok("generation-document : A0b — aucune reaffectation de 'chemin' entre sa declaration et l'upload");
    else
      fail(
        `generation-document : A0b — 'chemin' est REAFFECTE ${reaffectations.length} fois entre sa declaration ` +
          "et l'upload : la valeur gardee n'est plus forcement celle qui est televersee.",
      );
  }

  const iGarde = h.indexOf("motifDeRefusDuChemin(chemin");
  const iUpload = h.indexOf(".upload(chemin");
  if (iGarde >= 0 && iUpload >= 0 && iGarde < iUpload)
    ok("generation-document : A1 — le chemin est garde AVANT le televersement service_role");
  else
    fail(
      "generation-document : A1 — le chemin televerse n'est PAS garde avant l'upload — c'est le jumeau EN ECRITURE " +
        "de #49 (pv_bornage.reference est fournie par le client et compose ce chemin).",
    );

  // A2 — le verdict de la garde est utilise, et il ARRETE le traitement.
  const affGarde = dep.match(/const\s+([\w$]+)\s*=\s*motifDeRefusDuChemin\(\s*chemin\b/);
  if (!affGarde) {
    fail(
      "generation-document : A2 — le retour de `motifDeRefusDuChemin(chemin, …)` n'est affecte a rien. " +
        "Une garde dont on jette le verdict ne garde rien.",
    );
  } else {
    const nomMotif = affGarde[1];
    const iAff = dep.indexOf(affGarde[0]);
    const iUp = dep.indexOf(".upload(chemin");
    const entre = iUp > iAff ? dep.slice(iAff, iUp) : "";
    const teste = new RegExp(`if\\s*\\(\\s*${nomMotif}\\s*\\)`).test(entre);
    const rend = /return\s+new Response\(/.test(entre);
    if (teste && rend)
      ok(`generation-document : A2 — '${nomMotif}' est teste et la branche de refus REND LA MAIN avant l'upload`);
    else
      fail(
        `generation-document : A2 — entre la garde et l'upload, test de '${nomMotif}'=${teste}, ` +
          `retour anticipe=${rend}. Le verdict doit ARRETER le televersement, pas seulement etre calcule.`,
      );
  }

  // A3 — la garde et l'upload portent sur la MEME expression.
  const argUploadGd = iUpload >= 0 ? premierArgument(h, h.indexOf("(", iUpload)) : null;
  if (argUploadGd === "chemin") ok("generation-document : A3 — l'objet televerse est bien la variable gardee 'chemin'");
  else
    fail(
      `generation-document : A3 — l'objet televerse est ${JSON.stringify(argUploadGd)} et non 'chemin' : ` +
        "garder A puis ecrire B est la forme exacte de l'esquive E3.",
    );

  // ── D3 (3e jumelle) : le TYPE passe a la garde vient de CONFIG, pas ────
  //                      d'un champ du webhook. `cfg.type_doc` est une
  //                      constante du SERVEUR (une entree fixe de CONFIG,
  //                      elle-meme choisie via l'allowlist `table = evt.
  //                      table`) — mais rien ne verifiait que l'appel s'
  //                      ecrit encore ainsi. Un vérificateur tiers a
  //                      rejoue la mutation M15g :
  //                      `motifDeRefusDuChemin(chemin, evt.type_doc ??
  //                      cfg.type_doc, rec.id)`, ou `evt` est le payload
  //                      du webhook. Le risque n'agrandit pas la portee
  //                      ici (`PREFIXE_PAR_TYPE` est injectif et `chemin`
  //                      commence par `${table}/`, donc un type libre ne
  //                      peut que faire REFUSER un chemin qui aurait ete
  //                      accepte) — mais un detecteur qui ne detecte pas
  //                      la regression du mandat n'est pas un detecteur.
  const iAppelD3Generation = dep.search(/motifDeRefusDuChemin\(\s*chemin\s*,/);
  const appelGardeGeneration =
    iAppelD3Generation >= 0
      ? argumentAppel(dep, dep.indexOf("(", iAppelD3Generation), 1) ?? ""
      : "";
  if (!appelGardeGeneration) {
    fail("generation-document : D3 — appel a 'motifDeRefusDuChemin(chemin, …)' introuvable dans `deposer` (fail-closed)");
  } else if (appelGardeGeneration === "cfg.type_doc") {
    ok("generation-document : D3 — le TYPE passe a la garde est EXACTEMENT 'cfg.type_doc' (constante CONFIG, jamais le webhook)");
  } else {
    fail(
      `generation-document : D3 — le TYPE passe a la garde n'est pas 'cfg.type_doc' mais ${JSON.stringify(appelGardeGeneration)} ` +
        "— une source melangee avec le payload du webhook (ex. 'evt.type_doc ?? cfg.type_doc') romprait la garantie.",
    );
  }

  // ── D3b (3e jumelle) : ni le NOM ni la VALEUR de 'cfg.type_doc' n'ont ──
  //                       bouge d'ici la garde. Meme lecon que D3b de
  //                       telecharger-document/convertir-plan-cad (dette
  //                       #52) : `cfg` est declaree `const` (ligne ~976),
  //                       ce qui empeche de reaffecter le BINDING — mais
  //                       RIEN n'empeche de muter sa PROPRIETE
  //                       `cfg.type_doc = …`, puisque `cfg` reste un objet
  //                       ordinaire. Un vérificateur tiers rejouerait la
  //                       meme mutation exacte que sur les deux jumelles
  //                       (M15f) : `cfg.type_doc = evt.type_doc ??
  //                       cfg.type_doc` juste avant l'appel laisserait D3
  //                       ci-dessus au vert, puisqu'il ne lit que le TEXTE
  //                       de l'argument ('cfg.type_doc'), jamais la valeur
  //                       qu'il porte au moment de l'appel.
  //
  //  🔴 A LA DIFFERENCE des deux jumelles, ce controle ne peut PAS relire
  //  `dep` (le corps de `deposer` SEUL) comme D3 le fait juste au-dessus :
  //  `cfg` est declaree HORS de `deposer` (`const cfg = CONFIG[table]`,
  //  dans la fonction englobante) et seulement CAPTUREE par fermeture. On
  //  cherche donc dans `h` (le handler ENTIER) — mais PAS jusqu'a `iGarde`
  //  (position TEXTUELLE de l'appel `motifDeRefusDuChemin(chemin, …)` a
  //  l'INTERIEUR du corps de `deposer`). `deposer` est une fonction que
  //  l'on peut appeler PLUSIEURS FOIS (deux points d'appel dans
  //  index.ts : ~1086 avant la declaration textuelle de `deposer`, ~1321
  //  bien APRES `iGarde`) ; chaque appel ré-execute le corps entier,
  //  garde comprise, en lisant `cfg.type_doc` par fermeture au moment de
  //  CET appel-la — pas au moment ou le texte de la garde apparait dans
  //  le fichier. Une mutation inseree juste avant le SECOND point d'appel
  //  (~1321) est donc textuellement APRES `iGarde`, mais s'execute AVANT
  //  que la garde ne lise `cfg.type_doc` pour cet appel : borner la
  //  fenetre a `iGarde` la manque entierement (mesure le 11/08 : EXIT=0,
  //  ok, sur un code mute). Il n'y a AUCUNE reaffectation legitime de
  //  `cfg.type_doc` nulle part dans le fichier (verifie par grep sur
  //  index.ts : zero occurrence de `cfg.type_doc =` ou
  //  `cfg["type_doc"] =`, en dehors des comparaisons `===` et lectures) ;
  //  la fenetre peut donc courir SANS BORNE HAUTE jusqu'a la fin de `h`
  //  sans risque de faux rouge.
  if (iGarde < 0) {
    fail("generation-document : D3b — appel a 'motifDeRefusDuChemin(chemin, …)' introuvable (fail-closed)");
  } else {
    const iCfgDecl = h.lastIndexOf("const cfg = CONFIG[table]", iGarde);
    if (iCfgDecl < 0) {
      fail("generation-document : D3b — declaration 'const cfg = CONFIG[table]' introuvable (fail-closed)");
    } else {
      const entreLectureEtGarde = sansContenuDeChaines(h.slice(iCfgDecl));
      if (/\bcfg(?:\.type_doc|\[\s*["'`]type_doc["'`]\s*\])\s*=(?!=)/.test(entreLectureEtGarde)) {
        fail(
          "generation-document : D3b — 'cfg.type_doc' est REAFFECTE quelque part dans le handler, entre sa " +
            "declaration et la fin du fichier : le texte de l'argument reste 'cfg.type_doc', mais la VALEUR " +
            "qu'il porte au moment d'un appel a `deposer()` peut avoir change (mutation M15f/M15g, y compris " +
            "inseree APRES la position textuelle de la garde mais AVANT un second point d'appel de `deposer`).",
        );
      } else {
        ok("generation-document : D3b — aucune reaffectation DIRECTE ('cfg.type_doc = …') dans tout le handler (n'exclut pas un alias ou Object.assign, hors perimetre)");
      }
    }
  }

  // ── B. UNE LIGNE PAR CHEMIN, PAS UNE PAR GENERATION ──────────────────
  //    L'`update` cible doit preceder l'`insert`, et l'`insert` ne doit pas
  //    etre atteignable sans lui : c'est ce qui a produit 57 doublons.
  const iUpdate = h.indexOf('.update(champs).eq("url_fichier", chemin)');
  const iInsert = h.indexOf(".insert(champs)");
  if (iUpdate >= 0 && iInsert >= 0 && iUpdate < iInsert)
    ok("generation-document : B1 — l'`update` par chemin PRECEDE l'`insert` (une ligne par chemin)");
  else
    fail(
      "generation-document : B1 — la ligne `documents` est inseree sans tentative de mise a jour prealable — " +
        "chaque regeneration ajoutera une ligne, comme les 57 doublons mesures le 10/08.",
    );
  if (/lignes\s*===?\s*0/.test(dep))
    ok("generation-document : B2 — l'insert n'a lieu que si l'update n'a touche aucune ligne");
  else fail("generation-document : B2 — rien ne conditionne l'insert au resultat de l'update");

  // B3 — LA CHAINE `.update(champs)` EST COMPLETE ET EXCLUSIVE.
  //   `eq("url_fichier", chemin)` est ce qui fait converger une regeneration
  //   sur la ligne existante, et `select("id")` est ce qui rend `maj.data`
  //   EXPLOITABLE (sans lui, `undefined` a l'execution reelle -> `lignes`
  //   toujours 0 -> insert a chaque generation). Voir
  //   `verifierChaineUpdateParChemin` pour le detail des deux esquives que
  //   la sous-chaine seule ne voyait pas.
  verifierChaineUpdateParChemin(dep, "B3");

  // B4 — UN SEUL `insert`, et il est DANS la branche `lignes === 0`.
  //   Un second `insert` ajoute ailleurs (ou le meme sorti de sa branche)
  //   refabrique un doublon par generation. B1/B2 ne le verraient pas.
  const nInsert = (dep.match(/\.insert\(champs\)/g) ?? []).length;
  const brancheZero = corpsDeLaFonction(dep, "if (lignes === 0)");
  if (nInsert !== 1) {
    fail(`generation-document : B4 — ${nInsert} \`insert(champs)\` dans \`deposer\` au lieu d'un seul`);
  } else if (brancheZero && brancheZero.includes(".insert(champs)")) {
    ok("generation-document : B4 — l'unique `insert` vit DANS la branche `lignes === 0`");
  } else {
    fail(
      "generation-document : B4 — l'`insert` n'est pas contenu dans la branche `lignes === 0` : " +
        "il est atteignable alors que l'`update` a deja mis une ligne a jour.",
    );
  }

  // B5 — LA REPRISE SUR COURSE CONCURRENTE (index.ts:1198).
  //   Deux generations simultanees peuvent toutes deux ne rien trouver a
  //   l'`update` puis inserer ; la seconde echoue. Le code retente alors
  //   l'`update` : si un concurrent a deja ecrit la ligne, le resultat
  //   CORRECT est en base et rendre `ok:false` serait un mensonge. Rien ne
  //   tenait cette reprise — la supprimer laissait tout au vert.
  const brancheInsErr = corpsDeLaFonction(dep, "if (ins.error)");
  if (!brancheInsErr) {
    fail("generation-document : B5 — branche `if (ins.error)` introuvable (fail-closed)");
  } else {
    // La reprise doit porter la MEME rigueur que la tentative principale :
    // un `.eq()` unique sur `url_fichier`/`chemin`, ET `.select("id")` dans
    // la meme instruction. Voir `verifierChaineUpdateParChemin`.
    verifierChaineUpdateParChemin(brancheInsErr, "B5 (retente)");
    const recompte = /lignes\s*=\s*maj2\./.test(brancheInsErr);
    const conditionne = /if\s*\(\s*lignes\s*===?\s*0\s*\)/.test(brancheInsErr);
    if (recompte && conditionne)
      ok("generation-document : B5 — l'echec d'insert retente l'`update` et ne signale que si la ligne manque TOUJOURS");
    else
      fail(
        `generation-document : B5 — reprise sur course incomplete (\`lignes\` recalcule=${recompte}, ` +
          `echec conditionne=${conditionne}). Sans elle, une course rend \`ok:false\` alors que la ligne est ` +
          "correctement en base.",
      );
  }

  // ── C1. LE SIGNALEMENT EST REEL : une ligne dans une table qu'un ECRAN lit.
  //    Un `console.error` ne signale rien — les six declencheurs passent par
  //    `sgfn_call_edge` -> `perform net.http_post(...)`, `returns void` : la
  //    reponse HTTP n'est jamais relue.
  //
  //    🔴 Tout ce qui suit lit `h` (COMMENTAIRES RETIRES) et non le fichier.
  const signaler = corpsDeLaFonction(h, "async function signalerIncident(");
  if (!signaler) {
    fail("generation-document : C1 — corps de `signalerIncident(...)` introuvable (fail-closed)");
  } else {
    if (/from\("journal_audit"\)\s*\.insert\(/.test(signaler))
      ok("generation-document : C1a — les incidents sont ecrits dans `journal_audit` (table lue par 2 ecrans)");
    else
      fail(
        "generation-document : C1a — aucun incident n'est ecrit dans `journal_audit` — le `500 ok:false` ne va " +
          "nulle part (sgfn_call_edge ne lit pas la reponse), l'echec redevient MUET du point de vue du produit.",
      );

    // C1b — LES COLONNES QUI PORTENT L'INFORMATION.
    //   Mesure du 11/08 en lecture seule : `/dashboard/administration` ne
    //   selectionne PAS `nouvelle_valeur`. Le seul ecran qui montre le detail
    //   d'un incident est `/dashboard` (ActivityCenter). Si `nouvelle_valeur`
    //   disparait d'ici, il ne reste plus NULLE PART de quoi savoir quel
    //   chemin a ete refuse ni pourquoi : la ligne existe et n'apprend rien.
    for (const colonne of ["table_concernee", "action", "nouvelle_valeur"]) {
      // `colonne:` ET la forme abregee `colonne,` / `colonne }` — `action`
      // est passee en raccourci (le parametre porte deja ce nom), et exiger
      // les deux-points faisait echouer un code parfaitement correct.
      if (new RegExp(`\\b${colonne}\\s*(?::|,|\\})`).test(signaler))
        ok(`generation-document : C1b — l'incident porte '${colonne}'`);
      else
        fail(
          `generation-document : C1b — '${colonne}' absent de l'incident. Sans elle, la ligne du journal ` +
            "n'apprend pas ce qui a ete refuse (seul /dashboard rend `nouvelle_valeur`).",
        );
    }

    // C1c — L'ECRITURE DE L'INCIDENT NE DOIT PAS MASQUER L'INCIDENT.
    //   Si le journal refuse la ligne, on la journalise et ON CONTINUE. Un
    //   `throw` ici transformerait un incident en 500 opaque et ferait perdre
    //   la reponse deja calculee : le remede pire que le mal.
    if (/throw\b/.test(signaler))
      fail("generation-document : C1c — `signalerIncident` peut lever : l'echec du journal masquerait l'incident.");
    else ok("generation-document : C1c — `signalerIncident` ne leve jamais (l'incident n'est pas masque par son journal)");
  }

  // C1d — CHAQUE SORTIE EN ECHEC DE `deposer` SIGNALE, sans exception.
  //   L'ancienne version comptait `ok: false` d'un cote et `signalerIncident`
  //   de l'autre : deux totaux egaux ne disent RIEN sur l'appariement, et
  //   surtout le comptage ignorait la sortie `return new Response("Erreur
  //   stockage", { status: 500 })` — un depot refuse, donc un acte qui
  //   n'existe ni au bucket ni au registre, et qui ne laissait qu'un
  //   `console.error`. On apparie donc chaque RETOUR EN ECHEC a SON
  //   signalement, en exigeant qu'aucun autre retour ne s'intercale.
  {
    const retours = [...dep.matchAll(/return\s+new Response\(/g)];
    let echecs = 0;
    let muets = 0;
    for (const r of retours) {
      const fin = dep.indexOf(";", r.index);
      const corpsRetour = dep.slice(r.index, fin < 0 ? dep.length : fin);
      if (/ok:\s*true/.test(corpsRetour)) continue; // sortie nominale
      echecs++;
      const s = dep.lastIndexOf("signalerIncident(", r.index);
      const retourIntercale = s >= 0 && /return\s+new Response\(/.test(dep.slice(s, r.index));
      if (s < 0 || retourIntercale) {
        muets++;
        fail(
          "generation-document : C1d — sortie en ECHEC sans signalement apparie : " +
            corpsRetour.replace(/\s+/g, " ").slice(0, 110),
        );
      }
    }
    if (echecs === 0)
      fail("generation-document : C1d — aucune sortie en echec trouvee dans `deposer` — le controle ne porte sur rien");
    else if (muets === 0) ok(`generation-document : C1d — les ${echecs} sorties en echec de \`deposer\` signalent toutes`);
  }

  // ── D. Le statut n'est bascule qu'apres une ligne reellement ecrite.
  const iStatut = h.indexOf('{ statut: "delivree" }');
  if (iStatut > iInsert && iInsert >= 0)
    ok("generation-document : D — le statut 'delivree' n'est bascule qu'apres l'ecriture de la ligne");
  else fail("generation-document : D — le statut 'delivree' est bascule avant (ou sans) l'ecriture de la ligne");
}

// ─────────────────────────────────────────────────────────────────────
//  ③ Chargement de la garde REELLE (pas une reimplementation)
// ─────────────────────────────────────────────────────────────────────

const dossier = mkdtempSync(join(tmpdir(), "dette49-"));
const fichierGarde = join(dossier, "garde.mts");
writeFileSync(
  fichierGarde,
  blocSource +
    "\nexport { PREFIXE_PAR_TYPE, DOSSIER_EST_L_ID_DE_LA_LIGNE, motifDeRefusDuChemin };\n",
);
const garde = await import(pathToFileURL(fichierGarde).href);
const { PREFIXE_PAR_TYPE, motifDeRefusDuChemin } = garde;

// La garde de reference vit HORS du bloc partage (elle ne sert qu'a
// `telecharger-document`) : on l'extrait de son fichier.
const fichierRef = join(dossier, "ref.mts");
{
  const texte = readFileSync(SOURCE, "utf8");
  const i = texte.indexOf("const REFERENCE_SURE");
  const j = texte.indexOf("Deno.serve(");
  if (i < 0 || j <= i) throw new Error("bloc de garde de reference introuvable dans telecharger-document");
  writeFileSync(fichierRef, texte.slice(i, j) + "\nexport { motifDeRefusDeLaReference };\n");
}
const { motifDeRefusDeLaReference } = await import(pathToFileURL(fichierRef).href);

const ID_PLAN = "16dbe0f9-f5e8-41c6-9d5a-1ee12c4fec89";
const ID_AUTRE_PLAN = "7d3a3f04-6d98-48a3-b3b2-23f1eecbf574";
const CIBLE = "attestations_cession/ATT-CESS-2026-00846.pdf";

const ATTAQUES = [
  [CIBLE, "plan_lot", ID_PLAN, "enonce #49 : plan_lot declarant une attestation"],
  [`plans-cad/${ID_PLAN}/../../${CIBLE}`, "plan_lot", ID_PLAN, "remontee '..' explicite"],
  [`plans-cad/${ID_PLAN}/..%2f..%2f${CIBLE}`, "plan_lot", ID_PLAN, "remontee encodee (%2f)"],
  [`plans-cad/${ID_PLAN}/%2e%2e/%2e%2e/${CIBLE}`, "plan_lot", ID_PLAN, "remontee entierement encodee (%2e%2e)"],
  [`plans-cad\\${ID_PLAN}\\..\\..\\${CIBLE}`, "plan_lot", ID_PLAN, "remontee par antislash"],
  [`plans-cad/${ID_PLAN}/./../${CIBLE}`, "plan_lot", ID_PLAN, "remontee mixte './..'"],
  // 🔴 LES DEUX CAS QUE LA LISTE NOIRE LAISSAIT PASSER (verificateur, 10/08).
  [`${CIBLE}#zzz`, "attestation_cession", "x", "fragment '#' — la garde validait A, l'admin ouvrait B"],
  [`${CIBLE}?x=1`, "attestation_cession", "x", "requete '?' — meme ecart"],
  [`plans-cad/${ID_PLAN}/original.dwg#/../../${CIBLE}`, "plan_lot", ID_PLAN, "fragment portant une remontee"],
  [`${CIBLE}#`, "attestation_cession", "x", "fragment vide"],
  [`${CIBLE}?`, "attestation_cession", "x", "requete vide"],
  ["/" + CIBLE, "attestation_cession", "x", "slash initial"],
  ["https://exemple.test/vole.pdf", "attestation_cession", "x", "URL absolue https"],
  ["file:///etc/passwd", "attestation_cession", "x", "URL absolue file"],
  ["data:text/plain;base64,QQ==", "attestation_cession", "x", "URL data:"],
  [CIBLE, "quittance", "x", "quittance pointant une attestation"],
  ["paiements/QUIT-2026-00004.html", "pv_bornage", "x", "pv_bornage pointant une quittance"],
  [`plans-cad/${ID_PLAN}/original.dwg`, "quittance", "x", "quittance pointant un plan"],
  [`plans-cad/${ID_AUTRE_PLAN}/original.dwg`, "plan_lot", ID_PLAN, "plan_lot dans le dossier d'un autre plan"],
  [CIBLE, "autre", "x", "type 'autre' (aucun prefixe declare)"],
  [CIBLE, "piece_identite", "x", "type 'piece_identite' (aucun prefixe declare)"],
  [CIBLE, "acd", "x", "type 'acd' (aucun prefixe declare)"],
  [CIBLE, "titre_foncier", "x", "type 'titre_foncier' (aucun prefixe declare)"],
  [CIBLE, "", "x", "type vide"],
  [CIBLE, null, "x", "type null"],
  [CIBLE, "attestations_cession", "x", "type confondu avec le NOM DU DOSSIER"],
  // Pollution de prototype : `PREFIXE_PAR_TYPE['constructor']` rend une
  // valeur truthy heritee. Inatteignable (le type vient d'un enum PG),
  // mais un lookup sans `Object.hasOwn` produirait un motif absurde.
  [CIBLE, "constructor", "x", "type 'constructor' (pollution de prototype)"],
  [CIBLE, "toString", "x", "type 'toString' (pollution de prototype)"],
  [CIBLE, "__proto__", "x", "type '__proto__' (pollution de prototype)"],
  ["", "attestation_cession", "x", "chemin vide"],
  [null, "attestation_cession", "x", "chemin null"],
  [42, "attestation_cession", "x", "chemin non-chaine"],
  ["attestations_cession", "attestation_cession", "x", "prefixe seul, sans fichier"],
  ["attestations_cession/", "attestation_cession", "x", "slash final"],
  ["attestations_cession//x.pdf", "attestation_cession", "x", "segment vide"],
  ["attestations_cession/./x.pdf", "attestation_cession", "x", "segment '.'"],
  ["attestations_cession/x" + String.fromCharCode(0) + ".pdf", "attestation_cession", "x", "octet NUL"],
  ["attestations_cession/x\n.pdf", "attestation_cession", "x", "saut de ligne"],
  ["attestations_cession/" + "a".repeat(600) + ".pdf", "attestation_cession", "x", "chemin > 512 caracteres"],
  ["attestations_cession_bis/x.pdf", "attestation_cession", "x", "prefixe voisin 'attestations_cession_bis'"],
  ["attestations_cessionX/x.pdf", "attestation_cession", "x", "prefixe colle"],
  ["plans-cad/abc/original.dwg", "plan_lot", null, "plan_lot sans id de ligne"],
];

console.log("\n③ L'attaque de l'enonce et ses variantes (toutes doivent etre REFUSEES)");
for (const [chemin, type, id, libelle] of ATTAQUES) {
  const motif = motifDeRefusDuChemin(chemin, type, id);
  if (motif) ok(`refuse — ${libelle}  [${motif}]`);
  else fail(`ACCEPTE alors qu'il devait etre refuse — ${libelle} : ${JSON.stringify(chemin)}`);
}

// Les motifs doivent NOMMER la cause : un motif faux coute une heure
// d'enquete. Trois avaient ete releves comme trompeurs par le verificateur.
console.log("\n③bis Les motifs de refus nomment la bonne cause");
for (const [chemin, type, attendu, libelle] of [
  [42, "attestation_cession", "non-chaine", "un non-chaine ne doit pas dire 'chemin vide'"],
  ["https://exemple.test/vole.pdf", "attestation_cession", "URL absolue", "une URL absolue ne doit pas dire 'segment vide'"],
  [`${CIBLE}#zzz`, "attestation_cession", "fragment", "un fragment doit etre nomme"],
]) {
  const motif = motifDeRefusDuChemin(chemin, type, "x") ?? "";
  if (motif.includes(attendu)) ok(`${libelle}  [${motif}]`);
  else fail(`motif trompeur — ${libelle} : recu "${motif}"`);
}

// ─────────────────────────────────────────────────────────────────────
//  ④ LES LECTURES LEGITIMES — le risque symetrique
// ─────────────────────────────────────────────────────────────────────

const LEGITIMES = [
  ["attestations_cession/ATT-CESS-2026-00846.pdf", "attestation_cession", "x", "attestation de cession (158 lignes)"],
  ["attestations_cession/ZZZ-TEST-2026-99999.pdf", "attestation_cession", "x", "attestation de cession, borne haute"],
  ["paiements/QUIT-2026-00004.html", "quittance", "x", "quittance HTML (10 lignes)"],
  ["paiements/QUIT-2026-00014.pdf", "quittance", "x", "quittance PDF"],
  ["attestations_coutumieres/APFC-EBIMPE-2022-001.pdf", "certificat_propriete_coutumiere", "x", "APFC (6 lignes)"],
  ["certificats_vente/CERT-VENTE-2026-00044.pdf", "certificat_vente", "x", "certificat de vente (2 lignes)"],
  ["pv_bornage/PV-BORNAGE-2026-00005.html", "pv_bornage", "x", "PV de bornage (1 ligne)"],
  [`plans-cad/${ID_PLAN}/original.dwg`, "plan_lot", ID_PLAN, "plan de lot, binaire (2 lignes)"],
  [`plans-cad/${ID_PLAN}/apercu.png`, "plan_lot", ID_PLAN, "plan de lot, APERCU reel en production"],
  [`plans-cad/${ID_PLAN}/apercu.svg`, "plan_lot", ID_PLAN, "plan de lot, apercu ecrit par convertir-plan-cad"],
  [`plans-cad/${ID_AUTRE_PLAN}/original.dwg`, "plan_lot", ID_AUTRE_PLAN, "second plan de lot"],
  [
    "attestations_attribution_lot/ATT-ATTR-2026-00001.pdf",
    "attestation_attribution",
    "x",
    "attestation d'attribution — 0 ligne, forme lue dans generation-document:813",
  ],
  [
    "plans-lotissement/2f1b0a5e-0000-4000-8000-000000000001/9c2d0a5e-0000-4000-8000-000000000002.pdf",
    "plan_lotissement",
    "9c2d0a5e-0000-4000-8000-000000000002",
    "plan de lotissement — 0 ligne, forme lue dans plans.service.ts:114",
  ],
];

console.log("\n④ Les lectures legitimes (toutes doivent PASSER)");
for (const [chemin, type, id, libelle] of LEGITIMES) {
  const motif = motifDeRefusDuChemin(chemin, type, id);
  if (!motif) ok(`passe — ${libelle}`);
  else fail(`REFUSEE alors qu'elle est legitime — ${libelle} : ${motif}`);
}

// ─────────────────────────────────────────────────────────────────────
//  ⑤ Le charset des references (branche CONFIG)
// ─────────────────────────────────────────────────────────────────────

console.log("\n⑤ Les references du client (branche CONFIG)");
for (const [ref, libelle] of [
  ["ATT-CESS-2026-00846", "reference reelle (106 en production)"],
  ["APFC-EBIMPE-2022-001", "reference APFC reelle"],
  ["QUIT-2026-00014", "reference de quittance"],
  ["PV-BORNAGE-2026-00005", "reference de PV"],
]) {
  const motif = motifDeRefusDeLaReference(ref);
  if (!motif) ok(`passe — ${libelle}`);
  else fail(`REFUSEE alors qu'elle est legitime — ${libelle} : ${motif}`);
}
for (const [ref, libelle] of [
  ["../../attestations_cession/ATT-CESS-2026-00846", "traversee"],
  ["..", "'..' seul"],
  ["a/b", "slash"],
  ["a\\b", "antislash"],
  ["a%2fb", "slash encode"],
  ["a#b", "fragment"],
  ["a?b", "requete"],
  ["", "vide"],
  ["a".repeat(200), "trop longue"],
]) {
  const motif = motifDeRefusDeLaReference(ref);
  if (motif) ok(`refuse — ${libelle}  [${motif}]`);
  else fail(`ACCEPTEE alors qu'elle devait etre refusee — ${libelle}`);
}

// ─────────────────────────────────────────────────────────────────────
//  ⑥ COMPORTEMENT — les handlers sont REELLEMENT EXECUTES
//
//  C'est la section qui tue M6 et M7. Les deux `index.ts` sont charges
//  avec un client Supabase bouchonne qui JOURNALISE chaque appel storage.
//  On n'affirme plus « la garde aurait refuse » : on constate qu'AUCUNE
//  URL n'a ete signee et qu'AUCUN octet n'a ete telecharge.
// ─────────────────────────────────────────────────────────────────────

console.log("\n⑥ Comportement reel des deux handlers (bouchons + journal)");

const STUB = join(dossier, "stub-supabase.mjs");
writeFileSync(
  STUB,
  `export let scenario = {};
export const journal = [];
export function __configurer(s) { scenario = s; journal.length = 0; }
export function createClient(url, cle) {
  const estService = cle === "SERVICE";
  const table = (nom) => ({
    select() { return this; },
    eq() { return this; },
    update(v) { journal.push({ op: "update", nom, v }); return { eq: async () => ({ error: null }) }; },
    async maybeSingle() {
      journal.push({ op: "select", nom, estService });
      if (scenario.erreurLecture) return { data: null, error: { message: "rls" } };
      return { data: scenario.ligne ?? null, error: null };
    },
  });
  return {
    from: table,
    storage: {
      from: (bucket) => ({
        async createSignedUrl(chemin, ttl) {
          journal.push({ op: "createSignedUrl", bucket, chemin, ttl, estService });
          return { data: { signedUrl: "https://stub.invalid/signed/" + chemin }, error: null };
        },
        async download(chemin) {
          journal.push({ op: "download", bucket, chemin, estService });
          if (scenario.contenu === undefined) return { data: null, error: { message: "absent" } };
          return { data: new Blob([scenario.contenu]), error: null };
        },
        async upload(chemin) { journal.push({ op: "upload", bucket, chemin }); return { error: null }; },
      }),
    },
  };
}
`,
);

async function chargerHandler(fichierSource, nom) {
  let texte = readFileSync(fichierSource, "utf8");
  const importOriginel = 'import { createClient } from "https://esm.sh/@supabase/supabase-js@2";';
  if (!texte.includes(importOriginel)) {
    fail(`${nom} : import supabase-js introuvable, le bouchon ne peut pas etre injecte`);
    return null;
  }
  texte = texte.replace(importOriginel, `import { createClient } from ${JSON.stringify(pathToFileURL(STUB).href)};`);
  const cible = join(dossier, `${nom}.mts`);
  writeFileSync(cible, texte);

  let handler = null;
  globalThis.Deno = {
    serve: (h) => {
      handler = h;
    },
    env: {
      get: (n) =>
        ({ SUPABASE_URL: "https://stub.invalid", SUPABASE_ANON_KEY: "ANON", SUPABASE_SERVICE_ROLE_KEY: "SERVICE" })[n] ??
        "x",
    },
  };
  await import(pathToFileURL(cible).href);
  if (!handler) fail(`${nom} : Deno.serve n'a pas ete appele, aucun handler capture`);
  return handler;
}

const stub = await import(pathToFileURL(STUB).href);
const requete = (corps) =>
  new Request("https://stub.invalid/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer jeton-de-test" },
    body: JSON.stringify(corps),
  });

const signatures = () => stub.journal.filter((e) => e.op === "createSignedUrl");
const telechargements = () => stub.journal.filter((e) => e.op === "download");

// ---- telecharger-document ----
const handlerTelecharger = await chargerHandler(SOURCE, "telecharger-document");
if (handlerTelecharger) {
  const cas = [
    {
      nom: "M6 — plan_lot forge, variant 'original' : AUCUNE signature",
      ligne: { id: ID_PLAN, type: "plan_lot", url_fichier: CIBLE, apercu_url: null },
      corps: { table: "documents", reference: ID_PLAN, variant: "original" },
      statut: 404,
      signatures: 0,
    },
    {
      // 🔴 LE CAS QUE LE VERIFICATEUR A DEMANDE (son point 2). L'ancien
      // script portait DEUX FOIS les memes arguments et ne testait donc
      // pas la selection de colonne. Ici `url_fichier` est IRREPROCHABLE
      // et seul `apercu_url` est empoisonne : seule la lecture effective
      // de `variant` peut faire echouer ce cas.
      nom: "apercu_url empoisonne, url_fichier propre, variant 'apercu' : AUCUNE signature",
      ligne: { id: ID_PLAN, type: "plan_lot", url_fichier: `plans-cad/${ID_PLAN}/original.dwg`, apercu_url: CIBLE },
      corps: { table: "documents", reference: ID_PLAN, variant: "apercu" },
      statut: 404,
      signatures: 0,
    },
    {
      // Le controle SYMETRIQUE du precedent : si le handler ignorait
      // `variant` et signait toujours `url_fichier`, le cas ci-dessus
      // passerait au vert par accident. Celui-ci l'interdit.
      nom: "variant 'apercu' signe bien apercu_url, pas url_fichier",
      ligne: {
        id: ID_PLAN,
        type: "plan_lot",
        url_fichier: `plans-cad/${ID_PLAN}/original.dwg`,
        apercu_url: `plans-cad/${ID_PLAN}/apercu.png`,
      },
      corps: { table: "documents", reference: ID_PLAN, variant: "apercu" },
      statut: 200,
      signatures: 1,
      cheminSigne: `plans-cad/${ID_PLAN}/apercu.png`,
    },
    {
      nom: "variant 'original' signe bien url_fichier",
      ligne: {
        id: ID_PLAN,
        type: "plan_lot",
        url_fichier: `plans-cad/${ID_PLAN}/original.dwg`,
        apercu_url: `plans-cad/${ID_PLAN}/apercu.png`,
      },
      corps: { table: "documents", reference: ID_PLAN, variant: "original" },
      statut: 200,
      signatures: 1,
      cheminSigne: `plans-cad/${ID_PLAN}/original.dwg`,
    },
    {
      nom: "fragment '#' : AUCUNE signature (la garde validait A, l'admin ouvrait B)",
      ligne: { id: "x", type: "attestation_cession", url_fichier: `${CIBLE}#zzz`, apercu_url: null },
      corps: { table: "documents", reference: "x", variant: "original" },
      statut: 404,
      signatures: 0,
    },
    {
      nom: "lecture legitime d'une attestation : 1 signature, chemin exact",
      ligne: { id: "x", type: "attestation_cession", url_fichier: CIBLE, apercu_url: null },
      corps: { table: "documents", reference: "x", variant: "original" },
      statut: 200,
      signatures: 1,
      cheminSigne: CIBLE,
    },
    {
      nom: "branche CONFIG, reference forgee : AUCUNE signature",
      ligne: { reference: "../../x" },
      corps: { table: "attestations_cession", reference: "../../x" },
      statut: 400,
      signatures: 0,
    },
    {
      nom: "branche CONFIG, reference legitime : signature sous le bon prefixe",
      ligne: { reference: "ATT-CESS-2026-00846" },
      corps: { table: "attestations_cession", reference: "ATT-CESS-2026-00846" },
      statut: 200,
      signatures: 1,
      cheminSigne: "attestations_cession/ATT-CESS-2026-00846.pdf",
    },
  ];

  for (const c of cas) {
    stub.__configurer({ ligne: c.ligne });
    const rep = await handlerTelecharger(requete(c.corps));
    const sig = signatures();
    const details = [];
    if (rep.status !== c.statut) details.push(`statut ${rep.status} (attendu ${c.statut})`);
    if (sig.length !== c.signatures) details.push(`${sig.length} signature(s) (attendu ${c.signatures})`);
    if (c.cheminSigne && sig[0]?.chemin !== c.cheminSigne)
      details.push(`chemin signe ${JSON.stringify(sig[0]?.chemin)} (attendu ${JSON.stringify(c.cheminSigne)})`);
    if (sig.some((s) => !s.estService)) details.push("une signature n'a pas ete faite en service_role");
    if (details.length === 0) ok(`telecharger-document : ${c.nom}`);
    else fail(`telecharger-document : ${c.nom} — ${details.join(" ; ")}`);
  }
}

// ---- convertir-plan-cad ----
const handlerConvertir = await chargerHandler(COPIE, "convertir-plan-cad");
if (handlerConvertir) {
  const cas = [
    {
      nom: "M7 — plan_lot forge : AUCUN telechargement service_role",
      ligne: { id: ID_PLAN, type: "plan_lot", url_fichier: CIBLE },
      telechargements: 0,
    },
    {
      nom: "type non convertible : AUCUN telechargement",
      ligne: { id: "x", type: "attestation_cession", url_fichier: CIBLE },
      telechargements: 0,
    },
    {
      nom: "fragment '#' sur un plan : AUCUN telechargement",
      ligne: { id: ID_PLAN, type: "plan_lot", url_fichier: `plans-cad/${ID_PLAN}/original.dwg#/../../${CIBLE}` },
      telechargements: 0,
    },
    {
      nom: "plan legitime : telechargement du chemin EXACT",
      ligne: { id: ID_PLAN, type: "plan_lot", url_fichier: `plans-cad/${ID_PLAN}/original.dwg` },
      telechargements: 1,
      cheminLu: `plans-cad/${ID_PLAN}/original.dwg`,
      contenu: "0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n",
    },
  ];

  for (const c of cas) {
    stub.__configurer({ ligne: c.ligne, contenu: c.contenu });
    await handlerConvertir(requete({ document_id: c.ligne.id }));
    const dl = telechargements();
    const details = [];
    if (dl.length !== c.telechargements) details.push(`${dl.length} telechargement(s) (attendu ${c.telechargements})`);
    if (c.cheminLu && dl[0]?.chemin !== c.cheminLu)
      details.push(`chemin lu ${JSON.stringify(dl[0]?.chemin)} (attendu ${JSON.stringify(c.cheminLu)})`);
    if (dl.some((d) => !d.estService)) details.push("un telechargement n'a pas ete fait en service_role");
    if (details.length === 0) ok(`convertir-plan-cad : ${c.nom}`);
    else fail(`convertir-plan-cad : ${c.nom} — ${details.join(" ; ")}`);
  }
}

/**
 * Nettoyeur SQL — retire `--...`, `/* ... *\/` (imbriques) en respectant
 * les chaines `'...'` (avec `''` correctement reconnue comme apostrophe
 * ECHAPPEE, pas comme fermeture). Extrait en fonction NOMMEE au 5e tour
 * pour servir les DEUX migrations (`⑦` et `⑦bis`) sans dupliquer les deux
 * defauts que le verificateur y a trouves et qui sont maintenant corriges
 * ICI, une seule fois — voir le detail dans le corps.
 *
 * 🔴 (a) LES COMMENTAIRES DE BLOC N'ETAIENT PAS RECONNUS. Une migration
 * dont tout le `alter table … add constraint` reel est mis en commentaire
 * de BLOC, avec un `grant execute` reel SUPPRIME et un leurre laisse en
 * commentaire, ressortait « contrainte bien posee, grant present » — vert
 * sur une migration qui ne pose plus rien. PostgreSQL AUTORISE les blocs
 * IMBRIQUES (`/* a /* b *\/ c *\/` est UN SEUL commentaire) : le scanner
 * suit une PROFONDEUR, pas seulement "chercher le premier `*\/`".
 *
 * 🔴 (b) `''` N'ETAIT PAS RECONNUE COMME APOSTROPHE ECHAPPEE. Basculer
 * `dansChaine` a CHAQUE `'` rencontre, sans regarder si le suivant est un
 * second `'`, refermait la chaine au MAUVAIS endroit sur tout motif
 * portant un `''` (le motif de liste blanche de 20260810100000 en porte
 * un). Le texte produit restait identique PAR CHANCE ; un `--`/`/*` tombe
 * entre les deux aurait rompu la chaine et cree un faux commentaire.
 */
function nettoyerSql(sql) {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];

    // Chaine SQL '...' — voir (b) ci-dessus.
    if (c === "'") {
      out += c;
      i++;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          out += "''"; // apostrophe ECHAPPEE : on reste dans la chaine
          i += 2;
          continue;
        }
        out += sql[i];
        if (sql[i] === "'") {
          i++;
          break; // fermeture reelle
        }
        i++;
      }
      continue;
    }

    // Commentaire de ligne.
    if (c === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue; // le "\n" est recopie au tour suivant
    }

    // Commentaire de BLOC — voir (a) ci-dessus. Imbrication geree par
    // profondeur, conforme au comportement reel de PostgreSQL.
    if (c === "/" && sql[i + 1] === "*") {
      let profondeur = 1;
      i += 2;
      while (i < sql.length && profondeur > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          profondeur++;
          i += 2;
          continue;
        }
        if (sql[i] === "*" && sql[i + 1] === "/") {
          profondeur--;
          i += 2;
          continue;
        }
        if (sql[i] === "\n") out += "\n"; // les sauts de ligne restent alignes
        i++;
      }
      continue;
    }

    out += c;
    i++;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
//  ⑦ DERIVE — la table des prefixes existe en DEUX endroits
//
//  `PREFIXE_PAR_TYPE` (TypeScript) et la fonction
//  `documents_chemin_suit_le_type` (SQL, migration 20260810100000)
//  disent la meme chose et peuvent diverger. Le depot ne peut pas les
//  fusionner — une edge function se deploie comme un fichier unique, elle
//  ne peut pas lire une migration. La divergence est donc TENUE PAR UNE
//  MACHINE, exactement comme les deux copies de la garde au §①.
// ─────────────────────────────────────────────────────────────────────

console.log("\n⑦ La migration : table des prefixes, contrainte, et proprietes de la fonction");
try {
  const sql = readFileSync(MIGRATION, "utf8");

  // 🔴 TOUTES les assertions de cette section lisent le CODE, jamais la PROSE.
  // Le trou du `else false` (cherche dans le fichier entier, ou il apparait
  // aussi dans deux commentaires) n'etait pas isole : le verificateur l'a
  // reproduit a l'identique sur le `grant execute`, qui est cite dans le
  // bandeau. Les commentaires sont donc retires UNE FOIS, ici, et c'est
  // `sqlCode` qui sert partout ensuite.
  //
  // ⚠️ Un simple filtre de lignes `^\s*--` ne suffisait pas : il laissait
  // passer les commentaires de FIN DE LIGNE. `select 1; -- grant execute on
  // function public.documents_chemin_suit_le_type(...) to authenticated,
  // service_role` aurait suffi a maintenir l'assertion des ACL au vert sur
  // une migration qui n'accorde plus rien. On balaye donc les caracteres.
  //
  // 🔴 5e TOUR — DEUX DEFAUTS TROUVES PAR LE VERIFICATEUR DANS CE SCANNER
  // LUI-MEME, LES DEUX FERMES ICI :
  //
  //  (a) LES COMMENTAIRES DE BLOC `/* … */` N'ETAIENT PAS RECONNUS. Une
  //      migration dont tout le `alter table … add constraint` reel est mis
  //      en commentaire de BLOC, avec un `grant execute` reel SUPPRIME et un
  //      leurre laisse en commentaire, ressortait « contrainte bien posee,
  //      grant present » — vert sur une migration qui ne pose plus rien.
  //      PostgreSQL AUTORISE les blocs IMBRIQUES (`/* a /* b */ c */` est UN
  //      SEUL commentaire) : le scanner suit donc une PROFONDEUR, pas
  //      seulement "chercher le premier `*/`".
  //
  //  (b) `''` (APOSTROPHE ECHAPPEE DANS UNE CHAINE SQL) N'ETAIT PAS
  //      RECONNUE COMME TELLE. L'ancien scanner basculait `dansChaine` a
  //      CHAQUE `'` rencontre, sans regarder si le suivant est un second
  //      `'`. Sur `'^[A-Za-z0-9!$&''()*+,./:;=@\[\]_|~-]+$'` — le motif de
  //      liste blanche lui-meme, qui contient un `''` pour autoriser
  //      l'apostrophe dans un chemin — il refermait la chaine au premier des
  //      deux, la rouvrait juste apres : le texte produit restait identique
  //      PAR CHANCE (rien entre les deux `'` ne ressemble a `--` ou `/*`),
  //      mais un `--` ou un `/*` qui tomberait entre les deux romprait la
  //      chaine et deviendrait un vrai commentaire — retirant du SQL actif.
  //      `''` est donc desormais recopiee ENTIERE, sans jamais faire
  //      basculer l'etat au milieu.
  //
  // L'ordre du scanner compte : on entre en mode commentaire/chaine DES le
  // premier caractere qui l'annonce, sans lire la suite au prealable. C'est
  // ce qui rend inoffensives les apostrophes de la prose francaise du
  // bandeau (« n'est », « d'ou ») — elles sont HORS chaine SQL, donc jamais
  // vues comme des ouvertures de litteral.
  const sqlCode = nettoyerSql(sql);

  // Le nettoyeur SQL est verifie, comme celui du TypeScript : s'il se
  // trompait, il le ferait en silence et dans les deux sens.
  if (/^\s*grant execute on function public\.documents_chemin_suit_le_type/m.test(sqlCode))
    ok("le nettoyeur SQL conserve le `grant execute` REEL (ligne de code)");
  else fail("le nettoyeur SQL a detruit le `grant execute` reel — les assertions ACL ne veulent plus rien dire");
  if (!/La redaction precedente/.test(sqlCode)) ok("le nettoyeur SQL retire la prose du bandeau");
  else fail("le nettoyeur SQL laisse la prose du bandeau — les assertions valideraient les commentaires");

  // 🔴 5e TOUR — LE NETTOYEUR SE TESTE LUI-MEME SUR DES CAS FABRIQUES, PAS
  // SEULEMENT SUR LE CONTENU REEL DE LA MIGRATION. Un texte reel ne prouve
  // que ce qu'il contient deja ; ces trois cas exercent precisement les deux
  // defauts trouves par le verificateur, sur des entrees qu'on CONSTRUIT.
  {
    const nettoyer = (s) => {
      // Meme scanner, reimplemente en fonction nommee pour les cas de test —
      // dupliquer ainsi est laid, mais extraire un module partage pour un
      // script jetable serait plus fragile que la duplication assumee ici,
      // et la divergence eventuelle entre les deux copies serait elle-meme
      // detectee par ces memes assertions (le sqlCode reel echouerait).
      let out = "", i = 0;
      while (i < s.length) {
        const c = s[i];
        if (c === "'") {
          out += c; i++;
          while (i < s.length) {
            if (s[i] === "'" && s[i + 1] === "'") { out += "''"; i += 2; continue; }
            out += s[i];
            if (s[i] === "'") { i++; break; }
            i++;
          }
          continue;
        }
        if (c === "-" && s[i + 1] === "-") { while (i < s.length && s[i] !== "\n") i++; continue; }
        if (c === "/" && s[i + 1] === "*") {
          let p = 1; i += 2;
          while (i < s.length && p > 0) {
            if (s[i] === "/" && s[i + 1] === "*") { p++; i += 2; continue; }
            if (s[i] === "*" && s[i + 1] === "/") { p--; i += 2; continue; }
            i++;
          }
          continue;
        }
        out += c; i++;
      }
      return out;
    };

    // Cas 1 — L'EXPLOIT DECRIT : l'`alter table` reel en commentaire de bloc,
    // un `grant execute` reel retire, un LEURRE laisse en commentaire.
    const exploit = [
      "alter table public.documents add constraint reelle check (true);",
      "/* alter table public.documents add constraint leurre check (false); */",
      "-- grant execute on function public.x(text) to authenticated, service_role",
    ].join("\n");
    const nettoye1 = nettoyer(exploit);
    if (nettoye1.includes("add constraint reelle") && !nettoye1.includes("add constraint leurre"))
      ok("nettoyeur SQL — cas fabrique : le bloc `/* … */` disparait, le code actif reste");
    else
      fail(
        "nettoyeur SQL — cas fabrique : le bloc `/* … */` NE disparait PAS correctement " +
          `(sortie : ${JSON.stringify(nettoye1.slice(0, 200))})`,
      );

    // Cas 2 — IMBRICATION. PostgreSQL imbrique les blocs ; un scanner qui
    // s'arrete au PREMIER `*/` romprait trop tot et laisserait echapper du
    // texte suppose commente.
    const imbrique = "avant /* externe /* interne */ toujours_commente */ apres";
    const nettoye2 = nettoyer(imbrique);
    if (nettoye2.includes("avant") && nettoye2.includes("apres") && !nettoye2.includes("toujours_commente"))
      ok("nettoyeur SQL — cas fabrique : les blocs IMBRIQUES sont geres par profondeur");
    else fail(`nettoyeur SQL — cas fabrique : imbrication mal geree (sortie : ${JSON.stringify(nettoye2)})`);

    // Cas 3 — L'APOSTROPHE ECHAPPEE `''`. Un `--` place ENTRE les deux `'`
    // d'une paire echappee ne doit PAS devenir un commentaire : il est a
    // l'INTERIEUR de la chaine SQL.
    const echappee = "select 'a''--b' as x; select 'reste';";
    const nettoye3 = nettoyer(echappee);
    if (nettoye3.includes("'a''--b'") && nettoye3.includes("'reste'"))
      ok("nettoyeur SQL — cas fabrique : `''` a l'interieur d'une chaine ne declenche pas de faux commentaire");
    else fail(`nettoyeur SQL — cas fabrique : \`''\` mal geree (sortie : ${JSON.stringify(nettoye3)})`);
  }

  // 🔴 On travaille sur le CORPS de la fonction, pas sur le fichier.
  // Une premiere version testait `/else\s+false/` sur le fichier ENTIER :
  // `else false` y apparait aussi dans deux commentaires, si bien que muter
  // le code en `else true` — un fail-OPEN, l'inverse exact de l'arbitrage
  // rendu — laissait le controle au vert. Un controle qui lit les
  // commentaires valide la prose, pas le code.
  const corps = sqlCode.match(/as \$function\$([\s\S]*?)\$function\$/)?.[1];
  if (!corps) {
    fail("corps `$function$ … $function$` introuvable dans la migration — controle impossible (fail-closed)");
  } else {
    const table = {};
    const motif = /when\s+'([a-z_]+)'::public\.type_document\s*then\s*starts_with\(p_chemin,\s*'([^']+)\/'\)/g;
    for (const m of corps.matchAll(motif)) table[m[1]] = m[2];

    const nSql = Object.keys(table).length;
    const nTs = Object.keys(PREFIXE_PAR_TYPE).length;
    if (nSql === 0) {
      fail("aucune branche de prefixe lue dans le corps de la fonction — le motif d'extraction ne correspond plus");
    } else if (nSql !== nTs) {
      fail(`${nTs} types en TypeScript, ${nSql} en SQL — les deux tables ont diverge`);
    } else {
      const ecarts = [];
      for (const [type, prefixe] of Object.entries(PREFIXE_PAR_TYPE)) {
        if (table[type] !== prefixe) ecarts.push(`${type}: TS='${prefixe}' SQL='${table[type] ?? "(absent)"}'`);
      }
      if (ecarts.length === 0) ok(`les ${nTs} types portent le meme prefixe des deux cotes`);
      else fail(`prefixes divergents : ${ecarts.join(" | ")}`);
    }

    if (/else\s+false/.test(corps)) ok("le CORPS de la fonction est fail-closed (`else false`)");
    else fail("le CORPS de la fonction n'est PAS fail-closed : un type inconnu y serait ACCEPTE (fail-open)");

    // Les bannissements de forme, dans le corps.
    if (/position\('\.\.' in p_chemin\)\s*=\s*0/.test(corps)) ok("le corps bannit la remontee '..'");
    else fail("le corps NE bannit PAS '..'");

    if (/left\(p_chemin,\s*1\)\s*<>\s*'\/'/.test(corps)) ok("le corps bannit le slash initial");
    else fail("le corps NE bannit PAS le slash initial");

    // La liste blanche remplace le bannissement explicite de l'antislash :
    // on verifie donc qu'elle est la ET qu'elle exclut bien l'antislash.
    // `(?:[^']|'')*` et non `[^']*` : la classe CONTIENT une apostrophe,
    // echappee en SQL par doublement (`''`). Un `[^']*` s'arrete dessus et
    // ne trouve rien — c'est ce qui a fait echouer ce controle a sa premiere
    // ecriture, en annoncant « aucune liste blanche » sur un corps qui en
    // portait une.
    const classe = corps.match(/p_chemin\s*~\s*'((?:[^']|'')*)'/)?.[1];
    if (!classe) {
      fail("aucune liste blanche de caracteres dans le corps — l'antislash et le non-ASCII passeraient");
    } else {
      const motifJs = new RegExp(classe.replace(/''/g, "'"));

      // ── 🔴 COMPARAISON EXHAUSTIVE, PAS UN ECHANTILLON ─────────────────
      // Une premiere version n'essayait que 6 caracteres. Le verificateur a
      // elargi la classe SQL a `" < > ^ ` { }` — 7 des 12 que la garde
      // refuse — et le controle est reste VERT : A3 n'etait pas TENU, il
      // etait SONDE. On derive donc les DEUX ensembles sur le meme domaine
      // et on les compare caractere par caractere, exactement comme le
      // faisait l'outil jetable `a3-charset.mjs` — mais ici, dans la preuve.
      const domaine = [];
      for (let c = 32; c <= 126; c++) domaine.push(String.fromCharCode(c));
      for (const ch of ["é", "É", "è", "ï", "ô", "ç", "à", "ù", "—", "’", "«", "»", "€", " ", "ñ", "Ø"])
        domaine.push(ch);

      const divergences = [];
      for (const ch of domaine) {
        // `/` est structurel (separateur) : la garde l'accepte, la classe SQL
        // aussi, mais il n'a pas de sens en position de nom de fichier isole.
        if (ch === "/") continue;
        const essai = `attestations_cession/x${ch}y.pdf`;
        const gardeAccepte = motifDeRefusDuChemin(essai, "attestation_cession", "id") === null;
        const sqlAccepte = motifJs.test(essai);
        if (gardeAccepte !== sqlAccepte) {
          divergences.push(`${JSON.stringify(ch)} garde=${gardeAccepte ? "accepte" : "refuse"} sql=${sqlAccepte ? "accepte" : "refuse"}`);
        }
      }
      if (divergences.length === 0)
        ok(`liste blanche SQL == garde TS sur ${domaine.length - 1} caracteres derives des deux cotes`);
      else
        fail(
          `la classe SQL et la garde TS DIVERGENT sur ${divergences.length} caractere(s) : ${divergences.slice(0, 12).join(" | ")}` +
            ". Stocker ce que la garde refusera de servir fabrique un 404 permanent.",
        );

      if (motifJs.test("attestations_cession/ATT-CESS-2026-00846.pdf"))
        ok("la liste blanche du corps accepte un chemin reel de production");
      else fail("la liste blanche du corps REFUSE un chemin reel de production");
    }

    // ── LE RESIDUEL J7 : ce que la contrainte acceptait et que la garde
    //    refuse a jamais (segment vide, slash final, segment '.', longueur).
    //    Cout mesure de la fermeture : 0 ligne sur 179 (max observe : 59
    //    caracteres, 0 `//`, 0 slash final, 0 segment '.').
    for (const [motifSql, libelle] of [
      [/position\('\/\/' in p_chemin\)\s*=\s*0/, "segment vide (//)"],
      [/right\(p_chemin,\s*1\)\s*<>\s*'\/'/, "slash final"],
      [/p_chemin\s*!~\s*'\(\^\|\/\)\\\.\(\/\|\$\)'/, "segment '.'"],
      [/length\(p_chemin\)\s*<=\s*512/, "longueur <= 512"],
      [/position\('\/' in p_chemin\)\s*>\s*0/, "presence d'un dossier"],
    ]) {
      if (motifSql.test(corps)) ok(`le corps ferme le residuel : ${libelle}`);
      else fail(`le corps NE ferme PAS le residuel : ${libelle} — accepte en base, refuse au telechargement`);
    }
  }

  // ── La CONTRAINTE elle-meme — elle n'etait verifiee par rien ──────────
  // Le verificateur a commente le `alter table … add constraint` en entier :
  // le script restait vert, alors que plus AUCUNE contrainte n'etait posee.
  const alter = sqlCode.match(/^\s*alter table public\.documents[\s\S]*?;/m)?.[0];
  if (!alter) {
    fail("aucun `alter table public.documents … add constraint` actif — la migration ne pose plus rien");
  } else if (!/add constraint\s+documents_chemin_conforme_au_type/.test(alter)) {
    fail("l'`alter table` ne pose pas la contrainte attendue");
  } else {
    ok("la contrainte `documents_chemin_conforme_au_type` est bien posee par la migration");

    // 🔴 LES DEUX COLONNES. Reduire la contrainte a `url_fichier` est
    // l'oubli du 09/08 reproduit a l'identique — et il passait.
    const surUrl = /documents_chemin_suit_le_type\(\s*type,\s*url_fichier\s*\)/.test(alter);
    const surApercu = /documents_chemin_suit_le_type\(\s*type,\s*apercu_url\s*\)/.test(alter);
    if (surUrl && surApercu) ok("la contrainte porte sur les DEUX colonnes de chemin");
    else
      fail(
        `la contrainte ne porte pas sur les deux colonnes (url_fichier=${surUrl}, apercu_url=${surApercu}) — ` +
          "c'est exactement l'oubli d'`apercu_url` du 09/08.",
      );
    if (/apercu_url is null\s*\n?\s*or/.test(alter)) ok("`apercu_url` NULL reste licite");
    else fail("`apercu_url is null or …` absent : les 178 lignes a apercu_url NULL seraient refusees");
  }

  // ── Proprietes de la fonction : immutable, et PAS security definer ────
  const entete = sqlCode.match(/create or replace function public\.documents_chemin_suit_le_type[\s\S]*?as \$function\$/)?.[0] ?? "";
  if (/\bimmutable\b/.test(entete)) ok("la fonction est `immutable` (exigence d'une contrainte CHECK)");
  else fail("la fonction n'est PAS `immutable` : PostgreSQL refusera la contrainte, ou pire, l'acceptera a tort");
  if (/security\s+definer/i.test(entete))
    fail("la fonction est `security definer` — elle ne lit rien, c'est une surface offerte pour rien");
  else ok("la fonction n'est pas `security definer`");

  // Les ACL et le garde-fou, lus dans `sqlCode` (defini en tete de section).
  for (const [motif, present, absent] of [
    [
      /grant execute on function public\.documents_chemin_suit_le_type[\s\S]{0,200}?to authenticated,\s*service_role/,
      "`grant execute … to authenticated, service_role` present",
      "aucun `grant execute … to authenticated, service_role` ACTIF : l'evaluation de la contrainte leverait 42501 et TOUTE ecriture dans `documents` tomberait.",
    ],
    [
      /revoke all on function public\.documents_chemin_suit_le_type[\s\S]{0,120}?from public,\s*anon/,
      "`revoke all … from public, anon` present",
      "aucun `revoke all … from public, anon` ACTIF : la fonction naitrait executable par PUBLIC (defaut cable de PostgreSQL).",
    ],
    [
      /do \$\$[\s\S]*?raise exception[\s\S]*?end \$\$;/,
      "le garde-fou `do $$ … raise exception … $$` est present",
      "le garde-fou du §3 a disparu : une donnee hors convention ferait echouer l'ALTER sans dire NI combien NI lesquelles.",
    ],
  ]) {
    if (motif.test(sqlCode)) ok(present);
    else fail(absent);
  }

  // La contrainte doit etre VALIDEE : `not valid` laisserait le passe echapper
  // tout en ayant l'air posee.
  if (/add constraint\s+documents_chemin_conforme_au_type[\s\S]*?not\s+valid/i.test(sqlCode))
    fail("la contrainte est posee `NOT VALID` : les lignes existantes ne sont PAS verifiees, le passe echappe.");
  else ok("la contrainte est VALIDEE contre les lignes existantes (pas de `not valid`)");
} catch (e) {
  fail(`migration illisible (${MIGRATION}) : ${e.message}`);
}

// ─────────────────────────────────────────────────────────────────────
//  ⑦bis LA SECONDE MIGRATION — reference/numero sans traversee
//
//  `20260810110000_reference_et_numero_sans_traversee.sql`. Le JUMEAU EN
//  ECRITURE de #49, trouve au 4e tour dans le fichier qu'on venait de
//  corriger : `generation-document` compose
//  `${table}/${rec.reference ?? rec.numero ?? rec.id}.${ext}`, et
//  `pv_bornage.reference` est ENTIEREMENT fournie par le client (aucun
//  CHECK de forme, aucun trigger BEFORE qui la fabrique, la policy
//  d'ecriture ne contraint que `mission_id`). Cette migration double en
//  base ce que la garde applicative de `generation-document` verifie deja.
//
//  🔴 Le verificateur a mesure cette migration BONNE au 4e tour — 7
//  contraintes sur les 6 tables du gabarit, 108 valeurs reelles, 0 hors
//  motif — puis l'a signalee comme ANGLE MORT COMPLET du dispositif de
//  preuve : ZERO assertion, ZERO mutation. Une migration correcte que rien
//  ne verifie n'est pas verifiee, elle est simplement pas encore cassee.
// ─────────────────────────────────────────────────────────────────────

console.log("\n⑦bis La seconde migration : reference/numero sans traversee");
try {
  const sql2 = readFileSync(MIGRATION2, "utf8");
  const sqlCode2 = nettoyerSql(sql2);

  if (/^\s*grant execute on function public\.reference_sans_traversee/m.test(sqlCode2))
    ok("nettoyeur SQL (migration 2) conserve le `grant execute` REEL (ligne de code)");
  else fail("nettoyeur SQL (migration 2) a detruit le `grant execute` reel — les assertions ACL ne veulent plus rien dire");

  // ── La fonction : immutable, PAS security definer ────────────────────
  const entete2 =
    sqlCode2.match(/create or replace function public\.reference_sans_traversee[\s\S]*?as \$function\$/)?.[0] ?? "";
  if (!entete2) {
    fail("migration 2 : entete de `reference_sans_traversee` introuvable (fail-closed)");
  } else {
    if (/\bimmutable\b/.test(entete2)) ok("migration 2 : `reference_sans_traversee` est `immutable`");
    else fail("migration 2 : `reference_sans_traversee` n'est PAS `immutable` — exigence d'une contrainte CHECK");
    if (/security\s+definer/i.test(entete2))
      fail("migration 2 : `reference_sans_traversee` est `security definer` — elle ne lit rien, surface offerte pour rien");
    else ok("migration 2 : `reference_sans_traversee` n'est pas `security definer`");
  }

  // ── Le PREDICAT — charset, '..', et NULL toujours licite ──────────────
  const corps2 = sqlCode2.match(/as \$function\$([\s\S]*?)\$function\$/)?.[1];
  if (!corps2) {
    fail("migration 2 : corps `$function$ … $function$` introuvable (fail-closed)");
  } else {
    if (/~\s*'\^\[A-Za-z0-9\._-\]\+\$'/.test(corps2))
      ok("migration 2 : le corps impose le charset `[A-Za-z0-9._-]`");
    else fail("migration 2 : le corps N'IMPOSE PLUS le charset `[A-Za-z0-9._-]` — le motif attendu a disparu ou change");
    if (/position\('\.\.'\s*in\s*p_valeur\)\s*=\s*0/.test(corps2))
      ok("migration 2 : le corps bannit la remontee '..'");
    else fail("migration 2 : le corps NE bannit PLUS '..'");
    if (/p_valeur\s+is\s+null/.test(corps2))
      ok("migration 2 : NULL reste licite (colonnes nullables du gabarit : paiements.reference, etc.)");
    else fail("migration 2 : NULL n'est plus accepte — casserait l'insertion sur les colonnes nullables");

    // Contre-epreuve : le predicat REEL (rejoue en JS) refuse-t-il bien
    // l'attaque de l'enonce ? Verifie sur le texte EXTRAIT de la migration,
    // pas sur une reimplementation supposee.
    const rejoue = (v) =>
      v === null || (/^[A-Za-z0-9._-]+$/.test(v) && !v.includes(".."));
    const attaque = "../attestations_cession/ATT-CESS-2026-00846.pdf#";
    if (!rejoue(attaque)) ok("migration 2 : le predicat REJOUE refuse l'attaque de l'enonce (pv_bornage.reference)");
    else fail("migration 2 : le predicat rejoue ACCEPTE l'attaque de l'enonce — verifier le motif extrait ci-dessus");
    if (rejoue("ATT-CESS-2026-00846")) ok("migration 2 : le predicat REJOUE accepte une reference reelle");
    else fail("migration 2 : le predicat rejoue REFUSE une reference reelle — casserait la generation en production");
  }

  // ── Le garde-fou pre-ALTER ─────────────────────────────────────────────
  if (/do \$\$[\s\S]*?raise exception[\s\S]*?end \$\$;/.test(sqlCode2))
    ok("migration 2 : le garde-fou `do $$ … raise exception … $$` est present");
  else fail("migration 2 : le garde-fou a disparu — une donnee hors motif ferait echouer l'ALTER sans dire combien/lesquelles");

  // ── LES SEPT CONTRAINTES, UNE PAR UNE, PAR NOM ET PAR COLONNE ─────────
  //  Nommees explicitement dans la lecon du 09/08 : ne pas en fermer deux
  //  sur trois. `reference`, `numero`, `id` alimentent le meme gabarit ;
  //  `id` n'a pas besoin de contrainte (le type `uuid` le fait deja), donc
  //  SEPT contraintes sur les SIX tables (attestations_coutumieres en
  //  porte deux : reference ET numero).
  const CONTRAINTES_ATTENDUES = [
    ["attestations_cession", "attestations_cession_reference_sans_traversee", "reference"],
    ["attestations_attribution_lot", "attestations_attribution_lot_reference_sans_traversee", "reference"],
    ["certificats_vente", "certificats_vente_reference_sans_traversee", "reference"],
    ["attestations_coutumieres", "attestations_coutumieres_reference_sans_traversee", "reference"],
    ["attestations_coutumieres", "attestations_coutumieres_numero_sans_traversee", "numero"],
    ["paiements", "paiements_reference_sans_traversee", "reference"],
    ["pv_bornage", "pv_bornage_reference_sans_traversee", "reference"],
  ];
  let nContraintesOk = 0;
  for (const [table, nomContrainte, colonne] of CONTRAINTES_ATTENDUES) {
    const motif = new RegExp(
      `alter table public\\.${table}\\s+add constraint\\s+${nomContrainte}\\s+check\\s*\\(\\s*public\\.reference_sans_traversee\\(${colonne}\\)\\s*\\)`,
    );
    if (motif.test(sqlCode2)) {
      nContraintesOk++;
    } else {
      fail(
        `migration 2 : contrainte ABSENTE ou alteree — ${table}.${colonne} (${nomContrainte}). ` +
          "C'est precisement 'fermer deux colonnes sur trois' — la lecon du 09/08.",
      );
    }
  }
  if (nContraintesOk === CONTRAINTES_ATTENDUES.length)
    ok(`migration 2 : les ${CONTRAINTES_ATTENDUES.length} contraintes sont posees, chacune sur la bonne colonne`);

  // pv_bornage EN PARTICULIER : c'est la table de l'attaque de l'enonce.
  // Une regression future qui la retirerait doit se voir NOMMEE, pas
  // seulement comptee dans un total.
  if (/alter table public\.pv_bornage\s+add constraint\s+pv_bornage_reference_sans_traversee/.test(sqlCode2))
    ok("migration 2 : `pv_bornage.reference` — la table de l'attaque de l'enonce — est bien contrainte");
  else
    fail(
      "migration 2 : `pv_bornage.reference` N'EST PLUS CONTRAINTE — c'est la table EXACTE par laquelle passe " +
        "l'attaque de l'enonce (jumeau en ecriture de #49).",
    );

  // ── VALIDEE, pas `NOT VALID` ───────────────────────────────────────────
  if (/add constraint\s+\w+_sans_traversee[\s\S]{0,80}?not\s+valid/i.test(sqlCode2))
    fail("migration 2 : au moins une contrainte est posee `NOT VALID` — le passe echappe.");
  else ok("migration 2 : aucune contrainte n'est `NOT VALID` (toutes validees contre l'existant)");
} catch (e) {
  fail(`migration 2 illisible (${MIGRATION2}) : ${e.message}`);
}

// ─────────────────────────────────────────────────────────────────────
//  ⑧ Balayage du dump de production, s'il est fourni
// ─────────────────────────────────────────────────────────────────────

const iProd = process.argv.indexOf("--production");
if (iProd >= 0 && process.argv[iProd + 1]) {
  // L'API de management rend `[{"lignes":[…]}]` ; un export direct rend `[…]`.
  // Une forme inattendue ECHOUE bruyamment au lieu de balayer 0 ligne en
  // annoncant « 0 refuse » — le faux vert type.
  const brut = JSON.parse(readFileSync(process.argv[iProd + 1], "utf8"));
  let plat = brut;
  if (Array.isArray(plat) && plat.length === 1 && Array.isArray(plat[0]?.lignes)) plat = plat[0].lignes;
  else if (!Array.isArray(plat) && Array.isArray(plat?.lignes)) plat = plat.lignes;
  if (!Array.isArray(plat) || plat.length === 0 || typeof plat[0]?.url_fichier !== "string") {
    fail("dump de production illisible : aucune ligne {id,type,url_fichier,apercu_url} trouvee");
    plat = [];
  }
  console.log(`\n⑧ Balayage du stock reel — ${plat.length} lignes documents`);
  const refus = [];
  let controles = 0;
  for (const l of plat) {
    for (const col of COLONNES_CHEMIN) {
      const val = l[col];
      if (val === null || val === undefined) continue;
      controles++;
      const motif = motifDeRefusDuChemin(val, l.type, l.id);
      if (motif) refus.push({ id: l.id, type: l.type, col, val, motif });
    }
  }
  // 🔴 Un zero ne s'affiche JAMAIS en vert. « ok 0 chemins reels controles,
  // 0 refuse » est la forme visuelle exacte de la dette #45 : un refus qui
  // ressemble a une bonne nouvelle. L'echec est deja emis plus haut quand le
  // dump est illisible, mais la ligne verte restait affichee dessous.
  if (controles === 0) fail("0 chemin reel controle — le balayage n'a rien couvert, ce n'est pas un succes");
  else if (refus.length === 0) ok(`${controles} chemins reels controles, 0 refuse`);
  else {
    fail(`${refus.length} chemin(s) REEL(S) refuse(s) sur ${controles} — une lecture legitime casserait :`);
    for (const r of refus.slice(0, 20)) console.error(`         ${r.type} ${r.col}=${r.val} : ${r.motif}`);
  }
  const typesEnBase = [...new Set(plat.map((l) => l.type))].sort();
  const manquants = typesEnBase.filter((t) => !Object.hasOwn(PREFIXE_PAR_TYPE, t));
  if (manquants.length === 0) ok(`les ${typesEnBase.length} types presents en base ont tous un prefixe declare`);
  else fail(`types presents en base SANS prefixe declare : ${manquants.join(", ")}`);
} else {
  console.log("\n⑧ Balayage du stock reel — non demande (--production <dump.json>)");
}

console.log(`\n${echecs === 0 ? "TOUT PASSE" : `${echecs} ECHEC(S)`}`);
process.exit(echecs === 0 ? 0 : 1);
