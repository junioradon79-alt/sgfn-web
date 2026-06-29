import { Edit2, MapPin, MoreHorizontal, Trash2 } from "lucide-react";
import type { Lotissement } from "../types";

type Props = {
  lotissements: Lotissement[];
  onEdit?: (lotissement: Lotissement) => void;
  onDelete?: (id: string) => void;
};

const TABLE_HEADERS = ["Nom du lotissement", "Localisation", "Lots", "Îlots", "Superficie", "Actions"] as const;

export default function LotissementTable({ lotissements, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200/60 bg-slate-50/50">
              {TABLE_HEADERS.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 last:text-right"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60">
            {lotissements.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                  Aucun lotissement enregistré.
                </td>
              </tr>
            ) : (
              lotissements.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-[#0D3B66]">{l.nom}</p>
                    {l.village && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="h-3 w-3" />
                        {l.village}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {[l.commune, l.district].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold tabular-nums text-slate-700">
                    {l.nb_lots ?? "—"}
                  </td>
                  <td className="px-5 py-4 text-sm tabular-nums text-slate-600">
                    {l.nb_ilots ?? "—"}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {l.superficie_texte ?? (l.superficie_m2 ? `${l.superficie_m2.toLocaleString("fr-FR")} m²` : "—")}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => onEdit?.(l)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0D3B66]"
                        aria-label={`Modifier ${l.nom}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete?.(l.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-[#EF4444]"
                        aria-label={`Supprimer ${l.nom}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
