"use client";

// Couche de données du portage mobile « Tier 2 » — co-signature APFC et
// signature Niveau 2/3 (Attestation d'Attribution de Lot), décidé et cadré par
// le propriétaire du projet le 17/08/2026.
//
// Ces deux gestes existaient déjà côté web, sur `/dashboard/validations`
// (`signerApfc` → RPC `signer_apfc`, `signerAttributionLot` → RPC
// `signer_attestation_attribution_lot`), mais nulle part côté mobile — alors
// que le geste qu'ils enregistrent, une signature CONSTATÉE sur un document
// papier, se pose typiquement sur le terrain, pas devant un ordinateur.
//
// 🔴 Fichier FRÈRE de `useAttestations.ts`, pas une extension de celui-ci :
// `attestations_coutumieres` (APFC) et `attestations_attribution_lot` (AAL)
// n'ont NI le même jeu de colonnes de signature (APFC : chef_famille /
// chef_village / cvgfr — AAL : proprietaire / operateur / chefferie, comme la
// cession) ni le même cycle de vie (l'AAL porte un paiement de signature qui
// bloque le geste ; l'APFC n'en a aucun). Les fusionner dans un seul type
// `AttestationMobile` aurait fait porter des champs sans objet sur l'une ou
// l'autre moitié des lignes.
//
// Ce qui EST partagé, en revanche, et vient du même module que l'écran web
// (`@/lib/signatures-attestation`) : la règle « ce que ce lotissement exige »
// et « ce créneau attend-il vraiment une signature ». L'écrire une seconde
// fois ici aurait exactement le risque que ce module a été créé pour éviter
// (cf. son en-tête) — une copie qui diverge sans que rien ne le signale.
//
// 🔴 Restreint au SEUL rôle `chefferie`. Le serveur autoriserait aussi
// l'admin (`signer_apfc` constate les trois signatures pour `est_admin()`,
// `signer_attestation_attribution_lot` de même) — mais ce portage mobile ne
// couvre que l'expérience de terrain de la chefferie, par arbitrage explicite
// du 17/08/2026 : voir `ActionsAttestation.apfc` / `attributionLot` dans
// `../roles`, qui bornent l'affichage en plus de ce hook.
//
// Signatures CONSTATÉES, jamais électroniques — même doctrine que
// `useAttestations.ts` (migration `20260722160000`) : le document est signé
// sur papier, l'app enregistre le constat et qui l'a fait.

import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/utils/supabase/client";
import {
  apfcAttendSignature,
  cessionAttendSignature,
  type ApfcSignable,
  type DatesSignatureCession,
  type LotissementSignataire,
} from "@/lib/signatures-attestation";
import type { Resultat } from "./useAttestations";

/**
 * Une APFC, réduite à ce que l'écran mobile affiche — étend `ApfcSignable`
 * (défini dans `@/lib/signatures-attestation`) pour pouvoir être passée telle
 * quelle à `etatSignaturesApfc`/`apfcAttendSignature`, sans reconstruire un
 * second objet à la frontière hook → écran.
 */
export type ApfcMobile = ApfcSignable & {
  id: string;
  reference: string | null;
  numero: string | null;
  statut: string;
  dateDelivrance: string | null;
  chefDeFamille: string | null;
  lotissementNom: string | null;
};

/**
 * Une Attestation d'Attribution de Lot (Niveau 2/3), réduite à ce que l'écran
 * mobile affiche — étend `DatesSignatureCession` pour la même raison que
 * `ApfcMobile` ci-dessus : passable telle quelle à `etatSignaturesCession`/
 * `cessionAttendSignature`, qui servent déjà l'écran Validations du web et la
 * cession côté mobile.
 */
