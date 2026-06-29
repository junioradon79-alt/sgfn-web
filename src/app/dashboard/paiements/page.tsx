"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";
import { Banknote, Clock, Receipt, TrendingUp } from "lucide-react";

type PaiementRecord = {
  id: string;
  type: string | null;
  montant_total: number | null;
  commission_sgfn: number | null;
  beneficiaire: string | null;
  moyen: string | null;
  statut: string | null;
  cree_le: string | null;
  acquereur_id: string | null;
  attributaires?: { nom: string | null } | null;
};

const STATUT_CONFIG: Record<string, { badge: "disponible" | "attribue" | "en_validation" | "litige"; label: string }> = {
  confirme: { badge: "attribue", label: "Confirmé" },
  en_attente: { badge: "en_validation", label: "En attente" },
  echoue: { badge: "litige", label: "Échoué" },
  rembourse: { badge: "disponible", label: "Remboursé" },
};

const TYPE_LABELS: Record<string, string> = {
  attestation_cession: "Attestation cession",
  honoraires: "Honoraires",
  vente_terrain: "Vente terrain",
  autre: "Autre",
};

const MOYEN_LABELS: Record<string, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  mtn_money: "MTN Money",
  moov_money: "Moov Money",
  virement: "Virement",
  especes: "Espèces",
  autre: "Autre",
};

const TABLE_HEADERS = ["Réf.", "Bénéficiaire", "Type", "Montant", "Moyen", "Statut", "Date"] as const;

const fcfa = (n: number | null) =>
  `${new Intl.NumberFormat("fr-FR").format(Math.round(n ?? 0))} FCFA`;

export default function PaiementsPage() {
  const supabase = createClient();

  const [paiements, setPaiements] = useState<PaiementRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const loadPaiements = async () => {
    setDataLoading(true);
    const { data } = await supabase
      .from("paiements")
      .select("id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut, cree_le, acquereur_id, attributaires(nom)")
      .order("cree_le", { ascending: false });
    setPaiements((data ?? []) as unknown as PaiementRecord[]);
    setDataLoading(false);
  };

  useEffect(() => {
    void loadPaiements();
  }, []);

  const confirmes = paiements.filter((p) => p.statut === "confirme");
  const totalEncaisse = confirmes.reduce((s, p) => s + (p.montant_total ?? 0), 0);
  const totalCommission = confirmes.reduce((s, p) => s + (p.commission_sgfn ?? 0), 0);
  const enAttente = paiements.filter((p) => p.statut === "en_attente").length;

  return (
    <div className="mx-auto max-w-6xl">
      {/* En-tête */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-primary">
            Suivi des Paiements
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Traçabilité des transactions, honoraires et commissions de la plateforme.{" "}
            <span className={enAttente > 0 ? "font-medium text-[#F39C12]" : "font-medium text-[#2D8F5A]"}>
              {enAttente} en attente.
            </span>
          </p>
        </div>
      </div>

      {/* KPI */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Total encaissé", value: fcfa(totalEncaisse), icon: <Banknote className="h-4 w-4 text-[#2D8F5A]" /> },
          { label: "Commission SGFN", value: fcfa(totalCommission), icon: <TrendingUp className="h-4 w-4 text-[#0D3B66]" /> },
          { label: "Paiements en attente", value: String(enAttente), icon: <Clock className="h-4 w-4 text-[#F39C12]" /> },
        ].map((metric) => (
          <div key={metric.label} className="rounded-xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{metric.label}</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F8FAFC]">
                {metric.icon}
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-[#0D3B66]">
              {dataLoading ? "…" : metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
        <div className="border-b border-slate-200/60 bg-slate-50/50 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Registre des transactions
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/50">
                {TABLE_HEADERS.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {dataLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                    Chargement des paiements…
                  </td>
                </tr>
              ) : paiements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="h-6 w-6 text-slate-300" />
                      Aucun paiement enregistré.
                    </div>
                  </td>
                </tr>
              ) : (
                paiements.map((p) => {
                  const cfg = STATUT_CONFIG[p.statut ?? "en_attente"] ?? STATUT_CONFIG.en_attente;
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-4 font-mono text-xs font-medium text-[#0D3B66]">
                        {p.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="max-w-[200px] truncate px-5 py-4 text-sm text-slate-700">
                        {p.beneficiaire || p.attributaires?.nom || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {TYPE_LABELS[p.type ?? ""] ?? p.type ?? "—"}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold tabular-nums text-slate-800">
                        {fcfa(p.montant_total)}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {MOYEN_LABELS[p.moyen ?? ""] ?? p.moyen ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <Badge status={cfg.badge}>{cfg.label}</Badge>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {p.cree_le
                          ? new Date(p.cree_le).toLocaleDateString("fr-FR", {
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
    </div>
  );
}
