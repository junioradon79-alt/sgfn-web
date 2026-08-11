// =====================================================================
//  SGNF — Edge Function : GENERATION-DOCUMENT  (v35 : gabarit reel Attestation d'Attribution de Lot — chef de village + arrete de nomination, admin temporaire de creation du template PDFMonkey)
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import QRCode from "npm:qrcode";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const PDFMONKEY_API_KEY = Deno.env.get("PDFMONKEY_API_KEY");
const GOTENBERG_URL  = Deno.env.get("GOTENBERG_URL");
const GOTENBERG_USER = Deno.env.get("GOTENBERG_USER");
const GOTENBERG_PASS = Deno.env.get("GOTENBERG_PASS");
const PUBLIC_VERIFY_BASE = Deno.env.get("PUBLIC_VERIFY_BASE");
const HOOK_SECRET    = Deno.env.get("HOOK_SECRET");

const CONFIG: Record<string, { titre: string; type_doc: string; template: string; pdfmonkeyEnv: string; pdfmonkeyTemplateIdDefault?: string; flipStatutDelivree: boolean; brandColor?: string }> = {
  attestations_cession:     { titre: "ATTESTATION DE CESSION",                       type_doc: "attestation_cession",            template: "attestation_cession.html", pdfmonkeyEnv: "PDFMONKEY_TEMPLATE_ID_ATTESTATION_CESSION", flipStatutDelivree: false, brandColor: "#20406B" },
  // Document unique par lot (Niveau 2/3, 23/07/2026) : mis a jour en place a
  // chaque transfert -> ce meme handler regenere le PDF sur INSERT (1re fois)
  // ET sur UPDATE (transitions Niveau 3, appelees explicitement par
  // _maj_attribution_lot_niveau3()/revoquer_attestation_attribution_lot()).
  // pdfmonkeyTemplateIdDefault : template "ATTESTATION_ATTRIBUTION_LOT" créé via l'API PDFMonkey le
  // 24/07/2026 (même patron que QUITTANCE le 03/07) — pas de secret PDFMONKEY_TEMPLATE_ID_ATTESTATION_ATTRIBUTION posé.
  attestations_attribution_lot: { titre: "ATTESTATION D'ATTRIBUTION DE LOT",         type_doc: "attestation_attribution",         template: "attestation_attribution_lot.html", pdfmonkeyEnv: "PDFMONKEY_TEMPLATE_ID_ATTESTATION_ATTRIBUTION", pdfmonkeyTemplateIdDefault: "a5376606-e3c3-49b2-99af-84368933ac40", flipStatutDelivree: false, brandColor: "#F77F00" },
  certificats_vente:        { titre: "CERTIFICAT DE VENTE",                          type_doc: "certificat_vente",               template: "certificat_vente.html",     pdfmonkeyEnv: "PDFMONKEY_TEMPLATE_ID_CERTIFICAT_VENTE", flipStatutDelivree: true, brandColor: "#0E6B57" },
  attestations_coutumieres: { titre: "ATTESTATION DE PROPRIETE FONCIERE COUTUMIERE", type_doc: "certificat_propriete_coutumiere", template: "apfc.html",               pdfmonkeyEnv: "PDFMONKEY_TEMPLATE_ID_APFC", flipStatutDelivree: true, brandColor: "#9C362A" },
  // pdfmonkeyTemplateIdDefault : template "QUITTANCE" créé via l'API PDFMonkey le 03/07/2026 (pas de secret
  // PDFMONKEY_TEMPLATE_ID_QUITTANCE posé) — un secret du même nom, s'il est ajouté plus tard, prend le dessus.
  paiements:                { titre: "QUITTANCE DE PAIEMENT",                       type_doc: "quittance",                      template: "quittance.html",           pdfmonkeyEnv: "PDFMONKEY_TEMPLATE_ID_QUITTANCE", pdfmonkeyTemplateIdDefault: "ea7baf50-0341-4ccb-be53-4e2701b7e87d", flipStatutDelivree: false },
  // Pas de gabarit PDFMonkey configure pour l'instant -> repli HTML/Gotenberg (cf. QUITTANCE_GABARIT/PV_BORNAGE_GABARIT).
  pv_bornage:                { titre: "PROCES-VERBAL DE BORNAGE",                    type_doc: "pv_bornage",                     template: "pv_bornage.html",          pdfmonkeyEnv: "PDFMONKEY_TEMPLATE_ID_PV_BORNAGE", flipStatutDelivree: false },
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

const TYPE_PAIEMENT_LABELS: Record<string, string> = {
  attestation_cession: "Attestation de cession",
  honoraires: "Honoraires geometre",
  vente_terrain: "Vente terrain",
  autre: "Paiement SGNF",
};
const MOYEN_LABELS: Record<string, string> = {
  wave: "Wave", orange_money: "Orange Money", mtn_money: "MTN Money", moov_money: "Moov Money",
  virement: "Virement bancaire", especes: "Especes", autre: "Autre",
};
const TYPE_MISSION_LABELS: Record<string, string> = {
  bornage: "Bornage", morcellement: "Morcellement", implantation: "Implantation",
  expertise_judiciaire: "Expertise judiciaire", leve_topographique: "Leve topographique",
  immatriculation: "Immatriculation", copropriete: "Copropriete", autre: "Autre",
};

const MOIS = ["Janvier","Fevrier","Mars","Avril","Mai","Juin","Juillet","Aout","Septembre","Octobre","Novembre","Decembre"];
function dateFr(d?: string): string {
  const dt = d ? new Date(d) : new Date();
  return `${dt.getDate()} ${MOIS[dt.getMonth()]} ${dt.getFullYear()}`;
}
function montantFr(n?: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}
function superficieFr(n?: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(n) + " m²";
}

async function chargerGabarit(nom: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from("templates").download(nom);
    if (data) return await data.text();
  } catch (_) {}
  return null;
}

async function chargerAttributaire(id: string) {
  const { data: att } = await supabase.from("attributaires")
    .select("nom,piece_nature,piece_num,telephone,email").eq("id", id).single();
  return {
    nom: att?.nom ?? "—",
    type_piece: att?.piece_nature ?? "—",
    num_piece: att?.piece_num ?? "—",
    contacts: [att?.telephone, att?.email].filter(Boolean).join(" / ") || "—",
  };
}

/**
 * Chef de l'autorité coutumière EN FONCTION À LA DATE DU DOCUMENT.
 *
 * 🔴 On lisait `autorites_coutumieres.chef`, qui porte le chef COURANT. Un acte
 * régénéré après une succession changeait donc de signataire — l'APFC de
 * Koelea-Accor, délivrée en 2022, sortait au nom du chef nommé en 2023. Corrigé
 * côté base le 29/07 pour la vérification QR ; c'est le même défaut ici, et le
 * PDF est la pièce que les gens gardent.
 *
 * `p_date` à null → chef courant, ce qu'il faut pour un document qu'on émet
 * aujourd'hui. Aucune période connue → « — » plutôt qu'un nom faux.
 */
