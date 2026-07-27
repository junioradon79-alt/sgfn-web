"use client";

import { useState } from "react";
import Link from "next/link";

import { EditProfileScreen } from "@/features/mobile/screens/EditProfileScreen";
import { ReportIssueScreen } from "@/features/mobile/screens/ReportIssueScreen";
import { NotificationsScreen } from "@/features/mobile/screens/NotificationsScreen";
import { SoumissionsVue } from "@/features/mobile/screens/admin/SoumissionsScreen";
import { AttributaireScreen } from "@/features/mobile/screens/admin/saisie/AttributaireScreen";
import { LotScreen } from "@/features/mobile/screens/admin/saisie/LotScreen";
import { LotissementScreen } from "@/features/mobile/screens/admin/saisie/LotissementScreen";
import { StructureScreen } from "@/features/mobile/screens/admin/saisie/StructureScreen";
import { SaisieScreen } from "@/features/mobile/screens/pro/SaisieScreen";
import { ParcelsScreen } from "@/features/mobile/screens/ParcelsScreen";
import { saisiesPour } from "@/features/mobile/roles";
import type { MobileProfile, Parcelle, Suivi } from "@/features/mobile/data/useMobileData";
import type { FileSoumissions, SoumissionEnAttente } from "@/features/mobile/data/useSoumissions";
import type {
  AttributaireFiche,
  FicheLotissement,
  LotissementOption,
  SaisieRegistre,
} from "@/features/mobile/data/useSaisieRegistre";
import type { LotEtat } from "@/lib/saisie";
import type { NotifRow } from "@/features/mobile/data/mappers";

/**
 * Aperçu des écrans mobiles — page de développement, jamais servie en prod.
 *
 * Raison d'être, la même que `/apercu-cartes` : ces écrans sont **inatteignables
 * autrement**. Le seul compte de test du projet est un administrateur, donc la
 * coquille choisit `ProApp` et les écrans citoyen (détail de parcelle,
 * signalement) ne s'ouvrent jamais au navigateur ; et l'état « notification non
 * lue » suppose un état de lecture absent d'une session neuve.
 *
 * 🔴 Ce sont les **vrais composants**, montés avec leurs props réelles — pas des
 * répliques de leur balisage. C'est la seule façon qu'une divergence entre cet
 * aperçu et l'écran réel soit impossible : s'ils rendaient un balisage recopié,
 * un défaut introduit dans l'écran ne se verrait pas ici. Aucune requête,
 * aucune écriture : toutes les fonctions d'envoi sont neutralisées.
 */

const PROFIL: MobileProfile = {
  id: "apercu-0000-0000-0000-000000000001",
  nom_complet: "Konan Yao Bernard",
  telephone: "+225 07 00 00 00 00",
  groupe: "proprietaire_terrien",
  famille_id: null,
  autorite_coutumiere_id: null,
  attributaire_id: null,
};

/** Rôle métier nominal : trois formulaires, pas de cockpit national. */
const PROFIL_OPERATEUR_SAISIE: MobileProfile = {
  ...PROFIL,
  nom_complet: "Aya Brou Sylvie",
  groupe: "operateur_saisie",
};

/**
 * 🔴 Le cas que la production ne sait pas produire : une chefferie dont le
 * compte n'est rattaché à aucune autorité coutumière. Les deux comptes réels ne
 * permettent pas de l'atteindre — l'un a une juridiction, l'autre est inactif —
 * et sans cet aperçu le garde-fou resterait du code jamais vu à l'écran.
 */
const PROFIL_CHEFFERIE_SANS_JURIDICTION: MobileProfile = {
  ...PROFIL,
  nom_complet: "N'Cho Koutouan Jules",
  groupe: "chefferie",
  autorite_coutumiere_id: null,
};

const PARCELLE: Parcelle = {
  lotId: "apercu-lot-0001",
  numeroLot: "142",
  statut: "attribue",
  ilotNumero: "7",
  lotissement: "Brignan Extension",
  commune: "Songon",
  qualite: "attributaire",
  rang: 1,
  collectif: false,
};

const ilYA = (heures: number) => new Date(Date.now() - heures * 3600 * 1000).toISOString();

/**
 * Terrains suivis d'un acquéreur. Le premier est **en vente** : cet état
 * n'existe sur aucun des quatre suivis réels de la production (tous issus d'un
 * scan QR, aucun rattaché à une annonce active), il ne se verrait donc nulle
 * part ailleurs. Le second couvre le cas ordinaire.
 */
