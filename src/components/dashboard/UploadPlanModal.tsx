"use client";

import { useEffect, useMemo, useState } from "react";
import { Upload, Loader2, Search, CheckCircle2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ds/button";
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ds/dialog";
import { Field } from "@/components/ds/label";
import { Input } from "@/components/ds/input";
import { createClient } from "@/utils/supabase/client";

type LotOption = {
  id: string;
  numero_lot: string | null;
  ilots: { numero: string | null; lotissements: { nom: string | null } | null } | null;
};

type Step = "form" | "envoi" | "conversion" | "succes" | "erreur";

export default function UploadPlanModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [lots, setLots] = useState<LotOption[]>([]);
  const [search, setSearch] = useState("");
  const [lotId, setLotId] = useState<string | null>(null);
  const [titre, setTitre] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [message, setMessage] = useState<string | null>(null);

  /**
   * Aucun filtre sur les lots — et c'est délibéré, contrairement aux
   * apparences (un géomètre voit ici les 898 lots du registre).
   *
   * Le resserrement de la dette #33 (migration 20260809100000) borne la
   * LECTURE d'un `plan_lot` à « celui que j'ai déposé » OU « un lot sur
   * lequel je porte une mission », mais son prédicat de DÉPÔT se réduit,
   * par algèbre, à « type `plan_lot`, déposé en mon propre nom » : la
   * branche « mission » y est absorbée (X ∧ (X ∨ Y) ≡ X). La base
   * accepte donc bien un dépôt sur n'importe quel lot, et cette liste ne
   * ment pas sur ce qui est permis.
   *
   * 🔴 Ne PAS « corriger » cet écran en le filtrant sur
   * `missions_geometre` : cette table est VIDE en production, la liste
   * tomberait à 0 lot et le téléversement deviendrait impossible, y
   * compris pour le compte de démonstration. Le jour où l'on décide de
   * borner le dépôt aux missions, la base doit être resserrée D'ABORD
   * (une ligne, documentée au §5 de la migration) et cet écran suivra.
   */
  useEffect(() => {
    supabase
      .from("lots")
      .select("id, numero_lot, ilots(numero, lotissements(nom))")
      .order("numero_lot")
      .then(({ data }) => setLots((data as unknown as LotOption[]) ?? []));
  }, [supabase]);

  const filtered = lots.filter((l) => {
    const q = search.toLowerCase();
    return !q || (l.numero_lot ?? "").toLowerCase().includes(q);
  }).slice(0, 50);

  const lotChoisi = lots.find((l) => l.id === lotId) ?? null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && !/\.dxf$/i.test(f.name)) {
      setMessage("Seul le format .dxf est accepté.");
      setFile(null);
      return;
    }
    setMessage(null);
    setFile(f);
  };

  const soumettre = async () => {
    if (!lotId || !file) return;
    setStep("envoi");
    setMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié.");

      const id = crypto.randomUUID();
      const chemin = `plans-cad/${id}/original.dxf`;

      // 🔴 L'ORDRE EST INVERSÉ DEPUIS LE 09/08 : la LIGNE d'abord, le
      // BINAIRE ensuite. Ce n'est pas une préférence de style, la policy
      // storage `documents_plans_cad_upload` l'exige : depuis la
      // migration 20260809100000, un objet ne peut atterrir sous
      // `plans-cad/` que si une ligne `documents` de type `plan_lot`
      // déposée par l'appelant déclare EXACTEMENT ce chemin dans
      // `url_fichier`. Envoyer le fichier en premier le ferait refuser.
      //
      // Bénéfice second, et il est mesuré : dans l'ancien ordre, un
      // insert refusé laissait le binaire déjà envoyé dans le bucket
      // privé, invisible et sans propriétaire logique — 4 des 7 objets
      // de `plans-cad/` sont exactement cela. Ce cas ne peut plus se
      // produire.
      const { error: insertErr } = await supabase.from("documents").insert({
        id,
        type: "plan_lot",
        lot_id: lotId,
        titre: titre.trim() || file.name,
        url_fichier: chemin,
        // Contraint en base depuis le 09/08 (`televerse_par = auth.uid()`
        // dans le `with check`) : ce champ n'est plus une déclaration du
        // client, c'est une signature. Y mettre l'identifiant d'un tiers
        // fait refuser l'écriture.
        televerse_par: user.id,
      });
      if (insertErr) {
        throw new Error(
          `Le dépôt du plan a été refusé : ${insertErr.message}`
        );
      }

      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(chemin, file);
      // La fiche existe déjà à ce stade. On ne tente PAS de la supprimer :
      // aucun rôle hors admin n'a le DELETE sur `documents` (délibéré — un
      // plan sur lequel une chefferie s'appuie ne doit pas pouvoir être
      // effacé par son déposant), un `.delete()` ici ne toucherait 0 ligne
      // en annonçant un succès. On nomme donc la fiche incomplète, pour
      // qu'un administrateur puisse la retirer.
      if (uploadErr) {
        throw new Error(
          `La fiche du plan a bien été enregistrée, mais l'envoi du fichier a échoué (${uploadErr.message}). ` +
            `La fiche ${id} reste incomplète : signalez-la à un administrateur, puis recommencez le dépôt.`
        );
      }

      setStep("conversion");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/convertir-plan-cad`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ document_id: id }),
        }
      );
      const json = await res.json();

      if (!json.ok) {
        setMessage(json.erreur ?? "La conversion a échoué, le plan original reste téléchargeable.");
        setStep("succes");
      } else {
        setStep("succes");
      }

      onUploaded();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Une erreur est survenue.");
      setStep("erreur");
    }
  };

  const enCours = step === "envoi" || step === "conversion";

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert && !enCours) onClose(); }}>
      <DialogContent showClose={!enCours}>
        <DialogHeader>
          <DialogTitle>Téléverser un plan</DialogTitle>
          <DialogDescription>
            Fichier AutoCAD au format DXF rattaché à un lot. Le dépôt est enregistré à votre nom.
          </DialogDescription>
        </DialogHeader>

        {step === "succes" ? (
          <DialogBody className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-success" />
            <p className="text-sm font-semibold text-foreground">Plan téléversé</p>
            {message && <p className="mt-2 text-xs text-warning">{message}</p>}
            <Button type="button" variant="primary" className="mt-5" onClick={onClose}>
              Fermer
            </Button>
          </DialogBody>
        ) : (
          <>
            <DialogBody className="space-y-4">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1 text-[13px] font-semibold text-foreground">
                  Lot concerné <span className="text-danger" aria-hidden>*</span>
                </label>
                {lotChoisi ? (
                  <div className="flex items-center justify-between rounded-md border border-accent/30 bg-accent-subtle px-3 py-2.5 text-sm">
                    <span className="text-foreground">
                      Lot {lotChoisi.numero_lot ?? "—"}
                      {lotChoisi.ilots?.numero ? ` · Îlot ${lotChoisi.ilots.numero}` : ""}
                      {lotChoisi.ilots?.lotissements?.nom ? ` · ${lotChoisi.ilots.lotissements.nom}` : ""}
                    </span>
                    {!enCours && (
                      <button type="button" onClick={() => setLotId(null)} className="text-xs font-semibold text-accent hover:underline">
                        Changer
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
                      <Input
                        placeholder="Rechercher un numéro de lot…"
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border">
                      {filtered.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-muted-2">Aucun lot trouvé.</p>
                      ) : (
                        filtered.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => setLotId(l.id)}
                            className="flex w-full items-center justify-between border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-inset"
                          >
                            <span className="text-foreground">
                              Lot {l.numero_lot ?? "—"}
                              {l.ilots?.numero ? ` · Îlot ${l.ilots.numero}` : ""}
                            </span>
                            {l.ilots?.lotissements?.nom && (
                              <span className="text-xs text-muted-2">{l.ilots.lotissements.nom}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              <Field label="Titre (optionnel)" htmlFor="plan-titre">
                <Input
                  id="plan-titre"
                  placeholder="Plan de bornage — lot 42"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  disabled={enCours}
                />
              </Field>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1 text-[13px] font-semibold text-foreground">
                  Fichier .dxf <span className="text-danger" aria-hidden>*</span>
                </label>
                <input
                  type="file"
                  accept=".dxf"
                  onChange={handleFile}
                  disabled={enCours}
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-accent hover:file:bg-accent/20"
                />
              </div>

              {message && (
                <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-danger">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {message}
                </p>
              )}
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={enCours}>
                Annuler
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={soumettre}
                disabled={enCours || !lotId || !file}
              >
                {enCours ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {step === "envoi" ? "Envoi…" : "Conversion en cours…"}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Téléverser
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