async function chargerChefALaDate(autoriteId: string, dateDocument?: string | null) {
  const { data } = await supabase.rpc("chef_autorite_a_la_date", {
    p_autorite: autoriteId,
    p_date: dateDocument ?? null,
  });
  const c: any = Array.isArray(data) ? data[0] : data;
  return {
    chef: c?.nom ?? "—",
    numero_arrete_nomination: c?.numero_arrete_nomination ?? "—",
    date_arrete_nomination: c?.date_arrete ? dateFr(c.date_arrete) : "—",
  };
}

async function chargerLot(id: string) {
  const { data: lot } = await supabase.from("lots")
    .select("numero_lot, superficie_m2, ilots(numero, lotissements(nom, village, commune))").eq("id", id).single();
  const il: any = (lot as any)?.ilots; const lo: any = il?.lotissements;
  return {
    lot: lot?.numero_lot ?? "—", ilot: il?.numero ?? "—",
    lotissement: lo?.nom ?? "—", village: lo?.village ?? "—", commune: lo?.commune ?? "—",
    superficie_enregistree: superficieFr(lot?.superficie_m2 ?? null),
  };
}

async function chargerDonnees(table: string, rec: any): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    if (table === "attestations_cession") {
      if (rec.acquereur_id) Object.assign(out, await chargerAttributaire(rec.acquereur_id));
      if (rec.lot_id) Object.assign(out, await chargerLot(rec.lot_id));
      // type_signature : "principal" (1er ayant-droit, gratuite, sans cession_id) -> 2 signatures
      //                  "tiers" (transmission/vente liee a une cession reelle) -> 1 signature (S/Chef seul)
      out.type_signature = rec.cession_id ? "tiers" : "principal";
    }

    if (table === "attestations_attribution_lot") {
      if (rec.titulaire_attributaire_id) Object.assign(out, await chargerAttributaire(rec.titulaire_attributaire_id));
      if (rec.lot_id) Object.assign(out, await chargerLot(rec.lot_id));
      out.niveau = rec.niveau != null ? String(rec.niveau) : "—";
      out.gratuite = rec.gratuite ? "Oui" : "Non";
      out.nom_identifie_physique = rec.nom_identifie_physique ?? "—";
      // Chef de village + arrete de nomination -- l'attestation est signee
      // par la chefferie du lotissement, pas par le titulaire : ces infos
      // viennent de autorites_coutumieres via lots -> ilots -> lotissements,
      // pas d'une colonne directe sur attestations_attribution_lot.
      out.chef_village = "—"; out.numero_arrete_nomination = "—"; out.date_arrete_nomination = "—";
      if (rec.lot_id) {
        const { data: lotAc } = await supabase.from("lots")
          .select("ilots(lotissements(autorite_coutumiere_id))").eq("id", rec.lot_id).single();
        const autoriteId = (lotAc as any)?.ilots?.lotissements?.autorite_coutumiere_id;
        if (autoriteId) {
          // Resolu par la date d'emission : identique au chef courant pour une
          // attestation emise aujourd'hui, exact si on la regenere apres une
          // succession.
          const chef = await chargerChefALaDate(autoriteId, rec.date_emission);
          out.chef_village = chef.chef;
          out.numero_arrete_nomination = chef.numero_arrete_nomination;
          out.date_arrete_nomination = chef.date_arrete_nomination;
        }
      }
    }

    if (table === "certificats_vente") {
      if (rec.acquereur_id) Object.assign(out, await chargerAttributaire(rec.acquereur_id));
      if (rec.lot_id) Object.assign(out, await chargerLot(rec.lot_id));
      if (rec.vente_id) {
        const { data: v } = await supabase.from("ventes")
          .select("prix_total,type_vente,date_vente,nb_echeances,montant_paye,solde,vendeur_operateur_id,vendeur_famille_id")
          .eq("id", rec.vente_id).single();
        if (v) {
          out.prix_total = montantFr(v.prix_total);
          out.montant_paye = montantFr(v.montant_paye);
          out.solde = montantFr(v.solde);
          out.type_vente = v.type_vente ?? "—";
          out.nb_echeances = v.nb_echeances != null ? String(v.nb_echeances) : "—";
          out.date_vente = v.date_vente ? dateFr(v.date_vente) : "—";
          if (v.vendeur_operateur_id) {
            const { data: op } = await supabase.from("operateurs").select("nom").eq("id", v.vendeur_operateur_id).single();
            out.vendeur = op?.nom ?? "—";
          } else if (v.vendeur_famille_id) {
            const { data: fam } = await supabase.from("familles").select("nom").eq("id", v.vendeur_famille_id).single();
            out.vendeur = fam?.nom ?? "—";
          } else out.vendeur = "—";
        }
      }
    }

    if (table === "attestations_coutumieres") {
      if (rec.lotissement_id) {
        const { data: lo } = await supabase.from("lotissements")
          .select("nom,village,commune,district,superficie_texte,nb_ilots,nb_lots").eq("id", rec.lotissement_id).single();
        out.lotissement = lo?.nom ?? "—"; out.village = lo?.village ?? "—";
        out.commune = lo?.commune ?? "—"; out.district = lo?.district ?? "—";
        out.superficie = lo?.superficie_texte ?? "—";
        out.nb_ilots = lo?.nb_ilots != null ? String(lo.nb_ilots) : "—";
        out.nb_lots = lo?.nb_lots != null ? String(lo.nb_lots) : "—";
      }
      if (rec.famille_id) {
        const { data: fam } = await supabase.from("familles").select("nom,chef_de_famille,lignee:lignee_id(nom)").eq("id", rec.famille_id).single();
        out.famille = fam?.nom ?? "—"; out.lignee = fam?.lignee?.nom ?? "—";
        out.chef_de_famille = rec.chef_de_famille ?? fam?.chef_de_famille ?? "—";
      } else {
        out.chef_de_famille = rec.chef_de_famille ?? "—";
      }
      if (rec.autorite_coutumiere_id) {
        const { data: ac } = await supabase.from("autorites_coutumieres").select("nom,type").eq("id", rec.autorite_coutumiere_id).single();
        out.autorite_coutumiere = ac?.nom ?? "—"; out.autorite_type = ac?.type ?? "—";
        // Le signataire de l'APFC est le chef en fonction a sa delivrance, pas
        // celui d'aujourd'hui : APFC-EBIMPE-2022-001 sortait au nom du chef
        // nomme en mai 2023.
        out.autorite_chef = (await chargerChefALaDate(rec.autorite_coutumiere_id, rec.date_delivrance)).chef;
      }
      if (rec.cvgfr_id) {
        const { data: cv } = await supabase.from("cvgfr").select("president").eq("id", rec.cvgfr_id).single();
        out.cvgfr_president = cv?.president ?? "—";
      }
      out.non_contestation = rec.non_contestation ? "Oui" : "Non";
    }

    if (table === "paiements") {
      out.type_paiement = TYPE_PAIEMENT_LABELS[rec.type] ?? rec.type ?? "—";
      out.montant_total = montantFr(rec.montant_total);
      out.commission_sgfn = montantFr(rec.commission_sgfn);
      out.montant_reverse = rec.montant_reverse != null ? montantFr(rec.montant_reverse) : "—";
      out.beneficiaire = rec.beneficiaire ?? "—";
      out.moyen = MOYEN_LABELS[rec.moyen] ?? rec.moyen ?? "—";
      out.reference_externe = rec.reference_externe ?? "—";
      out.date_confirmation = dateFr(rec.confirme_le);
      if (rec.acquereur_id) {
        const att = await chargerAttributaire(rec.acquereur_id);
        out.beneficiaire = out.beneficiaire !== "—" ? out.beneficiaire : att.nom;
        out.acquereur_contacts = att.contacts;
      }
    }

    if (table === "pv_bornage") {
      const { data: m } = await supabase.from("missions_geometre")
        .select("client_nom,client_contact,lieu,type_mission,lot_id,geometre_id").eq("id", rec.mission_id).single();
      out.client_nom = m?.client_nom ?? "—";
      out.client_contact = m?.client_contact ?? "—";
      out.lieu = m?.lieu ?? "—";
      out.type_mission = TYPE_MISSION_LABELS[m?.type_mission ?? ""] ?? m?.type_mission ?? "—";
      if (m?.geometre_id) {
        const { data: ge } = await supabase.from("geometres_experts").select("nom,numero_ordre,cabinet").eq("id", m.geometre_id).single();
        out.geometre_nom = ge?.nom ?? "—";
        out.geometre_numero_ordre = ge?.numero_ordre ?? "—";
        out.geometre_cabinet = ge?.cabinet ?? "—";
      }
      if (m?.lot_id) {
        Object.assign(out, await chargerLot(m.lot_id));
      } else {
        out.lot = "—"; out.ilot = "—"; out.lotissement = "—"; out.superficie_enregistree = "—";
      }
      out.date_bornage = rec.date_bornage ? dateFr(rec.date_bornage) : "—";
      out.superficie_mesuree = superficieFr(rec.superficie_mesuree_m2 ?? null);
      out.observations = rec.observations ?? "—";
    }
  } catch (e) { console.error("chargerDonnees", table, e); }
  return out;
}

