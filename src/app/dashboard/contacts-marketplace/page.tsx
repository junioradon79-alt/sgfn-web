"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Copy, Handshake, Inbox, Mail, MessageCircle, MessageSquareText, Phone, RefreshCw,
  ShieldAlert, Sparkles, User,
} from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Kpi } from "@/components/ds/kpi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ds/select";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { useProfile } from "@/hooks/useProfile";
import { fadeUp, stagger } from "@/lib/motion";

type DemandeContactRecord = {
  id: string;
  statut: string;
  message: string | null;
  cree_le: string;
  annonces_marketplace: {
    titre: string;
    prix: number;
    zone: string | null;
    proprietaire_profile_id: string;
    profiles: { nom_complet: string | null; telephone: string | null } | null;
  } | null;
  jetons_marketplace: {
    reference: string;
    acheteur_nom: string;
    acheteur_email: string;
    acheteur_telephone: string;
  } | null;
};

const STATUT_CONFIG: Record<string, { tone: "warning" | "accent" | "success" | "neutral"; label: string }> = {
  nouvelle: { tone: "warning", label: "Nouvelle" },
  traitee: { tone: "accent", label: "Traitée" },
  transmise: { tone: "success", label: "Transmise" },
  close: { tone: "neutral", label: "Close" },
};

const STATUT_OPTIONS = ["nouvelle", "traitee", "transmise", "close"] as const;

function fmtPrix(v: number): string {
  return new Intl.NumberFormat("fr-FR").format(v) + " FCFA";
}

