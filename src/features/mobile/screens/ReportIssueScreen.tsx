"use client";

// Signaler un problème sur une parcelle.
//
// Les objets fréquents sont proposés en pastilles plutôt qu'en saisie libre :
// sur un téléphone, taper au clavier est le principal point d'abandon, et un
// vocabulaire commun (« Bornage contesté » et non « le voisin a bougé la
// borne ») rend les signalements triables par ceux qui les traitent. « Autre »
// ouvre le champ libre pour ne rien perdre de ce qui sort du cadre.
//
// L'erreur d'envoi est affichée telle quelle, sans repli d'aucune sorte : un
// signalement avalé en silence laisserait croire qu'un litige a été porté à la
// connaissance de l'administration.

import { useState } from "react";
import { AlertTriangle, Loader2, Send } from "lucide-react";

import { useRetourFormulaire } from "@/lib/android-back";
import { BarHeader } from "../components/MobileHeader";
import type { Parcelle } from "../data/useMobileData";

/** Dernier choix : bascule vers la saisie libre. */
const AUTRE = "Autre";

const OBJETS = [
  "Occupation illégale",
  "Bornage contesté",
  "Double attribution",
  "Erreur sur mes informations",
  AUTRE,
];

type Props = {
  lotId: string;
  parcelle: Parcelle | null;
  onBack: () => void;
  onSubmit: (lotId: string, objet: string, description: string) => Promise<{ ok: boolean; error?: string }>;
  onDone: () => void;
  /** Sert à prévenir avant d'abandonner une saisie — cf. `useRetourFormulaire`. */
  flash: (msg: string) => void;
};

export function ReportIssueScreen({ lotId, parcelle, onBack, onSubmit, onDone, flash }: Props) {
  const [choix, setChoix] = useState<string | null>(null);
  const [objetLibre, setObjetLibre] = useState("");
  const [description, setDescription] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Objet **dérivé** du couple (pastille, champ libre) : le déduire évite un
  // état de plus à resynchroniser, et donc de poser un état dans un effet.
  const objet = choix === AUTRE ? objetLibre.trim() : (choix ?? "");

  // Tout ce qui serait perdu par un geste de bord : la pastille choisie coûte
  // un tap, la description peut coûter plusieurs centaines de caractères tapés
  // au pouce. On les traite pareil — c'est le fait d'avoir commencé qui compte,
  // pas le volume, et doser la friction au nombre de caractères serait
  // inexplicable à qui la subit.
  const saisieEnCours = !!choix || objetLibre.trim() !== "" || description.trim() !== "";
  useRetourFormulaire(saisieEnCours, () => flash("Appuyez à nouveau pour abandonner ce signalement"));

  const nom = parcelle
    ? `Lot ${parcelle.numeroLot ?? "—"}${parcelle.ilotNumero ? ` · Îlot ${parcelle.ilotNumero}` : ""}`
    : "Cette parcelle";

  const envoyer = async () => {
    if (!objet || envoi) return;
    setEnvoi(true);
    setErreur(null);
    const res = await onSubmit(lotId, objet, description);
    setEnvoi(false);
    if (res.ok) onDone();
    else setErreur(res.error ?? "Le signalement n'a pas pu être transmis.");
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <BarHeader
        onBack={onBack}
        title={
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-foreground">Signaler un problème</div>
            <div className="truncate text-[11.5px] text-muted-foreground">{nom}</div>
          </div>
        }
      />

      <div className="sgnf-scroll flex-1 overflow-y-auto px-[18px] pt-4 pb-6">
        {/* Le texte est en `text-foreground`, pas en `text-warning` : ce dernier
            sur `bg-warning-subtle` mesurait 2,83:1 en thème clair, très en
            dessous d'AA. C'est l'icône qui porte la couleur d'alerte — même
            règle que la primitive `Avertissement` des écrans de saisie, et même
            principe que pour les marqueurs d'obligation : le sens ne repose
            jamais sur la seule couleur. */}
        <div className="flex gap-2.5 rounded-[14px] bg-warning-subtle px-3.5 py-3 text-[12px] leading-snug text-foreground">
          <AlertTriangle className="mt-px size-[18px] flex-none text-warning" strokeWidth={2} />
          <span>
            Votre signalement est transmis à la cellule SGNF, qui vous recontacte. Il ne remplace pas une
            procédure judiciaire.
          </span>
        </div>

        <div className="mt-5 text-[12px] font-semibold text-muted-foreground">De quoi s&apos;agit-il ?</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {OBJETS.map((o) => {
            const actif = choix === o;
            return (
              <button
                key={o}
                type="button"
                onClick={() => setChoix(o)}
                aria-pressed={actif}
                className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  actif
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border-strong bg-card text-foreground"
                }`}
              >
                {o}
              </button>
            );
          })}
        </div>

        {choix === AUTRE && (
          <input
            value={objetLibre}
            onChange={(e) => setObjetLibre(e.target.value)}
            placeholder="Précisez l'objet en quelques mots"
            className="mt-3 w-full rounded-lg border border-border-strong bg-inset px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary"
          />
        )}

        <label className="mt-5 block text-[12px] font-semibold text-muted-foreground">
          Description <span className="font-normal">(facultative)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          placeholder="Dates, personnes concernées, ce que vous avez constaté sur place…"
          className="mt-1.5 w-full resize-none rounded-xl border border-border bg-inset px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground outline-none focus:border-primary"
        />

        {erreur && (
          <div role="alert" className="mt-3 rounded-xl bg-danger-subtle px-3.5 py-3 text-danger">
            <div className="text-[13px] font-semibold">Le signalement n&apos;a pas été transmis.</div>
            <div className="mt-1 text-[11.5px] leading-snug break-words opacity-90">{erreur}</div>
          </div>
        )}
      </div>

      <div className="flex-none border-t border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={() => void envoyer()}
          disabled={envoi || !objet}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {envoi ? <Loader2 className="size-[18px] animate-spin" /> : <Send className="size-[18px]" />}
          {envoi ? "Envoi…" : "Envoyer le signalement"}
        </button>
      </div>
    </div>
  );
}
