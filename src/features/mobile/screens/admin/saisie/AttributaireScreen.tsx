"use client";

// Attributaire — créer une fiche, ou en corriger une existante.
//
// Jusqu'ici un attributaire ne pouvait naître que comme **effet de bord** d'une
// mise à jour d'attributions (le tableau `nouveaux_attributaires`), et rien ne
// permettait d'en corriger un : pas même une faute de frappe sur un nom, alors
// que ce nom est imprimé sur les attestations délivrées.
//
// Type de soumission `maj_attributaire`. Sa migration
// (`20260726150000_soumission_maj_attributaire.sql`) est **exécutée en
// production** — vérifié le 26/07/2026 : la contrainte de type de
// `soumissions_saisie` énumère bien les cinq types, et `soumettre_saisie` comme
// `approuver_soumission` connaissent le nouveau.
//
// L'échec d'envoi reste affiché tel quel, message serveur compris : un écran
// qui avalerait cette erreur laisserait croire à une correction enregistrée.

import { useEffect, useState } from "react";
import { UserPlus, UserSearch } from "lucide-react";

import { useRetourFormulaire } from "@/lib/android-back";
import {
  TYPE_ATTRIBUTAIRE_OPTIONS,
  labelTypeAttributaire,
  normaliserNom,
  type PayloadMajAttributaire,
  type ResumeAttributaire,
  type TypeAttributaire,
} from "@/lib/saisie";
import type { AttributaireFiche, SaisieRegistre } from "../../../data/useSaisieRegistre";
import {
  Avertissement,
  BoutonEnvoyer,
  Carte,
  Champ,
  ChampRecherche,
  Chargement,
  EchecEnvoi,
  EcranSaisie,
  EnvoiConfirme,
  LigneChoix,
  Pastilles,
  RappelFile,
  SectionLabel,
  Texte,
  aideTypeInvalide,
  useEnvoi,
} from "./champs";

type Mode = "creer" | "corriger";

/** En dessous, la recherche ramènerait la moitié du registre. */
const MIN_RECHERCHE = 2;

/** Champs comparés pour compter ce qui bouge réellement dans une correction. */
const CHAMPS_COMPARES = [
  "nom",
  "type",
  "piece_nature",
  "piece_num",
  "telephone",
  "email",
  "adresse",
] as const;

/** `null` et `""` disent la même chose côté base (`nullif(btrim(…), '')`). */
const vide = (v: string | null) => (v ?? "").trim();

