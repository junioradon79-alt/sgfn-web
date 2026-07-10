"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Compass,
  CreditCard,
  FileCheck2,
  HelpCircle,
  Landmark,
  PartyPopper,
  Phone,
  Printer,
  QrCode,
  ShieldCheck,
} from "lucide-react";

/**
 * « Acheter mon terrain » — guide grand public du parcours acquéreur, pensé pour
 * une audience majoritairement peu à l'aise avec le numérique (et la lecture) :
 * gros pictogrammes, phrases très courtes, une seule action à la fois, zéro
 * jargon (pas de « cession », « échéance », « attestation de cession »). Les
 * boutons montrés sont des reproductions fidèles de ceux de « Mon achat » pour
 * que la personne les reconnaisse à l'écran.
 *
 * Page autonome (hors layout /dashboard) : contenu générique, aucune donnée
 * privée → publique, imprimable proprement (bouton « Imprimer / PDF ») et
 * partageable par l'agence. Voir src/app/dashboard/mon-achat/page.tsx.
 */

const BLEU = "#0D3B66";
const VERT = "#2D8F5A";
const ORANGE = "#F39C12";

const printCss = `
@media print {
  .no-print { display: none !important; }
  body { background: #fff !important; }
  .guide-page {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    box-shadow: none !important;
    max-width: 190mm !important;
    margin: 0 auto !important;
    padding: 0 !important;
  }
  .guide-step, .guide-note, .guide-cover, .guide-help { break-inside: avoid; page-break-inside: avoid; }
  @page { margin: 14mm; }
}
`;

export default function GuideAchatPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-6 sm:py-10">
      <style dangerouslySetInnerHTML={{ __html: printCss }} />

      {/* Barre d'actions — masquée à l'impression */}
      <div className="no-print mx-auto mb-6 flex max-w-2xl items-center justify-between">
        <Link
          href="/dashboard/mon-achat"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-[#0D3B66]"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à mon achat
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0D3B66] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0a2f52]"
        >
          <Printer className="h-4 w-4" />
          Imprimer / Enregistrer en PDF
        </button>
      </div>

      <article className="guide-page mx-auto max-w-2xl rounded-3xl bg-white px-5 py-8 shadow-sm sm:px-8 sm:py-10">
        {/* Couverture */}
        <header className="guide-cover mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0D3B66] p-1.5 shadow-md">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-white">
              <Image src="/logo-embleme.png" alt="SGNF" width={44} height={44} className="object-contain" priority />
            </div>
          </div>
          <h1 className="font-display text-3xl font-extrabold text-[#0D3B66] sm:text-4xl">Acheter mon terrain</h1>
          <p className="mt-1 text-lg font-semibold text-[#F39C12]">en 4 étapes faciles</p>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-slate-600">
            À chaque moment, <span className="font-semibold text-slate-800">une seule chose à faire</span>. L&apos;agence
            SGNF vous accompagne du début à la fin.
          </p>
        </header>

        {/* Étape 1 */}
        <Step n={1} color={BLEU} icon={<Compass className="h-7 w-7" />} titre="Je choisis mon terrain">
          <ul className="space-y-1.5">
            <Puce>Je regarde les terrains à vendre.</Puce>
            <Puce>Je choisis le terrain que je veux.</Puce>
            <Puce>J&apos;appuie sur le bouton pour faire ma demande.</Puce>
          </ul>
          <Legende>Je cherche ce bouton :</Legende>
          <BoutonVisuel color={BLEU} icon={<Compass className="h-5 w-5" />}>
            Trouver un terrain
          </BoutonVisuel>
        </Step>

        {/* Note : l'agence rappelle */}
        <Note icon={<Phone className="h-6 w-6" />}>
          <span className="font-bold text-slate-800">L&apos;agence me répond.</span>{" "}
          Elle regarde ma demande, puis elle m&apos;appelle pour se mettre d&apos;accord sur le prix. Je peux aussi voir
          mes messages dans l&apos;application.
        </Note>

        {/* Étape 2 */}
        <Step n={2} color={VERT} icon={<CreditCard className="h-7 w-7" />} titre="Je paie mon terrain">
          <ul className="space-y-1.5">
            <Puce>Quand le prix est fixé, je paie mon terrain.</Puce>
            <Puce>Avec mon téléphone (mobile money), ou en espèces à l&apos;agence SGNF.</Puce>
            <Puce>Je peux payer en une seule fois, ou petit à petit.</Puce>
          </ul>
          <Legende>Je cherche ce bouton vert :</Legende>
          <BoutonVisuel color={VERT} icon={<CreditCard className="h-5 w-5" />} full>
            Payer mon terrain
          </BoutonVisuel>
        </Step>

        {/* Étape 3 */}
        <Step n={3} color={VERT} icon={<PartyPopper className="h-7 w-7" />} titre="Je deviens propriétaire">
          <ul className="space-y-1.5">
            <Puce>Dès que le terrain est payé, le terrain est à moi !</Puce>
            <Puce>Je reçois mon certificat de propriété.</Puce>
          </ul>
          <Legende>Voici ce que je vois :</Legende>
          <div className="rounded-xl border border-[#2D8F5A]/30 bg-[#2D8F5A]/5 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-bold text-[#2D8F5A]">
              <PartyPopper className="h-5 w-5 shrink-0" />
              Félicitations, vous êtes propriétaire !
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#0D3B66]">
              <FileCheck2 className="h-3.5 w-3.5" />
              Voir mon certificat de propriété
            </p>
          </div>
        </Step>

        {/* Étape 4 */}
        <Step n={4} color={BLEU} icon={<ShieldCheck className="h-7 w-7" />} titre="Je reçois mon attestation" last>
          <ul className="space-y-1.5">
            <Puce>C&apos;est la dernière étape.</Puce>
            <Puce>Je paie mon attestation officielle.</Puce>
            <Puce>Ensuite, je peux la voir et la montrer quand je veux.</Puce>
          </ul>
          <Legende>Je cherche ces boutons :</Legende>
          <div className="space-y-2.5">
            <BoutonVisuel color={VERT} icon={<CreditCard className="h-5 w-5" />} full>
              Payer mon attestation
            </BoutonVisuel>
            <BoutonVisuel color={BLEU} icon={<ShieldCheck className="h-5 w-5" />} full>
              Voir mon attestation
            </BoutonVisuel>
          </div>
        </Step>

        {/* Aide & rassurance */}
        <section className="guide-help mt-4 space-y-3 rounded-2xl bg-[#0D3B66]/[0.04] px-5 py-5">
          <Aide icon={<QrCode className="h-5 w-5" />}>
            Mon certificat et mon attestation ont un <span className="font-semibold">code QR</span>. Tout le monde peut
            vérifier qu&apos;ils sont vrais.
          </Aide>
          <Aide icon={<Landmark className="h-5 w-5" />}>
            Une question ? Je vais à l&apos;<span className="font-semibold">agence SGNF</span>. On m&apos;explique.
          </Aide>
          <Aide icon={<HelpCircle className="h-5 w-5" />}>
            Je retrouve mon achat à tout moment dans <span className="font-semibold">« Mon achat »</span>.
          </Aide>
        </section>
      </article>
    </main>
  );
}

