"use client";

// Attribuer un lot — **un seul lot à la fois**.
//
// Le module de saisie a été conçu pour l'import d'un guide de répartition :
// une soumission = des dizaines d'opérations, préparées sur tableur. Ce n'est
// pas ce qui se passe sur le terrain, où l'on constate qu'un lot a changé de
// main, ou qu'une attribution était fausse. Cet écran couvre ce cas-là, et lui
// seul : une soumission `maj_attributions` ne portant **qu'une** opération.
//
// Cette limite est un choix, pas un raccourci. Un panier multi-lots au pouce
// demanderait de tenir un diff à l'écran, de le rejouer après un rechargement,
// et de le rendre lisible sur 6 cm — trois occasions d'envoyer en validation
// autre chose que ce qu'on croit. Un lot, un acte, un résumé vérifiable.
//
// 🔴 L'écran ne décide de rien : `_appliquer_maj_attributions` est pilotée par
// l'état **cible** (« ce lot doit finir libre / attribué à X »), pas par une
// différence calculée ici. C'est ce qui la rend résiliente à un diff légèrement
// périmé — si quelqu'un a modifié le lot entre-temps, la cible reste valable.

import { useEffect, useState } from "react";
import { LandPlot, Lock, PackageSearch, UserPlus, UserSearch } from "lucide-react";

import { useRetourFormulaire } from "@/lib/android-back";
import {
  CLASSE_LABELS,
  QUALITE_OPTIONS,
  TYPE_ATTRIBUTAIRE_OPTIONS,
  classifier,
  labelQualite,
  labelTypeAttributaire,
  type CibleChoisie,
  type LotEtat,
  type NouvelAttributaire,
  type OperationCible,
  type PayloadMajAttributions,
  type Qualite,
  type ResumeMaj,
  type TypeAttributaire,
} from "@/lib/saisie";
import type { AttributaireFiche, SaisieRegistre } from "../../../data/useSaisieRegistre";
import {
  Avertissement,
  Bascule,
  BoutonEnvoyer,
  Carte,
  Champ,
  ChampRecherche,
  Chargement,
  ChoixLotissement,
  EchecEnvoi,
  EcranSaisie,
  EnvoiConfirme,
  LigneChoix,
  Pastilles,
  RappelFile,
  SectionLabel,
  Texte,
  useEnvoi,
} from "./champs";

/**
 * Référence interne du nouvel attributaire dans le payload. Sa seule fonction
 * est de relier `nouveaux_attributaires[0]` à l'unique opération : il n'y en a
 * jamais qu'un, une valeur fixe suffit et se relit dans le payload stocké.
 */
const REF_NOUVEAU = "nouveau-1";

/** En dessous, la recherche d'attributaire ramènerait la moitié du registre. */
const MIN_RECHERCHE = 2;

type Source = "existant" | "nouveau";

/** Réponse de recherche portant la clé qui l'a produite (cf. AttributaireScreen). */
type Reponse<T> = { cle: string; liste: T[]; erreur: string | null };

