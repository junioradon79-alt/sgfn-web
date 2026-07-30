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

/**
 * Les formulaires de saisie du registre, tels que la coquille les ouvre.
 *
 * ⚠️ `lot` = **attribuer** un lot (`maj_attributions`) ; `fiche_lot` =
 * corriger ce que le registre **dit** d'un lot (`modification_lot`). Deux actes
 * de nature différente, et un seul des deux est ouvert à la chefferie.
 */
export type EcranSaisie =
  | "lot"
  | "fiche_lot"
  | "ilot"
  | "attributaire"
  | "lotissement"
  | "structure";

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
  // Ouvert le 28/07, une fois son périmètre posé en base (migration
  // 20260728140000). Ses 3 comptes n'ont ni fiche attributaire, ni parcelle,
  // ni terrain suivi : ils ne perdent rien à quitter l'expérience citoyen,
  // dont l'onglet « Parcelles » leur était vide.
  operateur: "pro",
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
  // Pas de « saisie » : `soumettre_saisie` n'accorde aucun formulaire à ce
  // rôle. Son métier dans l'app est la remise du document au client.
  operateur: ["attestations", "messages", "profile"],
};

export function ongletsPour(groupe: string | null | undefined): OngletPro[] {
  return (groupe ? ONGLETS_PAR_ROLE[groupe] : undefined) ?? ONGLETS_PAR_ROLE.admin;
}

/**
 * 🔴 Formulaires ouverts à chaque rôle. Cette table doit rester le MIROIR EXACT
 * de la garde de `soumettre_saisie`, relue en production le 30/07/2026
 * (migration 20260730090000, qui resserre celle du 20260730080000) :
 *
 *   maj_attributions | creation_structure       → admin ou operateur_saisie
 *   maj_attributaire                            → admin, operateur_saisie,
 *                                                 ou chefferie bornée à sa
 *                                                 JURIDICTION et en CORRECTION
 *                                                 seulement (elle ne crée pas
 *                                                 d'identité)
 *   creation_lotissement | modification_lotissement
 *   modification_lot     | modification_ilot    → admin ou chefferie, dans sa
 *                                                 JURIDICTION
 *
 * 🔴 **JURIDICTION, ET JAMAIS FAMILLE.** `maj_attributaire` était le seul type
 * borné par `lot_ids_chefferie()`, qui accorde la juridiction **ou** la famille
 * de rattachement : le même compte franchissait sur ce type et se faisait
 * refuser sur les trois autres, pour le même lotissement. Arbitrage du
 * propriétaire du projet le 30/07 — une chefferie n'agit que sur le territoire
 * dont elle est l'autorité coutumière, jamais par appartenance familiale. C'est
 * sa directive du 29/07 : **chefferie ≠ chef de famille**.
 * ⚠️ `lot_ids_chefferie()` n'a PAS bougé : elle sert aussi à deux policies de
 * LECTURE. C'est la garde d'écriture qui s'est resserrée, elle seule.
 *
 * 🔴 **UNE CHEFFERIE SANS JURIDICTION NE SAISIT RIEN**, quel que soit le type —
 * `creation_lotissement` compris, qui y échappait et déposait une création
 * rattachée à aucune autorité coutumière. Voir `chefferieSansJuridiction`
 * ci-dessous : les deux disent la même chose, l'un à l'écran, l'autre en base.
 *
 * ❌ `maj_attributions` et `creation_structure` restent FERMÉS à la chefferie,
 * et la symétrie apparente est un piège : réattribuer déplace la propriété et
 * déclenche cession puis attestation ; créer une structure fabrique des lots.
 * Ce sont des actes du registre national.
 *
 * Offrir ici un formulaire que le serveur refuse ne produit pas un bug visible
 * à la compilation : la personne remplit une fiche entière, puis se fait
 * rejeter à l'envoi. C'est la seule table du fichier dont une erreur coûte du
 * travail déjà saisi.
 */
const SAISIES_PAR_ROLE: Record<string, EcranSaisie[]> = {
  admin: ["lot", "fiche_lot", "ilot", "attributaire", "lotissement", "structure"],
  operateur_saisie: ["lot", "attributaire", "structure"],
  chefferie: ["fiche_lot", "ilot", "attributaire", "lotissement"],
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
 * ✅ `operateur` a été ouvert le 28/07, mais SEULEMENT après que son périmètre
 * a été posé en base (migration 20260728140000). Jusque-là ses droits
 * d'écriture étaient NATIONAUX — aucune des quatre RPC ne le bornait — et
 * aucune policy SELECT ne lui donnait accès aux attestations : ses 3 comptes
 * voyaient 0 ligne sur 51. Lui ouvrir la lecture seule aurait donc transformé
 * un droit national latent en droit exerçable. Les deux ont été faits d'un
 * même geste ; ne jamais dissocier.
 *
 * ⚠️ Ne pas confondre `operateur` et `operateur_saisie` : ce dernier est dans
 * la coquille métier mais n'a AUCUN droit sur les attestations.
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
  operateur: {
    // Comme l'admin sur le papier — il tient le document — mais borné à son
    // parc par le serveur. La génération reste `est_admin()` seule.
    signatures: ["proprietaire", "operateur", "chefferie"],
    remise: true,
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
  operateur: "Opérateur · Périmètre aménagé",
};

export function libelleRole(groupe: string | null | undefined): string {
  return (groupe ? LIBELLE_ROLE[groupe] : undefined) ?? "Registre national";
}

/**
 * Une chefferie n'est exploitable que rattachée à une autorité coutumière :
 * depuis la migration 20260730090000, `soumettre_saisie` refuse d'emblée TOUTE
 * saisie d'un compte `chefferie` dont `ma_chefferie_id()` est NULL, quel que
 * soit le type, et le dit en nommant la cause.
 *
 * Le cas n'est pas théorique : sur les deux comptes `chefferie` de production,
 * un seul porte une juridiction. L'autre voit pourtant 49 lots — par la branche
 * FAMILLE de `lot_ids_chefferie()`, qui borne la lecture et non l'écriture.
 * Voir des lots sans pouvoir en saisir un seul est exactement ce que cet écran
 * doit annoncer : une liste pleine et des envois tous refusés se lit comme une
 * panne.
 *
 * Mieux vaut donc le dire d'emblée que laisser saisir pour rien.
 */
export function chefferieSansJuridiction(
  groupe: string | null | undefined,
  autoriteCoutumiereId: string | null | undefined,
): boolean {
  return groupe === "chefferie" && !autoriteCoutumiereId;
}

/**
 * Quel rattachement manque, s'il en manque un.
 *
 * Deux rôles sont bornés par un rattachement, et subissent le même double
 * effet quand il est absent : la policy ne renvoie **aucune ligne**, ET la RPC
 * refuserait l'écriture. Une liste vide sans explication se lit « rien à
 * faire » — l'inverse de la vérité.
 *
 *   chefferie → `autorite_coutumiere_id` (`ma_chefferie_id()`)
 *   operateur → `operateur_id`           (`mon_operateur_id()`)
 *
 * Le cas n'est pas théorique : en production, **un compte sur deux** côté
 * chefferie et **un sur trois** côté opérateur n'ont pas de rattachement.
 */
export type RattachementManquant = "chefferie" | "operateur" | null;

export function rattachementManquant(
  groupe: string | null | undefined,
  autoriteCoutumiereId: string | null | undefined,
  operateurId: string | null | undefined,
): RattachementManquant {
  if (groupe === "chefferie" && !autoriteCoutumiereId) return "chefferie";
  if (groupe === "operateur" && !operateurId) return "operateur";
  return null;
}
