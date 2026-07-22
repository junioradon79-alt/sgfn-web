"use client";

import { useCallback, useMemo, useState } from "react";
import { Gavel, Plus, Search, Building } from "lucide-react";

import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ds/dialog";
import { EmptyState } from "@/components/ds/empty-state";
import { Input } from "@/components/ds/input";
import { Field } from "@/components/ds/label";
import { createClient } from "@/utils/supabase/client";
import { useChargement } from "@/hooks/useChargement";

/**
 * Référentiels métier : opérateurs et commissaires de justice.
 *
 * Comble un manque relevé le 22/07. `operateurs` n'avait que deux lectures dans
 * toute l'application et aucune écriture ; `commissaires_justice` était
 * **totalement absente du front** — zéro lecture, zéro écriture — alors que
 * `profiles.commissaire_id` et `lotissements.pv_commissaire_justice_id` y
 * renvoient. Ces deux entités ne pouvaient donc naître qu'en SQL, ce qui
 * bloquait l'onboarding d'un nouveau territoire (Phase 2).
 *
 * Aucune migration : les policies `operateurs_admin_all` et
 * `commissaires_admin_all` (`est_admin()`) autorisaient déjà l'écriture. Seul
 * l'écran manquait. La RLS reste l'autorité — un non-admin qui atteindrait ces
 * formulaires se verrait refuser l'insertion par la base, et le message d'erreur
 * de Supabase est affiché tel quel.
 */

type Operateur = { id: string; nom: string; type: string | null; contact: string | null };
type Commissaire = { id: string; nom: string; etude: string | null; ressort: string | null; contact: string | null };

