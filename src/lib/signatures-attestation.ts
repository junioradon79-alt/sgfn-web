/**
 * Signatures d'une attestation de cession — règles partagées.
 *
 * Doctrine (22/07) : les signatures sont **constatées**, pas électroniques. Le
 * document est signé sur papier ; l'application enregistre qu'elles y figurent
 * et qui l'a constaté. Voir la migration `20260722160000`.
 *
 * Ce module existe pour que la règle de libellé ne soit écrite qu'UNE fois :
 * elle est utilisée par le Coffre-fort documentaire et par l'écran Validations
 * de la chefferie, et une copie divergente serait invisible jusqu'à ce qu'un
 * écran affiche le mauvais titre.
 */

/**
 * Clés de `lotissements.signatures_requises`, dans l'ordre d'affichage.
 *
 * 🔴 `chefferie` s'intitule « Chef de village », jamais « Chefferie ». Ces
 * libellés nomment une PERSONNE qui signe, et « Chefferie » seul ne dit pas
 * laquelle des deux autorités coutumières a signé — le chef de VILLAGE ou le
 * chef de FAMILLE, qui figure sur le même document, deux lignes plus haut, sous
 * `proprietaire`. « Chefferie » reste juste pour l'institution (« Chefferie
 * d'Ebimpe », « Espace Chefferie », « Entérinement chefferie ») : ce n'est pas
 * une institution qui appose une signature.
 *
 * Cette seule ligne commande NEUF rendus (Coffre-fort documentaire ×2, écran
 * Validations, app mobile ×4 dont le libellé de bouton « Constater : … »).
 */
export const SIGNATURES_ATTESTATION = [
  { cle: "proprietaire", label: "Propriétaire terrien" },
  { cle: "operateur", label: "Opérateur" },
  { cle: "chefferie", label: "Chef de village" },
] as const;

/** Jeu appliqué quand le lotissement n'en configure pas (norme à 3). */
export const SIGNATURES_PAR_DEFAUT = ["proprietaire", "operateur", "chefferie"];

/**
 * Le signataire « proprietaire » ne porte pas le même titre partout, et la
 * différence est de fond :
 *
 * - un lotissement rattaché à **une** famille (Koelea-Accor revu → lignée Ako
 *   Djebe) est signé par son **chef de famille** ;
 * - un lotissement couvrant **plusieurs** familles (Brignan Kakodji,
 *   `famille_id` nul, 16 représentants distincts au rang 1) est signé par le
 *   **propriétaire terrien** du lot concerné.
 *
 * Le libellé se déduit donc du rattachement du lotissement, sans configuration
 * supplémentaire à tenir à jour.
 */
export function libelleSignature(cle: string, lotissementAUneFamille: boolean): string {
  if (cle === "proprietaire") {
    return lotissementAUneFamille ? "Chef de famille" : "Propriétaire terrien";
  }
  return SIGNATURES_ATTESTATION.find((s) => s.cle === cle)?.label ?? cle;
}

// ─── Cessions et Attributions de Lot — les trois colonnes `sig_*_le` ─────────
//
// Les deux tables (`attestations_cession`, `attestations_attribution_lot`)
// portent exactement les mêmes trois colonnes, et la même règle : le jeu exigé
// vient de `lotissements.signatures_requises`, pas d'une liste en dur.
//
// 🔴 Ce que ce bloc répare. `/dashboard/validations` codait DEUX pastilles en
// dur — « Propriétaire terrien » + « Opérateur » — sans jamais lire
// `signatures_requises`. Les 50 cessions en attente sont des cessions
// Koelea-Accor revu, dont le lotissement exige {proprietaire, chefferie} :
// chacune affichait donc une pastille orange « Opérateur » pour une signature
// que PERSONNE n'attend, que `marquer_attestation_delivree` n'exigera jamais,
// et que la migration `20260722160000` glose elle-même par « chef de famille
// + chefferie, sans l'opérateur ». C'est le défaut corrigé sur l'APFC et laissé
// vingt lignes plus haut, dans le même fichier.
//
// Le Coffre-fort documentaire (`/dashboard/documents`) tenait déjà la règle,
// mais dans son propre corps de composant. La voici sortie là où les trois
// écrans peuvent la partager, pour qu'une quatrième surface ne reparte pas d'un
// tableau écrit à la main.

/** Dates de constat des trois signatures, indexées par clé. */
export type DatesSignatureCession = {
  sig_proprietaire_le: string | null;
  sig_operateur_le: string | null;
  sig_chefferie_le: string | null;
};

