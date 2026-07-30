"use client";

// Couche de données des écrans de saisie du registre (app mobile, expérience
// admin).
//
// 🔴 Un seul chemin d'écriture : la RPC `soumettre_saisie`. Les cinq tables du
// registre (`lotissements`, `ilots`, `lots`, `attributaires`, `attributions`)
// n'ont qu'une policy d'écriture, `est_admin()` — un administrateur *pourrait*
// donc écrire directement depuis le téléphone. On ne le fait pas : le
// maker-checker est la seule trace de qui a changé quoi, et une écriture
// directe la perdrait. Le propriétaire du projet a tranché en ce sens : tout
// passe par la file de validation, administrateur compris.
//
// D'où la forme de ce module : il **lit** le registre pour alimenter les
// formulaires, et n'en **écrit** rien. La seule fonction sortante est
// `soumettre`, qui dépose dans `soumissions_saisie`.
//
// Client porteur de session (`@/utils/supabase/client`), jamais le singleton
// `@/lib/supabase` : ce dernier interroge en anonyme, et comme la plupart des
// tables du registre sont lisibles publiquement, la panne serait invisible en
// lecture pour ne se manifester qu'à l'écriture.

import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/utils/supabase/client";
import type {
  LotEtat,
  NatureDroit,
  PayloadCreationStructure,
  PayloadLotissement,
  PayloadMajAttributaire,
  PayloadMajAttributions,
  PayloadModificationIlot,
  PayloadModificationLot,
  PayloadModificationLotissement,
  Qualite,
  ResumeAttributaire,
  ResumeCreation,
  ResumeIlot,
  ResumeLot,
  ResumeLotissement,
  ResumeMaj,
  TypeAttributaire,
} from "@/lib/saisie";
import type { Json } from "../../../../database.types";

/** Une réponse réseau ne se réduit jamais à `null` : l'erreur doit remonter. */
export type Resultat<T> =
  | { ok: true; valeur: T }
  | {
      ok: false;
      error: string;
      /**
       * 🔴 « L'envoi n'a produit aucun effet » est une affirmation, pas un
       * constat. Un refus du serveur (« Type de soumission invalide », « Action
       * réservée… ») la garantit : la fonction s'est exécutée et a dit non. Une
       * réponse **perdue en vol** ne garantit rien du tout — la soumission peut
       * très bien avoir été enregistrée avant que la connexion ne tombe.
       * Ce drapeau distingue les deux ; `undefined` vaut « refus certain », le
       * cas des lectures, où la question ne se pose pas.
       */
      incertain?: boolean;
    };

export type LotissementOption = {
  id: string;
  nom: string;
  village: string | null;
  commune: string | null;
};

export type AttributaireFiche = {
  id: string;
  nom: string;
  type: TypeAttributaire;
  piece_nature: string | null;
  piece_num: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
};

/**
 * La fiche complète d'un lotissement, telle qu'il faut la **renvoyer entière**
 * en modification (cf. le piège documenté sur `PayloadModificationLotissement`).
 * Tous les champs écrits par la fonction d'application y figurent, y compris
 * ceux que le formulaire n'affiche qu'en second plan.
 */
export type FicheLotissement = {
  id: string;
  nom: string;
  village: string | null;
  commune: string | null;
  district: string | null;
  superficie_texte: string | null;
  nb_lots: number | null;
  nb_ilots: number | null;
  guide_reference: string | null;
  autorite_coutumiere_id: string | null;
  /** Pour l'affichage seul : la modification ne touche pas ce rattachement. */
  autorite_nom: string | null;
  pv_identification_physique_numero: string | null;
  pv_identification_physique_date: string | null;
  pv_identification_physique_scan_url: string | null;
};

/**
 * Un rattachement proposé dans un sélecteur (autorité coutumière, opérateur,
 * famille). Trois listes de même forme : ce sont des identités à désigner, pas
 * des valeurs métier — d'où un type unique plutôt que trois copies.
 */
export type RefOption = { id: string; nom: string };
/** Conservé sous son nom d'origine : il est déjà employé par les écrans. */
export type AutoriteOption = RefOption;

/**
 * Ce qui part dans la file. Le type discrimine le triplet
 * (type, payload, resume) : c'est ce qui empêche d'envoyer un payload de
 * lotissement sous le type `maj_attributions`, erreur qui ne se verrait qu'à
 * l'approbation, c'est-à-dire trop tard.
 *
 * `lotissementId` alimente la colonne `lotissement_id` de la file (elle sert au
 * rattachement et, pour une chefferie, au contrôle de juridiction) : `null`
 * partout où la soumission ne porte pas sur un lotissement déjà existant.
 */
