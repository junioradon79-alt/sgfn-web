// =====================================================================
//  SGFN — Edge Function : TELECHARGER-DOCUMENT
//  Telechargement securise d'un document depuis le bucket prive
//  'documents'. Principe :
//    1) On cree un client Supabase avec le JETON DE L'UTILISATEUR
//       (pas service_role) -> les RLS deja en place s'appliquent.
//    2) On essaie de lire la ligne correspondant a la reference/id
//       demandee. Si RLS bloque -> la ligne n'est pas trouvee -> acces refuse.
//    3) 🔴 ON VALIDE LE CHEMIN QUE LA LIGNE DECLARE (dette #49, 10/08/2026).
//    4) Si et seulement si les trois passent, on bascule sur un client
//       service_role UNIQUEMENT pour generer une URL signee temporaire.
//
//  ── 🔴 DETTE #49 — POURQUOI L'ETAPE 3 EXISTE ─────────────────────────
//  Enonce d'origine (§4.3 du document directeur), VERBATIM :
//    « `telecharger-document` signe en `service_role` le chemin que la
//      LIGNE declare, sans valider aucun prefixe. […] `chemin = (variant
//      === 'apercu') ? row.apercu_url : row.url_fichier` — le `variant`
//      est choisi par le client —, puis
//      `adminClient.storage.createSignedUrl(chemin, 120)`. La ligne est
//      relue avec le jeton de l'appelant, donc le controle RLS PASSE :
//      c'est bien SA ligne. Mais le chemin qu'elle declare n'est jamais
//      valide. Consequence generale : qui peut INSERER une ligne dans
//      `documents` peut LIRE n'importe quel objet du bucket prive. »
//
//  Le commentaire de tete disait, jusqu'a aujourd'hui : « Aucune logique
//  d'autorisation n'est dupliquee : les politiques RLS existantes restent
//  la seule source de verite. » C'ETAIT LA FAUTE, ecrite noir sur blanc et
//  relue comme une qualite. La RLS repond a « CETTE LIGNE est-elle a
//  vous ? ». Elle ne repond pas a « ce CHEMIN est-il celui de cette
//  ligne ? » — et c'est cette seconde question que `createSignedUrl` pose
//  en `service_role`, hors de toute RLS. Une donnee ecrite par un
//  utilisateur ne peut pas designer, seule, l'objet qu'un pouvoir
//  d'administration va ouvrir.
//
//  Le correctif du 09/08 (migration 20260809100000) avait ferme ce chemin
//  au niveau des POLICIES, et seulement pour `plan_lot` : quatre clauses
//  sur `documents_geometre_plans_insert`. Cette defense-la est type par
//  type et ne tient pas a l'echelle — la prochaine policy d'ecriture
//  rouvre la faille sans que personne ne relise cette fonction. La garde
//  ci-dessous ferme la TRAVERSEE et la NORMALISATION D'URL pour TOUS les
//  types, y compris ceux qui n'existent pas encore — mais PAS le probleme
//  en entier, et le dire honnetement compte plus que la rassurer :
//
//  ── CE QU'ELLE FERME ──────────────────────────────────────────────
//  Toute remontee `../..`, toute forme de normalisation que le parseur
//  d'URL applique (fragment `#`, requete `?`, encodage `%`), et tout
//  chemin hors du prefixe attendu pour le TYPE que la ligne declare.
//
//  ── CE QU'ELLE NE FERME PAS ───────────────────────────────────────
//  Un chemin syntaxiquement valide, sous le bon prefixe, qui designe
//  l'objet d'un AUTRE enregistrement DU MEME TYPE — sauf pour les types
//  listes dans `DOSSIER_EST_L_ID_DE_LA_LIGNE` (aujourd'hui : `plan_lot`
//  seul, dont le dossier EST l'id de la ligne). Pour tout autre type, un
//  role capable d'INSERER une ligne `documents` avec un `type` et un
//  `url_fichier`/`apercu_url` de son choix (sous le bon prefixe)
//  obtiendrait une URL signee sur l'objet d'un TIERS du meme type.
//
//  ── POURQUOI C'EST SANS CONSEQUENCE AUJOURD'HUI, ET JUSQU'A QUAND ──
//  Aucune policy INSERT non-admin sur `documents` n'ouvre un type libre :
//  le geometre est borne a `plan_lot`, deja scope par dossier=id (la
//  seule entree de `DOSSIER_EST_L_ID_DE_LA_LIGNE`). C'est une PROPRIETE
//  DE L'ETAT ACTUEL DES POLICIES — pas une garantie que cette fonction
//  porte elle-meme. C'est une DETTE RESIDUELLE, documentee au document
//  directeur (§4.3) : a surveiller des qu'une future policy ouvrirait
//  l'ecriture d'un type sans scoper son dossier a l'id de la ligne.
//
//  ⚠️ CETTE GARDE A DEUX JUMELLES :
//     · `supabase/functions/convertir-plan-cad` telecharge
//       `docRow.url_fichier` en `service_role` (etape 2 de son handler)
//       avec exactement le meme defaut, AVANT le `.download()`.
//     · `supabase/functions/generation-document` l'ECRIT (et non le lit)
//       en `service_role`, AVANT l'`.upload()` — le JUMEAU EN ECRITURE de
//       la meme faille (voir son commentaire d'etape « LE JUMEAU EN
//       ECRITURE DE LA DETTE #49 »).
//  Le bloc « GARDE DE CHEMIN » ci-dessous y est recopie A L'IDENTIQUE dans
//  les DEUX. Les trois fonctions sont deployees fichier par fichier
//  (`deploy_edge_function`, un seul `index.ts` chacune), donc un module
//  `_shared/` ne serait pas embarque : la duplication est imposee par la
//  forme du deploiement, pas choisie.
//  `scripts/e2e-dette-49-chemin-signe.mjs` compare les trois exemplaires
//  du bloc (source + deux copies) OCTET PAR OCTET et echoue si l'un
//  d'eux diverge — c'est ce qui remplace le module partage. Le 09/08,
//  une correction « complete » avait oublie la colonne voisine
//  `apercu_url` ; on ne compte plus sur la relecture.
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Content-Type": "application/json",
};

