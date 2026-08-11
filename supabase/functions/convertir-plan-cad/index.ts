// =====================================================================
//  SGFN — Edge Function : CONVERTIR-PLAN-CAD
//  Convertit un plan DXF (deja televerse dans le bucket prive
//  'documents', chemin stocke dans documents.url_fichier) en un apercu
//  SVG via un parseur/moteur de rendu DXF internes (aucun service
//  externe). Remplace l'ancienne integration CloudConvert (DWG->PNG),
//  abandonnee car DWG est un format binaire proprietaire non documente
//  et produisait des apercus blancs sur des fichiers reels.
//  Principe d'acces identique a telecharger-document : verification via
//  le jeton de l'appelant (RLS), puis bascule service_role pour lire/
//  ecrire dans le storage et mettre a jour la ligne.
//
//  🔴 DETTE #49 (10/08/2026) — « identique a telecharger-document »
//  incluait aussi son DEFAUT. Cette fonction telechargeait en service_role
//  le chemin que la LIGNE declare, sans valider aucun prefixe. La garde
//  commune (bloc « GARDE DE CHEMIN » ci-dessous, recopie octet par octet
//  depuis telecharger-document) est desormais appliquee AVANT le
//  telechargement. Voir le commentaire de l'etape 2 pour l'ampleur reelle
//  de ce qui etait ouvert ici, qui n'etait PAS celle de la fuite jumelle.
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

function reponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

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

// ─────────────────────────────────────────────────────────────────────
//  PARSEUR DXF
//  Format ASCII DXF : paires de lignes (code numerique / valeur).
//  On ne traite que la section ENTITIES, et seulement les types
//  d'entites utiles a un apercu 2D de plan (lignes, polylignes,
//  cercles, arcs, textes). Tout type non supporte (INSERT/blocs,
//  HATCH, DIMENSION, SPLINE, ELLIPSE...) est silencieusement ignore
//  (jamais d'exception qui ferait echouer tout le fichier).
// ─────────────────────────────────────────────────────────────────────

type DxfPoint = { x: number; y: number };

type DxfEntity =
  | { kind: "line"; a: DxfPoint; b: DxfPoint }
  | { kind: "circle"; center: DxfPoint; radius: number }
  | { kind: "arc"; center: DxfPoint; radius: number; startAngleDeg: number; endAngleDeg: number }
  | { kind: "polyline"; closed: boolean; vertices: DxfPoint[] }
  | { kind: "text"; position: DxfPoint; height: number; content: string };

type DxfToken = { code: number; value: string };

function tokenizeDxf(text: string): DxfToken[] {
  const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim());
  const tokens: DxfToken[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i], 10);
    const value = lines[i + 1];
    if (Number.isNaN(code) || value === undefined) break;
    tokens.push({ code, value });
  }
  return tokens;
}

