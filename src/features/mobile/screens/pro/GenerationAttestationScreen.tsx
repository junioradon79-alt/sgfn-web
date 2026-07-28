"use client";

// Générer une attestation de cession par dérogation, depuis le terrain.
//
// 🔴 Ce n'est PAS le chemin normal. Une attestation éligible se crée toute
// seule (trigger `trg_creer_attestation_gratuite`) ; cet écran sert le cas
// inverse — le dossier documentaire est incomplet, mais la transaction réelle
// est établie et le titulaire attend son papier. C'est exactement ce qui a
// servi 36 fois sur Koelea-Accor. La garde serveur est `est_admin()` seul.
//
// L'écran ne décide rien : il AFFICHE ce que le serveur répond
// (`lot_peut_emettre_attestation_niveau1`, `manques_documentaires_lot`) et
// laisse l'administrateur assumer la dérogation avec un motif. Recalculer
// l'éligibilité côté client créerait une seconde règle, vouée à diverger de
// celle qui fait autorité.
//
// ⚠️ Le Niveau 2 (Attestation d'Attribution de Lot) est délibérément ABSENT :
// sa génération crée aussitôt une créance de 550 000 FCFA, arbitrée comme
// devant rester au dashboard web.

import { useCallback, useState } from "react";
import { CheckCircle2, FileWarning, Loader2, TriangleAlert } from "lucide-react";

import { useBackHandler, useRetourFormulaire } from "@/lib/android-back";
import type { LotEtat } from "@/lib/saisie";
import type { SaisieRegistre } from "../../data/useSaisieRegistre";
import type { DiagnosticLot, FileAttestations } from "../../data/useAttestations";
import {
  Avertissement,
  BoutonReessayer,
  Carte,
  Chargement,
  ChampRecherche,
  ChoixLotissement,
  EcranSaisie,
  LigneChoix,
  SectionLabel,
} from "../admin/saisie/champs";

/** Minimum imposé par le serveur (`length(btrim(p_motif)) < 10` → refus). */
const MOTIF_MINIMUM = 10;

/**
 * `lotissementId` est porté par les deux étapes qui en dépendent, et non par
 * la seule étape « lot » : revenir du diagnostic doit rendre la recherche
 * exactement là où on l'avait laissée. Une première version le perdait au
 * retour, et la recherche suivante repartait sur un lotissement vide.
 */
type Etape =
  | { nom: "lotissement" }
  | { nom: "lot"; lotissementId: string }
  | { nom: "diagnostic"; lotissementId: string; lot: LotEtat; diagnostic: DiagnosticLot };

