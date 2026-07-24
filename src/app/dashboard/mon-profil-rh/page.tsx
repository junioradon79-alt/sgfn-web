"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, Building2, Calendar, IdCard, Mail, Phone } from "lucide-react";

import { fadeUp } from "@/lib/motion";
import { createClient } from "@/utils/supabase/client";
import { useChargement } from "@/hooks/useChargement";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Skeleton } from "@/components/ds/skeleton";

/**
 * Espace du rôle `collaborateur` (24/07) — sa propre fiche RH, en lecture
 * seule. Aucune donnée à saisir ici : `poste`/`service`/etc. sont maintenus
 * par admin/comptable sur `/dashboard/collaborateurs`. La RLS (policy
 * `collaborateurs_lecture_soi`, migration 20260724191000) ne laisse ce rôle
 * voir que sa propre ligne — pas de `.eq()` nécessaire côté client.
 */

type MaFiche = {
  nom_complet: string;
  poste: string | null;
  service: string | null;
  email: string | null;
  telephone: string | null;
  date_entree: string | null;
  statut: string;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function Champ({ icon: Icon, label, valeur }: { icon: typeof IdCard; label: string; valeur: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-2" aria-hidden />
      <div>
        <p className="text-[11px] font-bold tracking-wider text-muted-2 uppercase">{label}</p>
        <p className="text-sm font-medium text-foreground">{valeur}</p>
      </div>
    </div>
  );
}

function MonProfilRhContenu() {
  const supabase = useMemo(() => createClient(), []);
  const { counts } = useBadgeCounts();
  const [fiche, setFiche] = useState<MaFiche | null>(null);

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("collaborateurs")
      .select("nom_complet, poste, service, email, telephone, date_entree, statut")
      .maybeSingle();
    setFiche((data as MaFiche | null) ?? null);
  }, [supabase]);

  const { isLoading: loading, recharger } = useChargement(charger, [charger]);

  return (
    <AppShell loading={loading} counts={counts} onRefresh={recharger}>
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex flex-col gap-5">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Ma fiche RH
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Vos informations telles qu&apos;enregistrées par l&apos;équipe SGNF.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{loading ? "Chargement…" : (fiche?.nom_complet ?? "Fiche introuvable")}</CardTitle>
              {fiche && (
                <CardDescription>
                  <Badge tone={fiche.statut === "actif" ? "success" : "neutral"}>
                    {fiche.statut === "actif" ? "Actif" : "Inactif"}
                  </Badge>
                </CardDescription>
              )}
            </div>
          </CardHeader>
          <div className="px-5 pb-5">
            {loading ? (
              <Skeleton className="h-40" />
            ) : !fiche ? (
              <EmptyState
                icon={IdCard}
                title="Aucune fiche associée"
                description="Votre compte n'est pas encore rattaché à une fiche RH. Contactez l'administration."
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                <Champ icon={Briefcase} label="Poste" valeur={fiche.poste ?? "—"} />
                <Champ icon={Building2} label="Service" valeur={fiche.service ?? "—"} />
                <Champ icon={Phone} label="Téléphone" valeur={fiche.telephone ?? "—"} />
                <Champ icon={Mail} label="Courriel" valeur={fiche.email ?? "—"} />
                <Champ icon={Calendar} label="Date d'entrée" valeur={formatDate(fiche.date_entree)} />
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </AppShell>
  );
}

export default function MonProfilRhPage() {
  return <MonProfilRhContenu />;
}
