"use client";

import { scoreColor } from "../data/mappers";

/** Jauge circulaire de l'indice de confiance (0–100), reprise du prototype. */
export function ScoreGauge({ score, size = 110 }: { score: number; size?: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  const color = scoreColor(score);
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} className="-rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--inset)" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c.toFixed(1)}
          strokeDashoffset={offset.toFixed(1)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-[28px] font-extrabold leading-none text-foreground">{score}</span>
        <span className="text-[10px] text-muted-2">/ 100</span>
      </div>
    </div>
  );
}
