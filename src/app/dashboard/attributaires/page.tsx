"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useChargement } from "@/hooks/useChargement";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { BoutonImprimer } from "@/components/dashboard/BoutonImprimer";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Building2, ChevronRight, Mail, MapPin, Phone, Plus, Search, User, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AttributaireRecord = {
  id: string;
  nom: string | null;
  type: string | null;
  piece_nature: string | null;
  piece_num: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
};

type AttributaireLot = {
  qualite: string | null;
  actuel: boolean | null;
  depuis: string | null;
  lots?: {
    id?: string | null;
    numero_lot?: string | null;
    statut?: string | null;
    superficie_m2?: number | null;
    ilots?: {
      numero?: string | null;
      lotissements?: { nom?: string | null } | null;
    } | null;
  } | null;
};

type FormState = {
  type: string;
  nom: string;
  piece_nature: string;
  piece_num: string;
  telephone: string;
  email: string;
  adresse: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: "personne_physique", label: "Personne physique" },
  { value: "collectif_ayants_droit", label: "Collectif d'ayants droit" },
  { value: "personne_morale", label: "Personne morale" },
];

const QUALITE_LABELS: Record<string, string> = {
  ayant_droit: "Propriétaire d'origine",
  ayant_droit_transmission: "Ayant-droit par transmission",
  acquereur: "Acquéreur",
  operateur: "Opérateur",
  entrepreneur: "Entrepreneur",
  reservataire: "Réservataire",
};

const STATUT_BADGE: Record<string, "disponible" | "attribue" | "en_validation" | "litige"> = {
  libre: "disponible", reserve_equipement: "en_validation",
  attribue: "attribue", occupe: "attribue", vendu: "attribue",
  en_litige: "litige",
};

const TABLE_HEADERS = ["Nom & Prénoms", "Type de profil", "Pièce d'identité", "Statut KYC", "Actions"] as const;

const EMPTY_FORM: FormState = {
  type: "personne_physique",
  nom: "",
  piece_nature: "",
  piece_num: "",
  telephone: "",
  email: "",
  adresse: "",
};

// ─── Fiche Attributaire Modal ─────────────────────────────────────────────────

