"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import type { Lotissement, NewLotissement } from "../types";

type Props = {
  initialData?: Lotissement | null;
  onClose: () => void;
  onSubmit: (values: NewLotissement) => void;
};

export default function LotissementForm({ initialData, onClose, onSubmit }: Props) {
  const isEdit = Boolean(initialData);

  const [form, setForm] = useState({
    nom: initialData?.nom ?? "",
    village: initialData?.village ?? "",
    commune: initialData?.commune ?? "",
    district: initialData?.district ?? "",
    superficie_texte: initialData?.superficie_texte ?? "",
    nb_lots: initialData?.nb_lots?.toString() ?? "",
    nb_ilots: initialData?.nb_ilots?.toString() ?? "",
    guide_reference: initialData?.guide_reference ?? "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit({
      nom: form.nom.trim(),
      village: form.village.trim() || null,
      commune: form.commune.trim() || null,
      district: form.district.trim() || null,
      superficie_texte: form.superficie_texte.trim() || null,
      nb_lots: form.nb_lots === "" ? null : Number(form.nb_lots),
      nb_ilots: form.nb_ilots === "" ? null : Number(form.nb_ilots),
      guide_reference: form.guide_reference.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-2xl sm:p-8">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
              {isEdit ? "Modifier" : "Nouveau lotissement"}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#0D3B66]">
              {isEdit ? initialData?.nom : "Enregistrer un lotissement"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {/* Nom */}
          <div className="space-y-1.5">
            <label htmlFor="lot-nom" className="text-sm font-medium text-slate-700">
              Nom du lotissement <span className="text-red-500">*</span>
            </label>
            <Input
              id="lot-nom"
              type="text"
              value={form.nom}
              onChange={set("nom")}
              placeholder="Ex. Lotissement Angré Extension"
              required
            />
          </div>

          {/* Village + Commune */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="lot-village" className="text-sm font-medium text-slate-700">
                Village
              </label>
              <Input
                id="lot-village"
                type="text"
                value={form.village}
                onChange={set("village")}
                placeholder="Ex. Angré"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lot-commune" className="text-sm font-medium text-slate-700">
                Commune
              </label>
              <Input
                id="lot-commune"
                type="text"
                value={form.commune}
                onChange={set("commune")}
                placeholder="Ex. Cocody"
              />
            </div>
          </div>

          {/* District + Superficie */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="lot-district" className="text-sm font-medium text-slate-700">
                District
              </label>
              <Input
                id="lot-district"
                type="text"
                value={form.district}
                onChange={set("district")}
                placeholder="Ex. Abidjan"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lot-superficie" className="text-sm font-medium text-slate-700">
                Superficie
              </label>
              <Input
                id="lot-superficie"
                type="text"
                value={form.superficie_texte}
                onChange={set("superficie_texte")}
                placeholder="Ex. 4,5 ha"
              />
            </div>
          </div>

          {/* Nb lots + Nb îlots */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="lot-nb-lots" className="text-sm font-medium text-slate-700">
                Nombre de lots
              </label>
              <Input
                id="lot-nb-lots"
                type="number"
                min="0"
                value={form.nb_lots}
                onChange={set("nb_lots")}
                placeholder="Ex. 49"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lot-nb-ilots" className="text-sm font-medium text-slate-700">
                Nombre d&apos;îlots
              </label>
              <Input
                id="lot-nb-ilots"
                type="number"
                min="0"
                value={form.nb_ilots}
                onChange={set("nb_ilots")}
                placeholder="Ex. 6"
              />
            </div>
          </div>

          {/* Référence guide */}
          <div className="space-y-1.5">
            <label htmlFor="lot-guide" className="text-sm font-medium text-slate-700">
              Référence guide parcellaire
            </label>
            <Input
              id="lot-guide"
              type="text"
              value={form.guide_reference}
              onChange={set("guide_reference")}
              placeholder="Ex. GP-2024-CI-001"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="rounded-full bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#1E6091]"
            >
              {isEdit ? "Enregistrer les modifications" : "Créer le lotissement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
