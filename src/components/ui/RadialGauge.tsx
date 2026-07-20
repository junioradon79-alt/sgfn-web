"use client";

import { useId, type ReactNode } from "react";

type Props = {
  value: number;
  size?: number;
  strokeWidth?: number;
  gradient: [string, string];
  trackColor?: string;
  children?: ReactNode;
};

export default function RadialGauge({
  value,
  size = 96,
  strokeWidth = 10,
  gradient,
  // Jeton plutôt qu'un gris figé : sur une page sombre, l'ancien `#F1F5F9`
  // dessinait un anneau blanc autour de la jauge. `--border` suit le thème et
  // vaut un gris clair équivalent hors du sous-arbre sombre.
  trackColor = "var(--border)",
  children,
}: Props) {
  const gradientId = useId();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradient[0]} />
            <stop offset="100%" stopColor={gradient[1]} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
