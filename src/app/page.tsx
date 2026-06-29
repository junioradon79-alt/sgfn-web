import Image from 'next/image';
import Link from 'next/link';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeMetrics } from '@/components/home/HomeMetrics';

const features = [
  {
    title: "Gestion des lotissements",
    description: "Périmètres, approbations globales et coordination administrative des plans.",
    href: "/services#lotissements",
  },
  {
    title: "Gestion des parcelles",
    description: "Suivi géométrique unitaire, numérotation et superficies des lots cadastraux.",
    href: "/services#parcelles",
  },
  {
    title: "Gestion documentaire",
    description: "Coffre-fort cryptographique pour vos actes d'attestation, cessions et arrêtés.",
    href: "/services#documentaire",
  },
  {
    title: "Suivi des paiements",
    description: "Traçabilité financière intégrée de toutes les transactions et taxes d'attribution.",
    href: "/services#paiements",
  },
  {
    title: "Arbitrage des litiges",
    description: "Registre d'alertes géographiques et archivage des PV de conciliation coutumière.",
    href: "/services#litiges",
  },
  {
    title: "Dossiers ADU & ACD",
    description: "Suivi d'instruction des dossiers techniques d'approbation et titres définitifs.",
    href: "/services#adu",
  },
];

const steps = [
  'Collecte et validation des informations foncières',
  'Structuration des parcelles et lotissements',
  'Validation administrative, documentaire et coutumière',
  'Suivi, sécurisation et publication des décisions',
];

