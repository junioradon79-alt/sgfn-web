"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  HelpCircle,
  Landmark,
  Loader2,
  MapPin,
  MessageSquare,
  PartyPopper,
  Send,
  ShieldCheck,
} from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { CountBadge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { createClient } from "@/utils/supabase/client";
import { invokeEdge } from "@/lib/invoke-edge";
import { fadeUp, stagger } from "@/lib/motion";

import ParcellesSuivies from "./_ParcellesSuivies";

/**
 * « Mon achat » — page d'accueil de l'acquéreur, pensée pour un public peu à
 * l'aise avec le numérique : un parcours visuel en 4 étapes, UNE action mise en
 * avant à la fois, un vocabulaire simple (« mon terrain », « payer », « mon
 * certificat »), aucun jargon (pas de « cession », « attestation de cession »,
 * « échéance » en gros). Le suivi vit ici ; la recherche de terrain reste sur
 * « Trouver un terrain » (/dashboard/acquisition).
 */

const verifUrl = (reference: string) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://sgfn.ci";
  return `${origin}/verifier?ref=${encodeURIComponent(reference)}`;
};

const fcfa = (n: number | null | undefined) =>
  n == null ? "" : `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`;

type DemandeRow = {
  id: string;
  lot_id: string;
  statut: string;
  cree_le: string;
  cession_id: string | null;
  vente_id: string | null;
};
type VenteRow = { id: string; statut: string; type_vente: string; prix_total: number | null; montant_paye: number | null };
type LotLabel = { lotissement: string | null; ilot: string | null; lot: string | null; village: string | null; commune: string | null };
type Paie = { id: string; statut: string; montant_total: number | null };
type Doc = { reference: string; qr_token: string | null };

/**
 * « C'est à moi de payer » — le même critère que le bouton « Payer » des cartes
 * plus bas : un paiement `initie` est un tunnel abandonné en route, il attend
 * toujours l'acquéreur. `en_attente_validation` est le tour du guichet, pas le
 * sien : le rouge dit « on m'attend », jamais « j'attends l'agence ».
 */
const aRegler = (p: Paie | undefined) => !!p && (p.statut === "en_attente" || p.statut === "initie");

