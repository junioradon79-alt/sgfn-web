"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Crown,
  Database,
  LayoutGrid,
  Link2,
  Lock,
  MapPin,
  PenLine,
  Plus,
  Ruler,
  ScanLine,
  Scale,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  Workflow,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { usePublicStats } from "@/hooks/usePublicStats";
import { METIERS_VITRINE, getMetier } from "@/lib/metiers";

/** Site public TerraCI Market — toute référence à la marketplace y renvoie. */
const TERRACI_MARKET_URL = "https://monterrain.sgfn.ci";

const fmt = (n?: number | null) => (typeof n === "number" ? n.toLocaleString("fr-FR") : "—");

const CARD_HOVER =
  "transition duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_10px_24px_rgba(15,23,42,.08)]";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] font-bold uppercase tracking-[0.09em] text-accent">{children}</p>;
}

export function VitrineMain() {
  const { stats, lotissements, ilots } = usePublicStats();

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border px-5 pb-10 pt-16 sm:px-7 sm:pt-22">
        <div
          className="pointer-events-none absolute left-1/2 top-[-160px] h-[560px] w-[900px] -translate-x-1/2 blur-[10px]"
          style={{
            background:
              "radial-gradient(closest-side, rgba(30,136,229,.20), rgba(11,77,136,.08) 60%, transparent 75%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1280px] items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div className="reveal">
            <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-card px-3.5 py-1.5 text-[12.5px] font-bold text-primary">
              <ShieldCheck className="size-3.5" /> Plateforme de gouvernance
            </span>
            <h1 className="mt-5 text-[clamp(32px,6vw,56px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-foreground">
              Le foncier,
              <br />
              gouverné avec précision.
            </h1>
            <p className="mt-5 max-w-[540px] text-[18px] leading-[1.65] text-muted-foreground">
              Cadastre national, titres, litiges et marketplace foncière réunis dans un système unique — pensé pour
              l&apos;État, les collectivités et les professionnels du foncier.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-flex h-[50px] items-center gap-2.5 rounded-xl bg-primary px-6 text-[14.5px] font-bold text-primary-foreground shadow-[0_10px_24px_rgba(11,77,136,.28)] transition-colors hover:bg-primary-700"
              >
                Demander une démonstration <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/verifier"
                className="inline-flex h-[50px] items-center gap-2.5 rounded-xl border border-border-strong bg-card px-5 text-[14.5px] font-bold text-foreground transition-colors hover:bg-inset"
              >
                <ScanLine className="size-4 text-primary" /> Vérifier un document
              </Link>
            </div>
            <p className="mt-5 flex items-center gap-2 text-[13px] text-muted-2">
              <Lock className="size-3.5 text-success" />
              Accès organisé par rôle · opérations journalisées · vérification par QR code
            </p>
          </div>

          {/* Maquette navigateur — chiffres réels (get_public_stats) */}
          <div className="reveal relative" style={{ animationDelay: "0.12s" }}>
            <div className="overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_40px_90px_-30px_rgba(11,46,79,.38)]">
              <div className="flex h-[42px] items-center gap-2 border-b border-border bg-inset px-4">
                <span className="size-[9px] rounded-full bg-[#EF9C9C]" />
                <span className="size-[9px] rounded-full bg-[#F3CB8C]" />
                <span className="size-[9px] rounded-full bg-[#9FD8B5]" />
                <span className="ml-2.5 font-mono text-[11.5px] text-muted-2">sgfn.ci/dashboard</span>
              </div>
              <div className="bg-background p-5">
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: "Lots", value: stats?.lots },
                    { label: "Attributions", value: stats?.attributions },
                    { label: "Documents", value: stats?.documents },
                  ].map((t) => (
                    <div key={t.label} className="rounded-xl border border-border bg-card p-3">
                      <div className="text-[10.5px] text-muted-foreground">{t.label}</div>
                      <div className="tabular mt-0.5 text-[16px] font-extrabold text-foreground">{fmt(t.value)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 rounded-xl border border-border bg-card p-3.5">
                  <div className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                    Registre national
                  </div>
                  <div className="grid grid-cols-7 gap-1.5" aria-hidden>
                    {["#D6E2F0", "#B9CFE8", "#B9CFE8", "#6E9BCF", "#6E9BCF", "var(--primary)", "var(--accent)"].map(
                      (bg, i) => (
                        <div key={i} className="h-[30px] rounded-md" style={{ background: bg }} />
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="floaty absolute -right-3.5 -top-4 flex items-center gap-2 rounded-[13px] border border-border bg-card px-3.5 py-2.5 shadow-[0_14px_30px_rgba(15,23,42,.14)]">
              <span className="pulse-dot size-2 rounded-full bg-success" />
              <span className="text-[12px] font-bold text-foreground">Système actif</span>
            </div>
            <div
              className="floaty absolute -bottom-4 -left-4 flex items-center gap-2.5 rounded-[13px] border border-border bg-card px-3.5 py-2.5 shadow-[0_14px_30px_rgba(15,23,42,.14)]"
              style={{ animationDelay: "0.3s" }}
            >
              <CheckCircle2 className="size-4 text-success" />
              <span className="text-[12px] font-bold text-foreground">Document authentique</span>
            </div>
          </div>
        </div>

        {/* Section agrandie de 25 % par rapport aux pastilles d'origine, et
            chaque métier renvoie désormais vers sa page descriptive. */}
        <div className="reveal mx-auto mt-20 max-w-[1280px]" style={{ animationDelay: "0.2s" }}>
          <p className="text-center text-[15px] font-bold uppercase tracking-[0.1em] text-muted-2">
            Conçu pour les acteurs du foncier
          </p>
          {/* Largeur bornée pour que les six cartes se répartissent 3 + 3
              plutôt que 4 + 2, qui déséquilibrait la rangée. */}
          <div className="mx-auto mt-5 flex max-w-[920px] flex-wrap justify-center gap-4">
            {METIERS_VITRINE.map((slug) => {
              const m = getMetier(slug);
              if (!m) return null;
              return (
                <Link
                  key={m.slug}
                  href={`/metiers/${m.slug}`}
                  className={cn(
                    "group inline-flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3.5 text-[16px] font-semibold text-muted-foreground hover:text-foreground",
                    CARD_HOVER,
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent-subtle text-primary">
                    <m.icon className="size-[18px]" />
                  </span>
                  {m.nom}
                  <ArrowRight className="size-4 text-accent opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Le produit ───────────────────────────────────────────────────── */}
      <section id="produit" className="mx-auto max-w-[1280px] scroll-mt-20 px-5 py-16 sm:px-7 sm:py-24">
        <div className="reveal max-w-[640px]">
          <Eyebrow>Le produit</Eyebrow>
          <h2 className="mt-3 text-[36px] font-extrabold tracking-[-0.02em] text-foreground">
            Une gouvernance foncière, pas un simple registre.
          </h2>
        </div>
        <div className="mt-11 grid gap-4.5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: MapPin, t: "Vision foncière unifiée", d: "Lots, dossiers, cartographie et décisions réunis dans un espace de travail unique." },
            { icon: ShieldCheck, t: "Décisions lisibles", d: "Statuts, historiques, pièces justificatives et score de confiance, accessibles au bon moment." },
            { icon: Users, t: "Collaboration par rôle", d: "Administration, opérateur, géomètre, chefferie : chacun accède exactement à ce qui le concerne." },
            { icon: ScrollText, t: "Traçabilité complète", d: "Chaque opération est journalisée, horodatée et attribuée à son auteur." },
          ].map((c) => (
            <div key={c.t} className={cn("rounded-[18px] border border-border bg-card p-6", CARD_HOVER)}>
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent-subtle text-primary">
                <c.icon className="size-[21px]" />
              </span>
              <h3 className="mt-4.5 text-[16.5px] font-bold text-foreground">{c.t}</h3>
              <p className="mt-2 text-[13.5px] leading-[1.6] text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Modules ──────────────────────────────────────────────────────── */}
      <section id="modules" className="scroll-mt-20 border-y border-border bg-card px-5 py-16 sm:px-7 sm:py-24">
        <div className="mx-auto max-w-[1280px]">
          <div className="reveal max-w-[640px]">
            <Eyebrow>Modules</Eyebrow>
            <h2 className="mt-3 text-[36px] font-extrabold tracking-[-0.02em] text-foreground">
              Un système, tous les usages du foncier.
            </h2>
          </div>
          <div className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[
              { icon: Boxes, t: "Cadastre national", d: "Carte foncière, lotissements, îlots et parcelles à l'échelle du pays." },
              { icon: ClipboardCheck, t: "Dossiers ADU / ACD", d: "Instruction des titres et actes, de la saisie à la délivrance." },
              { icon: Scale, t: "Litiges & concertation", d: "Suivi des contentieux et médiation avec les chefferies." },
              { icon: Link2, t: "Attributions", d: "Traçabilité des ayants droit, qualités et rangs d'attribution." },
              { icon: Store, t: "TerraCI Market", d: "Mise en vente et découverte de parcelles vérifiées." },
              { icon: BarChart3, t: "Statistiques & rapports", d: "Performance régionale, classements et exports." },
              { icon: Sparkles, t: "SGNF AI", d: "Saisie assistée et analyse documentaire par intelligence artificielle." },
            ].map((m) => (
              <div key={m.t} className={cn("rounded-2xl border border-border bg-background p-5.5", CARD_HOVER)}>
                <span className="flex size-[38px] items-center justify-center rounded-[10px] border border-border bg-card text-primary">
                  <m.icon className="size-[18px]" />
                </span>
                <h3 className="mt-3.5 text-[14.5px] font-bold text-foreground">{m.t}</h3>
                <p className="mt-1.5 text-[12.5px] leading-[1.5] text-muted-foreground">{m.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Un accès par rôle ────────────────────────────────────────────── */}
      <section id="roles" className="scroll-mt-20 border-b border-border bg-card px-5 py-16 sm:px-7 sm:py-24">
        <div className="mx-auto max-w-[1280px]">
          <div className="reveal max-w-[640px]">
            <Eyebrow>Un accès par rôle</Eyebrow>
            <h2 className="mt-3 text-[36px] font-extrabold tracking-[-0.02em] text-foreground">
              Chaque acteur a son espace de travail.
            </h2>
          </div>
          <div className="mt-11 flex flex-wrap justify-center gap-4">
            {[
              { icon: Scale, t: "Commissaire de justice", d: "Constats, notifications et exécution des décisions foncières, avec dossiers horodatés." },
              { icon: Ruler, t: "Géomètre-expert", d: "Bornage, levés et dépôt des plans directement rattachés au dossier cadastral." },
              { icon: Workflow, t: "Opérateur", d: "Instruction des dossiers et saisie assistée par intelligence artificielle." },
              { icon: Crown, t: "Chefferie", d: "Concertation coutumière, avis sur les attributions et suivi des litiges locaux." },
              { icon: MapPin, t: "Propriétaire terrien", d: "Suivi de son titre, mise en vente sur TerraCI Market et vérification de ses documents." },
              { icon: PenLine, t: "Agent de saisie", d: "Saisie assistée par IA des dossiers, pièces justificatives et demandes entrantes." },
              { icon: LayoutGrid, t: "Administration nationale", d: "Vue nationale consolidée, alertes et pilotage de la couverture cadastrale." },
            ].map((r) => (
              <div
                key={r.t}
                className={cn("max-w-[270px] flex-1 basis-[240px] rounded-2xl border border-border bg-background p-6", CARD_HOVER)}
              >
                <span className="flex size-10 items-center justify-center rounded-[11px] bg-accent-subtle text-primary">
                  <r.icon className="size-[19px]" />
                </span>
                <h3 className="mt-4 text-[15px] font-bold text-foreground">{r.t}</h3>
                <p className="mt-1.5 text-[12.5px] leading-[1.55] text-muted-foreground">{r.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cartographie (chiffres réels, pas de couverture inventée) ────── */}
      <section
        id="cartographie"
        className="mx-auto grid max-w-[1280px] scroll-mt-20 items-center gap-10 px-5 py-16 sm:px-7 sm:py-24 lg:grid-cols-2 lg:gap-14"
      >
        <div className="reveal">
          <Eyebrow>Cartographie</Eyebrow>
          <h2 className="mt-3 text-[34px] font-extrabold leading-[1.15] tracking-[-0.02em] text-foreground">
            Une carte qui n&apos;est jamais décorative.
          </h2>
          <p className="mt-4 max-w-[460px] text-[15px] leading-[1.7] text-muted-foreground">
            Le cadastre national visualisé lotissement par lotissement, avec parcelles, îlots et attributions rattachés au
            registre officiel — chaque point sur la carte correspond à une donnée vérifiable.
          </p>
          <div className="mt-7 flex flex-wrap gap-7">
            {[
              { v: fmt(lotissements.length || null), l: "lotissements cartographiés" },
              { v: fmt(ilots), l: "îlots enregistrés" },
              { v: fmt(stats?.lots), l: "lots au registre" },
            ].map((s) => (
              <div key={s.l}>
                <div className="tabular text-[26px] font-extrabold text-foreground">{s.v}</div>
                <div className="mt-0.5 text-[12.5px] text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div
          className="reveal rounded-[18px] border border-border bg-card p-5.5 shadow-[0_24px_60px_-30px_rgba(11,46,79,.3)]"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="mb-3.5 flex items-center justify-between">
            <span className="rounded-full bg-primary px-3 py-1.5 text-[11.5px] font-bold text-primary-foreground">
              Lotissements
            </span>
            <span className="rounded-full bg-inset px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground">
              Cadastre
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {lotissements.length > 0 ? (
              lotissements.map((l) => (
                <div key={l.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-subtle text-primary">
                    <MapPin className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-foreground">{l.nom}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2.5 py-1 text-[10.5px] font-bold text-success">
                    <CheckCircle2 className="size-3" /> cartographié
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-background p-6 text-center text-[13px] text-muted-foreground">
                Chargement du registre…
              </div>
            )}
          </div>
          <p className="mt-3.5 text-[11.5px] text-muted-2">
            Déploiement progressif — le cadastre s&apos;étend lotissement par lotissement.
          </p>
        </div>
      </section>

      {/* ── Marketplace ──────────────────────────────────────────────────── */}
      <section id="marketplace" className="scroll-mt-20 border-y border-border bg-card px-5 py-16 sm:px-7 sm:py-24">
        <div className="mx-auto grid max-w-[1280px] items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="reveal rounded-[18px] border border-border bg-background p-8">
            <span className="flex size-12 items-center justify-center rounded-[13px] bg-accent-subtle text-primary">
              <Store className="size-6" />
            </span>
            <h3 className="mt-5 text-[18px] font-extrabold text-foreground">Chaque annonce adossée au registre</h3>
            <p className="mt-2.5 text-[13.5px] leading-[1.6] text-muted-foreground">
              Les parcelles mises en vente sont d&apos;abord vérifiées dans le cadastre officiel : pas d&apos;annonce sans
              lot enregistré, pas de surface sans mesure. Les annonces publiques arrivent.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-[12px] font-semibold text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-success" /> Vérifié contre le registre officiel
            </div>
          </div>
          <div className="reveal" style={{ animationDelay: "0.1s" }}>
            <Eyebrow>TerraCI Market</Eyebrow>
            <h2 className="mt-3 text-[34px] font-extrabold leading-[1.15] tracking-[-0.02em] text-foreground">
              TerraCI Market — le marché foncier vérifié.
            </h2>
            <p className="mt-4 max-w-[460px] text-[15px] leading-[1.7] text-muted-foreground">
              Propriétaires et opérateurs publient leurs parcelles disponibles ; acquéreurs et investisseurs consultent
              des annonces adossées au registre officiel. Chaque parcelle affichée est déjà dans le cadastre.
            </p>
            <a
              href={TERRACI_MARKET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-[46px] items-center gap-2 rounded-[11px] border border-border-strong bg-background px-5 text-[13.5px] font-bold text-foreground transition-colors hover:bg-inset"
            >
              Explorer TerraCI Market <ArrowRight className="size-[15px]" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Bandeau chiffres (réels) ─────────────────────────────────────── */}
      <section className="relative overflow-hidden px-5 py-20 sm:px-7" style={{ background: "linear-gradient(135deg, var(--primary), #0E5A9B)" }}>
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative mx-auto max-w-[1280px]">
          <div className="reveal text-center">
            <p className="text-[12.5px] font-bold uppercase tracking-[0.09em] text-white/70">En chiffres</p>
            <h2 className="mt-3 text-[32px] font-extrabold tracking-[-0.02em] text-white">
              Le foncier, mesuré à l&apos;échelle nationale.
            </h2>
          </div>
          <div className="mt-13 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {[
              { v: fmt(stats?.lots), l: "Lots enregistrés" },
              { v: fmt(stats?.attributions), l: "Attributions" },
              { v: fmt(stats?.attributaires), l: "Attributaires" },
              { v: fmt(stats?.documents), l: "Documents" },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <div className="tabular text-[38px] font-extrabold text-white">{s.v}</div>
                <div className="mt-1.5 text-[13px] text-white/70">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sécurité & confiance ─────────────────────────────────────────── */}
      <section id="securite" className="mx-auto max-w-[1280px] scroll-mt-20 px-5 py-16 sm:px-7 sm:py-24">
        <div className="grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <div className="reveal">
            <Eyebrow>Sécurité &amp; confiance</Eyebrow>
            <h2 className="mt-3 text-[32px] font-extrabold leading-[1.18] tracking-[-0.02em] text-foreground">
              Des signaux vérifiables, pas des promesses vagues.
            </h2>
            <p className="mt-4 max-w-[420px] text-[15px] leading-[1.7] text-muted-foreground">
              Chaque accès est scopé, chaque opération journalisée, chaque document vérifiable — la confiance se prouve,
              elle ne s&apos;affirme pas.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: ScrollText, c: "text-success", t: "Historique des opérations", d: "Chaque écran métier rend visibles les actions, leurs statuts et leurs auteurs." },
              { icon: ScanLine, c: "text-primary", t: "Vérification par référence", d: "Un parcours dédié permet de consulter un document par référence ou QR code." },
              { icon: Lock, c: "text-primary", t: "Accès organisé par rôle", d: "Sept profils, chacun scopé à sa juridiction et à ses dossiers." },
              { icon: Database, c: "text-primary", t: "Sauvegardes & continuité", d: "Sauvegardes nocturnes et infrastructure supervisée en continu." },
            ].map((s) => (
              <div key={s.t} className="rounded-2xl border border-border bg-card p-5.5">
                <s.icon className={cn("size-5", s.c)} />
                <h3 className="mt-3.5 text-[14.5px] font-bold text-foreground">{s.t}</h3>
                <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Partenaires & métiers ────────────────────────────────────────── */}
      <section id="partenaires" className="scroll-mt-20 border-y border-border bg-card px-5 py-16 sm:px-7 sm:py-24">
        <div className="mx-auto max-w-[1280px]">
          <div className="reveal max-w-[640px]">
            <Eyebrow>Partenaires &amp; métiers</Eyebrow>
            <h2 className="mt-3 text-[34px] font-extrabold tracking-[-0.02em] text-foreground">
              Conçu avec, et pour, les acteurs du foncier.
            </h2>
          </div>
          <div className="mt-10 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {["collectivite", "amenageur", "promoteur", "geometre", "notaire", "cabinet-juridique", "banque", "chefferie"].map(
              (slug) => {
                const p = getMetier(slug);
                if (!p) return null;
                return (
                  <Link
                    key={p.slug}
                    href={`/metiers/${p.slug}`}
                    className={cn(
                      "flex items-center gap-3 rounded-[13px] border border-border bg-background p-4",
                      CARD_HOVER,
                    )}
                  >
                    <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-accent-subtle text-primary">
                      <p.icon className="size-4" />
                    </span>
                    <span className="text-[13px] font-semibold text-foreground">{p.nom}</span>
                  </Link>
                );
              },
            )}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="mx-auto max-w-[860px] scroll-mt-20 px-5 py-16 sm:px-7 sm:py-24">
        <div className="reveal text-center">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-3 text-[32px] font-extrabold tracking-[-0.02em] text-foreground">Les réponses essentielles.</h2>
        </div>
        <div className="reveal mt-10 overflow-hidden rounded-[18px] border border-border bg-card" style={{ animationDelay: "0.08s" }}>
          {[
            { q: "À qui s'adresse SGNF ?", a: "Aux collectivités, opérateurs, propriétaires, acquéreurs, géomètres, commissaires de justice et chefferies impliqués dans la gestion foncière.", open: true },
            { q: "Comment vérifier l'authenticité d'un document ?", a: "Utilisez sa référence ou son code QR sur la page de vérification pour consulter les informations disponibles au registre." },
            { q: "Comment mon organisation obtient-elle un accès ?", a: "Votre organisation vous invite depuis son espace ; vous activez ensuite votre compte avec le code reçu par email." },
            { q: "Mes données sont-elles sécurisées ?", a: "Chaque rôle est scopé à ses propres données, chaque opération est journalisée et l'infrastructure est sauvegardée chaque nuit." },
            { q: "SGNF remplace-t-il les actes notariés ?", a: "Non — SGNF centralise et fiabilise le registre foncier ; notaires et cabinets juridiques restent vos interlocuteurs pour les actes." },
          ].map((f, i) => (
            <details key={f.q} open={f.open} className={cn("group", i < 4 && "border-b border-border")}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[15px] font-bold text-foreground [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-inset text-primary transition-transform group-open:rotate-45">
                  <Plus className="size-3.5" strokeWidth={2.4} />
                </span>
              </summary>
              <p className="max-w-[640px] px-6 pb-5 text-[14px] leading-[1.65] text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section id="cta" className="mx-auto mb-24 max-w-[1280px] scroll-mt-20 px-5 sm:px-7">
        <div
          className="reveal rounded-[28px] px-6 py-16 text-center text-white sm:px-10 sm:py-18"
          style={{ background: "linear-gradient(135deg, var(--primary), #0E5A9B)" }}
        >
          <h2 className="text-[34px] font-extrabold tracking-[-0.02em]">Prêt à moderniser votre gouvernance foncière ?</h2>
          <p className="mt-3.5 text-[15px] text-white/80">
            Une démonstration personnalisée, adaptée à votre organisation.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex h-[50px] items-center rounded-xl bg-white px-6 text-[14.5px] font-bold text-primary transition-opacity hover:opacity-90"
            >
              Demander une démonstration
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-[50px] items-center rounded-xl border border-white/35 px-6 text-[14.5px] font-bold text-white transition-colors hover:bg-white/10"
            >
              Contacter l&apos;équipe
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
