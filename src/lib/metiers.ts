import type { LucideIcon } from "lucide-react";
import {
  Landmark,
  Ruler,
  Scale,
  Building2,
  Briefcase,
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
};

export const metiers: Metier[] = [
  {
    slug: "collectivite",
    nom: "Collectivités territoriales",
    icon: Landmark,
    description:
      "Pilotez vos lotissements, suivez les attributions et sécurisez les décisions administratives de votre territoire.",
    cta: "Doter ma collectivité de SGNF",
  },
  {
    slug: "amenageur",
    nom: "Aménageurs fonciers",
    icon: Building2,
    description:
      "Structurez vos périmètres, gérez les îlots et les lots, et coordonnez chaque validation avec les autorités compétentes.",
    cta: "Digitaliser mes aménagements",
  },
  {
    slug: "promoteur",
    nom: "Promoteurs immobiliers",
    icon: Building,
    description:
      "Centralisez vos programmes, suivez les ventes et les paiements, et accélérez vos délais de commercialisation.",
    cta: "Connecter mes programmes",
  },
  {
    slug: "geometre",
    nom: "Géomètres",
    icon: Ruler,
    description:
      "Rattachez vos relevés topographiques aux parcelles officielles et fiabilisez chaque numérotation cadastrale.",
    cta: "Rejoindre le réseau des géomètres",
  },
  {
    slug: "notaire",
    nom: "Notaires",
    icon: Scale,
    description:
      "Accédez aux actes authentifiés, vérifiez l'historique de propriété et sécurisez vos dossiers d'authentification.",
    cta: "Sécuriser mes actes notariés",
  },
  {
    slug: "cabinet-juridique",
    nom: "Cabinets juridiques",
    icon: Briefcase,
    description:
      "Suivez les litiges fonciers de vos clients, consultez les PV de conciliation et l'historique complet des dossiers.",
    cta: "Suivre mes dossiers de litige",
  },
  {
    slug: "bureau-etudes",
    nom: "Bureaux d'études",
    icon: HardHat,
    description:
      "Instruisez les dossiers ADU et ACD avec une vision claire de chaque étape de validation technique.",
    cta: "Instruire mes dossiers techniques",
  },
  {
    slug: "banque",
    nom: "Banques",
    icon: Landmark,
    description:
      "Vérifiez instantanément l'authenticité d'un titre foncier avant financement, grâce à la vérification QR SGNF.",
    cta: "Sécuriser mes dossiers de financement",
  },
  {
    slug: "agence-immobiliere",
    nom: "Agences immobilières",
    icon: Home,
    description:
      "Consultez la disponibilité réelle des lots et rassurez vos clients avec des documents authentifiés en temps réel.",
    cta: "Fiabiliser mes transactions",
  },
  {
    slug: "entreprise-construction",
    nom: "Entreprises de construction",
    icon: HardHat,
    description:
      "Suivez l'état d'attribution des lots de vos chantiers et la traçabilité des paiements associés.",
    cta: "Suivre mes chantiers",
  },
  {
    slug: "investisseur",
    nom: "Investisseurs",
    icon: TrendingUp,
    description:
      "Analysez la disponibilité foncière et vérifiez la conformité de chaque lotissement avant tout engagement financier.",
    cta: "Explorer les opportunités foncières",
  },
];
