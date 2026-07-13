"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Activity, FilePlus2, PencilLine, Trash2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { fadeUp } from "@/lib/motion";
import type { AdminOverview, AuditEntry } from "@/hooks/useAdminOverview";
import { Badge, StatusDot } from "@/components/ds/badge";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ds/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ds/dialog";
import { EmptyState } from "@/components/ds/empty-state";
import { ScrollArea } from "@/components/ds/scroll-area";
import { Skeleton } from "@/components/ds/skeleton";
import { BarSeries } from "@/components/ds/spark";
import { Tabs, TabsList, TabsTrigger } from "@/components/ds/tabs";

/** Noms de tables → langage métier. Le journal est technique, l'écran ne l'est pas. */
const TABLE_LABELS: Record<string, string> = {
  lots: "Lot",
  ilots: "Îlot",
  lotissements: "Lotissement",
  attributions: "Attribution",
  attributaires: "Attributaire",
  attestations_cession: "Attestation de cession",
  cessions: "Cession",
  paiements: "Paiement",
  ventes: "Vente",
  litiges: "Litige",
  dossiers_adu: "Dossier ADU",
  pv_reunions_famille: "PV de réunion",
  demandes_acquisition: "Demande d'acquisition",
  soumissions_saisie: "Soumission de saisie",
  familles: "Famille",
  invitations: "Invitation",
};

type ActionMeta = { label: string; icon: LucideIcon; tone: "success" | "accent" | "danger" | "neutral" };

const ACTIONS: Record<string, ActionMeta> = {
  INSERT: { label: "Création", icon: FilePlus2, tone: "success" },
  UPDATE: { label: "Modification", icon: PencilLine, tone: "accent" },
  DELETE: { label: "Suppression", icon: Trash2, tone: "danger" },
};

function actionMeta(action: string | null): ActionMeta {
  return ACTIONS[action ?? ""] ?? { label: action ?? "Événement", icon: Activity, tone: "neutral" };
}

function libelleTable(t: string | null) {
  if (!t) return "Enregistrement";
  return TABLE_LABELS[t] ?? t.replace(/_/g, " ");
}

