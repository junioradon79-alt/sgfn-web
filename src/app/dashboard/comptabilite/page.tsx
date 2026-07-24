"use client";

import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { HandCoins, PiggyBank, Plus, Receipt, Scale, Trash2, Wallet } from "lucide-react";

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
 * Apports (24/07) : entrées manuelles hors commissions — apports en capital,
 * prêts associés… reçus pour couvrir des charges courantes avant encaissement
 * des commissions (table `apports`). Volontairement tenus À PART du KPI
 * Recettes (décision user) pour que ce dernier reste un vrai indicateur du
 * chiffre d'affaires commissions ; ils entrent en revanche dans le Solde de
 * trésorerie disponible, au même titre que les dépenses.
 *
 * Accès : admin + rôle `comptable` (policies `depenses_gestion`, `apports_gestion`
 * et `paiements_read_comptable`, migrations 20260724181000/20260724191000).
 */

type CategorieDepense = Database["public"]["Enums"]["categorie_depense"];
type CategorieApport = Database["public"]["Enums"]["categorie_apport"];

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

const CATEGORIE_APPORT_LABELS: Record<CategorieApport, string> = {
  apport_capital: "Apport en capital",
  pret_associe: "Prêt associé",
  subvention: "Subvention",
  autre: "Autre",
};

const CATEGORIES_APPORT = Object.keys(CATEGORIE_APPORT_LABELS) as CategorieApport[];

