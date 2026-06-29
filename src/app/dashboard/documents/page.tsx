import { Badge } from "@/components/ui/Badge";
import {
  Download,
  Eye,
  FileCheck,
  FileSignature,
  FileText,
  MoreHorizontal,
  Upload,
} from "lucide-react";

type SecurityStatus = "disponible" | "en_validation" | "litige";

interface DocumentCategory {
  id: string;
  label: string;
  count: number;
  icon: React.ReactNode;
}

interface Document {
  reference: string;
  fileName: string;
  type: string;
  parcelle: string;
  signataire: string;
  securityStatus: SecurityStatus;
  securityLabel: string;
  dateUpload: string;
}

const CATEGORIES: DocumentCategory[] = [
  {
    id: "attestations",
    label: "Attestations & ADU",
    count: 55,
    icon: <FileCheck className="h-4 w-4 text-[#0D3B66]" />,
  },
  {
    id: "pv-famille",
    label: "PV de Famille",
    count: 13,
    icon: <FileSignature className="h-4 w-4 text-[#1E6091]" />,
  },
  {
    id: "actes-vente",
    label: "Actes de Vente",
    count: 0,
    icon: <FileText className="h-4 w-4 text-slate-400" />,
  },
];

const MOCK_DOCUMENTS: Document[] = [
  {
    reference: "DOC-ACD-001",
    fileName: "PV_Famille_Angre_Signe.pdf",
    type: "PV de famille",
    parcelle: "Lot 14 — Îlot 02",
    signataire: "Chef de famille / Coutumier",
    securityStatus: "disponible",
    securityLabel: "Verrouillé",
    dateUpload: "08 fév. 2026",
  },
  {
    reference: "DOC-ADU-042",
    fileName: "Attestation_Domaine_Yao_Kouassi.pdf",
    type: "Attestation & ADU",
    parcelle: "Lot 07 — Îlot 01",
    signataire: "Notaire — Étude Konan & Associés",
    securityStatus: "disponible",
    securityLabel: "Verrouillé",
    dateUpload: "21 janv. 2026",
  },
  {
    reference: "DOC-PV-013",
    fileName: "PV_Famille_Bingerville_Draft.pdf",
    type: "PV de famille",
    parcelle: "Lot 03 — Îlot 01",
    signataire: "Sous-préfet de Bingerville",
    securityStatus: "en_validation",
    securityLabel: "En signature",
    dateUpload: "14 fév. 2026",
  },
  {
    reference: "DOC-PLN-022",
    fileName: "Plan_Cadastral_Lot22_V2.pdf",
    type: "Attestation & ADU",
    parcelle: "Lot 22 — Îlot 04",
    signataire: "Géomètre — Cabinet TopoCI",
    securityStatus: "en_validation",
    securityLabel: "En signature",
    dateUpload: "27 fév. 2026",
  },
];

const TABLE_HEADERS = [
  "Réf. Document",
  "Nom du fichier",
  "Type",
  "Parcelle associée",
  "Signataire",
  "Sécurité",
  "Date de téléversement",
  "Actions",
] as const;

function AuditMenu() {
  return (
    <details className="relative">
      <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 [&::-webkit-details-marker]:hidden">
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">Audit et historique</span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200/60 bg-white py-1 shadow-lg">
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
        >
          Journal d&apos;audit
        </button>
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
        >
          Empreinte blockchain
        </button>
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
        >
          Historique des signatures
        </button>
      </div>
    </details>
  );
}

export default function DocumentsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      {/* En-tête du module */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-primary">
            Coffre-fort Documentaire
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Archivage numérique, traçabilité et signature électronique des 68
            documents officiels et PV de famille.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#0D3B66] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#1E6091] active:scale-[0.98]"
        >
          <Upload className="h-4 w-4" />
          Téléverser un document
        </button>
      </div>

      {/* Grille de catégories — style Notion */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            className="group flex items-center justify-between rounded-xl border border-slate-200/60 bg-white px-4 py-3.5 text-left shadow-sm transition-all hover:border-[#0D3B66]/20 hover:bg-slate-50/80 hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F8FAFC] transition-colors group-hover:bg-[#0D3B66]/5">
                {category.icon}
              </div>
              <span className="text-sm font-medium text-slate-700">
                {category.label}
              </span>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600 transition-colors group-hover:bg-[#0D3B66]/10 group-hover:text-[#0D3B66]">
              {category.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/50">
                {TABLE_HEADERS.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 last:text-right"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {MOCK_DOCUMENTS.map((doc) => (
                <tr
                  key={doc.reference}
                  className="transition-colors hover:bg-slate-50/60"
                >
                  <td className="px-5 py-4 text-sm font-mono font-medium text-[#0D3B66]">
                    {doc.reference}
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-slate-800">
                    {doc.fileName}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {doc.type}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-700">
                    {doc.parcelle}
                  </td>
                  <td className="max-w-[180px] truncate px-5 py-4 text-sm text-slate-600">
                    {doc.signataire}
                  </td>
                  <td className="px-5 py-4">
                    <Badge status={doc.securityStatus}>
                      {doc.securityLabel}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    {doc.dateUpload}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0D3B66]"
                        aria-label={`Télécharger ${doc.fileName}`}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0D3B66]"
                        aria-label={`Prévisualiser ${doc.fileName}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <AuditMenu />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
