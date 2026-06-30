import Link from 'next/link';
import { Clock, ShieldCheck, Lock, LayoutDashboard } from 'lucide-react';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeMetrics } from '@/components/home/HomeMetrics';

const benefices = [
  {
    titre: "Gagner du temps",
    description: "Réduction des tâches administratives grâce à des processus entièrement digitalisés.",
    icon: Clock,
  },
  {
    titre: "Réduire les risques",
    description: "Historique complet et traçabilité de chaque opération foncière.",
    icon: ShieldCheck,
  },
  {
    titre: "Travailler en confiance",
    description: "Accès sécurisé réservé aux utilisateurs autorisés selon leur rôle.",
    icon: Lock,
  },
  {
    titre: "Mieux piloter",
    description: "Des tableaux de bord facilitent le pilotage stratégique de vos projets.",
    icon: LayoutDashboard,
  },
];

const indicateurs = [
  "Une seule plateforme",
  "Une traçabilité complète",
  "Une collaboration fluide",
  "Une sécurité renforcée",
];

const garantiesSecurite = [
  "Confidentialité",
  "Contrôle des accès",
  "Traçabilité",
  "Sauvegarde",
  "Haute disponibilité",
];

const publicCible = [
  "Collectivités territoriales",
  "Aménageurs fonciers",
  "Promoteurs immobiliers",
  "Géomètres",
  "Notaires",
  "Cabinets juridiques",
  "Bureaux d'études",
  "Investisseurs",
  "Entreprises de construction",
];

const modules = [
  {
    titre: "Gestion des lotissements",
    description: "Périmètres, approbations globales et coordination administrative des plans.",
  },
  {
    titre: "Gestion des parcelles",
    description: "Suivi géométrique unitaire, numérotation et superficies des lots cadastraux.",
  },
  {
    titre: "Coffre-fort documentaire",
    description: "Centralisation sécurisée de vos actes d'attestation, cessions et arrêtés.",
  },
  {
    titre: "Suivi des paiements",
    description: "Traçabilité financière intégrée de toutes les transactions et taxes d'attribution.",
  },
  {
    titre: "Arbitrage des litiges",
    description: "Registre d'alertes géographiques et archivage des PV de conciliation coutumière.",
  },
  {
    titre: "Dossiers ADU & ACD",
    description: "Suivi d'instruction des dossiers techniques jusqu'à l'obtention du titre définitif.",
  },
];

const etapes = [
  "Collecte et validation des informations foncières",
  "Structuration des parcelles et lotissements",
  "Validation administrative, documentaire et coutumière",
  "Suivi, sécurisation et publication des décisions",
];

