"use client";

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

/** Bouton retour rond, décliné clair (sur header sombre) ou neutre. */
export function BackButton({
  onClick,
  variant = "light",
}: {
  onClick: () => void;
  variant?: "light" | "neutral";
}) {
  const cls =
    variant === "light"
      ? "bg-white/15 text-white hover:bg-white/25"
      : "bg-inset text-foreground hover:bg-border/60";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Retour"
      className={`flex size-9 flex-none items-center justify-center rounded-full transition-colors ${cls}`}
    >
      <ChevronLeft className="size-[22px]" strokeWidth={2.1} />
    </button>
  );
}

/** En-tête « marque » (fond primary, coins bas arrondis). */
export function PrimaryHeader({
  onBack,
  centerTitle,
  right,
  children,
  className = "",
}: {
  onBack?: () => void;
  centerTitle?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const hasBar = onBack || centerTitle || right;
  return (
    <div className={`flex-none rounded-b-[26px] bg-primary px-5 pt-3 pb-5 text-white ${className}`}>
      {hasBar && (
        <div className="flex items-center justify-between gap-3">
          {onBack ? <BackButton onClick={onBack} /> : <span className="size-9" />}
          {centerTitle ? (
            <span className="truncate text-[13.5px] font-semibold opacity-90">{centerTitle}</span>
          ) : (
            <span />
          )}
          {right ?? <span className="size-9" />}
        </div>
      )}
      {children}
    </div>
  );
}

/** En-tête léger (fond card + filet bas), pour Chat / Notifications / Achat. */
export function BarHeader({
  onBack,
  title,
  right,
}: {
  onBack: () => void;
  title: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-none items-center gap-3 border-b border-border bg-card px-3 py-2">
      <BackButton onClick={onBack} variant="neutral" />
      <div className="min-w-0 flex-1">{title}</div>
      {right}
    </div>
  );
}
