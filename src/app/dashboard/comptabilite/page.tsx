"use client";

import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { HandCoins, PiggyBank, Plus, Receipt, Scale, Trash2, Wallet } from "lucide-react";

import { fadeUp, stagger } from "@/lib/motion";
import { fetchAllPages } from "@/lib/supabase-pagination";
import { createClient } from "@/utils/supabase/client";
import { useChargement } from "@/hooks/useChargement";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";

import { AppShell } from "@/components/pilotage/AppShell";
import { BoutonImprimer } from "@/components/dashboard/BoutonImprimer";
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
 * Relevé imprimable (24/07 soir) : filtres période + postes de dépenses +
 * sections, agissant sur TOUT l'écran (décision user : on imprime ce qu'on
 * voit, et les filtres servent aussi à l'analyse quotidienne). Impression par
 * le navigateur via `BoutonImprimer`/`window.print()`, comme les 5 registres
 * admin — pas de gabarit PDFMonkey : ce relevé est un document interne, non
 * opposable et non QR-vérifiable, il ne justifie pas un 5e gabarit distant à
 * tenir synchronisé à la main. Les recettes sont détaillées ligne à ligne
 * (décision user) pour qu'un montant puisse être remonté à sa pièce d'origine.
 *
 * Accès : admin + rôle `comptable` (policies `depenses_gestion`, `apports_gestion`
 * et `paiements_read_comptable`, migrations 20260724181000/20260724191000).
 */

type CategorieDepense = Database["public"]["Enums"]["categorie_depense"];
type CategorieApport = Database["public"]["Enums"]["categorie_apport"];
type TypePaiement = Database["public"]["Enums"]["type_paiement"];

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

const TYPE_PAIEMENT_LABELS: Record<TypePaiement, string> = {
  attestation_cession: "Attestation de cession",
  signature_attribution_lot: "Signature attribution de lot",
  vente_terrain: "Vente de terrain",
  pass_marketplace: "Pass TerraCI Market",
  honoraires: "Honoraires",
  autre: "Autre",
};

type PaiementConfirme = {
  id: string;
  reference: string | null;
  type: TypePaiement;
  montant_total: number;
  commission_sgfn: number;
  confirme_le: string | null;
};
type Depense = { id: string; date_depense: string; categorie: CategorieDepense; description: string; montant: number };
type Apport = { id: string; date_apport: string; categorie: CategorieApport; description: string; montant: number };

const nf = new Intl.NumberFormat("fr-FR");
const fcfa = (n: number) => `${nf.format(Math.round(n))} F`;

/**
 * Tables du relevé. La colonne descriptive porte `w-full` pour absorber
 * l'espace libre — sans quoi le navigateur le répartit en creux au milieu du
 * tableau à l'impression. Mais `w-full` seul réduit les autres colonnes à leur
 * minimum et **colle les textes entre eux** (constaté sur rendu réel) : d'où la
 * gouttière explicite, retirée sur la dernière colonne pour garder les montants
 * alignés au bord.
 */
const TABLE_RELEVE =
  "w-full text-[13px] [&_th]:pr-5 [&_td]:pr-5 [&_th:last-child]:pr-0 [&_td:last-child]:pr-0 [&_.tabular]:whitespace-nowrap print:min-w-0 print:text-[11px]";