export type EnvoiSaisie =
  | {
      // 🔴 `null`, et ce n'est PAS un oubli : depuis la migration
      // 20260730090000 le serveur dérive lui-même le lotissement depuis les
      // lots que l'attributaire détient — dans SA juridiction s'il s'agit d'une
      // chefferie. C'est cette valeur-là qui est enregistrée dans la file, et
      // c'est elle qui fait apparaître l'avertissement documentaire côté
      // approbateur. En envoyer une ici laisserait croire qu'elle fait foi, et
      // permettrait de faire porter l'avertissement de l'admin sur un dossier
      // choisi par celui qui soumet.
      type: "maj_attributaire";
      lotissementId: null;
      titre: string;
      payload: PayloadMajAttributaire;
      resume: ResumeAttributaire;
    }
  | {
      type: "maj_attributions";
      lotissementId: string;
      titre: string;
      payload: PayloadMajAttributions;
      resume: ResumeMaj;
    }
  | {
      type: "creation_lotissement";
      lotissementId: null;
      titre: string;
      payload: PayloadLotissement;
      resume: ResumeLotissement;
    }
  | {
      type: "modification_lotissement";
      lotissementId: string;
      titre: string;
      payload: PayloadModificationLotissement;
      resume: ResumeLotissement;
    }
  | {
      type: "creation_structure";
      lotissementId: null;
      titre: string;
      payload: PayloadCreationStructure;
      resume: ResumeCreation;
    }
  | {
      // `lotissementId` reste `null` : le serveur remonte lui-même le
      // lotissement depuis `lot_id`, et c'est SA valeur qui est enregistrée
      // dans la file comme contrôlée pour la juridiction. En envoyer une ici
      // laisserait croire qu'elle fait foi.
      type: "modification_lot";
      lotissementId: null;
      titre: string;
      payload: PayloadModificationLot;
      resume: ResumeLot;
    }
  | {
      type: "modification_ilot";
      lotissementId: null;
      titre: string;
      payload: PayloadModificationIlot;
      resume: ResumeIlot;
    };

/**
 * La fiche **descriptive** d'un lot (`modification_lot`). Rigoureusement les
 * colonnes que `_appliquer_modification_lot` écrit — ni `statut`, ni
 * `verrouille`, ni `ilot_id`, que la fonction refuse d'écrire.
 *
 * `verrouille` figure quand même ici, en LECTURE seule : un lot sous gel
 * juridique est refusé à l'approbation, et le dire avant que la fiche ne soit
 * remplie vaut mieux que de le découvrir après.
 */
export type FicheLot = {
  id: string;
  ilot_numero: string;
  numero_lot: string | null;
  numero_parcelle: string | null;
  est_equipement: boolean | null;
  superficie_m2: number | null;
  nature_droit: NatureDroit | null;
  observation: string | null;
  guide_page: number | null;
  latitude: number | null;
  longitude: number | null;
  verrouille: boolean;
};

/** Un îlot du lotissement, avec le nombre de lots qu'il porte. */
export type IlotOption = { id: string; numero: string; nb_lots: number };

export type SaisieRegistre = {
  lotissements: LotissementOption[];
  autorites: AutoriteOption[];
  /** Rattachements proposés à la création d'une structure (`creation_structure`). */
  operateurs: RefOption[];
  familles: RefOption[];
  /** Vrai tant que les référentiels des sélecteurs n'ont pas répondu. */
  loading: boolean;
  erreur: string | null;
  /**
   * Libellés des listes **facultatives** dont le chargement a échoué. Une liste
   * vide par échec et une liste vide par nature se ressemblent à l'écran ; seul
   * ce champ les distingue.
   */
  listesEnEchec: string[];
  recharger: () => Promise<void>;
  chercherAttributaires: (q: string) => Promise<Resultat<AttributaireFiche[]>>;
  chargerFiche: (lotissementId: string) => Promise<Resultat<FicheLotissement>>;
  chercherLots: (lotissementId: string, q: string) => Promise<Resultat<LotEtat[]>>;
  chargerFicheLot: (lotId: string) => Promise<Resultat<FicheLot>>;
  chargerIlots: (lotissementId: string) => Promise<Resultat<IlotOption[]>>;
  /**
   * Le lotissement auquel rattacher la correction d'un attributaire — `null`
   * s'il n'en détient aucun lot visible.
   *
   * 🔴 Il ne sert **qu'à afficher l'avertissement documentaire** au moment de
   * soumettre. Il n'est PAS envoyé au serveur : depuis la migration
   * 20260730090000, `soumettre_saisie` dérive lui-même ce lotissement, et pour
   * une chefferie il le dérive dans SA juridiction. Une valeur envoyée par le
   * client serait une affirmation de l'appelant, et l'avertissement porterait
   * alors sur un dossier choisi par celui-là même qui soumet.
   *
   * ⚠️ Cette lecture est bornée par la RLS, qui reste plus large que la garde
   * d'écriture (elle accorde aussi la famille de rattachement) : elle peut donc
   * nommer un lotissement que le serveur refusera. Elle informe, elle
   * n'autorise rien.
   */
  lotissementDeAttributaire: (attributaireId: string) => Promise<Resultat<string | null>>;
  soumettre: (envoi: EnvoiSaisie) => Promise<Resultat<string>>;
};