const SUIVIS: Suivi[] = [
  {
    lot_id: "apercu-suivi-0001",
    numero_lot: "06",
    ilot_numero: "2",
    lotissement: "Koelea-Accor revu",
    en_vente: true,
    annonce_id: "apercu-annonce-0001",
    cree_le: ilYA(24 * 10),
  },
  {
    lot_id: "apercu-suivi-0002",
    numero_lot: "17",
    ilot_numero: null,
    lotissement: "Koelea-Accor revu",
    en_vente: false,
    annonce_id: null,
    cree_le: ilYA(24 * 3),
  },
];

/**
 * Types et paramètres **réels**, tels que `decrireNotif` les traduit
 * (`NOTIF_TYPE_LABELS` / `NOTIF_TYPE_TONES` dans `data/mappers.ts`). Un type
 * inventé retomberait sur le libellé générique « Notification » et sur le ton
 * neutre : l'aperçu montrerait quatre lignes grises identiques et ne dirait
 * rien de ce que voit réellement un utilisateur.
 */
const NOTIFS: NotifRow[] = [
  {
    id: "n1",
    type: "acquereur_attestation_prete",
    params: { lot: "Lot 142", lieu: "Brignan Extension" },
    cree_le: ilYA(2),
  },
  {
    id: "n2",
    type: "acquereur_certificat",
    params: { complement: "Votre certificat de vente est disponible." },
    cree_le: ilYA(26),
  },
  {
    id: "n3",
    type: "acquereur_vente_creee",
    params: { lot: "Lot 142", lieu: "Songon" },
    cree_le: ilYA(72),
  },
  {
    id: "n4",
    type: "agence_nouvelle_demande",
    params: { complement: "Un acquéreur s'est manifesté sur une de vos parcelles." },
    cree_le: ilYA(120),
  },
];

/** Les deux premières sont neuves ; les suivantes ont déjà été ouvertes. */
const DEJA_LUES = new Set(["n3", "n4"]);

/** Rien ne part : l'aperçu ne parle jamais à la base. */
const NEANT = async () => ({ ok: true as const });

/**
 * File des saisies **simulée**. La file réelle est vide en production (0 en
 * attente), si bien que l'écran ne montrait jamais autre chose que son état
 * vide — alors que c'est celui qui porte les deux actes irréversibles de l'app.
 *
 * Les compteurs de `resume` sont ceux, réels, de `ResumeMaj`/`ResumeCreation`
 * (`@/lib/saisie`) : des clés inventées feraient afficher des puces vides et
 * l'aperçu mentirait sur ce que voit l'admin. Les volumes couvrent les deux cas
 * d'accord (12 → « nouveaux », 1 → « nouvel ») et la seconde soumission est
 * volontairement **sans titre**, pour montrer le repli sur le libellé de type.
 *
 * 🔴 `approuver`/`rejeter` n'écrivent rien et **échouent volontairement** : la
 * base de ce projet est la production, et une réussite simulée entraînerait à
 * lire un « appliqué » qui n'a rien appliqué. L'erreur dit ce qui se passe.
 */
const SOUMISSIONS: SoumissionEnAttente[] = [
  {
    id: "s1",
    type: "maj_attributions",
    titre: "Brignan Extension — guide de répartition, pages 12 à 18",
    resume: {
      nouvelles_attributions: 24,
      reassignations: 3,
      remises_libre: 1,
      inchanges: 7,
      nouveaux_attributaires: 12,
    },
    cree_le: ilYA(3),
  },
  {
    id: "s2",
    type: "creation_structure",
    titre: null,
    resume: {
      nom_lotissement: "Koelea-Accor Extension 2",
      nb_ilots: 14,
      nb_lots: 386,
      nb_equipements: 5,
    },
    cree_le: ilYA(29),
  },
  {
    id: "s3",
    type: "maj_attributions",
    titre: "Ebimpe — régularisation d'un lot après succession",
    resume: {
      nouvelles_attributions: 1,
      reassignations: 0,
      remises_libre: 0,
      inchanges: 0,
      nouveaux_attributaires: 1,
    },
    cree_le: ilYA(50),
  },
  // Les trois types ajoutés depuis (fiche de lotissement, fiche d'attributaire,
  // coquille) : ils étaient lus comme des créations de structure et affichaient
  // « undefined îlot, undefined lot ». Ils restent ici pour que la régression ne
  // puisse pas revenir sans se voir.
  {
    id: "s4",
    type: "modification_lotissement",
    titre: "Koelea-Accor — PV d'identification physique renseigné",
    resume: {
      nom_lotissement: "Koelea-Accor",
      localisation: "Koelea · Anyama",
      nb_ilots: 14,
      nb_lots: 386,
      champs_modifies: 3,
    },
    cree_le: ilYA(6),
  },
  {
    id: "s5",
    type: "maj_attributaire",
    titre: null,
    resume: {
      nom: "Konan Yao Bernard",
      type_attributaire: "personne_physique",
      creation: false,
      champs_modifies: 1,
    },
    cree_le: ilYA(11),
  },
  {
    id: "s6",
    type: "creation_structure",
    titre: "Ebimpe Extension — fiche créée depuis le terrain",
    resume: {
      nom_lotissement: "Ebimpe Extension",
      nb_ilots: 0,
      nb_lots: 0,
      nb_equipements: 0,
    },
    cree_le: ilYA(14),
  },
];

