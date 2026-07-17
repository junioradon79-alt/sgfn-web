"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2, MapPin, Eye, Tag, CheckCircle2, AlertTriangle, Store, Info,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";

// Leaflet a besoin des APIs browser → import dynamique ssr:false
import PhotosAnnonce from "./_PhotosAnnonce";

const VenteMap = dynamic(() => import("./_VenteMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-100">
      <Loader2 className="h-6 w-6 animate-spin text-[#0D3B66]" />
    </div>
  ),
});

const USAGES = [
  { value: "habitation", label: "Habitation" },
  { value: "commerce", label: "Commerce" },
  { value: "agricole", label: "Agricole" },
  { value: "industriel", label: "Industriel" },
];

type LotEligible = {
  id: string;
  numero_lot: string | null;
  superficie_m2: number | null;
  latitude: number | null;
  longitude: number | null;
  village: string | null;
  commune: string | null;
  lotissement: string | null;
  documentType: "attestation_cession" | "certificat_vente";
};

type AnnonceExistante = {
  id: string;
  lot_id: string;
  titre: string;
  prix: number | null;
  usage: string | null;
  zone: string | null;
  description: string | null;
  statut: string;
};

// Arrondi ~110 m, identique à la vue publique annonces_publiques
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Valeurs du formulaire pour un lot : reprise de l'annonce existante, sinon
 * proposition à partir du lot. Partagée par la sélection manuelle et par
 * l'arrivée depuis un bouton « Mettre en vente » (?lot=…).
 */
function valeursPour(lot: LotEligible | undefined, existante: AnnonceExistante | undefined) {
  if (existante) {
    return {
      titre: existante.titre ?? "",
      usage: existante.usage ?? "habitation",
      zone: existante.zone ?? lot?.commune ?? "",
      prix: existante.prix != null ? String(existante.prix) : "",
      description: existante.description ?? "",
      statut: (existante.statut === "brouillon" ? "brouillon" : "active") as "active" | "brouillon",
    };
  }
  return {
    titre: lot ? `Parcelle vérifiée ${lot.numero_lot ?? ""}`.trim() : "",
    usage: "habitation",
    zone: lot?.commune ?? lot?.village ?? "",
    prix: "",
    description: "",
    statut: "active" as const,
  };
}

