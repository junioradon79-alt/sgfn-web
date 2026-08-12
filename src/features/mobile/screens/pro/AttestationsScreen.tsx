"use client";

// Les attestations DE CESSION, depuis le terrain.
//
// Ce que cet écran sert, précisément : 48 attestations de cession attendent
// aujourd'hui en production une signature qui se constate sur papier, devant
// la parcelle ou dans la cour de la chefferie — pas devant un ordinateur (une
// 49e porte déjà ses deux signatures et n'attend que sa remise). La chefferie
// qui les voit toutes (`attcess_chefferie_read`, scopée à sa juridiction)
// n'avait jusqu'ici aucun écran pour le dire.
//
// ⚠️ PÉRIMÈTRE — cet écran ne lit que `attestations_cession`. Les Attestations
// d'Attribution de Lot (`attestations_attribution_lot`, Niveau 2/3) en sont
// absentes, et il faut le dire : leur GÉNÉRATION est exclue par arbitrage
// (créance de 380 000 FCFA, cf. `GenerationAttestationScreen`), mais leur
// CONSTAT de signature est autorisé par le serveur avec exactement la même
// garde de rôle que `signer_attestation`. La table compte 0 ligne en
// production, si bien que l'écart ne se voit pas encore — la première
// attestation N2 générée depuis le web sera invisible ici. C'est un
// rétrécissement assumé, pas un oubli.
//
// 🔴 Trois règles qui ne se devinent pas et que l'écran doit respecter :
//
//   • Les signatures sont **constatées**, pas électroniques : le document est
//     signé sur papier, l'app enregistre qu'elles y figurent et qui l'a
//     constaté. D'où le vocabulaire — « constater », jamais « signer ».
//   • Le nombre de signatures requises vient du **lotissement** et varie
//     réellement : deux sur Koelea-Accor revu, trois sur Brignan Kakodji. Les
//     trois pastilles restent affichées — c'est l'état du document — mais
//     seules les requises comptent pour la remise, exactement comme
//     `marquer_attestation_delivree` en décide.
//   • Une attestation révoquée n'est plus signable (`estSignable`) : le
//     serveur le refuse, et deux lignes sont dans ce cas en production.
//
// L'écran est une **vue pure** : la file lui est passée. C'est la coquille qui
// détient le hook (elle en tire aussi la pastille de l'onglet), et c'est ce qui
// rend l'écran montable dans `/apercu-mobile` avec une file simulée.

import { useCallback, useState } from "react";
import {
  CheckCircle2,
  FileCheck2,
  Loader2,
  PenLine,
  ShieldAlert,
  Stamp,
  TriangleAlert,
} from "lucide-react";

import { useBackHandler } from "@/lib/android-back";
import { Badge } from "@/components/ds/badge";
import {
  estSignable,
  libelleSignature,
  remisePossible,
  signaturesActionnables,
  signaturesManquantes,
  TOUTES_SIGNATURES,
  type AttestationMobile,
  type FileAttestations,
  type Signature,
  type StatutAttestation,
} from "../../data/useAttestations";
import type { ActionsAttestation, RattachementManquant } from "../../roles";

/** Libellés et tons repris du Coffre-fort documentaire (`dashboard/documents`). */
const STATUT: Record<StatutAttestation, { label: string; tone: "warning" | "accent" | "success" | "danger" }> = {
  a_generer: { label: "À générer", tone: "warning" },
  generee: { label: "Générée", tone: "accent" },
  delivree: { label: "Délivrée", tone: "success" },
  revoquee: { label: "Révoquée", tone: "danger" },
};

type Filtre = "signer" | "remettre" | "toutes";

/** Acte engageant en cours de confirmation sur une carte. */
type Acte = { kind: "constater"; signature: Signature } | { kind: "remise" };