export type AttributionLotMobile = DatesSignatureCession & {
  id: string;
  reference: string;
  statut: string;
  niveau: number;
  /** `null` = paiement non confirmé : `signer_attestation_attribution_lot` refuse la branche 'chefferie'. */
  signaturePayeeLe: string | null;
  dateEmission: string | null;
  titulaire: string | null;
  lotId: string | null;
  numeroLot: string | null;
  ilot: string | null;
  lotissement: LotissementSignataire;
  lotissementNom: string | null;
  /** Décide du titre du signataire « proprietaire » (`libelleSignature`), comme sur la cession. */
  lotissementAUneFamille: boolean;
};

export type FileApfc = {
  items: ApfcMobile[];
  loading: boolean;
  erreur: string | null;
  /** APFC sur lesquelles le chef de village peut encore constater sa signature. */
  aSigner: number;
  recharger: () => Promise<void>;
  constater: (id: string) => Promise<Resultat<void>>;
};

export type FileAttributionLot = {
  items: AttributionLotMobile[];
  loading: boolean;
  erreur: string | null;
  /** AAL sur lesquelles la chefferie peut encore constater sa signature (paiement confirmé compris). */
  aSigner: number;
  recharger: () => Promise<void>;
  constater: (id: string) => Promise<Resultat<void>>;
};

export type ValidationsChefferie = {
  apfc: FileApfc;
  attributionLot: FileAttributionLot;
};

const LIMITE = 200;

// ─── APFC ─────────────────────────────────────────────────────────────────
//
// Aucun filtre de signature à la lecture : contrairement à l'AAL ci-dessous,
// l'écran web (`/dashboard/validations`) charge TOUTES les APFC de la
// juridiction — y compris déjà co-signées — et calcule le compteur côté
// client via `apfcAttendSignature`. On reprend ce choix ici plutôt que
// d'inventer un filtre serveur que le web n'a pas : une APFC déjà signée
// reste visible (état « Validé »), ce qui est aussi la seule ligne qu'une
// juridiction avec une seule APFC (Ebimpe, en production) a jamais à montrer.
const COLONNES_APFC =
  "id, reference, numero, statut, date_delivrance, chef_de_famille, " +
  "sig_chef_famille_le, sig_chef_village_le, sig_cvgfr_le, cvgfr_id, " +
  "lotissement:lotissements!attestations_coutumieres_lotissement_id_fkey(nom, signatures_requises)";

type LigneApfc = {
  id: string;
  reference: string | null;
  numero: string | null;
  statut: string | null;
  date_delivrance: string | null;
  chef_de_famille: string | null;
  sig_chef_famille_le: string | null;
  sig_chef_village_le: string | null;
  sig_cvgfr_le: string | null;
  cvgfr_id: string | null;
  lotissement: { nom: string | null; signatures_requises: string[] | null } | null;
};

function mapperApfc(l: LigneApfc): ApfcMobile {
  return {
    id: l.id,
    reference: l.reference,
    numero: l.numero,
    statut: l.statut ?? "generee",
    dateDelivrance: l.date_delivrance,
    chefDeFamille: l.chef_de_famille,
    sig_chef_famille_le: l.sig_chef_famille_le,
    sig_chef_village_le: l.sig_chef_village_le,
    sig_cvgfr_le: l.sig_cvgfr_le,
    cvgfr_id: l.cvgfr_id,
    lotissement: l.lotissement ? { signatures_requises: l.lotissement.signatures_requises } : null,
    lotissementNom: l.lotissement?.nom ?? null,
  };
}

/** Vrai si le chef de village peut encore constater sa signature sur cette APFC. */
export function apfcActionnable(a: ApfcMobile): boolean {
  return apfcAttendSignature(a, "sig_chef_village_le");
}

// ─── Attestation d'Attribution de Lot (Niveau 2/3) ─────────────────────────
//
// Ici, à l'inverse de l'APFC, on filtre côté serveur — même choix que le web :
// `sig_chefferie_le is null` (signature pas encore constatée) et
// `statut <> 'revoquee'` (une AAL révoquée n'est plus signable, la RPC la
// refuse explicitement). Une AAL déjà signée par la chefferie n'a plus rien à
// faire dans cette file.
const COLONNES_AAL =
  "id, reference, statut, niveau, signature_payee_le, date_emission, " +
  "sig_proprietaire_le, sig_operateur_le, sig_chefferie_le, lot_id, " +
  "attributaires!attestations_attribution_lot_titulaire_attributaire_id_fkey(nom), " +
  "lots!attestations_attribution_lot_lot_id_fkey(numero_lot, ilots(numero, lotissements(nom, signatures_requises, famille_id)))";

