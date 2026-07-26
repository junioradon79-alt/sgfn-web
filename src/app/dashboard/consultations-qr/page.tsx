"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, Clock, QrCode, ShieldAlert, Wallet, XCircle } from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Kpi } from "@/components/ds/kpi";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { useProfile } from "@/hooks/useProfile";
import { createClient } from "@/utils/supabase/client";
import { fadeUp, stagger } from "@/lib/motion";
import { fmtMontantFCFA } from "@/lib/consultation-qr";

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

const STATUT_CONFIG: Record<string, { tone: "warning" | "success" | "danger" | "neutral"; label: string }> = {
  en_attente: { tone: "warning", label: "En attente" },
  initie: { tone: "warning", label: "Paiement initié" },
  payee: { tone: "success", label: "Payée" },
  echoue: { tone: "danger", label: "Échouée" },
  annulee: { tone: "neutral", label: "Annulée" },
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
  const supabase = useMemo(() => createClient(), []);
  const { loading: profilLoading, isAdmin } = useProfile();
  const { counts } = useBadgeCounts();

  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadConsultations = useCallback(async () => {
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
  }, [supabase]);

  const { isLoading: dataLoading, recharger } = useChargement(loadConsultations, [loadConsultations], isAdmin);

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
  const payees = consultations.filter((c) => c.statut === "payee");
  const recettes = payees.reduce((s, c) => s + (c.montant_total ?? 0), 0);
  const chargement = profilLoading || (dataLoading && isAdmin);

  // La page n'est plus responsable de sa propre coquille : même le refus
  // d'accès se rend dans `AppShell`, sinon l'utilisateur perd la navigation.
  if (!profilLoading && !isAdmin) {
    return (
      <AppShell loading={false} counts={counts} onRefresh={recharger}>
        <EmptyState
          icon={ShieldAlert}
          tone="pending"
          title="Accès réservé"
          description="Cette page est réservée aux administrateurs SGNF."
        />
      </AppShell>
    );
  }

  return (
    <AppShell loading={chargement} counts={counts} onRefresh={recharger}>
      <div>
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
          Consultations QR payantes
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Vérifications payantes d&apos;attestations de cession — {fmtMontantFCFA(60000)}, dont{" "}
          {fmtMontantFCFA(50000)} pour la chefferie et {fmtMontantFCFA(10000)} de commission SGNF.
        </p>
      </div>

      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-3"
        aria-label="Indicateurs des consultations payantes"
      >
        <Kpi
          icon={QrCode}
          label="Consultations"
          loading={chargement}
          value={consultations.length}
          legende={<>200 dernières demandes</>}
        />
        {/* Jumelle de la vue « À valider » des paiements, qui est en brique :
            chaque ligne comptée ici porte un bouton « Marquer payée » que
            personne d'autre ne cliquera. Seul signal de file de l'écran — le
            registre, lui, mêle tous les statuts et reste neutre. */}
        <Kpi
          icon={Clock}
          label="En attente de paiement"
          loading={chargement}
          value={enAttente}
          tone={!chargement && enAttente > 0 ? "alert" : "neutral"}
          legende={<>à valider au guichet</>}
        />
        <Kpi
          icon={Wallet}
          label="Recettes encaissées"
          loading={chargement}
          value={recettes}
          format={fmtMontantFCFA}
          legende={<>sur {payees.length} consultation{payees.length > 1 ? "s" : ""} payée{payees.length > 1 ? "s" : ""}</>}
        />
      </motion.section>

      {errorMessage && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger-subtle px-4 py-3 text-sm font-medium text-danger">
          {errorMessage}
        </p>
      )}

      {consultations.length === 0 ? (
        <Card>
          <EmptyState
            icon={QrCode}
            tone="positive"
            title="Aucune consultation payante"
            description="Aucune vérification payante d'attestation n'a encore été demandée."
          />
        </Card>
      ) : (
        <motion.div variants={stagger(0.05, 0.04)} initial="hidden" animate="show" className="flex flex-col gap-3">
          {consultations.map((c) => {
            const cfg = STATUT_CONFIG[c.statut] ?? STATUT_CONFIG.en_attente;
            const actionable = c.statut === "en_attente" || c.statut === "initie" || c.statut === "echoue";
            return (
              <motion.div key={c.id} variants={fadeUp}>
                <Card className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
                        <QrCode className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="font-mono tracking-wider">{c.code}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.reference_document} · {fmtMontantFCFA(c.montant_total)} · demandée le{" "}
                        {fmtDate(c.cree_le)}
                        {c.payee_le && <> · payée le {fmtDate(c.payee_le)}</>}
                      </p>
                      {c.reference_externe && (
                        <p className="mt-0.5 text-xs text-muted-2">{c.reference_externe}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={cfg.tone}>{cfg.label}</Badge>
                      {actionable && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-success hover:bg-success-subtle hover:text-success"
                            loading={updatingId === c.id}
                            onClick={() => changerStatut(c, "payee")}
                          >
                            <BadgeCheck />
                            Marquer payée
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={updatingId === c.id}
                            onClick={() => changerStatut(c, "annulee")}
                          >
                            <XCircle />
                            Annuler
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </AppShell>
  );
}
