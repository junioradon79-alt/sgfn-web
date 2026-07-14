"use client";

import { useState, type FormEvent } from "react";
import type { Database } from "../../../../database.types";
import { useChargement } from "@/hooks/useChargement";
import { useProfile } from "@/hooks/useProfile";
import {
  ChevronRight,
  FileText,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/utils/supabase/client";

// ─── Types ──────────────────────────────────────────────────────────────────

type DossierAdu = {
  id: string;
  lot_id?: string | null;
  adu_numero?: string | null;
  statut?: string | null;
  depose_le?: string | null;
  notes?: string | null;
  adu_date?: string | null;
  acd_reference?: string | null;
  cree_le?: string | null;
  lots?: {
    numero_lot?: string | number | null;
    ilots?: {
      numero?: string | number | null;
      lotissements?: { nom?: string | null } | null;
    } | null;
  } | null;
};

type LotOption = {
  id: string;
  numero_lot: string | null;
  ilots?: { numero: string | null; lotissements?: { nom: string | null } | null } | null;
};

const STATUT_ADU_LABELS: Record<string, string> = {
  en_preparation: "En préparation",
  piece_manquante: "Pièce manquante",
  depose: "Déposé",
  en_instruction: "En instruction",
  adu_delivree: "ADU délivrée",
  acd_obtenu: "ACD obtenu",
  rejete: "Rejeté",
};

const STATUT_ADU_OPTIONS = Object.entries(STATUT_ADU_LABELS).map(
  ([value, label]) => ({ value, label })
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function badgeStatus(s: string | null | undefined): "attribue" | "en_validation" | "litige" | "disponible" {
  const st = s ?? "";
  if (st === "adu_delivree" || st === "acd_obtenu") return "attribue";
  if (st === "en_instruction" || st === "depose") return "en_validation";
  if (st === "rejete") return "litige";
  return "disponible";
}

function lotLabel(d: DossierAdu): string {
  const num = d.lots?.numero_lot != null ? `Lot ${d.lots.numero_lot}` : "Lot —";
  const ilot = d.lots?.ilots?.numero != null ? ` · Îlot ${d.lots.ilots.numero}` : "";
  const loti = d.lots?.ilots?.lotissements?.nom ? ` — ${d.lots.ilots.lotissements.nom}` : "";
  return `${num}${ilot}${loti}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DossiersAduPage() {
  const supabase = createClient();
  const { isAdmin } = useProfile();

  const [dossiers, setDossiers] = useState<DossierAdu[]>([]);

  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [selected, setSelected] = useState<DossierAdu | null>(null);

  // Édition du dossier sélectionné — seul point d'entrée pour faire progresser
  // un statut après création (la modale de création ne sert qu'à l'état initial).
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    statut: "en_preparation",
    adu_numero: "",
    depose_le: "",
    adu_date: "",
    acd_reference: "",
    notes: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const startEdit = (d: DossierAdu) => {
    setEditForm({
      statut: d.statut ?? "en_preparation",
      adu_numero: d.adu_numero ?? "",
      depose_le: d.depose_le ? d.depose_le.slice(0, 10) : "",
      adu_date: d.adu_date ? d.adu_date.slice(0, 10) : "",
      acd_reference: d.acd_reference ?? "",
      notes: d.notes ?? "",
    });
    setEditError(null);
    setEditing(true);
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSavingEdit(true);
    setEditError(null);
    const payload = {
      statut: editForm.statut as Database["public"]["Enums"]["statut_dossier_adu"],
      adu_numero: editForm.adu_numero.trim() || null,
      depose_le: editForm.depose_le || null,
      adu_date: editForm.adu_date || null,
      acd_reference: editForm.acd_reference.trim() || null,
      notes: editForm.notes.trim() || null,
    };
    const { error } = await supabase.from("dossiers_adu").update(payload).eq("id", selected.id);
    setSavingEdit(false);
    if (error) {
      setEditError(error.message);
      return;
    }
    setSelected({ ...selected, ...payload });
    setEditing(false);
    void recharger();
  };

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [lotOptions, setLotOptions] = useState<LotOption[]>([]);
  const [form, setForm] = useState({
    lot_id: "",
    statut: "en_preparation",
    adu_numero: "",
    depose_le: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {

    const { data } = await supabase
      .from("dossiers_adu")
      .select(
        "id, lot_id, adu_numero, statut, depose_le, notes, adu_date, acd_reference, cree_le, lots(numero_lot, ilots(numero, lotissements(nom)))"
      )
      .order("cree_le", { ascending: false });
    setDossiers((data ?? []) as unknown as DossierAdu[]);

  };

  const { isLoading: loading, recharger } = useChargement(load);

  const filtered = dossiers.filter((d) => {
    if (statutFilter && d.statut !== statutFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const numAdu = (d.adu_numero ?? "").toLowerCase();
      const numLot = String(d.lots?.numero_lot ?? "").toLowerCase();
      if (!numAdu.includes(q) && !numLot.includes(q)) return false;
    }
    return true;
  });

  const kpis = [
    { label: "Total", value: dossiers.length, color: "text-[#0D3B66]" },
    {
      label: "En cours",
      value: dossiers.filter((d) => ["depose", "en_instruction"].includes(d.statut ?? "")).length,
      color: "text-[#1E6091]",
    },
    {
      label: "Délivrés / ACD",
      value: dossiers.filter((d) => ["adu_delivree", "acd_obtenu"].includes(d.statut ?? "")).length,
      color: "text-[#2D8F5A]",
    },
    {
      label: "Rejetés",
      value: dossiers.filter((d) => d.statut === "rejete").length,
      color: "text-red-500",
    },
  ];

  const openCreate = async () => {
    if (lotOptions.length === 0) {
      const { data } = await supabase
        .from("lots")
        .select("id, numero_lot, ilots(numero, lotissements(nom))")
        .order("numero_lot")
        .limit(200);
      setLotOptions((data ?? []) as unknown as LotOption[]);
    }
    setForm({ lot_id: "", statut: "en_preparation", adu_numero: "", depose_le: "", notes: "" });
    setFormError(null);
    setShowCreate(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.lot_id) { setFormError("Sélectionnez un lot."); return; }
    setSubmitting(true);
    setFormError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("dossiers_adu").insert([{
      lot_id: form.lot_id,
      statut: form.statut as Database["public"]["Enums"]["statut_dossier_adu"],
      adu_numero: form.adu_numero.trim() || null,
      depose_le: form.depose_le || null,
      notes: form.notes.trim() || null,
      cree_par: user?.id ?? null,
    }]);
    setSubmitting(false);
    if (error) { setFormError(error.message); return; }
    setShowCreate(false);
    void recharger();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
            Instruction foncière
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#0D3B66]">Dossiers ADU & ACD</h1>
          <p className="mt-1 text-sm sm:text-base text-slate-400">
            Suivi des autorisations de droits urbains et arrêtés de concession définitive
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#0D3B66] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#1E6091]"
        >
          <Plus className="h-3.5 w-3.5" />
          Nouveau dossier
        </button>
      </div>

      {/* KPIs */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {kpi.label}
            </p>
            <p className={`mt-2 text-3xl font-bold ${kpi.color}`}>
              {loading ? <Loader2 className="h-6 w-6 animate-spin opacity-40" /> : kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher par n° ADU ou n° lot…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
          >
            <option value="">Tous les statuts</option>
            {STATUT_ADU_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {(search || statutFilter) && (
          <button
            type="button"
            onClick={() => { setSearch(""); setStatutFilter(""); }}
            className="text-sm text-slate-400 hover:text-slate-600 shrink-0"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* List */}
      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-10 text-center text-sm text-slate-400">
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-10 text-center text-sm text-slate-500">
            {dossiers.length === 0
              ? "Aucun dossier ADU enregistré. Cliquez sur « Nouveau dossier » pour commencer."
              : "Aucun résultat pour ces filtres."}
          </div>
        ) : (
          filtered.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelected(d)}
              className="w-full rounded-2xl border border-slate-200/60 bg-white px-5 py-4 text-left shadow-sm transition hover:border-[#1E6091]/30 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-[#1E6091]" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {d.adu_numero || "Dossier sans numéro"}
                    </p>
                    <p className="truncate text-xs text-slate-400">{lotLabel(d)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge status={badgeStatus(d.statut)}>
                    {STATUT_ADU_LABELS[d.statut ?? ""] ?? d.statut}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
              </div>
              {d.depose_le && (
                <p className="mt-1.5 text-xs text-slate-400">
                  Déposé le {new Date(d.depose_le).toLocaleDateString("fr-FR")}
                </p>
              )}
            </button>
          ))
        )}
      </div>

      {/* ── Panneau détail ────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
          <div
            className="w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-slate-200/70 bg-white shadow-2xl"
            style={{ maxHeight: "90vh" }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
                  Instruction foncière
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[#0D3B66]">
                  {selected.adu_numero || "Dossier sans numéro"}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">{lotLabel(selected)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isAdmin && !editing && (
                  <button
                    type="button"
                    onClick={() => startEdit(selected)}
                    title="Modifier le dossier"
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Modifier
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setSelected(null); setEditing(false); }}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {editing ? (
              <form className="space-y-4 p-6" onSubmit={saveEdit}>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Statut</label>
                  <select
                    value={editForm.statut}
                    onChange={(e) => setEditForm((f) => ({ ...f, statut: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
                  >
                    {STATUT_ADU_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Numéro ADU</label>
                    <input
                      type="text"
                      value={editForm.adu_numero}
                      onChange={(e) => setEditForm((f) => ({ ...f, adu_numero: e.target.value }))}
                      placeholder="Ex. ADU-2026-001"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Référence ACD</label>
                    <input
                      type="text"
                      value={editForm.acd_reference}
                      onChange={(e) => setEditForm((f) => ({ ...f, acd_reference: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Date de dépôt</label>
                    <input
                      type="date"
                      value={editForm.depose_le}
                      onChange={(e) => setEditForm((f) => ({ ...f, depose_le: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Date ADU</label>
                    <input
                      type="date"
                      value={editForm.adu_date}
                      onChange={(e) => setEditForm((f) => ({ ...f, adu_date: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Notes</label>
                  <textarea
                    rows={3}
                    value={editForm.notes}
                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#0D3B66] focus:outline-none"
                  />
                </div>
                {editError && (
                  <div className="rounded-2xl border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {editError}
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setEditing(false); setEditError(null); }}
                    className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="rounded-full bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E6091] disabled:opacity-70"
                  >
                    {savingEdit ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </div>
              </form>
            ) : (
            <div className="space-y-4 p-6">
              <div className="mb-2">
                <Badge status={badgeStatus(selected.statut)}>
                  {STATUT_ADU_LABELS[selected.statut ?? ""] ?? selected.statut ?? "Statut inconnu"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Date de dépôt",
                    value: selected.depose_le
                      ? new Date(selected.depose_le).toLocaleDateString("fr-FR")
                      : "—",
                  },
                  {
                    label: "Date ADU",
                    value: selected.adu_date
                      ? new Date(selected.adu_date).toLocaleDateString("fr-FR")
                      : "—",
                  },
                  { label: "Référence ACD", value: selected.acd_reference ?? "—" },
                  {
                    label: "Enregistré le",
                    value: selected.cree_le
                      ? new Date(selected.cree_le).toLocaleDateString("fr-FR")
                      : "—",
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">{item.label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-700">{item.value}</p>
                  </div>
                ))}
              </div>
              {selected.notes && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Notes
                  </p>
                  <p className="whitespace-pre-wrap rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {selected.notes}
                  </p>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Fermer
                </button>
              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modale création ───────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
          <div
            className="w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-2xl sm:p-8"
            style={{ maxHeight: "92vh" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
                  Instruction foncière
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[#0D3B66]">Nouveau dossier ADU</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleCreate}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Lot concerné <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.lot_id}
                  onChange={(e) => setForm((f) => ({ ...f, lot_id: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                >
                  <option value="">— Sélectionner un lot —</option>
                  {lotOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      Lot {l.numero_lot ?? "—"}
                      {l.ilots?.numero ? ` · Îlot ${l.ilots.numero}` : ""}
                      {l.ilots?.lotissements?.nom ? ` — ${l.ilots.lotissements.nom}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Statut</label>
                <select
                  value={form.statut}
                  onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
                >
                  {STATUT_ADU_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Numéro ADU</label>
                <input
                  type="text"
                  value={form.adu_numero}
                  onChange={(e) => setForm((f) => ({ ...f, adu_numero: e.target.value }))}
                  placeholder="Ex. ADU-2026-001"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Date de dépôt</label>
                <input
                  type="date"
                  value={form.depose_le}
                  onChange={(e) => setForm((f) => ({ ...f, depose_le: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Observations, documents manquants…"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#0D3B66] focus:outline-none"
                />
              </div>

              {formError && (
                <div className="rounded-2xl border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E6091] disabled:opacity-70"
                >
                  {submitting ? "Enregistrement…" : "Créer le dossier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
