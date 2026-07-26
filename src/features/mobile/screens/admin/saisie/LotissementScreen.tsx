"use client";

// Lotissement — créer une fiche, ou corriger une fiche existante.
// Types `creation_lotissement` / `modification_lotissement`.
//
// 🔴 PIÈGE VÉRIFIÉ EN BASE, à relire à chaque évolution de cet écran.
// `_appliquer_modification_lotissement` écrit :
//
//     village = nullif(btrim(payload->>'village'), '')
//
// **sans `coalesce`**, et de même pour commune, district, superficie_texte,
// nb_lots, nb_ilots, guide_reference et les trois champs de PV. Autrement dit :
// toute clé absente du payload est **remise à NULL en base**. Seul `nom` est
// protégé (lui seul passe par un `coalesce`).
//
// Conséquence structurante : cet écran **charge la fiche complète et la renvoie
// entière**, champs non modifiés compris. Un formulaire qui n'enverrait que le
// champ corrigé — le réflexe naturel, et ce que fait la plupart des écrans
// d'édition — viderait la fiche de tout le reste. C'est pour cela que le
// formulaire n'est jamais accessible avant que `chargerFiche` ait répondu :
// sans la fiche d'origine, il n'y a rien à renvoyer, donc rien à préserver.
//
// Corollaire visible à l'écran : ce qui est affiché **est** ce que la fiche
// vaudra. Un champ vidé à la main sera vidé au registre — c'est voulu, c'est
// même le seul moyen d'effacer une valeur erronée, mais il faut le dire.
//
// ⚠️ `autorite_coutumiere_id` fait exception : la fonction de modification ne
// touche pas cette colonne. Le rattachement à une chefferie ne se déplace donc
// pas depuis cet écran, et l'y proposer ferait croire le contraire.

import { useEffect, useState, type ReactNode } from "react";
import { Building2, FilePlus2, FileSearch } from "lucide-react";

import { useRetourFormulaire } from "@/lib/android-back";
import type {
  PayloadLotissement,
  PayloadModificationLotissement,
  ResumeLotissement,
} from "@/lib/saisie";
import type { FicheLotissement, SaisieRegistre } from "../../../data/useSaisieRegistre";
import {
  Avertissement,
  BoutonEnvoyer,
  Carte,
  Champ,
  Chargement,
  ChoixLotissement,
  EchecEnvoi,
  EcranSaisie,
  EnvoiConfirme,
  RappelFile,
  SectionLabel,
  Selection,
  Texte,
  useEnvoi,
} from "./champs";

type Mode = "creer" | "modifier";

/**
 * Le formulaire est tenu **en texte**, y compris les deux nombres : c'est ce
 * que rend un `<input>`, et c'est aussi ce que lit la base
 * (`nullif(p_payload->>'nb_lots', '')::int`). Convertir plus tôt obligerait à
 * inventer une valeur pour « champ en cours de frappe », qui n'existe pas.
 */
type Champs = {
  nom: string;
  village: string;
  commune: string;
  district: string;
  superficie_texte: string;
  nb_lots: string;
  nb_ilots: string;
  guide_reference: string;
  /** Création seulement — la modification ne touche pas ce rattachement. */
  autorite_coutumiere_id: string;
  pv_numero: string;
  pv_date: string;
  pv_scan_url: string;
};

const VIDE: Champs = {
  nom: "",
  village: "",
  commune: "",
  district: "",
  superficie_texte: "",
  nb_lots: "",
  nb_ilots: "",
  guide_reference: "",
  autorite_coutumiere_id: "",
  pv_numero: "",
  pv_date: "",
  pv_scan_url: "",
};

/** `null` en base et chaîne vide à l'écran disent la même chose. */
const texte = (v: string | number | null) => (v == null ? "" : String(v));

function depuisFiche(f: FicheLotissement): Champs {
  return {
    nom: texte(f.nom),
    village: texte(f.village),
    commune: texte(f.commune),
    district: texte(f.district),
    superficie_texte: texte(f.superficie_texte),
    nb_lots: texte(f.nb_lots),
    nb_ilots: texte(f.nb_ilots),
    guide_reference: texte(f.guide_reference),
    autorite_coutumiere_id: texte(f.autorite_coutumiere_id),
    pv_numero: texte(f.pv_identification_physique_numero),
    pv_date: texte(f.pv_identification_physique_date),
    pv_scan_url: texte(f.pv_identification_physique_scan_url),
  };
}

