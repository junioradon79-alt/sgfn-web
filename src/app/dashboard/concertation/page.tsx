"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  MessageSquare, FileText, Plus, X, Send, Upload,
  Users, Building2, Crown, HandCoins, ShieldCheck,
  ChevronLeft, AlertTriangle, Search, Loader2, Download, Trash2,
} from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ds/dialog";
import { Field } from "@/components/ds/label";
import { Input, Textarea } from "@/components/ds/input";
import { SelectItem } from "@/components/ds/select";
import { ChampSelect } from "@/components/dashboard/ModaleFormulaire";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";

// ─── Types ────────────────────────────────────────────────────────────────────

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

type Participant = {
  id: string;
  nom_complet: string;
  groupe: string;
  autorite_coutumiere_id?: string | null;
  famille_id?: string | null;
};

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
  admin: "SGNF", chefferie: "Chefferie", proprietaire_terrien: "Propriétaire terrien", proprietaire: "Propriétaire",
  operateur: "Opérateur", acquereur: "Acquéreur", commissaire: "Commissaire",
  verificateur: "Vérificateur", geometre: "Géomètre", agent_ia: "Agent IA", amenageur: "Aménageur",
};

// Ton (Badge DS) par rôle — le DS n'a que 5 tons, l'icône du rôle porte le
// reste de la distinction. Remplace les couleurs figées (amber-50, teal-50…)
// qui rendaient en clair sur page sombre.
const GROUPE_TONE: Record<string, BadgeTone> = {
  admin: "neutral",
  chefferie: "warning",
  proprietaire_terrien: "accent",
  proprietaire: "accent",
  operateur: "success",
};
const groupeTone = (g: string): BadgeTone => GROUPE_TONE[g] ?? "neutral";

// Sentinelle « aucun lotissement » — Radix Select refuse la chaîne vide.
const AUCUN_LOT = "aucun";

