"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  CreditCard,
  Download,
  FileCheck2,
  Landmark,
  ListChecks,
  MapPin,
  MessageSquare,
  Store,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import KpiCard from "@/components/dashboard/KpiCard";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";

/**
 * Espace Propriétaire — vue personnelle d'un ayant-droit / acquéreur sur ses
 * lots, attestations, paiements et démarches. Le RLS Supabase filtre déjà tout
 * sur le profil connecté : aucune clause `.eq()` explicite n'est nécessaire.
 * Porté depuis le prototype `sgfn_espace_client_2.html`.
 */

const QUALITE_LABELS: Record<string, string> = {
  ayant_droit: "Propriétaire terrien",
  ayant_droit_transmission: "Propriétaire terrien (transmission)",
  acquereur: "Acquéreur",
  operateur: "Opérateur",
  entrepreneur: "Entrepreneur",
  reservataire: "Réservataire",
};

const STATUT_LOT: Record<string, { badge: "disponible" | "attribue" | "en_validation" | "litige"; label: string }> = {
  attribue: { badge: "attribue", label: "Attribué" },
  occupe: { badge: "attribue", label: "Occupé" },
  vendu: { badge: "attribue", label: "Vendu" },
  libre: { badge: "disponible", label: "Libre" },
  en_litige: { badge: "litige", label: "Litige" },
  reserve_equipement: { badge: "en_validation", label: "Réservé" },
};

type AttributionRow = {
  lot_id: string;
  qualite: string | null;
  actuel: boolean | null;
  lots: {
    numero_lot: string | number | null;
    statut: string | null;
    ilots: {
      numero: string | number | null;
      lotissements: { nom: string | null; village: string | null; commune: string | null } | null;
    } | null;
  } | null;
};

type AttestationRow = {
  reference: string;
  statut: string | null;
  date_emission: string | null;
  lot_id: string;
  cession_id: string | null;
};

type PaiementRow = {
  id: string;
  montant_total: number | null;
  statut: string | null;
  moyen: string | null;
  cree_le: string | null;
  cession_id: string | null;
  acquereur_id: string | null;
};

type DemarcheRow = {
  id: string;
  type: string | null;
  statut: string | null;
  description: string | null;
  ouverte_le: string | null;
  terminee_le: string | null;
  montant_honoraires: number | null;
};

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "—";

const fcfa = (n: number | null) =>
  n == null ? "—" : `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`;

