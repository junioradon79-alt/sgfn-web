"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  CheckCircle2, Eye, FileCheck2, Info, Loader2, MapPin, PencilLine, Store, Tag,
} from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Button } from "@/components/ds/button";
import { Card, CardHeader, CardTitle } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Input, Textarea } from "@/components/ds/input";
import { Kpi } from "@/components/ds/kpi";
import { Field } from "@/components/ds/label";
import { SelectItem } from "@/components/ds/select";
import { ChampSelect } from "@/components/dashboard/ModaleFormulaire";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { createClient } from "@/utils/supabase/client";
import { invokeEdge } from "@/lib/invoke-edge";
import { fadeUp, stagger } from "@/lib/motion";

import PhotosAnnonce from "./_PhotosAnnonce";

// Leaflet a besoin des APIs browser → import dynamique ssr:false
const VenteMap = dynamic(() => import("./_VenteMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-inset">
      <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
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
  const { counts } = useBadgeCounts();
  // Lot ciblé par le bouton « Mettre en vente » d'un espace propriétaire.
  const lotDemande = useSearchParams().get("lot");
  const lotDemandeApplique = useRef(false);

  const [lots, setLots] = useState<LotEligible[]>([]);
  const [annonces, setAnnonces] = useState<Record<string, AnnonceExistante>>({});

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

  // Chargement des lots éligibles + annonces existantes. `useChargement` évite
  // d'écrire l'état de chargement de façon synchrone dans l'effet (cascade de
  // rendus) et donne le `recharger` du bouton de rafraîchissement.
  const { isLoading: loading, recharger } = useChargement(async () => {
    const [att, cert] = await Promise.all([
      supabase.from("attestations_cession").select("lot_id").eq("statut", "delivree"),
      supabase.from("certificats_vente").select("lot_id").eq("statut", "delivree"),
    ]);

    const docType = new Map<string, "attestation_cession" | "certificat_vente">();
    (att.data ?? []).forEach((r: { lot_id: string }) => docType.set(r.lot_id, "attestation_cession"));
    (cert.data ?? []).forEach((r: { lot_id: string }) => docType.set(r.lot_id, "certificat_vente"));

    const lotIds = [...docType.keys()];
    if (lotIds.length === 0) {
      setLots([]);
      setAnnonces({});
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

    // Le lot passé en ?lot= n'est retenu que s'il est réellement éligible :
    // une URL forgée ne doit pas ouvrir le formulaire sur le lot d'autrui
    // (`publier-annonce` refuserait de toute façon en 403).
    if (lotDemande && !lotDemandeApplique.current) {
      lotDemandeApplique.current = true;
      const lot = mapped.find((l) => l.id === lotDemande);
      if (lot) appliquer(lot, annMap[lotDemande]);
    }
  }, [supabase, lotDemande, appliquer]);

  // Sélection d'un lot → préremplissage
  const selectLot = (id: string) => {
    setMessage(null);
    appliquer(lots.find((l) => l.id === id), annonces[id]);
  };

  const previewPoint: [number, number] | null = point ? [round3(point[0]), round3(point[1])] : null;

  const canSubmit = !!lotId && !!titre.trim() && Number(prix) >= 0 && prix !== "" && !submitting;

  const submit = async () => {
    setSubmitting(true);
    setMessage(null);
    const res = await invokeEdge<{ annonce: { id: string } }>(
      supabase,
      "publier-annonce",
      {
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
      "Publication impossible.",
    );

    if (res.error || !res.data) {
      setMessage({ type: "err", text: res.error ?? "Publication impossible." });
      setSubmitting(false);
      return;
    }

    // Sorti de la closure : le rétrécissement de type de `res.data` ne survit
    // pas au passage dans le callback de `setAnnonces`.
    const annonceId = res.data.annonce.id;
    setMessage({
      type: "ok",
      text: statut === "active" ? "Annonce publiée sur TerraCI Market ✓" : "Brouillon enregistré ✓",
    });
    setAnnonces((prev) => ({
      ...prev,
      [lotId]: { id: annonceId, lot_id: lotId, titre, prix: Number(prix), usage, zone, description, statut },
    }));
    setSubmitting(false);
  };

  const selectedLot = lots.find((l) => l.id === lotId) ?? null;
  const enVente = Object.values(annonces).filter((a) => a.statut !== "brouillon").length;
  const brouillons = Object.values(annonces).filter((a) => a.statut === "brouillon").length;

  return (
    <AppShell loading={loading} counts={counts} onRefresh={() => void recharger()}>
      <div>
        <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">TerraCI Market</p>
        <h1 className="mt-1 font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
          Mettre un terrain en vente
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Seuls vos lots dont l&apos;attestation ou le certificat est <strong className="font-semibold text-foreground">délivré</strong>{" "}
          sont éligibles à la place de marché.
        </p>
      </div>

      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <Kpi
          icon={FileCheck2}
          label="Lots éligibles"
          loading={loading}
          value={lots.length}
          legende={<>Document foncier délivré</>}
        />
        <Kpi
          icon={Store}
          label="Déjà publiés"
          loading={loading}
          value={enVente}
          legende={<>Visibles des acheteurs</>}
        />
        <Kpi
          icon={PencilLine}
          label="Brouillons"
          loading={loading}
          value={brouillons}
          tone={brouillons > 0 ? "warning" : "neutral"}
          legende={<>Enregistrés, non publiés</>}
        />
      </motion.section>

      {loading ? null : lots.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileCheck2}
            tone="pending"
            title="Aucun lot éligible pour le moment"
            description="Un document foncier doit être au statut « délivré » pour qu'un lot puisse être mis en vente."
          />
        </Card>
      ) : (
        <motion.div variants={stagger(0.05, 0.06)} initial="hidden" animate="show" className="flex flex-col gap-5">
          {/* 1 — Lot */}
          <Etape n={1} titre="Lot concerné">
            <ChampSelect
              id="lot"
              label="Lot à mettre en vente"
              value={lotId}
              onChange={selectLot}
              placeholder="— Choisir un lot —"
              required
            >
              {lots.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  Lot {l.numero_lot ?? "?"} · {l.lotissement ?? l.commune ?? "—"}
                  {l.superficie_m2 ? ` · ${l.superficie_m2} m²` : ""}
                  {annonces[l.id] ? "  (déjà en vente)" : ""}
                </SelectItem>
              ))}
            </ChampSelect>
            {selectedLot && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-success">
                <CheckCircle2 className="size-3.5" aria-hidden />
                {selectedLot.documentType === "attestation_cession"
                  ? "Attestation de cession délivrée"
                  : "Certificat de vente délivré"}{" "}
                — éligible
              </p>
            )}
          </Etape>

          {lotId && (
            <>
              {/* 2 — Description */}
              <Etape n={2} titre="Description de l'annonce">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Titre" htmlFor="titre" required className="sm:col-span-2">
                    <Input
                      id="titre"
                      value={titre}
                      onChange={(e) => setTitre(e.target.value)}
                      placeholder="Ex. Lot résidentiel viabilisé — Bingerville"
                    />
                  </Field>
                  <ChampSelect id="usage" label="Usage" value={usage} onChange={setUsage}>
                    {USAGES.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </ChampSelect>
                  <Field label="Zone (commune / localité)" htmlFor="zone">
                    <Input id="zone" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ex. Bingerville" />
                  </Field>
                  <Field label="Prix (FCFA)" htmlFor="prix" required className="sm:col-span-2">
                    <Input
                      id="prix"
                      type="number"
                      min={0}
                      value={prix}
                      onChange={(e) => setPrix(e.target.value)}
                      placeholder="12 000 000"
                    />
                  </Field>
                  <Field label="Description" htmlFor="description" className="sm:col-span-2">
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="Viabilisation, environnement, atouts du terrain…"
                    />
                  </Field>
                </div>
              </Etape>

              {/* 3 — Localisation */}
              <Etape n={3} titre="Localisation">
                <p className="mb-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                  Cliquez (ou glissez le repère) pour poser le point exact. Il reste{" "}
                  <strong className="font-semibold text-foreground">privé</strong> : l&apos;acheteur ne verra
                  qu&apos;un cercle flou d&apos;environ 500 m.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <MapPin className="size-3.5 text-accent" aria-hidden /> Point exact (privé)
                    </p>
                    <div className="h-64 overflow-hidden rounded-xl border border-border">
                      <VenteMap mode="exact" point={point} onPick={(lat, lng) => setPoint([lat, lng])} />
                    </div>
                    <p className="tabular mt-1 text-xs text-muted-2">
                      {point ? `${point[0].toFixed(5)}, ${point[1].toFixed(5)}` : "Aucun point posé"}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Eye className="size-3.5 text-warning" aria-hidden /> Aperçu acheteur (flou 500 m)
                    </p>
                    <div className="h-64 overflow-hidden rounded-xl border border-border">
                      <VenteMap mode="preview" point={previewPoint} />
                    </div>
                    <p className="mt-1 text-xs text-muted-2">
                      {previewPoint ? "Zone approximative telle que vue par l'acheteur" : "Posez un point à gauche"}
                    </p>
                  </div>
                </div>
              </Etape>

              {/* 4 — Photos */}
              <Etape n={4} titre="Photos">
                {annonces[lotId]?.id ? (
                  <PhotosAnnonce annonceId={annonces[lotId].id} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Enregistrez d&apos;abord l&apos;annonce (brouillon ou publication) pour pouvoir ajouter des photos.
                  </p>
                )}
              </Etape>

              {/* Actions */}
              <motion.div variants={fadeUp}>
                <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <fieldset className="flex flex-wrap items-center gap-4 text-sm">
                    <legend className="sr-only">Statut de l&apos;annonce</legend>
                    <span className="font-medium text-muted-foreground">Statut :</span>
                    <ChoixStatut
                      valeur="brouillon" actuel={statut} onChange={setStatut} libelle="Brouillon"
                    />
                    <ChoixStatut
                      valeur="active" actuel={statut} onChange={setStatut} libelle="Publier maintenant"
                    />
                  </fieldset>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {message && (
                      <span
                        role="status"
                        className={`text-xs font-medium ${message.type === "ok" ? "text-success" : "text-danger"}`}
                      >
                        {message.text}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => void submit()}
                      loading={submitting}
                      disabled={!canSubmit}
                    >
                      <Tag />
                      {statut === "active" ? "Publier l'annonce" : "Enregistrer le brouillon"}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            </>
          )}
        </motion.div>
      )}
    </AppShell>
  );
}

// `useSearchParams` impose une borne Suspense sur un export statique (output:
// "export") — sans elle, le build échoue.
export default function MettreEnVentePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      }
    >
      <MettreEnVenteForm />
    </Suspense>
  );
}

/** Carte numérotée d'une étape du formulaire — la structure en 4 temps est
 *  conservée de l'écran historique : elle porte le déroulé métier. */
function Etape({ n, titre, children }: { n: number; titre: string; children: React.ReactNode }) {
  return (
    <motion.div variants={fadeUp}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              {n}
            </span>
            {titre}
          </CardTitle>
        </CardHeader>
        <div className="px-5 pb-5">{children}</div>
      </Card>
    </motion.div>
  );
}

/** Bouton radio de statut : la case native suit le thème via `accent-color`. */
function ChoixStatut({
  valeur, actuel, onChange, libelle,
}: {
  valeur: "active" | "brouillon";
  actuel: "active" | "brouillon";
  onChange: (v: "active" | "brouillon") => void;
  libelle: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-foreground">
      <input
        type="radio"
        name="statut-annonce"
        checked={actuel === valeur}
        onChange={() => onChange(valeur)}
        className="size-4"
        style={{ accentColor: "var(--primary)" }}
      />
      {libelle}
    </label>
  );
}