type PaiementConfirme = { montant_total: number; commission_sgfn: number; confirme_le: string | null };
type Depense = { id: string; date_depense: string; categorie: CategorieDepense; description: string; montant: number };
type Apport = { id: string; date_apport: string; categorie: CategorieApport; description: string; montant: number };

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
  const [apports, setApports] = useState<Apport[]>([]);
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [modaleApportOuverte, setModaleApportOuverte] = useState(false);

  const charger = useCallback(async () => {
    const [p, d, a] = await Promise.all([
      supabase.from("paiements").select("montant_total, commission_sgfn, confirme_le").eq("statut", "confirme"),
      supabase
        .from("depenses")
        .select("id, date_depense, categorie, description, montant")
        .order("date_depense", { ascending: false }),
      supabase
        .from("apports")
        .select("id, date_apport, categorie, description, montant")
        .order("date_apport", { ascending: false }),
    ]);
    setPaiements((p.data ?? []) as PaiementConfirme[]);
    setDepenses((d.data ?? []) as Depense[]);
    setApports((a.data ?? []) as Apport[]);
  }, [supabase]);

  const { isLoading: loading, recharger } = useChargement(charger, [charger]);

  const recettesTotal = paiements.reduce((s, p) => s + (p.commission_sgfn ?? 0), 0);
  const depensesTotal = depenses.reduce((s, d) => s + (d.montant ?? 0), 0);
  const apportsTotal = apports.reduce((s, a) => s + (a.montant ?? 0), 0);
  // Solde de trésorerie = recettes commissions + apports − dépenses. Les
  // apports restent hors KPI Recettes (qui ne doit refléter que le chiffre
  // d'affaires réel), mais comptent bien dans ce qui est disponible en caisse.
  const solde = recettesTotal + apportsTotal - depensesTotal;

  // ── Solde mensuel — recettes (paiements.confirme_le), apports (apports.date_apport)
  //    et dépenses (depenses.date_depense) regroupés par mois, fusionnés sur les
  //    6 derniers mois avec au moins un mouvement. ──
  const parMois = useMemo(() => {
    const table = new Map<string, { recettes: number; apports: number; depenses: number }>();
    for (const p of paiements) {
      if (!p.confirme_le) continue;
      const cle = moisCle(p.confirme_le);
      const e = table.get(cle) ?? { recettes: 0, apports: 0, depenses: 0 };
      e.recettes += p.commission_sgfn ?? 0;
      table.set(cle, e);
    }
    for (const a of apports) {
      const cle = moisCle(a.date_apport);
      const e = table.get(cle) ?? { recettes: 0, apports: 0, depenses: 0 };
      e.apports += a.montant ?? 0;
      table.set(cle, e);
    }
    for (const d of depenses) {
      const cle = moisCle(d.date_depense);
      const e = table.get(cle) ?? { recettes: 0, apports: 0, depenses: 0 };
      e.depenses += d.montant ?? 0;
      table.set(cle, e);
    }
    return [...table.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6)
      .map(([cle, v]) => ({ cle, ...v, solde: v.recettes + v.apports - v.depenses }));
  }, [paiements, apports, depenses]);

  const supprimerDepense = async (d: Depense) => {
    if (!window.confirm(`Supprimer la dépense « ${d.description} » (${fcfa(d.montant)}) ?`)) return;
    await supabase.from("depenses").delete().eq("id", d.id);
    void recharger();
  };

  const supprimerApport = async (a: Apport) => {
    if (!window.confirm(`Supprimer l'apport « ${a.description} » (${fcfa(a.montant)}) ?`)) return;
    await supabase.from("apports").delete().eq("id", a.id);
    void recharger();
  };

  return (
    <AppShell wide loading={loading} counts={counts} onRefresh={recharger}>
      <motion.div variants={stagger(0, 0.05)} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={fadeUp} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            icon={HandCoins}
            label="Recettes"
            loading={loading}
            value={recettesTotal}
            format={fcfa}
            legende="Part SGNF des paiements confirmés (toutes périodes)"
          />
          <Kpi
            icon={PiggyBank}
            label="Apports"
            loading={loading}
            value={apportsTotal}
            format={fcfa}
            legende={`${apports.length} apport${apports.length > 1 ? "s" : ""} saisi${apports.length > 1 ? "s" : ""} · hors chiffre d'affaires`}
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
            legende="Recettes + apports − dépenses, toutes périodes confondues"
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
                  <table className="w-full min-w-[620px] text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] font-bold tracking-wider text-muted-2 uppercase">
                        <th className="pb-2 font-bold">Mois</th>
                        <th className="pb-2 text-right font-bold">Recettes</th>
                        <th className="pb-2 text-right font-bold">Apports</th>
                        <th className="pb-2 text-right font-bold">Dépenses</th>
                        <th className="pb-2 text-right font-bold">Solde</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parMois.map((m) => (
                        <tr key={m.cle} className="border-b border-border/60 last:border-0">
                          <td className="py-2.5 font-medium text-foreground capitalize">{moisLabel(m.cle)}</td>
                          <td className="tabular py-2.5 text-right text-success">{fcfa(m.recettes)}</td>
                          <td className="tabular py-2.5 text-right text-accent">{fcfa(m.apports)}</td>
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

        <motion.div variants={fadeUp}>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border px-5 py-4">
              <PiggyBank className="size-4 text-primary" aria-hidden />
              <h2 className="text-sm font-semibold text-foreground">Apports ({apports.length})</h2>
              <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={() => setModaleApportOuverte(true)}>
                <Plus className="size-4" />
                Nouvel apport
              </Button>
            </div>
            <div className="px-5 pb-5">
              {loading ? (
                <Skeleton className="h-40" />
              ) : apports.length === 0 ? (
                <EmptyState
                  icon={PiggyBank}
                  title="Aucun apport"
                  description="Enregistrez un apport en capital, un prêt associé ou une subvention reçus par la structure."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {apports.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{a.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {CATEGORIE_APPORT_LABELS[a.categorie]} ·{" "}
                          {new Date(a.date_apport).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge className="tabular">{fcfa(a.montant)}</Badge>
                        <Button variant="ghost" size="icon-sm" onClick={() => supprimerApport(a)} title="Supprimer">
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

      {modaleApportOuverte && (
        <ApportModal
          onClose={() => setModaleApportOuverte(false)}
          onSuccess={() => {
            setModaleApportOuverte(false);
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

// ─── Modale de saisie d'un apport (entrée manuelle hors commissions) ──────

function ApportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [description, setDescription] = useState("");
  const [categorie, setCategorie] = useState<CategorieApport>("apport_capital");
  const [montant, setMontant] = useState("");
  const [dateApport, setDateApport] = useState(aujourdhui);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState("");

  const enregistrer = async () => {
    const montantNombre = Number(montant.replace(",", "."));
    if (!description.trim()) { setErreur("La description est requise."); return; }
    if (!Number.isFinite(montantNombre) || montantNombre <= 0) { setErreur("Le montant doit être un nombre positif."); return; }

    setSaving(true);
    setErreur("");

    const { error } = await supabase.from("apports").insert({
      description: description.trim(),
      categorie,
      montant: montantNombre,
      date_apport: dateApport,
    });

    if (error) { setErreur(error.message); setSaving(false); return; }
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Nouvel apport</p>
          <DialogTitle>Enregistrer un apport</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Description" htmlFor="apport-description" required>
            <Input
              id="apport-description"
              autoFocus
              value={description}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
              placeholder="Ex : Apport de trésorerie juillet"
            />
          </Field>
          <Field label="Catégorie" htmlFor="apport-categorie" required>
            <Select value={categorie} onValueChange={(v) => setCategorie(v as CategorieApport)}>
              <SelectTrigger id="apport-categorie">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES_APPORT.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORIE_APPORT_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Montant (FCFA)" htmlFor="apport-montant" required>
            <Input
              id="apport-montant"
              inputMode="numeric"
              value={montant}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setMontant(e.target.value)}
              placeholder="Ex : 500000"
            />
          </Field>
          <Field label="Date" htmlFor="apport-date" required>
            <Input
              id="apport-date"
              type="date"
              value={dateApport}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDateApport(e.target.value)}
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
