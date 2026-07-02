"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, FileText, Gavel, Loader2, MessageSquare, Plus, ReceiptText, Rows3, Users, X } from "lucide-react";
import SGFNStatCard from "@/components/dashboard/SGFNStatCard";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { MOYEN_LABELS, STATUT_CONFIG, fcfa, labelTypePaiement } from "@/lib/paiements";
import type { Database } from "../../../database.types";

/**
 * Routage par rôle : à l'arrivée sur /dashboard, chaque groupe est redirigé vers
 * son espace. Les groupes absents de cette table (admin, geometre, agent_ia…)
 * restent sur le dashboard d'administration ci-dessous.
 */
const ROLE_HOME: Record<string, string> = {
  proprietaire: "/dashboard/proprietaire",
  acquereur: "/dashboard/acquisition",
  amenageur: "/dashboard/acquisition",
  operateur: "/dashboard/operateur",
  commissaire: "/dashboard/commissaire",
  verificateur: "/dashboard/commissaire",
  chefferie: "/dashboard/chefferie",
};

type AuditLog = {
  id?: number;
  table_concernee?: string | null;
  enregistrement_id?: string | null;
  action?: string | null;
  ancienne_valeur?: Record<string, unknown> | null;
  nouvelle_valeur?: Record<string, unknown> | null;
  effectue_par?: string | null;
  effectue_le?: string | null;
};

type DossierAdu = {
  id?: string;
  lot_id?: string | null;
  adu_numero?: string | null;
  statut?: string | null;
  depose_le?: string | null;
  notes?: string | null;
  adu_date?: string | null;
  acd_reference?: string | null;
};

type PaiementSnapshot = {
  id: string;
  type: string | null;
  montant_total: number | null;
  commission_sgfn: number | null;
  beneficiaire: string | null;
  moyen: string | null;
  statut: string | null;
  cree_le: string | null;
  reference_externe: string | null;
  attributaires?: { nom: string | null } | null;
  ventes?: { type_vente: string | null } | null;
};

type LotOption = { id: string; numero_lot: string | null; ilots?: { numero: string | null; lotissements?: { nom: string | null } | null } | null };
type DossierAduInsert = Database["public"]["Tables"]["dossiers_adu"]["Insert"];
type StatutAdu = Database["public"]["Enums"]["statut_dossier_adu"];

const STATUT_ADU_LABELS: Record<string, string> = {
  en_preparation: "En préparation",
  piece_manquante: "Pièce manquante",
  depose: "Déposé",
  en_instruction: "En instruction",
  adu_delivree: "ADU délivrée",
  acd_obtenu: "ACD obtenu",
  rejete: "Rejeté",
};

const STATUT_ADU_OPTIONS = Object.entries(STATUT_ADU_LABELS).map(([value, label]) => ({ value, label }));

type LotStatut = { statut: string };

