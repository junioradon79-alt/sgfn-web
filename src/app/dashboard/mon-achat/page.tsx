"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Download,
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
import { messageLecture } from "@/lib/supabase-pagination";
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

/**
 * DEUX CHEMINS, DEUX BESOINS — ne pas les confondre.
 *
 * 1. `/verifier?ref=` (ci-dessous) — la vérification PUBLIQUE et opposable :
 *    n'importe qui, muni de la référence ou du QR, contrôle l'authenticité de
 *    l'acte. C'est le produit payant (60 000 FCFA, `TYPES_PAYANTS` dans
 *    `supabase/functions/verification-qr/index.ts`). Il reste en place, entier
 *    et inchangé : un acquéreur peut vouloir le montrer à un tiers.
 *
 * 2. `telechargerAttestation()` plus bas — la LECTURE DE SON PROPRE ACTE par
 *    une partie concernée, gratuite. Elle ne passe PAS par `verification-qr`
 *    et ne touche donc à aucun tarif : elle passe par `telecharger-document`,
 *    qui relit la ligne avec le JETON DE L'APPELANT (les RLS s'appliquent,
 *    policy `attcess_read` : `acquereur_id = mon_attributaire_id()`) avant de
 *    signer une URL de 120 s. Un tiers qui scanne un QR n'a pas de session
 *    portant cet `attributaire_id` : la RLS lui rend 0 ligne et la fonction
 *    répond 403. Le paywall n'est donc pas contournable par ce chemin.
 */
const verifUrl = (reference: string) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://sgfn.ci";
  return `${origin}/verifier?ref=${encodeURIComponent(reference)}`;
};

/**
 * Repli affiché UNIQUEMENT quand le serveur n'a envoyé aucun motif exploitable
 * — coupure réseau, CORS, corps non-JSON. Il sert aussi de sentinelle : si
 * `invokeEdge` rend exactement ce texte, c'est que rien n'a été compris du
 * serveur, donc que l'état réel est INCONNU. Toute autre valeur vient de
 * `telecharger-document` et dit quelque chose de vrai (refus d'accès, fichier
 * pas encore généré). Même doctrine que `useAttestations.ts` (`incertain`).
 */
const REPLI_TRANSPORT =
  "Nous n'avons pas pu joindre le service de téléchargement. Vérifiez votre connexion, puis réessayez.";

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
 * `incertain` : le serveur n'a rien dit d'exploitable, donc on ne sait PAS si
 * l'acte est inaccessible ou si l'appel n'est simplement jamais arrivé. Ne
 * jamais présenter ce cas comme « vous n'avez pas ce document ».
 */
