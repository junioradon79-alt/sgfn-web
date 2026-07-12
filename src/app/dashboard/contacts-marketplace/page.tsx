"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import {
  Copy,
  Handshake,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  RefreshCw,
  ShieldAlert,
  User,
} from "lucide-react";

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

const STATUT_CONFIG: Record<string, { badge: "en_validation" | "attribue" | "disponible" | "neutre"; label: string }> = {
  nouvelle: { badge: "en_validation", label: "Nouvelle" },
  traitee: { badge: "attribue", label: "Traitée" },
  transmise: { badge: "disponible", label: "Transmise" },
  close: { badge: "neutre", label: "Close" },
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
  const supabase = createClient();
  const { loading: profilLoading, isAdmin } = useProfile();

  const [demandes, setDemandes] = useState<DemandeContactRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [siteAJour, setSiteAJour] = useState(true);
  const [marquantReconstruit, setMarquantReconstruit] = useState(false);

  const loadDemandes = useCallback(async () => {
    setDataLoading(true);
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
    setDataLoading(false);
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

  useEffect(() => {
    if (isAdmin) {
      void loadDemandes();
      void loadEtatSite();
    }
  }, [isAdmin, loadDemandes, loadEtatSite]);

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

  if (profilLoading || (dataLoading && isAdmin)) {
    return <div className="py-20 text-center text-sm text-slate-500">Chargement…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <p className="mt-4 text-sm text-slate-600">
          Cette page est réservée aux administrateurs SGNF.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-brand-primary">
          Demandes de contact — Mon Terrain
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Mise en relation entre acheteurs (porteurs de pass) et propriétaires de lots.{" "}
          <span className={nouvelles > 0 ? "font-medium text-[#F39C12]" : "font-medium text-[#2D8F5A]"}>
            {nouvelles} nouvelle{nouvelles !== 1 ? "s" : ""} demande{nouvelles !== 1 ? "s" : ""}.
          </span>
        </p>
      </div>

      {!siteAJour && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200/70 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Une annonce a été publiée ou modifiée depuis le dernier déploiement du site. Pensez à
            reconstruire et redéployer <strong>monterrain-web</strong> (export statique, aucune mise à
            jour automatique).
          </p>
          <button
            type="button"
            onClick={() => void marquerReconstruit()}
            disabled={marquantReconstruit}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
          >
            {marquantReconstruit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Marquer comme reconstruit
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 rounded-2xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {demandes.length === 0 ? (
        <div className="rounded-xl border border-slate-200/60 bg-white px-5 py-16 text-center text-sm text-slate-500">
          Aucune demande de contact pour le moment.
        </div>
      ) : (
        <div className="space-y-4">
          {demandes.map((d) => {
            const cfg = STATUT_CONFIG[d.statut] ?? STATUT_CONFIG.nouvelle;
            const proprietaire = d.annonces_marketplace?.profiles;
            return (
              <div
                key={d.id}
                className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-[#0D3B66]">
                      {d.annonces_marketplace?.titre ?? "Annonce supprimée"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {d.annonces_marketplace?.zone ?? "—"} ·{" "}
                      {d.annonces_marketplace ? fmtPrix(d.annonces_marketplace.prix) : "—"} ·{" "}
                      {fmtDate(d.cree_le)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={cfg.badge}>{cfg.label}</Badge>
                    <select
                      value={d.statut}
                      disabled={updatingId === d.id}
                      onChange={(e) => handleStatutChange(d.id, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10 disabled:opacity-50"
                    >
                      {STATUT_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {STATUT_CONFIG[s].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50/70 p-3.5">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <User className="h-3.5 w-3.5" /> Acheteur (pass {d.jetons_marketplace?.reference ?? "—"})
                    </p>
                    <p className="text-sm font-medium text-slate-800">
                      {d.jetons_marketplace?.acheteur_nom ?? "—"}
                    </p>
                    <div className="mt-1.5 flex flex-col gap-1 text-sm text-slate-600">
                      {d.jetons_marketplace?.acheteur_telephone && (
                        <button
                          type="button"
                          onClick={() => copier(d.jetons_marketplace!.acheteur_telephone, `tel-${d.id}`)}
                          className="flex items-center gap-1.5 text-left hover:text-[#1E6091]"
                        >
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {d.jetons_marketplace.acheteur_telephone}
                          <Copy className="h-3 w-3 text-slate-400" />
                          {copiedField === `tel-${d.id}` && <span className="text-xs text-emerald-600">copié</span>}
                        </button>
                      )}
                      {d.jetons_marketplace?.acheteur_email && (
                        <button
                          type="button"
                          onClick={() => copier(d.jetons_marketplace!.acheteur_email, `email-${d.id}`)}
                          className="flex items-center gap-1.5 text-left hover:text-[#1E6091]"
                        >
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          {d.jetons_marketplace.acheteur_email}
                          <Copy className="h-3 w-3 text-slate-400" />
                          {copiedField === `email-${d.id}` && <span className="text-xs text-emerald-600">copié</span>}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50/70 p-3.5">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Handshake className="h-3.5 w-3.5" /> Propriétaire (vendeur)
                    </p>
                    <p className="text-sm font-medium text-slate-800">
                      {proprietaire?.nom_complet ?? "—"}
                    </p>
                    <div className="mt-1.5 flex flex-col gap-1 text-sm text-slate-600">
                      {proprietaire?.telephone && (
                        <button
                          type="button"
                          onClick={() => copier(proprietaire.telephone!, `tel-prop-${d.id}`)}
                          className="flex items-center gap-1.5 text-left hover:text-[#1E6091]"
                        >
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {proprietaire.telephone}
                          <Copy className="h-3 w-3 text-slate-400" />
                          {copiedField === `tel-prop-${d.id}` && <span className="text-xs text-emerald-600">copié</span>}
                        </button>
                      )}
                    </div>
                    {proprietaire?.telephone && (
                      <a
                        href={lienWhatsApp(proprietaire.telephone, d)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#25D366]/10 px-3 py-1.5 text-xs font-semibold text-[#128C4A] transition hover:bg-[#25D366]/20"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Contacter via WhatsApp
                      </a>
                    )}
                  </div>
                </div>

                {d.message && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-slate-100 bg-white p-3.5 text-sm text-slate-700">
                    <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <p>{d.message}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
