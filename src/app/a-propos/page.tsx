import Link from 'next/link';

const pillars = [
  {
    title: "Gouvernance foncière",
    body: "SGFN structure chaque dossier autour d'un cadre de décision transparent, auditable et conforme aux exigences de sécurité institutionnelle.",
  },
  {
    title: "Souveraineté des données",
    body: "Les informations sensibles restent maîtrisées au niveau local, avec une traçabilité immuable et un contrôle strict des accès par profil.",
  },
  {
    title: "Interconnexion sécurisée",
    body: "Familles, chefferies, géomètres et administration communiquent à travers un espace unique, cohérent et sécurisé.",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <section className="mx-auto flex max-w-4xl flex-col px-4 sm:px-6 py-12 sm:py-20 text-center">
        <Link
          href="/"
          className="mb-8 self-start sm:self-center text-sm font-semibold text-[#1E6091] transition hover:text-[#0D3B66]"
        >
          ← Retour à l'accueil
        </Link>

        <p className="mb-4 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">À propos</p>
        <h1 className="font-display text-3xl sm:text-4xl lg:text-6xl font-black tracking-[-0.03em] text-[#0D3B66]">
          La modernisation du patrimoine foncier.
        </h1>

        <p className="mx-auto mt-6 sm:mt-8 max-w-3xl text-base sm:text-lg leading-relaxed text-slate-600">
          SGFN accompagne la transformation numérique du foncier en Côte d'Ivoire avec une approche claire, institutionnelle et souveraine.
        </p>

        <div className="mt-10 sm:mt-16 grid gap-4 sm:gap-6 sm:grid-cols-3">
          {pillars.map((pillar) => (
            <article
              key={pillar.title}
              className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-left shadow-sm"
            >
              <h2 className="mb-3 text-base sm:text-xl font-semibold text-[#0D3B66]">{pillar.title}</h2>
              <p className="text-sm leading-relaxed text-slate-600">{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
