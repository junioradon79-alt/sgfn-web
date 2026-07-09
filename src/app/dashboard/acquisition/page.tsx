"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  BadgeCheck,
  CheckCircle2,
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
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/utils/supabase/client";

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
    <div className="flex h-full items-center justify-center bg-slate-100">
      <Loader2 className="h-5 w-5 animate-spin text-[#0D3B66]" />
    </div>
  ),
});

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
};

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

export default function AcquisitionPage() {
  const supabase = useMemo(() => createClient(), []);

  const [conformite, setConformite] = useState<ConformiteRow[]>([]);
  const [lots, setLots] = useState<DispoRow[]>([]);
  const [filterLz, setFilterLz] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [interetState, setInteretState] = useState<Record<string, "idle" | "loading" | "done" | "error">>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [detailLot, setDetailLot] = useState<DispoRow | null>(null);

  useEffect(() => {
    (async () => {
      const [conf, dispo] = await Promise.all([
        supabase.rpc("conformite_lotissements"),
        supabase.rpc("lots_verifiables"),
      ]);
      setConformite((conf.data ?? []) as unknown as ConformiteRow[]);
      setLots((dispo.data ?? []) as unknown as DispoRow[]);
      setLoading(false);
    })();
  }, [supabase]);

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

  return (
    <div className="mx-auto max-w-5xl">
      {detailLot && (
        <LotDetailsModal
          lot={detailLot}
          conformite={conformite.find((c) => c.lotissement === detailLot.lotissement) ?? null}
          interet={interetState[detailLot.lot_id] ?? "idle"}
          onManifester={() => void manifester(detailLot)}
          onClose={() => setDetailLot(null)}
        />
      )}

      {/* En-tête */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-primary">Acquérir un lot</h1>
          <p className="mt-1.5 text-sm sm:text-base text-slate-500">
            Registre foncier vérifiable — contrôlez l&apos;authenticité d&apos;un lot avant toute acquisition.
          </p>
        </div>
        <Link
          href="/dashboard/messages"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200/60 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <MessageSquare className="h-4 w-4 text-[#0D3B66]" />
          Mes messages
        </Link>
      </div>

      {flash && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2D8F5A]" />
          <span>{flash}</span>
        </div>
      )}

      {/* Conformité par lotissement */}
      <section className="mb-6">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-800">Conformité par lotissement</h2>
          <p className="text-xs text-slate-400">Statut juridique global avant tout intérêt</p>
        </div>
        {loading ? (
          <div className="rounded-xl border border-slate-200/60 bg-white px-5 py-8 text-center text-sm text-slate-500">
            Chargement…
          </div>
        ) : conformite.length === 0 ? (
          <div className="rounded-xl border border-slate-200/60 bg-white px-5 py-8 text-center text-sm text-slate-500">
            Aucun lotissement enregistré.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {conformite.map((c, i) => {
              const apfcOk = c.apfc_statut === "delivree";
              const noLitige = (c.litiges_actifs ?? 0) === 0;
              return (
                <div key={`${c.lotissement}-${i}`} className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold text-slate-800">{c.lotissement ?? "—"}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
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
                      <div key={s.l} className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                        <p className="text-lg font-bold tabular-nums text-[#0D3B66]">{s.v}</p>
                        <p className="text-[11px] text-slate-400">{s.l}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        apfcOk ? "bg-[#2D8F5A]/10 text-[#2D8F5A]" : "bg-[#F39C12]/10 text-[#F39C12]"
                      }`}
                    >
                      {apfcOk ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                      APFC {c.apfc_statut ?? "non délivrée"}
                      {fmtDate(c.apfc_date_delivrance) && ` · ${fmtDate(c.apfc_date_delivrance)}`}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        noLitige ? "bg-[#2D8F5A]/10 text-[#2D8F5A]" : "bg-[#EF4444]/10 text-[#EF4444]"
                      }`}
                    >
                      {noLitige ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                      {noLitige ? "Aucun litige actif" : `${c.litiges_actifs} litige(s) actif(s)`}
                    </span>
                    {c.autorite_coutumiere && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Autorité : {c.autorite_coutumiere}
                      </span>
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
          <h2 className="text-sm font-semibold text-slate-800">Lots du registre</h2>
          <p className="text-xs text-slate-400">
            {lots.length} lot(s) attribué(s) — vérifiez l&apos;authenticité et le propriétaire avant d&apos;acquérir
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
          <div className="rounded-xl border border-slate-200/60 bg-white px-5 py-8 text-center text-sm text-slate-500">
            Chargement…
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-xl border border-slate-200/60 bg-white px-5 py-8 text-center text-sm text-slate-500">
            Aucun lot disponible dans ce filtre.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((l) => {
              const state = interetState[l.lot_id] ?? "idle";
              const isOp = !!l.est_lot_operateur;
              return (
                <div
                  key={l.lot_id}
                  className={`flex flex-col rounded-xl border p-4 shadow-sm ${
                    isOp ? "border-[#9C6406]/40 bg-[#F6ECD6]/40" : "border-slate-200/60 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-xs text-slate-400">
                      Îlot {l.ilot} · Lot {l.lot}
                    </p>
                    {isOp && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#9C6406]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9C6406]">
                        Lot opérateur
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                    <Landmark className="h-3.5 w-3.5 text-[#0D3B66]" />
                    {l.lotissement}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {l.village} · {l.commune}
                  </p>
                  {isOp && l.operateur_nom && (
                    <p className="mt-1 text-xs font-medium text-[#9C6406]">
                      Cédé par l&apos;opérateur · {l.operateur_nom}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetailLot(l)}
                    className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0D3B66] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0a2f52]"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Vérifier
                  </button>
                  {state === "done" && (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[#2D8F5A]">
                      <CheckCircle2 className="h-3 w-3" /> Intérêt déjà transmis
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
          « Vérifier » ouvre la consultation officielle du registre SGNF (authenticité, propriétaire
          actuel, litiges éventuels) — acte payant de {" "}
          <span className="font-semibold text-slate-600">60 000 FCFA</span>, gratuit pour la 1re
          attestation d&apos;un lot. « Manifester un intérêt » (dans le détail du lot) envoie en plus un
          message à l&apos;opérateur, au chef de famille et à l&apos;agence SGNF, sans réservation automatique.
        </p>
      </section>
    </div>
  );
}

function LotDetailsModal({
  lot,
  conformite,
  interet,
  onManifester,
  onClose,
}: {
  lot: DispoRow;
  conformite: ConformiteRow | null;
  interet: "idle" | "loading" | "done" | "error";
  onManifester: () => void;
  onClose: () => void;
}) {
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 px-6 py-4">
          <div>
            <p className="font-mono text-xs text-slate-400">
              Îlot {lot.ilot} · Lot {lot.lot}
            </p>
            <h2 className="mt-0.5 flex items-center gap-1.5 text-base font-bold text-[#0D3B66]">
              <Landmark className="h-4 w-4" />
              {lot.lotissement}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#2D8F5A]/10 px-2 py-0.5 text-[11px] font-semibold text-[#2D8F5A]">
                <CheckCircle2 className="h-3 w-3" /> Libre
              </span>
              {isOp && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#9C6406]/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#9C6406]">
                  Lot opérateur
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Vérification — CTA principal */}
          <div className="rounded-xl border border-[#0D3B66]/20 bg-[#0D3B66]/[0.03] p-4">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0D3B66]" />
              <div>
                <p className="text-sm font-semibold text-[#0D3B66]">Vérifier ce lot</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Consultation officielle du registre SGNF : authenticité, propriétaire actuel et
                  litiges éventuels. Acte payant de{" "}
                  <span className="font-semibold text-[#0D3B66]">60 000 FCFA</span>{" "}
                  (gratuit pour la 1re attestation d&apos;un lot).
                </p>
              </div>
            </div>
            {attRef && (
              <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
                <div className="shrink-0 rounded-lg border border-slate-200 bg-white p-2">
                  <QRCodeSVG value={verifUrl(attRef)} size={104} bgColor="#ffffff" fgColor="#0D3B66" level="M" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-xs text-slate-500">Scannez le QR avec un téléphone, ou :</p>
                  <a
                    href={verifUrl(attRef)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#0D3B66] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1E6091]"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Ouvrir la vérification
                  </a>
                  <p className="mt-2 font-mono text-[11px] text-slate-400">Réf. {attRef}</p>
                </div>
              </div>
            )}
          </div>

          {/* Carte */}
          <div>
            <div className="h-56 overflow-hidden rounded-xl border border-slate-200/60">
              {lat != null && lng != null ? (
                <LotDetailMap lat={lat} lng={lng} label={`${lot.lotissement} — Lot ${lot.lot}`} approx={approx} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-50 text-center text-sm text-slate-400">
                  <MapPinOff className="h-6 w-6 text-slate-300" />
                  Localisation non encore positionnée sur la carte.
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between">
              {approx && (
                <p className="text-[11px] text-slate-400">Position approximative (niveau lotissement).</p>
              )}
              {lat != null && lng != null && (
                <a
                  href={googleMapsDirectionsUrl(lat, lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0D3B66] transition-colors hover:bg-slate-50"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Itinéraire
                </a>
              )}
            </div>
          </div>

          {/* Faits */}
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label} className="rounded-xl border border-slate-200/60 bg-slate-50/60 px-4 py-3">
                <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  <f.icon className="h-3.5 w-3.5" />
                  {f.label}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-800">{f.value}</dd>
              </div>
            ))}
          </dl>
          {isOp && lot.operateur_nom && (
            <p className="-mt-2 text-xs font-medium text-[#9C6406]">
              Lot cédé par l&apos;opérateur · {lot.operateur_nom}
            </p>
          )}

          {/* Conformité du lotissement */}
          {conformite && (
            <div className="rounded-xl border border-slate-200/60 p-4">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Conformité juridique du lotissement
              </p>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    apfcOk ? "bg-[#2D8F5A]/10 text-[#2D8F5A]" : "bg-[#F39C12]/10 text-[#F39C12]"
                  }`}
                >
                  {apfcOk ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                  APFC {conformite.apfc_statut ?? "non délivrée"}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    noLitige ? "bg-[#2D8F5A]/10 text-[#2D8F5A]" : "bg-[#EF4444]/10 text-[#EF4444]"
                  }`}
                >
                  {noLitige ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                  {noLitige ? "Aucun litige actif" : `${conformite.litiges_actifs} litige(s) actif(s)`}
                </span>
                {conformite.autorite_coutumiere && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {conformite.autorite_coutumiere}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pied : action */}
        <div className="flex flex-col gap-2 border-t border-slate-200/60 px-6 py-4 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:flex-1"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={onManifester}
            disabled={interet === "loading" || interet === "done"}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-70 sm:flex-1 ${
              interet === "error"
                ? "border-[#EF4444] text-[#EF4444]"
                : interet === "done"
                  ? "border-[#2D8F5A] bg-[#2D8F5A]/5 text-[#2D8F5A]"
                  : "border-[#0D3B66]/30 text-[#0D3B66] hover:bg-[#0D3B66]/5"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            {interet === "loading"
              ? "Envoi…"
              : interet === "done"
                ? "Intérêt transmis ✓"
                : interet === "error"
                  ? "Erreur — réessayer"
                  : "Manifester un intérêt"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-[#0D3B66] bg-[#0D3B66] text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
