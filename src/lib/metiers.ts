import type { LucideIcon } from "lucide-react";
import {
  Landmark,
  Ruler,
  Scale,
  Building2,
  Briefcase,
  Crown,
  HardHat,
  TrendingUp,
  Building,
  Home,
} from "lucide-react";

export type Metier = {
  slug: string;
  nom: string;
  icon: LucideIcon;
  description: string;
  cta: string;
  /** Titre de la page descriptive du métier. */
  accroche: string;
  /** Ce que le métier doit résoudre aujourd'hui. */
  enjeux: string[];
  /** Ce que SGNF apporte concrètement, par point. */
  apports: { titre: string; texte: string }[];
};

export const metiers: Metier[] = [
  {
    slug: "chefferie",
    nom: "Chefferies",
    icon: Crown,
    description:
      "Donnez un cadre traçable à la concertation coutumière : avis sur les attributions, validation des lotissements et suivi des litiges de votre juridiction.",
    cta: "Inscrire ma chefferie",
    accroche: "L'autorité coutumière, inscrite au registre national.",
    enjeux: [
      "Les décisions coutumières restent souvent orales, donc contestables des années plus tard.",
      "Les familles et ayants droit sont difficiles à reconstituer après une succession.",
      "Les litiges se règlent sans trace écrite opposable.",
    ],
    apports: [
      {
        titre: "Juridiction délimitée",
        texte:
          "Votre espace ne montre que les lotissements, îlots et lots de votre juridiction — ni plus, ni moins.",
      },
      {
        titre: "Avis et validations horodatés",
        texte:
          "Chaque approbation de lotissement et chaque avis sur une attribution est enregistré, daté et attribué à son auteur.",
      },
      {
        titre: "Familles et successions",
        texte:
          "Le registre des familles et des ayants droit se transmet : une succession se documente au lieu de se discuter.",
      },
      {
        titre: "Litiges suivis",
        texte:
          "Les contentieux de votre juridiction et les PV de concertation restent consultables à tout moment.",
      },
    ],
  },
  {
    slug: "collectivite",
    nom: "Collectivités territoriales",
    icon: Landmark,
    description:
      "Pilotez vos lotissements, suivez les attributions et sécurisez les décisions administratives de votre territoire.",
    cta: "Doter ma collectivité de SGNF",
    accroche: "Le foncier de votre territoire, vu d'un seul écran.",
    enjeux: [
      "Les données foncières sont éclatées entre services, fichiers Excel et archives papier.",
      "L'état réel d'un lotissement demande des jours de recoupement.",
      "Les décisions passées sont difficiles à justifier en cas de contestation.",
    ],
    apports: [
      {
        titre: "Vue consolidée",
        texte:
          "Lotissements, îlots, lots, attributions et documents rattachés au même registre, à jour en permanence.",
      },
      {
        titre: "Instruction encadrée",
        texte:
          "Les dossiers ADU et ACD suivent un circuit de validation explicite, de la saisie à la délivrance.",
      },
      {
        titre: "Traçabilité opposable",
        texte:
          "Chaque opération est journalisée, horodatée et rattachée à son auteur — une décision se prouve.",
      },
      {
        titre: "Statistiques de couverture",
        texte:
          "Suivez l'avancement de la couverture cadastrale de votre territoire et exportez vos rapports.",
      },
    ],
  },
  {
    slug: "amenageur",
    nom: "Aménageurs fonciers",
    icon: Building2,
    description:
      "Structurez vos périmètres, gérez les îlots et les lots, et coordonnez chaque validation avec les autorités compétentes.",
    cta: "Digitaliser mes aménagements",
    accroche: "Du périmètre brut au lot attribué, sans rupture.",
    enjeux: [
      "Le découpage en îlots et lots vit dans des plans qui ne parlent pas au registre.",
      "L'état d'attribution d'un lot change plus vite que les tableaux de suivi.",
      "Les validations avec la chefferie et l'administration s'éternisent faute de circuit clair.",
    ],
    apports: [
      {
        titre: "Périmètres structurés",
        texte:
          "Vos lotissements se déclinent en îlots puis en lots, chacun identifié et cartographié.",
      },
      {
        titre: "Portée limitée à vos opérations",
        texte:
          "Votre espace est scopé à vos lotissements : vos données restent les vôtres.",
      },
      {
        titre: "Attributions traçables",
        texte:
          "Qualités, rangs et ayants droit sont enregistrés, avec l'historique des transferts.",
      },
      {
        titre: "Validation coordonnée",
        texte:
          "Les approbations de la chefferie et de l'administration passent par un circuit unique et daté.",
      },
    ],
  },
  {
    slug: "geometre",
    nom: "Géomètres-experts",
    icon: Ruler,
    description:
      "Rattachez vos relevés topographiques aux parcelles officielles et fiabilisez chaque numérotation cadastrale.",
    cta: "Rejoindre le réseau des géomètres",
    accroche: "Le bornage rattaché au registre, pas à un tiroir.",
    enjeux: [
      "Un PV de bornage isolé n'est vérifiable par personne d'autre que son auteur.",
      "Les missions se suivent sur des supports séparés du dossier cadastral.",
      "La numérotation des parcelles diverge entre le plan et le registre.",
    ],
    apports: [
      {
        titre: "PV de bornage vérifiable",
        texte:
          "Chaque PV est rattaché au lot et porte un QR code qui permet à un tiers d'en confirmer l'authenticité.",
      },
      {
        titre: "Portefeuille de missions",
        texte:
          "Vos missions, leurs clients et leur avancement dans un seul espace de travail.",
      },
      {
        titre: "Dossiers ADU assignés",
        texte:
          "Les dossiers qui vous sont confiés arrivent avec leurs pièces, sans échange de fichiers.",
      },
      {
        titre: "Inscription au registre",
        texte:
          "Le registre des géomètres-experts rend votre agrément visible des donneurs d'ordre.",
      },
    ],
  },
  {
    slug: "notaire",
    nom: "Notaires",
    icon: Scale,
    description:
      "Accédez aux actes authentifiés, vérifiez l'historique de propriété et sécurisez vos dossiers d'authentification.",
    cta: "Sécuriser mes actes notariés",
    accroche: "Instruire un dossier sur des pièces vérifiées.",
    enjeux: [
      "L'authenticité d'une attestation de cession se vérifie encore par téléphone.",
      "L'historique de propriété d'une parcelle est long à reconstituer.",
      "Un même lot peut faire l'objet de deux transactions concurrentes.",
    ],
    apports: [
      {
        titre: "Vérification immédiate",
        texte:
          "Un QR code ou une référence suffit à confirmer qu'un document provient bien du registre national.",
      },
      {
        titre: "Chaîne de propriété",
        texte:
          "Attributions successives, transferts et cessions restent consultables dans l'ordre.",
      },
      {
        titre: "Détection des doublons",
        texte:
          "Le registre bloque la double cession d'un même lot au lieu de la découvrir après coup.",
      },
      {
        titre: "Pièces rattachées",
        texte:
          "Plans, PV de bornage et attestations sont attachés au lot, pas dispersés entre les parties.",
      },
    ],
  },
  {
    slug: "banque",
    nom: "Banques",
    icon: Landmark,
    description:
      "Vérifiez instantanément l'authenticité d'un titre foncier avant financement, grâce à la vérification QR SGNF.",
    cta: "Sécuriser mes dossiers de financement",
    accroche: "Financer sur une garantie foncière vérifiée.",
    enjeux: [
      "Un document falsifié ne se distingue pas d'un original à l'œil nu.",
      "La valeur d'une garantie dépend d'un statut d'attribution difficile à confirmer.",
      "Les délais d'instruction s'allongent en attendant confirmation de l'administration.",
    ],
    apports: [
      {
        titre: "Authenticité prouvée",
        texte:
          "Le verdict de vérification est calculé côté serveur à partir du registre — il ne peut pas être imité.",
      },
      {
        titre: "Score de confiance",
        texte:
          "Chaque lotissement porte un score fondé sur les pièces réellement déposées (APFC, guide, PV).",
      },
      {
        titre: "Passeport parcelle",
        texte:
          "Une fiche de synthèse par parcelle, consultable avant toute décision d'engagement.",
      },
      {
        titre: "Instruction accélérée",
        texte:
          "La confirmation se fait en ligne, sans courrier ni attente de contre-appel.",
      },
    ],
  },
  {
    slug: "promoteur",
    nom: "Promoteurs immobiliers",
    icon: Building,
    description:
      "Centralisez vos programmes, suivez les ventes et les paiements, et accélérez vos délais de commercialisation.",
    cta: "Connecter mes programmes",
    accroche: "Commercialiser sur un stock foncier fiable.",
    enjeux: [
      "L'état réel de disponibilité d'un lot n'est pas connu au moment de la vente.",
      "Le suivi des paiements et celui de la propriété vivent dans deux systèmes.",
      "Les acquéreurs demandent des garanties que le papier ne fournit plus.",
    ],
    apports: [
      {
        titre: "Disponibilité réelle",
        texte: "Le statut d'un lot vient du registre, pas d'un tableau recopié.",
      },
      {
        titre: "Ventes et encaissements",
        texte:
          "La propriété bascule quand la vente est soldée, avec répartition automatique des paiements.",
      },
      {
        titre: "Documents authentifiables",
        texte:
          "Vos acquéreurs vérifient eux-mêmes leurs attestations par QR code.",
      },
    ],
  },
  {
    slug: "cabinet-juridique",
    nom: "Cabinets juridiques",
    icon: Briefcase,
    description:
      "Suivez les litiges fonciers de vos clients, consultez les PV de conciliation et l'historique complet des dossiers.",
    cta: "Suivre mes dossiers de litige",
    accroche: "Plaider sur un dossier documenté.",
    enjeux: [
      "Les pièces d'un litige foncier sont dispersées entre plusieurs détenteurs.",
      "La chronologie des décisions est difficile à établir.",
      "Les PV de concertation coutumière circulent mal.",
    ],
    apports: [
      {
        titre: "Historique complet",
        texte:
          "Attributions, transferts et décisions se lisent dans l'ordre, avec leurs dates.",
      },
      {
        titre: "PV de concertation",
        texte:
          "Les procès-verbaux de médiation coutumière sont rattachés au dossier.",
      },
      {
        titre: "Journal opposable",
        texte: "Chaque opération porte son auteur et son horodatage.",
      },
    ],
  },
  {
    slug: "bureau-etudes",
    nom: "Bureaux d'études",
    icon: HardHat,
    description:
      "Instruisez les dossiers ADU et ACD avec une vision claire de chaque étape de validation technique.",
    cta: "Instruire mes dossiers techniques",
    accroche: "Instruire sans perdre le fil des validations.",
    enjeux: [
      "Les étapes de validation d'un dossier ADU ne sont pas visibles de tous.",
      "Les pièces techniques reviennent incomplètes.",
      "Le même dossier peut être instruit deux fois.",
    ],
    apports: [
      {
        titre: "Circuit explicite",
        texte: "Chaque dossier affiche son étape courante et ce qui la débloque.",
      },
      {
        titre: "Pièces rattachées",
        texte: "Les documents techniques restent attachés au lot concerné.",
      },
      {
        titre: "Anti-doublon",
        texte: "Un même lot ne peut pas ouvrir deux dossiers ADU concurrents.",
      },
    ],
  },
  {
    slug: "agence-immobiliere",
    nom: "Agences immobilières",
    icon: Home,
    description:
      "Consultez la disponibilité réelle des lots et rassurez vos clients avec des documents authentifiés en temps réel.",
    cta: "Fiabiliser mes transactions",
    accroche: "Vendre ce qui existe vraiment au registre.",
    enjeux: [
      "Des parcelles sont proposées alors qu'elles sont déjà attribuées.",
      "Les clients n'ont aucun moyen de contrôler ce qu'on leur montre.",
      "La réputation se joue sur un seul dossier qui tourne mal.",
    ],
    apports: [
      {
        titre: "Annonces adossées au registre",
        texte:
          "Sur TerraCI Market, pas d'annonce sans lot enregistré ni surface sans mesure.",
      },
      {
        titre: "Vérification par le client",
        texte: "Vos acquéreurs contrôlent eux-mêmes l'authenticité des pièces.",
      },
      {
        titre: "Statut à jour",
        texte: "La disponibilité d'un lot suit le registre en temps réel.",
      },
    ],
  },
  {
    slug: "entreprise-construction",
    nom: "Entreprises de construction",
    icon: HardHat,
    description:
      "Suivez l'état d'attribution des lots de vos chantiers et la traçabilité des paiements associés.",
    cta: "Suivre mes chantiers",
    accroche: "Bâtir sur un terrain dont le statut est clair.",
    enjeux: [
      "Un chantier démarre parfois sur un lot au statut contesté.",
      "Les interruptions pour litige foncier coûtent des mois.",
      "La traçabilité des paiements liés au lot est incomplète.",
    ],
    apports: [
      {
        titre: "Statut vérifié avant travaux",
        texte: "L'état d'attribution du lot est consultable avant l'ouverture du chantier.",
      },
      {
        titre: "Alerte sur litige",
        texte: "Un lot en litige est identifié comme tel dans le registre.",
      },
      {
        titre: "Paiements rattachés",
        texte: "Les encaissements liés au lot restent traçables.",
      },
    ],
  },
  {
    slug: "investisseur",
    nom: "Investisseurs",
    icon: TrendingUp,
    description:
      "Analysez la disponibilité foncière et vérifiez la conformité de chaque lotissement avant tout engagement financier.",
    cta: "Explorer les opportunités foncières",
    accroche: "Engager des fonds sur des données vérifiables.",
    enjeux: [
      "La qualité documentaire d'un lotissement est invisible de l'extérieur.",
      "Les volumes disponibles se mesurent mal.",
      "Le risque juridique se découvre après l'investissement.",
    ],
    apports: [
      {
        titre: "Score de confiance",
        texte:
          "Chaque lotissement porte un score fondé sur les pièces réellement déposées.",
      },
      {
        titre: "Disponibilité mesurée",
        texte: "Lots libres, attribués et vendus se comptent depuis le registre.",
      },
      {
        titre: "Marché vérifié",
        texte: "TerraCI Market ne référence que des parcelles présentes au cadastre.",
      },
    ],
  },
];

/**
 * Métiers mis en avant sur la page d'accueil, dans l'ordre demandé.
 * Toute entrée doit correspondre à un `slug` de `metiers`.
 */
export const METIERS_VITRINE = [
  "chefferie",
  "collectivite",
  "amenageur",
  "geometre",
  "notaire",
  "banque",
] as const;

export function getMetier(slug: string): Metier | undefined {
  return metiers.find((m) => m.slug === slug);
}
