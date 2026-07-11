// Types & helpers partagés du module « Opérateur de saisie » (maker-checker).
// Contrat aligné sur les RPC SQL soumettre_saisie / approuver_soumission
// (migrations 20260710_operateur_saisie_*). Voir aussi la page /dashboard/saisie.

export type Qualite =
  | "ayant_droit"
  | "ayant_droit_transmission"
  | "acquereur"
  | "operateur"
  | "entrepreneur"
  | "reservataire";

export const QUALITE_OPTIONS: { value: Qualite; label: string }[] = [
  { value: "ayant_droit", label: "Propriétaire d'origine" },
  { value: "ayant_droit_transmission", label: "Ayant-droit par transmission" },
  { value: "acquereur", label: "Acquéreur" },
  { value: "operateur", label: "Opérateur" },
  { value: "entrepreneur", label: "Entrepreneur" },
  { value: "reservataire", label: "Réservataire" },
];

export function labelQualite(q: string | null | undefined): string {
  return QUALITE_OPTIONS.find((o) => o.value === q)?.label ?? q ?? "—";
}

export type TypeAttributaire =
  | "personne_physique"
  | "collectif_ayants_droit"
  | "personne_morale";

// Un attributaire à créer au moment de l'approbation (référencé par `ref` dans les opérations).
export type NouvelAttributaire = {
  ref: string;
  nom: string;
  type: TypeAttributaire;
  piece_nature?: string;
  piece_num?: string;
  telephone?: string;
};

// Une opération = l'état CIBLE d'un lot (l'application serveur est pilotée par la cible).
export type OperationCible =
  | { lot_id: string; cible: "libre" }
  | {
      lot_id: string;
      cible: "attribue";
      attributaire_id?: string; // attributaire existant
      attributaire_ref?: string; // ou nouvel attributaire (via NouvelAttributaire.ref)
      qualite: Qualite;
    };

export type PayloadMajAttributions = {
  lotissement_id: string;
  nouveaux_attributaires: NouvelAttributaire[];
  operations: OperationCible[];
};

export type LotStructure = {
  numero_lot: string;
  numero_parcelle?: string;
  superficie_m2?: number | null;
  est_equipement?: boolean;
};

// Créées à l'approbation, jamais à la soumission (même principe que les
// nouveaux attributaires côté maj_attributions) — jamais de création silencieuse.
export type NouvelleAutorite = { nom: string; type?: string; village?: string; chef?: string; contact?: string };
export type NouvelOperateur = { nom: string; type?: string; contact?: string };
export type NouvelleFamille = { nom: string; chef_de_famille?: string; contact?: string };

export type PayloadCreationStructure = {
  lotissement: {
    nom: string;
    village?: string;
    commune?: string;
    district?: string;
    autorite_coutumiere_id?: string;
    operateur_id?: string;
    famille_id?: string;
    guide_reference?: string;
    superficie_texte?: string;
  };
  nouvelle_autorite?: NouvelleAutorite;
  nouvel_operateur?: NouvelOperateur;
  nouvelle_famille?: NouvelleFamille;
  ilots: { numero: string; lots: LotStructure[] }[];
};

export type TypeSoumission = "maj_attributions" | "creation_structure";
export type StatutSoumission = "en_attente" | "approuvee" | "rejetee";

// ── Diff côté front : classification d'un changement vs l'état courant en base ──
export type ClasseChangement =
  | "nouvelle_attribution"
  | "reassignation"
  | "remise_libre"
  | "inchange";

export const CLASSE_LABELS: Record<ClasseChangement, string> = {
  nouvelle_attribution: "Nouvelle attribution",
  reassignation: "Réassignation",
  remise_libre: "Remise en disponibilité",
  inchange: "Aucun changement",
};

/** État actuel d'un lot (chargé depuis la base) pour construire le diff. */
export type LotEtat = {
  lot_id: string;
  ilot: string;
  numero_lot: string;
  statut: string;
  attributaire_id: string | null;
  attributaire_nom: string | null;
  qualite: Qualite | null;
};

/** Cible choisie par l'opérateur pour un lot. */
export type CibleChoisie =
  | { type: "libre" }
  | {
      type: "attribue";
      attributaire_id?: string;
      attributaire_ref?: string;
      attributaire_nom: string; // pour l'affichage
      qualite: Qualite;
    };

export function classifier(etat: LotEtat, cible: CibleChoisie): ClasseChangement {
  if (cible.type === "libre") {
    return etat.attributaire_id ? "remise_libre" : "inchange";
  }
  // cible.type === "attribue"
  if (!etat.attributaire_id) return "nouvelle_attribution";
  const memeAttributaire =
    !!cible.attributaire_id && cible.attributaire_id === etat.attributaire_id;
  if (memeAttributaire && cible.qualite === etat.qualite) return "inchange";
  return "reassignation";
}

/** Compteurs pour le résumé (resume jsonb). */
export type ResumeMaj = {
  nouvelles_attributions: number;
  reassignations: number;
  remises_libre: number;
  inchanges: number;
  nouveaux_attributaires: number;
};

/** Résumé d'une soumission creation_structure (resume jsonb). */
export type ResumeCreation = {
  nom_lotissement: string;
  nb_ilots: number;
  nb_lots: number;
  nb_equipements: number;
};
