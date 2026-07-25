"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Banknote, FileWarning, ShieldCheck } from "lucide-react";

import { stagger, fadeUp } from "@/lib/motion";
import type { AdminOverview } from "@/hooks/useAdminOverview";
import { AlertCenter } from "@/components/pilotage/AlertCenter";
import { Button } from "@/components/ds/button";
import { CountBadge } from "@/components/ds/badge";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";

/**
 * Aperçu des cartes d'action — page de développement, jamais servie en prod.
 *
 * Raison d'être : en production les files sont vides (« Aucune action requise »),
 * donc l'état **brique** — celui qui compte — est invisible à l'écran. On ne
 * fabrique pas des dossiers en base pour regarder une couleur : cette page
 * alimente les **vrais composants** avec des compteurs simulés, côté client.
 *
 * `AlertCenter` est rendu tel quel, avec ses props réelles : ce qui s'affiche
 * ici est exactement ce que verra l'agence le jour où un litige s'ouvre. Les
 * trois autres blocs reproduisent leur écran avec les mêmes primitives du DS
 * (`Card tone="alert"`, `CountBadge`) — s'ils divergent un jour, c'est le signe
 * que la convention a été contournée quelque part.
 */

/** Compteurs simulés : aucune requête, aucune écriture. */
function jeuDeDonnees(plein: boolean): {
  files: AdminOverview["files"];
  recettes: AdminOverview["recettes"];
} {
  return {
    files: {
      litiges: [],
      litigesOuverts: plein ? 2 : 0,
      dossiersAdu: [],
      dossiersAduTotal: 0,
      dossiersAduEnCours: plein ? 7 : 0,
      saisieAValider: plein ? 12 : 0,
      demandesATraiter: plein ? 3 : 0,
    },
    recettes: { encaisse: 0, commissions: 0, enAttente: plein ? 4 : 0, paiements: [] },
  };
}

