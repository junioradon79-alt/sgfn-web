"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { KeyRound, Loader2, ScrollText, Settings, ShieldCheck, Users } from "lucide-react";

import { fadeUp } from "@/lib/motion";
import { NAV_ITEMS, SECTION_LABELS, visibleNavItems } from "@/lib/navigation";
import { useAdministration, type CompteSysteme, type EntreeAudit } from "@/hooks/useAdministration";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Skeleton } from "@/components/ds/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ds/tabs";

const nf = new Intl.NumberFormat("fr-FR");

/** Volets pilotés par `?volet=` — miroir des sous-entrées « Administration » de la barre. */
const VOLETS = ["comptes", "roles", "audit", "parametres"] as const;

/** Libellés métier des groupes — le nom technique ne se montre pas à l'écran. */
const GROUPES: Record<string, string> = {
  admin: "Administration nationale",
  operateur: "Opérateur",
  operateur_saisie: "Agent de saisie",
  geometre: "Géomètre-expert",
  commissaire: "Commissaire de justice",
  verificateur: "Vérificateur",
  chefferie: "Chefferie",
  proprietaire_terrien: "Propriétaire terrien",
  acquereur: "Acquéreur",
  agent_ia: "Agent IA",
  amenageur: "Aménageur (déprécié)",
  proprietaire: "Propriétaire par achat (déprécié)",
};

const libelleGroupe = (g: string | null) => (g ? GROUPES[g] ?? g : "—");

function date(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function dateHeure(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Administration — rubrique « Administration » du handoff, avec ses quatre
 * volets : utilisateurs système, rôles & permissions, journal d'audit,
 * paramètres.
 *
 * Écran de consultation. Les droits ne se modifient pas ici : ils sont portés
 * par la RLS et par `@/lib/navigation`, et cet écran les *donne à lire* au lieu
 * de les dupliquer dans une interface qui divergerait.
 */
function AdministrationContenu() {
  const admin = useAdministration();
  const { counts } = useBadgeCounts();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Onglet actif dérivé de l'URL (?volet=) : les sous-entrées « Rôles &
  // permissions »… de la barre latérale ouvrent directement le bon volet, et la
  // barre se resurligne quand on change d'onglet ici. `comptes` = onglet par défaut.
  const paramVolet = searchParams.get("volet");
  const volet = paramVolet && (VOLETS as readonly string[]).includes(paramVolet) ? paramVolet : "comptes";

  const changerVolet = React.useCallback(
    (v: string) => {
      // `comptes` = URL nue ; les autres portent `?volet=`. `scroll: false` pour
      // ne pas remonter la page à chaque changement d'onglet.
      router.replace(v === "comptes" ? pathname : `${pathname}?volet=${v}`, { scroll: false });
    },
    [router, pathname],
  );

  return (
    <AppShell wide loading={admin.loading} counts={counts} onRefresh={admin.refresh}>
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <Tabs value={volet} onValueChange={changerVolet} className="flex flex-col gap-5">
          <TabsList>
            <TabsTrigger value="comptes">
              <Users className="size-4" /> Utilisateurs système
            </TabsTrigger>
            <TabsTrigger value="roles">
              <KeyRound className="size-4" /> Rôles &amp; permissions
            </TabsTrigger>
            <TabsTrigger value="audit">
              <ScrollText className="size-4" /> Journal d&apos;audit
            </TabsTrigger>
            <TabsTrigger value="parametres">
              <Settings className="size-4" /> Paramètres
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comptes">
            <ComptesPanel comptes={admin.comptes} loading={admin.loading} />
          </TabsContent>

          <TabsContent value="roles">
            <RolesPanel comptes={admin.comptes} loading={admin.loading} />
          </TabsContent>

          <TabsContent value="audit">
            <AuditPanel entrees={admin.audit} loading={admin.loading} />
          </TabsContent>

          <TabsContent value="parametres">
            <ParametresPanel
              tarifs={admin.tarifs}
              parametres={admin.parametres}
              loading={admin.loading}
            />
          </TabsContent>
        </Tabs>

        {admin.error && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-danger/30 bg-danger-subtle px-4 py-2.5 text-[13px] text-danger"
          >
            Certaines données n&apos;ont pas pu être chargées : {admin.error}
          </p>
        )}
      </motion.div>
    </AppShell>
  );
}

// `useSearchParams` (onglet actif) impose une borne Suspense en export statique.
export default function AdministrationPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      }
    >
      <AdministrationContenu />
    </React.Suspense>
  );
}