export function AttributaireScreen({
  api,
  onBack,
  flash,
  creationInterdite = false,
}: {
  api: SaisieRegistre;
  onBack: () => void;
  flash: (msg: string) => void;
  /**
   * 🔴 Miroir de la garde de `soumettre_saisie` : depuis le 30/07, une
   * chefferie peut CORRIGER la fiche d'un attributaire de sa juridiction, mais
   * pas en CRÉER une — le serveur refuse un payload sans `attributaire_id`,
   * message à l'appui. Sans ce drapeau, l'écran laissait remplir sept champs
   * avant de se faire renvoyer à l'envoi : exactement le coût que
   * `SAISIES_PAR_ROLE` existe pour éviter.
   */
  creationInterdite?: boolean;
}) {
  const { chercherAttributaires } = api;
  const envoi = useEnvoi(api.soumettre);

  const [mode, setMode] = useState<Mode>(creationInterdite ? "corriger" : "creer");
  const [recherche, setRecherche] = useState("");
  const motif = recherche.trim();
  // La réponse porte le motif qui l'a produite : c'est ce qui permet de
  // **dériver** l'état « recherche en cours » au lieu de le poser dans un effet
  // (règle `react-hooks/set-state-in-effect`), et donc de ne jamais le laisser
  // allumé sur une sortie anticipée.
  const [reponse, setReponse] = useState<{
    pour: string;
    liste: AttributaireFiche[];
    erreur: string | null;
  } | null>(null);

  /** Fiche d'origine en correction — la référence du diff. `null` = création. */
  const [base, setBase] = useState<AttributaireFiche | null>(null);

  const [nom, setNom] = useState("");
  const [type, setType] = useState<TypeAttributaire>("personne_physique");
  const [pieceNature, setPieceNature] = useState("");
  const [pieceNum, setPieceNum] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [adresse, setAdresse] = useState("");

  useEffect(() => {
    if (mode !== "corriger" || motif.length < MIN_RECHERCHE) return;
    let vivant = true;
    // Débounce : la frappe au pouce déclencherait sinon une requête par lettre.
    const t = setTimeout(() => {
      void (async () => {
        const res = await chercherAttributaires(motif);
        if (!vivant) return;
        setReponse(
          res.ok
            ? { pour: motif, liste: res.valeur, erreur: null }
            : { pour: motif, liste: [], erreur: res.error },
        );
      })();
    }, 250);
    return () => {
      vivant = false;
      clearTimeout(t);
    };
  }, [mode, motif, chercherAttributaires]);

  /**
   * Détection d'homonyme en **création**. L'écran sait déjà chercher des
   * attributaires — il ne le faisait qu'en mode correction. Créer une seconde
   * fiche pour une personne qui en a déjà une passe inaperçu jusqu'au jour où
   * il faut délivrer une attestation : la base compte déjà des homonymes, et
   * `attributaires.nom` ne porte aucune contrainte d'unicité.
   */
  const nomCherche = nom.trim();
  // Même motif que `reponse` plus haut : la réponse **porte le nom qui l'a
  // produite**, et l'affichage se dérive de la comparaison. Poser `[]` dans le
  // corps de l'effet quand le nom redevient trop court enfreindrait
  // `react-hooks/set-state-in-effect` — la règle que ce fichier respecte
  // partout ailleurs.
  const [repHomonymes, setRepHomonymes] = useState<{
    pour: string;
    liste: AttributaireFiche[];
    /** 🔴 Une recherche en échec ne doit pas se lire « aucun homonyme ». */
    erreur: string | null;
  } | null>(null);

  useEffect(() => {
    if (mode !== "creer" || nomCherche.length < MIN_RECHERCHE) return;
    let vivant = true;
    const t = setTimeout(() => {
      void (async () => {
        const res = await chercherAttributaires(nomCherche);
        if (!vivant) return;
        // Égalité stricte sur le nom normalisé : la recherche serveur est un
        // `ilike %motif%`, elle ramène « Konan » pour « Konan Yao Bernard ».
        // Signaler une ressemblance partielle ferait crier au loup à chaque
        // patronyme courant, et l'avertissement cesserait d'être lu.
        setRepHomonymes({
          pour: nomCherche,
          liste: res.ok
            ? res.valeur.filter((a) => normaliserNom(a.nom) === normaliserNom(nomCherche))
            : [],
          erreur: res.ok ? null : res.error,
        });
      })();
    }, 400);
    return () => {
      vivant = false;
      clearTimeout(t);
    };
  }, [mode, nomCherche, chercherAttributaires]);

  const repHomonymesUtile =
    mode === "creer" && repHomonymes?.pour === nomCherche ? repHomonymes : null;
  const homonymes = repHomonymesUtile?.liste ?? [];
  const homonymesIndecidable = repHomonymesUtile?.erreur ?? null;

  const viderChamps = () => {
    setNom("");
    setType("personne_physique");
    setPieceNature("");
    setPieceNum("");
    setTelephone("");
    setEmail("");
    setAdresse("");
  };

  const choisirMode = (m: Mode) => {
    setMode(m);
    setBase(null);
    setRecherche("");
    setReponse(null);
    viderChamps();
    envoi.oublierErreur();
  };

  const choisirFiche = (f: AttributaireFiche) => {
    setBase(f);
    setNom(f.nom);
    setType(f.type);
    setPieceNature(f.piece_nature ?? "");
    setPieceNum(f.piece_num ?? "");
    setTelephone(f.telephone ?? "");
    setEmail(f.email ?? "");
    setAdresse(f.adresse ?? "");
  };

  const valeurs = {
    nom: nom.trim(),
    type,
    piece_nature: pieceNature.trim(),
    piece_num: pieceNum.trim(),
    telephone: telephone.trim(),
    email: email.trim(),
    adresse: adresse.trim(),
  };

  const champsModifies = base
    ? CHAMPS_COMPARES.filter((c) =>
        c === "type" ? valeurs.type !== base.type : valeurs[c] !== vide(base[c] as string | null),
      ).length
    : 0;

  // En création, « saisie en cours » = le moindre champ rempli. En correction,
  // sélectionner une fiche ne coûte rien à refaire : seul un champ *changé*
  // mérite qu'on freine le geste de retour.
  const saisieEnCours = base
    ? champsModifies > 0
    : Object.values(valeurs).some((v) => v !== "" && v !== "personne_physique");
  // `&& !envoi.confirme` : les champs survivent à l'envoi, la garde restait
  // donc armée sur l'écran de confirmation et y annonçait un abandon.
  useRetourFormulaire(saisieEnCours && !envoi.confirme, () =>
    flash("Appuyez à nouveau pour abandonner cette saisie"),
  );

  if (envoi.confirme) {
    return (
      <EnvoiConfirme
        titre="Fiche attributaire"
        onBack={onBack}
        recapitulatif={envoi.confirme}
        onNouvelle={() => {
          envoi.reprendre();
          choisirMode(mode);
        }}
      />
    );
  }

  const pret =
    valeurs.nom.length > 0 && (base ? champsModifies > 0 : true) && (mode === "creer" || !!base);

  const envoyer = () => {
    if (!pret) return;
    // 🔴 Convention de `_appliquer_maj_attributaire` : **clé absente = valeur
    // inchangée, clé présente à `null` = effacement**. On envoie donc TOUJOURS
    // les sept clés, avec `null` pour un champ laissé vide : ce que l'écran
    // montre est exactement ce que la fiche vaudra. Envoyer seulement les
    // champs modifiés marcherait aussi, mais rendrait impossible d'effacer un
    // numéro de pièce erroné — or c'est précisément l'un des cas qui motivent
    // cet écran.
    const payload: PayloadMajAttributaire = {
      ...(base ? { attributaire_id: base.id } : {}),
      nom: valeurs.nom,
      type: valeurs.type,
      piece_nature: valeurs.piece_nature || null,
      piece_num: valeurs.piece_num || null,
      telephone: valeurs.telephone || null,
      email: valeurs.email || null,
      adresse: valeurs.adresse || null,
    };
    const resume: ResumeAttributaire = {
      nom: valeurs.nom,
      type_attributaire: valeurs.type,
      creation: !base,
      ...(base ? { champs_modifies: champsModifies } : {}),
    };
    void envoi.envoyer(
      {
        type: "maj_attributaire",
        lotissementId: null,
        titre: base
          ? `Correction de fiche — ${valeurs.nom}`
          : `Nouvel attributaire — ${valeurs.nom}`,
        payload,
        resume,
      },
      base
        ? `${champsModifies} champ${champsModifies > 1 ? "s" : ""} de la fiche de ${valeurs.nom} ${champsModifies > 1 ? "seront corrigés" : "sera corrigé"} après approbation.`
        : `La fiche de ${valeurs.nom} (${labelTypeAttributaire(valeurs.type)}) sera créée après approbation.`,
    );
  };

  const chargementRecherche =
    mode === "corriger" && motif.length >= MIN_RECHERCHE && reponse?.pour !== motif;

  return (
    <EcranSaisie
      titre="Attributaire"
      sousTitre={base ? `Correction — ${base.nom}` : creationInterdite ? "Corriger une fiche" : "Créer une fiche"}
      onBack={onBack}
      action={
        <BoutonEnvoyer onClick={envoyer} disabled={!pret} enCours={envoi.enCours} />
      }
    >
      <RappelFile />

      {/* La bascule disparaît quand une seule position est autorisée : un
          onglet grisé invite quand même à appuyer, puis n'explique rien. */}
      {creationInterdite ? (
        <p className="mb-4 text-[11.5px] leading-relaxed text-muted-foreground">
          Vous corrigez la fiche d&apos;un attributaire de votre juridiction. La{" "}
          <b>création</b> d&apos;une fiche relève du registre national — le serveur la
          refuserait ici.
        </p>
      ) : (
        <div className="mb-4 flex gap-2">
          <BoutonMode
            actif={mode === "creer"}
            onClick={() => choisirMode("creer")}
            libelle="Créer une fiche"
          />
          <BoutonMode
            actif={mode === "corriger"}
            onClick={() => choisirMode("corriger")}
            libelle="Corriger une fiche"
          />
        </div>
      )}

      {mode === "corriger" && !base && (
        <>
          <SectionLabel>Quelle fiche corriger ?</SectionLabel>
          <ChampRecherche
            value={recherche}
            onChange={setRecherche}
            placeholder="Nom de l'attributaire…"
          />
          {motif.length > 0 && motif.length < MIN_RECHERCHE && (
            <p className="mt-2 px-1 text-[11.5px] text-muted-foreground">
              Encore {MIN_RECHERCHE - motif.length} caractère
              {MIN_RECHERCHE - motif.length > 1 ? "s" : ""} pour lancer la recherche.
            </p>
          )}
          {chargementRecherche && <Chargement texte="Recherche…" />}
          {reponse?.pour === motif && reponse.erreur && (
            <div className="mt-3">
              <Avertissement>Recherche impossible : {reponse.erreur}</Avertissement>
            </div>
          )}
          {reponse?.pour === motif && !reponse.erreur && (
            <div className="mt-3 rounded-[18px] border border-border bg-card px-3 shadow-panel">
              {reponse.liste.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <UserSearch className="size-7 text-muted-2" />
                  <div className="text-[13.5px] font-semibold text-foreground">Aucune fiche</div>
                  <div className="text-[12px] text-muted-foreground">
                    Aucun attributaire ne porte ce nom. Passez par « Créer une fiche ».
                  </div>
                </div>
              ) : (
                reponse.liste.map((f) => (
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
                    onClick={() => choisirFiche(f)}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      {(mode === "creer" || base) && (
        <>
          {base && (
            <>
              {/* 🔴 Sortie explicite pour changer de fiche. Avant que l'onglet
                  actif ne devienne inerte (il vidait le formulaire sans rien
                  demander), le re-toucher était le geste — accidentel — qui
                  ramenait au sélecteur. Neutraliser l'onglet sans offrir ce
                  bouton laissait un cul-de-sac : la fiche ouverte par erreur
                  ne pouvait plus être quittée que par un détour. */}
              <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="text-[11.5px] text-muted-foreground">Fiche corrigée</div>
                  <div className="truncate text-[13.5px] font-semibold text-foreground">
                    {base.nom}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBase(null);
                    setRecherche("");
                    setReponse(null);
                    viderChamps();
                    envoi.oublierErreur();
                  }}
                  className="flex-none rounded-full border border-border-strong px-3 py-1.5 text-[12.5px] font-semibold text-foreground"
                >
                  Changer
                </button>
              </div>
              <div className="mb-3">
                <Avertissement>
                  Vous corrigez une fiche existante. <b>Ce que montre l&apos;écran est ce que la
                  fiche vaudra</b>{" "}
                  : un champ laissé vide sera effacé du registre.
                </Avertissement>
              </div>
            </>
          )}

          <SectionLabel>Identité</SectionLabel>
          <Carte>
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
          </Carte>

          {mode === "creer" && homonymesIndecidable && (
            <div className="mt-3">
              <Avertissement>
                Le contrôle d&apos;homonyme n&apos;a pas pu s&apos;exécuter ({homonymesIndecidable}).
                Une fiche portant ce nom existe <b>peut-être</b> déjà — l&apos;absence
                d&apos;avertissement ne prouve rien ici.
              </Avertissement>
            </div>
          )}

          {mode === "creer" && homonymes.length > 0 && (
            <div className="mt-3">
              <Avertissement>
                <b>
                  {homonymes.length === 1
                    ? "Une fiche porte déjà ce nom"
                    : `${homonymes.length} fiches portent déjà ce nom`}
                </b>{" "}
                au registre
                {homonymes[0].piece_num ? ` (pièce ${homonymes[0].piece_num})` : ""}. S&apos;il
                s&apos;agit de la même personne, passez par «&nbsp;Corriger une fiche&nbsp;» :
                deux fiches pour un même attributaire se fusionnent mal, et les attestations
                déjà délivrées restent attachées à la première.
              </Avertissement>
            </div>
          )}

          <SectionLabel className="mt-5">Pièce d&apos;identité</SectionLabel>
          <Carte>
            <Champ label="Nature de la pièce">
              <Texte value={pieceNature} onChange={setPieceNature} placeholder="CNI, passeport…" />
            </Champ>
            <Champ label="Numéro de la pièce">
              <Texte value={pieceNum} onChange={setPieceNum} placeholder="Ex. CI002123456789" />
            </Champ>
          </Carte>

          <SectionLabel className="mt-5">Coordonnées</SectionLabel>
          <Carte>
            <Champ label="Téléphone">
              <Texte
                value={telephone}
                onChange={setTelephone}
                type="tel"
                inputMode="tel"
                placeholder="+225 07 00 00 00 00"
              />
            </Champ>
            <Champ label="Adresse e-mail">
              <Texte
                value={email}
                onChange={setEmail}
                type="email"
                inputMode="email"
                placeholder="nom@exemple.ci"
              />
            </Champ>
            <Champ label="Adresse">
              <Texte value={adresse} onChange={setAdresse} placeholder="Quartier, commune…" />
            </Champ>
          </Carte>

          {base && (
            <p className="mt-3 px-1 text-[12px] text-muted-foreground">
              {champsModifies === 0
                ? "Aucun changement pour l'instant : la soumission n'aurait rien à appliquer."
                : `${champsModifies} champ${champsModifies > 1 ? "s" : ""} modifié${champsModifies > 1 ? "s" : ""}.`}
            </p>
          )}

          {envoi.erreur && (
            <div className="mt-4">
              <EchecEnvoi
                erreur={envoi.erreur}
                aide={aideTypeInvalide(envoi.erreur)}
                incertain={envoi.erreurIncertaine}
              />
            </div>
          )}
        </>
      )}
    </EcranSaisie>
  );
}

function BoutonMode({
  actif,
  onClick,
  libelle,
}: {
  actif: boolean;
  onClick: () => void;
  libelle: string;
}) {
  return (
    <button
      type="button"
      // Onglet déjà actif = aucun effet. `choisirMode` vide les champs sans
      // rien demander : le re-toucher effaçait la saisie en cours.
      onClick={() => {
        if (!actif) onClick();
      }}
      aria-pressed={actif}
      className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 text-[13.5px] font-semibold transition-colors ${
        actif ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"
      }`}
    >
      {libelle === "Créer une fiche" ? (
        <UserPlus className="size-[18px]" strokeWidth={1.9} />
      ) : (
        <UserSearch className="size-[18px]" strokeWidth={1.9} />
      )}
      {libelle}
    </button>
  );
}
