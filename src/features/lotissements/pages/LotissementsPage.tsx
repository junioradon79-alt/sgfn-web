"use client";

import { useEffect, useState } from "react";
import { Map, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useProfile } from "@/hooks/useProfile";
import { useLotissements } from "../hooks/useLotissements";
import LotissementTable from "../components/LotissementTable";
import LotissementForm from "../components/LotissementForm";
import {
  proposerLotissement,
  getMesSoumissionsLotissement,
  type SoumissionLotissement,
} from "../services/lotissements.service";
import type { Lotissement, NewLotissement } from "../types";

const PAGE_SIZE = 8;

const STATUT_SOUMISSION_LABELS: Record<string, string> = {
  en_attente: "En attente d'approbation",
  approuvee: "Approuvée",
  rejetee: "Rejetée",
};

const STATUT_SOUMISSION_COLORS: Record<string, string> = {
  en_attente: "border-amber-200 bg-amber-50 text-amber-700",
  approuvee: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejetee: "border-red-200 bg-red-50 text-red-700",
};

export default function LotissementsPage() {
  const { profile, isAdmin, isChefferie } = useProfile();
  const { lotissements, loading, error, create, update, remove } = useLotissements();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState<Lotissement | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [mesSoumissions, setMesSoumissions] = useState<SoumissionLotissement[]>([]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!isChefferie) return;
    void getMesSoumissionsLotissement().then(({ data }) => setMesSoumissions(data ?? []));
  }, [isChefferie]);

  const openCreate = () => {
    setSelected(null);
    setIsModalOpen(true);
  };

  const openEdit = (l: Lotissement) => {
    setSelected(l);
    setIsModalOpen(true);
  };

  const handleSubmit = async (values: NewLotissement) => {
    if (isChefferie && !isAdmin) {
      const { error: submitError } = selected
        ? await proposerLotissement("modification_lotissement", selected.id, { ...values, lotissement_id: selected.id }, `Correction — ${values.nom}`)
        : await proposerLotissement("creation_lotissement", null, values, `Création — ${values.nom}`);
      if (submitError) {
        showToast(`Échec de l'envoi : ${submitError.message}`, "error");
      } else {
        showToast("Proposition envoyée — en attente d'approbation du Super Admin.");
        void getMesSoumissionsLotissement().then(({ data }) => setMesSoumissions(data ?? []));
      }
      setSelected(null);
      setIsModalOpen(false);
      return;
    }

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

  const filtered = lotissements
    .filter((l) => !isChefferie || l.autorite_coutumiere_id === profile?.autorite_coutumiere_id)
    .filter((l) => {
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
            {isChefferie
              ? "Lotissements sous votre juridiction — créations et corrections soumises à l'approbation du Super Admin."
              : "Périmètres fonciers enregistrés, coordonnés et validés dans le système."}
          </p>
        </div>
        {(isAdmin || isChefferie) && (
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

      {/* Mes propositions (chefferie) */}
      {isChefferie && mesSoumissions.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-[#0D3B66]">Mes propositions</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {mesSoumissions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">{s.titre ?? s.payload?.nom ?? "Proposition"}</p>
                  {s.statut === "rejetee" && s.commentaire_admin && (
                    <p className="mt-0.5 text-xs text-red-600">Motif : {s.commentaire_admin}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
                    STATUT_SOUMISSION_COLORS[s.statut] ?? "border-slate-200 bg-slate-50 text-slate-500"
                  }`}
                >
                  {STATUT_SOUMISSION_LABELS[s.statut] ?? s.statut}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
            onEdit={isAdmin || isChefferie ? openEdit : undefined}
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
