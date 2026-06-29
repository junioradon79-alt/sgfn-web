"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CheckCircle2,
  Landmark,
  MapPin,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

/**
 * Espace Acquisition — destiné aux visiteurs en quête de lots (acquéreurs).
 * Affiche la conformité juridique par lotissement (avant toute prise de contact)
 * et les lots disponibles. Le bouton « Manifester un intérêt » appelle la RPC
 * `manifester_interet` qui route la conversation vers l'opérateur du lotissement,
 * le chef de famille et l'admin SGFN. Porté depuis `sgfn_espace_amenageur_2.html`.
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

  useEffect(() => {
    (async () => {
      const [conf, dispo] = await Promise.all([
        supabase.rpc("conformite_lotissements"),
        supabase.rpc("disponibilites_foncieres"),
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
      `Votre intérêt pour le lot ${lot.lot} (${lot.lotissement}) a été transmis à l'opérateur, au chef de famille et à l'agence SGFN. Suivez l'échange dans Messages.`
    );
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* En-tête */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-primary">Acquérir un lot</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Foncier disponible et vérifié — conformité juridique avant toute prise de contact.
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
          <h2 className="text-sm font-semibold text-slate-800">Lots disponibles</h2>
          <p className="text-xs text-slate-400">{lots.length} lot(s) libre(s) au registre</p>
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
                    onClick={() => void manifester(l)}
                    disabled={state === "loading" || state === "done"}
                    className={`mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-70 ${
                      state === "error"
                        ? "bg-[#EF4444]"
                        : state === "done"
                          ? "bg-[#2D8F5A]"
                          : "bg-[#0D3B66] hover:bg-[#0a2f52]"
                    }`}
                  >
                    {state === "loading"
                      ? "Envoi…"
                      : state === "done"
                        ? "Intérêt transmis ✓"
                        : state === "error"
                          ? "Erreur — réessayer"
                          : "Manifester un intérêt"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
          « Manifester un intérêt » envoie un message à l&apos;opérateur du lotissement, au chef de
          famille identifié et à l&apos;agence SGFN — suivez la réponse dans l&apos;onglet Messages.
          Aucune réservation automatique n&apos;est effectuée.
        </p>
      </section>
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
