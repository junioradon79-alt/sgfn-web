"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import type { Lotissement, NewLotissement, UpdateLotissement } from "../types";

type Props = {
  initialData?: Lotissement | null;
  onClose: () => void;
  onSubmit: (values: NewLotissement | UpdateLotissement) => void;
};

export default function LotissementForm({
  initialData,
  onClose,
  onSubmit,
}: Props) {
  const [nom, setNom] = useState(initialData?.nom ?? "");
  const [commune, setCommune] = useState(initialData?.commune ?? "");
  const [district, setDistrict] = useState(initialData?.district ?? "");
  const [nbLots, setNbLots] = useState<number>(initialData?.nb_lots ?? 0);
  const [nbIlots, setNbIlots] = useState<number>(initialData?.nb_ilots ?? 0);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    onSubmit({
      nom,
      commune,
      district,
      nb_lots: nbLots,
      nb_ilots: nbIlots,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold">
          {initialData ? "Modifier le lotissement" : "Nouveau lotissement"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full rounded border p-2"
            placeholder="Nom"
            value={nom}
            onChange={(event) => setNom(event.target.value)}
            required
          />

          <input
            className="w-full rounded border p-2"
            placeholder="Commune"
            value={commune}
            onChange={(event) => setCommune(event.target.value)}
          />

          <input
            className="w-full rounded border p-2"
            placeholder="District"
            value={district}
            onChange={(event) => setDistrict(event.target.value)}
          />

          <input
            type="number"
            min={0}
            className="w-full rounded border p-2"
            placeholder="Nombre de lots"
            value={nbLots === 0 ? "" : nbLots}
            onChange={(event) => setNbLots(Number(event.target.value))}
          />

          <input
            type="number"
            min={0}
            className="w-full rounded border p-2"
            placeholder="Nombre d'ilots"
            value={nbIlots === 0 ? "" : nbIlots}
            onChange={(event) => setNbIlots(Number(event.target.value))}
          />

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-4 py-2"
            >
              Annuler
            </button>

            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              {initialData ? "Modifier" : "Creer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