function GroupeIcon({ groupe }: { groupe: string }) {
  if (groupe === "admin") return <ShieldCheck className="h-3 w-3" />;
  if (groupe === "chefferie") return <Crown className="h-3 w-3" />;
  if (groupe === "proprietaire_terrien") return <Crown className="h-3 w-3" />;
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
  const supabase = useMemo(() => createClient(), []);
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
        .select("id, nom_complet, groupe, autorite_coutumiere_id, famille_id")
        .eq("actif", true)
        .order("nom_complet");
      setAllProfiles((profiles ?? []) as Participant[]);
    })();
  }, [supabase]);

  // Auto-sélection des participants du lotissement — déclenchée par le
  // changement du select (event handler), pas par un effet.
  const choisirLotissement = (id: string) => {
    setLotissementId(id);
    if (!id) return;
    const lot = lotissements.find((l) => l.id === id);
    if (!lot) return;

    const autoIds = new Set<string>();
    if (myId) autoIds.add(myId);

    // Admins SGNF
    allProfiles.filter((p) => p.groupe === "admin").forEach((p) => autoIds.add(p.id));

    // Chefferie (village) liée au lotissement — même autorité coutumière
    if (lot.autorite_coutumiere_id) {
      allProfiles
        .filter((p) => p.groupe === "chefferie" && p.autorite_coutumiere_id === lot.autorite_coutumiere_id)
        .forEach((p) => autoIds.add(p.id));
    }

    // Opérateur lié au lotissement
    if (lot.operateur_id) {
      allProfiles.filter((p) => p.groupe === "operateur").forEach((p) => autoIds.add(p.id));
    }

    // Chef de famille / propriétaire terrien lié — même famille (couvre les
    // deux rôles possibles, `chefferie` conflaté historique et le nouveau
    // `proprietaire_terrien`, cf. conflation_chefferie_chef_famille)
    if (lot.famille_id) {
      allProfiles.filter((p) => p.famille_id === lot.famille_id).forEach((p) => autoIds.add(p.id));
    }

    setSelectedIds(autoIds);
  };

  const toggleParticipant = (id: string) => {
    if (myId && id === myId) return; // l'initiateur reste toujours dedans
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Concertation</p>
          <DialogTitle>Nouvel espace d&apos;échange</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Objet */}
          <Field label="Objet" htmlFor="conc-sujet" required>
            <Input
              id="conc-sujet"
              autoFocus
              placeholder="Ex : Régularisation APFC — Lotissement Koelea-Accor"
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
            />
          </Field>

          {/* Lotissement (facultatif) */}
          <ChampSelect
            id="conc-lot"
            label="Lotissement concerné (optionnel)"
            value={lotissementId || AUCUN_LOT}
            onChange={(v) => choisirLotissement(v === AUCUN_LOT ? "" : v)}
          >
            <SelectItem value={AUCUN_LOT}>— Aucun lotissement —</SelectItem>
            {lotissements.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.nom}{l.village ? ` — ${l.village}` : ""}</SelectItem>
            ))}
          </ChampSelect>

          {/* Participants */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[13px] font-semibold text-foreground">
                Participants ({selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""})
              </label>
            </div>
            {selectedIds.size > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {[...selectedIds].map((id) => {
                  const p = allProfiles.find((x) => x.id === id);
                  if (!p) return null;
                  const isMe = id === myId;
                  return (
                    <Badge key={id} tone={groupeTone(p.groupe)}>
                      <GroupeIcon groupe={p.groupe} />
                      {p.nom_complet.split(" ")[0]}
                      {!isMe && (
                        <button
                          type="button"
                          onClick={() => toggleParticipant(id)}
                          className="ml-0.5 opacity-60 transition-opacity hover:opacity-100"
                          aria-label={`Retirer ${p.nom_complet}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  );
                })}
              </div>
            )}
            <div className="relative mb-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
              <Input
                placeholder="Ajouter un participant…"
                className="pl-9"
                value={searchParticipant}
                onChange={(e) => setSearchParticipant(e.target.value)}
              />
            </div>
            <div className="max-h-36 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {filteredProfiles.slice(0, 20).map((p) => {
                const checked = selectedIds.has(p.id);
                const isMe = p.id === myId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleParticipant(p.id)}
                    disabled={isMe}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition ${checked ? "bg-accent-subtle" : "hover:bg-inset"} ${isMe ? "cursor-default opacity-60" : ""}`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-primary bg-primary" : "border-border-strong"}`}>
                      {checked && <span className="text-[11px] leading-none text-primary-foreground">✓</span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{p.nom_complet}</span>
                      <Badge tone={groupeTone(p.groupe)} className="mt-0.5">
                        <GroupeIcon groupe={p.groupe} />
                        {GROUPE_LABELS[p.groupe] ?? p.groupe}
                      </Badge>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-xl border border-danger/25 bg-danger-subtle px-3 py-2 text-sm font-medium text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="button" variant="primary" loading={step === "saving"} onClick={handleCreate}>
            {step === "saving" ? "Création…" : "Créer l'espace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<"messages" | "documents">("messages");

  // Messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [corps, setCorps] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Documents
  const [docs, setDocs] = useState<Doc[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from("messages")
      .select("id, expediteur, corps, envoye_le, profil:profiles!messages_expediteur_fkey(nom_complet, groupe)")
      .eq("conversation_id", espace.id)
      .order("envoye_le");
    setMessages((data ?? []) as unknown as Message[]);
  }, [espace.id, supabase]);

  const fetchDocs = useCallback(async () => {
    const { data } = await supabase
      .from("conversation_documents")
      .select("id, nom_fichier, storage_path, taille_octets, type_mime, created_at, uploader:profiles!conversation_documents_uploaded_by_fkey(nom_complet)")
      .eq("conversation_id", espace.id)
      .order("created_at", { ascending: false });
    setDocs((data ?? []) as unknown as Doc[]);
  }, [espace.id, supabase]);

  const { isLoading: messagesLoading } = useChargement(fetchMessages, [fetchMessages]);
  const { isLoading: docsLoading } = useChargement(fetchDocs, [fetchDocs], tab === "documents");
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
  }, [espace.id, fetchMessages, supabase]);

  const handleSend = async () => {
    if (!corps.trim() || sending || !myId) return;
    setSending(true);
    setSendError("");
    const { error } = await supabase.from("messages").insert({ conversation_id: espace.id, corps: corps.trim(), expediteur: myId });
    if (error) {
      // On garde le message saisi pour permettre une nouvelle tentative.
      setSendError(`Message non envoyé : ${error.message}`);
      setSending(false);
      return;
    }
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
    setUploadError("");
    const { error: e1 } = await supabase.storage.from("concertation-docs").remove([doc.storage_path]);
    if (e1) { setUploadError(`Suppression du fichier impossible : ${e1.message}`); return; }
    const { error: e2 } = await supabase.from("conversation_documents").delete().eq("id", doc.id);
    if (e2) { setUploadError(`Fichier supprimé mais entrée non retirée : ${e2.message}`); }
    void fetchDocs();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-5 py-4">
        <div className="flex items-start gap-3">
          <button onClick={onBack} className="mt-0.5 shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-inset lg:hidden">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold text-foreground">{espace.sujet ?? "Espace sans titre"}</h2>
            {espace.lotissement && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-2">
                <Building2 className="h-3 w-3" />
                {espace.lotissement.nom}{espace.lotissement.village ? ` — ${espace.lotissement.village}` : ""}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {espace.participants.map((p) => (
                <Badge key={p.id} tone={groupeTone(p.groupe)}>
                  <GroupeIcon groupe={p.groupe} />
                  {p.nom_complet.split(" ").slice(0, 2).join(" ")}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex w-fit gap-1 rounded-xl border border-border bg-inset p-1">
          <button
            onClick={() => setTab("messages")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${tab === "messages" ? "bg-card text-accent shadow-panel" : "text-muted-foreground hover:text-foreground"}`}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Messages
          </button>
          <button
            onClick={() => setTab("documents")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${tab === "documents" ? "bg-card text-accent shadow-panel" : "text-muted-foreground hover:text-foreground"}`}
          >
            <FileText className="h-3.5 w-3.5" /> Documents
            {docs.length > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-border px-1 text-xs text-muted-foreground">{docs.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Onglet Messages ── */}
      {tab === "messages" && (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {messagesLoading ? (
              <div className="flex justify-center py-8 text-muted-2"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <MessageSquare className="h-8 w-8 text-muted-2" />
                <p className="text-sm text-muted-foreground">Aucun message pour l&apos;instant.</p>
                <p className="text-xs text-muted-2">Démarrez la concertation ci-dessous.</p>
              </div>
            ) : (
              messages.map((m) => {
                const isMine = m.expediteur === myId;
                return (
                  <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${isMine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-inset text-foreground"}`}>
                      {!isMine && m.profil && (
                        <p className="mb-1 text-xs font-semibold text-muted-foreground">
                          {m.profil.nom_complet} · {GROUPE_LABELS[m.profil.groupe] ?? m.profil.groupe}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.corps}</p>
                      <p className={`mt-1 text-right text-xs ${isMine ? "text-primary-foreground/60" : "text-muted-2"}`}>{fmtHeure(m.envoye_le)}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Zone de saisie */}
          <div className="border-t border-border bg-card px-4 py-3">
            {sendError && <p className="mb-2 text-sm text-danger">{sendError}</p>}
            <div className="flex items-end gap-2">
              <Textarea
                value={corps}
                onChange={(e) => setCorps(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                placeholder="Votre message… (Entrée pour envoyer)"
                rows={2}
                className="flex-1"
              />
              <Button
                type="button"
                variant="primary"
                size="icon"
                onClick={() => void handleSend()}
                disabled={!corps.trim() || sending}
                aria-label="Envoyer"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Envoi en cours…" : "Ajouter un document"}
            </Button>
            {uploadError && <p className="mt-2 text-sm text-danger">{uploadError}</p>}
            <p className="mt-1.5 text-xs text-muted-2">PDF, Word, Excel, images — 20 Mo max par fichier</p>
          </div>

          {docsLoading ? (
            <div className="flex justify-center py-8 text-muted-2"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center">
              <FileText className="h-8 w-8 text-muted-2" />
              <p className="text-sm text-muted-foreground">Aucun document partagé.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {docs.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-panel transition hover:border-border-strong">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-inset">
                    <FileText className="h-4 w-4 text-muted-2" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{doc.nom_fichier}</p>
                    <p className="text-xs text-muted-2">
                      {doc.uploader?.nom_complet ?? "Inconnu"} · {fmt(doc.created_at)}
                      {doc.taille_octets ? ` · ${fmtOctets(doc.taille_octets)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void handleDownload(doc)}
                      title="Télécharger"
                      aria-label="Télécharger"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {doc.uploader?.nom_complet && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleDelete(doc)}
                        title="Supprimer"
                        aria-label="Supprimer"
                        className="text-muted-2 hover:bg-danger-subtle hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
  const supabase = useMemo(() => createClient(), []);
  const { counts } = useBadgeCounts();
  const [myId, setMyId] = useState<string | null>(null);
  const [espaces, setEspaces] = useState<Espace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNouveau, setShowNouveau] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMyId(user.id);
    })();
  }, [supabase]);

  const fetchEspaces = useCallback(async () => {
    // Espaces où je suis participant
    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("profile_id", (await supabase.auth.getUser()).data.user?.id ?? "");

    const ids = (participations ?? []).map((p) => p.conversation_id);
    if (ids.length === 0) { setEspaces([]); return; }

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
  }, [supabase]);

  const { isLoading: loading, recharger } = useChargement(fetchEspaces, [fetchEspaces]);

  const filteredEspaces = espaces.filter((e) => {
    const q = search.toLowerCase();
    return !q || (e.sujet ?? "").toLowerCase().includes(q) || (e.lotissement?.nom ?? "").toLowerCase().includes(q);
  });

  // L'espace sélectionné est dérivé de la liste : toujours à jour après refresh.
  const selected = selectedId ? espaces.find((e) => e.id === selectedId) ?? null : null;

  return (
    <AppShell loading={loading} counts={counts} onRefresh={recharger}>
      <div className="flex h-[calc(100vh-10rem)] min-h-[560px] overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
        {/* ── Panneau gauche : liste ── */}
        <div className={`flex flex-col border-r border-border bg-inset/40 ${selected ? "hidden lg:flex" : "flex"} w-full shrink-0 lg:w-72 xl:w-80`}>
          {/* Header liste */}
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-sm font-bold text-foreground">Concertation</h1>
                <p className="text-xs text-muted-2">Espaces d&apos;échange multi-acteurs</p>
              </div>
              <Button type="button" variant="primary" size="sm" onClick={() => setShowNouveau(true)}>
                <Plus className="h-3.5 w-3.5" /> Nouveau
              </Button>
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
              <Input
                placeholder="Rechercher…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Liste */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12 text-muted-2"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : filteredEspaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
                <MessageSquare className="h-8 w-8 text-muted-2" />
                <p className="text-sm text-muted-foreground">Aucun espace de concertation.</p>
                <Button type="button" variant="primary" size="sm" onClick={() => setShowNouveau(true)}>
                  Créer le premier
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredEspaces.map((e) => {
                  const isSelected = selected?.id === e.id;
                  return (
                    <li key={e.id}>
                      <button
                        onClick={() => setSelectedId(e.id)}
                        className={`w-full border-l-2 px-4 py-3.5 text-left transition ${isSelected ? "border-accent bg-accent-subtle" : "border-transparent hover:bg-inset"}`}
                      >
                        <p className="truncate text-sm font-semibold text-foreground">{e.sujet ?? "Sans titre"}</p>
                        {e.lotissement && (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-2">
                            <Building2 className="h-3 w-3 shrink-0" />
                            {e.lotissement.nom}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {e.participants.slice(0, 4).map((p) => (
                            <Badge key={p.id} tone={groupeTone(p.groupe)}>
                              <GroupeIcon groupe={p.groupe} />
                              {GROUPE_LABELS[p.groupe] ?? p.groupe}
                            </Badge>
                          ))}
                          {e.participants.length > 4 && (
                            <Badge tone="neutral">+{e.participants.length - 4}</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-right text-xs text-muted-2">{fmt(e.cree_le)}</p>
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
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-inset">
                <MessageSquare className="h-7 w-7 text-muted-2" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Sélectionnez un espace</p>
                <p className="mt-1 text-sm text-muted-foreground">ou créez un nouvel espace de concertation entre SGNF, le Chef de village, le Chef de famille et l&apos;Opérateur.</p>
              </div>
              <Button type="button" variant="primary" onClick={() => setShowNouveau(true)}>
                <Plus className="h-4 w-4" /> Nouvel espace
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showNouveau && (
        <NouvelEspaceModal
          onClose={() => setShowNouveau(false)}
          onSuccess={(id) => {
            setShowNouveau(false);
            void fetchEspaces().then(() => {
              setSelectedId(id);
            });
          }}
        />
      )}
    </AppShell>
  );
}