export function ReferentielsPanel() {
  const supabase = useMemo(() => createClient(), []);

  const [operateurs, setOperateurs] = useState<Operateur[]>([]);
  const [commissaires, setCommissaires] = useState<Commissaire[]>([]);
  const [recherche, setRecherche] = useState("");
  const [modale, setModale] = useState<"operateur" | "commissaire" | null>(null);

  const charger = useCallback(async () => {
    const [ops, cjs] = await Promise.all([
      supabase.from("operateurs").select("id, nom, type, contact").order("nom"),
      supabase.from("commissaires_justice").select("id, nom, etude, ressort, contact").order("nom"),
    ]);
    setOperateurs((ops.data ?? []) as Operateur[]);
    setCommissaires((cjs.data ?? []) as Commissaire[]);
  }, [supabase]);

  const { isLoading: loading, recharger } = useChargement(charger, [charger]);

  const q = recherche.trim().toLowerCase();
  const opsFiltres = operateurs.filter((o) => !q || [o.nom, o.type, o.contact].some((v) => v?.toLowerCase().includes(q)));
  const cjsFiltres = commissaires.filter(
    (c) => !q || [c.nom, c.etude, c.ressort, c.contact].some((v) => v?.toLowerCase().includes(q)),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="relative w-full max-w-sm print:hidden">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          placeholder="Rechercher un opérateur ou un commissaire…"
          className="pl-9"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          aria-label="Rechercher dans les référentiels"
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2 xl:items-start">
        {/* ── Opérateurs ─────────────────────────────────────────────────── */}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border px-5 py-4">
            <Building className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold text-foreground">Opérateurs ({operateurs.length})</h2>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto shrink-0 print:hidden"
              onClick={() => setModale("operateur")}
            >
              <Plus className="size-4" />
              Nouveau
            </Button>
          </div>
          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : opsFiltres.length === 0 ? (
            <EmptyState
              icon={Building}
              title={q ? "Aucun résultat" : "Aucun opérateur enregistré"}
              description={
                q
                  ? `Aucun opérateur ne correspond à « ${recherche} ».`
                  : "Un opérateur aménage et commercialise un lotissement ; un compte utilisateur s'y rattache ensuite."
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {opsFiltres.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{o.nom}</p>
                    <p className="truncate text-xs text-muted-foreground">{o.contact ?? "—"}</p>
                  </div>
                  {o.type && <Badge className="shrink-0">{o.type}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── Commissaires de justice ────────────────────────────────────── */}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border px-5 py-4">
            <Gavel className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold text-foreground">Commissaires de justice ({commissaires.length})</h2>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto shrink-0 print:hidden"
              onClick={() => setModale("commissaire")}
            >
              <Plus className="size-4" />
              Nouveau
            </Button>
          </div>
          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : cjsFiltres.length === 0 ? (
            <EmptyState
              icon={Gavel}
              title={q ? "Aucun résultat" : "Aucun commissaire enregistré"}
              description={
                q
                  ? `Aucun commissaire ne correspond à « ${recherche} ».`
                  : "Le commissaire de justice signe les PV d'identification physique rattachés à un lotissement."
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {cjsFiltres.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{c.nom}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.etude, c.contact].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  {c.ressort && <Badge className="shrink-0">{c.ressort}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {modale === "operateur" && (
        <CreerReferentielModal
          titre="Créer un opérateur"
          surtitre="Nouvel opérateur"
          table="operateurs"
          champs={[
            { cle: "nom", label: "Nom", requis: true, placeholder: "Ex : SGNF Aménagement" },
            { cle: "type", label: "Type", placeholder: "Ex : aménageur, promoteur…" },
            { cle: "contact", label: "Contact", placeholder: "Téléphone ou courriel" },
          ]}
          onClose={() => setModale(null)}
          onSuccess={() => { setModale(null); void recharger(); }}
        />
      )}

      {modale === "commissaire" && (
        <CreerReferentielModal
          titre="Créer un commissaire de justice"
          surtitre="Nouveau commissaire"
          table="commissaires_justice"
          champs={[
            { cle: "nom", label: "Nom", requis: true, placeholder: "Ex : Maître Kouamé" },
            { cle: "etude", label: "Étude", placeholder: "Ex : Étude Kouamé & Associés" },
            { cle: "ressort", label: "Ressort", placeholder: "Ex : Tribunal d'Abidjan" },
            { cle: "contact", label: "Contact", placeholder: "Téléphone ou courriel" },
          ]}
          onClose={() => setModale(null)}
          onSuccess={() => { setModale(null); void recharger(); }}
        />
      )}
    </div>
  );
}

// ─── Modale générique ────────────────────────────────────────────────────────

type Champ = { cle: string; label: string; requis?: boolean; placeholder?: string };

/**
 * Une seule modale pour les deux référentiels : ils ont la même forme (un nom
 * obligatoire, des champs libres facultatifs). Deux composants jumeaux auraient
 * divergé à la première retouche.
 */
function CreerReferentielModal({
  titre,
  surtitre,
  table,
  champs,
  onClose,
  onSuccess,
}: {
  titre: string;
  surtitre: string;
  table: "operateurs" | "commissaires_justice";
  champs: Champ[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState("");

  const enregistrer = async () => {
    const manquant = champs.find((c) => c.requis && !valeurs[c.cle]?.trim());
    if (manquant) { setErreur(`Le champ « ${manquant.label} » est requis.`); return; }

    setSaving(true);
    setErreur("");

    // Les champs laissés vides partent à NULL plutôt qu'en chaîne vide : une
    // recherche sur « contact renseigné » ne doit pas remonter des blancs.
    const v = (cle: string) => valeurs[cle]?.trim() || null;
    const nom = valeurs.nom.trim();

    // Insertion explicite par table plutôt qu'un objet construit dynamiquement :
    // le client Supabase est typé par table, et un objet à index générique le
    // ferait échouer — un cast l'aurait tu, au prix de la vérification.
    const { error } =
      table === "operateurs"
        ? await supabase.from("operateurs").insert({ nom, type: v("type"), contact: v("contact") })
        : await supabase
            .from("commissaires_justice")
            .insert({ nom, etude: v("etude"), ressort: v("ressort"), contact: v("contact") });

    if (error) { setErreur(error.message); setSaving(false); return; }
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">{surtitre}</p>
          <DialogTitle>{titre}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {champs.map((c, i) => (
            <Field key={c.cle} label={c.label} htmlFor={`ref-${c.cle}`} required={c.requis}>
              <Input
                id={`ref-${c.cle}`}
                autoFocus={i === 0}
                placeholder={c.placeholder}
                value={valeurs[c.cle] ?? ""}
                onChange={(e) => setValeurs((v) => ({ ...v, [c.cle]: e.target.value }))}
              />
            </Field>
          ))}
          {erreur && <p role="alert" className="text-sm font-medium text-danger">{erreur}</p>}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="button" variant="primary" loading={saving} onClick={enregistrer}>
            {saving ? "Création…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