function MettreEnVenteForm() {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useProfile();
  // Lot ciblé par le bouton « Mettre en vente » d'un espace propriétaire.
  const lotDemande = useSearchParams().get("lot");
  const lotDemandeApplique = useRef(false);

  const [lots, setLots] = useState<LotEligible[]>([]);
  const [annonces, setAnnonces] = useState<Record<string, AnnonceExistante>>({});
  const [loading, setLoading] = useState(true);

  // Formulaire
  const [lotId, setLotId] = useState("");
  const [titre, setTitre] = useState("");
  const [usage, setUsage] = useState("habitation");
  const [zone, setZone] = useState("");
  const [prix, setPrix] = useState("");
  const [description, setDescription] = useState("");
  const [statut, setStatut] = useState<"active" | "brouillon">("active");
  const [point, setPoint] = useState<[number, number] | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  /** Pose le lot et son préremplissage dans le formulaire. */
  const appliquer = useCallback(
    (lot: LotEligible | undefined, existante: AnnonceExistante | undefined) => {
      const v = valeursPour(lot, existante);
      setLotId(lot?.id ?? "");
      setTitre(v.titre);
      setUsage(v.usage);
      setZone(v.zone);
      setPrix(v.prix);
      setDescription(v.description);
      setStatut(v.statut);
      setPoint(lot?.latitude != null && lot?.longitude != null ? [lot.latitude, lot.longitude] : null);
    },
    []
  );

  // Chargement des lots éligibles + annonces existantes
  useEffect(() => {
    (async () => {
      const [att, cert] = await Promise.all([
        supabase.from("attestations_cession").select("lot_id").eq("statut", "delivree"),
        supabase.from("certificats_vente").select("lot_id").eq("statut", "delivree"),
      ]);

      const docType = new Map<string, "attestation_cession" | "certificat_vente">();
      (att.data ?? []).forEach((r: { lot_id: string }) => docType.set(r.lot_id, "attestation_cession"));
      (cert.data ?? []).forEach((r: { lot_id: string }) => docType.set(r.lot_id, "certificat_vente"));

      const lotIds = [...docType.keys()];
      if (lotIds.length === 0) {
        setLoading(false);
        return;
      }

      const [lotsRes, annRes] = await Promise.all([
        supabase
          .from("lots")
          .select("id, numero_lot, superficie_m2, latitude, longitude, ilots(numero, lotissements(nom, village, commune))")
          .in("id", lotIds),
        supabase
          .from("annonces_marketplace")
          .select("id, lot_id, titre, prix, usage, zone, description, statut")
          .in("lot_id", lotIds),
      ]);

      type LotRow = {
        id: string; numero_lot: string | null; superficie_m2: number | null;
        latitude: number | null; longitude: number | null;
        ilots: { lotissements: { nom: string | null; village: string | null; commune: string | null } | null } | null;
      };

      const mapped: LotEligible[] = ((lotsRes.data ?? []) as unknown as LotRow[]).map((l) => ({
        id: l.id,
        numero_lot: l.numero_lot,
        superficie_m2: l.superficie_m2,
        latitude: l.latitude,
        longitude: l.longitude,
        village: l.ilots?.lotissements?.village ?? null,
        commune: l.ilots?.lotissements?.commune ?? null,
        lotissement: l.ilots?.lotissements?.nom ?? null,
        documentType: docType.get(l.id)!,
      }));

      const annMap: Record<string, AnnonceExistante> = {};
      ((annRes.data ?? []) as unknown as AnnonceExistante[]).forEach((a) => { annMap[a.lot_id] = a; });

      setLots(mapped);
      setAnnonces(annMap);
      setLoading(false);

      // Le lot passé en ?lot= n'est retenu que s'il est réellement éligible :
      // une URL forgée ne doit pas ouvrir le formulaire sur le lot d'autrui
      // (`publier-annonce` refuserait de toute façon en 403).
      if (lotDemande && !lotDemandeApplique.current) {
        lotDemandeApplique.current = true;
        const lot = mapped.find((l) => l.id === lotDemande);
        if (lot) appliquer(lot, annMap[lotDemande]);
      }
    })();
  }, [supabase, lotDemande, appliquer]);

  // Sélection d'un lot → préremplissage
  const selectLot = (id: string) => {
    setMessage(null);
    appliquer(lots.find((l) => l.id === id), annonces[id]);
  };

  const previewPoint: [number, number] | null = point ? [round3(point[0]), round3(point[1])] : null;

  const canSubmit = lotId && titre.trim() && Number(prix) >= 0 && prix !== "" && !submitting;

  const submit = async () => {
    setSubmitting(true);
    setMessage(null);
    const res = await supabase.functions.invoke("publier-annonce", {
      body: {
        lot_id: lotId,
        titre: titre.trim(),
        usage,
        zone: zone.trim() || null,
        prix: Number(prix),
        description: description.trim() || null,
        statut,
        latitude: point ? point[0] : null,
        longitude: point ? point[1] : null,
      },
    });

    if (res.error || res.data?.error) {
      setMessage({ type: "err", text: res.data?.error ?? "Publication impossible." });
      setSubmitting(false);
      return;
    }

    setMessage({
      type: "ok",
      text: statut === "active" ? "Annonce publiée sur TerraCI Market ✓" : "Brouillon enregistré ✓",
    });
    setAnnonces((prev) => ({
      ...prev,
      [lotId]: { id: res.data.annonce.id, lot_id: lotId, titre, prix: Number(prix), usage, zone, description, statut },
    }));
    setSubmitting(false);
  };

  const selectedLot = lots.find((l) => l.id === lotId) ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-brand-primary sm:text-3xl">
          <Store className="h-6 w-6 text-[#0D3B66]" />
          Mettre un terrain en vente
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Seuls vos lots avec une attestation ou un certificat <strong>délivré</strong> sont éligibles à TerraCI Market.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#0D3B66]" />
        </div>
      ) : lots.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
          Aucun lot éligible pour le moment. Un document foncier doit être au statut « délivré » pour pouvoir être mis en vente.
        </div>
      ) : (
        <div className="space-y-5">
          {/* 1 — Lot */}
          <Section n={1} title="Lot concerné">
            <select
              value={lotId}
              onChange={(e) => selectLot(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-[#0D3B66] focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
            >
              <option value="">— Choisir un lot —</option>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  Lot {l.numero_lot ?? "?"} · {l.lotissement ?? l.commune ?? "—"}
                  {l.superficie_m2 ? ` · ${l.superficie_m2} m²` : ""}
                  {annonces[l.id] ? "  (déjà en vente)" : ""}
                </option>
              ))}
            </select>
            {selectedLot && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {selectedLot.documentType === "attestation_cession"
                  ? "Attestation de cession délivrée"
                  : "Certificat de vente délivré"}{" "}
                — éligible
              </p>
            )}
          </Section>

          {lotId && (
            <>
              {/* 2 — Description */}
              <Section n={2} title="Description de l'annonce">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Titre" full>
                    <input
                      value={titre}
                      onChange={(e) => setTitre(e.target.value)}
                      placeholder="Ex. Lot résidentiel viabilisé — Bingerville"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Usage">
                    <select value={usage} onChange={(e) => setUsage(e.target.value)} className={inputCls}>
                      {USAGES.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Zone (commune / localité)">
                    <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ex. Bingerville" className={inputCls} />
                  </Field>
                  <Field label="Prix (FCFA)" full>
                    <input
                      type="number"
                      min={0}
                      value={prix}
                      onChange={(e) => setPrix(e.target.value)}
                      placeholder="12 000 000"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Description" full>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="Viabilisation, environnement, atouts du terrain…"
                      className={inputCls}
                    />
                  </Field>
                </div>
              </Section>

              {/* 3 — Localisation */}
              <Section n={3} title="Localisation">
                <p className="mb-3 flex items-start gap-1.5 text-xs text-slate-500">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0D3B66]" />
                  Cliquez (ou glissez le repère) pour poser le point exact. Il reste <strong>privé</strong> :
                  l&apos;acheteur ne verra qu&apos;un cercle flou d&apos;environ 500 m.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <MapPin className="h-3.5 w-3.5 text-[#0D3B66]" /> Point exact (privé)
                    </p>
                    <div className="h-64 overflow-hidden rounded-xl border border-slate-200">
                      <VenteMap mode="exact" point={point} onPick={(lat, lng) => setPoint([lat, lng])} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {point ? `${point[0].toFixed(5)}, ${point[1].toFixed(5)}` : "Aucun point posé"}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <Eye className="h-3.5 w-3.5 text-[#b45309]" /> Aperçu acheteur (flou 500 m)
                    </p>
                    <div className="h-64 overflow-hidden rounded-xl border border-slate-200">
                      <VenteMap mode="preview" point={previewPoint} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {previewPoint ? "Zone approximative telle que vue par l'acheteur" : "Posez un point à gauche"}
                    </p>
                  </div>
                </div>
              </Section>

              {/* 4 — Photos */}
              <Section n={4} title="Photos">
                {annonces[lotId]?.id ? (
                  <PhotosAnnonce annonceId={annonces[lotId].id} />
                ) : (
                  <p className="text-xs text-slate-500">
                    Enregistrez d&apos;abord l&apos;annonce (brouillon ou publication) pour pouvoir ajouter des photos.
                  </p>
                )}
              </Section>

              {/* Actions */}
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200/60 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-4 text-sm">
                  <span className="font-medium text-slate-600">Statut :</span>
                  <span className="flex items-center gap-1.5">
                    <input type="radio" checked={statut === "brouillon"} onChange={() => setStatut("brouillon")} />
                    Brouillon
                  </span>
                  <span className="flex items-center gap-1.5">
                    <input type="radio" checked={statut === "active"} onChange={() => setStatut("active")} />
                    Publier maintenant
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  {message && (
                    <span className={`text-xs font-medium ${message.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
                      {message.text}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={!canSubmit}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0D3B66] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1E6091] disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                    {statut === "active" ? "Publier l'annonce" : "Enregistrer le brouillon"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// `useSearchParams` impose une borne Suspense sur un export statique (output:
// "export") — sans elle, le build échoue.
export default function MettreEnVentePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#0D3B66]" />
        </div>
      }
    >
      <MettreEnVenteForm />
    </Suspense>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-[#0D3B66] focus:outline-none focus:ring-1 focus:ring-[#0D3B66]";

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
      <div className="border-b border-slate-200/60 bg-slate-50/50 px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0D3B66] text-xs text-white">{n}</span>
          {title}
        </p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
