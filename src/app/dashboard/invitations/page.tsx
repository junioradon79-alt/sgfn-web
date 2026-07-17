"use client";

import { useEffect, useState } from "react";
import { useChargement } from "@/hooks/useChargement";
import { createClient } from "@/utils/supabase/client";
import type { Database } from "../../../../database.types";
import SGNFButton from "@/components/ui/SGNFButton";
import { Input } from "@/components/ui/Input";
import { UserPlus, Copy, Check, X } from "lucide-react";

const GROUPES = [
  // Rôle legacy « Propriétaire » (par achat) déprécié → fondu dans « Propriétaire terrien ».
  { value: "proprietaire_terrien", label: "Propriétaire terrien" },
  { value: "acquereur", label: "Acquéreur" },
  { value: "commissaire", label: "Commissaire" },
  { value: "chefferie", label: "Chefferie" },
  { value: "geometre", label: "Géomètre" },
  { value: "verificateur", label: "Vérificateur" },
  // « Aménageur » fusionné dans « Opérateur » (même métier côté foncier).
  { value: "operateur", label: "Opérateur / Aménageur" },
];

const STATUT_STYLES: Record<string, string> = {
  en_attente: "bg-amber-50 text-amber-700 border border-amber-200",
  utilisee: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  revoquee: "bg-red-50 text-red-600 border border-red-200",
  expiree: "bg-slate-100 text-slate-500 border border-slate-200",
};

const STATUT_LABELS: Record<string, string> = {
  en_attente: "En attente",
  utilisee: "Utilisée",
  revoquee: "Révoquée",
  expiree: "Expirée",
};

const GROUPES_ATTRIBUTAIRE_REQUIS = ["proprietaire", "acquereur"];
const GROUPES_AUTORITE_REQUIS = ["chefferie"];
const GROUPES_FAMILLE_REQUIS = ["proprietaire_terrien"];

type Attributaire = {
  id: string;
  nom: string;
};

type Autorite = {
  id: string;
  nom: string;
};

type Famille = {
  id: string;
  nom: string;
};