const INERTE = async () => ({
  ok: false as const,
  error: "Aperçu : aucune décision n'est envoyée à la base.",
});

const FILE_SOUMISSIONS: FileSoumissions = {
  soumissions: SOUMISSIONS,
  loading: false,
  erreur: null,
  recharger: async () => {},
  approuver: INERTE,
  rejeter: INERTE,
};

// ── Saisie du registre ───────────────────────────────────────────────────────
//
// Les quatre formulaires de saisie sont, eux aussi, invisibles autrement : ils
// vivent derrière l'onglet « À faire » de l'expérience admin, et surtout ils
// **lisent le registre de production** dès leur ouverture. Les monter ici avec
// un registre simulé est la seule façon de les parcourir sans interroger — ni,
// pire, alimenter — la vraie base.

const LOTISSEMENTS: LotissementOption[] = [
  { id: "apc-lot-1", nom: "Brignan Extension", village: "Brignan", commune: "Songon" },
  { id: "apc-lot-2", nom: "Koelea-Accor", village: "Koelea", commune: "Anyama" },
  { id: "apc-lot-3", nom: "Ebimpe Résidentiel", village: "Ebimpe", commune: "Anyama" },
];

/**
 * Fiches complètes, telles que `chargerFiche` les renvoie. La première est
 * pleine et la seconde pleine de trous : c'est sur celle-là que se voit le
 * piège du `NULL` implicite — un champ vide à l'écran est un champ vide en
 * base, et il repartira vide.
 */
const FICHES: Record<string, FicheLotissement> = {
  "apc-lot-1": {
    id: "apc-lot-1",
    nom: "Brignan Extension",
    village: "Brignan",
    commune: "Songon",
    district: "Abidjan",
    superficie_texte: "42 ha 18 a",
    nb_lots: 846,
    nb_ilots: 31,
    guide_reference: "GR-2023-004",
    autorite_coutumiere_id: "apc-aut-1",
    autorite_nom: "Chefferie de Brignan",
    pv_identification_physique_numero: "PV-2023-117",
    pv_identification_physique_date: "2023-09-14",
    pv_identification_physique_scan_url: "https://exemple.ci/pv/2023-117.pdf",
  },
  "apc-lot-2": {
    id: "apc-lot-2",
    nom: "Koelea-Accor",
    village: "Koelea",
    commune: "Anyama",
    district: null,
    superficie_texte: null,
    nb_lots: 386,
    nb_ilots: 14,
    guide_reference: null,
    autorite_coutumiere_id: null,
    autorite_nom: null,
    pv_identification_physique_numero: null,
    pv_identification_physique_date: null,
    pv_identification_physique_scan_url: null,
  },
  "apc-lot-3": {
    id: "apc-lot-3",
    nom: "Ebimpe Résidentiel",
    village: "Ebimpe",
    commune: "Anyama",
    district: "Abidjan",
    superficie_texte: "8 ha",
    nb_lots: 142,
    nb_ilots: 6,
    guide_reference: "GR-2025-021",
    autorite_coutumiere_id: "apc-aut-2",
    autorite_nom: "Chefferie d'Ebimpe",
    pv_identification_physique_numero: null,
    pv_identification_physique_date: null,
    pv_identification_physique_scan_url: null,
  },
};

