"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, FileSignature, ScrollText, ShieldAlert } from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Button } from "@/components/ds/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { ScrollArea } from "@/components/ds/scroll-area";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { useProfile } from "@/hooks/useProfile";
import { fadeUp, stagger } from "@/lib/motion";
import { libelleSignature } from "@/lib/signatures-attestation";
import type { AttestationCoutumiere } from "@/components/dashboard/chefferie/types";
import { SignaturesBadges, ProgressBar } from "@/components/dashboard/chefferie/SharedUI";

// ─── Types ────────────────────────────────────────────────────────────────────

type AttestationCession = {
  id: string;
  reference: string;
  statut: string;
  sig_chefferie_le: string | null;
  sig_proprietaire_le: string | null;
  sig_operateur_le: string | null;
  date_emission: string | null;
  lot: {
    numero_lot: string | null;
    ilots?: {
      numero: string | null;
      /** `famille_id` sert au libellé du signataire — voir `libelleSignature`. */
      lotissements?: { id: string; nom: string | null; famille_id?: string | null } | null;
    } | null;
  } | null;
};

// ─── Page ─────────────────────────────────────────────────────────────────────
// Signatures/validations du chef de village : attestations de cession à valider
// + APFC à co-signer. Déplacées ici depuis l'Espace Chefferie (qui n'affiche plus
// que des cartes). Atteinte via les cartes APFC / Cessions de l'Espace Chefferie.

