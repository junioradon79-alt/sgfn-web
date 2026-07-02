"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Badge } from "@/components/ui/Badge";
import {
  Download,
  FileCheck,
  FileSignature,
  FileText,
  ExternalLink,
  Hash,
  QrCode,
  X,
  Copy,
  Check,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AttestationRow = {
  id: string;
  reference: string;
  statut: string;
  date_emission: string | null;
  cree_le: string;
  sig_proprietaire_le: string | null;
  sig_operateur_le: string | null;
  sig_chefferie_le: string | null;
  qr_token: string | null;
  lots: { numero_lot: string | null; ilots: { numero: string | null; lotissements: { nom: string | null } | null } | null } | null;
  attributaires: { nom: string | null } | null;
};

type PvRow = {
  id: string;
  reference: string;
  objet: string;
  statut: string;
  date_reunion: string | null;
  valide_le: string | null;
  lieu: string | null;
  document_id: string | null;
  document: { url_fichier: string | null } | null;
  attributaires: { nom: string | null } | null;
};

type DocumentRow = {
  id: string;
  type: string;
  titre: string | null;
  emetteur: string | null;
  date_document: string | null;
  url_fichier: string;
  hash_fichier: string | null;
  televerse_le: string;
  lots: { numero_lot: string | null; ilots: { lotissements: { nom: string | null } | null } | null } | null;
};

type DlState = Record<string, "idle" | "loading" | "error">;

// ─── Constantes ───────────────────────────────────────────────────────────────

const ATT_STATUT_BADGE: Record<string, "disponible" | "en_validation" | "attribue" | "litige"> = {
  a_generer: "en_validation",
  generee: "disponible",
  delivree: "attribue",
  revoquee: "litige",
};
const ATT_STATUT_LABEL: Record<string, string> = {
  a_generer: "À générer",
  generee: "Générée",
  delivree: "Délivrée",
  revoquee: "Révoquée",
};

const PV_STATUT_BADGE: Record<string, "disponible" | "en_validation" | "attribue" | "litige"> = {
  a_fournir: "en_validation",
  fourni: "disponible",
  valide: "attribue",
  rejete: "litige",
};
const PV_STATUT_LABEL: Record<string, string> = {
  a_fournir: "À fournir",
  fourni: "Fourni",
  valide: "Validé",
  rejete: "Rejeté",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  apfc: "APFC",
  attestation_cession: "Attestation de cession",
  plan_lotissement: "Plan de lotissement",
  plan_lot: "Plan de lot",
  piece_identite: "Pièce d'identité",
  acte_vente: "Acte de vente",
  quittance: "Quittance",
  acd: "ACD",
  titre_foncier: "Titre foncier",
  certificat_propriete_coutumiere: "Cert. propriété coutumière",
  pv_constatation: "PV de constatation",
  attestation_non_contestation: "Attestation non-contestation",
  plan_localisation: "Plan de localisation",
  autre: "Autre",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Indicateur de signature ──────────────────────────────────────────────────

function SigDots({ proprietaire, operateur, chefferie }: { proprietaire: string | null; operateur: string | null; chefferie: string | null }) {
  const sigs = [
    { label: "Propriétaire", date: proprietaire },
    { label: "Opérateur", date: operateur },
    { label: "Chefferie", date: chefferie },
  ];
  const signed = sigs.filter((s) => s.date).length;
  return (
    <div className="flex items-center gap-1.5">
      {sigs.map((s) => (
        <div
          key={s.label}
          title={s.date ? `${s.label} — ${fmtDate(s.date)}` : `${s.label} — non signé`}
          className={`h-2.5 w-2.5 rounded-full ${s.date ? "bg-emerald-500" : "bg-slate-200"}`}
        />
      ))}
      <span className="ml-1 text-xs text-slate-400">{signed}/3</span>
    </div>
  );
}

// ─── Onglets Attestations ─────────────────────────────────────────────────────

function AttestationsTab({ rows, dlState, onDownload, onShowQr }: {
  rows: AttestationRow[];
  dlState: DlState;
  onDownload: (ref: string) => void;
  onShowQr: (att: AttestationRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-slate-400">
        <FileCheck className="mb-3 h-8 w-8 text-slate-300" />
        Aucune attestation enregistrée.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
            <th className="px-5 py-3">Référence</th>
            <th className="px-5 py-3">Lot</th>
            <th className="px-5 py-3">Acquéreur</th>
            <th className="px-5 py-3">Statut</th>
            <th className="px-5 py-3">Signatures</th>
            <th className="px-5 py-3">Date émission</th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((att) => {
            const lot = att.lots;
            const lotLabel = lot
              ? `Lot ${lot.numero_lot ?? "—"}${lot.ilots?.numero ? ` · Îlot ${lot.ilots.numero}` : ""}`
              : "—";
            const lotissement = lot?.ilots?.lotissements?.nom ?? null;
            const dl = dlState[att.reference] ?? "idle";
            return (
              <tr key={att.id} className="transition hover:bg-slate-50/50">
                <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[#0D3B66]">
                  {att.reference}
                </td>
                <td className="px-5 py-3.5 text-slate-700">
                  {lotLabel}
                  {lotissement && (
                    <p className="text-xs text-slate-400">{lotissement}</p>
                  )}
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {att.attributaires?.nom ?? "—"}
                </td>
                <td className="px-5 py-3.5">
                  <Badge status={ATT_STATUT_BADGE[att.statut] ?? "en_validation"}>
                    {ATT_STATUT_LABEL[att.statut] ?? att.statut}
                  </Badge>
                </td>
                <td className="px-5 py-3.5">
                  <SigDots
                    proprietaire={att.sig_proprietaire_le}
                    operateur={att.sig_operateur_le}
                    chefferie={att.sig_chefferie_le}
                  />
                </td>
                <td className="px-5 py-3.5 text-slate-500">
                  {fmtDate(att.date_emission ?? att.cree_le)}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                  {att.qr_token && (
                    <button
                      onClick={() => onShowQr(att)}
                      title="QR code de vérification"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-[#0D3B66]"
                    >
                      <QrCode className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onDownload(att.reference)}
                    disabled={dl === "loading"}
                    title="Télécharger"
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                      dl === "error"
                        ? "text-red-500"
                        : "text-slate-400 hover:bg-slate-100 hover:text-[#0D3B66]"
                    } disabled:opacity-50`}
                  >
                    <Download className={`h-4 w-4 ${dl === "loading" ? "animate-pulse" : ""}`} />
                  </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Onglet PV de famille ─────────────────────────────────────────────────────

function PvTab({ rows }: { rows: PvRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-slate-400">
        <FileSignature className="mb-3 h-8 w-8 text-slate-300" />
        Aucun PV de famille enregistré.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
            <th className="px-5 py-3">Référence</th>
            <th className="px-5 py-3">Objet</th>
            <th className="px-5 py-3">Collectif</th>
            <th className="px-5 py-3">Statut</th>
            <th className="px-5 py-3">Date réunion</th>
            <th className="px-5 py-3">Validé le</th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((pv) => {
            const fileUrl = pv.document?.url_fichier ?? null;
            return (
              <tr key={pv.id} className="transition hover:bg-slate-50/50">
                <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[#0D3B66]">
                  {pv.reference}
                </td>
                <td className="px-5 py-3.5 text-slate-800">
                  <p className="max-w-[260px] truncate">{pv.objet}</p>
                  {pv.lieu && (
                    <p className="text-xs text-slate-400">{pv.lieu}</p>
                  )}
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {pv.attributaires?.nom ?? "—"}
                </td>
                <td className="px-5 py-3.5">
                  <Badge status={PV_STATUT_BADGE[pv.statut] ?? "en_validation"}>
                    {PV_STATUT_LABEL[pv.statut] ?? pv.statut}
                  </Badge>
                </td>
                <td className="px-5 py-3.5 text-slate-500">{fmtDate(pv.date_reunion)}</td>
                <td className="px-5 py-3.5 text-slate-500">{fmtDate(pv.valide_le)}</td>
                <td className="px-5 py-3.5 text-right">
                  {fileUrl ? (
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ouvrir le document"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-[#0D3B66]"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Onglet Documents génériques ──────────────────────────────────────────────

function DocumentsTab({ rows }: { rows: DocumentRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-slate-400">
        <FileText className="mb-3 h-8 w-8 text-slate-300" />
        Aucun document téléversé.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
            <th className="px-5 py-3">Type</th>
            <th className="px-5 py-3">Titre</th>
            <th className="px-5 py-3">Émetteur</th>
            <th className="px-5 py-3">Lot associé</th>
            <th className="px-5 py-3">Date document</th>
            <th className="px-5 py-3">Intégrité</th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((doc) => {
            const lot = doc.lots;
            const lotLabel = lot ? `Lot ${lot.numero_lot ?? "—"}` : null;
            const lotissement = lot?.ilots?.lotissements?.nom ?? null;
            return (
              <tr key={doc.id} className="transition hover:bg-slate-50/50">
                <td className="px-5 py-3.5">
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {DOC_TYPE_LABEL[doc.type] ?? doc.type}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-slate-800">
                  {doc.titre ?? <span className="text-slate-300">Sans titre</span>}
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {doc.emetteur ?? <span className="text-slate-300">—</span>}
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {lotLabel ? (
                    <>
                      {lotLabel}
                      {lotissement && (
                        <p className="text-xs text-slate-400">{lotissement}</p>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-slate-500">
                  {fmtDate(doc.date_document ?? doc.televerse_le)}
                </td>
                <td className="px-5 py-3.5">
                  {doc.hash_fichier ? (
                    <span
                      title={doc.hash_fichier}
                      className="flex items-center gap-1 text-xs text-emerald-600"
                    >
                      <Hash className="h-3 w-3" />
                      Hashé
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <a
                    href={doc.url_fichier}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Ouvrir"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-[#0D3B66]"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Modale QR code ───────────────────────────────────────────────────────────

function QrModal({ att, onClose }: { att: AttestationRow; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const urlVerification = `${window.location.origin}/verifier/?ref=${att.qr_token}`;

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(urlVerification);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard indisponible */ }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="text-left">
            <p className="text-sm font-semibold text-[#0D3B66]">QR code de vérification</p>
            <p className="mt-0.5 font-mono text-xs text-slate-500">{att.reference}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex justify-center rounded-xl border border-slate-200 bg-white p-5">
          <QRCodeSVG value={urlVerification} size={220} level="M" includeMargin={false} />
        </div>

        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Ce QR code figure sur le document imprimé. Tout scan mène à la page
          publique de vérification SGNF et est journalisé côté serveur.
        </p>

        <button
          onClick={copier}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D3B66] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1E6091]"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Lien copié" : "Copier le lien de vérification"}
        </button>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type Tab = "attestations" | "pv" | "documents";

export default function DocumentsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<Tab>("attestations");
  const [attestations, setAttestations] = useState<AttestationRow[]>([]);
  const [pvs, setPvs] = useState<PvRow[]>([]);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dlState, setDlState] = useState<DlState>({});
  const [qrAtt, setQrAtt] = useState<AttestationRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [attRes, pvRes, docRes] = await Promise.all([
      supabase
        .from("attestations_cession")
        .select(
          "id, reference, statut, date_emission, cree_le, sig_proprietaire_le, sig_operateur_le, sig_chefferie_le, qr_token, lots(numero_lot, ilots(numero, lotissements(nom))), attributaires(nom)"
        )
        .order("cree_le", { ascending: false }),
      supabase
        .from("pv_reunions_famille")
        .select(
          "id, reference, objet, statut, date_reunion, valide_le, lieu, document_id, document:documents!document_id(url_fichier), attributaires:attributaires!pv_reunions_famille_collectif_attributaire_id_fkey(nom)"
        )
        .order("cree_le", { ascending: false }),
      supabase
        .from("documents")
        .select(
          "id, type, titre, emetteur, date_document, url_fichier, hash_fichier, televerse_le, lots(numero_lot, ilots(lotissements(nom)))"
        )
        .order("televerse_le", { ascending: false }),
    ]);
    setAttestations((attRes.data ?? []) as unknown as AttestationRow[]);
    setPvs((pvRes.data ?? []) as unknown as PvRow[]);
    setDocs((docRes.data ?? []) as unknown as DocumentRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const telecharger = async (reference: string) => {
    setDlState((s) => ({ ...s, [reference]: "loading" }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/telecharger-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ table: "attestations_cession", reference }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.erreur || "Erreur");
      window.open(json.url, "_blank");
      setDlState((s) => ({ ...s, [reference]: "idle" }));
    } catch {
      setDlState((s) => ({ ...s, [reference]: "error" }));
      setTimeout(() => setDlState((s) => ({ ...s, [reference]: "idle" })), 2500);
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "attestations", label: "Attestations", icon: <FileCheck className="h-4 w-4" />, count: attestations.length },
    { id: "pv", label: "PV de famille", icon: <FileSignature className="h-4 w-4" />, count: pvs.length },
    { id: "documents", label: "Documents", icon: <FileText className="h-4 w-4" />, count: docs.length },
  ];

  const delivrees = attestations.filter((a) => a.statut === "delivree").length;
  const pvValides = pvs.filter((p) => p.statut === "valide").length;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0D3B66]">Coffre-fort Documentaire</h1>
        <p className="mt-1 text-sm sm:text-base text-slate-500">
          Attestations de cession, PV de famille et documents officiels.
        </p>
      </div>

      {/* KPIs */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Attestations</p>
            <p className="mt-1 text-2xl font-bold text-[#0D3B66]">{attestations.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Délivrées</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{delivrees}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">PV de famille</p>
            <p className="mt-1 text-2xl font-bold text-[#0D3B66]">{pvs.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">PV validés</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{pvValides}</p>
          </div>
        </div>
      )}

      {/* Onglets */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        {/* Barre d'onglets */}
        <div className="flex border-b border-slate-100">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-b-2 border-[#0D3B66] text-[#0D3B66]"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.icon}
              {tab.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  activeTab === tab.id
                    ? "bg-[#0D3B66]/10 text-[#0D3B66]"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {loading ? "…" : tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Chargement…
          </div>
        ) : activeTab === "attestations" ? (
          <AttestationsTab rows={attestations} dlState={dlState} onDownload={telecharger} onShowQr={setQrAtt} />
        ) : activeTab === "pv" ? (
          <PvTab rows={pvs} />
        ) : (
          <DocumentsTab rows={docs} />
        )}
      </div>

      {qrAtt && <QrModal att={qrAtt} onClose={() => setQrAtt(null)} />}
    </div>
  );
}