type DlErreur = { reference: string; message: string; incertain: boolean };

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
  /** Référence de l'attestation dont le téléchargement est en cours, ou null. */
  const [dlEnCours, setDlEnCours] = useState<string | null>(null);
  const [dlErreur, setDlErreur] = useState<DlErreur | null>(null);
  /**
   * 🔴 UN ÉCHEC QUI SE FAISAIT PASSER POUR « AUCUN ACHAT » — relevé le
   * 30/07/2026 par un vérificateur tiers. `load()` faisait
   * `const { data } = await …` et jetait `error` : une lecture en échec
   * donnait `data === null`, donc `demandes === []`, donc la section
   * « Mes achats en cours » disparaissait purement et simplement. Un
   * acquéreur en plein tunnel de paiement voyait son achat s'évaporer sans
   * un mot. On distingue désormais « vous n'avez aucun achat » de « je n'ai
   * pas pu lire vos achats ».
   */
  const [chargeErreur, setChargeErreur] = useState<string | null>(null);
  /** Motif d'une lecture SECONDAIRE tombée (ventes, certificats, attestations,
   *  paiements) : la page reste affichée, mais annoncée comme incomplète. */
  const [detailErreur, setDetailErreur] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("demandes_acquisition")
      .select("id,lot_id,statut,cree_le,cession_id,vente_id")
      .order("cree_le", { ascending: false });
    if (error) {
      setChargeErreur(error.message);
      setDemandes([]);
      setLots({});
      return;
    }
    setChargeErreur(null);
    // 🔴 Les lectures SUIVANTES jetaient toutes leur `error` : le correctif du
    // 30/07 n'avait porté que sur la première. La plus grave est celle des
    // attestations — un acquéreur est une des « parties concernées » de la
    // consigne, et un refus sur son propre acte se présentait comme un acte
    // inexistant. On accumule les motifs, on les affiche à la fin.
    const echecs: string[] = [];
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
    // 🔴 CORRECTIF DU 30/07/2026 (vérificateur tiers). Le premier
    // rebranchement ne lisait QUE les annonces `active`, et son commentaire
    // parlait de « l'état réel du stock » : c'est l'état réel des ANNONCES,
    // pas des DEMANDES. Mesuré : l'unique demande de la base porte sur le lot
    // 91ccc540 (« Koelea-Accor revu », îlot 01, lot 06), qui n'a AUCUNE
    // annonce — son libellé disparaissait au profit du repli générique. Une
    // demande d'acquisition n'implique évidemment pas que le lot soit en
    // vente ; le lier au catalogue était l'erreur.
    //
    // Ordre de résolution, du plus précis au plus général, sans toucher à la
    // RLS de `lots` (hors périmètre, décision du user) :
    //   1. `mes_suivis()` — RPC déjà bornée à l'appelant et déjà utilisée par
    //      « Mes terrains suivis » plus bas ; elle rend le vrai libellé
    //      cadastral (lotissement, îlot, n° de lot). Mesuré : le demandeur
    //      SUIT bien le lot de sa demande, le libellé est donc rétabli.
    //   2. l'annonce, quand il y en a une. Le filtre `statut = 'active'` est
    //      RETIRÉ ici : c'est la RLS de `annonces_marketplace` qui décide
    //      (`statut = 'active'` pour tous, plus ses propres annonces pour un
    //      vendeur), et un vendeur doit pouvoir nommer son terrain même
    //      annonce suspendue. Le catalogue de /dashboard/acquisition, lui,
    //      garde le filtre : ce sont deux besoins différents.
    const lotIds = [...new Set(rows.map((d) => d.lot_id).filter(Boolean))];
    const lotMap: Record<string, LotLabel> = {};
    if (lotIds.length > 0) {
      type SuiviLabel = {
        lot_id: string;
        numero_lot: string | null;
        ilot_numero: string | null;
        lotissement: string | null;
      };
      const [suivisRes, annoncesRes] = await Promise.all([
        supabase.rpc("mes_suivis"),
        supabase.from("annonces_marketplace").select("lot_id,titre,zone").in("lot_id", lotIds),
      ]);
      if (suivisRes.error) echecs.push(messageLecture("les terrains que vous suivez", suivisRes.error));
      if (annoncesRes.error) echecs.push(messageLecture("les annonces liées à vos demandes", annoncesRes.error));
      for (const s of (suivisRes.data ?? []) as SuiviLabel[]) {
        if (!lotIds.includes(s.lot_id)) continue;
        lotMap[s.lot_id] = {
          lotissement: s.lotissement,
          ilot: s.ilot_numero,
          lot: s.numero_lot,
          village: null,
          commune: null,
        };
      }
      for (const a of (annoncesRes.data ?? []) as {
        lot_id: string;
        titre: string | null;
        zone: string | null;
      }[]) {
        // Le suivi gagne : il porte la référence cadastrale, l'annonce non.
        if (lotMap[a.lot_id]) continue;
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
      if (vRes.error) echecs.push(messageLecture("vos ventes", vRes.error));
      if (cRes.error) echecs.push(messageLecture("vos certificats de vente", cRes.error));
      if (vpRes.error) echecs.push(messageLecture("les paiements de vos ventes", vpRes.error));
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
      if (aRes.error) echecs.push(messageLecture("vos attestations de cession", aRes.error));
      if (apRes.error) echecs.push(messageLecture("les paiements de vos attestations", apRes.error));
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

    // Volontairement PAS `chargeErreur` : celui-là escamote toute la liste des
    // achats, ce qui serait faux ici — les demandes, elles, ont bien été lues.
    // Une lecture secondaire tombée rend la page INCOMPLÈTE, pas illisible.
    setDetailErreur(echecs.length ? echecs.join(" · ") : null);
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

  /**
   * Lecture GRATUITE de son propre acte — première phrase de la consigne du
   * propriétaire du projet : « toute attestation générée devra pouvoir être
   * lisible par les parties concernées ». L'acquéreur était la seule des quatre
   * parties nommées à ne rien lire : cet écran ne renvoyait que vers
   * `/verifier`, c'est-à-dire vers le guichet payant, pour un acte dont il est
   * partie. On ajoute le chemin manquant, on n'en retire aucun.
   *
   * `telecharger-document` est le levier propre : il relit la ligne avec le
   * jeton de l'appelant (RLS appliquées) AVANT de signer l'URL en service_role.
   * Aucune autorisation n'est dupliquée ici, et le bucket `documents` reste
   * privé — il n'a d'ailleurs aucune policy SELECT sur le préfixe
   * `attestations_cession/`, donc l'accès direct au Storage reste fermé.
   */
  const telechargerAttestation = async (reference: string) => {
    setDlEnCours(reference);
    setDlErreur(null);
    const res = await invokeEdge<{ url: string }>(
      supabase,
      "telecharger-document",
      { table: "attestations_cession", reference },
      REPLI_TRANSPORT,
    );
    setDlEnCours(null);

    // 🔴 On LIT l'erreur. Un refus d'accès (403) et un fichier pas encore
    // généré (404) sont deux faits différents, et aucun des deux ne doit
    // s'afficher comme l'autre — ni comme un simple bouton qui ne réagit pas.
    if (res.error || !res.data?.url) {
      const message = res.error ?? REPLI_TRANSPORT;
      setDlErreur({ reference, message, incertain: message === REPLI_TRANSPORT });
      return;
    }
    // Même geste que /dashboard/documents : l'URL signée expire en 120 s, on
    // l'ouvre tout de suite plutôt que de la garder en mémoire.
    window.open(res.data.url, "_blank", "noopener,noreferrer");
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

      {/* La liste des achats n'a PAS pu être lue : on le dit. La faire
          disparaître en silence reviendrait à affirmer « vous n'avez aucun
          achat », ce qui n'a pas été mesuré. */}
      {!loading && chargeErreur && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-danger/30 bg-danger-subtle px-4 py-4"
        >
          <p className="text-sm font-semibold text-foreground">
            Impossible d&apos;afficher vos achats pour le moment.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Cela ne veut pas dire que vous n&apos;avez aucun achat en cours : la donnée n&apos;a
            pas pu être lue. Vérifiez votre connexion, puis réessayez.
          </p>
          <p className="font-mono text-[11px] break-words text-muted-2">{chargeErreur}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => void recharger()}
          >
            Réessayer
          </Button>
        </div>
      )}

      {!loading && !chargeErreur && detailErreur && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger-subtle px-4 py-3 text-sm font-medium text-danger">
          Page INCOMPLÈTE — {detailErreur}
        </p>
      )}

      {/* Achats en cours : l'ancien tunnel agence, conservé, mais secondaire —
          affiché seulement s'il existe une demande/vente réelle. */}
      {loading || chargeErreur ? null : demandes.length > 0 ? (
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
                dlEnCours={dlEnCours}
                dlErreur={dlErreur}
                onTelecharger={telechargerAttestation}
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
  dlEnCours,
  dlErreur,
  onTelecharger,
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
  dlEnCours: string | null;
  dlErreur: DlErreur | null;
  onTelecharger: (reference: string) => void;
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

  // Une ANNONCE ne porte ni îlot ni numéro de lot (ce sont des données du
  // registre, pas du catalogue) ; un SUIVI, si. On titre donc par la référence
  // cadastrale quand on l'a, sinon par l'intitulé, plutôt que d'afficher
  // « Lot ? · Îlot ? ».
  const refCadastrale =
    lot && (lot.lot != null || lot.ilot != null)
      ? `Lot ${lot.lot ?? "?"} · Îlot ${lot.ilot ?? "?"}`
      : null;
  // Dernier repli : « Terrain demandé » et non « Mon terrain ». Une demande
  // peut être `refusee` — l'unique demande de la base l'est — et titrer
  // « Mon terrain » sur une demande non retenue affirme une propriété qui
  // n'existe pas. Le repli doit rester vrai dans tous les états de la carte.
  const titreLot = refCadastrale ?? lot?.lotissement ?? "Terrain demandé";
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
            dlEnCours={dlEnCours}
            dlErreur={dlErreur}
            onTelecharger={onTelecharger}
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
  dlEnCours,
  dlErreur,
  onTelecharger,
}: {
  certificat: Doc | undefined;
  attestation: Doc | undefined;
  attPaie: Paie | undefined;
  hasCession: boolean;
  payingId: string | null;
  onPayer: (id: string) => void;
  dlEnCours: string | null;
  dlErreur: DlErreur | null;
  onTelecharger: (reference: string) => void;
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
        <div className="space-y-2">
          {/* Action principale : LIRE SON PROPRE ACTE, gratuitement. */}
          <Button
            variant="primary"
            loading={dlEnCours === attestation.reference}
            onClick={() => onTelecharger(attestation.reference)}
            className="h-auto w-full rounded-xl py-4 text-base font-bold"
          >
            {dlEnCours !== attestation.reference && <Download className="size-5" aria-hidden />}
            {dlEnCours === attestation.reference ? "Ouverture…" : "Voir mon attestation"}
          </Button>
          <p className="text-center text-xs text-muted-2">
            Gratuit — c&apos;est votre document ({attestation.reference}).
          </p>

          {/* Le refus et la panne ne disent PAS la même chose : on affiche le
              motif rendu par le serveur, et on ne prétend jamais « vous n'avez
              pas ce document » quand on n'a rien pu lire du tout. */}
          {dlErreur && dlErreur.reference === attestation.reference && (
            <div
              role="alert"
              className="flex flex-col gap-1.5 rounded-xl border border-danger/30 bg-danger-subtle px-4 py-3"
            >
              <p className="text-sm font-semibold text-foreground">
                {dlErreur.incertain
                  ? "Nous n'avons pas pu ouvrir votre attestation."
                  : "Votre attestation n'a pas pu être ouverte."}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">{dlErreur.message}</p>
              {dlErreur.incertain && (
                <p className="text-xs leading-relaxed text-muted-2">
                  Cela ne veut pas dire que le document n&apos;existe pas : la demande n&apos;a
                  pas abouti.
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 self-start"
                onClick={() => onTelecharger(attestation.reference)}
              >
                Réessayer
              </Button>
            </div>
          )}

          {/* ⚠️ CONSERVÉ : la vérification publique opposable est un AUTRE
              besoin (montrer l'acte à un tiers, contrôle d'authenticité). Elle
              reste payante pour les tiers — on n'y touche pas. */}
          <a
            href={verifUrl(attestation.reference)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent flex items-center justify-center gap-1.5 pt-1 text-xs font-semibold underline decoration-dotted hover:no-underline"
          >
            <ShieldCheck className="size-3.5" aria-hidden />
            Page de vérification publique
          </a>
        </div>
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
