"use client";

import { type FormEvent, useState } from "react";
import { Building2, IdCard, Link2, Phone, Pencil, Plus, Ruler, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { useChargement } from "@/hooks/useChargement";
import { createClient } from "@/utils/supabase/client";

// ─── Types ──────────────────────────────────────────────────────────────────

type GeometreRecord = {
  id: string;
  nom: string;
  numero_ordre: string | null;
  cabinet: string | null;
  contact: string | null;
};

type ProfileOption = {
  id: string;
  nom_complet: string;
  geometre_id: string | null;
};

type FormState = {
  nom: string;
  numero_ordre: string;
  cabinet: string;
  contact: string;
  profile_id: string;
};

const EMPTY_FORM: FormState = {
  nom: "",
  numero_ordre: "",
  cabinet: "",
  contact: "",
  profile_id: "",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GeometresExpertsPage() {
  const supabase = createClient();

  const [geometres, setGeometres] = useState<GeometreRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    const [{ data: g }, { data: p }] = await Promise.all([
      supabase.from("geometres_experts").select("id, nom, numero_ordre, cabinet, contact").order("nom"),
      supabase.from("profiles").select("id, nom_complet, geometre_id").eq("groupe", "geometre"),
    ]);
    setGeometres((g ?? []) as GeometreRecord[]);
    setProfiles((p ?? []) as ProfileOption[]);
  };

  const { isLoading: loading, recharger } = useChargement(load);

  const comptePourGeometre = (geometreId: string) => profiles.find((p) => p.geometre_id === geometreId) ?? null;

  const filtered = geometres.filter((g) => {
    const q = search.toLowerCase();
    return (
      !q ||
      g.nom.toLowerCase().includes(q) ||
      (g.numero_ordre ?? "").toLowerCase().includes(q) ||
      (g.cabinet ?? "").toLowerCase().includes(q)
    );
  });

  // ── Modal création / édition ──────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEdit = (g: GeometreRecord) => {
    const compte = comptePourGeometre(g.id);
    setEditingId(g.id);
    setForm({
      nom: g.nom,
      numero_ordre: g.numero_ordre ?? "",
      cabinet: g.cabinet ?? "",
      contact: g.contact ?? "",
      profile_id: compte?.id ?? "",
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim()) {
      setErrorMessage("Le nom du géomètre-expert est obligatoire.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      nom: form.nom.trim(),
      numero_ordre: form.numero_ordre.trim() || null,
      cabinet: form.cabinet.trim() || null,
      contact: form.contact.trim() || null,
    };

    let geometreId = editingId;
    if (editingId) {
      const { error } = await supabase.from("geometres_experts").update(payload).eq("id", editingId);
      if (error) {
        setIsSubmitting(false);
        setErrorMessage(error.message);
        return;
      }
    } else {
      const { data, error } = await supabase.from("geometres_experts").insert(payload).select("id").single();
      if (error || !data) {
        setIsSubmitting(false);
        setErrorMessage(error?.message ?? "Échec de la création.");
        return;
      }
      geometreId = data.id;
    }

    // Compte lié : détache l'ancien compte (s'il change) puis rattache le nouveau.
    const compteActuel = editingId ? comptePourGeometre(editingId) : null;
    if (compteActuel && compteActuel.id !== form.profile_id) {
      await supabase.from("profiles").update({ geometre_id: null }).eq("id", compteActuel.id);
    }
    if (form.profile_id) {
      const { error: linkError } = await supabase
        .from("profiles")
        .update({ geometre_id: geometreId })
        .eq("id", form.profile_id);
      if (linkError) {
        setIsSubmitting(false);
        setErrorMessage(`Enregistré, mais échec de la liaison au compte : ${linkError.message}`);
        return;
      }
    }

    setIsSubmitting(false);
    setIsModalOpen(false);
    void recharger();
  };

  // Comptes géomètre disponibles pour la liaison : non liés + celui déjà lié à la fiche en cours d'édition.
  const comptesDisponibles = profiles.filter((p) => !p.geometre_id || p.id === form.profile_id);

  return (
    <div className="mx-auto max-w-6xl p-6 sm:p-8">
      {/* En-tête */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Réseau partenaires</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#0D3B66]">Géomètres-experts</h1>
          <p className="mt-1.5 text-sm sm:text-base text-slate-500">
            Registre des géomètres-experts partenaires : numéro d&apos;ordre, cabinet et compte SGNF associé.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#0D3B66] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-300 hover:bg-[#1E6091] hover:shadow-md active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Nouveau géomètre-expert
        </button>
      </div>

      {/* Recherche */}
      <div className="mb-6">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Rechercher un nom, un numéro d'ordre, un cabinet…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-10 text-center text-sm text-slate-400">
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-10 text-center text-sm text-slate-500">
          {geometres.length === 0
            ? "Aucun géomètre-expert enregistré. Cliquez sur « Nouveau géomètre-expert » pour commencer."
            : "Aucun résultat pour cette recherche."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((g) => {
            const compte = comptePourGeometre(g.id);
            return (
              <div
                key={g.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0D3B66]/10">
                    <Ruler className="h-4.5 w-4.5 text-[#0D3B66]" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{g.nom}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      {g.numero_ordre && (
                        <span className="inline-flex items-center gap-1">
                          <IdCard className="h-3 w-3" /> {g.numero_ordre}
                        </span>
                      )}
                      {g.cabinet && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {g.cabinet}
                        </span>
                      )}
                      {g.contact && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {g.contact}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {compte ? (
                    <Badge status="disponible">
                      <Link2 className="h-3 w-3" /> {compte.nom_complet}
                    </Badge>
                  ) : (
                    <Badge status="en_validation">Aucun compte lié</Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(g)}
                    title="Modifier"
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Modifier
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal création / édition */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
                  {editingId ? "Modifier la fiche" : "Nouveau géomètre-expert"}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[#0D3B66]">
                  {editingId ? "Mettre à jour le géomètre-expert" : "Enregistrer un géomètre-expert"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label htmlFor="geo-nom" className="text-sm font-medium text-slate-700">
                  Nom complet <span className="text-red-500">*</span>
                </label>
                <Input
                  id="geo-nom"
                  type="text"
                  value={form.nom}
                  onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                  placeholder="Ex. Kouamé N'Guessan, Géomètre-Expert"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="geo-numero-ordre" className="text-sm font-medium text-slate-700">
                    Numéro d&apos;ordre
                  </label>
                  <Input
                    id="geo-numero-ordre"
                    type="text"
                    value={form.numero_ordre}
                    onChange={(e) => setForm((f) => ({ ...f, numero_ordre: e.target.value }))}
                    placeholder="Ex. OGEF-CI-0042"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="geo-contact" className="text-sm font-medium text-slate-700">
                    Contact
                  </label>
                  <Input
                    id="geo-contact"
                    type="text"
                    value={form.contact}
                    onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                    placeholder="+225 07 00 00 00 00"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="geo-cabinet" className="text-sm font-medium text-slate-700">
                  Cabinet
                </label>
                <Input
                  id="geo-cabinet"
                  type="text"
                  value={form.cabinet}
                  onChange={(e) => setForm((f) => ({ ...f, cabinet: e.target.value }))}
                  placeholder="Ex. Cabinet Kouamé & Associés"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="geo-compte" className="text-sm font-medium text-slate-700">
                  Compte SGNF lié
                </label>
                <select
                  id="geo-compte"
                  value={form.profile_id}
                  onChange={(e) => setForm((f) => ({ ...f, profile_id: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                >
                  <option value="">Aucun compte lié</option>
                  {comptesDisponibles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom_complet}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400">
                  Rattache cette fiche à un compte « géomètre » existant — il verra alors son propre nom, cabinet et
                  numéro d&apos;ordre dans son espace dédié.
                </p>
              </div>

              {errorMessage && (
                <div className="rounded-2xl border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E6091] disabled:opacity-70"
                >
                  {isSubmitting ? "Enregistrement…" : editingId ? "Mettre à jour" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