/**
 * Un `%`, un `_` ou un `*` tapé dans une recherche deviendrait un joker : la
 * liste renverrait alors tout le registre au lieu de rien, ce qui ressemble à
 * un résultat et n'en est pas. Aucun numéro de lot ni nom d'attributaire ne
 * contient ces caractères — les retirer est sans perte.
 */
function nettoyerRecherche(q: string): string {
  return q.trim().replace(/[%_*\\]/g, "");
}

/** Au-delà, la liste ne se parcourt plus au pouce : c'est la recherche qui doit affiner. */
const LIMITE_RESULTATS = 25;

const COLONNES_FICHE =
  "id, nom, village, commune, district, superficie_texte, nb_lots, nb_ilots, guide_reference, " +
  "autorite_coutumiere_id, pv_identification_physique_numero, pv_identification_physique_date, " +
  "pv_identification_physique_scan_url, autorites_coutumieres(nom)";

type LigneLot = {
  id: string;
  numero_lot: string | null;
  statut: string | null;
  verrouille: boolean | null;
  ilots: { numero: string | null } | null;
};

type LigneAttribution = {
  lot_id: string | null;
  attributaire_id: string | null;
  qualite: string | null;
  attributaires: { nom: string | null } | null;
};

/**
 * `actif` évite de charger les référentiels tant que l'écran n'est pas ouvert :
 * ils vivent derrière un calque, et la liste des lotissements se paie sur un
 * forfait téléphone.
 *
 * `juridictionId` restreint la liste des lotissements à une autorité
 * coutumière. 🔴 Ce n'est PAS une mesure de sécurité — la table est lisible
 * publiquement (`lotissements_public_read`, dont se sert la vitrine), et c'est
 * `soumettre_saisie` qui refuse en dernier ressort tout lotissement hors
 * juridiction. C'est une mesure d'honnêteté : sans elle, une chefferie se
 * verrait proposer des fiches qu'elle ne peut pas soumettre, et l'apprendrait
 * seulement après les avoir remplies. `null` = aucune restriction.
 */
