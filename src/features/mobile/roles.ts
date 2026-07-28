// Table des expériences mobiles par rôle.
//
// L'app n'a longtemps connu que deux coquilles — `admin` d'un côté, tout le
// reste de l'autre — ce qui laissait 17 comptes sur 21 dans l'expérience
// citoyen, y compris des rôles que la BASE autorise à écrire dans le registre.
// Un `operateur_saisie` pouvait soumettre côté serveur sans qu'aucun écran ne
// le lui permette.
//
// Le choix retenu est une coquille commune (`ProApp`) dont les onglets se
// composent depuis ce fichier, plutôt qu'une coquille par métier : les deux
// existantes divergeaient déjà (nav, geste de retour, profil dupliqués), et
// douze de plus auraient multiplié chaque correctif par douze. Ouvrir un
// nouveau rôle = ajouter une entrée ici.

/** Les quatre formulaires de saisie du registre, tels que la coquille les ouvre. */
export type EcranSaisie = "lot" | "attributaire" | "lotissement" | "structure";

/** Onglets possibles d'une expérience métier. Le FAB « Vérifier » est ajouté par la coquille. */
export type OngletPro = "pilotage" | "files" | "saisie" | "attestations" | "messages" | "profile";

export type Experience = "citoyen" | "pro";

/**
 * Qui bascule sur l'expérience métier. Tout rôle absent de cette table reste
 * citoyen — c'est volontairement le défaut : `collaborateur` et `agent_ia`
 * n'ont quasiment aucun droit en base, et `acquereur` / `proprietaire_terrien`
 * sont des usagers, pas des agents.
 */
const EXPERIENCE_PAR_ROLE: Record<string, Experience> = {
  admin: "pro",
  operateur_saisie: "pro",
  chefferie: "pro",
};

export function experiencePour(groupe: string | null | undefined): Experience {
  return (groupe ? EXPERIENCE_PAR_ROLE[groupe] : undefined) ?? "citoyen";
}

/**
 * Onglets de chaque rôle métier, dans l'ordre d'affichage.
 *
 * `pilotage` et `files` s'appuient sur `useAdminOverview`, qui lit des
 * compteurs NATIONAUX : les réserver à l'admin n'est pas un choix de mise en
 * page, c'est ce que la RLS permet. Les donner à une chefferie afficherait
 * des files vides ou, pire, des chiffres qu'elle n'a pas à connaître.
 */
const ONGLETS_PAR_ROLE: Record<string, OngletPro[]> = {
  admin: ["pilotage", "files", "messages", "profile"],
  operateur_saisie: ["saisie", "messages", "profile"],
  chefferie: ["saisie", "attestations", "messages", "profile"],
};

export function ongletsPour(groupe: string | null | undefined): OngletPro[] {
  return (groupe ? ONGLETS_PAR_ROLE[groupe] : undefined) ?? ONGLETS_PAR_ROLE.admin;
}

/**
 * 🔴 Formulaires ouverts à chaque rôle. Cette table doit rester le MIROIR EXACT
 * de la garde de `soumettre_saisie` (migration 20260710_operateur_saisie_module,
 * relue en production le 27/07) :
 *
 *   maj_attributions | creation_structure | maj_attributaire → admin ou operateur_saisie
 *   creation_lotissement | modification_lotissement          → admin ou chefferie
 *
 * Offrir ici un formulaire que le serveur refuse ne produit pas un bug visible
 * à la compilation : la personne remplit une fiche entière, puis se fait
 * rejeter à l'envoi. C'est la seule table du fichier dont une erreur coûte du
 * travail déjà saisi.
 */
const SAISIES_PAR_ROLE: Record<string, EcranSaisie[]> = {
  admin: ["lot", "attributaire", "lotissement", "structure"],
  operateur_saisie: ["lot", "attributaire", "structure"],
  chefferie: ["lotissement"],
};

export function saisiesPour(groupe: string | null | undefined): EcranSaisie[] {
  return (groupe ? SAISIES_PAR_ROLE[groupe] : undefined) ?? [];
}