/** Champs réellement comparés dans le décompte d'une correction. */
const COMPARES = [
  "nom",
  "village",
  "commune",
  "district",
  "superficie_texte",
  "nb_lots",
  "nb_ilots",
  "guide_reference",
  "pv_numero",
  "pv_date",
  "pv_scan_url",
] as const;

const t = (v: string) => v.trim();
const ou = (v: string) => t(v) || null;

/**
 * Un nombre saisi au pouce peut contenir une espace ou une virgule. La base
 * ferait un `::int` dessus et l'approbation échouerait — bien plus tard, sur
 * l'écran de quelqu'un d'autre. On normalise ici, et ce qui n'est pas un
 * nombre ne part pas.
 */
function nombre(v: string): number | null {
  const brut = t(v).replace(/[\s ]/g, "");
  if (!brut) return null;
  const n = Number(brut);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function LotissementScreen({
  api,
  onBack,
  flash,
}: {
  api: SaisieRegistre;
  onBack: () => void;
  flash: (msg: string) => void;
}) {
  const { chargerFiche } = api;
  const envoi = useEnvoi(api.soumettre);

  const [mode, setMode] = useState<Mode>("creer");
  /**
   * `fiche` non nulle = correction ; `null` = création. Les deux voyagent
   * ensemble parce que les champs n'ont de sens qu'avec leur origine : c'est
   * elle qui sert de référence au décompte des modifications, et c'est son
   * absence qui interdit d'ouvrir le formulaire de correction trop tôt.
   */
  const [edition, setEdition] = useState<{ fiche: FicheLotissement | null; champs: Champs } | null>({
    fiche: null,
    champs: VIDE,
  });
  const [demande, setDemande] = useState<string | null>(null);
  const [reponse, setReponse] = useState<{ pour: string; erreur: string | null } | null>(null);

  useEffect(() => {
    if (mode !== "modifier" || !demande) return;
    let vivant = true;
    void (async () => {
      const res = await chargerFiche(demande);
      if (!vivant) return;
      if (res.ok) {
        setEdition({ fiche: res.valeur, champs: depuisFiche(res.valeur) });
        setReponse({ pour: demande, erreur: null });
        return;
      }
      setReponse({ pour: demande, erreur: res.error });
    })();
    return () => {
      vivant = false;
    };
  }, [mode, demande, chargerFiche]);

  const choisirMode = (m: Mode) => {
    setMode(m);
    setDemande(null);
    setReponse(null);
    // En création le formulaire s'ouvre tout de suite ; en correction il reste
    // fermé tant que la fiche d'origine n'est pas là (cf. le piège en tête).
    setEdition(m === "creer" ? { fiche: null, champs: VIDE } : null);
    envoi.oublierErreur();
  };

  const champs = edition?.champs ?? VIDE;
  const fiche = edition?.fiche ?? null;
  const origine = fiche ? depuisFiche(fiche) : null;

  const poser = (cle: keyof Champs, valeur: string) =>
    setEdition((e) => (e ? { ...e, champs: { ...e.champs, [cle]: valeur } } : e));

  const champsModifies = origine
    ? COMPARES.filter((c) => t(champs[c]) !== t(origine[c])).length
    : 0;

  const saisieEnCours = origine
    ? champsModifies > 0
    : Object.values(champs).some((v) => t(v) !== "");
  useRetourFormulaire(saisieEnCours, () => flash("Appuyez à nouveau pour abandonner cette saisie"));

  if (envoi.confirme) {
    return (
      <EnvoiConfirme
        titre="Fiche de lotissement"
        onBack={onBack}
        recapitulatif={envoi.confirme}
        onNouvelle={() => {
          envoi.reprendre();
          choisirMode(mode);
        }}
      />
    );
  }

  const nom = t(champs.nom);
  const pret = nom.length > 0 && (origine ? champsModifies > 0 : true);

  const envoyer = () => {
    if (!pret) return;

    // 🔴 Les onze clés partent **toujours**, remplies ou non. C'est la
    // contrepartie directe du piège documenté en tête de fichier : côté base,
    // une clé absente vaut effacement. Ne transmettre que les champs modifiés
    // — réflexe habituel — viderait tout le reste de la fiche.
    const commun: PayloadLotissement = {
      nom,
      village: ou(champs.village),
      commune: ou(champs.commune),
      district: ou(champs.district),
      superficie_texte: ou(champs.superficie_texte),
      nb_lots: nombre(champs.nb_lots),
      nb_ilots: nombre(champs.nb_ilots),
      guide_reference: ou(champs.guide_reference),
      pv_identification_physique_numero: ou(champs.pv_numero),
      pv_identification_physique_date: ou(champs.pv_date),
      pv_identification_physique_scan_url: ou(champs.pv_scan_url),
    };

    const localisation =
      [champs.village, champs.commune, champs.district].map(t).filter(Boolean).join(" · ") || null;

    const resume: ResumeLotissement = {
      nom_lotissement: nom,
      localisation,
      nb_ilots: nombre(champs.nb_ilots),
      nb_lots: nombre(champs.nb_lots),
      ...(fiche ? { champs_modifies: champsModifies } : {}),
    };

    if (fiche) {
      const payload: PayloadModificationLotissement = { ...commun, lotissement_id: fiche.id };
      void envoi.envoyer(
        {
          type: "modification_lotissement",
          lotissementId: fiche.id,
          titre: `Fiche corrigée — ${nom}`,
          payload,
          resume,
        },
        `${champsModifies} champ${champsModifies > 1 ? "s" : ""} de la fiche « ${nom} » ${champsModifies > 1 ? "seront corrigés" : "sera corrigé"} après approbation.`,
      );
      return;
    }

    void envoi.envoyer(
      {
        type: "creation_lotissement",
        lotissementId: null,
        titre: `Nouveau lotissement — ${nom}`,
        // L'autorité coutumière n'est écrite qu'à la **création** : c'est le
        // seul moment où cette clé a un effet, d'où sa présence ici et son
        // absence du payload de modification.
        payload: { ...commun, autorite_coutumiere_id: ou(champs.autorite_coutumiere_id) },
        resume,
      },
      `Le lotissement « ${nom} » sera créé après approbation. Aucun îlot ni lot n'est créé par cette fiche.`,
    );
  };

  // ── Choix de la fiche à corriger ───────────────────────────────────────────
  if (mode === "modifier" && !edition) {
    const chargement = demande !== null && reponse?.pour !== demande;
    return (
      <EcranSaisie titre="Lotissement" sousTitre="Corriger une fiche" onBack={onBack}>
        <RappelFile />
        <Onglets mode={mode} onMode={choisirMode} />
        <SectionLabel>Quelle fiche corriger ?</SectionLabel>
        {chargement ? (
          <Chargement texte="Chargement de la fiche…" />
        ) : (
          <>
            {reponse?.erreur && (
              <div className="mb-3">
                <Avertissement>Fiche illisible : {reponse.erreur}</Avertissement>
              </div>
            )}
            <ChoixLotissement
              lotissements={api.lotissements}
              onChoisir={(id) => {
                setDemande(id);
                setReponse(null);
              }}
              loading={api.loading}
              erreur={api.erreur}
            />
          </>
        )}
      </EcranSaisie>
    );
  }

  // ── Formulaire ─────────────────────────────────────────────────────────────
  return (
    <EcranSaisie
      titre="Lotissement"
      sousTitre={fiche ? `Correction — ${fiche.nom}` : "Nouvelle fiche"}
      onBack={onBack}
      action={<BoutonEnvoyer onClick={envoyer} disabled={!pret} enCours={envoi.enCours} />}
    >
      <RappelFile />
      <Onglets mode={mode} onMode={choisirMode} />

      <div className="mb-4">
        {fiche ? (
          <Avertissement>
            <b>Ce que montre l&apos;écran est ce que la fiche vaudra.</b>{" "}
            Tous les champs sont renvoyés, pas seulement ceux que vous changez — un champ vidé
            ici sera vidé au registre.
          </Avertissement>
        ) : (
          <Avertissement>
            Cette fiche décrit un lotissement ; elle ne crée <b>ni îlot ni lot</b>. Les volumes
            saisis plus bas sont des chiffres annoncés, pas un contenu.
          </Avertissement>
        )}
      </div>

      <SectionLabel>Identification</SectionLabel>
      <Carte>
        <Champ label="Nom du lotissement" obligatoire>
          <Texte
            value={champs.nom}
            onChange={(v) => poser("nom", v)}
            placeholder="Ex. Brignan Extension"
            autoCapitalize="words"
          />
        </Champ>
        <Champ label="Référence du guide de répartition">
          <Texte
            value={champs.guide_reference}
            onChange={(v) => poser("guide_reference", v)}
            placeholder="Ex. GR-2024-018"
          />
        </Champ>
      </Carte>

      <SectionLabel className="mt-5">Localisation</SectionLabel>
      <Carte>
        <Champ label="Village">
          <Texte
            value={champs.village}
            onChange={(v) => poser("village", v)}
            autoCapitalize="words"
          />
        </Champ>
        <Champ label="Commune">
          <Texte
            value={champs.commune}
            onChange={(v) => poser("commune", v)}
            autoCapitalize="words"
          />
        </Champ>
        <Champ label="District">
          <Texte
            value={champs.district}
            onChange={(v) => poser("district", v)}
            placeholder="Ex. Abidjan"
            autoCapitalize="words"
          />
        </Champ>
        <Champ label="Superficie" aide="Texte libre, tel qu'il figure sur les documents.">
          <Texte
            value={champs.superficie_texte}
            onChange={(v) => poser("superficie_texte", v)}
            placeholder="Ex. 12 ha 45 a"
          />
        </Champ>
      </Carte>

      <SectionLabel className="mt-5">Volumes annoncés</SectionLabel>
      <Carte>
        <Champ
          label="Nombre d'îlots"
          aide="Chiffre déclaré sur la fiche. Il ne crée aucun îlot."
        >
          <Texte
            value={champs.nb_ilots}
            onChange={(v) => poser("nb_ilots", v)}
            inputMode="numeric"
            placeholder="Ex. 14"
          />
        </Champ>
        <Champ label="Nombre de lots" aide="Chiffre déclaré sur la fiche. Il ne crée aucun lot.">
          <Texte
            value={champs.nb_lots}
            onChange={(v) => poser("nb_lots", v)}
            inputMode="numeric"
            placeholder="Ex. 386"
          />
        </Champ>
      </Carte>

      <SectionLabel className="mt-5">Autorité coutumière</SectionLabel>
      {fiche ? (
        // Affichage seul : la fonction d'application ne touche pas cette
        // colonne. Un sélecteur actif ici laisserait croire qu'on peut déplacer
        // un lotissement d'une chefferie à une autre depuis le téléphone.
        <Carte>
          <div className="flex items-start gap-3">
            <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-inset text-primary">
              <Building2 className="size-5" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-foreground">
                {fiche.autorite_nom ?? "Aucun rattachement"}
              </div>
              <div className="text-[11.5px] text-muted-foreground">
                Le rattachement à une chefferie ne se modifie pas depuis l&apos;application.
              </div>
            </div>
          </div>
        </Carte>
      ) : (
        <Carte>
          <Champ label="Chefferie de rattachement">
            <Selection
              value={champs.autorite_coutumiere_id}
              onChange={(v) => poser("autorite_coutumiere_id", v)}
              options={api.autorites}
              vide="Aucun rattachement"
            />
          </Champ>
        </Carte>
      )}

      <SectionLabel className="mt-5">PV d&apos;identification physique</SectionLabel>
      <Carte>
        <Champ label="Numéro du PV">
          <Texte value={champs.pv_numero} onChange={(v) => poser("pv_numero", v)} />
        </Champ>
        <Champ label="Date du PV">
          <Texte value={champs.pv_date} onChange={(v) => poser("pv_date", v)} type="date" />
        </Champ>
        <Champ label="Lien vers le scan" aide="Adresse du document déjà déposé.">
          <Texte
            value={champs.pv_scan_url}
            onChange={(v) => poser("pv_scan_url", v)}
            type="url"
            inputMode="url"
            autoCapitalize="none"
          />
        </Champ>
      </Carte>

      {origine && (
        <p className="mt-3 px-1 text-[12px] text-muted-foreground">
          {champsModifies === 0
            ? "Aucun changement pour l'instant : la soumission n'aurait rien à appliquer."
            : `${champsModifies} champ${champsModifies > 1 ? "s" : ""} modifié${champsModifies > 1 ? "s" : ""}.`}
        </p>
      )}

      {envoi.erreur && (
        <div className="mt-4">
          <EchecEnvoi erreur={envoi.erreur} />
        </div>
      )}
    </EcranSaisie>
  );
}

function Onglets({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
  return (
    <div className="mb-4 flex gap-2">
      <Onglet
        actif={mode === "creer"}
        onClick={() => onMode("creer")}
        libelle="Créer une fiche"
        icone={<FilePlus2 className="size-[18px]" strokeWidth={1.9} />}
      />
      <Onglet
        actif={mode === "modifier"}
        onClick={() => onMode("modifier")}
        libelle="Corriger une fiche"
        icone={<FileSearch className="size-[18px]" strokeWidth={1.9} />}
      />
    </div>
  );
}

function Onglet({
  actif,
  onClick,
  libelle,
  icone,
}: {
  actif: boolean;
  onClick: () => void;
  libelle: string;
  icone: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 text-[13.5px] font-semibold transition-colors ${
        actif
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground"
      }`}
    >
      {icone}
      {libelle}
    </button>
  );
}
