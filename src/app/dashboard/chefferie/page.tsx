"use client";

import { useEffect, useState, useCallback } from "react";
import { useChargement } from "@/hooks/useChargement";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Banknote, ClipboardList, Crown, FileWarning, Handshake, Map, ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { fadeUp, stagger } from "@/lib/motion";
import type { Profile } from "@/components/dashboard/chefferie/types";
import { AppShell } from "@/components/pilotage/AppShell";
import { Button } from "@/components/ds/button";
import { CountBadge } from "@/components/ds/badge";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Kpi } from "@/components/ds/kpi";
import { ProprietaireTerrienView } from "@/components/dashboard/proprietaire-terrien/ProprietaireTerrienView";

// ─── Types ────────────────────────────────────────────────────────────────────

type AutoriteCoutumiere = {
  id: string;
  nom: string;
  type: string | null;
  village: string | null;
  chef: string | null;
};

// ─── Vue Chef de Village ──────────────────────────────────────────────────────

function ChefVillageView({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [autorite, setAutorite] = useState<AutoriteCoutumiere | null>(null);
  const [lotissementsCount, setLotissementsCount] = useState(0);
  const [apfcTotal, setApfcTotal] = useState(0);
  const [apfcPending, setApfcPending] = useState(0);
  const [cessionsPending, setCessionsPending] = useState(0);
  const [dossiersAduCount, setDossiersAduCount] = useState(0);
  const [litigesActifsCount, setLitigesActifsCount] = useState(0);
  const [concertationCount, setConcertationCount] = useState(0);

  // Toutes les valeurs sont scopées à la juridiction : soit par une RLS déjà
  // scopée via ma_chefferie_id() (cessions / dossiers ADU / litiges), soit par un
  // filtre explicite autorite_coutumiere_id (lotissements / APFC). Comptes seuls
  // (head:true) — l'Espace Chefferie n'affiche que des cartes, pas de détails.
  const fetchData = useCallback(async () => {
    const [
      autoriteRes, lotissementsRes, apfcTotalRes, apfcPendingRes,
      cessionsRes, dossiersRes, litigesRes, concertationRes,
    ] = await Promise.all([
      supabase.from("autorites_coutumieres").select("id, nom, type, village, chef").eq("id", profile.autorite_coutumiere_id!).single(),
      supabase.from("lotissements").select("id", { count: "exact", head: true }).eq("autorite_coutumiere_id", profile.autorite_coutumiere_id!),
      supabase.from("attestations_coutumieres").select("id", { count: "exact", head: true }).eq("autorite_coutumiere_id", profile.autorite_coutumiere_id!),
      supabase.from("attestations_coutumieres").select("id", { count: "exact", head: true }).eq("autorite_coutumiere_id", profile.autorite_coutumiere_id!).is("sig_chef_village_le", null),
      supabase.from("attestations_cession").select("id", { count: "exact", head: true }).is("sig_chefferie_le", null),
      supabase.from("dossiers_adu").select("id", { count: "exact", head: true }),
      supabase.from("litiges").select("id", { count: "exact", head: true }).neq("statut", "clos"),
      supabase.from("conversation_participants").select("profile_id", { count: "exact", head: true }).eq("profile_id", profile.id),
    ]);
    setAutorite(autoriteRes.data as AutoriteCoutumiere | null);
    setLotissementsCount(lotissementsRes.count ?? 0);
    setApfcTotal(apfcTotalRes.count ?? 0);
    setApfcPending(apfcPendingRes.count ?? 0);
    setCessionsPending(cessionsRes.count ?? 0);
    setDossiersAduCount(dossiersRes.count ?? 0);
    setLitigesActifsCount(litigesRes.count ?? 0);
    setConcertationCount(concertationRes.count ?? 0);
  }, [profile.autorite_coutumiere_id, profile.id]);

  const { isLoading: loading, recharger } = useChargement(fetchData, [fetchData]);
  const { counts } = useBadgeCounts();

  // « À traiter en priorité » (handoff). Chaque ligne naît d'un compteur réel :
  // rien ne s'affiche qui ne corresponde pas à un dossier effectivement en
  // attente. Le handoff nomme des parcelles précises — on ne les invente pas.
  type Priorite = {
    cle: string;
    titre: string;
    detail: string;
    action: string;
    href: string;
    icon: LucideIcon;
    compte: number;
  };

  const priorites: Priorite[] = [
    apfcPending > 0 && {
      cle: "apfc",
      titre: `${apfcPending} attestation${apfcPending > 1 ? "s" : ""} coutumière${apfcPending > 1 ? "s" : ""} en attente de votre signature`,
      detail: "APFC · co-signature chef de village",
      action: "Signer",
      href: "/dashboard/validations",
      icon: ShieldCheck,
      compte: apfcPending,
    },
    cessionsPending > 0 && {
      cle: "cessions",
      titre: `${cessionsPending} cession${cessionsPending > 1 ? "s" : ""} à valider`,
      detail: "En attente de validation de la chefferie",
      action: "Examiner",
      href: "/dashboard/validations",
      icon: Banknote,
      compte: cessionsPending,
    },
    litigesActifsCount > 0 && {
      cle: "litiges",
      titre: `${litigesActifsCount} litige${litigesActifsCount > 1 ? "s" : ""} actif${litigesActifsCount > 1 ? "s" : ""} sur votre juridiction`,
      detail: "En attente de médiation",
      action: "Médier",
      href: "/dashboard/litiges",
      icon: FileWarning,
      compte: litigesActifsCount,
    },
  ].filter((p): p is Priorite => p !== false);

  // Même convention que le Centre de pilotage national : la carte ne prend la
  // teinte brique que si la file est non vide, et la pastille d'en-tête compte
  // les dossiers, pas les lignes.
  const dossiersEnAttente = priorites.reduce((n, p) => n + p.compte, 0);

  if (loading) {
    return (
      <AppShell loading counts={counts} onRefresh={recharger}>
        <div className="flex min-h-[320px] items-center justify-center">
          <span className="text-[13px] font-medium text-muted-2">Chargement de votre juridiction…</span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell loading={loading} counts={counts} onRefresh={recharger}>
      {/* En-tête */}
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-bold tracking-[0.22em] text-primary uppercase">
          Chef de village · Chefferie
        </p>
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
          {autorite?.nom ?? "Mon autorité coutumière"}
        </h1>
        {autorite?.village && (
          <p className="text-[13.5px] text-muted-foreground">Village : {autorite.village}</p>
        )}
        <p className="mt-1 max-w-2xl text-[13px] text-muted-2">
          Consultez le détail de vos lotissements (îlots, lots, attributaires) ou proposez une création ou
          une correction, soumise à l&apos;approbation du Super Admin.
        </p>
      </div>

      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Indicateurs de ma juridiction"
      >
        <Kpi
          icon={Map}
          label="Lotissements"
          href="/lotissements"
          loading={loading}
          value={lotissementsCount}
          legende={<>sous votre juridiction</>}
        />
        {/* Ces deux chiffres sont ceux de la carte « À traiter en priorité »
            ci-dessous : les écrire en ambre ici et en brique là-bas ferait de la
            couleur un hasard. Une même file, une seule couleur. */}
        <Kpi
          icon={ShieldCheck}
          label="APFC"
          href="/dashboard/validations"
          loading={loading}
          value={apfcTotal}
          tone={apfcPending > 0 ? "alert" : "neutral"}
          legende={apfcPending > 0 ? <>{apfcPending} à co-signer</> : <>toutes co-signées</>}
        />
        <Kpi
          icon={Banknote}
          label="Cessions à valider"
          href="/dashboard/validations"
          loading={loading}
          value={cessionsPending}
          tone={cessionsPending > 0 ? "alert" : "neutral"}
          legende={cessionsPending > 0 ? <>en attente de votre validation</> : <>aucune cession en attente</>}
        />
        <Kpi
          icon={ClipboardList}
          label="Dossiers ADU"
          href="/dashboard/dossiers-adu"
          loading={loading}
          value={dossiersAduCount}
          legende={<>sur votre juridiction</>}
        />
        <Kpi
          icon={FileWarning}
          label="Litiges"
          href="/dashboard/litiges"
          loading={loading}
          value={litigesActifsCount}
          tone={litigesActifsCount > 0 ? "warning" : "neutral"}
          legende={litigesActifsCount > 0 ? <>actifs sur votre juridiction</> : <>aucun litige actif</>}
        />
        <Kpi
          icon={Handshake}
          label="Concertation"
          href="/dashboard/concertation"
          loading={loading}
          value={concertationCount}
          legende={<>échanges en cours</>}
        />
      </motion.section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] xl:items-start">
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="min-w-0">
          <Card tone={priorites.length > 0 ? "alert" : "default"} className="h-full">
            <CardHeader>
              <div>
                <CardTitle>À traiter en priorité</CardTitle>
                <CardDescription>Ce qui attend une décision de la chefferie</CardDescription>
              </div>
              {priorites.length > 0 && (
                <CardAction className="gap-2.5">
                  <CountBadge tone="inverse" value={dossiersEnAttente} />
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="text-brick-foreground hover:bg-brick-foreground/15 hover:text-brick-foreground"
                  >
                    <Link href="/dashboard/validations">Tout voir</Link>
                  </Button>
                </CardAction>
              )}
            </CardHeader>

            <div className="px-5 pt-4 pb-5">
              {priorites.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="Rien en attente"
                  description="Aucune signature, aucune cession et aucun litige ne requiert votre intervention."
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {priorites.map((p) => {
                    const Icone = p.icon;
                    return (
                      <li key={p.cle}>
                        <Link
                          href={p.href}
                          className="group flex items-center gap-3 rounded-xl border border-brick/20 bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-brick/50"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-brick text-brick-foreground">
                            <Icone className="size-[18px]" aria-hidden />
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="text-[13px] font-semibold text-foreground">{p.titre}</span>
                            <span className="truncate text-[11.5px] text-muted-2">{p.detail}</span>
                          </span>
                          <span className="ml-auto flex shrink-0 items-center gap-2.5">
                            <CountBadge value={p.compte} />
                            {/* `text-primary` (bleu marine) disparaissait sur le
                                fond de carte en thème sombre : le libellé
                                d'action était quasi invisible. La ligne entière
                                est cliquable, la flèche suffit à l'affordance. */}
                            <span className="text-[12px] font-semibold text-foreground">{p.action} →</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" className="min-w-0">
          <Card className="h-full">
            <CardHeader>
              <div>
                <CardTitle>Actions rapides</CardTitle>
                <CardDescription>Ce que vous pouvez engager depuis ici</CardDescription>
              </div>
            </CardHeader>

            <div className="flex flex-col gap-2.5 px-5 pb-5">
              {[
                { icon: Handshake, titre: "Nouvelle concertation", desc: "Convoquer les parties", href: "/dashboard/concertation" },
                { icon: FileWarning, titre: "Signaler un litige", desc: "Ouvrir un dossier", href: "/dashboard/litiges" },
                { icon: Map, titre: "Consulter les lotissements", desc: "Îlots, lots, attributaires", href: "/lotissements" },
              ].map((a) => {
                const Icone = a.icon;
                return (
                  <Link
                    key={a.titre}
                    href={a.href}
                    className="group flex items-center gap-3 rounded-xl border border-border p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-inset text-primary transition-colors group-hover:bg-accent-subtle">
                      <Icone className="size-[18px]" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[13px] font-semibold text-foreground">{a.titre}</span>
                      <span className="truncate text-[11.5px] text-muted-2">{a.desc}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>
        </motion.div>
      </div>
    </AppShell>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ChefferiePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Un compte `chefferie` rattaché à une famille voit l'espace Propriétaire
  // terrien : cette vue porte désormais sa propre coquille, qui a besoin des
  // pastilles. Cet écran sera migré à son tour.
  const { counts } = useBadgeCounts();

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, nom_complet, groupe, famille_id, autorite_coutumiere_id, attributaire_id"
        )
        .eq("id", user.id)
        .single();
      setProfile(data as Profile | null);
      setLoading(false);
    })();
  }, []);

  // Chargement et impasses de rattachement gardent la coquille.
  if (loading || !profile) {
    return (
      <AppShell loading={loading} counts={counts} onRefresh={() => window.location.reload()}>
        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <span className="text-[13px] font-medium text-muted-2">Chargement de votre espace…</span>
          </div>
        ) : (
          <EmptyState
            icon={Crown}
            title="Profil introuvable"
            description="Votre profil n'a pas pu être chargé. Contactez l'administration SGNF."
            action={{ label: "Contacter l'administration", href: "/dashboard/messages" }}
          />
        )}
      </AppShell>
    );
  }

  if (profile.famille_id) return <ProprietaireTerrienView profile={profile} counts={counts} />;
  if (profile.autorite_coutumiere_id)
    return <ChefVillageView profile={profile} />;

  return (
    <AppShell loading={false} counts={counts} onRefresh={() => window.location.reload()}>
      <EmptyState
        icon={Crown}
        title="Compte en cours de provisionnement"
        description="Votre compte n'est pas encore rattaché à une famille ou une autorité coutumière. Contactez l'administration SGNF pour finaliser le provisionnement."
        action={{ label: "Contacter l'administration", href: "/dashboard/messages" }}
      />
    </AppShell>
  );
}