const QUITTANCE_GABARIT = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>{{titre}} — {{reference}}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, "Helvetica Neue", sans-serif;
    color: #1F2937;
    background: #ffffff;
    width: 210mm;
    min-height: 297mm;
    padding: 16mm 18mm;
  }

  /* En-tête */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid #0D3B66;
    padding-bottom: 14px;
    margin-bottom: 28px;
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand .badge {
    width: 48px; height: 48px; border-radius: 12px;
    background: linear-gradient(135deg, #0D3B66, #1E6091);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .brand .badge svg { width: 26px; height: 26px; }
  .brand .name { font-size: 20px; font-weight: 800; color: #0D3B66; letter-spacing: 0.02em; }
  .brand .tagline { font-size: 10px; color: #64748b; margin-top: 2px; }
  .doc-meta { text-align: right; }
  .doc-meta .titre {
    font-size: 15px; font-weight: 800; color: #0D3B66; letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .doc-meta .ref { font-size: 12px; color: #475569; margin-top: 3px; font-family: "Courier New", monospace; }
  .doc-meta .date { font-size: 11px; color: #94a3b8; margin-top: 2px; }

  /* Montant en avant */
  .montant-box {
    background: linear-gradient(135deg, #0D3B66, #1E6091);
    border-radius: 14px;
    padding: 22px 26px;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
  }
  .montant-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85; }
  .montant-box .valeur { font-size: 30px; font-weight: 800; margin-top: 4px; }
  .montant-box .statut {
    background: rgba(255,255,255,0.18);
    border-radius: 999px;
    padding: 5px 14px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  /* Détails */
  .details {
    border: 1px solid #E2E8F0;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 28px;
  }
  .details .row {
    display: flex;
    padding: 12px 18px;
    border-bottom: 1px solid #F1F5F9;
  }
  .details .row:last-child { border-bottom: none; }
  .details .row:nth-child(even) { background: #F8FAFC; }
  .details .label { width: 42%; font-size: 11.5px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
  .details .value { width: 58%; font-size: 13px; color: #1F2937; font-weight: 600; }

  /* Vérification / QR */
  .verif {
    display: flex;
    align-items: center;
    gap: 18px;
    border: 1px dashed #CBD5E1;
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 28px;
  }
  .verif img { width: 84px; height: 84px; flex-shrink: 0; }
  .verif .titre-verif { font-size: 12.5px; font-weight: 700; color: #0D3B66; }
  .verif .texte-verif { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.5; }
  .verif .url-verif { font-size: 10.5px; color: #1E6091; margin-top: 4px; word-break: break-all; }

  .mention-legale {
    font-size: 10px;
    color: #94a3b8;
    line-height: 1.6;
    border-top: 1px solid #E2E8F0;
    padding-top: 14px;
  }

  .footer {
    margin-top: 40px;
    text-align: center;
    font-size: 9.5px;
    color: #CBD5E1;
  }
</style>
</head>
<body>

  <div class="header">
    <div class="brand">
      <div class="badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      </div>
      <div>
        <div class="name">SGNF</div>
        <div class="tagline">Système de Gestion Numérique du Foncier</div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="titre">{{titre}}</div>
      <div class="ref">{{reference}}</div>
      <div class="date">Émise le {{date}}</div>
    </div>
  </div>

  <div class="montant-box">
    <div>
      <div class="label">Montant payé</div>
      <div class="valeur">{{montant_total}}</div>
    </div>
    <div class="statut">Paiement confirmé</div>
  </div>

  <div class="details">
    <div class="row">
      <div class="label">Réglé par</div>
      <div class="value">{{beneficiaire}}</div>
    </div>
    <div class="row">
      <div class="label">Contact</div>
      <div class="value">{{acquereur_contacts}}</div>
    </div>
    <div class="row">
      <div class="label">Nature du paiement</div>
      <div class="value">{{type_paiement}}</div>
    </div>
    <div class="row">
      <div class="label">Moyen de paiement</div>
      <div class="value">{{moyen}}</div>
    </div>
    <div class="row">
      <div class="label">Référence de transaction</div>
      <div class="value">{{reference_externe}}</div>
    </div>
    <div class="row">
      <div class="label">Date de confirmation</div>
      <div class="value">{{date_confirmation}}</div>
    </div>
  </div>

  <div class="verif">
    <img src="{{qr_data_uri}}" alt="QR code de vérification" />
    <div>
      <div class="titre-verif">Vérifier l'authenticité de cette quittance</div>
      <div class="texte-verif">
        Scannez ce QR code avec l'appareil photo de votre téléphone, ou saisissez la
        référence <strong>{{reference}}</strong> sur la page de vérification SGNF.
      </div>
      <div class="url-verif">{{verify_url}}</div>
    </div>
  </div>

  <p class="mention-legale">
    Ce document atteste qu'un paiement a été reçu et confirmé par le Système de Gestion
    Numérique du Foncier (SGNF) pour le compte désigné ci-dessus. Il ne constitue ni un
    titre de propriété ni une attestation foncière — ces documents sont délivrés
    séparément une fois la démarche associée finalisée. Chaque vérification de ce document
    est journalisée par SGNF.
  </p>

  <div class="footer">SGNF — Système de Gestion Numérique du Foncier · Document généré automatiquement</div>

</body>
</html>
`;

const PV_BORNAGE_GABARIT = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>{{titre}} — {{reference}}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, "Helvetica Neue", sans-serif;
    color: #1F2937;
    background: #ffffff;
    width: 210mm;
    min-height: 297mm;
    padding: 16mm 18mm;
  }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 3px solid #0D3B66; padding-bottom: 14px; margin-bottom: 28px;
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand .badge {
    width: 48px; height: 48px; border-radius: 12px;
    background: linear-gradient(135deg, #0D3B66, #1E6091);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .brand .badge svg { width: 26px; height: 26px; }
  .brand .name { font-size: 20px; font-weight: 800; color: #0D3B66; letter-spacing: 0.02em; }
  .brand .tagline { font-size: 10px; color: #64748b; margin-top: 2px; }
  .doc-meta { text-align: right; }
  .doc-meta .titre { font-size: 15px; font-weight: 800; color: #0D3B66; letter-spacing: 0.06em; text-transform: uppercase; }
  .doc-meta .ref { font-size: 12px; color: #475569; margin-top: 3px; font-family: "Courier New", monospace; }
  .doc-meta .date { font-size: 11px; color: #94a3b8; margin-top: 2px; }

  .geometre-box {
    background: linear-gradient(135deg, #0D3B66, #1E6091);
    border-radius: 14px; padding: 18px 24px; color: #ffffff; margin-bottom: 24px;
  }
  .geometre-box .label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85; }
  .geometre-box .nom { font-size: 18px; font-weight: 800; margin-top: 3px; }
  .geometre-box .sous { font-size: 11.5px; margin-top: 4px; opacity: 0.9; }

  .superficies { display: flex; gap: 14px; margin-bottom: 24px; }
  .superficie-card {
    flex: 1; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px 18px;
  }
  .superficie-card .label { font-size: 10.5px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
  .superficie-card .valeur { font-size: 20px; font-weight: 800; color: #0D3B66; margin-top: 4px; }

  .details { border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
  .details .row { display: flex; padding: 12px 18px; border-bottom: 1px solid #F1F5F9; }
  .details .row:last-child { border-bottom: none; }
  .details .row:nth-child(even) { background: #F8FAFC; }
  .details .label { width: 42%; font-size: 11.5px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
  .details .value { width: 58%; font-size: 13px; color: #1F2937; font-weight: 600; }

  .observations { border: 1px dashed #CBD5E1; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px; }
  .observations .label { font-size: 10.5px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 6px; }
  .observations .texte { font-size: 12.5px; color: #334155; line-height: 1.6; }

  .signatures { display: flex; gap: 14px; margin-bottom: 24px; }
  .signature-box { flex: 1; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; text-align: center; }
  .signature-box .role { font-size: 11px; font-weight: 700; color: #0D3B66; text-transform: uppercase; letter-spacing: 0.03em; }
  .signature-box .ligne { border-top: 1px solid #CBD5E1; margin-top: 36px; padding-top: 6px; font-size: 10px; color: #94a3b8; }

  .verif {
    display: flex; align-items: center; gap: 18px; border: 1px dashed #CBD5E1;
    border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;
  }
  .verif img { width: 84px; height: 84px; flex-shrink: 0; }
  .verif .titre-verif { font-size: 12.5px; font-weight: 700; color: #0D3B66; }
  .verif .texte-verif { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.5; }
  .verif .url-verif { font-size: 10.5px; color: #1E6091; margin-top: 4px; word-break: break-all; }

  .mention-legale { font-size: 10px; color: #94a3b8; line-height: 1.6; border-top: 1px solid #E2E8F0; padding-top: 14px; }
  .footer { margin-top: 40px; text-align: center; font-size: 9.5px; color: #CBD5E1; }
</style>
</head>
<body>

  <div class="header">
    <div class="brand">
      <div class="badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      </div>
      <div>
        <div class="name">SGNF</div>
        <div class="tagline">Système de Gestion Numérique du Foncier</div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="titre">{{titre}}</div>
      <div class="ref">{{reference}}</div>
      <div class="date">Émis le {{date}} — bornage du {{date_bornage}}</div>
    </div>
  </div>

  <div class="geometre-box">
    <div class="label">Géomètre-expert</div>
    <div class="nom">{{geometre_nom}}</div>
    <div class="sous">{{geometre_cabinet}} · N° d'ordre {{geometre_numero_ordre}}</div>
  </div>

  <div class="superficies">
    <div class="superficie-card">
      <div class="label">Superficie mesurée</div>
      <div class="valeur">{{superficie_mesuree}}</div>
    </div>
    <div class="superficie-card">
      <div class="label">Superficie enregistrée</div>
      <div class="valeur">{{superficie_enregistree}}</div>
    </div>
  </div>

  <div class="details">
    <div class="row"><div class="label">Client / demandeur</div><div class="value">{{client_nom}}</div></div>
    <div class="row"><div class="label">Contact</div><div class="value">{{client_contact}}</div></div>
    <div class="row"><div class="label">Type de mission</div><div class="value">{{type_mission}}</div></div>
    <div class="row"><div class="label">Lieu</div><div class="value">{{lieu}}</div></div>
    <div class="row"><div class="label">Lot / lotissement</div><div class="value">{{lot}} · {{lotissement}}</div></div>
  </div>

  <div class="observations">
    <div class="label">Observations</div>
    <div class="texte">{{observations}}</div>
  </div>

  <div class="signatures">
    <div class="signature-box"><div class="role">Le demandeur</div><div class="ligne">Signature</div></div>
    <div class="signature-box"><div class="role">Le géomètre-expert</div><div class="ligne">Signature</div></div>
    <div class="signature-box"><div class="role">L'autorité coutumière</div><div class="ligne">Signature</div></div>
  </div>

  <div class="verif">
    <img src="{{qr_data_uri}}" alt="QR code de vérification" />
    <div>
      <div class="titre-verif">Vérifier l'authenticité de ce procès-verbal</div>
      <div class="texte-verif">
        Scannez ce QR code avec l'appareil photo de votre téléphone, ou saisissez la
        référence <strong>{{reference}}</strong> sur la page de vérification SGNF.
      </div>
      <div class="url-verif">{{verify_url}}</div>
    </div>
  </div>

  <p class="mention-legale">
    Ce procès-verbal constate les opérations de bornage réalisées par le géomètre-expert
    désigné ci-dessus. Il engage sa responsabilité professionnelle et n'a valeur légale
    définitive qu'une fois signé par l'ensemble des parties présentes. Chaque vérification
    de ce document est journalisée par SGNF.
  </p>

  <div class="footer">SGNF — Système de Gestion Numérique du Foncier · Document généré automatiquement</div>

</body>
</html>
`;

function gabaritInterne(cfg: { titre: string; type_doc: string }): string {
  if (cfg.type_doc === "quittance") return QUITTANCE_GABARIT;
  if (cfg.type_doc === "pv_bornage") return PV_BORNAGE_GABARIT;
  return `<!DOCTYPE html><html><body><h1>${cfg.titre}</h1><p>{{reference}} — document genere sans gabarit specifique (repli minimal)</p></body></html>`;
}

// Incruste le blason SGNF (bouclier + coche, meme trace que dans QUITTANCE_GABARIT/PV_BORNAGE_GABARIT)
// au centre d'un QR genere en errorCorrectionLevel "H" (tolere ~30% de recouvrement -- le badge
// n'en occupe qu'environ 7%, large marge de securite pour la lecture).
function incrusterLogoQr(svg: string, brandColor: string): string {
  const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!vb) return svg;
  const w = Number(vb[1]), h = Number(vb[2]);
  const badge = Math.max(6, Math.round(Math.min(w, h) * 0.26));
  const cx = w / 2, cy = h / 2;
  const r = badge / 2;
  const scale = badge / 24;
  const overlay = `<circle cx="${cx}" cy="${cy}" r="${r * 1.12}" fill="#ffffff"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${brandColor}"/>` +
    `<g transform="translate(${cx - badge / 2} ${cy - badge / 2}) scale(${scale})">` +
    `<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M9 12l2 2 4-4" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</g>`;
  return svg.replace("</svg>", overlay + "</svg>");
}

async function renderViaPdfMonkey(templateId: string, payload: Record<string, string>, filename: string): Promise<Uint8Array> {
  const res = await fetch("https://api.pdfmonkey.io/api/v1/documents/sync", {
    method: "POST",
    headers: { "Authorization": `Bearer ${PDFMONKEY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      document: { document_template_id: templateId, status: "pending", payload: JSON.stringify(payload), meta: { _filename: filename } },
    }),
  });
  if (!res.ok) throw new Error(`PDFMonkey HTTP ${res.status}: ${await res.text()}`);
  const card = await res.json();
  const doc = card.document_card ?? card.document ?? card;
  if (doc.status !== "success" || !doc.download_url) {
    throw new Error(`PDFMonkey statut=${doc.status} failure_cause=${JSON.stringify(doc.failure_cause ?? doc)}`);
  }
  const pdfRes = await fetch(doc.download_url);
  if (!pdfRes.ok) throw new Error(`Telechargement PDFMonkey HTTP ${pdfRes.status}`);
  return new Uint8Array(await pdfRes.arrayBuffer());
}

// --- Autorisation ----------------------------------------------------------
// Cette fonction n'est appelee QUE par les triggers/cron DB (pg_net via sgfn_call_edge),
// qui presentent un JWT de role "service_role". verify_jwt=true (plateforme) ne suffit PAS :
// la cle anon publique est elle aussi un JWT valide et passerait la verification plateforme.
// On exige donc service_role, OU l'en-tete applicatif x-hook-secret lorsque le secret
// HOOK_SECRET est configure (durcissement optionnel, defense en profondeur).
// La signature du JWT est deja validee par la plateforme (verify_jwt=on) : on se contente
// de lire le claim `role` du payload, sans reverifier la signature.
function roleDuJwt(req: Request): string | null {
  const m = (req.headers.get("Authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const seg = m[1].split(".")[1];
  if (!seg) return null;
  try {
    let b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    b64 += "=".repeat((4 - (b64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const secretOk = HOOK_SECRET ? req.headers.get("x-hook-secret") === HOOK_SECRET : false;
  const role = roleDuJwt(req);
  if (!secretOk && role !== "service_role") {
    console.warn(`generation-document: appel refuse (role=${role ?? "aucun"}, x-hook-secret=${secretOk})`);
    return new Response("Non autorise", { status: 401 });
  }

  const evt = await req.json().catch(() => ({}));

  // ---- MODE DIAGNOSTIC ----
  if (evt.debug === true) {
    const t = evt.table ?? "attestations_cession";
    const cfg = CONFIG[t];
    const tplId = cfg ? (Deno.env.get(cfg.pdfmonkeyEnv) ?? cfg.pdfmonkeyTemplateIdDefault) : null;
    const fnBaseDiag = (Deno.env.get("SUPABASE_URL") ?? "").replace(".supabase.co", ".functions.supabase.co");
    const verifyUrlSample = PUBLIC_VERIFY_BASE ? `${PUBLIC_VERIFY_BASE.replace(/\/+$/, "")}/?ref=SAMPLE-REF` : `${fnBaseDiag}/verification-qr?ref=SAMPLE-REF`;
    const diag: Record<string, unknown> = { table: t, hasApiKey: !!PDFMONKEY_API_KEY, hasTemplateId: !!tplId, templateId: tplId ?? null, hasPublicVerifyBase: !!PUBLIC_VERIFY_BASE, publicVerifyBase: PUBLIC_VERIFY_BASE ?? null, sampleVerifyUrl: verifyUrlSample };
    if (PDFMONKEY_API_KEY && tplId && cfg) {
      try {
        const sample: Record<string, string> = {
          titre: cfg.titre, reference: "DEBUG-0001", date: "24 Juin 2026",
          nom: "DIAGNOSTIC TEST", type_piece: "CNI", num_piece: "CI-9999", contacts: "+225 00 00",
          lotissement: "TEST-LOT", village: "EBIMPE", commune: "ANYAMA", ilot: "99", lot: "99",
          vendeur: "TEST OPERATEUR", prix_total: "1 000 000 FCFA", montant_paye: "500 000 FCFA", solde: "500 000 FCFA",
          type_vente: "comptant", nb_echeances: "1", date_vente: "24 Juin 2026",
          famille: "TEST FAMILLE", lignee: "TEST LIGNEE", chef_de_famille: "TEST CHEF",
          autorite_coutumiere: "TEST CHEFFERIE", autorite_type: "chefferie", autorite_chef: "TEST CHEF VILLAGE",
          cvgfr_president: "TEST PRESIDENT CVGFR", non_contestation: "Oui", district: "ABIDJAN",
          superficie: "1000 m2", nb_ilots: "10", nb_lots: "49", type_signature: evt.type_signature ?? "principal",
          qr_svg: "", qr_data_uri: "", verify_url: "https://example.com",
          type_paiement: "Vente terrain", montant_total: "250 000 FCFA", commission_sgfn: "10 000 FCFA",
          montant_reverse: "240 000 FCFA", beneficiaire: "TEST BENEFICIAIRE", moyen: "Wave",
          reference_externe: "cinetpay:TEST", date_confirmation: "24 Juin 2026", acquereur_contacts: "+225 00 00",
          client_nom: "TEST CLIENT", client_contact: "+225 00 00", type_mission: "Bornage",
          geometre_nom: "TEST GEOMETRE", geometre_numero_ordre: "TEST-0000", geometre_cabinet: "TEST CABINET",
          date_bornage: "24 Juin 2026", superficie_mesuree: "1 000 m²", superficie_enregistree: "1 000 m²", observations: "—",
          niveau: "2", gratuite: "Oui", nom_identifie_physique: "TEST IDENTIFIE PHYSIQUEMENT",
          chef_village: "TEST CHEF VILLAGE", numero_arrete_nomination: "99/PA/SG/D1", date_arrete_nomination: "24 Juin 2026",
          revoquee: "", revoquee_le: "",
        };
        const bytes = await renderViaPdfMonkey(tplId, sample, "debug.pdf");
        diag.success = true; diag.pdfSizeBytes = bytes.length;
      } catch (e) { diag.success = false; diag.error = String(e instanceof Error ? e.message : e); }
    }
    return new Response(JSON.stringify(diag, null, 2), { headers: { "Content-Type": "application/json" } });
  }

  const table: string = evt.table;
  const rec = evt.record;
  const cfg = CONFIG[table];
  if (!cfg || !rec) {
    // 🔴 `status: 200` MENTAIT (dette #49, 5e tour) : rien n'est produit, et
    // la reponse disait « succes ». Corrige au moins le code — 422, la table
    // ou l'enregistrement ne correspondent a rien de traitable.
    //
    // PAS de `signalerIncident` ici, et c'est un jugement, pas un oubli :
    // les six declencheurs reels (`sgfn_trigger_generation`,
    // `paiements_trigger_generation`) n'appellent CETTE fonction QUE depuis
    // les six tables de CONFIG — ce cas ne se produit dans l'usage normal
    // qu'en cas de derive du schema (nouveau trigger sur une table hors
    // perimetre) ou d'appel manuel malforme, jamais en train d'egarer un
    // acte reel. Et si `!rec`, `rec.id` n'existe pas : `journal_audit`
    // n'aurait rien de solide a rattacher. Un log suffit ; le journal
    // d'incidents reste reserve aux echecs qui concernent un ACTE identifie.
    console.error(`[dette#49] Requete ignoree — table=${JSON.stringify(table)} cfg=${!!cfg} rec=${!!rec}`);
    return new Response(JSON.stringify({ ok: false, erreur: "Table ou enregistrement non traitable." }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const d = await chargerDonnees(table, rec);

  const fnBase = (Deno.env.get("SUPABASE_URL") ?? "").replace(".supabase.co", ".functions.supabase.co");
  const refForQr = rec.reference ?? rec.numero ?? rec.id;
  const verifyUrl = PUBLIC_VERIFY_BASE
    ? `${PUBLIC_VERIFY_BASE.replace(/\/+$/, "")}/?token=${rec.qr_token ?? refForQr}`
    : `${fnBase}/verification-qr?ref=${refForQr}`;

  let qrSvg = "", qrDataUri = "";
  try {
    qrSvg = await QRCode.toString(verifyUrl, { type: "svg", margin: 0, errorCorrectionLevel: "H" });
    if (cfg.brandColor) qrSvg = incrusterLogoQr(qrSvg, cfg.brandColor);
  } catch (e) { console.error("QR svg", e); }
  try { qrDataUri = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 240 }); } catch (e) { console.error("QR dataurl", e); }

  // Filigrane de revocation. Le gabarit PDFMonkey teste `{{revoquee}}` (chaine
  // vide = document normal) pour afficher « REVOQUEE » en arriere-plan.
  // `revoquer_attestation()` redeclenche cette generation apres revocation :
  // le PDF stocke est ecrase par sa version filigranee, de sorte qu'un
  // exemplaire retelecharge porte la mention, alors que les exemplaires deja
  // imprimes restent evidemment inchanges -- c'est la verification QR qui fait
  // foi pour ceux-la.
  const estRevoquee = String(rec.statut ?? "") === "revoquee";

  const baseVars: Record<string, string> = {
    titre: cfg.titre,
    reference: rec.reference ?? rec.numero ?? rec.id ?? "",
    date: dateFr(rec.date_emission ?? rec.date_delivrance ?? rec.confirme_le ?? rec.cree_le),
    qr_svg: qrSvg, qr_data_uri: qrDataUri, verify_url: verifyUrl,
    revoquee: estRevoquee ? "REVOQUEE" : "",
    revoquee_le: estRevoquee ? dateFr(rec.revoquee_le) : "",
    ...d,
  };

  let pdfmonkeyTemplateId = Deno.env.get(cfg.pdfmonkeyEnv) ?? cfg.pdfmonkeyTemplateIdDefault;
  if (table === "attestations_cession" && rec.lot_id) {
    // Surcharge par lotissement (ex. Brignan Kakodji) -- ne remplace le gabarit
    // global que si la colonne est renseignee pour ce lotissement precis.
    const { data: lotLo } = await supabase.from("lots")
      .select("ilots(lotissements(pdfmonkey_template_attestation_cession))")
      .eq("id", rec.lot_id).single();
    const override = (lotLo as any)?.ilots?.lotissements?.pdfmonkey_template_attestation_cession;
    if (override) pdfmonkeyTemplateId = override;
  }
  if (table === "attestations_attribution_lot" && rec.lot_id) {
    const { data: lotLo } = await supabase.from("lots")
      .select("ilots(lotissements(pdfmonkey_template_attestation_attribution))")
      .eq("id", rec.lot_id).single();
    const override = (lotLo as any)?.ilots?.lotissements?.pdfmonkey_template_attestation_attribution;
    if (override) pdfmonkeyTemplateId = override;
  }
  const filename = `${cfg.type_doc}_${baseVars.reference}.pdf`;

  async function renderFallback(): Promise<Response> {
    let html = (await chargerGabarit(cfg.template)) ?? gabaritInterne(cfg);
    html = html.replace(/\{\{(\w+)\}\}/g, (_m, k) => baseVars[k] ?? "");
    let b: Uint8Array, e: string, m: string;
    if (GOTENBERG_URL) {
      const form = new FormData();
      form.append("files", new File([html], "index.html", { type: "text/html" }));
      form.append("paperWidth", "8.27"); form.append("paperHeight", "11.69");
      form.append("marginTop", "0"); form.append("marginBottom", "0");
      form.append("marginLeft", "0"); form.append("marginRight", "0");
      form.append("printBackground", "true");
      const headers: Record<string, string> = {};
      if (GOTENBERG_USER && GOTENBERG_PASS) headers["Authorization"] = "Basic " + btoa(`${GOTENBERG_USER}:${GOTENBERG_PASS}`);
      const r = await fetch(`${GOTENBERG_URL.replace(/\/+$/, "")}/forms/chromium/convert/html`, { method: "POST", body: form, headers });
      if (!r.ok) {
        // 🔴 MEME RAIL QUE LE DEPOT REFUSE (dette #49, 5e tour). Un rendu
        // Gotenberg en echec est de la MEME FAMILLE que le depot au bucket
        // refuse : un acte qui n'existe nulle part et dont seul un
        // `console.error` gardait trace — muet du point de vue du produit,
        // pour la meme raison que `signalerIncident` a ete branchee ailleurs
        // (`sgfn_call_edge` ne relit jamais la reponse HTTP).
        const motifGotenberg = await r.text();
        console.error("Gotenberg", r.status, motifGotenberg);
        await signalerIncident("GENERATION_RENDU_REFUSE", {
          table_source: table, type_doc: cfg.type_doc, statut_gotenberg: r.status, motif: motifGotenberg,
        });
        return new Response(JSON.stringify({ ok: false, erreur: "Le rendu du document a echoue." }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
      b = new Uint8Array(await r.arrayBuffer()); e = "pdf"; m = "application/pdf";
    } else {
      b = new TextEncoder().encode(html); e = "html"; m = "text/html";
    }
    return await deposer(b, e, m);
  }

  /**
   * Signale un incident LA OU QUELQU'UN LE VERRA.
   *
   * 🔴 UN `console.error` NE SIGNALE RIEN, ET LE PRETENDRE ETAIT FAUX.
   * La redaction precedente de cette fonction affirmait que l'echec « est
   * desormais SIGNALE ». Mesure du verificateur : les six declencheurs
   * passent tous par `sgfn_call_edge`, qui fait
   * `perform net.http_post(...)` et `returns void` — LA REPONSE N'EST
   * JAMAIS RELUE. Aucun appelant dans `src/`, aucun dans l'APK, aucun
   * `cron.job`. Le `500 ok:false` ne va donc nulle part, et la seule
   * trace etait un journal que personne ne consulte : du point de vue du
   * produit, l'echec restait exactement aussi muet qu'avant. C'est la
   * forme de la dette #45 — un refus qui n'a pas l'air d'un refus.
   *
   * On ecrit donc dans `journal_audit`, qui est deja lu par DEUX ecrans
   * reels. Pas de table neuve, pas de RLS neuve, pas d'ecran neuf — le
   * rail existe, il suffisait de s'y brancher.
   *
   * ⚠️ MAIS LES DEUX ECRANS NE MONTRENT PAS LA MEME CHOSE, et une
   * redaction precedente de ce commentaire ne citait que le mauvais :
   *   · `/dashboard/administration` (`useAdministration.ts:86`) fait
   *     `select id, table_concernee, action, effectue_par, effectue_le`
   *     — il N'A PAS `nouvelle_valeur`. On y voit donc QU'un incident
   *     `GENERATION_CHEMIN_REFUSE` a eu lieu sur `documents`, et RIEN
   *     de ce qui suit : ni le chemin, ni le motif, ni la table source.
   *   · `/dashboard` — Centre de Pilotage — (`useAdminOverview.ts:243`)
   *     selectionne `nouvelle_valeur` et `ActivityCenter.tsx:249` la
   *     rend en clair au clic sur la ligne. C'EST LE SEUL ECRAN OU LE
   *     DETAIL DE L'INCIDENT EST LISIBLE.
   * Les deux limitent le fil aux plus recentes (200 cote administration,
   * 40 cote pilotage) sur une table qui porte 8 369 lignes alimentees en
   * continu par les triggers d'audit : un incident isole peut sortir de
   * la fenetre de 40 en quelques heures. Le rail est le bon, il n'est
   * pas une alerte — le dire ici plutot que de laisser croire l'inverse.
   *
   * Mesure du 11/08/2026 en lecture seule sur la production, parce que
   * cette ligne doit etre VRAIE et pas seulement rassurante :
   * `journal_audit` porte bien les 4 colonnes ecrites ci-dessous ;
   * `id` est `generated always as identity` (ne pas la fournir est
   * correct) ; `effectue_le` vaut `now()` par defaut ; `action` est un
   * `text` SANS contrainte de valeur (les noms d'actions neufs passent) ;
   * et `service_role` porte `INSERT` + `rolbypassrls = true`, ce qui est
   * NECESSAIRE ici : la seule policy de la table est `audit_admin_read`,
   * en SELECT — aucune policy d'INSERT n'existe.
   *
   * `effectue_par` reste NULL : la fonction s'execute en `service_role`,
   * il n'y a pas d'utilisateur derriere. C'est deja le cas de 7 767 des
   * 8 369 lignes, ecrites par `enregistrer_audit()` hors session.
   *
   * L'ecriture de l'incident ne doit JAMAIS masquer l'incident : si elle
   * echoue a son tour, on le journalise et on continue.
   */
  async function signalerIncident(action: string, details: Record<string, unknown>) {
    const { error } = await supabase.from("journal_audit").insert({
      table_concernee: "documents",
      enregistrement_id: rec.id ?? null,
      action,
      nouvelle_valeur: details,
    });
    if (error) console.error(`[dette#49] Incident '${action}' NON journalise : ${error.message}`, details);
  }

  async function deposer(b: Uint8Array, e: string, m: string): Promise<Response> {
    const chemin = `${table}/${rec.reference ?? rec.numero ?? rec.id}.${e}`;

    // ═══════════════════════════════════════════════════════════════════
    //  🔴 LE JUMEAU EN ECRITURE DE LA DETTE #49
    //
    //  L'enonce de #49 ne parlait que de LECTURE (« qui peut inserer une
    //  ligne peut lire n'importe quel objet du bucket »). La moitie
    //  ECRITURE etait ici, dans le fichier meme qu'on venait de corriger.
    //
    //  `rec` vient d'un trigger, donc de la base — ce qui rassure a tort.
    //  `pv_bornage.reference` est ENTIEREMENT FOURNIE PAR LE CLIENT :
    //  relu en catalogue le 10/08 — `text NOT NULL` sans defaut, AUCUN
    //  CHECK de forme, AUCUN trigger BEFORE qui la fabrique (contrairement
    //  a `paiements`, qui a `trg_reference_quittance`), policy
    //  `pv_bornage_owner_all` dont le `with check` ne contraint QUE
    //  `mission_id`, et `missions_geometre_owner_all` laisse le geometre
    //  creer lui-meme la mission qui l'autorise. `authenticated` — et meme
    //  `anon` — portent le grant INSERT sur les deux tables.
    //
    //  La chaine, telle qu'elle etait ouverte :
    //    ① le geometre insere sa mission, puis un `pv_bornage` dont
    //       reference = '../attestations_cession/ATT-CESS-2026-00846.pdf#'
    //    ② le trigger appelle cette fonction, qui construit
    //       "pv_bornage/../attestations_cession/ATT-CESS-2026-00846.pdf#.html"
    //    ③ `upload(..., { upsert: true })` en service_role ; le parseur
    //       d'URL normalise, et l'objet REELLEMENT ECRASE est
    //       "attestations_cession/ATT-CESS-2026-00846.pdf"
    //  → le PDF d'une attestation reelle est remplace par un faux, et la
    //  verification QR continue de repondre « authentique ».
    //
    //  Latent aujourd'hui (`missions_geometre` porte 0 ligne, un seul
    //  compte geometre et c'est un compte de demonstration), mais ouvert
    //  au premier usage normal du module.
    //
    //  La garde est la MEME que cote lecture, et pour la meme raison : le
    //  chemin d'ecriture merite la discipline du chemin de signature.
    //  Elle est doublee en base par la contrainte de forme sur
    //  `reference`/`numero` (migration 20260810110000) — ni l'un ni
    //  l'autre ne suffit seul : la fonction peut etre redeployee sans la
    //  migration, et la base ne connait pas le gabarit.
    // ═══════════════════════════════════════════════════════════════════
    const motifChemin = motifDeRefusDuChemin(chemin, cfg.type_doc, rec.id);
    if (motifChemin) {
      console.error(
        `[dette#49] TELEVERSEMENT REFUSE — table=${table} type=${cfg.type_doc} motif="${motifChemin}" ` +
        `chemin=${JSON.stringify(chemin)} (reference=${JSON.stringify(rec.reference ?? null)}, ` +
        `numero=${JSON.stringify(rec.numero ?? null)})`,
      );
      await signalerIncident("GENERATION_CHEMIN_REFUSE", {
        table_source: table, type_doc: cfg.type_doc, chemin, motif: motifChemin,
        reference: rec.reference ?? null, numero: rec.numero ?? null,
      });
      return new Response(
        JSON.stringify({ ok: false, erreur: "Le chemin de stockage de ce document est invalide." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const up = await supabase.storage.from("documents").upload(chemin, b, { contentType: m, upsert: true });
    if (up.error) {
      // Derniere sortie MUETTE de `deposer` : elle ne rendait qu'un
      // `console.error` et un 500 en texte brut. Or un depot refuse, c'est
      // l'acte qui n'existe nulle part — ni au bucket, ni au registre —,
      // exactement l'incident qu'il faut voir. Meme rail que les quatre
      // autres branches.
      console.error(`[dette#49] Depot AU BUCKET refuse — chemin=${JSON.stringify(chemin)} : ${up.error.message}`);
      await signalerIncident("GENERATION_DEPOT_REFUSE", {
        table_source: table, type_doc: cfg.type_doc, chemin, motif: up.error.message, etape: "upload",
      });
      return new Response(
        JSON.stringify({ ok: false, erreur: "Le document n'a pas pu etre depose au stockage.", fichier: chemin }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    //  UNE LIGNE PAR CHEMIN, PAS UNE LIGNE PAR GENERATION
    //
    //  Mesure du 10/08 : 179 lignes `documents` pour 122 `url_fichier`
    //  distincts — 57 doublons, dont 6 lignes pour le seul APFC. Cause
    //  structurelle : le binaire etait ecrase (`upsert: true`) mais la
    //  ligne etait AJOUTEE (`.insert()` sec). Chaque regeneration
    //  produisait donc une ligne de plus et zero fichier de plus, et
    //  `/dashboard/documents` affichait le meme acte deux fois — six fois
    //  pour l'APFC.
    //
    //  Arbitrage du proprietaire (10/08) : on ferme la boucle, on ne
    //  touche PAS a l'historique. Les 57 lignes existantes restent ; on ne
    //  supprime pas des lignes d'un registre foncier sans decision ligne a
    //  ligne.
    //
    //  ⚠️ PAS D'`upsert` POSTGREST ICI, ET C'EST UNE CONTRAINTE D'ORDRE :
    //  `upsert` exige un index unique sur `url_fichier`, or il ne PEUT PAS
    //  etre pose aujourd'hui — les 57 doublons existants le feraient
    //  echouer. D'ou la sequence `update` puis `insert`.
    //
    //  L'`update` d'abord : quand des doublons existent deja, il les met
    //  TOUS a jour, ce qui fait converger l'historique sans le supprimer.
    // ═══════════════════════════════════════════════════════════════════
    const champs = { lot_id: rec.lot_id ?? null, type: cfg.type_doc, titre: cfg.titre, url_fichier: chemin };

    const maj = await supabase.from("documents").update(champs).eq("url_fichier", chemin).select("id");
    if (maj.error) {
      console.error(`[dette#49] Mise a jour de la ligne 'documents' refusee — chemin=${JSON.stringify(chemin)} : ${maj.error.message}`);
      await signalerIncident("GENERATION_LIGNE_REFUSEE", {
        table_source: table, type_doc: cfg.type_doc, chemin, motif: maj.error.message, etape: "update",
      });
      return new Response(
        JSON.stringify({ ok: false, erreur: "Le document a ete genere mais son enregistrement au registre a ete refuse.", fichier: chemin }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    let lignes = maj.data?.length ?? 0;
    if (lignes === 0) {
      const ins = await supabase.from("documents").insert(champs);
      if (ins.error) {
        // ── LA COURSE, ET COMMENT ELLE EST TRAITEE ────────────────────
        // Deux generations simultanees du meme acte peuvent toutes deux
        // ne rien trouver a l'`update`, puis inserer. Sans index unique
        // (impossible aujourd'hui, voir plus haut), rien ne les separe en
        // base : la fenetre est reelle et elle est ASSUMEE — elle produit
        // au pire le doublon qu'on produisait SYSTEMATIQUEMENT avant.
        // On retente malgre tout l'`update` une fois : si l'insert a
        // echoue parce qu'un concurrent avait deja ecrit la ligne, le
        // resultat correct est deja en base et l'echec serait trompeur.
        const maj2 = await supabase.from("documents").update(champs).eq("url_fichier", chemin).select("id");
        lignes = maj2.error ? 0 : (maj2.data?.length ?? 0);
        if (lignes === 0) {
          console.error(
            `[dette#49] Depot AU BUCKET reussi mais ligne 'documents' REFUSEE — table=${table} ` +
            `type=${cfg.type_doc} chemin=${JSON.stringify(chemin)} : ${ins.error.message}. ` +
            `Le binaire reste en place (upsert le remplacera) et le statut n'est PAS bascule.`,
          );
          await signalerIncident("GENERATION_LIGNE_REFUSEE", {
            table_source: table, type_doc: cfg.type_doc, chemin, motif: ins.error.message, etape: "insert",
          });
          return new Response(
            JSON.stringify({ ok: false, erreur: "Le document a ete genere mais son enregistrement au registre a ete refuse.", fichier: chemin }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      } else {
        lignes = 1;
      }
    }

    if (cfg.flipStatutDelivree) {
      // Ne bascule le statut qu'apres une ligne REELLEMENT ecrite : marquer
      // « delivree » un acte dont le registre ne porte aucune trace serait pire
      // que l'orphelin lui-meme.
      const maj = await supabase.from(table).update({ statut: "delivree" }).eq("id", rec.id);
      if (maj.error) {
        console.error(`[dette#49] Statut 'delivree' NON bascule sur ${table}/${rec.id} : ${maj.error.message}`);
        await signalerIncident("GENERATION_STATUT_NON_BASCULE", {
          table_source: table, id: rec.id, motif: maj.error.message,
        });
        return new Response(
          JSON.stringify({ ok: false, erreur: "Le document a ete enregistre mais son statut n'a pas pu etre mis a jour.", fichier: chemin }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }
    return new Response(JSON.stringify({ ok: true, fichier: chemin, format: e, lignes }), { headers: { "Content-Type": "application/json" } });
  }

  if (PDFMONKEY_API_KEY && pdfmonkeyTemplateId) {
    try {
      const bytes = await renderViaPdfMonkey(pdfmonkeyTemplateId, baseVars, filename);
      return await deposer(bytes, "pdf", "application/pdf");
    } catch (e) {
      console.error("PDFMonkey a echoue, repli sur Gotenberg/HTML:", e);
      return await renderFallback();
    }
  } else {
    return await renderFallback();
  }
});
