"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, FileText, RotateCcw, Sparkles, Upload } from "lucide-react";

type ExtractedField = {
  label: string;
  value: string;
  accent?: string;
};

type Phase = "idle" | "analyzing" | "done";

const ACCEPTED = ["application/pdf", "image/png", "image/jpeg"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function IAPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Champs extraits (simulés — l'analyse OCR réelle viendra via une edge function).
  const extractedFields = useMemo<ExtractedField[]>(
    () => [
      { label: "Nom de l’attributaire détecté", value: "Awa Diop", accent: "text-cyan-400" },
      { label: "Numéro de parcelle identifié", value: "PAR-042/2026", accent: "text-indigo-300" },
      { label: "Score de confiance de la signature", value: "98%", accent: "text-emerald-400" },
      { label: "Statut de conformité", value: "Validé", accent: "text-emerald-400" },
    ],
    [],
  );

  // Nettoyage de l'URL d'objet pour éviter les fuites mémoire.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Animation réelle de la barre de progression pendant l'analyse.
  useEffect(() => {
    if (phase !== "analyzing") return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return Math.min(100, p + Math.floor(Math.random() * 12) + 4);
      });
    }, 180);
    return () => clearInterval(interval);
  }, [phase]);

  // Passage à l'état "done" quand la progression atteint 100%.
  useEffect(() => {
    if (phase === "analyzing" && progress >= 100) {
      const t = setTimeout(() => setPhase("done"), 400);
      return () => clearTimeout(t);
    }
  }, [phase, progress]);

  const handleFile = useCallback(
    (selected: File | null) => {
      if (!selected) return;
      setError(null);

      if (!ACCEPTED.includes(selected.type)) {
        setError("Format non supporté. Utilisez un PDF, PNG ou JPG.");
        return;
      }
      if (selected.size > MAX_SIZE) {
        setError("Fichier trop volumineux (max 10 Mo).");
        return;
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(selected.type.startsWith("image/") ? URL.createObjectURL(selected) : null);
      setFile(selected);
      setPhase("analyzing");
    },
    [previewUrl],
  );

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setPhase("idle");
    setProgress(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-[#090D16] px-2 py-4 text-slate-100 sm:px-4 lg:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="rounded-[2rem] border border-slate-800/80 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_28%),linear-gradient(135deg,_#111827_0%,_#0d1323_100%)] p-7 shadow-[0_20px_80px_-30px_rgba(34,211,238,0.2)] sm:p-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-sm font-medium text-cyan-300">
                <Sparkles className="h-4 w-4" />
                Intelligence artificielle SGFN
              </div>
              <h1 className="font-display mt-4 text-2xl font-black sm:text-3xl">
                <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
                  SGFN AI — Analyseur Intelligent
                </span>
              </h1>
              <p className="mt-3 text-base leading-7 text-slate-400">
                Automatisez la vérification, l’extraction de données et la détection d’anomalies sur vos documents fonciers administratifs.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-[#131B2E]/90 px-4 py-3 text-sm text-slate-300 shadow-sm">
              <div className="flex items-center gap-2 font-medium text-cyan-300">
                <Bot className="h-4 w-4" />
                Analyse assistée par IA
              </div>
            </div>
          </div>

          {/* Zone de dépôt — input réel + drag & drop */}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`mb-6 mt-8 cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 sm:p-12 ${
              isDragging
                ? "border-cyan-400 bg-[#18223a] shadow-[0_18px_45px_-28px_rgba(34,211,238,0.6)]"
                : "border-slate-800/80 bg-[#131B2E] hover:border-cyan-500/50 hover:bg-[#18223a] hover:shadow-[0_18px_45px_-28px_rgba(34,211,238,0.35)]"
            }`}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300 shadow-sm">
              <Upload className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-slate-100">
              {isDragging
                ? "Relâchez pour analyser le document"
                : "Glissez-déposez un PV de famille, une CNI ou une attestation"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Formats acceptés : PDF, PNG, JPG (Max 10 Mo) — ou cliquez pour parcourir
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
              {error}
            </div>
          )}

          {/* Barre de progression réelle */}
          {phase === "analyzing" && (
            <div className="mb-8 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between text-sm font-medium text-cyan-300">
                <span>Analyse du document par l’IA en cours…</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-900/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 shadow-[0_0_12px_rgba(34,211,238,0.6)] transition-all duration-200 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            {/* Aperçu du document */}
            <div className="rounded-[1.5rem] border border-slate-800/60 bg-[#131B2E] p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">Aperçu du document</h3>
                <div className="flex items-center gap-2">
                  {file && (
                    <button
                      type="button"
                      onClick={reset}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/70 px-3 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800/70"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Recommencer
                    </button>
                  )}
                  <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-emerald-400">
                    {phase === "done" ? "Document chargé" : phase === "analyzing" ? "Analyse…" : "En attente"}
                  </div>
                </div>
              </div>
              <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-[1.25rem] border border-dashed border-slate-800 bg-[#0F172A] p-6 text-center">
                {!file ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-100">Aucun document sélectionné</p>
                    <p className="text-sm text-slate-400">Ajoutez un fichier pour commencer l’analyse intelligente.</p>
                  </div>
                ) : previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt={file.name} className="max-h-[260px] w-auto rounded-lg object-contain" />
                ) : (
                  <div className="space-y-3">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                      <FileText className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="break-all text-sm font-semibold text-slate-100">{file.name}</p>
                      <p className="mt-1 text-sm text-slate-400">{formatSize(file.size)} · PDF</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Données extraites — uniquement après analyse */}
            <div className="rounded-[1.5rem] border border-slate-800/60 bg-[#131B2E] p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">Données extraites par l’IA</h3>
                {phase === "done" && (
                  <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                    Prêt pour l’exploitation
                  </div>
                )}
              </div>

              {phase === "done" ? (
                <div className="space-y-3">
                  {extractedFields.map((field) => (
                    <div key={field.label} className="rounded-2xl border border-slate-800/60 bg-[#0F172A] px-4 py-3">
                      <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">{field.label}</p>
                      <p className={`mt-1 text-sm font-semibold ${field.accent ?? "text-slate-100"}`}>{field.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-[#0F172A] text-center">
                  <p className="px-6 text-sm text-slate-500">
                    {phase === "analyzing"
                      ? "Extraction des métadonnées en cours…"
                      : "Les données extraites apparaîtront ici une fois un document analysé."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
