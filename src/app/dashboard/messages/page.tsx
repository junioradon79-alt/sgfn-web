"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MessageSquare, Plus, Search, Send, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

/**
 * Messagerie SGNF — fil de discussion entre l'agence (admin/agent) et les
 * autres profils (propriétaires, aménageurs, commissaires…). Branchée sur les
 * tables réelles `conversations` / `conversation_participants` / `messages`.
 *
 * Volontairement agnostique du rôle : la même page est réutilisée par les
 * espaces client et commissaire. Le RLS Supabase garantit qu'on ne voit que
 * les conversations dont on est participant.
 */

type ProfileLite = {
  id: string;
  nom_complet: string | null;
  groupe: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  corps: string;
  envoye_le: string;
  expediteur: string;
  lu: boolean;
};

type ParticipantRow = {
  profile_id: string;
  profiles: ProfileLite | null;
};

type ConversationRow = {
  id: string;
  sujet: string | null;
  cree_le: string;
  conversation_participants: ParticipantRow[];
  messages: MessageRow[];
};

const GROUPE_LABELS: Record<string, string> = {
  chefferie: "Chefferie",
  proprietaire_terrien: "Propriétaire terrien",
  proprietaire: "Propriétaire",
  acquereur: "Acquéreur",
  amenageur: "Aménageur",
  operateur: "Opérateur",
  commissaire: "Commissaire",
  verificateur: "Vérificateur",
  geometre: "Géomètre",
  agent_ia: "Agent IA",
  admin: "Admin",
};

// ─── Modal nouvelle conversation ─────────────────────────────────────────────

