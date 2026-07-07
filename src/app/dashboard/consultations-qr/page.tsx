"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { fmtMontantFCFA } from "@/lib/consultation-qr";
import { BadgeCheck, QrCode, ShieldAlert, XCircle } from "lucide-react";

type ConsultationRecord = {
  id: string;
  code: string;
  reference_document: string;
  type_document: string;
  montant_total: number;
  part_chefferie: number;
  commission_sgnf: number;
  statut: string;
  reference_externe: string | null;
  payee_le: string | null;
  cree_le: string;
};

const STATUT_CONFIG: Record<string, { badge: "en_validation" | "attribue" | "disponible" | "litige" | "neutre"; label: string }> = {
  en_attente: { badge: "en_validation", label: "En attente" },
  initie: { badge: "en_validation", label: "Paiement initié" },
  payee: { badge: "disponible", label: "Payée" },
  echoue: { badge: "litige", label: "Échouée" },
  annulee: { badge: "neutre", label: "Annulée" },
};

function fmtDate(v: string): string {
  return new Date(v).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConsultationsQrPage() {
  const supabase = createClient();
  const { loading: profilLoading, isAdmin } = useProfile();

  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadConsultations = useCallback(async () => {
    setDataLoading(true);
    const { data, error } = await supabase
      .from("consultations_qr")
      .select(
        "id, code, reference_document, type_document, montant_total, part_chefferie, commission_sgnf, statut, reference_externe, payee_le, cree_le",
      )
      .order("cree_le", { ascending: false })
      .limit(200);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setConsultations((data ?? []) as ConsultationRecord[]);
    }
    setDataLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (isAdmin) void loadConsultations();
  }, [isAdmin, loadConsultations]);

  const changerStatut = async (c: ConsultationRecord, statut: "payee" | "annulee") => {
    setUpdatingId(c.id);
    setErrorMessage(null);
    const maj =
      statut === "payee"
        ? {
            statut,
            payee_le: new Date().toISOString(),
            reference_externe: c.reference_externe ?? "paiement manuel (guichet)",
          }
        : { statut };
    const { error } = await supabase.from("consultations_qr").update(maj).eq("id", c.id);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setConsultations((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...maj } : x)));
    }
    setUpdatingId(null);
  };

  const enAttente = consultations.filter((c) => c.statut === "en_attente" || c.statut === "initie").length;

  if (profilLoading || (dataLoading && isAdmin)) {
    return <div className="py-20 text-center text-sm text-slate-500">Chargement…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <p className="mt-4 text-sm text-slate-600">
          Cette page est réservée aux administrateurs SGNF.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-brand-primary">
          Consultations QR payantes
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Vérifications payantes d&apos;attestations de cession ({fmtMontantFCFA(60000)} — dont{" "}
          {fmtMontantFCFA(50000)} pour la chefferie et {fmtMontantFCFA(10000)} de commission SGNF).{" "}
          <span className={enAttente > 0 ? "font-medium text-[#F39C12]" : "font-medium text-[#2D8F5A]"}>
            {enAttente} en attente de paiement.
          </span>
        </p>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-2xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {consultations.length === 0 ? (
        <div className="rounded-xl border border-slate-200/60 bg-white px-5 py-16 text-center text-sm text-slate-500">
          Aucune consultation payante pour le moment.
        </div>
      ) : (
        <div className="space-y-4">
          {consultations.map((c) => {
            const cfg = STATUT_CONFIG[c.statut] ?? STATUT_CONFIG.en_attente;
            const actionable = c.statut === "en_attente" || c.statut === "initie" || c.statut === "echoue";
            return (
              <div key={c.id} className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-[#0D3B66]">
                      <QrCode className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="font-mono tracking-wider">{c.code}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {c.reference_document} · {fmtMontantFCFA(c.montant_total)} · demandée le{" "}
                      {fmtDate(c.cree_le)}
                      {c.payee_le && <> · payée le {fmtDate(c.payee_le)}</>}
                    </p>
                    {c.reference_externe && (
                      <p className="mt-0.5 text-xs text-slate-400">{c.reference_externe}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={cfg.badge}>{cfg.label}</Badge>
                    {actionable && (
                      <>
                        <button
                          type="button"
                          disabled={updatingId === c.id}
                          onClick={() => changerStatut(c, "payee")}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D8F5A]/10 px-3 py-1.5 text-xs font-semibold text-[#2D8F5A] transition hover:bg-[#2D8F5A]/20 disabled:opacity-50"
                        >
                          <BadgeCheck className="h-3.5 w-3.5" />
                          Marquer payée
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === c.id}
                          onClick={() => changerStatut(c, "annulee")}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-200 disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Annuler
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
