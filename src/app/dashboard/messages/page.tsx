"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MessageSquare, Plus, Search, Send, X } from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Button } from "@/components/ds/button";
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ds/dialog";
import { Field } from "@/components/ds/label";
import { Input, Textarea } from "@/components/ds/input";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";

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
  const supabase = useMemo(() => createClient(), []);
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
  }, [myId, supabase]);

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
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Messagerie</p>
          <DialogTitle>Nouvelle conversation</DialogTitle>
        </DialogHeader>

        {!destinataire ? (
          <DialogBody className="space-y-3">
            <Field label="Destinataire" htmlFor="dest-search">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
                <Input
                  id="dest-search"
                  autoFocus
                  placeholder="Rechercher un utilisateur…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </Field>
            <div className="max-h-52 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {loadingProfiles ? (
                <p className="px-4 py-6 text-center text-sm text-muted-2">Chargement…</p>
              ) : filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-2">Aucun utilisateur trouvé.</p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDestinataire(p)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-inset"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                      {initiales(p.nom_complet)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{p.nom_complet ?? "—"}</p>
                      <p className="text-xs text-muted-2">{GROUPE_LABELS[p.groupe ?? ""] ?? p.groupe ?? "—"}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </DialogBody>
        ) : (
          <>
            <DialogBody className="space-y-4">
              {/* Destinataire sélectionné */}
              <div className="flex items-center justify-between rounded-md border border-border bg-inset px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                    {initiales(destinataire.nom_complet)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{destinataire.nom_complet}</p>
                    <p className="text-xs text-muted-2">{GROUPE_LABELS[destinataire.groupe ?? ""] ?? destinataire.groupe}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setDestinataire(null); setSearch(""); }}
                  className="rounded-full p-1 text-muted-2 transition-colors hover:bg-border/60 hover:text-foreground"
                  aria-label="Changer de destinataire"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <Field label="Sujet" htmlFor="conv-sujet" hint="Optionnel">
                <Input
                  id="conv-sujet"
                  type="text"
                  placeholder="Ex. : Demande de renseignement lot 42"
                  value={sujet}
                  onChange={(e) => setSujet(e.target.value)}
                />
              </Field>

              <Field label="Message" htmlFor="conv-message" required error={error || undefined}>
                <Textarea
                  id="conv-message"
                  autoFocus
                  rows={4}
                  placeholder="Votre message…"
                  value={corps}
                  onChange={(e) => setCorps(e.target.value)}
                />
              </Field>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
              <Button
                type="button"
                variant="primary"
                disabled={sending || !corps.trim()}
                onClick={handleEnvoyer}
              >
                <Send className="h-3.5 w-3.5" />
                {sending ? "Envoi…" : "Envoyer"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
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
  const { counts } = useBadgeCounts();

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

  const rafraichir = useCallback(() => {
    if (myId) void chargerConversations(myId);
  }, [myId, chargerConversations]);

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
    <AppShell loading={loading} counts={counts} onRefresh={rafraichir}>
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
      <div>
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
          Messagerie
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Échanges avec les propriétaires, aménageurs et partenaires de la
          plateforme.{" "}
          {nbNonLusTotal > 0 && (
            <span className="font-medium text-warning">
              {nbNonLusTotal} message{nbNonLusTotal > 1 ? "s" : ""} non lu
              {nbNonLusTotal > 1 ? "s" : ""}.
            </span>
          )}
        </p>
      </div>

      <div className="grid min-h-[560px] grid-cols-1 overflow-hidden rounded-xl border border-border bg-card shadow-panel md:grid-cols-[320px_1fr]">
        {/* Liste des conversations */}
        <div
          className={`border-border md:border-r ${
            openConvo ? "hidden md:block" : "block"
          } overflow-y-auto`}
        >
          <div className="flex items-center justify-between border-b border-border bg-inset px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Conversations
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setShowCompose(true)}
              title="Nouvelle conversation"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouveau
            </Button>
          </div>

          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Chargement…
            </div>
          ) : convosTriees.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-6 w-6 text-muted-2" />
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
                  className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-inset ${
                    active ? "bg-accent/5" : ""
                  }`}
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                    {initiales(autre?.nom_complet)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {autre?.nom_complet || "Interlocuteur"}
                      </span>
                      {n > 0 && (
                        <span className="shrink-0 rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {n}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-2">
                      {c.sujet || "Sans sujet"}
                    </span>
                    {last && (
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
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
            <div className="m-auto flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-2">
              <MessageSquare className="h-7 w-7 text-muted-2" />
              Sélectionnez une conversation.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-border bg-inset px-5 py-3">
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-border/60 md:hidden"
                  aria-label="Retour"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {autrePartenaire(openConvo)?.nom_complet || "Interlocuteur"}
                  </p>
                  <p className="truncate text-xs text-muted-2">
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
                          ? "self-end bg-primary text-primary-foreground"
                          : "self-start bg-inset text-foreground"
                      }`}
                    >
                      {m.corps}
                      <div
                        className={`mt-1 text-[10px] ${
                          mine ? "text-primary-foreground/70" : "text-muted-2"
                        }`}
                      >
                        {fmtHeure(m.envoye_le)}
                      </div>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>

              <div className="flex items-end gap-2 border-t border-border px-4 py-3">
                <Textarea
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
                  className="max-h-32 flex-1"
                />
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void envoyer()}
                  disabled={sending || !draft.trim()}
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {sending ? "…" : "Envoyer"}
                  </span>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
