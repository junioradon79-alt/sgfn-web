"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Link2, Plus, X } from "lucide-react";

type AttributionRecord = {
  id: string;
  lot_id: string | null;
  attributaire_id: string | null;
  qualite: string | null;
  actuel: boolean | null;
  depuis: string | null;
  observation: string | null;
  lots?: { numero_lot: string | null } | null;
  attributaires?: { nom: string | null } | null;
};

type LotOption = { id: string; numero_lot: string | null };
type AttributaireOption = { id: string; nom: string | null };

const QUALITE_OPTIONS = [
  { value: "ayant_droit", label: "Ayant droit" },
  { value: "ayant_droit_transmission", label: "Ayant droit (transmission)" },
  { value: "acquereur", label: "Acquéreur" },
  { value: "operateur", label: "Opérateur" },
  { value: "entrepreneur", label: "Entrepreneur" },
  { value: "reservataire", label: "Réservataire" },
];

const TABLE_HEADERS = ["Lot", "Attributaire", "Qualité", "Statut", "Depuis", "Observation"] as const;

export default function AttributionsPage() {
  const supabase = createClient();
  const { isAdmin } = useProfile();

  const [attributions, setAttributions] = useState<AttributionRecord[]>([]);
  const [lotsOptions, setLotsOptions] = useState<LotOption[]>([]);
  const [attributairesOptions, setAttributairesOptions] = useState<AttributaireOption[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    lot_id: "",
    attributaire_id: "",
    qualite: "ayant_droit",
    actuel: true,
    depuis: new Date().toISOString().slice(0, 10),
    observation: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadAttributions = async () => {
    setDataLoading(true);
    const { data } = await supabase
      .from("attributions")
      .select("id, lot_id, attributaire_id, qualite, actuel, depuis, observation, lots(numero_lot), attributaires(nom)")
      .order("depuis", { ascending: false });
    setAttributions((data ?? []) as AttributionRecord[]);
    setDataLoading(false);
  };

  useEffect(() => {
    void loadAttributions();
    supabase.from("lots").select("id, numero_lot").eq("statut", "libre").order("numero_lot").then(({ data }) => {
      setLotsOptions((data ?? []) as LotOption[]);
    });
    supabase.from("attributaires").select("id, nom").order("nom").then(({ data }) => {
      setAttributairesOptions((data ?? []) as AttributaireOption[]);
    });
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.lot_id || !form.attributaire_id) {
      setErrorMessage("Le lot et l'attributaire sont obligatoires.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("attributions").insert([
      {
        lot_id: form.lot_id,
        attributaire_id: form.attributaire_id,
        qualite: form.qualite as "ayant_droit" | "ayant_droit_transmission" | "acquereur" | "operateur" | "entrepreneur" | "reservataire",
        actuel: form.actuel,
        depuis: form.depuis || null,
        observation: form.observation.trim() || null,
        operateur_id: user?.id ?? null,
      },
    ]);

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    if (form.actuel) {
      await supabase.from("lots").update({ statut: "attribue" }).eq("id", form.lot_id);
    }

    setForm({
      lot_id: "",
      attributaire_id: "",
      qualite: "ayant_droit",
      actuel: true,
      depuis: new Date().toISOString().slice(0, 10),
      observation: "",
    });
    setIsModalOpen(false);
    setIsSubmitting(false);
    setSuccessMessage("Attribution enregistrée avec succès.");
    setTimeout(() => setSuccessMessage(null), 4000);
    await loadAttributions();

    supabase.from("lots").select("id, numero_lot").eq("statut", "libre").order("numero_lot").then(({ data }) => {
      setLotsOptions((data ?? []) as LotOption[]);
    });
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* En-tête */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-primary">
            Attributions Foncières
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Enregistrement et suivi des attributions de lots aux ayants droit et acquéreurs.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => { setIsModalOpen(true); setErrorMessage(null); }}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#0D3B66] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#1E6091] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Nouvelle attribution
          </button>
        )}
      </div>

      {successMessage && (
        <div className="mb-4 rounded-2xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      )}

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/50">
                {TABLE_HEADERS.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
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
                    Chargement des attributions…
                  </td>
                </tr>
              ) : attributions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                    Aucune attribution enregistrée.
                  </td>
                </tr>
              ) : (
                attributions.map((attr) => (
                  <tr key={attr.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-5 py-4 text-sm font-semibold text-[#0D3B66]">
                      {attr.lots?.numero_lot ? `Lot ${attr.lots.numero_lot}` : "—"}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-800">
                      {attr.attributaires?.nom || "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {QUALITE_OPTIONS.find((q) => q.value === attr.qualite)?.label ?? attr.qualite ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      <Badge status={attr.actuel ? "attribue" : "disponible"}>
                        {attr.actuel ? "Actuel" : "Historique"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {attr.depuis
                        ? new Date(attr.depuis).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-5 py-4 text-sm text-slate-500">
                      {attr.observation || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de création */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
                  Nouvelle attribution
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[#0D3B66]">
                  Lier un lot à un attributaire
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
              {/* Lot */}
              <div className="space-y-1.5">
                <label htmlFor="attr-lot" className="text-sm font-medium text-slate-700">
                  Lot foncier <span className="text-red-500">*</span>
                </label>
                <select
                  id="attr-lot"
                  value={form.lot_id}
                  onChange={(e) => setForm((f) => ({ ...f, lot_id: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                >
                  <option value="">— Sélectionner un lot libre —</option>
                  {lotsOptions.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      Lot {lot.numero_lot}
                    </option>
                  ))}
                </select>
              </div>

              {/* Attributaire */}
              <div className="space-y-1.5">
                <label htmlFor="attr-attrib" className="text-sm font-medium text-slate-700">
                  Attributaire <span className="text-red-500">*</span>
                </label>
                <select
                  id="attr-attrib"
                  value={form.attributaire_id}
                  onChange={(e) => setForm((f) => ({ ...f, attributaire_id: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                >
                  <option value="">— Sélectionner un attributaire —</option>
                  {attributairesOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nom}
                    </option>
                  ))}
                </select>
              </div>

              {/* Qualité */}
              <div className="space-y-1.5">
                <label htmlFor="attr-qualite" className="text-sm font-medium text-slate-700">
                  Qualité de l'attributaire
                </label>
                <select
                  id="attr-qualite"
                  value={form.qualite}
                  onChange={(e) => setForm((f) => ({ ...f, qualite: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                >
                  {QUALITE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Depuis */}
              <div className="space-y-1.5">
                <label htmlFor="attr-depuis" className="text-sm font-medium text-slate-700">
                  Date d'effet
                </label>
                <input
                  id="attr-depuis"
                  type="date"
                  value={form.depuis}
                  onChange={(e) => setForm((f) => ({ ...f, depuis: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                />
              </div>

              {/* Actuel */}
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.actuel}
                  onChange={(e) => setForm((f) => ({ ...f, actuel: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-[#0D3B66] focus:ring-[#0D3B66]"
                />
                Attribution actuelle (marque le lot comme "Attribué")
              </label>

              {/* Observation */}
              <div className="space-y-1.5">
                <label htmlFor="attr-obs" className="text-sm font-medium text-slate-700">
                  Observation
                </label>
                <textarea
                  id="attr-obs"
                  value={form.observation}
                  onChange={(e) => setForm((f) => ({ ...f, observation: e.target.value }))}
                  placeholder="Remarques, conditions particulières…"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                />
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
                  className="rounded-full bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#1E6091] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Enregistrement…" : "Enregistrer l'attribution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
