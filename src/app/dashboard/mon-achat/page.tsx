"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { createClient } from "@/utils/supabase/client";
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

function MonAchatContenu() {
  const supabase = useMemo(() => createClient(), []);

  const [demandes, setDemandes] = useState<DemandeRow[]>([]);
  const [lots, setLots] = useState<Record<string, LotLabel>>({});
  const [ventes, setVentes] = useState<Record<string, VenteRow>>({});
  const [certificats, setCertificats] = useState<Record<string, Doc>>({});
  const [ventePaies, setVentePaies] = useState<Record<string, Paie>>({});
  const [attestations, setAttestations] = useState<Record<string, Doc>>({});
  const [attPaies, setAttPaies] = useState<Record<string, Paie>>({});
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("demandes_acquisition")
      .select("id,lot_id,statut,cree_le,cession_id,vente_id")
      .order("cree_le", { ascending: false });
    const rows = (data ?? []) as DemandeRow[];
    setDemandes(rows);

    // Libellés des lots (registre public vérifiable — lisible par l'acquéreur).
    const dispo = await supabase.rpc("lots_verifiables");
    const lotMap: Record<string, LotLabel> = {};
    for (const l of (dispo.data ?? []) as unknown as (LotLabel & { lot_id: string })[]) {
      lotMap[l.lot_id] = { lotissement: l.lotissement, ilot: l.ilot, lot: l.lot, village: l.village, commune: l.commune };
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
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // Paiement en ligne (CinetPay). Réutilisé pour le terrain et l'attestation.
  const payerEnLigne = async (paiementId: string) => {
    setPayingId(paiementId);
    setPayError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setPayingId(null);
      return;
    }
    const res = await supabase.functions.invoke("initier-paiement", { body: { paiement_id: paiementId } });
    if (res.error || res.data?.error) {
      setPayError(res.data?.error ?? "Le paiement en ligne n'est pas disponible pour le moment. Vous pouvez payer au guichet SGNF.");
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
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-brand-primary sm:text-3xl">Mon espace acquéreur</h1>
        <p className="mt-1.5 text-sm text-slate-500 sm:text-base">
          Suivez les terrains qui vous intéressent et l&apos;avancement de vos achats.
        </p>
        <Link
          href="/guide-achat"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D3B66] underline decoration-dotted underline-offset-2 hover:no-underline"
        >
          <HelpCircle className="h-4 w-4" />
          Comment ça marche ?
        </Link>
      </div>

      {payError && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-[#F39C12]" />
          <span>{payError}</span>
        </div>
      )}

      {/* Cœur du dashboard : les parcelles suivies + les alertes de mise en vente
          (gère aussi l'enregistrement du suivi à l'arrivée depuis /verifier). */}
      <ParcellesSuivies />

      {/* Achats en cours : l'ancien tunnel agence, conservé, mais secondaire —
          affiché seulement s'il existe une demande/vente réelle. */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200/60 bg-white px-5 py-12 text-center text-sm text-slate-500">
          Chargement…
        </div>
      ) : demandes.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Mes achats en cours</h2>
          {demandes.map((d) => (
            <AchatCard
              key={d.id}
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
          ))}
        </div>
      ) : null}
    </div>
  );
}

