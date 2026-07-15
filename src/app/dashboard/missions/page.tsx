"use client";

import { type FormEvent, useCallback, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Download,
  HandCoins,
  Pencil,
  Plus,
  Ruler,
} from "lucide-react";

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

type PvBornage = {
  id: string;
  reference: string;
  statut: string;
  date_bornage: string | null;
  superficie_mesuree_m2: number | null;
  observations: string | null;
  sig_demandeur_le: string | null;
  sig_geometre_le: string | null;
  sig_autorite_le: string | null;
};

type Mission = {
  id: string;
  type_mission: string;
  client_nom: string;
  client_contact: string | null;
  lieu: string | null;
  lot_id: string | null;
  statut: string;
  montant_honoraires: number | null;
  montant_recu: number | null;
  description: string | null;
  ouverte_le: string;
  lots?: {
    numero_lot?: string | number | null;
    ilots?: { numero?: string | number | null; lotissements?: { nom?: string | null } | null } | null;
  } | null;
  pv_bornage?: PvBornage[] | null;
};

type LotOption = {
  id: string;
  numero_lot: string | null;
  ilots?: { numero: string | null; lotissements?: { nom: string | null } | null } | null;
};

// ─── Libellés ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  bornage: "Bornage",
  morcellement: "Morcellement",
  implantation: "Implantation",
  expertise_judiciaire: "Expertise judiciaire",
  leve_topographique: "Levé topographique",
  immatriculation: "Immatriculation",
  copropriete: "Copropriété",
  autre: "Autre",
};
const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));

const STATUT_LABELS: Record<string, string> = {
  en_preparation: "En préparation",
  en_cours: "En cours",
  terminee: "Terminée",
  annulee: "Annulée",
};
const STATUT_OPTIONS = Object.entries(STATUT_LABELS).map(([value, label]) => ({ value, label }));

function toneStatut(s: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (s === "terminee") return "success";
  if (s === "annulee") return "danger";
  if (s === "en_cours") return "accent";
  return "neutral";
}

function lotLabel(m: Mission): string {
  if (!m.lot_id || !m.lots) return m.lieu || "—";
  const l = m.lots;
  const num = l.numero_lot != null ? `Lot ${l.numero_lot}` : "";
  const ilot = l.ilots?.numero != null ? ` · Îlot ${l.ilots.numero}` : "";
  const loti = l.ilots?.lotissements?.nom ? ` — ${l.ilots.lotissements.nom}` : "";
  return `${num}${ilot}${loti}` || m.lieu || "—";
}

function dernierPv(m: Mission): PvBornage | null {
  if (!m.pv_bornage || m.pv_bornage.length === 0) return null;
  return m.pv_bornage[0];
}

