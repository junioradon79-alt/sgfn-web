"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  HandCoins,
  Landmark,
  MapPin,
  MessageSquare,
  PackageCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";

/**
 * Espace Opérateur — vue cantonnée à SON périmètre (RLS lots_read_scope).
 * L'opérateur est rémunéré en « lots en nature » (attribution qualite='operateur') ;
 * ce sont les seuls lots qu'il peut céder à des tiers. On les met en avant ici,
 * et ils sont marqués dans l'inventaire visiteur (espace Acquisition).
 */

type LotRow = {
  id: string;
  numero_lot: string | number | null;
  statut: string | null;
  ilots: {
    numero: string | number | null;
    lotissement_id: string | null;
    lotissements: { nom: string | null; operateur_id: string | null } | null;
  } | null;
  attributions: Array<{
    qualite: string | null;
    actuel: boolean | null;
    attributaires: { nom: string | null } | null;
  }> | null;
};

type LotissementRow = {
  id: string;
  nom: string | null;
  village: string | null;
  commune: string | null;
  nb_lots: number | null;
  nb_ilots: number | null;
};

const STATUT_LOT: Record<string, { badge: "disponible" | "attribue" | "en_validation" | "litige"; label: string }> = {
  attribue: { badge: "attribue", label: "Détenu" },
  vendu: { badge: "disponible", label: "Cédé" },
  libre: { badge: "disponible", label: "Libre" },
  en_litige: { badge: "litige", label: "Litige" },
};

const estLotOperateur = (l: LotRow) =>
  (l.attributions ?? []).some((a) => a.qualite === "operateur");

export default function OperateurPage() {
  const supabase = useMemo(() => createClient(), []);

  const [lotissements, setLotissements] = useState<LotissementRow[]>([]);
  const [lots, setLots] = useState<LotRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Périmètre opérateur : son identifiant + ses lotissements.
      const { data: monOp } = await supabase.rpc("mon_operateur_id");

      const lotissPromise = monOp
        ? supabase
            .from("lotissements")
            .select("id, nom, village, commune, nb_lots, nb_ilots")
            .eq("operateur_id", monOp)
            .order("nom")
        : Promise.resolve({ data: [] });

      // Les lots sont déjà cantonnés à l'opérateur par le RLS (lots_read_scope).
      const lotsPromise = supabase
        .from("lots")
        .select(
          "id, numero_lot, statut, ilots(numero, lotissement_id, lotissements(nom, operateur_id)), attributions(qualite, actuel, attributaires(nom))"
        )
        .order("numero_lot", { ascending: true });

      const [lotiss, lotsRes] = await Promise.all([lotissPromise, lotsPromise]);
      setLotissements((lotiss.data ?? []) as unknown as LotissementRow[]);
      setLots((lotsRes.data ?? []) as unknown as LotRow[]);
      setLoading(false);
    })();
  }, [supabase]);

  const opLots = lots.filter(estLotOperateur);
  const cedables = opLots.filter((l) => l.statut !== "vendu");
  const cedes = opLots.filter((l) => l.statut === "vendu");

  const kpis = [
    { label: "Mes lotissements", value: lotissements.length, icon: <Landmark className="h-4 w-4 text-[#0D3B66]" /> },
    { label: "Lots dans mon périmètre", value: lots.length, icon: <Boxes className="h-4 w-4 text-[#1E6091]" /> },
    { label: "Mes lots en nature (cédables)", value: cedables.length, icon: <HandCoins className="h-4 w-4 text-[#9C6406]" /> },
    { label: "Lots en nature cédés", value: cedes.length, icon: <PackageCheck className="h-4 w-4 text-[#2D8F5A]" /> },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {/* En-tête */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-primary">Espace Opérateur</h1>
          <p className="mt-1.5 text-sm sm:text-base text-slate-500">
            Vos lotissements et vos lots en nature — les seuls que vous pouvez céder à des tiers.
          </p>
        </div>
        <Link
          href="/dashboard/messages"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200/60 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <MessageSquare className="h-4 w-4 text-[#0D3B66]" />
          Demandes d&apos;intérêt
        </Link>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200/60 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{k.label}</p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F8FAFC]">{k.icon}</div>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-[#0D3B66]">{loading ? "…" : k.value}</p>
          </div>
        ))}
      </div>

      {/* Mes lotissements */}
      <section className="mb-6">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-800">Mes lotissements</h2>
          <p className="text-xs text-slate-400">Lotissements dont vous êtes l&apos;opérateur</p>
        </div>
        {loading ? (
          <div className="rounded-xl border border-slate-200/60 bg-white px-5 py-8 text-center text-sm text-slate-500">
            Chargement…
          </div>
        ) : lotissements.length === 0 ? (
          <div className="rounded-xl border border-slate-200/60 bg-white px-5 py-8 text-center text-sm text-slate-500">
            Aucun lotissement rattaché à votre compte opérateur.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {lotissements.map((lo) => (
              <div key={lo.id} className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-800">{lo.nom}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="h-3 w-3" />
                  {lo.village ?? "—"} · {lo.commune ?? "—"}
                </p>
                <div className="mt-3 flex gap-2">
                  <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                    <b className="text-[#0D3B66]">{lo.nb_lots ?? 0}</b> lots
                  </span>
                  <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                    <b className="text-[#0D3B66]">{lo.nb_ilots ?? 0}</b> îlots
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mes lots en nature */}
      <section className="overflow-hidden rounded-xl border border-[#9C6406]/30 bg-white">
        <div className="border-b border-[#9C6406]/20 bg-[#F6ECD6]/40 px-5 py-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[#7a5407]">
            <HandCoins className="h-4 w-4" />
            Mes lots en nature
          </p>
          <p className="text-xs text-[#9C6406]/80">
            Lots reçus en rémunération — les seuls que vous pouvez céder à des tiers
          </p>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">Chargement…</div>
        ) : opLots.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            Aucun lot en nature enregistré à votre nom pour l&apos;instant.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {opLots.map((l) => {
              const st = STATUT_LOT[l.statut ?? "libre"] ?? STATUT_LOT.libre;
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span className="font-mono text-xs text-slate-400">
                    Îlot {l.ilots?.numero} · Lot {l.numero_lot}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                    {l.ilots?.lotissements?.nom ?? "—"}
                  </span>
                  <Badge status={st.badge}>{st.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t border-slate-100 px-5 py-3 text-xs leading-relaxed text-slate-500">
          Ces lots apparaissent dans l&apos;inventaire des visiteurs, signalés « Lot opérateur ». Quand un
          acquéreur manifeste son intérêt, vous recevez le message dans <b>Demandes d&apos;intérêt</b>.
        </p>
      </section>
    </div>
  );
}
