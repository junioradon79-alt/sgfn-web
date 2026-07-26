"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Pencil,
  Plus,
  Ruler,
  Search,
  XCircle,
} from "lucide-react";

import type { Database } from "../../../../database.types";
import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ds/dialog";
import { EmptyState } from "@/components/ds/empty-state";
import { Input, Textarea } from "@/components/ds/input";
import { Kpi } from "@/components/ds/kpi";
import { Field } from "@/components/ds/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ds/select";
import { ChampSelect, ModaleFormulaire } from "@/components/dashboard/ModaleFormulaire";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { useProfile } from "@/hooks/useProfile";
import { fadeUp, stagger } from "@/lib/motion";

// ─── Types ──────────────────────────────────────────────────────────────────

type DossierAdu = {
  id: string;
  lot_id?: string | null;
  adu_numero?: string | null;
  statut?: string | null;
  depose_le?: string | null;
  notes?: string | null;
  adu_date?: string | null;
  acd_reference?: string | null;
  cree_le?: string | null;
  geometre_id?: string | null;
  lots?: {
    numero_lot?: string | number | null;
    ilots?: {
      numero?: string | number | null;
      lotissements?: { nom?: string | null } | null;
    } | null;
  } | null;
  geometres_experts?: {
    nom?: string | null;
    cabinet?: string | null;
  } | null;
};

type LotOption = {
  id: string;
  numero_lot: string | null;
  ilots?: { numero: string | null; lotissements?: { nom: string | null } | null } | null;
};

type GeometreOption = {
  id: string;
  nom: string;
  cabinet: string | null;
};

const STATUT_ADU_LABELS: Record<string, string> = {
  en_preparation: "En préparation",
  piece_manquante: "Pièce manquante",
  depose: "Déposé",
  en_instruction: "En instruction",
  adu_delivree: "ADU délivrée",
  acd_obtenu: "ACD obtenu",
  rejete: "Rejeté",
};

const STATUT_ADU_OPTIONS = Object.entries(STATUT_ADU_LABELS).map(
  ([value, label]) => ({ value, label })
);

const STATUT_ADU_TONE: Record<string, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  en_preparation: "neutral",
  piece_manquante: "warning",
  depose: "accent",
  en_instruction: "accent",
  adu_delivree: "success",
  acd_obtenu: "success",
  rejete: "danger",
};

// Radix Select refuse la chaîne vide comme valeur : sentinelles pour « tous les
// statuts » (filtre) et « aucun géomètre » (édition).
const TOUS = "tous";
const AUCUN_GEOMETRE = "aucun";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lotLabel(d: DossierAdu): string {
  const num = d.lots?.numero_lot != null ? `Lot ${d.lots.numero_lot}` : "Lot —";
  const ilot = d.lots?.ilots?.numero != null ? ` · Îlot ${d.lots.ilots.numero}` : "";
  const loti = d.lots?.ilots?.lotissements?.nom ? ` — ${d.lots.ilots.lotissements.nom}` : "";
  return `${num}${ilot}${loti}`;
}

const fmtDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DossiersAduPage() {
  const supabase = createClient();
  const { isAdmin, isChefferie } = useProfile();
  const { counts } = useBadgeCounts();

  const [dossiers, setDossiers] = useState<DossierAdu[]>([]);

  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState(TOUS);
  const [selected, setSelected] = useState<DossierAdu | null>(null);

  // Édition du dossier sélectionné — seul point d'entrée pour faire progresser
  // un statut après création (la modale de création ne sert qu'à l'état initial).
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    statut: "en_preparation",
    adu_numero: "",
    depose_le: "",
    adu_date: "",
    acd_reference: "",
    notes: "",
    geometre_id: AUCUN_GEOMETRE,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [geometreOptions, setGeometreOptions] = useState<GeometreOption[]>([]);

  const startEdit = async (d: DossierAdu) => {
    if (geometreOptions.length === 0) {
      const { data } = await supabase.from("geometres_experts").select("id, nom, cabinet").order("nom");
      setGeometreOptions((data ?? []) as GeometreOption[]);
    }
    setEditForm({
      statut: d.statut ?? "en_preparation",
      adu_numero: d.adu_numero ?? "",
      depose_le: d.depose_le ? d.depose_le.slice(0, 10) : "",
      adu_date: d.adu_date ? d.adu_date.slice(0, 10) : "",
      acd_reference: d.acd_reference ?? "",
      notes: d.notes ?? "",
      geometre_id: d.geometre_id ?? AUCUN_GEOMETRE,
    });
    setEditError(null);
    setEditing(true);
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSavingEdit(true);
    setEditError(null);
    const payload = {
      statut: editForm.statut as Database["public"]["Enums"]["statut_dossier_adu"],
      adu_numero: editForm.adu_numero.trim() || null,
      depose_le: editForm.depose_le || null,
      adu_date: editForm.adu_date || null,
      acd_reference: editForm.acd_reference.trim() || null,
      notes: editForm.notes.trim() || null,
      geometre_id: editForm.geometre_id === AUCUN_GEOMETRE ? null : editForm.geometre_id,
    };
    const { error } = await supabase.from("dossiers_adu").update(payload).eq("id", selected.id);
    setSavingEdit(false);
    if (error) {
      setEditError(error.message);
      return;
    }
    const geometreChoisi = geometreOptions.find((g) => g.id === payload.geometre_id) ?? null;
    setSelected({
      ...selected,
      ...payload,
      geometres_experts: geometreChoisi ? { nom: geometreChoisi.nom, cabinet: geometreChoisi.cabinet } : null,
    });
    setEditing(false);
    void recharger();
  };

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [lotOptions, setLotOptions] = useState<LotOption[]>([]);
  const [form, setForm] = useState({
    lot_id: "",
    statut: "en_preparation",
    adu_numero: "",
    depose_le: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("dossiers_adu")
      .select(
        "id, lot_id, adu_numero, statut, depose_le, notes, adu_date, acd_reference, cree_le, geometre_id, lots(numero_lot, ilots(numero, lotissements(nom))), geometres_experts(nom, cabinet)"
      )
      .order("cree_le", { ascending: false });
    setDossiers((data ?? []) as unknown as DossierAdu[]);
  };

  const { isLoading: loading, recharger } = useChargement(load);

  const filtered = dossiers.filter((d) => {
    if (statutFilter !== TOUS && d.statut !== statutFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const numAdu = (d.adu_numero ?? "").toLowerCase();
      const numLot = String(d.lots?.numero_lot ?? "").toLowerCase();
      if (!numAdu.includes(q) && !numLot.includes(q)) return false;
    }
    return true;
  });

  const nbTotal = dossiers.length;
  const nbEnCours = dossiers.filter((d) => ["depose", "en_instruction"].includes(d.statut ?? "")).length;
  const nbDelivres = dossiers.filter((d) => ["adu_delivree", "acd_obtenu"].includes(d.statut ?? "")).length;
  const nbRejetes = dossiers.filter((d) => d.statut === "rejete").length;

  const filtreActif = search !== "" || statutFilter !== TOUS;

  const openCreate = async () => {
    if (lotOptions.length === 0) {
      const { data } = await supabase
        .from("lots")
        .select("id, numero_lot, ilots(numero, lotissements(nom))")
        .order("numero_lot")
        .limit(200);
      setLotOptions((data ?? []) as unknown as LotOption[]);
    }
    setForm({ lot_id: "", statut: "en_preparation", adu_numero: "", depose_le: "", notes: "" });
    setFormError(null);
    setShowCreate(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.lot_id) { setFormError("Sélectionnez un lot."); return; }
    setSubmitting(true);
    setFormError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("dossiers_adu").insert([{
      lot_id: form.lot_id,
      statut: form.statut as Database["public"]["Enums"]["statut_dossier_adu"],
      adu_numero: form.adu_numero.trim() || null,
      depose_le: form.depose_le || null,
      notes: form.notes.trim() || null,
      cree_par: user?.id ?? null,
    }]);
    setSubmitting(false);
    if (error) { setFormError(error.message); return; }
    setShowCreate(false);
    void recharger();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell loading={loading} counts={counts} onRefresh={recharger}>
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Dossiers ADU &amp; ACD
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Suivi des autorisations de droits urbains et arrêtés de concession définitive.
          </p>
        </div>
        {!isChefferie && (
          <Button type="button" variant="primary" className="shrink-0" onClick={openCreate}>
            <Plus />
            Nouveau dossier
          </Button>
        )}
      </div>

      {/* KPIs */}
      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Indicateurs des dossiers"
      >
        <Kpi icon={FileText} label="Total" loading={loading} value={nbTotal} legende={<>dossiers enregistrés</>} />
        {/* Seul signal de l'écran : c'est cette file que la pastille brique du
            menu annonce, et l'on arrivait ici sans rien voir. Le rejet, lui,
            reste en ambre — c'est une issue, pas une file : elle ne se vide
            jamais d'elle-même, et la teindre reviendrait à la peindre à demeure. */}
        <Kpi
          icon={Clock}
          label="En cours"
          loading={loading}
          value={nbEnCours}
          tone={!loading && nbEnCours > 0 ? "alert" : "neutral"}
          legende={<>déposés ou en instruction</>}
        />
        <Kpi icon={CheckCircle2} label="Délivrés / ACD" loading={loading} value={nbDelivres} legende={<>ADU délivrée ou ACD obtenu</>} />
        <Kpi
          icon={XCircle}
          label="Rejetés"
          loading={loading}
          value={nbRejetes}
          tone={nbRejetes > 0 ? "warning" : "neutral"}
          legende={<>à réexaminer</>}
        />
      </motion.section>

      {/* Barre de recherche + filtre */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <Card className="flex-row flex-wrap items-center gap-3 p-3">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder="Rechercher par n° ADU ou n° lot…"
              className="pl-9"
              aria-label="Rechercher un dossier"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statutFilter} onValueChange={setStatutFilter}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Filtrer par statut">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Tous les statuts</SelectItem>
              {STATUT_ADU_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {filtreActif && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(""); setStatutFilter(TOUS); }}
            >
              Réinitialiser
            </Button>
          )}
        </Card>
      </motion.div>

      {/* Liste */}
      <div className="flex flex-col gap-2">
        {loading ? (
          <Card className="items-center px-6 py-10 text-center text-sm text-muted-foreground">Chargement…</Card>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={FileText}
              tone={dossiers.length === 0 ? "pending" : "neutral"}
              title={dossiers.length === 0 ? "Aucun dossier ADU enregistré" : "Aucun résultat"}
              description={
                dossiers.length === 0
                  ? "Cliquez sur « Nouveau dossier » pour ouvrir un premier dossier d'instruction."
                  : "Aucun dossier ne correspond à ces critères. Élargissez la recherche ou le filtre."
              }
            />
          </Card>
        ) : (
          filtered.map((d) => (
            <motion.button
              key={d.id}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              type="button"
              onClick={() => setSelected(d)}
              className="w-full rounded-xl border border-border bg-card px-5 py-4 text-left shadow-panel transition hover:border-accent/40"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {d.adu_numero || "Dossier sans numéro"}
                    </p>
                    <p className="truncate text-xs text-muted-2">{lotLabel(d)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={STATUT_ADU_TONE[d.statut ?? ""] ?? "neutral"}>
                    {STATUT_ADU_LABELS[d.statut ?? ""] ?? d.statut}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-2" />
                </div>
              </div>
              {d.depose_le && (
                <p className="mt-1.5 text-xs text-muted-2">Déposé le {fmtDate(d.depose_le)}</p>
              )}
              {d.geometres_experts?.nom && (
                <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-accent">
                  <Ruler className="h-3 w-3" /> {d.geometres_experts.nom}
                </p>
              )}
            </motion.button>
          ))
        )}
      </div>

      {/* ── Panneau détail ────────────────────────────────────────────────── */}
      {selected && (
        <Dialog open onOpenChange={(ouvert) => { if (!ouvert) { setSelected(null); setEditing(false); } }}>
          <DialogContent>
            <DialogHeader>
              <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Instruction foncière</p>
              <DialogTitle>{selected.adu_numero || "Dossier sans numéro"}</DialogTitle>
              <DialogDescription>{lotLabel(selected)}</DialogDescription>
            </DialogHeader>

            {editing ? (
              <form onSubmit={saveEdit}>
                <DialogBody className="space-y-4">
                  <ChampSelect
                    id="adu-edit-statut"
                    label="Statut"
                    value={editForm.statut}
                    onChange={(v) => setEditForm((f) => ({ ...f, statut: v }))}
                  >
                    {STATUT_ADU_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </ChampSelect>

                  <ChampSelect
                    id="adu-edit-geometre"
                    label="Géomètre-expert assigné"
                    value={editForm.geometre_id}
                    onChange={(v) => setEditForm((f) => ({ ...f, geometre_id: v }))}
                  >
                    <SelectItem value={AUCUN_GEOMETRE}>Aucun</SelectItem>
                    {geometreOptions.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.nom}{g.cabinet ? ` · ${g.cabinet}` : ""}
                      </SelectItem>
                    ))}
                  </ChampSelect>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Numéro ADU" htmlFor="adu-edit-numero">
                      <Input
                        id="adu-edit-numero"
                        type="text"
                        value={editForm.adu_numero}
                        placeholder="Ex. ADU-2026-001"
                        onChange={(e) => setEditForm((f) => ({ ...f, adu_numero: e.target.value }))}
                      />
                    </Field>
                    <Field label="Référence ACD" htmlFor="adu-edit-acd">
                      <Input
                        id="adu-edit-acd"
                        type="text"
                        value={editForm.acd_reference}
                        onChange={(e) => setEditForm((f) => ({ ...f, acd_reference: e.target.value }))}
                      />
                    </Field>
                    <Field label="Date de dépôt" htmlFor="adu-edit-depose">
                      <Input
                        id="adu-edit-depose"
                        type="date"
                        value={editForm.depose_le}
                        onChange={(e) => setEditForm((f) => ({ ...f, depose_le: e.target.value }))}
                      />
                    </Field>
                    <Field label="Date ADU" htmlFor="adu-edit-date">
                      <Input
                        id="adu-edit-date"
                        type="date"
                        value={editForm.adu_date}
                        onChange={(e) => setEditForm((f) => ({ ...f, adu_date: e.target.value }))}
                      />
                    </Field>
                  </div>

                  <Field label="Notes" htmlFor="adu-edit-notes">
                    <Textarea
                      id="adu-edit-notes"
                      rows={3}
                      value={editForm.notes}
                      onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </Field>

                  {editError && (
                    <p role="alert" className="rounded-xl border border-danger/25 bg-danger-subtle px-3 py-2 text-sm font-medium text-danger">
                      {editError}
                    </p>
                  )}
                </DialogBody>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setEditing(false); setEditError(null); }}>
                    Annuler
                  </Button>
                  <Button type="submit" variant="primary" loading={savingEdit}>
                    {savingEdit ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <>
                <DialogBody className="space-y-4">
                  {selected.geometres_experts?.nom && (
                    <p className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                      <Ruler className="h-3 w-3" />
                      {selected.geometres_experts.nom}
                      {selected.geometres_experts.cabinet ? ` · ${selected.geometres_experts.cabinet}` : ""}
                    </p>
                  )}

                  <Badge tone={STATUT_ADU_TONE[selected.statut ?? ""] ?? "neutral"}>
                    {STATUT_ADU_LABELS[selected.statut ?? ""] ?? selected.statut ?? "Statut inconnu"}
                  </Badge>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Date de dépôt", value: fmtDate(selected.depose_le) },
                      { label: "Date ADU", value: fmtDate(selected.adu_date) },
                      { label: "Référence ACD", value: selected.acd_reference ?? "—" },
                      { label: "Enregistré le", value: fmtDate(selected.cree_le) },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-inset p-3">
                        <p className="text-xs text-muted-2">{item.label}</p>
                        <p className="mt-0.5 text-sm font-semibold text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {selected.notes && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-2">Notes</p>
                      <p className="whitespace-pre-wrap rounded-xl bg-inset px-4 py-3 text-sm text-foreground">
                        {selected.notes}
                      </p>
                    </div>
                  )}
                </DialogBody>

                <DialogFooter>
                  {isAdmin && (
                    <Button type="button" variant="outline" onClick={() => startEdit(selected)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Modifier
                    </Button>
                  )}
                  <Button type="button" variant="primary" onClick={() => setSelected(null)}>Fermer</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* ── Modale création ───────────────────────────────────────────────── */}
      {showCreate && (
        <ModaleFormulaire
          surTitre="Instruction foncière"
          titre="Nouveau dossier ADU"
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          error={formError}
          isSubmitting={submitting}
          libelleAction="Créer le dossier"
          libelleEnCours="Enregistrement…"
        >
          <ChampSelect
            id="adu-lot"
            label="Lot concerné"
            required
            placeholder="— Sélectionner un lot —"
            value={form.lot_id}
            onChange={(v) => setForm((f) => ({ ...f, lot_id: v }))}
          >
            {lotOptions.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                Lot {l.numero_lot ?? "—"}
                {l.ilots?.numero ? ` · Îlot ${l.ilots.numero}` : ""}
                {l.ilots?.lotissements?.nom ? ` — ${l.ilots.lotissements.nom}` : ""}
              </SelectItem>
            ))}
          </ChampSelect>

          <ChampSelect
            id="adu-statut"
            label="Statut"
            value={form.statut}
            onChange={(v) => setForm((f) => ({ ...f, statut: v }))}
          >
            {STATUT_ADU_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </ChampSelect>

          <Field label="Numéro ADU" htmlFor="adu-numero">
            <Input
              id="adu-numero"
              type="text"
              value={form.adu_numero}
              placeholder="Ex. ADU-2026-001"
              onChange={(e) => setForm((f) => ({ ...f, adu_numero: e.target.value }))}
            />
          </Field>

          <Field label="Date de dépôt" htmlFor="adu-depose">
            <Input
              id="adu-depose"
              type="date"
              value={form.depose_le}
              onChange={(e) => setForm((f) => ({ ...f, depose_le: e.target.value }))}
            />
          </Field>

          <Field label="Notes" htmlFor="adu-notes">
            <Textarea
              id="adu-notes"
              rows={3}
              value={form.notes}
              placeholder="Observations, documents manquants…"
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>
        </ModaleFormulaire>
      )}
    </AppShell>
  );
}
