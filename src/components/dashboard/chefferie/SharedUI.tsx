import Link from "next/link";
import { CheckCircle2, Clock, Loader2, MessageSquare, ChevronRight } from "lucide-react";

// ─── Helpers partagés entre ChefFamilleView et ChefVillageView ───────────────

export const PV_STATUT_LABELS: Record<string, string> = {
  a_fournir: "À régulariser",
  en_cours: "En cours",
  valide: "Validé",
  rejete: "Rejeté",
};

export const PV_STATUT_COLORS: Record<string, string> = {
  a_fournir: "bg-amber-50 text-amber-700 border-amber-200",
  en_cours: "bg-blue-50 text-blue-700 border-blue-200",
  valide: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejete: "bg-red-50 text-red-700 border-red-200",
};

export function SignaturesBadges({
  sigs,
}: {
  sigs: { label: string; done: boolean }[];
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {sigs.map((s) => (
        <span
          key={s.label}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            s.done
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {s.done ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <Clock className="h-3 w-3" />
          )}
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-slate-100">
        <div
          className="h-1.5 rounded-full bg-[#2D8F5A] transition-all"
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="text-xs text-slate-400">
        {value}/{max} signatures
      </span>
    </div>
  );
}

// ─── Écran de chargement ──────────────────────────────────────────────────────

export function LoadingScreen() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm font-medium">Chargement de votre espace…</span>
      </div>
    </div>
  );
}

// ─── Lien messagerie ──────────────────────────────────────────────────────────

export function MessagerieLink({ subtitle }: { subtitle: string }) {
  return (
    <Link
      href="/dashboard/messages"
      className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm transition hover:border-[#0D3B66]/30 hover:bg-slate-50"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-[#0D3B66]/5 p-2">
          <MessageSquare className="h-4 w-4 text-[#0D3B66]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Messagerie</p>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-400" />
    </Link>
  );
}