// useSearchParams (dans ParcellesSuivies) impose une borne Suspense sur un export
// statique (output: export).
export default function MonAchatPage() {
  return (
    <Suspense fallback={null}>
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

  const titreLot = lot
    ? `Lot ${lot.lot ?? "?"} · Îlot ${lot.ilot ?? "?"}`
    : "Mon terrain";
  const lieu = lot ? [lot.lotissement, lot.village, lot.commune].filter(Boolean).join(" · ") : "";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      {/* En-tête terrain */}
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0D3B66]/5">
          <MapPin className="h-5 w-5 text-[#0D3B66]" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-slate-800">{titreLot}</p>
          {lieu && <p className="truncate text-xs text-slate-500">{lieu}</p>}
        </div>
      </div>

      {/* Ruban d'étapes */}
      {!refusee && (
        <div className="flex items-center justify-between px-5 pt-5">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex flex-1 items-center">
              <StepBubble state={states[i]} icon={s.icon} label={s.label} />
              {i < STEPS.length - 1 && (
                <div className={`mx-1 h-0.5 flex-1 rounded ${states[i] === "done" ? "bg-[#2D8F5A]" : "bg-slate-200"}`} />
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
            <span className="font-semibold text-slate-700">Demande envoyée.</span> L&apos;agence SGNF étudie
            votre demande et vous contactera pour convenir du prix.
            <Link href="/dashboard/messages" className="ml-1 font-semibold text-[#0D3B66] underline decoration-dotted hover:no-underline">
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
    </div>
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
      <p className="mb-3 text-sm text-slate-600">
        Prix du terrain : <span className="font-bold text-slate-800">{fcfa(vente?.prix_total)}</span>
        {vente?.montant_paye ? ` — déjà payé ${fcfa(vente.montant_paye)}` : ""}
        {reste != null && reste > 0 && vente?.montant_paye ? ` · reste ${fcfa(reste)}` : ""}
        {vente?.type_vente === "echelonne" && <span className="ml-1 text-slate-400">(paiement en plusieurs fois)</span>}
      </p>

      {enLigne || echelonneSansPaiement ? (
        <>
          <button
            type="button"
            onClick={() => (enLigne && ventePaie ? onPayer(ventePaie.id) : onPayerEcheance(venteId))}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#2D8F5A] px-5 py-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-[#24794c] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
            {busy ? "Redirection…" : `Payer mon terrain${enLigne && ventePaie?.montant_total != null ? ` — ${fcfa(ventePaie.montant_total)}` : ""}`}
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">
            Paiement mobile money sécurisé — ou payez en espèces au guichet SGNF.
          </p>
        </>
      ) : guichet ? (
        <Info tone="wait" icon={Landmark}>
          <span className="font-semibold text-slate-700">À payer au guichet SGNF</span>
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
      <div className="flex items-start gap-2.5 rounded-xl border border-[#2D8F5A]/30 bg-[#2D8F5A]/5 px-4 py-3">
        <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-[#2D8F5A]" />
        <div>
          <p className="text-sm font-bold text-[#2D8F5A]">Félicitations, vous êtes propriétaire !</p>
          {certificat && (
            <a
              href={verifUrl(certificat.reference)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D3B66] underline decoration-dotted hover:no-underline"
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              Voir mon certificat de propriété ({certificat.reference})
            </a>
          )}
        </div>
      </div>

      {/* Étape attestation */}
      {attestation ? (
        <a
          href={verifUrl(attestation.reference)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#0D3B66] px-5 py-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-[#0a2f52]"
        >
          <ShieldCheck className="h-5 w-5" />
          Voir mon attestation
        </a>
      ) : attEnLigne ? (
        <>
          <button
            type="button"
            onClick={() => attPaie && onPayer(attPaie.id)}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#2D8F5A] px-5 py-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-[#24794c] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
            {busy ? "Redirection…" : `Payer mon attestation${attPaie?.montant_total != null ? ` — ${fcfa(attPaie.montant_total)}` : ""}`}
          </button>
          <p className="text-center text-xs text-slate-400">Dernière étape : votre attestation officielle de cession.</p>
        </>
      ) : attGuichet ? (
        <Info tone="wait" icon={Landmark}>
          <span className="font-semibold text-slate-700">Attestation à régler au guichet SGNF</span>
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
        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
          done
            ? "border-[#2D8F5A] bg-[#2D8F5A] text-white"
            : current
              ? "border-[#F39C12] bg-[#F39C12]/10 text-[#F39C12]"
              : "border-slate-200 bg-white text-slate-300"
        }`}
      >
        {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
      </div>
      <span className={`text-[10px] font-semibold ${current ? "text-[#F39C12]" : done ? "text-[#2D8F5A]" : "text-slate-400"}`}>
        {label}
      </span>
    </div>
  );
}

function Info({ children, tone, icon: Icon }: { children: React.ReactNode; tone: "wait" | "neutral"; icon?: typeof Send }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm leading-relaxed ${
        tone === "wait" ? "bg-[#0D3B66]/[0.04] text-slate-600" : "bg-slate-50 text-slate-500"
      }`}
    >
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#0D3B66]" />}
      <p>{children}</p>
    </div>
  );
}