type LigneAal = {
  id: string;
  reference: string;
  statut: string;
  niveau: number;
  signature_payee_le: string | null;
  date_emission: string | null;
  sig_proprietaire_le: string | null;
  sig_operateur_le: string | null;
  sig_chefferie_le: string | null;
  lot_id: string | null;
  attributaires: { nom: string | null } | null;
  lots: {
    numero_lot: string | null;
    ilots: {
      numero: string | null;
      lotissements: { nom: string | null; signatures_requises: string[] | null; famille_id: string | null } | null;
    } | null;
  } | null;
};

function mapperAal(l: LigneAal): AttributionLotMobile {
  const lotissement = l.lots?.ilots?.lotissements ?? null;
  return {
    id: l.id,
    reference: l.reference ?? "—",
    statut: l.statut ?? "generee",
    niveau: l.niveau,
    signaturePayeeLe: l.signature_payee_le,
    dateEmission: l.date_emission,
    sig_proprietaire_le: l.sig_proprietaire_le,
    sig_operateur_le: l.sig_operateur_le,
    sig_chefferie_le: l.sig_chefferie_le,
    titulaire: l.attributaires?.nom ?? null,
    lotId: l.lot_id,
    numeroLot: l.lots?.numero_lot ?? null,
    ilot: l.lots?.ilots?.numero ?? null,
    lotissement: lotissement
      ? { signatures_requises: lotissement.signatures_requises, famille_id: lotissement.famille_id }
      : null,
    lotissementNom: lotissement?.nom ?? null,
    lotissementAUneFamille: lotissement?.famille_id != null,
  };
}

/** Une AAL révoquée n'est plus signable — même garde que côté web. */
export function aalEstSignable(a: AttributionLotMobile): boolean {
  return a.statut !== "revoquee";
}

/**
 * Vrai si la chefferie peut encore constater sa signature sur cette AAL :
 * non révoquée, paiement de signature confirmé, et le lotissement exige
 * effectivement la chefferie (`signatures_requises`).
 *
 * 🔴 Seules les DEUX PREMIÈRES conditions sont vérifiées côté serveur, par
 * `signer_attestation_attribution_lot` (révocation, paiement — cf.
 * `20260812100000_tarif_signature_attribution_lot_550k_vers_380k.sql`). La
 * troisième — `signatures_requises` — n'y est PAS référencée : c'est une
 * garde CLIENT SEULEMENT, reprise de `cessionAttendSignature`
 * (`@/lib/signatures-attestation`). Ne pas la retirer en la croyant
 * redondante avec une vérification serveur qui n'existe pas : sans elle, le
 * bouton resterait actionnable sur un lotissement qui n'exige pas la
 * chefferie, et `signer_attestation_attribution_lot` n'a rien pour refuser.
 */
export function aalActionnable(a: AttributionLotMobile): boolean {
  return (
    aalEstSignable(a) &&
    Boolean(a.signaturePayeeLe) &&
    cessionAttendSignature(a, a.lotissement, "chefferie")
  );
}

/**
 * Hook « Tier 2 » : APFC à co-signer et AAL à signer, pour la chefferie
 * connectée. `actif` doit venir de `ActionsAttestation.apfc || .attributionLot`
 * (cf. `../roles`) — pas d'un test direct du groupe, pour rester une seule
 * source de vérité avec l'écran qui décide de l'affichage.
 *
 * Comme `useAttestations`, la juridiction n'est PAS filtrée ici : c'est la RLS
 * (`apfc_read`, `attribution_lot_chefferie_read`) qui borne les deux lectures
 * à `ma_chefferie_id()`. Rejouer le filtre côté client créerait une seconde
 * règle, vouée à diverger de celle qui fait autorité.
 */
