"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Layers3, Map, MapPin, Plus, Search } from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Input } from "@/components/ds/input";
import { Kpi } from "@/components/ds/kpi";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useProfile } from "@/hooks/useProfile";
import { fadeUp, stagger } from "@/lib/motion";
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

/** Tons du Design System — les couleurs vivent dans les jetons, pas ici. */
const STATUT_SOUMISSION_TONES: Record<string, "warning" | "success" | "danger"> = {
  en_attente: "warning",
  approuvee: "success",
  rejetee: "danger",
};

/**
 * Registre des lotissements.
 *
 * Écran migré sous `AppShell` le 22/07 : il était resté le dernier à porter la
 * coquille legacy (`src/app/lotissements/layout.tsx`), avec une barre latérale
 * `w-64` sans point de rupture. Sur téléphone elle occupait les deux tiers de
 * l'écran et le `overflow-hidden` de la coquille *coupait* le reste au lieu de
 * le laisser défiler : le contenu n'était pas seulement décalé, il était
 * inatteignable.
 */
export default function LotissementsPage() {
  const { profile, isAdmin, isChefferie } = useProfile();
  const { counts } = useBadgeCounts();
  const { lotissements, loading, error, create, update, remove, refresh } = useLotissements();

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
    <AppShell loading={loading} counts={counts} onRefresh={refresh}>
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Gestion des lotissements
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            {isChefferie
              ? "Lotissements sous votre juridiction — créations et corrections soumises à l'approbation du Super Admin."
              : "Périmètres fonciers enregistrés, coordonnés et validés dans le système."}
          </p>
        </div>
        {(isAdmin || isChefferie) && (
          <Button type="button" variant="primary" className="shrink-0" onClick={openCreate}>
            <Plus />
            Nouveau lotissement
          </Button>
        )}
      </div>

      {/* Propositions en cours (chefferie) */}
      {isChefferie && mesSoumissions.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">Mes propositions</h2>
          </div>
          <div className="divide-y divide-border">
            {mesSoumissions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {s.titre ?? s.payload?.nom ?? "Proposition"}
                  </p>
                  {s.statut === "rejetee" && s.commentaire_admin && (
                    <p className="mt-0.5 text-xs text-danger">Motif : {s.commentaire_admin}</p>
                  )}
                </div>
                <Badge tone={STATUT_SOUMISSION_TONES[s.statut] ?? "neutral"} className="shrink-0">
                  {STATUT_SOUMISSION_LABELS[s.statut] ?? s.statut}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Indicateurs */}
      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Indicateurs des lotissements"
      >
        <Kpi
          icon={Map}
          label="Lotissements"
          loading={loading}
          value={lotissements.length}
          legende={<>périmètres enregistrés</>}
        />
        <Kpi
          icon={Layers3}
          label="Lots totaux"
          loading={loading}
          value={lotissements.reduce((s, l) => s + (l.nb_lots ?? 0), 0)}
          legende={<>toutes parcelles confondues</>}
        />
        <Kpi
          icon={Building2}
          label="Îlots totaux"
          loading={loading}
          value={lotissements.reduce((s, l) => s + (l.nb_ilots ?? 0), 0)}
          legende={<>découpage cadastral</>}
        />
        <Kpi
          icon={MapPin}
          label="Communes couvertes"
          loading={loading}
          value={new Set(lotissements.map((l) => l.commune).filter(Boolean)).size}
          legende={<>emprise territoriale</>}
        />
      </motion.section>

      <motion.div variants={stagger(0.05, 0.06)} initial="hidden" animate="show" className="flex flex-col gap-5">
        {/* Recherche */}
        <motion.div variants={fadeUp}>
          <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                placeholder="Rechercher par nom, commune, village…"
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                aria-label="Rechercher un lotissement"
              />
            </div>
            <p className="text-sm text-muted-foreground sm:pr-2">
              {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
            </p>
          </Card>
        </motion.div>

        {error && (
          <p role="alert" className="rounded-xl border border-danger/25 bg-danger-subtle px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        {/* Registre */}
        <motion.div variants={fadeUp}>
          {loading ? (
            <Card>
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Chargement des lotissements…</p>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={Map}
                title={search ? "Aucun résultat" : "Aucun lotissement enregistré"}
                description={
                  search
                    ? `Aucun lotissement ne correspond à « ${search} ».`
                    : "Enregistrez un premier périmètre foncier pour ouvrir le registre."
                }
              />
            </Card>
          ) : (
            <>
              <LotissementTable
                lotissements={paginated}
                onEdit={isAdmin || isChefferie ? openEdit : undefined}
                onDelete={isAdmin ? handleDelete : undefined}
              />

              {totalPages > 1 && (
                <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Page {page} sur {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(p - 1, 1))}
                      disabled={page === 1}
                    >
                      Précédent
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                      disabled={page === totalPages}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </motion.div>

      {isModalOpen && (
        <LotissementForm initialData={selected} onClose={() => setIsModalOpen(false)} onSubmit={handleSubmit} />
      )}

      {toast && (
        <div
          role="status"
          className={`fixed right-5 bottom-5 z-50 rounded-xl border px-5 py-3 text-sm font-medium shadow-float ${
            toast.type === "error"
              ? "border-danger/25 bg-danger-subtle text-danger"
              : "border-success/25 bg-success-subtle text-success"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </AppShell>
  );
}