const CONFIG: Record<string, { refColumn: string; ext: string[] }> = {
  attestations_cession:     { refColumn: "reference", ext: ["pdf", "html"] },
  certificats_vente:        { refColumn: "reference", ext: ["pdf", "html"] },
  attestations_coutumieres: { refColumn: "reference", ext: ["pdf", "html"] },
  paiements:                { refColumn: "reference", ext: ["pdf", "html"] },
  pv_bornage:               { refColumn: "reference", ext: ["pdf", "html"] },
};

// ═════════════════════════════════════════════════════════════════════
//  ▼▼▼ GARDE DE CHEMIN (dette #49) — DEBUT DU BLOC RECOPIE ▼▼▼
//  Ce bloc existe A L'IDENTIQUE dans TROIS fichiers :
//     supabase/functions/telecharger-document/index.ts   (source de verite)
//     supabase/functions/convertir-plan-cad/index.ts     (copie, appliquee
//       AVANT le `.download()` du fichier original)
//     supabase/functions/generation-document/index.ts    (copie EN
//       ECRITURE, appliquee AVANT l'`.upload()` plutot qu'avant une
//       lecture)
//  Les trois fonctions se deploient fichier par fichier (un seul index.ts
//  chacune), donc un module `_shared/` ne serait pas embarque : la
//  duplication est imposee par la forme du deploiement, pas choisie.
//  ⚠️ NE PAS EDITER LES COPIES A LA MAIN. Modifier la SOURCE
//  (telecharger-document), puis relancer
//  scripts/e2e-dette-49-chemin-signe.mjs --synchroniser, qui recopie le
//  bloc octet par octet vers les deux copies. Sans argument, ce meme
//  script ECHOUE si l'une des copies diverge — c'est ce qui remplace le
//  module partage.
// ═════════════════════════════════════════════════════════════════════