function dateCourte(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export function AttestationsScreen({
  file,
  actions,
  header,
  /**
   * Compte non rattaché : la policy ne renvoie AUCUNE ligne, et la RPC
   * refuserait de toute façon. Une liste vide sans explication se lirait
   * « rien à signer », c'est-à-dire l'inverse de la vérité. Vaut pour la
   * chefferie (`ma_chefferie_id()`) comme pour l'opérateur
   * (`mon_operateur_id()`) — cf. `rattachementManquant`.
   */
  blocage = null,
  onOuvrirGeneration,
}: {
  file: FileAttestations;
  actions: ActionsAttestation;
  /** En-tête fourni par la coquille : bandeau d'onglet, ou barre de calque. */
  header: React.ReactNode;
  blocage?: RattachementManquant;
  /** Génération par dérogation — réservée à l'admin (`generation`). */
  onOuvrirGeneration?: () => void;
}) {
  const { attestations, loading, erreur, aSigner, aRemettre, recharger, constater, remettre } = file;

  const [filtre, setFiltre] = useState<Filtre>("signer");
  // Une seule confirmation ouverte à la fois : deux panneaux dépliés sur un
  // écran de téléphone, et l'on ne sait plus lequel on confirme.
  const [confirmation, setConfirmation] = useState<{ id: string; acte: Acte } | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; texte: string } | null>(null);

  // Le geste de retour referme d'abord la confirmation : sinon un réflexe de
  // sortie ferait constater — ou manquer — un acte qu'on s'apprêtait à relire.
  useBackHandler(
    useCallback(() => {
      if (confirmation) {
        setConfirmation(null);
        return true;
      }
      return false;
    }, [confirmation]),
  );

  const confirmer = async () => {
    if (!confirmation || enCours) return;
    const { id, acte } = confirmation;
    setEnCours(id);
    const res =
      acte.kind === "constater" ? await constater(id, acte.signature) : await remettre(id);
    setEnCours(null);
    if (!res.ok) {
      // Le message du serveur est conservé tel quel : « Signature(s)
      // manquante(s) avant remise : chefferie » ou « Ce lotissement ne releve
      // pas de votre juridiction » disent précisément quoi faire — un « Échec »
      // générique obligerait à deviner.
      setFlash({
        ok: false,
        texte: res.incertain
          ? // Réponse perdue en vol : l'acte a PEUT-ÊTRE abouti. Annoncer
            // « échec » ferait re-constater une signature déjà enregistrée.
            `Envoi interrompu : ${res.error}. L'acte a peut-être été enregistré — rafraîchissez avant de recommencer.`
          : `Refusé : ${res.error}`,
      });
      return;
    }
    setConfirmation(null);
    setFlash({
      ok: true,
      texte:
        acte.kind === "constater"
          ? "Signature constatée."
          : "Remise enregistrée : l'attestation est délivrée.",
    });
  };

  // Les deux premiers filtres montrent ce que CE rôle peut faire, exactement
  // comme les compteurs qui les surmontent. Une chefferie qui a constaté sa
  // signature voit la ligne quitter « À constater », même si le document
  // attend encore le chef de famille : c'est fini pour elle.
  const visibles = attestations.filter((a) => {
    if (filtre === "toutes") return true;
    if (filtre === "signer") return signaturesActionnables(a, actions).length > 0;
    return remisePossible(a, actions);
  });

  const onglets: { cle: Filtre; label: string; n: number }[] = [
    { cle: "signer", label: "À constater", n: aSigner },
    // Sans droit de remise, l'onglet disparaît plutôt que d'afficher un zéro
    // permanent au-dessus de documents sur lesquels le rôle ne peut rien.
    ...(actions.remise
      ? [{ cle: "remettre" as const, label: "À remettre", n: aRemettre }]
      : []),
    { cle: "toutes", label: "Toutes", n: attestations.length },
  ];

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      {header}

      <div className="sgnf-scroll flex-1 overflow-y-auto px-[18px] pt-3 pb-6">
        {blocage ? (
          <div className="rounded-[22px] border border-brick/45 bg-brick-subtle p-4 shadow-panel">
            <div className="flex items-center gap-2 text-[13px] font-bold text-foreground">
              <ShieldAlert className="size-[18px] text-brick" strokeWidth={2} />
              Compte non rattaché
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {blocage === "chefferie" ? (
                <>
                  Votre compte n&apos;est rattaché à aucune chefferie. Les attestations sont
                  bornées à une juridiction : sans rattachement, cette liste reste vide et
                  chaque constat serait refusé par le serveur.
                </>
              ) : (
                <>
                  Votre compte n&apos;est rattaché à aucun opérateur. Les attestations sont
                  bornées au périmètre aménagé : sans rattachement, cette liste reste vide
                  et chaque constat serait refusé par le serveur.
                </>
              )}
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              Contactez l&apos;administration du SGNF pour faire rattacher votre compte à{" "}
              {blocage === "chefferie" ? "votre autorité coutumière" : "votre opérateur"}.
            </p>
          </div>
        ) : (
          <>
            {flash && (
              <div
                role="alert"
                className={`mb-3 flex items-start gap-2 rounded-2xl px-3.5 py-3 text-[12.5px] font-medium ${
                  flash.ok ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"
                }`}
              >
                {flash.ok ? (
                  <CheckCircle2 className="mt-px size-4 flex-none" />
                ) : (
                  <TriangleAlert className="mt-px size-4 flex-none" />
                )}
                <span className="min-w-0">{flash.texte}</span>
              </div>
            )}

            {/* Générer par dérogation — au-dessus de la file, car c'est le geste
                qui ALIMENTE cette file. Réservé à l'admin : la garde de
                `generer_attestation_exceptionnelle` est `est_admin()` seul. */}
            {actions.generation && onOuvrirGeneration && (
              <button
                type="button"
                onClick={onOuvrirGeneration}
                className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-panel"
              >
                <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-inset text-primary">
                  <PenLine className="size-5" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-foreground">
                    Générer par dérogation
                  </span>
                  <span className="block text-[11.5px] text-muted-foreground">
                    Pour un lot dont le dossier documentaire est incomplet
                  </span>
                </span>
              </button>
            )}

            <div className="mb-3 flex gap-1.5">
              {onglets.map((o) => (
                <button
                  key={o.cle}
                  type="button"
                  onClick={() => setFiltre(o.cle)}
                  className={`flex-1 rounded-full px-2 py-2 text-[12px] font-semibold transition-colors ${
                    filtre === o.cle
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-foreground"
                  }`}
                >
                  {o.label} <span className="tabular opacity-80">{o.n}</span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Chargement des attestations…
              </div>
            ) : erreur && attestations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                <TriangleAlert className="size-7 text-danger" />
                <div className="text-[14px] font-semibold text-foreground">Liste illisible</div>
                <div className="text-[12px] text-muted-foreground">{erreur}</div>
                <button
                  type="button"
                  onClick={() => void recharger()}
                  className="mt-2 rounded-full border border-border px-4 py-2 text-[13px] font-semibold text-foreground"
                >
                  Réessayer
                </button>
              </div>
            ) : visibles.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                <FileCheck2 className="size-7 text-muted-2" />
                <div className="text-[14px] font-semibold text-foreground">
                  {filtre === "signer"
                    ? "Aucune signature à constater"
                    : filtre === "remettre"
                      ? "Aucune remise en attente"
                      : "Aucune attestation"}
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {filtre === "toutes"
                    ? "Aucune attestation n'est visible depuis ce compte."
                    : "Les autres onglets peuvent en contenir."}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Un rechargement raté APRÈS un premier succès ne doit pas
                    coûter la liste : on la garde, et on signale que ce qui
                    s'affiche est le dernier état connu. */}
                {erreur && (
                  <div className="flex items-start gap-2 rounded-2xl bg-warning-subtle px-3.5 py-3 text-[12px] text-foreground">
                    <TriangleAlert className="mt-px size-4 flex-none text-warning" />
                    <span className="min-w-0">
                      Liste peut-être dépassée — le rechargement a échoué ({erreur}).
                    </span>
                  </div>
                )}
                {visibles.map((a) => (
                  <CarteAttestation
                    key={a.id}
                    attestation={a}
                    actions={actions}
                    acte={confirmation?.id === a.id ? confirmation.acte : null}
                    busy={enCours === a.id}
                    // Un envoi en vol ailleurs fige les autres cartes : en
                    // lancer un second rendrait le message de retour impossible
                    // à rattacher à l'acte qui l'a produit.
                    gele={enCours !== null && enCours !== a.id}
                    onDemander={(acte) => {
                      setConfirmation({ id: a.id, acte });
                      setFlash(null);
                    }}
                    onAnnuler={() => setConfirmation(null)}
                    onConfirmer={() => void confirmer()}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CarteAttestation({
  attestation: a,
  actions,
  acte,
  busy,
  gele,
  onDemander,
  onAnnuler,
  onConfirmer,
}: {
  attestation: AttestationMobile;
  actions: ActionsAttestation;
  acte: Acte | null;
  busy: boolean;
  gele: boolean;
  onDemander: (acte: Acte) => void;
  onAnnuler: () => void;
  onConfirmer: () => void;
}) {
  const manquantes = signaturesManquantes(a);
  const signable = estSignable(a);
  // Intersection des droits du rôle, des signatures requises par le
  // lotissement, et de celles qui manquent. Proposer au-delà enverrait droit
  // dans un refus serveur. Même fonction que celle qui alimente les compteurs
  // — les deux ne peuvent donc pas diverger.
  const constatables = signaturesActionnables(a, actions);
  const peutRemettre = remisePossible(a, actions);

  const statut = STATUT[a.statut];

  return (
    // `data-testid` porté par la CARTE : sans lui, un test qui veut vérifier
    // l'absence de bouton sur une attestation donnée ne sait pas remonter de la
    // référence jusqu'au conteneur, et compte 0 bouton quoi qu'il arrive.
    <div
      data-testid={`attestation-${a.id}`}
      className="rounded-[20px] border border-border bg-card p-4 shadow-panel"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-bold text-foreground">{a.reference}</div>
          <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
            Lot {a.numeroLot ?? "—"} · Îlot {a.ilot ?? "—"} · {a.lotissement ?? "—"}
          </div>
        </div>
        <Badge tone={statut.tone}>{statut.label}</Badge>
      </div>

      <div className="mt-2 text-[12.5px] text-foreground">
        <span className="text-muted-foreground">Titulaire : </span>
        {a.titulaire ?? "—"}
      </div>
      <div className="mt-0.5 text-[11.5px] text-muted-foreground">
        Émise le {dateCourte(a.dateEmission ?? a.creeLe)}
        {a.delivreeLe ? ` · remise le ${dateCourte(a.delivreeLe)}` : ""}
      </div>

      {a.exception && (
        // Une attestation générée par dérogation ne dit pas que le dossier est
        // complet — elle dit qu'on est passé outre. Le taire ferait croire à un
        // dossier en règle.
        <div className="mt-2 rounded-xl bg-warning-subtle px-3 py-2 text-[11.5px] leading-snug text-foreground">
          <span className="font-semibold">Générée par dérogation.</span>
          {a.exceptionMotif ? ` ${a.exceptionMotif}` : ""}
        </div>
      )}

      {/* Les trois signatures sont montrées, y compris celles que ce
          lotissement n'exige pas — en pointillés. Les masquer laisserait
          croire à une norme unique, alors que le jeu requis change d'un
          lotissement à l'autre et décide, seul, de la remise. */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {TOUTES_SIGNATURES.map((sig) => {
          const requise = a.signaturesRequises.includes(sig);
          const date = a.signatures[sig];
          const label = libelleSignature(sig, a.lotissementAUneFamille);
          if (!requise) {
            return (
              <span
                key={sig}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-2.5 py-1 text-[11.5px] font-medium text-muted-2"
                title="Non requise sur ce lotissement"
              >
                {label} · non requise
              </span>
            );
          }
          return (
            <span
              key={sig}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-foreground ${
                date ? "bg-success-subtle" : "bg-inset"
              }`}
            >
              <span
                className={`size-[6px] flex-none rounded-full ${date ? "bg-success" : "bg-muted-2"}`}
              />
              {label}
              {date ? ` · ${dateCourte(date)}` : ""}
            </span>
          );
        })}
      </div>

      {acte === null ? (
        (constatables.length > 0 || peutRemettre) && (
          <div className="mt-3.5 flex flex-wrap gap-2">
            {constatables.map((sig) => (
              <button
                key={sig}
                type="button"
                disabled={gele}
                onClick={() => onDemander({ kind: "constater", signature: sig })}
                className="flex-1 rounded-full border border-border py-2.5 text-[13px] font-semibold text-foreground disabled:opacity-50"
              >
                Constater : {libelleSignature(sig, a.lotissementAUneFamille)}
              </button>
            ))}
            {peutRemettre && (
              <button
                type="button"
                disabled={gele}
                onClick={() => onDemander({ kind: "remise" })}
                className="flex-1 rounded-full bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                Enregistrer la remise
              </button>
            )}
          </div>
        )
      ) : (
        <div className="mt-3.5 rounded-2xl border border-warning/45 bg-warning-subtle p-3">
          <div className="flex items-start gap-2">
            <Stamp className="mt-px size-4 flex-none text-warning" />
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-foreground">
                {acte.kind === "constater"
                  ? `Constater la signature « ${libelleSignature(acte.signature, a.lotissementAUneFamille)} » ?`
                  : "Enregistrer la remise ?"}
              </div>
              <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {acte.kind === "constater" ? (
                  // ⚠️ Ne PAS promettre ici qu'un administrateur pourra
                  // annuler : `annuler_signature_attestation` existe en base
                  // mais n'est offerte par AUCUN écran, ni mobile ni web
                  // (vérifié : zéro occurrence dans `src/`). Annoncer un
                  // recours inexistant ferait constater à la légère.
                  <>
                    Vous attestez que cette signature figure bien sur le document papier.
                    L&apos;acte est horodaté à votre nom et n&apos;est pas annulable depuis
                    l&apos;application.
                  </>
                ) : (
                  <>
                    Vous confirmez que le document a été physiquement remis à son
                    titulaire. L&apos;attestation passera au statut « Délivrée ».
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={onAnnuler}
              disabled={busy}
              className="flex-1 rounded-full border border-border bg-card py-2.5 text-[13.5px] font-semibold text-foreground disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onConfirmer}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-[13.5px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Confirmer
            </button>
          </div>
        </div>
      )}

      {/* Une attestation qui n'attend plus rien de CE rôle doit le dire :
          sinon une carte sans bouton se lit comme une panne. */}
      {acte === null && constatables.length === 0 && !peutRemettre && (
        <div className="mt-3 text-[11.5px] leading-snug text-muted-2">
          {!signable
            ? a.statut === "delivree"
              ? "Document remis — rien à faire."
              : "Attestation révoquée — plus aucune action possible."
            : manquantes.length > 0
              ? `En attente de : ${manquantes
                  .map((sig) => libelleSignature(sig, a.lotissementAUneFamille))
                  .join(", ")}. Hors de votre ressort.`
              : "Signatures complètes — la remise revient à l'administration."}
        </div>
      )}
    </div>
  );
}
