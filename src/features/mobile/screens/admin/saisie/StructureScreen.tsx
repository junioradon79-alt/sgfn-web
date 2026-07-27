"use client";

// Nouveau lotissement « coquille » — type `creation_structure`, `ilots: []`.
//
// Pourquoi une coquille et pas un lotissement complet : `creation_structure`
// sait créer d'un coup le lotissement, ses îlots et ses lots. Saisir au clavier
// d'un téléphone les 14 îlots et 386 lots d'un Koelea-Accor est hors de portée
// — c'est un travail de tableur, que le dashboard web couvre déjà (import du
// guide de répartition). Le propriétaire du projet en a été prévenu et a
// tranché : depuis le terrain on crée la **fiche**, immédiatement, pendant
// qu'on a l'information sous les yeux ; le contenu vient ensuite.
//
// 🔴 D'où l'obligation de le dire à l'écran, deux fois plutôt qu'une : rien
// dans le rendu ne distingue une coquille d'un lotissement peuplé, et
// quelqu'un qui aurait cru saisir un lotissement entier ne s'en apercevrait
// qu'en cherchant ses lots des semaines plus tard.
//
// Différence avec « Lotissement → Créer une fiche » (`creation_lotissement`),
// qui produit lui aussi un lotissement vide : celui-ci sait en plus créer les
// **rattachements** (autorité coutumière, opérateur, famille) qui n'existent pas
// encore, et il alimente `nb_ilots`/`nb_lots` avec le compte **réel** des
// éléments créés — donc 0 ici. L'autre écran porte des volumes *annoncés* et un
// PV d'identification physique, que celui-ci n'a pas.
//
// Comme pour les nouveaux attributaires : les entités ne sont créées qu'à
// l'**approbation**, jamais à la soumission, et seulement si le payload porte
// explicitement l'objet correspondant — jamais de création silencieuse.

import { useState } from "react";
import { Layers } from "lucide-react";

import { useRetourFormulaire } from "@/lib/android-back";
import {
  normaliserNom,
  type NouvelOperateur,
  type NouvelleAutorite,
  type NouvelleFamille,
  type PayloadCreationStructure,
  type ResumeCreation,
} from "@/lib/saisie";
import type { RefOption, SaisieRegistre } from "../../../data/useSaisieRegistre";
import {
  Avertissement,
  Bascule,
  BoutonEnvoyer,
  Carte,
  BoutonReessayer,
  Champ,
  EchecEnvoi,
  EcranSaisie,
  EnvoiConfirme,
  RappelFile,
  SectionLabel,
  Selection,
  Texte,
  useEnvoi,
} from "./champs";

/** Aucun rattachement, un rattachement existant, ou un à créer à l'approbation. */
type ModeRef = "aucun" | "existant" | "nouveau";

const MODES: { value: ModeRef; label: string }[] = [
  { value: "aucun", label: "Aucun" },
  { value: "existant", label: "Existant" },
  { value: "nouveau", label: "À créer" },
];

/** Champs d'une entité à créer, décrits une fois pour être rendus et lus. */
type ChampEntite = { cle: string; label: string; placeholder?: string };

const CHAMPS_AUTORITE: ChampEntite[] = [
  { cle: "nom", label: "Nom de la chefferie", placeholder: "Ex. Chefferie d'Ebimpe" },
  { cle: "type", label: "Type", placeholder: "Village, canton…" },
  { cle: "village", label: "Village" },
  { cle: "chef", label: "Chef" },
  { cle: "contact", label: "Contact" },
];

const CHAMPS_OPERATEUR: ChampEntite[] = [
  { cle: "nom", label: "Nom de l'opérateur", placeholder: "Raison sociale" },
  { cle: "type", label: "Type", placeholder: "Aménageur, promoteur…" },
  { cle: "contact", label: "Contact" },
];

const CHAMPS_FAMILLE: ChampEntite[] = [
  { cle: "nom", label: "Nom de la famille", placeholder: "Ex. Famille Ako Djebe" },
  { cle: "chef_de_famille", label: "Chef de famille" },
  { cle: "contact", label: "Contact" },
];

type Entite = Record<string, string>;

const t = (v: string) => v.trim();
/** Lecture nettoyée d'un champ d'entité, absent ou vide compris. */
const g = (e: Entite, cle: string) => t(e[cle] ?? "");
/** N'ajoute la clé que si elle porte quelque chose — pas de clé morte au payload. */
const si = (valeur: string, cle: string) => (valeur ? { [cle]: valeur } : {});

