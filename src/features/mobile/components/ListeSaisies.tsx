"use client";

import { Building2, ChevronRight, Grid2x2, Layers, LandPlot, SquarePen, UserCog } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { EcranSaisie } from "../roles";

// Liste des formulaires de saisie du registre. Extraite de `FilesScreen` quand
// les rôles métier ont eu leur propre écran de saisie : deux surfaces affichent
// désormais ces entrées, et deux copies auraient divergé au premier libellé
// retouché.

/**
 * Les entrées, dans l'ordre de leur fréquence réelle sur le terrain : on
 * constate un changement d'attributaire tous les jours, on crée un lotissement
 * quelques fois par an.
 *
 * ⚠️ « Attribuer un lot » et « Corriger la fiche d'un lot » se ressemblent à
 * la lecture et n'ont rien à voir : le premier déplace la propriété
 * (`maj_attributions`, fermé à la chefferie), le second corrige ce que le
 * registre dit du terrain (`modification_lot`). Les libellés doivent garder
 * cette distinction visible — c'est la seule chose qui empêche une chefferie
 * de chercher longtemps le formulaire qu'elle n'a pas.
 */
const SAISIES: { cle: EcranSaisie; icon: LucideIcon; label: string; detail: string }[] = [
  {
    cle: "lot",
    icon: LandPlot,
    label: "Attribuer un lot",
    detail: "Désigner un attributaire, ou rendre le lot libre",
  },
  {
    cle: "fiche_lot",
    icon: SquarePen,
    label: "Corriger la fiche d'un lot",
    detail: "Superficie, numéro de parcelle, nature du droit, observation",
  },
  {
    cle: "ilot",
    icon: Grid2x2,
    label: "Corriger le numéro d'un îlot",
    detail: "Renuméroter un îlot du lotissement",
  },
  {
    cle: "attributaire",
    icon: UserCog,
    label: "Fiche d'attributaire",
    detail: "Créer une fiche, ou corriger une fiche existante",
  },
  {
    cle: "lotissement",
    icon: Building2,
    label: "Fiche de lotissement",
    detail: "Créer ou corriger la fiche d'un lotissement",
  },
  {
    cle: "structure",
    icon: Layers,
    label: "Nouveau lotissement",
    detail: "Fiche seule, sans îlot ni lot",
  },
];

export function ListeSaisies({
  /** Formulaires à montrer — cf. `saisiesPour(groupe)`, miroir de la garde serveur. */
  ecrans,
  onOuvrir,
}: {
  ecrans: EcranSaisie[];
  onOuvrir: (ecran: EcranSaisie) => void;
}) {
  // L'ordre reste celui de SAISIES (fréquence d'usage) et non celui du tableau
  // reçu : le rôle décide de ce qui s'affiche, pas de la mise en page.
  const visibles = SAISIES.filter((s) => ecrans.includes(s.cle));
  if (visibles.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-border bg-card px-4 shadow-panel">
      {visibles.map((s, i, arr) => {
        const Icon = s.icon;
        return (
          <button
            key={s.cle}
            type="button"
            onClick={() => onOuvrir(s.cle)}
            className={`flex w-full items-center gap-3 py-3 text-left ${
              i < arr.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <span className="flex size-9 flex-none items-center justify-center rounded-xl bg-inset text-primary">
              <Icon className="size-[18px]" strokeWidth={1.9} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold text-foreground">{s.label}</span>
              <span className="block truncate text-[11.5px] text-muted-foreground">{s.detail}</span>
            </span>
            <ChevronRight className="size-4 flex-none text-muted-2" />
          </button>
        );
      })}
    </div>
  );
}