function MonAchatContenu() {
  const supabase = useMemo(() => createClient(), []);
  const { counts } = useBadgeCounts();

  const [demandes, setDemandes] = useState<DemandeRow[]>([]);
  const [lots, setLots] = useState<Record<string, LotLabel>>({});
  const [ventes, setVentes] = useState<Record<string, VenteRow>>({});
  const [certificats, setCertificats] = useState<Record<string, Doc>>({});
  const [ventePaies, setVentePaies] = useState<Record<string, Paie>>({});
  const [attestations, setAttestations] = useState<Record<string, Doc>>({});
  const [attPaies, setAttPaies] = useState<Record<string, Paie>>({});
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("demandes_acquisition")
      .select("id,lot_id,statut,cree_le,cession_id,vente_id")
      .order("cree_le", { ascending: false });
    const rows = (data ?? []) as DemandeRow[];
    setDemandes(rows);

    // Libellés des terrains suivis.
    //
    // 🔴 Cet écran appelait `lots_verifiables()` pour de simples LIBELLÉS. Or
    // cette RPC SECURITY DEFINER n'avait aucune garde : mesure du 30/07/2026
    // par emprunt de rôle, elle rendait 49 lots — avec leur
    // `attestation_reference` — à un acquéreur n'ayant droit à rien, soit
    // exactement autant qu'à l'admin. Un libellé d'en-tête ne justifie pas de
    // charger le registre foncier entier dans le navigateur.
    //
    // Depuis la migration 20260730060000 elle lève 42501 pour qui n'a aucun
    // périmètre : un acquéreur prospect aurait vu cet écran tomber. On lit
    // donc les ANNONCES, seule source pensée pour le catalogue, et bornée aux
    // lots effectivement suivis par l'utilisateur.
    //
    // ⚠️ 1 annonce en base au 30/07/2026, au statut `suspendue` — donc
    // 0 active. Aucun libellé ne sera résolu aujourd'hui, et l'en-tête
    // retombe sur « Mon terrain », ce qu'il faisait déjà pour tout lot
    // inconnu. C'est l'état réel du stock, pas une régression.
    const lotIds = [...new Set(rows.map((d) => d.lot_id).filter(Boolean))];
    const lotMap: Record<string, LotLabel> = {};
    if (lotIds.length > 0) {
      const { data: annonces } = await supabase
        .from("annonces_marketplace")
        .select("lot_id,titre,zone")
        .eq("statut", "active")
        .in("lot_id", lotIds);
      for (const a of (annonces ?? []) as { lot_id: string; titre: string | null; zone: string | null }[]) {
        lotMap[a.lot_id] = {
          lotissement: a.titre,
          ilot: null,
          lot: null,
          village: a.zone,
          commune: null,
        };
      }
    }
    setLots(lotMap);

    const venteIds = rows.map((d) => d.vente_id).filter(Boolean) as string[];
    if (venteIds.length > 0) {
      const [vRes, cRes, vpRes] = await Promise.all([
        supabase.from("ventes").select("id,statut,type_vente,prix_total,montant_paye").in("id", venteIds),
        supabase.from("certificats_vente").select("reference,qr_token,vente_id").in("vente_id", venteIds),
        supabase
          .from("paiements")
          .select("id,statut,montant_total,vente_id,cree_le")
          .eq("type", "vente_terrain")
          .neq("statut", "confirme")
          .in("vente_id", venteIds)
          .order("cree_le", { ascending: false }),
      ]);
      const vMap: Record<string, VenteRow> = {};
      for (const v of (vRes.data ?? []) as VenteRow[]) vMap[v.id] = v;
      setVentes(vMap);
      const cMap: Record<string, Doc> = {};
      for (const c of (cRes.data ?? []) as (Doc & { vente_id: string | null })[]) if (c.vente_id) cMap[c.vente_id] = { reference: c.reference, qr_token: c.qr_token };
      setCertificats(cMap);
      const vpMap: Record<string, Paie> = {};
      for (const p of (vpRes.data ?? []) as (Paie & { vente_id: string | null })[]) if (p.vente_id && !vpMap[p.vente_id]) vpMap[p.vente_id] = { id: p.id, statut: p.statut, montant_total: p.montant_total };
      setVentePaies(vpMap);
    } else {
      setVentes({});
      setCertificats({});
      setVentePaies({});
    }

    const cessionIds = rows.map((d) => d.cession_id).filter(Boolean) as string[];
    if (cessionIds.length > 0) {
      const [aRes, apRes] = await Promise.all([
        supabase.from("attestations_cession").select("reference,qr_token,cession_id").in("cession_id", cessionIds),
        supabase.from("paiements").select("id,statut,montant_total,cession_id").eq("type", "attestation_cession").in("cession_id", cessionIds),
      ]);
      const aMap: Record<string, Doc> = {};
      for (const a of (aRes.data ?? []) as (Doc & { cession_id: string | null })[]) if (a.cession_id) aMap[a.cession_id] = { reference: a.reference, qr_token: a.qr_token };
      setAttestations(aMap);
      const apMap: Record<string, Paie> = {};
      for (const p of (apRes.data ?? []) as (Paie & { cession_id: string | null })[]) if (p.cession_id) apMap[p.cession_id] = { id: p.id, statut: p.statut, montant_total: p.montant_total };
      setAttPaies(apMap);
    } else {
      setAttestations({});
      setAttPaies({});
    }
  }, [supabase]);

  const { isLoading: loading, recharger } = useChargement(load);

  const paiementsARegler = [...Object.values(ventePaies), ...Object.values(attPaies)].filter(aRegler).length;

  // Paiement en ligne (CinetPay). Réutilisé pour le terrain et l'attestation.
  const payerEnLigne = async (paiementId: string) => {
    setPayingId(paiementId);
    setPayError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setPayingId(null);
      return;
    }
    const res = await invokeEdge<{ payment_url: string }>(
      supabase,
      "initier-paiement",
      { paiement_id: paiementId },
      "Le paiement en ligne n'est pas disponible pour le moment. Vous pouvez payer au guichet SGNF.",
    );
    if (res.error || !res.data) {
      setPayError(res.error ?? "Le paiement en ligne n'est pas disponible pour le moment. Vous pouvez payer au guichet SGNF.");
      setPayingId(null);
      return;
    }
    window.location.assign(res.data.payment_url);
  };

  const payerEcheanceSuivante = async (venteId: string) => {
    setPayingId(`ech:${venteId}`);
    setPayError(null);
    const { data, error } = await supabase.rpc("creer_paiement_echeance_suivante", {
      p_vente_id: venteId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      p_moyen: "orange_money" as any,
    });
    if (error) {
      setPayError(error.message);
      setPayingId(null);
      return;
    }
    const pid = (data as { paiement_id?: string } | null)?.paiement_id;
    if (pid) await payerEnLigne(pid);
    else setPayingId(null);
  };

  return (
    <AppShell loading={loading} counts={counts} onRefresh={() => void recharger()}>
      <div>
        <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Mon achat</p>
        <h1 className="mt-1 font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
          Mon espace acquéreur
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Suivez les terrains qui vous intéressent et l&apos;avancement de vos achats.
        </p>
        {/* La barre latérale annonce « N à traiter » à l'acquéreur, et il arrivait
            ici sans rien voir : le bouton « Payer » pouvait être à trois écrans de
            défilement plus bas. Même bandeau que l'espace Propriétaire terrien. */}
        {!loading && paiementsARegler > 0 && (
          <div className="mt-2.5">
            <a
              href="#mes-achats"
              className="inline-flex items-center gap-2 rounded-full border border-brick/40 bg-brick-subtle py-1.5 pr-3.5 pl-2 text-xs font-semibold text-foreground transition-opacity hover:opacity-80"
            >
              <CountBadge value={paiementsARegler} />
              paiement{paiementsARegler > 1 ? "s" : ""} en attente de votre part
            </a>
          </div>
        )}

        <Button asChild variant="link" size="sm" className="mt-2 h-auto px-0">
          <Link href="/guide-achat">
            <HelpCircle className="size-4" aria-hidden />
            Comment ça marche ?
          </Link>
        </Button>
      </div>

      {payError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-foreground">
          <Landmark className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>{payError}</span>
        </div>
      )}

      {/* Cœur du dashboard : les parcelles suivies + les alertes de mise en vente
          (gère aussi l'enregistrement du suivi à l'arrivée depuis /verifier). */}
      <ParcellesSuivies />

      {/* Achats en cours : l'ancien tunnel agence, conservé, mais secondaire —
          affiché seulement s'il existe une demande/vente réelle. */}
      {loading ? null : demandes.length > 0 ? (
        <motion.section
          id="mes-achats"
          variants={stagger(0, 0.05)}
          initial="hidden"
          animate="show"
          className="flex scroll-mt-6 flex-col gap-4"
        >
          <h2 className="text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
            Mes achats en cours
          </h2>
          {demandes.map((d) => (
            <motion.div key={d.id} variants={fadeUp}>
              <AchatCard
                d={d}
                lot={lots[d.lot_id]}
                vente={d.vente_id ? ventes[d.vente_id] : undefined}
                certificat={d.vente_id ? certificats[d.vente_id] : undefined}
                ventePaie={d.vente_id ? ventePaies[d.vente_id] : undefined}
                attestation={d.cession_id ? attestations[d.cession_id] : undefined}
                attPaie={d.cession_id ? attPaies[d.cession_id] : undefined}
                payingId={payingId}
                onPayer={payerEnLigne}
                onPayerEcheance={payerEcheanceSuivante}
              />
            </motion.div>
          ))}
        </motion.section>
      ) : null}
    </AppShell>
  );
}

