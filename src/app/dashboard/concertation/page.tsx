"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  MessageSquare, FileText, Plus, X, Send, Upload,
  Users, Building2, Crown, HandCoins, ShieldCheck,
  ChevronLeft, AlertTriangle, Search, Loader2, Download, Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/Input";

// ─── Types ────────────────────────────────────────────────────────────────────

type Participant = { id: string; nom_complet: string; groupe: string };

type Espace = {
  id: string;
  sujet: string | null;
  lotissement_id: string | null;
  lotissement: { nom: string; village: string | null } | null;
  cree_le: string;
  participants: Participant[];
  nb_messages?: number;
};

type Message = {
  id: string;
  expediteur: string;
  corps: string;
  envoye_le: string;
  profil: { nom_complet: string; groupe: string } | null;
};

type Doc = {
  id: string;
  nom_fichier: string;
  storage_path: string;
  taille_octets: number | null;
  type_mime: string | null;
  created_at: string;
  uploader: { nom_complet: string } | null;
};

type LotissementOption = {
  id: string;
  nom: string;
  village: string | null;
  autorite_coutumiere_id: string | null;
  operateur_id: string | null;
  famille_id: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GROUPE_LABELS: Record<string, string> = {
  admin: "SGNF", chefferie: "Chefferie", proprietaire: "Propriétaire",
  operateur: "Opérateur", acquereur: "Acquéreur", commissaire: "Commissaire",
  verificateur: "Vérificateur", geometre: "Géomètre", agent_ia: "Agent IA", amenageur: "Aménageur",
};

const GROUPE_COLORS: Record<string, string> = {
  admin:        "bg-slate-100 text-slate-700 border-slate-200",
  chefferie:    "bg-amber-50 text-amber-700 border-amber-200",
  proprietaire: "bg-blue-50 text-blue-700 border-blue-200",
  operateur:    "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function GroupeIcon({ groupe }: { groupe: string }) {
  if (groupe === "admin") return <ShieldCheck className="h-3 w-3" />;
  if (groupe === "chefferie") return <Crown className="h-3 w-3" />;
  if (groupe === "proprietaire") return <Building2 className="h-3 w-3" />;
  if (groupe === "operateur") return <HandCoins className="h-3 w-3" />;
  return <Users className="h-3 w-3" />;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function fmtHeure(d: string) {
  return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function fmtOctets(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} o`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / 1048576).toFixed(1)} Mo`;
}

// ─── Modal : Nouvel espace ────────────────────────────────────────────────────

function NouvelEspaceModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const supabase = createClient();
  const [step, setStep] = useState<"form" | "saving">("form");
  const [sujet, setSujet] = useState("");
  const [lotissements, setLotissements] = useState<LotissementOption[]>([]);
  const [lotissementId, setLotissementId] = useState<string>("");
  const [allProfiles, setAllProfiles] = useState<Participant[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchParticipant, setSearchParticipant] = useState("");
  const [error, setError] = useState("");
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMyId(user.id);

      const { data: lots } = await supabase
        .from("lotissements")
        .select("id, nom, village, autorite_coutumiere_id, operateur_id, famille_id")
        .order("nom");
      setLotissements((lots ?? []) as LotissementOption[]);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nom_complet, groupe")
        .eq("actif", true)
        .order("nom_complet");
      setAllProfiles((profiles ?? []) as Participant[]);
    })();
  }, []);

  // Auto-sélectionner les participants du lotissement
  useEffect(() => {
    if (!lotissementId) return;
    const lot = lotissements.find((l) => l.id === lotissementId);
    if (!lot) return;

    const autoIds = new Set<string>();
    if (myId) autoIds.add(myId);

    // Admins SGNF
    allProfiles.filter((p) => p.groupe === "admin").forEach((p) => autoIds.add(p.id));

    // Chefferie liée au lotissement
    if (lot.autorite_coutumiere_id) {
      allProfiles
        .filter((p) => {
          // On cherche les profils chefferie — ils auront autorite_coutumiere_id
          // (non disponible ici, on filtre par groupe et laisse l'admin ajuster)
          return p.groupe === "chefferie";
        })
        .forEach((p) => autoIds.add(p.id));
    }

    // Opérateur lié au lotissement
    if (lot.operateur_id) {
      allProfiles.filter((p) => p.groupe === "operateur").forEach((p) => autoIds.add(p.id));
    }

    // Chef de famille lié (filtré par groupe propriétaire / chefferie)
    if (lot.famille_id) {
      allProfiles.filter((p) => p.groupe === "proprietaire").forEach((p) => autoIds.add(p.id));
    }

    setSelectedIds(autoIds);
  }, [lotissementId, lotissements, allProfiles, myId]);

  const toggleParticipant = (id: string) => {
    if (myId && id === myId) return; // l'initiateur reste toujours dedans
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredProfiles = allProfiles.filter((p) => {
    const q = searchParticipant.toLowerCase();
    return !q || p.nom_complet.toLowerCase().includes(q) || (GROUPE_LABELS[p.groupe] ?? "").toLowerCase().includes(q);
  });

  const handleCreate = async () => {
    if (!sujet.trim()) { setError("L'objet est requis."); return; }
    if (selectedIds.size < 2) { setError("Au moins 2 participants requis."); return; }
    setStep("saving");
    setError("");

    // Créer la conversation
    const { data: conv, error: e1 } = await supabase
      .from("conversations")
      .insert({
        sujet: sujet.trim(),
        type: "concertation",
        lotissement_id: lotissementId || null,
      })
      .select("id")
      .single();
    if (e1 || !conv) { setError(e1?.message ?? "Erreur création"); setStep("form"); return; }

    // Ajouter les participants
    const { error: e2 } = await supabase
      .from("conversation_participants")
      .insert([...selectedIds].map((pid) => ({ conversation_id: conv.id, profile_id: pid })));
    if (e2) { setError(e2.message); setStep("form"); return; }

    onSuccess(conv.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white shadow-2xl" style={{ maxHeight: "92vh" }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Concertation</p>
            <h2 className="mt-1 text-lg font-semibold text-[#0D3B66]">Nouvel espace d&apos;échange</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "60vh" }}>
          <div className="space-y-4 p-6">
            {/* Objet */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Objet *</label>
              <Input
                autoFocus
                placeholder="Ex : Régularisation APFC — Lotissement Koelea-Accor"
                value={sujet}
                onChange={(e) => setSujet(e.target.value)}
              />
            </div>

            {/* Lotissement (facultatif) */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Lotissement concerné (optionnel)</label>
              <select
                value={lotissementId}
                onChange={(e) => setLotissementId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1E6091]/30"
              >
                <option value="">— Aucun lotissement sélectionné —</option>
                {lotissements.map((l) => (
                  <option key={l.id} value={l.id}>{l.nom}{l.village ? ` — ${l.village}` : ""}</option>
                ))}
              </select>
            </div>

            {/* Participants */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600">Participants ({selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""})</label>
              </div>
              {selectedIds.size > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {[...selectedIds].map((id) => {
                    const p = allProfiles.find((x) => x.id === id);
                    if (!p) return null;
                    const isMe = id === myId;
                    return (
                      <span key={id} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${GROUPE_COLORS[p.groupe] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        <GroupeIcon groupe={p.groupe} />
                        {p.nom_complet.split(" ")[0]}
                        {!isMe && (
                          <button onClick={() => toggleParticipant(id)} className="ml-0.5 opacity-60 hover:opacity-100">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="relative mb-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Ajouter un participant…"
                  className="pl-9 text-sm"
                  value={searchParticipant}
                  onChange={(e) => setSearchParticipant(e.target.value)}
                />
              </div>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50">
                {filteredProfiles.slice(0, 20).map((p) => {
                  const checked = selectedIds.has(p.id);
                  const isMe = p.id === myId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleParticipant(p.id)}
                      disabled={isMe}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition ${checked ? "bg-blue-50/60" : "hover:bg-slate-50"} ${isMe ? "cursor-default opacity-60" : ""}`}
                    >
                      <span className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center ${checked ? "bg-[#0D3B66] border-[#0D3B66]" : "border-slate-300"}`}>
                        {checked && <span className="text-white text-xs leading-none">✓</span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-800">{p.nom_complet}</span>
                        <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs ${GROUPE_COLORS[p.groupe] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          <GroupeIcon groupe={p.groupe} />
                          {GROUPE_LABELS[p.groupe] ?? p.groupe}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
            Annuler
          </button>
          <button
            onClick={handleCreate}
            disabled={step === "saving"}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0D3B66] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E6091] disabled:opacity-40"
          >
            {step === "saving" ? <><Loader2 className="h-4 w-4 animate-spin" /> Création…</> : "Créer l'espace"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Panneau détail ───────────────────────────────────────────────────────────

function EspaceDetail({
  espace,
  myId,
  onBack,
}: {
  espace: Espace;
  myId: string | null;
  onBack: () => void;
}) {
  const supabase = createClient();
  const [tab, setTab] = useState<"messages" | "documents">("messages");

  // Messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [corps, setCorps] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Documents
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const fetchMessages = useCallback(async () => {
    setMessagesLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("id, expediteur, corps, envoye_le, profil:profiles!messages_expediteur_fkey(nom_complet, groupe)")
      .eq("conversation_id", espace.id)
      .order("envoye_le");
    setMessages((data ?? []) as unknown as Message[]);
    setMessagesLoading(false);
  }, [espace.id]);

  const fetchDocs = useCallback(async () => {
    setDocsLoading(true);
    const { data } = await supabase
      .from("conversation_documents")
      .select("id, nom_fichier, storage_path, taille_octets, type_mime, created_at, uploader:profiles!conversation_documents_uploaded_by_fkey(nom_complet)")
      .eq("conversation_id", espace.id)
      .order("created_at", { ascending: false });
    setDocs((data ?? []) as unknown as Doc[]);
    setDocsLoading(false);
  }, [espace.id]);

  useEffect(() => { void fetchMessages(); }, [fetchMessages]);
  useEffect(() => { if (tab === "documents") void fetchDocs(); }, [tab, fetchDocs]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Temps réel messages
  useEffect(() => {
    const channel = supabase
      .channel(`concertation-${espace.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${espace.id}`,
      }, () => { void fetchMessages(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [espace.id, fetchMessages]);

  const handleSend = async () => {
    if (!corps.trim() || sending || !myId) return;
    setSending(true);
    await supabase.from("messages").insert({ conversation_id: espace.id, corps: corps.trim(), expediteur: myId });
    setCorps("");
    setSending(false);
  };

  const handleUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    const ext = file.name.split(".").pop();
    const path = `${espace.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: e1 } = await supabase.storage.from("concertation-docs").upload(path, file);
    if (e1) { setUploadError(e1.message); setUploading(false); return; }

    const { error: e2 } = await supabase.from("conversation_documents").insert({
      conversation_id: espace.id,
      nom_fichier: file.name,
      storage_path: path,
      taille_octets: file.size,
      type_mime: file.type,
      uploaded_by: myId,
    });
    if (e2) { setUploadError(e2.message); setUploading(false); return; }

    setUploading(false);
    void fetchDocs();
  };

  const handleDownload = async (doc: Doc) => {
    const { data } = await supabase.storage.from("concertation-docs").createSignedUrl(doc.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (doc: Doc) => {
    await supabase.storage.from("concertation-docs").remove([doc.storage_path]);
    await supabase.from("conversation_documents").delete().eq("id", doc.id);
    void fetchDocs();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-100 bg-white px-5 py-4">
        <div className="flex items-start gap-3">
          <button onClick={onBack} className="mt-0.5 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold text-slate-800">{espace.sujet ?? "Espace sans titre"}</h2>
            {espace.lotissement && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                <Building2 className="h-3 w-3" />
                {espace.lotissement.nom}{espace.lotissement.village ? ` — ${espace.lotissement.village}` : ""}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {espace.participants.map((p) => (
                <span key={p.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${GROUPE_COLORS[p.groupe] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  <GroupeIcon groupe={p.groupe} />
                  {p.nom_complet.split(" ").slice(0, 2).join(" ")}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex gap-1 rounded-xl border border-slate-100 bg-slate-50 p-1 w-fit">
          <button
            onClick={() => setTab("messages")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${tab === "messages" ? "bg-white shadow-sm text-[#0D3B66]" : "text-slate-500 hover:text-slate-700"}`}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Messages
          </button>
          <button
            onClick={() => setTab("documents")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${tab === "documents" ? "bg-white shadow-sm text-[#0D3B66]" : "text-slate-500 hover:text-slate-700"}`}
          >
            <FileText className="h-3.5 w-3.5" /> Documents
            {docs.length > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-200 px-1 text-xs text-slate-600">{docs.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Onglet Messages ── */}
      {tab === "messages" && (
        <>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messagesLoading ? (
              <div className="flex justify-center py-8 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <MessageSquare className="h-8 w-8 text-slate-200" />
                <p className="text-sm text-slate-400">Aucun message pour l&apos;instant.</p>
                <p className="text-xs text-slate-300">Démarrez la concertation ci-dessous.</p>
              </div>
            ) : (
              messages.map((m) => {
                const isMine = m.expediteur === myId;
                return (
                  <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${isMine ? "bg-[#0D3B66] text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm"}`}>
                      {!isMine && m.profil && (
                        <p className={`mb-1 text-xs font-semibold ${GROUPE_COLORS[m.profil.groupe] ? "text-current" : "text-slate-500"}`}>
                          {m.profil.nom_complet} · {GROUPE_LABELS[m.profil.groupe] ?? m.profil.groupe}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.corps}</p>
                      <p className={`mt-1 text-right text-xs ${isMine ? "text-white/60" : "text-slate-400"}`}>{fmtHeure(m.envoye_le)}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Zone de saisie */}
          <div className="border-t border-slate-100 bg-white px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                value={corps}
                onChange={(e) => setCorps(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                placeholder="Votre message… (Entrée pour envoyer)"
                rows={2}
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E6091]/30"
              />
              <button
                onClick={() => void handleSend()}
                disabled={!corps.trim() || sending}
                className="shrink-0 rounded-xl bg-[#0D3B66] p-2.5 text-white transition hover:bg-[#1E6091] disabled:opacity-40"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Onglet Documents ── */}
      {tab === "documents" && (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Upload */}
          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); e.target.value = ""; }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-xl border border-[#0D3B66] px-4 py-2 text-sm font-semibold text-[#0D3B66] transition hover:bg-[#0D3B66] hover:text-white disabled:opacity-40"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Envoi en cours…" : "Ajouter un document"}
            </button>
            {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
            <p className="mt-1.5 text-xs text-slate-400">PDF, Word, Excel, images — 20 Mo max par fichier</p>
          </div>

          {docsLoading ? (
            <div className="flex justify-center py-8 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center rounded-2xl border border-dashed border-slate-200">
              <FileText className="h-8 w-8 text-slate-200" />
              <p className="text-sm text-slate-400">Aucun document partagé.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {docs.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:border-slate-200">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100">
                    <FileText className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{doc.nom_fichier}</p>
                    <p className="text-xs text-slate-400">
                      {doc.uploader?.nom_complet ?? "Inconnu"} · {fmt(doc.created_at)}
                      {doc.taille_octets ? ` · ${fmtOctets(doc.taille_octets)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void handleDownload(doc)}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-[#0D3B66]"
                      title="Télécharger"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    {doc.uploader?.nom_complet && (
                      <button
                        onClick={() => void handleDelete(doc)}
                        className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ConcertationPage() {
  const supabase = createClient();
  const [myId, setMyId] = useState<string | null>(null);
  const [espaces, setEspaces] = useState<Espace[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Espace | null>(null);
  const [showNouveau, setShowNouveau] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMyId(user.id);
    })();
  }, []);

  const fetchEspaces = useCallback(async () => {
    setLoading(true);
    // Espaces où je suis participant
    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("profile_id", (await supabase.auth.getUser()).data.user?.id ?? "");

    const ids = (participations ?? []).map((p) => p.conversation_id);
    if (ids.length === 0) { setEspaces([]); setLoading(false); return; }

    const { data: convs } = await supabase
      .from("conversations")
      .select(
        "id, sujet, lotissement_id, cree_le, type, " +
        "lotissement:lotissements(nom, village)"
      )
      .in("id", ids)
      .eq("type", "concertation")
      .order("cree_le", { ascending: false });

    // Participants de chaque espace
    const { data: allParticipants } = await supabase
      .from("conversation_participants")
      .select("conversation_id, profil:profiles(id, nom_complet, groupe)")
      .in("conversation_id", ids);

    const participantsByConv: Record<string, Participant[]> = {};
    for (const p of allParticipants ?? []) {
      const cid = p.conversation_id;
      if (!participantsByConv[cid]) participantsByConv[cid] = [];
      const prof = p.profil as unknown as Participant | null;
      if (prof) participantsByConv[cid].push(prof);
    }

    type ConvRow = {
      id: string;
      sujet: string | null;
      lotissement_id: string | null;
      lotissement: { nom: string; village: string | null } | null;
      cree_le: string;
    };
    setEspaces(
      ((convs ?? []) as unknown as ConvRow[]).map((c) => ({
        id: c.id,
        sujet: c.sujet,
        lotissement_id: c.lotissement_id,
        lotissement: c.lotissement,
        cree_le: c.cree_le,
        participants: participantsByConv[c.id] ?? [],
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => { void fetchEspaces(); }, [fetchEspaces]);

  const filteredEspaces = espaces.filter((e) => {
    const q = search.toLowerCase();
    return !q || (e.sujet ?? "").toLowerCase().includes(q) || (e.lotissement?.nom ?? "").toLowerCase().includes(q);
  });

  // Synchroniser l'espace sélectionné après refresh
  useEffect(() => {
    if (selected) {
      const updated = espaces.find((e) => e.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [espaces]);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      {/* ── Panneau gauche : liste ── */}
      <div className={`flex flex-col border-r border-slate-100 bg-slate-50/40 ${selected ? "hidden lg:flex" : "flex"} w-full lg:w-72 xl:w-80 shrink-0`}>
        {/* Header liste */}
        <div className="border-b border-slate-100 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-sm font-bold text-[#0D3B66]">Concertation</h1>
              <p className="text-xs text-slate-400">Espaces d&apos;échange multi-acteurs</p>
            </div>
            <button
              onClick={() => setShowNouveau(true)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#0D3B66] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1E6091]"
            >
              <Plus className="h-3.5 w-3.5" /> Nouveau
            </button>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher…"
              className="pl-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : filteredEspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
              <MessageSquare className="h-8 w-8 text-slate-200" />
              <p className="text-sm text-slate-400">Aucun espace de concertation.</p>
              <button
                onClick={() => setShowNouveau(true)}
                className="rounded-xl bg-[#0D3B66] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E6091]"
              >
                Créer le premier
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredEspaces.map((e) => {
                const isSelected = selected?.id === e.id;
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => setSelected(e)}
                      className={`w-full px-4 py-3.5 text-left transition ${isSelected ? "bg-[#0D3B66]/6 border-l-2 border-[#0D3B66]" : "hover:bg-slate-50 border-l-2 border-transparent"}`}
                    >
                      <p className="truncate text-sm font-semibold text-slate-800">{e.sujet ?? "Sans titre"}</p>
                      {e.lotissement && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400">
                          <Building2 className="h-3 w-3 shrink-0" />
                          {e.lotissement.nom}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {e.participants.slice(0, 4).map((p) => (
                          <span key={p.id} className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs ${GROUPE_COLORS[p.groupe] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
                            <GroupeIcon groupe={p.groupe} />
                            {GROUPE_LABELS[p.groupe] ?? p.groupe}
                          </span>
                        ))}
                        {e.participants.length > 4 && (
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">+{e.participants.length - 4}</span>
                        )}
                      </div>
                      <p className="mt-1 text-right text-xs text-slate-300">{fmt(e.cree_le)}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Panneau droit : détail ── */}
      <div className={`min-w-0 flex-1 ${selected ? "flex" : "hidden lg:flex"} flex-col`}>
        {selected ? (
          <EspaceDetail
            espace={selected}
            myId={myId}
            onBack={() => setSelected(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 h-full text-center px-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100">
              <MessageSquare className="h-7 w-7 text-slate-300" />
            </div>
            <div>
              <p className="font-semibold text-slate-700">Sélectionnez un espace</p>
              <p className="mt-1 text-sm text-slate-400">ou créez un nouvel espace de concertation entre SGNF, la Chefferie, le Chef de famille et l&apos;Opérateur.</p>
            </div>
            <button
              onClick={() => setShowNouveau(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0D3B66] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1E6091]"
            >
              <Plus className="h-4 w-4" /> Nouvel espace
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showNouveau && (
        <NouvelEspaceModal
          onClose={() => setShowNouveau(false)}
          onSuccess={(id) => {
            setShowNouveau(false);
            void fetchEspaces().then(() => {
              setSelected(espaces.find((e) => e.id === id) ?? null);
            });
          }}
        />
      )}
    </div>
  );
}
