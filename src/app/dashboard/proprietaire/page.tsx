"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge, CountBadge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Kpi } from "@/components/ds/kpi";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { useProfile } from "@/hooks/useProfile";
import { createClient } from "@/utils/supabase/client";
import { fadeUp, stagger } from "@/lib/motion";

/**
 * Espace Propriétaire — vue personnelle d'un ayant-droit / acquéreur sur ses
 * lots, attestations, paiements et démarches. Le RLS Supabase filtre déjà tout
 * sur le profil connecté : aucune clause `.eq()` explicite n'est nécessaire.
 * Porté depuis le prototype `sgfn_espace_client_2.html`.
 */

const QUALITE_LABELS: Record<string, string> = {
  ayant_droit: "Propriétaire d'origine",
  ayant_droit_transmission: "Ayant-droit par transmission",
  acquereur: "Acquéreur",
  operateur: "Opérateur",
  entrepreneur: "Entrepreneur",
  reservataire: "Réservataire",
};

type Ton = "neutral" | "accent" | "success" | "warning" | "danger";

const STATUT_LOT: Record<string, { ton: Ton; label: string }> = {
  attribue: { ton: "accent", label: "Attribué" },
  occupe: { ton: "accent", label: "Occupé" },
  vendu: { ton: "accent", label: "Vendu" },
  libre: { ton: "success", label: "Libre" },
  en_litige: { ton: "danger", label: "Litige" },
  reserve_equipement: { ton: "warning", label: "Réservé" },
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

/**
 * Défilement interne des quatre listes.
 *
 * L'écran est pensé pour un propriétaire, qui a quelques lots. Mais le RLS
 * ouvre tout à un administrateur, et la page mesurait alors 101 520 px de haut
 * — les blocs du bas devenaient inatteignables. Chaque liste défile chez elle ;
 * les quatre titres restent visibles.
 */
const BORNE = "max-h-[58vh] overflow-auto";

/** Une attestation révoquée n'est pas « en cours » : elle se lit en rouge,
 *  pas en orange, sans quoi le propriétaire la croit encore valable. */
const tonAttestation = (statut: string | null): Ton =>
  statut === "delivree" ? "success" : statut === "revoquee" || statut === "annulee" ? "danger" : "warning";

export default function EspaceProprietairePage() {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useProfile();
  const { counts } = useBadgeCounts();

  const [attributions, setAttributions] = useState<AttributionRow[]>([]);
  const [attestations, setAttestations] = useState<AttestationRow[]>([]);
  const [paiements, setPaiements] = useState<PaiementRow[]>([]);
  const [demarches, setDemarches] = useState<DemarcheRow[]>([]);
  const [dlState, setDlState] = useState<Record<string, "idle" | "loading" | "error">>({});
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  // `useChargement` porte l'état de chargement : au premier rendu il n'écrit
  // rien de façon synchrone (pas de cascade de rendus), et `recharger` sert le
  // bouton de rafraîchissement de la coquille.
  const { isLoading: loading, recharger } = useChargement(async () => {
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

  // Un même lot peut porter plusieurs attributions actuelles (ex. propriétaire
  // d'origine ET opérateur). On déduplique par lot — « 1 lot = 1 carte » — en
  // fusionnant les qualités.
  const lotsUniques = useMemo(() => {
    const map = new Map<
      string,
      { lot_id: string; lots: AttributionRow["lots"]; qualites: string[] }
    >();
    for (const a of attributions) {
      const label = QUALITE_LABELS[a.qualite ?? ""] ?? a.qualite ?? null;
      const existing = map.get(a.lot_id);
      if (existing) {
        if (label && !existing.qualites.includes(label)) existing.qualites.push(label);
      } else {
        map.set(a.lot_id, { lot_id: a.lot_id, lots: a.lots, qualites: label ? [label] : [] });
      }
    }
    return Array.from(map.values());
  }, [attributions]);

  const nbAttDelivrees = attestations.filter((a) => a.statut === "delivree").length;
  const nbDemarchesOuvertes = demarches.filter((d) => !d.terminee_le).length;
  const totalPaye = paiements
    .filter((p) => p.statut === "confirme")
    .reduce((s, p) => s + (p.montant_total ?? 0), 0);
  const paiementsAPayer = paiements.filter(
    (p) => p.statut === "en_attente" && p.acquereur_id === profile?.attributaire_id
  );

  const prenom = profile?.nom_complet?.split(" ")[0] ?? "";

  return (
    <AppShell loading={loading} counts={counts} onRefresh={() => void recharger()}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Mon patrimoine</p>
          <h1 className="mt-1 font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Espace Propriétaire{prenom && ` — ${prenom}`}
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Suivez vos lots, attestations, paiements et démarches foncières.
          </p>
          {/* Rouge brique et pastille compteur : c'est le même message que le
              bandeau « N actions à faire » des Demandes d'acquisition, il doit
              s'écrire de la même façon. Était en ambre. */}
          {paiementsAPayer.length > 0 && (
            <a
              href="#mes-paiements"
              className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-brick/40 bg-brick-subtle py-1.5 pr-3.5 pl-2 text-xs font-semibold text-foreground transition-opacity hover:opacity-80"
            >
              <CountBadge value={paiementsAPayer.length} />
              <Banknote className="size-3.5 text-brick" aria-hidden />
              paiement{paiementsAPayer.length > 1 ? "s" : ""} en attente de votre part
            </a>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild variant="primary">
            <Link href="/dashboard/mettre-en-vente">
              <Store />
              Mettre en vente
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/messages">
              <MessageSquare />
              Mes messages
            </Link>
          </Button>
        </div>
      </div>

      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Kpi
          icon={Landmark}
          label="Lots détenus"
          loading={loading}
          value={lotsUniques.length}
          legende={<>Attributions en cours</>}
        />
        <Kpi
          icon={FileCheck2}
          label="Attestations délivrées"
          loading={loading}
          value={nbAttDelivrees}
          legende={<>Sur {attestations.length} document{attestations.length > 1 ? "s" : ""} à votre nom</>}
        />
        <Kpi
          icon={ListChecks}
          label="Démarches en cours"
          loading={loading}
          value={nbDemarchesOuvertes}
          tone={nbDemarchesOuvertes > 0 ? "warning" : "neutral"}
          legende={<>Dossiers non clôturés</>}
        />
        <Kpi
          icon={Banknote}
          label="Total payé"
          loading={loading}
          value={totalPaye}
          format={(n) => fcfa(n)}
          legende={<>Versements confirmés</>}
        />
      </motion.section>

      <motion.div variants={stagger(0.05, 0.06)} initial="hidden" animate="show" className="flex flex-col gap-5">
        {/* Mes lots */}
        <Bloc titre="Mes lots" hint="Lots dont vous êtes le propriétaire terrien ou l'acquéreur actuel">
          {loading ? null : lotsUniques.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="Aucun lot rattaché à votre profil"
              description="Dès qu'une attribution vous sera enregistrée, elle apparaîtra ici."
            />
          ) : (
            <div className={`grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 ${BORNE}`}>
              {lotsUniques.map((u) => {
                const l = u.lots!;
                const lo = l.ilots?.lotissements;
                const st = STATUT_LOT[l.statut ?? "libre"] ?? STATUT_LOT.libre;
                const att = attestations.find((x) => x.lot_id === u.lot_id);
                const delivree = att?.statut === "delivree";
                return (
                  <div key={u.lot_id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-muted-2">
                          Îlot {l.ilots?.numero} · Lot {l.numero_lot}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                          {lo?.nom ?? "Lotissement"}
                        </p>
                      </div>
                      <Badge tone={st.ton}>{st.label}</Badge>
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3" aria-hidden />
                      {lo?.village ?? "—"} · {lo?.commune ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {u.qualites.length > 1 ? "Vos qualités" : "Votre qualité"} :{" "}
                      <span className="font-semibold text-foreground">
                        {u.qualites.length > 0 ? u.qualites.join(", ") : "—"}
                      </span>
                    </p>
                    <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs">
                      <span
                        aria-hidden
                        className={`size-1.5 rounded-full ${delivree ? "bg-success" : "bg-warning"}`}
                      />
                      <span className="font-medium text-foreground">
                        {att ? att.reference : "Pas encore d'attestation"}
                      </span>
                      {att && <span className="ml-auto text-muted-2">{att.statut}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Bloc>

        {/* Mes attestations */}
        <Bloc titre="Mes attestations" hint={`${attestations.length} document(s) à votre nom`}>
          {loading ? null : attestations.length === 0 ? (
            <EmptyState
              icon={FileCheck2}
              title="Aucune attestation pour le moment"
              description="Les documents fonciers émis à votre nom se retrouveront ici, téléchargeables."
            />
          ) : (
            <ul className={`divide-y divide-border ${BORNE}`}>
              {attestations.map((a) => {
                const state = dlState[a.reference] ?? "idle";
                const paiementLie = a.cession_id
                  ? paiements.find((p) => p.cession_id === a.cession_id)
                  : null;
                const paiementRequis = !!a.cession_id && paiementLie?.statut !== "confirme";
                return (
                  <li key={a.reference} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <Badge tone={tonAttestation(a.statut)}>{a.statut ?? "—"}</Badge>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{a.reference}</p>
                      {!a.cession_id ? (
                        <p className="text-xs text-muted-2">gratuite — 1er propriétaire terrien</p>
                      ) : paiementRequis ? (
                        <p className="text-xs font-medium text-warning">
                          Paiement requis — voir « Mes paiements »
                        </p>
                      ) : null}
                    </div>
                    <span className="ml-auto text-xs text-muted-2">{fmtDate(a.date_emission)}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant={state === "error" ? "danger" : "primary"}
                      onClick={() => void telecharger(a.reference)}
                      loading={state === "loading"}
                    >
                      <Download />
                      {state === "loading" ? "Préparation…" : state === "error" ? "Erreur" : "Télécharger"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Bloc>

        {/* Mes paiements */}
        <Bloc id="mes-paiements" titre="Mes paiements" hint={`${paiements.length} versement(s) enregistré(s)`}>
          {payError && (
            <p role="alert" className="border-b border-danger/25 bg-danger-subtle px-5 py-2.5 text-xs font-medium text-danger">
              {payError}
            </p>
          )}
          {loading ? null : paiements.length === 0 ? (
            <EmptyState
              icon={Banknote}
              tone="positive"
              title="Aucun paiement enregistré"
              description="C'est le cas normal d'une reconnaissance de propriétaire terrien d'origine, qui est gratuite."
            />
          ) : (
            <ul className={`divide-y divide-border ${BORNE}`}>
              {paiements.map((p) => {
                const canPay = p.statut === "en_attente" && p.acquereur_id === profile?.attributaire_id;
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <Banknote className="size-4 text-success" aria-hidden />
                    <span className="tabular text-sm font-semibold text-foreground">{fcfa(p.montant_total)}</span>
                    <span className="text-xs text-muted-2">
                      {p.moyen ?? "—"} · {fmtDate(p.cree_le)}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      <Badge tone={p.statut === "confirme" ? "success" : "warning"}>{p.statut ?? "—"}</Badge>
                      {canPay && (
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          onClick={() => void handlePayer(p)}
                          loading={payingId === p.id}
                        >
                          <CreditCard />
                          Payer
                        </Button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Bloc>

        {/* Mes démarches */}
        <Bloc titre="Mes démarches" hint={`${demarches.length} dossier(s) suivi(s)`}>
          {loading ? null : demarches.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              tone="positive"
              title="Aucune démarche en cours"
              description="Rien ne requiert votre attention côté dossiers."
            />
          ) : (
            <ul className={`divide-y divide-border ${BORNE}`}>
              {demarches.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {d.type ?? "Démarche"}
                      {d.description && <span className="text-muted-foreground"> — {d.description}</span>}
                    </p>
                    <p className="text-xs text-muted-2">
                      ouverte le {fmtDate(d.ouverte_le)}
                      {d.montant_honoraires != null && ` · honoraires ${fcfa(d.montant_honoraires)}`}
                    </p>
                  </div>
                  <span className="ml-auto">
                    <Badge tone={d.terminee_le ? "success" : "warning"}>
                      {d.terminee_le ? "terminée" : d.statut ?? "en cours"}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Bloc>
      </motion.div>
    </AppShell>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

/** Section de l'espace : titre, sous-titre et corps sans marge (listes à bords
 *  perdus). `scroll-mt` garde l'ancre « Mes paiements » sous l'en-tête collant. */
function Bloc({
  titre,
  hint,
  id,
  children,
}: {
  titre: string;
  hint?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section variants={fadeUp} id={id} className="scroll-mt-24">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{titre}</CardTitle>
            {hint && <CardDescription>{hint}</CardDescription>}
          </div>
        </CardHeader>
        {children}
      </Card>
    </motion.section>
  );
}
