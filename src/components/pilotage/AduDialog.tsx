"use client";

import * as React from "react";

import { createClient } from "@/utils/supabase/client";
import type { Database } from "../../../database.types";
import { Button } from "@/components/ds/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ds/dialog";
import { Field } from "@/components/ds/label";
import { Input, Textarea } from "@/components/ds/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ds/select";

type DossierAduInsert = Database["public"]["Tables"]["dossiers_adu"]["Insert"];
type StatutAdu = Database["public"]["Enums"]["statut_dossier_adu"];

type LotOption = {
  id: string;
  numero_lot: string | null;
  ilots?: { numero: string | null; lotissements?: { nom: string | null } | null } | null;
};

export const STATUT_ADU_LABELS: Record<string, string> = {
  en_preparation: "En préparation",
  piece_manquante: "Pièce manquante",
  depose: "Déposé",
  en_instruction: "En instruction",
  adu_delivree: "ADU délivrée",
  acd_obtenu: "ACD obtenu",
  rejete: "Rejeté",
};

const VIDE = { lot_id: "", statut: "en_preparation" as StatutAdu, adu_numero: "", depose_le: "", notes: "" };

/**
 * Création d'un dossier ADU.
 *
 * Reprise à l'identique du formulaire historique (mêmes champs, même insertion,
 * même `cree_par`) : la refonte est visuelle et structurelle, elle ne touche pas
 * au métier. Seule la liste des lots est désormais chargée à l'ouverture de la
 * modale plutôt qu'avec la page.
 */
export function AduDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [lots, setLots] = React.useState<LotOption[]>([]);
  const [form, setForm] = React.useState(VIDE);
  const [envoi, setEnvoi] = React.useState(false);
  const [erreur, setErreur] = React.useState<string | null>(null);

  // Les lots ne sont chargés qu'à la première ouverture — 200 lignes qu'on ne
  // fait pas payer à l'affichage initial du dashboard.
  React.useEffect(() => {
    if (!open || lots.length > 0) return;
    void (async () => {
      const { data } = await supabase
        .from("lots")
        .select("id, numero_lot, ilots(numero, lotissements(nom))")
        .order("numero_lot")
        .limit(200);
      setLots((data ?? []) as unknown as LotOption[]);
    })();
  }, [open, lots.length, supabase]);

  // Le formulaire se vide à la *fermeture*, quel qu'en soit le chemin (Échap,
  // clic hors modale, Annuler, envoi réussi) — un effet de remise à zéro sur
  // `open` provoquerait un rendu de plus à chaque ouverture.
  const fermer = React.useCallback(
    (v: boolean) => {
      if (!v) {
        setForm(VIDE);
        setErreur(null);
      }
      onOpenChange(v);
    },
    [onOpenChange],
  );

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lot_id) {
      setErreur("Sélectionnez un lot.");
      return;
    }
    setEnvoi(true);
    setErreur(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload: DossierAduInsert = {
      lot_id: form.lot_id,
      statut: form.statut,
      adu_numero: form.adu_numero.trim() || null,
      depose_le: form.depose_le || null,
      notes: form.notes.trim() || null,
      cree_par: user?.id ?? null,
    };

    const { error } = await supabase.from("dossiers_adu").insert([payload]);
    setEnvoi(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    fermer(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={fermer}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau dossier ADU</DialogTitle>
          <DialogDescription>Instruction foncière — arrêté de disposition d&apos;urbanisme.</DialogDescription>
        </DialogHeader>

        <form onSubmit={soumettre}>
          <DialogBody className="space-y-4">
            <Field label="Lot concerné" htmlFor="adu-lot" required error={erreur && !form.lot_id ? erreur : null}>
              <Select value={form.lot_id} onValueChange={(v) => setForm((f) => ({ ...f, lot_id: v }))}>
                <SelectTrigger id="adu-lot">
                  <SelectValue placeholder="Sélectionner un lot…" />
                </SelectTrigger>
                <SelectContent>
                  {lots.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      Lot {l.numero_lot ?? "—"}
                      {l.ilots?.numero ? ` · Îlot ${l.ilots.numero}` : ""}
                      {l.ilots?.lotissements?.nom ? ` — ${l.ilots.lotissements.nom}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Statut" htmlFor="adu-statut">
                <Select
                  value={form.statut}
                  onValueChange={(v) => setForm((f) => ({ ...f, statut: v as StatutAdu }))}
                >
                  <SelectTrigger id="adu-statut">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUT_ADU_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Date de dépôt" htmlFor="adu-date">
                <Input
                  id="adu-date"
                  type="date"
                  value={form.depose_le}
                  onChange={(e) => setForm((f) => ({ ...f, depose_le: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="Numéro ADU" htmlFor="adu-numero" hint="Laisser vide si le numéro n'est pas encore attribué.">
              <Input
                id="adu-numero"
                value={form.adu_numero}
                onChange={(e) => setForm((f) => ({ ...f, adu_numero: e.target.value }))}
                placeholder="Ex. ADU-2026-001"
              />
            </Field>

            <Field label="Notes" htmlFor="adu-notes">
              <Textarea
                id="adu-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Observations, documents manquants…"
              />
            </Field>

            {erreur && form.lot_id && (
              <p role="alert" className="rounded-lg border border-danger/30 bg-danger-subtle px-3 py-2 text-[13px] text-danger">
                {erreur}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => fermer(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" loading={envoi}>
              {envoi ? "Enregistrement…" : "Créer le dossier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
