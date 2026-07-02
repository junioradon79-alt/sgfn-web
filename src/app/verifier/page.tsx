"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, ShieldX, ShieldAlert, Loader2, ScanLine } from "lucide-react";

type Verdict = "idle" | "loading" | "trouve" | "introuvable" | "erreur";

type ResultatVerification = {
  type_document?: string | null;
  statut?: string;
  [key: string]: unknown;
};

const TYPE_LABEL: Record<string, string> = {
  attestation_cession: "Attestation de cession",
  certificat_vente: "Certificat de vente",
  apfc: "Attestation de propriété foncière coutumière (APFC)",
};

const CHAMP_LABEL: Record<string, string> = {
  reference: "Référence",
  statut_document: "Statut du document",
  statut_attestation: "Statut de l'attestation",
  proprietaire_actuel: "Propriétaire actuel",
  qualite_proprietaire_actuel: "Qualité",
  autorite_coutumiere_apfc: "Autorité coutumière (APFC)",
  guide_page: "Page du guide",
  acquereur: "Acquéreur",
  proprietaire: "Propriétaire",
  lot: "Lot",
  ilot: "Îlot",
  lotissement: "Lotissement",
  village: "Village",
  commune: "Commune",
  district: "District",
  superficie: "Superficie",
  nb_ilots: "Nombre d'îlots",
  nb_lots: "Nombre de lots",
  famille: "Famille",
  lignee: "Lignée",
  chef_de_famille: "Chef de famille",
  autorite_coutumiere: "Autorité coutumière",
  autorite_chef: "Chef",
  date_emission: "Date d'émission",
  date_delivrance: "Date de délivrance",
  statut_litige: "Litige",
  nb_attestations_emises: "Attestations émises",
  pv_numero_enregistrement: "N° enregistrement PV",
  pv_commissaire_nom: "Commissaire de justice",
  pv_commissaire_etude: "Étude",
  guide_reference: "Guide de référence",
};

function fmtValeur(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    return new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  }
  return String(v);
}

