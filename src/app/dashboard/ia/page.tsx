"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Bot, CheckCircle2, FileText, Loader2, RotateCcw, ShieldAlert, ShieldCheck,
  ShieldQuestion, Sparkles, Upload, XCircle,
} from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { createClient } from "@/utils/supabase/client";
import { invokeEdge } from "@/lib/invoke-edge";

// ─── Types ────────────────────────────────────────────────────────────────────

type Signatures = {
  chef_famille: boolean;
  chef_village: boolean;
  sgnf: boolean;
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

const PHASE_BADGE: Record<Phase, { tone: "neutral" | "accent" | "success" | "danger"; label: string }> = {
  idle: { tone: "neutral", label: "En attente" },
  analyzing: { tone: "accent", label: "Analyse…" },
  done: { tone: "success", label: "Analysé" },
  error: { tone: "danger", label: "Erreur" },
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
      <span className="text-xs text-muted-foreground">{label}</span>
      <Badge tone={present ? "success" : "neutral"}>
        {present ? <CheckCircle2 aria-hidden /> : <XCircle aria-hidden />}
        {present ? "Présente" : "Absente"}
      </Badge>
    </div>
  );
}

function ConformiteBadge({ conformite }: { conformite: AnalysisResult["conformite"] }) {
  const cfg = {
    conforme: { tone: "success" as const, Icone: ShieldCheck, label: "Conforme" },
    non_conforme: { tone: "danger" as const, Icone: ShieldAlert, label: "Non conforme" },
    a_verifier: { tone: "warning" as const, Icone: ShieldQuestion, label: "À vérifier" },
  }[conformite] ?? { tone: "warning" as const, Icone: ShieldQuestion, label: "À vérifier" };

  return (
    <Badge tone={cfg.tone} className="px-3 py-1 text-[13px]">
      <cfg.Icone aria-hidden />
      {cfg.label}
    </Badge>
  );
}

/** Bloc libellé / valeur des données extraites. */
function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-inset px-4 py-3">
      <p className="font-mono text-xs font-semibold tracking-widest text-accent uppercase">{label}</p>
      <p className="mt-1 text-[13px] font-semibold text-foreground">{children}</p>
    </div>
  );
}

