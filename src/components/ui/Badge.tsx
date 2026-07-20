import React from "react";

type ParcelStatus = "disponible" | "attribue" | "en_validation" | "litige" | "neutre";

interface BadgeProps {
  status: ParcelStatus;
  children?: React.ReactNode;
  className?: string;
}

// Jetons du Design System plutôt que des hex figés : les 3 écrans dashboard qui
// consomment encore ce badge (geometres, saisie, FileValidation) suivent ainsi
// le thème clair/sombre. L'API `status` + le point pulsé restent inchangés.
const STATUS_STYLES: Record<
  ParcelStatus,
  {
    border: string;
    bg: string;
    text: string;
    dot: string;
    dotAnim: string;
  }
> = {
  disponible: {
    border: "border-success/25",
    bg: "bg-success-subtle",
    text: "text-success",
    dot: "bg-success",
    dotAnim: "bg-success/60",
  },
  attribue: {
    border: "border-accent/25",
    bg: "bg-accent-subtle",
    text: "text-accent",
    dot: "bg-accent",
    dotAnim: "bg-accent/60",
  },
  en_validation: {
    border: "border-warning/25",
    bg: "bg-warning-subtle",
    text: "text-warning",
    dot: "bg-warning",
    dotAnim: "bg-warning/60",
  },
  litige: {
    border: "border-danger/25",
    bg: "bg-danger-subtle",
    text: "text-danger",
    dot: "bg-danger",
    dotAnim: "bg-danger/60",
  },
  neutre: {
    border: "border-border",
    bg: "bg-inset",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
    dotAnim: "bg-muted-foreground/60",
  },
};

export const Badge: React.FC<BadgeProps> = ({
  status,
  children,
  className = "",
}) => {
  const styles = STATUS_STYLES[status];
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-0.5 
        rounded-full border text-xs font-semibold
        ${styles.bg} ${styles.text} ${styles.border}
        ${className}
      `}
    >
      {/* Pulsating dot */}
      <span className="relative flex h-2 w-2">
        <span
          className={`
            animate-ping absolute inline-flex h-full w-full rounded-full 
            ${styles.dotAnim} opacity-80
          `}
        ></span>
        <span
          className={`
            relative inline-flex rounded-full h-2 w-2
            ${styles.dot} 
          `}
        ></span>
      </span>
      <span>{children}</span>
    </span>
  );
};