import Link from 'next/link';

const modules = [
  {
    id: "lotissements",
    title: "Gestion des lotissements",
    summary: "Modélisez les périmètres, importez les plans globaux et coordonnez les validations administratives avec une clarté maximale.",
    details: "Chaque lotissement est structuré comme une unité de gouvernance complète, avec une vue d'ensemble des périmètres, des approbations et des dépendances techniques entre les acteurs.",
  },
  {
    id: "parcelles",
    title: "Gestion des parcelles",
    summary: "Suivez chaque parcelle individuellement avec une numérotation automatique, un contrôle géométrique précis et un calcul instantané des superficies.",
    details: "Le module parcellaire garantit une gestion fine des limites, des unités cadastrales et des évolutions de surface, sans rupture dans la traçabilité historique.",
  },
  {
    id: "documentaire",
    title: "Gestion documentaire",
    summary: "Archivez et signez électroniquement chaque acte dans un coffre-fort numérique sécurisé, auditable et résilient.",
    details: "Les documents sont stockés avec une sécurité renforcée, un contrôle d'accès strict et une immutabilité de l'historique pour éviter toute altération ou perte.",
  },
  {
    id: "paiements",
    title: "Suivi des paiements",
    summary: "Traquez chaque transaction, taxe d'attribution et mouvement financier avec une visibilité complète et inédite.",
    details: "Le module financier relie les opérations de paiement à chaque dossier, rendant le suivi transparent pour les équipes internes comme pour les parties prenantes.",
  },
  {
    id: "litiges",
    title: "Arbitrage des litiges",
    summary: "Centralisez les alertes géographiques, les procès-verbaux de conciliation et l'historique des litiges en un espace unique.",
    details: "La plateforme transforme l'arbitrage en un workflow robuste où la géolocalisation, les pièces jointes et les décisions sont parfaitement reliées.",
  },
  {
    id: "adu",
    title: "Dossiers ADU & ACD",
    summary: "Pilotage complet du flux technique jusqu'à l'approbation finale, avec suivi des dossiers et des validations en temps réel.",
    details: "Chaque dossier suit une trajectoire claire de validation jusqu'à l'aboutissement, avec une orchestration fine des étapes techniques et administratives.",
  },
];

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900 antialiased">
      {/* Lien retour */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[#0D3B66] group"
        >
          <span className="transform transition-transform group-hover:-translate-x-0.5">←</span>
          Retour à l'accueil
        </Link>
      </div>

      {/* En-tête */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-20 lg:py-24 text-center">
        <p className="mb-4 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Modules SGNF</p>
        <h1 className="font-display text-3xl sm:text-4xl lg:text-6xl font-black tracking-[-0.03em] text-[#0D3B66]">
          L'infrastructure technique de SGNF.
        </h1>
        <p className="mx-auto mt-4 sm:mt-6 max-w-3xl text-base sm:text-lg leading-relaxed text-slate-500">
          Découvrez la puissance et la rigueur de nos modules conçus pour réinventer la gestion foncière privée.
        </p>
      </section>

      {/* Modules */}
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:gap-8 px-4 sm:px-6 pb-16 sm:pb-20">
        {modules.map((module) => (
          <section
            key={module.id}
            id={module.id}
            className="w-full rounded-2xl sm:rounded-[1.75rem] border border-slate-200/40 bg-white px-5 py-10 sm:px-8 sm:py-14 lg:px-12"
          >
            <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <div>
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Module</p>
                <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-[#0D3B66]">
                  {module.title}
                </h2>
                <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-8 text-slate-600">{module.summary}</p>
              </div>
              <div className="rounded-xl sm:rounded-[1.5rem] border border-slate-200/40 bg-[#F8FAFC] p-5 sm:p-6">
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Architecture</p>
                <p className="mt-3 sm:mt-4 text-sm sm:text-base leading-7 sm:leading-8 text-slate-600">{module.details}</p>
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* CTA final */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 pb-16 sm:pb-24 text-center">
        <div className="rounded-2xl sm:rounded-[1.75rem] border border-slate-200/40 bg-white px-6 py-8 sm:px-10 sm:py-10">
          <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#0D3B66]">
            Prêt à sécuriser votre espace ?
          </h3>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[#0D3B66] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1E6091]"
          >
            Accéder à la plateforme →
          </Link>
        </div>
      </section>
    </main>
  );
}
