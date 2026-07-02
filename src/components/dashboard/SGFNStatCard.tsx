import { LucideIcon } from "lucide-react";
import SGFNCard from "@/components/ui/SGFNCard";

type Props = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  /** Dégradé de couleurs (ex. ["#1E6091", "#4FA8D8"]) — remplace le badge plat si fourni. */
  gradient?: [string, string];
  subtitle?: string;
};

export default function SGFNStatCard({
  title,
  value,
  icon: Icon,
  color = "text-blue-600",
  gradient,
  subtitle,
}: Props) {
  return (
    <SGFNCard className="h-full">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <h3 className="mt-3 text-4xl font-bold text-slate-900">
            {value}
          </h3>

          {subtitle && (
            <p className="mt-2 text-sm text-slate-500">
              {subtitle}
            </p>
          )}

        </div>

        {gradient ? (
          <div
            className="rounded-2xl p-3 text-white shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
              boxShadow: `0 10px 24px -8px ${gradient[0]}80`,
            }}
          >
            <Icon size={28} />
          </div>
        ) : (
          <div className={`rounded-xl bg-slate-100 p-3 ${color}`}>
            <Icon size={28} />
          </div>
        )}

      </div>

    </SGFNCard>
  );
}