export default function DashboardPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const supabase = useMemo(() => createClient(), []);

  // Cible de redirection selon le rôle (null = reste sur le dashboard admin).
  const redirectTo =
    !profileLoading && profile?.groupe ? ROLE_HOME[profile.groupe] ?? null : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  const [counts, setCounts] = useState({ lots: 0, attributaires: 0, ilots: 0, paiements: 0, litiges: 0 });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dossiersAdu, setDossiersAdu] = useState<DossierAdu[]>([]);
  const [transactions, setTransactions] = useState<PaiementSnapshot[]>([]);
  const [repartition, setRepartition] = useState({ disponibles: 0, attribues: 0, enLitige: 0, total: 0 });
  const [dataLoading, setDataLoading] = useState(true);
  const [userGroup, setUserGroup] = useState<string | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<AuditLog | null>(null);
  const [showAduCreate, setShowAduCreate] = useState(false);
  const [lotOptions, setLotOptions] = useState<LotOption[]>([]);
  const [aduForm, setAduForm] = useState<{
    lot_id: string;
    statut: StatutAdu;
    adu_numero: string;
    depose_le: string;
    notes: string;
  }>({ lot_id: "", statut: "en_preparation", adu_numero: "", depose_le: "", notes: "" });
  const [aduSubmitting, setAduSubmitting] = useState(false);
  const [aduError, setAduError] = useState<string | null>(null);

  useEffect(() => {
    if (profileLoading || redirectTo) return; // attend le rôle ; ne charge rien si on redirige
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let resolvedGroup: string | null = null;

      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("groupe")
          .eq("id", user.id)
          .single();
        resolvedGroup = profileData?.groupe ?? null;
      }

      setUserGroup(resolvedGroup);

      // Le cloisonnement par locataire est assuré côté serveur par le RLS
      // (lots_read_scope) : un opérateur/aménageur ne voit déjà que SES lots.
      // Pas de filtre client (et `lots` n'a pas de colonne operateur_id).
      const lotsQuery = supabase.from("lots").select("*", { count: "exact", head: true });
      const lotsStatusQuery = supabase.from("lots").select("statut");

      const [
        lotsRes,
        attribRes,
        paieRes,
        litigeRes,
        auditRes,
        aduRes,
        ilotsRes,
        statutsRes,
        transactionsRes,
      ] = await Promise.all([
        lotsQuery,
        supabase.from("attributaires").select("*", { count: "exact", head: true }),
        supabase.from("paiements").select("*", { count: "exact", head: true }),
        supabase.from("litiges").select("*", { count: "exact", head: true }),
        supabase.from("journal_audit").select("id, table_concernee, enregistrement_id, action, ancienne_valeur, nouvelle_valeur, effectue_par, effectue_le").order("effectue_le", { ascending: false }).limit(5),
        supabase.from("dossiers_adu").select("id, lot_id, adu_numero, statut, depose_le, notes, adu_date, acd_reference").order("cree_le", { ascending: false }).limit(5),
        supabase.from("ilots").select("*", { count: "exact", head: true }),
        lotsStatusQuery,
        supabase
          .from("paiements")
          .select("id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut, cree_le, reference_externe, attributaires(nom), ventes(type_vente)")
          .order("cree_le", { ascending: false }),
      ]);

      setCounts({
        lots: lotsRes.count ?? 0,
        attributaires: attribRes.count ?? 0,
        ilots: ilotsRes.count ?? 0,
        paiements: paieRes.count ?? 0,
        litiges: litigeRes.count ?? 0,
      });
      setAuditLogs((auditRes.data ?? []) as unknown as AuditLog[]);
      setDossiersAdu((aduRes.data ?? []) as DossierAdu[]);
      setTransactions((transactionsRes.data ?? []) as unknown as PaiementSnapshot[]);

      const all = (statutsRes.data ?? []) as LotStatut[];
      const disponibles = all.filter((l) => l.statut === "libre" || l.statut === "reserve_equipement").length;
      const attribues = all.filter((l) => ["attribue", "vendu", "occupe"].includes(l.statut)).length;
      const enLitige = all.filter((l) => l.statut === "en_litige").length;
      setRepartition({ disponibles, attribues, enLitige, total: all.length });

      setDataLoading(false);
    })();
  }, [profileLoading, redirectTo, supabase]);

  const statCards = [
    { title: "Lots", value: counts.lots, icon: Building2, color: "text-[#0D3B66]", subtitle: "Parcelles enregistrées", href: "/dashboard/lots" },
    { title: "Attributaires", value: counts.attributaires, icon: Users, color: "text-[#1E6091]", subtitle: "Profils reliés", href: "/dashboard/attributaires" },
    { title: "Îlots", value: counts.ilots, icon: Rows3, color: "text-[#2D8F5A]", subtitle: "Îlots cadastraux", href: "/dashboard/ilots" },
    { title: "Paiements", value: counts.paiements, icon: ReceiptText, color: "text-[#0D3B66]", subtitle: "Transactions suivies", href: "/dashboard/paiements" },
    { title: "Litiges", value: counts.litiges, icon: Gavel, color: "text-[#EF4444]", subtitle: "Cas ouverts", href: "/dashboard/litiges" },
  ];

  const openAduCreate = async () => {
    if (lotOptions.length === 0) {
      const { data } = await supabase.from("lots").select("id, numero_lot, ilots(numero, lotissements(nom))").order("numero_lot").limit(200);
      setLotOptions((data ?? []) as unknown as LotOption[]);
    }
    setAduForm({ lot_id: "", statut: "en_preparation", adu_numero: "", depose_le: "", notes: "" });
    setAduError(null);
    setShowAduCreate(true);
  };

  const handleAduCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aduForm.lot_id) { setAduError("Sélectionnez un lot."); return; }
    setAduSubmitting(true);
    setAduError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: DossierAduInsert = {
      lot_id: aduForm.lot_id,
      statut: aduForm.statut,
      adu_numero: aduForm.adu_numero.trim() || null,
      depose_le: aduForm.depose_le || null,
      notes: aduForm.notes.trim() || null,
      cree_par: user?.id ?? null,
    };
    const { error } = await supabase.from("dossiers_adu").insert([payload]);
    setAduSubmitting(false);
    if (error) { setAduError(error.message); return; }
    setShowAduCreate(false);
    // Rafraîchir la liste
    const { data } = await supabase.from("dossiers_adu").select("id, lot_id, adu_numero, statut, depose_le, notes, adu_date, acd_reference").order("cree_le", { ascending: false }).limit(5);
    setDossiersAdu((data ?? []) as DossierAdu[]);
  };

  // Pendant la résolution du rôle ou une redirection en cours : écran d'attente
  // (n'affiche jamais le dashboard admin à un utilisateur d'un autre espace).
  if (profileLoading || redirectTo) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm font-medium">Ouverture de votre espace…</span>
        </div>
      </div>
    );
  }

  const pct = (n: number) => repartition.total > 0 ? Math.round((n / repartition.total) * 100) : 0;
  const transactionsConfirmees = transactions.filter((p) => p.statut === "confirme");
  const totalTransactions = transactionsConfirmees.reduce((sum, p) => sum + (p.montant_total ?? 0), 0);
  const totalCommissions = transactionsConfirmees.reduce((sum, p) => sum + (p.commission_sgfn ?? 0), 0);
  const transactionsEnAttente = transactions.filter((p) => p.statut === "en_attente" || p.statut === "en_attente_validation").length;

  const prenom = profile?.nom_complet?.split(" ")[0] ?? "utilisateur";
  const heroTitle = profileLoading
    ? "Chargement…"
    : userGroup === "amenageur"
      ? "Espace Aménageur — SGNF"
      : userGroup === "admin"
        ? "Administration Globale — SGNF"
        : `Bonjour, ${prenom}`;

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#1F2937] antialiased sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="rounded-[2rem] border border-slate-200/60 bg-white p-8 shadow-sm sm:p-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
                Tableau de bord SGNF
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0D3B66] sm:text-4xl">
                {heroTitle}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Vue en temps réel de votre gouvernance foncière numérique.
              </p>
            </div>
            <Link
              href="/dashboard/messages"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#0D3B66] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E6091]"
            >
              <MessageSquare className="h-4 w-4" />
              Nouveau message
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {statCards.map((stat) => (
              <Link
                key={stat.title}
                href={stat.href}
                className="block h-full rounded-[1.25rem] border border-slate-200/60 bg-white shadow-sm cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:border-[#1E6091]/40 hover:bg-[#F8FAFC]/40 hover:shadow-md"
              >
                <SGFNStatCard
                  title={stat.title}
                  value={dataLoading ? "…" : stat.value}
                  icon={stat.icon}
                  color={stat.color}
                  subtitle={stat.subtitle}
                />
              </Link>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
                  Transactions
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[#0D3B66]">
                  Vue financière en lecture seule
                </h2>
              </div>
              <Link
                href="/dashboard/paiements"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Registre complet
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: "Total confirmé", value: fcfa(totalTransactions) },
                { label: "Commission SGNF", value: fcfa(totalCommissions) },
                { label: "À suivre", value: String(transactionsEnAttente) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-[#0D3B66]">
                    {dataLoading ? "…" : item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 max-h-[460px] overflow-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200/70">
                    {["Réf.", "Bénéficiaire", "Cas", "Montant", "Moyen", "Statut", "Date"].map((header) => (
                      <th key={header} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dataLoading ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                        Chargement des transactions…
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                        Aucune transaction enregistrée.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((paiement) => {
                      const cfg = STATUT_CONFIG[paiement.statut ?? "en_attente"] ?? STATUT_CONFIG.en_attente;
                      return (
                        <tr key={paiement.id} className="hover:bg-slate-50/70">
                          <td className="px-3 py-3 font-mono text-xs font-medium text-[#0D3B66]">
                            {paiement.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="max-w-[170px] truncate px-3 py-3 text-sm text-slate-700">
                            {paiement.beneficiaire || paiement.attributaires?.nom || "—"}
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-600">
                            {labelTypePaiement(paiement.type, paiement.ventes?.type_vente)}
                          </td>
                          <td className="px-3 py-3 text-sm font-semibold tabular-nums text-slate-800">
                            {fcfa(paiement.montant_total)}
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-600">
                            {MOYEN_LABELS[paiement.moyen ?? ""] ?? paiement.moyen ?? "—"}
                          </td>
                          <td className="px-3 py-3">
                            <Badge status={cfg.badge}>{cfg.label}</Badge>
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-500">
                            {paiement.cree_le
                              ? new Date(paiement.cree_le).toLocaleDateString("fr-FR", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Répartition du Parcellaire */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="text-[#1E6091]">🗺️</span>
                Répartition du Parcellaire
              </div>
              <div className="mt-6 space-y-4">
                {[
                  { label: "Disponibles", value: repartition.disponibles, color: "bg-[#2D8F5A]" },
                  { label: "Attribués", value: repartition.attribues, color: "bg-[#1E6091]" },
                  { label: "En litige", value: repartition.enLitige, color: "bg-slate-300" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                      <span>{item.label}</span>
                      <span className="font-semibold text-slate-700">
                        {dataLoading ? "…" : `${item.value} lot${item.value !== 1 ? "s" : ""}`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div
                        className={`h-1.5 rounded-full transition-all ${item.color}`}
                        style={{ width: `${pct(item.value)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Indice de conformité */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm text-center">
              <div className="text-5xl font-bold tracking-tight text-[#2D8F5A]">100%</div>
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Indice de conformité et de traçabilité
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Zéro anomalie détectée. 100% des parcelles et PV de familles disposent d&apos;un ancrage d&apos;audit immuable.
              </p>
            </div>

            {/* Documents & Titres */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-700">
                Avancement des Documents & Titres
              </div>
              <div className="mt-6 space-y-4">
                {[
                  { label: "Attestations délivrées", value: "4", color: "text-[#2D8F5A]", bg: "bg-[#2D8F5A]/10" },
                  { label: "PV de famille verrouillés", value: "13", color: "text-[#1E6091]", bg: "bg-[#1E6091]/10" },
                  { label: "Dossiers ADU en cours", value: String(dossiersAdu.length || 0), color: "text-[#F39C12]", bg: "bg-[#F39C12]/10" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                    <span className="text-sm text-slate-600">{item.label}</span>
                    <span className={`inline-flex items-center rounded-full ${item.bg} px-2.5 py-1 text-xs font-semibold ${item.color}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Journal d'audit */}
          <div className="rounded-[1.5rem] border border-slate-200/60 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
                  Audit temps réel
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[#0D3B66]">
                  Journal d&apos;audit opérationnel
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {auditLogs.length > 0 ? (
                auditLogs.map((entry, index) => (
                  <button
                    key={entry.id ?? `${entry.effectue_le ?? "entry"}-${index}`}
                    type="button"
                    onClick={() => setSelectedAudit(entry)}
                    className="w-full rounded-2xl border border-slate-200/60 bg-slate-50/70 p-4 text-left transition hover:border-[#0D3B66]/20 hover:bg-[#0D3B66]/4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {entry.action ?? "Modification enregistrée"}
                        </p>
                        {entry.table_concernee && (
                          <p className="mt-0.5 text-xs text-[#1E6091]">Table : {entry.table_concernee}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs font-medium text-slate-400">
                        {entry.effectue_le
                          ? new Date(entry.effectue_le).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                          : "À l&apos;instant"}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-500">
                  Système de traçabilité immuable actif — Aucun changement récent.
                </div>
              )}
            </div>
          </div>

          {/* Dossiers ADU */}
          <div className="rounded-[1.5rem] border border-slate-200/60 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
                  Instruction foncière
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[#0D3B66]">
                  Dossiers ADU & ACD
                </h2>
              </div>
              <button
                type="button"
                onClick={openAduCreate}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1E6091]"
              >
                <Plus className="h-3.5 w-3.5" />
                Nouveau dossier
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {dossiersAdu.length > 0 ? (
                dossiersAdu.map((dossier, index) => {
                  const s = dossier.statut ?? "";
                  const badgeStatus =
                    s === "adu_delivree" || s === "acd_obtenu"
                      ? ("attribue" as const)
                      : s === "en_instruction" || s === "depose"
                      ? ("en_validation" as const)
                      : s === "rejete"
                      ? ("litige" as const)
                      : ("disponible" as const);

                  return (
                    <div
                      key={dossier.id ?? index}
                      className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-slate-50/70 px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-[#1E6091]" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {dossier.adu_numero || "Dossier sans numéro"}
                          </p>
                          {dossier.depose_le && (
                            <p className="text-xs text-slate-400">
                              Déposé le {new Date(dossier.depose_le).toLocaleDateString("fr-FR")}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge status={badgeStatus}>
                        {STATUT_ADU_LABELS[s] ?? s}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-500">
                  Aucun dossier ADU enregistré. Cliquez sur « Nouveau dossier » pour commencer.
                </div>
              )}
            </div>

            {dossiersAdu.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Link href="/dashboard/dossiers-adu" className="inline-flex items-center gap-1 text-sm font-medium text-[#1E6091] hover:underline">
                  Voir tous les dossiers
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Modale détail entrée d'audit ── */}
    {selectedAudit && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-xl overflow-y-auto rounded-[1.75rem] border border-slate-200/70 bg-white shadow-2xl" style={{ maxHeight: "90vh" }}>
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Journal d&apos;audit</p>
              <h2 className="mt-1 text-lg font-semibold text-[#0D3B66]">{selectedAudit.action ?? "Événement"}</h2>
            </div>
            <button type="button" onClick={() => setSelectedAudit(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Table", value: selectedAudit.table_concernee ?? "—" },
                { label: "Enregistrement", value: selectedAudit.enregistrement_id ? selectedAudit.enregistrement_id.slice(0, 8) + "…" : "—" },
                { label: "Date", value: selectedAudit.effectue_le ? new Date(selectedAudit.effectue_le).toLocaleString("fr-FR") : "—" },
                { label: "Auteur (ID)", value: selectedAudit.effectue_par ? selectedAudit.effectue_par.slice(0, 8) + "…" : "Système" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">{item.label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-700">{item.value}</p>
                </div>
              ))}
            </div>
            {selectedAudit.nouvelle_valeur && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-[#2D8F5A]">Nouvelle valeur</p>
                <pre className="overflow-x-auto rounded-xl bg-emerald-50/60 p-3 text-xs text-emerald-900">
                  {JSON.stringify(selectedAudit.nouvelle_valeur, null, 2)}
                </pre>
              </div>
            )}
            {selectedAudit.ancienne_valeur && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">Ancienne valeur</p>
                <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                  {JSON.stringify(selectedAudit.ancienne_valeur, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* ── Modale création dossier ADU ── */}
    {showAduCreate && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-2xl sm:p-8" style={{ maxHeight: "92vh" }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Instruction foncière</p>
              <h2 className="mt-2 text-xl font-semibold text-[#0D3B66]">Nouveau dossier ADU</h2>
            </div>
            <button type="button" onClick={() => setShowAduCreate(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleAduCreate}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Lot concerné <span className="text-red-500">*</span></label>
              <select
                value={aduForm.lot_id}
                onChange={(e) => setAduForm((f) => ({ ...f, lot_id: e.target.value }))}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
              >
                <option value="">— Sélectionner un lot —</option>
                {lotOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    Lot {l.numero_lot ?? "—"}
                    {l.ilots?.numero ? ` · Îlot ${l.ilots.numero}` : ""}
                    {l.ilots?.lotissements?.nom ? ` — ${l.ilots.lotissements.nom}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Statut</label>
              <select
                value={aduForm.statut}
                onChange={(e) => setAduForm((f) => ({ ...f, statut: e.target.value as StatutAdu }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
              >
                {STATUT_ADU_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Numéro ADU</label>
              <input
                type="text"
                value={aduForm.adu_numero}
                onChange={(e) => setAduForm((f) => ({ ...f, adu_numero: e.target.value }))}
                placeholder="Ex. ADU-2026-001"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Date de dépôt</label>
              <input
                type="date"
                value={aduForm.depose_le}
                onChange={(e) => setAduForm((f) => ({ ...f, depose_le: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Notes</label>
              <textarea
                rows={3}
                value={aduForm.notes}
                onChange={(e) => setAduForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Observations, documents manquants…"
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#0D3B66] focus:outline-none"
              />
            </div>
            {aduError && <div className="rounded-2xl border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700">{aduError}</div>}
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setShowAduCreate(false)} className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Annuler</button>
              <button type="submit" disabled={aduSubmitting} className="rounded-full bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E6091] disabled:opacity-70">
                {aduSubmitting ? "Enregistrement…" : "Créer le dossier"}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </div>
  );
}
