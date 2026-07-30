"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Handshake,
  Landmark,
  Loader2,
  MapPin,
  MapPinOff,
  Maximize2,
  MessageSquare,
  Navigation,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import {
  Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ds/dialog";
import { Field } from "@/components/ds/label";
import { Input, Textarea } from "@/components/ds/input";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";

// Lien public de vérification d'un document (scannable / partageable). Utilise
// l'origine courante : https://sgfn.ci/... en prod, localhost en dev.
const verifUrl = (reference: string) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://sgfn.ci";
  return `${origin}/verifier?ref=${encodeURIComponent(reference)}`;
};

// Carte mono-point du modal détails — Leaflet a besoin des APIs browser.
const LotDetailMap = dynamic(() => import("./_LotDetailMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-inset">
      <Loader2 className="h-5 w-5 animate-spin text-accent" />
    </div>
  ),
});

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const NATURE_DROIT_LABELS: Record<string, string> = {
  droit_coutumier: "Droit coutumier",
  attestation_villageoise: "Attestation villageoise",
  certificat_foncier: "Certificat foncier",
  acd: "ACD (Arrêté de Concession Définitive)",
  titre_foncier: "Titre foncier",
};

const fmtSuperficie = (m2: number | null) => {
  if (m2 == null) return null;
  const base = `${new Intl.NumberFormat("fr-FR").format(m2)} m²`;
  return m2 >= 10000 ? `${base} · ${(m2 / 10000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ha` : base;
};

// Une annonce marketplace ne porte ni îlot ni numéro de lot : ce sont des
// données du REGISTRE, pas du catalogue — c'est précisément la séparation que
// le rebranchement du 30/07/2026 vient rétablir. On n'affiche donc ce libellé
// que lorsqu'il existe, au lieu d'écrire « Îlot null · Lot null ».
const refCadastrale = (ilot: string | number | null, lot: string | number | null) =>
  ilot != null || lot != null ? `Îlot ${ilot ?? "—"} · Lot ${lot ?? "—"}` : null;

const fmtPrix = (v: number | null) =>
  v == null ? null : `${new Intl.NumberFormat("fr-FR").format(v)} FCFA`;

const googleMapsDirectionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

/**
 * Espace Acquisition — destiné aux visiteurs en quête de lots (acquéreurs).
 * Affiche la conformité juridique par lotissement (avant toute prise de contact)
 * et les lots disponibles. Le bouton « Manifester un intérêt » appelle la RPC
 * `manifester_interet` qui route la conversation vers l'opérateur du lotissement,
 * le chef de famille et l'admin SGNF. Porté depuis `sgfn_espace_amenageur_2.html`.
 */

type ConformiteRow = {
  lotissement: string | null;
  village: string | null;
  commune: string | null;
  district: string | null;
  superficie: string | null;
  nb_lots: number | null;
  nb_lots_libres: number | null;
  nb_ilots: number | null;
  apfc_statut: string | null;
  apfc_date_delivrance: string | null;
  litiges_actifs: number | null;
  autorite_coutumiere: string | null;
};

type DispoRow = {
  lot_id: string;
  lotissement_id: string;
  ilot: string | number | null;
  lot: string | number | null;
  lotissement: string | null;
  village: string | null;
  commune: string | null;
  district: string | null;
  est_lot_operateur: boolean | null;
  operateur_nom: string | null;
  superficie_m2: number | null;
  numero_parcelle: string | null;
  nature_droit: string | null;
  lot_latitude: number | null;
  lot_longitude: number | null;
  lz_latitude: number | null;
  lz_longitude: number | null;
  lz_superficie_texte: string | null;
  attestation_reference: string | null;
  attestation_statut: string | null;
  prix: number | null;
};

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

type DemandeRow = {
  id: string;
  lot_id: string;
  statut: string;
  montant_propose: number | null;
  cree_le: string;
};

// Libellé + ton (Badge DS) de chaque statut de demande d'acquisition (acquéreur).
const DEMANDE_STATUTS: Record<string, { label: string; tone: BadgeTone }> = {
  nouvelle: { label: "Demande envoyée", tone: "accent" },
  en_discussion: { label: "En discussion", tone: "warning" },
  accord: { label: "Accord de principe", tone: "success" },
  convertie: { label: "Achat en cours", tone: "warning" },
  refusee: { label: "Non retenue", tone: "danger" },
  annulee: { label: "Annulée", tone: "neutral" },
};

