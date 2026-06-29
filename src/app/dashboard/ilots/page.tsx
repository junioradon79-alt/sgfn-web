"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/utils/supabase/client";

type IlotRecord = {
  id: string;
  numero: string | null;
  lotissement_id: string | null;
};

type LotissementOption = {
  id: string;
  nom: string | null;
};

const TABLE_HEADERS = ["Numéro", "Lotissement", "Actions"] as const;
const EMPTY_FORM = { numero: "", lotissement_id: "" };

export default function IlotsPage() {
  const supabase = createClient();

  const [ilots, setIlots] = useState<IlotRecord[]>([]);
  const [lotissements, setLotissements] = useState<LotissementOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [ilotsRes, lotsRes] = await Promise.all([
      supabase.from("ilots").select("id, numero, lotissement_id").order("numero", { ascending: true }),
      supabase.from("lotissements").select("id, nom").order("nom", { ascending: true }),
    ]);

    setIlots((ilotsRes.data ?? []) as IlotRecord[]);
    setLotissements((lotsRes.data ?? []) as LotissementOption[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const lotName = (id: string | null) =>
    lotissements.find((l) => l.id === id)?.nom ?? "—";

  const filtered = ilots.filter((ilot) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (ilot.numero ?? "").toLowerCase().includes(q) ||
      lotName(ilot.lotissement_id).toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!form.numero.trim()) {
      setErrorMessage("Le numéro d’îlot est obligatoire.");
      return;
    }

    if (!form.lotissement_id) {
      setErrorMessage("Le lotissement de rattachement est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase.from("ilots").insert([
      {
        numero: form.numero.trim(),
        lotissement_id: form.lotissement_id,
      },
    ]);

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setForm(EMPTY_FORM);
    setIsModalOpen(false);
    setIsSubmitting(false);
    setSuccessMessage("Îlot créé avec succès.");
    setTimeout(() => setSuccessMessage(null), 4000);
    await loadData();
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-primary">Gestion des Îlots</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Vue synthétique des îlots cadastraux et de leur lotissement de rattachement.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsModalOpen(true);
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#0D3B66] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-300 hover:bg-[#1E6091] hover:shadow-md active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Ajouter un îlot
        </button>
      </div>

      {successMessage && (
        <div className="mb-4 rounded-2xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="mb-6">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Rechercher un îlot ou un lotissement"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher un îlot"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/50">
                {TABLE_HEADERS.map((header) => (
                  <th key={header} scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 last:text-right">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-500">
                    Chargement des îlots…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-500">
                    Aucun îlot enregistré.
                  </td>
                </tr>
              ) : (
                filtered.map((ilot) => (
                  <tr key={ilot.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-5 py-4 text-sm font-medium text-slate-800">{ilot.numero ?? "—"}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{lotName(ilot.lotissement_id)}</td>
                    <td className="px-5 py-4 text-right text-sm text-slate-400">—</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-[0_30px_80px_-20px_rgba(2,8,23,0.35)] sm:p-8" style={{ maxHeight: "92vh" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Nouvel îlot</p>
                <h2 className="mt-2 text-xl font-semibold text-[#0D3B66]">Créer un îlot cadastral</h2>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600" aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label htmlFor="ilot-numero" className="text-sm font-medium text-slate-700">
                  Numéro d’îlot <span className="text-red-500">*</span>
                </label>
                <Input
                  id="ilot-numero"
                  type="text"
                  value={form.numero}
                  onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
                  placeholder="Ex. 01"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ilot-lotissement" className="text-sm font-medium text-slate-700">
                  Lotissement de rattachement <span className="text-red-500">*</span>
                </label>
                <select
                  id="ilot-lotissement"
                  value={form.lotissement_id}
                  onChange={(e) => setForm((f) => ({ ...f, lotissement_id: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-[#1E6091] focus:ring-2 focus:ring-[#1E6091]/20"
                >
                  <option value="">Sélectionner un lotissement…</option>
                  {lotissements.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.nom ?? lot.id}
                    </option>
                  ))}
                </select>
              </div>

              {errorMessage && (
                <div className="rounded-2xl border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">
                  Annuler
                </button>
                <button type="submit" disabled={isSubmitting} className="rounded-full bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1E6091] disabled:opacity-70">
                  {isSubmitting ? "Enregistrement…" : "Enregistrer l’îlot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
