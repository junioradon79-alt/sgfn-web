import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  History,
  LockKeyhole,
  MapPinned,
  QrCode,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

const benefits = [
  { icon: MapPinned, title: "Une vision foncière unifiée", text: "Lots, dossiers, localisations et décisions réunis dans un espace de travail clair." },
  { icon: ShieldCheck, title: "Des décisions plus lisibles", text: "Des statuts, historiques et pièces justificatives accessibles au bon moment." },
  { icon: UsersRound, title: "Une collaboration encadrée", text: "Chaque acteur accède aux actions utiles à son rôle, sans surcharge." },
];

const faqs = [
  ["À qui s’adresse SGNF ?", "Aux collectivités, opérateurs, propriétaires, acquéreurs et professionnels impliqués dans la gestion foncière."],
  ["Comment vérifier un document ?", "Utilisez sa référence ou son code QR pour consulter les informations disponibles par le registre."],
  ["Comment obtenir un accès ?", "Votre organisation peut vous inviter ; vous activez ensuite votre compte avec le code reçu."],
];

const proofSignals = [
  { icon: UsersRound, label: "Accès par rôle", value: "7 profils" },
  { icon: QrCode, label: "Vérification QR", value: "Serveur" },
  { icon: History, label: "Journal d'audit", value: "Traçable" },
];

const auditEvents = [
  "Attestation vérifiée",
  "Statut dossier mis à jour",
  "Accès opérateur confirmé",
];

