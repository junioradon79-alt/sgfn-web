"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Map as MapIcon, Boxes, Users } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useChargement } from "@/hooks/useChargement";
import { LotDetailModal, type LotRecord, type LitigeRow, type ScoreConfiance } from "@/components/dashboard/lots/LotDetailModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type LotissementDetail = {
  id: string;
  nom: string;
  village: string | null;
  commune: string | null;
  district: string | null;
  superficie_texte: string | null;
  nb_lots: number | null;
  nb_ilots: number | null;
  guide_reference: string | null;
  tf_numero: string | null;
  livre_foncier: string | null;
  pv_numero_enregistrement: string | null;
  pv_identification_physique_numero: string | null;
  pv_identification_physique_date: string | null;
};

type IlotRow = { id: string; numero: string | null };

type LotRow = {
  id: string;
  numero_lot: string | null;
  statut: string | null;
  superficie_m2: number | null;
  ilot_id: string | null;
};

type AttributaireRow = {
  nom: string;
  qualite: string | null;
  lot_id: string;
};

const STATUT_LOT_LABELS: Record<string, string> = {
  libre: "Libre",
  attribue: "Attribué",
  occupe: "Occupé",
  vendu: "Vendu",
  en_validation: "En validation",
  en_litige: "En litige",
  reserve_equipement: "Équipement",
};

const QUALITE_LABELS: Record<string, string> = {
  ayant_droit: "Propriétaire d'origine",
  ayant_droit_transmission: "Ayant-droit par transmission",
  acquereur: "Acquéreur",
  operateur: "Opérateur",
  entrepreneur: "Entrepreneur",
  reservataire: "Réservataire",
};

