"use client";

import { useEffect, useState, useCallback } from "react";
import { useChargement } from "@/hooks/useChargement";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import {
  Banknote, ChevronRight, ClipboardList, Crown, FileWarning, Handshake, Map, MessageSquare, ShieldCheck,
} from "lucide-react";
import type { Profile } from "@/components/dashboard/chefferie/types";
import { LoadingScreen, StatCard } from "@/components/dashboard/chefferie/SharedUI";
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

  const { isLoading: loading } = useChargement(fetchData, [fetchData]);

  if (loading) return <LoadingScreen />;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
          Chef de village · Chefferie
        </p>
        <h1 className="text-2xl font-bold text-[#0D3B66]">
          {autorite?.nom ?? "Mon autorité coutumière"}
        </h1>
        {autorite?.village && (
          <p className="text-sm text-slate-500">Village : {autorite.village}</p>
        )}
      </div>

      {/* Carte principale — Lotissements (page dédiée du chef de village) */}
      <Link
        href="/lotissements"
        className="group flex items-center justify-between gap-4 rounded-3xl border border-[#0D3B66]/15 bg-gradient-to-br from-[#0D3B66] to-[#1E6091] p-6 text-white shadow-sm transition hover:shadow-md sm:p-8"
      >
        <div>
          <div className="flex items-center gap-2 text-white/70">
            <Map className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">
              Lotissements sous votre juridiction
            </span>
          </div>
          <p className="mt-3 text-5xl font-bold leading-none">{lotissementsCount}</p>
          <p className="mt-2 max-w-md text-sm text-white/70">
            Consulter le détail (îlots, lots, attributaires) ou proposer une création / correction,
            soumise à l&apos;approbation du Super Admin.
          </p>
        </div>
        <ChevronRight className="h-6 w-6 shrink-0 text-white/60 transition group-hover:translate-x-1" />
      </Link>

      {/* Autres rubriques */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          href="/dashboard/validations"
          icon={ShieldCheck}
          label="APFC"
          value={apfcTotal}
          subtitle={apfcPending > 0 ? `${apfcPending} à co-signer` : "À jour"}
          alerte={apfcPending}
        />
        <StatCard
          href="/dashboard/validations"
          icon={Banknote}
          label="Cessions à valider"
          value={cessionsPending}
          subtitle={cessionsPending > 0 ? "En attente de validation" : "À jour"}
          alerte={cessionsPending}
        />
        <StatCard
          href="/dashboard/dossiers-adu"
          icon={ClipboardList}
          label="Dossiers ADU"
          value={dossiersAduCount}
          subtitle="Sur votre juridiction"
        />
        <StatCard
          href="/dashboard/litiges"
          icon={FileWarning}
          label="Litiges"
          value={litigesActifsCount}
          subtitle={litigesActifsCount > 0 ? "Actifs" : "Aucun litige actif"}
          alerte={litigesActifsCount}
        />
        <StatCard
          href="/dashboard/concertation"
          icon={Handshake}
          label="Concertation"
          value={concertationCount}
          subtitle="Concertations en cours"
        />
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ChefferiePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <LoadingScreen />;

  if (!profile) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-sm text-slate-400">
          Profil introuvable. Contactez l&apos;administration.
        </p>
      </div>
    );
  }

  if (profile.famille_id) return <ProprietaireTerrienView profile={profile} />;
  if (profile.autorite_coutumiere_id)
    return <ChefVillageView profile={profile} />;

  return (
    <div className="flex min-h-[300px] items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
          <Crown className="h-6 w-6 text-amber-600" />
        </div>
        <p className="text-sm font-semibold text-slate-800">
          Compte en cours de provisionnement
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Votre compte n&apos;est pas encore rattaché à une famille ou une autorité
          coutumière. Contactez l&apos;administration SGNF pour finaliser le
          provisionnement.
        </p>
        <Link
          href="/dashboard/messages"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1E6091]"
        >
          <MessageSquare className="h-4 w-4" />
          Contacter l&apos;administration
        </Link>
      </div>
    </div>
  );
}