export function LotScreen({
  api,
  onBack,
  flash,
}: {
  api: SaisieRegistre;
  onBack: () => void;
  flash: (msg: string) => void;
}) {
  const { chercherLots, chercherAttributaires } = api;
  const envoi = useEnvoi(api.soumettre);

  const [lotissementId, setLotissementId] = useState<string | null>(null);
  const lotissement = api.lotissements.find((l) => l.id === lotissementId) ?? null;

  const [rechercheLot, setRechercheLot] = useState("");
  const motifLot = rechercheLot.trim();
  const [lots, setLots] = useState<Reponse<LotEtat> | null>(null);
  const [lot, setLot] = useState<LotEtat | null>(null);

  const [cible, setCible] = useState<"libre" | "attribue">("attribue");
  const [source, setSource] = useState<Source>("existant");
  const [qualite, setQualite] = useState<Qualite | null>(null);

  const [rechercheAtt, setRechercheAtt] = useState("");
  const motifAtt = rechercheAtt.trim();
  const [attributaires, setAttributaires] = useState<Reponse<AttributaireFiche> | null>(null);
  const [attributaire, setAttributaire] = useState<AttributaireFiche | null>(null);

  const [nom, setNom] = useState("");
  const [type, setType] = useState<TypeAttributaire>("personne_physique");
  const [pieceNature, setPieceNature] = useState("");
  const [pieceNum, setPieceNum] = useState("");
  const [telephone, setTelephone] = useState("");

  // Recherche des lots. Le motif vide est **légitime** : il ramène les premiers
  // lots du lotissement, ce qui donne un point de départ à qui ne connaît pas
  // encore le numéro. La clé porte aussi le lotissement, sinon une réponse
  // lente sur l'ancien lotissement viendrait remplir la liste du nouveau.
  const cleLots = `${lotissementId ?? ""}|${motifLot}`;
  useEffect(() => {
    if (!lotissementId || lot) return;
    let vivant = true;
    const t = setTimeout(() => {
      void (async () => {
        const res = await chercherLots(lotissementId, motifLot);
        if (!vivant) return;
        setLots(
          res.ok
            ? { cle: `${lotissementId}|${motifLot}`, liste: res.valeur, erreur: null }
            : { cle: `${lotissementId}|${motifLot}`, liste: [], erreur: res.error },
        );
      })();
    }, 250);
    return () => {
      vivant = false;
      clearTimeout(t);
    };
  }, [lotissementId, motifLot, lot, chercherLots]);

  useEffect(() => {
    if (source !== "existant" || cible !== "attribue" || attributaire) return;
    if (motifAtt.length < MIN_RECHERCHE) return;
    let vivant = true;
    const t = setTimeout(() => {
      void (async () => {
        const res = await chercherAttributaires(motifAtt);
        if (!vivant) return;
        setAttributaires(
          res.ok
            ? { cle: motifAtt, liste: res.valeur, erreur: null }
            : { cle: motifAtt, liste: [], erreur: res.error },
        );
      })();
    }, 250);
    return () => {
      vivant = false;
      clearTimeout(t);
    };
  }, [source, cible, attributaire, motifAtt, chercherAttributaires]);

  const choisirLotissement = (id: string) => {
    setLotissementId(id);
    setRechercheLot("");
    setLots(null);
    setLot(null);
  };

  const oublierCible = () => {
    setCible("attribue");
    setSource("existant");
    setQualite(null);
    setRechercheAtt("");
    setAttributaires(null);
    setAttributaire(null);
    setNom("");
    setType("personne_physique");
    setPieceNature("");
    setPieceNum("");
    setTelephone("");
    envoi.oublierErreur();
  };

  const choisirLot = (l: LotEtat) => {
    setLot(l);
    oublierCible();
  };

  // Nom affiché de la cible — celui qui apparaîtra dans le récapitulatif et
  // dans le titre de la soumission, donc ce que l'admin lira dans sa file.
  const nomCible = source === "existant" ? (attributaire?.nom ?? "") : nom.trim();

  const cibleChoisie: CibleChoisie | null =
    cible === "libre"
      ? { type: "libre" }
      : qualite && nomCible
        ? {
            type: "attribue",
            ...(source === "existant"
              ? { attributaire_id: attributaire?.id }
              : { attributaire_ref: REF_NOUVEAU }),
            attributaire_nom: nomCible,
            qualite,
          }
        : null;

  const classeBrute = lot && cibleChoisie ? classifier(lot, cibleChoisie) : null;
  /**
   * `classifier` — partagée avec le web — ne compare que l'attributaire. Un lot
   * sans attributaire mais dont le statut n'est pas « libre » (typiquement
   * `reserve_equipement`) serait donc classé « aucun changement », alors que
   * `_appliquer_maj_attributions` fait bel et bien `update lots set
   * statut = 'libre'` : l'écran refuserait un acte qui en est un. On corrige
   * ici plutôt que dans `classifier`, dont le web dépend aussi.
   */
  const classeCalculee =
    classeBrute === "inchange" && cible === "libre" && lot && lot.statut !== "libre"
      ? ("remise_libre" as const)
      : classeBrute;
  // Un lot gelé n'aura AUCUN acte : annoncer « Remise en disponibilité » deux
  // blocs sous l'avertissement qui dit que le lot ne peut pas être remis en
  // disponibilité, c'est se contredire sur l'écran qui porte la règle.
  const classe = lot?.verrouille ? null : classeCalculee;

  // Une opération « inchangée » serait comptée `n_skip` par la base : la
  // soumission occuperait la file d'un administrateur pour n'appliquer
  // strictement rien. On l'arrête ici plutôt qu'à l'approbation.
  //
  // Un lot sous **gel juridique** est refusé pour une autre raison : ce n'est
  // pas un acte inutile, c'est un acte interdit. La base le refuse désormais à
  // l'approbation ; l'arrêter ici évite de faire porter à un administrateur une
  // soumission qui ne pourra jamais aboutir.
  const pret =
    !!lot && !lot.verrouille && !!cibleChoisie && classe !== null && classe !== "inchange";

  // Atteindre un lot a coûté un choix de lotissement puis une recherche par
  // numéro, et tout ce qui suit en dépend : c'est à partir de là qu'un
  // effleurement du bord de l'écran fait perdre du travail.
  // `&& !envoi.confirme` : après l'envoi le lot reste sélectionné, donc la
  // garde restait armée sur l'écran de confirmation et y annonçait un abandon.
  useRetourFormulaire(!!lot && !envoi.confirme, () =>
    flash("Appuyez à nouveau pour abandonner cette saisie"),
  );

  if (envoi.confirme) {
    return (
      <EnvoiConfirme
        titre="Attribution de lot"
        onBack={onBack}
        recapitulatif={envoi.confirme}
        onNouvelle={() => {
          envoi.reprendre();
          setLot(null);
          setRechercheLot("");
          setLots(null);
          oublierCible();
        }}
      />
    );
  }

  const envoyer = () => {
    if (!pret || !lot || !lotissement) return;

    const nouveaux: NouvelAttributaire[] =
      cible === "attribue" && source === "nouveau"
        ? [
            {
              ref: REF_NOUVEAU,
              nom: nom.trim(),
              type,
              // Omis plutôt qu'envoyés vides : la fonction d'application fait
              // déjà `nullif(btrim(…), '')`, mais un payload sans clé morte se
              // relit sans se demander si le champ a été effacé volontairement.
              ...(pieceNature.trim() ? { piece_nature: pieceNature.trim() } : {}),
              ...(pieceNum.trim() ? { piece_num: pieceNum.trim() } : {}),
              ...(telephone.trim() ? { telephone: telephone.trim() } : {}),
            },
          ]
        : [];

    // Les trois retours anticipés qui suivent sont **inatteignables** — `pret`
    // exige déjà une qualité et un attributaire résolu. Ils existent pour que
    // le typage de `OperationCible` soit satisfait sans assertion `!` : une
    // assertion tiendrait par convention, un retour tient par construction.
    let operation: OperationCible;
    if (cible === "libre") {
      operation = { lot_id: lot.lot_id, cible: "libre" };
    } else if (!qualite) {
      return;
    } else if (source === "existant") {
      if (!attributaire) return;
      operation = {
        lot_id: lot.lot_id,
        cible: "attribue",
        attributaire_id: attributaire.id,
        qualite,
      };
    } else {
      operation = {
        lot_id: lot.lot_id,
        cible: "attribue",
        attributaire_ref: REF_NOUVEAU,
        qualite,
      };
    }

    const payload: PayloadMajAttributions = {
      lotissement_id: lotissement.id,
      nouveaux_attributaires: nouveaux,
      operations: [operation],
    };

    // Compteurs de `ResumeMaj` — exactement les clés que la file sait afficher.
    // Une seule opération, donc au plus un compteur à 1 : c'est la
    // classification qui dit lequel, et c'est elle que l'écran a montrée avant
    // l'envoi. Résumé et écran ne peuvent donc pas diverger.
    const resume: ResumeMaj = {
      nouvelles_attributions: classe === "nouvelle_attribution" ? 1 : 0,
      reassignations: classe === "reassignation" ? 1 : 0,
      remises_libre: classe === "remise_libre" ? 1 : 0,
      inchanges: 0,
      nouveaux_attributaires: nouveaux.length,
    };

    const ouLot = `lot ${lot.numero_lot} (îlot ${lot.ilot})`;
    void envoi.envoyer(
      {
        type: "maj_attributions",
        lotissementId: lotissement.id,
        titre: `${lotissement.nom} — ${ouLot}`,
        payload,
        resume,
      },
      cible === "libre"
        ? `Le ${ouLot} de ${lotissement.nom} sera remis en disponibilité après approbation.`
        : `Le ${ouLot} de ${lotissement.nom} sera attribué à ${nomCible} (${labelQualite(qualite)}) après approbation.`,
    );
  };

  // ── Étape 1 : le lotissement ───────────────────────────────────────────────
  if (!lotissement) {
    return (
      <EcranSaisie titre="Attribuer un lot" sousTitre="Choisir le lotissement" onBack={onBack}>
        <RappelFile />
        <SectionLabel>Dans quel lotissement ?</SectionLabel>
        <ChoixLotissement
          lotissements={api.lotissements}
          onChoisir={choisirLotissement}
          loading={api.loading}
          erreur={api.erreur}
          recharger={api.recharger}
        />
      </EcranSaisie>
    );
  }

  // ── Étape 2 : le lot ───────────────────────────────────────────────────────
  if (!lot) {
    const chargement = lots?.cle !== cleLots;
    return (
      <EcranSaisie
        titre={lotissement.nom}
        sousTitre="Choisir le lot"
        onBack={() => setLotissementId(null)}
      >
        <SectionLabel>Quel lot ?</SectionLabel>
        <ChampRecherche
          value={rechercheLot}
          onChange={setRechercheLot}
          placeholder="Numéro du lot…"
        />
        {chargement && <Chargement texte="Recherche…" />}
        {lots?.cle === cleLots && lots.erreur && (
          <div className="mt-3">
            <Avertissement>Recherche impossible : {lots.erreur}</Avertissement>
          </div>
        )}
        {lots?.cle === cleLots && !lots.erreur && (
          <div className="mt-3 rounded-[18px] border border-border bg-card px-3 shadow-panel">
            {lots.liste.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <PackageSearch className="size-7 text-muted-2" />
                <div className="text-[13.5px] font-semibold text-foreground">Aucun lot</div>
                <div className="text-[12px] text-muted-foreground">
                  {motifLot
                    ? `Aucun lot ne porte le numéro « ${motifLot} » dans ce lotissement.`
                    : "Ce lotissement ne contient aucun lot. Les lots se créent sur le dashboard web (import du guide de répartition) — cet écran ne fait qu'attribuer des lots existants."}
                </div>
              </div>
            ) : (
              lots.liste.map((l) => (
                <LigneChoix
                  key={l.lot_id}
                  // Le gel se lit dès la liste : le voir seulement après avoir
                  // ouvert le lot, c'est le découvrir une fois le geste engagé.
                  titre={`${l.verrouille ? "🔒 " : ""}Lot ${l.numero_lot} · îlot ${l.ilot}`}
                  detail={
                    l.verrouille
                      ? `Gel juridique — ${l.attributaire_nom ?? `statut « ${l.statut} »`}`
                      : l.attributaire_nom
                        ? `${l.attributaire_nom} — ${labelQualite(l.qualite)}`
                        : `Libre (${l.statut})`
                  }
                  onClick={() => choisirLot(l)}
                />
              ))
            )}
          </div>
        )}
        {lots?.cle === cleLots && lots.liste.length >= 25 && (
          <p className="mt-2 px-1 text-[11.5px] text-muted-foreground">
            25 premiers lots seulement — tapez un numéro pour affiner.
          </p>
        )}
      </EcranSaisie>
    );
  }

  // ── Étape 3 : la cible ─────────────────────────────────────────────────────
  return (
    <EcranSaisie
      titre={`Lot ${lot.numero_lot}`}
      sousTitre={`${lotissement.nom} · îlot ${lot.ilot}`}
      onBack={() => {
        setLot(null);
        oublierCible();
      }}
      action={<BoutonEnvoyer onClick={envoyer} disabled={!pret} enCours={envoi.enCours} />}
    >
      <RappelFile />

      <SectionLabel>Situation actuelle</SectionLabel>
      <Carte>
        <div className="flex items-start gap-3">
          <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-inset text-primary">
            {lot.verrouille ? (
              <Lock className="size-5" strokeWidth={1.9} />
            ) : (
              <LandPlot className="size-5" strokeWidth={1.9} />
            )}
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-foreground">
              {lot.attributaire_nom ?? "Aucun attributaire"}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {lot.attributaire_nom
                ? `${labelQualite(lot.qualite)} · statut « ${lot.statut} »`
                : `Statut « ${lot.statut} »`}
            </div>
          </div>
        </div>
      </Carte>

      {/* Le gel n'est pas une nuance d'affichage : il ferme l'écran. Placé
          juste sous la situation actuelle, avant les choix, pour qu'on ne
          renseigne pas une cible qui ne partira jamais. */}
      {lot.verrouille && (
        <div className="mt-3">
          <Avertissement>
            <b>Ce lot est sous gel juridique.</b> Il ne peut être ni réattribué ni remis en
            disponibilité depuis l&apos;application. Le gel se lève sur le dashboard web, par
            un administrateur, une fois le litige tranché.
          </Avertissement>
        </div>
      )}

      <SectionLabel className="mt-5">Que doit devenir ce lot ?</SectionLabel>
      <Bascule
        options={[
          { value: "attribue" as const, label: "Attribué à…" },
          { value: "libre" as const, label: "Libre" },
        ]}
        value={cible}
        onChange={(v) => {
          setCible(v);
          envoi.oublierErreur();
        }}
      />

      {cible === "libre" ? (
        <div className="mt-3">
          {/* Deux phrases distinctes : promettre la clôture d'une attribution
              sur un lot qui n'en a aucune (un lot réservé pour équipement, par
              exemple) décrirait un acte qui n'aura pas lieu. */}
          <Avertissement>
            {lot.attributaire_id ? (
              <>
                L&apos;attribution en cours sera close et le lot repassera en <b>libre</b>.
                L&apos;historique des attributions est conservé — rien n&apos;est effacé, le lot
                redevient simplement disponible.
              </>
            ) : (
              <>
                Le lot n&apos;a pas d&apos;attributaire : seul son <b>statut</b>{" "}
                changera, de «&nbsp;{lot.statut}&nbsp;» à «&nbsp;libre&nbsp;».
              </>
            )}
          </Avertissement>
        </div>
      ) : (
        <>
          <div className="mt-3">
            <Bascule
              options={[
                { value: "existant" as const, label: "Attributaire connu" },
                { value: "nouveau" as const, label: "Nouveau" },
              ]}
              value={source}
              onChange={(v) => {
                setSource(v);
                setAttributaire(null);
                setRechercheAtt("");
                setAttributaires(null);
              }}
            />
          </div>

          {source === "existant" ? (
            <div className="mt-3">
              {attributaire ? (
                <Carte>
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-inset text-primary">
                      <UserSearch className="size-5" strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold text-foreground">
                        {attributaire.nom}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {[
                          labelTypeAttributaire(attributaire.type),
                          attributaire.piece_num ? `Pièce ${attributaire.piece_num}` : null,
                          attributaire.telephone,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttributaire(null)}
                      className="flex-none rounded-full border border-border-strong px-3 py-1.5 text-[12px] font-semibold text-foreground"
                    >
                      Changer
                    </button>
                  </div>
                </Carte>
              ) : (
                <>
                  <ChampRecherche
                    value={rechercheAtt}
                    onChange={setRechercheAtt}
                    placeholder="Nom de l'attributaire…"
                  />
                  {motifAtt.length > 0 && motifAtt.length < MIN_RECHERCHE && (
                    <p className="mt-2 px-1 text-[11.5px] text-muted-foreground">
                      Encore {MIN_RECHERCHE - motifAtt.length} caractère
                      {MIN_RECHERCHE - motifAtt.length > 1 ? "s" : ""} pour lancer la recherche.
                    </p>
                  )}
                  {motifAtt.length >= MIN_RECHERCHE && attributaires?.cle !== motifAtt && (
                    <Chargement texte="Recherche…" />
                  )}
                  {attributaires?.cle === motifAtt && attributaires.erreur && (
                    <div className="mt-3">
                      <Avertissement>Recherche impossible : {attributaires.erreur}</Avertissement>
                    </div>
                  )}
                  {attributaires?.cle === motifAtt && !attributaires.erreur && (
                    <div className="mt-3 rounded-[18px] border border-border bg-card px-3 shadow-panel">
                      {attributaires.liste.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                          <UserPlus className="size-7 text-muted-2" />
                          <div className="text-[13.5px] font-semibold text-foreground">
                            Aucune fiche
                          </div>
                          <div className="text-[12px] text-muted-foreground">
                            Personne ne porte ce nom au registre. Basculez sur « Nouveau » pour
                            créer la fiche en même temps que l&apos;attribution.
                          </div>
                        </div>
                      ) : (
                        attributaires.liste.map((f) => (
                          <LigneChoix
                            key={f.id}
                            titre={f.nom}
                            detail={[
                              labelTypeAttributaire(f.type),
                              f.piece_num ? `Pièce ${f.piece_num}` : null,
                              f.telephone,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            onClick={() => setAttributaire(f)}
                          />
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="mt-3">
                <Avertissement>
                  La fiche sera créée <b>à l&apos;approbation</b>, en même temps que
                  l&apos;attribution. Vérifiez d&apos;abord dans « Attributaire connu » que la
                  personne n&apos;existe pas déjà : deux fiches pour un même nom se
                  fusionnent mal.
                </Avertissement>
              </div>
              <Carte className="mt-3">
                <Champ label="Nom" obligatoire>
                  <Texte
                    value={nom}
                    onChange={setNom}
                    placeholder="Prénom NOM, ou raison sociale"
                    autoCapitalize="words"
                  />
                </Champ>
                <Champ label="Type">
                  <Pastilles options={TYPE_ATTRIBUTAIRE_OPTIONS} value={type} onChange={setType} />
                </Champ>
                <Champ label="Nature de la pièce">
                  <Texte value={pieceNature} onChange={setPieceNature} placeholder="CNI, passeport…" />
                </Champ>
                <Champ label="Numéro de la pièce">
                  <Texte value={pieceNum} onChange={setPieceNum} placeholder="Ex. CI002123456789" />
                </Champ>
                <Champ label="Téléphone">
                  <Texte
                    value={telephone}
                    onChange={setTelephone}
                    type="tel"
                    inputMode="tel"
                    placeholder="+225 07 00 00 00 00"
                  />
                </Champ>
              </Carte>
            </>
          )}

          <SectionLabel className="mt-5">À quel titre ?</SectionLabel>
          <Carte>
            <Champ
              label="Qualité de l'attribution"
              obligatoire
              aide="Elle détermine la portée juridique de l'acte et figure sur l'attestation."
            >
              <Pastilles options={QUALITE_OPTIONS} value={qualite} onChange={setQualite} />
            </Champ>
          </Carte>
        </>
      )}

      {/* Nature exacte de l'acte, calculée par `classifier` — la même fonction
          qui sert au web. C'est le seul endroit où l'écran dit ce qu'il fait :
          « attribuer » à un lot déjà attribué n'est pas une attribution mais
          une réassignation, et la distinction se perd très vite au pouce. */}
      {classe && (
        <div className="mt-4">
          {classe === "inchange" ? (
            <Avertissement>
              <b>{CLASSE_LABELS.inchange}.</b>{" "}
              Le lot est déjà exactement dans cet état : la soumission n&apos;appliquerait rien
              et occuperait la file pour rien.
            </Avertissement>
          ) : (
            <div className="rounded-2xl border border-accent/40 bg-accent-subtle px-3.5 py-3 text-[12.5px] leading-relaxed text-foreground">
              Acte soumis : <b>{CLASSE_LABELS[classe]}</b>
              {classe === "reassignation" && lot.attributaire_nom && (
                <> — l&apos;attribution de {lot.attributaire_nom} sera close.</>
              )}
            </div>
          )}
        </div>
      )}

      {envoi.erreur && (
        <div className="mt-4">
          <EchecEnvoi erreur={envoi.erreur} incertain={envoi.erreurIncertaine} />
        </div>
      )}
    </EcranSaisie>
  );
}
