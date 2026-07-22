"use client";

import { useState, type FormEvent } from "react";
import { X, Loader2, ScrollText } from "lucide-react";
import { Input } from "@/components/ui/Input";
import type { Lotissement } from "../types";
import type { Apfc, NewApfc, StatutApfc } from "../services/apfc.service";

type Props = {
  lotissement: Lotissement;
  initialData?: Apfc | null;
  onClose: () => void;
  onSubmit: (values: NewApfc) => void;
  saving?: boolean;
};

/**
 * Points que chaque statut rapporte au score de confiance v3 (critère APFC,
 * 40 pts sur 100). Affiché à l'admin parce que la conséquence du statut n'a
 * rien d'évident : c'est le seul critère du score qui ne soit pas binaire.
 */
const POINTS_PAR_STATUT: Record<StatutApfc, number> = {
  a_delivrer: 10,
  en_cours: 20,
  delivree: 40,
};

const LIBELLE_STATUT: Record<StatutApfc, string> = {
  a_delivrer: "À délivrer",
  en_cours: "En cours",
  delivree: "Délivrée",
};

export default function ApfcForm({ lotissement, initialData, onClose, onSubmit, saving }: Props) {
  const isEdit = Boolean(initialData);

  const [form, setForm] = useState({
    numero: initialData?.numero ?? "",
    date_delivrance: initialData?.date_delivrance ?? "",
    statut: (initialData?.statut ?? "a_delivrer") as StatutApfc,
    chef_de_famille: initialData?.chef_de_famille ?? "",
    non_contestation: initialData?.non_contestation ?? false,
  });

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const numero = form.numero.trim();
    onSubmit({
      // Le rattachement n'est jamais saisi à la main : il est hérité du
      // lotissement, sans quoi une APFC pourrait pointer vers une chefferie
      // ou une famille différente de celle de son propre lotissement.
      lotissement_id: lotissement.id,
      autorite_coutumiere_id: lotissement.autorite_coutumiere_id,
      famille_id: lotissement.famille_id,
      numero: numero || null,
      // L'unique APFC existante (APFC-EBIMPE-2022-001) porte la même valeur
      // dans `numero` et `reference` ; on conserve cette convention plutôt
      // que d'ouvrir deux champs qui divergeraient.
      reference: numero || null,
      date_delivrance: form.date_delivrance || null,
      statut: form.statut,
      chef_de_famille: form.chef_de_famille.trim() || null,
      non_contestation: form.non_contestation,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
              {isEdit ? "Modifier l'APFC" : "Nouvelle APFC"}
            </p>
            <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold text-[#0D3B66]">
              <ScrollText className="h-5 w-5" />
              {lotissement.nom}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Attestation de Propriété Foncière Coutumière — titre coutumier du lotissement.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="apfc-numero" className="text-sm font-medium text-slate-700">
              Numéro de l&apos;attestation
            </label>
            <Input
              id="apfc-numero"
              type="text"
              value={form.numero}
              onChange={set("numero")}
              placeholder="Ex. APFC-EBIMPE-2022-001"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="apfc-statut" className="text-sm font-medium text-slate-700">
                Statut
              </label>
              <select
                id="apfc-statut"
                value={form.statut}
                onChange={set("statut")}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
              >
                {(Object.keys(LIBELLE_STATUT) as StatutApfc[]).map((s) => (
                  <option key={s} value={s}>
                    {LIBELLE_STATUT[s]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Vaut {POINTS_PAR_STATUT[form.statut]} points sur 40 au score de confiance.
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="apfc-date" className="text-sm font-medium text-slate-700">
                Date de délivrance
              </label>
              <Input
                id="apfc-date"
                type="date"
                value={form.date_delivrance ?? ""}
                onChange={set("date_delivrance")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="apfc-chef" className="text-sm font-medium text-slate-700">
              Chef de famille signataire
            </label>
            <Input
              id="apfc-chef"
              type="text"
              value={form.chef_de_famille}
              onChange={set("chef_de_famille")}
              placeholder="Ex. N'CHO OHOUO BONIFACE"
            />
          </div>

          <label className="flex items-start gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3">
            <input
              type="checkbox"
              checked={form.non_contestation}
              onChange={(e) => setForm((f) => ({ ...f, non_contestation: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-600">
              Non-contestation constatée
              <span className="mt-0.5 block text-xs text-slate-500">
                Aucune opposition n&apos;a été soulevée pendant le délai d&apos;affichage.
              </span>
            </span>
          </label>

          <p className="rounded-xl border border-dashed border-[#0D3B66]/25 bg-[#0D3B66]/5 px-4 py-3 text-xs text-slate-600">
            Les signatures (chef de village, chef de famille, CVGFR) ne se posent pas ici : la
            chefferie les appose depuis son écran « Validations ». Cet écran enregistre le
            document, il ne le signe pas.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-[#0D3B66] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1E6091] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Enregistrer" : "Créer l'APFC"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
