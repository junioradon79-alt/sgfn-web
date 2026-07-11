"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import {
  Clock,
  ShieldCheck,
  Lock,
  LayoutDashboard,
  ChevronDown,
  ScanLine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { HomeMetrics } from "./HomeMetrics";
import { metiers } from "@/lib/metiers";

const metierByNom = new Map(metiers.map((m) => [m.nom, m]));

// ─── Données ──────────────────────────────────────────────────────────────────

const profiles = [
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
    profiles: ["Collectivités territoriales", "Aménageurs fonciers", "Promoteurs immobiliers", "Bureaux d'études"],
  },
  {
    titre: "Gestion des parcelles",
    description: "Suivi géométrique unitaire, numérotation et superficies des lots cadastraux.",
    profiles: ["Géomètres", "Aménageurs fonciers", "Bureaux d'études", "Notaires"],
  },
  {
    titre: "Coffre-fort documentaire",
    description: "Centralisation sécurisée de vos actes d'attestation, cessions et arrêtés.",
    profiles: ["Notaires", "Cabinets juridiques", "Collectivités territoriales", "Géomètres"],
  },
  {
    titre: "Suivi des paiements",
    description: "Traçabilité financière intégrée de toutes les transactions et taxes d'attribution.",
    profiles: ["Collectivités territoriales", "Promoteurs immobiliers", "Investisseurs", "Entreprises de construction"],
  },
  {
    titre: "Arbitrage des litiges",
    description: "Registre d'alertes géographiques et archivage des PV de conciliation coutumière.",
    profiles: ["Cabinets juridiques", "Collectivités territoriales", "Notaires", "Aménageurs fonciers"],
  },
  {
    titre: "Dossiers ADU & ACD",
    description: "Suivi d'instruction des dossiers techniques jusqu'à l'obtention du titre définitif.",
    profiles: ["Bureaux d'études", "Promoteurs immobiliers", "Collectivités territoriales", "Notaires"],
  },
];

const benefices = [
  { titre: "Gagner du temps", description: "Réduction des tâches administratives grâce à des processus entièrement digitalisés.", icon: Clock },
  { titre: "Réduire les risques", description: "Historique complet et traçabilité de chaque opération foncière.", icon: ShieldCheck },
  { titre: "Travailler en confiance", description: "Accès sécurisé réservé aux utilisateurs autorisés selon leur rôle.", icon: Lock },
  { titre: "Mieux piloter", description: "Des tableaux de bord facilitent le pilotage stratégique de vos projets.", icon: LayoutDashboard },
];

const piliers: { titre: string; description: string; icon: LucideIcon }[] = [
  { titre: "Sécurisée", description: "Chiffrement et contrôle d'accès à chaque étape.", icon: Lock },
  { titre: "Traçable", description: "Historique complet et immuable de chaque opération.", icon: ShieldCheck },
  { titre: "Contrôlée", description: "Validation par les autorités compétentes avant publication.", icon: LayoutDashboard },
];

const indicateurs = ["Une seule plateforme", "Une traçabilité complète", "Une collaboration fluide", "Une sécurité renforcée"];

const garantiesSecurite = ["Confidentialité", "Contrôle des accès", "Traçabilité", "Sauvegarde", "Haute disponibilité"];

const etapes = [
  "Collecte et validation des informations foncières",
  "Structuration des parcelles et lotissements",
  "Validation administrative, documentaire et coutumière",
  "Suivi, sécurisation et publication des décisions",
];

