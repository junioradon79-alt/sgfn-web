import Link from "next/link";
import { metiers } from "@/lib/metiers";

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
          Collectivités, aménageurs, notaires, géomètres, banques… découvrez ce que SGNF
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
              href={`/metiers/${m.slug}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0D3B66] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1E6091]"
            >
              Découvrir →
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
            SGNF s&apos;adapte à de nombreux profils institutionnels. Contactez-nous pour étudier
            votre besoin.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[#0D3B66] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1E6091]"
          >
            Contacter l&apos;équipe SGNF →
          </Link>
        </div>
      </section>
    </main>
  );
}