export function useSaisieRegistre(actif: boolean, juridictionId: string | null = null): SaisieRegistre {
  const [supabase] = useState(() => createClient());
  // `null` = jamais chargé, ce qui distingue « on attend » de « il n'y en a
  // pas ». Même raison que dans `useSoumissions` : un booléen de chargement
  // posé depuis l'effet reste bloqué à `true` sur toute sortie anticipée.
  const [referentiels, setReferentiels] = useState<{
    lotissements: LotissementOption[];
    autorites: AutoriteOption[];
    operateurs: RefOption[];
    familles: RefOption[];
  } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  /** Listes facultatives dont le chargement a échoué (vides, mais pas vides en base). */
  const [listesEnEchec, setListesEnEchec] = useState<string[]>([]);

  // Une réponse peut revenir après que l'admin a quitté l'écran.
  const monte = useRef(true);
  useEffect(() => {
    monte.current = true;
    return () => {
      monte.current = false;
    };
  }, []);

  const charger = useCallback(async () => {
    const requeteLotissements = supabase.from("lotissements").select("id, nom, village, commune");
    const [lots, auts, ops, fams] = await Promise.all([
      (juridictionId
        ? requeteLotissements.eq("autorite_coutumiere_id", juridictionId)
        : requeteLotissements
      ).order("nom"),
      supabase.from("autorites_coutumieres").select("id, nom").order("nom"),
      supabase.from("operateurs").select("id, nom").order("nom"),
      supabase.from("familles").select("id, nom").order("nom"),
    ]);
    if (!monte.current) return;
    // Seule la liste des lotissements est bloquante : sans elle, ni la
    // modification de fiche ni l'attribution d'un lot ne sont possibles. Les
    // trois listes de rattachement, elles, sont facultatives dans le payload
    // (`creation_structure` accepte un lotissement sans autorité, sans opérateur
    // et sans famille) : une liste vide dégrade le formulaire sans l'empêcher.
    if (lots.error) {
      setErreur(lots.error.message);
      return;
    }
    setErreur(null);
    // 🔴 Une liste facultative en échec revenait `[]` — indistinguable d'un
    // référentiel réellement vide. Le formulaire affichait « Liste
    // indisponible » sans que personne ne puisse savoir s'il n'y a aucune
    // autorité coutumière en base ou si la requête a échoué. On garde donc la
    // trace de celles qui ont échoué, pour que l'écran puisse le dire.
    const echecs: string[] = [];
    if (auts.error) echecs.push("autorités coutumières");
    if (ops.error) echecs.push("opérateurs");
    if (fams.error) echecs.push("familles");
    setListesEnEchec(echecs);
    setReferentiels({
      lotissements: (lots.data ?? []) as LotissementOption[],
      autorites: (auts.data ?? []) as AutoriteOption[],
      operateurs: (ops.data ?? []) as RefOption[],
      familles: (fams.data ?? []) as RefOption[],
    });
  }, [supabase, juridictionId]);

  useEffect(() => {
    if (!actif) return;
    // Enveloppé dans une fonction asynchrone : le premier `setState` n'a lieu
    // qu'au retour du réseau, jamais pendant le rendu de l'effet (règle
    // `react-hooks/set-state-in-effect`).
    void (async () => {
      await charger();
    })();
  }, [actif, charger]);

  const chercherAttributaires = useCallback(
    async (q: string): Promise<Resultat<AttributaireFiche[]>> => {
      const motif = nettoyerRecherche(q);
      if (!motif) return { ok: true, valeur: [] };
      const { data, error } = await supabase
        .from("attributaires")
        .select("id, nom, type, piece_nature, piece_num, telephone, email, adresse")
        .ilike("nom", `%${motif}%`)
        .order("nom")
        .limit(LIMITE_RESULTATS);
      if (error) return { ok: false, error: error.message };
      return { ok: true, valeur: (data ?? []) as AttributaireFiche[] };
    },
    [supabase],
  );

  const chargerFiche = useCallback(
    async (lotissementId: string): Promise<Resultat<FicheLotissement>> => {
      const { data, error } = await supabase
        .from("lotissements")
        .select(COLONNES_FICHE)
        .eq("id", lotissementId)
        .single();
      if (error) return { ok: false, error: error.message };
      if (!data) return { ok: false, error: "Lotissement introuvable." };
      const r = data as unknown as Omit<FicheLotissement, "autorite_nom"> & {
        autorites_coutumieres: { nom: string | null } | null;
      };
      return {
        ok: true,
        valeur: {
          id: r.id,
          nom: r.nom,
          village: r.village,
          commune: r.commune,
          district: r.district,
          superficie_texte: r.superficie_texte,
          nb_lots: r.nb_lots,
          nb_ilots: r.nb_ilots,
          guide_reference: r.guide_reference,
          autorite_coutumiere_id: r.autorite_coutumiere_id,
          autorite_nom: r.autorites_coutumieres?.nom ?? null,
          pv_identification_physique_numero: r.pv_identification_physique_numero,
          pv_identification_physique_date: r.pv_identification_physique_date,
          pv_identification_physique_scan_url: r.pv_identification_physique_scan_url,
        },
      };
    },
    [supabase],
  );

  /**
   * Lots d'un lotissement filtrés par numéro, avec leur attribution **actuelle**.
   *
   * Deux requêtes à plat plutôt qu'un embed `lots → attributions →
   * attributaires` : cet embed imbriqué a déjà provoqué un timeout à 8 s (donc
   * un HTTP 500 rendu en « liste vide », le pire des retours) sur Brignan et ses
   * 846 lots. Ici la recherche borne déjà le nombre de lots, mais on garde la
   * forme éprouvée — la volumétrie du registre ne fera que croître.
   */
  const chercherLots = useCallback(
    async (lotissementId: string, q: string): Promise<Resultat<LotEtat[]>> => {
      const motif = nettoyerRecherche(q);
      let requete = supabase
        .from("lots")
        // `verrouille` = gel juridique. Le web le montre partout (cadenas,
        // « Gel juridique ») ; ne pas le charger ici, c'est proposer un lot
        // gelé à la réattribution sans le moindre signal.
        .select("id, numero_lot, statut, verrouille, ilots!inner(numero, lotissement_id)")
        .eq("ilots.lotissement_id", lotissementId);
      if (motif) requete = requete.ilike("numero_lot", `%${motif}%`);
      const { data, error } = await requete
        .order("numero_lot", { ascending: true })
        .limit(LIMITE_RESULTATS);
      if (error) return { ok: false, error: error.message };

      const lignes = (data ?? []) as unknown as LigneLot[];
      if (lignes.length === 0) return { ok: true, valeur: [] };

      const { data: attrs, error: e2 } = await supabase
        .from("attributions")
        .select("lot_id, attributaire_id, qualite, attributaires(nom)")
        .in(
          "lot_id",
          lignes.map((l) => l.id),
        )
        .eq("actuel", true);
      // L'attribution en cours n'est pas un détail décoratif : c'est elle qui
      // dit si l'opération sera une nouvelle attribution ou une réassignation.
      // Sans elle, l'écran mentirait sur la nature de l'acte.
      if (e2) return { ok: false, error: e2.message };

      const parLot = new Map<string, LigneAttribution>();
      for (const a of (attrs ?? []) as unknown as LigneAttribution[]) {
        if (a.lot_id) parLot.set(a.lot_id, a);
      }

      return {
        ok: true,
        valeur: lignes.map((l) => {
          const a = parLot.get(l.id);
          return {
            lot_id: l.id,
            ilot: l.ilots?.numero ?? "—",
            numero_lot: l.numero_lot ?? "—",
            statut: l.statut ?? "—",
            attributaire_id: a?.attributaire_id ?? null,
            attributaire_nom: a?.attributaires?.nom ?? null,
            qualite: (a?.qualite as Qualite | undefined) ?? null,
            // `null` en base (colonne nullable) se lit ici comme « non gelé » :
            // c'est bien le défaut de la colonne, pas une supposition.
            verrouille: l.verrouille === true,
          };
        }),
      };
    },
    [supabase],
  );

  /**
   * Fiche descriptive d'un lot. Chargée avant toute correction : c'est elle qui
   * donne les valeurs d'origine, et donc ce qui permet de n'envoyer QUE les
   * champs réellement changés (`_appliquer_modification_lot` laisse intact tout
   * champ absent du payload).
   */
  const chargerFicheLot = useCallback(
    async (lotId: string): Promise<Resultat<FicheLot>> => {
      const { data, error } = await supabase
        .from("lots")
        .select(
          "id, numero_lot, numero_parcelle, est_equipement, superficie_m2, nature_droit, " +
            "observation, guide_page, latitude, longitude, verrouille, ilots(numero)",
        )
        .eq("id", lotId)
        .single();
      if (error) return { ok: false, error: error.message };
      if (!data) return { ok: false, error: "Lot introuvable." };
      const r = data as unknown as Omit<FicheLot, "ilot_numero" | "verrouille"> & {
        verrouille: boolean | null;
        ilots: { numero: string | null } | null;
      };
      return {
        ok: true,
        valeur: {
          id: r.id,
          ilot_numero: r.ilots?.numero ?? "—",
          numero_lot: r.numero_lot,
          numero_parcelle: r.numero_parcelle,
          est_equipement: r.est_equipement,
          superficie_m2: r.superficie_m2,
          nature_droit: r.nature_droit,
          observation: r.observation,
          guide_page: r.guide_page,
          latitude: r.latitude,
          longitude: r.longitude,
          // `null` en base = « non gelé », c'est le défaut de la colonne.
          verrouille: r.verrouille === true,
        },
      };
    },
    [supabase],
  );

  /**
   * Îlots d'un lotissement, avec leur nombre de lots.
   *
   * Le compte n'est pas décoratif : renuméroter un îlot est une opération d'un
   * mot qui change la désignation de tous ses lots, et donc ce qui figurera sur
   * chaque attestation à venir. Le montrer, c'est dire l'ampleur du geste.
   */
  const chargerIlots = useCallback(
    async (lotissementId: string): Promise<Resultat<IlotOption[]>> => {
      const { data, error } = await supabase
        .from("ilots")
        .select("id, numero, lots(count)")
        .eq("lotissement_id", lotissementId)
        .order("numero");
      if (error) return { ok: false, error: error.message };
      const lignes = (data ?? []) as unknown as {
        id: string;
        numero: string | null;
        lots: { count: number }[] | null;
      }[];
      return {
        ok: true,
        valeur: lignes.map((l) => ({
          id: l.id,
          numero: l.numero ?? "—",
          nb_lots: l.lots?.[0]?.count ?? 0,
        })),
      };
    },
    [supabase],
  );

  /**
   * Le lotissement d'un attributaire, pour donner un CONTEXTE à la correction
   * de sa fiche (`maj_attributaire`).
   *
   * 🔴 Sans lui, l'avertissement documentaire ne s'affichait pour ce type ni au
   * formulaire ni dans la file : `AvertissementDocumentaire` rend `null` sur un
   * identifiant nul, et personne ne fournissait d'identifiant. C'était un écart
   * à l'arbitrage du propriétaire du projet, qui veut les pièces manquantes
   * nommées **aux deux bouts**.
   *
   * ⚠️ Un attributaire peut détenir des lots dans plusieurs lotissements. On en
   * retient UN — celui de son attribution la plus récemment lisible — comme le
   * fait le serveur. Le champ répond à « à quel dossier cela se rattache », pas
   * à « la liste exhaustive ».
   *
   * Deux requêtes à plat plutôt qu'un embed `attributions → lots → ilots` :
   * l'embed imbriqué a déjà provoqué un timeout rendu en « liste vide » sur ce
   * projet, et une liste vide se lit ici « aucun lotissement », c'est-à-dire un
   * avertissement qui disparaît sans le dire.
   */
  const lotissementDeAttributaire = useCallback(
    async (attributaireId: string): Promise<Resultat<string | null>> => {
      const { data, error } = await supabase
        .from("attributions")
        .select("lot_id")
        .eq("attributaire_id", attributaireId)
        .limit(LIMITE_RESULTATS);
      if (error) return { ok: false, error: error.message };
      const lotIds = ((data ?? []) as { lot_id: string | null }[])
        .map((a) => a.lot_id)
        .filter((v): v is string => !!v);
      if (lotIds.length === 0) return { ok: true, valeur: null };

      const { data: lots, error: e2 } = await supabase
        .from("lots")
        .select("ilots(lotissement_id)")
        .in("id", lotIds)
        .limit(1);
      if (e2) return { ok: false, error: e2.message };
      const ligne = (lots ?? [])[0] as unknown as
        | { ilots: { lotissement_id: string | null } | null }
        | undefined;
      return { ok: true, valeur: ligne?.ilots?.lotissement_id ?? null };
    },
    [supabase],
  );

  const soumettre = useCallback(
    async (envoi: EnvoiSaisie): Promise<Resultat<string>> => {
      const { data, error } = await supabase.rpc("soumettre_saisie", {
        p_type: envoi.type,
        // La fonction SQL accepte `null` (soumission sans lotissement existant) ;
        // le générateur de types Supabase rend ce paramètre non-null faute de
        // DEFAULT. Même cast que côté web (`proposerLotissement`).
        p_lotissement_id: envoi.lotissementId as string,
        p_titre: envoi.titre,
        p_payload: envoi.payload as unknown as Json,
        p_resume: envoi.resume as unknown as Json,
      });
      if (error) {
        // PostgREST renseigne `code` (`P0001` pour un `raise exception`, `42501`
        // pour un refus de droits…) : la requête est arrivée, la base a
        // répondu non, rien n'a été écrit. Sans `code`, l'échec est survenu
        // dans le transport — `Failed to fetch`, coupure, délai dépassé — et
        // l'état du serveur est alors **inconnu**.
        const codePostgrest = (error as { code?: string | null }).code;
        return {
          ok: false,
          error: error.message,
          incertain: !codePostgrest,
        };
      }
      return { ok: true, valeur: (data ?? "") as string };
    },
    [supabase],
  );

  return {
    lotissements: referentiels?.lotissements ?? [],
    autorites: referentiels?.autorites ?? [],
    operateurs: referentiels?.operateurs ?? [],
    familles: referentiels?.familles ?? [],
    // Dérivé, jamais posé dans un effet : impossible d'oublier de le redescendre.
    loading: actif && referentiels === null && erreur === null,
    erreur,
    listesEnEchec,
    recharger: charger,
    chercherAttributaires,
    chargerFiche,
    chercherLots,
    chargerFicheLot,
    chargerIlots,
    lotissementDeAttributaire,
    soumettre,
  };
}