/**
 * Lots de « Brignan Extension ». Les trois états que `classifier` distingue y
 * sont représentés : un lot libre (→ nouvelle attribution), un lot attribué
 * (→ réassignation, ou remise en disponibilité), et de quoi retomber sur
 * « aucun changement » en réattribuant à l'identique.
 */
const LOTS: LotEtat[] = [
  {
    lot_id: "apc-l-1",
    ilot: "7",
    numero_lot: "142",
    statut: "attribue",
    attributaire_id: "apc-att-1",
    attributaire_nom: "Konan Yao Bernard",
    qualite: "ayant_droit",
    verrouille: false,
  },
  {
    lot_id: "apc-l-2",
    ilot: "7",
    numero_lot: "143",
    statut: "libre",
    attributaire_id: null,
    attributaire_nom: null,
    qualite: null,
    verrouille: false,
  },
  {
    lot_id: "apc-l-3",
    ilot: "12",
    numero_lot: "308",
    statut: "attribue",
    attributaire_id: "apc-att-2",
    attributaire_nom: "SCI Les Palmiers",
    qualite: "acquereur",
    verrouille: false,
  },
  {
    lot_id: "apc-l-4",
    ilot: "12",
    numero_lot: "309",
    statut: "reserve_equipement",
    attributaire_id: null,
    attributaire_nom: null,
    qualite: null,
    verrouille: false,
  },
  // Un lot sous gel juridique : sans lui, l'écran refusant l'acte n'est
  // atteignable dans l'aperçu par aucun chemin, et le garde-fou ne se voit
  // jamais. 6 lots sont dans cet état en production.
  {
    lot_id: "apc-l-5",
    ilot: "12",
    numero_lot: "310",
    statut: "vendu",
    attributaire_id: "apc-att-2",
    attributaire_nom: "SCI Les Palmiers",
    qualite: "acquereur",
    verrouille: true,
  },
];

const ATTRIBUTAIRES: AttributaireFiche[] = [
  {
    id: "apc-att-1",
    nom: "Konan Yao Bernard",
    type: "personne_physique",
    piece_nature: "CNI",
    piece_num: "CI002123456789",
    telephone: "+225 07 00 00 00 00",
    email: null,
    adresse: "Songon, Abidjan",
  },
  {
    id: "apc-att-2",
    nom: "SCI Les Palmiers",
    type: "personne_morale",
    piece_nature: "RCCM",
    piece_num: "CI-ABJ-2019-B-1234",
    telephone: null,
    email: "contact@lespalmiers.ci",
    adresse: null,
  },
  {
    id: "apc-att-3",
    nom: "Collectif Ako Djebe",
    type: "collectif_ayants_droit",
    piece_nature: null,
    piece_num: null,
    telephone: "+225 05 11 22 33 44",
    email: null,
    adresse: null,
  },
];

const contient = (valeur: string, motif: string) =>
  valeur.toLowerCase().includes(motif.trim().toLowerCase());

/**
 * Registre simulé. Les recherches filtrent réellement les tableaux ci-dessus :
 * un `chercherLots` qui renverrait tout ferait passer pour fonctionnel un
 * écran dont la recherche est cassée.
 *
 * 🔴 `soumettre` n'écrit rien et renvoie un identifiant factice. Ce choix
 * diffère volontairement de `approuver`/`rejeter` plus haut, qui échouent :
 * approuver annonce « appliqué », donc un faux succès mentirait sur l'état du
 * registre ; soumettre n'annonce que « parti en validation », et c'est
 * précisément l'écran de confirmation — celui qui porte la distinction entre
 * « envoyé » et « appliqué » — qu'il faut pouvoir relire avant de livrer. Le
 * bandeau de la page rappelle qu'aucune soumission ne part.
 *
 * ⚠️ Il **inspecte** en revanche ce qu'on lui passe. Un succès inconditionnel
 * ne teste rien : c'est le seul endroit où le payload construit par les écrans
 * peut encore être vu (l'e2e ne soumet jamais, `verif-rpc-saisie` n'envoie que
 * `null`), et il passait sans être regardé.
 */