export default function ValidationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { profile, loading: profileLoading, isChefferie } = useProfile();
  const { counts } = useBadgeCounts();

  const [attestations, setAttestations] = useState<AttestationCession[]>([]);
  const [apfc, setApfc] = useState<AttestationCoutumiere[]>([]);
  const [signing, setSigning] = useState<string | null>(null);
  const [signingApfc, setSigningApfc] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);

  const autoriteId = profile?.autorite_coutumiere_id ?? null;

  // Cessions scopées au territoire par la RLS (attcess_chefferie_read) ; APFC
  // filtrées sur la juridiction (apfc_read scopée aussi, filtre explicite en plus).
  const fetchData = useCallback(async () => {
    if (!autoriteId) return;
    const [attestationsRes, apfcRes] = await Promise.all([
      supabase
        .from("attestations_cession")
        .select(
          "id, reference, statut, sig_chefferie_le, sig_proprietaire_le, sig_operateur_le, date_emission, lot:lot_id(numero_lot, ilots(numero, lotissements(id, nom, famille_id)))"
        )
        .is("sig_chefferie_le", null),
      supabase
        .from("attestations_coutumieres")
        .select(
          "id, reference, numero, statut, date_delivrance, sig_chef_famille_le, sig_chef_village_le, sig_cvgfr_le, chef_de_famille"
        )
        .eq("autorite_coutumiere_id", autoriteId),
    ]);
    setAttestations((attestationsRes.data ?? []) as unknown as AttestationCession[]);
    setApfc((apfcRes.data ?? []) as AttestationCoutumiere[]);
  }, [autoriteId, supabase]);

  const { isLoading, recharger } = useChargement(fetchData, [autoriteId], !!autoriteId);

  /**
   * Passe par la RPC `signer_attestation` et non par un `update` direct.
   * L'ancienne version était **inopérante depuis toujours** : la chefferie n'a
   * qu'une policy SELECT sur `attestations_cession`, et sous RLS un update sans
   * policy ne lève aucune erreur — il touche 0 ligne. Comme le code ne testait
   * que `error`, l'écran affichait un succès et la pastille restait grise.
   * La RPC, elle, lève une exception explicite si le droit manque.
   */
  const signerAttestation = async (id: string) => {
    setSigning(id);
    setSignError(null);
    const { error } = await supabase.rpc("signer_attestation", {
      p_id: id,
      p_signature: "chefferie",
    });
    if (error) setSignError(`Signature non enregistrée : ${error.message}`);
    setSigning(null);
    void recharger();
  };

  const signerApfc = async (id: string) => {
    setSigningApfc(id);
    setSignError(null);
    const { error } = await supabase
      .from("attestations_coutumieres")
      .update({ sig_chef_village_le: new Date().toISOString() })
      .eq("id", id);
    if (error) setSignError(`Signature non enregistrée : ${error.message}`);
    setSigningApfc(null);
    void recharger();
  };

  const chargement = profileLoading || (isChefferie && isLoading);

  if (!profileLoading && (!isChefferie || !profile?.autorite_coutumiere_id)) {
    return (
      <AppShell loading={false} counts={counts} onRefresh={recharger}>
        <EmptyState
          icon={ShieldAlert}
          tone="pending"
          title="Accès réservé"
          description="Cet espace est réservé au chef de village."
        />
      </AppShell>
    );
  }

  return (
    <AppShell loading={chargement} counts={counts} onRefresh={recharger}>
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard/chefferie">
            <ArrowLeft />
            Retour à l&apos;Espace Chefferie
          </Link>
        </Button>
        <h1 className="mt-2 font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
          Validations
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Attestations de cession à valider et APFC à co-signer, sur votre juridiction.
        </p>
      </div>

      {signError && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger-subtle px-4 py-3 text-sm font-medium text-danger">
          {signError}
        </p>
      )}

      <motion.div variants={stagger(0.05, 0.06)} initial="hidden" animate="show" className="flex flex-col gap-5">
        {/* Attestations de cession à valider */}
        <motion.div variants={fadeUp}>
          <Card id="cessions" className="scroll-mt-6 overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>Attestations de cession — en attente de votre validation</CardTitle>
                <CardDescription>
                  Validez après vérification de la cession hors-système
                  {!chargement && attestations.length > 0 && ` · ${attestations.length} en attente`}
                </CardDescription>
              </div>
            </CardHeader>
            {attestations.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                tone="positive"
                title="Rien en attente"
                description="Aucune attestation de cession n'attend votre validation."
              />
            ) : (
              // Sur une juridiction qui porte tous les lotissements, la file
              // dépasse les 400 entrées : sans hauteur bornée la page s'étirait
              // sur plus de 40 000 px et la section APFC, juste dessous,
              // devenait inatteignable.
              <ScrollArea className="max-h-[520px] border-t border-border">
              <ul className="divide-y divide-border">
                {attestations.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-foreground">{a.reference}</p>
                      <p className="mt-0.5 text-xs text-muted-2">
                        Lot {a.lot?.numero_lot ?? "—"}
                        {a.lot?.ilots?.lotissements?.nom ? ` — ${a.lot.ilots.lotissements.nom}` : ""}
                      </p>
                      <SignaturesBadges
                        sigs={[
                          {
                            // Même règle que le Coffre-fort documentaire :
                            // chef de famille si le lotissement en a une,
                            // propriétaire terrien s'il en couvre plusieurs.
                            label: libelleSignature("proprietaire", Boolean(a.lot?.ilots?.lotissements?.famille_id)),
                            done: !!a.sig_proprietaire_le,
                          },
                          { label: "Opérateur", done: !!a.sig_operateur_le },
                        ]}
                      />
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={signing === a.id}
                      onClick={() => signerAttestation(a.id)}
                    >
                      <FileSignature />
                      Valider
                    </Button>
                  </li>
                ))}
              </ul>
              </ScrollArea>
            )}
          </Card>
        </motion.div>

        {/* APFC à co-signer */}
        <motion.div variants={fadeUp}>
          <Card id="apfc" className="scroll-mt-6 overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>APFC — Attestations de Propriété Foncière Coutumière</CardTitle>
                <CardDescription>Documents entérinés par la Chefferie du village</CardDescription>
              </div>
            </CardHeader>
            {apfc.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="Aucune APFC"
                description="Aucune attestation de propriété foncière coutumière sur votre territoire."
              />
            ) : (
              <ScrollArea className="max-h-[520px] border-t border-border">
              <ul className="divide-y divide-border">
                {apfc.map((a) => {
                  const sig1 = !!a.sig_chef_famille_le;
                  const sig2 = !!a.sig_chef_village_le;
                  const sig3 = !!a.sig_cvgfr_le;
                  const pct = [sig1, sig2, sig3].filter(Boolean).length;
                  return (
                    <li key={a.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold text-foreground">{a.numero ?? a.reference ?? "APFC"}</p>
                        <p className="mt-0.5 text-xs text-muted-2">Chef de famille : {a.chef_de_famille ?? "—"}</p>
                        <SignaturesBadges
                          sigs={[
                            { label: "Chef de famille", done: sig1 },
                            { label: "Chefferie village", done: sig2 },
                            { label: "CVGFR", done: sig3 },
                          ]}
                        />
                        <ProgressBar value={pct} max={3} />
                      </div>
                      {sig2 ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-success/25 bg-success-subtle px-3 py-2 text-xs font-semibold text-success">
                          <CheckCircle2 className="size-3.5" aria-hidden /> Validé
                        </span>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          loading={signingApfc === a.id}
                          onClick={() => signerApfc(a.id)}
                        >
                          <FileSignature />
                          Valider
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
              </ScrollArea>
            )}
          </Card>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
