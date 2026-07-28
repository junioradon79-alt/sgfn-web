"use client";

// Couche de données des attestations, côté app mobile.
//
// 🔴 Aucune écriture directe : les quatre actes passent par des RPC
// `security definer` (`signer_attestation`, `marquer_attestation_delivree`,
// `generer_attestation_exceptionnelle`). Les tables n'ont d'ailleurs qu'une
// policy d'écriture, `est_admin()` — une chefferie ne peut RIEN écrire en
// direct, alors que le serveur l'autorise bel et bien à constater sa propre
// signature. Passer par la RPC est donc la seule voie, pas une préférence.
//
// Ce que ces fonctions vérifient et qu'on ne réimplémente pas ici : la
// juridiction de la chefferie, le paiement préalable de la signature Chefferie
// sur une Attestation d'Attribution de Lot, la liste des signatures réellement
// requises avant remise, et l'unicité d'une attestation valide par titulaire.
//
// Client porteur de session (`@/utils/supabase/client`), jamais le singleton
// `@/lib/supabase` : celui-ci interroge en anonyme et renverrait des listes
// vides sans la moindre erreur.

import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/utils/supabase/client";
import {
  SIGNATURES_ATTESTATION,
  SIGNATURES_PAR_DEFAUT,
  libelleSignature,
} from "@/lib/signatures-attestation";
import type { ActionsAttestation } from "../roles";

/** Statuts de `statut_att_cession`, tels qu'ils existent en base. */
export type StatutAttestation = "a_generer" | "generee" | "delivree" | "revoquee";

/** Les trois signatures constatables. `signer_attestation` n'en accepte pas d'autre. */
export type Signature = "proprietaire" | "operateur" | "chefferie";

/**
 * Ordre d'affichage et libellés viennent de `@/lib/signatures-attestation`,
 * partagé avec le Coffre-fort documentaire et l'écran Validations du web.
 *
 * 🔴 Ce module a été écrit précisément pour qu'une copie ne puisse pas
 * diverger : le titre de `proprietaire` n'est pas fixe — « Chef de famille »
 * sur un lotissement rattaché à une seule famille, « Propriétaire terrien »
 * sinon. Une constante locale l'aurait figé au mauvais mot sur la moitié du
 * parc, sans que rien ne le signale.
 */
export const TOUTES_SIGNATURES: Signature[] = SIGNATURES_ATTESTATION.map(
  (s) => s.cle as Signature,
);

export { libelleSignature };

/**
 * Une attestation de cession, réduite à ce que l'écran mobile affiche.
 *
 * 🔴 `signaturesRequises` vient du **lotissement**, et varie réellement d'un
 * lotissement à l'autre : en production, « Koelea-Accor revu » n'en exige que
 * deux (propriétaire + chefferie) là où « Brignan Kakodji » en exige trois.
 * Afficher trois pastilles partout ferait croire à une signature manquante sur
 * une attestation en réalité complète — et `marquer_attestation_delivree` ne
 * contrôle, lui, que les signatures requises.
 */
export type AttestationMobile = {
  id: string;
  reference: string;
  statut: StatutAttestation;
  dateEmission: string | null;
  creeLe: string | null;
  /** Générée par dérogation (`generer_attestation_exceptionnelle`). */
  exception: boolean;
  exceptionMotif: string | null;
  signatures: Record<Signature, string | null>;
  signaturesRequises: Signature[];
  delivreeLe: string | null;
  titulaire: string | null;
  lotId: string | null;
  numeroLot: string | null;
  ilot: string | null;
  lotissement: string | null;
  /**
   * Décide du titre du signataire « proprietaire » (`libelleSignature`) : chef
   * de famille sur un lotissement d'une seule lignée, propriétaire terrien
   * quand il en couvre plusieurs. Se déduit de `lotissements.famille_id`.
   */
  lotissementAUneFamille: boolean;
};

/** Ce que le serveur répond sur l'aptitude d'un lot à porter une attestation. */
export type DiagnosticLot = {
  eligible: boolean;
  /** Libellés des pièces manquantes, tels que `manques_documentaires_lot` les nomme. */
  manques: string[];
  /** Attestation déjà existante et non révoquée sur ce lot, le cas échéant. */
  existante: AttestationMobile | null;
};

/** Une réponse réseau ne se réduit jamais à `null` : l'erreur doit remonter. */
export type Resultat<T> =
  | { ok: true; valeur: T }
  | {
      ok: false;
      error: string;
      /**
       * 🔴 Distingue un refus du serveur (la fonction s'est exécutée et a dit
       * non — rien n'a été écrit) d'une réponse perdue en vol, où l'état de la
       * base est **inconnu**. Un acte annoncé « échoué » alors qu'il a abouti
       * ferait re-signer, ou re-générer, une attestation déjà traitée.
       * Même mécanique que `useSaisieRegistre`.
       */
      incertain?: boolean;
    };