/**
 * Prefixe de stockage attendu pour chaque `documents.type`.
 *
 * ── D'OU VIENNENT CES VALEURS ────────────────────────────────────────
 * Elles ne sont pas devinees : elles sont MESUREES en production le
 * 10/08/2026 (179 lignes `documents`, 134 objets du bucket) et
 * recoupees avec le code qui les ecrit. Chaque type observe porte UN
 * SEUL prefixe, sur 100 % de ses lignes :
 *
 *   type_document                    | prefixe                      | lignes
 *   ---------------------------------|------------------------------|-------
 *   attestation_cession              | attestations_cession/        |   158
 *   quittance                        | paiements/                   |    10
 *   certificat_propriete_coutumiere  | attestations_coutumieres/    |     6
 *   certificat_vente                 | certificats_vente/           |     2
 *   plan_lot                         | plans-cad/                   |     2
 *   pv_bornage                       | pv_bornage/                  |     1
 *
 * Les deux dernieres entrees de la table ci-dessous n'ont AUCUNE ligne
 * en production, elles sont donc lues dans le code qui les produirait :
 *   · `attestation_attribution` — `generation-document` construit
 *     `${table}/${reference}.${ext}` a partir de la cle CONFIG
 *     `attestations_attribution_lot` (index.ts:813). 0 ligne aujourd'hui
 *     parce que la table `attestations_attribution_lot` est vide.
 *   · `plan_lotissement` — `src/features/lotissements/services/
 *     plans.service.ts:114` (`cheminStockage`) ecrit
 *     `plans-lotissement/<lotissementId>/<documentId>.<ext>`.
 * Les omettre aurait casse ces deux ecrans le jour de leur premier
 * usage, sans qu'aucune mesure ne le signale — c'est exactement le
 * genre de faux vert que ce depot paie a repetition.
 *
 * ── FAIL-CLOSED, ET CE QUE CA COUTE ──────────────────────────────────
 * Les 13 autres valeurs de l'enum `type_document` (`apfc`,
 * `piece_identite`, `acte_vente`, `acd`, `titre_foncier`, `autre`,
 * `pv_constatation`, `attestation_non_contestation`,
 * `plan_localisation`, `certificat_residence`, `demande_adu`, `adu`,
 * `pv_reunion_famille`) ne sont PAS ici : elles portent 0 ligne en
 * production et aucun code du depot n'en ecrit. Une ligne de l'un de
 * ces types sera donc REFUSEE au telechargement. Cout mesure : ZERO
 * ligne existante. Le jour ou l'un de ces types sera utilise, il faudra
 * ajouter son prefixe ICI — et l'ecran le dira aussitot (404 + motif
 * complet dans les logs de la fonction), au lieu de laisser un chemin
 * libre etre signe en service_role.
 */
const PREFIXE_PAR_TYPE: Record<string, string> = {
  attestation_cession:             "attestations_cession",
  attestation_attribution:         "attestations_attribution_lot",
  certificat_vente:                "certificats_vente",
  certificat_propriete_coutumiere: "attestations_coutumieres",
  quittance:                       "paiements",
  pv_bornage:                      "pv_bornage",
  plan_lot:                        "plans-cad",
  plan_lotissement:                "plans-lotissement",
};

/**
 * Types dont le second segment de chemin est l'ID DE LA LIGNE elle-meme.
 *
 * `plan_lot` est le seul : la convention est
 * `plans-cad/<id du document>/original.<ext>` et l'apercu se range a
 * cote (`plans-cad/<id>/apercu.png`). C'est aussi ce qu'impose deja le
 * `with check` de `documents_geometre_plans_insert` depuis le 09/08
 * (`url_fichier like 'plans-cad/' || id::text || '/%'`) — la fonction
 * cesse ici d'etre plus permissive que la policy.
 *
 * ⚠️ `plan_lotissement` N'EST PAS dans cette liste, et ce n'est pas un
 * oubli : son second segment est le `lotissement_id`, pas le
 * `document_id` (`plans-lotissement/<lotissementId>/<documentId>.<ext>`).
 * Plusieurs plans partagent donc un dossier. Y appliquer la meme regle
 * aurait refuse 100 % des depots de lotissement.
 */
