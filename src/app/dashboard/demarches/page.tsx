"use client";

import { type FormEvent, useCallback, useState } from "react";
import { CheckCircle2, Clock, HandCoins, Pencil, Plus, Ruler } from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { DataGrid, type Column } from "@/components/ds/data-grid";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ds/dialog";
import { Kpi } from "@/components/ds/kpi";
import { Field } from "@/components/ds/label";
import { Input, Textarea } from "@/components/ds/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ds/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ds/sheet";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { useProfile } from "@/hooks/useProfile";
import { createClient } from "@/utils/supabase/client";
import type { Database } from "../../../../database.types";

// ─── Types ──────────────────────────────────────────────────────────────────

type Demarche = {
  id: string;
  type: string | null;
  statut: string | null;
  lot_id?: string | null;
  description: string | null;
  montant_honoraires: number | null;
  agent_assigne: string | null;
  ouverte_le?: string | null;
  terminee_le?: string | null;
  lots?: {
    numero_lot?: string | number | null;
    ilots?: { numero?: string | number | null; lotissements?: { nom?: string | null } | null } | null;
  } | null;
  agent?: { nom_complet?: string | null } | null;
};

type LotOption = {
  id: string;
  numero_lot: string | null;
  ilots?: { numero: string | null; lotissements?: { nom: string | null } | null } | null;
};

type AgentOption = { id: string; nom_complet: string };

// ─── Libellés ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  bornage: "Bornage",
  delivrance_attestation_cession: "Délivrance attestation",
  transmission: "Transmission",
  enterinement_chefferie: "Entérinement chefferie",
  mutation_acquereur: "Mutation acquéreur",
  demande_acd: "Demande ACD",
  levee_litige: "Levée de litige",
  autre: "Autre",
};
const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));

const STATUT_LABELS: Record<string, string> = {
  en_attente_paiement: "En attente de paiement",
  payee_en_cours: "Payée — en cours",
  en_traitement: "En traitement",
  terminee: "Terminée",
  suspendue_litige: "Suspendue (litige)",
  annulee: "Annulée",
};
const STATUT_OPTIONS = Object.entries(STATUT_LABELS).map(([value, label]) => ({ value, label }));

function toneStatut(s: string | null): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (s === "terminee") return "success";
  if (s === "suspendue_litige" || s === "annulee") return "danger";
  if (s === "en_traitement" || s === "payee_en_cours") return "accent";
  return "neutral";
}

function lotLabel(d: Demarche): string {
  const l = d.lots;
  if (!l) return "Lot —";
  const num = l.numero_lot != null ? `Lot ${l.numero_lot}` : "Lot —";
  const ilot = l.ilots?.numero != null ? ` · Îlot ${l.ilots.numero}` : "";
  const loti = l.ilots?.lotissements?.nom ? ` — ${l.ilots.lotissements.nom}` : "";
  return `${num}${ilot}${loti}`;
}

