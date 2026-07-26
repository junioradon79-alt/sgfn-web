"use client";

import { type FormEvent, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, FileText, Gavel, Plus, Scale } from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import {
  Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ds/dialog";
import { EmptyState } from "@/components/ds/empty-state";
import { Input, Textarea } from "@/components/ds/input";
import { Kpi } from "@/components/ds/kpi";
import { Field } from "@/components/ds/label";
import { ScrollArea } from "@/components/ds/scroll-area";
import { SelectItem } from "@/components/ds/select";
import { BoutonImprimer } from "@/components/dashboard/BoutonImprimer";
import { Avertissement, ChampSelect, ModaleFormulaire } from "@/components/dashboard/ModaleFormulaire";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { useProfile } from "@/hooks/useProfile";
import { fadeUp, stagger } from "@/lib/motion";

type LitigeRecord = {
  id: string;
  lot_id: string | null;
  objet: string | null;
  statut: string | null;
  ouvert_le: string | null;
  notes: string | null;
  lots?: { numero_lot: string | null } | null;
};

type LotOption = { id: string; numero_lot: string | null };

type SuiviRow = {
  id: string;
  type: "note" | "statut";
  statut_avant: string | null;
  statut_apres: string | null;
  corps: string | null;
  cree_le: string;
  profiles: { nom_complet: string | null } | null;
};

const STATUT_CONFIG: Record<string, { tone: "danger" | "warning" | "accent" | "success"; label: string }> = {
  ouvert: { tone: "danger", label: "Ouvert" },
  en_mediation: { tone: "warning", label: "En médiation" },
  tranche: { tone: "accent", label: "Tranché" },
  clos: { tone: "success", label: "Clos" },
};

const TABLE_HEADERS = ["Réf.", "Lot concerné", "Objet", "Statut", "Date d'ouverture", "Actions"] as const;

const fmtDate = (v: string) =>
  new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

export default function LitigesPage() {
  const supabase = useMemo(() => createClient(), []);
  const { isAdmin, isChefferie } = useProfile();
  const { counts } = useBadgeCounts();

  const [litiges, setLitiges] = useState<LitigeRecord[]>([]);
  const [lotsOptions, setLotsOptions] = useState<LotOption[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ lot_id: "", objet: "", notes: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [detailLitige, setDetailLitige] = useState<LitigeRecord | null>(null);
  const [suivi, setSuivi] = useState<SuiviRow[]>([]);
  const [suiviLoading, setSuiviLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const loadSuivi = async (litigeId: string) => {
    setSuiviLoading(true);
    const { data } = await supabase
      .from("litiges_suivi")
      .select("id, type, statut_avant, statut_apres, corps, cree_le, profiles:auteur_id(nom_complet)")
      .eq("litige_id", litigeId)
      .order("cree_le", { ascending: true });
    setSuivi((data ?? []) as unknown as SuiviRow[]);
    setSuiviLoading(false);
  };

  const openDetail = (litige: LitigeRecord) => {
    setDetailLitige(litige);
    setSuivi([]);
    setNoteText("");
    setNoteError(null);
    void loadSuivi(litige.id);
  };

  const ajouterNote = async () => {
    if (!detailLitige || !noteText.trim()) return;
    setNoteSubmitting(true);
    setNoteError(null);
    const { error } = await supabase.rpc("ajouter_note_litige", {
      p_litige_id: detailLitige.id,
      p_corps: noteText.trim(),
    });
    if (error) {
      setNoteError(error.message);
    } else {
      setNoteText("");
      await loadSuivi(detailLitige.id);
    }
    setNoteSubmitting(false);
  };

  const loadLitiges = async () => {
    const { data } = await supabase
      .from("litiges")
      .select("id, lot_id, objet, statut, ouvert_le, notes, lots(numero_lot)")
      .order("ouvert_le", { ascending: false });
    setLitiges((data ?? []) as LitigeRecord[]);
  };

  const loadLots = async () => {
    const { data } = await supabase
      .from("lots")
      .select("id, numero_lot")
      .order("numero_lot", { ascending: true });
    setLotsOptions((data ?? []) as LotOption[]);
  };

  const { isLoading: dataLoading, recharger } = useChargement(async () => {
    await Promise.all([loadLitiges(), loadLots()]);
  });

  const ouverts = litiges.filter((l) => l.statut === "ouvert" || l.statut === "en_mediation").length;
  const clos = litiges.filter((l) => l.statut === "tranche" || l.statut === "clos").length;
  const taux = litiges.length > 0 ? Math.round((clos / litiges.length) * 100) : 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.objet.trim()) {
      setErrorMessage("L'objet du litige est obligatoire.");
      return;
    }
    // lot_id est NOT NULL en base : un litige sans lot a toujours été rejeté
    // (l'ancien `as any` masquait cette contrainte).
    if (!form.lot_id) {
      setErrorMessage("Sélectionnez le lot concerné par le litige.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("litiges").insert([
      {
        lot_id: form.lot_id,
        objet: form.objet.trim(),
        notes: form.notes.trim() || null,
        statut: "ouvert",
        cree_par: user?.id ?? null,
      },
    ]);

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setForm({ lot_id: "", objet: "", notes: "" });
    setIsModalOpen(false);
    setIsSubmitting(false);
    setSuccessMessage("Dossier de litige ouvert avec succès.");
    setTimeout(() => setSuccessMessage(null), 4000);
    await recharger();
  };

  return (
    <AppShell loading={dataLoading} counts={counts} onRefresh={recharger}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Litiges fonciers
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Registre des réclamations, arbitrages coutumiers et résolutions juridiques.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BoutonImprimer />
          {isAdmin && (
            <Button
              type="button"
              variant="danger"
              className="print:hidden"
              onClick={() => { setIsModalOpen(true); setErrorMessage(null); }}
            >
              <Plus />
              Ouvrir un dossier
            </Button>
          )}
        </div>
      </div>

      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-3"
        aria-label="Indicateurs des litiges"
      >
        {/* Seul signal de l'écran : la barre latérale annonce « N à traiter » sur
            les litiges non clos, et l'on arrivait ici sans rien voir. Un dossier
            ouvert ou en médiation attend une décision — c'est une file, pas un
            état, d'où la brique plutôt que l'ambre. */}
        <Kpi
          icon={Gavel}
          label="En cours d'arbitrage"
          loading={dataLoading}
          value={ouverts}
          tone={!dataLoading && ouverts > 0 ? "alert" : "neutral"}
          legende={<>ouverts ou en médiation</>}
        />
        <Kpi
          icon={CheckCircle2}
          label="Dossiers résolus"
          loading={dataLoading}
          value={clos}
          legende={<>tranchés ou clos</>}
        />
        <Kpi
          icon={Scale}
          label="Taux de résolution"
          loading={dataLoading}
          value={taux}
          format={(n) => `${n} %`}
          legende={<>sur {litiges.length} dossier{litiges.length > 1 ? "s" : ""} enregistré{litiges.length > 1 ? "s" : ""}</>}
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
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Chargement des litiges…</p>
          ) : litiges.length === 0 ? (
            <EmptyState
              icon={Scale}
              tone="positive"
              title="Aucun litige enregistré"
              description="Aucune réclamation n'a été ouverte sur votre périmètre."
            />
          ) : (
            <div className="max-h-[62vh] overflow-auto print:max-h-none print:overflow-visible">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border bg-inset">
                    {TABLE_HEADERS.map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="bg-inset px-5 py-3 text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase last:text-right print:last:hidden"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {litiges.map((litige) => {
                    const cfg = STATUT_CONFIG[litige.statut ?? "ouvert"] ?? STATUT_CONFIG.ouvert;
                    return (
                      <tr key={litige.id} className="transition-colors hover:bg-inset/70">
                        <td className="px-5 py-3.5 font-mono text-xs font-medium text-muted-foreground">
                          {litige.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-5 py-3.5 text-[13px] font-semibold text-foreground">
                          {litige.lots?.numero_lot ? `Lot ${litige.lots.numero_lot}` : "N/A"}
                        </td>
                        <td className="max-w-[220px] truncate px-5 py-3.5 text-[13px] text-muted-foreground">
                          {litige.objet || "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={cfg.tone}>{cfg.label}</Badge>
                        </td>
                        <td className="px-5 py-3.5 text-[13px] text-muted-2">
                          {litige.ouvert_le ? fmtDate(litige.ouvert_le) : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right print:hidden">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetail(litige)}
                            aria-label={`Ouvrir le dossier ${litige.id.slice(0, 8).toUpperCase()}`}
                          >
                            <FileText />
                            Dossier
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Ouverture d'un dossier */}
      {isModalOpen && (
        <ModaleFormulaire
          surTitre="Nouveau dossier"
          surTitreTon="danger"
          titre="Ouvrir un dossier de litige"
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmit}
          error={errorMessage}
          isSubmitting={isSubmitting}
          variante="danger"
          libelleAction="Ouvrir le dossier"
          libelleEnCours="Ouverture…"
        >
          <ChampSelect
            id="litige-lot"
            label="Lot concerné"
            required
            placeholder="— Sélectionner un lot —"
            value={form.lot_id}
            onChange={(v) => setForm((f) => ({ ...f, lot_id: v }))}
          >
            {lotsOptions.map((lot) => (
              <SelectItem key={lot.id} value={lot.id}>Lot {lot.numero_lot}</SelectItem>
            ))}
          </ChampSelect>

          <Field label="Objet du litige" htmlFor="litige-objet" required>
            <Input
              id="litige-objet"
              type="text"
              value={form.objet}
              required
              placeholder="Ex. Contestation de limites de parcelle"
              onChange={(e) => setForm((f) => ({ ...f, objet: e.target.value }))}
            />
          </Field>

          <Field label="Notes" htmlFor="litige-notes">
            <Textarea
              id="litige-notes"
              value={form.notes}
              rows={3}
              placeholder="Détails, contexte, parties impliquées…"
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>

          <Avertissement>
            L&apos;ouverture d&apos;un dossier de litige est enregistrée dans le journal d&apos;audit et
            notifiée aux parties concernées.
          </Avertissement>
        </ModaleFormulaire>
      )}

      {/* Détail d'un dossier — historique + notes de suivi */}
      {detailLitige && (
        <Dialog open onOpenChange={(ouvert) => { if (!ouvert) setDetailLitige(null); }}>
          <DialogContent>
            <DialogHeader>
              <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">
                {detailLitige.lots?.numero_lot ? `Lot ${detailLitige.lots.numero_lot}` : "Dossier"}
              </p>
              <DialogTitle>{detailLitige.objet || "Litige"}</DialogTitle>
            </DialogHeader>

            <DialogBody className="space-y-4">
              {suiviLoading ? (
                <p className="text-[13px] text-muted-2">Chargement…</p>
              ) : suivi.length === 0 ? (
                <p className="text-[13px] text-muted-2">Aucun suivi enregistré pour ce dossier.</p>
              ) : (
                <ScrollArea className="max-h-80">
                  <div className="space-y-3 pr-1">
                    {suivi.map((s) => (
                      <div key={s.id} className="rounded-xl border border-border bg-inset px-3.5 py-2.5">
                        {s.type === "statut" ? (
                          <p className="text-xs text-muted-foreground">
                            Statut :{" "}
                            <span className="font-medium text-foreground">
                              {STATUT_CONFIG[s.statut_avant ?? ""]?.label ?? s.statut_avant ?? "—"}
                            </span>
                            {" → "}
                            <span className="font-medium text-foreground">
                              {STATUT_CONFIG[s.statut_apres ?? ""]?.label ?? s.statut_apres ?? "—"}
                            </span>
                          </p>
                        ) : (
                          <p className="text-[13px] text-foreground">{s.corps}</p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-2">
                          {s.profiles?.nom_complet ?? "Équipe SGNF"} · {fmtDate(s.cree_le)}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {(isAdmin || isChefferie) && (
                <div className="space-y-2">
                  <Textarea
                    value={noteText}
                    rows={2}
                    placeholder="Ajouter une note de suivi…"
                    aria-label="Note de suivi"
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                  {noteError && <p role="alert" className="text-xs font-medium text-danger">{noteError}</p>}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      loading={noteSubmitting}
                      disabled={!noteText.trim()}
                      onClick={ajouterNote}
                    >
                      Ajouter la note
                    </Button>
                  </div>
                </div>
              )}
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </AppShell>
  );
}