export type FileAttestations = {
  attestations: AttestationMobile[];
  loading: boolean;
  erreur: string | null;
  /**
   * Attestations sur lesquelles CE rôle peut encore constater une signature.
   * Pas « celles à qui il manque une signature » — cf. `signaturesActionnables`.
   */
  aSigner: number;
  /** Attestations que CE rôle peut remettre. Toujours 0 sans le droit de remise. */
  aRemettre: number;
  recharger: () => Promise<void>;
  constater: (id: string, signature: Signature) => Promise<Resultat<void>>;
  remettre: (id: string) => Promise<Resultat<void>>;
  /** `titulaireId` = attributaire actuel du lot ; c'est lui que le serveur regarde. */
  diagnostiquerLot: (lotId: string, titulaireId: string | null) => Promise<Resultat<DiagnosticLot>>;
  genererExceptionnelle: (lotId: string, motif: string) => Promise<Resultat<string>>;
};

/**
 * L'embed part des attestations (51 lignes en production, bornées par le RLS)
 * et non des lots (898) : c'est le sens qui a tenu, alors que
 * `lots → attributions → attributaires` avait déjà provoqué un dépassement de
 * délai rendu en « liste vide » sur Brignan et ses 846 lots.
 *
 * Les deux clés étrangères sont nommées explicitement : `attestations_cession`
 * pointe **sept fois** vers `profiles` et deux fois vers d'autres tables, et un
 * embed ambigu est refusé par PostgREST.
 */
const COLONNES =
  "id, reference, statut, date_emission, cree_le, delivree_le, exception, exception_motif, " +
  "sig_proprietaire_le, sig_operateur_le, sig_chefferie_le, lot_id, " +
  "attributaires!attestations_cession_acquereur_id_fkey(nom), " +
  "lots!attestations_cession_lot_id_fkey(numero_lot, ilots(numero, lotissements(nom, signatures_requises, famille_id)))";

type LigneAttestation = {
  id: string;
  reference: string | null;
  statut: string | null;
  date_emission: string | null;
  cree_le: string | null;
  delivree_le: string | null;
  exception: boolean | null;
  exception_motif: string | null;
  sig_proprietaire_le: string | null;
  sig_operateur_le: string | null;
  sig_chefferie_le: string | null;
  lot_id: string | null;
  attributaires: { nom: string | null } | null;
  lots: {
    numero_lot: string | null;
    ilots: {
      numero: string | null;
      lotissements: {
        nom: string | null;
        signatures_requises: string[] | null;
        famille_id: string | null;
      } | null;
    } | null;
  } | null;
};

/**
 * Le défaut à trois signatures vient de `SIGNATURES_PAR_DEFAUT` (module
 * partagé), lui-même aligné sur le `coalesce` que fait
 * `marquer_attestation_delivree` côté serveur. Diverger ici afficherait une
 * attestation « complète » que le serveur refuserait ensuite de remettre.
 *
 * L'ordre rendu est toujours celui de `SIGNATURES_ATTESTATION`, jamais celui
 * de la colonne : le tableau en base n'a pas d'ordre garanti, et deux
 * lotissements afficheraient leurs pastilles dans des ordres différents.
 */
function normaliserSignatures(brut: string[] | null | undefined): Signature[] {
  const source = brut && brut.length > 0 ? brut : SIGNATURES_PAR_DEFAUT;
  const connues = TOUTES_SIGNATURES.filter((s) => source.includes(s));
  return connues.length > 0 ? connues : (SIGNATURES_PAR_DEFAUT as Signature[]);
}

function mapper(l: LigneAttestation): AttestationMobile {
  const lotissement = l.lots?.ilots?.lotissements ?? null;
  return {
    id: l.id,
    reference: l.reference ?? "—",
    statut: (l.statut ?? "generee") as StatutAttestation,
    dateEmission: l.date_emission,
    creeLe: l.cree_le,
    exception: l.exception === true,
    exceptionMotif: l.exception_motif,
    signatures: {
      proprietaire: l.sig_proprietaire_le,
      operateur: l.sig_operateur_le,
      chefferie: l.sig_chefferie_le,
    },
    signaturesRequises: normaliserSignatures(lotissement?.signatures_requises),
    delivreeLe: l.delivree_le,
    titulaire: l.attributaires?.nom ?? null,
    lotId: l.lot_id,
    numeroLot: l.lots?.numero_lot ?? null,
    ilot: l.lots?.ilots?.numero ?? null,
    lotissement: lotissement?.nom ?? null,
    lotissementAUneFamille: lotissement?.famille_id != null,
  };
}

