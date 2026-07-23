"use client";

import type { ReactNode } from "react";
import { PenLine, Handshake, FileWarning, FolderOpen, ChevronRight, ExternalLink } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AdminOverview } from "@/hooks/useAdminOverview";

export function FilesScreen({
  overview,
  openWeb,
}: {
  overview: AdminOverview;
  openWeb: (path: string) => void;
}) {
  const { files } = overview;

  const queues: { icon: LucideIcon; label: string; count: number; path: string; tone?: "danger" }[] = [
    { icon: PenLine, label: "Saisies à valider", count: files.saisieAValider, path: "/dashboard/saisie/" },
    { icon: Handshake, label: "Demandes à traiter", count: files.demandesATraiter, path: "/dashboard/demandes-acquisition/" },
    { icon: FileWarning, label: "Litiges ouverts", count: files.litigesOuverts, path: "/dashboard/litiges/", tone: "danger" },
    { icon: FolderOpen, label: "Dossiers ADU en cours", count: files.dossiersAduEnCours, path: "/dashboard/dossiers-adu/" },
  ];

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <div className="flex-none px-[18px] pt-2 pb-3">
        <div className="text-[22px] font-extrabold text-foreground">À faire</div>
        <div className="mt-0.5 text-[12.5px] text-muted-foreground">Files nationales à traiter</div>
      </div>

      <div className="sgnf-scroll flex-1 overflow-y-auto px-[18px] pb-6">
        <div className="flex flex-col gap-2.5">
          {queues.map((q) => {
            const Icon = q.icon;
            return (
              <button
                key={q.label}
                type="button"
                onClick={() => openWeb(q.path)}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-panel"
              >
                <span
                  className={`flex size-10 flex-none items-center justify-center rounded-xl ${
                    q.tone === "danger" && q.count > 0 ? "bg-danger-subtle text-danger" : "bg-inset text-primary"
                  }`}
                >
                  <Icon className="size-5" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1 text-[14px] font-semibold text-foreground">{q.label}</span>
                <span
                  className={`tabular text-[20px] font-extrabold ${
                    q.tone === "danger" && q.count > 0 ? "text-danger" : "text-foreground"
                  }`}
                >
                  {q.count}
                </span>
                <ExternalLink className="size-4 flex-none text-muted-2" />
              </button>
            );
          })}
        </div>

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