export default function LotissementDetailClient() {
  const params = useParams<{ id: string }>();
  const supabase = createClient();

  const [lotissement, setLotissement] = useState<LotissementDetail | null>(null);
  const [ilots, setIlots] = useState<IlotRow[]>([]);
  const [lots, setLots] = useState<LotRow[]>([]);
  const [attributaires, setAttributaires] = useState<AttributaireRow[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  // Dossier foncier d'un lot (lecture seule) — ouvert au clic sur une ligne.
  const [dossierLot, setDossierLot] = useState<LotRecord | null>(null);
  const [dossierLitiges, setDossierLitiges] = useState<LitigeRow[]>([]);
  const [dossierScore, setDossierScore] = useState<ScoreConfiance | null>(null);
  const [dossierEnCours, setDossierEnCours] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setErreur(null);

    const { data: lotissementData, error: lotissementErr } = await supabase
      .from("lotissements")
      .select(
        "id, nom, village, commune, district, superficie_texte, nb_lots, nb_ilots, guide_reference, tf_numero, livre_foncier, pv_numero_enregistrement, pv_identification_physique_numero, pv_identification_physique_date"
      )
      .eq("id", params.id)
      .single();

    if (lotissementErr || !lotissementData) {
      setErreur("Lotissement introuvable.");
      return;
    }
    setLotissement(lotissementData as LotissementDetail);

    const { data: ilotsData } = await supabase
      .from("ilots")
      .select("id, numero")
      .eq("lotissement_id", params.id)
      .order("numero");
    const ilotsList = (ilotsData ?? []) as IlotRow[];
    setIlots(ilotsList);

    const ilotIds = ilotsList.map((i) => i.id);
    if (ilotIds.length === 0) {
      setLots([]);
      setAttributaires([]);
      return;
    }

    const { data: lotsData } = await supabase
      .from("lots")
      .select("id, numero_lot, statut, superficie_m2, ilot_id")
      .in("ilot_id", ilotIds)
      .order("numero_lot");
    const lotsList = (lotsData ?? []) as LotRow[];
    setLots(lotsList);

    const lotIds = lotsList.map((l) => l.id);
    if (lotIds.length > 0) {
      const { data: attribData } = await supabase
        .from("attributions")
        .select("lot_id, qualite, attributaires(nom)")
        .in("lot_id", lotIds)
        .eq("actuel", true);
      setAttributaires(
        ((attribData ?? []) as unknown as { lot_id: string; qualite: string | null; attributaires: { nom: string } | null }[]).map(
          (a) => ({ lot_id: a.lot_id, qualite: a.qualite, nom: a.attributaires?.nom ?? "—" })
        )
      );
    } else {
      setAttributaires([]);
    }
  }, [params.id, supabase]);

  const { isLoading: loading } = useChargement(fetchData, [fetchData]);

  // Charge le dossier complet du lot (attributions, cession, litiges, score de
  // confiance) à la demande, puis affiche le modal partagé en lecture seule.
  const ouvrirDossier = async (lotId: string) => {
    setDossierEnCours(lotId);
    const [{ data: lotData }, { data: litigesData }, { data: scoreData }] = await Promise.all([
      supabase
        .from("lots")
        .select(
          "id, numero_lot, numero_parcelle, ilot_id, statut, verrouille, superficie_m2, est_equipement, nature_droit, observation, guide_page, ilots(id, numero, lotissements(nom, commune, village, autorite_coutumiere_id)), attributions(rang, qualite, actuel, depuis, observation, attributaires(id, nom, type)), attestations_cession(reference, statut, cession_id)"
        )
        .eq("id", lotId)
        .single(),
      supabase.from("litiges").select("id, objet, statut, ouvert_le").eq("lot_id", lotId),
      supabase.rpc("calculer_score_confiance", { p_lot_id: lotId }),
    ]);
    setDossierLitiges((litigesData ?? []) as LitigeRow[]);
    setDossierScore((scoreData ?? null) as ScoreConfiance | null);
    setDossierLot((lotData ?? null) as unknown as LotRecord | null);
    setDossierEnCours(null);
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-400">Chargement…</div>;
  }

  if (erreur || !lotissement) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-red-600">{erreur ?? "Lotissement introuvable."}</p>
        <Link href="/lotissements" className="mt-3 inline-block text-sm font-medium text-[#0D3B66] hover:underline">
          ← Retour aux lotissements
        </Link>
      </div>
    );
  }

  const lotsParIlot = new Map<string, LotRow[]>();
  for (const lot of lots) {
    const key = lot.ilot_id ?? "—";
    lotsParIlot.set(key, [...(lotsParIlot.get(key) ?? []), lot]);
  }
  const attribParLot = new Map<string, AttributaireRow[]>();
  for (const a of attributaires) {
    attribParLot.set(a.lot_id, [...(attribParLot.get(a.lot_id) ?? []), a]);
  }

  const identite = [
    { label: "Superficie", value: lotissement.superficie_texte },
    { label: "Guide de référence", value: lotissement.guide_reference },
    { label: "N° Titre Foncier", value: lotissement.tf_numero },
    { label: "Livre Foncier", value: lotissement.livre_foncier },
    { label: "N° enregistrement PV (guide)", value: lotissement.pv_numero_enregistrement },
    { label: "N° PV d'identification physique", value: lotissement.pv_identification_physique_numero },
    {
      label: "Date du PV d'identification physique",
      value: lotissement.pv_identification_physique_date
        ? new Date(lotissement.pv_identification_physique_date).toLocaleDateString("fr-FR")
        : null,
    },
  ].filter((it) => it.value != null && it.value !== "");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/lotissements" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0D3B66] hover:underline">
        <ArrowLeft className="h-4 w-4" /> Retour aux lotissements
      </Link>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Lotissement · Vue détaillée</p>
        <h1 className="mt-1 text-2xl font-bold text-[#0D3B66]">{lotissement.nom}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {[lotissement.village, lotissement.commune, lotissement.district].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>

      {identite.length > 0 && (
        <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {identite.map((it) => (
              <div key={it.label}>
                <p className="text-xs text-slate-400">{it.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-700">{it.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Îlots */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <MapIcon className="h-4 w-4 text-[#0D3B66]" />
          <h2 className="text-sm font-semibold text-[#0D3B66]">Îlots ({ilots.length})</h2>
        </div>
        {ilots.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">Aucun îlot enregistré.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {ilots.map((ilot) => {
              const lotsIlot = lotsParIlot.get(ilot.id) ?? [];
              return (
                <div key={ilot.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">Îlot {ilot.numero ?? "—"}</p>
                    <span className="text-xs text-slate-400">{lotsIlot.length} lot{lotsIlot.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Lots */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Boxes className="h-4 w-4 text-[#0D3B66]" />
          <h2 className="text-sm font-semibold text-[#0D3B66]">Lots ({lots.length})</h2>
          {lots.length > 0 && (
            <span className="ml-auto text-xs text-slate-400">Cliquez un lot pour ouvrir son dossier</span>
          )}
        </div>
        {lots.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">Aucun lot enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2.5">Lot</th>
                  <th className="px-5 py-2.5">Îlot</th>
                  <th className="px-5 py-2.5">Statut</th>
                  <th className="px-5 py-2.5">Superficie</th>
                  <th className="px-5 py-2.5">Attributaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lots.map((lot) => {
                  const ilotNum = ilots.find((i) => i.id === lot.ilot_id)?.numero ?? "—";
                  const attribs = attribParLot.get(lot.id) ?? [];
                  return (
                    <tr
                      key={lot.id}
                      onClick={() => ouvrirDossier(lot.id)}
                      title="Voir le dossier foncier du lot"
                      className={`cursor-pointer transition-colors hover:bg-slate-50 ${dossierEnCours === lot.id ? "opacity-60" : ""}`}
                    >
                      <td className="px-5 py-3 font-medium text-[#0D3B66] underline-offset-2 hover:underline">{lot.numero_lot ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-500">{ilotNum}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {STATUT_LOT_LABELS[lot.statut ?? ""] ?? lot.statut ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {lot.superficie_m2 ? `${lot.superficie_m2.toLocaleString("fr-FR")} m²` : "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {attribs.length > 0
                          ? attribs.map((a) => `${a.nom}${a.qualite ? ` (${QUALITE_LABELS[a.qualite] ?? a.qualite})` : ""}`).join(", ")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Attributaires */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Users className="h-4 w-4 text-[#0D3B66]" />
          <h2 className="text-sm font-semibold text-[#0D3B66]">Attributaires ({attributaires.length})</h2>
        </div>
        {attributaires.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">Aucun attributaire actuel sur ce lotissement.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {attributaires.map((a, idx) => (
              <div key={`${a.lot_id}-${idx}`} className="flex items-center justify-between px-5 py-3.5">
                <p className="text-sm font-semibold text-slate-800">{a.nom}</p>
                <p className="text-xs text-slate-400">{a.qualite ? QUALITE_LABELS[a.qualite] ?? a.qualite : "—"}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {dossierLot && (
        <LotDetailModal
          lot={dossierLot}
          litiges={dossierLitiges}
          score={dossierScore}
          pvAlert={null}
          onClose={() => setDossierLot(null)}
        />
      )}
    </div>
  );
}
