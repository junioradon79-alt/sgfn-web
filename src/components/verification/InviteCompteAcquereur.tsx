"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, ShieldCheck, Store, ChevronRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// Marketplace public (TerraCI Market) — la découverte des annonces y vit.
const MARKETPLACE_BASE = "https://monterrain.sgfn.ci";

/**
 * Invite de captage de leads affichée sur /verifier, APRÈS l'aperçu gratuit d'un
 * document scanné. Propose à un visiteur non connecté de créer un compte
 * acquéreur pour suivre la parcelle (« être prévenu si elle est mise en vente »)
 * — ou, si elle est déjà en vente, pour contacter le vendeur.
 *
 * Règles (politique arbitrée du 17/07) :
 *  - JAMAIS si l'utilisateur est déjà connecté.
 *  - non bloquante : c'est un encart, pas un mur.
 *  - MINIMALE anti-phishing : ne demande jamais argent / papiers / code — le
 *    parcours ne mène qu'à un email + mot de passe, dit noir sur blanc.
 */
export function InviteCompteAcquereur({ reference }: { reference: string }) {
  const [statut, setStatut] = useState<"chargement" | "cache" | "invite">("chargement");
  const [enVente, setEnVente] = useState(false);
  const [annonceId, setAnnonceId] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (annule) return;
      // Décision : ne jamais montrer l'invite à un utilisateur connecté.
      if (user) {
        setStatut("cache");
        return;
      }
      // L'aimant (statut de vente) est résolu côté serveur sans exposer le
      // registre : la RPC ne renvoie que { en_vente, annonce_id }.
      const { data } = await supabase.rpc("annonce_active_pour_reference", {
        p_reference: reference,
      });
      if (annule) return;
      const res = (data ?? {}) as { en_vente?: boolean; annonce_id?: string | null };
      setEnVente(!!res.en_vente);
      setAnnonceId(res.annonce_id ?? null);
      setStatut("invite");
    })();
    return () => {
      annule = true;
    };
  }, [reference]);

  if (statut !== "invite") return null;

  const inscriptionHref = `/inscription?public=1&suivi=${encodeURIComponent(reference)}`;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#1E6091]/25 bg-gradient-to-br from-[#0D3B66]/[0.04] to-[#1E6091]/[0.06]">
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#0D3B66] shadow-sm">
            {enVente ? <Store className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            {enVente ? (
              <>
                <p className="text-sm font-bold text-[#0D3B66]">Ce terrain est en vente sur TerraCI Market</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Créez votre compte acquéreur (gratuit) pour contacter le vendeur et suivre ce terrain.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-[#0D3B66]">Intéressé par ce terrain ?</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Créez votre compte acquéreur (gratuit) pour être prévenu si ce terrain est mis en
                  vente sur TerraCI Market.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link
            href={inscriptionHref}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0D3B66] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1E6091]"
          >
            <Bell className="h-4 w-4" />
            {enVente ? "Créer mon compte pour contacter le vendeur" : "Créer mon compte pour être prévenu"}
          </Link>
          {enVente && annonceId && (
            <a
              href={`${MARKETPLACE_BASE}/annonces/${annonceId}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#1E6091]/30 bg-white px-5 py-3 text-sm font-semibold text-[#1E6091] transition hover:bg-[#1E6091]/5"
            >
              Voir l&apos;annonce
              <ChevronRight className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* Garde-fou anti-phishing — critère simple donné au public. */}
        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#147A55]" />
          SGNF ne vous demandera jamais d&apos;argent ni vos papiers après un scan — seulement un
          email et un mot de passe pour créer votre compte.
        </p>
      </div>
    </div>
  );
}
