"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ds/button";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ds/dialog";
import { Field } from "@/components/ds/label";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ds/select";

/**
 * Coquille commune des formulaires en boîte de dialogue du dashboard.
 *
 * Chaque écran legacy portait ses propres modales, recopiées les unes des
 * autres — quatre rien que sur le registre des Lots. Les factoriser garantit
 * qu'un correctif d'ergonomie (fermeture au clavier, ordre des boutons, place
 * du message d'erreur) profite à toutes d'un coup, au lieu d'être appliqué
 * vingt fois et oublié deux.
 */
export function ModaleFormulaire({
  surTitre, surTitreTon = "accent", titre, description, entete, children,
  onClose, onSubmit, error, isSubmitting, actionDesactivee, variante = "primary",
  libelleAction, libelleEnCours, largeur,
}: {
  surTitre: string;
  surTitreTon?: "accent" | "danger";
  titre: string;
  description?: string;
  /** Bloc affiché avant les champs (rappel de contexte, aperçu de tarif…). */
  entete?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  error: string | null;
  isSubmitting: boolean;
  actionDesactivee?: boolean;
  variante?: "primary" | "danger";
  libelleAction: string;
  libelleEnCours: string;
  /** Classe de largeur, ex. "max-w-2xl". Par défaut celle de `DialogContent`. */
  largeur?: string;
}) {
  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className={largeur}>
        <DialogHeader>
          <p className={`text-[11px] font-bold tracking-[0.18em] uppercase ${
            surTitreTon === "danger" ? "text-danger" : "text-accent"
          }`}>
            {surTitre}
          </p>
          <DialogTitle>{titre}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <DialogBody className="space-y-4">
            {entete}
            {children}
            {error && (
              <p role="alert" className="rounded-xl border border-danger/25 bg-danger-subtle px-3 py-2 text-sm font-medium text-danger">
                {error}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" variant={variante} loading={isSubmitting} disabled={actionDesactivee}>
              {isSubmitting ? libelleEnCours : libelleAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Champ « liste déroulante » : `Field` + `Select` du DS, espacement homogène. */
export function ChampSelect({ id, label, value, onChange, required, placeholder, children }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <Field label={label} htmlFor={id} required={required}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder ?? "— Sélectionner —"} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </Field>
  );
}

export function CaseACocher({ checked, onChange, children }: {
  checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-border bg-inset px-4 py-3 text-sm text-foreground transition-colors hover:border-border-strong">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-border"
        // `accent-color` en jeton : la case native suit le thème sans qu'on ait
        // à la reconstruire en div.
        style={{ accentColor: "var(--primary)" }}
      />
      {children}
    </label>
  );
}

export function Avertissement({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning-subtle p-3">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p className="text-xs text-warning">{children}</p>
    </div>
  );
}
