"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Briefcase,
  Building2,
  ClipboardList,
  HandCoins,
  IdCard,
  Phone,
  Ruler,
  Upload,
} from "lucide-react";

import { stagger } from "@/lib/motion";
import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ds/card";
import { DataGrid, type Column } from "@/components/ds/data-grid";
import { Kpi } from "@/components/ds/kpi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ds/tabs";
import UploadPlanModal from "@/components/dashboard/UploadPlanModal";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { useProfile } from "@/hooks/useProfile";

// ─── Types ──────────────────────────────────────────────────────────────────

type GeometreExpert = {
  id: string;
  nom: string;
  numero_ordre: string | null;
  cabinet: string | null;
  contact: string | null;
};

type LotRef = {
  numero_lot?: string | number | null;
  ilots?: { numero?: string | number | null; lotissements?: { nom?: string | null } | null } | null;
} | null;

type DossierAssigne = {
  id: string;
  adu_numero: string | null;
  statut: string | null;
  depose_le: string | null;
  lots?: LotRef;
};

type DemarcheAssignee = {
  id: string;
  type: string | null;
  statut: string | null;
  montant_honoraires: number | null;
  lots?: LotRef;
};

type MissionResume = {
  id: string;
  type_mission: string | null;
  client_nom: string;
  lieu: string | null;
  statut: string | null;
  montant_honoraires: number | null;
  ouverte_le: string | null;
  lots?: LotRef;
};

// ─── Libellés ─────────────────────────────────────────────────────────────────

const STATUT_ADU_LABELS: Record<string, string> = {
  en_preparation: "En préparation",
  piece_manquante: "Pièce manquante",
  depose: "Déposé",
  en_instruction: "En instruction",
  adu_delivree: "ADU délivrée",
  acd_obtenu: "ACD obtenu",
  rejete: "Rejeté",
};

const TYPE_DEMARCHE_LABELS: Record<string, string> = {
  delivrance_attestation_cession: "Délivrance attestation",
  transmission: "Transmission",
  enterinement_chefferie: "Entérinement chefferie",
  mutation_acquereur: "Mutation acquéreur",
  bornage: "Bornage",
  demande_acd: "Demande ACD",
  levee_litige: "Levée de litige",
  autre: "Autre",
};

const STATUT_DEMARCHE_LABELS: Record<string, string> = {
  en_attente_paiement: "En attente de paiement",
  payee_en_cours: "Payée — en cours",
  en_traitement: "En traitement",
  terminee: "Terminée",
  suspendue_litige: "Suspendue (litige)",
  annulee: "Annulée",
};

const TYPE_MISSION_LABELS: Record<string, string> = {
  bornage: "Bornage",
  morcellement: "Morcellement",
  implantation: "Implantation",
  expertise_judiciaire: "Expertise judiciaire",
  leve_topographique: "Levé topographique",
  immatriculation: "Immatriculation",
  copropriete: "Copropriété",
  autre: "Autre",
};

function toneAdu(s: string | null): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (s === "adu_delivree" || s === "acd_obtenu") return "success";
  if (s === "rejete") return "danger";
  if (s === "piece_manquante") return "warning";
  if (s === "en_instruction" || s === "depose") return "accent";
  return "neutral";
}

function toneDemarche(s: string | null): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (s === "terminee") return "success";
  if (s === "suspendue_litige" || s === "annulee") return "danger";
  if (s === "en_traitement" || s === "payee_en_cours") return "accent";
  return "neutral";
}

function toneMission(s: string | null): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (s === "terminee") return "success";
  if (s === "annulee") return "danger";
  if (s === "en_cours") return "accent";
  return "neutral";
}

function lotLabel(l: LotRef | undefined): string {
  if (!l) return "—";
  const num = l.numero_lot != null ? `Lot ${l.numero_lot}` : "Lot —";
  const ilot = l.ilots?.numero != null ? ` · Îlot ${l.ilots.numero}` : "";
  const loti = l.ilots?.lotissements?.nom ? ` — ${l.ilots.lotissements.nom}` : "";
  return `${num}${ilot}${loti}`;
}

