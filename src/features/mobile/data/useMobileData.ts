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
  telephone: string | null;
  groupe: string | null;
  famille_id: string | null;
  autorite_coutumiere_id: string | null;
  attributaire_id: string | null;
};

const PROFILE_SELECT =
  "id, nom_complet, telephone, groupe, famille_id, autorite_coutumiere_id, attributaire_id";

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

/** Appel RPC vers une fonction pas encore présente dans les types générés. */
type RpcNonTypee = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ error: { message: string } | null }>;

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

/**
 * Une parcelle **suivie** — captage de leads : on suit après avoir scanné le QR
 * d'un document, pour être prévenu si le terrain passe en vente.
 *
 * Rien à voir avec `Parcelle`, qui décrit un bien qu'on **possède** (via une
 * attribution). La distinction n'est pas cosmétique : un acquéreur n'a
 * généralement aucune attribution — les quatre comptes acquéreur de la
 * production n'en ont aucune — et son onglet « Parcelles » restait donc vide
 * alors qu'il suit réellement des terrains.
 *
 * Forme calquée sur la RPC `mes_suivis()` (SECURITY DEFINER, scopée à
 * `auth.uid()`), déjà utilisée par `/dashboard/mon-achat`.
 */
export type Suivi = {
  lot_id: string;
  numero_lot: string | null;
  ilot_numero: string | null;
  lotissement: string | null;
  /** Une annonce active existe sur ce lot — c'est l'information qu'on attend. */
  en_vente: boolean;
  annonce_id: string | null;
  cree_le: string;
};

// ─── Orchestrateur principal ────────────────────────────────────────────────────

