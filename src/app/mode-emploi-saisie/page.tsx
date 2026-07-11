"use client";

import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  HelpCircle,
  Layers,
  Printer,
  Search,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";

/**
 * Mode d'emploi du module « Opérateur de saisie » (maker-checker) — pensé pour
 * l'opérateur qui saisit les attributions et l'administrateur qui valide.
 * Même famille visuelle que /guide-achat (pictogrammes, une action à la fois,
 * reproductions fidèles des boutons réels) mais structuré en chapitres de
 * référence plutôt qu'en parcours linéaire, car le module a plusieurs usages
 * indépendants (mise à jour, création, validation).
 *
 * Page autonome (hors layout /dashboard) : aucune donnée privée, uniquement
 * le mode d'emploi → imprimable proprement et consultable avant même d'avoir
 * un compte (utile pour former un nouvel opérateur).
 */

const BLEU = "#0D3B66";
const VERT = "#2D8F5A";
const ORANGE = "#F39C12";
const ROUGE = "#EF4444";

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
  .guide-chapter, .guide-note, .guide-cover, .guide-help { break-inside: avoid; page-break-inside: avoid; }
  @page { margin: 14mm; }
}
`;

export default function ModeEmploiSaisiePage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-6 sm:py-10">
      <style dangerouslySetInnerHTML={{ __html: printCss }} />

      {/* Barre d'actions — masquée à l'impression */}
      <div className="no-print mx-auto mb-6 flex max-w-2xl items-center justify-between">
        <Link
          href="/dashboard/saisie"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-[#0D3B66]"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au module
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
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#F39C12]">Mode d&apos;emploi</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-[#0D3B66] sm:text-4xl">Saisie foncière</h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-slate-600">
            Ce module sert à mettre à jour les attributions (qui détient quel lot) et à créer de nouveaux
            lotissements dans la base SGNF. <span className="font-semibold text-slate-800">Rien n&apos;est jamais
            appliqué directement</span> : chaque saisie passe par une validation avant d&apos;impacter la base réelle.
          </p>
        </header>

        {/* Principe : double validation */}
        <section className="guide-chapter mb-8 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-3 flex items-center gap-3">
            <span style={{ color: BLEU }}>
              <ShieldCheck className="h-7 w-7" />
            </span>
            <h2 className="font-display text-xl font-bold text-slate-800">Le principe : deux regards, jamais un seul</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <RoleCard color={BLEU} titre="L'opérateur de saisie">
              Saisit les changements (à la main ou par import Excel), voit un aperçu clair de ce qui va changer, puis{" "}
              <span className="font-semibold">soumet</span> pour validation.
            </RoleCard>
            <RoleCard color={VERT} titre="L'administrateur">
              Reçoit chaque soumission dans une file d&apos;attente, revoit le détail, puis{" "}
              <span className="font-semibold">approuve</span> (la base est mise à jour) ou{" "}
              <span className="font-semibold">rejette</span> (rien ne change) avec un motif.
            </RoleCard>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Tant que l&apos;administrateur n&apos;a pas approuvé, la base réelle n&apos;est pas touchée — l&apos;opérateur peut
            se tromper sans risque, tout se voit avant d&apos;être définitif.
          </p>
        </section>

        {/* Chapitre 1 */}
        <Chapter n={1} color={BLEU} icon={<Users className="h-7 w-7" />} titre="Arriver sur le module">
          <ul className="space-y-1.5">
            <Puce>Connectez-vous avec votre compte d&apos;opérateur de saisie.</Puce>
            <Puce>Le menu ne montre qu&apos;un seul élément : « Saisie foncière ». C&apos;est normal, votre compte n&apos;a accès qu&apos;à ce module.</Puce>
            <Puce>En haut de la page, choisissez ce que vous voulez faire :</Puce>
          </ul>
          <Legende>Les deux modes :</Legende>
          <div className="flex flex-wrap gap-2">
            <PillVisuel active>Mettre à jour un lotissement</PillVisuel>
            <PillVisuel>Créer un nouveau lotissement</PillVisuel>
          </div>
        </Chapter>

        {/* Chapitre 2 */}
        <Chapter n={2} color={BLEU} icon={<Search className="h-7 w-7" />} titre="Mettre à jour un lotissement">
          <ul className="space-y-1.5">
            <Puce>Choisissez le lotissement dans la liste déroulante.</Puce>
            <Puce>Les lots et leurs titulaires actuels se chargent automatiquement.</Puce>
            <Puce>Vous avez ensuite <span className="font-semibold">deux façons</span> de saisir vos changements — utilisables l&apos;une après l&apos;autre, elles s&apos;additionnent dans le même aperçu.</Puce>
          </ul>

          <div className="mt-5 rounded-xl border border-slate-200/70 bg-slate-50/70 p-4">
            <p className="text-sm font-bold text-[#0D3B66]">A. Ligne par ligne</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              <Puce>Recherchez le lot (numéro de lot, numéro d&apos;îlot, ou nom du titulaire actuel).</Puce>
              <Puce>Choisissez l&apos;action : « Attribuer à… » ou « Remettre en disponibilité ».</Puce>
              <Puce>Si vous attribuez : recherchez l&apos;attributaire par son nom. S&apos;il n&apos;existe pas encore, utilisez « Créer un nouvel attributaire » — jamais de création automatique, vous confirmez toujours vous-même.</Puce>
              <Puce>Choisissez sa qualité (propriétaire d&apos;origine, ayant-droit, acquéreur…).</Puce>
              <Puce>Cliquez sur « Ajouter à la liste ». Répétez pour chaque lot à modifier.</Puce>
            </ul>
            <Legende>Les boutons à repérer :</Legende>
            <div className="flex flex-wrap gap-2">
              <BoutonVisuel color={BLEU} icon={<Search className="h-4 w-4" />}>Attribuer à…</BoutonVisuel>
              <BoutonVisuel color="#64748B" icon={<X className="h-4 w-4" />}>Remettre en disponibilité</BoutonVisuel>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <LienVisuel icon={<UserPlus className="h-3.5 w-3.5" />}>Créer un nouvel attributaire</LienVisuel>
              <BoutonVisuel color={BLEU} icon={<Send className="h-4 w-4" />}>Ajouter à la liste</BoutonVisuel>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50/70 p-4">
            <p className="text-sm font-bold text-[#0D3B66]">B. Import d&apos;un fichier Excel</p>
            <p className="mt-1 text-sm text-slate-600">Utile pour saisir beaucoup de lots d&apos;un coup (une ligne = un lot).</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              <Puce>Cliquez sur « Télécharger le modèle » : un fichier Excel avec un onglet à remplir et un onglet d&apos;aide (qualités valides, exemples).</Puce>
              <Puce>Remplissez une ligne par lot (îlot, numéro de lot, action, nom de l&apos;attributaire, qualité).</Puce>
              <Puce>Cliquez sur « Choisir un fichier Excel » pour l&apos;importer.</Puce>
              <Puce>Le module signale toute erreur (lot introuvable, qualité invalide, ligne en double…) — corrigez le fichier et réimportez.</Puce>
              <Puce>Pour chaque nom d&apos;attributaire, le module essaie de le retrouver automatiquement. S&apos;il y a un doute, un badge orange « À résoudre » apparaît : recherchez-le manuellement ou créez-le comme nouveau.</Puce>
              <Puce>Une fois tout résolu, cliquez sur « Ajouter à l&apos;aperçu ».</Puce>
            </ul>
            <Legende>Les boutons à repérer :</Legende>
            <div className="flex flex-wrap gap-2">
              <BoutonVisuel color={BLEU} icon={<Download className="h-4 w-4" />}>Télécharger le modèle</BoutonVisuel>
              <BoutonVisuel color={BLEU} icon={<FileSpreadsheet className="h-4 w-4" />}>Choisir un fichier Excel</BoutonVisuel>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">À résoudre</span>
              <span className="text-xs text-slate-500">→ nécessite votre attention avant de continuer</span>
            </div>
            <div className="mt-2">
              <BoutonVisuel color={BLEU} icon={<Check className="h-4 w-4" />}>Ajouter à l&apos;aperçu</BoutonVisuel>
            </div>
          </div>
        </Chapter>

        {/* Chapitre 3 */}
        <Chapter n={3} color={ORANGE} icon={<AlertTriangle className="h-7 w-7" />} titre="Vérifier l'aperçu avant de soumettre">
          <p className="text-sm leading-relaxed text-slate-700">
            Chaque ligne ajoutée apparaît dans un tableau « Avant / Après », classée automatiquement :
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <LigneApercu couleur="emerald" label="Nouvelle attribution">Le lot était libre, il est maintenant attribué.</LigneApercu>
            <LigneApercu couleur="amber" label="Réassignation">Le lot change de titulaire ou de qualité.</LigneApercu>
            <LigneApercu couleur="slate" label="Remise en disponibilité">Le lot redevient libre.</LigneApercu>
            <LigneApercu couleur="slate" label="Sans effet">Rien ne change réellement — ne sera pas envoyé à la validation.</LigneApercu>
          </div>
          <ul className="mt-4 space-y-1.5">
            <Puce>Une ligne ajoutée par erreur ? Retirez-la avec l&apos;icône poubelle.</Puce>
            <Puce>Donnez un titre à votre soumission (optionnel — un titre par défaut est proposé).</Puce>
            <Puce>Cliquez sur « Soumettre pour validation ». Un message confirme l&apos;envoi.</Puce>
          </ul>
          <Legende>Le bouton final :</Legende>
          <BoutonVisuel color={BLEU} icon={<Send className="h-4 w-4" />}>Soumettre pour validation</BoutonVisuel>
        </Chapter>

        {/* Chapitre 4 */}
        <Chapter n={4} color={BLEU} icon={<Building2 className="h-7 w-7" />} titre="Créer un nouveau lotissement">
          <p className="text-sm leading-relaxed text-slate-700">
            À utiliser uniquement pour un lotissement qui n&apos;existe pas encore dans la base (formulaire séparé —
            l&apos;import Excel ne sert qu&apos;aux attributions).
          </p>
          <ul className="mt-3 space-y-1.5">
            <Puce>Renseignez le nom du lotissement (obligatoire), le village, la commune, le district.</Puce>
            <Puce>Choisissez l&apos;autorité coutumière, l&apos;opérateur et la famille concernés dans les listes — ou cliquez sur « + Créer nouveau » si l&apos;un d&apos;eux n&apos;existe pas encore.</Puce>
            <Puce>Ajoutez les îlots un par un, puis les lots de chaque îlot (numéro, superficie). Cochez « équipement » pour un lot réservé (école, marché, voirie…).</Puce>
            <Puce>Vérifiez le résumé (nombre d&apos;îlots, de lots, d&apos;équipements) puis soumettez.</Puce>
          </ul>
          <Legende>Repère :</Legende>
          <div className="flex items-center gap-2">
            <span style={{ color: BLEU }}><Layers className="h-4 w-4" /></span>
            <span className="text-sm text-slate-600">Un îlot ajouté ouvre automatiquement son éditeur de lots.</span>
          </div>
        </Chapter>

        {/* Chapitre 5 */}
        <Chapter n={5} color={VERT} icon={<ClipboardCheck className="h-7 w-7" />} titre="Suivre vos soumissions">
          <p className="text-sm leading-relaxed text-slate-700">
            L&apos;onglet « Mes soumissions » liste tout ce que vous avez envoyé, avec son statut :
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatutVisuel couleur={ORANGE}>En attente</StatutVisuel>
            <StatutVisuel couleur={BLEU}>Approuvée</StatutVisuel>
            <StatutVisuel couleur={ROUGE}>Rejetée</StatutVisuel>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            En cas de rejet, le motif indiqué par l&apos;administrateur s&apos;affiche sous la soumission — corrigez et
            soumettez à nouveau.
          </p>
        </Chapter>

        {/* Chapitre 6 — réservé admin */}
        <Chapter n={6} color={VERT} icon={<ShieldCheck className="h-7 w-7" />} titre="Valider une soumission" note="Réservé aux administrateurs" last>
          <ul className="space-y-1.5">
            <Puce>Une pastille rouge apparaît sur « Saisie foncière » dans le menu dès qu&apos;une soumission attend une validation.</Puce>
            <Puce>Dans l&apos;onglet « File de validation », cliquez sur « Voir le détail » pour revoir chaque changement (tableau Avant/Après, ou aperçu complet pour une création de lotissement).</Puce>
            <Puce>Deux choix : approuver (la base est mise à jour immédiatement) ou rejeter (rien ne change, un motif peut être ajouté pour l&apos;opérateur).</Puce>
            <Puce>Toutes les soumissions traitées restent visibles dans l&apos;historique, pour garder une trace.</Puce>
          </ul>
          <Legende>Les boutons à repérer :</Legende>
          <div className="flex flex-wrap gap-2">
            <BoutonVisuel color={BLEU} icon={<Check className="h-4 w-4" />}>Approuver et appliquer</BoutonVisuel>
            <BoutonVisuel color="#FFFFFF" textColor="#475569" border icon={<X className="h-4 w-4" />}>Rejeter</BoutonVisuel>
          </div>
        </Chapter>

        {/* FAQ / aide */}
        <section className="guide-help mt-4 space-y-3 rounded-2xl bg-[#0D3B66]/[0.04] px-5 py-5">
          <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-slate-800">
            <HelpCircle className="h-5 w-5 text-[#0D3B66]" />
            Questions fréquentes
          </h2>
          <Aide>
            <span className="font-semibold">« Lot introuvable » lors d&apos;un import Excel.</span> Vérifiez que le
            numéro d&apos;îlot et de lot dans le fichier correspondent exactement au lotissement sélectionné à l&apos;écran.
          </Aide>
          <Aide>
            <span className="font-semibold">Un nom de lotissement proche existe déjà.</span> Le module vous
            prévient mais ne bloque pas — vérifiez qu&apos;il ne s&apos;agit pas d&apos;un doublon avant de continuer.
          </Aide>
          <Aide>
            <span className="font-semibold">Puis-je annuler une soumission approuvée ?</span> Non, pas depuis le
            module. Contactez un administrateur pour une correction manuelle si nécessaire.
          </Aide>
          <Aide>
            <span className="font-semibold">Une attestation de cession est-elle générée par ce module ?</span>{" "}
            Jamais. La saisie ne fait que mettre à jour qui détient quel lot.
          </Aide>
        </section>
      </article>
    </main>
  );
}

function Chapter({
  n,
  color,
  icon,
  titre,
  note,
  children,
  last,
}: {
  n: number;
  color: string;
  icon: React.ReactNode;
  titre: string;
  note?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className="guide-chapter flex gap-4 sm:gap-5">
      <div className="flex flex-col items-center">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-extrabold text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          {n}
        </div>
        {!last && <div className="mt-2 w-1 flex-1 rounded bg-slate-200" />}
      </div>

      <div className={`flex-1 ${last ? "" : "pb-6"}`}>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <span style={{ color }}>{icon}</span>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-800">{titre}</h2>
              {note && (
                <p className="text-xs font-semibold uppercase tracking-wide text-[#F39C12]">{note}</p>
              )}
            </div>
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
  textColor,
  border,
  icon,
  children,
}: {
  color: string;
  textColor?: string;
  border?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm ${
        border ? "border border-slate-200" : ""
      }`}
      style={{ backgroundColor: color, color: textColor ?? "#fff" }}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}

