"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Bot, CheckCircle2, FileText, RotateCcw,
  Sparkles, Upload, XCircle, Loader2, ShieldCheck, ShieldAlert, ShieldQuestion,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type Signatures = {
  chef_famille: boolean;
  chef_village: boolean;
  sgfn: boolean;
  notaire: boolean;
};

type AnalysisResult = {
  type_document: "attestation_cession" | "apfc" | "certificat_vente" | "pv_reunion_famille" | "cni" | "autre";
  attributaire: string | null;
  ilot: string | null;
  lot: string | null;
  lotissement: string | null;
  date_document: string | null;
  signatures: Signatures;
  conformite: "conforme" | "non_conforme" | "a_verifier";
  alertes: string[];
  score_confiance: number;
  observations: string | null;
};

type Phase = "idle" | "analyzing" | "done" | "error";

const ACCEPTED = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_SIZE = 4.5 * 1024 * 1024; // 4,5 Mo (base64 → ~6 Mo dans la requête)

const TYPE_LABELS: Record<string, string> = {
  attestation_cession: "Attestation de cession",
  apfc: "APFC",
  certificat_vente: "Certificat de vente",
  pv_reunion_famille: "PV de réunion familiale",
  cni: "Carte nationale d'identité",
  autre: "Autre document",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // retire le préfixe "data:...;base64,"
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function SignatureRow({ label, present }: { label: string; present: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-400">{label}</span>
      {present ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
          <CheckCircle2 className="h-3 w-3" /> Présente
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-xs font-medium text-slate-500">
          <XCircle className="h-3 w-3" /> Absente
        </span>
      )}
    </div>
  );
}

function ConformiteBadge({ conformite }: { conformite: AnalysisResult["conformite"] }) {
  if (conformite === "conforme") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-400">
        <ShieldCheck className="h-4 w-4" /> Conforme
      </span>
    );
  }
  if (conformite === "non_conforme") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-sm font-semibold text-red-400">
        <ShieldAlert className="h-4 w-4" /> Non conforme
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-400">
      <ShieldQuestion className="h-4 w-4" /> À vérifier
    </span>
  );
}