/** Clé de regroupement mensuel triable ("2026-07"), et son libellé ("juil. 2026"). */
function moisCle(iso: string) {
  return iso.slice(0, 7);
}
function moisLabel(cle: string) {
  const [annee, mois] = cle.split("-").map(Number);
  return new Date(annee, mois - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

const jour = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Section vide : illustration confortable à l'écran, mais une seule ligne sur
 * papier. Un `EmptyState` imprimé mange ~5 cm de feuille pour dire « rien » —
 * constaté sur le premier rendu réel du relevé.
 */
function SectionVide({ icon, title, description }: { icon: typeof Wallet; title: string; description: string }) {
  return (
    <>
      <div className="print:hidden">
        <EmptyState icon={icon} title={title} description={description} />
      </div>
      <p className="hidden text-[11px] text-muted-foreground italic print:block">{description}</p>
    </>
  );
}

/** `YYYY-MM-DD` local (pas UTC : `toISOString()` décale d'un jour selon le fuseau). */
function isoLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Raccourcis de période. `null` = borne ouverte (« Tout »). Les bornes sont
 * inclusives et comparées sur la tranche `YYYY-MM-DD` des dates, ce qui évite
 * de manipuler des fuseaux sur `confirme_le` (timestamp) vs `date_depense`
 * (date nue).
 */
function periodePreset(cle: "mois" | "trimestre" | "annee" | "tout"): { du: string; au: string } {
  const now = new Date();
  if (cle === "tout") return { du: "", au: "" };
  if (cle === "mois") {
    return { du: isoLocal(new Date(now.getFullYear(), now.getMonth(), 1)), au: isoLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }
  if (cle === "trimestre") {
    const t = Math.floor(now.getMonth() / 3);
    return { du: isoLocal(new Date(now.getFullYear(), t * 3, 1)), au: isoLocal(new Date(now.getFullYear(), t * 3 + 3, 0)) };
  }
  return { du: isoLocal(new Date(now.getFullYear(), 0, 1)), au: isoLocal(new Date(now.getFullYear(), 11, 31)) };
}

function ComptabiliteContenu() {
  const supabase = useMemo(() => createClient(), []);
  const { counts } = useBadgeCounts();

  const [paiements, setPaiements] = useState<PaiementConfirme[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [apports, setApports] = useState<Apport[]>([]);
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [modaleApportOuverte, setModaleApportOuverte] = useState(false);

  // ── Filtres du relevé (agissent sur l'écran ET sur l'impression) ──
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [postes, setPostes] = useState<Set<CategorieDepense>>(new Set(CATEGORIES));
  const [sections, setSections] = useState({ recettes: true, apports: true, depenses: true });

  const charger = useCallback(async () => {
    // `fetchAllPages` sur les trois tables : PostgREST plafonne chaque réponse à
    // 1000 lignes et tronque SILENCIEUSEMENT au-delà. Un relevé comptable
    // amputé sans avertissement serait pire qu'absent — c'est le seul écran où
    // un total faux se propage dans une décision de gestion.
    const [p, d, a] = await Promise.all([
      fetchAllPages<PaiementConfirme>((from, to) =>
        supabase
          .from("paiements")
          .select("id, reference, type, montant_total, commission_sgfn, confirme_le")
          .eq("statut", "confirme")
          .order("id", { ascending: true })
          .range(from, to),
      ),
      fetchAllPages<Depense>((from, to) =>
        supabase
          .from("depenses")
          .select("id, date_depense, categorie, description, montant")
          .order("id", { ascending: true })
          .range(from, to),
      ),
      fetchAllPages<Apport>((from, to) =>
        supabase
          .from("apports")
          .select("id, date_apport, categorie, description, montant")
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);
    // Tri d'affichage côté client : `fetchAllPages` impose un ordre déterministe
    // (la clé primaire) pour que les pages ne se chevauchent pas.
    setPaiements(p.sort((x, y) => (y.confirme_le ?? "").localeCompare(x.confirme_le ?? "")));
    setDepenses(d.sort((x, y) => y.date_depense.localeCompare(x.date_depense)));
    setApports(a.sort((x, y) => y.date_apport.localeCompare(x.date_apport)));
  }, [supabase]);

  const { isLoading: loading, recharger } = useChargement(charger, [charger]);

  const dansPeriode = useCallback(
    (iso: string | null) => {
      if (!iso) return false;
      const j = iso.slice(0, 10);
      if (du && j < du) return false;
      if (au && j > au) return false;
      return true;
    },
    [du, au],
  );

  const paiementsFiltres = useMemo(
    () => paiements.filter((p) => dansPeriode(p.confirme_le)),
    [paiements, dansPeriode],
  );
  const depensesFiltrees = useMemo(
    () => depenses.filter((d) => dansPeriode(d.date_depense) && postes.has(d.categorie)),
    [depenses, dansPeriode, postes],
  );
  const apportsFiltres = useMemo(
    () => apports.filter((a) => dansPeriode(a.date_apport)),
    [apports, dansPeriode],
  );

  // Une section décochée sort du relevé ET des totaux : le solde imprimé doit
  // toujours être la somme de ce que la feuille montre, sinon il est indéfendable.
  const recettesTotal = sections.recettes ? paiementsFiltres.reduce((s, p) => s + (p.commission_sgfn ?? 0), 0) : 0;
  const depensesTotal = sections.depenses ? depensesFiltrees.reduce((s, d) => s + (d.montant ?? 0), 0) : 0;
  const apportsTotal = sections.apports ? apportsFiltres.reduce((s, a) => s + (a.montant ?? 0), 0) : 0;
  const solde = recettesTotal + apportsTotal - depensesTotal;

  const filtreActif = Boolean(du || au) || postes.size !== CATEGORIES.length || !sections.recettes || !sections.apports || !sections.depenses;

  const libellePeriode = du && au ? `du ${jour(du)} au ${jour(au)}` : du ? `à partir du ${jour(du)}` : au ? `jusqu'au ${jour(au)}` : "toutes périodes";

  // ── Solde mensuel — sur les données filtrées, 12 mois max ──
  const parMois = useMemo(() => {
    const table = new Map<string, { recettes: number; apports: number; depenses: number }>();
    const touche = (cle: string) => table.get(cle) ?? { recettes: 0, apports: 0, depenses: 0 };
    if (sections.recettes) {
      for (const p of paiementsFiltres) {
        if (!p.confirme_le) continue;
        const cle = moisCle(p.confirme_le);
        const e = touche(cle);
        e.recettes += p.commission_sgfn ?? 0;
        table.set(cle, e);
      }
    }
    if (sections.apports) {
      for (const a of apportsFiltres) {
        const cle = moisCle(a.date_apport);
        const e = touche(cle);
        e.apports += a.montant ?? 0;
        table.set(cle, e);
      }
    }
    if (sections.depenses) {
      for (const d of depensesFiltrees) {
        const cle = moisCle(d.date_depense);
        const e = touche(cle);
        e.depenses += d.montant ?? 0;
        table.set(cle, e);
      }
    }
    return [...table.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12)
      .map(([cle, v]) => ({ cle, ...v, solde: v.recettes + v.apports - v.depenses }));
  }, [paiementsFiltres, apportsFiltres, depensesFiltrees, sections]);

  /** Récapitulatif des dépenses par poste — c'est la ventilation qu'on imprime. */
  const parPoste = useMemo(() => {
    const table = new Map<CategorieDepense, { total: number; nb: number }>();
    for (const d of depensesFiltrees) {
      const e = table.get(d.categorie) ?? { total: 0, nb: 0 };
      e.total += d.montant ?? 0;
      e.nb += 1;
      table.set(d.categorie, e);
    }
    return [...table.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [depensesFiltrees]);

  /** Récapitulatif des recettes par type d'acte. */
  const parType = useMemo(() => {
    const table = new Map<TypePaiement, { total: number; nb: number }>();
    for (const p of paiementsFiltres) {
      const e = table.get(p.type) ?? { total: 0, nb: 0 };
      e.total += p.commission_sgfn ?? 0;
      e.nb += 1;
      table.set(p.type, e);
    }
    return [...table.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [paiementsFiltres]);

  const basculerPoste = (c: CategorieDepense) => {
    setPostes((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const reinitialiser = () => {
    setDu("");
    setAu("");
    setPostes(new Set(CATEGORIES));
    setSections({ recettes: true, apports: true, depenses: true });
  };

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
        {/* En-tête d'écran */}
        <motion.div variants={fadeUp} className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:hidden">
          <div>
            <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
              Comptabilité
            </h1>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Recettes de commissions, apports et dépenses de la structure. Relevé imprimable.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <BoutonImprimer />
          </div>
        </motion.div>

        {/* En-tête du document imprimé — une feuille sortie d'ici doit se décrire
            elle-même : périmètre, filtres appliqués, date d'édition. */}
        <header className="hidden print:block">
          <h1 className="text-[19px] font-extrabold text-foreground">SGNF — Relevé comptable</h1>
          <p className="mt-1 text-[12px] text-foreground">
            Période : <strong>{libellePeriode}</strong>
            {postes.size !== CATEGORIES.length && (
              <>
                {" · "}Postes retenus : <strong>{[...postes].map((c) => CATEGORIE_LABELS[c]).join(", ") || "aucun"}</strong>
              </>
            )}
            {(!sections.recettes || !sections.apports || !sections.depenses) && (
              <>
                {" · "}Sections :{" "}
                <strong>
                  {[sections.recettes && "recettes", sections.apports && "apports", sections.depenses && "dépenses"]
                    .filter(Boolean)
                    .join(", ") || "aucune"}
                </strong>
              </>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Édité le {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} · Document
            interne, non opposable.
          </p>
          <hr className="mt-3 mb-1 border-border" />
        </header>

        {/* ── Filtres ── */}
        <motion.div variants={fadeUp} className="print:hidden">
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Du" htmlFor="filtre-du">
                  <Input id="filtre-du" type="date" value={du} onChange={(e: ChangeEvent<HTMLInputElement>) => setDu(e.target.value)} className="w-[170px]" />
                </Field>
                <Field label="Au" htmlFor="filtre-au">
                  <Input id="filtre-au" type="date" value={au} onChange={(e: ChangeEvent<HTMLInputElement>) => setAu(e.target.value)} className="w-[170px]" />
                </Field>
                <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
                  {([["mois", "Ce mois"], ["trimestre", "Ce trimestre"], ["annee", "Cette année"], ["tout", "Tout"]] as const).map(
                    ([cle, label]) => (
                      <Button
                        key={cle}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const p = periodePreset(cle);
                          setDu(p.du);
                          setAu(p.au);
                        }}
                      >
                        {label}
                      </Button>
                    ),
                  )}
                </div>
                {filtreActif && (
                  <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={reinitialiser}>
                    Réinitialiser
                  </Button>
                )}
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold tracking-wider text-muted-2 uppercase">Postes de dépenses</p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => {
                    const actif = postes.has(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={actif}
                        onClick={() => basculerPoste(c)}
                        className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                          actif
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {CATEGORIE_LABELS[c]}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setPostes(new Set(postes.size === CATEGORIES.length ? [] : CATEGORIES))}
                    className="rounded-full border border-dashed border-border px-3 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    {postes.size === CATEGORIES.length ? "Tout décocher" : "Tout cocher"}
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold tracking-wider text-muted-2 uppercase">Sections du relevé</p>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ["recettes", "Recettes"],
                      ["apports", "Apports"],
                      ["depenses", "Dépenses"],
                    ] as const
                  ).map(([cle, label]) => {
                    const actif = sections[cle];
                    return (
                      <button
                        key={cle}
                        type="button"
                        aria-pressed={actif}
                        onClick={() => setSections((prev) => ({ ...prev, [cle]: !prev[cle] }))}
                        className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                          actif
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ── KPI ── */}
        <motion.div variants={fadeUp} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
          <Kpi
            icon={HandCoins}
            label="Recettes"
            loading={loading}
            value={recettesTotal}
            format={fcfa}
            legende={sections.recettes ? `Part SGNF · ${paiementsFiltres.length} paiement${paiementsFiltres.length > 1 ? "s" : ""} · ${libellePeriode}` : "Section exclue du relevé"}
          />
          <Kpi
            icon={PiggyBank}
            label="Apports"
            loading={loading}
            value={apportsTotal}
            format={fcfa}
            legende={sections.apports ? `${apportsFiltres.length} apport${apportsFiltres.length > 1 ? "s" : ""} · hors chiffre d'affaires` : "Section exclue du relevé"}
          />
          <Kpi
            icon={Receipt}
            label="Dépenses"
            loading={loading}
            value={depensesTotal}
            format={fcfa}
            legende={sections.depenses ? `${depensesFiltrees.length} dépense${depensesFiltrees.length > 1 ? "s" : ""}${postes.size !== CATEGORIES.length ? ` · ${postes.size}/${CATEGORIES.length} postes` : ""}` : "Section exclue du relevé"}
          />
          <Kpi
            icon={Scale}
            label="Solde"
            loading={loading}
            value={solde}
            format={fcfa}
            tone={solde < 0 ? "warning" : "neutral"}
            legende="Recettes + apports − dépenses"
          />
        </motion.div>

        {/* ── Solde mensuel ── */}
        <motion.div variants={fadeUp}>
          <Card className="overflow-hidden print:break-inside-avoid print:border-none print:shadow-none">
            <CardHeader>
              <div>
                <CardTitle>Solde mensuel</CardTitle>
                <CardDescription>Mois comportant au moins un mouvement sur la période retenue (12 max).</CardDescription>
              </div>
            </CardHeader>
            <div className="px-5 pb-5 print:px-0">
              {loading ? (
                <Skeleton className="h-32" />
              ) : parMois.length === 0 ? (
                <SectionVide icon={Wallet} title="Aucun mouvement" description="Aucun mouvement sur la période et les postes retenus." />
              ) : (
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full min-w-[620px] text-[13px] print:min-w-0">
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
                    <tfoot>
                      <tr className="border-t-2 border-border text-[13px] font-bold">
                        <td className="pt-2.5 text-foreground">Total</td>
                        <td className="tabular pt-2.5 text-right text-success">{fcfa(recettesTotal)}</td>
                        <td className="tabular pt-2.5 text-right text-accent">{fcfa(apportsTotal)}</td>
                        <td className="tabular pt-2.5 text-right text-danger">{fcfa(depensesTotal)}</td>
                        <td className="tabular pt-2.5 text-right text-foreground">{fcfa(solde)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* ── Recettes détaillées ── */}
        {sections.recettes && (
          <motion.div variants={fadeUp}>
            <Card className="overflow-hidden print:break-inside-auto print:border-none print:shadow-none">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border px-5 py-4 print:px-0">
                <HandCoins className="size-4 text-primary print:hidden" aria-hidden />
                <h2 className="text-sm font-semibold text-foreground">Recettes ({paiementsFiltres.length})</h2>
                <span className="text-xs text-muted-foreground">
                  Part SGNF des paiements confirmés — jamais saisie, calculée depuis les paiements.
                </span>
              </div>
              <div className="px-5 pb-5 print:px-0">
                {loading ? (
                  <Skeleton className="h-40" />
                ) : paiementsFiltres.length === 0 ? (
                  <SectionVide icon={HandCoins} title="Aucune recette" description="Aucun paiement confirmé sur la période retenue." />
                ) : (
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className={`min-w-[720px] ${TABLE_RELEVE}`}>
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] font-bold tracking-wider text-muted-2 uppercase">
                          <th className="pb-2 font-bold">Date</th>
                          <th className="pb-2 font-bold">Référence</th>
                          {/* Colonne gourmande : sans elle, le navigateur répartit
                              l'espace libre en creux entre les colonnes à l'impression. */}
                          <th className="w-full pb-2 font-bold">Type d&apos;acte</th>
                          <th className="pb-2 text-right font-bold">Montant total</th>
                          <th className="pb-2 text-right font-bold">Part SGNF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paiementsFiltres.map((p) => (
                          <tr key={p.id} className="border-b border-border/60 last:border-0 print:break-inside-avoid">
                            <td className="tabular py-2.5 whitespace-nowrap text-muted-foreground">
                              {p.confirme_le ? jour(p.confirme_le) : "—"}
                            </td>
                            <td className="py-2.5 font-medium text-foreground">{p.reference ?? "—"}</td>
                            <td className="py-2.5 text-muted-foreground">{TYPE_PAIEMENT_LABELS[p.type]}</td>
                            <td className="tabular py-2.5 text-right text-muted-foreground">{fcfa(p.montant_total)}</td>
                            <td className="tabular py-2.5 text-right font-semibold text-success">{fcfa(p.commission_sgfn)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border font-bold">
                          <td className="pt-2.5 text-foreground" colSpan={4}>
                            Total recettes
                          </td>
                          <td className="tabular pt-2.5 text-right text-success">{fcfa(recettesTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {parType.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3 print:break-inside-avoid">
                    <p className="mb-2 text-[11px] font-bold tracking-wider text-muted-2 uppercase">Ventilation par type d&apos;acte</p>
                    <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 print:grid-cols-2">
                      {parType.map(([t, v]) => (
                        <li key={t} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                          <span className="text-muted-foreground">
                            {TYPE_PAIEMENT_LABELS[t]} <span className="text-muted-2">({v.nb})</span>
                          </span>
                          <span className="tabular font-semibold text-foreground">{fcfa(v.total)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* ── Dépenses ── */}
        {sections.depenses && (
          <motion.div variants={fadeUp}>
            <Card className="overflow-hidden print:break-inside-auto print:border-none print:shadow-none">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border px-5 py-4 print:px-0">
                <Receipt className="size-4 text-primary print:hidden" aria-hidden />
                <h2 className="text-sm font-semibold text-foreground">Dépenses ({depensesFiltrees.length})</h2>
                <Button variant="outline" size="sm" className="ml-auto shrink-0 print:hidden" onClick={() => setModaleOuverte(true)}>
                  <Plus className="size-4" />
                  Nouvelle dépense
                </Button>
              </div>
              <div className="px-5 pb-5 print:px-0">
                {loading ? (
                  <Skeleton className="h-40" />
                ) : depensesFiltrees.length === 0 ? (
                  <SectionVide
                    icon={Receipt}
                    title="Aucune dépense"
                    description={filtreActif ? "Aucune dépense sur la période et les postes retenus." : "Enregistrez la première dépense de la structure."}
                  />
                ) : (
                  <>
                    <div className="overflow-x-auto print:overflow-visible">
                      <table className={`min-w-[680px] ${TABLE_RELEVE}`}>
                        <thead>
                          <tr className="border-b border-border text-left text-[11px] font-bold tracking-wider text-muted-2 uppercase">
                            <th className="pb-2 font-bold">Date</th>
                            <th className="w-full pb-2 font-bold">Description</th>
                            <th className="pb-2 font-bold whitespace-nowrap">Poste</th>
                            <th className="pb-2 text-right font-bold">Montant</th>
                            <th className="pb-2 print:hidden" />
                          </tr>
                        </thead>
                        <tbody>
                          {depensesFiltrees.map((d) => (
                            <tr key={d.id} className="border-b border-border/60 last:border-0 print:break-inside-avoid">
                              <td className="tabular py-2.5 whitespace-nowrap text-muted-foreground">{jour(d.date_depense)}</td>
                              <td className="py-2.5 font-medium text-foreground">{d.description}</td>
                              <td className="py-2.5 whitespace-nowrap text-muted-foreground">{CATEGORIE_LABELS[d.categorie]}</td>
                              <td className="tabular py-2.5 text-right font-semibold text-danger">{fcfa(d.montant)}</td>
                              <td className="py-2.5 text-right print:hidden">
                                <Button variant="ghost" size="icon-sm" onClick={() => supprimerDepense(d)} title="Supprimer">
                                  <Trash2 className="size-4 text-danger" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-border font-bold">
                            <td className="pt-2.5 text-foreground" colSpan={3}>
                              Total dépenses
                            </td>
                            <td className="tabular pt-2.5 text-right text-danger">{fcfa(depensesTotal)}</td>
                            <td className="print:hidden" />
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="mt-4 border-t border-border pt-3 print:break-inside-avoid">
                      <p className="mb-2 text-[11px] font-bold tracking-wider text-muted-2 uppercase">Ventilation par poste</p>
                      <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 print:grid-cols-2">
                        {parPoste.map(([c, v]) => (
                          <li key={c} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                            <span className="text-muted-foreground">
                              {CATEGORIE_LABELS[c]} <span className="text-muted-2">({v.nb})</span>
                            </span>
                            <span className="tabular font-semibold text-foreground">{fcfa(v.total)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* ── Apports ── */}
        {sections.apports && (
          <motion.div variants={fadeUp}>
            <Card className="overflow-hidden print:break-inside-auto print:border-none print:shadow-none">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border px-5 py-4 print:px-0">
                <PiggyBank className="size-4 text-primary print:hidden" aria-hidden />
                <h2 className="text-sm font-semibold text-foreground">Apports ({apportsFiltres.length})</h2>
                <Button variant="outline" size="sm" className="ml-auto shrink-0 print:hidden" onClick={() => setModaleApportOuverte(true)}>
                  <Plus className="size-4" />
                  Nouvel apport
                </Button>
              </div>
              <div className="px-5 pb-5 print:px-0">
                {loading ? (
                  <Skeleton className="h-40" />
                ) : apportsFiltres.length === 0 ? (
                  <SectionVide
                    icon={PiggyBank}
                    title="Aucun apport"
                    description={
                      filtreActif
                        ? "Aucun apport sur la période retenue."
                        : "Enregistrez un apport en capital, un prêt associé ou une subvention reçus par la structure."
                    }
                  />
                ) : (
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className={`min-w-[680px] ${TABLE_RELEVE}`}>
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] font-bold tracking-wider text-muted-2 uppercase">
                          <th className="pb-2 font-bold">Date</th>
                          <th className="w-full pb-2 font-bold">Description</th>
                          <th className="pb-2 font-bold whitespace-nowrap">Nature</th>
                          <th className="pb-2 text-right font-bold">Montant</th>
                          <th className="pb-2 print:hidden" />
                        </tr>
                      </thead>
                      <tbody>
                        {apportsFiltres.map((a) => (
                          <tr key={a.id} className="border-b border-border/60 last:border-0 print:break-inside-avoid">
                            <td className="tabular py-2.5 whitespace-nowrap text-muted-foreground">{jour(a.date_apport)}</td>
                            <td className="py-2.5 font-medium text-foreground">{a.description}</td>
                            <td className="py-2.5 whitespace-nowrap text-muted-foreground">{CATEGORIE_APPORT_LABELS[a.categorie]}</td>
                            <td className="tabular py-2.5 text-right font-semibold text-accent">{fcfa(a.montant)}</td>
                            <td className="py-2.5 text-right print:hidden">
                              <Button variant="ghost" size="icon-sm" onClick={() => supprimerApport(a)} title="Supprimer">
                                <Trash2 className="size-4 text-danger" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border font-bold">
                          <td className="pt-2.5 text-foreground" colSpan={3}>
                            Total apports
                          </td>
                          <td className="tabular pt-2.5 text-right text-accent">{fcfa(apportsTotal)}</td>
                          <td className="print:hidden" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* ── Récapitulatif final — la ligne que le lecteur du relevé cherche ── */}
        <motion.div variants={fadeUp}>
          <Card className="overflow-hidden print:break-inside-avoid print:border print:shadow-none">
            <div className="flex flex-col gap-2 p-5 print:p-3">
              <p className="text-[11px] font-bold tracking-wider text-muted-2 uppercase">Récapitulatif — {libellePeriode}</p>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-4 print:grid-cols-4">
                <div className="flex flex-col">
                  <dt className="text-muted-foreground">Recettes</dt>
                  <dd className="tabular font-semibold text-success">{fcfa(recettesTotal)}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-muted-foreground">Apports</dt>
                  <dd className="tabular font-semibold text-accent">{fcfa(apportsTotal)}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-muted-foreground">Dépenses</dt>
                  <dd className="tabular font-semibold text-danger">{fcfa(depensesTotal)}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-muted-foreground">Solde</dt>
                  <dd className={`tabular text-[15px] font-extrabold ${solde < 0 ? "text-danger" : "text-foreground"}`}>
                    {fcfa(solde)}
                  </dd>
                </div>
              </dl>
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
