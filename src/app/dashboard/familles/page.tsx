"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Users, UserCheck, AlertTriangle, Search, X, Check, UserPlus, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/Input";
import SGFNButton from "@/components/ui/SGFNButton";
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
  lignee: string | null;
  chef_profile_id: string | null;
  chef_profile: ChefProfile | null;
};

type ProfilePicker = {
  id: string;
  nom_complet: string;
  groupe: string;
  telephone: string | null;
  famille_id: string | null;
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

// ─── Modal de désignation ─────────────────────────────────────────────────────

function DesignerModal({
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
        .select("id, nom_complet, groupe, telephone, famille_id")
        .order("nom_complet");
      setProfiles((data ?? []) as ProfilePicker[]);
      setLoading(false);
    };
    void load();
  }, []);

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      p.nom_complet.toLowerCase().includes(q) ||
      (GROUPE_LABELS[p.groupe] ?? p.groupe).toLowerCase().includes(q)
    );
  });

  const handleDesigner = async (profile: ProfilePicker) => {
    setSaving(profile.id);
    setError("");

    // 1. Mettre à jour chef_profile_id sur la famille
    const { error: e1 } = await supabase
      .from("familles")
      .update({ chef_profile_id: profile.id })
      .eq("id", famille.id);

    if (e1) {
      setError(e1.message);
      setSaving(null);
      return;
    }

    // 2. Lier le profil à cette famille si pas déjà fait
    if (!profile.famille_id) {
      await supabase
        .from("profiles")
        .update({ famille_id: famille.id })
        .eq("id", profile.id);
    }

    setSaving(null);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div
        className="w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white shadow-2xl"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
              Désigner un chef de famille
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#0D3B66]">
              {famille.nom}
            </h2>
            {famille.chef_de_famille && (
              <p className="mt-0.5 text-xs text-slate-400">
                Chef enregistré : {famille.chef_de_famille}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Recherche */}
        <div className="border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              autoFocus
              placeholder="Rechercher un profil par nom ou rôle…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Liste */}
        <div className="overflow-y-auto" style={{ maxHeight: "50vh" }}>
          {error && (
            <p className="px-4 py-2 text-sm text-red-600">{error}</p>
          )}
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              Chargement…
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              Aucun profil trouvé.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const isCurrentChef = p.id === famille.chef_profile_id;
                const alreadyLinked =
                  p.famille_id && p.famille_id !== famille.id;
                return (
                  <li
                    key={p.id}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${
                      isCurrentChef ? "bg-emerald-50/60" : "hover:bg-slate-50"
                    }`}
                  >
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
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            GROUPE_BADGE[p.groupe] ??
                            "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {GROUPE_LABELS[p.groupe] ?? p.groupe}
                        </span>
                        {p.telephone && (
                          <span className="text-xs text-slate-400">
                            {p.telephone}
                          </span>
                        )}
                        {alreadyLinked && (
                          <span className="text-xs text-amber-600">
                            · lié à une autre famille
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDesigner(p)}
                      disabled={saving === p.id || isCurrentChef}
                      className="shrink-0 rounded-xl border border-[#0D3B66] px-3 py-1.5 text-xs font-semibold text-[#0D3B66] transition hover:bg-[#0D3B66] hover:text-white disabled:cursor-default disabled:opacity-40"
                    >
                      {saving === p.id
                        ? "…"
                        : isCurrentChef
                        ? "Désigné"
                        : "Désigner"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-400">
            {filtered.length} profil{filtered.length !== 1 ? "s" : ""}
          </p>
          <Link
            href="/dashboard/invitations"
            className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Inviter un chef
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function FamillesPage() {
  const supabase = createClient();
  const [familles, setFamilles] = useState<Famille[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalFamille, setModalFamille] = useState<Famille | null>(null);

  const fetchFamilles = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("familles")
      .select(
        "id, nom, chef_de_famille, contact, lignee, chef_profile_id, chef_profile:profiles!familles_chef_profile_id_fkey(id, nom_complet, groupe, telephone)"
      )
      .order("nom");
    setFamilles((data ?? []) as unknown as Famille[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchFamilles();
  }, [fetchFamilles]);

  const sansChef = familles.filter((f) => !f.chef_profile_id).length;

  const filtered = familles.filter((f) => {
    const q = search.toLowerCase();
    return (
      !q ||
      f.nom.toLowerCase().includes(q) ||
      (f.chef_de_famille ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Familles &amp; Chefs désignés
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Désignez le compte numérique du chef de chaque famille pour activer
            le routage des intérêts fonciers.
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

      {/* Bandeau d'alerte gap */}
      {!loading && sansChef > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {sansChef} famille{sansChef > 1 ? "s" : ""} sans compte chef lié
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Les demandes d&apos;intérêt sur ces familles n&apos;atteindront
              que les admins. Invitez et désignez un chef pour chaque famille.
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Familles totales
            </p>
            <p className="mt-1 text-2xl font-bold text-[#0D3B66]">
              {familles.length}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Chef lié
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">
              {familles.length - sansChef}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-4 shadow-sm col-span-2 sm:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
              Sans chef lié
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{sansChef}</p>
          </div>
        </div>
      )}

      {/* Recherche */}
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Rechercher une famille…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Users className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400">Aucune famille trouvée.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3">Famille</th>
                <th className="px-5 py-3">Chef (registre)</th>
                <th className="px-5 py-3">Compte lié</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((f) => (
                <tr key={f.id} className="transition hover:bg-slate-50/50">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-800">{f.nom}</p>
                    {f.lignee && (
                      <p className="mt-0.5 text-xs text-slate-400">{f.lignee}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {f.chef_de_famille ?? (
                      <span className="text-slate-300">—</span>
                    )}
                    {f.contact && (
                      <p className="text-xs text-slate-400">{f.contact}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {f.chef_profile ? (
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <UserCheck className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {f.chef_profile.nom_complet}
                          </p>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              GROUPE_BADGE[f.chef_profile.groupe] ??
                              "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {GROUPE_LABELS[f.chef_profile.groupe] ??
                              f.chef_profile.groupe}
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

      {/* Modal de désignation */}
      {modalFamille && (
        <DesignerModal
          famille={modalFamille}
          onClose={() => setModalFamille(null)}
          onSuccess={() => {
            setModalFamille(null);
            void fetchFamilles();
          }}
        />
      )}
    </div>
  );
}