function ResultCard({ result }: { result: AnalysisResult }) {
  const confiance = result.score_confiance ?? 0;
  const confianceColor = confiance >= 80 ? "from-emerald-400 to-cyan-400" : confiance >= 50 ? "from-amber-400 to-yellow-300" : "from-red-400 to-orange-400";

  return (
    <div className="space-y-4">
      {/* Type + conformité */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-indigo-300">
          {TYPE_LABELS[result.type_document] ?? result.type_document}
        </span>
        <ConformiteBadge conformite={result.conformite} />
      </div>

      {/* Champs principaux */}
      <div className="space-y-2">
        {result.attributaire && (
          <div className="rounded-xl border border-slate-800/60 bg-[#0F172A] px-4 py-3">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-cyan-400">Attributaire</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{result.attributaire}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {result.ilot && (
            <div className="rounded-xl border border-slate-800/60 bg-[#0F172A] px-3 py-2.5">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-indigo-300">Îlot</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-100">{result.ilot}</p>
            </div>
          )}
          {result.lot && (
            <div className="rounded-xl border border-slate-800/60 bg-[#0F172A] px-3 py-2.5">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-indigo-300">Lot</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-100">{result.lot}</p>
            </div>
          )}
          {result.date_document && (
            <div className="rounded-xl border border-slate-800/60 bg-[#0F172A] px-3 py-2.5">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-indigo-300">Date</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-100">
                {new Date(result.date_document).toLocaleDateString("fr-FR")}
              </p>
            </div>
          )}
        </div>

        {result.lotissement && (
          <div className="rounded-xl border border-slate-800/60 bg-[#0F172A] px-4 py-3">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-indigo-300">Lotissement</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-100">{result.lotissement}</p>
          </div>
        )}
      </div>

      {/* Signatures */}
      <div className="rounded-xl border border-slate-800/60 bg-[#0F172A] px-4 py-3">
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-cyan-400">Signatures</p>
        <div className="space-y-2">
          <SignatureRow label="Chef de famille" present={result.signatures.chef_famille} />
          <SignatureRow label="Chef de village / Chefferie" present={result.signatures.chef_village} />
          <SignatureRow label="SGNF" present={result.signatures.sgfn} />
          <SignatureRow label="Notaire / Officiel" present={result.signatures.notaire} />
        </div>
      </div>

      {/* Score de confiance */}
      <div className="rounded-xl border border-slate-800/60 bg-[#0F172A] px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-cyan-400">Confiance IA</p>
          <span className="tabular-nums text-xs font-bold text-slate-200">{confiance}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900/70">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${confianceColor} transition-all duration-700`}
            style={{ width: `${confiance}%` }}
          />
        </div>
      </div>

      {/* Alertes */}
      {result.alertes.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
          <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-widest text-amber-400">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
            Alertes ({result.alertes.length})
          </p>
          <ul className="space-y-1">
            {result.alertes.map((a, i) => (
              <li key={i} className="text-sm text-amber-200/80">· {a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Observations */}
      {result.observations && (
        <div className="rounded-xl border border-slate-800/60 bg-[#0F172A] px-4 py-3">
          <p className="mb-1 font-mono text-xs font-semibold uppercase tracking-widest text-slate-500">Observations</p>
          <p className="text-sm leading-relaxed text-slate-300">{result.observations}</p>
        </div>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function IAPage() {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const handleFile = useCallback(async (selected: File | null) => {
    if (!selected) return;
    setError(null);
    setResult(null);

    if (!ACCEPTED.includes(selected.type)) {
      setError("Format non supporté. Utilisez un PDF, PNG, JPG ou WebP.");
      return;
    }
    if (selected.size > MAX_SIZE) {
      setError(`Fichier trop volumineux (max ${formatSize(MAX_SIZE)}). Compressez le PDF ou l'image.`);
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(selected.type.startsWith("image/") ? URL.createObjectURL(selected) : null);
    setFile(selected);
    setPhase("analyzing");

    try {
      const contenu_base64 = await readAsBase64(selected);

      const { data, error: fnError } = await supabase.functions.invoke("analyser-document-ia", {
        body: { contenu_base64, type_mime: selected.type, nom_fichier: selected.name },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data?.ok) throw new Error(data?.erreur ?? "Erreur inconnue du service IA");

      setResult(data.resultat as AnalysisResult);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'analyse.");
      setPhase("error");
    }
  }, [previewUrl, supabase]);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setPhase("idle");
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-[#090D16] px-2 py-4 text-slate-100 sm:px-4 lg:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="rounded-[2rem] border border-slate-800/80 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_28%),linear-gradient(135deg,_#111827_0%,_#0d1323_100%)] p-7 shadow-[0_20px_80px_-30px_rgba(34,211,238,0.2)] sm:p-10">
          {/* Header */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-sm font-medium text-cyan-300">
                <Sparkles className="h-4 w-4" />
                Intelligence artificielle SGNF
              </div>
              <h1 className="mt-4 text-2xl font-black sm:text-3xl">
                <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
                  SGNF AI — Analyseur Intelligent
                </span>
              </h1>
              <p className="mt-3 text-base leading-7 text-slate-400">
                Vérification, extraction de données et détection d&apos;anomalies sur vos documents fonciers — attestations, APFC, PV, CNI.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-[#131B2E]/90 px-4 py-3 text-sm text-slate-300 shadow-sm">
              <div className="flex items-center gap-2 font-medium text-cyan-300">
                <Bot className="h-4 w-4" />
                Propulsé par Claude
              </div>
            </div>
          </div>

          {/* Zone de dépôt */}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              void handleFile(e.dataTransfer.files?.[0] ?? null);
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
              {isDragging ? "Relâchez pour analyser" : "Glissez-déposez un document foncier"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              PDF, PNG, JPG, WebP · Max {formatSize(MAX_SIZE)} · ou cliquez pour parcourir
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Analyse en cours */}
          {phase === "analyzing" && (
            <div className="mb-8 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
              <div className="flex items-center gap-3 text-sm font-medium text-cyan-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyse du document par l&apos;IA en cours… cela peut prendre 10 à 30 secondes.
              </div>
            </div>
          )}

          {/* Grille résultats */}
          <div className="grid gap-6 xl:grid-cols-2">
            {/* Aperçu */}
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
                      <RotateCcw className="h-3.5 w-3.5" /> Recommencer
                    </button>
                  )}
                  <div className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] ${
                    phase === "done" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : phase === "analyzing" ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                    : phase === "error" ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-slate-700 bg-slate-800/40 text-slate-500"
                  }`}>
                    {phase === "done" ? "Analysé" : phase === "analyzing" ? "Analyse…" : phase === "error" ? "Erreur" : "En attente"}
                  </div>
                </div>
              </div>
              <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-[1.25rem] border border-dashed border-slate-800 bg-[#0F172A] p-6 text-center">
                {!file ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-100">Aucun document sélectionné</p>
                    <p className="text-sm text-slate-400">Ajoutez un fichier pour commencer l&apos;analyse.</p>
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
                    {phase === "analyzing" && (
                      <div className="flex justify-center pt-2">
                        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Données extraites */}
            <div className="rounded-[1.5rem] border border-slate-800/60 bg-[#131B2E] p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">Données extraites par l&apos;IA</h3>
                {phase === "done" && (
                  <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                    Prêt pour l&apos;exploitation
                  </div>
                )}
              </div>

              {phase === "done" && result ? (
                <ResultCard result={result} />
              ) : (
                <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-[#0F172A] text-center">
                  <p className="px-6 text-sm text-slate-500">
                    {phase === "analyzing"
                      ? "Extraction des données en cours…"
                      : phase === "error"
                      ? "L'analyse a échoué. Réessayez avec un autre document."
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
