import Link from "next/link";
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
    cta: "Doter ma collectivité de SGFN",
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
      "Vérifiez instantanément l'authenticité d'un titre foncier avant financement, grâce à la vérification QR SGFN.",
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

export default function MetiersPartenairesPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900 antialiased">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[#0D3B66] group"
        >
          <span className="transform transition-transform group-hover:-translate-x-0.5">←</span>
          Retour à l&apos;accueil
        </Link>
      </div>

      {/* En-tête */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-20 lg:py-24 text-center">
        <p className="mb-4 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
          Métiers partenaires
        </p>
        <h1 className="font-display text-3xl sm:text-4xl lg:text-6xl font-black tracking-[-0.03em] text-[#0D3B66]">
          Une plateforme conçue pour chaque métier du foncier.
        </h1>
        <p className="mx-auto mt-4 sm:mt-6 max-w-3xl text-base sm:text-lg leading-relaxed text-slate-500">
          Collectivités, aménageurs, notaires, géomètres, banques… découvrez ce que SGFN
          apporte concrètement à votre activité et accédez à un espace pensé pour vos besoins.
        </p>
      </section>

      {/* Grille des métiers */}
      <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:gap-6 sm:px-6 sm:pb-24 sm:grid-cols-2 xl:grid-cols-3">
        {metiers.map((m) => (
          <article
            key={m.slug}
            className="flex flex-col rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm sm:p-7"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#0D3B66]/8">
              <m.icon className="h-5 w-5 text-[#0D3B66]" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-[#0D3B66]">{m.nom}</h2>
            <p className="mb-6 flex-1 text-sm leading-relaxed text-slate-500">
              {m.description}
            </p>
            <Link
              href={`/contact?profil=${m.slug}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0D3B66] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1E6091]"
            >
              {m.cta} →
            </Link>
          </article>
        ))}
      </div>

      {/* CTA final */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 pb-16 sm:pb-24 text-center">
        <div className="rounded-2xl sm:rounded-[1.75rem] border border-slate-200/40 bg-white px-6 py-8 sm:px-10 sm:py-10">
          <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#0D3B66]">
            Votre métier n&apos;apparaît pas dans la liste ?
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-500 sm:text-base">
            SGFN s&apos;adapte à de nombreux profils institutionnels. Contactez-nous pour étudier
            votre besoin.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[#0D3B66] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1E6091]"
          >
            Contacter l&apos;équipe SGFN →
          </Link>
        </div>
      </section>
    </main>
  );
}
