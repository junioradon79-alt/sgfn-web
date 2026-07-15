import { LucideIcon } from "lucide-react";

type Props = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  /** Conservé pour compatibilité avec les écrans existants. */
  gradient?: [string, string];
  subtitle?: string;
};

export default function SGNFStatCard({
  title,
  value,
  icon: Icon,
  color = "text-[#0F5E8C]",
  subtitle,
}: Props) {
  return <div className="flex h-full items-start justify-between gap-4 p-5 sm:p-6">
    <div>
      <p className="text-sm font-semibold text-[#526176]">{title}</p>
      <h3 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0B2E4F] tabular-nums">{value}</h3>
      {subtitle && <p className="mt-2 text-sm text-[#526176]">{subtitle}</p>}
    </div>
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 ${color}`}>
      <Icon size={21} />
    </div>
  </div>;
}