const nf = new Intl.NumberFormat("fr-FR");

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DemarchesPage() {
  const supabase = createClient();
  const { profile, isAdmin } = useProfile();
  const { counts, refresh: refreshBadges } = useBadgeCounts();

  const [demarches, setDemarches] = useState<Demarche[]>([]);
  const [statutFilter, setStatutFilter] = useState<string>("__all");
  const [selected, setSelected] = useState<Demarche | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("demarches")
      .select(
        "id, type, statut, lot_id, description, montant_honoraires, agent_assigne, ouverte_le, terminee_le, lots(numero_lot, ilots(numero, lotissements(nom))), agent:profiles!demarches_agent_assigne_fkey(nom_complet)"
      )
      .order("ouverte_le", { ascending: false });
    setDemarches((data ?? []) as unknown as Demarche[]);
  };

  const { isLoading: loading, recharger } = useChargement(load);

  const rafraichir = useCallback(() => {
    void recharger();
    refreshBadges();
  }, [recharger, refreshBadges]);

  const filtered = statutFilter === "__all" ? demarches : demarches.filter((d) => d.statut === statutFilter);
  const demarchesActives = demarches.filter((d) => !["terminee", "annulee"].includes(d.statut ?? ""));

  const peutModifier = (d: Demarche) => isAdmin || (!!profile && d.agent_assigne === profile.id);

  // ── Édition ──────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ statut: "en_attente_paiement", description: "", montant_honoraires: "", agent_assigne: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([]);

  const startEdit = async (d: Demarche) => {
    if (isAdmin && agentOptions.length === 0) {
      const { data } = await supabase.from("profiles").select("id, nom_complet").eq("groupe", "geometre");
      setAgentOptions((data ?? []) as AgentOption[]);
    }
    setEditForm({
      statut: d.statut ?? "en_attente_paiement",
      description: d.description ?? "",
      montant_honoraires: d.montant_honoraires != null ? String(d.montant_honoraires) : "",
      agent_assigne: d.agent_assigne ?? "",
    });
    setEditError(null);
    setEditing(true);
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSavingEdit(true);
    setEditError(null);

    const payload: Database["public"]["Tables"]["demarches"]["Update"] = {
      statut: editForm.statut as Database["public"]["Enums"]["statut_demarche"],
      description: editForm.description.trim() || null,
    };
    if (editForm.statut === "terminee" && !selected.terminee_le) {
      payload.terminee_le = new Date().toISOString();
    }
    if (isAdmin) {
      payload.montant_honoraires = editForm.montant_honoraires ? Number(editForm.montant_honoraires) : null;
      payload.agent_assigne = editForm.agent_assigne || null;
    }

    const { error } = await supabase.from("demarches").update(payload).eq("id", selected.id);
    setSavingEdit(false);
    if (error) {
      setEditError(error.message);
      return;
    }
    const agentChoisi = agentOptions.find((a) => a.id === payload.agent_assigne);
    setSelected({
      ...selected,
      ...payload,
      agent: isAdmin ? (agentChoisi ? { nom_complet: agentChoisi.nom_complet } : null) : selected.agent,
    } as Demarche);
    setEditing(false);
    rafraichir();
  };

  // ── Création ─────────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [lotOptions, setLotOptions] = useState<LotOption[]>([]);
  const [form, setForm] = useState({
    lot_id: "",
    type: "bornage",
    description: "",
    montant_honoraires: "",
    agent_assigne: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = async () => {
    if (lotOptions.length === 0) {
      const { data } = await supabase
        .from("lots")
        .select("id, numero_lot, ilots(numero, lotissements(nom))")
        .order("numero_lot")
        .limit(200);
      setLotOptions((data ?? []) as unknown as LotOption[]);
    }
    if (agentOptions.length === 0) {
      const { data } = await supabase.from("profiles").select("id, nom_complet").eq("groupe", "geometre");
      setAgentOptions((data ?? []) as AgentOption[]);
    }
    setForm({ lot_id: "", type: "bornage", description: "", montant_honoraires: "", agent_assigne: "" });
    setFormError(null);
    setShowCreate(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.lot_id) {
      setFormError("Sélectionnez un lot.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("demarches").insert([
      {
        lot_id: form.lot_id,
        type: form.type as Database["public"]["Enums"]["type_demarche"],
        description: form.description.trim() || null,
        montant_honoraires: form.montant_honoraires ? Number(form.montant_honoraires) : null,
        agent_assigne: form.agent_assigne || null,
        cree_par: user?.id ?? null,
      },
    ]);
    setSubmitting(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setShowCreate(false);
    rafraichir();
  };

  // ── Colonnes ──────────────────────────────────────────────────────────────
  const columns: Array<Column<Demarche>> = [
    {
      id: "type",
      header: "Type",
      sortBy: (d) => TYPE_LABELS[d.type ?? ""] ?? d.type ?? "",
      searchBy: (d) => `${TYPE_LABELS[d.type ?? ""] ?? ""} ${lotLabel(d)} ${d.agent?.nom_complet ?? ""}`,
      cell: (d) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{TYPE_LABELS[d.type ?? ""] ?? d.type}</p>
          {d.agent?.nom_complet && <p className="truncate text-[11.5px] text-muted-foreground">{d.agent.nom_complet}</p>}
        </div>
      ),
    },
    {
      id: "lot",
      header: "Lot",
      secondary: true,
      sortBy: (d) => lotLabel(d),
      cell: (d) => <span className="block truncate text-muted-foreground">{lotLabel(d)}</span>,
    },
    {
      id: "statut",
      header: "Statut",
      width: "11rem",
      sortBy: (d) => d.statut ?? "",
      cell: (d) => <Badge tone={toneStatut(d.statut)}>{STATUT_LABELS[d.statut ?? ""] ?? d.statut ?? "—"}</Badge>,
    },
    {
      id: "honoraires",
      header: "Honoraires",
      width: "9rem",
      align: "right",
      secondary: true,
      sortBy: (d) => d.montant_honoraires ?? 0,
      cell: (d) => (
        <span className="font-semibold text-foreground tabular">
          {d.montant_honoraires != null ? `${nf.format(d.montant_honoraires)} F` : "—"}
        </span>
      ),
    },
  ];

  return (
    <AppShell loading={loading} counts={counts} onRefresh={rafraichir}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">Démarches</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Suivi des démarches (bornage, transmission, mutation…) et de leurs honoraires.
          </p>
        </div>
        {isAdmin && (
          <Button variant="primary" onClick={openCreate}>
            <Plus />
            Nouvelle démarche
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Ruler} label="Total" loading={loading} value={demarches.length} legende="Toutes démarches confondues" />
        <Kpi
          icon={Clock}
          label="En cours"
          loading={loading}
          value={demarches.filter((d) => ["payee_en_cours", "en_traitement"].includes(d.statut ?? "")).length}
          legende="Payées ou en traitement"
        />
        <Kpi
          icon={CheckCircle2}
          label="Terminées"
          loading={loading}
          value={demarches.filter((d) => d.statut === "terminee").length}
          legende="Démarches clôturées"
        />
        <Kpi
          icon={HandCoins}
          label="Honoraires en cours"
          loading={loading}
          value={demarchesActives.reduce((sum, d) => sum + (d.montant_honoraires ?? 0), 0)}
          format={(n) => `${nf.format(n)} F`}
          legende="Démarches non clôturées"
        />
      </div>

      <Card>
        <DataGrid
          rows={filtered}
          columns={columns}
          getRowId={(d) => d.id}
          loading={loading}
          searchPlaceholder="Rechercher par n° de lot, type ou agent…"
          initialSort={{ id: "type", dir: "asc" }}
          onRowClick={(d) => setSelected(d)}
          toolbarExtra={
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="h-8 w-48 text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Tous les statuts</SelectItem>
                {STATUT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
          emptyIcon={Ruler}
          emptyTone="neutral"
          emptyTitle="Aucune démarche enregistrée"
        />
      </Card>

      {/* ── Panneau détail ────────────────────────────────────────────────── */}
      <Sheet
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) {
            setSelected(null);
            setEditing(false);
          }
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetTitle className="sr-only">Détail de la démarche</SheetTitle>
          {selected && (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-border p-5 pr-12">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Instruction foncière</p>
                  <h2 className="mt-1 truncate font-display text-lg font-bold text-foreground">
                    {TYPE_LABELS[selected.type ?? ""] ?? selected.type}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{lotLabel(selected)}</p>
                  {selected.agent?.nom_complet && (
                    <p className="mt-1 text-[11.5px] text-muted-foreground">Assignée à {selected.agent.nom_complet}</p>
                  )}
                </div>
                {peutModifier(selected) && !editing && (
                  <Button variant="outline" size="sm" onClick={() => startEdit(selected)}>
                    <Pencil />
                    Modifier
                  </Button>
                )}
              </div>

              {editing ? (
                <form className="space-y-4 p-5" onSubmit={saveEdit}>
                  <Field label="Statut" htmlFor="d-statut">
                    <Select value={editForm.statut} onValueChange={(v) => setEditForm((f) => ({ ...f, statut: v }))}>
                      <SelectTrigger id="d-statut">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  {isAdmin && (
                    <>
                      <Field label="Géomètre-expert assigné" htmlFor="d-agent">
                        <Select
                          value={editForm.agent_assigne || "__none"}
                          onValueChange={(v) => setEditForm((f) => ({ ...f, agent_assigne: v === "__none" ? "" : v }))}
                        >
                          <SelectTrigger id="d-agent">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">Aucun</SelectItem>
                            {agentOptions.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.nom_complet}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Montant des honoraires (FCFA)" htmlFor="d-honoraires">
                        <Input
                          id="d-honoraires"
                          type="number"
                          min="0"
                          value={editForm.montant_honoraires}
                          onChange={(e) => setEditForm((f) => ({ ...f, montant_honoraires: e.target.value }))}
                        />
                      </Field>
                    </>
                  )}

                  <Field label="Description / notes" htmlFor="d-description">
                    <Textarea
                      id="d-description"
                      rows={3}
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </Field>

                  {editError && (
                    <p role="alert" className="rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2 text-[13px] text-danger">
                      {editError}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={() => { setEditing(false); setEditError(null); }}>
                      Annuler
                    </Button>
                    <Button type="submit" variant="primary" loading={savingEdit}>
                      {savingEdit ? "Enregistrement…" : "Enregistrer"}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4 p-5">
                  <div>
                    <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Statut</p>
                    <div className="mt-1.5">
                      <Badge tone={toneStatut(selected.statut)}>{STATUT_LABELS[selected.statut ?? ""] ?? selected.statut}</Badge>
                    </div>
                  </div>
                  {selected.montant_honoraires != null && (
                    <div>
                      <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Honoraires</p>
                      <p className="mt-1 text-[13px] text-foreground tabular">{nf.format(selected.montant_honoraires)} FCFA</p>
                    </div>
                  )}
                  {selected.description && (
                    <div>
                      <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Description</p>
                      <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground">{selected.description}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Modal création ───────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle démarche</DialogTitle>
            <DialogDescription>Ouvrir une démarche liée à un lot du registre SGNF.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate}>
            <DialogBody className="space-y-4">
              <Field label="Type de démarche" htmlFor="nd-type">
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger id="nd-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Lot concerné" htmlFor="nd-lot" required error={formError && !form.lot_id ? formError : null}>
                <Select value={form.lot_id} onValueChange={(v) => setForm((f) => ({ ...f, lot_id: v }))}>
                  <SelectTrigger id="nd-lot">
                    <SelectValue placeholder="Sélectionner un lot…" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotOptions.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        Lot {l.numero_lot ?? "—"}
                        {l.ilots?.numero ? ` · Îlot ${l.ilots.numero}` : ""}
                        {l.ilots?.lotissements?.nom ? ` — ${l.ilots.lotissements.nom}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Géomètre-expert assigné" htmlFor="nd-agent">
                <Select
                  value={form.agent_assigne || "__none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, agent_assigne: v === "__none" ? "" : v }))}
                >
                  <SelectTrigger id="nd-agent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Aucun (à assigner plus tard)</SelectItem>
                    {agentOptions.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nom_complet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Montant des honoraires (FCFA)" htmlFor="nd-honoraires">
                <Input
                  id="nd-honoraires"
                  type="number"
                  min="0"
                  value={form.montant_honoraires}
                  onChange={(e) => setForm((f) => ({ ...f, montant_honoraires: e.target.value }))}
                  placeholder="Ex. 75000"
                />
              </Field>

              <Field label="Description / notes" htmlFor="nd-description">
                <Textarea
                  id="nd-description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Ex. Bornage contradictoire suite à litige de limite"
                />
              </Field>

              {formError && form.lot_id && (
                <p role="alert" className="rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2 text-[13px] text-danger">
                  {formError}
                </p>
              )}
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="primary" loading={submitting}>
                {submitting ? "Enregistrement…" : "Ouvrir la démarche"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
