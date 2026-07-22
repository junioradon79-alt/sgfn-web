"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users, UserCheck, AlertTriangle, Search, Check,
  UserPlus, ChevronRight, Crown, Landmark, Link2, Unlink, Building2, Plus,
} from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ds/dialog";
import { Field } from "@/components/ds/label";
import { Input } from "@/components/ds/input";
import { BoutonImprimer } from "@/components/dashboard/BoutonImprimer";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";

// ─── Types ────────────────────────────────────────────────────────────────────

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

type ChefProfile = {
  id: string;
  nom_complet: string;
  groupe: string;
  telephone: string | null;
};

type Famille = {
  id: string;
  nom: string;
  chef_de_famille: string | null;
  contact: string | null;
  grande_famille_id: string | null;
  grande_famille: { id: string; nom: string } | null;
  chef_profile_id: string | null;
  chef_profile: ChefProfile | null;
  attributaire_id: string | null;
  collectif: { id: string; nom: string } | null;
  lignee_id: string | null;
  lignee: { id: string; nom: string } | null;
};

type SousLignee = {
  id: string;
  nom: string;
  chef_de_famille: string | null;
  chef_profile_id: string | null;
  chef_profile: { id: string; nom_complet: string } | null;
};

type LigneeInGF = {
  id: string;
  nom: string;
  chef_de_famille: string | null;
  chef_profile_id: string | null;
  chef_profile: { id: string; nom_complet: string } | null;
  sous_lignees: SousLignee[];
};

type GrandeFamille = {
  id: string;
  nom: string;
  description: string | null;
  lignees: LigneeInGF[];
};

type CollectifOption = { id: string; nom: string; nb_lots: number };

type AutoriteCoutumiere = {
  id: string;
  nom: string;
  type: string | null;
  village: string | null;
  chef: string | null;
  chefs_profils: ChefProfile[];
};

type ProfilePicker = {
  id: string;
  nom_complet: string;
  groupe: string;
  telephone: string | null;
  famille_id: string | null;
  autorite_coutumiere_id: string | null;
};

const GROUPE_LABELS: Record<string, string> = {
  chefferie: "Chefferie",
  proprietaire_terrien: "Propriétaire terrien",
  proprietaire: "Propriétaire",
  acquereur: "Acquéreur",
  amenageur: "Aménageur",
  operateur: "Opérateur",
  commissaire: "Commissaire",
  verificateur: "Vérificateur",
  geometre: "Géomètre",
  agent_ia: "Agent IA",
  admin: "Admin",
};

// Ton (Badge DS) par rôle — remplace les couleurs figées (amber-50, teal-50…)
// illisibles sur page sombre. L'étiquette porte le reste de la distinction.
const GROUPE_TONE: Record<string, BadgeTone> = {
  chefferie: "warning",
  proprietaire_terrien: "success",
  proprietaire: "accent",
  admin: "neutral",
};
const groupeTone = (g: string): BadgeTone => GROUPE_TONE[g] ?? "neutral";

// ─── Modal : créer une grande famille ────────────────────────────────────────

function CreerGrandeFamilleModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!nom.trim()) { setError("Le nom est requis."); return; }
    setSaving(true);
    setError("");
    const { error: e } = await supabase
      .from("grandes_familles")
      .insert({ nom: nom.trim(), description: description.trim() || null });
    if (e) { setError(e.message); setSaving(false); return; }
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Nouvelle grande famille</p>
          <DialogTitle>Créer une grande famille</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Nom" htmlFor="gf-nom" required>
            <Input id="gf-nom" autoFocus placeholder="Ex : BEUH, AKE, YAGO…" value={nom} onChange={(e) => setNom(e.target.value)} />
          </Field>
          <Field label="Description (optionnel)" htmlFor="gf-desc">
            <Input id="gf-desc" placeholder="Ex : Grande famille BEUH — Village Ebimpe" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="button" variant="primary" loading={saving} onClick={handleSave}>
            {saving ? "Création…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal : créer une autorité coutumière ───────────────────────────────────

/**
 * Création d'une chefferie.
 *
 * Comble un manque relevé le 22/07 : la table `autorites_coutumieres` n'avait
 * aucun point d'écriture dans l'interface — six lectures, zéro création. Une
 * nouvelle chefferie ne pouvait naître que par un INSERT manuel en base, ce qui
 * bloquait l'onboarding d'un nouveau territoire (Phase 2 du Document
 * Directeur). La policy `autorites_admin_all` autorisait déjà l'écriture à
 * l'admin : il ne manquait que l'écran.
 */
function CreerAutoriteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [nom, setNom] = useState("");
  const [type, setType] = useState("chefferie");
  const [village, setVillage] = useState("");
  const [chef, setChef] = useState("");
  const [contact, setContact] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!nom.trim()) { setError("Le nom est requis."); return; }
    setSaving(true);
    setError("");
    const { error: e } = await supabase.from("autorites_coutumieres").insert({
      nom: nom.trim(),
      type: type.trim() || null,
      village: village.trim() || null,
      chef: chef.trim() || null,
      contact: contact.trim() || null,
    });
    if (e) { setError(e.message); setSaving(false); return; }
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Nouvelle autorité coutumière</p>
          <DialogTitle>Créer une chefferie</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Nom" htmlFor="ac-nom" required>
            <Input id="ac-nom" autoFocus placeholder="Ex : Chefferie d'Ebimpe" value={nom} onChange={(e) => setNom(e.target.value)} />
          </Field>
          <Field label="Type" htmlFor="ac-type">
            <Input id="ac-type" placeholder="Ex : chefferie" value={type} onChange={(e) => setType(e.target.value)} />
          </Field>
          <Field label="Village" htmlFor="ac-village">
            <Input id="ac-village" placeholder="Ex : Ebimpe" value={village} onChange={(e) => setVillage(e.target.value)} />
          </Field>
          <Field label="Chef (nom d'usage)" htmlFor="ac-chef">
            <Input id="ac-chef" placeholder="Ex : Nanan Kouassi" value={chef} onChange={(e) => setChef(e.target.value)} />
          </Field>
          <Field label="Contact" htmlFor="ac-contact">
            <Input id="ac-contact" placeholder="Téléphone ou courriel" value={contact} onChange={(e) => setContact(e.target.value)} />
          </Field>
          <p className="text-xs text-muted-foreground">
            Le compte numérique du chef se crée ensuite depuis « Invitations » : cet écran enregistre l&apos;autorité,
            pas son utilisateur.
          </p>
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="button" variant="primary" loading={saving} onClick={handleSave}>
            {saving ? "Création…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal : créer une famille (lignée) ──────────────────────────────────────

/** Même manque que ci-dessus : `familles` se modifiait et se rattachait, mais ne se créait pas. */
function CreerFamilleModal({
  grandesFamilles,
  onClose,
  onSuccess,
}: {
  grandesFamilles: GrandeFamille[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [nom, setNom] = useState("");
  const [chefDeFamille, setChefDeFamille] = useState("");
  const [contact, setContact] = useState("");
  const [grandeFamilleId, setGrandeFamilleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!nom.trim()) { setError("Le nom est requis."); return; }
    setSaving(true);
    setError("");
    const { error: e } = await supabase.from("familles").insert({
      nom: nom.trim(),
      chef_de_famille: chefDeFamille.trim() || null,
      contact: contact.trim() || null,
      grande_famille_id: grandeFamilleId || null,
    });
    if (e) { setError(e.message); setSaving(false); return; }
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Nouvelle lignée</p>
          <DialogTitle>Créer une famille</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Nom" htmlFor="fa-nom" required>
            <Input id="fa-nom" autoFocus placeholder="Ex : Famille AKO DJEBE" value={nom} onChange={(e) => setNom(e.target.value)} />
          </Field>
          <Field label="Chef de famille (nom d'usage)" htmlFor="fa-chef">
            <Input id="fa-chef" placeholder="Ex : Ncho Ohouo Boniface" value={chefDeFamille} onChange={(e) => setChefDeFamille(e.target.value)} />
          </Field>
          <Field label="Contact" htmlFor="fa-contact">
            <Input id="fa-contact" placeholder="Téléphone ou courriel" value={contact} onChange={(e) => setContact(e.target.value)} />
          </Field>
          <Field label="Grande famille de rattachement" htmlFor="fa-gf">
            <select
              id="fa-gf"
              value={grandeFamilleId}
              onChange={(e) => setGrandeFamilleId(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <option value="">— Aucune pour l&apos;instant —</option>
              {grandesFamilles.map((gf) => (
                <option key={gf.id} value={gf.id}>{gf.nom}</option>
              ))}
            </select>
          </Field>
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="button" variant="primary" loading={saving} onClick={handleSave}>
            {saving ? "Création…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal : lier une lignée à une grande famille ─────────────────────────────

function LierGrandeFamilleModal({
  famille,
  grandesFamilles,
  onClose,
  onSuccess,
}: {
  famille: Famille;
  grandesFamilles: GrandeFamille[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleLier = async (gfId: string) => {
    setSaving(gfId);
    setError("");
    const { error: e } = await supabase.from("familles").update({ grande_famille_id: gfId }).eq("id", famille.id);
    if (e) { setError(e.message); setSaving(null); return; }
    onSuccess();
  };

  const handleDelier = async () => {
    setSaving("unlink");
    setError("");
    const { error: e } = await supabase.from("familles").update({ grande_famille_id: null }).eq("id", famille.id);
    if (e) { setError(e.message); setSaving(null); return; }
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Grande famille</p>
          <DialogTitle>{famille.nom}</DialogTitle>
        </DialogHeader>

        {famille.grande_famille && (
          <div className="flex items-center justify-between border-b border-border bg-accent-subtle px-5 py-3">
            <div>
              <p className="text-xs text-muted-2">Grande famille actuelle</p>
              <p className="text-sm font-semibold text-accent">{famille.grande_famille.nom}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelier}
              disabled={saving === "unlink"}
              className="text-danger hover:bg-danger-subtle hover:text-danger"
            >
              <Unlink className="h-3.5 w-3.5" />
              {saving === "unlink" ? "…" : "Délier"}
            </Button>
          </div>
        )}

        {error && <p role="alert" className="px-5 py-2 text-sm text-danger">{error}</p>}

        {grandesFamilles.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-2">Aucune grande famille. Créez-en une d&apos;abord.</p>
        ) : (
          <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto">
            {grandesFamilles.map((gf) => {
              const isCurrent = gf.id === famille.grande_famille_id;
              return (
                <li key={gf.id} className={`flex items-center justify-between gap-3 px-5 py-3.5 ${isCurrent ? "bg-accent-subtle" : "hover:bg-inset"}`}>
                  <div>
                    <p className="font-medium text-foreground">
                      {gf.nom}
                      {isCurrent && (
                        <Badge tone="accent" className="ml-2"><Check /> Liée</Badge>
                      )}
                    </p>
                    {gf.description && <p className="text-xs text-muted-2">{gf.description}</p>}
                  </div>
                  {!isCurrent && (
                    <Button variant="outline" size="sm" onClick={() => handleLier(gf.id)} disabled={saving === gf.id}>
                      {saving === gf.id ? "…" : "Lier"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal liaison collectif ──────────────────────────────────────────────────

function LierCollectifModal({
  famille,
  onClose,
  onSuccess,
}: {
  famille: Famille;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [search, setSearch] = useState("");
  const [collectifs, setCollectifs] = useState<CollectifOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: liees } = await supabase.from("familles").select("attributaire_id").not("attributaire_id", "is", null);
      const lieeIds = (liees ?? []).map((f) => f.attributaire_id).filter((id): id is string => id !== null && id !== famille.attributaire_id);

      let q = supabase.from("attributaires").select("id, nom").eq("type", "collectif_ayants_droit").order("nom");
      if (lieeIds.length > 0) q = q.not("id", "in", `(${lieeIds.join(",")})`);
      const { data: attrs } = await q;

      const { data: attrCounts } = await supabase
        .from("attributions")
        .select("attributaire_id")
        .eq("actuel", true)
        .in("attributaire_id", (attrs ?? []).map((a) => a.id));

      const countMap: Record<string, number> = {};
      for (const row of attrCounts ?? []) {
        countMap[row.attributaire_id] = (countMap[row.attributaire_id] ?? 0) + 1;
      }

      setCollectifs((attrs ?? []).map((a) => ({ id: a.id, nom: a.nom, nb_lots: countMap[a.id] ?? 0 })));
      setLoading(false);
    })();
  }, [famille.attributaire_id, supabase]);

  const filtered = collectifs.filter((c) => !search || c.nom.toLowerCase().includes(search.toLowerCase()));

  const handleLier = async (collectifId: string) => {
    setSaving(collectifId);
    setError("");
    const { error: e } = await supabase.from("familles").update({ attributaire_id: collectifId }).eq("id", famille.id);
    if (e) { setError(e.message); setSaving(null); return; }
    setSaving(null);
    onSuccess();
  };

  const handleDelier = async () => {
    setSaving("unlink");
    setError("");
    const { error: e } = await supabase.from("familles").update({ attributaire_id: null }).eq("id", famille.id);
    if (e) { setError(e.message); setSaving(null); return; }
    setSaving(null);
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Lier un collectif d&apos;ayants-droit</p>
          <DialogTitle>{famille.nom}</DialogTitle>
        </DialogHeader>

        {famille.collectif && (
          <div className="flex items-center justify-between border-b border-border bg-accent-subtle px-5 py-3">
            <div>
              <p className="text-xs text-muted-2">Collectif actuel</p>
              <p className="text-sm font-semibold text-accent">{famille.collectif.nom}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelier}
              disabled={saving === "unlink"}
              className="text-danger hover:bg-danger-subtle hover:text-danger"
            >
              <Unlink className="h-3.5 w-3.5" />
              {saving === "unlink" ? "…" : "Délier"}
            </Button>
          </div>
        )}

        <div className="border-b border-border p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <Input autoFocus placeholder="Rechercher un collectif…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="max-h-[46vh] overflow-y-auto">
          {error && <p role="alert" className="px-4 py-2 text-sm text-danger">{error}</p>}
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-2">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-2">Aucun collectif disponible.</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((c) => {
                const isCurrent = c.id === famille.attributaire_id;
                return (
                  <li key={c.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${isCurrent ? "bg-accent-subtle" : "hover:bg-inset"}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {c.nom}
                        {isCurrent && <Badge tone="accent" className="ml-2"><Check /> Lié</Badge>}
                      </p>
                      <p className="text-xs text-muted-2">{c.nb_lots} lot{c.nb_lots !== 1 ? "s" : ""} attribué{c.nb_lots !== 1 ? "s" : ""}</p>
                    </div>
                    {!isCurrent && (
                      <Button variant="outline" size="sm" onClick={() => handleLier(c.id)} disabled={saving === c.id}>
                        {saving === c.id ? "…" : "Lier"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-muted-2">{filtered.length} collectif{filtered.length !== 1 ? "s" : ""} disponible{filtered.length !== 1 ? "s" : ""}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal désignation chef de famille ───────────────────────────────────────

function DesignerChefFamilleModal({
  famille,
  onClose,
  onSuccess,
}: {
  famille: Famille;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<ProfilePicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, nom_complet, groupe, telephone, famille_id, autorite_coutumiere_id")
        .order("nom_complet");
      setProfiles((data ?? []) as ProfilePicker[]);
      setLoading(false);
    };
    void load();
  }, [supabase]);

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return p.nom_complet.toLowerCase().includes(q) || (GROUPE_LABELS[p.groupe] ?? p.groupe).toLowerCase().includes(q);
  });

  const handleDesigner = async (profile: ProfilePicker) => {
    setSaving(profile.id);
    setError("");
    const { error: e1 } = await supabase.from("familles").update({ chef_profile_id: profile.id }).eq("id", famille.id);
    if (e1) { setError(e1.message); setSaving(null); return; }
    if (!profile.famille_id) {
      const { error: e2 } = await supabase.from("profiles").update({ famille_id: famille.id }).eq("id", profile.id);
      if (e2) { setError(`Chef désigné mais rattachement à la famille échoué : ${e2.message}`); setSaving(null); return; }
    }
    // Nouvelles désignations : rôle "Propriétaire terrien" par défaut. Un compte déjà
    // "chefferie" (ex. Koelea-Accor Revu) n'est jamais rétrogradé — coexistence permanente
    // des deux modèles, voir TerraCI_SGNF_Document_Directeur_Unique_v1.md.
    if (profile.groupe !== "chefferie" && profile.groupe !== "proprietaire_terrien") {
      const { error: e3 } = await supabase.from("profiles").update({ groupe: "proprietaire_terrien" }).eq("id", profile.id);
      if (e3) { setError(`Chef désigné mais changement de rôle échoué : ${e3.message}`); setSaving(null); return; }
    }
    setSaving(null);
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Désigner un chef de famille</p>
          <DialogTitle>{famille.nom}</DialogTitle>
          {famille.chef_de_famille && (
            <p className="text-xs text-muted-2">Chef enregistré : {famille.chef_de_famille}</p>
          )}
        </DialogHeader>
        <div className="border-b border-border p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <Input autoFocus placeholder="Rechercher un profil par nom ou rôle…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {error && <p role="alert" className="px-4 py-2 text-sm text-danger">{error}</p>}
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-2">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-2">Aucun profil trouvé.</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((p) => {
                const isCurrentChef = p.id === famille.chef_profile_id;
                const alreadyLinked = p.famille_id && p.famille_id !== famille.id;
                return (
                  <li key={p.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${isCurrentChef ? "bg-success-subtle" : "hover:bg-inset"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {p.nom_complet}
                        {isCurrentChef && (
                          <Badge tone="success" className="ml-2"><Check /> Actuel</Badge>
                        )}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Badge tone={groupeTone(p.groupe)}>{GROUPE_LABELS[p.groupe] ?? p.groupe}</Badge>
                        {p.telephone && <span className="text-xs text-muted-2">{p.telephone}</span>}
                        {alreadyLinked && <span className="text-xs text-warning">· lié à une autre famille</span>}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDesigner(p)}
                      disabled={saving === p.id || Boolean(isCurrentChef)}
                    >
                      {saving === p.id ? "…" : isCurrentChef ? "Désigné" : "Désigner"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <p className="text-xs text-muted-2">{filtered.length} profil{filtered.length !== 1 ? "s" : ""}</p>
          <Button asChild variant="subtle" size="sm">
            <Link href="/dashboard/invitations">
              <UserPlus className="h-3.5 w-3.5" />
              Inviter un chef
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal désignation chef de village ───────────────────────────────────────

function DesignerChefVillageModal({
  autorite,
  onClose,
  onSuccess,
}: {
  autorite: AutoriteCoutumiere;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<ProfilePicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, nom_complet, groupe, telephone, famille_id, autorite_coutumiere_id")
        .order("nom_complet");
      setProfiles((data ?? []) as ProfilePicker[]);
      setLoading(false);
    };
    void load();
  }, [supabase]);

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return p.nom_complet.toLowerCase().includes(q) || (GROUPE_LABELS[p.groupe] ?? p.groupe).toLowerCase().includes(q);
  });

  const currentChefIds = new Set(autorite.chefs_profils.map((c) => c.id));

  const handleDesigner = async (profile: ProfilePicker) => {
    setSaving(profile.id);
    setError("");
    const { error: e } = await supabase.from("profiles").update({ autorite_coutumiere_id: autorite.id }).eq("id", profile.id);
    if (e) { setError(e.message); setSaving(null); return; }
    setSaving(null);
    onSuccess();
  };

  const handleRetirer = async (profileId: string) => {
    setSaving(profileId);
    setError("");
    const { error: e } = await supabase.from("profiles").update({ autorite_coutumiere_id: null }).eq("id", profileId);
    if (e) { setError(e.message); setSaving(null); return; }
    setSaving(null);
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-warning uppercase">Désigner un chef de village</p>
          <DialogTitle>{autorite.nom}</DialogTitle>
          {autorite.village && <p className="text-xs text-muted-2">Village : {autorite.village}</p>}
          {autorite.chef && <p className="text-xs text-muted-2">Chef (registre) : {autorite.chef}</p>}
        </DialogHeader>

        {autorite.chefs_profils.length > 0 && (
          <div className="border-b border-border bg-warning-subtle px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-warning">Compte(s) actuellement lié(s)</p>
            <ul className="space-y-1.5">
              {autorite.chefs_profils.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
                      <Crown className="h-3 w-3" />
                    </div>
                    <span className="truncate text-sm font-medium text-foreground">{c.nom_complet}</span>
                    <Badge tone="warning" className="shrink-0">{GROUPE_LABELS[c.groupe] ?? c.groupe}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRetirer(c.id)}
                    disabled={saving === c.id}
                    className="text-danger hover:bg-danger-subtle hover:text-danger"
                  >
                    {saving === c.id ? "…" : "Retirer"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-b border-border p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <Input autoFocus placeholder="Rechercher un profil…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="max-h-[42vh] overflow-y-auto">
          {error && <p role="alert" className="px-4 py-2 text-sm text-danger">{error}</p>}
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-2">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-2">Aucun profil trouvé.</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((p) => {
                const isLinked = currentChefIds.has(p.id);
                const linkedElsewhere = p.autorite_coutumiere_id && p.autorite_coutumiere_id !== autorite.id;
                return (
                  <li key={p.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${isLinked ? "bg-warning-subtle" : "hover:bg-inset"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {p.nom_complet}
                        {isLinked && (
                          <Badge tone="warning" className="ml-2"><Check /> Lié</Badge>
                        )}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Badge tone={groupeTone(p.groupe)}>{GROUPE_LABELS[p.groupe] ?? p.groupe}</Badge>
                        {p.telephone && <span className="text-xs text-muted-2">{p.telephone}</span>}
                        {linkedElsewhere && <span className="text-xs text-warning">· lié à une autre chefferie</span>}
                      </div>
                    </div>
                    {!isLinked && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDesigner(p)}
                        disabled={saving === p.id}
                        className="border-warning/40 text-warning hover:bg-warning hover:text-white"
                      >
                        {saving === p.id ? "…" : "Désigner"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <p className="text-xs text-muted-2">{filtered.length} profil{filtered.length !== 1 ? "s" : ""}</p>
          <Button asChild variant="subtle" size="sm">
            <Link href="/dashboard/invitations">
              <UserPlus className="h-3.5 w-3.5" />
              Inviter un chef
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type Tab = "familles" | "autorites" | "grandesfamilles";

export default function FamillesPage() {
  const supabase = useMemo(() => createClient(), []);
  const { counts } = useBadgeCounts();
  const [tab, setTab] = useState<Tab>("familles");

  // ── Grandes familles ──
  const [grandesFamilles, setGrandesFamilles] = useState<GrandeFamille[]>([]);

  const [showCreerGF, setShowCreerGF] = useState(false);
  const [showCreerAutorite, setShowCreerAutorite] = useState(false);
  const [showCreerFamille, setShowCreerFamille] = useState(false);
  const [modalGrandeFamille, setModalGrandeFamille] = useState<Famille | null>(null);

  // ── Familles (lignées) ──
  const [familles, setFamilles] = useState<Famille[]>([]);

  const [searchFamilles, setSearchFamilles] = useState("");
  const [modalFamille, setModalFamille] = useState<Famille | null>(null);
  const [modalCollectif, setModalCollectif] = useState<Famille | null>(null);

  // ── Autorités coutumières ──
  const [autorites, setAutorites] = useState<AutoriteCoutumiere[]>([]);

  const [searchAutorites, setSearchAutorites] = useState("");
  const [modalAutorite, setModalAutorite] = useState<AutoriteCoutumiere | null>(null);

  const fetchGrandesFamilles = useCallback(async () => {
    const { data: gfs } = await supabase.from("grandes_familles").select("id, nom, description").order("nom");

    // Lignées de premier niveau (rattachées à une grande famille, sans parent lignée)
    const { data: lignees } = await supabase
      .from("familles")
      .select("id, nom, chef_de_famille, chef_profile_id, grande_famille_id, chef_profile:profiles!familles_chef_profile_id_fkey(id, nom_complet)")
      .not("grande_famille_id", "is", null)
      .is("lignee_id", null);

    // Sous-lignées (enfants / petits-enfants d'une lignée)
    const { data: sousLignees } = await supabase
      .from("familles")
      .select("id, nom, chef_de_famille, chef_profile_id, lignee_id, chef_profile:profiles!familles_chef_profile_id_fkey(id, nom_complet)")
      .not("lignee_id", "is", null)
      .order("nom");

    const sousLigneesByLignee: Record<string, SousLignee[]> = {};
    for (const sl of sousLignees ?? []) {
      const pid = (sl as unknown as { lignee_id: string }).lignee_id;
      if (!sousLigneesByLignee[pid]) sousLigneesByLignee[pid] = [];
      sousLigneesByLignee[pid].push({
        id: sl.id,
        nom: sl.nom,
        chef_de_famille: (sl as unknown as { chef_de_famille: string | null }).chef_de_famille,
        chef_profile_id: sl.chef_profile_id,
        chef_profile: sl.chef_profile as { id: string; nom_complet: string } | null,
      });
    }

    const ligneesByGF: Record<string, LigneeInGF[]> = {};
    for (const l of lignees ?? []) {
      if (l.grande_famille_id) {
        if (!ligneesByGF[l.grande_famille_id]) ligneesByGF[l.grande_famille_id] = [];
        ligneesByGF[l.grande_famille_id].push({
          id: l.id,
          nom: l.nom,
          chef_de_famille: (l as unknown as { chef_de_famille: string | null }).chef_de_famille,
          chef_profile_id: l.chef_profile_id,
          chef_profile: l.chef_profile as { id: string; nom_complet: string } | null,
          sous_lignees: sousLigneesByLignee[l.id] ?? [],
        });
      }
    }

    setGrandesFamilles((gfs ?? []).map((gf) => ({ ...gf, lignees: ligneesByGF[gf.id] ?? [] })));
  }, [supabase]);

  const fetchFamilles = useCallback(async () => {
    const { data } = await supabase
      .from("familles")
      .select(
        "id, nom, chef_de_famille, contact, grande_famille_id, chef_profile_id, attributaire_id, lignee_id, " +
        "grande_famille:grandes_familles(id, nom), " +
        "chef_profile:profiles!familles_chef_profile_id_fkey(id, nom_complet, groupe, telephone), " +
        "collectif:attributaires(id, nom), " +
        "lignee:familles!familles_lignee_id_fkey(id, nom)"
      )
      .order("nom");
    setFamilles((data ?? []) as unknown as Famille[]);
  }, [supabase]);

  const fetchAutorites = useCallback(async () => {
    const { data: acs } = await supabase.from("autorites_coutumieres").select("id, nom, type, village, chef").order("nom");

    const { data: chefsProfils } = await supabase
      .from("profiles")
      .select("id, nom_complet, groupe, telephone, autorite_coutumiere_id")
      .not("autorite_coutumiere_id", "is", null);

    const chefsByAutorite: Record<string, ChefProfile[]> = {};
    for (const p of chefsProfils ?? []) {
      const aid = (p as ProfilePicker).autorite_coutumiere_id!;
      if (!chefsByAutorite[aid]) chefsByAutorite[aid] = [];
      chefsByAutorite[aid].push({ id: p.id, nom_complet: p.nom_complet, groupe: p.groupe, telephone: p.telephone });
    }

    setAutorites((acs ?? []).map((ac) => ({ ...ac, chefs_profils: chefsByAutorite[ac.id] ?? [] })));
  }, [supabase]);

  const { isLoading: grandesFamillesLoading, recharger: rechargerGF } = useChargement(fetchGrandesFamilles, [fetchGrandesFamilles]);
  const { isLoading: famillesLoading, recharger: rechargerF } = useChargement(fetchFamilles, [fetchFamilles]);
  const { isLoading: autoritesLoading, recharger: rechargerA } = useChargement(fetchAutorites, [fetchAutorites]);

  const rafraichir = useCallback(() => {
    void rechargerGF();
    void rechargerF();
    void rechargerA();
  }, [rechargerGF, rechargerF, rechargerA]);

  const sansChefFamille = familles.filter((f) => !f.chef_profile_id).length;
  // Une sous-lignée (lignee_id défini) est implicitement rattachée à une grande famille
  const sansGrandeFamille = familles.filter((f) => !f.grande_famille_id && !f.lignee_id).length;
  const sansChefAutorite = autorites.filter((a) => a.chefs_profils.length === 0).length;

  const filteredFamilles = familles.filter((f) => {
    const q = searchFamilles.toLowerCase();
    return !q || f.nom.toLowerCase().includes(q) || (f.chef_de_famille ?? "").toLowerCase().includes(q) || (f.grande_famille?.nom ?? "").toLowerCase().includes(q);
  });

  const filteredAutorites = autorites.filter((a) => {
    const q = searchAutorites.toLowerCase();
    return !q || a.nom.toLowerCase().includes(q) || (a.village ?? "").toLowerCase().includes(q);
  });

  return (
    <AppShell loading={grandesFamillesLoading || famillesLoading || autoritesLoading} counts={counts} onRefresh={rafraichir}>
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Chefferie &amp; désignations
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Gérez la hiérarchie familiale et liez les comptes numériques aux familles et autorités coutumières.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BoutonImprimer />
          <Button asChild variant="primary" className="print:hidden">
            <Link href="/dashboard/invitations">
              <UserPlus className="h-4 w-4" />
              Inviter un chef
            </Link>
          </Button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex w-fit flex-wrap gap-1 rounded-2xl border border-border bg-inset p-1 print:hidden">
        <button
          onClick={() => setTab("grandesfamilles")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${tab === "grandesfamilles" ? "bg-card text-accent shadow-panel" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Building2 className="h-4 w-4" />
          Grandes familles
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-border px-1.5 text-xs font-semibold text-muted-foreground">
            {grandesFamilles.length}
          </span>
        </button>
        <button
          onClick={() => setTab("familles")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${tab === "familles" ? "bg-card text-accent shadow-panel" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Landmark className="h-4 w-4" />
          Lignées
          {sansChefFamille > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning-subtle px-1.5 text-xs font-semibold text-warning">
              {sansChefFamille}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("autorites")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${tab === "autorites" ? "bg-card text-accent shadow-panel" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Crown className="h-4 w-4" />
          Autorités coutumières
          {sansChefAutorite > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning-subtle px-1.5 text-xs font-semibold text-warning">
              {sansChefAutorite}
            </span>
          )}
        </button>
      </div>

      {/* ══ Onglet Grandes familles ════════════════════════════════════════════ */}
      {tab === "grandesfamilles" && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Chaque grande famille regroupe une ou plusieurs lignées, elles-mêmes composées d&apos;attributaires primaires et leurs collectifs d&apos;ayants-droit.
            </p>
            <Button variant="outline" className="shrink-0 print:hidden" onClick={() => setShowCreerGF(true)}>
              <Plus className="h-4 w-4" />
              Nouvelle
            </Button>
          </div>

          {grandesFamillesLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-2">Chargement…</div>
          ) : grandesFamilles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16">
              <Building2 className="h-8 w-8 text-muted-2" />
              <p className="text-sm text-muted-foreground">Aucune grande famille créée.</p>
              <Button variant="primary" size="sm" onClick={() => setShowCreerGF(true)}>
                Créer la première grande famille
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {grandesFamilles.map((gf) => (
                <Card key={gf.id} className="overflow-hidden">
                  <div className="border-b border-border bg-accent-subtle px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-accent" />
                      <p className="font-bold text-foreground">{gf.nom}</p>
                    </div>
                    {gf.description && <p className="mt-0.5 text-xs text-muted-2">{gf.description}</p>}
                    <p className="mt-1 text-xs font-medium text-accent">{gf.lignees.length} lignée{gf.lignees.length !== 1 ? "s" : ""}</p>
                  </div>
                  {gf.lignees.length > 0 ? (
                    <ul className="divide-y divide-border">
                      {gf.lignees.map((l) => (
                        <li key={l.id}>
                          {/* Lignée de premier niveau */}
                          <div className="flex items-center gap-3 px-5 py-3.5">
                            <Landmark className="h-3.5 w-3.5 shrink-0 text-accent" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground">{l.nom}</p>
                              {l.chef_profile ? (
                                <p className="text-xs font-medium text-success">{l.chef_profile.nom_complet}</p>
                              ) : l.chef_de_famille ? (
                                <p className="text-xs text-muted-2">{l.chef_de_famille} <span className="text-warning">· sans compte</span></p>
                              ) : (
                                <p className="text-xs text-warning">Sans chef lié</p>
                              )}
                              {l.sous_lignees.length > 0 && (
                                <p className="text-xs text-accent">{l.sous_lignees.length} sous-lignée{l.sous_lignees.length > 1 ? "s" : ""}</p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setModalFamille({
                                id: l.id,
                                nom: l.nom,
                                chef_de_famille: l.chef_de_famille,
                                chef_profile_id: l.chef_profile_id,
                                chef_profile: null,
                                contact: null,
                                grande_famille_id: gf.id,
                                grande_famille: { id: gf.id, nom: gf.nom },
                                attributaire_id: null,
                                collectif: null,
                                lignee_id: null,
                                lignee: null,
                              })}
                            >
                              {l.chef_profile_id ? "Modifier" : "Désigner"}
                            </Button>
                          </div>
                          {/* Sous-lignées */}
                          {l.sous_lignees.length > 0 && (
                            <ul className="border-t border-border bg-inset/60">
                              {l.sous_lignees.map((sl) => (
                                <li key={sl.id} className="flex items-center gap-3 py-2.5 pr-5 pl-10">
                                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-2" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-foreground">{sl.nom}</p>
                                    {sl.chef_profile ? (
                                      <p className="text-xs text-success">{sl.chef_profile.nom_complet}</p>
                                    ) : sl.chef_de_famille ? (
                                      <p className="text-xs text-muted-2">{sl.chef_de_famille} <span className="text-warning">· sans compte</span></p>
                                    ) : (
                                      <p className="text-xs text-warning">Sans chef</p>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setModalFamille({
                                      id: sl.id,
                                      nom: sl.nom,
                                      chef_de_famille: sl.chef_de_famille,
                                      chef_profile_id: sl.chef_profile_id,
                                      chef_profile: null,
                                      contact: null,
                                      grande_famille_id: gf.id,
                                      grande_famille: { id: gf.id, nom: gf.nom },
                                      attributaire_id: null,
                                      collectif: null,
                                      lignee_id: l.id,
                                      lignee: { id: l.id, nom: l.nom },
                                    })}
                                  >
                                    {sl.chef_profile_id ? "Modifier" : "Désigner"}
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-5 py-4 text-sm italic text-muted-2">Aucune lignée liée — allez dans l&apos;onglet Lignées pour les rattacher.</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══ Onglet Lignées (familles) ═════════════════════════════════════════ */}
      {tab === "familles" && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Lignées du registre — rattachées à une grande famille et, le cas échéant, à un compte chef.
            </p>
            <Button variant="outline" className="shrink-0 print:hidden" onClick={() => setShowCreerFamille(true)}>
              <Plus className="h-4 w-4" />
              Nouvelle
            </Button>
          </div>

          {!famillesLoading && sansChefFamille > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-subtle px-4 py-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-semibold text-warning">
                  {sansChefFamille} lignée{sansChefFamille > 1 ? "s" : ""} sans compte chef lié
                </p>
                <p className="mt-0.5 text-xs text-warning">
                  Les demandes d&apos;intérêt sur ces lignées n&apos;atteindront que les admins.
                </p>
              </div>
            </div>
          )}

          {!famillesLoading && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-2">Lignées totales</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{familles.length}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">Rattachées</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-accent">{familles.length - sansGrandeFamille}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-success">Chef lié</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-success">{familles.length - sansChefFamille}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-warning">Sans chef lié</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-warning">{sansChefFamille}</p>
              </Card>
            </div>
          )}

          <div className="relative w-full max-w-sm print:hidden">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <Input placeholder="Rechercher une lignée…" className="pl-9" value={searchFamilles} onChange={(e) => setSearchFamilles(e.target.value)} />
          </div>

          <Card className="overflow-hidden print:overflow-visible print:rounded-none print:border-none">
            {famillesLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-2">Chargement…</div>
            ) : filteredFamilles.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Users className="h-8 w-8 text-muted-2" />
                <p className="text-sm text-muted-foreground">Aucune lignée trouvée.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-inset text-left text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3">Lignée</th>
                      <th className="px-5 py-3">Rattachement</th>
                      <th className="px-5 py-3">Collectif d&apos;ayants-droit</th>
                      <th className="px-5 py-3">Chef (registre)</th>
                      <th className="px-5 py-3">Compte lié</th>
                      <th className="px-5 py-3 print:hidden"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredFamilles.map((f) => (
                      <tr key={f.id} className="transition hover:bg-inset/60">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {f.lignee_id && <ChevronRight className="h-3 w-3 shrink-0 text-muted-2" />}
                            <p className="font-medium text-foreground">{f.nom}</p>
                          </div>
                        </td>
                        {/* Colonne Rattachement : grande famille et/ou lignée parente */}
                        <td className="px-5 py-3.5">
                          {f.lignee ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 text-xs text-accent">
                                <Building2 className="h-3 w-3" />
                                {f.grande_famille?.nom ?? "—"}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Landmark className="h-3 w-3" />
                                {f.lignee.nom}
                              </div>
                            </div>
                          ) : f.grande_famille ? (
                            <button
                              onClick={() => setModalGrandeFamille(f)}
                              className="flex items-center gap-1 text-xs text-accent hover:underline"
                            >
                              <Building2 className="h-3 w-3" />
                              {f.grande_famille.nom}
                            </button>
                          ) : (
                            <button
                              onClick={() => setModalGrandeFamille(f)}
                              className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2 py-0.5 text-xs font-medium text-accent transition hover:brightness-95"
                            >
                              <Link2 className="h-3 w-3" /> Rattacher
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {f.collectif ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                                <Link2 className="h-3 w-3" />
                              </div>
                              <div>
                                <p className="truncate text-sm font-medium text-foreground">{f.collectif.nom}</p>
                                <button
                                  onClick={() => setModalCollectif(f)}
                                  className="text-xs text-muted-2 underline-offset-2 hover:text-accent hover:underline"
                                >
                                  Modifier
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setModalCollectif(f)}
                              className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2.5 py-1 text-xs font-medium text-accent transition hover:brightness-95"
                            >
                              <Link2 className="h-3 w-3" /> Lier
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">
                          {f.chef_de_famille ?? <span className="text-muted-2">—</span>}
                          {f.contact && <p className="text-xs text-muted-2">{f.contact}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          {f.chef_profile ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                                <UserCheck className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{f.chef_profile.nom_complet}</p>
                                <Badge tone={groupeTone(f.chef_profile.groupe)}>{GROUPE_LABELS[f.chef_profile.groupe] ?? f.chef_profile.groupe}</Badge>
                              </div>
                            </div>
                          ) : (
                            <Badge tone="warning"><AlertTriangle /> Non lié</Badge>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right print:hidden">
                          <Button variant="ghost" size="sm" onClick={() => setModalFamille(f)}>
                            {f.chef_profile ? "Modifier" : "Désigner"}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ══ Onglet Autorités coutumières ════════════════════════════════════ */}
      {tab === "autorites" && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Chefferies et autorités coutumières du registre — chacune peut porter ses propres tarifs de cession.
            </p>
            <Button variant="outline" className="shrink-0 print:hidden" onClick={() => setShowCreerAutorite(true)}>
              <Plus className="h-4 w-4" />
              Nouvelle
            </Button>
          </div>

          {!autoritesLoading && sansChefAutorite > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-subtle px-4 py-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-semibold text-warning">
                  {sansChefAutorite} autorité{sansChefAutorite > 1 ? "s" : ""} sans compte chef de village lié
                </p>
                <p className="mt-0.5 text-xs text-warning">
                  Les validations de ces chefferies ne pourront pas être routées vers un compte numérique.
                </p>
              </div>
            </div>
          )}

          {!autoritesLoading && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-2">Autorités totales</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{autorites.length}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-success">Chef lié</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-success">{autorites.length - sansChefAutorite}</p>
              </Card>
              <Card className="col-span-2 p-4 sm:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-warning">Sans chef lié</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-warning">{sansChefAutorite}</p>
              </Card>
            </div>
          )}

          <div className="relative w-full max-w-sm print:hidden">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <Input placeholder="Rechercher une autorité ou un village…" className="pl-9" value={searchAutorites} onChange={(e) => setSearchAutorites(e.target.value)} />
          </div>

          <Card className="overflow-hidden print:overflow-visible print:rounded-none print:border-none">
            {autoritesLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-2">Chargement…</div>
            ) : filteredAutorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Crown className="h-8 w-8 text-muted-2" />
                <p className="text-sm text-muted-foreground">Aucune autorité coutumière trouvée.</p>
                {!searchAutorites && (
                  <Button variant="primary" size="sm" onClick={() => setShowCreerAutorite(true)}>
                    Créer la première chefferie
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-inset text-left text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3">Autorité</th>
                      <th className="px-5 py-3">Chef (registre)</th>
                      <th className="px-5 py-3">Compte(s) lié(s)</th>
                      <th className="px-5 py-3 print:hidden"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredAutorites.map((a) => (
                      <tr key={a.id} className="transition hover:bg-inset/60">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-foreground">{a.nom}</p>
                          {a.village && <p className="mt-0.5 text-xs text-muted-2">{a.village}</p>}
                          {a.type && <p className="text-xs text-muted-2">{a.type}</p>}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">
                          {a.chef ?? <span className="text-muted-2">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {a.chefs_profils.length > 0 ? (
                            <div className="space-y-1">
                              {a.chefs_profils.map((c) => (
                                <div key={c.id} className="flex items-center gap-2">
                                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
                                    <Crown className="h-3 w-3" />
                                  </div>
                                  <span className="text-sm font-medium text-foreground">{c.nom_complet}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <Badge tone="warning"><AlertTriangle /> Non lié</Badge>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right print:hidden">
                          <Button variant="ghost" size="sm" onClick={() => setModalAutorite(a)}>
                            {a.chefs_profils.length > 0 ? "Gérer" : "Désigner"}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Modals */}
      {showCreerGF && (
        <CreerGrandeFamilleModal
          onClose={() => setShowCreerGF(false)}
          onSuccess={() => { setShowCreerGF(false); void rechargerGF(); }}
        />
      )}

      {showCreerAutorite && (
        <CreerAutoriteModal
          onClose={() => setShowCreerAutorite(false)}
          onSuccess={() => { setShowCreerAutorite(false); void rechargerA(); }}
        />
      )}

      {showCreerFamille && (
        <CreerFamilleModal
          grandesFamilles={grandesFamilles}
          onClose={() => setShowCreerFamille(false)}
          onSuccess={() => { setShowCreerFamille(false); void rechargerF(); }}
        />
      )}

      {modalGrandeFamille && (
        <LierGrandeFamilleModal
          famille={modalGrandeFamille}
          grandesFamilles={grandesFamilles}
          onClose={() => setModalGrandeFamille(null)}
          onSuccess={() => { setModalGrandeFamille(null); void rechargerF(); void rechargerGF(); }}
        />
      )}

      {modalCollectif && (
        <LierCollectifModal
          famille={modalCollectif}
          onClose={() => setModalCollectif(null)}
          onSuccess={() => { setModalCollectif(null); void rechargerF(); }}
        />
      )}

      {modalFamille && (
        <DesignerChefFamilleModal
          famille={modalFamille}
          onClose={() => setModalFamille(null)}
          onSuccess={() => { setModalFamille(null); void rechargerF(); void rechargerGF(); }}
        />
      )}

      {modalAutorite && (
        <DesignerChefVillageModal
          autorite={modalAutorite}
          onClose={() => setModalAutorite(null)}
          onSuccess={() => { setModalAutorite(null); void rechargerA(); }}
        />
      )}
    </AppShell>
  );
}
