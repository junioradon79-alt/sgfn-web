import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

import { metiers, getMetier } from "@/lib/metiers";
import { VitrineHeader } from "@/components/home/VitrineHeader";
import { SiteFooter } from "@/components/home/SiteFooter";

// Export statique (output: 'export') : chaque route [slug] doit être connue au
// moment du build — le catalogue métiers est en dur, aucune requête réseau.
export function generateStaticParams() {
  return metiers.map((m) => ({ slug: m.slug }));
}

export default async function MetierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const metier = getMetier(slug);
  if (!metier) notFound();

  const autres = metiers.filter((m) => m.slug !== metier.slug).slice(0, 5);

  return (
    <>
      <VitrineHeader />
      <main>
        {/* ── En-tête ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-border px-5 pb-14 pt-12 sm:px-7 sm:pt-16">
          <div
            className="pointer-events-none absolute left-1/2 top-[-180px] h-[520px] w-[860px] -translate-x-1/2 blur-[10px]"
            style={{
              background:
                "radial-gradient(closest-side, rgba(30,136,229,.18), rgba(11,77,136,.07) 60%, transparent 75%)",
            }}
          />
          <div className="relative mx-auto max-w-[1280px]">
            <Link
              href="/metiers-partenaires"
              className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Tous les métiers
            </Link>

            <div className="mt-7 flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent-subtle text-primary">
                <metier.icon className="size-7" />
              </span>
              <p className="text-[12.5px] font-bold uppercase tracking-[0.09em] text-accent">{metier.nom}</p>
            </div>

            <h1 className="mt-5 max-w-[780px] text-[clamp(30px,5vw,46px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-foreground">
              {metier.accroche}
            </h1>
            <p className="mt-5 max-w-[620px] text-[17px] leading-[1.65] text-muted-foreground">{metier.description}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/contact?profil=${metier.slug}`}
                className="inline-flex h-[50px] items-center gap-2.5 rounded-xl bg-primary px-6 text-[14.5px] font-bold text-primary-foreground shadow-[0_10px_24px_rgba(11,77,136,.28)] transition-colors hover:bg-primary-700"
              >
                {metier.cta} <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-[50px] items-center gap-2.5 rounded-xl border border-border-strong bg-card px-5 text-[14.5px] font-bold text-foreground transition-colors hover:bg-inset"
              >
                Demander une démonstration
              </Link>
            </div>
          </div>
        </section>

        {/* ── Enjeux ──────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-7 sm:py-20">
          <div className="grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
            <div>
              <p className="text-[12.5px] font-bold uppercase tracking-[0.09em] text-accent">Le point de départ</p>
              <h2 className="mt-3 text-[30px] font-extrabold leading-[1.18] tracking-[-0.02em] text-foreground">
                Ce que le terrain impose aujourd&apos;hui.
              </h2>
            </div>
            <ul className="flex flex-col gap-3.5">
              {metier.enjeux.map((e) => (
                <li
                  key={e}
                  className="rounded-2xl border border-border bg-card p-5 text-[14.5px] leading-[1.6] text-muted-foreground"
                >
                  {e}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Apports ─────────────────────────────────────────────────────── */}
        <section className="border-y border-border bg-card px-5 py-16 sm:px-7 sm:py-24">
          <div className="mx-auto max-w-[1280px]">
            <div className="max-w-[640px]">
              <p className="text-[12.5px] font-bold uppercase tracking-[0.09em] text-accent">Ce que SGNF apporte</p>
              <h2 className="mt-3 text-[32px] font-extrabold tracking-[-0.02em] text-foreground">
                Concrètement, sur vos dossiers.
              </h2>
            </div>
            <div className="mt-11 grid gap-4.5 sm:grid-cols-2">
              {metier.apports.map((a) => (
                <div
                  key={a.titre}
                  className="rounded-[18px] border border-border bg-background p-6 transition duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_10px_24px_rgba(15,23,42,.08)]"
                >
                  <CheckCircle2 className="size-5 text-success" />
                  <h3 className="mt-4 text-[16.5px] font-bold text-foreground">{a.titre}</h3>
                  <p className="mt-2 text-[13.5px] leading-[1.6] text-muted-foreground">{a.texte}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Autres métiers ──────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-7 sm:py-20">
          <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-foreground">Autres métiers</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {autres.map((m) => (
              <Link
                key={m.slug}
                href={`/metiers/${m.slug}`}
                className="inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2.5 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
              >
                <m.icon className="size-4 text-primary" />
                {m.nom}
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
