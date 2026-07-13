"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { DUR, EASE } from "@/lib/motion";

/**
 * Micro-graphiques en SVG natif.
 *
 * Pas de librairie de charts : à cette taille, une dépendance de ~100 ko
 * coûterait plus cher que le code qu'elle remplace, et nous perdrions le
 * contrôle des tokens (les couleurs viennent de `--chart-*`, donc le mode
 * sombre est gratuit).
 */

/** Trace lissée (Catmull-Rom → Bézier) : évite les angles durs d'une polyline. */
function smoothPath(pts: Array<[number, number]>) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export function Sparkline({
  data,
  color = "var(--chart-2)",
  className,
  height = 40,
  ariaLabel,
}: {
  data: number[];
  color?: string;
  className?: string;
  height?: number;
  ariaLabel: string;
}) {
  const id = React.useId();
  const W = 120;
  const H = height;
  const PAD = 3;

  const pts = React.useMemo<Array<[number, number]>>(() => {
    if (data.length === 0) return [];
    const max = Math.max(...data);
    const min = Math.min(...data);
    const span = max - min || 1;
    const stepX = data.length > 1 ? (W - PAD * 2) / (data.length - 1) : 0;
    return data.map((v, i) => [PAD + i * stepX, H - PAD - ((v - min) / span) * (H - PAD * 2)]);
  }, [data, H]);

  if (pts.length < 2) {
    return <div className={cn("h-10", className)} aria-hidden />;
  }

  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("w-full overflow-visible", className)}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill={`url(#spark-${id})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DUR.slow, ease: EASE, delay: 0.15 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: EASE }}
      />
      <motion.circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r={2.2}
        fill={color}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: DUR.fast, ease: EASE, delay: 0.65 }}
      />
    </svg>
  );
}

export type Segment = { key: string; label: string; value: number; color: string };

/**
 * Barre de composition — remplace un camembert : à surface égale, une barre
 * empilée se compare et s'étiquette mieux, surtout sous 4 catégories.
 */
export function CompositionBar({
  segments,
  className,
  height = 8,
}: {
  segments: Segment[];
  className?: string;
  height?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <div className={cn("rounded-full bg-inset", className)} style={{ height }} />;

  return (
    <div
      className={cn("flex w-full gap-0.5 overflow-hidden rounded-full", className)}
      style={{ height }}
      role="img"
      aria-label={segments.map((s) => `${s.label} : ${s.value}`).join(", ")}
    >
      {segments
        .filter((s) => s.value > 0)
        .map((s, i) => (
          <motion.div
            key={s.key}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ background: s.color }}
            initial={{ width: 0 }}
            animate={{ width: `${(s.value / total) * 100}%` }}
            transition={{ duration: DUR.slow, ease: EASE, delay: 0.08 * i }}
          />
        ))}
    </div>
  );
}

/** Histogramme compact — volumes par période, sans axes ni grille. */
export function BarSeries({
  data,
  color = "var(--chart-2)",
  className,
  height = 56,
  ariaLabel,
}: {
  data: Array<{ label: string; value: number }>;
  color?: string;
  className?: string;
  height?: number;
  ariaLabel: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    // `items-stretch` (et non `items-end`) : sans étirement, les colonnes
    // prennent la hauteur de leur contenu, et la hauteur en % des barres se
    // résout alors contre 0 — l'histogramme reste invisible.
    <div
      className={cn("flex items-stretch gap-1", className)}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      {data.map((d, i) => (
        <div key={d.label} className="flex h-full flex-1 flex-col justify-end" title={`${d.label} : ${d.value}`}>
          <motion.div
            className="w-full rounded-t-[3px]"
            style={{ background: d.value > 0 ? color : "var(--border)" }}
            initial={{ height: 0 }}
            animate={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 6 : 2)}%` }}
            transition={{ duration: DUR.slow, ease: EASE, delay: 0.02 * i }}
          />
        </div>
      ))}
    </div>
  );
}