export default function ApercuCartesPage() {
  const [sombre, setSombre] = useState(false);

  if (process.env.NODE_ENV !== "development") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Aperçu réservé au développement local.{" "}
          <Link href="/" className="font-semibold text-accent underline">
            Retour à l&apos;accueil
          </Link>
        </p>
      </main>
    );
  }

  const plein = jeuDeDonnees(true);
  const vide = jeuDeDonnees(false);

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
              Cartes d&apos;action — aperçu
            </h1>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Rouge brique dès qu&apos;une file attend une décision, neutre sinon. Données simulées :
              rien n&apos;est lu ni écrit en base.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              document.documentElement.classList.toggle("dark");
              setSombre((s) => !s);
            }}
          >
            {sombre ? "Passer en clair" : "Passer en sombre"}
          </Button>
        </header>

        <Section
          titre="1 · Centre de pilotage — « Actions requises »"
          note="Le composant réel, alimenté par des compteurs simulés. La pastille d'en-tête compte les dossiers (29), pas les lignes (6) : six lignes peuvent cacher vingt-neuf dossiers."
        >
          <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
            <Etat libelle="File pleine — ce que voit l'agence quand on l'attend">
              <motion.div variants={stagger(0.05, 0.04)} initial="hidden" animate="show">
                <AlertCenter files={plein.files} recettes={plein.recettes} marketplaceARebuild loading={false} />
              </motion.div>
            </Etat>
            <Etat libelle="File vide — l'état actuel de la production">
              <motion.div variants={stagger(0.05, 0.04)} initial="hidden" animate="show">
                <AlertCenter
                  files={vide.files}
                  recettes={vide.recettes}
                  marketplaceARebuild={false}
                  loading={false}
                />
              </motion.div>
            </Etat>
          </div>
        </Section>

        <Section
          titre="2 · Espace Chefferie — « À traiter en priorité »"
          note="Même convention, autre rôle : la chefferie voit ses signatures et ses médiations."
        >
          <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
            <Etat libelle="File pleine">
              <CarteChefferie priorites={PRIORITES_DEMO} />
            </Etat>
            <Etat libelle="File vide">
              <CarteChefferie priorites={[]} />
            </Etat>
          </div>
        </Section>

        <Section
          titre="3 · Validations — files de signature"
          note="Le compte quittait la description en fin de phrase ; il devient une pastille."
        >
          <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
            <Etat libelle="File pleine">
              <CarteValidation nb={9} />
            </Etat>
            <Etat libelle="File vide">
              <CarteValidation nb={0} />
            </Etat>
          </div>
        </Section>

        <Section
          titre="4 · Demandes d'acquisition — bandeau et cartes marquées"
          note="Ce bandeau portait le rouge « danger », qui signale une anomalie. Rien n'est cassé ici : des dossiers attendent."
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-brick/40 bg-brick-subtle px-4 py-3">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brick opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brick" />
              </span>
              <CountBadge value={3} />
              <span className="text-sm font-semibold text-foreground">actions à faire</span>
              <span className="text-sm text-muted-foreground">
                — traitez les cartes marquées en brique ci-dessous.
              </span>
            </div>
            <div className="rounded-xl border border-brick/45 bg-brick-subtle p-5 shadow-panel ring-1 ring-brick/20">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-base font-semibold text-foreground">
                  Koelea-Accor — Îlot 4 · Lot 112
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brick px-2.5 py-1 text-xs font-bold text-brick-foreground shadow-panel">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  À faire : Créer la vente
                </span>
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground">
                L&apos;acquéreur s&apos;est engagé ; la vente reste à ouvrir au guichet.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-panel">
              <p className="text-base font-semibold text-foreground">Brignan — Îlot 2 · Lot 37</p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Dossier soldé : rien ne nous attend, la carte reste neutre.
              </p>
            </div>
          </div>
        </Section>

        <Section
          titre="5 · Où la convention s'applique"
          note="Une carte n'apparaît en brique que si sa file est non vide — en production, elles le sont toutes, donc tout reste blanc."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-[12.5px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-2 uppercase">
                  <th className="py-2 pr-4 font-bold">Écran</th>
                  <th className="py-2 pr-4 font-bold">Ce qui déclenche la teinte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {COUVERTURE.map((c) => (
                  <tr key={c.ecran}>
                    <td className="py-2 pr-4 font-semibold text-foreground">{c.ecran}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{c.declencheur}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <p className="pb-6 text-[12.5px] text-muted-foreground">
          Les écrans réels vivent sur{" "}
          <Link href="/dashboard" className="font-semibold text-accent underline">
            /dashboard
          </Link>
          ,{" "}
          <Link href="/dashboard/validations" className="font-semibold text-accent underline">
            /dashboard/validations
          </Link>{" "}
          et{" "}
          <Link href="/dashboard/demandes-acquisition" className="font-semibold text-accent underline">
            /dashboard/demandes-acquisition
          </Link>
          . Ils n&apos;afficheront la teinte que le jour où une file se remplira.
        </p>
      </div>
    </main>
  );
}

function Section({ titre, note, children }: { titre: string; note: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-[17px] font-bold tracking-tight text-foreground">{titre}</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{note}</p>
      </div>
      {children}
    </section>
  );
}

function Etat({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[11.5px] font-semibold tracking-wide text-muted-2 uppercase">{libelle}</p>
      {children}
    </div>
  );
}

/** Récapitulatif de couverture — tenu à jour à la main, il est la seule vue
 *  d'ensemble de la convention : une carte oubliée se voit ici par son absence. */
const COUVERTURE = [
  { ecran: "Pilotage — Actions requises", declencheur: "toute file foncière non vide" },
  { ecran: "Pilotage — Files de traitement", declencheur: "litiges ouverts + paiements à encaisser" },
  { ecran: "Chefferie — À traiter en priorité", declencheur: "APFC à signer, cessions, litiges" },
  { ecran: "Validations — cessions", declencheur: "attestations sans signature chefferie" },
  { ecran: "Validations — attributions de lot", declencheur: "attributions sans signature chefferie" },
  { ecran: "Validations — APFC", declencheur: "APFC sans signature du chef de village" },
  { ecran: "Demandes d'acquisition", declencheur: "demandes où l'agence doit jouer" },
  { ecran: "Paiements — vue À valider", declencheur: "règlements guichet en attente" },
  { ecran: "Géomètres-experts", declencheur: "demandes d'inscription à approuver" },
  { ecran: "Saisie — file de validation (admin)", declencheur: "soumissions en attente" },
  { ecran: "Saisie — mes soumissions (agent)", declencheur: "soumissions rejetées à corriger" },
  { ecran: "Propriétaire terrien — APFC / PV", declencheur: "à signer / à régulariser" },
  { ecran: "Propriétaire — bandeau paiements", declencheur: "paiements en attente de sa part" },
  { ecran: "Barre latérale + onglets mobiles", declencheur: "pastilles « N à traiter »" },
  { ecran: "App mobile admin — À faire / Files", declencheur: "toute file non vide" },
];

const PRIORITES_DEMO = [
  {
    cle: "apfc",
    titre: "3 attestations coutumières en attente de votre signature",
    detail: "APFC · co-signature chef de village",
    action: "Signer",
    icon: ShieldCheck,
    compte: 3,
  },
  {
    cle: "cessions",
    titre: "5 cessions à valider",
    detail: "En attente de validation de la chefferie",
    action: "Examiner",
    icon: Banknote,
    compte: 5,
  },
  {
    cle: "litiges",
    titre: "1 litige actif sur votre juridiction",
    detail: "En attente de médiation",
    action: "Médier",
    icon: FileWarning,
    compte: 1,
  },
];

function CarteChefferie({ priorites }: { priorites: typeof PRIORITES_DEMO }) {
  const dossiers = priorites.reduce((n, p) => n + p.compte, 0);
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show">
      <Card tone={priorites.length > 0 ? "alert" : "default"} className="h-full">
        <CardHeader>
          <div>
            <CardTitle>À traiter en priorité</CardTitle>
            <CardDescription>Ce qui attend une décision de la chefferie</CardDescription>
          </div>
          {priorites.length > 0 && (
            <CardAction className="gap-2.5">
              <CountBadge tone="inverse" value={dossiers} />
              <Button
                variant="ghost"
                size="sm"
                className="text-brick-foreground hover:bg-brick-foreground/15 hover:text-brick-foreground"
              >
                Tout voir
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <div className="px-5 pt-4 pb-5">
          {priorites.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Rien en attente"
              description="Aucune signature, aucune cession et aucun litige ne requiert votre intervention."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {priorites.map((p) => {
                const Icone = p.icon;
                return (
                  <li key={p.cle}>
                    <div className="group flex items-center gap-3 rounded-xl border border-brick/20 bg-card p-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-brick text-brick-foreground">
                        <Icone className="size-[18px]" aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[13px] font-semibold text-foreground">{p.titre}</span>
                        <span className="truncate text-[11.5px] text-muted-2">{p.detail}</span>
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-2.5">
                        <CountBadge value={p.compte} />
                        <span className="text-[12px] font-semibold text-foreground">{p.action} →</span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function CarteValidation({ nb }: { nb: number }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show">
      <Card tone={nb > 0 ? "alert" : "default"} className="overflow-hidden">
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Attestations de cession — en attente de votre validation</CardTitle>
            <CardDescription>Validez après vérification de la cession hors-système</CardDescription>
          </div>
          {nb > 0 && (
            <CardAction>
              <CountBadge tone="inverse" value={nb} />
            </CardAction>
          )}
        </CardHeader>
        {nb === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            tone="positive"
            title="Rien en attente"
            description="Aucune attestation de cession n'attend votre validation."
          />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {["SGFN-ATT-2026-0148", "SGFN-ATT-2026-0151", "SGFN-ATT-2026-0159"].map((ref) => (
              <li key={ref} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-foreground">{ref}</p>
                  <p className="mt-0.5 text-xs text-muted-2">Lot 112 — Koelea-Accor</p>
                </div>
                <Button variant="primary" size="sm">
                  Valider
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </motion.div>
  );
}
