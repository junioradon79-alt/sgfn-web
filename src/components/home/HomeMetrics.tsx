"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Metric = { value: string; label: string; highlight?: boolean };

const STATIC_METRICS: Metric[] = [
  { value: "—", label: "Lots enregistrés" },
  { value: "—", label: "Attributions" },
  { value: "—", label: "Attributaires" },
  { value: "—", label: "Documents" },
  { value: "—", label: "PV de famille" },
  { value: "100%", label: "Traçabilité", highlight: true },
];

export function HomeMetrics() {
  const [metrics, setMetrics] = useState<Metric[]>(STATIC_METRICS);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.rpc("get_public_stats");
      if (!data) return;
      const stats = data as {
        lots?: number;
        attributions?: number;
        attributaires?: number;
        documents?: number;
        pv_famille?: number;
      };
      setMetrics([
        { value: String(stats.lots ?? "—"), label: "Lots enregistrés" },
        { value: String(stats.attributions ?? "—"), label: "Attributions" },
        { value: String(stats.attributaires ?? "—"), label: "Attributaires" },
        { value: String(stats.documents ?? "—"), label: "Documents" },
        { value: String(stats.pv_famille ?? "—"), label: "PV de famille" },
        { value: "100%", label: "Traçabilité", highlight: true },
      ]);
    })();
  }, []);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {metrics.map((item) => (
        <div
          key={item.label}
          className={`rounded-xl sm:rounded-2xl border p-4 sm:p-6 text-left ${
            item.highlight
              ? "border-[#0D3B66]/10 bg-[#0D3B66] text-white"
              : "border-slate-200/60 bg-white text-slate-700"
          }`}
        >
          <p className={`text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] leading-snug ${item.highlight ? "text-white/70" : "text-slate-400"}`}>
            {item.label}
          </p>
          <p className={`mt-2 sm:mt-3 text-2xl sm:text-4xl font-semibold tracking-tight ${item.highlight ? "text-white" : "text-[#0D3B66]"}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