const DOSSIER_EST_L_ID_DE_LA_LIGNE: Record<string, true> = {
  plan_lot: true,
};

/**
 * Refuse tout chemin qui n'est pas EXACTEMENT celui qu'une ligne de ce
 * type a le droit de designer. Rend le MOTIF REEL (destine aux logs
 * serveur, jamais au client) ou `null` si le chemin est acceptable.
 *
 * ── POURQUOI LES GARDES PORTENT SUR LA CHAINE BRUTE ──────────────────
 * `createSignedUrl(chemin)` de supabase-js concatene le chemin dans une
 * URL puis appelle `fetch`. Le parseur d'URL (WHATWG) NORMALISE ce qu'il
 * recoit AVANT l'envoi, et il le fait sur trois formes distinctes :
 *   · `a/b/../../x`   -> `x`         (segment « double-dot »)
 *   · `a/b/%2e%2e/x`  -> `a/x`       le spec traite `%2e`, `.%2e`, `%2e.`
 *                                     et `%2e%2e` comme des points, en
 *                                     ignorant la casse — d'ou
 *                                     l'interdiction du caractere `%`
 *   · `a\..\x`        -> `a/../x`    l'antislash vaut slash pour les
 *                                     schemas speciaux (http/https)
 * Une garde posee APRES normalisation ne verrait plus rien. Une garde
 * de prefixe seule (`startsWith('plans-cad/')`) est satisfaite par
 * `plans-cad/<id>/../../attestations_cession/ATT-CESS-2026-00846.pdf`
 * et ne protege donc rien.
 *
 * ── 🔴 ET C'EST POURQUOI LA LISTE NOIRE NE DECIDE PLUS ────────────────
 * La premiere redaction de cette garde s'arretait a une liste de
 * caracteres bannis (`..`, `\`, `%`). Un verificateur tiers l'a
 * DEBORDEE en une ligne, le 10/08 :
 *     attestations_cession/ATT-CESS-2026-00846.pdf#zzz
 * Aucun caractere banni, prefixe conforme, dossier conforme — ACCEPTE.
 * Et l'objet reellement ouvert par `createSignedUrl` etait
 * `attestations_cession/ATT-CESS-2026-00846.pdf`, le `#` ouvrant un
 * FRAGMENT que le parseur d'URL retire du chemin. La garde validait A
 * pendant que l'administration ouvrait B — la forme EXACTE du defaut
 * que la dette #49 est censee fermer, reintroduite par le correctif
 * lui-meme. Le confinement au dossier la rendait inexploitable ce
 * jour-la ; ce n'est pas une raison de la laisser.
 *
 * Une liste noire se fait deborder : il faut connaitre a l'avance tous
 * les caracteres que le parseur traite a part (`#`, `?`, et ce que la
 * prochaine version du spec ajoutera). Une EGALITE, non. Le controle
 * qui decide est donc devenu :
 *     new URL(RACINE + chemin).pathname  ===  <racine> + chemin
 * — « l'URL que fetch construira designe EXACTEMENT le chemin que j'ai
 * valide, caractere pour caractere ». Tout ce que la normalisation
 * retire, ajoute, deplace ou reencode fait echouer l'egalite, qu'on ait
 * su le nommer ou pas.
 *
 * Les bannissements explicites sont CONSERVES en defense
 * supplementaire : ils sont redondants avec l'egalite pour `..`, `\`,
 * `%`, `#` et `?`, mais ils rendent un motif de log qui NOMME la cause,
 * et ils couvrent `//` que la normalisation d'URL laisse passer.
 * Cout mesure : 0 des 180 chemins reels de production n'en declenche un.
 */
/**
 * Racine sous laquelle supabase-js compose le chemin avant de le confier
 * a `fetch`. Le HOTE n'a aucune importance — seule compte la
 * TRANSFORMATION que le parseur d'URL applique au chemin. On modelise
 * donc la construction reelle
 * (`${url}/object/sign/${bucket}/${chemin}`), avec un hote inexistant
 * par construction : rien n'est jamais appele ici.
 */