function parseDxf(text: string): { entities: DxfEntity[]; skipped: string[] } {
  const tokens = tokenizeDxf(text);
  const entities: DxfEntity[] = [];
  const skipped = new Set<string>();

  let inEntities = false;
  let i = 0;

  function readEntityBlock(): DxfToken[] {
    const group: DxfToken[] = [];
    i++;
    while (i < tokens.length && tokens[i].code !== 0) {
      group.push(tokens[i]);
      i++;
    }
    return group;
  }

  function get(group: DxfToken[], code: number): string | undefined {
    return group.find((g) => g.code === code)?.value;
  }
  function num(group: DxfToken[], code: number, fallback = 0): number {
    const v = get(group, code);
    return v === undefined ? fallback : parseFloat(v);
  }

  while (i < tokens.length) {
    const tok = tokens[i];

    if (tok.code === 0 && tok.value === "SECTION") {
      const nameTok = tokens[i + 1];
      inEntities = !!nameTok && nameTok.code === 2 && nameTok.value === "ENTITIES";
      i += 2;
      continue;
    }
    if (tok.code === 0 && tok.value === "ENDSEC") {
      inEntities = false;
      i++;
      continue;
    }
    if (tok.code === 0 && tok.value === "EOF") break;
    if (!inEntities) {
      i++;
      continue;
    }
    if (tok.code !== 0) {
      i++;
      continue;
    }

    try {
      if (tok.value === "LINE") {
        const g = readEntityBlock();
        entities.push({
          kind: "line",
          a: { x: num(g, 10), y: num(g, 20) },
          b: { x: num(g, 11), y: num(g, 21) },
        });
      } else if (tok.value === "CIRCLE") {
        const g = readEntityBlock();
        entities.push({ kind: "circle", center: { x: num(g, 10), y: num(g, 20) }, radius: num(g, 40) });
      } else if (tok.value === "ARC") {
        const g = readEntityBlock();
        entities.push({
          kind: "arc",
          center: { x: num(g, 10), y: num(g, 20) },
          radius: num(g, 40),
          startAngleDeg: num(g, 50),
          endAngleDeg: num(g, 51),
        });
      } else if (tok.value === "LWPOLYLINE") {
        const g = readEntityBlock();
        const closed = (parseInt(get(g, 70) ?? "0", 10) & 1) === 1;
        // Les sommets sont des groupes 10/20 repetes : un nouveau code 10 demarre un sommet.
        // NB v1 : le bulge (code 42, segments courbes) n'est pas interprete — chaque segment
        // est trace en ligne droite (TODO v2 : fidelite des arcs de polyligne si necessaire).
        const vertices: DxfPoint[] = [];
        let current: DxfPoint | null = null;
        for (const t of g) {
          if (t.code === 10) {
            if (current) vertices.push(current);
            current = { x: parseFloat(t.value), y: 0 };
          } else if (t.code === 20 && current) {
            current.y = parseFloat(t.value);
          }
        }
        if (current) vertices.push(current);
        entities.push({ kind: "polyline", closed, vertices });
      } else if (tok.value === "POLYLINE") {
        // Forme heritee : sommets en sous-entites separees VERTEX...SEQEND.
        const g = readEntityBlock();
        const closed = (parseInt(get(g, 70) ?? "0", 10) & 1) === 1;
        const vertices: DxfPoint[] = [];
        while (i < tokens.length && !(tokens[i].code === 0 && tokens[i].value === "SEQEND")) {
          if (tokens[i].code === 0 && tokens[i].value === "VERTEX") {
            const vg = readEntityBlock();
            vertices.push({ x: num(vg, 10), y: num(vg, 20) });
          } else {
            i++;
          }
        }
        if (i < tokens.length && tokens[i].code === 0 && tokens[i].value === "SEQEND") i++;
        entities.push({ kind: "polyline", closed, vertices });
        continue;
      } else if (tok.value === "TEXT") {
        const g = readEntityBlock();
        entities.push({
          kind: "text",
          position: { x: num(g, 10), y: num(g, 20) },
          height: num(g, 40, 2.5),
          content: get(g, 1) ?? "",
        });
      } else if (tok.value === "MTEXT") {
        const g = readEntityBlock();
        const chunks = g.filter((t) => t.code === 3).map((t) => t.value);
        const finalChunk = get(g, 1) ?? "";
        let content = chunks.join("") + finalChunk;
        // Best-effort : on retire les codes de formatage MTEXT sans les interpreter.
        content = content.replace(/\\P/g, " ").replace(/[{}]/g, "").replace(/\\[A-Za-z][^;]*;/g, "");
        entities.push({ kind: "text", position: { x: num(g, 10), y: num(g, 20) }, height: num(g, 40, 2.5), content });
      } else {
        // Type non supporte en v1 (INSERT/blocs, HATCH, DIMENSION, SPLINE, ELLIPSE...).
        skipped.add(tok.value);
        readEntityBlock();
      }
    } catch (err) {
      // Une entite malformee ne doit jamais faire echouer tout le fichier.
      console.warn("Entite DXF ignoree (erreur de parsing):", tok.value, err);
      skipped.add(`${tok.value}(erreur)`);
      i++;
    }
  }

  return { entities, skipped: Array.from(skipped) };
}