export default function AcquisitionPage() {
  const supabase = useMemo(() => createClient(), []);
  const { counts } = useBadgeCounts();

  const [conformite, setConformite] = useState<ConformiteRow[]>([]);
  const [lots, setLots] = useState<DispoRow[]>([]);
  const [demandes, setDemandes] = useState<DemandeRow[]>([]);
  const [filterLz, setFilterLz] = useState<string>("all");
  const [interetState, setInteretState] = useState<Record<string, "idle" | "loading" | "done" | "error">>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [detailLot, setDetailLot] = useState<DispoRow | null>(null);

  // Pastilles « déjà demandé » sur les cartes de lot. Le suivi complet de l'achat
  // (paiement du terrain, certificat, attestation) vit sur « Mon achat ».
  const loadDemandes = useCallback(async () => {
    const { data } = await supabase
      .from("demandes_acquisition")
      .select("id,lot_id,statut,montant_propose,cree_le")
      .order("cree_le", { ascending: false });
    setDemandes((data ?? []) as DemandeRow[]);
  }, [supabase]);

  /**
   * Catalogue = annonces marketplace ACTIVES, et rien d'autre.
   *
   * 🔴 Cet écran lisait `lots_verifiables()`. Cette RPC est SECURITY DEFINER,
   * son `execute` était accordé à `authenticated`, et son corps ne portait
   * AUCUNE garde. Mesure du 30/07/2026 par emprunt de rôle : un acquéreur
   * n'ayant droit à rien en obtenait 49 références — exactement le même
   * chiffre que l'admin, ce qui est la signature d'une absence de périmètre,
   * pas d'un droit. Or `attestation_reference` suffit ensuite à obtenir
   * gratuitement, via /verifier, le propriétaire actuel et l'historique
   * complet du lot. Ce n'était pas un catalogue de vente : c'était le
   * registre entier, servi à tout utilisateur connecté.
   *
   * Depuis la migration 20260730060000, `lots_verifiables()` lève 42501 pour
   * qui n'a aucun périmètre. Cet écran lit donc les ANNONCES : « ce qui est à
   * vendre » cesse d'être confondu avec « ce qui est attesté ».
   *
   * On lit `annonces_marketplace` en direct et NON la vue `annonces_publiques`,
   * qui joint `lots` : la RLS de `lots` rendrait cette vue vide pour un
   * acquéreur prospect. Vérifié : la vue n'est déjà réellement lisible ni par
   * `anon` ni hors périmètre, pour cette raison précise.
   *
   * ⚠️ La base compte aujourd'hui 1 annonce, au statut `suspendue` — donc
   * 0 active. Cet écran est VIDE, et c'est l'état réel du stock, pas une
   * régression. L'état vide ci-dessous le dit en toutes lettres.
   */
  const chargerCatalogue = useCallback(async (): Promise<DispoRow[]> => {
    const { data } = await supabase
      .from("annonces_marketplace")
      .select("id,lot_id,titre,description,prix,usage,zone,superficie_m2,publiee_le")
      .eq("statut", "active")
      .order("publiee_le", { ascending: false });

    type Annonce = {
      lot_id: string;
      titre: string | null;
      prix: number | null;
      usage: string | null;
      zone: string | null;
      superficie_m2: number | null;
    };

    // L'annonce ne porte AUCUNE référence d'attestation, et c'est voulu :
    // la vérification reste un acte payant, elle ne se donne pas avec le
    // catalogue. `attestation_reference: null` masque donc le bloc QR.
    return ((data ?? []) as Annonce[]).map((a) => ({
      lot_id: a.lot_id,
      lotissement_id: "",
      ilot: null,
      lot: null,
      lotissement: a.titre,
      village: a.zone,
      commune: null,
      district: null,
      est_lot_operateur: false,
      operateur_nom: null,
      superficie_m2: a.superficie_m2,
      numero_parcelle: null,
      nature_droit: a.usage,
      lot_latitude: null,
      lot_longitude: null,
      lz_latitude: null,
      lz_longitude: null,
      lz_superficie_texte: null,
      attestation_reference: null,
      attestation_statut: null,
      prix: a.prix,
    }));
  }, [supabase]);

  const { isLoading: loading, recharger } = useChargement(async () => {
    const [conf, catalogue] = await Promise.all([
      supabase.rpc("conformite_lotissements"),
      chargerCatalogue(),
      loadDemandes(),
    ]);
    setConformite((conf.data ?? []) as unknown as ConformiteRow[]);
    setLots(catalogue);
  });

  const demandeByLot = useMemo(
    () => Object.fromEntries(demandes.map((d) => [d.lot_id, d])) as Record<string, DemandeRow>,
    [demandes]
  );

  const lzNames = useMemo(
    () => [...new Set(lots.map((l) => l.lotissement).filter(Boolean))] as string[],
    [lots]
  );
  const shown = filterLz === "all" ? lots : lots.filter((l) => l.lotissement === filterLz);

  const manifester = async (lot: DispoRow) => {
    setInteretState((s) => ({ ...s, [lot.lot_id]: "loading" }));
    const { error } = await supabase.rpc("manifester_interet", { p_lot_id: lot.lot_id });

    if (error) {
      setInteretState((s) => ({ ...s, [lot.lot_id]: "error" }));
      setTimeout(() => setInteretState((s) => ({ ...s, [lot.lot_id]: "idle" })), 3000);
      return;
    }
    setInteretState((s) => ({ ...s, [lot.lot_id]: "done" }));
    setFlash(
      `Votre intérêt pour le lot ${lot.lot} (${lot.lotissement}) a été transmis à l'opérateur, au chef de famille et à l'agence SGNF. Suivez l'échange dans Messages.`
    );
  };

  // Engage formel : crée une demande d'acquisition pilotable par l'agence
  // (statut, offre) qui pourra être convertie en cession en un clic.
  const engager = async (
    lot: DispoRow,
    form: { telephone: string; montant: string; message: string }
  ): Promise<string | null> => {
    const montantNum = form.montant.replace(/[^\d]/g, "");
    const { error } = await supabase.rpc("creer_demande_acquisition", {
      p_lot_id: lot.lot_id,
      p_telephone: form.telephone.trim() || undefined,
      p_montant: montantNum ? Number(montantNum) : undefined,
      p_message: form.message.trim() || undefined,
    });
    if (error) return error.message;
    await loadDemandes();
    setDetailLot(null);
    setFlash(
      `Votre demande d'acquisition pour le lot ${lot.lot} (${lot.lotissement}) a été enregistrée. ` +
        `L'agence SGNF vous recontactera pour finaliser. Suivez l'échange dans Messages.`
    );
    return null;
  };

  return (
    <AppShell loading={loading} counts={counts} onRefresh={recharger}>
      {detailLot && (
        <LotDetailsModal
          lot={detailLot}
          conformite={conformite.find((c) => c.lotissement === detailLot.lotissement) ?? null}
          interet={interetState[detailLot.lot_id] ?? "idle"}
          demande={demandeByLot[detailLot.lot_id] ?? null}
          onManifester={() => void manifester(detailLot)}
          onEngager={(form) => engager(detailLot, form)}
          onClose={() => setDetailLot(null)}
        />
      )}

      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Trouver un terrain
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Registre foncier vérifiable — contrôlez l&apos;authenticité d&apos;un terrain avant de vous engager.
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/dashboard/messages">
            <MessageSquare className="h-4 w-4 text-accent" />
            Mes messages
          </Link>
        </Button>
      </div>

      {flash && (
        <div className="flex items-start gap-2.5 rounded-xl border border-success/25 bg-success-subtle px-4 py-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{flash}</span>
        </div>
      )}

      {/* Le suivi de l'achat (paiement du terrain, certificat, attestation) vit
          désormais sur « Mon achat » (/dashboard/mon-achat). Ici on ne fait que
          trouver et vérifier un terrain, puis engager la demande. */}
      {demandes.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/30 bg-success-subtle px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <ClipboardCheck className="h-4 w-4 shrink-0 text-success" />
            Vous avez {demandes.length} demande{demandes.length > 1 ? "s" : ""} en cours.
          </p>
          <Button asChild variant="primary" size="sm">
            <Link href="/dashboard/mon-achat">Suivre mon achat</Link>
          </Button>
        </div>
      )}

      {/* Conformité par lotissement */}
      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-foreground">Conformité par lotissement</h2>
          <p className="text-xs text-muted-2">Statut juridique global avant tout intérêt</p>
        </div>
        {loading ? (
          <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-panel">
            Chargement…
          </div>
        ) : conformite.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-panel">
            Aucun lotissement enregistré.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {conformite.map((c, i) => {
              const apfcOk = c.apfc_statut === "delivree";
              const noLitige = (c.litiges_actifs ?? 0) === 0;
              return (
                <div key={`${c.lotissement}-${i}`} className="rounded-xl border border-border bg-card p-5 shadow-panel">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold text-foreground">{c.lotissement ?? "—"}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {c.village ?? "—"} · {c.commune ?? "—"} · {c.district ?? "—"}
                        {c.superficie && ` — ${c.superficie}`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { v: c.nb_lots ?? 0, l: "lots au total" },
                      { v: c.nb_lots_libres ?? 0, l: "disponibles" },
                      { v: c.nb_ilots ?? 0, l: "îlots" },
                    ].map((s) => (
                      <div key={s.l} className="rounded-lg bg-inset px-3 py-2 text-center">
                        <p className="text-lg font-bold tabular-nums text-accent">{s.v}</p>
                        <p className="text-[11px] text-muted-2">{s.l}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={apfcOk ? "success" : "warning"}>
                      {apfcOk ? <ShieldCheck /> : <ShieldAlert />}
                      APFC {c.apfc_statut ?? "non délivrée"}
                      {fmtDate(c.apfc_date_delivrance) && ` · ${fmtDate(c.apfc_date_delivrance)}`}
                    </Badge>
                    <Badge tone={noLitige ? "success" : "danger"}>
                      {noLitige ? <CheckCircle2 /> : <ShieldAlert />}
                      {noLitige ? "Aucun litige actif" : `${c.litiges_actifs} litige(s) actif(s)`}
                    </Badge>
                    {c.autorite_coutumiere && (
                      <Badge tone="neutral">
                        <BadgeCheck />
                        Autorité : {c.autorite_coutumiere}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Lots disponibles */}
      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-foreground">Terrains en vente</h2>
          <p className="text-xs text-muted-2">
            {lots.length} annonce(s) en ligne — vérifiez l&apos;authenticité et le propriétaire avant d&apos;acquérir
          </p>
        </div>

        {!loading && lzNames.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            <FilterChip active={filterLz === "all"} onClick={() => setFilterLz("all")}>
              Tous ({lots.length})
            </FilterChip>
            {lzNames.map((n) => (
              <FilterChip key={n} active={filterLz === n} onClick={() => setFilterLz(n)}>
                {n} ({lots.filter((l) => l.lotissement === n).length})
              </FilterChip>
            ))}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-panel">
            Chargement…
          </div>
        ) : shown.length === 0 ? (
          /* État vide SOIGNÉ, et distinct selon la cause : « le filtre ne
             ramène rien » n'est pas « le catalogue est vide ». Au 30/07/2026
             c'est le second cas — 1 annonce en base, suspendue, donc 0 active :
             l'écran doit le dire, pas tourner dans le vide. */
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-5 py-10 text-center shadow-panel">
            <MapPinOff className="h-7 w-7 text-muted-2" aria-hidden />
            {lots.length === 0 ? (
              <>
                <p className="text-sm font-semibold text-foreground">
                  Aucun terrain n&apos;est actuellement en vente
                </p>
                <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                  Les annonces publiées par les propriétaires et les opérateurs apparaîtront ici dès
                  leur mise en ligne. En attendant, vous pouvez consulter la conformité des
                  lotissements ci-dessus, ou nous écrire pour faire part de votre recherche.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href="/dashboard/messages">
                    <MessageSquare className="h-4 w-4 text-accent" />
                    Décrire ma recherche
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">Aucun terrain dans ce filtre</p>
                <p className="text-xs text-muted-foreground">
                  Essayez « Tous » pour voir les {lots.length} annonce(s) en ligne.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((l) => {
              const state = interetState[l.lot_id] ?? "idle";
              const dem = demandeByLot[l.lot_id];
              const isOp = !!l.est_lot_operateur;
              return (
                <div
                  key={l.lot_id}
                  className={`flex flex-col rounded-xl border p-4 shadow-panel ${
                    isOp ? "border-warning/40 bg-warning-subtle/40" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-xs text-muted-2">
                      {refCadastrale(l.ilot, l.lot) ?? "Annonce en ligne"}
                    </p>
                    {isOp && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                        Lot opérateur
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Landmark className="h-3.5 w-3.5 text-accent" />
                    {l.lotissement}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[l.village, l.commune].filter(Boolean).join(" · ") || "Localisation non précisée"}
                  </p>
                  {fmtPrix(l.prix) && (
                    <p className="mt-1 text-sm font-bold tabular-nums text-accent">{fmtPrix(l.prix)}</p>
                  )}
                  {isOp && l.operateur_nom && (
                    <p className="mt-1 text-xs font-medium text-warning">
                      Cédé par l&apos;opérateur · {l.operateur_nom}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => setDetailLot(l)}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Vérifier
                  </Button>
                  {dem ? (
                    <Badge tone={(DEMANDE_STATUTS[dem.statut] ?? { tone: "neutral" as BadgeTone }).tone} className="mt-1.5 self-start">
                      <Handshake />
                      {(DEMANDE_STATUTS[dem.statut] ?? { label: dem.statut }).label}
                    </Badge>
                  ) : (
                    state === "done" && (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-success">
                        <CheckCircle2 className="h-3 w-3" /> Intérêt déjà transmis
                      </p>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 rounded-xl bg-inset px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          « Vérifier » ouvre la consultation officielle du registre SGNF (authenticité, propriétaire
          actuel, litiges éventuels) — acte payant de{" "}
          <span className="font-semibold text-foreground">60 000 FCFA</span>, gratuit pour la 1re
          attestation d&apos;un lot. Dans le détail du lot, « Engager l&apos;acquisition » enregistre une
          demande suivie par l&apos;agence SGNF (avec votre offre éventuelle), tandis que « Manifester un
          intérêt » se limite à un message ; aucun paiement en ligne n&apos;est requis à ce stade.
        </p>
      </section>
    </AppShell>
  );
}

function LotDetailsModal({
  lot,
  conformite,
  interet,
  demande,
  onManifester,
  onEngager,
  onClose,
}: {
  lot: DispoRow;
  conformite: ConformiteRow | null;
  interet: "idle" | "loading" | "done" | "error";
  demande: DemandeRow | null;
  onManifester: () => void;
  onEngager: (form: { telephone: string; montant: string; message: string }) => Promise<string | null>;
  onClose: () => void;
}) {
  const [engaging, setEngaging] = useState(false);
  const [form, setForm] = useState({ telephone: "", montant: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [engageErr, setEngageErr] = useState<string | null>(null);

  const statutMeta = demande
    ? DEMANDE_STATUTS[demande.statut] ?? { label: demande.statut, tone: "neutral" as BadgeTone }
    : null;

  const submitEngage = async () => {
    setSubmitting(true);
    setEngageErr(null);
    const err = await onEngager(form);
    setSubmitting(false);
    if (err) setEngageErr(err);
  };
  const lat = lot.lot_latitude ?? lot.lz_latitude;
  const lng = lot.lot_longitude ?? lot.lz_longitude;
  const approx = lot.lot_latitude == null && lat != null;
  const isOp = !!lot.est_lot_operateur;
  const superficie = fmtSuperficie(lot.superficie_m2) ?? lot.lz_superficie_texte;
  const natureDroit = lot.nature_droit
    ? NATURE_DROIT_LABELS[lot.nature_droit] ?? lot.nature_droit
    : null;
  const localisation = [lot.village, lot.commune, lot.district].filter(Boolean).join(" · ");
  const apfcOk = conformite?.apfc_statut === "delivree";
  const noLitige = (conformite?.litiges_actifs ?? 0) === 0;
  const attRef = lot.attestation_reference;

  const facts: { icon: typeof Maximize2; label: string; value: string | null }[] = [
    { icon: Maximize2, label: "Superficie", value: superficie },
    { icon: ScrollText, label: "Nature du droit", value: natureDroit },
    { icon: MapPin, label: "Localisation", value: localisation || null },
    { icon: Landmark, label: "N° de parcelle", value: lot.numero_parcelle },
  ].filter((f) => f.value);

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <p className="font-mono text-xs text-muted-2">
            {refCadastrale(lot.ilot, lot.lot) ?? "Annonce en ligne"}
          </p>
          <DialogTitle className="flex items-center gap-1.5">
            <Landmark className="h-4 w-4 text-accent" />
            {lot.lotissement}
          </DialogTitle>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone="success"><CheckCircle2 /> Libre</Badge>
            {isOp && <Badge tone="warning">Lot opérateur</Badge>}
          </div>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {/* Vérification — CTA principal */}
          <div className="rounded-xl border border-accent/25 bg-accent-subtle p-4">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="text-sm font-semibold text-foreground">Vérifier ce lot</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Consultation officielle du registre SGNF : authenticité, propriétaire actuel et
                  litiges éventuels. Acte payant de{" "}
                  <span className="font-semibold text-accent">60 000 FCFA</span>{" "}
                  (gratuit pour la 1re attestation d&apos;un lot).
                </p>
              </div>
            </div>
            {attRef && (
              <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
                <div className="shrink-0 rounded-lg border border-border bg-white p-2">
                  <QRCodeSVG value={verifUrl(attRef)} size={104} bgColor="#ffffff" fgColor="#0B4D88" level="M" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-xs text-muted-foreground">Scannez le QR avec un téléphone, ou :</p>
                  <Button asChild variant="primary" size="sm" className="mt-2">
                    <a href={verifUrl(attRef)} target="_blank" rel="noopener noreferrer">
                      <ShieldCheck className="h-4 w-4" />
                      Ouvrir la vérification
                    </a>
                  </Button>
                  <p className="mt-2 font-mono text-[11px] text-muted-2">Réf. {attRef}</p>
                </div>
              </div>
            )}
            {/* Une annonce ne porte PAS la référence d'attestation : la donner
                ici reviendrait à offrir la consultation payante avec le
                catalogue — c'est exactement la fuite fermée le 30/07/2026. */}
            {!attRef && (
              <div className="mt-3 rounded-lg bg-card/70 px-3 py-2.5">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  La référence de vérification n&apos;est pas communiquée avec l&apos;annonce. Demandez-la
                  au vendeur, ou saisissez-la sur la page{" "}
                  <Link href="/verifier" className="font-semibold text-accent underline underline-offset-2">
                    Vérifier un document
                  </Link>{" "}
                  si vous la détenez déjà.
                </p>
              </div>
            )}
          </div>

          {/* Carte */}
          <div>
            <div className="h-56 overflow-hidden rounded-xl border border-border">
              {lat != null && lng != null ? (
                <LotDetailMap lat={lat} lng={lng} label={`${lot.lotissement} — Lot ${lot.lot}`} approx={approx} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 bg-inset text-center text-sm text-muted-2">
                  <MapPinOff className="h-6 w-6 text-muted-2" />
                  Localisation non encore positionnée sur la carte.
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between">
              {approx && (
                <p className="text-[11px] text-muted-2">Position approximative (niveau lotissement).</p>
              )}
              {lat != null && lng != null && (
                <Button asChild variant="outline" size="sm" className="ml-auto">
                  <a href={googleMapsDirectionsUrl(lat, lng)} target="_blank" rel="noopener noreferrer">
                    <Navigation className="h-3.5 w-3.5" />
                    Itinéraire
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Faits */}
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label} className="rounded-xl border border-border bg-inset px-4 py-3">
                <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-2">
                  <f.icon className="h-3.5 w-3.5" />
                  {f.label}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">{f.value}</dd>
              </div>
            ))}
          </dl>
          {isOp && lot.operateur_nom && (
            <p className="-mt-2 text-xs font-medium text-warning">
              Lot cédé par l&apos;opérateur · {lot.operateur_nom}
            </p>
          )}

          {/* Conformité du lotissement */}
          {conformite && (
            <div className="rounded-xl border border-border p-4">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Conformité juridique du lotissement
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge tone={apfcOk ? "success" : "warning"}>
                  {apfcOk ? <ShieldCheck /> : <ShieldAlert />}
                  APFC {conformite.apfc_statut ?? "non délivrée"}
                </Badge>
                <Badge tone={noLitige ? "success" : "danger"}>
                  {noLitige ? <CheckCircle2 /> : <ShieldAlert />}
                  {noLitige ? "Aucun litige actif" : `${conformite.litiges_actifs} litige(s) actif(s)`}
                </Badge>
                {conformite.autorite_coutumiere && (
                  <Badge tone="neutral">
                    <BadgeCheck />
                    {conformite.autorite_coutumiere}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </DialogBody>

        {/* Pied : engagement / actions */}
        <div className="border-t border-border p-5">
          {demande && statutMeta ? (
            /* Une demande existe déjà pour ce lot */
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="inline-flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                <Handshake className="h-4 w-4 shrink-0 text-accent" />
                Demande d&apos;acquisition enregistrée —
                <Badge tone={statutMeta.tone}>{statutMeta.label}</Badge>
              </p>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href="/dashboard/messages">
                    <MessageSquare className="h-4 w-4 text-accent" />
                    Messages
                  </Link>
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
              </div>
            </div>
          ) : engaging ? (
            /* Formulaire d'engagement */
            <div className="space-y-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Handshake className="h-4 w-4 text-accent" />
                  Engager l&apos;acquisition
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  L&apos;agence SGNF reçoit votre demande et vous recontacte pour convenir du prix et créer
                  la vente. Aucun paiement en ligne à ce stade.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Offre proposée (FCFA) — optionnel" htmlFor="engage-montant">
                  <Input
                    id="engage-montant"
                    inputMode="numeric"
                    value={form.montant}
                    onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
                    placeholder="Ex. 5 000 000"
                  />
                </Field>
                <Field label="Téléphone — optionnel" htmlFor="engage-tel">
                  <Input
                    id="engage-tel"
                    inputMode="tel"
                    value={form.telephone}
                    onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
                    placeholder="Rappel pour vous joindre"
                  />
                </Field>
              </div>
              <Field label="Message — optionnel" htmlFor="engage-message">
                <Textarea
                  id="engage-message"
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  rows={2}
                  placeholder="Précisez votre projet ou vos questions…"
                />
              </Field>
              {engageErr && (
                <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {engageErr}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="sm:flex-1"
                  disabled={submitting}
                  onClick={() => { setEngaging(false); setEngageErr(null); }}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="sm:flex-[2]"
                  loading={submitting}
                  onClick={() => void submitEngage()}
                >
                  {submitting ? null : <Handshake className="h-4 w-4" />}
                  {submitting ? "Envoi…" : "Envoyer la demande"}
                </Button>
              </div>
            </div>
          ) : (
            /* Actions par défaut */
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="sm:flex-1" onClick={onClose}>
                Fermer
              </Button>
              <Button
                type="button"
                variant="outline"
                className={`sm:flex-1 ${
                  interet === "error"
                    ? "text-danger hover:text-danger"
                    : interet === "done"
                      ? "text-success hover:text-success"
                      : ""
                }`}
                disabled={interet === "loading" || interet === "done"}
                onClick={onManifester}
              >
                <MessageSquare className="h-4 w-4" />
                {interet === "loading"
                  ? "Envoi…"
                  : interet === "done"
                    ? "Intérêt transmis ✓"
                    : interet === "error"
                      ? "Erreur — réessayer"
                      : "Manifester un intérêt"}
              </Button>
              <Button type="button" variant="primary" className="sm:flex-[1.4]" onClick={() => setEngaging(true)}>
                <Handshake className="h-4 w-4" />
                Engager l&apos;acquisition
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-border-strong"
      }`}
    >
      {children}
    </button>
  );
}
