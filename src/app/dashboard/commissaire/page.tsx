"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Download,
  FileCheck2,
  Gift,
  Landmark,
  Lock,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";

/**
 * Espace Commissaire — supervision EN LECTURE SEULE du registre : lots, PV de
 * réunion de famille, attestations (téléchargement). Aucune écriture sur le
 * foncier. Porté depuis `sgfn_espace_commissaire_2.html`.
 */

type AttributionLite = {
  rang: number | null;
  qualite: string | null;
  actuel: boolean | null;
  observation: string | null;
  attributaires: { id: string | null; nom: string | null; type: string | null } | null;
};

type AttestationLite = { reference: string | null; statut: string | null; cession_id: string | null };

type LotRow = {
  id: string;
  numero_lot: string | number | null;
  statut: string | null;
  verrouille: boolean | null;
  ilots: {
    numero: string | number | null;
    lotissements: { nom: string | null; village: string | null; commune: string | null } | null;
  } | null;
  attributions: AttributionLite[] | null;
  attestations_cession: AttestationLite[] | null;
};

type PvRow = {
  reference: string | null;
  statut: string | null;
  collectif_attributaire_id: string | null;
  attributaires: { nom: string | null } | null;
  pv_reunions_famille_lots: Array<{
    lots: { numero_lot: string | number | null; ilots: { numero: string | number | null } | null } | null;
  }> | null;
};

type PvInfo = { reference: string | null; statut: string | null };

const QUALITE_LABELS: Record<string, string> = {
  ayant_droit: "Ayant-droit",
  ayant_droit_transmission: "Transmission",
  acquereur: "Acquéreur",
  operateur: "Opérateur",
  entrepreneur: "Entrepreneur",
  reservataire: "Réservataire",
};

const STATUT_LOT: Record<string, { badge: "disponible" | "attribue" | "en_validation" | "litige"; label: string }> = {
  attribue: { badge: "attribue", label: "Attribué" },
  occupe: { badge: "attribue", label: "Occupé" },
  vendu: { badge: "attribue", label: "Vendu" },
  libre: { badge: "disponible", label: "Libre" },
  en_litige: { badge: "litige", label: "Litige" },
  reserve_equipement: { badge: "en_validation", label: "Réservé" },
};

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "attribue", label: "Attribués" },
  { key: "vendu", label: "Vendus" },
  { key: "libre", label: "Libres" },
  { key: "pv", label: "PV à régulariser" },
] as const;

function lotPvAlert(lot: LotRow, pvByCollectif: Map<string, PvInfo>): PvInfo | null {
  const attrs = lot.attributions ?? [];
  const r1 = attrs.find((a) => a.rang === 1);
  if (!r1 || r1.attributaires?.type !== "collectif_ayants_droit") return null;
  if (!attrs.some((a) => (a.rang ?? 0) > 1)) return null;
  const pv = pvByCollectif.get(r1.attributaires?.id ?? "");
  if (pv && pv.statut === "valide") return null;
  return pv ?? { reference: "—", statut: "a_fournir" };
}

const actuel = (attrs: AttributionLite[] | null) =>
  !attrs?.length ? null : attrs.find((a) => a.actuel) ?? [...attrs].sort((a, b) => (b.rang ?? 0) - (a.rang ?? 0))[0];