export default function EspaceProprietairePage() {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useProfile();

  const [attributions, setAttributions] = useState<AttributionRow[]>([]);
  const [attestations, setAttestations] = useState<AttestationRow[]>([]);
  const [paiements, setPaiements] = useState<PaiementRow[]>([]);
  const [demarches, setDemarches] = useState<DemarcheRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dlState, setDlState] = useState<Record<string, "idle" | "loading" | "error">>({});
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [attr, att, pai, dem] = await Promise.all([
        supabase
          .from("attributions")
          .select(
            "lot_id, qualite, actuel, lots(numero_lot, statut, ilots(numero, lotissements(nom, village, commune)))"
          )
          .eq("actuel", true),
        supabase
          .from("attestations_cession")
          .select("reference, statut, date_emission, lot_id, cession_id"),
        supabase
          .from("paiements")
          .select("id, montant_total, statut, moyen, cree_le, cession_id, acquereur_id")
          .order("cree_le", { ascending: false }),
        supabase
          .from("demarches")
          .select("id, type, statut, description, ouverte_le, terminee_le, montant_honoraires")
          .order("ouverte_le", { ascending: false }),
      ]);

      setAttributions(((attr.data ?? []) as unknown as AttributionRow[]).filter((a) => a.lots));
      setAttestations((att.data ?? []) as unknown as AttestationRow[]);
      setPaiements((pai.data ?? []) as unknown as PaiementRow[]);
      setDemarches((dem.data ?? []) as unknown as DemarcheRow[]);
      setLoading(false);
    })();
  }, [supabase]);

  const telecharger = async (reference: string) => {
    setDlState((s) => ({ ...s, [reference]: "loading" }));
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/telecharger-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ table: "attestations_cession", reference }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.erreur || "Téléchargement impossible");
      window.open(json.url, "_blank");
      setDlState((s) => ({ ...s, [reference]: "idle" }));
    } catch {
      setDlState((s) => ({ ...s, [reference]: "error" }));
      setTimeout(() => setDlState((s) => ({ ...s, [reference]: "idle" })), 2500);
    }
  };

  const handlePayer = async (p: PaiementRow) => {
    setPayingId(p.id);
    setPayError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setPayingId(null); return; }

    const res = await supabase.functions.invoke("initier-paiement", {
      body: { paiement_id: p.id },
    });

    if (res.error || res.data?.error) {
      setPayError(res.data?.error ?? "Erreur lors de l'initialisation du paiement.");
      setPayingId(null);
      return;
    }

    window.location.assign(res.data.payment_url);
  };

  const nbAttDelivrees = attestations.filter((a) => a.statut === "delivree").length;
  const nbDemarchesOuvertes = demarches.filter((d) => !d.terminee_le).length;
  const totalPaye = paiements
    .filter((p) => p.statut === "confirme")
    .reduce((s, p) => s + (p.montant_total ?? 0), 0);
  const paiementsAPayer = paiements.filter(
    (p) => p.statut === "en_attente" && p.acquereur_id === profile?.attributaire_id
  );

  const kpis: { label: string; value: string | number; icon: typeof Landmark; gradient: [string, string] }[] = [
    { label: "Lots détenus", value: attributions.length, icon: Landmark, gradient: ["#1E6091", "#4FA8D8"] },
    { label: "Attestations délivrées", value: nbAttDelivrees, icon: FileCheck2, gradient: ["#16A34A", "#4ADE80"] },
    { label: "Démarches en cours", value: nbDemarchesOuvertes, icon: ListChecks, gradient: ["#D97706", "#FBBF24"] },
    { label: "Total payé", value: fcfa(totalPaye), icon: Banknote, gradient: ["#2D8F5A", "#5FBF8A"] },
  ];

  const prenom = profile?.nom_complet?.split(" ")[0] ?? "";

  return (
    <div className="mx-auto max-w-5xl">
      {/* En-tête */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-primary">
            Espace Propriétaire{prenom && ` — ${prenom}`}
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-slate-500">
            Suivez vos lots, attestations, paiements et démarches foncières.
          </p>
          {paiementsAPayer.length > 0 && (
            <a
              href="#mes-paiements"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#FEF3C7] px-3 py-1.5 text-xs font-semibold text-[#92400E] transition-colors hover:bg-[#FDE68A]"
            >
              <Banknote className="h-3.5 w-3.5" />
              {paiementsAPayer.length} paiement{paiementsAPayer.length > 1 ? "s" : ""} en attente de votre part
            </a>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/dashboard/mettre-en-vente"
            className="inline-flex items-center gap-2 rounded-full bg-[#0D3B66] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1E6091]"
          >
            <Store className="h-4 w-4" />
            Mettre en vente
          </Link>
          <Link
            href="/dashboard/messages"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <MessageSquare className="h-4 w-4 text-[#0D3B66]" />
            Mes messages
          </Link>
        </div>
      </div>

      {/* KPI */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={loading ? "…" : k.value} icon={k.icon} gradient={k.gradient} />
        ))}
      </div>

      {/* Mes lots */}
      <Section title="Mes lots" hint="Lots dont vous êtes le propriétaire terrien ou l'acquéreur actuel">
        {loading ? (
          <Empty>Chargement…</Empty>
        ) : attributions.length === 0 ? (
          <Empty>Aucun lot rattaché à votre profil pour l&apos;instant.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            {attributions.map((a) => {
              const l = a.lots!;
              const lo = l.ilots?.lotissements;
              const st = STATUT_LOT[l.statut ?? "libre"] ?? STATUT_LOT.libre;
              const att = attestations.find((x) => x.lot_id === a.lot_id);
              return (
                <div key={a.lot_id} className="rounded-xl border border-slate-200/60 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-slate-400">
                        Îlot {l.ilots?.numero} · Lot {l.numero_lot}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-800">{lo?.nom ?? "Lotissement"}</p>
                    </div>
                    <Badge status={st.badge}>{st.label}</Badge>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="h-3 w-3" />
                    {lo?.village ?? "—"} · {lo?.commune ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Votre qualité :{" "}
                    <span className="font-semibold text-slate-700">
                      {QUALITE_LABELS[a.qualite ?? ""] ?? a.qualite ?? "—"}
                    </span>
                  </p>
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        att && att.statut === "delivree" ? "bg-[#2D8F5A]" : "bg-[#F39C12]"
                      }`}
                    />
                    <span className="font-medium text-slate-600">
                      {att ? att.reference : "Pas encore d'attestation"}
                    </span>
                    {att && <span className="ml-auto text-slate-400">{att.statut}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Mes attestations */}
      <Section title="Mes attestations" hint={`${attestations.length} document(s) à votre nom`}>
        {loading ? (
          <Empty>Chargement…</Empty>
        ) : attestations.length === 0 ? (
          <Empty>Aucune attestation pour le moment.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {attestations.map((a) => {
              const state = dlState[a.reference] ?? "idle";
              const paiementLie = a.cession_id
                ? paiements.find((p) => p.cession_id === a.cession_id)
                : null;
              const paiementRequis = !!a.cession_id && paiementLie?.statut !== "confirme";
              return (
                <li key={a.reference} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <Badge status={a.statut === "delivree" ? "attribue" : "en_validation"}>
                    {a.statut ?? "—"}
                  </Badge>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{a.reference}</p>
                    {!a.cession_id ? (
                      <p className="text-xs text-slate-400">gratuite — 1er propriétaire terrien</p>
                    ) : paiementRequis ? (
                      <p className="text-xs font-medium text-[#F39C12]">Paiement requis — voir « Mes paiements »</p>
                    ) : null}
                  </div>
                  <span className="ml-auto text-xs text-slate-400">{fmtDate(a.date_emission)}</span>
                  <button
                    type="button"
                    onClick={() => void telecharger(a.reference)}
                    disabled={state === "loading"}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-60 ${
                      state === "error" ? "bg-[#EF4444]" : "bg-[#0D3B66] hover:bg-[#0a2f52]"
                    }`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {state === "loading" ? "Préparation…" : state === "error" ? "Erreur" : "Télécharger"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Mes paiements */}
      <Section id="mes-paiements" title="Mes paiements" hint={`${paiements.length} versement(s) enregistré(s)`}>
        {payError && (
          <p className="border-b border-red-100 bg-red-50 px-5 py-2.5 text-xs text-red-700">{payError}</p>
        )}
        {loading ? (
          <Empty>Chargement…</Empty>
        ) : paiements.length === 0 ? (
          <Empty>
            Aucun paiement enregistré — généralement le cas pour une reconnaissance de propriétaire terrien
            d&apos;origine (gratuite).
          </Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {paiements.map((p) => {
              const canPay = p.statut === "en_attente" && p.acquereur_id === profile?.attributaire_id;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <Banknote className="h-4 w-4 text-[#2D8F5A]" />
                  <span className="text-sm font-semibold tabular-nums text-slate-800">{fcfa(p.montant_total)}</span>
                  <span className="text-xs text-slate-400">{p.moyen ?? "—"} · {fmtDate(p.cree_le)}</span>
                  <span className="ml-auto flex items-center gap-2">
                    <Badge status={p.statut === "confirme" ? "attribue" : "en_validation"}>
                      {p.statut ?? "—"}
                    </Badge>
                    {canPay && (
                      <button
                        type="button"
                        onClick={() => void handlePayer(p)}
                        disabled={payingId === p.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D3B66] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E6091] disabled:opacity-60"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        {payingId === p.id ? "…" : "Payer"}
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Mes démarches */}
      <Section title="Mes démarches" hint={`${demarches.length} dossier(s) suivi(s)`}>
        {loading ? (
          <Empty>Chargement…</Empty>
        ) : demarches.length === 0 ? (
          <Empty>Aucune démarche en cours.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {demarches.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {d.type ?? "Démarche"}
                    {d.description && <span className="text-slate-500"> — {d.description}</span>}
                  </p>
                  <p className="text-xs text-slate-400">
                    ouverte le {fmtDate(d.ouverte_le)}
                    {d.montant_honoraires != null && ` · honoraires ${fcfa(d.montant_honoraires)}`}
                  </p>
                </div>
                <span className="ml-auto">
                  <Badge status={d.terminee_le ? "attribue" : "en_validation"}>
                    {d.terminee_le ? "terminée" : d.statut ?? "en cours"}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function Section({
  title,
  hint,
  id,
  children,
}: {
  title: string;
  hint?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-5 overflow-hidden rounded-xl border border-slate-200/60 bg-white scroll-mt-4">
      <div className="border-b border-slate-200/60 bg-slate-50/50 px-5 py-3">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-8 text-center text-sm text-slate-500">{children}</div>;
}