export function GenerationAttestationScreen({
  saisie,
  file,
  onBack,
  flash,
}: {
  /** Référentiels et recherche de lots — déjà éprouvés par les écrans de saisie. */
  saisie: SaisieRegistre;
  file: FileAttestations;
  onBack: () => void;
  flash: (msg: string) => void;
}) {
  const [etape, setEtape] = useState<Etape>({ nom: "lotissement" });
  const [recherche, setRecherche] = useState("");
  const [lots, setLots] = useState<LotEtat[] | null>(null);
  const [erreurLots, setErreurLots] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);

  // 🔴 Le motif est du texte tapé au pouce, et remonter d'une étape le PERD
  // (`ouvrirLot` le remet à vide). Le geste de bord se déclenche d'un
  // frôlement : sans ce frein, une dérogation à moitié rédigée disparaît sans
  // un mot. Même grammaire que les quatre écrans de saisie — un premier geste
  // prévient, un second laisse passer.
  useRetourFormulaire(etape.nom === "diagnostic" && motif.trim().length > 0, () =>
    flash("Appuyez à nouveau pour abandonner ce motif"),
  );

  // Puis la navigation d'étape proprement dite : remonter plutôt que refermer,
  // pour ne pas obliger à refaire tout le parcours de sélection.
  useBackHandler(
    useCallback(() => {
      if (etape.nom === "diagnostic") {
        setEtape({ nom: "lot", lotissementId: etape.lotissementId });
        return true;
      }
      if (etape.nom === "lot") {
        setEtape({ nom: "lotissement" });
        return true;
      }
      return false;
    }, [etape]),
  );

  const chercher = useCallback(
    async (lotissementId: string, q: string) => {
      setChargement(true);
      const res = await saisie.chercherLots(lotissementId, q);
      setChargement(false);
      if (!res.ok) {
        setErreurLots(res.error);
        return;
      }
      setErreurLots(null);
      setLots(res.valeur);
    },
    [saisie],
  );

  const ouvrirLot = useCallback(
    async (lotissementId: string, lot: LotEtat) => {
      setChargement(true);
      setEchec(null);
      const res = await file.diagnostiquerLot(lot.lot_id, lot.attributaire_id);
      setChargement(false);
      if (!res.ok) {
        setErreurLots(res.error);
        return;
      }
      setMotif("");
      setEtape({ nom: "diagnostic", lotissementId, lot, diagnostic: res.valeur });
    },
    [file],
  );

  const generer = async () => {
    if (etape.nom !== "diagnostic" || envoi) return;
    setEnvoi(true);
    setEchec(null);
    const res = await file.genererExceptionnelle(etape.lot.lot_id, motif);
    setEnvoi(false);
    if (!res.ok) {
      setEchec(
        res.incertain
          ? `Envoi interrompu : ${res.error}. L'attestation a peut-être été générée — vérifiez la liste avant de recommencer.`
          : res.error,
      );
      return;
    }
    flash(`Attestation ${res.valeur} générée.`);
    onBack();
  };

  // ── Étape 1 : le lotissement ────────────────────────────────────────────────
  if (etape.nom === "lotissement") {
    return (
      <EcranSaisie
        titre="Générer par dérogation"
        sousTitre="Attestation de cession · Niveau 1"
        onBack={onBack}
      >
        <RappelDerogation />
        <SectionLabel>Lotissement</SectionLabel>
        <ChoixLotissement
          lotissements={saisie.lotissements}
          loading={saisie.loading}
          erreur={saisie.erreur}
          recharger={() => void saisie.recharger()}
          onChoisir={(id) => {
            setEtape({ nom: "lot", lotissementId: id });
            setRecherche("");
            setLots(null);
            setErreurLots(null);
            void chercher(id, "");
          }}
        />
      </EcranSaisie>
    );
  }

  // ── Étape 2 : le lot ────────────────────────────────────────────────────────
  if (etape.nom === "lot") {
    return (
      <EcranSaisie
        titre="Choisir le lot"
        sousTitre="Recherche par numéro"
        onBack={() => setEtape({ nom: "lotissement" })}
      >
        <ChampRecherche
          value={recherche}
          onChange={(v) => {
            setRecherche(v);
            void chercher(etape.lotissementId, v);
          }}
          placeholder="Numéro de lot…"
        />
        {erreurLots && (
          <div className="mt-3 space-y-2">
            <Avertissement>Recherche impossible : {erreurLots}</Avertissement>
            <BoutonReessayer onClick={() => void chercher(etape.lotissementId, recherche)} />
          </div>
        )}
        {chargement ? (
          <div className="mt-3">
            <Chargement texte="Recherche des lots…" />
          </div>
        ) : (
          <div className="mt-3 rounded-[18px] border border-border bg-card px-3 shadow-panel">
            {(lots ?? []).length === 0 ? (
              <div className="px-4 py-10 text-center text-[12.5px] text-muted-foreground">
                Aucun lot ne correspond.
              </div>
            ) : (
              (lots ?? []).map((l) => (
                <LigneChoix
                  key={l.lot_id}
                  // Le cadenas du gel juridique, comme sur « Attribuer un lot »
                  // (`LotScreen`) : c'est le même composant de ligne, et un lot
                  // gelé y est signalé partout ailleurs dans l'app. Le serveur
                  // ne le contrôle pas sur cette fonction — raison de plus pour
                  // que la personne qui déroge le voie.
                  titre={`${l.verrouille ? "🔒 " : ""}Lot ${l.numero_lot} · Îlot ${l.ilot}`}
                  detail={l.attributaire_nom ?? "Aucun titulaire actuel"}
                  onClick={() => void ouvrirLot(etape.lotissementId, l)}
                />
              ))
            )}
          </div>
        )}
      </EcranSaisie>
    );
  }

  // ── Étape 3 : le diagnostic, puis la dérogation ─────────────────────────────
  const { lot, diagnostic, lotissementId } = etape;
  const motifPropre = motif.trim();
  const manqueCaracteres = MOTIF_MINIMUM - motifPropre.length;
  // Une attestation valide existe déjà POUR LE TITULAIRE ACTUEL : le serveur
  // refusera (« Une attestation valide existe deja pour le titulaire actuel »).
  // Le dire avant plutôt que de laisser taper un motif pour rien. Le
  // diagnostic est scopé sur ce même titulaire, sinon l'écran refuserait une
  // revente que le serveur accepte.
  const dejaCouvert = diagnostic.existante !== null;
  const sansTitulaire = !lot.attributaire_id;

  return (
    <EcranSaisie
      titre={`Lot ${lot.numero_lot}`}
      sousTitre={`Îlot ${lot.ilot} · ${lot.attributaire_nom ?? "aucun titulaire"}`}
      onBack={() => setEtape({ nom: "lot", lotissementId })}
    >
      <SectionLabel>État du dossier</SectionLabel>
      <Carte>
        <div className="flex items-start gap-2.5">
          {diagnostic.eligible ? (
            <CheckCircle2 className="mt-px size-[18px] flex-none text-success" />
          ) : (
            <FileWarning className="mt-px size-[18px] flex-none text-warning" />
          )}
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold text-foreground">
              {diagnostic.eligible
                ? "Dossier complet — éligible au Niveau 1"
                : "Dossier incomplet"}
            </div>
            <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {diagnostic.eligible ? (
                <>
                  Ce lot remplit les conditions ordinaires. Une attestation gratuite est
                  normalement créée automatiquement — la dérogation n&apos;a pas lieu
                  d&apos;être ici.
                </>
              ) : diagnostic.manques.length > 0 ? (
                <>
                  Pièces manquantes : <b>{diagnostic.manques.join(", ")}</b>.
                </>
              ) : (
                <>
                  Le détail des pièces manquantes n&apos;a pas pu être lu. L&apos;éligibilité,
                  elle, a bien été vérifiée par le serveur.
                </>
              )}
            </div>
          </div>
        </div>
      </Carte>

      {dejaCouvert && (
        <div className="mt-3">
          <Avertissement>
            Une attestation valide existe déjà sur ce lot ({diagnostic.existante?.reference}). Le
            serveur refuserait d&apos;en générer une seconde pour le titulaire actuel.
          </Avertissement>
        </div>
      )}

      {sansTitulaire && (
        <div className="mt-3">
          <Avertissement>
            Ce lot n&apos;a aucun titulaire actuel : il n&apos;y a personne à qui délivrer une
            attestation. Attribuez-le d&apos;abord.
          </Avertissement>
        </div>
      )}

      {!dejaCouvert && !sansTitulaire && (
        <>
          <SectionLabel className="mt-5">Motif de la dérogation</SectionLabel>
          <Carte>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Réservez ce geste aux dossiers dont la <b>transaction réelle est déjà
              établie</b>. Le motif est conservé sur l&apos;attestation et affiché à qui la
              consulte : il doit expliquer pourquoi on passe outre les pièces manquantes.
            </p>
            <textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
              placeholder="Ex. : vente constatée au registre du 12/03, APFC en cours de délivrance…"
              className="w-full resize-none rounded-lg border border-border-strong bg-inset px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary"
            />
            <div className="text-[11.5px] text-muted-foreground">
              {manqueCaracteres > 0
                ? `Encore ${manqueCaracteres} caractère${manqueCaracteres > 1 ? "s" : ""} — le serveur exige ${MOTIF_MINIMUM} caractères au minimum.`
                : "Motif suffisant."}
            </div>
          </Carte>

          {echec && (
            <div className="mt-3">
              <Avertissement>{echec}</Avertissement>
            </div>
          )}

          <button
            type="button"
            onClick={() => void generer()}
            disabled={manqueCaracteres > 0 || envoi}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-[14px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {envoi && <Loader2 className="size-4 animate-spin" />}
            Générer l&apos;attestation
          </button>
          <p className="mt-2 px-1 text-[11.5px] leading-snug text-muted-foreground">
            L&apos;attestation est créée immédiatement, au statut « Générée ». Elle devra
            encore être signée puis remise.
          </p>
        </>
      )}
    </EcranSaisie>
  );
}

function RappelDerogation() {
  return (
    <div className="mb-4 flex gap-2.5 rounded-2xl border border-warning/45 bg-warning-subtle px-3.5 py-3">
      <TriangleAlert className="mt-px size-4 flex-none text-warning" strokeWidth={2} />
      <div className="min-w-0 text-[12px] leading-relaxed text-foreground">
        Cet écran <b>passe outre</b> les conditions documentaires. Il écrit directement dans
        le registre — il n&apos;y a pas de file de validation ici.
      </div>
    </div>
  );
}
