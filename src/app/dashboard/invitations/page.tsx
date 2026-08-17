"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Clock, Copy, UserPlus, X } from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card, CardHeader, CardTitle } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Input } from "@/components/ds/input";
import { Kpi } from "@/components/ds/kpi";
import { Field } from "@/components/ds/label";
import { SelectItem } from "@/components/ds/select";
import { ChampSelect } from "@/components/dashboard/ModaleFormulaire";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { fadeUp, stagger } from "@/lib/motion";
import type { Database } from "../../../../database.types";

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
  { value: "comptable", label: "Comptable (RH & finances)" },
  { value: "collaborateur", label: "Collaborateur (accès minimal)" },
];

const STATUT_TONE: Record<string, "warning" | "success" | "danger" | "neutral"> = {
  en_attente: "warning",
  utilisee: "success",
  revoquee: "danger",
  expiree: "neutral",
};

const STATUT_LABELS: Record<string, string> = {
  en_attente: "En attente",
  utilisee: "Utilisée",
  revoquee: "Révoquée",
  expiree: "Expirée",
};

// Un acquéreur est un prospect/acheteur : il ne doit JAMAIS être rattaché à
// l'attributaire d'un lot existant à l'invitation (sinon il « devient »
// propriétaire des lots du vendeur — bug du 23/07). Seul l'ancien rôle
// `proprietaire` (déprécié) reste rattaché à un attributaire.
const GROUPES_ATTRIBUTAIRE_REQUIS = ["proprietaire"];
const GROUPES_AUTORITE_REQUIS = ["chefferie"];
const GROUPES_FAMILLE_REQUIS = ["proprietaire_terrien"];
const GROUPES_COLLABORATEUR_REQUIS = ["collaborateur"];
const GROUPES_COMMISSAIRE_REQUIS = ["commissaire"];

type Option = { id: string; nom: string };

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
    <Button
      variant="ghost"
      size="icon-sm"
      className="ml-1"
      onClick={handleCopy}
      title="Copier le code"
      aria-label={`Copier le code ${text}`}
    >
      {copied ? <Check className="text-success" /> : <Copy />}
    </Button>
  );
}

/** Statut effectif : une invitation en attente dont la date est passée est expirée. */
const statutEffectif = (inv: Invitation) =>
  inv.statut === "en_attente" && new Date(inv.expire_le) < new Date() ? "expiree" : inv.statut;