function heure(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Regroupe le fil par jour — « Aujourd'hui », « Hier », puis la date. */
function grouperParJour(entries: AuditEntry[]) {
  const auj = new Date().toDateString();
  const hier = new Date(Date.now() - 86_400_000).toDateString();

  const groupes = new Map<string, AuditEntry[]>();
  for (const e of entries) {
    if (!e.effectue_le) continue;
    const d = new Date(e.effectue_le).toDateString();
    const label = d === auj ? "Aujourd'hui" : d === hier ? "Hier" : new Date(e.effectue_le).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    groupes.set(label, [...(groupes.get(label) ?? []), e]);
  }
  return [...groupes.entries()];
}

/**
 * Centre d'activité — le journal d'audit rendu lisible.
 *
 * La base en contient plusieurs milliers de lignes ; les empiler n'apprend
 * rien. On donne donc d'abord le rythme (l'histogramme sur 14 jours), puis le
 * détail filtrable. La ligne technique complète (valeurs avant/après) reste
 * accessible au clic, parce que c'est ce qui fait la valeur probante du
 * journal.
 */
export function ActivityCenter({ activite, loading }: { activite: AdminOverview["activite"]; loading: boolean }) {
  const [filtre, setFiltre] = React.useState<string>("tout");
  const [detail, setDetail] = React.useState<AuditEntry | null>(null);

  const tables = React.useMemo(() => {
    const compte = new Map<string, number>();
    for (const e of activite.journal) {
      if (!e.table_concernee) continue;
      compte.set(e.table_concernee, (compte.get(e.table_concernee) ?? 0) + 1);
    }
    return [...compte.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [activite.journal]);

  const filtrees = React.useMemo(
    () => (filtre === "tout" ? activite.journal : activite.journal.filter((e) => e.table_concernee === filtre)),
    [activite.journal, filtre],
  );

  const groupes = React.useMemo(() => grouperParJour(filtrees), [filtrees]);
  const pic = Math.max(...activite.serie.map((s) => s.value), 0);

  return (
    <>
      <motion.div variants={fadeUp} className="min-w-0">
        <Card className="h-full">
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Activité</CardTitle>
              <CardDescription>
                {loading ? (
                  "Chargement du journal…"
                ) : (
                  <>
                    {activite.total14j.toLocaleString("fr-FR")} événements sur 14 jours
                    {pic > 0 && ` · pic à ${pic.toLocaleString("fr-FR")}`}
                  </>
                )}
              </CardDescription>
            </div>
            {!loading && tables.length > 0 && (
              <CardAction>
                <Tabs value={filtre} onValueChange={setFiltre}>
                  <TabsList>
                    <TabsTrigger value="tout">Tout</TabsTrigger>
                    {tables.map(([t]) => (
                      <TabsTrigger key={t} value={t}>
                        {libelleTable(t)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </CardAction>
            )}
          </CardHeader>

          {/* Rythme sur 14 jours */}
          <div className="px-5 pb-4">
            {loading ? (
              <Skeleton className="h-14" />
            ) : (
              <>
                <BarSeries
                  data={activite.serie}
                  color="var(--chart-2)"
                  height={56}
                  ariaLabel={`Événements par jour sur 14 jours : ${activite.serie.map((s) => `${s.label} ${s.value}`).join(", ")}`}
                />
                <div className="mt-1.5 flex justify-between text-[10.5px] text-muted-foreground">
                  <span>{activite.serie[0]?.label}</span>
                  <span>Aujourd&apos;hui</span>
                </div>
              </>
            )}
          </div>

          {/* Fil */}
          <div className="min-h-0 flex-1 border-t border-border">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : groupes.length === 0 ? (
              <EmptyState icon={Activity} title="Aucun événement" description="Le journal d'audit est vide pour ce filtre." />
            ) : (
              <ScrollArea className="h-[15rem]">
                <div className="p-2">
                  {groupes.map(([jour, entries]) => (
                    <div key={jour} className="mb-1 last:mb-0">
                      <p className="sticky top-0 z-10 bg-card/90 px-2 py-1.5 text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase backdrop-blur-sm">
                        {jour}
                      </p>
                      <ul>
                        {entries.map((e, i) => {
                          const meta = actionMeta(e.action);
                          const Icon = meta.icon;
                          return (
                            <li key={`${e.id ?? "x"}-${i}`}>
                              <button
                                type="button"
                                onClick={() => setDetail(e)}
                                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-inset focus-visible:ring-2 focus-visible:ring-ring/50"
                              >
                                <Icon
                                  className={cn(
                                    "size-3.5 shrink-0",
                                    meta.tone === "success" && "text-success",
                                    meta.tone === "accent" && "text-accent",
                                    meta.tone === "danger" && "text-danger",
                                    meta.tone === "neutral" && "text-muted-foreground",
                                  )}
                                  aria-hidden
                                />
                                <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
                                  <b className="font-semibold">{meta.label}</b>{" "}
                                  <span className="text-muted-foreground">{libelleTable(e.table_concernee)}</span>
                                </span>
                                <span className="shrink-0 text-[11px] text-muted-foreground tabular">
                                  {heure(e.effectue_le)}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Détail d'un événement — la valeur probante du journal. */}
      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {detail ? `${actionMeta(detail.action).label} — ${libelleTable(detail.table_concernee)}` : ""}
            </DialogTitle>
            <DialogDescription>Entrée du journal d&apos;audit</DialogDescription>
          </DialogHeader>

          {detail && (
            <DialogBody className="space-y-4">
              <dl className="grid grid-cols-2 gap-2">
                {[
                  { k: "Table", v: detail.table_concernee ?? "—" },
                  { k: "Enregistrement", v: detail.enregistrement_id ? `${detail.enregistrement_id.slice(0, 8)}…` : "—" },
                  {
                    k: "Date",
                    v: detail.effectue_le ? new Date(detail.effectue_le).toLocaleString("fr-FR") : "—",
                  },
                  { k: "Auteur", v: detail.effectue_par ? `${detail.effectue_par.slice(0, 8)}…` : "Système" },
                ].map((item) => (
                  <div key={item.k} className="rounded-lg bg-inset p-2.5">
                    <dt className="text-[11px] text-muted-foreground">{item.k}</dt>
                    <dd className="mt-0.5 truncate text-[13px] font-semibold text-foreground">{item.v}</dd>
                  </div>
                ))}
              </dl>

              {detail.nouvelle_valeur && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-success uppercase">
                    <StatusDot tone="success" />
                    Nouvelle valeur
                  </p>
                  <pre className="max-h-52 overflow-auto rounded-lg bg-success-subtle p-3 text-[11.5px] leading-relaxed text-foreground">
                    {JSON.stringify(detail.nouvelle_valeur, null, 2)}
                  </pre>
                </div>
              )}

              {detail.ancienne_valeur && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                    <StatusDot />
                    Ancienne valeur
                  </p>
                  <pre className="max-h-52 overflow-auto rounded-lg bg-inset p-3 text-[11.5px] leading-relaxed text-muted-foreground">
                    {JSON.stringify(detail.ancienne_valeur, null, 2)}
                  </pre>
                </div>
              )}

              {!detail.nouvelle_valeur && !detail.ancienne_valeur && (
                <Badge tone="neutral">Aucune donnée de diff enregistrée</Badge>
              )}
            </DialogBody>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