export function StructureScreen({
  api,
  onBack,
  flash,
}: {
  api: SaisieRegistre;
  onBack: () => void;
  flash: (msg: string) => void;
}) {
  const envoi = useEnvoi(api.soumettre);

  const [nom, setNom] = useState("");
  const [village, setVillage] = useState("");
  const [commune, setCommune] = useState("");
  const [district, setDistrict] = useState("");
  const [superficie, setSuperficie] = useState("");
  const [guide, setGuide] = useState("");

  const [modeAutorite, setModeAutorite] = useState<ModeRef>("aucun");
  const [autoriteId, setAutoriteId] = useState("");
  const [autoriteNeuve, setAutoriteNeuve] = useState<Entite>({});

  const [modeOperateur, setModeOperateur] = useState<ModeRef>("aucun");
  const [operateurId, setOperateurId] = useState("");
  const [operateurNeuf, setOperateurNeuf] = useState<Entite>({});

  const [modeFamille, setModeFamille] = useState<ModeRef>("aucun");
  const [familleId, setFamilleId] = useState("");
  const [familleNeuve, setFamilleNeuve] = useState<Entite>({});

  const nomLotissement = t(nom);

  /**
   * Un rattachement « à créer » sans nom ferait échouer l'approbation côté base
   * (`Nom de la nouvelle autorité coutumière manquant.`) — c'est-à-dire sur
   * l'écran de quelqu'un d'autre, longtemps après. On l'exige ici.
   */
  const manqueNom =
    (modeAutorite === "nouveau" && !g(autoriteNeuve, "nom")) ||
    (modeOperateur === "nouveau" && !g(operateurNeuf, "nom")) ||
    (modeFamille === "nouveau" && !g(familleNeuve, "nom"));

  const pret = nomLotissement.length > 0 && !manqueNom;

  // Détection d'homonyme : la liste des lotissements est déjà chargée pour les
  // autres écrans, le contrôle est gratuit. Il avertit sans bloquer.
  const homonyme = nomLotissement
    ? (api.lotissements.find((l) => normaliserNom(l.nom) === normaliserNom(nomLotissement)) ?? null)
    : null;

  /** Entités qui naîtront à l'approbation — annoncées avant l'envoi. */
  const aCreer = [
    modeAutorite === "nouveau" ? "chefferie" : null,
    modeOperateur === "nouveau" ? "opérateur" : null,
    modeFamille === "nouveau" ? "famille" : null,
  ].filter((v): v is string => v !== null);

  const saisieEnCours =
    [nom, village, commune, district, superficie, guide].some((v) => t(v) !== "") ||
    modeAutorite !== "aucun" ||
    modeOperateur !== "aucun" ||
    modeFamille !== "aucun";
  // `&& !envoi.confirme` : après un envoi réussi les champs restent remplis,
  // donc `saisieEnCours` reste vrai. Sans cette condition, le geste de retour
  // proposait « abandonner cette saisie » sur l'écran dont la fonction unique
  // est d'annoncer qu'elle est **partie** — au pire endroit possible.
  useRetourFormulaire(saisieEnCours && !envoi.confirme, () =>
    flash("Appuyez à nouveau pour abandonner cette saisie"),
  );

  const reinitialiser = () => {
    setNom("");
    setVillage("");
    setCommune("");
    setDistrict("");
    setSuperficie("");
    setGuide("");
    setModeAutorite("aucun");
    setAutoriteId("");
    setAutoriteNeuve({});
    setModeOperateur("aucun");
    setOperateurId("");
    setOperateurNeuf({});
    setModeFamille("aucun");
    setFamilleId("");
    setFamilleNeuve({});
    envoi.oublierErreur();
  };

  if (envoi.confirme) {
    return (
      <EnvoiConfirme
        titre="Nouveau lotissement"
        onBack={onBack}
        recapitulatif={envoi.confirme}
        onNouvelle={() => {
          envoi.reprendre();
          reinitialiser();
        }}
      />
    );
  }

  const envoyer = () => {
    if (!pret) return;

    const nouvelleAutorite: NouvelleAutorite | undefined =
      modeAutorite === "nouveau"
        ? {
            nom: g(autoriteNeuve, "nom"),
            ...si(g(autoriteNeuve, "type"), "type"),
            ...si(g(autoriteNeuve, "village"), "village"),
            ...si(g(autoriteNeuve, "chef"), "chef"),
            ...si(g(autoriteNeuve, "contact"), "contact"),
          }
        : undefined;

    const nouvelOperateur: NouvelOperateur | undefined =
      modeOperateur === "nouveau"
        ? {
            nom: g(operateurNeuf, "nom"),
            ...si(g(operateurNeuf, "type"), "type"),
            ...si(g(operateurNeuf, "contact"), "contact"),
          }
        : undefined;

    const nouvelleFamille: NouvelleFamille | undefined =
      modeFamille === "nouveau"
        ? {
            nom: g(familleNeuve, "nom"),
            ...si(g(familleNeuve, "chef_de_famille"), "chef_de_famille"),
            ...si(g(familleNeuve, "contact"), "contact"),
          }
        : undefined;

    const payload: PayloadCreationStructure = {
      lotissement: {
        nom: nomLotissement,
        ...si(t(village), "village"),
        ...si(t(commune), "commune"),
        // Laissé absent, `district` retombe côté base sur 'Abidjan'
        // (`coalesce(..., 'Abidjan')`). C'est le comportement de la fonction
        // d'application, pas une valeur par défaut inventée ici — d'où le
        // champ vide autorisé et l'aide qui l'annonce.
        ...si(t(district), "district"),
        ...si(t(superficie), "superficie_texte"),
        ...si(t(guide), "guide_reference"),
        // Un identifiant n'est transmis que si son rattachement est en mode
        // « existant » : rester sur un id après être passé en « à créer »
        // rattacherait à l'ancienne entité tout en en créant une seconde.
        ...(modeAutorite === "existant" ? si(autoriteId, "autorite_coutumiere_id") : {}),
        ...(modeOperateur === "existant" ? si(operateurId, "operateur_id") : {}),
        ...(modeFamille === "existant" ? si(familleId, "famille_id") : {}),
      },
      ...(nouvelleAutorite ? { nouvelle_autorite: nouvelleAutorite } : {}),
      ...(nouvelOperateur ? { nouvel_operateur: nouvelOperateur } : {}),
      ...(nouvelleFamille ? { nouvelle_famille: nouvelleFamille } : {}),
      // 🔴 Zéro îlot, donc zéro lot. `_appliquer_creation_structure` accepte le
      // tableau vide et écrit `nb_ilots = 0, nb_lots = 0` sur le lotissement.
      ilots: [],
    };

    // Clés de `ResumeCreation`, celles que la file sait déjà afficher. Les
    // trois zéros ne sont pas un oubli : ils sont l'information principale, et
    // c'est en les lisant que l'administrateur saura qu'il approuve une fiche
    // et non un lotissement peuplé.
    const resume: ResumeCreation = {
      nom_lotissement: nomLotissement,
      nb_ilots: 0,
      nb_lots: 0,
      nb_equipements: 0,
    };

    const crees = [
      nouvelleAutorite ? "la chefferie" : null,
      nouvelOperateur ? "l'opérateur" : null,
      nouvelleFamille ? "la famille" : null,
    ].filter(Boolean);

    void envoi.envoyer(
      {
        type: "creation_structure",
        lotissementId: null,
        titre: `Nouvelle structure — ${nomLotissement}`,
        payload,
        resume,
      },
      `Le lotissement « ${nomLotissement} » sera créé après approbation${
        crees.length ? `, avec ${crees.join(" et ")}` : ""
      } — sans aucun îlot ni lot.`,
    );
  };

  return (
    <EcranSaisie
      titre="Nouveau lotissement"
      sousTitre="Fiche seule, sans îlot ni lot"
      onBack={onBack}
      action={<BoutonEnvoyer onClick={envoyer} disabled={!pret} enCours={envoi.enCours} />}
    >
      <RappelFile />

      <div className="mb-4">
        <Avertissement>
          Cet écran crée <b>la fiche du lotissement seulement</b>{" "}
          : aucun îlot, aucun lot. Un
          lotissement réel en compte des centaines, hors de portée d&apos;une saisie au clavier —
          ils s&apos;ajoutent ensuite depuis le dashboard web (import du guide de répartition),
          puis s&apos;attribuent lot par lot depuis « Attribuer un lot ».
        </Avertissement>
      </div>

      {/* Une liste de rattachement vide par échec ressemble trait pour trait à
          une liste vide par nature. Le dire, et proposer le réessai : sinon on
          crée la fiche sans rattachement en croyant qu'il n'y en avait aucun. */}
      {api.listesEnEchec.length > 0 && (
        <div className="mb-4 space-y-2">
          <Avertissement>
            Liste des <b>{api.listesEnEchec.join(", ")}</b> non chargée. Les sélecteurs
            correspondants sont vides <b>par erreur</b>, pas parce que le référentiel l&apos;est.
          </Avertissement>
          <BoutonReessayer onClick={() => void api.recharger()} />
        </div>
      )}

      <SectionLabel>Le lotissement</SectionLabel>
      <Carte>
        <Champ label="Nom du lotissement" obligatoire>
          <Texte
            value={nom}
            onChange={setNom}
            placeholder="Ex. Koelea-Accor Extension 2"
            autoCapitalize="words"
          />
        </Champ>
        {homonyme && (
          <div className="mb-3">
            <Avertissement>
              <b>«&nbsp;{homonyme.nom}&nbsp;» existe déjà</b> au registre
              {[homonyme.village, homonyme.commune].filter(Boolean).length > 0 &&
                ` (${[homonyme.village, homonyme.commune].filter(Boolean).join(" · ")})`}
              . Rien en base n&apos;interdit un second lotissement du même nom, mais deux fiches
              homonymes se distinguent mal ensuite.
            </Avertissement>
          </div>
        )}
        <Champ label="Village">
          <Texte value={village} onChange={setVillage} autoCapitalize="words" />
        </Champ>
        <Champ label="Commune">
          <Texte value={commune} onChange={setCommune} autoCapitalize="words" />
        </Champ>
        <Champ label="District" aide="Laissé vide, le district sera « Abidjan ».">
          <Texte value={district} onChange={setDistrict} autoCapitalize="words" />
        </Champ>
        <Champ label="Superficie" aide="Texte libre, tel qu'il figure sur les documents.">
          <Texte value={superficie} onChange={setSuperficie} placeholder="Ex. 12 ha 45 a" />
        </Champ>
        <Champ label="Référence du guide de répartition">
          <Texte value={guide} onChange={setGuide} placeholder="Ex. GR-2024-018" />
        </Champ>
      </Carte>

      <Rattachement
        titre="Chefferie"
        mode={modeAutorite}
        onMode={setModeAutorite}
        options={api.autorites}
        valeur={autoriteId}
        onValeur={setAutoriteId}
        videLabel="Choisir une chefferie…"
        champs={CHAMPS_AUTORITE}
        entite={autoriteNeuve}
        onEntite={setAutoriteNeuve}
      />

      <Rattachement
        titre="Opérateur"
        mode={modeOperateur}
        onMode={setModeOperateur}
        options={api.operateurs}
        valeur={operateurId}
        onValeur={setOperateurId}
        videLabel="Choisir un opérateur…"
        champs={CHAMPS_OPERATEUR}
        entite={operateurNeuf}
        onEntite={setOperateurNeuf}
      />

      <Rattachement
        titre="Famille"
        mode={modeFamille}
        onMode={setModeFamille}
        options={api.familles}
        valeur={familleId}
        onValeur={setFamilleId}
        videLabel="Choisir une famille…"
        champs={CHAMPS_FAMILLE}
        entite={familleNeuve}
        onEntite={setFamilleNeuve}
      />

      {/* Ce que l'administrateur lira dans sa file, annoncé avant l'envoi :
          l'écran et le résumé ne peuvent donc pas se contredire. */}
      <div className="mt-5 flex gap-2.5 rounded-2xl border border-border bg-inset px-3.5 py-3">
        <Layers className="mt-px size-4 flex-none text-muted-2" strokeWidth={2} />
        <div className="min-w-0 text-[12px] leading-relaxed text-foreground">
          Sera soumis : <b>1 lotissement</b>, 0 îlot, 0 lot
          {aCreer.length > 0 && <> · à créer aussi : {aCreer.join(", ")}</>}.
        </div>
      </div>

      {manqueNom && (
        <div className="mt-3">
          <Avertissement>
            Un rattachement « à créer » doit porter un nom, sinon la validation échouera au
            moment de l&apos;approbation.
          </Avertissement>
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

/**
 * Un rattachement facultatif : aucun, un existant, ou un nouveau créé à
 * l'approbation. Les trois se comportent exactement pareil côté base, d'où un
 * seul composant — trois copies auraient dérivé au premier ajustement.
 */
function Rattachement({
  titre,
  mode,
  onMode,
  options,
  valeur,
  onValeur,
  videLabel,
  champs,
  entite,
  onEntite,
}: {
  titre: string;
  mode: ModeRef;
  onMode: (m: ModeRef) => void;
  options: RefOption[];
  valeur: string;
  onValeur: (v: string) => void;
  videLabel: string;
  champs: ChampEntite[];
  entite: Entite;
  onEntite: (e: Entite) => void;
}) {
  return (
    <>
      <SectionLabel className="mt-5">{titre}</SectionLabel>
      <Bascule options={MODES} value={mode} onChange={onMode} />

      {mode === "existant" && (
        <Carte className="mt-3">
          <Champ label={`${titre} de rattachement`}>
            <Selection value={valeur} onChange={onValeur} options={options} vide={videLabel} />
          </Champ>
        </Carte>
      )}

      {mode === "nouveau" && (
        <Carte className="mt-3">
          {champs.map((c, i) => (
            <Champ
              key={c.cle}
              label={c.label}
              // Le nom est le seul champ exigé par la fonction d'application :
              // c'est toujours le premier de la liste.
              obligatoire={i === 0}
            >
              <Texte
                value={entite[c.cle] ?? ""}
                onChange={(v) => onEntite({ ...entite, [c.cle]: v })}
                placeholder={c.placeholder}
                autoCapitalize="words"
              />
            </Champ>
          ))}
        </Carte>
      )}
    </>
  );
}