function AttributaireDetailModal({ attributaire, lots, onClose }: {
  attributaire: AttributaireRecord;
  lots: AttributaireLot[];
  onClose: () => void;
}) {
  const isValidated = Boolean(attributaire.piece_num);
  const lotsActuels = lots.filter((l) => l.actuel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-y-auto rounded-[1.75rem] border border-slate-200/70 bg-white shadow-2xl" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0D3B66]/8 text-[#0D3B66]">
              <User className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Fiche attributaire</p>
              <h2 className="mt-0.5 text-xl font-semibold text-[#0D3B66]">{attributaire.nom ?? "—"}</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {TYPE_OPTIONS.find((o) => o.value === attributaire.type)?.label ?? "Personne physique"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge status={isValidated ? "disponible" : "en_validation"}>
              {isValidated ? "KYC Validé" : "KYC en attente"}
            </Badge>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          {/* Identité */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Identité & Contact</p>
            <div className="space-y-2">
              {attributaire.piece_nature && (
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <User className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">{attributaire.piece_nature}</p>
                    <p className="text-sm font-semibold text-slate-700">{attributaire.piece_num ?? "N/A"}</p>
                  </div>
                </div>
              )}
              {attributaire.telephone && (
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <p className="text-sm text-slate-700">{attributaire.telephone}</p>
                </div>
              )}
              {attributaire.email && (
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <p className="text-sm text-slate-700">{attributaire.email}</p>
                </div>
              )}
              {attributaire.adresse && (
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <p className="text-sm text-slate-700">{attributaire.adresse}</p>
                </div>
              )}
              {!attributaire.piece_nature && !attributaire.telephone && !attributaire.email && !attributaire.adresse && (
                <p className="text-sm text-slate-400 italic">Aucun contact renseigné.</p>
              )}
            </div>
          </section>

          {/* Lots */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
              Lots attribués <span className="ml-1 rounded-full bg-[#0D3B66]/8 px-2 py-0.5 text-[#0D3B66]">{lotsActuels.length}</span>
            </p>
            {lots.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Aucun lot attribué à cet attributaire.
              </div>
            ) : (
              <div className="space-y-2">
                {lots.map((attr, i) => {
                  const lot = attr.lots;
                  const statut = lot?.statut ?? "libre";
                  const badgeStatus = STATUT_BADGE[statut] ?? "disponible";
                  const badgeLabel = { disponible: "Disponible", attribue: "Attribué", en_validation: "Équipement", litige: "Litige" }[badgeStatus];

                  return (
                    <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-white px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F8FAFC]">
                          <Building2 className="h-4 w-4 text-[#1E6091]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            Lot {lot?.numero_lot ?? "—"}
                            <span className="ml-1.5 text-xs font-normal text-slate-400">
                              {attr.actuel ? "· Actuel" : "· Historique"}
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {lot?.ilots?.lotissements?.nom ?? "—"}
                            {lot?.ilots?.numero && ` · Îlot ${lot.ilots.numero}`}
                            {lot?.superficie_m2 && ` · ${Number(lot.superficie_m2).toLocaleString("fr-FR")} m²`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {attr.qualite && (
                          <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 sm:inline">
                            {QUALITE_LABELS[attr.qualite] ?? attr.qualite}
                          </span>
                        )}
                        <Badge status={badgeStatus}>{badgeLabel}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AttributairesPage() {
  const supabase = createClient();
  useProfile();

  const [attributaires, setAttributaires] = useState<AttributaireRecord[]>([]);

  const [search, setSearch] = useState("");

  // Create modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Detail modal
  const [detailAttributaire, setDetailAttributaire] = useState<AttributaireRecord | null>(null);
  const [attributaireLots, setAttributaireLots] = useState<AttributaireLot[]>([]);

  const loadAttributaires = async () => {
    const { data } = await supabase
      .from("attributaires")
      .select("id, nom, type, piece_nature, piece_num, telephone, email, adresse")
      .order("nom", { ascending: true });
    if (data) setAttributaires(data as AttributaireRecord[]);
  };

  const { isLoading: dataLoading, recharger } = useChargement(loadAttributaires);

  // Load lots when detail opens (le modal n'est pas rendu quand detailAttributaire
  // est null, une liste résiduelle est donc sans effet — pas de reset synchrone).
  useEffect(() => {
    if (!detailAttributaire) return;
    supabase
      .from("attributions")
      .select("qualite, actuel, depuis, lots(id, numero_lot, statut, superficie_m2, ilots(numero, lotissements(nom)))")
      .eq("attributaire_id", detailAttributaire.id)
      .order("actuel", { ascending: false })
      .then(({ data }) => setAttributaireLots((data ?? []) as unknown as AttributaireLot[]));
  }, [detailAttributaire]);

  const filtered = attributaires.filter((a) => {
    const q = search.toLowerCase();
    return !q || (a.nom ?? "").toLowerCase().includes(q) || (a.piece_num ?? "").toLowerCase().includes(q);
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.nom.trim()) {
      setErrorMessage("Le nom est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase.from("attributaires").insert([{
      nom: form.nom.trim(),
      type: form.type as "personne_physique" | "collectif_ayants_droit" | "personne_morale",
      piece_nature: form.piece_nature.trim() || null,
      piece_num: form.piece_num.trim() || null,
      telephone: form.telephone.trim() || null,
      email: form.email.trim() || null,
      adresse: form.adresse.trim() || null,
    }]);

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setForm(EMPTY_FORM);
    setIsModalOpen(false);
    setIsSubmitting(false);
    setSuccessMessage("Attributaire enregistré avec succès.");
    setTimeout(() => setSuccessMessage(null), 4000);
    await recharger();
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* En-tête */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-primary">Gestion des Attributaires</h1>
          <p className="mt-1.5 text-sm sm:text-base text-slate-500">
            Registre officiel des attributaires, suivi des identités et des droits fonciers rattachés.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BoutonImprimer />
          <button type="button" onClick={() => { setIsModalOpen(true); setErrorMessage(null); setSuccessMessage(null); }}
            className="print:hidden inline-flex items-center gap-2 rounded-full bg-[#0D3B66] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-300 hover:bg-[#1E6091] hover:shadow-md active:scale-[0.98]">
            <Plus className="h-4 w-4" />
            Nouvel Attributaire
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 rounded-2xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{successMessage}</div>
      )}

      {/* Recherche */}
      <div className="print:hidden mb-6">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input type="search" placeholder="Rechercher un attributaire, un numéro de pièce…" className="pl-9"
            value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher un attributaire" />
        </div>
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white print:overflow-visible print:rounded-none print:border-none">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/50">
                {TABLE_HEADERS.map((header) => (
                  <th key={header} scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 last:text-right print:last:hidden">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {dataLoading ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">Chargement des attributaires…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">Aucun attributaire enregistré.</td></tr>
              ) : (
                filtered.map((item) => {
                  const isValidated = Boolean(item.piece_num);
                  return (
                    <tr key={item.id} className="cursor-pointer transition-colors hover:bg-slate-50/60" onClick={() => { setAttributaireLots([]); setDetailAttributaire(item); }}>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-800">{item.nom || "N/A"}</p>
                        {item.email && <p className="mt-0.5 text-xs text-slate-400">{item.email}</p>}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {TYPE_OPTIONS.find((o) => o.value === item.type)?.label ?? "Personne physique"}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {item.piece_nature ? `${item.piece_nature} — ${item.piece_num || "N/A"}` : "Non renseignée"}
                      </td>
                      <td className="px-5 py-4">
                        <Badge status={isValidated ? "disponible" : "en_validation"}>
                          {isValidated ? "Validé" : "En validation"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right print:hidden">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setAttributaireLots([]); setDetailAttributaire(item); }}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#0D3B66]"
                        >
                          Voir la fiche
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal création attributaire */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Nouvel attributaire</p>
                <h2 className="mt-2 text-xl font-semibold text-[#0D3B66]">Enregistrer un attributaire</h2>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {/* Type */}
              <div className="space-y-1.5">
                <label htmlFor="attrib-type" className="text-sm font-medium text-slate-700">Type d&apos;attributaire</label>
                <select id="attrib-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10">
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Nom */}
              <div className="space-y-1.5">
                <label htmlFor="attrib-nom" className="text-sm font-medium text-slate-700">Nom complet <span className="text-red-500">*</span></label>
                <Input id="attrib-nom" type="text" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} placeholder="Ex. Kouassi Yao Bernard" required />
              </div>

              {/* Pièce d'identité */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="attrib-piece-nature" className="text-sm font-medium text-slate-700">Nature de la pièce</label>
                  <Input id="attrib-piece-nature" type="text" value={form.piece_nature} onChange={(e) => setForm((f) => ({ ...f, piece_nature: e.target.value }))} placeholder="CNI, Passeport…" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="attrib-piece-num" className="text-sm font-medium text-slate-700">Numéro de pièce</label>
                  <Input id="attrib-piece-num" type="text" value={form.piece_num} onChange={(e) => setForm((f) => ({ ...f, piece_num: e.target.value }))} placeholder="CI-AB-2024-12345" />
                </div>
              </div>

              {/* Téléphone + Email */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="attrib-tel" className="text-sm font-medium text-slate-700">Téléphone</label>
                  <Input id="attrib-tel" type="tel" value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} placeholder="+225 07 00 00 00" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="attrib-email" className="text-sm font-medium text-slate-700">E-mail</label>
                  <Input id="attrib-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="exemple@mail.com" />
                </div>
              </div>

              {/* Adresse */}
              <div className="space-y-1.5">
                <label htmlFor="attrib-adresse" className="text-sm font-medium text-slate-700">Adresse</label>
                <Input id="attrib-adresse" type="text" value={form.adresse} onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))} placeholder="Ex. Anyama, Ebimpe" />
              </div>

              {errorMessage && (
                <div className="rounded-2xl border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</div>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Annuler</button>
                <button type="submit" disabled={isSubmitting} className="rounded-full bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E6091] disabled:opacity-70">
                  {isSubmitting ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fiche attributaire */}
      {detailAttributaire && (
        <AttributaireDetailModal
          attributaire={detailAttributaire}
          lots={attributaireLots}
          onClose={() => setDetailAttributaire(null)}
        />
      )}
    </div>
  );
}
