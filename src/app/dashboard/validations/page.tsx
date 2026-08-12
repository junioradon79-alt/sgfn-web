"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, FileSignature, MinusCircle, ScrollText, ShieldAlert } from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Button } from "@/components/ds/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ds/card";
import { CountBadge } from "@/components/ds/badge";
import { EmptyState } from "@/components/ds/empty-state";
import { ScrollArea } from "@/components/ds/scroll-area";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { useProfile } from "@/hooks/useProfile";
import { fadeUp, stagger } from "@/lib/motion";
import {
  apfcAttendSignature,
  cessionAttendSignature,
  etatSignaturesApfc,
  etatSignaturesCession,
} from "@/lib/signatures-attestation";
import { fetchAllPages, messageLecture, type ReponsePostgrest } from "@/lib/supabase-pagination";
import type { AttestationCoutumiere } from "@/components/dashboard/chefferie/types";
import { SignaturesBadges, ProgressBar } from "@/components/dashboard/chefferie/SharedUI";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * `signatures_requises` commande les pastilles ET le bouton : sans elle, cet
 * écran réclamait une signature d'opérateur sur un lotissement qui n'en veut
 * pas. `famille_id` commande le titre du signataire `proprietaire` (chef de
 * famille / propriétaire terrien). Cf. `etatSignaturesCession`.
 */
type LotissementSignatures = {
  id: string;
  nom: string | null;
  famille_id?: string | null;
  signatures_requises?: string[] | null;
};

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
      lotissements?: LotissementSignatures | null;
    } | null;
  } | null;
};

/**
 * Attestation d'Attribution de Lot (Niveau 2/3, 23/07/2026) — la signature
 * Chefferie est conditionnée au paiement de signature (500 000 FCFA chefferie
 * + 50 000 FCFA commission SGNF, `signature_payee_le`) : le bouton "Valider"
 * reste désactivé et l'explique tant qu'il n'est pas confirmé.
 */