export default function CommissairePage() {
  const supabase = useMemo(() => createClient(), []);

  const [lots, setLots] = useState<LotRow[]>([]);
  const [pv, setPv] = useState<PvRow[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [sel, setSel] = useState<LotRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [dl, setDl] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    (async () => {
      const [lotsRes, pvRes] = await Promise.all([
        supabase
          .from("lots")
          .select(
            "id, numero_lot, statut, verrouille, ilots(numero, lotissements(nom, village, commune)), attributions(rang, qualite, actuel, observation, attributaires(id, nom, type)), attestations_cession(reference, statut, cession_id)"
          )
          .order("numero_lot", { ascending: true }),
        supabase
          .from("pv_reunions_famille")
          .select(
            "reference, statut, collectif_attributaire_id, attributaires(nom), pv_reunions_famille_lots(lots(numero_lot, ilots(numero)))"
          ),
      ]);
      setLots((lotsRes.data ?? []) as unknown as LotRow[]);
      setPv((pvRes.data ?? []) as unknown as PvRow[]);
      setLoading(false);
    })();
  }, [supabase]);

  const pvByCollectif = useMemo(() => {
    const m = new Map<string, PvInfo>();
    pv.forEach((p) => {
      if (p.collectif_attributaire_id) m.set(p.collectif_attributaire_id, { reference: p.reference, statut: p.statut });
    });
    return m;
  }, [pv]);

  const kA = lots.filter((l) => l.statut === "attribue").length;
  const kV = lots.filter((l) => l.statut === "vendu").length;
  const attestations = lots.flatMap((l) => l.attestations_cession ?? []);
  const attDelivrees = attestations.filter((a) => a.statut === "delivree").length;
  const attGratuites = attestations.filter((a) => !a.cession_id).length;
  const pvNonRegularises = pv.filter((p) => p.statut !== "valide").length;
  const pvAlertLots = lots.filter((l) => lotPvAlert(l, pvByCollectif));

  const shown = lots.filter((l) => {
    if (filter === "pv") return !!lotPvAlert(l, pvByCollectif);
    if (filter !== "all" && l.statut !== filter) return false;
    return true;
  });

  const kpis = [
    { label: "Lots au registre", value: lots.length, icon: <Landmark className="h-4 w-4 text-[#0D3B66]" /> },
    { label: "Attestations délivrées", value: attDelivrees, icon: <FileCheck2 className="h-4 w-4 text-[#2D8F5A]" /> },
    { label: "Dont gratuites (1ers AD)", value: attGratuites, icon: <Gift className="h-4 w-4 text-[#1E6091]" /> },
    { label: "PV non régularisés", value: pvNonRegularises, icon: <AlertTriangle className="h-4 w-4 text-[#F39C12]" /> },
  ];

  const telecharger = async (reference: string) => {
    setDl("loading");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/telecharger-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ table: "attestations_cession", reference }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.erreur || "Téléchargement impossible");
      window.open(json.url, "_blank");
      setDl("idle");
    } catch {
      setDl("error");
      setTimeout(() => setDl("idle"), 2500);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* En-tête */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-primary">Supervision du registre</h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <ShieldCheck className="h-3 w-3" />
              Lecture seule
            </span>
          </div>
          <p className="mt-1.5 text-sm sm:text-base text-slate-500">Contrôle et conformité — accès en consultation.</p>
        </div>
        <Link
          href="/dashboard/messages"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200/60 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <MessageSquare className="h-4 w-4 text-[#0D3B66]" />
          Messages
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

      {/* Registre des lots */}
      <section className="mb-6 overflow-hidden rounded-xl border border-slate-200/60 bg-white">
        <div className="border-b border-slate-200/60 bg-slate-50/50 px-5 py-3">
          <p className="text-sm font-semibold text-slate-800">Registre des lots</p>
          <p className="text-xs text-slate-400">
            {kA + kV} attribués sur {lots.length} · {pvAlertLots.length} PV en attente
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200/60 px-5 py-3">
          {FILTERS.map((f) => {
            const n =
              f.key === "all"
                ? lots.length
                : f.key === "pv"
                  ? pvAlertLots.length
                  : lots.filter((l) => l.statut === f.key).length;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f.key
                    ? "border-[#0D3B66] bg-[#0D3B66] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-1.5 text-[10px] ${
                    filter === f.key ? "bg-white/20" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">Chargement…</div>
          ) : shown.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">Aucun lot dans ce filtre.</div>
          ) : (
            shown.map((l) => {
              const st = STATUT_LOT[l.statut ?? "libre"] ?? STATUT_LOT.libre;
              const p = actuel(l.attributions);
              const att = l.attestations_cession?.[0];
              const pvA = lotPvAlert(l, pvByCollectif);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSel(l)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">
                        Îlot {l.ilots?.numero} · Lot {l.numero_lot}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">
                        {p ? p.attributaires?.nom : "— libre"}
                      </span>
                      {l.verrouille && <Lock className="h-3 w-3 text-amber-500" />}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      {p && <span>{QUALITE_LABELS[p.qualite ?? ""] ?? p.qualite}</span>}
                      {att && <span className="text-[#2D8F5A]">· attestation {att.statut}</span>}
                      {pvA && <span className="text-[#F39C12]">· PV {(pvA.statut ?? "").replace(/_/g, " ")}</span>}
                    </div>
                  </div>
                  <Badge status={st.badge}>{st.label}</Badge>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* PV de réunion de famille */}
      <section className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
        <div className="border-b border-slate-200/60 bg-slate-50/50 px-5 py-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <ScrollText className="h-4 w-4 text-[#0D3B66]" />
            PV de réunion de famille
          </p>
          <p className="text-xs text-slate-400">{pv.length} dossier(s) suivi(s)</p>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">Chargement…</div>
        ) : pv.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">Aucun PV enregistré.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pv.map((p, i) => (
              <li key={`${p.reference}-${i}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
                  {p.attributaires?.nom ?? "—"}
                </span>
                <span className="text-xs text-slate-400">
                  {(p.pv_reunions_famille_lots ?? [])
                    .map((x) => `${x.lots?.ilots?.numero ?? "?"}/${x.lots?.numero_lot ?? "?"}`)
                    .join(", ")}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    p.statut === "valide" ? "bg-[#2D8F5A]/10 text-[#2D8F5A]" : "bg-[#F39C12]/10 text-[#F39C12]"
                  }`}
                >
                  {(p.statut ?? "").replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Fiche lot (détail lecture seule) */}
      {sel && (
        <LotSheet
          lot={sel}
          pvAlert={lotPvAlert(sel, pvByCollectif)}
          dl={dl}
          onDownload={telecharger}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

function LotSheet({
  lot,
  pvAlert,
  dl,
  onDownload,
  onClose,
}: {
  lot: LotRow;
  pvAlert: PvInfo | null;
  dl: "idle" | "loading" | "error";
  onDownload: (ref: string) => void;
  onClose: () => void;
}) {
  const lo = lot.ilots?.lotissements;
  const p = actuel(lot.attributions);
  const hist = [...(lot.attributions ?? [])].sort((a, b) => (a.rang ?? 0) - (b.rang ?? 0));
  const att = lot.attestations_cession?.[0];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 px-5 py-4">
          <div>
            <p className="font-mono text-xs text-slate-400">
              ÎLOT {lot.ilots?.numero} · LOT {lot.numero_lot}
            </p>
            <h3 className="mt-0.5 text-lg font-bold text-[#0D3B66]">{p ? p.attributaires?.nom : "Lot libre"}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
            <dt className="text-slate-400">Lotissement</dt>
            <dd className="font-medium text-slate-700">{lo?.nom ?? "—"}</dd>
            <dt className="text-slate-400">Localisation</dt>
            <dd className="font-medium text-slate-700">{lo?.village ?? "—"} · {lo?.commune ?? "—"}</dd>
            <dt className="text-slate-400">Qualité</dt>
            <dd className="font-medium text-slate-700">{p ? QUALITE_LABELS[p.qualite ?? ""] ?? p.qualite : "—"}</dd>
            <dt className="text-slate-400">Attestation</dt>
            <dd className="font-medium text-slate-700">{att ? `${att.reference} · ${att.statut}` : "—"}</dd>
          </dl>

          {att && (
            <button
              type="button"
              onClick={() => onDownload(att.reference ?? "")}
              disabled={dl === "loading"}
              className={`mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-60 ${
                dl === "error" ? "bg-[#EF4444]" : "bg-[#0D3B66] hover:bg-[#0a2f52]"
              }`}
            >
              <Download className="h-3.5 w-3.5" />
              {dl === "loading" ? "Préparation…" : dl === "error" ? "Erreur" : "Télécharger l'attestation"}
            </button>
          )}

          {lot.verrouille && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
              <Lock className="h-3.5 w-3.5" />
              Lot verrouillé.
            </div>
          )}

          {pvAlert && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              PV de réunion de famille : <span className="font-semibold">{(pvAlert.statut ?? "").replace(/_/g, " ")}</span>
            </div>
          )}

          <p className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Historique de propriété
          </p>
          {hist.length === 0 ? (
            <p className="text-sm text-slate-500">Lot libre — aucune attribution.</p>
          ) : (
            <ol className="relative space-y-3 border-l-2 border-slate-200 pl-5">
              {hist.map((a, idx) => (
                <li key={idx} className="relative">
                  <span
                    className={`absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full border-2 border-white ${
                      a.actuel ? "bg-[#2D8F5A]" : "bg-slate-300"
                    }`}
                  />
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{a.attributaires?.nom ?? "—"}</p>
                    {a.actuel && (
                      <span className="rounded bg-[#2D8F5A]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#2D8F5A]">
                        ACTUEL
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {QUALITE_LABELS[a.qualite ?? ""] ?? a.qualite ?? "—"}
                    {a.observation && ` · ${a.observation}`}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </>
  );
}
