"use client";

// File de validation des saisies (module maker-checker), côté app mobile.
//
// Même acte métier que l'onglet « File de validation » du dashboard web
// (`components/dashboard/saisie/FileValidation.tsx`) : tout passe par les deux
// RPC `approuver_soumission` / `rejeter_soumission`. La table `soumissions_saisie`
// n'a **aucune** policy UPDATE — un `.update()` client échouerait, et c'est
// voulu : l'application réelle des attributions (historique préservé, garde
// anti-attestation) vit dans une seule fonction SECURITY DEFINER, jamais
// dupliquée dans un client. Rejouer cette logique ici ferait diverger deux
// chemins pour un même acte.
//
// Le `payload` n'est délibérément PAS chargé : il porte le diff complet, lot par
// lot (un lotissement en compte jusqu'à plusieurs centaines). C'est du réseau
// payé sur un forfait téléphone pour un détail que cet écran n'affiche pas — le
// `resume` pré-calculé à la soumission suffit à décider. Le détail ligne à ligne
// reste l'affaire du web.

import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/utils/supabase/client";
import type { ResumeSoumission, TypeSoumission } from "@/lib/saisie";

/** Une soumission en attente, réduite à ce que la file affiche. */
export type SoumissionEnAttente = {
  id: string;
  type: TypeSoumission;
  titre: string | null;
  /**
   * Forme dictée par `type` (cf. `ResumeSoumission`). Le champ était typé sur
   * les deux seuls résumés d'origine, si bien que les trois types ajoutés
   * depuis se faisaient lire comme des `ResumeCreation` : la file affichait
   * « undefined îlot, undefined lot ». C'est `puces()` qui fait le tri, et le
   * type l'y oblige désormais.
   */
  resume: ResumeSoumission | null;
  cree_le: string | null;
};

/**
 * Ce que la base a réellement appliqué, renvoyé par `approuver_soumission`.
 * Les clés diffèrent selon le type de soumission (attributions vs structure),
 * d'où des champs tous optionnels : l'écran n'affiche que ceux présents.
 */
export type ResultatApplication = {
  nouvelles_attributions?: number;
  reassignations?: number;
  remises_libre?: number;
  inchanges?: number;
  nouveaux_attributaires?: number;
  nb_ilots?: number;
  nb_lots?: number;
};

export type Traitement =
  | { ok: true; resultat: ResultatApplication | null }
  | { ok: false; error: string };

export type FileSoumissions = {
  soumissions: SoumissionEnAttente[];
  loading: boolean;
  erreur: string | null;
  recharger: () => Promise<void>;
  approuver: (id: string, commentaire: string) => Promise<Traitement>;
  rejeter: (id: string, commentaire: string) => Promise<Traitement>;
};

const COLONNES = "id, type, titre, resume, cree_le";

/**
 * File des saisies en attente de décision.
 *
 * `actif` évite de requêter tant que l'écran n'est pas ouvert : la file vit
 * derrière un calque, la monter à vide coûterait une lecture pour rien.
 */
export function useSoumissions(actif: boolean): FileSoumissions {
  const [supabase] = useState(() => createClient());
  // `null` = jamais chargé, et c'est ce qui distingue « on attend » de « la file
  // est vide ». Un booléen de chargement posé depuis l'effet se serait retrouvé
  // bloqué à `true` sur toute sortie anticipée (cf. `useContactsMessagerie`).
  const [soumissions, setSoumissions] = useState<SoumissionEnAttente[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Un acte recharge la file : la réponse peut revenir après que l'admin a
  // quitté l'écran. On garde donc l'état monté ET le rang de la demande.
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
      .from("soumissions_saisie")
      .select(COLONNES)
      .eq("statut", "en_attente")
      // Les plus récentes d'abord : une saisie fraîche est celle dont
      // l'opérateur attend le retour, les anciennes ont déjà été arbitrées.
      .order("cree_le", { ascending: false });

    // Une réponse arrivée après un démontage — ou dépassée par un
    // rechargement plus récent — ne doit pas écraser l'écran.
    if (!monte.current || rang !== demande.current) return;

    if (error) {
      setErreur(error.message);
      return;
    }
    setErreur(null);
    setSoumissions((data ?? []) as unknown as SoumissionEnAttente[]);
  }, [supabase]);

  useEffect(() => {
    if (!actif) return;
    // Enveloppé dans une fonction asynchrone plutôt qu'appelé directement : le
    // premier `setState` n'a lieu qu'au retour du réseau, jamais pendant le
    // rendu de l'effet (règle `react-hooks/set-state-in-effect`).
    void (async () => {
      await charger();
    })();
  }, [actif, charger]);

  // Le commentaire reste **facultatif** des deux côtés, exactement comme le web
  // (« Motif du rejet (optionnel) ») : le rendre obligatoire ici créerait deux
  // règles pour un même acte selon l'écran d'où l'admin décide. Vide, il part en
  // `undefined` — la RPC applique déjà `nullif(btrim(...), '')`.
  const approuver = useCallback(
    async (id: string, commentaire: string): Promise<Traitement> => {
      const { data, error } = await supabase.rpc("approuver_soumission", {
        p_id: id,
        p_commentaire: commentaire.trim() || undefined,
      });
      if (error) return { ok: false, error: error.message };
      await charger();
      return { ok: true, resultat: (data ?? null) as unknown as ResultatApplication | null };
    },
    [supabase, charger],
  );

  const rejeter = useCallback(
    async (id: string, commentaire: string): Promise<Traitement> => {
      const { error } = await supabase.rpc("rejeter_soumission", {
        p_id: id,
        p_commentaire: commentaire.trim() || undefined,
      });
      if (error) return { ok: false, error: error.message };
      await charger();
      return { ok: true, resultat: null };
    },
    [supabase, charger],
  );

  return {
    soumissions: soumissions ?? [],
    // Dérivé, jamais posé dans un effet : impossible d'oublier de le redescendre.
    loading: actif && soumissions === null && erreur === null,
    erreur,
    recharger: charger,
    approuver,
    rejeter,
  };
}