function VerifierForm() {
  const searchParams = useSearchParams();
  const refInitiale = searchParams.get("ref") ?? searchParams.get("token") ?? "";

  const [ref, setRef] = useState(refInitiale);
  const [verdict, setVerdict] = useState<Verdict>("idle");
  const [resultat, setResultat] = useState<ResultatVerification | null>(null);

  const verifier = useCallback(async (reference: string) => {
    const r = reference.trim();
    if (!r) return;
    setVerdict("loading");
    setResultat(null);

    // Géolocalisation facultative (DCFT §6 : géolocalisation des scans)
    const position = await new Promise<GeolocationPosition | null>((resolve) => {
      if (!("geolocation" in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
        timeout: 3000,
        maximumAge: 300000,
      });
    });

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/verification-qr`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ref: r,
            latitude: position?.coords.latitude ?? null,
            longitude: position?.coords.longitude ?? null,
          }),
        },
      );
      const data: ResultatVerification = await res.json();
      if (!res.ok || data.statut === "erreur") {
        setVerdict("erreur");
      } else if (!data.type_document) {
        setVerdict("introuvable");
      } else {
        setResultat(data);
        setVerdict("trouve");
      }
    } catch {
      setVerdict("erreur");
    }
  }, []);

  // Vérification automatique quand on arrive via un QR code scanné
  useEffect(() => {
    if (refInitiale) verifier(refInitiale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refInitiale]);

  const litigeActif =
    resultat?.statut_litige && resultat.statut_litige !== "aucun";
  const litigesApfc = Array.isArray(resultat?.litiges_actifs)
    ? (resultat.litiges_actifs as Record<string, unknown>[])
    : [];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-20 text-slate-900 antialiased">
      <div className="mx-auto flex max-w-3xl flex-col items-center">
        <Link
          href="/"
          className="mb-8 text-sm font-semibold text-[#1E6091] transition hover:text-[#0D3B66]"
        >
          ← Retour à l&apos;accueil
        </Link>

        <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_rgba(13,59,102,0.08)] sm:p-10">
          <div className="text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
              Vérification
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-[#0D3B66] sm:text-4xl">
              Vérifier un document SGNF
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
              Scannez le QR code d&apos;un document ou saisissez sa référence pour
              vérifier son authenticité auprès du registre foncier numérique.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifier(ref);
            }}
            className="mx-auto mt-8 flex max-w-xl gap-3"
          >
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Référence ou code QR (ex : ATT-2026-0001)"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#1E6091] focus:ring-2 focus:ring-[#1E6091]/20"
            />
            <button
              type="submit"
              disabled={verdict === "loading" || !ref.trim()}
              className="flex items-center gap-2 rounded-xl bg-[#0D3B66] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1E6091] disabled:opacity-50"
            >
              {verdict === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanLine className="h-4 w-4" />
              )}
              Vérifier
            </button>
          </form>

          {verdict === "introuvable" && (
            <div className="mt-8 flex items-start gap-4 rounded-2xl bg-red-50 p-6">
              <ShieldX className="mt-0.5 h-8 w-8 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold text-red-800">Document introuvable</p>
                <p className="mt-1 text-sm text-red-700">
                  Aucun document du registre SGNF ne correspond à cette référence.
                  Si ce code figure sur un document qui vous a été présenté, il peut
                  s&apos;agir d&apos;un faux — rapprochez-vous de SGNF.
                </p>
              </div>
            </div>
          )}

          {verdict === "erreur" && (
            <div className="mt-8 flex items-start gap-4 rounded-2xl bg-amber-50 p-6">
              <ShieldAlert className="mt-0.5 h-8 w-8 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-800">Vérification impossible</p>
                <p className="mt-1 text-sm text-amber-700">
                  Une erreur technique est survenue. Réessayez dans quelques instants.
                </p>
              </div>
            </div>
          )}

          {verdict === "trouve" && resultat && (
            <div className="mt-8">
              <div
                className={`flex items-start gap-4 rounded-2xl p-6 ${
                  litigeActif ? "bg-amber-50" : "bg-emerald-50"
                }`}
              >
                {litigeActif ? (
                  <ShieldAlert className="mt-0.5 h-8 w-8 shrink-0 text-amber-600" />
                ) : (
                  <ShieldCheck className="mt-0.5 h-8 w-8 shrink-0 text-emerald-600" />
                )}
                <div>
                  <p
                    className={`font-semibold ${
                      litigeActif ? "text-amber-800" : "text-emerald-800"
                    }`}
                  >
                    Document authentique —{" "}
                    {TYPE_LABEL[String(resultat.type_document)] ?? resultat.type_document}
                  </p>
                  <p
                    className={`mt-1 text-sm ${
                      litigeActif ? "text-amber-700" : "text-emerald-700"
                    }`}
                  >
                    {litigeActif
                      ? "Ce document est enregistré au registre SGNF, mais un litige est en cours sur ce bien."
                      : "Ce document est enregistré au registre foncier numérique SGNF."}
                  </p>
                </div>
              </div>

              <dl className="mt-6 grid gap-x-8 gap-y-3 rounded-2xl border border-slate-200 p-6 sm:grid-cols-2">
                {Object.entries(CHAMP_LABEL)
                  .filter(([k]) => resultat[k] !== undefined)
                  .map(([k, label]) => (
                    <div key={k}>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-sm font-medium text-slate-800">
                        {fmtValeur(resultat[k])}
                      </dd>
                    </div>
                  ))}
              </dl>

              {litigesApfc.length > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-6">
                  <p className="text-sm font-semibold text-amber-800">
                    Litiges en cours sur ce lotissement
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-amber-700">
                    {litigesApfc.map((l, i) => (
                      <li key={i}>
                        Lot {String(l.lot ?? "—")} (îlot {String(l.ilot ?? "—")}) —{" "}
                        {String(l.objet ?? "")} ({String(l.statut ?? "")})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <p className="mt-8 text-center text-xs text-slate-400">
            Chaque vérification est validée côté serveur et journalisée par SGNF.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function VerifierPage() {
  return (
    <Suspense fallback={null}>
      <VerifierForm />
    </Suspense>
  );
}
