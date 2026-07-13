"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BadgeCheck, FilePlus2, Landmark, ReceiptText, ScaleIcon, ShieldCheck } from "lucide-react";

import { fadeUp } from "@/lib/motion";
import type { AdminOverview, DossierAdu, LitigeRow, PaiementRow } from "@/hooks/useAdminOverview";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ds/card";
import { DataGrid, type Column } from "@/components/ds/data-grid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ds/tabs";
import { STATUT_ADU_LABELS } from "./AduDialog";

const nf = new Intl.NumberFormat("fr-FR");

function jour(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Un statut ne doit jamais être lu comme du code : on traduit, et on colore par gravité. */
function tonLitige(s: string | null) {
  if (s === "clos" || s === "resolu") return "success" as const;
  if (s === "en_mediation") return "warning" as const;
  return "danger" as const;
}

function tonAdu(s: string | null) {
  if (s === "acd_obtenu" || s === "adu_delivree") return "success" as const;
  if (s === "rejete") return "danger" as const;
  if (s === "piece_manquante") return "warning" as const;
  return "accent" as const;
}

function tonPaiement(s: string | null) {
  if (s === "confirme") return "success" as const;
  if (s === "echoue" || s === "annule") return "danger" as const;
  return "warning" as const;
}

/**
 * Files de traitement.
 *
 * Trois registres opérationnels réunis dans un seul panneau à onglets, au lieu
 * de trois panneaux empilés : ils se consultent l'un après l'autre, jamais
 * simultanément, et l'écran gagne les deux tiers de la hauteur qu'ils
 * occupaient.
 */
export function WorkQueues({
  files,
  recettes,
  loading,
  onNouveauDossier,
}: {
  files: AdminOverview["files"];
  recettes: AdminOverview["recettes"];
  loading: boolean;
  onNouveauDossier: () => void;
}) {
  const router = useRouter();

  const colLitiges: Array<Column<LitigeRow>> = [
    {
      id: "lot",
      header: "Lot",
      width: "7rem",
      sortBy: (r) => r.lots?.numero_lot ?? "",
      cell: (r) => <span className="font-semibold text-foreground tabular">{r.lots?.numero_lot ?? "—"}</span>,
    },
    {
      id: "objet",
      header: "Objet",
      sortBy: (r) => r.objet ?? "",
      searchBy: (r) => `${r.objet ?? ""} ${r.lots?.numero_lot ?? ""}`,
      cell: (r) => <span className="block truncate text-muted-foreground">{r.objet ?? "Sans objet"}</span>,
    },
    {
      id: "statut",
      header: "Statut",
      width: "9rem",
      sortBy: (r) => r.statut ?? "",
      cell: (r) => <Badge tone={tonLitige(r.statut)}>{(r.statut ?? "—").replace(/_/g, " ")}</Badge>,
    },
    {
      id: "ouvert",
      header: "Ouvert le",
      width: "8rem",
      align: "right",
      secondary: true,
      sortBy: (r) => r.ouvert_le ?? "",
      cell: (r) => <span className="text-muted-foreground tabular">{jour(r.ouvert_le)}</span>,
    },
  ];

  const colAdu: Array<Column<DossierAdu>> = [
    {
      id: "numero",
      header: "N° ADU",
      width: "9rem",
      sortBy: (r) => r.adu_numero ?? "",
      searchBy: (r) => `${r.adu_numero ?? ""} ${r.acd_reference ?? ""} ${r.notes ?? ""}`,
      cell: (r) => (
        <span className="font-semibold text-foreground tabular">{r.adu_numero ?? "Non attribué"}</span>
      ),
    },
    {
      id: "notes",
      header: "Observations",
      sortBy: (r) => r.notes ?? "",
      cell: (r) => <span className="block truncate text-muted-foreground">{r.notes ?? "—"}</span>,
    },
    {
      id: "statut",
      header: "Statut",
      width: "9.5rem",
      sortBy: (r) => r.statut ?? "",
      cell: (r) => (
        <Badge tone={tonAdu(r.statut)}>{STATUT_ADU_LABELS[r.statut ?? ""] ?? r.statut ?? "—"}</Badge>
      ),
    },
    {
      id: "depose",
      header: "Déposé le",
      width: "8rem",
      align: "right",
      secondary: true,
      sortBy: (r) => r.depose_le ?? "",
      cell: (r) => <span className="text-muted-foreground tabular">{jour(r.depose_le)}</span>,
    },
  ];

  const colPaiements: Array<Column<PaiementRow>> = [
    {
      id: "ref",
      header: "Référence",
      width: "10rem",
      sortBy: (r) => r.reference_externe ?? "",
      searchBy: (r) => `${r.reference_externe ?? ""} ${r.type ?? ""} ${r.beneficiaire ?? ""}`,
      cell: (r) => (
        <span className="block truncate font-semibold text-foreground tabular">{r.reference_externe ?? "—"}</span>
      ),
    },
    {
      id: "type",
      header: "Type",
      sortBy: (r) => r.type ?? "",
      cell: (r) => <span className="block truncate text-muted-foreground">{(r.type ?? "—").replace(/_/g, " ")}</span>,
    },
    {
      id: "montant",
      header: "Montant",
      width: "8rem",
      align: "right",
      sortBy: (r) => r.montant_total ?? 0,
      cell: (r) => (
        <span className="font-semibold text-foreground tabular">
          {r.montant_total != null ? `${nf.format(r.montant_total)} F` : "—"}
        </span>
      ),
    },
    {
      id: "statut",
      header: "Statut",
      width: "9rem",
      align: "right",
      secondary: true,
      sortBy: (r) => r.statut ?? "",
      cell: (r) => <Badge tone={tonPaiement(r.statut)}>{(r.statut ?? "—").replace(/_/g, " ")}</Badge>,
    },
  ];

  return (
    <motion.div variants={fadeUp}>
      <Card>
        <Tabs defaultValue="litiges">
          <CardHeader className="border-b border-border">
            <div className="min-w-0">
              <CardTitle>Files de traitement</CardTitle>
              <CardDescription>Les registres opérationnels qui demandent un arbitrage.</CardDescription>
            </div>
            <CardAction className="flex-wrap justify-end gap-2">
              <TabsList>
                <TabsTrigger value="litiges">
                  <ScaleIcon />
                  Litiges
                  {files.litigesOuverts > 0 && (
                    <span className="ml-0.5 tabular">({nf.format(files.litigesOuverts)})</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="adu">
                  <Landmark />
                  Dossiers ADU
                  {files.dossiersAduTotal > 0 && (
                    <span className="ml-0.5 tabular">({nf.format(files.dossiersAduTotal)})</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="paiements">
                  <ReceiptText />
                  Paiements
                  {recettes.paiements.length > 0 && (
                    <span className="ml-0.5 tabular">({nf.format(recettes.paiements.length)})</span>
                  )}
                </TabsTrigger>
              </TabsList>
            </CardAction>
          </CardHeader>

          <div className="pt-4">
            <TabsContent value="litiges">
              <DataGrid
                rows={files.litiges}
                columns={colLitiges}
                getRowId={(r) => r.id}
                loading={loading}
                searchPlaceholder="Rechercher un litige…"
                initialSort={{ id: "ouvert", dir: "desc" }}
                onRowClick={() => router.push("/dashboard/litiges")}
                emptyIcon={ShieldCheck}
                emptyTone="positive"
                emptyTitle="Aucun litige"
                emptyDescription="Aucun conflit n'est enregistré sur le patrimoine. C'est une bonne nouvelle, pas un écran vide."
              />
            </TabsContent>

            <TabsContent value="adu">
              <DataGrid
                rows={files.dossiersAdu}
                columns={colAdu}
                getRowId={(r) => r.id}
                loading={loading}
                searchPlaceholder="Rechercher un dossier…"
                initialSort={{ id: "depose", dir: "desc" }}
                onRowClick={() => router.push("/dashboard/dossiers-adu")}
                toolbarExtra={
                  <Button variant="outline" size="sm" onClick={onNouveauDossier}>
                    <FilePlus2 />
                    <span className="hidden sm:inline">Nouveau dossier</span>
                  </Button>
                }
                emptyIcon={Landmark}
                emptyTone="pending"
                emptyTitle="Aucun dossier ADU"
                emptyDescription="Aucune demande d'arrêté de disposition d'urbanisme n'a encore été ouverte."
              />
            </TabsContent>

            <TabsContent value="paiements">
              <DataGrid
                rows={recettes.paiements}
                columns={colPaiements}
                getRowId={(r) => r.id}
                loading={loading}
                searchPlaceholder="Rechercher un paiement…"
                initialSort={{ id: "montant", dir: "desc" }}
                onRowClick={() => router.push("/dashboard/paiements")}
                emptyIcon={BadgeCheck}
                emptyTone="pending"
                emptyTitle="Aucun paiement enregistré"
                emptyDescription="Le paiement en ligne (CinetPay) n'est pas encore activé : aucune recette ne peut être encaissée."
              />
            </TabsContent>
          </div>
        </Tabs>
      </Card>
    </motion.div>
  );
}
