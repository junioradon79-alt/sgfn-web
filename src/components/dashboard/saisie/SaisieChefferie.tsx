"use client";

// Module de saisie du dashboard Chefferie (web).
//
// Demande du 29/07, verbatim : « le dashboard Chefferie devrait avoir la
// possibilité de saisir des modifications (Lots, Ilots, Attributaires,
// acquéreurs, etc.) qui seront soumises à validation par le Super Admin. »
//
// 🔴 UN SEUL CHEMIN D'ÉCRITURE : la RPC `soumettre_saisie`. Jamais un
// `.update()` sur `lots`, `ilots`, `lotissements` ou `attributaires` — le rôle
// `chefferie` n'y a **aucune policy d'écriture**, et un update sans policy
// touche **0 ligne sans lever d'erreur** : PostgREST rend 200, l'écran affiche
// un succès, rien n'a bougé. Ce dépôt a payé ce piège trois fois (cessions
// 22/07, APFC 28/07, dette #28 encore ouverte).
//
// 🆕 20/08/2026 — `maj_attributions` (réattribuer un lot : changement de
// propriétaire, cession, remise en disponibilité) est OUVERT à la chefferie
// (migration 20260820120000_reouverture_maj_attributions_chefferie.sql — le
// nom du fichier dit « réouverture », mais ce type n'avait JAMAIS été ouvert
// à la chefferie avant ce jour), borné à SA juridiction, avec au moins une
// opération exigée (une chefferie ne crée pas d'attributaire seul — arbitrage
// du propriétaire du projet) et le gel juridique refusé dès la soumission —
// toujours en maker-checker, jamais d'application directe. Demande du
// propriétaire du projet, verbatim : « Impossible de saisir manuellement les
// changements de propriétaires, cessions, etc. » puis, confirmation
// explicite : « Oui, rouvrir maj_attributions ».
//
// 🔴 CE QUI N'EST PAS ICI, et ne doit pas y arriver : `creation_structure`
// (fabriquer des îlots et des lots). `soumettre_saisie` le refuse à la
// chefferie — c'est un acte du registre national, la symétrie apparente avec
// les cinq formulaires ci-dessous est un piège.
//
// La couche de données est celle de l'app mobile (`useSaisieRegistre`) : c'est
// le même contrat serveur, et deux copies auraient divergé au premier champ
// ajouté.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Building2,
  Grid2x2,
  Loader2,
  Lock,
  PackageSearch,
  Search,
  Send,
  SquarePen,
  UserCog,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ds/button";
import { createClient } from "@/utils/supabase/client";
import {
  CLASSE_LABELS,
  NATURE_DROIT_OPTIONS,
  QUALITE_OPTIONS,
  TYPE_ATTRIBUTAIRE_OPTIONS,
  classifier,
  labelQualite,
  type CibleChoisie,
  type LotEtat,
  type NatureDroit,
  type NouvelAttributaire,
  type OperationCible,
  type PayloadMajAttributions,
  type PayloadModificationIlot,
  type PayloadModificationLot,
  type PayloadModificationLotissement,
  type Qualite,
  type ResumeAttributaire,
  type ResumeIlot,
  type ResumeLot,
  type ResumeLotissement,
  type ResumeMaj,
  type TypeAttributaire,
} from "@/lib/saisie";
import {
  useSaisieRegistre,
  type AttributaireFiche,
  type FicheLot,
  type FicheLotissement,
  type IlotOption,
  type LotissementOption,
} from "@/features/mobile/data/useSaisieRegistre";
import { AvertissementDocumentaire } from "./AvertissementDocumentaire";

type Onglet = "lotissement" | "attribution" | "lot" | "ilot" | "attributaire";

const ONGLETS: { key: Onglet; label: string; icon: typeof Building2 }[] = [
  { key: "lotissement", label: "Fiche du lotissement", icon: Building2 },
  { key: "attribution", label: "Attribution d'un lot", icon: ArrowRightLeft },
  { key: "lot", label: "Fiche d'un lot", icon: SquarePen },
  { key: "ilot", label: "Numéro d'un îlot", icon: Grid2x2 },
  { key: "attributaire", label: "Fiche d'un attributaire", icon: UserCog },
];

type Flash = { kind: "ok" | "err"; text: string };

const CHAMP =
  "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40";

/** `null` en base et chaîne vide à l'écran disent la même chose. */
const texte = (v: string | number | null | undefined) => (v == null ? "" : String(v));

const nombreOuNull = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function Ligne({ label, aide, children }: { label: string; aide?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {aide && <span className="text-[11.5px] leading-snug text-muted-foreground">{aide}</span>}
    </label>
  );
}

function Panneau({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">{children}</div>
  );
}

