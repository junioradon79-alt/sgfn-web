"use client";

import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { HandCoins, Plus, Receipt, Scale, Trash2, Wallet } from "lucide-react";

import { fadeUp, stagger } from "@/lib/motion";
import { createClient } from "@/utils/supabase/client";
import { useChargement } from "@/hooks/useChargement";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ds/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ds/dialog";
import { EmptyState } from "@/components/ds/empty-state";
import { Field } from "@/components/ds/label";
import { Input } from "@/components/ds/input";
import { Kpi } from "@/components/ds/kpi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ds/select";
import { Skeleton } from "@/components/ds/skeleton";
import type { Database } from "../../../../database.types";

/**
 * Comptabilité simplifiée SGNF (24/07) — recettes/dépenses avec solde, pas de
 * grand livre en partie double (décidé avec le user).
 *
 * Les recettes ne sont PAS saisies : elles viennent de `paiements`
 * (statut='confirme'), colonne `commission_sgfn` — la part réellement
 * encaissée par SGNF après répartition (chefferie, prestataires…), pas
 * `montant_total` qui inclut la part reversée à des tiers. Seules les
 * dépenses sont saisies à la main (table `depenses`).
 *
 * Accès : admin + rôle `comptable` (policies `depenses_gestion` et
 * `paiements_read_comptable`, migration 20260724181000).
 */

type CategorieDepense = Database["public"]["Enums"]["categorie_depense"];

const CATEGORIE_LABELS: Record<CategorieDepense, string> = {
  salaires: "Salaires",
  loyer_charges: "Loyer & charges",
  materiel_equipement: "Matériel & équipement",
  prestataires_externes: "Prestataires externes",
  marketing_communication: "Marketing & communication",
  impots_taxes: "Impôts & taxes",
  deplacements: "Déplacements",
  autre: "Autre",
};

const CATEGORIES = Object.keys(CATEGORIE_LABELS) as CategorieDepense[];

type PaiementConfirme = { montant_total: number; commission_sgfn: number; confirme_le: string | null };
type Depense = { id: string; date_depense: string; categorie: CategorieDepense; description: string; montant: number };

const nf = new Intl.NumberFormat("fr-FR");
const fcfa = (n: number) => `${nf.format(Math.round(n))} F`;