export default function HomePage() {
  return (
    <div className="min-h-screen scroll-smooth bg-[#F8FAFC] text-slate-900 antialiased">
      <HomeHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto flex max-w-6xl flex-col items-center px-4 sm:px-6 pb-16 sm:pb-24 lg:pb-32 pt-14 sm:pt-20 lg:pt-28 text-center">
          <span className="mb-5 rounded-full bg-[#F39C12]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#F39C12]">
            Sécurisez le foncier
          </span>
          <h1 className="max-w-4xl text-3xl sm:text-5xl lg:text-7xl font-black leading-tight tracking-[-0.03em] text-[#0D3B66]">
            Le foncier, centralisé, transparent et sécurisé.
          </h1>
          <p className="mt-5 sm:mt-6 max-w-2xl text-base sm:text-lg lg:text-xl leading-relaxed text-slate-600">
            SGFN transforme la gouvernance foncière en un système numérique fiable pour les familles, les chefferies, les géomètres et les administrations.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm font-semibold tracking-tight">
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0D3B66] px-6 py-3 text-white shadow-md transition hover:bg-[#1E6091] active:scale-[0.98] group"
            >
              Accéder à la plateforme
              <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="#apropos"
              className="text-slate-500 hover:text-[#0D3B66] inline-flex items-center gap-1.5 group transition-colors"
            >
              Découvrir SGFN
              <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </div>

          {/* Mock dashboard */}
          <div className="mt-14 sm:mt-20 w-full max-w-5xl rounded-2xl sm:rounded-[2rem] border border-slate-200/60 bg-white p-4 sm:p-6 lg:p-10">
            <div className="rounded-xl sm:rounded-[1.5rem] border border-slate-200/50 bg-[#F8FAFC] p-4 sm:p-6 lg:p-8">
              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                <div className="space-y-3 text-left">
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Vue d'ensemble</p>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[#0D3B66]">
                    Un tableau de bord unique pour piloter chaque parcelle.
                  </h2>
                  <p className="text-sm sm:text-base leading-relaxed text-slate-600">
                    Centralisez les dossiers, les documents, les validations et les décisions dans un environnement cohérent et sécurisé.
                  </p>
                </div>
                <div className="rounded-xl sm:rounded-2xl border border-slate-200/60 bg-white p-4 sm:p-5">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 sm:pb-4">
                    <p className="text-xs sm:text-sm font-semibold text-slate-500">État du système</p>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                      En ligne
                    </span>
                  </div>
                  <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
                    {[
                      { label: 'Dossiers actifs', value: '124', color: 'text-[#0D3B66]' },
                      { label: 'Validations en cours', value: '18', color: 'text-[#0D3B66]' },
                      { label: 'Taux de conformité', value: '99,2%', color: 'text-emerald-600' },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between rounded-lg sm:rounded-xl bg-[#F8FAFC] px-3 sm:px-4 py-2.5 sm:py-3"
                      >
                        <span className="text-xs sm:text-sm text-slate-600">{row.label}</span>
                        <span className={`font-semibold text-sm sm:text-base ${row.color}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* À propos */}
        <section id="apropos" className="mx-auto max-w-6xl border-t border-slate-200/40 px-4 sm:px-6 py-14 sm:py-24 lg:py-32">
          <div className="grid gap-8 sm:gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <p className="mb-3 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">La vision</p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#0D3B66]">
                Un écosystème souverain au service de la transparence foncière.
              </h2>
            </div>
            <div className="space-y-4 text-base sm:text-lg leading-relaxed text-slate-600">
              <p>
                SGFN repense la gouvernance foncière numérique en Côte d'Ivoire. En centralisant les archives, en structurant les découpages cadastraux et en authentifiant chaque acte, la plateforme crée un environnement fiable pour les autorités coutumières, les géomètres et les acquéreurs.
              </p>
              <p>
                L'objectif est clair : réduire les risques, accélérer les décisions et garantir une traçabilité irréprochable de bout en bout.
              </p>
            </div>
          </div>
        </section>

        {/* Chiffres */}
        <section id="chiffres" className="mx-auto max-w-6xl border-t border-slate-200/40 px-4 sm:px-6 py-14 sm:py-24 lg:py-32">
          <div className="mb-8 sm:mb-10 text-center">
            <p className="mb-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Statistiques réelles</p>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#0D3B66]">La plateforme en chiffres</h3>
          </div>

          <HomeMetrics />
        </section>

        {/* Fonctionnalités */}
        <section id="fonctions" className="mx-auto max-w-6xl border-t border-slate-200/40 px-4 sm:px-6 py-14 sm:py-24 lg:py-32">
          <div className="mb-8 sm:mb-10 max-w-3xl">
            <p className="mb-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Modules SaaS</p>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#0D3B66]">
              Une infrastructure complète pour le foncier numérique.
            </h3>
          </div>

          <div className="grid gap-3 sm:gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="flex flex-col justify-between rounded-xl sm:rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-6 transition-colors hover:bg-[#F8FAFC]">
                <div>
                  <h4 className="mb-2 text-base sm:text-lg font-semibold text-[#0D3B66]">{feature.title}</h4>
                  <p className="text-sm leading-relaxed text-slate-600">{feature.description}</p>
                </div>
                <Link href={feature.href} className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#1E6091] transition hover:text-[#0D3B66]">
                  En savoir plus →
                </Link>
              </article>
            ))}
          </div>
        </section>

        {/* Processus */}
        <section id="processus" className="mx-auto max-w-6xl border-t border-slate-200/40 px-4 sm:px-6 py-14 sm:py-24 lg:py-32">
          <div className="grid gap-8 sm:gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <p className="mb-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Processus</p>
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#0D3B66]">
                Une marche de validation claire à chaque étape.
              </h3>
              <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600">
                Le flux SGFN a été conçu pour simplifier la coordination entre les parties prenantes, tout en garantissant une qualité de décision élevée.
              </p>
            </div>

            <div className="rounded-xl sm:rounded-[1.5rem] border border-slate-200/60 bg-white p-4 sm:p-6 overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-3 pr-4 font-semibold whitespace-nowrap">Étape</th>
                    <th className="pb-3 font-semibold">Objectif</th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((step, index) => (
                    <tr key={step} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 pr-4 font-semibold text-[#0D3B66] whitespace-nowrap">0{index + 1}</td>
                      <td className="py-3">{step}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl border-t border-slate-200/40 px-4 sm:px-6 py-14 sm:py-24 lg:py-32">
        <div className="mb-8 sm:mb-10">
          <p className="mb-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">FAQ</p>
          <h3 className="font-bold text-2xl sm:text-3xl text-[#0D3B66]">Questions fréquentes</h3>
        </div>

        <div className="rounded-xl sm:rounded-[1.5rem] border border-slate-200/60 bg-white p-2">
          {[
            {
              q: 'Comment SGFN garantit-il la sécurité des documents ?',
              a: 'Chaque document et procès-verbal téléversé est chiffré et tracé de manière immuable en base de données, empêchant toute falsification ou double attribution.',
            },
            {
              q: "Qui peut accéder à la plateforme ?",
              a: "L'accès est sectorisé par rôles stricts : familles coutumières, chefferies, géomètres et acquéreurs disposent chacun d'un espace sécurisé propre à leurs prérogatives.",
            },
            {
              q: "La plateforme est-elle synchronisée avec le cadastre national ?",
              a: "SGFN est conçu comme une infrastructure d'interconnexion moderne visant à centraliser et fluidifier l'instruction des dossiers jusqu'à l'obtention de l'ACD.",
            },
          ].map((item, i, arr) => (
            <div
              key={item.q}
              className={`px-4 sm:px-6 py-5 sm:py-6 ${i < arr.length - 1 ? 'border-b border-slate-200/60' : ''}`}
            >
              <h4 className="text-base sm:text-lg font-semibold text-[#0D3B66]">{item.q}</h4>
              <p className="mt-2 sm:mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="mx-auto max-w-6xl border-t border-slate-200/40 px-4 sm:px-6 py-14 sm:py-24 lg:py-32">
        <div className="text-center">
          <p className="mb-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Contact</p>
          <h3 className="font-bold text-2xl sm:text-3xl text-[#0D3B66]">Contactez notre équipe</h3>
          <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base leading-relaxed text-slate-600">
            Une question sur le déploiement ou besoin d'une démonstration ? Écrivez-nous.
          </p>
        </div>

        <div className="mx-auto mt-8 sm:mt-10 max-w-2xl rounded-2xl sm:rounded-[2rem] border border-slate-200/60 bg-white p-6 sm:p-10">
          <Link
            href="/contact"
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#0D3B66] px-4 text-sm font-semibold text-white transition hover:bg-[#1E6091]"
          >
            Ouvrir le formulaire de contact →
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200/40 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:px-6 py-8 sm:py-10 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 SGFN. Gouvernance foncière moderne et souveraine.</p>
          <div className="flex gap-6 flex-wrap">
            <Link href="#apropos" className="transition hover:text-[#0D3B66]">Vision</Link>
            <Link href="#fonctions" className="transition hover:text-[#0D3B66]">Fonctionnalités</Link>
            <Link href="/contact" className="transition hover:text-[#0D3B66]">Contact</Link>
            <Link href="/login" className="transition hover:text-[#0D3B66]">Connexion</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
