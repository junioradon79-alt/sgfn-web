"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck, ShieldX, ShieldAlert, Loader2, ScanLine, Camera, X, Lock, Eye, MapPin,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { CONSULTATION_QR, fmtMontantFCFA } from "@/lib/consultation-qr";
import RadialGauge from "@/components/ui/RadialGauge";

const PasseportMap = dynamic(() => import("./PasseportMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-slate-100 text-xs text-slate-400">Carte…</div>,
});

type Verdict = "idle" | "loading" | "trouve" | "introuvable" | "erreur" | "paiement_requis";

// Métadonnées cadastrales du lotissement (plan de Titre Foncier), exposées par
// verifier_attestation()/verifier_document() dans l'objet `cadastre`.
type Cadastre = {
  livre_foncier?: string | null;
  centre_cadastral?: string | null;
  reference_plan?: string | null;
  tf_numero?: string | null;
  cedant?: string | null;
  beneficiaire_immatriculation?: string | null;
  geometre_expert?: string | null;
  cabinet_geometre?: string | null;
  date_leve_topographique?: string | null;
  nb_bornes?: number | null;
  superficie?: string | null;
  operateur?: string | null;
};

type ResultatVerification = {
  type_document?: string | null;
  statut?: string;
  reference?: string;
  montant_total?: number;
  code_consultation?: string;
  jeton_consultation?: string;
  statut_consultation?: string;
  consultation_payee?: boolean;
  score_confiance?: number;
  lat_approx?: number | null;
  lng_approx?: number | null;
  nb_verifications?: number;
  cadastre?: Cadastre | null;
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

const QR_READER_ID = "qr-reader-camera";

// Un QR code peut encoder soit la référence brute, soit une URL de deep link
// (ex: https://sgfn.ci/verifier?ref=ATT-2026-0001) — on extrait la référence des deux cas.
function extraireReference(texteScanne: string): string {
  const brut = texteScanne.trim();
  try {
    const url = new URL(brut);
    return url.searchParams.get("ref") ?? url.searchParams.get("token") ?? brut;
  } catch {
    return brut;
  }
}

function ScannerCamera({
  onResultat,
  onFermer,
}: {
  onResultat: (reference: string) => void;
  onFermer: () => void;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const arreteRef = useRef(false);

  useEffect(() => {
    arreteRef.current = false;
    let annule = false;

    const demarrer = async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (annule) return;

      const scanner = new Html5Qrcode(QR_READER_ID);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (texteDecode) => {
            if (arreteRef.current) return;
            arreteRef.current = true;
            onResultat(extraireReference(texteDecode));
          },
          () => {
            // échec de décodage sur une frame donnée : ignoré (normal en continu)
          },
        );
      } catch {
        if (!annule) {
          setErreur(
            "Impossible d'accéder à la caméra. Vérifiez les autorisations de votre navigateur.",
          );
        }
      }
    };

    demarrer();

    return () => {
      annule = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
  }, [onResultat]);

  return (
    <div className="mx-auto mt-6 max-w-xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#0D3B66]">Scanner un QR code</p>
        <button
          type="button"
          onClick={onFermer}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
          Fermer
        </button>
      </div>
      {erreur ? (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-6">
          <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-700">{erreur}</p>
        </div>
      ) : (
        <div
          id={QR_READER_ID}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-black"
        />
      )}
    </div>
  );
}

function fmtValeur(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    return new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  }
  return String(v);
}

// Jeton de consultation payante : conservé en sessionStorage pour redéclencher
// l'affichage du verdict après paiement (retour agrégateur ou validation manuelle).
function jetonStocke(reference: string): string | null {
  try {
    return sessionStorage.getItem(`sgnf-consultation:${reference}`);
  } catch {
    return null;
  }
}

function stockerJeton(references: (string | undefined)[], jeton: string) {
  try {
    for (const r of references) {
      if (r) sessionStorage.setItem(`sgnf-consultation:${r}`, jeton);
    }
  } catch {
    /* stockage indisponible (navigation privée…) : le jeton reste en mémoire */
  }
}