const faq = [
  {
    q: "Comment SGNF garantit-il la sécurité des documents ?",
    a: "Chaque document et procès-verbal téléversé est chiffré et tracé de manière immuable en base de données, empêchant toute falsification ou double attribution.",
  },
  {
    q: "Qui peut accéder à la plateforme ?",
    a: "L'accès est structuré par rôles stricts : collectivités, aménageurs, géomètres, notaires et opérateurs fonciers disposent chacun d'un espace sécurisé propre à leurs prérogatives.",
  },
  {
    q: "La plateforme est-elle synchronisée avec le cadastre national ?",
    a: "SGNF est conçu comme une infrastructure d'interconnexion moderne visant à centraliser et fluidifier l'instruction des dossiers jusqu'à l'obtention de l'ACD.",
  },
  {
    q: "Les documents générés par SGNF ont-ils une valeur juridique ?",
    a: "Oui. Les attestations de cession, APFC et certificats de vente produits par SGNF sont générés à partir de gabarits officiels validés, horodatés et traçables. Ils sont conçus pour être opposables et conformes aux exigences de l'administration foncière ivoirienne.",
  },
  {
    q: "Comment obtenir un accès à la plateforme ?",
    a: "L'accès est accordé sur invitation par l'administrateur de votre organisation. Une fois invité, vous recevez un lien sécurisé pour créer votre compte et accéder à votre espace selon votre rôle.",
  },
  {
    q: "SGNF peut-il détecter les doubles attributions de lots ?",
    a: "Oui. La base de données maintient une contrainte d'unicité sur chaque lot par lotissement. Toute tentative d'attribution d'un lot déjà assigné est bloquée et signalée automatiquement avant validation.",
  },
  {
    q: "Comment sont gérés les litiges fonciers dans la plateforme ?",
    a: "SGNF dispose d'un module dédié à l'arbitrage des litiges : ouverture d'un dossier de litige, archivage des PV de conciliation, suivi de l'état de résolution et consultation restreinte aux parties concernées.",
  },
  {
    q: "Peut-on utiliser SGNF depuis un téléphone mobile ?",
    a: "Oui. SGNF est accessible depuis tout navigateur mobile (PWA) et dispose d'une application Android téléchargeable. L'interface s'adapte automatiquement à la taille de l'écran.",
  },
  {
    q: "Comment sont sauvegardées les données ?",
    a: "Les données sont hébergées sur Supabase (infrastructure PostgreSQL en haute disponibilité) avec des sauvegardes automatiques quotidiennes. Aucune donnée n'est stockée localement sur les appareils des utilisateurs.",
  },
  {
    q: "SGNF gère-t-il les héritages et transmissions de lots ?",
    a: "Oui. La plateforme modélise la hiérarchie familiale (grande famille, lignée, ayants-droit) et permet d'enregistrer les PV de réunion familiale désignant les successeurs, avec traçabilité complète de chaque transmission.",
  },
  {
    q: "Comment sont gérées les cessions de lots entre particuliers ?",
    a: "Chaque cession est saisie par un agent ou opérateur, validée par les autorités compétentes (chefferie, SGNF, notaire selon le cas), puis génère automatiquement une attestation de cession numérotée et archivée.",
  },
  {
    q: "Quels moyens de paiement sont acceptés sur la plateforme ?",
    a: "SGNF intègre CinetPay comme agrégateur de paiement, couvrant les cartes bancaires, Mobile Money (Orange Money, Wave, MTN MoMo) et virements. Chaque transaction est horodatée et associée au dossier concerné.",
  },
  {
    q: "SGNF peut-il gérer plusieurs lotissements simultanément ?",
    a: "Oui. La plateforme est multi-lotissements nativement. Chaque lotissement dispose de ses propres îlots, lots, attributaires et documents, tout en restant consultable dans un tableau de bord unifié.",
  },
  {
    q: "Est-il possible d'importer des données foncières existantes ?",
    a: "Oui. Une migration initiale des données (lots, attributaires, documents) peut être réalisée lors du déploiement. Notre équipe accompagne la reprise de l'historique foncier existant sous format tableur ou base de données.",
  },
  {
    q: "Une formation est-elle prévue pour les utilisateurs ?",
    a: "Oui. SGNF propose une formation à la prise en main pour chaque rôle (agent, commissaire, aménageur, client). Des guides utilisateurs et un support technique sont disponibles après déploiement.",
  },
  {
    q: "Peut-on personnaliser les niveaux d'accès des utilisateurs ?",
    a: "Les rôles sont préconfigurés (agent, commissaire, aménageur, propriétaire) avec des permissions adaptées à chaque profil. Des ajustements fins peuvent être demandés lors du déploiement selon les besoins spécifiques de l'organisation.",
  },
  {
    q: "Que se passe-t-il en cas de panne internet ?",
    a: "L'application mobile (PWA et Android) met en cache les données consultées récemment, permettant une navigation partielle hors ligne. Toute action nécessitant une écriture (validation, paiement) requiert une connexion active.",
  },
];