/** Ce que l'écran doit savoir du lotissement porteur — et rien de plus. */
export type LotissementSignataire = {
  signatures_requises?: string[] | null;
  /** Rattachement à UNE famille : décide du titre du signataire `proprietaire`. */
  famille_id?: string | null;
} | null | undefined;

export type LigneSignatureCession = {
  cle: (typeof SIGNATURES_ATTESTATION)[number]["cle"];
  label: string;
  /** Ce lotissement exige-t-il cette signature ? */
  requise: boolean;
  /** La signature est-elle constatée au registre ? */
  signee: boolean;
};

const COLONNE_DE: Record<string, keyof DatesSignatureCession> = {
  proprietaire: "sig_proprietaire_le",
  operateur: "sig_operateur_le",
  chefferie: "sig_chefferie_le",
};

/**
 * État des trois créneaux d'une cession (ou d'une attribution de lot) : ce que
 * le lotissement exige, ce qui est constaté, et le décompte à afficher.
 *
 * `total` peut valoir 0 si `signatures_requises` ne contient aucune clé connue —
 * la contrainte SQL l'interdit aujourd'hui, mais ne pas diviser par `total`
 * sans garde (cf. `ProgressBar`).
 */
export function etatSignaturesCession(
  dates: DatesSignatureCession,
  lotissement: LotissementSignataire,
): {
  lignes: LigneSignatureCession[];
  signees: number;
  total: number;
  complete: boolean;
} {
  const requises = lotissement?.signatures_requises ?? SIGNATURES_PAR_DEFAUT;
  const uneSeuleFamille = Boolean(lotissement?.famille_id);
  const lignes: LigneSignatureCession[] = SIGNATURES_ATTESTATION.map((s) => ({
    cle: s.cle,
    label: libelleSignature(s.cle, uneSeuleFamille),
    requise: requises.includes(s.cle),
    signee: Boolean(dates[COLONNE_DE[s.cle]]),
  }));
  const exigees = lignes.filter((l) => l.requise);
  const signees = exigees.filter((l) => l.signee).length;
  return { lignes, signees, total: exigees.length, complete: signees === exigees.length };
}

/**
 * Ce créneau attend-il vraiment une signature ? Vrai seulement s'il est exigé
 * ET non constaté — même prédicat que `apfcAttendSignature`, et pour la même
 * raison : c'est lui, et lui seul, qui doit faire apparaître un bouton
 * « Valider », teinter une carte ou incrémenter une pastille. Une colonne vide
 * n'est pas une signature en attente si le lotissement ne la demande pas.
 */
export function cessionAttendSignature(
  dates: DatesSignatureCession,
  lotissement: LotissementSignataire,
  cle: string,
): boolean {
  return etatSignaturesCession(dates, lotissement).lignes.some(
    (l) => l.cle === cle && l.requise && !l.signee,
  );
}

// ─── APFC — mêmes clés, autres colonnes ──────────────────────────────────────
//
// L'APFC (`attestations_coutumieres`) porte TROIS colonnes de signature, et
// trois écrans codaient « 3 signatures » en dur. L'APFC-EBIMPE-2022-001 de
// Koelea-Accor affichait donc « 2/3 » à perpétuité alors que son lotissement
// n'exige que deux signatures et qu'aucun CVGFR n'existe nulle part en base.
//
// La correspondance ci-dessous n'était écrite NULLE PART — elle est établie
// ici, une seule fois, et se tient à ceci :
//
//   • `proprietaire` → `sig_chef_famille_le`. La migration `20260722160000`
//     qui a créé `signatures_requises` glose elle-même les deux signatures de
//     Koelea-Accor par « chef de famille + chefferie, sans l'opérateur », et
//     `libelleSignature("proprietaire", …)` rend déjà « Chef de famille » pour
//     un lotissement rattaché à UNE famille — ce qu'une APFC est toujours
//     (`attestations_coutumieres.famille_id`).
//   • `chefferie` → `sig_chef_village_le`. C'est le geste que
//     `/dashboard/validations` déclenche par `signer_apfc(…, 'chef_village')`
//     depuis le rôle `chefferie`, à la ligne même où une cession appelle
//     `signer_attestation(…, 'chefferie')`.
//   • `operateur` → AUCUNE colonne. Une APFC est un acte coutumier entre la
//     famille et la chefferie ; l'opérateur d'aménagement n'y est pas partie,
//     et la table ne lui offre pas de colonne. Un lotissement à trois
//     signatures (Brignan Kakodji) a donc une APFC à deux créneaux.
//   • Le CVGFR n'est PAS une valeur de `signatures_requises` : la contrainte
//     `lotissements_signatures_requises_valides` borne le tableau à
//     {proprietaire, operateur, chefferie}. Son créneau est donc commandé par
//     la donnée qui le désigne réellement — `attestations_coutumieres.cvgfr_id`.
//     Un document qui nomme un Comité Villageois de Gestion Foncière Rurale
//     doit porter sa signature ; un document qui n'en nomme aucun n'a pas une
//     signature « manquante », il a une signature sans objet. Au 29/07/2026 la
//     table `cvgfr` est vide dans toute la base : aucun créneau CVGFR n'est
//     donc présenté aujourd'hui, et la règle reste prête pour le jour où un
//     comité sera enregistré.
//
// Élargir la contrainte SQL à une quatrième valeur 'cvgfr' aurait été l'autre
// voie ; elle a été écartée : `signatures_requises` sert aussi aux cessions et
// aux attributions, dont les tables n'ont pas de colonne CVGFR — on aurait
// ouvert une clé que personne ne peut satisfaire, pour une table vide.

