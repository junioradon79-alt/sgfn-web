import Link from "next/link";
import { CheckCircle2, Clock, Loader2, MessageSquare, ChevronRight, type LucideIcon } from "lucide-react";

// ─── Helpers partagés entre ProprietaireTerrienView et ChefVillageView ───────
//
// Ce fichier est consommé par des écrans DÉJÀ migrés sur le Design System
// (Propriétaire terrien, Validations) : il doit donc parler en jetons, sinon
// ses blocs restent blancs sur une page en mode sombre.

export const PV_STATUT_LABELS: Record<string, string> = {
  a_fournir: "À régulariser",
  en_cours: "En cours",
  valide: "Validé",
  rejete: "Rejeté",
};

export const PV_STATUT_COLORS: Record<string, string> = {
  a_fournir: "bg-warning-subtle text-warning border-warning/25",
  en_cours: "bg-accent-subtle text-accent border-accent/25",
  valide: "bg-success-subtle text-success border-success/25",
  rejete: "bg-danger-subtle text-danger border-danger/25",
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
              ? "border-success/25 bg-success-subtle text-success"
              : "border-warning/25 bg-warning-subtle text-warning"
          }`}
        >
          {s.done ? (
            <CheckCircle2 className="size-3" aria-hidden />
          ) : (
            <Clock className="size-3" aria-hidden />
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
      <div className="h-1.5 w-24 rounded-full bg-inset">
        <div
          className="h-1.5 rounded-full bg-success transition-all"
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="text-xs text-muted-2">
        {value}/{max} signatures
      </span>
    </div>
  );
}

// ─── Écran de chargement ──────────────────────────────────────────────────────

export function LoadingScreen() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        <span className="text-sm font-medium">Chargement de votre espace…</span>
      </div>
    </div>
  );
}

// ─── Lien messagerie ──────────────────────────────────────────────────────────

export function MessagerieLink({ subtitle, href = "/dashboard/messages" }: { subtitle: string; href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 shadow-panel transition-colors hover:border-primary/30 hover:bg-inset"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-inset p-2">
          <MessageSquare className="size-4 text-primary" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Messagerie</p>
          <p className="text-xs text-muted-2">{subtitle}</p>
        </div>
      </div>
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}

// ─── Carte de synthèse cliquable ───────────────────────────────────────────────
// `href` commençant par "#" → ancre sur la même page (scroll) ; sinon navigation.

export function StatCard({
  href, icon: Icon, label, value, subtitle, alerte = 0,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: number;
  subtitle: string;
  alerte?: number;
}) {
  const className =
    "group relative rounded-xl border border-border bg-card p-4 shadow-panel transition-colors hover:border-primary/30";
  const inner = (
    <>
      {alerte > 0 && (
        <span className="absolute top-3 right-3 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">
          {alerte}
        </span>
      )}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
      </div>
      <p className="tabular mt-2 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-2">{subtitle}</p>
    </>
  );
  return href.startsWith("#") ? (
    <a href={href} className={className}>{inner}</a>
  ) : (
    <Link href={href} className={className}>{inner}</Link>
  );
}
