// Import Excel simplifié du module « Opérateur de saisie » (étape 4).
// Logique pure de parsing/validation (aucune dépendance à SheetJS ici) : le
// composant appelant lit le fichier et fournit une matrice de cellules déjà
// désérialisée (sheet_to_json({ header: 1 })).
//
// Généralise le flux manuel décrit dans src/lib/saisie.ts : un import produit
// le même vocabulaire (LotEtat / CibleChoisie / NouvelAttributaire) que la
// saisie manuelle, pour rejoindre l'aperçu du diff et la soumission existants.

import { QUALITE_OPTIONS, type Qualite } from "./saisie";

export type ActionImport = "attribuer" | "libre";

export type LigneImport = {
  ligne: number; // n° de ligne dans le fichier (1-based, header inclus)
  ilot: string;
  numeroLot: string;
  action: ActionImport;
  attributaireNom?: string;
  qualite?: Qualite;
  pieceNature?: string;
  pieceNum?: string;
  telephone?: string;
};

export type ParseResult = {
  lignes: LigneImport[];
  erreurs: string[]; // erreurs bloquantes (colonnes manquantes, valeurs invalides)
};

// ── Normalisation ──

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function cleKey(s: string): string {
  return stripAccents(String(s ?? ""))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** "04" et "4" doivent matcher le même lot. */
export function normaliserNumero(s: string): string {
  const v = String(s ?? "").trim();
  return /^\d+$/.test(v) ? String(parseInt(v, 10)) : v.toLowerCase();
}

export function normaliserNom(s: string): string {
  return stripAccents(String(s ?? "").trim().toLowerCase()).replace(/\s+/g, " ");
}

// ── En-têtes tolérés (alias) ──

const ALIASES: Record<keyof Omit<LigneImport, "ligne" | "action" | "qualite">, string[]> = {
  ilot: ["ilot"],
  numeroLot: ["lot", "numlot", "numerolot"],
  attributaireNom: ["attributaire", "nomattributaire", "nom"],
  pieceNature: ["piecenature", "naturepiece", "typepiece"],
  pieceNum: ["piecenum", "numpiece", "numeropiece"],
  telephone: ["telephone", "tel"],
};
const ALIAS_ACTION = ["action"];
const ALIAS_QUALITE = ["qualite"];

function trouverColonne(headers: string[], aliases: string[]): number {
  const keys = headers.map(cleKey);
  for (const alias of aliases) {
    const i = keys.indexOf(alias);
    if (i !== -1) return i;
  }
  return -1;
}

function matchAction(brut: string): ActionImport | null {
  const k = cleKey(brut);
  if (["attribuer", "attribue", "attribution"].includes(k)) return "attribuer";
  if (["libre", "disponible", "remettreendisponibilite"].includes(k)) return "libre";
  return null;
}

const QUALITE_PAR_CLE = new Map<string, Qualite>(
  QUALITE_OPTIONS.flatMap((o) => [
    [cleKey(o.value), o.value] as const,
    [cleKey(o.label), o.value] as const,
  ]),
);

export function matchQualite(brut: string): Qualite | null {
  return QUALITE_PAR_CLE.get(cleKey(brut)) ?? null;
}

/**
 * Parse la matrice brute (1re ligne = en-têtes) issue de
 * `XLSX.utils.sheet_to_json(feuille, { header: 1, defval: "" })`.
 */
export function parserFeuilleImport(matrice: unknown[][]): ParseResult {
  const erreurs: string[] = [];
  if (matrice.length === 0) {
    return { lignes: [], erreurs: ["Le fichier est vide."] };
  }
  const headers = matrice[0].map((h) => String(h ?? ""));
  const idx = {
    ilot: trouverColonne(headers, ALIASES.ilot),
    numeroLot: trouverColonne(headers, ALIASES.numeroLot),
    action: trouverColonne(headers, ALIAS_ACTION),
    attributaireNom: trouverColonne(headers, ALIASES.attributaireNom),
    qualite: trouverColonne(headers, ALIAS_QUALITE),
    pieceNature: trouverColonne(headers, ALIASES.pieceNature),
    pieceNum: trouverColonne(headers, ALIASES.pieceNum),
    telephone: trouverColonne(headers, ALIASES.telephone),
  };
  const manquantes: string[] = [];
  if (idx.ilot === -1) manquantes.push("Ilot");
  if (idx.numeroLot === -1) manquantes.push("Lot");
  if (idx.action === -1) manquantes.push("Action");
  if (manquantes.length > 0) {
    return { lignes: [], erreurs: [`Colonne(s) manquante(s) : ${manquantes.join(", ")}.`] };
  }

  const cell = (row: unknown[], i: number): string =>
    i === -1 ? "" : String(row[i] ?? "").trim();

  const lignes: LigneImport[] = [];
  for (let r = 1; r < matrice.length; r++) {
    const row = matrice[r];
    if (!row || row.every((c) => String(c ?? "").trim() === "")) continue; // ligne vide ignorée
    const numLigne = r + 1;
    const ilot = cell(row, idx.ilot);
    const numeroLot = cell(row, idx.numeroLot);
    const actionBrut = cell(row, idx.action);
    if (!ilot || !numeroLot) {
      erreurs.push(`Ligne ${numLigne} : îlot ou n° de lot manquant.`);
      continue;
    }
    const action = matchAction(actionBrut);
    if (!action) {
      erreurs.push(`Ligne ${numLigne} : action « ${actionBrut} » invalide (attendu : Attribuer / Libre).`);
      continue;
    }
    if (action === "libre") {
      lignes.push({ ligne: numLigne, ilot, numeroLot, action });
      continue;
    }
    // action === "attribuer"
    const attributaireNom = cell(row, idx.attributaireNom);
    const qualiteBrut = cell(row, idx.qualite);
    if (!attributaireNom) {
      erreurs.push(`Ligne ${numLigne} : nom de l'attributaire manquant.`);
      continue;
    }
    const qualite = matchQualite(qualiteBrut);
    if (!qualite) {
      erreurs.push(
        `Ligne ${numLigne} : qualité « ${qualiteBrut} » invalide (voir feuille « Qualités valides »).`,
      );
      continue;
    }
    lignes.push({
      ligne: numLigne,
      ilot,
      numeroLot,
      action,
      attributaireNom,
      qualite,
      pieceNature: cell(row, idx.pieceNature) || undefined,
      pieceNum: cell(row, idx.pieceNum) || undefined,
      telephone: cell(row, idx.telephone) || undefined,
    });
  }

  // Un même lot ne doit apparaître qu'une fois (sinon ambiguïté sur la ligne gagnante).
  const vus = new Map<string, number>();
  for (const l of lignes) {
    const cleLot = `${normaliserNumero(l.ilot)}/${normaliserNumero(l.numeroLot)}`;
    if (vus.has(cleLot)) {
      erreurs.push(
        `Lignes ${vus.get(cleLot)} et ${l.ligne} : le lot îlot ${l.ilot} / lot ${l.numeroLot} apparaît deux fois.`,
      );
    } else {
      vus.set(cleLot, l.ligne);
    }
  }

  return { lignes, erreurs };
}

// ── Génération du modèle ──

export const TEMPLATE_HEADERS = [
  "Ilot",
  "Lot",
  "Action",
  "Attributaire",
  "Qualite",
  "Piece_nature",
  "Piece_num",
  "Telephone",
];

export const TEMPLATE_EXEMPLES: (string | number)[][] = [
  ["04", "031", "Attribuer", "KOUAME YAO PIERRE", "Propriétaire d'origine", "CNI", "CI001234567", "0708000000"],
  ["04", "032", "Libre", "", "", "", "", ""],
];

export function construireFeuilleModele(): (string | number)[][] {
  return [TEMPLATE_HEADERS, ...TEMPLATE_EXEMPLES];
}

export function construireFeuilleAide(): (string | number)[][] {
  return [
    ["Aide au remplissage"],
    [""],
    ["1 ligne = 1 lot. Colonnes Ilot / Lot / Action obligatoires."],
    ["Action = « Attribuer » ou « Libre »."],
    ["Si Action = Attribuer : Attributaire et Qualite sont obligatoires."],
    ["Piece_nature / Piece_num / Telephone ne servent que pour un NOUVEL attributaire."],
    [""],
    ["Qualités valides :"],
    ...QUALITE_OPTIONS.map((o) => [o.label]),
  ];
}