/**
 * Créneaux de signature d'une APFC, dans l'ordre d'affichage. `cle` est la
 * valeur de `lotissements.signatures_requises` qui commande le créneau (`null`
 * pour le CVGFR, commandé par `cvgfr_id`) ; `rpc` est l'argument attendu par
 * `signer_apfc(p_id, p_signature)`.
 */
export const SIGNATURES_APFC = [
  { cle: "proprietaire", colonne: "sig_chef_famille_le", label: "Chef de famille", rpc: "chef_famille" },
  { cle: "chefferie", colonne: "sig_chef_village_le", label: "Chef de village", rpc: "chef_village" },
  { cle: null, colonne: "sig_cvgfr_le", label: "CVGFR", rpc: "cvgfr" },
] as const;

/** Créneau d'APFC, désigné par sa colonne — la seule clé jamais ambiguë. */
export type ColonneSignatureApfc = (typeof SIGNATURES_APFC)[number]["colonne"];

/** La part d'une APFC dont dépend l'état de ses signatures. */
export type ApfcSignable = {
  sig_chef_famille_le: string | null;
  sig_chef_village_le: string | null;
  sig_cvgfr_le: string | null;
  cvgfr_id: string | null;
  /** Le lotissement porteur de `signatures_requises` (embed PostgREST). */
  lotissement: { signatures_requises: string[] | null } | null;
};

export type LigneSignatureApfc = {
  colonne: ColonneSignatureApfc;
  label: string;
  /** Ce lotissement/ce document exige-t-il cette signature ? */
  requise: boolean;
  /** La signature est-elle constatée au registre ? */
  signee: boolean;
};

/**
 * État des trois créneaux d'une APFC : lesquels sont exigés, lesquels sont
 * constatés, et le décompte à afficher (`signees`/`total`).
 *
 * `total` peut valoir 0 — un lotissement dont `signatures_requises` ne contient
 * que `operateur` n'exige aucune signature d'APFC. Le cas n'existe pas en base
 * au 29/07/2026, mais la contrainte SQL l'autorise : ne pas diviser par `total`
 * sans garde.
 */
export function etatSignaturesApfc(apfc: ApfcSignable): {
  lignes: LigneSignatureApfc[];
  signees: number;
  total: number;
  complete: boolean;
} {
  const requises = apfc.lotissement?.signatures_requises ?? SIGNATURES_PAR_DEFAUT;
  const lignes: LigneSignatureApfc[] = SIGNATURES_APFC.map((s) => ({
    colonne: s.colonne,
    label: s.label,
    requise: s.cle === null ? Boolean(apfc.cvgfr_id) : requises.includes(s.cle),
    signee: Boolean(apfc[s.colonne]),
  }));
  const exigees = lignes.filter((l) => l.requise);
  const signees = exigees.filter((l) => l.signee).length;
  return { lignes, signees, total: exigees.length, complete: signees === exigees.length };
}

/**
 * Ce créneau attend-il vraiment une signature ? Vrai seulement s'il est exigé
 * ET non constaté — c'est ce prédicat, et lui seul, qui doit teinter une carte,
 * incrémenter une pastille ou faire apparaître un bouton « Valider ». Un
 * créneau non exigé n'attend rien de personne.
 */
export function apfcAttendSignature(apfc: ApfcSignable, colonne: ColonneSignatureApfc): boolean {
  return etatSignaturesApfc(apfc).lignes.some((l) => l.colonne === colonne && l.requise && !l.signee);
}