const faq = [
  {
    q: "Comment SGFN garantit-il la sécurité des documents ?",
    a: "Chaque document et procès-verbal téléversé est chiffré et tracé de manière immuable en base de données, empêchant toute falsification ou double attribution.",
  },
  {
    q: "Qui peut accéder à la plateforme ?",
    a: "L'accès est structuré par rôles stricts : collectivités, aménageurs, géomètres, notaires et opérateurs fonciers disposent chacun d'un espace sécurisé propre à leurs prérogatives.",
  },
  {
    q: "La plateforme est-elle synchronisée avec le cadastre national ?",
    a: "SGFN est conçu comme une infrastructure d'interconnexion moderne visant à centraliser et fluidifier l'instruction des dossiers jusqu'à l'obtention de l'ACD.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen scroll-smooth bg-[#F8FAFC] text-slate-900 antialiased">
      <HomeHeader />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="mx-auto flex max-w-6xl flex-col items-center px-4 sm:px-6 pb-16 sm:pb-24 lg:pb-32 pt-14 sm:pt-20 lg:pt-28 text-center">
          <span className="mb-5 rounded-full border border-[#0D3B66]/12 bg-[#0D3B66]/6 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#1E6091]">
            Infrastructure numérique foncière
          </span>

          <h1 className="max-w-4xl text-3xl sm:text-5xl lg:text-6xl font-black leading-[1.08] tracking-[-0.03em] text-[#0D3B66]">
            La plateforme de référence pour sécuriser, centraliser et piloter vos opérations foncières.
          </h1>

          <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-500">
            SGFN accompagne les collectivités, aménageurs, promoteurs immobiliers et opérateurs fonciers
            dans la digitalisation complète de leurs projets grâce à une plateforme sécurisée,
            collaborative et conforme aux exigences du secteur.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/contact"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0D3B66] px-7 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#1E6091] active:scale-[0.98]"
            >
              Demander une démonstration
            </Link>
            <Link
              href="#apropos"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-7 py-3.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-[#0D3B66]/30 hover:text-[#0D3B66]"
            >
              Découvrir la plateforme
            </Link>
          </div>
        </section>

        {/* ── Bloc confiance ────────────────────────────────────────────────── */}
        <section className="border-t border-slate-200/40 bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20 lg:py-24">
            <div className="text-center mb-10 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0D3B66]">
                Pourquoi les professionnels choisissent SGFN ?
              </h2>
              <p className="mt-3 text-base sm:text-lg text-slate-500">
                Parce qu'en matière de foncier, une simple erreur peut coûter des millions.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
              {["Traçable", "Sécurisée", "Transparente", "Contrôlée", "Documentée"].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2.5 rounded-full border border-emerald-200/70 bg-emerald-50/60 px-5 py-3 text-sm font-semibold text-emerald-800"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                    ✓
                  </span>
                  Chaque opération est {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── À propos ─────────────────────────────────────────────────────── */}
        <section id="apropos" className="mx-auto max-w-6xl border-t border-slate-200/40 px-4 sm:px-6 py-14 sm:py-24 lg:py-32">
          <div className="grid gap-8 sm:gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="mb-3 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
                À propos
              </p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#0D3B66]">
                Une plateforme professionnelle dédiée à la gouvernance foncière.
              </h2>
            </div>
            <div className="space-y-5 text-base sm:text-lg leading-relaxed text-slate-600">
              <p>
                SGFN est une plateforme professionnelle dédiée à la transformation numérique des opérations
                foncières en Côte d'Ivoire. Sa mission est de permettre aux acteurs du foncier de travailler
                plus rapidement tout en renforçant la transparence, la sécurité et la maîtrise des risques.
              </p>
              <p>
                Toutes les parcelles, tous les documents, toutes les transactions et toutes les décisions
                sont centralisés dans un environnement unique, sécurisé et collaboratif.
              </p>
            </div>
          </div>
        </section>

        {/* ── Bénéfices ────────────────────────────────────────────────────── */}
        <section className="border-t border-slate-200/40 bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-24 lg:py-32">
            <div className="mb-10 sm:mb-14">
              <p className="mb-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
                Bénéfices
              </p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#0D3B66]">
                Ce que SGFN change concrètement.
              </h2>
            </div>

            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {benefices.map((b) => (
                <div
                  key={b.titre}
                  className="rounded-2xl border border-slate-200/60 bg-[#F8FAFC] p-6 sm:p-7"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D3B66]/8">
                    <b.icon className="h-5 w-5 text-[#0D3B66]" />
                  </div>
                  <h3 className="mb-2 text-base font-bold text-[#0D3B66]">{b.titre}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{b.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Indicateurs de valeur ────────────────────────────────────────── */}
        <section className="border-t border-[#0D3B66] bg-[#0D3B66]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
            <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
              {indicateurs.map((ind) => (
                <div key={ind} className="flex items-center gap-3 py-2">
                  <span className="shrink-0 text-[#F39C12] text-lg font-bold">—</span>
                  <span className="text-sm sm:text-base font-semibold text-white leading-snug">{ind}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Chiffres réels ───────────────────────────────────────────────── */}
        <section id="chiffres" className="mx-auto max-w-6xl border-t border-slate-200/40 px-4 sm:px-6 py-14 sm:py-24 lg:py-32">
          <div className="mb-8 sm:mb-10 text-center">
            <p className="mb-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
              Statistiques réelles
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#0D3B66]">
              La plateforme en chiffres
            </h2>
          </div>
          <HomeMetrics />
        </section>

        {/* ── Modules ──────────────────────────────────────────────────────── */}
        <section id="fonctions" className="border-t border-slate-200/40 bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-24 lg:py-32">
            <div className="mb-8 sm:mb-12 max-w-3xl">
              <p className="mb-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
                Modules
              </p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#0D3B66]">
                Une infrastructure complète pour le foncier numérique.
              </h2>
            </div>

            <div className="grid gap-3 sm:gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {modules.map((m) => (
                <article
                  key={m.titre}
                  className="rounded-2xl border border-slate-200/60 bg-[#F8FAFC] p-5 sm:p-6"
                >
                  <h3 className="mb-2 text-base font-semibold text-[#0D3B66]">{m.titre}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{m.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Sécurité ─────────────────────────────────────────────────────── */}
        <section className="border-t border-slate-200/40 bg-[#F8FAFC]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-24 lg:py-32">
            <div className="grid gap-8 sm:gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="mb-3 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
                  Sécurité
                </p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#0D3B66]">
                  La sécurité est au cœur de SGFN.
                </h2>
                <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-500">
                  Les données foncières constituent un patrimoine stratégique. SGFN garantit leur
                  intégrité à chaque étape de leur cycle de vie.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {garantiesSecurite.map((g) => (
                  <div
                    key={g}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0D3B66]/8 text-[#0D3B66] text-sm font-bold">
                      ✓
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{g}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Public cible ─────────────────────────────────────────────────── */}
        <section className="border-t border-slate-200/40 bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-24 lg:py-32">
            <div className="mb-8 sm:mb-12 text-center">
              <p className="mb-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
                Public cible
              </p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#0D3B66]">
                Conçu pour les acteurs du foncier professionnel.
              </h2>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {publicCible.map((p) => (
                <span
                  key={p}
                  className="rounded-full border border-slate-200 bg-[#F8FAFC] px-5 py-2.5 text-sm font-medium text-slate-700"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Processus ────────────────────────────────────────────────────── */}
        <section id="processus" className="border-t border-slate-200/40 bg-[#F8FAFC]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-24 lg:py-32">
            <div className="grid gap-8 sm:gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
              <div>
                <p className="mb-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
                  Processus
                </p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#0D3B66]">
                  Une marche de validation claire à chaque étape.
                </h2>
                <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-500">
                  Le flux SGFN a été conçu pour simplifier la coordination entre les parties prenantes,
                  tout en garantissant une qualité de décision élevée.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/60 bg-white p-4 sm:p-6 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400">
                      <th className="pb-3 pr-4 font-semibold whitespace-nowrap">Étape</th>
                      <th className="pb-3 font-semibold">Objectif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etapes.map((etape, i) => (
                      <tr key={etape} className="border-b border-slate-100 last:border-b-0">
                        <td className="py-3 pr-4 font-semibold text-[#0D3B66] whitespace-nowrap">
                          0{i + 1}
                        </td>
                        <td className="py-3">{etape}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA final ────────────────────────────────────────────────────── */}
        <section className="border-t border-[#0D3B66] bg-[#0D3B66]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 lg:py-32 text-center">
            <h2 className="mx-auto max-w-3xl text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-white">
              Faites du foncier un levier de confiance et de performance.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-white/70">
              Découvrez comment SGFN peut moderniser vos projets fonciers.
            </p>
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/contact"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-sm font-bold text-[#0D3B66] shadow-md transition hover:bg-slate-100 active:scale-[0.98]"
              >
                Demander une démonstration personnalisée →
              </Link>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section id="faq" className="mx-auto max-w-6xl border-t border-slate-200/40 px-4 sm:px-6 py-14 sm:py-24 lg:py-32">
          <div className="mb-8 sm:mb-10">
            <p className="mb-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
              FAQ
            </p>
            <h2 className="font-bold text-2xl sm:text-3xl text-[#0D3B66]">Questions fréquentes</h2>
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-white p-2">
            {faq.map((item, i) => (
              <div
                key={item.q}
                className={`px-4 sm:px-6 py-5 sm:py-6 ${i < faq.length - 1 ? "border-b border-slate-200/60" : ""}`}
              >
                <h3 className="text-base sm:text-lg font-semibold text-[#0D3B66]">{item.q}</h3>
                <p className="mt-2 sm:mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Contact ──────────────────────────────────────────────────────── */}
        <section id="contact" className="mx-auto max-w-6xl border-t border-slate-200/40 px-4 sm:px-6 py-14 sm:py-24 lg:py-32">
          <div className="text-center">
            <p className="mb-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
              Contact
            </p>
            <h2 className="font-bold text-2xl sm:text-3xl text-[#0D3B66]">Contactez notre équipe</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base leading-relaxed text-slate-600">
              Une question sur le déploiement ou besoin d'une démonstration ? Écrivez-nous.
            </p>
          </div>

          <div className="mx-auto mt-8 sm:mt-10 max-w-2xl rounded-2xl border border-slate-200/60 bg-white p-6 sm:p-10">
            <Link
              href="/contact"
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#0D3B66] px-4 text-sm font-semibold text-white transition hover:bg-[#1E6091]"
            >
              Ouvrir le formulaire de contact →
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/40 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:px-6 py-8 sm:py-10 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 SGFN. Gouvernance foncière numérique et souveraine.</p>
          <div className="flex gap-6 flex-wrap">
            <Link href="#apropos" className="transition hover:text-[#0D3B66]">À propos</Link>
            <Link href="#fonctions" className="transition hover:text-[#0D3B66]">Modules</Link>
            <Link href="#faq" className="transition hover:text-[#0D3B66]">FAQ</Link>
            <Link href="/contact" className="transition hover:text-[#0D3B66]">Contact</Link>
            <Link href="/login" className="transition hover:text-[#0D3B66]">Connexion</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