/**
 * Une attestation révoquée n'est plus signable : `signer_attestation` la
 * refuse explicitement (« Cette attestation est revoquee »). Deux lignes sont
 * dans ce cas en production — offrir le geste les enverrait droit dans le mur.
 */
export function estSignable(a: AttestationMobile): boolean {
  return a.statut === "generee";
}

/** Signatures requises encore absentes. Vide = l'attestation peut être remise. */
export function signaturesManquantes(a: AttestationMobile): Signature[] {
  return a.signaturesRequises.filter((s) => !a.signatures[s]);
}

/**
 * 🔴 Ce que CE rôle peut encore constater sur CETTE attestation — et non ce
 * qu'il manque au document.
 *
 * La distinction n'est pas théorique : en production, 48 attestations
 * attendent à la fois la chefferie et le chef de famille. Une chefferie qui
 * constate ses 48 signatures — la totalité de son travail — les laisse
 * incomplètes côté chef de famille. Compter « ce qui manque » ferait donc
 * afficher 48 à sa pastille pour toujours, y compris après qu'elle a tout
 * fait. Un compteur qui ne redescend jamais cesse d'être lu.
 */
export function signaturesActionnables(
  a: AttestationMobile,
  actions: ActionsAttestation,
): Signature[] {
  if (!estSignable(a)) return [];
  return signaturesManquantes(a).filter((s) => actions.signatures.includes(s));
}

/** Vrai si CE rôle peut enregistrer la remise de CETTE attestation. */
export function remisePossible(a: AttestationMobile, actions: ActionsAttestation): boolean {
  return estSignable(a) && actions.remise && signaturesManquantes(a).length === 0;
}

/** Au-delà, la liste ne se parcourt plus au pouce. */
const LIMITE = 200;

/**
 * File des attestations visibles par la session.
 *
 * Le hook **ne filtre rien par rôle** : c'est le RLS qui décide. Un admin voit
 * tout, une chefferie uniquement les lots de sa juridiction, un titulaire les
 * siennes. Rejouer ce filtrage ici créerait une seconde règle, vouée à diverger
 * de celle qui fait autorité.
 *
 * `actif` évite de requêter pour un rôle qui n'a aucun accès aux attestations.
 *
 * `actions` ne filtre PAS la liste — elle sert aux compteurs, qui doivent
 * mesurer ce que ce rôle peut faire et non l'état brut des documents.
 */