export function PremiumHome() {
  return <main>
    <section className="border-b border-[#E3E8EF]">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12 lg:items-center lg:px-8 lg:py-28">
        <div className="lg:col-span-7">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#0F5E8C]/20 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#0F5E8C]"><ShieldCheck className="h-4 w-4" /> Gestion foncière numérique</p>
          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-[-0.035em] text-[#0B2E4F] sm:text-5xl lg:text-6xl">Le foncier, piloté avec plus de clarté.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#526176]">SGNF réunit les dossiers, documents et décisions foncières dans un espace de travail conçu pour les organisations ivoiriennes.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/contact" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0B2E4F] px-5 text-sm font-bold text-white transition hover:bg-[#0F5E8C]">Demander une démonstration <ArrowRight className="h-4 w-4" /></Link><Link href="/verifier" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#C9D5E0] bg-white px-5 text-sm font-bold text-[#0B2E4F] transition hover:bg-slate-50"><FileSearch className="h-4 w-4" /> Vérifier un document</Link></div>
          <p className="mt-5 flex items-center gap-2 text-sm text-[#526176]"><LockKeyhole className="h-4 w-4 text-[#147A55]" /> Accès organisé par rôle et opérations journalisées.</p>
        </div>
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-[#D5E0E9] bg-white p-3 shadow-[0_18px_48px_-32px_rgba(11,46,79,0.35)]">
            <div className="overflow-hidden rounded-xl border border-[#E3E8EF] bg-[#F7F9FC]">
              <div className="flex items-center justify-between border-b border-[#E3E8EF] bg-white px-4 py-3">
                <div className="flex items-center gap-2">
                  <Image src="/logo-embleme.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" priority />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0F5E8C]">Registre sécurisé</p>
                    <p className="text-sm font-extrabold text-[#0B2E4F]">Lot 042 · Anyama</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#147A55]/10 px-2.5 py-1 text-xs font-bold text-[#147A55]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Authentique
                </span>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-[1.05fr_0.95fr]">
                <div className="min-h-[240px] rounded-xl border border-[#D5E0E9] bg-white p-4">
                  <div className="relative h-44 overflow-hidden rounded-lg bg-[#EAF1F5]">
                    <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(#D5E0E9_1px,transparent_1px),linear-gradient(90deg,#D5E0E9_1px,transparent_1px)] [background-size:28px_28px]" />
                    <div className="absolute left-8 top-8 h-20 w-28 rounded-[40%] border-2 border-[#0F5E8C] bg-[#0F5E8C]/10" />
                    <div className="absolute bottom-7 right-8 h-24 w-20 rounded-[42%] border-2 border-[#147A55] bg-[#147A55]/10" />
                    <span className="absolute left-[5.5rem] top-[4.25rem] h-3 w-3 rounded-full bg-[#0F5E8C] ring-4 ring-white" />
                    <span className="absolute bottom-[4.8rem] right-[5rem] h-3 w-3 rounded-full bg-[#147A55] ring-4 ring-white" />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {["Localisé", "Documenté", "À valider"].map((label, index) => (
                      <div key={label} className="rounded-lg border border-[#E3E8EF] bg-[#F7F9FC] p-2 text-center">
                        <p className="text-[10px] font-semibold text-[#526176]">{label}</p>
                        <p className={`mt-1 text-xs font-extrabold ${index === 2 ? "text-[#B45309]" : "text-[#0B2E4F]"}`}>
                          {index === 2 ? "1 action" : "Confirmé"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-[#D5E0E9] bg-white p-4">
                    <div className="flex items-center gap-2 text-[#0B2E4F]">
                      <ClipboardCheck className="h-4 w-4 text-[#0F5E8C]" />
                      <p className="text-sm font-extrabold">Dossier foncier</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {proofSignals.map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-[#F7F9FC] px-3 py-2">
                          <span className="flex items-center gap-2 text-xs font-semibold text-[#526176]"><Icon className="h-3.5 w-3.5 text-[#0F5E8C]" />{label}</span>
                          <span className="text-xs font-bold text-[#0B2E4F]">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#D5E0E9] bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#526176]">Journal récent</p>
                    <div className="mt-3 space-y-2">
                      {auditEvents.map((event) => (
                        <div key={event} className="flex items-center gap-2 text-xs font-semibold text-[#172033]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#147A55]" />
                          {event}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section id="produit" className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.16em] text-[#0F5E8C]">Une plateforme, des rôles clairs</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0B2E4F] sm:text-4xl">L’information utile, au moment de décider.</h2></div><div className="mt-10 grid gap-4 md:grid-cols-3">{benefits.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-[#E3E8EF] bg-white p-6"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B2E4F]/[0.06] text-[#0F5E8C]"><Icon className="h-5 w-5" /></div><h3 className="mt-5 text-lg font-bold text-[#0B2E4F]">{title}</h3><p className="mt-2 leading-7 text-[#526176]">{text}</p></article>)}</div></section>
    <section id="securite" className="border-y border-[#E3E8EF] bg-white"><div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-20"><div className="lg:col-span-5"><p className="text-sm font-bold uppercase tracking-[0.16em] text-[#0F5E8C]">Confiance vérifiable</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0B2E4F]">Des signaux clairs, pas des promesses vagues.</h2></div><div className="grid gap-4 sm:grid-cols-2 lg:col-span-7"><div className="rounded-2xl border border-[#E3E8EF] p-5"><BadgeCheck className="h-5 w-5 text-[#147A55]" /><h3 className="mt-3 font-bold text-[#0B2E4F]">Historique des opérations</h3><p className="mt-2 text-sm leading-6 text-[#526176]">Les écrans métier rendent visibles les actions et leurs statuts.</p></div><div className="rounded-2xl border border-[#E3E8EF] p-5"><FileSearch className="h-5 w-5 text-[#0F5E8C]" /><h3 className="mt-3 font-bold text-[#0B2E4F]">Vérification de référence</h3><p className="mt-2 text-sm leading-6 text-[#526176]">Un parcours dédié permet de consulter les informations disponibles pour un document.</p></div></div></div></section>
    <section id="faq" className="mx-auto max-w-[960px] px-4 py-16 sm:px-6 sm:py-24"><div className="text-center"><p className="text-sm font-bold uppercase tracking-[0.16em] text-[#0F5E8C]">FAQ</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0B2E4F]">Les réponses essentielles.</h2></div><div className="mt-10 divide-y divide-[#E3E8EF] rounded-2xl border border-[#E3E8EF] bg-white px-5">{faqs.map(([question, answer]) => <details key={question} className="group py-5"><summary className="cursor-pointer list-none pr-8 font-bold text-[#0B2E4F]">{question}<span className="float-right text-[#0F5E8C] group-open:rotate-45">+</span></summary><p className="mt-3 max-w-2xl leading-7 text-[#526176]">{answer}</p></details>)}</div></section>
  </main>;
}
