import React from "react";

type ParcelStatus = "disponible" | "attribue" | "en_validation" | "litige";

interface BadgeProps {
  status: ParcelStatus;
  children?: React.ReactNode;
  className?: string;
}

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
    border: "border-[#2D8F5A]/25",
    bg: "bg-[#2D8F5A]/10",
    text: "text-[#2D8F5A]",
    dot: "bg-[#2D8F5A]",
    dotAnim: "bg-[#2D8F5A]/60",
  },
  attribue: {
    border: "border-[#1E6091]/25",
    bg: "bg-[#1E6091]/10",
    text: "text-[#1E6091]",
    dot: "bg-[#1E6091]",
    dotAnim: "bg-[#1E6091]/60",
  },
  en_validation: {
    border: "border-[#F39C12]/25",
    bg: "bg-[#F39C12]/10",
    text: "text-[#F39C12]",
    dot: "bg-[#F39C12]",
    dotAnim: "bg-[#F39C12]/60",
  },
  litige: {
    border: "border-[#EF4444]/25",
    bg: "bg-[#EF4444]/10",
    text: "text-[#EF4444]",
    dot: "bg-[#EF4444]",
    dotAnim: "bg-[#EF4444]/60",
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