export function SaisieChefferie({
  juridictionId,
  onFlash,
}: {
  /** `autorite_coutumiere_id` du profil. `null` = compte non rattaché. */
  juridictionId: string | null;
  onFlash: (f: Flash | null) => void;
}) {
  const api = useSaisieRegistre(true, juridictionId);
  const [onglet, setOnglet] = useState<Onglet>("lotissement");
  const [lotissementId, setLotissementId] = useState("");

  // 🔴 Une chefferie sans rattachement n'obtient RIEN du serveur :
  // `ma_chefferie_id()` vaut NULL, la garde de juridiction ne trouve aucun
  // lotissement et chaque envoi est refusé. Le dire d'emblée vaut mieux que de
  // laisser remplir une fiche entière pour rien — le cas n'est pas théorique,
  // un compte `chefferie` sur deux est dans cette situation en production.
  if (!juridictionId) {
    return (
      <Panneau>
        <h2 className="text-sm font-semibold text-primary">Compte non rattaché</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Votre compte n&apos;est rattaché à aucune autorité coutumière. La saisie dans le
          registre est liée à une juridiction : sans rattachement, le serveur refuserait
          chaque envoi. Contactez l&apos;administration du SGNF.
        </p>
      </Panneau>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1 text-sm shadow-sm w-fit">
        {ONGLETS.map((o) => {
          const Icon = o.icon;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                setOnglet(o.key);
                onFlash(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 font-medium transition ${
                onglet === o.key ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-primary"
              }`}
            >
              <Icon className="size-3.5" />
              {o.label}
            </button>
          );
        })}
      </div>

      {/* La liste est déjà bornée à la juridiction par `useSaisieRegistre` ; ce
          n'est PAS une mesure de sécurité (la table est lisible publiquement),
          c'en est une d'honnêteté : proposer une fiche qu'on ne peut pas
          soumettre se paie après l'avoir remplie. */}
      <Panneau>
        <Ligne
          label="Lotissement"
          aide="Seuls les lotissements de votre juridiction sont proposés — ce sont les seuls que le serveur acceptera."
        >
          <select
            value={lotissementId}
            onChange={(e) => {
              setLotissementId(e.target.value);
              onFlash(null);
            }}
            className={`${CHAMP} sm:max-w-md`}
          >
            <option value="">— Sélectionner un lotissement —</option>
            {api.lotissements.map((l: LotissementOption) => (
              <option key={l.id} value={l.id}>
                {l.nom}
                {l.village ? ` — ${l.village}` : ""}
              </option>
            ))}
          </select>
        </Ligne>
        {api.erreur && (
          <p className="mt-3 text-sm text-danger">Liste des lotissements illisible : {api.erreur}</p>
        )}
      </Panneau>

      {lotissementId && (
        <>
          <AvertissementDocumentaire lotissementId={lotissementId} />

          {/* 🔴 `key={lotissementId}` : changer de lotissement REMONTE le
              formulaire au lieu de le réinitialiser champ par champ. Un
              formulaire qui garderait la fiche du lotissement précédent
              soumettrait des valeurs prises ailleurs — et la garde de
              juridiction, qui porte sur l'objet visé, ne verrait rien à
              redire. C'est aussi ce qui évite un `setState` dans le corps
              d'un effet. */}
          {onglet === "lotissement" && (
            <FormLotissement key={lotissementId} api={api} lotissementId={lotissementId} onFlash={onFlash} />
          )}
          {onglet === "attribution" && (
            <FormAttribution key={lotissementId} api={api} lotissementId={lotissementId} onFlash={onFlash} />
          )}
          {onglet === "lot" && (
            <FormLot key={lotissementId} api={api} lotissementId={lotissementId} onFlash={onFlash} />
          )}
          {onglet === "ilot" && (
            <FormIlot key={lotissementId} api={api} lotissementId={lotissementId} onFlash={onFlash} />
          )}
          {onglet === "attributaire" && <FormAttributaire api={api} onFlash={onFlash} />}
        </>
      )}
    </div>
  );
}

type Api = ReturnType<typeof useSaisieRegistre>;

function BoutonSoumettre({
  onClick,
  disabled,
  enCours,
  libelle = "Soumettre pour validation",
}: {
  onClick: () => void;
  disabled: boolean;
  enCours: boolean;
  libelle?: string;
}) {
  return (
    <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-5">
      <p className="text-xs text-muted-foreground">
        Rien n&apos;est appliqué avant l&apos;approbation d&apos;un administrateur.
      </p>
      <Button onClick={onClick} disabled={disabled || enCours}>
        {enCours ? <Loader2 className="animate-spin" /> : <Send />}
        {libelle}
      </Button>
    </div>
  );
}

/**
 * Petit utilitaire d'envoi commun aux quatre formulaires. Reprend le contrat de
 * `useSaisieRegistre.soumettre` : `incertain` distingue un **refus prouvé** du
 * serveur d'une réponse **perdue en vol**, et les deux ne se disent pas pareil.
 */
function useEnvoiWeb(api: Api, onFlash: (f: Flash | null) => void) {
  const [enCours, setEnCours] = useState(false);
  const envoyer = useCallback(
    async (envoi: Parameters<Api["soumettre"]>[0], succes: string): Promise<boolean> => {
      setEnCours(true);
      onFlash(null);
      const r = await api.soumettre(envoi);
      setEnCours(false);
      if (!r.ok) {
        onFlash({
          kind: "err",
          text: r.incertain
            ? `Envoi interrompu, issue inconnue : ${r.error}. La soumission a peut-être été enregistrée — vérifiez la file avant de renvoyer.`
            : r.error,
        });
        return false;
      }
      onFlash({ kind: "ok", text: succes });
      window.dispatchEvent(new Event("sgnf:refresh-badges"));
      return true;
    },
    [api, onFlash],
  );
  return { enCours, envoyer };
}

// ── Fiche du lotissement ────────────────────────────────────────────────────
//
// `_appliquer_modification_lotissement` a été corrigée le 30/07 : une clé
// absente laisse désormais la valeur en place. On envoie néanmoins la fiche
// ENTIÈRE, comme l'écran mobile : ce qui s'affiche **est** ce que la fiche
// vaudra, un champ vidé à la main sera vidé au registre — et c'est le seul
// moyen d'effacer une valeur erronée.
const CHAMPS_LOTISSEMENT = [
  ["nom", "Nom", undefined],
  ["village", "Village", undefined],
  ["commune", "Commune", undefined],
  ["district", "District", undefined],
  ["superficie_texte", "Superficie (texte)", undefined],
  ["nb_ilots", "Nombre d'îlots annoncé", undefined],
  ["nb_lots", "Nombre de lots annoncé", undefined],
  ["guide_reference", "Référence du guide de répartition", undefined],
  [
    "pv_numero_enregistrement",
    "PV du guide de répartition — numéro d'enregistrement",
    "La pièce que la condition documentaire réclamait sans qu'aucun écran ne permette de la fournir. Ouverte à la saisie le 30/07.",
  ],
  ["pv_identification_physique_numero", "PV d'identification physique — numéro", undefined],
  ["pv_identification_physique_date", "PV d'identification physique — date", undefined],
  ["pv_identification_physique_scan_url", "PV d'identification physique — lien du scan", undefined],
] as const;

type CleLotissement = (typeof CHAMPS_LOTISSEMENT)[number][0];

function FormLotissement({
  api,
  lotissementId,
  onFlash,
}: {
  api: Api;
  lotissementId: string;
  onFlash: (f: Flash | null) => void;
}) {
  const [fiche, setFiche] = useState<FicheLotissement | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [v, setV] = useState<Record<string, string>>({});
  const { enCours, envoyer } = useEnvoiWeb(api, onFlash);
  const { chargerFiche } = api;

  // Pas de remise à zéro ici : le composant est monté avec `key={lotissementId}`
  // par son parent, donc changer de lotissement le REMPLACE plutôt que de le
  // réinitialiser. C'est aussi ce qui évite d'appeler `setState` dans le corps
  // d'un effet (règle `react-hooks/set-state-in-effect`), et surtout d'afficher
  // une fraction de seconde la fiche du lotissement précédent.
  useEffect(() => {
    let actif = true;
    void (async () => {
      const r = await chargerFiche(lotissementId);
      if (!actif) return;
      if (!r.ok) {
        setErreur(r.error);
        return;
      }
      const f = r.valeur;
      setFiche(f);
      setV({
        nom: texte(f.nom),
        village: texte(f.village),
        commune: texte(f.commune),
        district: texte(f.district),
        superficie_texte: texte(f.superficie_texte),
        nb_ilots: texte(f.nb_ilots),
        nb_lots: texte(f.nb_lots),
        guide_reference: texte(f.guide_reference),
        // La colonne n'est pas chargée par `chargerFiche` (elle ne servait à
        // aucun écran jusqu'ici) : le champ part donc vide, et une chaîne vide
        // vaut « efface ». Il est rempli ci-dessous à la lecture séparée.
        pv_numero_enregistrement: "",
        pv_identification_physique_numero: texte(f.pv_identification_physique_numero),
        pv_identification_physique_date: texte(f.pv_identification_physique_date),
        pv_identification_physique_scan_url: texte(f.pv_identification_physique_scan_url),
      });
    })();
    return () => {
      actif = false;
    };
  }, [lotissementId, chargerFiche]);

  // 🔴 `pv_numero_enregistrement` est lue à part : `FicheLotissement` ne la
  // portait pas, et envoyer une chaîne vide sur une fiche qui en avait une
  // l'EFFACERAIT — sur la pièce même que ce chantier ouvre à la saisie.
  useEffect(() => {
    if (!fiche) return;
    let actif = true;
    void (async () => {
      const { data } = await createClient()
        .from("lotissements")
        .select("pv_numero_enregistrement")
        .eq("id", lotissementId)
        .maybeSingle();
      if (!actif || !data) return;
      setV((prev) => ({ ...prev, pv_numero_enregistrement: texte(data.pv_numero_enregistrement) }));
    })();
    return () => {
      actif = false;
    };
  }, [fiche, lotissementId]);

  if (erreur) return <Panneau><p className="text-sm text-danger">Fiche illisible : {erreur}</p></Panneau>;
  if (!fiche) {
    return (
      <Panneau>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement de la fiche…
        </div>
      </Panneau>
    );
  }

  const soumettre = () => {
    const payload: PayloadModificationLotissement = {
      lotissement_id: lotissementId,
      nom: v.nom.trim(),
      village: v.village.trim() || null,
      commune: v.commune.trim() || null,
      district: v.district.trim() || null,
      superficie_texte: v.superficie_texte.trim() || null,
      nb_ilots: nombreOuNull(v.nb_ilots),
      nb_lots: nombreOuNull(v.nb_lots),
      guide_reference: v.guide_reference.trim() || null,
      pv_numero_enregistrement: v.pv_numero_enregistrement.trim() || null,
      pv_identification_physique_numero: v.pv_identification_physique_numero.trim() || null,
      pv_identification_physique_date: v.pv_identification_physique_date.trim() || null,
      pv_identification_physique_scan_url: v.pv_identification_physique_scan_url.trim() || null,
    };
    const resume: ResumeLotissement = {
      nom_lotissement: payload.nom,
      localisation: [payload.village, payload.commune, payload.district].filter(Boolean).join(" · ") || null,
      nb_ilots: payload.nb_ilots ?? null,
      nb_lots: payload.nb_lots ?? null,
      champs_modifies: CHAMPS_LOTISSEMENT.filter(([k]) => {
        const avant =
          k === "pv_numero_enregistrement"
            ? undefined
            : ((fiche as unknown as Record<string, unknown>)[
                k === "pv_identification_physique_numero" ||
                k === "pv_identification_physique_date" ||
                k === "pv_identification_physique_scan_url"
                  ? k
                  : k
              ] ?? null);
        return avant === undefined ? true : texte(avant as string | number | null) !== v[k].trim();
      }).length,
    };
    void envoyer(
      {
        type: "modification_lotissement",
        lotissementId,
        titre: `Correction de fiche — ${payload.nom}`,
        payload,
        resume,
      },
      "Correction de fiche envoyée en validation.",
    );
  };

  return (
    <Panneau>
      <h2 className="text-sm font-semibold text-primary">Corriger la fiche du lotissement</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        La fiche vaudra <b>exactement</b> ce qui s&apos;affiche ci-dessous : un champ vidé à la
        main sera vidé au registre. Le rattachement à votre chefferie n&apos;est pas modifiable
        depuis cet écran.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {CHAMPS_LOTISSEMENT.map(([cle, label, aide]) => (
          <Ligne key={cle} label={label} aide={aide}>
            <input
              type={cle === "pv_identification_physique_date" ? "date" : "text"}
              value={v[cle] ?? ""}
              onChange={(e) => setV((p) => ({ ...p, [cle as CleLotissement]: e.target.value }))}
              className={CHAMP}
            />
          </Ligne>
        ))}
      </div>
      <BoutonSoumettre onClick={soumettre} disabled={!v.nom?.trim()} enCours={enCours} />
    </Panneau>
  );
}

// ── Attribution d'un lot (maj_attributions) ─────────────────────────────────
//
// 🆕 20/08/2026. Une opération à la fois — jamais de panier multi-lots —, sur
// le gabarit exact de l'écran mobile (`LotScreen.tsx`, app Pro, dossier
// `admin/saisie`) : un lot, un acte, un résumé vérifiable avant l'envoi.
// `_appliquer_maj_attributions` est pilotée par l'état CIBLE du lot (« ce lot
// doit finir libre / attribué à X »), jamais par un diff calculé ici — ce qui
// la rend résiliente à un état légèrement périmé.
//
// Le bandeau « Rien n'est appliqué avant l'approbation… » et l'avertissement
// documentaire sont déjà rendus par les composants communs du fichier
// (`BoutonSoumettre`, `AvertissementDocumentaire` au niveau du parent) : rien
// à dupliquer ici.
const REF_NOUVEAU = "nouveau-1";

function FormAttribution({
  api,
  lotissementId,
  onFlash,
}: {
  api: Api;
  lotissementId: string;
  onFlash: (f: Flash | null) => void;
}) {
  const [q, setQ] = useState("");
  const [lots, setLots] = useState<LotEtat[]>([]);
  const [lot, setLot] = useState<LotEtat | null>(null);
  const { enCours, envoyer } = useEnvoiWeb(api, onFlash);
  const { chercherLots, chercherAttributaires } = api;

  const [cible, setCible] = useState<"libre" | "attribue">("attribue");
  const [source, setSource] = useState<"existant" | "nouveau">("existant");
  const [qualite, setQualite] = useState<Qualite | null>(null);

  const [rechercheAtt, setRechercheAtt] = useState("");
  const [attributaires, setAttributaires] = useState<AttributaireFiche[]>([]);
  const [attributaire, setAttributaire] = useState<AttributaireFiche | null>(null);

  const [nom, setNom] = useState("");
  const [type, setType] = useState<TypeAttributaire>("personne_physique");
  const [pieceNature, setPieceNature] = useState("");
  const [pieceNum, setPieceNum] = useState("");
  const [telephone, setTelephone] = useState("");

  // Recherche des lots. Le motif vide est légitime : il ramène les premiers
  // lots du lotissement — point de départ pour qui ne connaît pas encore le
  // numéro. `chercherLots` filtre déjà par lotissement, mais ce bornage est
  // fait CÔTÉ CLIENT (`.eq("ilots.lotissement_id", …)` dans
  // `useSaisieRegistre.ts`), pas par la RLS : `select count(*) from lots` sous
  // le rôle chefferie rend le parc ENTIER (mesuré, 898 lignes). Le bornage
  // réel, celui qui empêche d'ÉCRIRE hors juridiction, est la garde serveur de
  // `soumettre_saisie` (migration 20260820120000) — celle-ci reste correcte.
  //
  // 🔴 Dette #45 : un échec de lecture (`r.ok === false`) doit être distingué
  // d'une liste vide, sur le modèle de l'écran mobile (`LotScreen.tsx`,
  // lignes ~370-373) — sinon un incident réseau ou une policy en défaut
  // s'affiche « Aucun lot ne correspond. », qui est un mensonge actif.
  const [erreurLots, setErreurLots] = useState<string | null>(null);
  useEffect(() => {
    if (lot) return;
    let actif = true;
    const t = setTimeout(() => {
      void (async () => {
        const r = await chercherLots(lotissementId, q);
        if (!actif) return;
        if (!r.ok) {
          setErreurLots(r.error);
          setLots([]);
          return;
        }
        setErreurLots(null);
        setLots(r.valeur);
      })();
    }, 250);
    return () => {
      actif = false;
      clearTimeout(t);
    };
  }, [lotissementId, q, lot, chercherLots]);

  const motifAtt = rechercheAtt.trim();
  // 🔴 Même correctif dette #45, ici plus grave : un échec silencieux
  // (`if (actif && r.ok) …`) laissait `attributaires` vide, et l'écran
  // affichait « Personne ne porte ce nom au registre. Basculez sur
  // 'Nouveau' » — poussant activement à créer un doublon d'attributaire à
  // cause d'une lecture ratée, pas d'une absence réelle.
  const [erreurAttributaires, setErreurAttributaires] = useState<string | null>(null);
  useEffect(() => {
    if (source !== "existant" || cible !== "attribue" || attributaire) return;
    if (motifAtt.length < 2) return;
    let actif = true;
    const t = setTimeout(() => {
      void (async () => {
        const r = await chercherAttributaires(motifAtt);
        if (!actif) return;
        if (!r.ok) {
          setErreurAttributaires(r.error);
          setAttributaires([]);
          return;
        }
        setErreurAttributaires(null);
        setAttributaires(r.valeur);
      })();
    }, 250);
    return () => {
      actif = false;
      clearTimeout(t);
    };
  }, [source, cible, attributaire, motifAtt, chercherAttributaires]);

  const oublierCible = () => {
    setCible("attribue");
    setSource("existant");
    setQualite(null);
    setRechercheAtt("");
    setAttributaires([]);
    setErreurAttributaires(null);
    setAttributaire(null);
    setNom("");
    setType("personne_physique");
    setPieceNature("");
    setPieceNum("");
    setTelephone("");
  };

  const choisirLot = (l: LotEtat) => {
    setLot(l);
    oublierCible();
  };

  // Nom affiché de la cible — celui qui apparaît dans le récapitulatif et le
  // titre de la soumission.
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
  // `classifier` (partagée avec le mobile) ne compare que l'attributaire. Un
  // lot sans attributaire mais dont le statut n'est pas « libre » (ex.
  // reserve_equipement) serait donc classé « aucun changement », alors que
  // `_appliquer_maj_attributions` fait bien `update lots set statut =
  // 'libre'`. Même correction que côté mobile (`LotScreen.tsx`), sur l'appelant
  // plutôt que dans `classifier`, dont le mobile dépend aussi.
  const classeCalculee =
    classeBrute === "inchange" && cible === "libre" && lot && lot.statut !== "libre"
      ? ("remise_libre" as const)
      : classeBrute;
  // Un lot gelé n'aura AUCUN acte : afficher « Remise en disponibilité » sous
  // l'avertissement qui dit que ce lot ne peut pas être remis en
  // disponibilité serait se contredire sur l'écran qui porte la règle.
  const classe = lot?.verrouille ? null : classeCalculee;

  // Une opération « inchangée » occuperait la file d'un administrateur pour
  // n'appliquer strictement rien : on l'arrête ici. Un lot sous gel juridique
  // est refusé pour une autre raison — un acte interdit, pas un acte inutile —
  // et la base le refuse désormais dès la soumission (migration
  // 20260820120000).
  const pret = !!lot && !lot.verrouille && !!cibleChoisie && classe !== null && classe !== "inchange";

  if (!lot) {
    return (
      <Panneau>
        <h2 className="text-sm font-semibold text-primary">Quel lot attribuer ?</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          Une opération à la fois : un lot, un acte, un résumé vérifiable avant l&apos;envoi.
        </p>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Numéro de lot…"
            className={`${CHAMP} pl-9 sm:max-w-md`}
          />
        </div>
        {erreurLots ? (
          <p className="mt-3 text-sm text-danger">Recherche impossible : {erreurLots}</p>
        ) : (
          <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-border">
            {lots.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <PackageSearch className="h-7 w-7 text-muted-2" />
                <div className="text-sm text-muted-2">Aucun lot ne correspond.</div>
              </div>
            ) : (
              lots.map((l) => (
                <button
                  key={l.lot_id}
                  type="button"
                  onClick={() => choisirLot(l)}
                  className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-inset"
                >
                  <span className="font-medium text-foreground">
                    {l.verrouille ? "🔒 " : ""}Îlot {l.ilot} · Lot {l.numero_lot}
                  </span>
                  <span className="truncate text-xs text-muted-2">
                    {l.verrouille
                      ? "gel juridique"
                      : l.attributaire_nom
                        ? `${l.attributaire_nom} — ${labelQualite(l.qualite)}`
                        : "libre"}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </Panneau>
    );
  }

  const soumettre = () => {
    if (!pret || !lot) return;

    const nouveaux: NouvelAttributaire[] =
      cible === "attribue" && source === "nouveau"
        ? [
            {
              ref: REF_NOUVEAU,
              nom: nom.trim(),
              type,
              ...(pieceNature.trim() ? { piece_nature: pieceNature.trim() } : {}),
              ...(pieceNum.trim() ? { piece_num: pieceNum.trim() } : {}),
              ...(telephone.trim() ? { telephone: telephone.trim() } : {}),
            },
          ]
        : [];

    // Les retours anticipés qui suivent sont inatteignables — `pret` exige
    // déjà une qualité et un attributaire résolu. Ils satisfont le typage de
    // `OperationCible` sans assertion `!`.
    let operation: OperationCible;
    if (cible === "libre") {
      operation = { lot_id: lot.lot_id, cible: "libre" };
    } else if (!qualite) {
      return;
    } else if (source === "existant") {
      if (!attributaire) return;
      operation = { lot_id: lot.lot_id, cible: "attribue", attributaire_id: attributaire.id, qualite };
    } else {
      operation = { lot_id: lot.lot_id, cible: "attribue", attributaire_ref: REF_NOUVEAU, qualite };
    }

    const payload: PayloadMajAttributions = {
      lotissement_id: lotissementId,
      nouveaux_attributaires: nouveaux,
      operations: [operation],
    };
    const resume: ResumeMaj = {
      nouvelles_attributions: classe === "nouvelle_attribution" ? 1 : 0,
      reassignations: classe === "reassignation" ? 1 : 0,
      remises_libre: classe === "remise_libre" ? 1 : 0,
      inchanges: 0,
      nouveaux_attributaires: nouveaux.length,
    };

    const ouLot = `îlot ${lot.ilot} · lot ${lot.numero_lot}`;
    void envoyer(
      {
        type: "maj_attributions",
        lotissementId,
        titre: `Attribution — ${ouLot}`,
        payload,
        resume,
      },
      cible === "libre"
        ? `Le ${ouLot} sera remis en disponibilité après approbation.`
        : `Le ${ouLot} sera attribué à ${nomCible} (${labelQualite(qualite)}) après approbation.`,
    );
  };

  return (
    <Panneau>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-primary">
          Îlot {lot.ilot} · Lot {lot.numero_lot}
        </h2>
        <button
          type="button"
          onClick={() => setLot(null)}
          className="text-sm font-medium text-primary hover:underline"
        >
          Choisir un autre lot
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-border bg-inset/60 px-3.5 py-2.5 text-sm">
        <span className="font-medium text-foreground">{lot.attributaire_nom ?? "Aucun attributaire"}</span>
        <span className="ml-1.5 text-muted-foreground">
          {lot.attributaire_nom
            ? `— ${labelQualite(lot.qualite)} · statut « ${lot.statut} »`
            : `Statut « ${lot.statut} »`}
        </span>
      </div>

      {/* Le gel n'est pas une nuance d'affichage : il ferme le formulaire.
          Placé juste sous la situation actuelle, avant les choix, pour ne pas
          faire remplir une cible qui ne partira jamais — refus dès la
          soumission depuis la migration 20260820120000. */}
      {lot.verrouille && (
        <div className="mt-3 flex gap-2.5 rounded-xl border border-warning/45 bg-warning-subtle px-3.5 py-2.5 text-sm text-foreground">
          <Lock className="mt-px h-4 w-4 flex-none text-warning" />
          <div>
            <b>Ce lot est sous gel juridique.</b> Il ne peut être ni réattribué ni remis en
            disponibilité : le serveur refuse la soumission. Le gel se lève depuis la fiche du lot,
            par un administrateur.
          </div>
        </div>
      )}

      {!lot.verrouille && (
        <>
          <div className="mt-4 flex gap-2">
            {[
              { key: "attribue" as const, label: "Attribué à…" },
              { key: "libre" as const, label: "Libre" },
            ].map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  setCible(o.key);
                  onFlash(null);
                }}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  cible === o.key
                    ? "border-primary bg-primary text-white"
                    : "border-border text-muted-foreground hover:bg-inset"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {cible === "libre" ? (
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
              {lot.attributaire_id ? (
                <>
                  L&apos;attribution en cours sera close et le lot repassera en <b>libre</b>.
                  L&apos;historique des attributions est conservé — rien n&apos;est effacé.
                </>
              ) : (
                <>
                  Le lot n&apos;a pas d&apos;attributaire : seul son <b>statut</b> changera, de «&nbsp;
                  {lot.statut}&nbsp;» à «&nbsp;libre&nbsp;».
                </>
              )}
            </p>
          ) : (
            <>
              <div className="mt-3 flex gap-2">
                {[
                  { key: "existant" as const, label: "Attributaire connu" },
                  { key: "nouveau" as const, label: "Nouveau" },
                ].map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => {
                      setSource(o.key);
                      setAttributaire(null);
                      setRechercheAtt("");
                      setAttributaires([]);
                    }}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                      source === o.key
                        ? "border-primary bg-primary text-white"
                        : "border-border text-muted-foreground hover:bg-inset"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {source === "existant" ? (
                <div className="mt-3">
                  {attributaire ? (
                    <div className="flex items-center justify-between rounded-xl border border-success/30 bg-success-subtle px-3 py-2 text-sm">
                      <span className="font-medium text-success">{attributaire.nom}</span>
                      <button
                        type="button"
                        onClick={() => setAttributaire(null)}
                        className="rounded-full p-1 text-success hover:bg-card"
                      >
                        Changer
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
                        <input
                          value={rechercheAtt}
                          onChange={(e) => setRechercheAtt(e.target.value)}
                          placeholder="Nom de l'attributaire…"
                          className={`${CHAMP} pl-9`}
                        />
                      </div>
                      {/* 🔴 Dette #45 : une erreur de lecture n'est PAS une absence de
                          résultat — la confondre pousse activement à créer un doublon.
                          Distinction reprise du gabarit mobile (`LotScreen.tsx`, ~563-566) :
                          erreur d'abord, résultats ensuite, absence de résultat seulement
                          quand la recherche a RÉUSSI et n'a rien trouvé. */}
                      {motifAtt.length >= 2 && erreurAttributaires && (
                        <p className="mt-2 text-[11.5px] text-danger">
                          Recherche impossible : {erreurAttributaires}
                        </p>
                      )}
                      {motifAtt.length >= 2 && !erreurAttributaires && attributaires.length > 0 && (
                        <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-card shadow-sm">
                          {attributaires.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => setAttributaire(a)}
                              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-inset"
                            >
                              <span className="font-medium text-foreground">{a.nom}</span>
                              <span className="truncate text-xs text-muted-2">{a.piece_num ?? ""}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {motifAtt.length >= 2 && !erreurAttributaires && attributaires.length === 0 && (
                        <p className="mt-2 flex items-center gap-1.5 px-1 text-[11.5px] text-muted-foreground">
                          <UserPlus className="h-3.5 w-3.5" /> Personne ne porte ce nom au registre.
                          Basculez sur « Nouveau » pour créer la fiche en même temps que
                          l&apos;attribution.
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <>
                  <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                    La fiche sera créée <b>à l&apos;approbation</b>, en même temps que
                    l&apos;attribution. Vérifiez d&apos;abord dans « Attributaire connu » que la
                    personne n&apos;existe pas déjà.
                  </p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Ligne label="Nom" aide="Prénom NOM, ou raison sociale">
                      <input value={nom} onChange={(e) => setNom(e.target.value)} className={CHAMP} />
                    </Ligne>
                    <Ligne label="Type">
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as TypeAttributaire)}
                        className={CHAMP}
                      >
                        {TYPE_ATTRIBUTAIRE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </Ligne>
                    <Ligne label="Nature de la pièce">
                      <input
                        value={pieceNature}
                        onChange={(e) => setPieceNature(e.target.value)}
                        placeholder="CNI, passeport…"
                        className={CHAMP}
                      />
                    </Ligne>
                    <Ligne label="Numéro de la pièce">
                      <input value={pieceNum} onChange={(e) => setPieceNum(e.target.value)} className={CHAMP} />
                    </Ligne>
                    <Ligne label="Téléphone">
                      <input
                        value={telephone}
                        onChange={(e) => setTelephone(e.target.value)}
                        type="tel"
                        placeholder="+225 07 00 00 00 00"
                        className={CHAMP}
                      />
                    </Ligne>
                  </div>
                </>
              )}

              <div className="mt-4">
                <Ligne
                  label="Qualité de l'attribution"
                  aide="Elle détermine la portée juridique de l'acte et figure sur l'attestation."
                >
                  <select
                    value={qualite ?? ""}
                    onChange={(e) => setQualite((e.target.value || null) as Qualite | null)}
                    className={CHAMP}
                  >
                    <option value="">— Sélectionner —</option>
                    {QUALITE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Ligne>
              </div>
            </>
          )}

          {/* Nature exacte de l'acte, calculée par `classifier` — la même
              fonction que le mobile : « attribuer » à un lot déjà attribué
              n'est pas une attribution mais une réassignation. */}
          {classe && (
            <div className="mt-4">
              {classe === "inchange" ? (
                <p className="rounded-xl border border-border bg-inset/60 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
                  <b>{CLASSE_LABELS.inchange}.</b> Le lot est déjà exactement dans cet état : la
                  soumission n&apos;appliquerait rien et occuperait la file pour rien.
                </p>
              ) : (
                <p className="rounded-xl border border-accent/40 bg-accent-subtle px-3.5 py-2.5 text-[12.5px] text-foreground">
                  Acte soumis : <b>{CLASSE_LABELS[classe]}</b>
                  {classe === "reassignation" && lot.attributaire_nom && (
                    <> — l&apos;attribution de {lot.attributaire_nom} sera close.</>
                  )}
                </p>
              )}
            </div>
          )}
        </>
      )}

      <BoutonSoumettre onClick={soumettre} disabled={!pret} enCours={enCours} />
    </Panneau>
  );
}

// ── Fiche d'un lot ──────────────────────────────────────────────────────────

function FormLot({
  api,
  lotissementId,
  onFlash,
}: {
  api: Api;
  lotissementId: string;
  onFlash: (f: Flash | null) => void;
}) {
  const [q, setQ] = useState("");
  const [lots, setLots] = useState<{ id: string; label: string; detail: string }[]>([]);
  const [fiche, setFiche] = useState<FicheLot | null>(null);
  const [v, setV] = useState<Record<string, string>>({});
  const [nature, setNature] = useState<NatureDroit | "">("");
  const { enCours, envoyer } = useEnvoiWeb(api, onFlash);
  const { chercherLots, chargerFicheLot } = api;

  useEffect(() => {
    let actif = true;
    const t = setTimeout(() => {
      void (async () => {
        const r = await chercherLots(lotissementId, q);
        if (!actif || !r.ok) return;
        setLots(
          r.valeur.map((l) => ({
            id: l.lot_id,
            label: `${l.verrouille ? "🔒 " : ""}Îlot ${l.ilot} · Lot ${l.numero_lot}`,
            detail: l.verrouille ? "gel juridique" : (l.attributaire_nom ?? "libre"),
          })),
        );
      })();
    }, 250);
    return () => {
      actif = false;
      clearTimeout(t);
    };
  }, [lotissementId, q, chercherLots]);

  const ouvrir = async (id: string) => {
    const r = await chargerFicheLot(id);
    if (!r.ok) {
      onFlash({ kind: "err", text: `Fiche du lot illisible : ${r.error}` });
      return;
    }
    const f = r.valeur;
    setFiche(f);
    setNature(f.nature_droit ?? "");
    setV({
      numero_lot: texte(f.numero_lot),
      numero_parcelle: texte(f.numero_parcelle),
      superficie_m2: texte(f.superficie_m2),
      guide_page: texte(f.guide_page),
      latitude: texte(f.latitude),
      longitude: texte(f.longitude),
      observation: texte(f.observation),
    });
  };

  // Seuls les champs réellement modifiés partent : la fonction laisse intact
  // tout champ absent du payload (convention `case when p_payload ? 'clé'`).
  const changes: Partial<PayloadModificationLot> = {};
  if (fiche) {
    if (v.numero_lot?.trim() && v.numero_lot.trim() !== texte(fiche.numero_lot)) changes.numero_lot = v.numero_lot.trim();
    if (v.numero_parcelle?.trim() !== texte(fiche.numero_parcelle)) changes.numero_parcelle = v.numero_parcelle.trim() || null;
    if (v.superficie_m2?.trim() !== texte(fiche.superficie_m2)) changes.superficie_m2 = nombreOuNull(v.superficie_m2);
    if ((nature || null) !== fiche.nature_droit) changes.nature_droit = nature || null;
    if (v.guide_page?.trim() !== texte(fiche.guide_page)) changes.guide_page = nombreOuNull(v.guide_page);
    if (v.latitude?.trim() !== texte(fiche.latitude)) changes.latitude = nombreOuNull(v.latitude);
    if (v.longitude?.trim() !== texte(fiche.longitude)) changes.longitude = nombreOuNull(v.longitude);
    if (v.observation?.trim() !== texte(fiche.observation)) changes.observation = v.observation.trim() || null;
  }
  const nb = Object.keys(changes).length;

  if (!fiche) {
    return (
      <Panneau>
        <h2 className="text-sm font-semibold text-primary">Quel lot corriger ?</h2>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Numéro de lot…"
            className={`${CHAMP} pl-9 sm:max-w-md`}
          />
        </div>
        <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-border">
          {lots.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-2">Aucun lot ne correspond.</div>
          ) : (
            lots.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => void ouvrir(l.id)}
                className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-inset"
              >
                <span className="font-medium text-foreground">{l.label}</span>
                <span className="truncate text-xs text-muted-2">{l.detail}</span>
              </button>
            ))
          )}
        </div>
      </Panneau>
    );
  }

  const designation = `Îlot ${fiche.ilot_numero} · Lot ${texte(fiche.numero_lot) || "—"}`;

  const soumettre = () => {
    const payload: PayloadModificationLot = { lot_id: fiche.id, ...changes };
    const resume: ResumeLot = {
      designation,
      lotissement: api.lotissements.find((l) => l.id === lotissementId)?.nom ?? null,
      champs_modifies: nb,
    };
    void envoyer(
      { type: "modification_lot", lotissementId: null, titre: `Correction de lot — ${designation}`, payload, resume },
      "Correction de lot envoyée en validation.",
    );
  };

  return (
    <Panneau>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-primary">{designation}</h2>
        <button
          type="button"
          onClick={() => setFiche(null)}
          className="text-sm font-medium text-primary hover:underline"
        >
          Choisir un autre lot
        </button>
      </div>

      {/* 🔴 Le gel juridique est refusé DÈS LA SOUMISSION depuis le 30/07
          (migration 20260730090000) : `soumettre_saisie` rend l'erreur à la
          personne qui saisit. Auparavant seule `_appliquer_modification_lot`
          refusait — la chefferie remplissait, envoyait, et c'est
          l'ADMINISTRATEUR qui recevait l'erreur. Le dire ici, avant que la
          fiche ne soit remplie. */}
      {fiche.verrouille && (
        <div className="mt-3 flex gap-2.5 rounded-xl border border-warning/45 bg-warning-subtle px-3.5 py-2.5 text-sm text-foreground">
          <Lock className="mt-px h-4 w-4 flex-none text-warning" />
          <div>
            <b>Ce lot est sous gel juridique.</b> Sa fiche ne peut pas être corrigée : le
            serveur refuse la soumission. Le gel se lève depuis la fiche du lot, par un
            administrateur.
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Ligne label="Numéro du lot" aide="Laissé vide, le numéro actuel est conservé.">
          <input value={v.numero_lot ?? ""} onChange={(e) => setV((p) => ({ ...p, numero_lot: e.target.value }))} className={CHAMP} />
        </Ligne>
        <Ligne label="Numéro de parcelle">
          <input value={v.numero_parcelle ?? ""} onChange={(e) => setV((p) => ({ ...p, numero_parcelle: e.target.value }))} className={CHAMP} />
        </Ligne>
        <Ligne label="Superficie (m²)">
          <input value={v.superficie_m2 ?? ""} onChange={(e) => setV((p) => ({ ...p, superficie_m2: e.target.value }))} className={CHAMP} />
        </Ligne>
        <Ligne label="Nature du droit">
          <select value={nature} onChange={(e) => setNature(e.target.value as NatureDroit | "")} className={CHAMP}>
            <option value="">— Non renseignée —</option>
            {NATURE_DROIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Ligne>
        <Ligne label="Page du guide de répartition">
          <input value={v.guide_page ?? ""} onChange={(e) => setV((p) => ({ ...p, guide_page: e.target.value }))} className={CHAMP} />
        </Ligne>
        <Ligne label="Latitude">
          <input value={v.latitude ?? ""} onChange={(e) => setV((p) => ({ ...p, latitude: e.target.value }))} className={CHAMP} />
        </Ligne>
        <Ligne label="Longitude">
          <input value={v.longitude ?? ""} onChange={(e) => setV((p) => ({ ...p, longitude: e.target.value }))} className={CHAMP} />
        </Ligne>
        <Ligne label="Observation">
          <input value={v.observation ?? ""} onChange={(e) => setV((p) => ({ ...p, observation: e.target.value }))} className={CHAMP} />
        </Ligne>
      </div>

      <p className="mt-4 text-[11.5px] leading-relaxed text-muted-foreground">
        {nb === 0
          ? "Aucun champ modifié — seuls les champs réellement changés sont envoyés."
          : `${nb} champ(s) modifié(s). Les autres ne partent pas dans la soumission et restent tels quels.`}{" "}
        Cet écran ne change ni l&apos;îlot du lot, ni son statut, ni son attributaire.
      </p>

      <BoutonSoumettre onClick={soumettre} disabled={nb === 0 || fiche.verrouille} enCours={enCours} />
    </Panneau>
  );
}

// ── Numéro d'un îlot ────────────────────────────────────────────────────────

function FormIlot({
  api,
  lotissementId,
  onFlash,
}: {
  api: Api;
  lotissementId: string;
  onFlash: (f: Flash | null) => void;
}) {
  const [ilots, setIlots] = useState<IlotOption[] | null>(null);
  const [choisi, setChoisi] = useState<IlotOption | null>(null);
  const [numero, setNumero] = useState("");
  const { enCours, envoyer } = useEnvoiWeb(api, onFlash);
  const { chargerIlots } = api;

  // Idem : remonté par `key={lotissementId}`, jamais réinitialisé sur place.
  useEffect(() => {
    let actif = true;
    void (async () => {
      const r = await chargerIlots(lotissementId);
      if (!actif) return;
      if (!r.ok) {
        onFlash({ kind: "err", text: `Liste des îlots illisible : ${r.error}` });
        setIlots([]);
        return;
      }
      setIlots(r.valeur);
    })();
    return () => {
      actif = false;
    };
  }, [lotissementId, chargerIlots, onFlash]);

  const change = !!choisi && numero.trim().length > 0 && numero.trim() !== choisi.numero;

  const soumettre = () => {
    if (!choisi) return;
    const payload: PayloadModificationIlot = { ilot_id: choisi.id, numero: numero.trim() };
    const resume: ResumeIlot = {
      numero_avant: choisi.numero,
      numero_apres: numero.trim(),
      lotissement: api.lotissements.find((l) => l.id === lotissementId)?.nom ?? null,
      nb_lots: choisi.nb_lots,
    };
    void envoyer(
      {
        type: "modification_ilot",
        lotissementId: null,
        titre: `Renumérotation d'îlot — ${choisi.numero} → ${numero.trim()}`,
        payload,
        resume,
      },
      "Renumérotation envoyée en validation.",
    );
  };

  return (
    <Panneau>
      <h2 className="text-sm font-semibold text-primary">Corriger le numéro d&apos;un îlot</h2>
      {ilots === null ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des îlots…
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Ligne label="Îlot">
            <select
              value={choisi?.id ?? ""}
              onChange={(e) => {
                const i = ilots.find((x) => x.id === e.target.value) ?? null;
                setChoisi(i);
                setNumero(i?.numero ?? "");
              }}
              className={CHAMP}
            >
              <option value="">— Sélectionner un îlot —</option>
              {ilots.map((i) => (
                <option key={i.id} value={i.id}>
                  Îlot {i.numero} — {i.nb_lots} lot(s)
                </option>
              ))}
            </select>
          </Ligne>
          <Ligne label="Nouveau numéro" aide="Un numéro vide serait refusé : l'îlot garderait l'ancien.">
            <input value={numero} onChange={(e) => setNumero(e.target.value)} className={CHAMP} />
          </Ligne>
        </div>
      )}

      {/* Un mot changé, et toute la désignation de ses lots change avec lui. */}
      {choisi && choisi.nb_lots > 0 && (
        <div className="mt-4 rounded-xl border border-warning/45 bg-warning-subtle px-3.5 py-2.5 text-sm text-foreground">
          Cet îlot porte <b>{choisi.nb_lots} lot(s)</b>. Les renuméroter change leur désignation
          partout — y compris sur les attestations délivrées ensuite. Les attestations{" "}
          <b>déjà délivrées</b> gardent l&apos;ancien numéro imprimé.
        </div>
      )}

      <p className="mt-4 text-[11.5px] leading-relaxed text-muted-foreground">
        Cet écran ne déplace pas l&apos;îlot vers un autre lotissement : il n&apos;en corrige
        que le numéro.
      </p>

      <BoutonSoumettre onClick={soumettre} disabled={!change} enCours={enCours} />
    </Panneau>
  );
}

// ── Fiche d'un attributaire ─────────────────────────────────────────────────
//
// 🔴 CORRECTION SEULEMENT. `soumettre_saisie` refuse à une chefferie tout
// payload `maj_attributaire` sans `attributaire_id`, et vérifie en plus que
// l'attributaire visé détient un lot de sa juridiction — c'est le périmètre
// posé le 30/07 (`lot_ids_chefferie`), appliqué à l'écriture. La recherche
// ci-dessous est bornée par la RLS au même périmètre : une chefferie ne voit
// plus les 57 attributaires du pays, seulement les siens.

const CHAMPS_ATTRIBUTAIRE = [
  ["nom", "Nom complet"],
  ["piece_nature", "Nature de la pièce"],
  ["piece_num", "Numéro de pièce"],
  ["telephone", "Téléphone"],
  ["email", "E-mail"],
  ["adresse", "Adresse"],
] as const;

function FormAttributaire({ api, onFlash }: { api: Api; onFlash: (f: Flash | null) => void }) {
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<AttributaireFiche[]>([]);
  const [base, setBase] = useState<AttributaireFiche | null>(null);
  const [v, setV] = useState<Record<string, string>>({});
  const [type, setType] = useState("personne_physique");
  const { enCours, envoyer } = useEnvoiWeb(api, onFlash);
  const { chercherAttributaires, lotissementDeAttributaire } = api;
  // 🔴 Le lotissement de rattachement, uniquement pour AFFICHER l'avertissement
  // documentaire. Ce type ne passait par aucun sélecteur de lotissement, si
  // bien que l'avertissement ne s'affichait pas — alors que l'arbitrage du
  // propriétaire du projet veut les pièces manquantes nommées AUX DEUX BOUTS.
  // La valeur n'est pas envoyée : le serveur dérive la sienne, dans la
  // juridiction.
  const [lotissementDuDossier, setLotissementDuDossier] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) return;
    let actif = true;
    const t = setTimeout(() => {
      void (async () => {
        const r = await chercherAttributaires(q);
        if (actif && r.ok) setResultats(r.valeur);
      })();
    }, 250);
    return () => {
      actif = false;
      clearTimeout(t);
    };
  }, [q, chercherAttributaires]);

  const ouvrir = (a: AttributaireFiche) => {
    setBase(a);
    setLotissementDuDossier(null);
    void (async () => {
      const r = await lotissementDeAttributaire(a.id);
      // Un échec laisse `null` : l'avertissement ne s'affiche alors pas. C'est
      // le seul repli honnête — inventer un lotissement ferait porter
      // l'avertissement sur le mauvais dossier.
      if (r.ok) setLotissementDuDossier(r.valeur);
    })();
    setType(a.type);
    setV({
      nom: texte(a.nom),
      piece_nature: texte(a.piece_nature),
      piece_num: texte(a.piece_num),
      telephone: texte(a.telephone),
      email: texte(a.email),
      adresse: texte(a.adresse),
    });
  };

  const modifies = useMemo(() => {
    if (!base) return 0;
    const b = base as unknown as Record<string, string | null>;
    let n = CHAMPS_ATTRIBUTAIRE.filter(([k]) => texte(b[k]) !== (v[k] ?? "").trim()).length;
    if (type !== base.type) n += 1;
    return n;
  }, [base, v, type]);

  if (!base) {
    return (
      <Panneau>
        <h2 className="text-sm font-semibold text-primary">Quelle fiche corriger ?</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          Seuls les attributaires détenant un lot de votre juridiction sont proposés. La{" "}
          <b>création</b> d&apos;une fiche relève du registre national — le serveur la
          refuserait ici.
        </p>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom de l'attributaire…"
            className={`${CHAMP} pl-9 sm:max-w-md`}
          />
        </div>
        {q.trim().length >= 2 && (
          <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-border">
            {resultats.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-2">
                Aucun attributaire de votre juridiction ne porte ce nom.
              </div>
            ) : (
              resultats.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => ouvrir(a)}
                  className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-inset"
                >
                  <span className="font-medium text-foreground">{a.nom}</span>
                  <span className="truncate text-xs text-muted-2">{a.piece_num ?? ""}</span>
                </button>
              ))
            )}
          </div>
        )}
      </Panneau>
    );
  }

  const soumettre = () => {
    // Convention `_appliquer_maj_attributaire` : clé absente = inchangé, clé à
    // `null` = effacement. On envoie donc la fiche complète, valeurs vides
    // comprises — c'est ce qui permet d'effacer une pièce erronée.
    const payload = {
      attributaire_id: base.id,
      nom: v.nom.trim(),
      type: type as ResumeAttributaire["type_attributaire"],
      piece_nature: v.piece_nature.trim() || null,
      piece_num: v.piece_num.trim() || null,
      telephone: v.telephone.trim() || null,
      email: v.email.trim() || null,
      adresse: v.adresse.trim() || null,
    };
    const resume: ResumeAttributaire = {
      nom: payload.nom,
      type_attributaire: payload.type,
      creation: false,
      champs_modifies: modifies,
    };
    void envoyer(
      {
        type: "maj_attributaire",
        lotissementId: null,
        titre: `Correction de fiche — ${payload.nom}`,
        payload,
        resume,
      },
      "Correction de fiche d'attributaire envoyée en validation.",
    );
  };

  return (
    <Panneau>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-primary">Correction — {base.nom}</h2>
        <button
          type="button"
          onClick={() => setBase(null)}
          className="text-sm font-medium text-primary hover:underline"
        >
          Choisir une autre fiche
        </button>
      </div>
      <div className="mt-3">
        <AvertissementDocumentaire lotissementId={lotissementDuDossier} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Ligne label="Type">
          <select value={type} onChange={(e) => setType(e.target.value)} className={CHAMP}>
            {TYPE_ATTRIBUTAIRE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Ligne>
        {CHAMPS_ATTRIBUTAIRE.map(([cle, label]) => (
          <Ligne key={cle} label={label}>
            <input
              value={v[cle] ?? ""}
              onChange={(e) => setV((p) => ({ ...p, [cle]: e.target.value }))}
              className={CHAMP}
            />
          </Ligne>
        ))}
      </div>
      <p className="mt-4 text-[11.5px] leading-relaxed text-muted-foreground">
        {modifies} champ(s) modifié(s). Un champ vidé sera <b>effacé</b> de la fiche : ce nom
        figure sur les attestations délivrées.
      </p>
      <BoutonSoumettre onClick={soumettre} disabled={modifies === 0 || !v.nom?.trim()} enCours={enCours} />
    </Panneau>
  );
}
