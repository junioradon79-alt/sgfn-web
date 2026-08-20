"use client";

import { useState, type FormEvent } from "react";
import { X, Loader2, ScrollText } from "lucide-react";
import { Input } from "@/components/ui/Input";
import type { Lotissement } from "../types";
import type {
  ArreteApprobation,
  NewArreteApprobation,
  StatutPieceAdministrative,
} from "../services/arreteApprobation.service";

type Props = {
  lotissement: Lotissement;
  initialData?: ArreteApprobation | null;
  onClose: () => void;
  onSubmit: (values: NewArreteApprobation) => void;
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
 * Enregistrement de l'Arrêté d'approbation d'un lotissement de type
 * `approuve` (ex. Brignan Kakodji) -- gabarit exact d'ApfcForm.tsx, adapté à
 * une pièce administrative (numéro, date, autorité signataire, statut, date
 * de délivrance) plutôt qu'un titre coutumier de famille.
 *
 * `scan_url` est un champ texte simple (chemin/URL collé après dépôt
 * ailleurs), PAS un widget de téléversement : ApfcForm -- le gabarit
 * explicitement désigné pour ce formulaire -- n'en a aucun, et le seul
 * précédent réel de ce dépôt (`LotissementForm.tsx`, upload du PV
 * d'identification physique vers le bucket "documents") s'appuie sur des
 * policies `storage.objects` qui ne couvrent QUE les préfixes `plans-cad/`
 * et `plans-lotissement/` (vérifié en lecture seule le 20/08 sur
 * `pg_policy` de `storage.objects`) -- construire un widget d'upload aurait
 * donc exigé une nouvelle policy de stockage, hors périmètre de cette tâche
 * et non demandée explicitement. Signalé au rapport plutôt que deviné en
 * silence.
 */
export default function ArreteApprobationForm({ lotissement, initialData, onClose, onSubmit, saving }: Props) {
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
      // Le rattachement n'est jamais saisi à la main, comme pour l'APFC : il
      // est hérité du lotissement ouvert.
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
              {isEdit ? "Modifier l'arrêté d'approbation" : "Nouvel arrêté d'approbation"}
            </p>
            <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold text-[#0D3B66]">
              <ScrollText className="h-5 w-5" />
              {lotissement.nom}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Arrêté d&apos;approbation — pièce foncière principale des lotissements approuvés.
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
            <label htmlFor="arrete-approbation-numero" className="text-sm font-medium text-slate-700">
              Numéro de l&apos;arrêté
            </label>
            <Input
              id="arrete-approbation-numero"
              type="text"
              value={form.numero}
              onChange={set("numero")}
              placeholder="Ex. 017/RW/P.SGLA/CAB"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="arrete-approbation-statut" className="text-sm font-medium text-slate-700">
                Statut
              </label>
              <select
                id="arrete-approbation-statut"
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
              <label htmlFor="arrete-approbation-date-arrete" className="text-sm font-medium text-slate-700">
                Date de l&apos;arrêté
              </label>
              <Input
                id="arrete-approbation-date-arrete"
                type="date"
                value={form.date_arrete ?? ""}
                onChange={set("date_arrete")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="arrete-approbation-signataire" className="text-sm font-medium text-slate-700">
              Autorité signataire
            </label>
            <Input
              id="arrete-approbation-signataire"
              type="text"
              value={form.autorite_signataire}
              onChange={set("autorite_signataire")}
              placeholder="Ex. Le Préfet du département de..."
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="arrete-approbation-date-delivrance" className="text-sm font-medium text-slate-700">
              Date de délivrance
            </label>
            <Input
              id="arrete-approbation-date-delivrance"
              type="date"
              value={form.date_delivrance ?? ""}
              onChange={set("date_delivrance")}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="arrete-approbation-scan" className="text-sm font-medium text-slate-700">
              Scan (chemin ou URL du document déjà déposé)
            </label>
            <Input
              id="arrete-approbation-scan"
              type="text"
              value={form.scan_url}
              onChange={set("scan_url")}
              placeholder="Ex. arretes-approbation/brignan-kakodji.pdf"
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