const RACINE_SIGNATURE = "https://storage.invalid/storage/v1/object/sign/documents/";
const CHEMIN_RACINE_SIGNATURE = "/storage/v1/object/sign/documents/";

function motifDeRefusDuChemin(
  chemin: unknown,
  typeLigne: unknown,
  idLigne: unknown,
): string | null {
  // 1. Le TYPE d'abord — il est relu dans la ligne, jamais recu du client.
  if (typeof typeLigne !== "string" || typeLigne === "") {
    return "type absent de la ligne";
  }
  // `Object.hasOwn` et non un simple acces : `PREFIXE_PAR_TYPE['constructor']`
  // rend une valeur truthy heritee du prototype, ce qui produirait un motif de
  // log absurde. Le type venant d'un enum PostgreSQL, le cas est inatteignable
  // — il coute deux mots, on ne laisse pas un piege dormir pour si peu.
  if (!Object.hasOwn(PREFIXE_PAR_TYPE, typeLigne)) {
    return `type '${typeLigne}' sans prefixe declare — refus fail-closed`;
  }
  const prefixe = PREFIXE_PAR_TYPE[typeLigne];

  // 2. La forme brute de la chaine.
  //    Les motifs NOMMENT la cause reelle : ils ne servent qu'a
  //    l'investigation cote serveur, et un motif faux y coute une heure.
  if (typeof chemin !== "string") return `chemin absent ou non-chaine (${typeof chemin})`;
  if (chemin === "") return "chemin vide";
  if (chemin.length > 512) return `chemin trop long (${chemin.length})`;
  for (let i = 0; i < chemin.length; i++) {
    const code = chemin.charCodeAt(i);
    if (code < 32 || code === 127) return "caractere de controle";
  }
  // Le test de schema passe AVANT celui du double slash : sans cela
  // `https://exemple.test/x` etait refuse au motif « segment vide », ce qui
  // envoie l'enqueteur dans le mur.
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(chemin)) return "URL absolue (schema present)";
  if (chemin.includes("..")) return "remontee '..' dans le chemin";
  if (chemin.includes("\\")) return "antislash (vaut slash apres parsing d'URL)";
  if (chemin.includes("%")) return "caractere '%' (traversee possible par encodage)";
  if (chemin.includes("#")) return "fragment '#' (tronque le chemin apres parsing d'URL)";
  if (chemin.includes("?")) return "requete '?' (tronque le chemin apres parsing d'URL)";
  if (chemin.startsWith("/")) return "slash initial (chemin absolu de bucket)";
  if (chemin.includes("//")) return "segment vide";
  if (chemin.endsWith("/")) return "chemin terminant par un slash";

  // 3. 🔴 LE CONTROLE QUI DECIDE — egalite, et non liste noire.
  //    « L'URL que fetch construira designe-t-elle EXACTEMENT le chemin que
  //    je m'apprete a valider ? » Tout ce que la normalisation retire
  //    (fragment, requete, segments de points), ajoute, deplace ou reencode
  //    fait echouer cette egalite — y compris ce que personne n'a su nommer
  //    au moment d'ecrire les lignes ci-dessus.
  let url: URL;
  try {
    url = new URL(RACINE_SIGNATURE + chemin);
  } catch {
    return "chemin non representable dans une URL";
  }
  if (url.pathname !== CHEMIN_RACINE_SIGNATURE + chemin || url.search !== "" || url.hash !== "") {
    return (
      `chemin altere par la normalisation d'URL — valide ${JSON.stringify(chemin)}, ` +
      `mais l'objet ouvert serait ${JSON.stringify(url.pathname.slice(CHEMIN_RACINE_SIGNATURE.length))}`
    );
  }

  // 4. Le prefixe attendu POUR CE TYPE.
  const segments = chemin.split("/");
  if (segments.length < 2) return "chemin sans dossier";
  if (segments[0] !== prefixe) {
    return `prefixe '${segments[0]}' hors convention — '${prefixe}' attendu pour le type '${typeLigne}'`;
  }
  if (segments.some((s) => s === "" || s === ".")) return "segment vide ou '.'";

  // 5. Pour les types ranges par document : le dossier est SON id.
  if (Object.hasOwn(DOSSIER_EST_L_ID_DE_LA_LIGNE, typeLigne)) {
    if (typeof idLigne !== "string" || idLigne === "") {
      return `id de ligne absent, requis pour le type '${typeLigne}'`;
    }
    if (segments[1] !== idLigne) {
      return `dossier '${segments[1]}' != id de la ligne '${idLigne}' (type '${typeLigne}')`;
    }
  }

  return null;
}

