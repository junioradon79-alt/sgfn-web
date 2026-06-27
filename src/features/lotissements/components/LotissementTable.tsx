import type { Lotissement } from "../types";

type Props = {
  lotissements: Lotissement[];
  onEdit?: (lotissement: Lotissement) => void;
  onDelete?: (id: string) => void;
};

export default function LotissementTable({
  lotissements,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-sm">
        <thead className="border-b bg-slate-50">
          <tr>
            <th className="p-4 text-left">Nom</th>
            <th className="p-4 text-left">Commune</th>
            <th className="p-4 text-left">District</th>
            <th className="p-4 text-left">Lots</th>
            <th className="p-4 text-left">Ilots</th>
            <th className="p-4 text-center">Actions</th>
          </tr>
        </thead>

        <tbody>
          {lotissements.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-6 text-center text-slate-500">
                Aucun lotissement trouve
              </td>
            </tr>
          ) : (
            lotissements.map((lotissement) => (
              <tr key={lotissement.id} className="border-b">
                <td className="p-4 font-medium">{lotissement.nom}</td>
                <td className="p-4">{lotissement.commune ?? "-"}</td>
                <td className="p-4">{lotissement.district ?? "-"}</td>
                <td className="p-4">{lotissement.nb_lots ?? 0}</td>
                <td className="p-4">{lotissement.nb_ilots ?? 0}</td>
                <td className="p-4">
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => onEdit?.(lotissement)}
                      className="text-blue-600 hover:underline"
                    >
                      Modifier
                    </button>

                    <button
                      type="button"
                      onClick={() => onDelete?.(lotissement.id)}
                      className="text-red-600 hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
