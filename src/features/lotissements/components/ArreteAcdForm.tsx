"use client";

import { useState, type FormEvent } from "react";
import { X, Loader2, ScrollText } from "lucide-react";
import { Input } from "@/components/ui/Input";
import type { Lotissement } from "../types";
import type {
  ArreteAcd,
  NewArreteAcd,
  StatutPieceAdministrative,
} from "../services/arreteAcd.service";

type Props = {
  lotissement: Lotissement;
  initialData?: ArreteAcd | null;
  onClose: () => void;
  onSubmit: (values: NewArreteAcd) => void;
  saving?: boolean;
};

/**
 * Points que chaque statut rapporte au score de confiance (critère "pièce
 * foncière principale", 40 pts sur 100 -- même barème que l'APFC pour un
 * lotissement villageois, généralisé migration 20260820110000).
 */
const POINTS_PAR_STATUT: Record<StatutPieceAdministrative, number> = {
  a_delivrer: 10,
  en_cours: 20,
  delivree: 40,
};

const LIBELLE_STATUT: Record<StatutPieceAdministrative, string> = {
  a_delivrer: "À délivrer",
  en_cours: "En cours",
  delivree: "Délivré",
};

/**
 * Enregistrement de l'Arrêté ACD d'un lotissement de type `acd` (aucun réel
 * en base au 20/08/2026) -- gabarit exact d'ApfcForm.tsx / ArreteApprobationForm.tsx,
 * table dédiée `arretes_acd_lotissement` (décision du propriétaire : pas de
 * généralisation d'un composant unique entre les 3 types de pièce).
 *
 * `scan_url` en champ texte simple, même choix et même raison
 * qu'ArreteApprobationForm.tsx (voir son commentaire de tête).
 */
export default function ArreteAcdForm({ lotissement, initialData, onClose, onSubmit, saving }: Props) {
  const isEdit = Boolean(initialData);

  const [form, setForm] = useState({
    numero: initialData?.numero ?? "",
    date_arrete: initialData?.date_arrete ?? "",
    autorite_signataire: initialData?.autorite_signataire ?? "",
    statut: (initialData?.statut ?? "a_delivrer") as StatutPieceAdministrative,
    date_delivrance: initialData?.date_delivrance ?? "",
    scan_url: initialData?.scan_url ?? "",
  });

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit({
      lotissement_id: lotissement.id,
      numero: form.numero.trim() || null,
      date_arrete: form.date_arrete || null,
      autorite_signataire: form.autorite_signataire.trim() || null,
      statut: form.statut,
      date_delivrance: form.date_delivrance || null,
      scan_url: form.scan_url.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
              {isEdit ? "Modifier l'arrêté ACD" : "Nouvel arrêté ACD"}
            </p>
            <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold text-[#0D3B66]">
              <ScrollText className="h-5 w-5" />
              {lotissement.nom}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Arrêté ACD — pièce foncière principale des lotissements avec ACD.
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
            <label htmlFor="arrete-acd-numero" className="text-sm font-medium text-slate-700">
              Numéro de l&apos;arrêté ACD
            </label>
            <Input
              id="arrete-acd-numero"
              type="text"
              value={form.numero}
              onChange={set("numero")}
              placeholder="Ex. ACD-2026-001"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="arrete-acd-statut" className="text-sm font-medium text-slate-700">
                Statut
              </label>
              <select
                id="arrete-acd-statut"
                value={form.statut}
                onChange={set("statut")}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
              >
                {(Object.keys(LIBELLE_STATUT) as StatutPieceAdministrative[]).map((s) => (
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
              <label htmlFor="arrete-acd-date-arrete" className="text-sm font-medium text-slate-700">
                Date de l&apos;arrêté
              </label>
              <Input
                id="arrete-acd-date-arrete"
                type="date"
                value={form.date_arrete ?? ""}
                onChange={set("date_arrete")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="arrete-acd-signataire" className="text-sm font-medium text-slate-700">
              Autorité signataire
            </label>
            <Input
              id="arrete-acd-signataire"
              type="text"
              value={form.autorite_signataire}
              onChange={set("autorite_signataire")}
              placeholder="Ex. Le Ministre de la Construction..."
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="arrete-acd-date-delivrance" className="text-sm font-medium text-slate-700">
              Date de délivrance
            </label>
            <Input
              id="arrete-acd-date-delivrance"
              type="date"
              value={form.date_delivrance ?? ""}
              onChange={set("date_delivrance")}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="arrete-acd-scan" className="text-sm font-medium text-slate-700">
              Scan (chemin ou URL du document déjà déposé)
            </label>
            <Input
              id="arrete-acd-scan"
              type="text"
              value={form.scan_url}
              onChange={set("scan_url")}
              placeholder="Ex. arretes-acd/mon-lotissement.pdf"
            />
          </div>

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
              {isEdit ? "Enregistrer" : "Créer l'arrêté"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