function fmtDate(v: string): string {
  return new Date(v).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function lienWhatsApp(telephone: string, d: DemandeContactRecord): string {
  const digits = telephone.replace(/\D/g, "");
  const texte = [
    `Bonjour, un acheteur SGNF est intéressé par votre annonce « ${d.annonces_marketplace?.titre ?? ""} ».`,
    `Contact : ${d.jetons_marketplace?.acheteur_nom ?? "—"} — ${d.jetons_marketplace?.acheteur_telephone ?? "—"}`,
    d.message ? `Message : « ${d.message} »` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return `https://wa.me/${digits}?text=${encodeURIComponent(texte)}`;
}

export default function ContactsMarketplacePage() {
  const supabase = useMemo(() => createClient(), []);
  const { loading: profilLoading, isAdmin } = useProfile();
  const { counts } = useBadgeCounts();

  const [demandes, setDemandes] = useState<DemandeContactRecord[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [siteAJour, setSiteAJour] = useState(true);
  const [marquantReconstruit, setMarquantReconstruit] = useState(false);

  const loadDemandes = useCallback(async () => {
    const { data, error } = await supabase
      .from("demandes_contact")
      .select(
        `id, statut, message, cree_le,
         annonces_marketplace ( titre, prix, zone, proprietaire_profile_id, profiles ( nom_complet, telephone ) ),
         jetons_marketplace ( reference, acheteur_nom, acheteur_email, acheteur_telephone )`,
      )
      .order("cree_le", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setDemandes((data ?? []) as unknown as DemandeContactRecord[]);
    }
  }, [supabase]);

  const loadEtatSite = useCallback(async () => {
    const [{ data: etat }, { data: derniere }] = await Promise.all([
      supabase.from("marketplace_etat_site").select("derniere_reconstruction").maybeSingle(),
      supabase
        .from("annonces_marketplace")
        .select("publiee_le")
        .eq("statut", "active")
        .order("publiee_le", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const derniereReconstruction = etat?.derniere_reconstruction ?? null;
    const dernierePublication = derniere?.publiee_le ?? null;
    setSiteAJour(!dernierePublication || (!!derniereReconstruction && dernierePublication <= derniereReconstruction));
  }, [supabase]);

  const { isLoading: dataLoading, recharger } = useChargement(
    async () => {
      await Promise.all([loadDemandes(), loadEtatSite()]);
    },
    [loadDemandes, loadEtatSite],
    isAdmin
  );

  const marquerReconstruit = async () => {
    setMarquantReconstruit(true);
    setErrorMessage(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("marketplace_etat_site")
      .update({ derniere_reconstruction: new Date().toISOString(), reconstruit_par: user?.id ?? null })
      .eq("id", true);
    if (error) setErrorMessage(`Marquage « site reconstruit » non enregistré : ${error.message}`);
    await loadEtatSite();
    window.dispatchEvent(new Event("sgnf:refresh-badges"));
    setMarquantReconstruit(false);
  };

  const handleStatutChange = async (id: string, statut: string) => {
    setUpdatingId(id);
    setErrorMessage(null);
    const { error } = await supabase.from("demandes_contact").update({ statut }).eq("id", id);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setDemandes((prev) => prev.map((d) => (d.id === id ? { ...d, statut } : d)));
    }
    setUpdatingId(null);
  };

  const copier = (valeur: string, champ: string) => {
    navigator.clipboard.writeText(valeur).then(() => {
      setCopiedField(champ);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  const nouvelles = demandes.filter((d) => d.statut === "nouvelle").length;
  const transmises = demandes.filter((d) => d.statut === "transmise").length;
  const chargement = profilLoading || (dataLoading && isAdmin);

  if (!profilLoading && !isAdmin) {
    return (
      <AppShell loading={false} counts={counts} onRefresh={recharger}>
        <EmptyState
          icon={ShieldAlert}
          tone="pending"
          title="Accès réservé"
          description="Cette page est réservée aux administrateurs SGNF."
        />
      </AppShell>
    );
  }

  return (
    <AppShell loading={chargement} counts={counts} onRefresh={recharger}>
      <div>
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
          Demandes de contact — TerraCI Market
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Mise en relation entre acheteurs porteurs de pass et propriétaires de lots.
        </p>
      </div>

      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-3"
        aria-label="Indicateurs des demandes de contact"
      >
        <Kpi
          icon={Inbox}
          label="Demandes reçues"
          loading={chargement}
          value={demandes.length}
          legende={<>depuis l&apos;ouverture de la place de marché</>}
        />
        <Kpi
          icon={Sparkles}
          label="Nouvelles"
          loading={chargement}
          value={nouvelles}
          tone={nouvelles > 0 ? "warning" : "neutral"}
          legende={<>en attente de mise en relation</>}
        />
        <Kpi
          icon={Handshake}
          label="Transmises"
          loading={chargement}
          value={transmises}
          legende={<>acheteur et vendeur mis en contact</>}
        />
      </motion.section>

      {/* Rouge brique et point clignotant, comme le bandeau « N actions à faire »
          des Demandes d'acquisition : c'est exactement ce que compte la pastille
          du menu, et l'ambre en disait autre chose. Le bandeau ne s'affiche que
          si le site est en retard — à jour, l'écran ne porte aucune teinte. */}
      {!siteAJour && (
        <div className="flex flex-col gap-3 rounded-xl border border-brick/40 bg-brick-subtle px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2.5 sm:items-center">
            <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0 sm:mt-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brick opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brick" />
            </span>
            <span>
              Une annonce a été publiée ou modifiée depuis le dernier déploiement du site. Pensez à
              reconstruire et redéployer <strong>monterrain-web</strong> (export statique, aucune mise à
              jour automatique).
            </span>
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            loading={marquantReconstruit}
            onClick={() => void marquerReconstruit()}
          >
            <RefreshCw />
            Marquer comme reconstruit
          </Button>
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger-subtle px-4 py-3 text-sm font-medium text-danger">
          {errorMessage}
        </p>
      )}

      {demandes.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            tone="positive"
            title="Aucune demande de contact"
            description="Aucun acheteur n'a encore demandé à être mis en relation avec un propriétaire."
          />
        </Card>
      ) : (
        <motion.div variants={stagger(0.05, 0.04)} initial="hidden" animate="show" className="flex flex-col gap-3">
          {demandes.map((d) => {
            const cfg = STATUT_CONFIG[d.statut] ?? STATUT_CONFIG.nouvelle;
            const proprietaire = d.annonces_marketplace?.profiles;
            return (
              <motion.div key={d.id} variants={fadeUp}>
                <Card className="p-5">
                  <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-foreground">
                        {d.annonces_marketplace?.titre ?? "Annonce supprimée"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {d.annonces_marketplace?.zone ?? "—"} ·{" "}
                        {d.annonces_marketplace ? fmtPrix(d.annonces_marketplace.prix) : "—"} ·{" "}
                        {fmtDate(d.cree_le)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={cfg.tone}>{cfg.label}</Badge>
                      <Select
                        value={d.statut}
                        onValueChange={(v) => handleStatutChange(d.id, v)}
                        disabled={updatingId === d.id}
                      >
                        <SelectTrigger className="h-8 w-36" aria-label="Changer le statut de la demande">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUT_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>{STATUT_CONFIG[s].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="min-w-0 rounded-lg bg-inset p-3.5">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <User className="size-3.5" aria-hidden /> Acheteur (pass {d.jetons_marketplace?.reference ?? "—"})
                      </p>
                      <p className="text-[13px] font-medium text-foreground">
                        {d.jetons_marketplace?.acheteur_nom ?? "—"}
                      </p>
                      <div className="mt-1.5 flex flex-col gap-1 text-[13px] text-muted-foreground">
                        {d.jetons_marketplace?.acheteur_telephone && (
                          <BoutonCopie
                            icone={Phone}
                            valeur={d.jetons_marketplace.acheteur_telephone}
                            copie={copiedField === `tel-${d.id}`}
                            onCopier={() => copier(d.jetons_marketplace!.acheteur_telephone, `tel-${d.id}`)}
                          />
                        )}
                        {d.jetons_marketplace?.acheteur_email && (
                          <BoutonCopie
                            icone={Mail}
                            valeur={d.jetons_marketplace.acheteur_email}
                            copie={copiedField === `email-${d.id}`}
                            onCopier={() => copier(d.jetons_marketplace!.acheteur_email, `email-${d.id}`)}
                          />
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 rounded-lg bg-inset p-3.5">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <Handshake className="size-3.5" aria-hidden /> Propriétaire (vendeur)
                      </p>
                      <p className="text-[13px] font-medium text-foreground">
                        {proprietaire?.nom_complet ?? "—"}
                      </p>
                      <div className="mt-1.5 flex flex-col gap-1 text-[13px] text-muted-foreground">
                        {proprietaire?.telephone && (
                          <BoutonCopie
                            icone={Phone}
                            valeur={proprietaire.telephone}
                            copie={copiedField === `tel-prop-${d.id}`}
                            onCopier={() => copier(proprietaire.telephone!, `tel-prop-${d.id}`)}
                          />
                        )}
                      </div>
                      {proprietaire?.telephone && (
                        // Ton `success` plutôt que le vert de marque WhatsApp :
                        // #128C4A ne tient pas le contraste sur fond sombre, et
                        // l'icône suffit à identifier le canal.
                        <Button asChild size="sm" variant="ghost" className="mt-2.5 text-success hover:bg-success-subtle hover:text-success">
                          <a href={lienWhatsApp(proprietaire.telephone, d)} target="_blank" rel="noopener noreferrer">
                            <MessageCircle />
                            Contacter via WhatsApp
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>

                  {d.message && (
                    <div className="mt-4 flex items-start gap-2 rounded-lg border border-border p-3.5 text-[13px] text-foreground">
                      <MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <p>{d.message}</p>
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </AppShell>
  );
}

/** Coordonnée cliquable : un clic copie la valeur dans le presse-papiers. */
function BoutonCopie({
  icone: Icone, valeur, copie, onCopier,
}: {
  icone: typeof Phone;
  valeur: string;
  copie: boolean;
  onCopier: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopier}
      className="flex min-w-0 items-center gap-1.5 text-left transition-colors hover:text-accent"
    >
      <Icone className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{valeur}</span>
      <Copy className="size-3 shrink-0 text-muted-2" aria-hidden />
      {copie && <span className="shrink-0 text-xs text-success">copié</span>}
    </button>
  );
}