export function useValidationsChefferie(actif: boolean): ValidationsChefferie {
  const [supabase] = useState(() => createClient());

  const [apfcItems, setApfcItems] = useState<ApfcMobile[] | null>(null);
  const [erreurApfc, setErreurApfc] = useState<string | null>(null);
  const [aalItems, setAalItems] = useState<AttributionLotMobile[] | null>(null);
  const [erreurAal, setErreurAal] = useState<string | null>(null);

  // Même garde monté/rang que `useAttestations` : une réponse dépassée par un
  // rechargement plus récent — ou arrivée après un démontage — ne doit pas
  // écraser l'écran.
  const monte = useRef(true);
  const rangApfc = useRef(0);
  const rangAal = useRef(0);
  useEffect(() => {
    monte.current = true;
    return () => {
      monte.current = false;
    };
  }, []);

  const chargerApfc = useCallback(async () => {
    const rang = (rangApfc.current += 1);
    const { data, error } = await supabase
      .from("attestations_coutumieres")
      .select(COLONNES_APFC)
      .order("id", { ascending: true })
      .limit(LIMITE);
    if (!monte.current || rang !== rangApfc.current) return;
    if (error) {
      setErreurApfc(error.message);
      return;
    }
    setErreurApfc(null);
    setApfcItems(((data ?? []) as unknown as LigneApfc[]).map(mapperApfc));
  }, [supabase]);

  const chargerAal = useCallback(async () => {
    const rang = (rangAal.current += 1);
    const { data, error } = await supabase
      .from("attestations_attribution_lot")
      .select(COLONNES_AAL)
      .is("sig_chefferie_le", null)
      .neq("statut", "revoquee")
      .order("cree_le", { ascending: false })
      .limit(LIMITE);
    if (!monte.current || rang !== rangAal.current) return;
    if (error) {
      setErreurAal(error.message);
      return;
    }
    setErreurAal(null);
    setAalItems(((data ?? []) as unknown as LigneAal[]).map(mapperAal));
  }, [supabase]);

  useEffect(() => {
    if (!actif) return;
    void (async () => {
      await Promise.all([chargerApfc(), chargerAal()]);
    })();
  }, [actif, chargerApfc, chargerAal]);

  /** Même traduction erreur → `Resultat` que `useAttestations.echec`. */
  const echec = useCallback(<T,>(error: { message: string; code?: string | null }): Resultat<T> => {
    return { ok: false, error: error.message, incertain: !error.code };
  }, []);

  const constaterApfc = useCallback(
    async (id: string): Promise<Resultat<void>> => {
      const { error } = await supabase.rpc("signer_apfc", { p_id: id, p_signature: "chef_village" });
      if (error) return echec(error);
      await chargerApfc();
      return { ok: true, valeur: undefined };
    },
    [supabase, chargerApfc, echec],
  );

  const constaterAal = useCallback(
    async (id: string): Promise<Resultat<void>> => {
      const { error } = await supabase.rpc("signer_attestation_attribution_lot", {
        p_id: id,
        p_signature: "chefferie",
      });
      if (error) return echec(error);
      await chargerAal();
      return { ok: true, valeur: undefined };
    },
    [supabase, chargerAal, echec],
  );

  const listeApfc = apfcItems ?? [];
  const listeAal = aalItems ?? [];

  return {
    apfc: {
      items: listeApfc,
      loading: actif && apfcItems === null && erreurApfc === null,
      erreur: erreurApfc,
      aSigner: listeApfc.filter(apfcActionnable).length,
      recharger: chargerApfc,
      constater: constaterApfc,
    },
    attributionLot: {
      items: listeAal,
      loading: actif && aalItems === null && erreurAal === null,
      erreur: erreurAal,
      aSigner: listeAal.filter(aalActionnable).length,
      recharger: chargerAal,
      constater: constaterAal,
    },
  };
}
