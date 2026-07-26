"use client";

// Briques communes aux quatre écrans de saisie du registre.
//
// Elles existent pour une raison précise : ces écrans envoient tous dans la
// **même** file de validation, et doivent donc tenir le même discours — « rien
// n'est appliqué avant qu'un administrateur approuve ». Reformulé quatre fois à
// la main, ce message aurait dérivé quatre fois.
//
// 🔴 Règle de couleur tenue ici : sur un fond teinté (`bg-*-subtle`), le texte
// reste en `text-foreground`. Mesuré ailleurs dans le projet, `text-warning`
// sur `bg-warning-subtle` tombe à 2,83:1 — sous AA. **La couleur porte la
// catégorie (le fond, le filet, l'icône), le texte porte l'information.**

import { useState, type ReactNode } from "react";
import { CheckCircle2, ChevronRight, Info, Loader2, Search, Send, TriangleAlert } from "lucide-react";

import { BarHeader } from "../../../components/MobileHeader";
import type { EnvoiSaisie, Resultat } from "../../../data/useSaisieRegistre";

/** Coquille d'écran : en-tête, zone défilante, barre d'action collée en bas. */
export function EcranSaisie({
  titre,
  sousTitre,
  onBack,
  children,
  action,
}: {
  titre: string;
  sousTitre: string;
  onBack: () => void;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <BarHeader
        onBack={onBack}
        title={
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-foreground">{titre}</div>
            <div className="truncate text-[11.5px] text-muted-foreground">{sousTitre}</div>
          </div>
        }
      />
      <div className="sgnf-scroll flex-1 overflow-y-auto px-[18px] pt-4 pb-6">{children}</div>
      {action && <div className="flex-none border-t border-border bg-card px-4 py-3">{action}</div>}
    </div>
  );
}

export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mb-2 text-[12px] font-bold tracking-[0.03em] text-muted-foreground uppercase ${className}`}>
      {children}
    </div>
  );
}

export function Carte({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-3.5 rounded-[18px] border border-border bg-card p-4 shadow-panel ${className}`}>
      {children}
    </div>
  );
}

export function Champ({
  label,
  obligatoire,
  aide,
  children,
}: {
  label: string;
  obligatoire?: boolean;
  aide?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-muted-foreground">
        {label}
        {/* Astérisque en `text-foreground` et non `text-brick` : mesuré à
            2,83:1 en thème sombre, sous AA. Un marqueur d'obligation ne doit
            de toute façon jamais porter son sens par la seule couleur — ici
            c'est la position après le libellé qui le porte. */}
        {obligatoire && <span className="font-bold text-foreground"> *</span>}
      </span>
      {children}
      {/* `text-muted-2` mesurait 2,56:1 sur ce texte d'aide — c'est justement
          celui qu'on lit quand on ne sait pas quoi saisir. `muted-foreground`
          est le plancher du DS (4,39:1 en clair). */}
      {aide && <span className="text-[11px] leading-snug text-muted-foreground">{aide}</span>}
    </label>
  );
}

const CLASSE_CHAMP =
  "w-full rounded-lg border border-border-strong bg-inset px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary";

export function Texte({
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  autoCapitalize,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "tel" | "email" | "date" | "url";
  inputMode?: "text" | "numeric" | "tel" | "email" | "url";
  autoCapitalize?: "none" | "words" | "characters";
}) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      autoCapitalize={autoCapitalize}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={CLASSE_CHAMP}
    />
  );
}

/**
 * Choix d'un **rattachement** dans une liste ouverte (autorité coutumière,
 * opérateur, famille).
 *
 * Ici le menu natif est le bon outil, là où `Pastilles` ne l'était pas : ces
 * listes comptent des dizaines d'entrées et ne portent aucune portée juridique
 * — c'est une identité qu'on désigne, pas une qualité qu'on qualifie. Le
 * déroulant natif apporte en prime la recherche au clavier de l'OS, que des
 * pastilles n'auraient pas.
 */
export function Selection({
  value,
  onChange,
  options,
  vide,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; nom: string }[];
  /** Libellé du choix « rien » — l'absence de rattachement est légitime. */
  vide: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={CLASSE_CHAMP}
      disabled={options.length === 0}
    >
      <option value="">{options.length === 0 ? "Liste indisponible" : vide}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nom}
        </option>
      ))}
    </select>
  );
}

/**
 * Choix parmi quelques valeurs closes, en pastilles plutôt qu'en `<select>` :
 * un menu déroulant natif masque les options tant qu'on ne l'ouvre pas, or le
 * type d'attributaire ou la qualité d'une attribution changent la portée
 * juridique de l'acte — cela se lit avant de choisir, pas après.
 */
export function Pastilles<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const actif = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={actif}
            className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
              actif
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border-strong bg-card text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Bascule à deux positions (créer / corriger, libre / attribué…). */
export function Bascule<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full border border-border bg-inset p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors ${
            value === o.value ? "bg-card text-foreground shadow-panel" : "text-muted-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ChampRecherche({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-inset px-3.5 py-2.5">
      <Search className="size-4 flex-none text-muted-2" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none"
      />
    </div>
  );
}

