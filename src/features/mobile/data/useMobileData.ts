"use client";

// Couche de données de l'app mobile citoyen. Les requêtes reprennent celles,
// éprouvées, des dashboards web :
//   • parcelles  → `ProprietaireTerrienView` (attributions perso + collectif) ;
//   • messages   → `dashboard/messages` (conversations/participants/messages) ;
//   • notifs     → table réelle `notifications` (RLS : destinataire = moi) ;
//   • détail+score → `LotDetailModal` (`lots` + `litiges` + RPC score).
// Tout passe par le client porteur de session `@/utils/supabase/client`
// (jamais le singleton `@/lib/supabase`, qui interroge en anonyme).

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { LotRecord, LitigeRow, ScoreConfiance } from "@/components/dashboard/lots/LotDetailModal";
import type { NotifRow } from "./mappers";

export type MobileProfile = {
  id: string;
  nom_complet: string | null;
  groupe: string | null;
  famille_id: string | null;
  autorite_coutumiere_id: string | null;
  attributaire_id: string | null;
};

export type Parcelle = {
  lotId: string;
  numeroLot: string | null;
  statut: string;
  ilotNumero: string | null;
  lotissement: string;
  commune: string | null;
  qualite: string | null;
  rang: number | null;
  collectif: boolean;
};

export type ConvoParticipant = {
  profile_id: string;
  profiles: { id: string; nom_complet: string | null; groupe: string | null } | null;
};
export type Message = {
  id: string;
  conversation_id: string;
  corps: string;
  envoye_le: string;
  expediteur: string;
  lu: boolean;
};
export type Convo = {
  id: string;
  sujet: string | null;
  cree_le: string;
  conversation_participants: ConvoParticipant[];
  messages: Message[];
};

type AttributionRow = {
  rang: number | null;
  qualite: string | null;
  lot: {
    id: string;
    numero_lot: string | null;
    statut: string;
    ilots?: {
      numero: string | null;
      lotissements?: { nom: string | null; commune: string | null; village: string | null } | null;
    } | null;
  } | null;
};

const SANS_LOTISSEMENT = "Lotissement non renseigné";

function aplatir(rows: AttributionRow[], collectif: boolean): Parcelle[] {
  return rows
    .filter((a) => a.lot?.id)
    .map((a) => ({
      lotId: a.lot!.id,
      numeroLot: a.lot!.numero_lot,
      statut: a.lot!.statut,
      ilotNumero: a.lot!.ilots?.numero ?? null,
      lotissement: a.lot!.ilots?.lotissements?.nom ?? SANS_LOTISSEMENT,
      commune: a.lot!.ilots?.lotissements?.commune ?? null,
      qualite: a.qualite,
      rang: a.rang,
      collectif,
    }));
}

const ATTR_SELECT =
  "rang, qualite, lot:lot_id(id, numero_lot, statut, ilots(numero, lotissements(nom, commune, village)))";

// ─── Orchestrateur principal ────────────────────────────────────────────────────

export type MobileData = {
  loading: boolean;
  authed: boolean;
  userId: string | null;
  email: string | null;
  profile: MobileProfile | null;
  parcelles: Parcelle[];
  convos: Convo[];
  notifs: NotifRow[];
  reloadMessages: () => Promise<void>;
  reloadNotifs: () => Promise<void>;
  envoyerMessage: (convId: string, corps: string) => Promise<boolean>;
  marquerLu: (conv: Convo) => Promise<void>;
  suivreParcelle: (lotId: string) => Promise<boolean>;
  deconnexion: () => Promise<void>;
};

