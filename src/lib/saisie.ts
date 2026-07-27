// Types & helpers partagés du module « Opérateur de saisie » (maker-checker).
// Contrat aligné sur les RPC SQL soumettre_saisie / approuver_soumission
// (migrations 20260710_operateur_saisie_*). Voir aussi la page /dashboard/saisie.

// ⚠️ Cette liste doit énumérer l'enum `qualite_attribution` **en entier**. Une
// valeur qui existe en base sans figurer ici ne s'affiche pas (`labelQualite`
// retombe sur le code brut) et surtout ne peut plus être **reconduite** : qui
// corrige une attribution portant cette qualité en change nécessairement la
// nature juridique — celle-là même qui figure sur l'attestation. C'est ce qui
// est arrivé à `legs`, ajouté en base le 13/07 et resté absent d'ici.
export type Qualite =
  | "ayant_droit"
  | "ayant_droit_transmission"
  | "acquereur"
  | "operateur"
  | "entrepreneur"
  | "reservataire"
  | "legs";

export const QUALITE_OPTIONS: { value: Qualite; label: string }[] = [
  { value: "ayant_droit", label: "Propriétaire d'origine" },
  { value: "ayant_droit_transmission", label: "Ayant-droit par transmission" },
  { value: "acquereur", label: "Acquéreur" },
  { value: "operateur", label: "Opérateur" },
  { value: "entrepreneur", label: "Entrepreneur" },
  { value: "reservataire", label: "Réservataire" },
  { value: "legs", label: "Legs" },
];

export function labelQualite(q: string | null | undefined): string {
  return QUALITE_OPTIONS.find((o) => o.value === q)?.label ?? q ?? "—";
}

export type TypeAttributaire =
  | "personne_physique"
  | "collectif_ayants_droit"
  | "personne_morale";

export const TYPE_ATTRIBUTAIRE_OPTIONS: { value: TypeAttributaire; label: string }[] = [
  { value: "personne_physique", label: "Personne physique" },
  { value: "collectif_ayants_droit", label: "Collectif d'ayants droit" },
  { value: "personne_morale", label: "Personne morale" },
];

export function labelTypeAttributaire(t: string | null | undefined): string {
  return TYPE_ATTRIBUTAIRE_OPTIONS.find((o) => o.value === t)?.label ?? t ?? "—";
}

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

// ── Fiche d'un lotissement (creation_lotissement / modification_lotissement) ──
//
// Clés **à plat**, jamais imbriquées sous `lotissement` : les deux fonctions
// `_appliquer_creation_lotissement` / `_appliquer_modification_lotissement`
// lisent `p_payload->>'village'` directement. C'est `creation_structure`, et
// elle seule, qui imbrique (cf. `PayloadCreationStructure`).
//
// La liste est **fermée** : ce sont exactement les colonnes que les deux
// fonctions SQL écrivent. Ajouter une clé ici sans l'ajouter en base la ferait
// disparaître en silence à l'approbation.
export type PayloadLotissement = {
  nom: string;
  village?: string | null;
  commune?: string | null;
  district?: string | null;
  superficie_texte?: string | null;
  nb_lots?: number | null;
  nb_ilots?: number | null;
  guide_reference?: string | null;
  /**
   * ⚠️ Écrite à la **création** seulement — `_appliquer_modification_lotissement`
   * ne touche pas cette colonne. Et pour un appelant `chefferie`,
   * `soumettre_saisie` écrase de toute façon la valeur envoyée par sa propre
   * juridiction : ne pas la renseigner côté client pour ce rôle.
   */
  autorite_coutumiere_id?: string | null;
  pv_identification_physique_numero?: string | null;
  pv_identification_physique_date?: string | null;
  pv_identification_physique_scan_url?: string | null;
};

/**
 * 🔴 PIÈGE — `_appliquer_modification_lotissement` fait
 * `village = nullif(btrim(payload->>'village'), '')` **sans `coalesce`**, et
 * pareil pour commune, district, superficie_texte, nb_lots, nb_ilots,
 * guide_reference et les trois champs de PV. Autrement dit **toute clé absente
 * du payload est remise à NULL en base**. Seul `nom` est protégé (il passe par
 * un `coalesce`).
 *
 * Conséquence pour tout écran qui produit ce payload : il doit **charger la
 * fiche complète et la renvoyer entière**, champs non modifiés compris. Un
 * formulaire qui n'enverrait que le champ corrigé viderait la fiche.
 */
