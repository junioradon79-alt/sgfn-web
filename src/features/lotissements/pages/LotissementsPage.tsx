"use client";

import { useState } from "react";
import { Map, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useProfile } from "@/hooks/useProfile";
import { useLotissements } from "../hooks/useLotissements";
import LotissementTable from "../components/LotissementTable";
import LotissementForm from "../components/LotissementForm";
import type { Lotissement } from "../types";

const PAGE_SIZE = 8;

export default function LotissementsPage() {
  const { isAdmin } = useProfile();
  const { lotissements, loading, error, create, update, remove } = useLotissements();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState<Lotissement | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openCreate = () => {
    setSelected(null);
    setIsModalOpen(true);
  };

  const openEdit = (l: Lotissement) => {
    setSelected(l);
    setIsModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    if (selected) {
      await update(selected.id, values);
      showToast("Lotissement modifié avec succès.");
    } else {
      await create(values);
      showToast("Lotissement créé avec succès.");
    }
    setSelected(null);
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce lotissement ? Cette action est irréversible.")) return;
    await remove(id);
    showToast("Lotissement supprimé.");
  };

  const filtered = lotissements.filter((l) => {
    const q = search.toLowerCase();
    return (
      !q ||
      l.nom.toLowerCase().includes(q) ||
      (l.commune ?? "").toLowerCase().includes(q) ||
      (l.district ?? "").toLowerCase().includes(q) ||
      (l.village ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-6xl">
      {/* En-tête */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-primary">
            Gestion des Lotissements
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Périmètres fonciers enregistrés, coordonnés et validés dans le système.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#0D3B66] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#1E6091] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Nouveau lotissement
          </button>
        )}
      </div>

      {/* Métriques rapides */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Lotissements", value: lotissements.length },
          { label: "Lots totaux", value: lotissements.reduce((s, l) => s + (l.nb_lots ?? 0), 0) },
          { label: "Îlots totaux", value: lotissements.reduce((s, l) => s + (l.nb_ilots ?? 0), 0) },
          { label: "Communes couvertes", value: new Set(lotissements.map((l) => l.commune).filter(Boolean)).size },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-slate-200/60 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{m.label}</p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-[#0D3B66]">
              {loading ? "…" : m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Barre de recherche */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Rechercher par nom, commune, village…"
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            aria-label="Rechercher un lotissement"
          />
        </div>
        <p className="text-sm text-slate-500">
          {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Erreur */}
      {error && (
        <div className="mb-4 rounded-2xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* État vide (chargement) */}
      {loading ? (
        <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Map className="h-8 w-8 animate-pulse text-slate-300" />
            <p className="text-sm text-slate-500">Chargement des lotissements…</p>
          </div>
        </div>
      ) : (
        <>
          <LotissementTable
            lotissements={paginated}
            onEdit={isAdmin ? openEdit : undefined}
            onDelete={isAdmin ? handleDelete : undefined}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Page {page} sur {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="rounded-full border border-slate-200/70 px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className="rounded-full border border-slate-200/70 px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modale */}
      {isModalOpen && (
        <LotissementForm
          initialData={selected}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmit}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-2xl border px-5 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