// ─── FAQ Accordéon ───────────────────────────────────────────────────────────

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  return (
    <div className="border-b border-slate-200/60 last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-4 py-5 text-left sm:px-6 sm:py-6"
      >
        <span className={`text-sm font-semibold leading-snug transition-colors sm:text-base ${open ? "text-[#0D3B66]" : "text-slate-700"}`}>
          {q}
        </span>
        <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ${open ? "rotate-180 text-[#0D3B66]" : ""}`} />
      </button>
      <div
        ref={bodyRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? (bodyRef.current?.scrollHeight ?? 500) : 0 }}
      >
        <p className="px-4 pb-5 text-sm leading-relaxed text-slate-500 sm:px-6 sm:pb-6">{a}</p>
      </div>
    </div>
  );
}

function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-2">
      {items.map((item, i) => (
        <FaqItem
          key={item.q}
          q={item.q}
          a={item.a}
          open={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? null : i)}
        />
      ))}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ active, onSelect }: { active: string | null; onSelect: (p: string | null) => void }) {
  return (
    <aside className="hidden xl:flex w-60 shrink-0 sticky top-[74px] self-start h-[calc(100vh-74px)] flex-col overflow-y-auto border-r border-slate-200/50 bg-white/60 pl-8 pr-4 py-6 backdrop-blur-sm">
      {/* Filtre métiers — aligné avec le logo du header */}
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Pour qui ?</p>
      <div className="flex flex-col gap-2">
        {profiles.map((p) => {
          const isActive = active === p;
          return (
            <button
              key={p}
              onClick={() => {
                onSelect(isActive ? null : p);
                if (!isActive) {
                  document.getElementById("fonctions")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className={`rounded-full border px-3 py-2 text-left text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? "border-[#0D3B66] bg-[#0D3B66] text-white shadow-md"
                  : "border-slate-200 bg-white text-slate-600 hover:border-[#0D3B66]/40 hover:text-[#0D3B66]"
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>
      {active && (
        <button
          onClick={() => onSelect(null)}
          className="mt-4 text-[10px] font-semibold text-slate-400 underline underline-offset-2 hover:text-slate-600 text-left transition-colors"
        >
          Tout afficher
        </button>
      )}
    </aside>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HomeContent() {
  const [activeProfile, setActiveProfile] = useState<string | null>(null);

  return (
    <div className="mx-auto flex max-w-7xl">
      <Sidebar active={activeProfile} onSelect={setActiveProfile} />

      <main className="min-w-0 flex-1">
        {/* ── Hero ── */}
        <section className="mx-auto flex max-w-4xl flex-col items-center px-4 pb-16 pt-14 text-center sm:px-6 sm:pb-24 sm:pt-20 lg:pb-28 lg:pt-28">
          <span className="mb-5 rounded-full border border-[#0D3B66]/12 bg-[#0D3B66]/6 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#1E6091]">
            Infrastructure numérique foncière
          </span>
          <h1 className="max-w-3xl text-3xl font-black leading-[1.1] tracking-[-0.03em] text-[#0D3B66] sm:text-5xl lg:text-6xl">
            La plateforme de référence pour sécuriser vos opérations foncières.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
            Une seule plateforme pour centraliser lots, attributions et documents — pour les
            collectivités, aménageurs, promoteurs et notaires.
          </p>

          <div className="mt-8 sm:mt-10">
            <Link href="/contact" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0D3B66] px-8 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#1E6091] active:scale-[0.98] sm:w-auto">
              Demander une démonstration
            </Link>
          </div>

          <div className="mt-5 flex items-center gap-6 text-sm font-medium text-slate-500">
            <Link href="/login" className="transition-colors hover:text-[#0D3B66]">
              Accéder à la plateforme
            </Link>
            <span className="text-slate-300">·</span>
            <Link href="/verifier?scan=1" className="inline-flex items-center gap-1.5 transition-colors hover:text-emerald-700">
              <ScanLine className="h-4 w-4" />
              Vérifier un QR code
            </Link>
          </div>
        </section>

        {/* ── Confiance ── */}
        <section className="border-t border-slate-200/40 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
            <div className="mb-10 text-center sm:mb-14">
              <h2 className="text-2xl font-bold tracking-tight text-[#0D3B66] sm:text-3xl">Pourquoi les professionnels choisissent SGNF ?</h2>
              <p className="mt-3 text-base text-slate-500 sm:text-lg">Parce qu'en matière de foncier, une simple erreur peut coûter des millions.</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {piliers.map((p) => (
                <div key={p.titre} className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200/60 px-6 py-8 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-bold text-[#0D3B66]">{p.titre}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── À propos ── */}
        <section id="apropos" className="mx-auto max-w-5xl border-t border-slate-200/40 px-4 py-14 sm:px-6 sm:py-24 lg:py-32">
          <div className="grid gap-8 sm:gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091] sm:text-sm">À propos</p>
              <h2 className="text-2xl font-bold tracking-tight text-[#0D3B66] sm:text-3xl lg:text-4xl">Une plateforme professionnelle dédiée à la gouvernance foncière.</h2>
            </div>
            <div className="space-y-5 text-base leading-relaxed text-slate-600 sm:text-lg">
              <p>SGNF est une plateforme professionnelle dédiée à la transformation numérique des opérations foncières en Côte d'Ivoire. Sa mission est de permettre aux acteurs du foncier de travailler plus rapidement tout en renforçant la transparence, la sécurité et la maîtrise des risques.</p>
              <p>Toutes les parcelles, tous les documents, toutes les transactions et toutes les décisions sont centralisés dans un environnement unique, sécurisé et collaboratif.</p>
            </div>
          </div>
        </section>

        {/* ── Bénéfices ── */}
        <section className="border-t border-slate-200/40 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-24 lg:py-32">
            <div className="mb-10 sm:mb-14">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091] sm:text-sm">Bénéfices</p>
              <h2 className="text-2xl font-bold tracking-tight text-[#0D3B66] sm:text-3xl lg:text-4xl">Ce que SGNF change concrètement.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
              {benefices.map((b) => (
                <div key={b.titre} className="rounded-2xl border border-slate-200/60 bg-[#F8FAFC] p-6 sm:p-7">
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

        {/* ── Indicateurs ── */}
        <section className="border-t border-[#0D3B66] bg-[#0D3B66]">
          <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {indicateurs.map((ind) => (
                <div key={ind} className="flex items-center gap-3 py-2">
                  <span className="shrink-0 text-lg font-bold text-[#F39C12]">—</span>
                  <span className="text-sm font-semibold leading-snug text-white sm:text-base">{ind}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Chiffres ── */}
        <section id="chiffres" className="mx-auto max-w-5xl border-t border-slate-200/40 px-4 py-14 sm:px-6 sm:py-24 lg:py-32">
          <div className="mb-8 text-center sm:mb-10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091] sm:text-sm">Statistiques réelles</p>
            <h2 className="text-2xl font-bold tracking-tight text-[#0D3B66] sm:text-3xl lg:text-4xl">La plateforme en chiffres</h2>
          </div>
          <HomeMetrics />
        </section>

        {/* ── Modules (avec filtre) ── */}
        <section id="fonctions" className="border-t border-slate-200/40 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-24 lg:py-32">
            <div className="mb-8 max-w-3xl sm:mb-12">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091] sm:text-sm">Modules</p>
              <h2 className="text-2xl font-bold tracking-tight text-[#0D3B66] sm:text-3xl lg:text-4xl">Une infrastructure complète pour le foncier numérique.</h2>
              {activeProfile && (
                <p className="mt-3 text-sm font-medium text-[#1E6091]">
                  Modules pertinents pour <strong>{activeProfile}</strong>
                </p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
              {modules.map((m) => {
                const isRelevant = !activeProfile || m.profiles.includes(activeProfile);
                const isHighlighted = Boolean(activeProfile) && isRelevant;
                return (
                  <article
                    key={m.titre}
                    className={`rounded-2xl border p-5 transition-all duration-500 ease-out sm:p-6 ${
                      isHighlighted
                        ? "-translate-y-1 border-[#F39C12]/50 bg-white shadow-[0_10px_30px_-8px_rgba(13,59,102,0.25)] ring-2 ring-[#F39C12]/30"
                        : isRelevant
                          ? "border-[#0D3B66]/20 bg-[#F8FAFC] shadow-sm"
                          : "border-slate-200/40 bg-[#F8FAFC]/40 opacity-30 blur-[1px] saturate-50"
                    }`}
                  >
                    <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-[#0D3B66]">
                      {m.titre}
                      {isHighlighted && (
                        <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-[#F39C12] shadow-[0_0_8px_2px_rgba(243,156,18,0.5)]" />
                      )}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-500">{m.description}</p>
                  </article>
                );
              })}
            </div>
            {activeProfile && metierByNom.has(activeProfile) && (
              <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl bg-[#0D3B66] px-6 py-6 text-white shadow-lg sm:mt-10 sm:flex-row sm:px-8">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#F39C12]">
                    {activeProfile}
                  </p>
                  <p className="mt-1 text-base font-bold sm:text-lg">
                    Ces modules sont conçus pour votre métier.
                  </p>
                </div>
                <Link
                  href={`/contact?profil=${metierByNom.get(activeProfile)!.slug}`}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#F39C12] px-6 py-3 text-sm font-bold text-[#0D3B66] shadow-md transition hover:bg-[#f5ab3d] active:scale-[0.98]"
                >
                  {metierByNom.get(activeProfile)!.cta} →
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ── Sécurité ── */}
        <section className="border-t border-slate-200/40 bg-[#F8FAFC]">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-24 lg:py-32">
            <div className="grid gap-8 sm:gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091] sm:text-sm">Sécurité</p>
                <h2 className="text-2xl font-bold tracking-tight text-[#0D3B66] sm:text-3xl lg:text-4xl">La sécurité est au cœur de SGNF.</h2>
                <p className="mt-4 text-base leading-relaxed text-slate-500 sm:text-lg">Les données foncières constituent un patrimoine stratégique. SGNF garantit leur intégrité à chaque étape de leur cycle de vie.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {garantiesSecurite.map((g) => (
                  <div key={g} className="flex items-center gap-3 rounded-2xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0D3B66]/8 text-sm font-bold text-[#0D3B66]">✓</span>
                    <span className="text-sm font-semibold text-slate-700">{g}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Public cible ── */}
        <section className="border-t border-slate-200/40 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-24 lg:py-32">
            <div className="mb-8 text-center sm:mb-12">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091] sm:text-sm">Public cible</p>
              <h2 className="text-2xl font-bold tracking-tight text-[#0D3B66] sm:text-3xl lg:text-4xl">Conçu pour les acteurs du foncier professionnel.</h2>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {profiles.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setActiveProfile(activeProfile === p ? null : p);
                    document.getElementById("fonctions")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
                    activeProfile === p
                      ? "border-[#0D3B66] bg-[#0D3B66] text-white shadow-md"
                      : "border-slate-200 bg-[#F8FAFC] text-slate-700 hover:border-[#0D3B66]/40 hover:text-[#0D3B66]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Processus ── */}
        <section id="processus" className="border-t border-slate-200/40 bg-[#F8FAFC]">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-24 lg:py-32">
            <div className="grid gap-8 sm:gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091] sm:text-sm">Processus</p>
                <h2 className="text-2xl font-bold tracking-tight text-[#0D3B66] sm:text-3xl lg:text-4xl">Une marche de validation claire à chaque étape.</h2>
                <p className="mt-4 text-base leading-relaxed text-slate-500 sm:text-lg">Le flux SGNF a été conçu pour simplifier la coordination entre les parties prenantes, tout en garantissant une qualité de décision élevée.</p>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-white p-4 sm:p-6">
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
                        <td className="py-3 pr-4 font-semibold whitespace-nowrap text-[#0D3B66]">0{i + 1}</td>
                        <td className="py-3">{etape}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="border-t border-[#0D3B66] bg-[#0D3B66]">
          <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:py-32">
            <h2 className="mx-auto max-w-3xl text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">Faites du foncier un levier de confiance et de performance.</h2>
            <p className="mt-4 text-base text-white/70 sm:text-lg">Découvrez comment SGNF peut moderniser vos projets fonciers.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:mt-10 sm:flex-row">
              <Link href="/contact" className="inline-flex w-full items-center justify-center rounded-full bg-white px-8 py-4 text-sm font-bold text-[#0D3B66] shadow-md transition hover:bg-slate-100 active:scale-[0.98] sm:w-auto">
                Demander une démonstration personnalisée →
              </Link>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="mx-auto max-w-5xl border-t border-slate-200/40 px-4 py-14 sm:px-6 sm:py-24 lg:py-32">
          <div className="mb-8 sm:mb-10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091] sm:text-sm">FAQ</p>
            <h2 className="text-2xl font-bold text-[#0D3B66] sm:text-3xl">Questions fréquentes</h2>
            <p className="mt-2 text-sm text-slate-400">{faq.length} questions</p>
          </div>
          <FaqAccordion items={faq} />
        </section>

        {/* ── Contact ── */}
        <section id="contact" className="mx-auto max-w-5xl border-t border-slate-200/40 px-4 py-14 sm:px-6 sm:py-24 lg:py-32">
          <div className="text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091] sm:text-sm">Contact</p>
            <h2 className="text-2xl font-bold text-[#0D3B66] sm:text-3xl">Contactez notre équipe</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">Une question sur le déploiement ou besoin d'une démonstration ? Écrivez-nous.</p>
          </div>
          <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-slate-200/60 bg-white p-6 sm:mt-10 sm:p-10">
            <Link href="/contact" className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#0D3B66] px-4 text-sm font-semibold text-white transition hover:bg-[#1E6091]">
              Ouvrir le formulaire de contact →
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