const nf = new Intl.NumberFormat("fr-FR");
const SELECT_MISSION =
  "id, type_mission, client_nom, client_contact, lieu, lot_id, statut, montant_honoraires, montant_recu, description, ouverte_le, lots(numero_lot, ilots(numero, lotissements(nom))), pv_bornage(id, reference, statut, date_bornage, superficie_mesuree_m2, observations, sig_demandeur_le, sig_geometre_le, sig_autorite_le)";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MissionsPage() {
  const supabase = createClient();
  const { profile, loading: profileLoading } = useProfile();
  const { counts, refresh: refreshBadges } = useBadgeCounts();

  const [missions, setMissions] = useState<Mission[]>([]);
  const [statutFilter, setStatutFilter] = useState<string>("__all");
  const [selected, setSelected] = useState<Mission | null>(null);

  const load = async () => {
    if (!profile?.geometre_id) return;
    const { data } = await supabase
      .from("missions_geometre")
      .select(SELECT_MISSION)
      .order("ouverte_le", { ascending: false });
    setMissions((data ?? []) as unknown as Mission[]);
  };

  const { isLoading: loading, recharger } = useChargement(
    load,
    [profile?.geometre_id],
    !profileLoading && !!profile?.geometre_id
  );

  const rafraichir = useCallback(() => {
    void recharger();
    refreshBadges();
  }, [recharger, refreshBadges]);

  const filtered = statutFilter === "__all" ? missions : missions.filter((m) => m.statut === statutFilter);

  const missionsActives = missions.filter((m) => !["terminee", "annulee"].includes(m.statut));

  // ── Édition mission ──────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ statut: "en_preparation", montant_honoraires: "", montant_recu: "", description: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const startEdit = (m: Mission) => {
    setEditForm({
      statut: m.statut,
      montant_honoraires: m.montant_honoraires != null ? String(m.montant_honoraires) : "",
      montant_recu: m.montant_recu != null ? String(m.montant_recu) : "",
      description: m.description ?? "",
    });
    setEditError(null);
    setEditing(true);
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSavingEdit(true);
    setEditError(null);
    const payload: Database["public"]["Tables"]["missions_geometre"]["Update"] = {
      statut: editForm.statut as Database["public"]["Enums"]["statut_mission_geometre"],
      montant_honoraires: editForm.montant_honoraires ? Number(editForm.montant_honoraires) : null,
      montant_recu: editForm.montant_recu ? Number(editForm.montant_recu) : null,
      description: editForm.description.trim() || null,
    };
    if (editForm.statut === "terminee") payload.terminee_le = new Date().toISOString();
    const { error } = await supabase.from("missions_geometre").update(payload).eq("id", selected.id);
    setSavingEdit(false);
    if (error) {
      setEditError(error.message);
      return;
    }
    setSelected({ ...selected, ...payload } as Mission);
    setEditing(false);
    rafraichir();
  };

  // ── Création mission ─────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [lotOptions, setLotOptions] = useState<LotOption[]>([]);
  const [form, setForm] = useState({
    type_mission: "bornage",
    client_nom: "",
    client_contact: "",
    lieu: "",
    lot_id: "",
    montant_honoraires: "",
    description: "",
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
    setForm({ type_mission: "bornage", client_nom: "", client_contact: "", lieu: "", lot_id: "", montant_honoraires: "", description: "" });
    setFormError(null);
    setShowCreate(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.client_nom.trim()) {
      setFormError("Le nom du client est obligatoire.");
      return;
    }
    if (!profile?.geometre_id) {
      setFormError("Profil non chargé, réessayez dans un instant.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("missions_geometre").insert([
      {
        geometre_id: profile.geometre_id,
        type_mission: form.type_mission as Database["public"]["Enums"]["type_mission_geometre"],
        client_nom: form.client_nom.trim(),
        client_contact: form.client_contact.trim() || null,
        lieu: form.lieu.trim() || null,
        lot_id: form.lot_id || null,
        montant_honoraires: form.montant_honoraires ? Number(form.montant_honoraires) : null,
        description: form.description.trim() || null,
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

  // ── Génération du PV de bornage ──────────────────────────────────────────
  const [showPvForm, setShowPvForm] = useState(false);
  const [pvForm, setPvForm] = useState({ date_bornage: "", superficie_mesuree_m2: "", observations: "" });
  const [generatingPv, setGeneratingPv] = useState(false);
  const [pvError, setPvError] = useState<string | null>(null);

  const rechargerSelection = async (id: string) => {
    const { data } = await supabase.from("missions_geometre").select(SELECT_MISSION).eq("id", id).single();
    if (data) setSelected(data as unknown as Mission);
  };

  const genererPv = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setGeneratingPv(true);
    setPvError(null);
    const { error } = await supabase.rpc("generer_pv_bornage", {
      p_mission_id: selected.id,
      p_date_bornage: (pvForm.date_bornage || null) as unknown as string,
      p_superficie_mesuree_m2: (pvForm.superficie_mesuree_m2 ? Number(pvForm.superficie_mesuree_m2) : null) as unknown as number,
      p_observations: (pvForm.observations.trim() || null) as unknown as string,
    });
    setGeneratingPv(false);
    if (error) {
      setPvError(error.message);
      return;
    }
    setShowPvForm(false);
    setPvForm({ date_bornage: "", superficie_mesuree_m2: "", observations: "" });
    rafraichir();
    await rechargerSelection(selected.id);
  };

  const [downloadState, setDownloadState] = useState<"idle" | "loading" | "error">("idle");
  const telechargerPv = async (reference: string) => {
    setDownloadState("loading");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/telecharger-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ table: "pv_bornage", reference }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.erreur || "Téléchargement impossible");
      window.open(json.url, "_blank");
      setDownloadState("idle");
    } catch {
      setDownloadState("error");
    }
  };

  const basculerSignature = async (pv: PvBornage, champ: "sig_demandeur_le" | "sig_geometre_le" | "sig_autorite_le") => {
    const valeur = pv[champ] ? null : new Date().toISOString();
    const payload = { [champ]: valeur } as Database["public"]["Tables"]["pv_bornage"]["Update"];
    const { error } = await supabase.from("pv_bornage").update(payload).eq("id", pv.id);
    if (!error && selected) {
      await rechargerSelection(selected.id);
      rafraichir();
    }
  };

  const marquerRemis = async (pv: PvBornage) => {
    const { error } = await supabase
      .from("pv_bornage")
      .update({ statut: "delivree", delivree_le: new Date().toISOString() })
      .eq("id", pv.id);
    if (!error && selected) {
      await rechargerSelection(selected.id);
      rafraichir();
    }
  };

  // ── Colonnes ──────────────────────────────────────────────────────────────
  const columns: Array<Column<Mission>> = [
    {
      id: "client",
      header: "Client",
      sortBy: (m) => m.client_nom,
      searchBy: (m) => `${m.client_nom} ${TYPE_LABELS[m.type_mission] ?? ""} ${m.lieu ?? ""}`,
      cell: (m) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{m.client_nom}</p>
          <p className="truncate text-[11.5px] text-muted-foreground">{TYPE_LABELS[m.type_mission] ?? m.type_mission}</p>
        </div>
      ),
    },
    {
      id: "lieu",
      header: "Lieu / lot",
      secondary: true,
      sortBy: (m) => lotLabel(m),
      cell: (m) => <span className="block truncate text-muted-foreground">{lotLabel(m)}</span>,
    },
    {
      id: "pv",
      header: "PV",
      width: "9rem",
      secondary: true,
      cell: (m) => {
        const pv = dernierPv(m);
        return pv ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-accent">
            <Ruler className="size-3" /> {pv.reference}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      id: "statut",
      header: "Statut",
      width: "10rem",
      sortBy: (m) => m.statut,
      cell: (m) => <Badge tone={toneStatut(m.statut)}>{STATUT_LABELS[m.statut] ?? m.statut}</Badge>,
    },
    {
      id: "honoraires",
      header: "Honoraires",
      width: "9rem",
      align: "right",
      secondary: true,
      sortBy: (m) => m.montant_honoraires ?? 0,
      cell: (m) => (
        <span className="font-semibold text-foreground tabular">
          {m.montant_honoraires != null ? `${nf.format(m.montant_honoraires)} F` : "—"}
        </span>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  if (!profileLoading && !profile?.geometre_id) {
    return (
      <AppShell title="Mes missions" loading={false} counts={counts} onRefresh={rafraichir}>
        <div className="flex min-h-[300px] items-center justify-center px-4">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent-subtle">
              <Briefcase className="size-6 text-accent" />
            </div>
            <p className="text-[13.5px] font-semibold text-foreground">Compte en cours de provisionnement</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              Votre compte n&apos;est pas encore rattaché à une fiche du registre des géomètres-experts. Contactez
              l&apos;administration SGNF pour finaliser votre inscription.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const pv = selected ? dernierPv(selected) : null;
  const toutesSignatures = pv ? !!(pv.sig_demandeur_le && pv.sig_geometre_le && pv.sig_autorite_le) : false;

  return (
    <AppShell title="Mes missions" loading={loading} counts={counts} onRefresh={rafraichir}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">Mes missions</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Portefeuille de missions clients — pas seulement celles liées au registre SGNF.
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus />
          Nouvelle mission
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Briefcase} label="Total" loading={loading} value={missions.length} legende="Toutes missions confondues" />
        <Kpi
          icon={Clock}
          label="En cours"
          loading={loading}
          value={missions.filter((m) => m.statut === "en_cours").length}
          legende="Missions actuellement actives"
        />
        <Kpi
          icon={CheckCircle2}
          label="Terminées"
          loading={loading}
          value={missions.filter((m) => m.statut === "terminee").length}
          legende="Missions clôturées"
        />
        <Kpi
          icon={HandCoins}
          label="Honoraires en cours"
          loading={loading}
          value={missionsActives.reduce((sum, m) => sum + (m.montant_honoraires ?? 0), 0)}
          format={(n) => `${nf.format(n)} F`}
          legende="Missions non clôturées"
        />
      </div>

      <Card>
        <DataGrid
          rows={filtered}
          columns={columns}
          getRowId={(m) => m.id}
          loading={loading}
          searchPlaceholder="Rechercher par client ou lieu…"
          initialSort={{ id: "client", dir: "asc" }}
          onRowClick={(m) => setSelected(m)}
          toolbarExtra={
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="h-8 w-44 text-[12.5px]">
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
          emptyIcon={Briefcase}
          emptyTone="pending"
          emptyTitle="Aucune mission enregistrée"
          emptyDescription="Cliquez sur « Nouvelle mission » pour commencer."
        />
      </Card>

      {/* ── Panneau détail ────────────────────────────────────────────────── */}
      <Sheet
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) {
            setSelected(null);
            setEditing(false);
            setShowPvForm(false);
          }
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetTitle className="sr-only">Détail de la mission</SheetTitle>
          {selected && (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-border p-5 pr-12">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Espace partenaire</p>
                  <h2 className="mt-1 truncate font-display text-lg font-bold text-foreground">{selected.client_nom}</h2>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {TYPE_LABELS[selected.type_mission] ?? selected.type_mission} · {lotLabel(selected)}
                  </p>
                </div>
                {!editing && (
                  <Button variant="outline" size="sm" onClick={() => startEdit(selected)}>
                    <Pencil />
                    Modifier
                  </Button>
                )}
              </div>

              {editing ? (
                <form className="space-y-4 p-5" onSubmit={saveEdit}>
                  <Field label="Statut" htmlFor="m-statut">
                    <Select value={editForm.statut} onValueChange={(v) => setEditForm((f) => ({ ...f, statut: v }))}>
                      <SelectTrigger id="m-statut">
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
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Honoraires (FCFA)" htmlFor="m-honoraires">
                      <Input
                        id="m-honoraires"
                        type="number"
                        min="0"
                        value={editForm.montant_honoraires}
                        onChange={(e) => setEditForm((f) => ({ ...f, montant_honoraires: e.target.value }))}
                      />
                    </Field>
                    <Field label="Montant reçu (FCFA)" htmlFor="m-recu">
                      <Input
                        id="m-recu"
                        type="number"
                        min="0"
                        value={editForm.montant_recu}
                        onChange={(e) => setEditForm((f) => ({ ...f, montant_recu: e.target.value }))}
                      />
                    </Field>
                  </div>
                  <Field label="Description / notes" htmlFor="m-description">
                    <Textarea
                      id="m-description"
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
                      <Badge tone={toneStatut(selected.statut)}>{STATUT_LABELS[selected.statut] ?? selected.statut}</Badge>
                    </div>
                  </div>
                  {selected.client_contact && (
                    <div>
                      <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Contact client</p>
                      <p className="mt-1 text-[13px] text-foreground">{selected.client_contact}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Honoraires</p>
                      <p className="mt-1 text-[13px] text-foreground tabular">
                        {selected.montant_honoraires != null ? `${nf.format(selected.montant_honoraires)} FCFA` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Reçu</p>
                      <p className="mt-1 text-[13px] text-foreground tabular">
                        {selected.montant_recu != null ? `${nf.format(selected.montant_recu)} FCFA` : "—"}
                      </p>
                    </div>
                  </div>
                  {selected.description && (
                    <div>
                      <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Description</p>
                      <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground">{selected.description}</p>
                    </div>
                  )}

                  {/* ── PV de bornage ── */}
                  {selected.type_mission === "bornage" && (
                    <div className="rounded-xl border border-accent/25 bg-accent-subtle p-4">
                      <p className="text-[11px] font-bold tracking-wider text-accent uppercase">Procès-verbal de bornage</p>

                      {!pv && !showPvForm && (
                        <Button variant="accent" size="sm" className="mt-3" onClick={() => setShowPvForm(true)}>
                          <Ruler />
                          Générer le PV de bornage
                        </Button>
                      )}

                      {!pv && showPvForm && (
                        <form className="mt-3 space-y-3" onSubmit={genererPv}>
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Date du bornage" htmlFor="pv-date">
                              <Input
                                id="pv-date"
                                type="date"
                                value={pvForm.date_bornage}
                                onChange={(e) => setPvForm((f) => ({ ...f, date_bornage: e.target.value }))}
                              />
                            </Field>
                            <Field label="Superficie mesurée (m²)" htmlFor="pv-superficie">
                              <Input
                                id="pv-superficie"
                                type="number"
                                min="0"
                                value={pvForm.superficie_mesuree_m2}
                                onChange={(e) => setPvForm((f) => ({ ...f, superficie_mesuree_m2: e.target.value }))}
                              />
                            </Field>
                          </div>
                          <Field label="Observations" htmlFor="pv-observations">
                            <Textarea
                              id="pv-observations"
                              rows={2}
                              value={pvForm.observations}
                              onChange={(e) => setPvForm((f) => ({ ...f, observations: e.target.value }))}
                            />
                          </Field>
                          {pvError && <p className="text-[12.5px] text-danger">{pvError}</p>}
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setShowPvForm(false)}>
                              Annuler
                            </Button>
                            <Button type="submit" variant="accent" size="sm" loading={generatingPv}>
                              {generatingPv ? "Génération…" : "Générer"}
                            </Button>
                          </div>
                        </form>
                      )}

                      {pv && (
                        <div className="mt-3 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-foreground">{pv.reference}</p>
                              <p className="text-[11.5px] text-muted-foreground">
                                Bornage du {pv.date_bornage ?? "—"} · {pv.superficie_mesuree_m2 ?? "—"} m²
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => telechargerPv(pv.reference)}
                              disabled={downloadState === "loading"}
                            >
                              <Download />
                              {downloadState === "loading" ? "…" : "Télécharger"}
                            </Button>
                          </div>
                          {downloadState === "error" && (
                            <p className="text-[12.5px] text-danger">Le fichier n&apos;est pas encore disponible, réessayez.</p>
                          )}

                          <div className="space-y-1.5">
                            <p className="text-[11.5px] font-semibold text-muted-foreground">Signatures recueillies</p>
                            {(
                              [
                                ["sig_demandeur_le", "Le demandeur"],
                                ["sig_geometre_le", "Le géomètre-expert"],
                                ["sig_autorite_le", "L'autorité coutumière"],
                              ] as const
                            ).map(([champ, label]) => (
                              <label key={champ} className="flex items-center gap-2 text-[13px] text-foreground">
                                <input
                                  type="checkbox"
                                  checked={!!pv[champ]}
                                  onChange={() => basculerSignature(pv, champ)}
                                  className="size-4 rounded border-border-strong accent-[var(--accent)]"
                                />
                                {label}
                              </label>
                            ))}
                          </div>

                          {pv.statut === "delivree" ? (
                            <Badge tone="success">
                              <CheckCircle2 className="size-3" /> Remis
                            </Badge>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              className="bg-success text-white hover:bg-success/90"
                              onClick={() => marquerRemis(pv)}
                              disabled={!toutesSignatures}
                            >
                              <CheckCircle2 />
                              Marquer comme remis
                            </Button>
                          )}
                        </div>
                      )}
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
            <DialogTitle>Nouvelle mission</DialogTitle>
            <DialogDescription>Enregistrer une mission cliente — dans ou hors registre SGNF.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate}>
            <DialogBody className="space-y-4">
              <Field label="Type de mission" htmlFor="c-type">
                <Select value={form.type_mission} onValueChange={(v) => setForm((f) => ({ ...f, type_mission: v }))}>
                  <SelectTrigger id="c-type">
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

              <Field label="Client / demandeur" htmlFor="c-client" required error={formError && !form.client_nom.trim() ? formError : null}>
                <Input
                  id="c-client"
                  value={form.client_nom}
                  onChange={(e) => setForm((f) => ({ ...f, client_nom: e.target.value }))}
                  placeholder="Ex. Kouassi Yao Bernard"
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Contact client" htmlFor="c-contact">
                  <Input
                    id="c-contact"
                    value={form.client_contact}
                    onChange={(e) => setForm((f) => ({ ...f, client_contact: e.target.value }))}
                    placeholder="+225 07 00 00 00"
                  />
                </Field>
                <Field label="Lieu" htmlFor="c-lieu">
                  <Input
                    id="c-lieu"
                    value={form.lieu}
                    onChange={(e) => setForm((f) => ({ ...f, lieu: e.target.value }))}
                    placeholder="Ex. Anyama, Ebimpé"
                  />
                </Field>
              </div>

              <Field label="Lot du registre SGNF (optionnel)" htmlFor="c-lot">
                <Select value={form.lot_id || "__none"} onValueChange={(v) => setForm((f) => ({ ...f, lot_id: v === "__none" ? "" : v }))}>
                  <SelectTrigger id="c-lot">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Aucun — client hors registre</SelectItem>
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

              <Field label="Honoraires (FCFA)" htmlFor="c-honoraires">
                <Input
                  id="c-honoraires"
                  type="number"
                  min="0"
                  value={form.montant_honoraires}
                  onChange={(e) => setForm((f) => ({ ...f, montant_honoraires: e.target.value }))}
                  placeholder="Ex. 150000"
                />
              </Field>

              <Field label="Description / notes" htmlFor="c-description">
                <Textarea
                  id="c-description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Détails de la mission…"
                />
              </Field>

              {formError && form.client_nom.trim() && (
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
                {submitting ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