export function useMobileData(): MobileData {
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [convos, setConvos] = useState<Convo[]>([]);
  const [notifs, setNotifs] = useState<NotifRow[]>([]);

  const chargerParcelles = useCallback(
    async (p: MobileProfile) => {
      const persoRes = p.attributaire_id
        ? await supabase.from("attributions").select(ATTR_SELECT).eq("attributaire_id", p.attributaire_id).eq("actuel", true)
        : { data: [] };

      let collectif: Parcelle[] = [];
      if (p.famille_id) {
        const { data: fam } = await supabase
          .from("familles")
          .select("attributaire_id")
          .eq("id", p.famille_id)
          .single();
        const famAttr = (fam as { attributaire_id: string | null } | null)?.attributaire_id;
        if (famAttr) {
          const { data } = await supabase.from("attributions").select(ATTR_SELECT).eq("attributaire_id", famAttr).eq("actuel", true);
          collectif = aplatir((data ?? []) as unknown as AttributionRow[], true);
        }
      }
      const perso = aplatir((persoRes.data ?? []) as unknown as AttributionRow[], false);
      // Perso d'abord, puis collectif ; tri par numéro de lot au sein d'un même flux.
      setParcelles(
        [...perso, ...collectif].sort((a, b) =>
          (a.numeroLot ?? "").localeCompare(b.numeroLot ?? "", "fr", { numeric: true })
        )
      );
    },
    [supabase]
  );

  const chargerConvos = useCallback(
    async (uid: string) => {
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("profile_id", uid);
      const ids = (parts ?? []).map((p) => (p as { conversation_id: string }).conversation_id);
      if (ids.length === 0) {
        setConvos([]);
        return;
      }
      const { data } = await supabase
        .from("conversations")
        .select(
          "id, sujet, cree_le, conversation_participants(profile_id, profiles(id, nom_complet, groupe)), messages(id, conversation_id, corps, envoye_le, expediteur, lu)"
        )
        .in("id", ids)
        .order("cree_le", { ascending: false });
      setConvos((data ?? []) as unknown as Convo[]);
    },
    [supabase]
  );

  const chargerNotifs = useCallback(
    async (uid: string) => {
      const { data } = await supabase
        .from("notifications")
        .select("id, type, params, cree_le")
        .eq("destinataire_profile_id", uid)
        .order("cree_le", { ascending: false })
        .limit(50);
      setNotifs((data ?? []) as unknown as NotifRow[]);
    },
    [supabase]
  );

  useEffect(() => {
    let annule = false;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!annule) {
          setAuthed(false);
          setLoading(false);
        }
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, nom_complet, groupe, famille_id, autorite_coutumiere_id, attributaire_id")
        .eq("id", user.id)
        .single();
      const p = (prof ?? null) as MobileProfile | null;
      if (annule) return;
      setUserId(user.id);
      setEmail(user.email ?? null);
      setProfile(p);
      setAuthed(true);
      if (p) {
        await Promise.all([chargerParcelles(p), chargerConvos(user.id), chargerNotifs(user.id)]);
      }
      if (!annule) setLoading(false);
    })();
    return () => {
      annule = true;
    };
  }, [supabase, chargerParcelles, chargerConvos, chargerNotifs]);

  const reloadMessages = useCallback(async () => {
    if (userId) await chargerConvos(userId);
  }, [userId, chargerConvos]);

  const reloadNotifs = useCallback(async () => {
    if (userId) await chargerNotifs(userId);
  }, [userId, chargerNotifs]);

  const envoyerMessage = useCallback(
    async (convId: string, corps: string) => {
      if (!userId || !corps.trim()) return false;
      const { error } = await supabase
        .from("messages")
        .insert({ conversation_id: convId, expediteur: userId, corps: corps.trim() });
      if (error) return false;
      await chargerConvos(userId);
      return true;
    },
    [supabase, userId, chargerConvos]
  );

  const marquerLu = useCallback(
    async (conv: Convo) => {
      if (!userId) return;
      const aLire = (conv.messages || []).filter((m) => !m.lu && m.expediteur !== userId);
      if (aLire.length === 0) return;
      const { error } = await supabase.from("messages").update({ lu: true }).in("id", aLire.map((m) => m.id));
      if (!error) await chargerConvos(userId);
    },
    [supabase, userId, chargerConvos]
  );

  // Manifester son intérêt = un suivi de parcelle (RLS : profile_id = auth.uid()).
  // upsert idempotent : re-cliquer ne double pas la ligne (unique profile_id+lot_id).
  const suivreParcelle = useCallback(
    async (lotId: string) => {
      if (!userId) return false;
      const { error } = await supabase
        .from("suivis_parcelle")
        .upsert(
          { profile_id: userId, lot_id: lotId, source: "annonce" },
          { onConflict: "profile_id,lot_id", ignoreDuplicates: true }
        );
      return !error;
    },
    [supabase, userId]
  );

  const deconnexion = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  return {
    loading,
    authed,
    userId,
    email,
    profile,
    parcelles,
    convos,
    notifs,
    reloadMessages,
    reloadNotifs,
    envoyerMessage,
    marquerLu,
    suivreParcelle,
    deconnexion,
  };
}

// ─── Détail d'une parcelle (chargé à la demande) ────────────────────────────────
// Même trio que `ProprietaireTerrienView.ouvrirDossier` : dossier complet du lot,
// litiges, et RPC de score (coûteux → jamais en liste, seulement ici).

export type ParcelleDetail = {
  loading: boolean;
  lot: LotRecord | null;
  litiges: LitigeRow[];
  score: ScoreConfiance | null;
};

export function useParcelleDetail(lotId: string | null): ParcelleDetail {
  const [supabase] = useState(() => createClient());
  const [state, setState] = useState<ParcelleDetail>({
    loading: false,
    lot: null,
    litiges: [],
    score: null,
  });

  useEffect(() => {
    if (!lotId) {
      setState({ loading: false, lot: null, litiges: [], score: null });
      return;
    }
    let annule = false;
    setState((s) => ({ ...s, loading: true }));
    void (async () => {
      const [{ data: lotData }, { data: litigesData }, { data: scoreData }] = await Promise.all([
        supabase
          .from("lots")
          .select(
            "id, numero_lot, numero_parcelle, ilot_id, statut, verrouille, superficie_m2, est_equipement, nature_droit, observation, guide_page, ilots(id, numero, lotissements(nom, commune, village, autorite_coutumiere_id)), attributions(rang, qualite, actuel, depuis, observation, attributaires(id, nom, type)), attestations_cession(reference, statut, cession_id)"
          )
          .eq("id", lotId)
          .single(),
        supabase.from("litiges").select("id, objet, statut, ouvert_le").eq("lot_id", lotId),
        supabase.rpc("calculer_score_confiance", { p_lot_id: lotId }),
      ]);
      if (annule) return;
      setState({
        loading: false,
        lot: (lotData ?? null) as unknown as LotRecord | null,
        litiges: (litigesData ?? []) as LitigeRow[],
        score: (scoreData ?? null) as ScoreConfiance | null,
      });
    })();
    return () => {
      annule = true;
    };
  }, [supabase, lotId]);

  return state;
}