// useSearchParams (dans ParcellesSuivies) impose une borne Suspense sur un export
// statique (output: export).
export default function MonAchatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      }
    >
      <MonAchatContenu />
    </Suspense>
  );
}

type StepState = "done" | "current" | "todo";
const STEPS: { key: string; label: string; icon: typeof Send }[] = [
  { key: "demande", label: "Demande", icon: Send },
  { key: "payer", label: "Payer", icon: CreditCard },
  { key: "certificat", label: "Propriétaire", icon: FileCheck2 },
  { key: "attestation", label: "Attestation", icon: BadgeCheck },
];

function AchatCard({
  d,
  lot,
  vente,
  certificat,
  ventePaie,
  attestation,
  attPaie,
  payingId,
  onPayer,
  onPayerEcheance,
}: {
  d: DemandeRow;
  lot: LotLabel | undefined;
  vente: VenteRow | undefined;
  certificat: Doc | undefined;
  ventePaie: Paie | undefined;
  attestation: Doc | undefined;
  attPaie: Paie | undefined;
  payingId: string | null;
  onPayer: (id: string) => void;
  onPayerEcheance: (venteId: string) => void;
}) {
  const refusee = d.statut === "refusee" || d.statut === "annulee";
  const hasVente = !!vente;
  const venteSoldee = vente?.statut === "soldee";
  const hasAtt = !!attestation;

  // État de chaque étape pour le ruban visuel.
  const states: StepState[] = [
    "done", // demande envoyée
    venteSoldee ? "done" : hasVente ? "current" : "todo", // payer le terrain
    venteSoldee ? "done" : "todo", // certificat / propriétaire
    hasAtt ? "done" : venteSoldee ? "current" : "todo", // attestation
  ];

  // L'annonce ne porte ni îlot ni numéro de lot (ce sont des données du
  // registre, pas du catalogue). On titre alors par l'intitulé de l'annonce
  // plutôt que d'afficher « Lot ? · Îlot ? ».
  const refCadastrale =
    lot && (lot.lot != null || lot.ilot != null)
      ? `Lot ${lot.lot ?? "?"} · Îlot ${lot.ilot ?? "?"}`
      : null;
  const titreLot = refCadastrale ?? lot?.lotissement ?? "Mon terrain";
  const lieu = lot
    ? [refCadastrale ? lot.lotissement : null, lot.village, lot.commune].filter(Boolean).join(" · ")
    : "";

  return (
    <Card className="overflow-hidden">
      {/* En-tête terrain */}
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <div className="bg-accent-subtle flex size-11 shrink-0 items-center justify-center rounded-xl">
          <MapPin className="text-accent size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-foreground">{titreLot}</p>
          {lieu && <p className="truncate text-xs text-muted-foreground">{lieu}</p>}
        </div>
      </div>

      {/* Ruban d'étapes */}
      {!refusee && (
        <div className="flex items-center justify-between px-5 pt-5">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex flex-1 items-center">
              <StepBubble state={states[i]} icon={s.icon} label={s.label} />
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-1 h-0.5 flex-1 rounded ${states[i] === "done" ? "bg-success" : "bg-border"}`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Zone d'action : UNE chose à faire */}
      <div className="px-5 py-5">
        {refusee ? (
          <Info tone="neutral">Cette demande n&apos;a pas abouti. Vous pouvez chercher un autre terrain.</Info>
        ) : !hasVente ? (
          <Info tone="wait" icon={MessageSquare}>
            <span className="font-semibold text-foreground">Demande envoyée.</span> L&apos;agence SGNF étudie
            votre demande et vous contactera pour convenir du prix.
            <Link
              href="/dashboard/messages"
              className="text-accent ml-1 font-semibold underline decoration-dotted hover:no-underline"
            >
              Voir mes messages
            </Link>
          </Info>
        ) : !venteSoldee ? (
          <PayerTerrain vente={vente} ventePaie={ventePaie} venteId={d.vente_id!} payingId={payingId} onPayer={onPayer} onPayerEcheance={onPayerEcheance} />
        ) : (
          <Proprietaire
            certificat={certificat}
            attestation={attestation}
            attPaie={attPaie}
            hasCession={!!d.cession_id}
            payingId={payingId}
            onPayer={onPayer}
          />
        )}
      </div>
    </Card>
  );
}

function PayerTerrain({
  vente,
  ventePaie,
  venteId,
  payingId,
  onPayer,
  onPayerEcheance,
}: {
  vente: VenteRow | undefined;
  ventePaie: Paie | undefined;
  venteId: string;
  payingId: string | null;
  onPayer: (id: string) => void;
  onPayerEcheance: (venteId: string) => void;
}) {
  const reste = vente && vente.prix_total != null && vente.montant_paye != null ? vente.prix_total - vente.montant_paye : null;
  const enLigne = ventePaie && (ventePaie.statut === "en_attente" || ventePaie.statut === "initie");
  const guichet = ventePaie && ventePaie.statut === "en_attente_validation";
  const echelonneSansPaiement = !ventePaie && vente?.type_vente === "echelonne";
  const busy = payingId === (ventePaie?.id ?? "") || payingId === `ech:${venteId}`;

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Prix du terrain : <span className="font-bold text-foreground">{fcfa(vente?.prix_total)}</span>
        {vente?.montant_paye ? ` — déjà payé ${fcfa(vente.montant_paye)}` : ""}
        {reste != null && reste > 0 && vente?.montant_paye ? ` · reste ${fcfa(reste)}` : ""}
        {vente?.type_vente === "echelonne" && <span className="ml-1 text-muted-2">(paiement en plusieurs fois)</span>}
      </p>

      {enLigne || echelonneSansPaiement ? (
        <>
          {/* Action unique et pleine largeur : cet écran s'adresse à un public peu
              à l'aise avec le numérique — cf. le docstring de la page. */}
          <Button
            variant="primary"
            loading={busy}
            onClick={() => (enLigne && ventePaie ? onPayer(ventePaie.id) : onPayerEcheance(venteId))}
            className="bg-success hover:bg-success/90 h-auto w-full rounded-xl py-4 text-base font-bold text-white"
          >
            {!busy && <CreditCard className="size-5" aria-hidden />}
            {busy ? "Redirection…" : `Payer mon terrain${enLigne && ventePaie?.montant_total != null ? ` — ${fcfa(ventePaie.montant_total)}` : ""}`}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-2">
            Paiement mobile money sécurisé — ou payez en espèces au guichet SGNF.
          </p>
        </>
      ) : guichet ? (
        <Info tone="wait" icon={Landmark}>
          <span className="font-semibold text-foreground">À payer au guichet SGNF</span>
          {ventePaie?.montant_total != null && <> — {fcfa(ventePaie.montant_total)}</>}. Présentez-vous à
          l&apos;agence ; votre certificat de propriété sera établi dès le paiement.
        </Info>
      ) : (
        <Info tone="wait">Paiement en cours de traitement…</Info>
      )}
    </div>
  );
}

function Proprietaire({
  certificat,
  attestation,
  attPaie,
  hasCession,
  payingId,
  onPayer,
}: {
  certificat: Doc | undefined;
  attestation: Doc | undefined;
  attPaie: Paie | undefined;
  hasCession: boolean;
  payingId: string | null;
  onPayer: (id: string) => void;
}) {
  const attEnLigne = attPaie && (attPaie.statut === "en_attente" || attPaie.statut === "initie");
  const attGuichet = attPaie && attPaie.statut === "en_attente_validation";
  const busy = payingId === (attPaie?.id ?? "");

  return (
    <div className="space-y-4">
      {/* Bandeau propriété acquise */}
      <div className="border-success/30 bg-success-subtle flex items-start gap-2.5 rounded-xl border px-4 py-3">
        <PartyPopper className="text-success mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="text-success text-sm font-bold">Félicitations, vous êtes propriétaire !</p>
          {certificat && (
            <a
              href={verifUrl(certificat.reference)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent mt-1 inline-flex items-center gap-1.5 text-xs font-semibold underline decoration-dotted hover:no-underline"
            >
              <FileCheck2 className="size-3.5" aria-hidden />
              Voir mon certificat de propriété ({certificat.reference})
            </a>
          )}
        </div>
      </div>

      {/* Étape attestation */}
      {attestation ? (
        <Button
          asChild
          variant="primary"
          className="h-auto w-full rounded-xl py-4 text-base font-bold"
        >
          <a href={verifUrl(attestation.reference)} target="_blank" rel="noopener noreferrer">
            <ShieldCheck className="size-5" aria-hidden />
            Voir mon attestation
          </a>
        </Button>
      ) : attEnLigne ? (
        <>
          <Button
            variant="primary"
            loading={busy}
            onClick={() => attPaie && onPayer(attPaie.id)}
            className="bg-success hover:bg-success/90 h-auto w-full rounded-xl py-4 text-base font-bold text-white"
          >
            {!busy && <CreditCard className="size-5" aria-hidden />}
            {busy ? "Redirection…" : `Payer mon attestation${attPaie?.montant_total != null ? ` — ${fcfa(attPaie.montant_total)}` : ""}`}
          </Button>
          <p className="text-center text-xs text-muted-2">Dernière étape : votre attestation officielle de cession.</p>
        </>
      ) : attGuichet ? (
        <Info tone="wait" icon={Landmark}>
          <span className="font-semibold text-foreground">Attestation à régler au guichet SGNF</span>
          {attPaie?.montant_total != null && <> — {fcfa(attPaie.montant_total)}</>}. Elle sera émise dès le paiement.
        </Info>
      ) : hasCession ? (
        <Info tone="wait">Votre attestation est en cours de préparation…</Info>
      ) : (
        <Info tone="wait" icon={CheckCircle2}>
          L&apos;agence SGNF va préparer votre attestation officielle de cession. Vous pourrez la régler ici même.
        </Info>
      )}
    </div>
  );
}

function StepBubble({ state, icon: Icon, label }: { state: StepState; icon: typeof Send; label: string }) {
  const done = state === "done";
  const current = state === "current";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex size-9 items-center justify-center rounded-full border-2 ${
          done
            ? "border-success bg-success text-white"
            : current
              ? "border-warning bg-warning-subtle text-warning"
              : "border-border bg-card text-muted-2"
        }`}
      >
        {done ? <CheckCircle2 className="size-5" aria-hidden /> : <Icon className="size-4" aria-hidden />}
      </div>
      <span
        className={`text-[10px] font-semibold ${
          current ? "text-warning" : done ? "text-success" : "text-muted-2"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function Info({ children, tone, icon: Icon }: { children: React.ReactNode; tone: "wait" | "neutral"; icon?: typeof Send }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm leading-relaxed ${
        tone === "wait" ? "bg-accent-subtle text-foreground" : "bg-inset text-muted-foreground"
      }`}
    >
      {Icon && <Icon className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />}
      <p>{children}</p>
    </div>
  );
}