/**
 * 🔴 Ce que chaque rôle peut faire sur une attestation. Même discipline que
 * `SAISIES_PAR_ROLE` : miroir EXACT des gardes serveur, relues en production le
 * 28/07 (`signer_attestation`, `marquer_attestation_delivree`,
 * `generer_attestation_exceptionnelle`) :
 *
 *   generer_attestation_exceptionnelle → est_admin() seul
 *   signer_attestation                 → admin et operateur (les 3 signatures)
 *                                        chefferie (la sienne, dans sa juridiction)
 *   marquer_attestation_delivree       → admin ou operateur
 *
 * ⚠️ `operateur` est ABSENT de cette table, et ce n'est pas un oubli : le rôle
 * a bien ces droits d'écriture, mais AUCUNE policy SELECT ne lui donne accès
 * aux attestations (`attcess_read` ne cite que admin, le titulaire et le
 * commissaire ; `attcess_chefferie_read` que la chefferie). Vérifié en
 * production : ses 3 comptes voient 0 ligne sur 51. Lui ouvrir l'écran
 * afficherait une liste vide surmontée de boutons parfaitement fonctionnels —
 * le pire des deux mondes. Rouvrir la question demande une migration RLS, donc
 * un arbitrage, pas une entrée de plus ici.
 *
 * ⚠️ Ne pas confondre `operateur` et `operateur_saisie` : ce dernier est dans
 * la coquille métier mais n'a aucun droit sur les attestations.
 */
export type ActionsAttestation = {
  /** Signatures que le rôle peut constater. Vide = aucun accès aux attestations. */
  signatures: Signature[];
  /** Peut enregistrer la remise physique (`marquer_attestation_delivree`). */
  remise: boolean;
  /** Peut générer par dérogation (`generer_attestation_exceptionnelle`). */
  generation: boolean;
};

/** Reprise de `useAttestations` sans l'importer : `roles.ts` ne dépend d'aucun écran. */
type Signature = "proprietaire" | "operateur" | "chefferie";

const ATTESTATIONS_PAR_ROLE: Record<string, ActionsAttestation> = {
  admin: {
    signatures: ["proprietaire", "operateur", "chefferie"],
    remise: true,
    generation: true,
  },
  chefferie: {
    // `signer_attestation` refuse à une chefferie toute signature autre que la
    // sienne, message à l'appui. Les trois pastilles restent AFFICHÉES — c'est
    // l'état du document — mais une seule est actionnable.
    signatures: ["chefferie"],
    remise: false,
    generation: false,
  },
};

const AUCUNE_ACTION: ActionsAttestation = { signatures: [], remise: false, generation: false };

export function attestationsPour(groupe: string | null | undefined): ActionsAttestation {
  return (groupe ? ATTESTATIONS_PAR_ROLE[groupe] : undefined) ?? AUCUNE_ACTION;
}

/** Vrai si le rôle a la moindre raison d'ouvrir l'écran des attestations. */
export function voitLesAttestations(groupe: string | null | undefined): boolean {
  const a = attestationsPour(groupe);
  return a.signatures.length > 0 || a.remise || a.generation;
}

/** Libellé affiché sous le nom, sur l'écran racine de l'expérience métier. */
const LIBELLE_ROLE: Record<string, string> = {
  admin: "Administration · Centre National de Pilotage",
  operateur_saisie: "Opérateur de saisie · Registre national",
  chefferie: "Chefferie · Juridiction coutumière",
};

export function libelleRole(groupe: string | null | undefined): string {
  return (groupe ? LIBELLE_ROLE[groupe] : undefined) ?? "Registre national";
}

/**
 * Une chefferie n'est exploitable que rattachée à une autorité coutumière :
 * `soumettre_saisie` force `autorite_coutumiere_id` à `ma_chefferie_id()`, et
 * refuse toute modification d'un lotissement hors juridiction. Sans
 * rattachement, la fonction ne renvoie rien d'utilisable et TOUTE soumission
 * échoue — le cas n'est pas théorique : sur les deux comptes `chefferie` en
 * production, un seul porte une juridiction.
 *
 * Mieux vaut donc le dire d'emblée que laisser saisir pour rien.
 */
export function chefferieSansJuridiction(
  groupe: string | null | undefined,
  autoriteCoutumiereId: string | null | undefined,
): boolean {
  return groupe === "chefferie" && !autoriteCoutumiereId;
}