const SAISIE: SaisieRegistre = {
  lotissements: LOTISSEMENTS,
  autorites: [
    { id: "apc-aut-1", nom: "Chefferie de Brignan" },
    { id: "apc-aut-2", nom: "Chefferie d'Ebimpe" },
  ],
  operateurs: [
    { id: "apc-ope-1", nom: "SODECI Aménagement" },
    { id: "apc-ope-2", nom: "Groupe Accor CI" },
  ],
  familles: [
    { id: "apc-fam-1", nom: "Famille Ako Djebe" },
    { id: "apc-fam-2", nom: "Famille Brou" },
  ],
  loading: false,
  erreur: null,
  listesEnEchec: [],
  recharger: async () => {},
  chercherAttributaires: async (q) => ({
    ok: true,
    valeur: ATTRIBUTAIRES.filter((a) => contient(a.nom, q)),
  }),
  chargerFiche: async (id) => {
    const f = FICHES[id];
    return f ? { ok: true, valeur: f } : { ok: false, error: "Lotissement introuvable." };
  },
  chercherLots: async (lotissementId, q) => ({
    ok: true,
    // Seul « Brignan Extension » a des lots : les deux autres montrent l'état
    // vide, qui est celui d'un lotissement dont les lots n'ont pas été importés.
    valeur:
      lotissementId === "apc-lot-1"
        ? LOTS.filter((l) => !q.trim() || contient(l.numero_lot, q))
        : [],
  }),
  // 🔴 Le payload est **inspecté**, pas ignoré. La version précédente ne lisait
  // aucun de ses arguments : un écran qui aurait construit un payload vide, ou
  // sous le mauvais type, affichait le même succès. C'était le seul endroit où
  // le payload pouvait encore être vu, et il ne l'était pas.
  soumettre: async (envoi) => {
    const vide =
      !envoi.payload ||
      (typeof envoi.payload === "object" && Object.keys(envoi.payload).length === 0);
    if (vide) return { ok: false, error: "Aperçu : l'écran a produit un payload vide." };
    if (!envoi.titre?.trim()) return { ok: false, error: "Aperçu : soumission sans titre." };
    return { ok: true, valeur: "apercu-aucune-soumission" };
  },
};

type Ecran =
  | "profil"
  | "signalement"
  | "notifications"
  | "soumissions"
  | "suivis"
  | "saisie-accueil"
  | "saisie-bloquee"
  | "saisie-lot"
  | "saisie-attributaire"
  | "saisie-lotissement"
  | "saisie-structure";

const ECRANS: { cle: Ecran; libelle: string; note: string }[] = [
  { cle: "profil", libelle: "Gérer mon profil", note: "Nom, téléphone, mot de passe — remplace la sortie vers le web" },
  { cle: "signalement", libelle: "Signaler un problème", note: "Création d'un litige depuis le détail d'une parcelle" },
  { cle: "notifications", libelle: "Notifications", note: "2 non lues sur 4 — teinte et compteur" },
  {
    cle: "soumissions",
    libelle: "Saisies à valider",
    note: "6 en attente, un par type de soumission (file réelle vide en prod) — approuver/rejeter sont inertes ici",
  },
  {
    cle: "suivis",
    libelle: "Terrains suivis (acquéreur)",
    note: "Un terrain « En vente », l'autre non. 🔴 L'état « en vente » n'existe sur AUCUN des 4 suivis réels : il ne se voit que là.",
  },
  {
    cle: "saisie-accueil",
    libelle: "Accueil « Saisie » (opérateur)",
    note: "Écran racine des rôles métier — 3 formulaires pour un opérateur de saisie, la fiche de lotissement en moins.",
  },
  {
    cle: "saisie-bloquee",
    libelle: "Chefferie non rattachée",
    note: "Cas INATTEIGNABLE en prod : le seul compte sans juridiction est inactif. Sans ce garde-fou, la fiche serait remplie puis rejetée à l'envoi.",
  },
  {
    cle: "saisie-lot",
    libelle: "Attribuer un lot",
    note: "Lotissement → lot → cible. Seul « Brignan Extension » porte des lots ; les autres montrent l'état vide.",
  },
  {
    cle: "saisie-attributaire",
    libelle: "Fiche d'attributaire",
    note: "Créer ou corriger. Tapez « ko », « sci » ou « ako » pour voir la recherche répondre.",
  },
  {
    cle: "saisie-lotissement",
    libelle: "Fiche de lotissement",
    note: "« Koelea-Accor » est volontairement pleine de trous : c'est là que se voit le piège du champ vidé.",
  },
  {
    cle: "saisie-structure",
    libelle: "Nouveau lotissement",
    note: "Coquille : 1 lotissement, 0 îlot, 0 lot — plus les rattachements créés à l'approbation.",
  },
];