const nf = new Intl.NumberFormat("fr-FR");
const jour = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EspaceGeometrePage() {
  const supabase = createClient();
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const { counts, refresh: refreshBadges } = useBadgeCounts();

  const [expert, setExpert] = useState<GeometreExpert | null>(null);
  const [dossiers, setDossiers] = useState<DossierAssigne[]>([]);
  const [demarches, setDemarches] = useState<DemarcheAssignee[]>([]);
  const [missions, setMissions] = useState<MissionResume[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  const load = async () => {
    if (!profile) return;

    const demarchesPromise = supabase
      .from("demarches")
      .select("id, type, statut, montant_honoraires, lots(numero_lot, ilots(numero, lotissements(nom)))")
      .eq("agent_assigne", profile.id);

    if (profile.geometre_id) {
      const [{ data: expertData }, { data: dossierData }, { data: demarcheData }, { data: missionData }] = await Promise.all([
        supabase
          .from("geometres_experts")
          .select("id, nom, numero_ordre, cabinet, contact")
          .eq("id", profile.geometre_id)
          .maybeSingle(),
        supabase
          .from("dossiers_adu")
          .select("id, adu_numero, statut, depose_le, lots(numero_lot, ilots(numero, lotissements(nom)))")
          .eq("geometre_id", profile.geometre_id)
          .order("cree_le", { ascending: false }),
        demarchesPromise,
        supabase
          .from("missions_geometre")
          .select("id, type_mission, client_nom, lieu, statut, montant_honoraires, ouverte_le, lots(numero_lot, ilots(numero, lotissements(nom)))")
          .order("ouverte_le", { ascending: false }),
      ]);
      setExpert((expertData as GeometreExpert | null) ?? null);
      setDossiers((dossierData ?? []) as unknown as DossierAssigne[]);
      setDemarches((demarcheData ?? []) as unknown as DemarcheAssignee[]);
      setMissions((missionData ?? []) as unknown as MissionResume[]);
    } else {
      const { data: demarcheData } = await demarchesPromise;
      setExpert(null);
      setDossiers([]);
      setDemarches((demarcheData ?? []) as unknown as DemarcheAssignee[]);
      setMissions([]);
    }
  };

  const { isLoading: loading, recharger } = useChargement(
    load,
    [profile?.id, profile?.geometre_id],
    !profileLoading && !!profile
  );

  const rafraichir = useCallback(() => {
    void recharger();
    refreshBadges();
  }, [recharger, refreshBadges]);

  const dossiersEnCours = dossiers.filter((d) => ["depose", "en_instruction"].includes(d.statut ?? ""));
  const demarchesActives = demarches.filter((d) => !["terminee", "annulee"].includes(d.statut ?? ""));
  const missionsActives = missions.filter((m) => !["terminee", "annulee"].includes(m.statut ?? ""));
  const honoraires =
    demarchesActives.reduce((sum, d) => sum + (d.montant_honoraires ?? 0), 0) +
    missionsActives.reduce((sum, m) => sum + (m.montant_honoraires ?? 0), 0);

  const colMissions: Array<Column<MissionResume>> = [
    {
      id: "client",
      header: "Client",
      sortBy: (m) => m.client_nom,
      searchBy: (m) => `${m.client_nom} ${TYPE_MISSION_LABELS[m.type_mission ?? ""] ?? ""} ${m.lieu ?? ""}`,
      cell: (m) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{m.client_nom}</p>
          <p className="truncate text-[11.5px] text-muted-foreground">
            {TYPE_MISSION_LABELS[m.type_mission ?? ""] ?? m.type_mission}
          </p>
        </div>
      ),
    },
    {
      id: "lieu",
      header: "Lieu / lot",
      secondary: true,
      sortBy: (m) => (m.lots ? lotLabel(m.lots) : m.lieu ?? ""),
      cell: (m) => <span className="block truncate text-muted-foreground">{m.lots ? lotLabel(m.lots) : m.lieu || "—"}</span>,
    },
    {
      id: "statut",
      header: "Statut",
      width: "10rem",
      sortBy: (m) => m.statut ?? "",
      cell: (m) => <Badge tone={toneMission(m.statut)}>{m.statut ?? "—"}</Badge>,
    },
    {
      id: "ouverte",
      header: "Ouverte le",
      width: "8rem",
      align: "right",
      secondary: true,
      sortBy: (m) => m.ouverte_le ?? "",
      cell: (m) => <span className="text-muted-foreground tabular">{jour(m.ouverte_le)}</span>,
    },
  ];

  const colAdu: Array<Column<DossierAssigne>> = [
    {
      id: "numero",
      header: "N° ADU",
      sortBy: (d) => d.adu_numero ?? "",
      searchBy: (d) => `${d.adu_numero ?? ""} ${lotLabel(d.lots)}`,
      cell: (d) => <span className="font-semibold text-foreground tabular">{d.adu_numero || "Non attribué"}</span>,
    },
    {
      id: "lot",
      header: "Lot",
      secondary: true,
      sortBy: (d) => lotLabel(d.lots),
      cell: (d) => <span className="block truncate text-muted-foreground">{lotLabel(d.lots)}</span>,
    },
    {
      id: "statut",
      header: "Statut",
      width: "10rem",
      sortBy: (d) => d.statut ?? "",
      cell: (d) => <Badge tone={toneAdu(d.statut)}>{STATUT_ADU_LABELS[d.statut ?? ""] ?? d.statut ?? "—"}</Badge>,
    },
    {
      id: "depose",
      header: "Déposé le",
      width: "8rem",
      align: "right",
      secondary: true,
      sortBy: (d) => d.depose_le ?? "",
      cell: (d) => <span className="text-muted-foreground tabular">{jour(d.depose_le)}</span>,
    },
  ];

  const colDemarches: Array<Column<DemarcheAssignee>> = [
    {
      id: "type",
      header: "Type",
      sortBy: (d) => TYPE_DEMARCHE_LABELS[d.type ?? ""] ?? d.type ?? "",
      searchBy: (d) => `${TYPE_DEMARCHE_LABELS[d.type ?? ""] ?? ""} ${lotLabel(d.lots)}`,
      cell: (d) => <span className="font-semibold text-foreground">{TYPE_DEMARCHE_LABELS[d.type ?? ""] ?? d.type}</span>,
    },
    {
      id: "lot",
      header: "Lot",
      secondary: true,
      sortBy: (d) => lotLabel(d.lots),
      cell: (d) => <span className="block truncate text-muted-foreground">{lotLabel(d.lots)}</span>,
    },
    {
      id: "statut",
      header: "Statut",
      width: "11rem",
      sortBy: (d) => d.statut ?? "",
      cell: (d) => <Badge tone={toneDemarche(d.statut)}>{STATUT_DEMARCHE_LABELS[d.statut ?? ""] ?? d.statut ?? "—"}</Badge>,
    },
    {
      id: "honoraires",
      header: "Honoraires",
      width: "8rem",
      align: "right",
      secondary: true,
      sortBy: (d) => d.montant_honoraires ?? 0,
      cell: (d) => (
        <span className="font-semibold text-foreground tabular">
          {d.montant_honoraires != null ? `${nf.format(d.montant_honoraires)} F` : "—"}
        </span>
      ),
    },
  ];

  if (profileLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <span className="text-sm font-medium text-muted-foreground">Ouverture de votre espace…</span>
      </div>
    );
  }

  return (
    <AppShell loading={loading} counts={counts} onRefresh={rafraichir}>
      {/* Bandeau identité */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Espace partenaire</p>
              <h1 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground">
                Bienvenue, {expert?.nom ?? profile?.nom_complet ?? ""}
              </h1>
              {expert ? (
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
                  {expert.numero_ordre && (
                    <span className="inline-flex items-center gap-1.5">
                      <IdCard className="size-3.5" /> N° d&apos;ordre {expert.numero_ordre}
                    </span>
                  )}
                  {expert.cabinet && (
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="size-3.5" /> {expert.cabinet}
                    </span>
                  )}
                  {expert.contact && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="size-3.5" /> {expert.contact}
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-2 max-w-prose text-[13px] text-warning">
                  Votre compte n&apos;est pas encore rattaché à une fiche du registre des géomètres-experts.
                  Contactez l&apos;administration SGNF pour finaliser votre inscription.
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowUpload(true)}>
              <Upload />
              Téléverser un plan
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* KPIs */}
      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        aria-label="Indicateurs clés"
      >
        <Kpi
          icon={ClipboardList}
          label="Dossiers ADU"
          href="/dashboard/dossiers-adu"
          loading={loading}
          value={dossiers.length}
          legende={`${nf.format(dossiersEnCours.length)} en cours d'instruction`}
        />
        <Kpi
          icon={Ruler}
          label="Démarches"
          href="/dashboard/demarches"
          loading={loading}
          value={demarches.length}
          legende={`${nf.format(demarchesActives.length)} active${demarchesActives.length > 1 ? "s" : ""}`}
        />
        <Kpi
          icon={Briefcase}
          label="Missions"
          href="/dashboard/missions"
          loading={loading}
          value={missions.length}
          legende={`${nf.format(missionsActives.length)} active${missionsActives.length > 1 ? "s" : ""}`}
        />
        <Kpi
          icon={HandCoins}
          label="Honoraires en cours"
          loading={loading}
          value={honoraires}
          format={(n) => `${nf.format(n)} F`}
          legende="Missions et démarches non clôturées"
        />
      </motion.section>

      {/* Mon activité — onglets */}
      <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} initial="hidden" animate="show">
        <Card>
          <Tabs defaultValue="missions">
            <CardHeader className="border-b border-border">
              <div className="min-w-0">
                <CardTitle>Mon activité</CardTitle>
                <CardDescription>Missions, dossiers ADU et démarches en un coup d&apos;œil.</CardDescription>
              </div>
              <CardAction className="flex-wrap justify-end gap-2">
                <TabsList>
                  <TabsTrigger value="missions">
                    <Briefcase />
                    Missions
                    {missions.length > 0 && <span className="ml-0.5 tabular">({nf.format(missions.length)})</span>}
                  </TabsTrigger>
                  <TabsTrigger value="adu">
                    <ClipboardList />
                    Dossiers ADU
                    {dossiers.length > 0 && <span className="ml-0.5 tabular">({nf.format(dossiers.length)})</span>}
                  </TabsTrigger>
                  <TabsTrigger value="demarches">
                    <Ruler />
                    Démarches
                    {demarches.length > 0 && <span className="ml-0.5 tabular">({nf.format(demarches.length)})</span>}
                  </TabsTrigger>
                </TabsList>
              </CardAction>
            </CardHeader>

            <div className="pt-4">
              <TabsContent value="missions">
                <DataGrid
                  rows={missions}
                  columns={colMissions}
                  getRowId={(m) => m.id}
                  loading={loading}
                  searchPlaceholder="Rechercher une mission…"
                  initialSort={{ id: "ouverte", dir: "desc" }}
                  onRowClick={() => router.push("/dashboard/missions")}
                  emptyIcon={Briefcase}
                  emptyTone="pending"
                  emptyTitle="Aucune mission enregistrée"
                  emptyDescription="Créez votre première mission depuis « Mes missions »."
                />
              </TabsContent>

              <TabsContent value="adu">
                <DataGrid
                  rows={dossiers}
                  columns={colAdu}
                  getRowId={(d) => d.id}
                  loading={loading}
                  searchPlaceholder="Rechercher un dossier…"
                  initialSort={{ id: "depose", dir: "desc" }}
                  onRowClick={() => router.push("/dashboard/dossiers-adu")}
                  emptyIcon={ClipboardList}
                  emptyTone="neutral"
                  emptyTitle="Aucun dossier ADU assigné"
                  emptyDescription="L'administration SGNF vous assigne les dossiers au fur et à mesure de l'instruction."
                />
              </TabsContent>

              <TabsContent value="demarches">
                <DataGrid
                  rows={demarches}
                  columns={colDemarches}
                  getRowId={(d) => d.id}
                  loading={loading}
                  searchPlaceholder="Rechercher une démarche…"
                  onRowClick={() => router.push("/dashboard/demarches")}
                  emptyIcon={Ruler}
                  emptyTone="neutral"
                  emptyTitle="Aucune démarche assignée"
                  emptyDescription="Bornage, transmission, mutation… vos démarches assignées apparaîtront ici."
                />
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </motion.div>

      {showUpload && (
        <UploadPlanModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            setShowUpload(false);
            rafraichir();
          }}
        />
      )}
    </AppShell>
  );
}