export default function InvitationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { counts } = useBadgeCounts();

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
  const [attributaires, setAttributaires] = useState<Option[]>([]);
  const [autoriteCoutumiereId, setAutoriteCoutumiereId] = useState("");
  const [autorites, setAutorites] = useState<Option[]>([]);
  const [familleId, setFamilleId] = useState("");
  const [familles, setFamilles] = useState<Option[]>([]);
  const [collaborateurId, setCollaborateurId] = useState("");
  const [collaborateursDisponibles, setCollaborateursDisponibles] = useState<Option[]>([]);
  const [commissaireId, setCommissaireId] = useState("");
  const [commissaires, setCommissaires] = useState<Option[]>([]);

  const attributaireRequis = GROUPES_ATTRIBUTAIRE_REQUIS.includes(groupe);
  const autoriteRequise = GROUPES_AUTORITE_REQUIS.includes(groupe);
  const familleRequise = GROUPES_FAMILLE_REQUIS.includes(groupe);
  const collaborateurRequis = GROUPES_COLLABORATEUR_REQUIS.includes(groupe);
  const commissaireRequis = GROUPES_COMMISSAIRE_REQUIS.includes(groupe);

  useEffect(() => {
    supabase.from("attributaires").select("id, nom").order("nom")
      .then(({ data }) => setAttributaires((data as Option[]) ?? []));
    supabase.from("autorites_coutumieres").select("id, nom").order("nom")
      .then(({ data }) => setAutorites((data as Option[]) ?? []));
    supabase.from("familles").select("id, nom").order("nom")
      .then(({ data }) => setFamilles((data as Option[]) ?? []));
    // Collaborateurs actifs qui n'ont pas déjà un compte (RPC plutôt qu'un
    // filtre client sur `profiles` — ce rôle n'a pas accès à cette table).
    Promise.all([
      supabase.from("collaborateurs").select("id, nom_complet").eq("statut", "actif").order("nom_complet"),
      supabase.rpc("collaborateurs_avec_compte"),
    ]).then(([{ data: collabs }, { data: avecCompte }]) => {
      const dejaLies = new Set((avecCompte as string[] | null) ?? []);
      const options = ((collabs as { id: string; nom_complet: string }[] | null) ?? [])
        .filter((c) => !dejaLies.has(c.id))
        .map((c) => ({ id: c.id, nom: c.nom_complet }));
      setCollaborateursDisponibles(options);
    });
    supabase.from("commissaires_justice").select("id, nom").order("nom")
      .then(({ data }) => setCommissaires((data as Option[]) ?? []));
  }, [supabase]);

  const fetchInvitations = async () => {
    const { data } = await supabase
      .from("invitations")
      .select("id, code, groupe, nom_complet, email, statut, cree_le, expire_le, utilisee_le")
      .order("cree_le", { ascending: false });
    setInvitations((data as Invitation[]) ?? []);
  };

  const { isLoading: loading, recharger } = useChargement(fetchInvitations);

  const handleCreer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();

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
      collaborateur_id: collaborateurRequis ? collaborateurId : null,
      commissaire_id: commissaireRequis ? commissaireId : null,
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
      setCollaborateurId("");
      setCommissaireId("");
      // Le collaborateur choisi n'est plus disponible pour une prochaine invitation.
      setCollaborateursDisponibles((prev) => prev.filter((c) => c.id !== collaborateurId));
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

  const enAttente = invitations.filter((i) => statutEffectif(i) === "en_attente").length;
  const utilisees = invitations.filter((i) => i.statut === "utilisee").length;

  return (
    <AppShell loading={loading} counts={counts} onRefresh={recharger}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Invitations
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Codes d&apos;accès à usage unique pour les nouveaux comptes de la plateforme.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          className="shrink-0"
          onClick={() => { setShowForm(!showForm); setError(""); }}
        >
          <UserPlus />
          Nouvelle invitation
        </Button>
      </div>

      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-3"
        aria-label="Indicateurs des invitations"
      >
        <Kpi
          icon={UserPlus}
          label="Invitations émises"
          loading={loading}
          value={invitations.length}
          legende={<>tous statuts confondus</>}
        />
        <Kpi
          icon={Clock}
          label="Codes actifs"
          loading={loading}
          value={enAttente}
          tone={enAttente > 0 ? "warning" : "neutral"}
          legende={<>en attente d&apos;activation</>}
        />
        <Kpi
          icon={Check}
          label="Comptes créés"
          loading={loading}
          value={utilisees}
          legende={<>invitations converties en compte</>}
        />
      </motion.section>

      {revokeError && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger-subtle px-4 py-3 text-sm font-medium text-danger">
          {revokeError}
        </p>
      )}

      <motion.div variants={stagger(0.05, 0.06)} initial="hidden" animate="show" className="flex flex-col gap-5">
        {/* Formulaire de création */}
        {showForm && (
          <motion.div variants={fadeUp}>
            <Card>
              <CardHeader>
                <CardTitle>Créer une invitation</CardTitle>
              </CardHeader>
              <form onSubmit={handleCreer} className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
                <ChampSelect
                  id="inv-groupe"
                  label="Espace / rôle"
                  required
                  placeholder="Sélectionner un rôle…"
                  value={groupe}
                  onChange={(v) => {
                    setGroupe(v);
                    setAttributaireId("");
                    setAutoriteCoutumiereId("");
                    setFamilleId("");
                    setCollaborateurId("");
                    setCommissaireId("");
                  }}
                >
                  {GROUPES.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                </ChampSelect>
                <div className="hidden sm:block" aria-hidden />

                {attributaireRequis && (
                  <ChampSelect
                    id="inv-attributaire"
                    label="Attributaire concerné"
                    required
                    placeholder="Sélectionner un attributaire…"
                    value={attributaireId}
                    onChange={setAttributaireId}
                  >
                    {attributaires.map((a) => <SelectItem key={a.id} value={a.id}>{a.nom}</SelectItem>)}
                  </ChampSelect>
                )}

                {autoriteRequise && (
                  <ChampSelect
                    id="inv-autorite"
                    label="Chefferie / autorité coutumière"
                    required
                    placeholder="Sélectionner une chefferie…"
                    value={autoriteCoutumiereId}
                    onChange={setAutoriteCoutumiereId}
                  >
                    {autorites.map((a) => <SelectItem key={a.id} value={a.id}>{a.nom}</SelectItem>)}
                  </ChampSelect>
                )}

                {familleRequise && (
                  <ChampSelect
                    id="inv-famille"
                    label="Famille concernée"
                    required
                    placeholder="Sélectionner une famille…"
                    value={familleId}
                    onChange={setFamilleId}
                  >
                    {familles.map((f) => <SelectItem key={f.id} value={f.id}>{f.nom}</SelectItem>)}
                  </ChampSelect>
                )}

                {collaborateurRequis && (
                  <ChampSelect
                    id="inv-collaborateur"
                    label="Collaborateur concerné"
                    required
                    placeholder={
                      collaborateursDisponibles.length === 0
                        ? "Aucun collaborateur disponible…"
                        : "Sélectionner un collaborateur…"
                    }
                    value={collaborateurId}
                    onChange={setCollaborateurId}
                  >
                    {collaborateursDisponibles.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                  </ChampSelect>
                )}

                {commissaireRequis && (
                  <ChampSelect
                    id="inv-commissaire"
                    label="Commissaire concerné"
                    required
                    placeholder="Sélectionner un commissaire de justice…"
                    value={commissaireId}
                    onChange={setCommissaireId}
                  >
                    {commissaires.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                  </ChampSelect>
                )}

                {(attributaireRequis || autoriteRequise || familleRequise || collaborateurRequis || commissaireRequis) && (
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    {attributaireRequis && "Un compte propriétaire ou acquéreur doit être rattaché à un attributaire existant."}
                    {autoriteRequise && "Un compte Chefferie doit être rattaché à son autorité coutumière dès l'invitation."}
                    {familleRequise && "Un compte Propriétaire terrien doit être rattaché à sa famille dès l'invitation."}
                    {collaborateurRequis && "Seuls les collaborateurs actifs n'ayant pas déjà de compte sont proposés. Ajoutez-le d'abord depuis la page Collaborateurs si besoin."}
                    {commissaireRequis && "Un compte Commissaire doit être rattaché à sa fiche du référentiel dès l'invitation."}
                  </p>
                )}

                <Field label="Nom complet (optionnel)" htmlFor="inv-nom">
                  <Input id="inv-nom" type="text" placeholder="Prénom NOM" value={nomComplet}
                    onChange={(e) => setNomComplet(e.target.value)} />
                </Field>

                <Field label="E-mail (optionnel)" htmlFor="inv-email">
                  <Input id="inv-email" type="email" placeholder="destinataire@exemple.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} />
                </Field>

                <Field label="Téléphone (optionnel)" htmlFor="inv-tel" className="sm:col-span-2">
                  <Input id="inv-tel" type="tel" placeholder="+225 07 00 00 00 00" value={telephone}
                    onChange={(e) => setTelephone(e.target.value)} />
                </Field>

                {error && (
                  <p role="alert" className="text-sm font-medium text-danger sm:col-span-2">{error}</p>
                )}

                <div className="flex justify-end gap-3 sm:col-span-2">
                  <Button type="button" variant="outline" onClick={() => { setShowForm(false); setError(""); }}>
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={isPending}
                    disabled={
                      !groupe ||
                      (attributaireRequis && !attributaireId) ||
                      (autoriteRequise && !autoriteCoutumiereId) ||
                      (familleRequise && !familleId) ||
                      (collaborateurRequis && !collaborateurId) ||
                      (commissaireRequis && !commissaireId)
                    }
                  >
                    {isPending ? "Génération…" : "Générer le code"}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}

        {/* Tableau */}
        <motion.div variants={fadeUp}>
          <Card className="overflow-hidden">
            {loading ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Chargement…</p>
            ) : invitations.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="Aucune invitation"
                description="Aucun code d'accès n'a encore été émis."
              />
            ) : (
              <div className="max-h-[62vh] overflow-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-border bg-inset text-left text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase">
                      <th className="bg-inset px-5 py-3">Code</th>
                      <th className="bg-inset px-5 py-3">Rôle</th>
                      <th className="bg-inset px-5 py-3">Destinataire</th>
                      <th className="bg-inset px-5 py-3">Statut</th>
                      <th className="bg-inset px-5 py-3">Expire le</th>
                      <th className="bg-inset px-5 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invitations.map((inv) => {
                      const statut = statutEffectif(inv);
                      return (
                        <tr key={inv.id} className="transition-colors hover:bg-inset/70">
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center font-mono text-xs tracking-widest text-foreground">
                              {inv.code}
                              {statut === "en_attente" && <CopyButton text={inv.code} />}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[13px] text-muted-foreground">
                            {GROUPES.find((g) => g.value === inv.groupe)?.label ?? inv.groupe}
                          </td>
                          <td className="px-5 py-3 text-[13px] text-muted-foreground">
                            {inv.nom_complet ?? inv.email ?? <span className="text-muted-2">—</span>}
                          </td>
                          <td className="px-5 py-3">
                            <Badge tone={STATUT_TONE[statut] ?? "neutral"}>
                              {STATUT_LABELS[statut] ?? statut}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-[13px] text-muted-2">{formatDate(inv.expire_le)}</td>
                          <td className="px-5 py-3 text-right">
                            {statut === "en_attente" && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="hover:bg-danger-subtle hover:text-danger"
                                loading={revoking === inv.id}
                                onClick={() => handleRevoquer(inv.id)}
                                title="Révoquer"
                                aria-label={`Révoquer le code ${inv.code}`}
                              >
                                <X />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