/** Ligne de liste sélectionnable (lotissement, attributaire, lot…). */
export function LigneChoix({
  titre,
  detail,
  onClick,
}: {
  titre: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-border px-1 py-3 text-left last:border-b-0"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-foreground">{titre}</span>
        {detail && <span className="block truncate text-[11.5px] text-muted-foreground">{detail}</span>}
      </span>
      <ChevronRight className="size-4 flex-none text-muted-2" />
    </button>
  );
}

/**
 * Choix d'un lotissement dans la liste déjà chargée par `useSaisieRegistre`.
 *
 * Partagé par « Attribuer un lot » et « Fiche de lotissement », qui commencent
 * tous deux par cette question. Le filtre est purement local : la liste tient en
 * mémoire (une centaine d'entrées), la refiltrer côté serveur ferait payer un
 * aller-retour réseau par lettre tapée.
 */
export function ChoixLotissement({
  lotissements,
  onChoisir,
  loading,
  erreur,
}: {
  lotissements: { id: string; nom: string; village: string | null; commune: string | null }[];
  onChoisir: (id: string) => void;
  loading: boolean;
  erreur: string | null;
}) {
  const [filtre, setFiltre] = useState("");
  const motif = filtre.trim().toLowerCase();
  const visibles = motif
    ? lotissements.filter((l) => l.nom.toLowerCase().includes(motif))
    : lotissements;

  if (erreur) return <Avertissement>Liste des lotissements illisible : {erreur}</Avertissement>;
  if (loading) return <Chargement texte="Chargement des lotissements…" />;

  return (
    <>
      <ChampRecherche value={filtre} onChange={setFiltre} placeholder="Nom du lotissement…" />
      <div className="mt-3 rounded-[18px] border border-border bg-card px-3 shadow-panel">
        {visibles.length === 0 ? (
          <div className="px-4 py-10 text-center text-[12.5px] text-muted-foreground">
            Aucun lotissement ne porte ce nom.
          </div>
        ) : (
          // Bornée : au-delà, la liste ne se parcourt plus au pouce, c'est le
          // filtre qui doit affiner — même règle que la recherche serveur.
          visibles.slice(0, 30).map((l) => (
            <LigneChoix
              key={l.id}
              titre={l.nom}
              detail={[l.village, l.commune].filter(Boolean).join(" · ") || undefined}
              onClick={() => onChoisir(l.id)}
            />
          ))
        )}
      </div>
      {visibles.length > 30 && (
        <p className="mt-2 px-1 text-[11.5px] text-muted-foreground">
          {visibles.length - 30} autre{visibles.length - 30 > 1 ? "s" : ""} au-delà des 30 premiers —
          affinez la recherche.
        </p>
      )}
    </>
  );
}

/**
 * Le rappel qui justifie l'existence même de ces écrans : depuis le téléphone,
 * **personne** n'écrit dans le registre — pas même un administrateur. Affiché
 * en haut de chaque formulaire, avant qu'on ait tapé quoi que ce soit.
 */
export function RappelFile({ children }: { children?: ReactNode }) {
  return (
    <div className="mb-4 flex gap-2.5 rounded-2xl border border-accent/40 bg-accent-subtle px-3.5 py-3">
      <Info className="mt-px size-4 flex-none text-accent" strokeWidth={2} />
      <div className="min-w-0 text-[12px] leading-relaxed text-foreground">
        {children ?? (
          <>
            Cette saisie part dans la <b>file de validation</b>. Rien n&apos;est écrit dans le
            registre tant qu&apos;un administrateur ne l&apos;a pas approuvée.
          </>
        )}
      </div>
    </div>
  );
}