export function useAttestations(
  actif: boolean,
  actions: ActionsAttestation,
): FileAttestations {
  const [supabase] = useState(() => createClient());
  // `null` = jamais chargé, ce qui distingue « on attend » de « il n'y en a
  // pas ». Un booléen posé depuis l'effet resterait bloqué à `true` sur toute
  // sortie anticipée (même raison que dans `useSoumissions`).
  const [attestations, setAttestations] = useState<AttestationMobile[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Un acte recharge la file : la réponse peut revenir après que l'écran a été
  // quitté. On garde donc l'état monté ET le rang de la demande.
  const monte = useRef(true);
  const demande = useRef(0);
  useEffect(() => {
    monte.current = true;
    return () => {
      monte.current = false;
    };
  }, []);

  const charger = useCallback(async () => {
    const rang = (demande.current += 1);
    const { data, error } = await supabase
      .from("attestations_cession")
      .select(COLONNES)
      // Les plus récentes d'abord : ce sont celles dont on attend le traitement.
      .order("cree_le", { ascending: false })
      .limit(LIMITE);

    // Une réponse dépassée par un rechargement plus récent — ou arrivée après
    // un démontage — ne doit pas écraser l'écran.
    if (!monte.current || rang !== demande.current) return;

    if (error) {
      setErreur(error.message);
      return;
    }
    setErreur(null);
    setAttestations(((data ?? []) as unknown as LigneAttestation[]).map(mapper));
  }, [supabase]);

  useEffect(() => {
    if (!actif) return;
    // Enveloppé dans une fonction asynchrone : le premier `setState` n'a lieu
    // qu'au retour du réseau, jamais pendant le rendu de l'effet (règle
    // `react-hooks/set-state-in-effect`).
    void (async () => {
      await charger();
    })();
  }, [actif, charger]);

  /**
   * Traduit une erreur PostgREST en `Resultat`. `code` renseigné (`P0001` pour
   * un `raise exception`, `42501` pour un refus de droits) prouve que la base a
   * répondu non ; son absence trahit un échec de transport, et l'état du
   * serveur est alors inconnu.
   */
  const echec = useCallback(<T,>(error: { message: string; code?: string | null }): Resultat<T> => {
    return { ok: false, error: error.message, incertain: !error.code };
  }, []);

  const constater = useCallback(
    async (id: string, signature: Signature): Promise<Resultat<void>> => {
      const { error } = await supabase.rpc("signer_attestation", {
        p_id: id,
        p_signature: signature,
      });
      if (error) return echec(error);
      await charger();
      return { ok: true, valeur: undefined };
    },
    [supabase, charger, echec],
  );

  const remettre = useCallback(
    async (id: string): Promise<Resultat<void>> => {
      const { error } = await supabase.rpc("marquer_attestation_delivree", { p_id: id });
      if (error) return echec(error);
      await charger();
      return { ok: true, valeur: undefined };
    },
    [supabase, charger, echec],
  );

  /**
   * Éligibilité d'un lot et pièces manquantes, telles que le serveur les
   * calcule. Rien n'est déduit côté client : les conditions du Niveau 1 (guide
   * de répartition, APFC délivrée, PV de répartition, ou dérogation) vivent
   * dans `lot_peut_emettre_attestation_niveau1`.
   *
   * ⚠️ `manques_documentaires_lot` existe en **deux** signatures ; on appelle
   * explicitement celle à deux paramètres avec `p_niveau = 1`, sans quoi
   * PostgREST choisirait l'autre — qui répond pour la règle historique, plus
   * exigeante, et afficherait des manques sans rapport avec ce que la
   * génération contrôle réellement.
   */
  const diagnostiquerLot = useCallback(
    async (lotId: string, titulaireId: string | null): Promise<Resultat<DiagnosticLot>> => {
      // 🔴 Le blocage doit porter sur le TITULAIRE ACTUEL, pas sur le lot :
      // `generer_attestation_exceptionnelle` ne refuse que s'il existe déjà une
      // attestation non révoquée `acquereur_id = <titulaire actuel>`. Sur une
      // revente, l'attestation du propriétaire précédent est toujours là et
      // valide — filtrer sur le seul lot refuserait ce que le serveur accepte,
      // et sans recours depuis l'app.
      let requeteExistante = supabase
        .from("attestations_cession")
        .select(COLONNES)
        .eq("lot_id", lotId)
        .neq("statut", "revoquee");
      if (titulaireId) requeteExistante = requeteExistante.eq("acquereur_id", titulaireId);

      const [elig, manques, existante] = await Promise.all([
        supabase.rpc("lot_peut_emettre_attestation_niveau1", { p_lot_id: lotId }),
        supabase.rpc("manques_documentaires_lot", { p_lot_id: lotId, p_niveau: 1 }),
        requeteExistante.order("cree_le", { ascending: false }).limit(1),
      ]);

      // L'éligibilité est la seule réponse dont l'absence empêcherait de
      // décider : sans elle, l'écran ne saurait pas quoi proposer.
      if (elig.error) return echec(elig.error);

      const lignes = (existante.data ?? []) as unknown as LigneAttestation[];
      return {
        ok: true,
        valeur: {
          eligible: elig.data === true,
          // Une liste de manques en échec revient vide — indistinguable d'un
          // dossier complet. On préfère donc ne rien affirmer : l'écran dit
          // « éligible » ou « non éligible », et n'énumère que ce qu'il a
          // réellement reçu.
          manques: manques.error ? [] : ((manques.data ?? []) as string[]),
          existante: lignes.length > 0 ? mapper(lignes[0]) : null,
        },
      };
    },
    [supabase, echec],
  );

  const genererExceptionnelle = useCallback(
    async (lotId: string, motif: string): Promise<Resultat<string>> => {
      const { data, error } = await supabase.rpc("generer_attestation_exceptionnelle", {
        p_lot_id: lotId,
        p_motif: motif.trim(),
      });
      if (error) return echec(error);
      await charger();
      const ligne = data as unknown as LigneAttestation | null;
      return { ok: true, valeur: ligne?.reference ?? "" };
    },
    [supabase, charger, echec],
  );

  const liste = attestations ?? [];
  // Dérivés, jamais posés dans un effet : impossible d'oublier de les
  // redescendre après un rechargement. Et dérivés du RÔLE, pas du seul état
  // des documents — sans quoi la pastille d'une chefferie resterait à 48
  // après qu'elle a constaté ses 48 signatures.
  const aSigner = liste.filter((a) => signaturesActionnables(a, actions).length > 0).length;
  const aRemettre = liste.filter((a) => remisePossible(a, actions)).length;

  return {
    attestations: liste,
    // 🔴 Une erreur ne masque plus une liste DÉJÀ chargée. Le rechargement qui
    // suit un constat réussi peut échouer : l'écran basculait alors sur
    // « Liste illisible » alors que l'acte venait d'aboutir et que le message
    // de succès s'affichait juste au-dessus. Même règle que `ChoixLotissement`.
    loading: actif && attestations === null && erreur === null,
    erreur,
    aSigner,
    aRemettre,
    recharger: charger,
    constater,
    remettre,
    diagnostiquerLot,
    genererExceptionnelle,
  };
}

