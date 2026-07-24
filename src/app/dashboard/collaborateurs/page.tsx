"use client";

import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, Plus, Search, Trash2, UserRoundCheck, UserRoundX, UsersRound } from "lucide-react";

import { fadeUp } from "@/lib/motion";
import { createClient } from "@/utils/supabase/client";
import { useChargement } from "@/hooks/useChargement";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ds/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ds/dialog";
import { EmptyState } from "@/components/ds/empty-state";
import { Field } from "@/components/ds/label";
import { Input } from "@/components/ds/input";
import { Skeleton } from "@/components/ds/skeleton";

/**
 * RH — annuaire simple des collaborateurs internes SGNF (24/07).
 *
 * Périmètre volontairement restreint (décidé avec le user) : identité, poste,
 * contact, date d'entrée, statut actif/inactif. Ni congés, ni paie — table
 * `collaborateurs`, indépendante de `profiles` (un collaborateur n'a pas
 * forcément de compte applicatif). Accès : admin + rôle `comptable`
 * (policies `collaborateurs_gestion`, migration 20260724181000).
 */

type Collaborateur = {
  id: string;
  nom_complet: string;
  poste: string | null;
  service: string | null;
  email: string | null;
  telephone: string | null;
  date_entree: string | null;
  statut: string;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function CollaborateursContenu() {
  const supabase = useMemo(() => createClient(), []);
  const { counts } = useBadgeCounts();

  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([]);
  const [recherche, setRecherche] = useState("");
  const [modaleOuverte, setModaleOuverte] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("collaborateurs")
      .select("id, nom_complet, poste, service, email, telephone, date_entree, statut")
      .order("nom_complet");
    setCollaborateurs((data ?? []) as Collaborateur[]);
  }, [supabase]);

  const { isLoading: loading, recharger } = useChargement(charger, [charger]);

  const q = recherche.trim().toLowerCase();
  const filtres = collaborateurs.filter(
    (c) => !q || [c.nom_complet, c.poste, c.service, c.email, c.telephone].some((v) => v?.toLowerCase().includes(q)),
  );
  const actifs = collaborateurs.filter((c) => c.statut === "actif").length;

  const basculerStatut = async (c: Collaborateur) => {
    await supabase.from("collaborateurs").update({ statut: c.statut === "actif" ? "inactif" : "actif" }).eq("id", c.id);
    void recharger();
  };

  const supprimer = async (c: Collaborateur) => {
    if (!window.confirm(`Retirer ${c.nom_complet} de l'annuaire ? Cette action est définitive.`)) return;
    await supabase.from("collaborateurs").delete().eq("id", c.id);
    void recharger();
  };

  return (
    <AppShell wide loading={loading} counts={counts} onRefresh={recharger}>
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              placeholder="Rechercher un collaborateur…"
              className="pl-9"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              aria-label="Rechercher un collaborateur"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            className="ml-auto shrink-0"
            onClick={() => setModaleOuverte(true)}
          >
            <Plus className="size-4" />
            Nouveau collaborateur
          </Button>
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Collaborateurs</CardTitle>
              <CardDescription>
                {loading
                  ? "Chargement…"
                  : `${collaborateurs.length} collaborateur${collaborateurs.length > 1 ? "s" : ""} · ${actifs} actif${actifs > 1 ? "s" : ""}`}
              </CardDescription>
            </div>
          </CardHeader>

          <div className="px-5 pb-5">
            {loading ? (
              <Skeleton className="h-48" />
            ) : filtres.length === 0 ? (
              <EmptyState
                icon={UsersRound}
                title={q ? "Aucun résultat" : "Aucun collaborateur"}
                description={
                  q
                    ? `Aucun collaborateur ne correspond à « ${recherche} ».`
                    : "Ajoutez le premier membre de l'équipe SGNF."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-bold tracking-wider text-muted-2 uppercase">
                      <th className="pb-2 font-bold">Nom</th>
                      <th className="pb-2 font-bold">Poste</th>
                      <th className="pb-2 font-bold">Service</th>
                      <th className="pb-2 font-bold">Contact</th>
                      <th className="pb-2 font-bold">Entrée</th>
                      <th className="pb-2 text-right font-bold">Statut</th>
                      <th className="pb-2 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtres.map((c) => (
                      <tr key={c.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 font-medium text-foreground">{c.nom_complet}</td>
                        <td className="py-2.5 text-muted-foreground">{c.poste ?? "—"}</td>
                        <td className="py-2.5 text-muted-foreground">{c.service ?? "—"}</td>
                        <td className="py-2.5 text-muted-foreground">
                          <div className="flex flex-col gap-0.5">
                            {c.telephone && (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="size-3" aria-hidden />
                                {c.telephone}
                              </span>
                            )}
                            {c.email && (
                              <span className="inline-flex items-center gap-1">
                                <Mail className="size-3" aria-hidden />
                                {c.email}
                              </span>
                            )}
                            {!c.telephone && !c.email && "—"}
                          </div>
                        </td>
                        <td className="tabular py-2.5 text-muted-2">{formatDate(c.date_entree)}</td>
                        <td className="py-2.5 text-right">
                          <Badge tone={c.statut === "actif" ? "success" : "neutral"}>
                            {c.statut === "actif" ? "Actif" : "Inactif"}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => basculerStatut(c)}
                              title={c.statut === "actif" ? "Marquer inactif" : "Marquer actif"}
                            >
                              {c.statut === "actif" ? (
                                <UserRoundX className="size-4" />
                              ) : (
                                <UserRoundCheck className="size-4" />
                              )}
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => supprimer(c)} title="Retirer">
                              <Trash2 className="size-4 text-danger" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {modaleOuverte && (
        <CollaborateurModal
          onClose={() => setModaleOuverte(false)}
          onSuccess={() => {
            setModaleOuverte(false);
            void recharger();
          }}
        />
      )}
    </AppShell>
  );
}

export default function CollaborateursPage() {
  return <CollaborateursContenu />;
}

// ─── Modale de création ────────────────────────────────────────────────────

function CollaborateurModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [valeurs, setValeurs] = useState({
    nom_complet: "",
    poste: "",
    service: "",
    email: "",
    telephone: "",
    date_entree: "",
  });
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState("");

  const champ = (cle: keyof typeof valeurs) => (e: ChangeEvent<HTMLInputElement>) =>
    setValeurs((v) => ({ ...v, [cle]: e.target.value }));

  const enregistrer = async () => {
    if (!valeurs.nom_complet.trim()) {
      setErreur("Le nom complet est requis.");
      return;
    }
    setSaving(true);
    setErreur("");

    const { error } = await supabase.from("collaborateurs").insert({
      nom_complet: valeurs.nom_complet.trim(),
      poste: valeurs.poste.trim() || null,
      service: valeurs.service.trim() || null,
      email: valeurs.email.trim() || null,
      telephone: valeurs.telephone.trim() || null,
      date_entree: valeurs.date_entree || null,
    });

    if (error) {
      setErreur(error.message);
      setSaving(false);
      return;
    }
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Nouveau</p>
          <DialogTitle>Ajouter un collaborateur</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Nom complet" htmlFor="collab-nom" required>
            <Input
              id="collab-nom"
              autoFocus
              value={valeurs.nom_complet}
              onChange={champ("nom_complet")}
              placeholder="Ex : Awa Koffi"
            />
          </Field>
          <Field label="Poste" htmlFor="collab-poste">
            <Input id="collab-poste" value={valeurs.poste} onChange={champ("poste")} placeholder="Ex : Chargée de clientèle" />
          </Field>
          <Field label="Service" htmlFor="collab-service">
            <Input id="collab-service" value={valeurs.service} onChange={champ("service")} placeholder="Ex : Opérations" />
          </Field>
          <Field label="Téléphone" htmlFor="collab-tel">
            <Input id="collab-tel" value={valeurs.telephone} onChange={champ("telephone")} placeholder="+225…" />
          </Field>
          <Field label="Courriel" htmlFor="collab-email">
            <Input
              id="collab-email"
              type="email"
              value={valeurs.email}
              onChange={champ("email")}
              placeholder="prenom.nom@sgnf.ci"
            />
          </Field>
          <Field label="Date d'entrée" htmlFor="collab-entree">
            <Input id="collab-entree" type="date" value={valeurs.date_entree} onChange={champ("date_entree")} />
          </Field>
          {erreur && (
            <p role="alert" className="text-sm font-medium text-danger">
              {erreur}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" variant="primary" loading={saving} onClick={enregistrer}>
            {saving ? "Ajout…" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
