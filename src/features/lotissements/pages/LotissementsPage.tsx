"use client";

import { useMemo, useState } from "react";

import { useLotissements } from "../hooks/useLotissements";
import LotissementTable from "../components/LotissementTable";
import LotissementForm from "../components/LotissementForm";
import type { Lotissement, NewLotissement, UpdateLotissement } from "../types";

export default function LotissementsPage() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Lotissement | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  const pageSize = 5;
  const { lotissements, loading, error, create, update, remove } =
    useLotissements();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return lotissements;

    return lotissements.filter((lotissement) =>
      [
        lotissement.nom,
        lotissement.commune,
        lotissement.district,
      ].some((value) => value?.toLowerCase().includes(query))
    );
  }, [lotissements, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  };

  const handleSubmit = async (
    values: NewLotissement | UpdateLotissement
  ) => {
    if (selected) {
      await update(selected.id, values);
      showToast("Lotissement modifie");
    } else {
      await create(values as NewLotissement);
      showToast("Lotissement cree");
    }

    setSelected(null);
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm("Supprimer ce lotissement ?");

    if (!ok) return;

    await remove(id);
    showToast("Lotissement supprime");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Lotissements
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestion des lotissements enregistres dans SGFN.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setOpen(true);
          }}
          className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
        >
          Nouveau
        </button>
      </div>

      <input
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="Rechercher un lotissement..."
        className="w-full max-w-md rounded border border-slate-300 p-2 text-sm"
      />

      {error && (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-slate-500">Chargement...</p>}

      <LotissementTable
        lotissements={paginated}
        onEdit={(lotissement) => {
          setSelected(lotissement);
          setOpen(true);
        }}
        onDelete={handleDelete}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Page {currentPage} sur {totalPages} - {filtered.length} resultat(s)
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(value - 1, 1))}
            disabled={currentPage === 1}
            className="rounded border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() =>
              setPage((value) => Math.min(value + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="rounded border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {open && (
        <LotissementForm
          initialData={selected}
          onClose={() => {
            setSelected(null);
            setOpen(false);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 rounded bg-slate-950 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