function LienVisuel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E6091]">
      {icon}
      {children}
    </span>
  );
}

function PillVisuel({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-4 py-1.5 text-sm font-medium shadow-sm ${
        active ? "bg-[#0D3B66] text-white" : "border border-slate-200 text-slate-500"
      }`}
    >
      {children}
    </span>
  );
}

function RoleCard({ color, titre, children }: { color: string; titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4">
      <p className="text-sm font-bold" style={{ color }}>
        {titre}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{children}</p>
    </div>
  );
}

const APERCU_COULEURS: Record<string, { bg: string; text: string }> = {
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700" },
  amber: { bg: "bg-amber-50", text: "text-amber-700" },
  slate: { bg: "bg-slate-100", text: "text-slate-600" },
};

function LigneApercu({ couleur, label, children }: { couleur: string; label: string; children: React.ReactNode }) {
  const c = APERCU_COULEURS[couleur];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white px-3 py-2">
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.text}`}>{label}</span>
      <span className="text-sm text-slate-600">{children}</span>
    </div>
  );
}

function StatutVisuel({ couleur, children }: { couleur: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{ borderColor: `${couleur}40`, backgroundColor: `${couleur}1A`, color: couleur }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: couleur }} />
      {children}
    </span>
  );
}

function Aide({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0D3B66]" />
      <p className="text-sm leading-relaxed text-slate-600">{children}</p>
    </div>
  );
}