/** Avertissement de contexte (portée limitée d'un écran, doublon probable…). */
export function Avertissement({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-2xl border border-warning/45 bg-warning-subtle px-3.5 py-3">
      <TriangleAlert className="mt-px size-4 flex-none text-warning" strokeWidth={2} />
      <div className="min-w-0 text-[12px] leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

/**
 * Échec d'envoi. Le message de la base est repris **tel quel** : « Action
 * réservée aux opérateurs de saisie » ou « Type de soumission invalide » disent
 * précisément ce qui bloque, là où un message maison ne dirait que « erreur ».
 */
export function EchecEnvoi({ erreur, aide }: { erreur: string; aide?: ReactNode }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger/45 bg-danger-subtle px-3.5 py-3">
      <div className="flex gap-2.5">
        <TriangleAlert className="mt-px size-4 flex-none text-danger" strokeWidth={2} />
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-foreground">Rien n&apos;a été envoyé.</div>
          <div className="mt-1 text-[11.5px] leading-snug break-words text-foreground opacity-90">{erreur}</div>
          {aide && <div className="mt-2 text-[11.5px] leading-snug text-muted-foreground">{aide}</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * Confirmation après envoi.
 *
 * Écran plein et non simple toast : la distinction « envoyé » / « appliqué »
 * est exactement celle que le maker-checker impose et que l'utilisateur risque
 * de ne pas faire. Un message qui s'efface en trois secondes laisserait croire
 * que le registre a changé.
 */
export function EnvoiConfirme({
  titre,
  onBack,
  recapitulatif,
  onNouvelle,
}: {
  titre: string;
  onBack: () => void;
  recapitulatif: string;
  onNouvelle: () => void;
}) {
  return (
    <EcranSaisie
      titre={titre}
      sousTitre="En attente de validation"
      onBack={onBack}
      action={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNouvelle}
            className="flex-1 rounded-full border border-border-strong bg-card py-3 text-[14.5px] font-semibold text-foreground"
          >
            Nouvelle saisie
          </button>
          <button
            type="button"
            onClick={onBack}
            className="flex-1 rounded-full bg-primary py-3 text-[14.5px] font-semibold text-primary-foreground"
          >
            Terminer
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-3 px-2 pt-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-success-subtle">
          <CheckCircle2 className="size-8 text-success" strokeWidth={1.9} />
        </span>
        <div className="text-[17px] font-bold text-foreground">Envoyé en validation</div>
        <div className="text-[13px] leading-relaxed text-foreground">{recapitulatif}</div>
      </div>

      <div className="mt-6 rounded-2xl border border-warning/45 bg-warning-subtle px-3.5 py-3">
        <div className="flex gap-2.5">
          <TriangleAlert className="mt-px size-4 flex-none text-warning" strokeWidth={2} />
          <div className="min-w-0 text-[12px] leading-relaxed text-foreground">
            {/* `{" "}` explicite : le transpileur JSX supprime l'espace qui ouvre
                un nœud de texte suivant une balise, et « appliqué.Le registre »
                se lit mal — sur la phrase qui porte tout le maker-checker. */}
            <b>Rien n&apos;est encore appliqué.</b>{" "}
            Le registre ne changera qu&apos;après approbation
            dans « À faire → Saisies à valider ». D&apos;ici là, la fiche reste telle qu&apos;elle
            était.
          </div>
        </div>
      </div>
    </EcranSaisie>
  );
}

/** Bouton d'envoi unique, toujours au même endroit, toujours le même libellé. */
export function BoutonEnvoyer({
  onClick,
  disabled,
  enCours,
  libelle = "Envoyer en validation",
}: {
  onClick: () => void;
  disabled: boolean;
  enCours: boolean;
  libelle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || enCours}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground disabled:opacity-50"
    >
      {enCours ? <Loader2 className="size-[18px] animate-spin" /> : <Send className="size-[18px]" />}
      {enCours ? "Envoi…" : libelle}
    </button>
  );
}

export function Chargement({ texte }: { texte: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {texte}
    </div>
  );
}

export type Envoi = {
  enCours: boolean;
  erreur: string | null;
  /** Récapitulatif affiché par `EnvoiConfirme`, `null` tant que rien n'est parti. */
  confirme: string | null;
  envoyer: (envoi: EnvoiSaisie, recapitulatif: string) => Promise<void>;
  reprendre: () => void;
  oublierErreur: () => void;
};

/**
 * Machine d'envoi partagée par les quatre formulaires.
 *
 * Un échec **ne quitte pas** le formulaire : ce qui a été tapé au pouce est
 * précisément ce qu'on ne peut pas se permettre de perdre, et l'erreur la plus
 * probable ici (droits, type de soumission non déployé) se corrige côté serveur,
 * pas côté saisie. On repropose donc le même envoi tel quel.
 */
export function useEnvoi(soumettre: (e: EnvoiSaisie) => Promise<Resultat<string>>): Envoi {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirme, setConfirme] = useState<string | null>(null);

  const envoyer = async (envoi: EnvoiSaisie, recapitulatif: string) => {
    if (enCours) return;
    setEnCours(true);
    setErreur(null);
    const res = await soumettre(envoi);
    setEnCours(false);
    if (!res.ok) {
      setErreur(res.error);
      return;
    }
    setConfirme(recapitulatif);
  };

  return {
    enCours,
    erreur,
    confirme,
    envoyer,
    reprendre: () => {
      setConfirme(null);
      setErreur(null);
    },
    oublierErreur: () => setErreur(null),
  };
}

/**
 * Aide affichée quand la base refuse un type de soumission.
 *
 * Née d'un décalage réel : `maj_attributaire` a été construit côté app avant que
 * sa migration ne soit exécutée. Elle l'est depuis — vérifié en production le
 * 26/07/2026, la contrainte de type énumère les cinq types. La note reste
 * néanmoins : le même décalage se reproduira au prochain type de soumission, et
 * sans elle l'utilisateur lit un message serveur exact mais illisible pour lui
 * et conclut à une panne de l'application.
 */
export function aideTypeInvalide(erreur: string): ReactNode {
  if (!/type de soumission invalide/i.test(erreur)) return undefined;
  return (
    <>
      Ce type de saisie n&apos;est pas encore activé sur le serveur. La migration
      correspondante doit être exécutée avant que l&apos;écran puisse envoyer quoi que ce
      soit — l&apos;application, elle, fonctionne.
    </>
  );
}