type Invitation = {
  id: string;
  code: string;
  groupe: string;
  nom_complet: string | null;
  email: string | null;
  statut: string;
  cree_le: string;
  expire_le: string;
  utilisee_le: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      title="Copier le code"
      className="ml-1 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export default function InvitationsPage() {
  const supabase = createClient();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [revokeError, setRevokeError] = useState("");

  const [groupe, setGroupe] = useState("");
  const [nomComplet, setNomComplet] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [attributaireId, setAttributaireId] = useState("");
  const [attributaires, setAttributaires] = useState<Attributaire[]>([]);
  const [autoriteCoutumiereId, setAutoriteCoutumiereId] = useState("");
  const [autorites, setAutorites] = useState<Autorite[]>([]);
  const [familleId, setFamilleId] = useState("");
  const [familles, setFamilles] = useState<Famille[]>([]);

  const attributaireRequis = GROUPES_ATTRIBUTAIRE_REQUIS.includes(groupe);
  const autoriteRequise = GROUPES_AUTORITE_REQUIS.includes(groupe);
  const familleRequise = GROUPES_FAMILLE_REQUIS.includes(groupe);

  useEffect(() => {
    supabase
      .from("attributaires")
      .select("id, nom")
      .order("nom")
      .then(({ data }) => setAttributaires((data as Attributaire[]) ?? []));

    supabase
      .from("autorites_coutumieres")
      .select("id, nom")
      .order("nom")
      .then(({ data }) => setAutorites((data as Autorite[]) ?? []));

    supabase
      .from("familles")
      .select("id, nom")
      .order("nom")
      .then(({ data }) => setFamilles((data as Famille[]) ?? []));
  }, []);

  const fetchInvitations = async () => {
    const { data } = await supabase
      .from("invitations")
      .select(
        "id, code, groupe, nom_complet, email, statut, cree_le, expire_le, utilisee_le"
      )
      .order("cree_le", { ascending: false });
    setInvitations((data as Invitation[]) ?? []);
  };

  const { isLoading: loading, recharger } = useChargement(fetchInvitations);

  const handleCreer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Non authentifié.");
      setIsPending(false);
      return;
    }

    const { error: insertError } = await supabase.from("invitations").insert({
      groupe: groupe as Database["public"]["Enums"]["groupe_utilisateur"],
      nom_complet: nomComplet || null,
      email: email || null,
      telephone: telephone || null,
      attributaire_id: attributaireRequis ? attributaireId : null,
      autorite_coutumiere_id: autoriteRequise ? autoriteCoutumiereId : null,
      famille_id: familleRequise ? familleId : null,
      cree_par: user.id,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setShowForm(false);
      setGroupe("");
      setNomComplet("");
      setEmail("");
      setTelephone("");
      setAttributaireId("");
      setAutoriteCoutumiereId("");
      setFamilleId("");
      await recharger();
    }

    setIsPending(false);
  };

  const handleRevoquer = async (id: string) => {
    setRevoking(id);
    setRevokeError("");
    const { error: revErr } = await supabase
      .from("invitations")
      .update({ statut: "revoquee" })
      .eq("id", id)
      .eq("statut", "en_attente");
    if (revErr) setRevokeError(`Révocation non enregistrée — le code reste actif : ${revErr.message}`);
    await recharger();
    setRevoking(null);
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Invitations</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Gérez les codes d&apos;accès pour les nouveaux utilisateurs.
          </p>
        </div>
        <SGNFButton
          onClick={() => { setShowForm(!showForm); setError(""); }}
          className="flex items-center gap-2 rounded-xl bg-[#0D3B66] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E6091]"
        >
          <UserPlus className="h-4 w-4" />
          Nouvelle invitation
        </SGNFButton>
      </div>

      {revokeError && (
        <div className="rounded-2xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-700">{revokeError}</div>
      )}

      {/* Formulaire de création */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-700">
            Créer une invitation
          </h2>
          <form onSubmit={handleCreer} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Espace / Rôle <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={groupe}
                onChange={(e) => {
                  setGroupe(e.target.value);
                  setAttributaireId("");
                  setAutoriteCoutumiereId("");
                  setFamilleId("");
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/20"
              >
                <option value="" disabled>
                  Sélectionner un rôle…
                </option>
                {GROUPES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            {attributaireRequis && (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Attributaire concerné <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={attributaireId}
                  onChange={(e) => setAttributaireId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/20"
                >
                  <option value="" disabled>
                    Sélectionner un attributaire…
                  </option>
                  {attributaires.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nom}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Un compte propriétaire ou acquéreur doit être rattaché à un attributaire existant.
                </p>
              </div>
            )}

            {autoriteRequise && (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Chefferie / autorité coutumière <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={autoriteCoutumiereId}
                  onChange={(e) => setAutoriteCoutumiereId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/20"
                >
                  <option value="" disabled>
                    Sélectionner une chefferie…
                  </option>
                  {autorites.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nom}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Un compte Chefferie doit être rattaché à son autorité coutumière dès l&apos;invitation.
                </p>
              </div>
            )}

            {familleRequise && (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Famille concernée <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={familleId}
                  onChange={(e) => setFamilleId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/20"
                >
                  <option value="" disabled>
                    Sélectionner une famille…
                  </option>
                  {familles.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nom}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Un compte Propriétaire terrien doit être rattaché à sa famille dès l&apos;invitation.
                </p>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Nom complet (optionnel)
              </label>
              <Input
                type="text"
                placeholder="Prénom NOM"
                value={nomComplet}
                onChange={(e) => setNomComplet(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                E-mail (optionnel)
              </label>
              <Input
                type="email"
                placeholder="destinataire@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Téléphone (optionnel)
              </label>
              <Input
                type="tel"
                placeholder="+225 07 00 00 00 00"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
              />
            </div>

            {error && (
              <p className="sm:col-span-2 text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <div className="sm:col-span-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(""); }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Annuler
              </button>
              <SGNFButton
                type="submit"
                disabled={
                  isPending ||
                  !groupe ||
                  (attributaireRequis && !attributaireId) ||
                  (autoriteRequise && !autoriteCoutumiereId) ||
                  (familleRequise && !familleId)
                }
                className="rounded-xl bg-[#0D3B66] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E6091] disabled:opacity-60"
              >
                {isPending ? "Génération…" : "Générer le code"}
              </SGNFButton>
            </div>
          </form>
        </div>
      )}

      {/* Tableau */}
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Chargement…
          </div>
        ) : invitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-sm text-slate-400">
            <UserPlus className="mb-3 h-8 w-8 text-slate-300" />
            Aucune invitation créée pour l&apos;instant.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Rôle</th>
                <th className="px-5 py-3">Destinataire</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3">Expire le</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invitations.map((inv) => {
                const estExpire =
                  inv.statut === "en_attente" &&
                  new Date(inv.expire_le) < new Date();
                const statut = estExpire ? "expiree" : inv.statut;

                return (
                  <tr
                    key={inv.id}
                    className="transition hover:bg-slate-50/50"
                  >
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center font-mono text-xs tracking-widest text-slate-700">
                        {inv.code}
                        {statut === "en_attente" && (
                          <CopyButton text={inv.code} />
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {GROUPES.find((g) => g.value === inv.groupe)?.label ??
                        inv.groupe}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {inv.nom_complet ?? inv.email ?? (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUT_STYLES[statut] ?? ""
                        }`}
                      >
                        {STATUT_LABELS[statut] ?? statut}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {formatDate(inv.expire_le)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {statut === "en_attente" && (
                        <button
                          onClick={() => handleRevoquer(inv.id)}
                          disabled={revoking === inv.id}
                          title="Révoquer"
                          className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
