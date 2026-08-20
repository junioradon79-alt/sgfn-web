import Link from "next/link";
import { Edit2, Eye, MapPin, Plus, ScrollText, ShieldAlert, Trash2 } from "lucide-react";
import type { Lotissement } from "../types";
import type { Apfc } from "../services/apfc.service";
import type { ArreteApprobation } from "../services/arreteApprobation.service";
import type { ArreteAcd } from "../services/arreteAcd.service";

type Props = {
  lotissements: Lotissement[];
  onEdit?: (lotissement: Lotissement) => void;
  onDelete?: (id: string) => void;
  /** APFC existantes (lotissements villageois), indexées par `lotissement_id`. */
  apfcParLotissement?: Map<string, Apfc>;
  onApfc?: (lotissement: Lotissement) => void;
  /** Arrêtés d'approbation existants (lotissements approuvés), indexés par `lotissement_id`. */
  arretesApprobationParLotissement?: Map<string, ArreteApprobation>;
  onArreteApprobation?: (lotissement: Lotissement) => void;
  /** Arrêtés ACD existants (lotissements ACD), indexés par `lotissement_id`. */
  arretesAcdParLotissement?: Map<string, ArreteAcd>;
  onArreteAcd?: (lotissement: Lotissement) => void;
  /** Admin seulement : accorder / retirer la dérogation à l'obligation documentaire. */
  onDeroger?: (lotissement: Lotissement) => void;
  onRetirerDerogation?: (lotissement: Lotissement) => void;
};

const TABLE_HEADERS = [
  "Nom du lotissement",
  "Localisation",
  "Lots",
  "Îlots",
  "Superficie",
  "Pièce foncière",
  "Actions",
] as const;

/** Les 3 pièces partagent le même enum de statut (a_delivrer/en_cours/delivree). */
type StatutPiece = "a_delivrer" | "en_cours" | "delivree";

/** Couleurs du badge — l'absence est un défaut, pas un état neutre. */
const PIECE_TONS: Record<StatutPiece, string> = {
  delivree: "bg-emerald-50 text-emerald-700",
  en_cours: "bg-amber-50 text-amber-700",
  a_delivrer: "bg-slate-100 text-slate-600",
};

const PIECE_LIBELLES: Record<StatutPiece, string> = {
  delivree: "Délivrée",
  en_cours: "En cours",
  a_delivrer: "À délivrer",
};

/**
 * Nom de la pièce foncière principale selon `type_lotissement` -- 3 tables
 * séparées (Phase B, migration 20260820100000), pas de généralisation :
 * villageois -> APFC, approuve -> Arrêté d'approbation, acd -> Arrêté ACD.
 */
const NOM_PIECE: Record<Lotissement["type_lotissement"], string> = {
  villageois: "APFC",
  approuve: "Arrêté d'approbation",
  acd: "Arrêté ACD",
};

export default function LotissementTable({
  lotissements,
  onEdit,
  onDelete,
  apfcParLotissement,
  onApfc,
  arretesApprobationParLotissement,
  onArreteApprobation,
  arretesAcdParLotissement,
  onArreteAcd,
  onDeroger,
  onRetirerDerogation,
}: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
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
            {lotissements.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                  Aucun lotissement enregistré.
                </td>
              </tr>
            ) : (
              lotissements.map((l) => {
                // Pièce foncière principale selon le type du lotissement --
                // même patron pour les 3 types, table/formulaire différents.
                const nomPiece = NOM_PIECE[l.type_lotissement];
                const piece =
                  l.type_lotissement === "villageois"
                    ? apfcParLotissement?.get(l.id)
                    : l.type_lotissement === "approuve"
                      ? arretesApprobationParLotissement?.get(l.id)
                      : arretesAcdParLotissement?.get(l.id);
                const onOuvrirFormulaire =
                  l.type_lotissement === "villageois"
                    ? onApfc
                    : l.type_lotissement === "approuve"
                      ? onArreteApprobation
                      : onArreteAcd;

                return (
                  <tr key={l.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-[#0D3B66]">{l.nom}</p>
                      {l.village && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="h-3 w-3" />
                          {l.village}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {[l.commune, l.district].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold tabular-nums text-slate-700">
                      {l.nb_lots ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-sm tabular-nums text-slate-600">
                      {l.nb_ilots ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {l.superficie_texte ?? (l.superficie_m2 ? `${l.superficie_m2.toLocaleString("fr-FR")} m²` : "—")}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {nomPiece}
                        </span>
                        {(() => {
                          if (!piece) {
                            // Sans dossier documentaire complet, le lotissement
                            // n'émet plus d'attestation (migration 20260722200000,
                            // généralisée aux 3 types par 20260820110000).
                            // L'état dérogé se lit donc ici même : autrement, un
                            // blocage levé ailleurs serait invisible depuis l'écran
                            // qui montre le manque.
                            const derogue = Boolean(l.derogation_documents_le);
                            return (
                              <div className="flex flex-col items-start gap-1">
                                {onOuvrirFormulaire ? (
                                  <button
                                    type="button"
                                    onClick={() => onOuvrirFormulaire(l)}
                                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-red-300 bg-red-50/60 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                                    aria-label={`Ajouter ${nomPiece} de ${l.nom}`}
                                  >
                                    <Plus className="h-3 w-3" />
                                    Aucune
                                  </button>
                                ) : (
                                  <span className="text-xs font-medium text-red-600">Aucune</span>
                                )}
                                {derogue ? (
                                  <button
                                    type="button"
                                    onClick={onRetirerDerogation ? () => onRetirerDerogation(l) : undefined}
                                    disabled={!onRetirerDerogation}
                                    title={l.derogation_documents_motif ?? undefined}
                                    className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors enabled:hover:bg-amber-100 disabled:cursor-default"
                                  >
                                    <ShieldAlert className="h-3 w-3" />
                                    Dérogation
                                  </button>
                                ) : (
                                  onDeroger && (
                                    <button
                                      type="button"
                                      onClick={() => onDeroger(l)}
                                      className="text-xs font-medium text-slate-500 underline underline-offset-2 transition-colors hover:text-amber-700"
                                    >
                                      Déroger
                                    </button>
                                  )
                                )}
                              </div>
                            );
                          }
                          const badge = (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${PIECE_TONS[piece.statut]}`}
                            >
                              <ScrollText className="h-3 w-3" />
                              {PIECE_LIBELLES[piece.statut]}
                            </span>
                          );
                          return onOuvrirFormulaire ? (
                            <button
                              type="button"
                              onClick={() => onOuvrirFormulaire(l)}
                              aria-label={`Modifier ${nomPiece} de ${l.nom}`}
                              className="transition-opacity hover:opacity-75"
                            >
                              {badge}
                            </button>
                          ) : (
                            badge
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-0.5">
                        <Link
                          href={`/lotissements/${l.id}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0D3B66]"
                          aria-label={`Voir le détail de ${l.nom}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => onEdit?.(l)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0D3B66]"
                          aria-label={`Modifier ${l.nom}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete?.(l.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-[#EF4444]"
                          aria-label={`Supprimer ${l.nom}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