// ─── Sections du Passeport parcelle (mode="passeport" uniquement) ─────────────
// Assemblage de champs déjà exposés par verifier_attestation()/verifier_document() —
// aucune section ici ne fait de nouvel appel réseau.
function PasseportSections({ resultat, urlPasseport }: { resultat: ResultatVerification; urlPasseport: string }) {
  const historique = Array.isArray(resultat.historique_propriete)
    ? (resultat.historique_propriete as { nom?: string; qualite?: string; depuis?: string | null; actuel?: boolean }[])
    : [];
  const point: [number, number] | null =
    typeof resultat.lat_approx === "number" && typeof resultat.lng_approx === "number"
      ? [resultat.lat_approx, resultat.lng_approx]
      : null;

  const cadastre = (resultat.cadastre ?? null) as Cadastre | null;
  const cadastreItems = cadastre
    ? [
        { label: "Superficie (contenance)", value: cadastre.superficie },
        { label: "N° Titre Foncier", value: cadastre.tf_numero },
        { label: "Livre Foncier", value: cadastre.livre_foncier },
        { label: "Centre cadastral", value: cadastre.centre_cadastral },
        { label: "Référence du plan", value: cadastre.reference_plan },
        { label: "Cédant", value: cadastre.cedant },
        { label: "Bénéficiaire", value: cadastre.beneficiaire_immatriculation },
        { label: "Opérateur", value: cadastre.operateur },
        { label: "Nombre de bornes", value: cadastre.nb_bornes != null ? String(cadastre.nb_bornes) : null },
      ].filter((it) => it.value != null && it.value !== "")
    : [];

  return (
    <div className="mt-6 space-y-6">
      {/* Identifiant / informations générales */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Identifiant</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Lot", value: resultat.lot },
            { label: "Îlot", value: resultat.ilot ? `Îlot ${resultat.ilot}` : undefined },
            { label: "Lotissement", value: resultat.lotissement },
            { label: "Commune", value: resultat.commune },
            { label: "Village", value: resultat.village },
            { label: "Guide de référence", value: resultat.guide_reference },
            { label: "Page du guide", value: resultat.guide_page ? `Page ${resultat.guide_page}` : undefined },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-400">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{fmtValeur(item.value)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Données cadastrales (plan de Titre Foncier) */}
      {cadastreItems.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Données cadastrales</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cadastreItems.map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{fmtValeur(item.value)}</p>
              </div>
            ))}
          </div>
          {cadastre?.geometre_expert && (
            <p className="mt-3 text-xs text-slate-400">
              Levé et dressé par {cadastre.geometre_expert}
              {cadastre.cabinet_geometre ? ` — ${cadastre.cabinet_geometre}` : ""}
              {cadastre.date_leve_topographique ? `, le ${fmtValeur(cadastre.date_leve_topographique)}` : ""}.
            </p>
          )}
        </section>
      )}

      {/* Documents (document courant consulté) */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Documents</p>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">
              {TYPE_LABEL[String(resultat.type_document)] ?? resultat.type_document}
            </p>
            <p className="mt-0.5 font-mono text-xs text-slate-500">{resultat.reference}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {String(resultat.statut_attestation ?? resultat.statut_document ?? "—")}
          </span>
        </div>
      </section>

      {/* Chronologie de propriété */}
      {historique.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Chronologie de propriété</p>
          <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5">
            {historique.map((h, idx) => (
              <li key={`${h.nom ?? "proprietaire"}-${idx}`} className="relative">
                <span
                  className={`absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full border-2 border-white ${
                    h.actuel ? "bg-[#2D8F5A]" : "bg-slate-300"
                  }`}
                />
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{h.nom ?? "—"}</p>
                  {h.actuel && (
                    <span className="rounded bg-[#2D8F5A]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#2D8F5A]">ACTUEL</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{h.qualite ?? "—"}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Géométrie */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Géométrie</p>
        {point ? (
          <div className="h-56 overflow-hidden rounded-xl border border-slate-200">
            <PasseportMap point={point} />
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            <MapPin className="h-4 w-4 shrink-0" />
            Géométrie non renseignée pour ce lot.
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">
          Localisation approximative (~500 m) — la position exacte n&apos;est jamais transmise au navigateur.
        </p>
      </section>

      {/* Vérifications + QR */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <Eye className="h-6 w-6 shrink-0 text-[#1E6091]" />
          <div>
            <p className="text-lg font-bold text-slate-800">{resultat.nb_verifications ?? 0}</p>
            <p className="text-xs text-slate-500">vérification{(resultat.nb_verifications ?? 0) > 1 ? "s" : ""} enregistrée{(resultat.nb_verifications ?? 0) > 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
          <QRCodeSVG value={urlPasseport} size={96} level="M" />
          <p className="text-center text-xs text-slate-400">Partagez ce Passeport</p>
        </div>
      </section>
    </div>
  );
}

function VerifierForm({ mode = "verify" }: { mode?: "verify" | "passeport" }) {
  const searchParams = useSearchParams();
  const refInitiale = searchParams.get("ref") ?? searchParams.get("token") ?? "";
  // Présent au retour du paiement en ligne (return_url CinetPay)
  const jetonUrl = searchParams.get("consultation");

  const [ref, setRef] = useState(refInitiale);
  // "loading" d'emblée quand on arrive via un QR scanné : la vérification
  // démarre automatiquement (effet ci-dessous), sans flash "idle".
  const [verdict, setVerdict] = useState<Verdict>(() => (refInitiale ? "loading" : "idle"));
  const [resultat, setResultat] = useState<ResultatVerification | null>(null);
  // Depuis un raccourci "?scan=1" (page d'accueil, app mobile) : ouvrir la caméra
  // directement, sans passer par le clic sur "Scanner avec la caméra".
  const [scannerOuvert, setScannerOuvert] = useState(
    () => searchParams.get("scan") === "1" && !refInitiale,
  );
  const [paiementEnCours, setPaiementEnCours] = useState(false);
  const [messagePaiement, setMessagePaiement] = useState<string | null>(null);

  // Partie asynchrone de la vérification — aucun setState synchrone, elle peut
  // donc être appelée directement depuis l'effet de vérification automatique.
  const executerVerification = useCallback(async (reference: string) => {
    const r = reference.trim();
    if (!r) return;

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
            jeton_consultation: jetonUrl ?? jetonStocke(r),
            latitude: position?.coords.latitude ?? null,
            longitude: position?.coords.longitude ?? null,
          }),
        },
      );
      const data: ResultatVerification = await res.json();
      if (!res.ok || data.statut === "erreur") {
        setVerdict("erreur");
      } else if (data.statut === "paiement_requis") {
        if (data.jeton_consultation) stockerJeton([r, data.reference], data.jeton_consultation);
        setResultat(data);
        setVerdict("paiement_requis");
      } else if (!data.type_document) {
        setVerdict("introuvable");
      } else {
        setResultat(data);
        setVerdict("trouve");
      }
    } catch {
      setVerdict("erreur");
    }
  }, [jetonUrl]);

  // Point d'entrée des interactions (bouton, scan) : reset synchrone autorisé
  // dans un event handler, puis vérification asynchrone.
  const verifier = useCallback((reference: string) => {
    if (!reference.trim()) return;
    setVerdict("loading");
    setResultat(null);
    setMessagePaiement(null);
    void executerVerification(reference);
  }, [executerVerification]);

  // Vérification automatique quand on arrive via un QR code scanné
  // (verdict déjà initialisé à "loading" dans ce cas).
  useEffect(() => {
    // Tous les setState d'executerVerification sont post-await (asynchrones) ;
    // le traceur du plugin les signale quand même à travers le useCallback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (refInitiale) void executerVerification(refInitiale);
  }, [refInitiale]);

  const handleScanReussi = useCallback(
    (reference: string) => {
      setScannerOuvert(false);
      setRef(reference);
      verifier(reference);
    },
    [verifier],
  );

  const payer = useCallback(async () => {
    const jeton = resultat?.jeton_consultation;
    if (!jeton) return;
    setPaiementEnCours(true);
    setMessagePaiement(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/payer-consultation-qr`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jeton_consultation: jeton }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.payment_url) {
        window.location.href = data.payment_url;
        return;
      }
      if (res.status === 503) {
        setMessagePaiement(
          "Le paiement en ligne sera bientôt disponible. En attendant, réglez le montant auprès de SGNF en indiquant votre code de consultation, puis cliquez sur « J'ai payé — afficher le résultat ».",
        );
      } else {
        setMessagePaiement(
          typeof data.error === "string"
            ? data.error
            : "Le paiement n'a pas pu être initié. Réessayez dans quelques instants.",
        );
      }
    } catch {
      setMessagePaiement(
        "Le paiement n'a pas pu être initié. Vérifiez votre connexion et réessayez.",
      );
    }
    setPaiementEnCours(false);
  }, [resultat]);

  const litigeActif =
    resultat?.statut_litige && resultat.statut_litige !== "aucun";
  const litigesApfc = Array.isArray(resultat?.litiges_actifs)
    ? (resultat.litiges_actifs as Record<string, unknown>[])
    : [];
  const estPasseport = mode === "passeport" && resultat?.type_document !== "apfc";
  const titrePage = mode === "passeport" ? "Passeport parcelle SGNF" : "Vérifier un document SGNF";
  const introPage = mode === "passeport"
    ? "Scannez le QR code d'un document ou saisissez sa référence pour ouvrir le passeport complet de la parcelle."
    : "Scannez le QR code d'un document ou saisissez sa référence pour vérifier son authenticité auprès du registre foncier numérique.";

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
              {mode === "passeport" ? "Passeport parcelle" : "Vérification"}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-[#0D3B66] sm:text-4xl">
              {titrePage}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
              {introPage}
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

          {!scannerOuvert && (
            <div className="mx-auto mt-4 flex max-w-xl justify-center">
              <button
                type="button"
                onClick={() => setScannerOuvert(true)}
                className="flex items-center gap-2 rounded-xl border border-[#1E6091]/30 bg-white px-4 py-2 text-sm font-semibold text-[#1E6091] transition hover:bg-[#1E6091]/5"
              >
                <Camera className="h-4 w-4" />
                Scanner avec la caméra
              </button>
            </div>
          )}

          {scannerOuvert && (
            <ScannerCamera
              onResultat={handleScanReussi}
              onFermer={() => setScannerOuvert(false)}
            />
          )}

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

          {verdict === "paiement_requis" && resultat && (
            <div className="mt-8">
              <div className="flex items-start gap-4 rounded-2xl bg-[#0D3B66]/5 p-6">
                <ShieldCheck className="mt-0.5 h-8 w-8 shrink-0 text-[#0D3B66]" />
                <div>
                  <p className="font-semibold text-[#0D3B66]">
                    Document trouvé —{" "}
                    {TYPE_LABEL[String(resultat.type_document)] ?? resultat.type_document}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Référence : <span className="font-medium">{resultat.reference ?? ref}</span>
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 p-6">
                <div className="flex items-start gap-4">
                  <Lock className="mt-0.5 h-6 w-6 shrink-0 text-[#1E6091]" />
                  <div>
                    <p className="font-semibold text-slate-800">
                      La consultation du verdict d&apos;authenticité est un acte payant
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Le résultat complet de la vérification (authenticité, propriétaire
                      actuel, litiges éventuels) sera affiché après règlement de{" "}
                      <span className="font-semibold text-[#0D3B66]">
                        {fmtMontantFCFA(resultat.montant_total ?? CONSULTATION_QR.montant_total)}
                      </span>
                      .
                    </p>
                  </div>
                </div>

                {resultat.code_consultation && (
                  <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Votre code de consultation
                    </p>
                    <p className="mt-1 font-mono text-lg font-bold tracking-widest text-[#0D3B66]">
                      {resultat.code_consultation}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Conservez ce code : il identifie votre demande auprès de SGNF.
                    </p>
                  </div>
                )}

                {messagePaiement && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-4">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <p className="text-sm text-amber-700">{messagePaiement}</p>
                  </div>
                )}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={payer}
                    disabled={paiementEnCours}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0D3B66] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1E6091] disabled:opacity-50"
                  >
                    {paiementEnCours ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    Payer {fmtMontantFCFA(resultat.montant_total ?? CONSULTATION_QR.montant_total)}
                  </button>
                  <button
                    type="button"
                    onClick={() => verifier(ref)}
                    disabled={paiementEnCours}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#1E6091]/30 bg-white px-5 py-3 text-sm font-semibold text-[#1E6091] transition hover:bg-[#1E6091]/5 disabled:opacity-50"
                  >
                    J&apos;ai payé — afficher le résultat
                  </button>
                </div>

                <p className="mt-4 text-center text-xs text-slate-400">
                  Une consultation payée reste accessible pendant 24 heures.
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
                <div className="flex-1">
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
                {typeof resultat.score_confiance === "number" && (
                  <RadialGauge
                    value={resultat.score_confiance}
                    size={72}
                    strokeWidth={7}
                    gradient={
                      resultat.score_confiance >= 70
                        ? ["#16A34A", "#4ADE80"]
                        : resultat.score_confiance >= 40
                          ? ["#D97706", "#FBBF24"]
                          : ["#DC2626", "#F87171"]
                    }
                  >
                    <span className="text-sm font-bold text-slate-700">{resultat.score_confiance}</span>
                  </RadialGauge>
                )}
              </div>
              {typeof resultat.score_confiance === "number" && (
                <p className="mt-2 text-center text-xs text-slate-400">Score de confiance sur 100</p>
              )}

              {estPasseport ? (
                <PasseportSections
                  resultat={resultat}
                  urlPasseport={typeof window !== "undefined" ? `${window.location.origin}/passeport?ref=${resultat.reference}` : ""}
                />
              ) : (
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
              )}

              {mode === "verify" && resultat.type_document !== "apfc" && (
                <div className="mt-4 text-center">
                  <Link
                    href={`/passeport?ref=${encodeURIComponent(resultat.reference ?? ref)}`}
                    className="text-sm font-semibold text-[#1E6091] underline-offset-2 hover:underline"
                  >
                    Voir le Passeport complet de ce lot →
                  </Link>
                </div>
              )}

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

export default function VerifierPageContent({ mode = "verify" }: { mode?: "verify" | "passeport" }) {
  return (
    <Suspense fallback={null}>
      <VerifierForm mode={mode} />
    </Suspense>
  );
}
