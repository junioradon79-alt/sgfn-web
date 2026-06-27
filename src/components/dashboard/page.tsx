"use client";

import { useEffect, useState } from "react";

import DashboardLayout from "@/components/layout/DashboardLayout";

import { getCurrentUser } from "@/services/auth";
import { getProfile } from "@/services/profile";
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

  useEffect(() => {
    async function loadProfile() {
      const { data: userData } = await getCurrentUser();

      if (!userData.user) return;

      const { data } = await getProfile(userData.user.id);

      setProfile(data);
    }

    loadProfile();
  }, []);

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Chargement...
      </div>
    );
  }

  return (
    <DashboardLayout nom={profile.nom_complet}>

      <div className="space-y-8">

        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            Tableau de bord
          </h2>

          <p className="mt-2 text-slate-500">
            Bienvenue, {profile.nom_complet}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

          <SGFNStatCard
            title="Lotissements"
            value={18}
            icon={Map}
            subtitle="Enregistrés"
          />

          <SGFNStatCard
            title="Lots"
            value={8542}
            icon={Square}
            subtitle="Référencés"
          />

          <SGFNStatCard
            title="Attributaires"
            value={3201}
            icon={Users}
            subtitle="Actifs"
          />

          <SGFNStatCard
            title="Paiements"
            value={125}
            icon={CreditCard}
            subtitle="Ce mois"
          />

        </div>

      </div>

    </DashboardLayout>
  );
}