export type PayloadModificationLotissement = PayloadLotissement & {
  lotissement_id: string;
};

/**
 * Fiche d'un attributaire (`maj_attributaire`). Sans `attributaire_id` la
 * soumission **crée** ; avec, elle **corrige**.
 *
 * Convention de la fonction d'application, différente de celle du lotissement
 * ci-dessus : **clé absente = valeur inchangée, clé présente à `null` =
 * effacement**. En JSON, `undefined` disparaît de la sérialisation — c'est donc
 * `undefined` qui signifie « ne touche pas » et `null` qui signifie « efface ».
 * Les deux ne sont pas interchangeables ici.
 */
export type PayloadMajAttributaire = {
  attributaire_id?: string;
  nom: string;
  type: TypeAttributaire;
  piece_nature?: string | null;
  piece_num?: string | null;
  telephone?: string | null;
  email?: string | null;
  adresse?: string | null;
};

export type TypeSoumission =
  | "maj_attributions"
  | "creation_structure"
  | "creation_lotissement"
  | "modification_lotissement"
  | "maj_attributaire";
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

/**
 * Forme comparable d'un nom propre : minuscules, sans accent, espaces
 * normalisés. « KOELEA-ACCOR  Extension » et « Koelea-Accor Extension » sont
 * le même lotissement pour un humain ; ni `lotissements.nom` ni
 * `attributaires.nom` ne portant de contrainte d'unicité, c'est au moment de
 * saisir qu'on peut encore l'apercevoir.
 */
export function normaliserNom(nom: string): string {
  return (
    nom
      .normalize("NFD")
      // `\p{Diacritic}` plutôt qu'une plage de caractères écrite en clair : les
      // diacritiques combinants sont invisibles dans le source, et un éditeur
      // qui renormalise le fichier à l'enregistrement changerait la regex sans
      // que personne ne le voie.
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** État actuel d'un lot (chargé depuis la base) pour construire le diff. */
export type LotEtat = {
  lot_id: string;
  ilot: string;
  numero_lot: string;
  statut: string;
  attributaire_id: string | null;
  attributaire_nom: string | null;
  qualite: Qualite | null;
  /**
   * Gel juridique (`lots.verrouille`). **Obligatoire, et volontairement pas
   * optionnel** : un champ facultatif se serait omis en silence à chaque
   * nouveau point de saisie, et c'est exactement ainsi que le garde-fou a
   * manqué. Un littéral qui l'oublie ne compile pas.
   *
   * ⚠️ La garantie **ne tient pas** derrière une assertion : `{…} as LotEtat`
   * passe sans le champ. `FileValidation.tsx` emploie ce motif. Le filet
   * attrape l'oubli ordinaire, pas l'assertion — n'en écrivez pas de nouvelle
   * sur ce type.
   */
  verrouille: boolean;
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

/**
 * Résumé d'une soumission creation_lotissement / modification_lotissement.
 *
 * Le `resume` est **tout ce que l'admin lit dans la file** (le payload n'y est
 * délibérément pas chargé, cf. `useSoumissions`). Sur une correction, savoir
 * combien de champs bougent réellement est la seule information qui distingue
 * une faute de frappe d'une refonte de fiche.
 */
export type ResumeLotissement = {
  nom_lotissement: string;
  /** « Village · Commune · District », déjà assemblé — `null` si rien de tout ça. */
  localisation: string | null;
  nb_ilots: number | null;
  nb_lots: number | null;
  /** Modification seulement : champs dont la valeur change vraiment. */
  champs_modifies?: number;
};

/** Résumé d'une soumission maj_attributaire. */
export type ResumeAttributaire = {
  nom: string;
  type_attributaire: TypeAttributaire;
  /** `true` = nouvelle fiche, `false` = correction d'une fiche existante. */
  creation: boolean;
  /** Correction seulement : champs dont la valeur change vraiment. */
  champs_modifies?: number;
};

/** Tout ce qu'un `resume` peut valoir, selon le `type` de la soumission. */
export type ResumeSoumission =
  | ResumeMaj
  | ResumeCreation
  | ResumeLotissement
  | ResumeAttributaire;
