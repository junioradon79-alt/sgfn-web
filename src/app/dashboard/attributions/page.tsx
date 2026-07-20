"use client";

import { type FormEvent, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { History, Link2, Plus } from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Input, Textarea } from "@/components/ds/input";
import { Kpi } from "@/components/ds/kpi";
import { Field } from "@/components/ds/label";
import { SelectItem } from "@/components/ds/select";
import { BoutonImprimer } from "@/components/dashboard/BoutonImprimer";
import { CaseACocher, ChampSelect, ModaleFormulaire } from "@/components/dashboard/ModaleFormulaire";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { useProfile } from "@/hooks/useProfile";
import { fadeUp, stagger } from "@/lib/motion";
import { fetchAllPages } from "@/lib/supabase-pagination";

type AttributionRecord = {
  id: string;
  lot_id: string | null;
  attributaire_id: string | null;
  qualite: string | null;
  actuel: boolean | null;
  depuis: string | null;
  observation: string | null;
  lots?: { numero_lot: string | null } | null;
  attributaires?: { nom: string | null } | null;
};

type LotOption = { id: string; numero_lot: string | null };
type AttributaireOption = { id: string; nom: string | null };

const QUALITE_OPTIONS = [
  { value: "ayant_droit", label: "Propriétaire d'origine" },
  { value: "ayant_droit_transmission", label: "Ayant-droit par transmission" },
  { value: "acquereur", label: "Acquéreur" },
  { value: "operateur", label: "Opérateur" },
  { value: "entrepreneur", label: "Entrepreneur" },
  { value: "reservataire", label: "Réservataire" },
];

const TABLE_HEADERS = ["Lot", "Attributaire", "Qualité", "Statut", "Depuis", "Observation"] as const;

const FORM_VIDE = {
  lot_id: "",
  attributaire_id: "",
  qualite: "ayant_droit",
  actuel: true,
  depuis: new Date().toISOString().slice(0, 10),
  observation: "",
};

