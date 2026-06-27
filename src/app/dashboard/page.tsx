"use client";

import { useEffect, useState } from "react";

import DashboardLayout from "@/components/layout/DashboardLayout";

import { getCurrentUser } from "@/services/auth";
import { getProfile } from "@/services/profile";
import { getDashboardStats } from "@/services/dashboard";

import type { Profile } from "@/types/database";

import SGFNStatCard from "@/components/dashboard/SGFNStatCard";

import {
  Map,
  Square,
  Users,
  CreditCard,
} from "lucide-react";

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  const [stats, setStats] = useState({
    lotissements: 0,
    lots: 0,
    attributaires: 0,
    paiements: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);

      const { data: userData } = await getCurrentUser();

      if (!userData.user) {
        setLoading(false);
        return;
      }

      const [profileResult, statsResult] = await Promise.all([
        getProfile(userData.user.id),
        getDashboardStats(),
      ]);

      setProfile(profileResult.data);

      if (statsResult.data) {
        setStats(statsResult.data);
      }

      setLoading(false);
    }

    loadDashboard();
  }, []);

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center text-lg">
        Chargement du tableau de bord...
      </div>
    );
  }

  return (
    <DashboardLayout nom={profile.nom_complet}>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <SGFNStatCard
          title="Lotissements"
          value={stats.lotissements}
          icon={Map}
          subtitle="Enregistrés"
        />

        <SGFNStatCard
          title="Lots"
          value={stats.lots}
          icon={Square}
          subtitle="Référencés"
        />

        <SGFNStatCard
          title="Attributaires"
          value={stats.attributaires}
          icon={Users}
          subtitle="Actifs"
        />

        <SGFNStatCard
          title="Paiements"
          value={stats.paiements}
          icon={CreditCard}
          subtitle="Enregistrés"
        />
      </div>
    </DashboardLayout>
  );
}