function NouvelleConversationModal({
  myId,
  onClose,
  onCreated,
}: {
  myId: string;
  onClose: () => void;
  onCreated: (convId: string) => void;
}) {
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [destinataire, setDestinataire] = useState<ProfileLite | null>(null);
  const [sujet, setSujet] = useState("");
  const [corps, setCorps] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nom_complet, groupe")
        .neq("id", myId)
        .order("nom_complet");
      setProfiles((data ?? []) as ProfileLite[]);
      setLoadingProfiles(false);
    })();
  }, [myId]);

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (p.nom_complet ?? "").toLowerCase().includes(q) ||
      (GROUPE_LABELS[p.groupe ?? ""] ?? "").toLowerCase().includes(q)
    );
  });

  const handleEnvoyer = async () => {
    if (!destinataire || !corps.trim()) return;
    setSending(true);
    setError("");

    // 1. Créer la conversation
    const { data: conv, error: e1 } = await supabase
      .from("conversations")
      .insert({ sujet: sujet.trim() || null, cree_par: myId })
      .select("id")
      .single();
    if (e1 || !conv) { setError(e1?.message ?? "Erreur création conversation"); setSending(false); return; }

    // 2. Ajouter les participants
    const { error: e2 } = await supabase.from("conversation_participants").insert([
      { conversation_id: conv.id, profile_id: myId },
      { conversation_id: conv.id, profile_id: destinataire.id },
    ]);
    if (e2) { setError(e2.message); setSending(false); return; }

    // 3. Envoyer le premier message
    const { error: e3 } = await supabase.from("messages").insert({
      conversation_id: conv.id,
      expediteur: myId,
      corps: corps.trim(),
    });
    if (e3) { setError(e3.message); setSending(false); return; }

    setSending(false);
    onCreated(conv.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white shadow-2xl" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Messagerie</p>
            <h2 className="mt-0.5 text-lg font-semibold text-[#0D3B66]">Nouvelle conversation</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5" style={{ maxHeight: "75vh" }}>
          {/* Sélection destinataire */}
          {!destinataire ? (
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700">Destinataire</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  placeholder="Rechercher un utilisateur…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 text-sm text-slate-700 focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                />
              </div>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {loadingProfiles ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">Chargement…</p>
                ) : filtered.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">Aucun utilisateur trouvé.</p>
                ) : (
                  filtered.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setDestinataire(p)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0D3B66]/10 text-xs font-bold text-[#0D3B66]">
                        {initiales(p.nom_complet)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{p.nom_complet ?? "—"}</p>
                        <p className="text-xs text-slate-400">{GROUPE_LABELS[p.groupe ?? ""] ?? p.groupe ?? "—"}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Destinataire sélectionné */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0D3B66]/10 text-xs font-bold text-[#0D3B66]">
                    {initiales(destinataire.nom_complet)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{destinataire.nom_complet}</p>
                    <p className="text-xs text-slate-400">{GROUPE_LABELS[destinataire.groupe ?? ""] ?? destinataire.groupe}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setDestinataire(null); setSearch(""); }}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Sujet */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Sujet <span className="text-slate-400 font-normal">(optionnel)</span></label>
                <input
                  type="text"
                  placeholder="Ex. : Demande de renseignement lot 42"
                  value={sujet}
                  onChange={(e) => setSujet(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Message <span className="text-red-500">*</span></label>
                <textarea
                  autoFocus
                  rows={4}
                  placeholder="Votre message…"
                  value={corps}
                  onChange={(e) => setCorps(e.target.value)}
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleEnvoyer}
                  disabled={sending || !corps.trim()}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0D3B66] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1E6091] disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {sending ? "Envoi…" : "Envoyer"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initiales = (nom: string | null | undefined) =>
  (nom || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const fmtHeure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const messagesTries = (c: ConversationRow) =>
  [...(c.messages || [])].sort(
    (a, b) => new Date(a.envoye_le).getTime() - new Date(b.envoye_le).getTime()
  );

export default function MessagesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [myId, setMyId] = useState<string | null>(null);
  const [convos, setConvos] = useState<ConversationRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const chargerConversations = useCallback(
    async (uid: string) => {
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("profile_id", uid);

      const ids = (parts ?? []).map((p) => p.conversation_id);
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

      setConvos((data ?? []) as unknown as ConversationRow[]);
    },
    [supabase]
  );

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setMyId(user.id);
      await chargerConversations(user.id);
      setLoading(false);
    })();
  }, [supabase, chargerConversations]);

  const autrePartenaire = useCallback(
    (c: ConversationRow): ProfileLite | null => {
      const autres = (c.conversation_participants || []).filter(
        (p) => p.profile_id !== myId
      );
      return autres[0]?.profiles ?? null;
    },
    [myId]
  );

  const nbNonLus = useCallback(
    (c: ConversationRow) =>
      (c.messages || []).filter((m) => !m.lu && m.expediteur !== myId).length,
    [myId]
  );

  const convosTriees = useMemo(() => {
    const dernier = (c: ConversationRow) =>
      (c.messages || []).reduce(
        (max, m) => Math.max(max, new Date(m.envoye_le).getTime()),
        new Date(c.cree_le).getTime()
      );
    return [...convos].sort((a, b) => dernier(b) - dernier(a));
  }, [convos]);

  const openConvo = openId
    ? convos.find((c) => c.id === openId) ?? null
    : null;

  // Auto-scroll en bas du fil à l'ouverture / réception.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [openId, openConvo?.messages.length]);

  const marquerLu = useCallback(
    async (c: ConversationRow) => {
      if (!myId) return;
      const aLire = (c.messages || []).filter(
        (m) => !m.lu && m.expediteur !== myId
      );
      if (aLire.length === 0) return;
      // Update groupé ; en cas d'échec le badge reste et la prochaine ouverture réessaie.
      const { error } = await supabase.from("messages").update({ lu: true }).in("id", aLire.map((m) => m.id));
      if (error) return;
      await chargerConversations(myId);
    },
    [supabase, myId, chargerConversations]
  );

  const ouvrir = async (c: ConversationRow) => {
    setOpenId(c.id);
    await marquerLu(c);
  };

  const envoyer = async () => {
    if (!openConvo || !myId || !draft.trim()) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: openConvo.id,
      expediteur: myId,
      corps: draft.trim(),
    });
    if (error) {
      alert("Erreur à l'envoi : " + error.message);
    } else {
      setDraft("");
      await chargerConversations(myId);
    }
    setSending(false);
  };

  const nbNonLusTotal = convos.reduce((n, c) => n + nbNonLus(c), 0);

  return (
    <div className="mx-auto max-w-6xl">
      {showCompose && myId && (
        <NouvelleConversationModal
          myId={myId}
          onClose={() => setShowCompose(false)}
          onCreated={async (convId) => {
            setShowCompose(false);
            if (myId) await chargerConversations(myId);
            setOpenId(convId);
          }}
        />
      )}
      {/* En-tête */}
      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-primary">
          Messagerie
        </h1>
        <p className="mt-1.5 text-sm sm:text-base text-slate-500">
          Échanges avec les propriétaires, aménageurs et partenaires de la
          plateforme.{" "}
          {nbNonLusTotal > 0 && (
            <span className="font-medium text-[#F39C12]">
              {nbNonLusTotal} message{nbNonLusTotal > 1 ? "s" : ""} non lu
              {nbNonLusTotal > 1 ? "s" : ""}.
            </span>
          )}
        </p>
      </div>

      <div className="grid min-h-[560px] grid-cols-1 overflow-hidden rounded-xl border border-slate-200/60 bg-white md:grid-cols-[320px_1fr]">
        {/* Liste des conversations */}
        <div
          className={`border-slate-200/60 md:border-r ${
            openConvo ? "hidden md:block" : "block"
          } overflow-y-auto`}
        >
          <div className="flex items-center justify-between border-b border-slate-200/60 bg-slate-50/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Conversations
            </p>
            <button
              type="button"
              onClick={() => setShowCompose(true)}
              title="Nouvelle conversation"
              className="flex items-center gap-1.5 rounded-lg bg-[#0D3B66] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1E6091]"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouveau
            </button>
          </div>

          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              Chargement…
            </div>
          ) : convosTriees.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-sm text-slate-500">
              <MessageSquare className="h-6 w-6 text-slate-300" />
              Aucune conversation pour l&apos;instant.
            </div>
          ) : (
            convosTriees.map((c) => {
              const autre = autrePartenaire(c);
              const n = nbNonLus(c);
              const msgs = messagesTries(c);
              const last = msgs[msgs.length - 1];
              const active = openConvo?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => ouvrir(c)}
                  className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50/60 ${
                    active ? "bg-[#0D3B66]/5" : ""
                  }`}
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0D3B66]/10 text-xs font-bold text-[#0D3B66]">
                    {initiales(autre?.nom_complet)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800">
                        {autre?.nom_complet || "Interlocuteur"}
                      </span>
                      {n > 0 && (
                        <span className="shrink-0 rounded-full bg-[#F39C12] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {n}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-400">
                      {c.sujet || "Sans sujet"}
                    </span>
                    {last && (
                      <span className="mt-1 block truncate text-xs text-slate-500">
                        {last.corps}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Fil de discussion */}
        <div
          className={`flex min-w-0 flex-col ${
            openConvo ? "flex" : "hidden md:flex"
          }`}
        >
          {!openConvo ? (
            <div className="m-auto flex flex-col items-center gap-2 p-8 text-center text-sm text-slate-400">
              <MessageSquare className="h-7 w-7 text-slate-300" />
              Sélectionnez une conversation.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-slate-200/60 bg-slate-50/50 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200/60 md:hidden"
                  aria-label="Retour"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {autrePartenaire(openConvo)?.nom_complet || "Interlocuteur"}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {openConvo.sujet || "Sans sujet"}
                  </p>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-4">
                {messagesTries(openConvo).map((m) => {
                  const mine = m.expediteur === myId;
                  return (
                    <div
                      key={m.id}
                      className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                        mine
                          ? "self-end bg-[#0D3B66] text-white"
                          : "self-start bg-slate-100 text-slate-800"
                      }`}
                    >
                      {m.corps}
                      <div
                        className={`mt-1 text-[10px] ${
                          mine ? "text-white/70" : "text-slate-400"
                        }`}
                      >
                        {fmtHeure(m.envoye_le)}
                      </div>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>

              <div className="flex items-end gap-2 border-t border-slate-200/60 px-4 py-3">
                <textarea
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void envoyer();
                    }
                  }}
                  placeholder="Écrire une réponse…"
                  className="max-h-32 flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0D3B66]"
                />
                <button
                  type="button"
                  onClick={() => void envoyer()}
                  disabled={sending || !draft.trim()}
                  className="flex h-10 items-center gap-1.5 rounded-lg bg-[#0D3B66] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0a2f52] disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {sending ? "…" : "Envoyer"}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
