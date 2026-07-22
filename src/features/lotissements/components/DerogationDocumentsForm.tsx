"use client";

import { useState, type FormEvent } from "react";
import { X, Loader2, ShieldAlert } from "lucide-react";
import type { Lotissement } from "../types";

type Props = {
  lotissement: Lotissement;
  onClose: () => void;
  onSubmit: (motif: string) => void;
  saving?: boolean;
  erreur?: string | null;
};

/**
 * Dérogation à l'exigence de dossier documentaire complet.
 *
 * Depuis le 22/07, un lotissement n'émet aucune attestation de cession tant que
 * son score de confiance n'atteint pas 100/100 — APFC délivrée, guide de
 * répartition, PV du guide et PV d'identification physique. La dérogation existe
 * parce que le terrain précède parfois le document, mais elle est nominative,
 * motivée et retirable : une exception constatée, pas un contournement.
 */
export default function DerogationDocumentsForm({ lotissement, onClose, onSubmit, saving, erreur }: Props) {
  const [motif, setMotif] = useState("");
  const motifValide = motif.trim().length >= 10;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!motifValide) return;
    onSubmit(motif.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-600">
              Dérogation
            </p>
            <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold text-[#0D3B66]">
              <ShieldAlert className="h-5 w-5" />
              {lotissement.nom}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Autoriser l&apos;émission d&apos;attestations malgré un dossier incomplet.
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
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-700">
            Le score de confiance mesure la chaîne documentaire du lotissement : APFC
            délivrée (40), guide de répartition (20), PV du guide (20), PV d&apos;identification
            physique (20). Une dérogation <strong>lève le blocage sans améliorer le score</strong> :
            les attestations émises resteront celles d&apos;un lotissement incomplet. Elle se retire
            dès que le dossier est complet.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="derogation-motif" className="text-sm font-medium text-slate-700">
              Motif de la dérogation
            </label>
            <textarea
              id="derogation-motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
              placeholder="Ex. PV d'identification physique en cours d'établissement — mission de bornage du 12/07."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#1E6091] focus:outline-none focus:ring-2 focus:ring-[#1E6091]/15"
            />
            <p className="text-xs text-slate-500">
              Conservé au registre avec votre nom et la date.{" "}
              {motif.trim().length < 10 && `${10 - motif.trim().length} caractère(s) manquant(s).`}
            </p>
          </div>

          {erreur && (
            <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {erreur}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!motifValide || saving}
              className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Accorder la dérogation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