function Step({
  n,
  color,
  icon,
  titre,
  children,
  last,
}: {
  n: number;
  color: string;
  icon: React.ReactNode;
  titre: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className="guide-step flex gap-4 sm:gap-5">
      {/* Rail : numéro + trait de liaison */}
      <div className="flex flex-col items-center">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-extrabold text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          {n}
        </div>
        {!last && <div className="mt-2 w-1 flex-1 rounded bg-slate-200" />}
      </div>

      {/* Contenu */}
      <div className={`flex-1 ${last ? "" : "pb-6"}`}>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <span style={{ color }}>{icon}</span>
            <h2 className="font-display text-xl font-bold text-slate-800">{titre}</h2>
          </div>
          <div className="text-[15px] leading-relaxed text-slate-700">{children}</div>
        </div>
      </div>
    </section>
  );
}

function Puce({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0D3B66]" />
      <span>{children}</span>
    </li>
  );
}

function Legende({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</p>;
}

function BoutonVisuel({
  color,
  icon,
  children,
  full,
}: {
  color: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-base font-bold text-white shadow-sm ${
        full ? "w-full" : ""
      }`}
      style={{ backgroundColor: color }}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}

function Note({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="guide-note ml-16 mb-6 flex items-start gap-3 rounded-2xl border border-[#F39C12]/30 bg-[#F39C12]/[0.07] px-4 py-3.5">
      <span className="mt-0.5 shrink-0 text-[#F39C12]" style={{ color: ORANGE }}>
        {icon}
      </span>
      <p className="text-[15px] leading-relaxed text-slate-700">{children}</p>
    </div>
  );
}

function Aide({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-[#0D3B66]">{icon}</span>
      <p className="text-sm leading-relaxed text-slate-600">{children}</p>
    </div>
  );
}
