"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import KpiCard from "@/components/dashboard/KpiCard";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Gavel,
  Plus,
  Scale,
  X,
} from "lucide-react";

type LitigeRecord = {
  id: string;
  lot_id: string | null;
  objet: string | null;
  statut: string | null;
  ouvert_le: string | null;
  notes: string | null;
  lots?: { numero_lot: string | null } | null;
};

type LotOption = { id: string; numero_lot: string | null };

const STATUT_CONFIG: Record<string, { badge: "disponible" | "attribue" | "en_validation" | "litige"; label: string }> = {
  ouvert: { badge: "litige", label: "Ouvert" },
  en_mediation: { badge: "en_validation", label: "En médiation" },
  tranche: { badge: "attribue", label: "Tranché" },
  clos: { badge: "disponible", label: "Clos" },
};

const TABLE_HEADERS = ["Réf.", "Lot concerné", "Objet", "Statut", "Date d'ouverture", "Actions"] as const;

export default function LitigesPage() {
  const supabase = createClient();
  const { isAdmin } = useProfile();

  const [litiges, setLitiges] = useState<LitigeRecord[]>([]);
  const [lotsOptions, setLotsOptions] = useState<LotOption[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ lot_id: "", objet: "", notes: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadLitiges = async () => {
    setDataLoading(true);
    const { data } = await supabase
      .from("litiges")
      .select("id, lot_id, objet, statut, ouvert_le, notes, lots(numero_lot)")
      .order("ouvert_le", { ascending: false });
    setLitiges((data ?? []) as LitigeRecord[]);
    setDataLoading(false);
  };

  const loadLots = async () => {
    const { data } = await supabase
      .from("lots")
      .select("id, numero_lot")
      .order("numero_lot", { ascending: true });
    setLotsOptions((data ?? []) as LotOption[]);
  };

  useEffect(() => {
    void loadLitiges();
    void loadLots();
  }, []);

  const ouverts = litiges.filter((l) => l.statut === "ouvert" || l.statut === "en_mediation").length;
  const clos = litiges.filter((l) => l.statut === "tranche" || l.statut === "clos").length;
  const taux = litiges.length > 0 ? Math.round((clos / litiges.length) * 100) : 0;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.objet.trim()) {
      setErrorMessage("L'objet du litige est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await (supabase.from("litiges") as any).insert([
      {
        ...(form.lot_id ? { lot_id: form.lot_id } : {}),
        objet: form.objet.trim(),
        notes: form.notes.trim() || null,
        statut: "ouvert",
        cree_par: user?.id ?? null,
      },
    ]);

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setForm({ lot_id: "", objet: "", notes: "" });
    setIsModalOpen(false);
    setIsSubmitting(false);
    setSuccessMessage("Dossier de litige ouvert avec succès.");
    setTimeout(() => setSuccessMessage(null), 4000);
    await loadLitiges();
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* En-tête */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-primary">
            Gestion des Litiges
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Registre des réclamations, arbitrages coutumiers et résolutions juridiques.{" "}
            <span className={ouverts > 0 ? "font-medium text-[#EF4444]" : "font-medium text-[#2D8F5A]"}>
              {ouverts} litige{ouverts !== 1 ? "s" : ""} actif{ouverts !== 1 ? "s" : ""}.
            </span>
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => { setIsModalOpen(true); setErrorMessage(null); }}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#EF4444] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#DC2626] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Ouvrir un dossier de litige
          </button>
        )}
      </div>

      {successMessage && (
        <div className="mb-4 rounded-2xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      )}

      {/* KPI */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            { label: "Dossiers résolus", value: String(clos), icon: CheckCircle2, gradient: ["#16A34A", "#4ADE80"] },
            { label: "En cours d'arbitrage", value: String(ouverts), icon: Gavel, gradient: ["#D97706", "#FBBF24"] },
            { label: "Taux de résolution", value: `${taux}%`, icon: Scale, gradient: ["#1E6091", "#4FA8D8"] },
          ] as { label: string; value: string; icon: typeof CheckCircle2; gradient: [string, string] }[]
        ).map((metric) => (
          <KpiCard
            key={metric.label}
            label={metric.label}
            value={dataLoading ? "…" : metric.value}
            icon={metric.icon}
            gradient={metric.gradient}
          />
        ))}
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
        <div className="border-b border-slate-200/60 bg-slate-50/50 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Registre des litiges
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/50">
                {TABLE_HEADERS.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 last:text-right"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {dataLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                    Chargement des litiges…
                  </td>
                </tr>
              ) : litiges.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                    Aucun dossier de litige enregistré.
                  </td>
                </tr>
              ) : (
                litiges.map((litige) => {
                  const cfg = STATUT_CONFIG[litige.statut ?? "ouvert"] ?? STATUT_CONFIG.ouvert;
                  return (
                    <tr key={litige.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-4 font-mono text-xs font-medium text-[#0D3B66]">
                        {litige.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {litige.lots?.numero_lot ? `Lot ${litige.lots.numero_lot}` : "N/A"}
                      </td>
                      <td className="max-w-[220px] truncate px-5 py-4 text-sm text-slate-700">
                        {litige.objet || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <Badge status={cfg.badge}>{cfg.label}</Badge>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {litige.ouvert_le
                          ? new Date(litige.ouvert_le).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#0D3B66]"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Dossier
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal d'ouverture de litige */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#EF4444]">
                  Nouveau dossier
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[#0D3B66]">
                  Ouvrir un dossier de litige
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {/* Lot concerné */}
              <div className="space-y-1.5">
                <label htmlFor="litige-lot" className="text-sm font-medium text-slate-700">
                  Lot concerné
                </label>
                <select
                  id="litige-lot"
                  value={form.lot_id}
                  onChange={(e) => setForm((f) => ({ ...f, lot_id: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                >
                  <option value="">— Sélectionner un lot (optionnel) —</option>
                  {lotsOptions.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      Lot {lot.numero_lot}
                    </option>
                  ))}
                </select>
              </div>

              {/* Objet */}
              <div className="space-y-1.5">
                <label htmlFor="litige-objet" className="text-sm font-medium text-slate-700">
                  Objet du litige <span className="text-red-500">*</span>
                </label>
                <input
                  id="litige-objet"
                  type="text"
                  value={form.objet}
                  onChange={(e) => setForm((f) => ({ ...f, objet: e.target.value }))}
                  placeholder="Ex. Contestation de limites de parcelle"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label htmlFor="litige-notes" className="text-sm font-medium text-slate-700">
                  Notes
                </label>
                <textarea
                  id="litige-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Détails, contexte, parties impliquées…"
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10 resize-none"
                />
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-xs text-amber-700">
                  L'ouverture d'un dossier de litige est enregistrée dans le journal d'audit et notifiée aux parties concernées.
                </p>
              </div>

              {errorMessage && (
                <div className="rounded-2xl border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full bg-[#EF4444] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#DC2626] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Ouverture…" : "Ouvrir le dossier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
