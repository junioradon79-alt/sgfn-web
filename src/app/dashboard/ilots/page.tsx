"use client";

import { type FormEvent, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Grid2x2, Map, Plus, Search } from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Input } from "@/components/ds/input";
import { Kpi } from "@/components/ds/kpi";
import { Field } from "@/components/ds/label";
import { SelectItem } from "@/components/ds/select";
import { ChampSelect, ModaleFormulaire } from "@/components/dashboard/ModaleFormulaire";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { fadeUp, stagger } from "@/lib/motion";

type IlotRecord = {
  id: string;
  numero: string | null;
  lotissement_id: string | null;
};

type LotissementOption = {
  id: string;
  nom: string | null;
};

const TABLE_HEADERS = ["Numéro", "Lotissement"] as const;
const EMPTY_FORM = { numero: "", lotissement_id: "" };

export default function IlotsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { counts } = useBadgeCounts();

  const [ilots, setIlots] = useState<IlotRecord[]>([]);
  const [lotissements, setLotissements] = useState<LotissementOption[]>([]);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    const [ilotsRes, lotsRes] = await Promise.all([
      supabase.from("ilots").select("id, numero, lotissement_id").order("numero", { ascending: true }),
      supabase.from("lotissements").select("id, nom").order("nom", { ascending: true }),
    ]);

    setIlots((ilotsRes.data ?? []) as IlotRecord[]);
    setLotissements((lotsRes.data ?? []) as LotissementOption[]);
  };

  const { isLoading: loading, recharger } = useChargement(loadData);

  const lotName = (id: string | null) =>
    lotissements.find((l) => l.id === id)?.nom ?? "—";

  const filtered = ilots.filter((ilot) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (ilot.numero ?? "").toLowerCase().includes(q) ||
      lotName(ilot.lotissement_id).toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.numero.trim()) {
      setErrorMessage("Le numéro d'îlot est obligatoire.");
      return;
    }

    if (!form.lotissement_id) {
      setErrorMessage("Le lotissement de rattachement est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase.from("ilots").insert([
      {
        numero: form.numero.trim(),
        lotissement_id: form.lotissement_id,
      },
    ]);

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setForm(EMPTY_FORM);
    setIsModalOpen(false);
    setIsSubmitting(false);
    setSuccessMessage("Îlot créé avec succès.");
    setTimeout(() => setSuccessMessage(null), 4000);
    await recharger();
  };

  return (
    <AppShell loading={loading} counts={counts} onRefresh={recharger}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Îlots cadastraux
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Vue synthétique des îlots et de leur lotissement de rattachement.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          className="shrink-0"
          onClick={() => {
            setIsModalOpen(true);
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
        >
          <Plus />
          Ajouter un îlot
        </Button>
      </div>

      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2"
        aria-label="Indicateurs des îlots"
      >
        <Kpi
          icon={Grid2x2}
          label="Îlots enregistrés"
          loading={loading}
          value={ilots.length}
          legende={<>toutes juridictions de votre périmètre</>}
        />
        <Kpi
          icon={Map}
          label="Lotissements couverts"
          loading={loading}
          value={lotissements.length}
          legende={<>périmètres de rattachement possibles</>}
        />
      </motion.section>

      {successMessage && (
        <p role="status" className="rounded-xl border border-success/25 bg-success-subtle px-4 py-3 text-sm font-medium text-success">
          {successMessage}
        </p>
      )}

      <motion.div variants={stagger(0.05, 0.06)} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={fadeUp}>
          <Card className="p-3">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                placeholder="Rechercher un îlot ou un lotissement"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Rechercher un îlot"
              />
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="overflow-hidden">
            {loading ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Chargement des îlots…</p>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Grid2x2}
                title={search ? "Aucun résultat" : "Aucun îlot enregistré"}
                description={
                  search
                    ? `Aucun îlot ne correspond à « ${search} ».`
                    : "Créez un premier îlot pour commencer à découper un lotissement."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border bg-inset">
                      {TABLE_HEADERS.map((header) => (
                        <th
                          key={header}
                          scope="col"
                          className="px-5 py-3 text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((ilot) => (
                      <tr key={ilot.id} className="transition-colors hover:bg-inset/70">
                        <td className="px-5 py-3.5 text-[13px] font-semibold text-foreground">{ilot.numero ?? "—"}</td>
                        <td className="px-5 py-3.5 text-[13px] text-muted-foreground">{lotName(ilot.lotissement_id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      </motion.div>

      {isModalOpen && (
        <ModaleFormulaire
          surTitre="Nouvel îlot"
          titre="Créer un îlot cadastral"
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmit}
          error={errorMessage}
          isSubmitting={isSubmitting}
          libelleAction="Enregistrer l'îlot"
          libelleEnCours="Enregistrement…"
        >
          <Field label="Numéro d'îlot" htmlFor="ilot-numero" required>
            <Input
              id="ilot-numero"
              type="text"
              value={form.numero}
              onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
              placeholder="Ex. 01"
              required
            />
          </Field>

          <ChampSelect
            id="ilot-lotissement"
            label="Lotissement de rattachement"
            required
            placeholder="Sélectionner un lotissement…"
            value={form.lotissement_id}
            onChange={(v) => setForm((f) => ({ ...f, lotissement_id: v }))}
          >
            {lotissements.map((lot) => (
              <SelectItem key={lot.id} value={lot.id}>{lot.nom ?? lot.id}</SelectItem>
            ))}
          </ChampSelect>
        </ModaleFormulaire>
      )}
    </AppShell>
  );
}