/** Clé de regroupement mensuel triable ("2026-07"), et son libellé ("juil. 2026"). */
function moisCle(iso: string) {
  return iso.slice(0, 7);
}
function moisLabel(cle: string) {
  const [annee, mois] = cle.split("-").map(Number);
  return new Date(annee, mois - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

function ComptabiliteContenu() {
  const supabase = useMemo(() => createClient(), []);
  const { counts } = useBadgeCounts();

  const [paiements, setPaiements] = useState<PaiementConfirme[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [modaleOuverte, setModaleOuverte] = useState(false);

  const charger = useCallback(async () => {
    const [p, d] = await Promise.all([
      supabase.from("paiements").select("montant_total, commission_sgfn, confirme_le").eq("statut", "confirme"),
      supabase
        .from("depenses")
        .select("id, date_depense, categorie, description, montant")
        .order("date_depense", { ascending: false }),
    ]);
    setPaiements((p.data ?? []) as PaiementConfirme[]);
    setDepenses((d.data ?? []) as Depense[]);
  }, [supabase]);

  const { isLoading: loading, recharger } = useChargement(charger, [charger]);

  const recettesTotal = paiements.reduce((s, p) => s + (p.commission_sgfn ?? 0), 0);
  const depensesTotal = depenses.reduce((s, d) => s + (d.montant ?? 0), 0);
  const solde = recettesTotal - depensesTotal;

  // ── Solde mensuel — recettes (paiements.confirme_le) et dépenses (depenses.date_depense)
  //    regroupées par mois, fusionnées sur les 6 derniers mois avec un mouvement. ──
  const parMois = useMemo(() => {
    const table = new Map<string, { recettes: number; depenses: number }>();
    for (const p of paiements) {
      if (!p.confirme_le) continue;
      const cle = moisCle(p.confirme_le);
      const e = table.get(cle) ?? { recettes: 0, depenses: 0 };
      e.recettes += p.commission_sgfn ?? 0;
      table.set(cle, e);
    }
    for (const d of depenses) {
      const cle = moisCle(d.date_depense);
      const e = table.get(cle) ?? { recettes: 0, depenses: 0 };
      e.depenses += d.montant ?? 0;
      table.set(cle, e);
    }
    return [...table.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6)
      .map(([cle, v]) => ({ cle, ...v, solde: v.recettes - v.depenses }));
  }, [paiements, depenses]);

  const supprimerDepense = async (d: Depense) => {
    if (!window.confirm(`Supprimer la dépense « ${d.description} » (${fcfa(d.montant)}) ?`)) return;
    await supabase.from("depenses").delete().eq("id", d.id);
    void recharger();
  };

  return (
    <AppShell wide loading={loading} counts={counts} onRefresh={recharger}>
      <motion.div variants={stagger(0, 0.05)} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={fadeUp} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Kpi
            icon={HandCoins}
            label="Recettes"
            loading={loading}
            value={recettesTotal}
            format={fcfa}
            legende="Part SGNF des paiements confirmés (toutes périodes)"
          />
          <Kpi
            icon={Receipt}
            label="Dépenses"
            loading={loading}
            value={depensesTotal}
            format={fcfa}
            legende={`${depenses.length} dépense${depenses.length > 1 ? "s" : ""} saisie${depenses.length > 1 ? "s" : ""}`}
          />
          <Kpi
            icon={Scale}
            label="Solde"
            loading={loading}
            value={solde}
            format={fcfa}
            tone={solde < 0 ? "warning" : "neutral"}
            legende="Recettes − dépenses, toutes périodes confondues"
          />
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>Solde mensuel</CardTitle>
                <CardDescription>Les 6 derniers mois avec au moins un mouvement.</CardDescription>
              </div>
            </CardHeader>
            <div className="px-5 pb-5">
              {loading ? (
                <Skeleton className="h-32" />
              ) : parMois.length === 0 ? (
                <EmptyState icon={Wallet} title="Aucun mouvement" description="Aucune recette ni dépense enregistrée pour l'instant." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] font-bold tracking-wider text-muted-2 uppercase">
                        <th className="pb-2 font-bold">Mois</th>
                        <th className="pb-2 text-right font-bold">Recettes</th>
                        <th className="pb-2 text-right font-bold">Dépenses</th>
                        <th className="pb-2 text-right font-bold">Solde</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parMois.map((m) => (
                        <tr key={m.cle} className="border-b border-border/60 last:border-0">
                          <td className="py-2.5 font-medium text-foreground capitalize">{moisLabel(m.cle)}</td>
                          <td className="tabular py-2.5 text-right text-success">{fcfa(m.recettes)}</td>
                          <td className="tabular py-2.5 text-right text-danger">{fcfa(m.depenses)}</td>
                          <td className="tabular py-2.5 text-right font-semibold text-foreground">{fcfa(m.solde)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border px-5 py-4">
              <Receipt className="size-4 text-primary" aria-hidden />
              <h2 className="text-sm font-semibold text-foreground">Dépenses ({depenses.length})</h2>
              <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={() => setModaleOuverte(true)}>
                <Plus className="size-4" />
                Nouvelle dépense
              </Button>
            </div>
            <div className="px-5 pb-5">
              {loading ? (
                <Skeleton className="h-40" />
              ) : depenses.length === 0 ? (
                <EmptyState icon={Receipt} title="Aucune dépense" description="Enregistrez la première dépense de la structure." />
              ) : (
                <ul className="divide-y divide-border">
                  {depenses.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{d.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {CATEGORIE_LABELS[d.categorie]} ·{" "}
                          {new Date(d.date_depense).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge className="tabular">{fcfa(d.montant)}</Badge>
                        <Button variant="ghost" size="icon-sm" onClick={() => supprimerDepense(d)} title="Supprimer">
                          <Trash2 className="size-4 text-danger" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {modaleOuverte && (
        <DepenseModal
          onClose={() => setModaleOuverte(false)}
          onSuccess={() => {
            setModaleOuverte(false);
            void recharger();
          }}
        />
      )}
    </AppShell>
  );
}

export default function ComptabilitePage() {
  return <ComptabiliteContenu />;
}

// ─── Modale de saisie d'une dépense ────────────────────────────────────────

function DepenseModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [description, setDescription] = useState("");
  const [categorie, setCategorie] = useState<CategorieDepense>("autre");
  const [montant, setMontant] = useState("");
  const [dateDepense, setDateDepense] = useState(aujourdhui);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState("");

  const enregistrer = async () => {
    const montantNombre = Number(montant.replace(",", "."));
    if (!description.trim()) { setErreur("La description est requise."); return; }
    if (!Number.isFinite(montantNombre) || montantNombre <= 0) { setErreur("Le montant doit être un nombre positif."); return; }

    setSaving(true);
    setErreur("");

    const { error } = await supabase.from("depenses").insert({
      description: description.trim(),
      categorie,
      montant: montantNombre,
      date_depense: dateDepense,
    });

    if (error) { setErreur(error.message); setSaving(false); return; }
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Nouvelle dépense</p>
          <DialogTitle>Enregistrer une dépense</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Description" htmlFor="dep-description" required>
            <Input
              id="dep-description"
              autoFocus
              value={description}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
              placeholder="Ex : Loyer bureau juillet"
            />
          </Field>
          <Field label="Catégorie" htmlFor="dep-categorie" required>
            <Select value={categorie} onValueChange={(v) => setCategorie(v as CategorieDepense)}>
              <SelectTrigger id="dep-categorie">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORIE_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Montant (FCFA)" htmlFor="dep-montant" required>
            <Input
              id="dep-montant"
              inputMode="numeric"
              value={montant}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setMontant(e.target.value)}
              placeholder="Ex : 150000"
            />
          </Field>
          <Field label="Date" htmlFor="dep-date" required>
            <Input
              id="dep-date"
              type="date"
              value={dateDepense}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDateDepense(e.target.value)}
            />
          </Field>
          {erreur && (
            <p role="alert" className="text-sm font-medium text-danger">
              {erreur}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" variant="primary" loading={saving} onClick={enregistrer}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
