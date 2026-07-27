"use client";

import type { ReactNode } from "react";
import {
  PenLine,
  Handshake,
  FileWarning,
  FolderOpen,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CountBadge } from "@/components/ds/badge";
import type { AdminOverview } from "@/hooks/useAdminOverview";
import { ListeSaisies } from "../../components/ListeSaisies";
import type { EcranSaisie } from "../../roles";

export function FilesScreen({
  overview,
  openWeb,
  onOpenSoumissions,
  onOuvrirSaisie,
  saisies,
}: {
  overview: AdminOverview;
  openWeb: (path: string) => void;
  /**
   * Ouvre la file des saisies DANS l'app (SoumissionsScreen). Optionnel le temps
   * que la coquille le câble : sans lui, la ligne retombe sur l'ancien renvoi
   * vers le web plutôt que d'offrir un bouton mort.
   */
  onOpenSoumissions?: () => void;
  /** Ouvre l'un des quatre formulaires de saisie. Absent = section masquée. */
  onOuvrirSaisie?: (ecran: EcranSaisie) => void;
  /**
   * Formulaires ouverts au rôle (cf. `saisiesPour`). Cet écran est réservé à
   * l'admin, qui les a tous — le paramètre existe pour que la liste ne soit
   * jamais codée en dur à deux endroits.
   */
  saisies?: EcranSaisie[];
}) {
  const { files } = overview;

  // `externe` n'est pas un détail décoratif : il dit si le tap fait SORTIR de
  // l'app. Les saisies se traitent désormais sur place, les trois autres files
  // demandent encore le dashboard web.
  const queues: { icon: LucideIcon; label: string; count: number; onPress: () => void; externe: boolean }[] = [
    {
      icon: PenLine,
      label: "Saisies à valider",
      count: files.saisieAValider,
      onPress: onOpenSoumissions ?? (() => openWeb("/dashboard/saisie/")),
      externe: !onOpenSoumissions,
    },
    {
      icon: Handshake,
      label: "Demandes à traiter",
      count: files.demandesATraiter,
      onPress: () => openWeb("/dashboard/demandes-acquisition/"),
      externe: true,
    },
    {
      icon: FileWarning,
      label: "Litiges ouverts",
      count: files.litigesOuverts,
      onPress: () => openWeb("/dashboard/litiges/"),
      externe: true,
    },
    {
      icon: FolderOpen,
      label: "Dossiers ADU en cours",
      count: files.dossiersAduEnCours,
      onPress: () => openWeb("/dashboard/dossiers-adu/"),
      externe: true,
    },
  ];

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <div className="flex-none px-[18px] pt-2 pb-3">
        <div className="text-[22px] font-extrabold text-foreground">À faire</div>
        <div className="mt-0.5 text-[12.5px] text-muted-foreground">Files nationales à traiter</div>
      </div>

      <div className="sgnf-scroll flex-1 overflow-y-auto px-[18px] pb-6">
        <div className="flex flex-col gap-2.5">
          {/* La teinte suit la file, pas le type de dossier : un litige à zéro
              n'a rien d'alarmant, une file de saisies à trente attend bel et
              bien quelqu'un. Auparavant seuls les litiges viraient au rouge,
              quel que soit leur nombre. */}
          {queues.map((q) => {
            const Icon = q.icon;
            const aTraiter = q.count > 0;
            return (
              <button
                key={q.label}
                type="button"
                onClick={q.onPress}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left shadow-panel ${
                  aTraiter ? "border-brick/45 bg-brick-subtle" : "border-border bg-card"
                }`}
              >
                <span
                  className={`flex size-10 flex-none items-center justify-center rounded-xl ${
                    aTraiter ? "bg-brick text-brick-foreground" : "bg-inset text-primary"
                  }`}
                >
                  <Icon className="size-5" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1 text-[14px] font-semibold text-foreground">{q.label}</span>
                {aTraiter ? (
                  <CountBadge value={q.count} />
                ) : (
                  <span className="tabular text-[20px] font-extrabold text-muted-2">0</span>
                )}
                {q.externe ? (
                  <ExternalLink className="size-4 flex-none text-muted-2" />
                ) : (
                  <ChevronRight className="size-4 flex-none text-muted-2" />
                )}
              </button>
            );
          })}
        </div>

        {/* Saisir dans le registre.
            Placé ici, sous les files, et non dans un onglet à part : ce que
            l'on saisit atterrit dans « Saisies à valider », deux centimètres
            plus haut. La boucle maker-checker — je soumets, un administrateur
            approuve — tient donc sur un seul écran, et le compteur du haut
            monte sous les yeux de celui qui vient d'envoyer. Un cinquième
            onglet aurait séparé l'acte de sa conséquence. */}
        {onOuvrirSaisie && (
          <>
            <SectionTitle>Saisir dans le registre</SectionTitle>
            <p className="-mt-1.5 mb-2.5 text-[11.5px] leading-snug text-muted-foreground">
              Toute saisie part dans « Saisies à valider » ci-dessus. Rien n&apos;est écrit dans le
              registre avant approbation, même pour un administrateur.
            </p>
            <ListeSaisies
              ecrans={saisies ?? ["lot", "attributaire", "lotissement", "structure"]}
              onOuvrir={onOuvrirSaisie}
            />
          </>
        )}

        {/* Litiges récents */}
        {files.litiges.length > 0 && (
          <>
            <SectionTitle>Litiges récents</SectionTitle>
            <div className="rounded-[18px] border border-border bg-card px-4 shadow-panel">
              {files.litiges.slice(0, 5).map((l, i, arr) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => openWeb("/dashboard/litiges/")}
                  className={`flex w-full items-center gap-3 py-3 text-left ${i < arr.length - 1 ? "border-b border-border" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">
                      {l.objet ?? "Litige"}
                    </span>
                    <span className="block text-[11.5px] text-muted-foreground">
                      {l.lots?.numero_lot ? `Lot ${l.lots.numero_lot} · ` : ""}
                      {l.statut ?? "—"}
                    </span>
                  </span>
                  <ChevronRight className="size-4 flex-none text-muted-2" />
                </button>
              ))}
            </div>
          </>
        )}

        {/* Dossiers ADU */}
        {files.dossiersAdu.length > 0 && (
          <>
            <SectionTitle>Dossiers ADU</SectionTitle>
            <div className="rounded-[18px] border border-border bg-card px-4 shadow-panel">
              {files.dossiersAdu.slice(0, 5).map((d, i, arr) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => openWeb("/dashboard/dossiers-adu/")}
                  className={`flex w-full items-center gap-3 py-3 text-left ${i < arr.length - 1 ? "border-b border-border" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">
                      {d.adu_numero ?? "Dossier ADU"}
                    </span>
                    <span className="block text-[11.5px] text-muted-foreground">{d.statut ?? "—"}</span>
                  </span>
                  <ChevronRight className="size-4 flex-none text-muted-2" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="mt-5 mb-2.5 text-[15px] font-bold text-foreground">{children}</div>;
}