export type MobileData = {
  loading: boolean;
  authed: boolean;
  userId: string | null;
  email: string | null;
  profile: MobileProfile | null;
  parcelles: Parcelle[];
  /** Parcelles suivies (captage QR). Vide pour qui n'en suit aucune. */
  suivis: Suivi[];
  convos: Convo[];
  notifs: NotifRow[];
  reloadMessages: () => Promise<void>;
  reloadNotifs: () => Promise<void>;
  envoyerMessage: (convId: string, corps: string) => Promise<boolean>;
  creerConversation: (
    destinataireId: string,
    sujet: string,
    corps: string,
  ) => Promise<{ ok: boolean; convId?: string; error?: string }>;
  marquerLu: (conv: Convo) => Promise<void>;
  suivreParcelle: (lotId: string) => Promise<boolean>;
  nePlusSuivre: (lotId: string) => Promise<boolean>;
  majProfil: (nom: string, telephone: string) => Promise<{ ok: boolean; error?: string }>;
  changerMotDePasse: (nouveau: string) => Promise<{ ok: boolean; error?: string }>;
  signalerProbleme: (
    lotId: string,
    objet: string,
    description: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  connexion: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  validerCode: (code: string) => Promise<{ valide: boolean; groupe?: string; message?: string; erreur?: boolean }>;
  inscrire: (p: InscriptionPayload) => Promise<{ ok: boolean; error?: string; needsConfirm?: boolean }>;
  deconnexion: () => Promise<void>;
};

export type InscriptionPayload = {
  public?: boolean;
  code?: string;
  groupe?: string;
  nomComplet: string;
  telephone?: string;
  email: string;
  password: string;
  accepteComm?: boolean;
};

export function useMobileData(): MobileData {
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [suivis, setSuivis] = useState<Suivi[]>([]);
  const [convos, setConvos] = useState<Convo[]>([]);
  const [notifs, setNotifs] = useState<NotifRow[]>([]);

  // Lecture seule du profil, sans pose d'état : le montage et `majProfil` la
  // rejouent tous deux, mais seul le premier décide aussi de `authed`.
  const lireProfil = useCallback(
    async (uid: string): Promise<MobileProfile | null> => {
      const { data } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", uid).single();
      return (data ?? null) as MobileProfile | null;
    },
    [supabase],
  );

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

  /**
   * Parcelles suivies. Passe par la RPC `mes_suivis()` et non par une lecture
   * de `suivis_parcelle` : elle joint déjà lot/îlot/lotissement et surtout
   * l'annonce active du marketplace (`en_vente`), que la RLS ne laisserait pas
   * assembler aussi simplement côté client.
   */
  const chargerSuivis = useCallback(async () => {
    const { data } = await supabase.rpc("mes_suivis");
    setSuivis((data ?? []) as Suivi[]);
  }, [supabase]);

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

  // L'auth pilote tout : on écoute les changements de session (connexion,
  // inscription avec session immédiate, déconnexion) et on (re)charge en
  // conséquence. `INITIAL_SESSION` couvre le montage — pas de getUser manuel.
  useEffect(() => {
    let annule = false;

    const load = async (u: { id: string; email?: string | null }) => {
      const p = await lireProfil(u.id);
      if (annule) return;
      setUserId(u.id);
      setEmail(u.email ?? null);
      setProfile(p);
      setAuthed(true);
      if (p)
        await Promise.all([
          chargerParcelles(p),
          chargerSuivis(),
          chargerConvos(u.id),
          chargerNotifs(u.id),
        ]);
      if (!annule) setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (annule) return;
      if (event === "SIGNED_OUT") {
        setAuthed(false);
        setProfile(null);
        setParcelles([]);
        setConvos([]);
        setNotifs([]);
        setUserId(null);
        setEmail(null);
        setLoading(false);
        return;
      }
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        if (session?.user) void load(session.user);
        else setLoading(false);
      }
    });

    return () => {
      annule = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase, lireProfil, chargerParcelles, chargerSuivis, chargerConvos, chargerNotifs]);

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

  // Ouvrir un échange. Même séquence que la messagerie web
  // (`dashboard/messages`) : conversation, participants, premier message — il
  // n'existe pas de RPC transactionnelle pour cela, et en inventer une ici
  // ferait diverger deux chemins pour un même acte.
  //
  // ⚠️ Si l'ajout des participants échoue, la conversation créée serait
  // orpheline et invisible de tous (le RLS filtre sur la participation) : on
  // la supprime plutôt que de laisser une ligne fantôme en base.
  const creerConversation = useCallback(
    async (destinataireId: string, sujet: string, corps: string) => {
      if (!userId) return { ok: false, error: "Session expirée." };
      const texte = corps.trim();
      if (!texte) return { ok: false, error: "Le message est vide." };

      const { data: conv, error: e1 } = await supabase
        .from("conversations")
        .insert({ sujet: sujet.trim() || null, cree_par: userId })
        .select("id")
        .single();
      if (e1 || !conv) return { ok: false, error: e1?.message ?? "Création impossible." };
      const convId = (conv as { id: string }).id;

      const { error: e2 } = await supabase.from("conversation_participants").insert([
        { conversation_id: convId, profile_id: userId },
        { conversation_id: convId, profile_id: destinataireId },
      ]);
      if (e2) {
        await supabase.from("conversations").delete().eq("id", convId);
        return { ok: false, error: e2.message };
      }

      const { error: e3 } = await supabase
        .from("messages")
        .insert({ conversation_id: convId, expediteur: userId, corps: texte });
      if (e3) return { ok: false, error: e3.message };

      await chargerConvos(userId);
      return { ok: true, convId };
    },
    [supabase, userId, chargerConvos],
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
      // Relire tout de suite : la liste des suivis est affichée dans l'onglet
      // Parcelles, et un terrain qu'on vient de suivre doit y figurer sans
      // qu'il faille relancer l'application.
      if (!error) await chargerSuivis();
      return !error;
    },
    [supabase, userId, chargerSuivis]
  );

  /**
   * Ne plus suivre. La policy de `suivis_parcelle` scope la suppression à
   * `profile_id = auth.uid()` ; le filtre sur `lot_id` suffit donc côté client.
   *
   * L'état local n'est pas mis à jour à l'aveugle : on relit après coup, pour
   * qu'une suppression refusée n'efface pas la ligne à l'écran — elle
   * réapparaîtrait au prochain lancement, et l'utilisateur croirait avoir agi.
   */
  const nePlusSuivre = useCallback(
    async (lotId: string) => {
      if (!userId) return false;
      const { error } = await supabase.from("suivis_parcelle").delete().eq("lot_id", lotId);
      await chargerSuivis();
      return !error;
    },
    [supabase, userId, chargerSuivis]
  );

  // ── Profil (édition dans l'app) ───────────────────────────────────────────────

  // ⚠️ N'envoyer QUE `nom_complet` et `telephone`. La policy
  // `profiles_self_update` n'ouvre la ligne qu'à son propriétaire, et le
  // trigger `trg_protect_profile_privileged_columns` rejette l'update entier
  // dès qu'une colonne réservée (`groupe`, rattachements, `actif`) *change* de
  // valeur. Il compare avec `is distinct from` : une valeur identique passerait
  // donc sans encombre — mais la joindre au payload reviendrait à réécrire un
  // état lu plus tôt, et il suffirait que l'administration l'ait modifié
  // entre-temps pour que l'enregistrement du nom échoue, sur une colonne que
  // l'écran ne montre même pas. Le payload minimal supprime la question.
  //
  // Le profil est **rechargé** ensuite : sans cela l'écran Profil continuerait
  // d'afficher l'ancien nom jusqu'à la prochaine ouverture de l'app, donnant
  // l'impression que l'enregistrement n'a pas pris.
  const majProfil = useCallback(
    async (nom: string, telephone: string) => {
      if (!userId) return { ok: false, error: "Session expirée." };
      const n = nom.trim();
      if (!n) return { ok: false, error: "Le nom complet est obligatoire." };
      const { error } = await supabase
        .from("profiles")
        .update({ nom_complet: n, telephone: telephone.trim() || null })
        .eq("id", userId);
      if (error) return { ok: false, error: error.message };
      const p = await lireProfil(userId);
      if (p) setProfile(p);
      return { ok: true };
    },
    [supabase, userId, lireProfil],
  );

  // Supabase renouvelle la session au passage : l'utilisateur reste connecté.
  //
  // ⚠️ Ne s'appelle pas directement depuis un écran. Le mot de passe gardé
  // dans le coffre biométrique devient caduc au même instant, et c'est
  // `MobileApp.handleChangePassword` qui l'y réécrit ensuite — la couche de
  // données n'a ni l'état de la biométrie ni à connaître le coffre natif.
  const changerMotDePasse = useCallback(
    async (nouveau: string) => {
      const { error } = await supabase.auth.updateUser({ password: nouveau });
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [supabase],
  );

  // ── Signalement d'un problème sur une parcelle ────────────────────────────────
  // `signaler_probleme_parcelle()` est en production depuis le 26/07
  // (SECURITY DEFINER, `execute` accordé à `authenticated` et refusé à `anon`).
  // Elle est le seul chemin d'écriture : aucun repli n'insère ailleurs — un
  // signalement rangé dans une autre table serait invisible de ceux qui doivent
  // le traiter, donc pire qu'une erreur affichée franchement.
  const signalerProbleme = useCallback(
    async (lotId: string, objet: string, description: string) => {
      if (!userId) return { ok: false, error: "Session expirée." };
      const o = objet.trim();
      if (!o) return { ok: false, error: "L'objet du signalement est obligatoire." };
      // La fonction existe en base mais pas dans `database.types.ts`, qui n'a
      // pas été régénéré depuis sa migration. On désigne cet appel — et lui
      // seul — comme non typé, plutôt que de maquiller à la main des types
      // censés venir de la base : il redeviendra vérifié à la prochaine
      // régénération.
      const appelerRpc = supabase.rpc as unknown as RpcNonTypee;
      const { error } = await appelerRpc("signaler_probleme_parcelle", {
        p_lot_id: lotId,
        p_objet: o,
        p_description: description.trim(),
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [supabase, userId],
  );

  // ── Authentification (connexion / inscription) ────────────────────────────────
  // Mêmes appels que les pages web /login et /inscription, mais internes à l'app.
  // La sécurité tient côté base : `handle_new_user()` ignore le `groupe` client
  // sans invitation valide (correctif du 15/07).

  const connexion = useCallback(
    async (mail: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email: mail.trim(), password });
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    [supabase]
  );

  const validerCode = useCallback(
    async (code: string) => {
      const { data, error } = await supabase.rpc("valider_invitation", { p_code: code.trim().toUpperCase() });
      if (error) return { valide: false, erreur: true as const };
      const d = data as { valide: boolean; groupe?: string; message?: string } | null;
      return { valide: !!d?.valide, groupe: d?.groupe, message: d?.message };
    },
    [supabase]
  );

  const inscrire = useCallback(
    async (p: InscriptionPayload) => {
      const metadata: Record<string, unknown> = {
        nom_complet: p.nomComplet.trim(),
        telephone: p.telephone?.trim() || null,
      };
      if (p.public) {
        metadata.accepte_communications = !!p.accepteComm;
      } else {
        metadata.groupe = p.groupe;
        metadata.code_invitation = p.code?.trim().toUpperCase();
      }
      const { data, error } = await supabase.auth.signUp({
        email: p.email.trim(),
        password: p.password,
        options: { data: metadata },
      });
      if (error) return { ok: false, error: error.message };
      // Session immédiate → `onAuthStateChange(SIGNED_IN)` charge le reste.
      return { ok: true, needsConfirm: !data.session };
    },
    [supabase]
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
    suivis,
    convos,
    notifs,
    reloadMessages,
    reloadNotifs,
    envoyerMessage,
    creerConversation,
    marquerLu,
    suivreParcelle,
    nePlusSuivre,
    majProfil,
    changerMotDePasse,
    signalerProbleme,
    connexion,
    validerCode,
    inscrire,
    deconnexion,
  };
}

// ─── Destinataires possibles (chargés à la demande) ─────────────────────────────
// La liste n'est PAS filtrée côté client : c'est la policy `peut_contacter()`
// qui décide qui l'on voit — les agents SGNF, plus les personnes avec qui l'on
// converse déjà (resserrée le 24/07 après qu'un acquéreur pouvait lire les 20
// profils de la base). Un filtre client en plus donnerait l'illusion d'une
// règle de sécurité alors qu'il ne serait qu'un confort d'affichage.

export type Contact = { id: string; nom_complet: string | null; groupe: string | null };

export function useContactsMessagerie(actif: boolean, moiId: string | null) {
  const [supabase] = useState(() => createClient());
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    if (!actif || !moiId) return;
    let annule = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nom_complet, groupe")
        .neq("id", moiId)
        .order("nom_complet");
      if (annule) return;
      setContacts((data ?? []) as Contact[]);
      setCharge(true);
    })();
    return () => {
      annule = true;
    };
  }, [supabase, actif, moiId]);

  // `loading` est **dérivé**, jamais posé depuis l'effet : sans session il n'y
  // a rien à charger ni à attendre, et une sortie anticipée de l'effet laissait
  // auparavant un spinner éternel. Le dériver rend ce cas impossible à oublier.
  return { contacts, loading: actif && !!moiId && !charge };
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