type AttestationAttributionLot = {
  id: string;
  reference: string;
  statut: string;
  niveau: number;
  sig_chefferie_le: string | null;
  sig_proprietaire_le: string | null;
  sig_operateur_le: string | null;
  signature_payee_le: string | null;
  lot: {
    numero_lot: string | null;
    ilots?: {
      numero: string | null;
      lotissements?: LotissementSignatures | null;
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
  const [attributionsLot, setAttributionsLot] = useState<AttestationAttributionLot[]>([]);
  const [apfc, setApfc] = useState<AttestationCoutumiere[]>([]);
  const [signing, setSigning] = useState<string | null>(null);
  const [signingAttrib, setSigningAttrib] = useState<string | null>(null);
  const [signingApfc, setSigningApfc] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  /**
   * 🔴 UN REFUS QUI SE LISAIT « RIEN EN ATTENTE ». Les trois lectures
   * jetaient leur `error` : un `42501` rendait une liste vide, et l'écran
   * affichait alors, en vert, « Aucune attestation de cession n'attend votre
   * validation ». Un droit manquant et une file réellement soldée disaient
   * exactement la même chose — c'est la dette #45. Une erreur par file : elles
   * ne réussissent pas ni n'échouent ensemble.
   */
  const [erreurs, setErreurs] = useState<{
    cessions: string | null;
    attributions: string | null;
    apfc: string | null;
  }>({ cessions: null, attributions: null, apfc: null });

  const autoriteId = profile?.autorite_coutumiere_id ?? null;

  // Cessions scopées au territoire par la RLS (attcess_chefferie_read) ; APFC
  // filtrées sur la juridiction (apfc_read scopée aussi, filtre explicite en plus).
  //
  // ⚠️ Les TROIS lectures sont paginées. PostgREST plafonne chaque réponse à
  // 1000 lignes et tronque SILENCIEUSEMENT au-delà (cf. `supabase-pagination`) :
  // une juridiction qui porterait tous les lotissements dépasse déjà 400
  // cessions en attente, et la RLS borne le périmètre, pas le nombre de lignes.
  // `.order("id")` fournit l'ordre déterministe qu'exige `fetchAllPages` —
  // sans lui, deux pages peuvent se chevaucher ou sauter des lignes.
  const fetchData = useCallback(async () => {
    if (!autoriteId) return;
    const [attestationsRows, attribRows, apfcRows] = await Promise.all([
      fetchAllPages<AttestationCession>((de, a) =>
        supabase
          .from("attestations_cession")
          // `signatures_requises` MANQUAIT : les pastilles étaient écrites en
          // dur et réclamaient l'opérateur partout. Cf. `etatSignaturesCession`.
          .select(
            "id, reference, statut, sig_chefferie_le, sig_proprietaire_le, sig_operateur_le, date_emission, lot:lot_id(numero_lot, ilots(numero, lotissements(id, nom, famille_id, signatures_requises)))"
          )
          .is("sig_chefferie_le", null)
          // Une cession révoquée ne peut plus être signée : elle n'a plus rien
          // à faire dans une file « à valider » — elle reste consultable dans
          // son historique sur /dashboard/documents.
          .neq("statut", "revoquee")
          .order("id", { ascending: true })
          .range(de, a) as unknown as PromiseLike<ReponsePostgrest<AttestationCession>>
      ),
      fetchAllPages<AttestationAttributionLot>((de, a) =>
        supabase
          .from("attestations_attribution_lot")
          .select(
            "id, reference, statut, niveau, sig_chefferie_le, sig_proprietaire_le, sig_operateur_le, signature_payee_le, lot:lot_id(numero_lot, ilots(numero, lotissements(id, nom, famille_id, signatures_requises)))"
          )
          .is("sig_chefferie_le", null)
          // Même garde que sur les cessions ci-dessus : une AAL révoquée ne
          // peut plus être signée, elle sort de cette file.
          .neq("statut", "revoquee")
          .order("id", { ascending: true })
          .range(de, a) as unknown as PromiseLike<ReponsePostgrest<AttestationAttributionLot>>
      ),
      fetchAllPages<AttestationCoutumiere>((de, a) =>
        supabase
          .from("attestations_coutumieres")
          // `cvgfr_id` + `signatures_requises` du lotissement : c'est de là que
          // vient le NOMBRE de signatures attendues. `lotissements` est en
          // lecture publique (`lotissements_public_read`, qual=true), l'embed ne
          // restreint donc pas la liste des APFC visibles.
          .select(
            "id, reference, numero, statut, date_delivrance, sig_chef_famille_le, sig_chef_village_le, sig_cvgfr_le, cvgfr_id, chef_de_famille, lotissement:lotissement_id(signatures_requises)"
          )
          .eq("autorite_coutumiere_id", autoriteId)
          .order("id", { ascending: true })
          .range(de, a) as unknown as PromiseLike<ReponsePostgrest<AttestationCoutumiere>>
      ),
    ]);
    // Les lignes déjà lues sont conservées même en cas d'échec : `fetchAllPages`
    // peut rendre une première page valide et échouer sur la suivante. Ce qui
    // change, c'est qu'on ne présente plus ce résultat comme complet.
    setAttestations(attestationsRows.rows);
    setAttributionsLot(attribRows.rows);
    setApfc(apfcRows.rows);
    setErreurs({
      cessions: attestationsRows.error
        ? messageLecture("les attestations de cession", attestationsRows.error)
        : null,
      attributions: attribRows.error
        ? messageLecture("les attestations d'attribution de lot", attribRows.error)
        : null,
      apfc: apfcRows.error ? messageLecture("les APFC de votre juridiction", apfcRows.error) : null,
    });
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

  /**
   * Signature de l'Attestation d'Attribution de Lot — conditionnée au paiement
   * de signature (500 000 FCFA chefferie + 50 000 FCFA commission SGNF) :
   * `signer_attestation_attribution_lot` refuse explicitement tant que
   * `signature_payee_le` n'est pas confirmé (cf. migration du 23/07).
   */
  const signerAttributionLot = async (id: string) => {
    setSigningAttrib(id);
    setSignError(null);
    const { error } = await supabase.rpc("signer_attestation_attribution_lot", {
      p_id: id,
      p_signature: "chefferie",
    });
    if (error) setSignError(`Signature non enregistrée : ${error.message}`);
    setSigningAttrib(null);
    void recharger();
  };

  /**
   * 🔴 Passe par `signer_apfc` et non par un `update` direct — même correction
   * que `signerAttestation` ci-dessus, qui n'avait jamais été reportée ici
   * alors que les deux boutons vivent sur le même écran.
   *
   * L'ancienne version était **inopérante depuis toujours** :
   * `attestations_coutumieres` ne porte que `apfc_admin_all` (ALL, admin) et
   * `apfc_read` (SELECT). Une chefferie n'a donc aucune policy d'écriture, et
   * sous RLS un update sans policy **ne lève aucune erreur** — il touche zéro
   * ligne. Prouvé en production le 28/07 sous la session réelle de la chefferie
   * rattachée : « apfc lisibles=1, update a touché 0 ligne(s), erreur=NON ».
   * Le chef de village croyait signer depuis des semaines.
   */
  const signerApfc = async (id: string) => {
    setSigningApfc(id);
    setSignError(null);
    const { error } = await supabase.rpc("signer_apfc", {
      p_id: id,
      p_signature: "chef_village",
    });
    if (error) setSignError(`Signature non enregistrée : ${error.message}`);
    setSigningApfc(null);
    void recharger();
  };

  const chargement = profileLoading || (isChefferie && isLoading);
  /**
   * Seules les APFC dont le lotissement EXIGE la signature du chef de village
   * et ne l'a pas encore constatée attendent une décision.
   *
   * 🔴 Le filtre était `!a.sig_chef_village_le` : une APFC dont le lotissement
   * ne demande pas la chefferie serait restée éternellement dans la file, carte
   * en brique et pastille rouge, pour un geste qui n'avait pas lieu d'être.
   */
  const apfcACosigner = apfc.filter((a) => apfcAttendSignature(a, "sig_chef_village_le")).length;
  /**
   * Le lotissement d'une cession, tel que `etatSignaturesCession` l'attend.
   * L'embed descend par `lot → ilots → lotissements` : un maillon absent (lot
   * supprimé, embed refusé) rend `undefined`, et le module retombe alors sur
   * `SIGNATURES_PAR_DEFAUT` — le jeu à trois, le plus exigeant. Un repli qui
   * demande TROP est visible à l'écran ; un repli qui demande trop peu ferait
   * délivrer un document non signé.
   */
  const lotissementDe = (a: AttestationCession | AttestationAttributionLot) =>
    a.lot?.ilots?.lotissements;
  /**
   * 🔴 Même correction que sur les APFC, deux cartes plus bas — et c'est ici
   * qu'elle manquait vraiment : les 50 cessions en attente portent toutes
   * `sig_chefferie_le is null`, mais leur lotissement (Koelea-Accor revu) exige
   * {proprietaire, chefferie}. Une cession dont le lotissement ne demande PAS
   * la chefferie ne l'attend pas : la compter teindrait la carte en brique pour
   * un geste sans objet.
   *
   * 🔴 Une cession `revoquee` ne peut plus être signée —
   * `signer_attestation` lève une exception explicite. Sans ce filtre, une
   * cession révoquée resterait comptée ici (pastille rouge permanente) alors
   * que le bouton « Valider » qu'elle affiche échouerait à chaque tentative.
   * Même garde que sur `attributionsSignables` ci-dessous.
   */
  const cessionsAValider = attestations.filter(
    (a) =>
      a.statut !== "revoquee" &&
      cessionAttendSignature(a, lotissementDe(a), "chefferie"),
  ).length;
  /**
   * Une attribution dont le paiement n'est pas reçu a son bouton désactivé :
   * elle ne peut PAS être signée aujourd'hui. La compter ferait afficher une
   * carte rouge et un compteur sur des lignes que l'on ne peut qu'attendre —
   * la teinte doit désigner ce sur quoi on peut agir, pas ce qui existe.
   *
   * S'y ajoute, depuis le 29/07, la même condition que sur les cessions : le
   * lotissement doit exiger la signature de la chefferie.
   *
   * 🔴 Une AAL `revoquee` ne peut plus être signée — `signer_attestation_attribution_lot`
   * lève une exception explicite. Sans ce filtre, une attribution payée puis
   * révoquée resterait comptée ici (pastille rouge permanente) alors que le
   * bouton « Valider » qu'elle affiche échouerait à chaque tentative.
   */
  const attributionsSignables = attributionsLot.filter(
    (a) =>
      a.statut !== "revoquee" &&
      a.signature_payee_le &&
      cessionAttendSignature(a, lotissementDe(a), "chefferie"),
  ).length;

  /**
   * 🔴 Sur un chargement direct de l'URL (F5, favori, lien partagé depuis
   * `/dashboard/chefferie#apfc`), le HTML statique exporté ne porte aucun des
   * trois `id` ci-dessous : ils n'existent qu'une fois les données chargées et
   * les cartes effectivement rendues. Le saut natif du navigateur vers le
   * fragment se joue donc AVANT que la cible n'existe et ne fait rien. On le
   * rejoue nous-mêmes une fois `chargement` retombé à `false` — et ça aide
   * AUSSI la navigation interne (`next/link`) : au premier rendu les 3 listes
   * sont vides, donc `#apfc` (la carte la plus basse) atterrit au milieu de
   * la page ; une fois les données là, la page s'allonge et il faut refaire
   * le saut. `deja` empêche seulement de rejouer ce saut à chaque
   * `recharger()` ultérieur (signature, bouton Actualiser) : sans lui, un chef
   * qui a défilé ailleurs se ferait ramener de force vers l'ancre en boucle.
   */
  const ancreDejaJouee = useRef(false);
  useEffect(() => {
    if (chargement || ancreDejaJouee.current) return;
    ancreDejaJouee.current = true;
    const hash = window.location.hash.slice(1);
    if (hash !== "apfc" && hash !== "cessions" && hash !== "attributions") return;
    document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [chargement]);

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
          <Card
            id="cessions"
            tone={!chargement && cessionsAValider > 0 ? "alert" : "default"}
            className="scroll-mt-24 overflow-hidden"
          >
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Attestations de cession — en attente de votre validation</CardTitle>
                <CardDescription>Validez après vérification de la cession hors-système</CardDescription>
              </div>
              {/* Le compte vivait en queue de description (« · 4 en attente ») :
                  noyé dans une phrase, il ne se lisait pas. Il devient une
                  pastille — même convention que le Centre de pilotage.
                  Il compte les cessions que ce lotissement vous demande de
                  signer, pas toutes celles dont la colonne est vide. */}
              {!chargement && cessionsAValider > 0 && (
                <CardAction>
                  <CountBadge tone="inverse" value={cessionsAValider} />
                </CardAction>
              )}
            </CardHeader>
            {/* Le motif du refus, sur la carte concernée : un bandeau global
                ne dirait pas LAQUELLE des trois files n'a pas pu être lue. */}
            {erreurs.cessions && (
              <p role="alert" className="mx-5 mb-4 rounded-xl border border-danger/25 bg-danger-subtle px-4 py-3 text-sm font-medium text-danger">
                {erreurs.cessions}
              </p>
            )}
            {attestations.length === 0 ? (
              // Rien lu ET lecture en échec : surtout pas le « Rien en attente »
              // vert, qui annoncerait une file soldée là où l'on n'a rien pu
              // lire. Le bandeau ci-dessus dit seul ce qui s'est passé.
              erreurs.cessions ? null : (
                <EmptyState
                  icon={CheckCircle2}
                  tone="positive"
                  title="Rien en attente"
                  description="Aucune attestation de cession n'attend votre validation."
                />
              )
            ) : (
              // Sur une juridiction qui porte tous les lotissements, la file
              // dépasse les 400 entrées : sans hauteur bornée la page s'étirait
              // sur plus de 40 000 px et la section APFC, juste dessous,
              // devenait inatteignable.
              <ScrollArea className="max-h-[520px] border-t border-border">
              <ul className="divide-y divide-border">
                {attestations.map((a) => {
                  // 🔴 Les pastilles étaient DEUX libellés en dur — « …terrien »
                  // et « Opérateur » — sans lecture de `signatures_requises`.
                  // Sur Koelea-Accor revu, qui n'exige pas l'opérateur, les 50
                  // lignes réclamaient donc en orange une signature que
                  // personne n'attend et que la remise n'exigera jamais.
                  const etat = etatSignaturesCession(a, lotissementDe(a));
                  const chefferieAttendue = etat.lignes.some(
                    (l) => l.cle === "chefferie" && l.requise && !l.signee
                  );
                  return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-foreground">{a.reference}</p>
                      <p className="mt-0.5 text-xs text-muted-2">
                        Lot {a.lot?.numero_lot ?? "—"}
                        {a.lot?.ilots?.lotissements?.nom ? ` — ${a.lot.ilots.lotissements.nom}` : ""}
                      </p>
                      <SignaturesBadges
                        sigs={etat.lignes.map((l) => ({
                          label: l.label,
                          done: l.signee,
                          requise: l.requise,
                        }))}
                      />
                    </div>
                    {chefferieAttendue ? (
                      <Button
                        variant="primary"
                        size="sm"
                        loading={signing === a.id}
                        onClick={() => signerAttestation(a.id)}
                      >
                        <FileSignature />
                        Valider
                      </Button>
                    ) : (
                      // Ni exigée ni constatée : ce lotissement ne demande pas
                      // la signature du chef de village. Même traitement que sur
                      // les APFC — on le DIT, plutôt que de laisser une ligne
                      // muette qui se lirait comme un bouton disparu.
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-semibold text-muted-2">
                        <MinusCircle className="size-3.5" aria-hidden /> Non requise
                      </span>
                    )}
                  </li>
                  );
                })}
              </ul>
              </ScrollArea>
            )}
          </Card>
        </motion.div>

        {/* Attestations d'Attribution de Lot — signature du chef de village payante */}
        <motion.div variants={fadeUp}>
          <Card
            id="attributions"
            tone={!chargement && attributionsSignables > 0 ? "alert" : "default"}
            className="scroll-mt-24 overflow-hidden"
          >
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Attestations d&apos;Attribution de Lot — en attente de votre signature</CardTitle>
                <CardDescription>
                  Signature conditionnée au paiement (500 000 FCFA chefferie + 50 000 FCFA commission SGNF)
                </CardDescription>
              </div>
              {!chargement && attributionsSignables > 0 && (
                <CardAction>
                  <CountBadge tone="inverse" value={attributionsSignables} />
                </CardAction>
              )}
            </CardHeader>
            {erreurs.attributions && (
              <p role="alert" className="mx-5 mb-4 rounded-xl border border-danger/25 bg-danger-subtle px-4 py-3 text-sm font-medium text-danger">
                {erreurs.attributions}
              </p>
            )}
            {attributionsLot.length === 0 ? (
              erreurs.attributions ? null : (
                <EmptyState
                  icon={CheckCircle2}
                  tone="positive"
                  title="Rien en attente"
                  description="Aucune Attestation d'Attribution de Lot n'attend votre signature."
                />
              )
            ) : (
              <ScrollArea className="max-h-[520px] border-t border-border">
              <ul className="divide-y divide-border">
                {attributionsLot.map((a) => {
                  const paye = !!a.signature_payee_le;
                  // Même table de signatures que les cessions, même règle : le
                  // jeu exigé vient du lotissement. (Zéro ligne en production au
                  // 29/07/2026 — le défaut était donc invisible, pas absent.)
                  const etat = etatSignaturesCession(a, lotissementDe(a));
                  const chefferieAttendue = etat.lignes.some(
                    (l) => l.cle === "chefferie" && l.requise && !l.signee
                  );
                  return (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold text-foreground">{a.reference}</p>
                        <p className="mt-0.5 text-xs text-muted-2">
                          Lot {a.lot?.numero_lot ?? "—"}
                          {a.lot?.ilots?.lotissements?.nom ? ` — ${a.lot.ilots.lotissements.nom}` : ""}
                          {" · Niveau "}{a.niveau}
                        </p>
                        <SignaturesBadges
                          sigs={etat.lignes.map((l) => ({
                            label: l.label,
                            done: l.signee,
                            requise: l.requise,
                          }))}
                        />
                        {/* Le motif doit être VISIBLE, pas seulement porté par
                            le `title` ci-dessous : `disabled:pointer-events-none`
                            (cf. `src/components/ds/button.tsx`) empêche tout
                            survol d'un bouton désactivé, donc son `title` ne
                            s'affiche jamais. */}
                        <p className={`mt-1.5 text-xs font-semibold ${paye ? "text-success" : "text-warning"}`}>
                          {paye
                            ? "Paiement de signature reçu"
                            : "Paiement de signature en attente (guichet SGNF)"}
                        </p>
                      </div>
                      {chefferieAttendue ? (
                        <Button
                          variant="primary"
                          size="sm"
                          loading={signingAttrib === a.id}
                          disabled={!paye}
                          title={
                            !paye
                              ? "La signature reste bloquée tant que le paiement de 550 000 FCFA n'est pas confirmé."
                              : undefined
                          }
                          onClick={() => signerAttributionLot(a.id)}
                        >
                          <FileSignature />
                          Valider
                        </Button>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-semibold text-muted-2">
                          <MinusCircle className="size-3.5" aria-hidden /> Non requise
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              </ScrollArea>
            )}
          </Card>
        </motion.div>

        {/* APFC à co-signer */}
        <motion.div variants={fadeUp}>
          {/* ⚠️ Contrairement aux deux files ci-dessus, la requête APFC ne filtre
              pas sur la signature manquante : la liste contient aussi les
              documents déjà validés. Le compteur doit donc être dérivé, sinon
              la carte resterait brique alors que plus rien n'attend. */}
          <Card
            id="apfc"
            tone={!chargement && apfcACosigner > 0 ? "alert" : "default"}
            className="scroll-mt-24 overflow-hidden"
          >
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>APFC — Attestations de Propriété Foncière Coutumière</CardTitle>
                {/* « la Chefferie » désignait ici une PERSONNE qui entérine —
                    et ne disait pas laquelle des deux autorités. C'est le chef
                    de village, jamais le chef de famille (qui signe, lui, le
                    créneau du dessus). */}
                <CardDescription>Documents entérinés par le chef de village</CardDescription>
              </div>
              {!chargement && apfcACosigner > 0 && (
                <CardAction>
                  <CountBadge tone="inverse" value={apfcACosigner} />
                </CardAction>
              )}
            </CardHeader>
            {erreurs.apfc && (
              <p role="alert" className="mx-5 mb-4 rounded-xl border border-danger/25 bg-danger-subtle px-4 py-3 text-sm font-medium text-danger">
                {erreurs.apfc}
              </p>
            )}
            {apfc.length === 0 ? (
              erreurs.apfc ? null : (
                <EmptyState
                  icon={ScrollText}
                  title="Aucune APFC"
                  description="Aucune attestation de propriété foncière coutumière sur votre territoire."
                />
              )
            ) : (
              <ScrollArea className="max-h-[520px] border-t border-border">
              <ul className="divide-y divide-border">
                {apfc.map((a) => {
                  // 🔴 Les trois signatures étaient codées EN DUR (`max={3}`).
                  // L'APFC de Koelea-Accor, dont le lotissement n'en exige que
                  // deux et qui ne désigne aucun CVGFR, affichait « 2/3 » et
                  // n'aurait JAMAIS pu être complète. La vérité vient
                  // maintenant de `lotissements.signatures_requises` et de
                  // `cvgfr_id` (cf. `src/lib/signatures-attestation.ts`).
                  const etat = etatSignaturesApfc(a);
                  const chefferieAttendue = etat.lignes.some(
                    (l) => l.colonne === "sig_chef_village_le" && l.requise && !l.signee
                  );
                  const chefferieSignee = !!a.sig_chef_village_le;
                  return (
                    <li key={a.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold text-foreground">{a.numero ?? a.reference ?? "APFC"}</p>
                        <p className="mt-0.5 text-xs text-muted-2">Chef de famille : {a.chef_de_famille ?? "—"}</p>
                        <SignaturesBadges
                          sigs={etat.lignes.map((l) => ({
                            label: l.label,
                            done: l.signee,
                            requise: l.requise,
                          }))}
                        />
                        <ProgressBar value={etat.signees} max={etat.total} />
                      </div>
                      {chefferieAttendue ? (
                        <Button
                          variant="primary"
                          size="sm"
                          loading={signingApfc === a.id}
                          onClick={() => signerApfc(a.id)}
                        >
                          <FileSignature />
                          Valider
                        </Button>
                      ) : chefferieSignee ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-success/25 bg-success-subtle px-3 py-2 text-xs font-semibold text-success">
                          <CheckCircle2 className="size-3.5" aria-hidden /> Validé
                        </span>
                      ) : (
                        // Ni attendue ni constatée : ce lotissement n'exige pas
                        // la chefferie. On le dit, plutôt que de laisser une
                        // ligne muette qui ressemblerait à un bouton disparu.
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-semibold text-muted-2">
                          <MinusCircle className="size-3.5" aria-hidden /> Non requise
                        </span>
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