function ResultCard({ result }: { result: AnalysisResult }) {
  const confiance = result.score_confiance ?? 0;
  // Le sens métier gouverne la couleur, comme partout ailleurs dans le DS.
  const tonConfiance = confiance >= 80 ? "bg-success" : confiance >= 50 ? "bg-warning" : "bg-danger";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone="accent" className="px-3 py-1 tracking-widest uppercase">
          {TYPE_LABELS[result.type_document] ?? result.type_document}
        </Badge>
        <ConformiteBadge conformite={result.conformite} />
      </div>

      <div className="space-y-2">
        {result.attributaire && <Champ label="Attributaire">{result.attributaire}</Champ>}

        <div className="grid gap-2 sm:grid-cols-3">
          {result.ilot && <Champ label="Îlot">{result.ilot}</Champ>}
          {result.lot && <Champ label="Lot">{result.lot}</Champ>}
          {result.date_document && (
            <Champ label="Date">{new Date(result.date_document).toLocaleDateString("fr-FR")}</Champ>
          )}
        </div>

        {result.lotissement && <Champ label="Lotissement">{result.lotissement}</Champ>}
      </div>

      <div className="rounded-xl border border-border bg-inset px-4 py-3">
        <p className="mb-3 font-mono text-xs font-semibold tracking-widest text-accent uppercase">Signatures</p>
        <div className="space-y-2">
          <SignatureRow label="Chef de famille" present={result.signatures.chef_famille} />
          <SignatureRow label="Chef de village / Chefferie" present={result.signatures.chef_village} />
          <SignatureRow label="SGNF" present={result.signatures.sgnf} />
          <SignatureRow label="Notaire / Officiel" present={result.signatures.notaire} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-inset px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-mono text-xs font-semibold tracking-widest text-accent uppercase">Confiance IA</p>
          <span className="tabular text-xs font-bold text-foreground">{confiance} %</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-border">
          <div
            className={`h-full rounded-full transition-all duration-700 ${tonConfiance}`}
            style={{ width: `${confiance}%` }}
          />
        </div>
      </div>

      {result.alertes.length > 0 && (
        <div className="rounded-xl border border-warning/25 bg-warning-subtle px-4 py-3">
          <p className="mb-2 font-mono text-xs font-semibold tracking-widest text-warning uppercase">
            <AlertTriangle className="mr-1 inline size-3.5" aria-hidden />
            Alertes ({result.alertes.length})
          </p>
          <ul className="space-y-1">
            {result.alertes.map((a, i) => (
              <li key={i} className="text-[13px] text-warning">· {a}</li>
            ))}
          </ul>
        </div>
      )}

      {result.observations && (
        <div className="rounded-xl border border-border bg-inset px-4 py-3">
          <p className="mb-1 font-mono text-xs font-semibold tracking-widest text-muted-2 uppercase">Observations</p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">{result.observations}</p>
        </div>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function IAPage() {
  const supabase = useMemo(() => createClient(), []);
  const { counts } = useBadgeCounts();
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

      const res = await invokeEdge<{ ok?: boolean; resultat?: AnalysisResult }>(
        supabase,
        "analyser-document-ia",
        { contenu_base64, type_mime: selected.type, nom_fichier: selected.name },
        "Le service d'analyse est indisponible pour le moment.",
      );

      // `fnError.message` ne disait que « Edge Function returned a non-2xx
      // status code » : le motif réel du service (quota, document illisible…)
      // restait dans la réponse, jamais lu.
      if (res.error) throw new Error(res.error);
      if (!res.data?.ok || !res.data.resultat) throw new Error("Erreur inconnue du service IA");

      setResult(res.data.resultat);
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

  const badgePhase = PHASE_BADGE[phase];

  return (
    <AppShell loading={phase === "analyzing"} counts={counts} onRefresh={reset} wide>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <Badge tone="accent" className="px-3 py-1 text-[13px]">
            <Sparkles aria-hidden />
            Intelligence artificielle SGNF
          </Badge>
          {/* Seule concession à l'ancienne identité « console » : le dégradé du
              titre. Il est bâti sur `accent` et `primary`, donc il tient dans
              les deux thèmes au lieu d'imposer un fond sombre à la page. */}
          <h1 className="mt-3 font-display text-[26px] leading-tight font-extrabold tracking-tight sm:text-3xl">
            <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              SGNF AI — Analyseur intelligent
            </span>
          </h1>
          <p className="mt-2 text-[13.5px] leading-6 text-muted-foreground">
            Vérification, extraction de données et détection d&apos;anomalies sur vos documents
            fonciers — attestations, APFC, PV, CNI.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground shadow-panel">
          <Bot className="size-4 text-accent" aria-hidden />
          Propulsé par Claude
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
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors sm:p-12 ${
          isDragging
            ? "border-accent bg-accent-subtle"
            : "border-border bg-card hover:border-accent/50 hover:bg-inset"
        }`}
      >
        <span className="mx-auto flex size-16 items-center justify-center rounded-xl bg-accent-subtle text-accent">
          <Upload className="size-7" aria-hidden />
        </span>
        <h2 className="mt-5 font-display text-xl font-semibold text-foreground">
          {isDragging ? "Relâchez pour analyser" : "Glissez-déposez un document foncier"}
        </h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          PDF, PNG, JPG, WebP · Max {formatSize(MAX_SIZE)} · ou cliquez pour parcourir
        </p>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-subtle px-4 py-3 text-sm font-medium text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {phase === "analyzing" && (
        <p className="flex items-center gap-3 rounded-xl border border-accent/25 bg-accent-subtle px-4 py-3 text-sm font-medium text-accent">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Analyse du document par l&apos;IA en cours… cela peut prendre 10 à 30 secondes.
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Aperçu */}
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-[15px] font-bold text-foreground">Aperçu du document</h3>
            <div className="flex items-center gap-2">
              {file && (
                <Button type="button" variant="ghost" size="sm" onClick={reset}>
                  <RotateCcw /> Recommencer
                </Button>
              )}
              <Badge tone={badgePhase.tone}>{badgePhase.label}</Badge>
            </div>
          </div>
          <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-inset p-6 text-center">
            {!file ? (
              <div className="space-y-2">
                <p className="text-[13px] font-semibold text-foreground">Aucun document sélectionné</p>
                <p className="text-[13px] text-muted-foreground">Ajoutez un fichier pour commencer l&apos;analyse.</p>
              </div>
            ) : previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={file.name} className="max-h-[260px] w-auto rounded-lg object-contain" />
            ) : (
              <div className="space-y-3">
                <span className="mx-auto flex size-14 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                  <FileText className="size-7" aria-hidden />
                </span>
                <div>
                  <p className="text-[13px] font-semibold break-all text-foreground">{file.name}</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">{formatSize(file.size)} · PDF</p>
                </div>
                {phase === "analyzing" && (
                  <div className="flex justify-center pt-2">
                    <Loader2 className="size-6 animate-spin text-accent" aria-hidden />
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Données extraites */}
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-[15px] font-bold text-foreground">Données extraites par l&apos;IA</h3>
            {phase === "done" && <Badge tone="success">Prêt pour l&apos;exploitation</Badge>}
          </div>

          {phase === "done" && result ? (
            <ResultCard result={result} />
          ) : (
            <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border bg-inset text-center">
              <p className="px-6 text-[13px] text-muted-foreground">
                {phase === "analyzing"
                  ? "Extraction des données en cours…"
                  : phase === "error"
                  ? "L'analyse a échoué. Réessayez avec un autre document."
                  : "Les données extraites apparaîtront ici une fois un document analysé."}
              </p>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