// ═════════════════════════════════════════════════════════════════════
//  ▲▲▲ GARDE DE CHEMIN — FIN DU BLOC RECOPIE ▲▲▲
// ═════════════════════════════════════════════════════════════════════

/**
 * Reference utilisable comme NOM DE FICHIER dans un chemin construit par
 * la fonction elle-meme (`${table}/${reference}.${ext}`).
 *
 * Ici la reference vient du CLIENT. Elle est certes confrontee a la base
 * (`.eq(refColumn, reference)`) et doit donc exister ET etre lisible sous
 * RLS — mais cela ne dit rien de sa FORME : rien n'interdit en base
 * qu'une reference contienne un `/` ou un `..`, et la chaine part
 * ensuite dans un chemin de stockage. Le charset est donc borne.
 * Mesure du 10/08 : 107 references reelles (attestations_cession = 106,
 * attestations_coutumieres = 1), 0 hors de ce motif.
 *
 * ⚠️ CE BLOC EST HORS DU BLOC RECOPIE, ET C'EST DELIBERE. Il n'a de sens
 * que pour la branche `table`+`reference` de CETTE fonction, ou le chemin
 * est CONSTRUIT ; `convertir-plan-cad` ne construit rien de tel. Le
 * mettre dans la partie partagee y laissait un symbole importe et jamais
 * utilise — un warning de lint releve par le verificateur le 10/08, et
 * surtout du code mort dans un fichier de securite, ou tout ce qui traine
 * finit par etre pris pour une garde active.
 */
const REFERENCE_SURE = /^[A-Za-z0-9._-]{1,128}$/;