export default function ApercuMobilePage() {
  const [ecran, setEcran] = useState<Ecran>("profil");
  const [sombre, setSombre] = useState(false);

  if (process.env.NODE_ENV !== "development") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Aperçu réservé au développement local.{" "}
          <Link href="/" className="font-semibold text-accent underline">
            Retour à l&apos;accueil
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className={sombre ? "dark" : ""}>
      <div className="min-h-screen bg-background px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Aperçu — écrans mobiles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Composants réels, données simulées. Aucune requête, aucune écriture.
          </p>
          {/* Dit une fois, en clair : les écrans de saisie affichent bien leur
              confirmation d'envoi, et pourtant rien ne part. Sans ce rappel, la
              page ferait exactement l'erreur qu'elle sert à éviter. */}
          <p className="mt-2 rounded-xl border border-warning/45 bg-warning-subtle px-3 py-2 text-[13px] text-foreground">
            Les formulaires de saisie affichent leur écran de confirmation, mais{" "}
            <b>aucune soumission n&apos;est envoyée</b>{" "}
            à la base — la production n&apos;a pas d&apos;environnement de test.
          </p>
        </header>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {ECRANS.map((e) => (
            <button
              key={e.cle}
              type="button"
              onClick={() => setEcran(e.cle)}
              data-apercu={e.cle}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                ecran === e.cle
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground"
              }`}
            >
              {e.libelle}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSombre((s) => !s)}
            className="ml-auto rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground"
          >
            {sombre ? "Thème clair" : "Thème sombre"}
          </button>
        </div>

        <p className="mb-3 text-[13px] text-muted-foreground">
          {ECRANS.find((e) => e.cle === ecran)?.note}
        </p>

        {/* Cadre au format téléphone : ces écrans sont en `absolute inset-0`,
            ils ont besoin d'un parent positionné et borné pour se dessiner. */}
        <div
          data-apercu-cadre
          className="relative h-[780px] w-full max-w-[412px] overflow-hidden rounded-[28px] border border-border-strong bg-background shadow-panel"
        >
          {ecran === "profil" && (
            <EditProfileScreen
              profile={PROFIL}
              email="konan.yao@exemple.ci"
              onBack={() => {}}
              onSave={NEANT}
              onChangePassword={NEANT}
              flash={() => {}}
            />
          )}
          {ecran === "signalement" && (
            <ReportIssueScreen
              lotId={PARCELLE.lotId}
              parcelle={PARCELLE}
              onBack={() => {}}
              onSubmit={NEANT}
              onDone={() => {}}
              flash={() => {}}
            />
          )}
          {ecran === "notifications" && (
            <NotificationsScreen notifs={NOTIFS} lues={DEJA_LUES} onBack={() => {}} />
          )}
          {ecran === "soumissions" && <SoumissionsVue file={FILE_SOUMISSIONS} onBack={() => {}} />}
          {ecran === "suivis" && (
            <ParcelsScreen
              parcelles={[]}
              suivis={SUIVIS}
              onOpenParcel={() => {}}
              onNePlusSuivre={() => {}}
              onVoirAnnonce={() => {}}
              onDecouvrir={() => {}}
            />
          )}
          {ecran === "saisie-accueil" && (
            <SaisieScreen
              profile={PROFIL_OPERATEUR_SAISIE}
              unreadNotif
              onOpenNotifications={() => {}}
              saisies={saisiesPour("operateur_saisie")}
              onOuvrirSaisie={() => {}}
            />
          )}
          {ecran === "saisie-bloquee" && (
            <SaisieScreen
              profile={PROFIL_CHEFFERIE_SANS_JURIDICTION}
              unreadNotif={false}
              onOpenNotifications={() => {}}
              saisies={saisiesPour("chefferie")}
              onOuvrirSaisie={() => {}}
            />
          )}
          {ecran === "saisie-lot" && (
            <LotScreen api={SAISIE} onBack={() => {}} flash={() => {}} />
          )}
          {ecran === "saisie-attributaire" && (
            <AttributaireScreen api={SAISIE} onBack={() => {}} flash={() => {}} />
          )}
          {ecran === "saisie-lotissement" && (
            <LotissementScreen api={SAISIE} onBack={() => {}} flash={() => {}} />
          )}
          {ecran === "saisie-structure" && (
            <StructureScreen api={SAISIE} onBack={() => {}} flash={() => {}} />
          )}
        </div>
      </div>
    </main>
  );
}
