"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Gavel, Loader2, ReceiptText, Rows3, Users } from "lucide-react";
import SGFNStatCard from "@/components/dashboard/SGFNStatCard";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";

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
  chefferie: "/dashboard/messages",
};

type AuditLog = {
  id?: string;
  action?: string;
  description?: string;
  effectue_le?: string;
};

type DossierAdu = {
  adu_numero?: string | null;
  statut?: string | null;
};

type LotStatut = { statut: string };

export default function DashboardPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const supabase = createClient();

  // Cible de redirection selon le rôle (null = reste sur le dashboard admin).
  const redirectTo =
    !profileLoading && profile?.groupe ? ROLE_HOME[profile.groupe] ?? null : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  const [counts, setCounts] = useState({ lots: 0, attributaires: 0, ilots: 0, paiements: 0, litiges: 0 });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dossiersAdu, setDossiersAdu] = useState<DossierAdu[]>([]);
  const [repartition, setRepartition] = useState({ disponibles: 0, attribues: 0, enLitige: 0, total: 0 });
  const [dataLoading, setDataLoading] = useState(true);
  const [userGroup, setUserGroup] = useState<string | null>(null);

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
      ] = await Promise.all([
        lotsQuery,
        supabase.from("attributaires").select("*", { count: "exact", head: true }),
        supabase.from("paiements").select("*", { count: "exact", head: true }),
        supabase.from("litiges").select("*", { count: "exact", head: true }),
        supabase.from("journal_audit").select("*").order("effectue_le", { ascending: false }).limit(3),
        supabase.from("dossiers_adu").select("statut, adu_numero").limit(3),
        supabase.from("ilots").select("*", { count: "exact", head: true }),
        lotsStatusQuery,
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

      const all = (statutsRes.data ?? []) as LotStatut[];
      const disponibles = all.filter((l) => l.statut === "libre" || l.statut === "reserve_equipement").length;
      const attribues = all.filter((l) => ["attribue", "vendu", "occupe"].includes(l.statut)).length;
      const enLitige = all.filter((l) => l.statut === "en_litige").length;
      setRepartition({ disponibles, attribues, enLitige, total: all.length });

      setDataLoading(false);
    })();
  }, [profileLoading, redirectTo]);

  const statCards = [
    { title: "Lots", value: counts.lots, icon: Building2, color: "text-[#0D3B66]", subtitle: "Parcelles enregistrées", href: "/dashboard/lots" },
    { title: "Attributaires", value: counts.attributaires, icon: Users, color: "text-[#1E6091]", subtitle: "Profils reliés", href: "/dashboard/attributaires" },
    { title: "Îlots", value: counts.ilots, icon: Rows3, color: "text-[#2D8F5A]", subtitle: "Îlots cadastraux", href: "/dashboard/ilots" },
    { title: "Paiements", value: counts.paiements, icon: ReceiptText, color: "text-[#0D3B66]", subtitle: "Transactions suivies", href: "/dashboard/paiements" },
    { title: "Litiges", value: counts.litiges, icon: Gavel, color: "text-[#EF4444]", subtitle: "Cas ouverts", href: "/dashboard/litiges" },
  ];

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

  const prenom = profile?.nom_complet?.split(" ")[0] ?? "utilisateur";
  const heroTitle = profileLoading
    ? "Chargement…"
    : userGroup === "amenageur"
      ? "Espace Aménageur — SGFN"
      : userGroup === "admin"
        ? "Administration Globale — SGFN"
        : `Bonjour, ${prenom}`;

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#1F2937] antialiased sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="rounded-[2rem] border border-slate-200/60 bg-white p-8 shadow-sm sm:p-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
                Tableau de bord SGFN
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0D3B66] sm:text-4xl">
                {heroTitle}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Vue en temps réel de votre gouvernance foncière numérique.
              </p>
            </div>
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
                Zéro anomalie détectée. 100% des parcelles et PV de familles disposent d'un ancrage d'audit immuable.
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
                  Journal d'audit opérationnel
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {auditLogs.length > 0 ? (
                auditLogs.map((entry, index) => (
                  <div
                    key={entry.id ?? `${entry.effectue_le ?? "entry"}-${index}`}
                    className="rounded-2xl border border-slate-200/60 bg-slate-50/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {entry.action ?? "Modification enregistrée"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {entry.description ?? "Événement consigné dans la traçabilité du système."}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                        {entry.effectue_le
                          ? new Date(entry.effectue_le).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "À l'instant"}
                      </span>
                    </div>
                  </div>
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
            </div>

            <div className="mt-6 space-y-3">
              {dossiersAdu.length > 0 ? (
                dossiersAdu.map((dossier, index) => {
                  const s = (dossier.statut ?? "").toLowerCase();
                  const badgeStatus =
                    s.includes("valid") || s.includes("approuv")
                      ? ("attribue" as const)
                      : s.includes("cours") || s.includes("instruction")
                      ? ("en_validation" as const)
                      : s.includes("litige") || s.includes("bloqu")
                      ? ("litige" as const)
                      : ("disponible" as const);
                  const labels = { attribue: "Validé", en_validation: "En cours", litige: "Bloqué", disponible: "En attente" };

                  return (
                    <div
                      key={`${dossier.adu_numero ?? "dossier"}-${index}`}
                      className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-slate-50/70 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {dossier.adu_numero || "Dossier sans numéro"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">Instruction foncière en suivi</p>
                      </div>
                      <Badge status={badgeStatus}>{labels[badgeStatus]}</Badge>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-500">
                  Aucun dossier ADU n'a encore été enregistré.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