export default function AttributionsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { isAdmin } = useProfile();
  const { counts } = useBadgeCounts();

  const [attributions, setAttributions] = useState<AttributionRecord[]>([]);
  const [lotsOptions, setLotsOptions] = useState<LotOption[]>([]);
  const [attributairesOptions, setAttributairesOptions] = useState<AttributaireOption[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(FORM_VIDE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadAttributions = async () => {
    // Pagination : PostgREST plafonne à 1000 lignes/réponse. Sur la vue nationale
    // (admin / vérificateur = 1352 attributions), 352 lignes étaient perdues
    // silencieusement. On pagine avec un ordre déterministe (depuis + id).
    const data = await fetchAllPages<AttributionRecord>((from, to) =>
      supabase
        .from("attributions")
        .select("id, lot_id, attributaire_id, qualite, actuel, depuis, observation, lots(numero_lot), attributaires(nom)")
        .order("depuis", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: AttributionRecord[] | null }>
    );
    setAttributions(data);
  };

  const { isLoading: dataLoading, recharger } = useChargement(async () => {
    const [, lotsRes, attrRes] = await Promise.all([
      loadAttributions(),
      supabase.from("lots").select("id, numero_lot").eq("statut", "libre").order("numero_lot"),
      supabase.from("attributaires").select("id, nom").order("nom"),
    ]);
    setLotsOptions((lotsRes.data ?? []) as LotOption[]);
    setAttributairesOptions((attrRes.data ?? []) as AttributaireOption[]);
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.lot_id || !form.attributaire_id) {
      setErrorMessage("Le lot et l'attributaire sont obligatoires.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    // RPC transactionnel : désactive l'ancienne attribution, insère la nouvelle
    // et met à jour le statut du lot en une seule transaction.
    const { error } = await supabase.rpc("transferer_attribution", {
      p_lot_id: form.lot_id,
      p_attributaire_id: form.attributaire_id,
      p_qualite: form.qualite as "ayant_droit" | "ayant_droit_transmission" | "acquereur" | "operateur" | "entrepreneur" | "reservataire",
      p_actuel: form.actuel,
      p_depuis: form.depuis || undefined,
      p_observation: form.observation.trim() || undefined,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setForm({ ...FORM_VIDE, depuis: new Date().toISOString().slice(0, 10) });
    setIsModalOpen(false);
    setIsSubmitting(false);
    setSuccessMessage("Attribution enregistrée avec succès.");
    setTimeout(() => setSuccessMessage(null), 4000);
    await recharger();

    supabase.from("lots").select("id, numero_lot").eq("statut", "libre").order("numero_lot").then(({ data }) => {
      setLotsOptions((data ?? []) as LotOption[]);
    });
  };

  const actuelles = attributions.filter((a) => a.actuel).length;

  return (
    <AppShell loading={dataLoading} counts={counts} onRefresh={recharger}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Attributions foncières
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Enregistrement et suivi des attributions de lots aux ayants droit et acquéreurs.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BoutonImprimer />
          {isAdmin && (
            <Button
              type="button"
              variant="primary"
              className="print:hidden"
              onClick={() => { setIsModalOpen(true); setErrorMessage(null); }}
            >
              <Plus />
              Nouvelle attribution
            </Button>
          )}
        </div>
      </div>

      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-3"
        aria-label="Indicateurs des attributions"
      >
        <Kpi
          icon={Link2}
          label="Attributions au registre"
          loading={dataLoading}
          value={attributions.length}
          legende={<>historique complet, tous rangs</>}
        />
        <Kpi
          icon={History}
          label="Attributions actuelles"
          loading={dataLoading}
          value={actuelles}
          legende={<>un titulaire en cours par lot</>}
        />
        <Kpi
          icon={Plus}
          label="Lots libres"
          loading={dataLoading}
          value={lotsOptions.length}
          legende={<>attribuables immédiatement</>}
        />
      </motion.section>

      {successMessage && (
        <p role="status" className="rounded-xl border border-success/25 bg-success-subtle px-4 py-3 text-sm font-medium text-success">
          {successMessage}
        </p>
      )}

      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <Card className="overflow-hidden print:border-none print:shadow-none">
          {dataLoading ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Chargement des attributions…</p>
          ) : attributions.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="Aucune attribution enregistrée"
              description="Aucun lot de votre périmètre n'a encore été attribué."
            />
          ) : (
            // 1 352 attributions sur la vue nationale : sans hauteur bornée, la
            // page dépasse les 70 000 px. Défilement interne, en overflow natif
            // (pas ScrollArea) parce que cet écran s'imprime.
            <div className="max-h-[62vh] overflow-auto print:max-h-none print:overflow-visible">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border bg-inset">
                    {TABLE_HEADERS.map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="bg-inset px-5 py-3 text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attributions.map((attr) => (
                    <tr key={attr.id} className="transition-colors hover:bg-inset/70">
                      <td className="px-5 py-3.5 text-[13px] font-bold text-foreground">
                        {attr.lots?.numero_lot ? `Lot ${attr.lots.numero_lot}` : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-[13px] font-medium text-foreground">
                        {attr.attributaires?.nom || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-muted-foreground">
                        {QUALITE_OPTIONS.find((q) => q.value === attr.qualite)?.label ?? attr.qualite ?? "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={attr.actuel ? "accent" : "neutral"}>
                          {attr.actuel ? "Actuel" : "Historique"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-muted-2">
                        {attr.depuis
                          ? new Date(attr.depuis).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="max-w-[200px] truncate px-5 py-3.5 text-[13px] text-muted-2">
                        {attr.observation || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>

      {isModalOpen && (
        <ModaleFormulaire
          surTitre="Nouvelle attribution"
          titre="Lier un lot à un attributaire"
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmit}
          error={errorMessage}
          isSubmitting={isSubmitting}
          libelleAction="Enregistrer l'attribution"
          libelleEnCours="Enregistrement…"
        >
          <ChampSelect
            id="attr-lot"
            label="Lot foncier"
            required
            placeholder="— Sélectionner un lot libre —"
            value={form.lot_id}
            onChange={(v) => setForm((f) => ({ ...f, lot_id: v }))}
          >
            {lotsOptions.map((lot) => (
              <SelectItem key={lot.id} value={lot.id}>Lot {lot.numero_lot}</SelectItem>
            ))}
          </ChampSelect>

          <ChampSelect
            id="attr-attrib"
            label="Attributaire"
            required
            value={form.attributaire_id}
            onChange={(v) => setForm((f) => ({ ...f, attributaire_id: v }))}
          >
            {attributairesOptions.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.nom ?? "—"}</SelectItem>
            ))}
          </ChampSelect>

          <ChampSelect
            id="attr-qualite"
            label="Qualité de l'attributaire"
            value={form.qualite}
            onChange={(v) => setForm((f) => ({ ...f, qualite: v }))}
          >
            {QUALITE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </ChampSelect>

          <Field label="Date d'effet" htmlFor="attr-depuis">
            <Input
              id="attr-depuis"
              type="date"
              value={form.depuis}
              onChange={(e) => setForm((f) => ({ ...f, depuis: e.target.value }))}
            />
          </Field>

          <CaseACocher checked={form.actuel} onChange={(v) => setForm((f) => ({ ...f, actuel: v }))}>
            Attribution actuelle (marque le lot comme « Attribué »)
          </CaseACocher>

          <Field label="Observation" htmlFor="attr-obs">
            <Textarea
              id="attr-obs"
              value={form.observation}
              rows={2}
              onChange={(e) => setForm((f) => ({ ...f, observation: e.target.value }))}
              placeholder="Remarques, conditions particulières…"
            />
          </Field>
        </ModaleFormulaire>
      )}
    </AppShell>
  );
}
