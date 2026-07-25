"use client";

import { type FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Check, Copy, IdCard, Link2, Phone, Pencil, Plus, Ruler, Search, ThumbsDown, ThumbsUp, UserPlus } from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ui/Badge";
import { CountBadge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Input } from "@/components/ds/input";
import { Kpi } from "@/components/ds/kpi";
import { Field } from "@/components/ds/label";
import { SelectItem } from "@/components/ds/select";
import { ChampSelect, ModaleFormulaire } from "@/components/dashboard/ModaleFormulaire";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { createClient } from "@/utils/supabase/client";
import { fadeUp, stagger } from "@/lib/motion";

// ─── Types ──────────────────────────────────────────────────────────────────

type GeometreRecord = {
  id: string;
  nom: string;
  numero_ordre: string | null;
  cabinet: string | null;
  contact: string | null;
};

type DemandeRecord = {
  id: string;
  nom: string;
  numero_ordre: string | null;
  cabinet: string | null;
  telephone: string;
  email: string | null;
  message: string | null;
  cree_le: string;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copier le code"
      aria-label="Copier le code"
      className="ml-1 rounded p-1 text-muted-foreground transition hover:bg-inset hover:text-foreground"
    >
      {copied ? <Check className="text-success size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}

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
  const { counts } = useBadgeCounts();

  const [geometres, setGeometres] = useState<GeometreRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [demandes, setDemandes] = useState<DemandeRecord[]>([]);
  const [search, setSearch] = useState("");
  const [codesGeneres, setCodesGeneres] = useState<Record<string, string>>({});
  const [demandeEnCours, setDemandeEnCours] = useState<string | null>(null);
  const [demandeErreur, setDemandeErreur] = useState<string | null>(null);

  const load = async () => {
    const [{ data: g }, { data: p }, { data: d }] = await Promise.all([
      supabase.from("geometres_experts").select("id, nom, numero_ordre, cabinet, contact").order("nom"),
      supabase.from("profiles").select("id, nom_complet, geometre_id").eq("groupe", "geometre"),
      supabase
        .from("demandes_inscription_geometre")
        .select("id, nom, numero_ordre, cabinet, telephone, email, message, cree_le")
        .eq("statut", "en_attente")
        .order("cree_le"),
    ]);
    setGeometres((g ?? []) as GeometreRecord[]);
    setProfiles((p ?? []) as ProfileOption[]);
    setDemandes((d ?? []) as DemandeRecord[]);
  };

  const { isLoading: loading, recharger } = useChargement(load);

  const comptePourGeometre = (geometreId: string) => profiles.find((p) => p.geometre_id === geometreId) ?? null;

  const handleApprouver = async (id: string) => {
    setDemandeEnCours(id);
    setDemandeErreur(null);
    const { data, error } = await supabase.rpc("approuver_demande_geometre", { p_id: id });
    setDemandeEnCours(null);
    if (error) {
      setDemandeErreur(error.message);
      return;
    }
    const code = (data as { code?: string } | null)?.code;
    if (code) {
      setCodesGeneres((prev) => ({ ...prev, [id]: code }));
    }
    // La fiche registre créée par l'approbation doit apparaître dans le tableau — recharge le registre,
    // mais garde la demande affichée localement (avec son code) tant que l'admin ne l'a pas rechargée.
    const { data: g } = await supabase.from("geometres_experts").select("id, nom, numero_ordre, cabinet, contact").order("nom");
    setGeometres((g ?? []) as GeometreRecord[]);
  };

  const handleRejeter = async (id: string) => {
    setDemandeEnCours(id);
    setDemandeErreur(null);
    const { error } = await supabase.rpc("rejeter_demande_geometre", { p_id: id });
    setDemandeEnCours(null);
    if (error) {
      setDemandeErreur(error.message);
      return;
    }
    setDemandes((prev) => prev.filter((d) => d.id !== id));
  };

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

  const lies = geometres.filter((g) => comptePourGeometre(g.id)).length;

  return (
    <AppShell loading={loading} counts={counts} onRefresh={() => void recharger()}>
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Réseau partenaires</p>
          <h1 className="mt-1 font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Géomètres-experts
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Registre des géomètres-experts partenaires : numéro d&apos;ordre, cabinet et compte SGNF associé.
          </p>
        </div>
        <Button variant="primary" onClick={openCreate} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          Nouveau géomètre-expert
        </Button>
      </div>

      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <Kpi
          icon={Ruler}
          label="Géomètres inscrits"
          loading={loading}
          value={geometres.length}
          legende={<>Au registre partenaires</>}
        />
        <Kpi
          icon={Link2}
          label="Comptes rattachés"
          loading={loading}
          value={lies}
          legende={<>Fiches liées à un compte SGNF</>}
        />
        <Kpi
          icon={UserPlus}
          label="Demandes en attente"
          loading={loading}
          value={demandes.length}
          tone={demandes.length > 0 ? "warning" : "neutral"}
          legende={<>À approuver ou rejeter</>}
        />
      </motion.section>

      {/* Demandes d'inscription en attente */}
      {demandes.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <UserPlus className="size-4 text-brick" aria-hidden />
            <h2 className="text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
              Demandes en attente
            </h2>
            <CountBadge value={demandes.length} />
          </div>

          {demandeErreur && (
            <div className="border-danger/30 bg-danger-subtle text-danger rounded-xl border px-4 py-3 text-sm">
              {demandeErreur}
            </div>
          )}

          {demandes.map((d) => {
            const code = codesGeneres[d.id];
            return (
              // Ces cartes étaient en ambre (`warning`), une troisième couleur
              // pour dire « on m'attend » — le brique unifie le signal.
              <Card key={d.id} className="border-brick/45 bg-brick-subtle px-5 py-4 ring-1 ring-brick/20">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{d.nom}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {d.numero_ordre && (
                        <span className="inline-flex items-center gap-1">
                          <IdCard className="size-3" aria-hidden /> {d.numero_ordre}
                        </span>
                      )}
                      {d.cabinet && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="size-3" aria-hidden /> {d.cabinet}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Phone className="size-3" aria-hidden /> {d.telephone}
                      </span>
                      {d.email && <span>{d.email}</span>}
                    </div>
                    {d.message && <p className="mt-2 text-xs text-muted-foreground">« {d.message} »</p>}
                  </div>

                  {code ? (
                    <div className="border-success/30 bg-success-subtle text-success flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 font-mono text-xs font-semibold">
                      {code}
                      <CopyButton text={code} />
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejeter(d.id)}
                        disabled={demandeEnCours === d.id}
                      >
                        <ThumbsDown className="size-3.5" aria-hidden />
                        Rejeter
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        loading={demandeEnCours === d.id}
                        onClick={() => handleApprouver(d.id)}
                      >
                        {demandeEnCours !== d.id && <ThumbsUp className="size-3.5" aria-hidden />}
                        Approuver
                      </Button>
                    </div>
                  )}
                </div>
                {code && (
                  <p className="text-success mt-2 text-xs">
                    Fiche créée — transmettez ce code au géomètre pour qu&apos;il finalise son inscription sur /inscription.
                  </p>
                )}
              </Card>
            );
          })}
        </section>
      )}

      {/* Recherche */}
      <div className="relative w-full max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Rechercher un nom, un numéro d'ordre, un cabinet…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Liste */}
      {loading ? null : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Ruler}
            tone={geometres.length === 0 ? "pending" : "neutral"}
            title={geometres.length === 0 ? "Aucun géomètre-expert enregistré" : "Aucun résultat"}
            description={
              geometres.length === 0
                ? "Cliquez sur « Nouveau géomètre-expert » pour créer la première fiche du registre."
                : "Aucune fiche ne correspond à cette recherche."
            }
          />
        </Card>
      ) : (
        <motion.div variants={stagger(0, 0.04)} initial="hidden" animate="show" className="flex flex-col gap-2">
          {filtered.map((g) => {
            const compte = comptePourGeometre(g.id);
            return (
              <motion.div key={g.id} variants={fadeUp}>
                <Card className="flex-row items-center justify-between gap-4 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="bg-accent-subtle flex size-10 shrink-0 items-center justify-center rounded-xl">
                      <Ruler className="text-accent size-4.5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{g.nom}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {g.numero_ordre && (
                          <span className="inline-flex items-center gap-1">
                            <IdCard className="size-3" aria-hidden /> {g.numero_ordre}
                          </span>
                        )}
                        {g.cabinet && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="size-3" aria-hidden /> {g.cabinet}
                          </span>
                        )}
                        {g.contact && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="size-3" aria-hidden /> {g.contact}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {compte ? (
                      <Badge status="disponible">
                        <Link2 className="size-3" aria-hidden /> {compte.nom_complet}
                      </Badge>
                    ) : (
                      <Badge status="en_validation">Aucun compte lié</Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEdit(g)} title="Modifier">
                      <Pencil className="size-3.5" aria-hidden />
                      Modifier
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Modal création / édition */}
      {isModalOpen && (
        <ModaleFormulaire
          surTitre={editingId ? "Modifier la fiche" : "Nouveau géomètre-expert"}
          titre={editingId ? "Mettre à jour le géomètre-expert" : "Enregistrer un géomètre-expert"}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmit}
          error={errorMessage}
          isSubmitting={isSubmitting}
          libelleAction={editingId ? "Mettre à jour" : "Enregistrer"}
          libelleEnCours="Enregistrement…"
        >
          <Field label="Nom complet" htmlFor="geo-nom" required>
            <Input
              id="geo-nom"
              type="text"
              value={form.nom}
              onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              placeholder="Ex. Kouamé N'Guessan, Géomètre-Expert"
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Numéro d'ordre" htmlFor="geo-numero-ordre">
              <Input
                id="geo-numero-ordre"
                type="text"
                value={form.numero_ordre}
                onChange={(e) => setForm((f) => ({ ...f, numero_ordre: e.target.value }))}
                placeholder="Ex. OGEF-CI-0042"
              />
            </Field>
            <Field label="Contact" htmlFor="geo-contact">
              <Input
                id="geo-contact"
                type="text"
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                placeholder="+225 07 00 00 00 00"
              />
            </Field>
          </div>

          <Field label="Cabinet" htmlFor="geo-cabinet">
            <Input
              id="geo-cabinet"
              type="text"
              value={form.cabinet}
              onChange={(e) => setForm((f) => ({ ...f, cabinet: e.target.value }))}
              placeholder="Ex. Cabinet Kouamé & Associés"
            />
          </Field>

          <div>
            <ChampSelect
              id="geo-compte"
              label="Compte SGNF lié"
              value={form.profile_id}
              onChange={(v) => setForm((f) => ({ ...f, profile_id: v }))}
              placeholder="Aucun compte lié"
            >
              {comptesDisponibles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nom_complet}
                </SelectItem>
              ))}
            </ChampSelect>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Rattache cette fiche à un compte « géomètre » existant — il verra alors son propre nom, cabinet et
              numéro d&apos;ordre dans son espace dédié.
            </p>
          </div>
        </ModaleFormulaire>
      )}
    </AppShell>
  );
}
