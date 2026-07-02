import { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  gradient: [string, string];
  size?: "sm" | "md";
};

export default function KpiCard({ label, value, icon: Icon, gradient, size = "md" }: Props) {
  const badgeSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const labelSize = size === "sm" ? "text-[11px]" : "text-xs";

  return (
    <div className="rounded-xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className={`${labelSize} font-medium uppercase tracking-wide text-slate-500`}>{label}</p>
        <div
          className={`flex ${badgeSize} items-center justify-center rounded-lg text-white shadow-sm`}
          style={{
            background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
            boxShadow: `0 6px 14px -6px ${gradient[0]}80`,
          }}
        >
          <Icon className={iconSize} />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-[#0D3B66]">{value}</p>
    </div>
  );
}
