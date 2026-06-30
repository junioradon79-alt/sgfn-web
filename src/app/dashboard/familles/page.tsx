"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Users, UserCheck, AlertTriangle, Search, X, Check,
  UserPlus, ChevronRight, Crown, Landmark, Link2, Unlink, Building2, Plus,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

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

const GROUPE_BADGE: Record<string, string> = {
  chefferie: "bg-amber-50 text-amber-700 border border-amber-200",
  proprietaire: "bg-blue-50 text-blue-700 border border-blue-200",
  admin: "bg-slate-100 text-slate-600 border border-slate-200",
};

// ─── Modal : créer une grande famille ────────────────────────────────────────

function CreerGrandeFamilleModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const supabase = createClient();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Nouvelle grande famille</p>
            <h2 className="mt-1 text-lg font-semibold text-[#0D3B66]">Créer une grande famille</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Nom *</label>
            <Input autoFocus placeholder="Ex : BEUH, AKE, YAGO…" value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Description (optionnel)</label>
            <Input placeholder="Ex : Grande famille BEUH — Village Ebimpe" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100">Annuler</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-[#0D3B66] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1E6091] disabled:opacity-40"
          >
            {saving ? "Création…" : "Créer"}
          </button>
        </div>
      </div>
    </div>
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
  const supabase = createClient();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Grande famille</p>
            <h2 className="mt-1 text-lg font-semibold text-[#0D3B66]">{famille.nom}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {famille.grande_famille && (
          <div className="flex items-center justify-between border-b border-slate-100 bg-indigo-50/40 px-6 py-3">
            <div>
              <p className="text-xs text-slate-400">Grande famille actuelle</p>
              <p className="text-sm font-semibold text-[#0D3B66]">{famille.grande_famille.nom}</p>
            </div>
            <button
              onClick={handleDelier}
              disabled={saving === "unlink"}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40"
            >
              <Unlink className="h-3.5 w-3.5" />
              {saving === "unlink" ? "…" : "Délier"}
            </button>
          </div>
        )}

        {error && <p className="px-6 py-2 text-sm text-red-600">{error}</p>}

        {grandesFamilles.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-400">Aucune grande famille. Créez-en une d&apos;abord.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {grandesFamilles.map((gf) => {
              const isCurrent = gf.id === famille.grande_famille_id;
              return (
                <li key={gf.id} className={`flex items-center justify-between gap-3 px-6 py-3.5 ${isCurrent ? "bg-indigo-50/40" : "hover:bg-slate-50"}`}>
                  <div>
                    <p className="font-medium text-slate-800">
                      {gf.nom}
                      {isCurrent && (
                        <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          <Check className="h-3 w-3" /> Liée
                        </span>
                      )}
                    </p>
                    {gf.description && <p className="text-xs text-slate-400">{gf.description}</p>}
                  </div>
                  {!isCurrent && (
                    <button
                      onClick={() => handleLier(gf.id)}
                      disabled={saving === gf.id}
                      className="shrink-0 rounded-xl border border-[#0D3B66] px-3 py-1.5 text-xs font-semibold text-[#0D3B66] transition hover:bg-[#0D3B66] hover:text-white disabled:opacity-40"
                    >
                      {saving === gf.id ? "…" : "Lier"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="text-sm font-medium text-slate-400 transition hover:text-slate-600">Fermer</button>
        </div>
      </div>
    </div>
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
  const supabase = createClient();
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
  }, [famille.attributaire_id]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white shadow-2xl" style={{ maxHeight: "90vh" }}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Lier un collectif d&apos;ayants-droit</p>
            <h2 className="mt-1 text-lg font-semibold text-[#0D3B66]">{famille.nom}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {famille.collectif && (
          <div className="flex items-center justify-between border-b border-slate-100 bg-blue-50/40 px-6 py-3">
            <div>
              <p className="text-xs text-slate-400">Collectif actuel</p>
              <p className="text-sm font-semibold text-[#0D3B66]">{famille.collectif.nom}</p>
            </div>
            <button
              onClick={handleDelier}
              disabled={saving === "unlink"}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40"
            >
              <Unlink className="h-3.5 w-3.5" />
              {saving === "unlink" ? "…" : "Délier"}
            </button>
          </div>
        )}

        <div className="border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input autoFocus placeholder="Rechercher un collectif…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "46vh" }}>
          {error && <p className="px-4 py-2 text-sm text-red-600">{error}</p>}
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Aucun collectif disponible.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((c) => {
                const isCurrent = c.id === famille.attributaire_id;
                return (
                  <li key={c.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${isCurrent ? "bg-blue-50/40" : "hover:bg-slate-50"}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {c.nom}
                        {isCurrent && <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"><Check className="h-3 w-3" /> Lié</span>}
                      </p>
                      <p className="text-xs text-slate-400">{c.nb_lots} lot{c.nb_lots !== 1 ? "s" : ""} attribué{c.nb_lots !== 1 ? "s" : ""}</p>
                    </div>
                    {!isCurrent && (
                      <button
                        onClick={() => handleLier(c.id)}
                        disabled={saving === c.id}
                        className="shrink-0 rounded-xl border border-[#0D3B66] px-3 py-1.5 text-xs font-semibold text-[#0D3B66] transition hover:bg-[#0D3B66] hover:text-white disabled:opacity-40"
                      >
                        {saving === c.id ? "…" : "Lier"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-400">{filtered.length} collectif{filtered.length !== 1 ? "s" : ""} disponible{filtered.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
    </div>
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
  const supabase = createClient();
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
  }, []);

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
      await supabase.from("profiles").update({ famille_id: famille.id }).eq("id", profile.id);
    }
    setSaving(null);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white shadow-2xl" style={{ maxHeight: "90vh" }}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Désigner un chef de famille</p>
            <h2 className="mt-1 text-lg font-semibold text-[#0D3B66]">{famille.nom}</h2>
            {famille.chef_de_famille && (
              <p className="mt-0.5 text-xs text-slate-400">Chef enregistré : {famille.chef_de_famille}</p>
            )}
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input autoFocus placeholder="Rechercher un profil par nom ou rôle…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: "50vh" }}>
          {error && <p className="px-4 py-2 text-sm text-red-600">{error}</p>}
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Aucun profil trouvé.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const isCurrentChef = p.id === famille.chef_profile_id;
                const alreadyLinked = p.famille_id && p.famille_id !== famille.id;
                return (
                  <li key={p.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${isCurrentChef ? "bg-emerald-50/60" : "hover:bg-slate-50"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {p.nom_complet}
                        {isCurrentChef && (
                          <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <Check className="h-3 w-3" /> Actuel
                          </span>
                        )}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${GROUPE_BADGE[p.groupe] ?? "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                          {GROUPE_LABELS[p.groupe] ?? p.groupe}
                        </span>
                        {p.telephone && <span className="text-xs text-slate-400">{p.telephone}</span>}
                        {alreadyLinked && <span className="text-xs text-amber-600">· lié à une autre famille</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDesigner(p)}
                      disabled={saving === p.id || isCurrentChef}
                      className="shrink-0 rounded-xl border border-[#0D3B66] px-3 py-1.5 text-xs font-semibold text-[#0D3B66] transition hover:bg-[#0D3B66] hover:text-white disabled:cursor-default disabled:opacity-40"
                    >
                      {saving === p.id ? "…" : isCurrentChef ? "Désigné" : "Désigner"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-400">{filtered.length} profil{filtered.length !== 1 ? "s" : ""}</p>
          <Link href="/dashboard/invitations" className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200">
            <UserPlus className="h-3.5 w-3.5" />
            Inviter un chef
          </Link>
        </div>
      </div>
    </div>
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
  const supabase = createClient();
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
  }, []);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white shadow-2xl" style={{ maxHeight: "90vh" }}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">Désigner un chef de village</p>
            <h2 className="mt-1 text-lg font-semibold text-[#0D3B66]">{autorite.nom}</h2>
            {autorite.village && <p className="mt-0.5 text-xs text-slate-400">Village : {autorite.village}</p>}
            {autorite.chef && <p className="text-xs text-slate-400">Chef (registre) : {autorite.chef}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {autorite.chefs_profils.length > 0 && (
          <div className="border-b border-slate-100 bg-amber-50/40 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-700">Compte(s) actuellement lié(s)</p>
            <ul className="space-y-1.5">
              {autorite.chefs_profils.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <Crown className="h-3 w-3" />
                    </div>
                    <span className="truncate text-sm font-medium text-slate-800">{c.nom_complet}</span>
                    <span className="shrink-0 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                      {GROUPE_LABELS[c.groupe] ?? c.groupe}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRetirer(c.id)}
                    disabled={saving === c.id}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-40"
                  >
                    {saving === c.id ? "…" : "Retirer"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input autoFocus placeholder="Rechercher un profil…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "42vh" }}>
          {error && <p className="px-4 py-2 text-sm text-red-600">{error}</p>}
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Aucun profil trouvé.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const isLinked = currentChefIds.has(p.id);
                const linkedElsewhere = p.autorite_coutumiere_id && p.autorite_coutumiere_id !== autorite.id;
                return (
                  <li key={p.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${isLinked ? "bg-amber-50/40" : "hover:bg-slate-50"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {p.nom_complet}
                        {isLinked && (
                          <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            <Check className="h-3 w-3" /> Lié
                          </span>
                        )}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${GROUPE_BADGE[p.groupe] ?? "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                          {GROUPE_LABELS[p.groupe] ?? p.groupe}
                        </span>
                        {p.telephone && <span className="text-xs text-slate-400">{p.telephone}</span>}
                        {linkedElsewhere && <span className="text-xs text-amber-600">· lié à une autre chefferie</span>}
                      </div>
                    </div>
                    {!isLinked && (
                      <button
                        onClick={() => handleDesigner(p)}
                        disabled={saving === p.id}
                        className="shrink-0 rounded-xl border border-amber-600 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-600 hover:text-white disabled:cursor-default disabled:opacity-40"
                      >
                        {saving === p.id ? "…" : "Désigner"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-400">{filtered.length} profil{filtered.length !== 1 ? "s" : ""}</p>
          <Link href="/dashboard/invitations" className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200">
            <UserPlus className="h-3.5 w-3.5" />
            Inviter un chef
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type Tab = "familles" | "autorites" | "grandesfamilles";

export default function FamillesPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("familles");

  // ── Grandes familles ──
  const [grandesFamilles, setGrandesFamilles] = useState<GrandeFamille[]>([]);
  const [grandesFamillesLoading, setGrandesFamillesLoading] = useState(true);
  const [showCreerGF, setShowCreerGF] = useState(false);
  const [modalGrandeFamille, setModalGrandeFamille] = useState<Famille | null>(null);

  // ── Familles (lignées) ──
  const [familles, setFamilles] = useState<Famille[]>([]);
  const [famillesLoading, setFamillesLoading] = useState(true);
  const [searchFamilles, setSearchFamilles] = useState("");
  const [modalFamille, setModalFamille] = useState<Famille | null>(null);
  const [modalCollectif, setModalCollectif] = useState<Famille | null>(null);

  // ── Autorités coutumières ──
  const [autorites, setAutorites] = useState<AutoriteCoutumiere[]>([]);
  const [autoritesLoading, setAutoritesLoading] = useState(true);
  const [searchAutorites, setSearchAutorites] = useState("");
  const [modalAutorite, setModalAutorite] = useState<AutoriteCoutumiere | null>(null);

  const fetchGrandesFamilles = useCallback(async () => {
    setGrandesFamillesLoading(true);
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
    setGrandesFamillesLoading(false);
  }, []);

  const fetchFamilles = useCallback(async () => {
    setFamillesLoading(true);
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
    setFamillesLoading(false);
  }, []);

  const fetchAutorites = useCallback(async () => {
    setAutoritesLoading(true);
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
    setAutoritesLoading(false);
  }, []);

  useEffect(() => { void fetchGrandesFamilles(); }, [fetchGrandesFamilles]);
  useEffect(() => { void fetchFamilles(); }, [fetchFamilles]);
  useEffect(() => { void fetchAutorites(); }, [fetchAutorites]);

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
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Chefferie & Désignations</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Gérez la hiérarchie familiale et liez les comptes numériques aux familles et autorités coutumières.
          </p>
        </div>
        <Link
          href="/dashboard/invitations"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#0D3B66] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E6091]"
        >
          <UserPlus className="h-4 w-4" />
          Inviter un chef
        </Link>
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200/60 bg-slate-50 p-1 w-fit">
        <button
          onClick={() => setTab("grandesfamilles")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${tab === "grandesfamilles" ? "bg-white shadow-sm text-[#0D3B66]" : "text-slate-500 hover:text-slate-700"}`}
        >
          <Building2 className="h-4 w-4" />
          Grandes familles
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-xs font-semibold text-slate-600">
            {grandesFamilles.length}
          </span>
        </button>
        <button
          onClick={() => setTab("familles")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${tab === "familles" ? "bg-white shadow-sm text-[#0D3B66]" : "text-slate-500 hover:text-slate-700"}`}
        >
          <Landmark className="h-4 w-4" />
          Lignées
          {sansChefFamille > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700">
              {sansChefFamille}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("autorites")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${tab === "autorites" ? "bg-white shadow-sm text-[#0D3B66]" : "text-slate-500 hover:text-slate-700"}`}
        >
          <Crown className="h-4 w-4" />
          Autorités coutumières
          {sansChefAutorite > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700">
              {sansChefAutorite}
            </span>
          )}
        </button>
      </div>

      {/* ══ Onglet Grandes familles ════════════════════════════════════════════ */}
      {tab === "grandesfamilles" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Chaque grande famille regroupe une ou plusieurs lignées, elles-mêmes composées d&apos;attributaires primaires et leurs collectifs d&apos;ayants-droit.
            </p>
            <button
              onClick={() => setShowCreerGF(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#0D3B66] px-3 py-2 text-sm font-semibold text-[#0D3B66] transition hover:bg-[#0D3B66] hover:text-white"
            >
              <Plus className="h-4 w-4" />
              Nouvelle
            </button>
          </div>

          {grandesFamillesLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">Chargement…</div>
          ) : grandesFamilles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-2xl border border-dashed border-slate-200">
              <Building2 className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-400">Aucune grande famille créée.</p>
              <button
                onClick={() => setShowCreerGF(true)}
                className="rounded-xl bg-[#0D3B66] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1E6091]"
              >
                Créer la première grande famille
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {grandesFamilles.map((gf) => (
                <div key={gf.id} className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
                  <div className="border-b border-slate-100 bg-indigo-50/30 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-indigo-600" />
                      <p className="font-bold text-[#0D3B66]">{gf.nom}</p>
                    </div>
                    {gf.description && <p className="mt-0.5 text-xs text-slate-400">{gf.description}</p>}
                    <p className="mt-1 text-xs text-indigo-600 font-medium">{gf.lignees.length} lignée{gf.lignees.length !== 1 ? "s" : ""}</p>
                  </div>
                  {gf.lignees.length > 0 ? (
                    <ul className="divide-y divide-slate-100">
                      {gf.lignees.map((l) => (
                        <li key={l.id}>
                          {/* Lignée de premier niveau */}
                          <div className="flex items-center gap-3 px-5 py-3.5">
                            <Landmark className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800">{l.nom}</p>
                              {l.chef_profile ? (
                                <p className="text-xs text-emerald-600 font-medium">{l.chef_profile.nom_complet}</p>
                              ) : l.chef_de_famille ? (
                                <p className="text-xs text-slate-400">{l.chef_de_famille} <span className="text-amber-500">· sans compte</span></p>
                              ) : (
                                <p className="text-xs text-amber-600">Sans chef lié</p>
                              )}
                              {l.sous_lignees.length > 0 && (
                                <p className="text-xs text-indigo-400">{l.sous_lignees.length} sous-lignée{l.sous_lignees.length > 1 ? "s" : ""}</p>
                              )}
                            </div>
                            <button
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
                              className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#0D3B66] transition hover:bg-[#0D3B66]/8 border border-[#0D3B66]/20"
                            >
                              {l.chef_profile_id ? "Modifier" : "Désigner"}
                            </button>
                          </div>
                          {/* Sous-lignées */}
                          {l.sous_lignees.length > 0 && (
                            <ul className="border-t border-slate-100 bg-slate-50/60">
                              {l.sous_lignees.map((sl) => (
                                <li key={sl.id} className="flex items-center gap-3 py-2.5 pr-5 pl-10">
                                  <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-slate-700">{sl.nom}</p>
                                    {sl.chef_profile ? (
                                      <p className="text-xs text-emerald-600">{sl.chef_profile.nom_complet}</p>
                                    ) : sl.chef_de_famille ? (
                                      <p className="text-xs text-slate-400">{sl.chef_de_famille} <span className="text-amber-500">· sans compte</span></p>
                                    ) : (
                                      <p className="text-xs text-amber-500">Sans chef</p>
                                    )}
                                  </div>
                                  <button
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
                                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-200 border border-slate-200"
                                  >
                                    {sl.chef_profile_id ? "Modifier" : "Désigner"}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-5 py-4 text-sm text-slate-400 italic">Aucune lignée liée — allez dans l&apos;onglet Lignées pour les rattacher.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══ Onglet Lignées (familles) ═════════════════════════════════════════ */}
      {tab === "familles" && (
        <>
          {!famillesLoading && sansChefFamille > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {sansChefFamille} lignée{sansChefFamille > 1 ? "s" : ""} sans compte chef lié
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Les demandes d&apos;intérêt sur ces lignées n&apos;atteindront que les admins.
                </p>
              </div>
            </div>
          )}

          {!famillesLoading && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lignées totales</p>
                <p className="mt-1 text-2xl font-bold text-[#0D3B66]">{familles.length}</p>
              </div>
              <div className="rounded-2xl border border-indigo-200/60 bg-indigo-50/50 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Rattachées</p>
                <p className="mt-1 text-2xl font-bold text-indigo-700">{familles.length - sansGrandeFamille}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Chef lié</p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">{familles.length - sansChefFamille}</p>
              </div>
              <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Sans chef lié</p>
                <p className="mt-1 text-2xl font-bold text-amber-700">{sansChefFamille}</p>
              </div>
            </div>
          )}

          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Rechercher une lignée…" className="pl-9" value={searchFamilles} onChange={(e) => setSearchFamilles(e.target.value)} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
            {famillesLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-400">Chargement…</div>
            ) : filteredFamilles.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Users className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-400">Aucune lignée trouvée.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3">Lignée</th>
                    <th className="px-5 py-3">Rattachement</th>
                    <th className="px-5 py-3">Collectif d&apos;ayants-droit</th>
                    <th className="px-5 py-3">Chef (registre)</th>
                    <th className="px-5 py-3">Compte lié</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFamilles.map((f) => (
                    <tr key={f.id} className="transition hover:bg-slate-50/50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {f.lignee_id && <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />}
                          <p className={`font-medium text-slate-800 ${f.lignee_id ? "text-sm" : ""}`}>{f.nom}</p>
                        </div>
                      </td>
                      {/* Colonne Rattachement : grande famille et/ou lignée parente */}
                      <td className="px-5 py-3.5">
                        {f.lignee ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-xs text-indigo-600">
                              <Building2 className="h-3 w-3" />
                              {f.grande_famille?.nom ?? "—"}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Landmark className="h-3 w-3" />
                              {f.lignee.nom}
                            </div>
                          </div>
                        ) : f.grande_famille ? (
                          <button
                            onClick={() => setModalGrandeFamille(f)}
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                          >
                            <Building2 className="h-3 w-3" />
                            {f.grande_famille.nom}
                          </button>
                        ) : (
                          <button
                            onClick={() => setModalGrandeFamille(f)}
                            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-500 transition hover:bg-indigo-100"
                          >
                            <Link2 className="h-3 w-3" /> Rattacher
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {f.collectif ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                              <Link2 className="h-3 w-3" />
                            </div>
                            <div>
                              <p className="truncate text-sm font-medium text-slate-800">{f.collectif.nom}</p>
                              <button
                                onClick={() => setModalCollectif(f)}
                                className="text-xs text-slate-400 underline-offset-2 hover:text-[#1E6091] hover:underline"
                              >
                                Modifier
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setModalCollectif(f)}
                            className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-100"
                          >
                            <Link2 className="h-3 w-3" /> Lier
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {f.chef_de_famille ?? <span className="text-slate-300">—</span>}
                        {f.contact && <p className="text-xs text-slate-400">{f.contact}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        {f.chef_profile ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                              <UserCheck className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">{f.chef_profile.nom_complet}</p>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${GROUPE_BADGE[f.chef_profile.groupe] ?? "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                                {GROUPE_LABELS[f.chef_profile.groupe] ?? f.chef_profile.groupe}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            <AlertTriangle className="h-3 w-3" /> Non lié
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setModalFamille(f)}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-[#0D3B66]"
                        >
                          {f.chef_profile ? "Modifier" : "Désigner"}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ══ Onglet Autorités coutumières ════════════════════════════════════ */}
      {tab === "autorites" && (
        <>
          {!autoritesLoading && sansChefAutorite > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {sansChefAutorite} autorité{sansChefAutorite > 1 ? "s" : ""} sans compte chef de village lié
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Les validations de ces chefferies ne pourront pas être routées vers un compte numérique.
                </p>
              </div>
            </div>
          )}

          {!autoritesLoading && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Autorités totales</p>
                <p className="mt-1 text-2xl font-bold text-[#0D3B66]">{autorites.length}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Chef lié</p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">{autorites.length - sansChefAutorite}</p>
              </div>
              <div className="col-span-2 rounded-2xl border border-amber-200/60 bg-amber-50/50 p-4 shadow-sm sm:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Sans chef lié</p>
                <p className="mt-1 text-2xl font-bold text-amber-700">{sansChefAutorite}</p>
              </div>
            </div>
          )}

          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Rechercher une autorité ou un village…" className="pl-9" value={searchAutorites} onChange={(e) => setSearchAutorites(e.target.value)} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
            {autoritesLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-400">Chargement…</div>
            ) : filteredAutorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Crown className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-400">Aucune autorité coutumière trouvée.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3">Autorité</th>
                    <th className="px-5 py-3">Chef (registre)</th>
                    <th className="px-5 py-3">Compte(s) lié(s)</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAutorites.map((a) => (
                    <tr key={a.id} className="transition hover:bg-slate-50/50">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800">{a.nom}</p>
                        {a.village && <p className="mt-0.5 text-xs text-slate-400">{a.village}</p>}
                        {a.type && <p className="text-xs text-slate-400">{a.type}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {a.chef ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {a.chefs_profils.length > 0 ? (
                          <div className="space-y-1">
                            {a.chefs_profils.map((c) => (
                              <div key={c.id} className="flex items-center gap-2">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                                  <Crown className="h-3 w-3" />
                                </div>
                                <span className="text-sm font-medium text-slate-800">{c.nom_complet}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            <AlertTriangle className="h-3 w-3" /> Non lié
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setModalAutorite(a)}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-[#0D3B66]"
                        >
                          {a.chefs_profils.length > 0 ? "Gérer" : "Désigner"}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {showCreerGF && (
        <CreerGrandeFamilleModal
          onClose={() => setShowCreerGF(false)}
          onSuccess={() => { setShowCreerGF(false); void fetchGrandesFamilles(); }}
        />
      )}

      {modalGrandeFamille && (
        <LierGrandeFamilleModal
          famille={modalGrandeFamille}
          grandesFamilles={grandesFamilles}
          onClose={() => setModalGrandeFamille(null)}
          onSuccess={() => { setModalGrandeFamille(null); void fetchFamilles(); void fetchGrandesFamilles(); }}
        />
      )}

      {modalCollectif && (
        <LierCollectifModal
          famille={modalCollectif}
          onClose={() => setModalCollectif(null)}
          onSuccess={() => { setModalCollectif(null); void fetchFamilles(); }}
        />
      )}

      {modalFamille && (
        <DesignerChefFamilleModal
          famille={modalFamille}
          onClose={() => setModalFamille(null)}
          onSuccess={() => { setModalFamille(null); void fetchFamilles(); void fetchGrandesFamilles(); }}
        />
      )}

      {modalAutorite && (
        <DesignerChefVillageModal
          autorite={modalAutorite}
          onClose={() => setModalAutorite(null)}
          onSuccess={() => { setModalAutorite(null); void fetchAutorites(); }}
        />
      )}
    </div>
  );
}