function ComptesPanel({ comptes, loading }: { comptes: CompteSysteme[]; loading: boolean }) {
  const actifs = comptes.filter((c) => c.actif).length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Utilisateurs système</CardTitle>
          <CardDescription>
            {loading
              ? "Chargement…"
              : `${nf.format(comptes.length)} compte${comptes.length > 1 ? "s" : ""} · ${nf.format(actifs)} actif${actifs > 1 ? "s" : ""}`}
          </CardDescription>
        </div>
      </CardHeader>

      <div className="px-5 pb-5">
        {loading ? (
          <Skeleton className="h-48" />
        ) : comptes.length === 0 ? (
          <EmptyState icon={Users} title="Aucun compte" description="Aucun profil n'est enregistré." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-bold tracking-wider text-muted-2 uppercase">
                  <th className="pb-2 font-bold">Nom</th>
                  <th className="pb-2 font-bold">Rôle</th>
                  <th className="pb-2 font-bold">Téléphone</th>
                  <th className="pb-2 font-bold">Créé le</th>
                  <th className="pb-2 text-right font-bold">État</th>
                </tr>
              </thead>
              <tbody>
                {comptes.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 font-medium text-foreground">{c.nom_complet ?? "—"}</td>
                    <td className="py-2.5 text-muted-foreground">{libelleGroupe(c.groupe)}</td>
                    <td className="tabular py-2.5 text-muted-foreground">{c.telephone ?? "—"}</td>
                    <td className="tabular py-2.5 text-muted-2">{date(c.cree_le)}</td>
                    <td className="py-2.5 text-right">
                      <Badge tone={c.actif ? "success" : "neutral"}>{c.actif ? "Actif" : "Inactif"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Matrice des accès, dérivée de `NAV_ITEMS` — la source unique des permissions
 * de navigation. Une matrice saisie à la main mentirait dès la première
 * évolution du menu ; celle-ci ne peut pas diverger.
 */
function RolesPanel({ comptes, loading }: { comptes: CompteSysteme[]; loading: boolean }) {
  const groupes = React.useMemo(() => {
    const presents = new Set(comptes.map((c) => c.groupe).filter((g): g is string => Boolean(g)));
    return [...presents].sort((a, b) => libelleGroupe(a).localeCompare(libelleGroupe(b), "fr"));
  }, [comptes]);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Rôles &amp; permissions</CardTitle>
          <CardDescription>
            Écrans accessibles par rôle, dérivés des règles de navigation. La RLS reste la garde en base.
          </CardDescription>
        </div>
      </CardHeader>

      <div className="px-5 pb-5">
        {loading ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="flex flex-col gap-3">
            {groupes.map((groupe) => {
              const accessibles = visibleNavItems(groupe, false);
              const effectif = comptes.filter((c) => c.groupe === groupe).length;

              return (
                <div key={groupe} className="rounded-xl border border-border p-4">
                  <div className="mb-2.5 flex flex-wrap items-center gap-2">
                    <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-[13.5px] font-semibold text-foreground">{libelleGroupe(groupe)}</span>
                    <Badge tone="neutral">
                      {effectif} compte{effectif > 1 ? "s" : ""}
                    </Badge>
                    <span className="ml-auto text-[11.5px] text-muted-2">
                      {accessibles.length} écran{accessibles.length > 1 ? "s" : ""} sur {NAV_ITEMS.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {accessibles.map((item) => (
                      <span
                        key={item.href}
                        className="rounded-full border border-border bg-inset px-2.5 py-1 text-[11.5px] text-muted-foreground"
                        title={SECTION_LABELS[item.section]}
                      >
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

function AuditPanel({ entrees, loading }: { entrees: EntreeAudit[]; loading: boolean }) {
  const ACTIONS: Record<string, { label: string; tone: "success" | "accent" | "danger" }> = {
    INSERT: { label: "Création", tone: "success" },
    UPDATE: { label: "Modification", tone: "accent" },
    DELETE: { label: "Suppression", tone: "danger" },
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Journal d&apos;audit</CardTitle>
          <CardDescription>
            Les {entrees.length} derniers événements enregistrés, du plus récent au plus ancien.
          </CardDescription>
        </div>
      </CardHeader>

      <div className="px-5 pb-5">
        {loading ? (
          <Skeleton className="h-48" />
        ) : entrees.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Journal vide"
            description="Aucun événement n'a encore été enregistré."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-bold tracking-wider text-muted-2 uppercase">
                  <th className="pb-2 font-bold">Action</th>
                  <th className="pb-2 font-bold">Enregistrement</th>
                  <th className="pb-2 text-right font-bold">Date</th>
                </tr>
              </thead>
              <tbody>
                {entrees.map((e, i) => {
                  const meta = ACTIONS[e.action ?? ""] ?? { label: e.action ?? "Événement", tone: "accent" as const };
                  return (
                    <tr key={e.id ?? i} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {(e.table_concernee ?? "—").replace(/_/g, " ")}
                      </td>
                      <td className="tabular py-2.5 text-right text-muted-2">{dateHeure(e.effectue_le)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function ParametresPanel({
  tarifs,
  parametres,
  loading,
}: {
  tarifs: ReturnType<typeof useAdministration>["tarifs"];
  parametres: ReturnType<typeof useAdministration>["parametres"];
  loading: boolean;
}) {
  const fcfa = (n: number | null) => (n === null ? "—" : `${nf.format(n)} F`);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Grille tarifaire</CardTitle>
            <CardDescription>Montants et commissions par type de démarche.</CardDescription>
          </div>
        </CardHeader>
        <div className="px-5 pb-5">
          {loading ? (
            <Skeleton className="h-40" />
          ) : tarifs.length === 0 ? (
            <EmptyState icon={Settings} title="Aucun tarif" description="La grille tarifaire est vide." />
          ) : (
            <ul className="flex flex-col gap-2">
              {tarifs.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-semibold text-foreground">
                      {(t.type_demarche ?? "—").replace(/_/g, " ")}
                    </span>
                    <span className="tabular truncate text-[11.5px] text-muted-2">
                      commission {fcfa(t.commission_min)}
                      {t.commission_max !== null && t.commission_max !== t.commission_min
                        ? ` – ${fcfa(t.commission_max)}`
                        : ""}
                    </span>
                  </span>
                  <span className="tabular ml-auto shrink-0 text-right text-[13px] font-bold text-foreground">
                    {fcfa(t.montant_min)}
                    {t.montant_max !== null && t.montant_max !== t.montant_min ? ` – ${fcfa(t.montant_max)}` : ""}
                  </span>
                  {!t.actif && <Badge tone="neutral">Inactif</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Paramètres de paiement</CardTitle>
            <CardDescription>Réglages de la passerelle et de la répartition.</CardDescription>
          </div>
        </CardHeader>
        <div className="px-5 pb-5">
          {loading ? (
            <Skeleton className="h-40" />
          ) : parametres.length === 0 ? (
            <EmptyState icon={Settings} title="Aucun paramètre" description="Aucun réglage n'est enregistré." />
          ) : (
            <ul className="flex flex-col gap-2">
              {parametres.map((p) => (
                <li key={p.cle} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-3">
                    <span className="truncate text-[13px] font-semibold text-foreground">
                      {p.cle.replace(/_/g, " ")}
                    </span>
                    <span className="tabular ml-auto shrink-0 text-[13px] font-bold text-foreground">
                      {p.valeur ?? "—"}
                    </span>
                  </div>
                  {p.description && <p className="mt-1 text-[11.5px] text-muted-2">{p.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