// ─────────────────────────────────────────────────────────────────────
//  RENDU SVG
// ─────────────────────────────────────────────────────────────────────

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function computeBounds(entities: DxfEntity[]): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const feed = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const e of entities) {
    if (e.kind === "line") { feed(e.a.x, e.a.y); feed(e.b.x, e.b.y); }
    else if (e.kind === "circle") { feed(e.center.x - e.radius, e.center.y - e.radius); feed(e.center.x + e.radius, e.center.y + e.radius); }
    else if (e.kind === "arc") { feed(e.center.x - e.radius, e.center.y - e.radius); feed(e.center.x + e.radius, e.center.y + e.radius); }
    else if (e.kind === "polyline") { for (const v of e.vertices) feed(v.x, v.y); }
    else if (e.kind === "text") { feed(e.position.x, e.position.y); }
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  if (maxX - minX < 1e-9) maxX = minX + 100;
  if (maxY - minY < 1e-9) maxY = minY + 100;
  return { minX, minY, maxX, maxY };
}

function makeTransform(bounds: Bounds, paddingRatio = 0.05) {
  const boxW = bounds.maxX - bounds.minX;
  const boxH = bounds.maxY - bounds.minY;
  const pad = Math.max(boxW, boxH) * paddingRatio;
  const paddedMinX = bounds.minX - pad;
  const paddedMinY = bounds.minY - pad;
  const paddedW = boxW + 2 * pad;
  const paddedH = boxH + 2 * pad;
  // DXF : axe Y vers le haut. SVG : axe Y vers le bas -> inversion explicite par point
  // (plutot qu'un <g transform="scale(1,-1)"> global, qui inverserait aussi le texte).
  const worldToSvg = (p: DxfPoint): DxfPoint => ({
    x: p.x - paddedMinX,
    y: paddedH - (p.y - paddedMinY),
  });
  return { worldToSvg, paddedW, paddedH };
}

const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : "0");
const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function renderEntity(
  e: DxfEntity,
  worldToSvg: (p: DxfPoint) => DxfPoint,
  strokeWidth: number,
  strokeColor: string,
): string {
  if (e.kind === "line") {
    const a = worldToSvg(e.a), b = worldToSvg(e.b);
    return `<line x1="${fmt(a.x)}" y1="${fmt(a.y)}" x2="${fmt(b.x)}" y2="${fmt(b.y)}" stroke="${strokeColor}" stroke-width="${fmt(strokeWidth)}" />`;
  }
  if (e.kind === "circle") {
    const c = worldToSvg(e.center);
    return `<circle cx="${fmt(c.x)}" cy="${fmt(c.y)}" r="${fmt(e.radius)}" stroke="${strokeColor}" stroke-width="${fmt(strokeWidth)}" fill="none" />`;
  }
  if (e.kind === "arc") {
    const startRad = (e.startAngleDeg * Math.PI) / 180;
    const endRad = (e.endAngleDeg * Math.PI) / 180;
    const startPtWorld = { x: e.center.x + e.radius * Math.cos(startRad), y: e.center.y + e.radius * Math.sin(startRad) };
    const endPtWorld = { x: e.center.x + e.radius * Math.cos(endRad), y: e.center.y + e.radius * Math.sin(endRad) };
    let sweptDeg = (e.endAngleDeg - e.startAngleDeg) % 360;
    if (sweptDeg < 0) sweptDeg += 360;
    const largeArcFlag = sweptDeg > 180 ? 1 : 0;
    // DXF balaie en sens trigonometrique (CCW). L'inversion Y (miroir) inverse le
    // sens visuel apparent -> sweep-flag force a 0 pour compenser (verifie
    // mathematiquement sur un cas de test avant deploiement).
    const sweepFlag = 0;
    const s = worldToSvg(startPtWorld), en = worldToSvg(endPtWorld);
    return `<path d="M ${fmt(s.x)} ${fmt(s.y)} A ${fmt(e.radius)} ${fmt(e.radius)} 0 ${largeArcFlag} ${sweepFlag} ${fmt(en.x)} ${fmt(en.y)}" stroke="${strokeColor}" stroke-width="${fmt(strokeWidth)}" fill="none" />`;
  }
  if (e.kind === "polyline") {
    if (e.vertices.length === 0) return "";
    const pts = e.vertices.map(worldToSvg);
    let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
    for (let k = 1; k < pts.length; k++) d += ` L ${fmt(pts[k].x)} ${fmt(pts[k].y)}`;
    if (e.closed) d += " Z";
    return `<path d="${d}" stroke="${strokeColor}" stroke-width="${fmt(strokeWidth)}" fill="none" />`;
  }
  if (e.kind === "text") {
    const p = worldToSvg(e.position);
    const size = e.height > 0 ? e.height : 2.5;
    return `<text x="${fmt(p.x)}" y="${fmt(p.y)}" font-size="${fmt(size)}" fill="${strokeColor}">${escapeXml(e.content)}</text>`;
  }
  return "";
}

