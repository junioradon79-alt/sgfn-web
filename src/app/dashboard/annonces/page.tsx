"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Coins, FileEdit, Megaphone, Search } from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Card } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Input } from "@/components/ds/input";
import { Kpi } from "@/components/ds/kpi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ds/select";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { stagger } from "@/lib/motion";

type AnnonceRecord = {
  id: string;
  titre: string;
  prix: number | null;
  usage: string | null;
  zone: string | null;
  statut: string;
  publiee_le: string | null;
  lot_id: string | null;
  proprietaire_profile_id: string | null;
  profiles: { nom_complet: string | null } | null;
};

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

/** Le statut d'une annonce lu en un jeton du Design System (thème clair/sombre). */
const STATUT_TONE: Record<string, { tone: Tone; label: string }> = {
  active: { tone: "success", label: "Active" },
  brouillon: { tone: "neutral", label: "Brouillon" },
  vendue: { tone: "accent", label: "Vendue" },
  suspendue: { tone: "warning", label: "Suspendue" },
  archivee: { tone: "warning", label: "Archivée" },
};

const TOUS = "tous";

const fcfa = (v: number) => new Intl.NumberFormat("fr-FR").format(v) + " FCFA";

const fmtDate = (v: string | null) =>
  v
    ? new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

/** Normalisation insensible aux accents/casse pour la recherche libre. */
const pliable = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function AnnoncesPage() {
  const supabase = useMemo(() => createClient(), []);
  const { counts } = useBadgeCounts();

  const [annonces, setAnnonces] = useState<AnnonceRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [statutFiltre, setStatutFiltre] = useState<string>(TOUS);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("annonces_marketplace")
      .select(
        "id, titre, prix, usage, zone, statut, publiee_le, lot_id, proprietaire_profile_id, profiles ( nom_complet )",
      )
      .order("publiee_le", { ascending: false, nullsFirst: false });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(null);
      setAnnonces((data ?? []) as unknown as AnnonceRecord[]);
    }
  }, [supabase]);

  const { isLoading, recharger } = useChargement(load);

  const actives = annonces.filter((a) => a.statut === "active").length;
  const brouillons = annonces.filter((a) => a.statut === "brouillon").length;
  const valeurActives = annonces
    .filter((a) => a.statut === "active")
    .reduce((s, a) => s + (a.prix ?? 0), 0);

  // Statuts réellement présents — le filtre ne propose que ce qui existe.
  const statutsPresents = useMemo(
    () => Array.from(new Set(annonces.map((a) => a.statut))),
    [annonces],
  );

  const requete = pliable(recherche.trim());
  const affichees = annonces.filter((a) => {
    if (statutFiltre !== TOUS && a.statut !== statutFiltre) return false;
    if (!requete) return true;
    const foin = pliable(
      [a.titre, a.zone ?? "", a.usage ?? "", a.profiles?.nom_complet ?? ""].join(" "),
    );
    return foin.includes(requete);
  });

  return (
    <AppShell loading={isLoading} counts={counts} onRefresh={recharger}>
      <div>
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
          Annonces publiées — TerraCI Market
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Parcelles mises en vente sur la place de marché, tous propriétaires confondus.
        </p>
      </div>

      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Indicateurs des annonces"
      >
        <Kpi icon={Megaphone} label="Annonces" loading={isLoading} value={annonces.length} legende={<>publiées ou en brouillon</>} />
        <Kpi icon={CheckCircle2} label="Actives" loading={isLoading} value={actives} legende={<>visibles sur le site public</>} />
        <Kpi icon={FileEdit} label="Brouillons" loading={isLoading} value={brouillons} tone={brouillons > 0 ? "warning" : "neutral"} legende={<>non encore publiés</>} />
        <Kpi icon={Coins} label="Valeur en vitrine" loading={isLoading} value={valeurActives} format={fcfa} legende={<>cumul des annonces actives</>} />
      </motion.section>

      {errorMessage && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger-subtle px-4 py-3 text-sm font-medium text-danger">
          {errorMessage}
        </p>
      )}

      {/* Barre d'outils : recherche libre + filtre de statut. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-2" aria-hidden />
          <Input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un titre, une zone, un propriétaire…"
            aria-label="Rechercher une annonce"
            className="pl-9"
          />
        </div>
        <Select value={statutFiltre} onValueChange={setStatutFiltre}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Filtrer par statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TOUS}>Tous les statuts</SelectItem>
            {statutsPresents.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUT_TONE[s]?.label ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {affichees.length === 0 ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title={annonces.length === 0 ? "Aucune annonce publiée" : "Aucune annonce ne correspond"}
            description={
              annonces.length === 0
                ? "Les parcelles mises en vente par les propriétaires apparaîtront ici."
                : "Ajustez la recherche ou le filtre de statut pour élargir les résultats."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="max-h-[62vh] overflow-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border text-left text-[11.5px] font-semibold tracking-wide text-muted-2 uppercase">
                  <th className="px-4 py-3 font-semibold">Annonce</th>
                  <th className="px-4 py-3 font-semibold">Zone</th>
                  <th className="px-4 py-3 font-semibold">Usage</th>
                  <th className="px-4 py-3 text-right font-semibold">Prix</th>
                  <th className="px-4 py-3 font-semibold">Propriétaire</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 font-semibold">Publiée le</th>
                </tr>
              </thead>
              <tbody>
                {affichees.map((a) => {
                  const cfg = STATUT_TONE[a.statut] ?? { tone: "neutral" as Tone, label: a.statut };
                  return (
                    <tr key={a.id} className="border-b border-border/70 last:border-0 hover:bg-inset/60">
                      <td className="px-4 py-3 font-medium text-foreground">{a.titre}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.zone ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{a.usage ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular font-medium text-foreground">
                        {a.prix != null ? fcfa(a.prix) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.profiles?.nom_complet ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={cfg.tone}>{cfg.label}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(a.publiee_le)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
