"use client";

import { useState, type FormEvent } from "react";
import { X, Loader2, FileText } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/utils/supabase/client";
import type { Lotissement, NewLotissement } from "../types";

type Props = {
  initialData?: Lotissement | null;
  onClose: () => void;
  onSubmit: (values: NewLotissement) => void;
};

export default function LotissementForm({ initialData, onClose, onSubmit }: Props) {
  const isEdit = Boolean(initialData);
  const supabase = createClient();

  const [form, setForm] = useState({
    nom: initialData?.nom ?? "",
    village: initialData?.village ?? "",
    commune: initialData?.commune ?? "",
    district: initialData?.district ?? "",
    superficie_texte: initialData?.superficie_texte ?? "",
    nb_lots: initialData?.nb_lots?.toString() ?? "",
    nb_ilots: initialData?.nb_ilots?.toString() ?? "",
    guide_reference: initialData?.guide_reference ?? "",
    pv_identification_physique_numero: initialData?.pv_identification_physique_numero ?? "",
    pv_identification_physique_date: initialData?.pv_identification_physique_date ?? "",
  });
  const [scanFile, setScanFile] = useState<File | null>(null);
  const scanUrl = initialData?.pv_identification_physique_scan_url ?? "";
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurScan, setErreurScan] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleScanFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScanFile(e.target.files?.[0] ?? null);
    setErreurScan(null);
  };

  const voirScanActuel = async () => {
    if (!scanUrl) return;
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(scanUrl, 3600);
    if (error || !data) return;
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let finalScanUrl = scanUrl || null;

    if (scanFile) {
      setEnvoiEnCours(true);
      setErreurScan(null);
      try {
        const id = initialData?.id ?? crypto.randomUUID();
        const extension = scanFile.name.split(".").pop() ?? "pdf";
        const chemin = `pv-identification-physique/${id}/scan.${extension}`;
        const { error: uploadErr } = await supabase.storage
          .from("documents")
          .upload(chemin, scanFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        finalScanUrl = chemin;
      } catch (err) {
        setErreurScan(err instanceof Error ? err.message : "Le téléversement du scan a échoué.");
        setEnvoiEnCours(false);
        return;
      }
      setEnvoiEnCours(false);
    }

    onSubmit({
      nom: form.nom.trim(),
      village: form.village.trim() || null,
      commune: form.commune.trim() || null,
      district: form.district.trim() || null,
      superficie_texte: form.superficie_texte.trim() || null,
      nb_lots: form.nb_lots === "" ? null : Number(form.nb_lots),
      nb_ilots: form.nb_ilots === "" ? null : Number(form.nb_ilots),
      guide_reference: form.guide_reference.trim() || null,
      pv_identification_physique_numero: form.pv_identification_physique_numero.trim() || null,
      pv_identification_physique_date: form.pv_identification_physique_date || null,
      pv_identification_physique_scan_url: finalScanUrl,
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

          {/* PV d'identification physique */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="lot-pv-idphys-numero" className="text-sm font-medium text-slate-700">
                N° PV d&apos;identification physique
              </label>
              <Input
                id="lot-pv-idphys-numero"
                type="text"
                value={form.pv_identification_physique_numero}
                onChange={set("pv_identification_physique_numero")}
                placeholder="Ex. PV-IDPHYS-2024-001"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lot-pv-idphys-date" className="text-sm font-medium text-slate-700">
                Date du PV
              </label>
              <Input
                id="lot-pv-idphys-date"
                type="date"
                value={form.pv_identification_physique_date ?? ""}
                onChange={set("pv_identification_physique_date")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="lot-pv-idphys-scan" className="text-sm font-medium text-slate-700">
              Scan du PV (optionnel)
            </label>
            <div className="flex items-center gap-3">
              <input
                id="lot-pv-idphys-scan"
                type="file"
                accept="application/pdf,image/*"
                onChange={handleScanFile}
                disabled={envoiEnCours}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#0D3B66]/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#0D3B66] hover:file:bg-[#0D3B66]/20"
              />
              {scanUrl && !scanFile && (
                <button
                  type="button"
                  onClick={voirScanActuel}
                  className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#0D3B66] hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Voir le scan
                </button>
              )}
            </div>
            {erreurScan && <p className="text-xs font-medium text-red-600">{erreurScan}</p>}
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={envoiEnCours}
              className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={envoiEnCours}
              className="flex items-center justify-center gap-2 rounded-full bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#1E6091] disabled:opacity-60"
            >
              {envoiEnCours && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Enregistrer les modifications" : "Créer le lotissement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