function renderSvg(entities: DxfEntity[]): string {
  const bounds = computeBounds(entities);
  const { worldToSvg, paddedW, paddedH } = makeTransform(bounds);
  // Epaisseur de trait relative a la taille du dessin : l'unite DXF (m, mm, sans
  // unite...) n'est pas fiable a lire, un trait absolu serait invisible ou enorme
  // selon l'echelle du plan source.
  const strokeWidth = Math.max(paddedW, paddedH) * 0.0025;
  const strokeColor = "#0D3B66";
  const body = entities.map((e) => renderEntity(e, worldToSvg, strokeWidth, strokeColor)).join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(paddedW)} ${fmt(paddedH)}" preserveAspectRatio="xMidYMid meet">\n  <rect x="0" y="0" width="${fmt(paddedW)}" height="${fmt(paddedH)}" fill="#ffffff" />\n  ${body}\n</svg>`;
}

// ─────────────────────────────────────────────────────────────────────
//  HANDLER
// ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return reponse({ ok: false, erreur: "Authentification requise." }, 401);
  }

  let body: { document_id?: string };
  try {
    body = await req.json();
  } catch {
    return reponse({ ok: false, erreur: "Corps de requete invalide." }, 400);
  }

  const documentId = body.document_id ?? "";
  if (!documentId) {
    return reponse({ ok: false, erreur: "Parametre 'document_id' manquant." }, 400);
  }

  // ---- Etape 1 : verification d'acces via le jeton de l'appelant (RLS) ----
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  // 🔴 `type` est RELU DANS LA LIGNE (dette #49) : c'est lui qui determine le
  // prefixe autorise, et il ne doit donc jamais venir du client.
  const { data: docRow, error: docErr } = await callerClient
    .from("documents")
    .select("id, type, url_fichier")
    .eq("id", documentId)
    .maybeSingle();

  if (docErr) {
    console.error("Erreur lecture autorisee:", docErr);
    return reponse({ ok: false, erreur: "Erreur lors de la verification d'acces." }, 500);
  }
  if (!docRow) {
    return reponse({ ok: false, erreur: "Document introuvable ou acces non autorise." }, 403);
  }

  // ---- 🔴 DETTE #49 : LE CHEMIN EST VALIDE AVANT TOUTE LECTURE service_role ----
  //
  // Le defaut est le meme que dans `telecharger-document` — c'est la JUMELLE
  // annoncee par l'enonce (« #49 peut avoir des jumeaux ailleurs »). Ici la
  // ligne est relue sous la RLS de l'appelant, donc le controle d'acces
  // passe : c'est bien SA ligne. Mais l'etape 2 telechargeait ensuite
  // `docRow.url_fichier` TEL QUEL en `service_role`, c'est-a-dire n'importe
  // quel objet du bucket prive que la ligne voulait bien nommer.
  //
  // ⚠️ LA FUITE N'ETAIT PAS DE MEME AMPLEUR, ET LE DIRE HONNETEMENT COMPTE :
  // le contenu telecharge n'est jamais renvoye a l'appelant, il est parse en
  // DXF puis rendu en SVG. Un PDF d'attestation ne produit aucune entite DXF
  // et repart en 422. Ce qui restait ouvert etait donc (a) un ORACLE
  // D'EXISTENCE — 500 « impossible de lire le fichier » contre 422 « aucun
  // element pris en charge » distingue un objet present d'un objet absent,
  // sur des references sequentielles et donc enumerables —, et (b) la lecture
  // effective de tout objet DXF du bucket. La garde ferme les deux.
  //
  // Une seule difference avec `telecharger-document` : ici le type attendu
  // est CONNU, cette fonction ne convertit que des plans CAO. Le refus est
  // donc double : le type doit etre `plan_lot`, et le chemin doit satisfaire
  // la garde commune.
  if (docRow.type !== "plan_lot") {
    console.error(
      `[dette#49] Conversion REFUSEE — document=${docRow.id} type=${docRow.type} : seul 'plan_lot' est convertible.`,
    );
    return reponse({ ok: false, erreur: "Ce document n'est pas un plan convertible." }, 400);
  }
  // Le chemin est fige dans un local AVANT d'etre garde, et c'est CE local
  // qui sera telecharge : garder `docRow.url_fichier` puis telecharger
  // `docRow.url_fichier` laisse deux lectures distinctes d'un objet mutable
  // entre la validation et l'usage. Ici l'objet ne change pas, mais la forme
  // « je valide X et j'ouvre X », littéralement le meme identifiant, est ce
  // que le §② de scripts/e2e-dette-49-chemin-signe.mjs verifie.
  //
  // `?? ""` plutot qu'un test de nullite separe : `url_fichier` est NOT NULL
  // en base, mais le type le rend `string | null` et la garde refuse deja la
  // chaine vide (« chemin vide »). Un `if (!chemin) return` supplementaire
  // serait une seconde garde disant la meme chose — et du code mort dans un
  // fichier de securite finit toujours par etre pris pour une garde active.
  const cheminOriginal = docRow.url_fichier ?? "";
  const motifChemin = motifDeRefusDuChemin(cheminOriginal, docRow.type, docRow.id);
  if (motifChemin) {
    // Motif reel dans les logs, message generique au client : un texte
    // distinct par motif ferait de cette garde un oracle.
    console.error(
      `[dette#49] Chemin REFUSE avant lecture service_role — document=${docRow.id} type=${docRow.type} motif="${motifChemin}" chemin=${JSON.stringify(cheminOriginal)}`,
    );
    return reponse({ ok: false, erreur: "Impossible de lire le fichier original." }, 500);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    // ---- Etape 2 : lecture directe du fichier original (bucket prive, service_role) ----
    const { data: fileBlob, error: downloadErr } = await adminClient
      .storage.from("documents")
      .download(cheminOriginal);

    if (downloadErr || !fileBlob) {
      console.error("Erreur telechargement original:", downloadErr);
      return reponse({ ok: false, erreur: "Impossible de lire le fichier original." }, 500);
    }

    // ---- Etape 3 : parsing DXF (texte ASCII) ----
    const dxfText = await fileBlob.text();
    const { entities, skipped } = parseDxf(dxfText);

    if (skipped.length > 0) {
      console.log(`Plan ${documentId} — types DXF ignores:`, skipped.join(", "));
    }

    if (entities.length === 0) {
      return reponse(
        {
          ok: false,
          erreur: "Aucun element pris en charge n'a ete trouve dans ce plan (blocs/references externes non supportes en v1).",
        },
        422,
      );
    }

    // ---- Etape 4 : rendu SVG ----
    const svgString = renderSvg(entities);

    // ---- Etape 5 : upload de l'apercu ----
    // Le chemin de l'apercu est construit sur `docRow.id` — la valeur RELUE
    // EN BASE — et non sur `documentId`, la chaine du client. Les deux sont
    // egales par construction (`.eq("id", documentId)` a matche), donc ce
    // n'est pas une correction de faille : c'est la meme discipline que
    // celle qu'impose la dette #49 un peu plus haut, appliquee au chemin
    // d'ECRITURE. Aucune chaine du client ne compose un chemin signe ou
    // ecrit en service_role.
    const cheminApercu = `plans-cad/${docRow.id}/apercu.svg`;
    const { error: uploadErr } = await adminClient
      .storage.from("documents")
      .upload(cheminApercu, new TextEncoder().encode(svgString), { contentType: "image/svg+xml", upsert: true });

    if (uploadErr) {
      console.error("Erreur upload apercu:", uploadErr);
      return reponse({ ok: false, erreur: "Echec de l'enregistrement de l'apercu." }, 500);
    }

    // ---- Etape 6 : mise a jour de la ligne documents ----
    const { error: updateErr } = await adminClient
      .from("documents")
      .update({ apercu_url: cheminApercu })
      .eq("id", documentId);

    if (updateErr) {
      console.error("Erreur mise a jour documents.apercu_url:", updateErr);
      return reponse({ ok: false, erreur: "Apercu genere mais non enregistre." }, 500);
    }

    return reponse({ ok: true, apercu_url: cheminApercu });
  } catch (err) {
    console.error("Erreur inattendue conversion plan CAD:", err);
    return reponse({ ok: false, erreur: "Erreur inattendue lors de la conversion." }, 500);
  }
});
