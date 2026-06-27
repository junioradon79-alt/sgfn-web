import { LucideIcon } from "lucide-react";
import SGFNCard from "@/components/ui/SGFNCard";

type Props = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  subtitle?: string;
};

export default function SGFNStatCard({
  title,
  value,
  icon: Icon,
  color = "text-blue-600",
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

        <div
          className={`rounded-xl bg-slate-100 p-3 ${color}`}
        >
          <Icon size={28} />
        </div>

      </div>

    </SGFNCard>
  );
}