function motifDeRefusDeLaReference(reference: string): string | null {
  if (!REFERENCE_SURE.test(reference)) return "reference hors charset [A-Za-z0-9._-]{1,128}";
  if (reference.includes("..")) return "reference contenant '..'";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ erreur: "Authentification requise." }), { status: 401, headers: cors });
  }

  let body: { table?: string; reference?: string; variant?: "original" | "apercu" };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ erreur: "Corps de requete invalide." }), { status: 400, headers: cors });
  }

  const table = body.table ?? "";
  const reference = body.reference ?? "";

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ---- Cas particulier : table "documents" generique (id, chemin deja connu dans la ligne) ----
  if (table === "documents") {
    if (!reference) {
      return new Response(JSON.stringify({ erreur: "Parametre 'reference' (id) manquant." }), { status: 400, headers: cors });
    }
    const variant = body.variant === "apercu" ? "apercu" : "original";

    // 🔴 `type` et `id` sont RELUS DANS LA LIGNE. Le client ne transmet que
    // l'identifiant et le `variant` ; le type qui determine le prefixe
    // autorise ne peut donc pas etre annonce par lui.
    const { data: row, error: rowErr } = await callerClient
      .from("documents")
      .select("id, type, url_fichier, apercu_url")
      .eq("id", reference)
      .maybeSingle();

    if (rowErr) {
      console.error("Erreur lecture autorisee (documents):", rowErr);
      return new Response(JSON.stringify({ erreur: "Erreur lors de la verification d'acces." }), { status: 500, headers: cors });
    }
    if (!row) {
      return new Response(JSON.stringify({ erreur: "Document introuvable ou acces non autorise." }), { status: 403, headers: cors });
    }

    const chemin = variant === "apercu" ? row.apercu_url : row.url_fichier;
    if (!chemin) {
      return new Response(JSON.stringify({ erreur: "Aucun fichier disponible pour cette variante." }), { status: 404, headers: cors });
    }

    // ---- 🔴 DETTE #49 : LE CHEMIN EST VALIDE AVANT D'ETRE SIGNE ----
    // Les deux colonnes passent par la MEME garde. C'est le point precis
    // ou la correction du 09/08 avait echoue une premiere fois : elle ne
    // couvrait que `url_fichier`, alors que `variant` — choisi par le
    // client — permet de faire signer `apercu_url`.
    const motif = motifDeRefusDuChemin(chemin, row.type, row.id);
    if (motif) {
      // Le motif REEL part dans les logs de la fonction ; le client, lui,
      // recoit EXACTEMENT la reponse d'un fichier absent (meme statut,
      // meme texte, ci-dessous). Un message distinct ferait de cette
      // garde un oracle : « ce chemin existe mais n'est pas le votre ».
      console.error(
        `[dette#49] Chemin REFUSE avant signature — document=${row.id} type=${row.type} variant=${variant} motif="${motif}" chemin=${JSON.stringify(chemin)}`,
      );
      return new Response(JSON.stringify({ erreur: "Le fichier n'a pas pu etre recupere." }), { status: 404, headers: cors });
    }

    const { data: signed, error: signErr } = await adminClient
      .storage.from("documents")
      .createSignedUrl(chemin, 120);

    if (signErr || !signed?.signedUrl) {
      console.error("Erreur signature URL (documents):", signErr);
      return new Response(JSON.stringify({ erreur: "Le fichier n'a pas pu etre recupere." }), { status: 404, headers: cors });
    }

    return new Response(JSON.stringify({ url: signed.signedUrl, expiresIn: 120 }), { headers: cors });
  }

  // ---- Cas standard : tables avec reference + extensions a essayer ----
  const cfg = CONFIG[table];
  if (!cfg || !reference) {
    return new Response(JSON.stringify({ erreur: "Parametres 'table' ou 'reference' manquants/invalides." }), { status: 400, headers: cors });
  }

  // Ici le chemin n'est PAS lu dans une ligne : il est CONSTRUIT par la
  // fonction, `${table}/${reference}.${ext}`. `table` est deja borne par
  // les cles de CONFIG (allowlist). La `reference`, elle, vient du client
  // et se retrouve telle quelle dans le chemin : elle est bornee ici.
  const motifRef = motifDeRefusDeLaReference(reference);
  if (motifRef) {
    console.error(`[dette#49] Reference REFUSEE — table=${table} motif="${motifRef}" reference=${JSON.stringify(reference)}`);
    return new Response(JSON.stringify({ erreur: "Parametres 'table' ou 'reference' manquants/invalides." }), { status: 400, headers: cors });
  }

  const { data: row, error: rowErr } = await callerClient
    .from(table)
    .select(cfg.refColumn)
    .eq(cfg.refColumn, reference)
    .maybeSingle();

  if (rowErr) {
    console.error("Erreur lecture autorisee:", rowErr);
    return new Response(JSON.stringify({ erreur: "Erreur lors de la verification d'acces." }), { status: 500, headers: cors });
  }
  if (!row) {
    return new Response(JSON.stringify({ erreur: "Document introuvable ou acces non autorise." }), { status: 403, headers: cors });
  }

  for (const ext of cfg.ext) {
    const chemin = `${table}/${reference}.${ext}`;
    const { data: signed, error: signErr } = await adminClient
      .storage.from("documents")
      .createSignedUrl(chemin, 120);

    if (!signErr && signed?.signedUrl) {
      return new Response(JSON.stringify({
        url: signed.signedUrl,
        format: ext,
        expiresIn: 120,
        reference,
      }), { headers: cors });
    }
  }

  return new Response(JSON.stringify({ erreur: "Le fichier n'a pas encore ete genere pour ce document." }), { status: 404, headers: cors });
});
