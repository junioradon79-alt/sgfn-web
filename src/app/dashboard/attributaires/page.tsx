"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2, ChevronRight, Mail, MapPin, Pencil, Phone, Plus, Search, ShieldCheck, User, Users,
} from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import {
  Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ds/dialog";
import { EmptyState } from "@/components/ds/empty-state";
import { Input } from "@/components/ds/input";
import { Kpi } from "@/components/ds/kpi";
import { Field } from "@/components/ds/label";
import { SelectItem } from "@/components/ds/select";
import { BoutonImprimer } from "@/components/dashboard/BoutonImprimer";
import { ChampSelect, ModaleFormulaire } from "@/components/dashboard/ModaleFormulaire";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { fadeUp, stagger } from "@/lib/motion";

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

const STATUT_LOT: Record<string, { tone: "success" | "accent" | "warning" | "danger"; label: string }> = {
  libre: { tone: "success", label: "Disponible" },
  reserve_equipement: { tone: "warning", label: "Équipement" },
  attribue: { tone: "accent", label: "Attribué" },
  occupe: { tone: "accent", label: "Occupé" },
  vendu: { tone: "accent", label: "Vendu" },
  en_litige: { tone: "danger", label: "Litige" },
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

const libelleType = (t: string | null) =>
  TYPE_OPTIONS.find((o) => o.value === t)?.label ?? "Personne physique";

// ─── Fiche Attributaire ───────────────────────────────────────────────────────

function AttributaireDetailModal({ attributaire, lots, onClose, onEdit }: {
  attributaire: AttributaireRecord;
  lots: AttributaireLot[];
  onClose: () => void;
  onEdit: () => void;
}) {
  const isValidated = Boolean(attributaire.piece_num);
  const lotsActuels = lots.filter((l) => l.actuel);

  const contacts = [
    attributaire.piece_nature && {
      icone: User, label: attributaire.piece_nature, valeur: attributaire.piece_num ?? "N/A",
    },
    attributaire.telephone && { icone: Phone, valeur: attributaire.telephone },
    attributaire.email && { icone: Mail, valeur: attributaire.email },
    attributaire.adresse && { icone: MapPin, valeur: attributaire.adresse },
  ].filter(Boolean) as { icone: typeof User; label?: string; valeur: string }[];

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Fiche attributaire</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <DialogTitle>{attributaire.nom ?? "—"}</DialogTitle>
            <Badge tone={isValidated ? "success" : "warning"}>
              {isValidated ? "KYC validé" : "KYC en attente"}
            </Badge>
          </div>
          <p className="text-[13px] text-muted-foreground">{libelleType(attributaire.type)}</p>
          <Button type="button" variant="outline" size="sm" className="mt-2 w-fit" onClick={onEdit}>
            <Pencil />
            Modifier le profil
          </Button>
        </DialogHeader>

        <DialogBody className="space-y-6">
          <section>
            <p className="mb-3 text-[11px] font-bold tracking-[0.18em] text-accent uppercase">
              Identité &amp; contact
            </p>
            {contacts.length === 0 ? (
              <p className="text-[13px] text-muted-2 italic">Aucun contact renseigné.</p>
            ) : (
              <div className="space-y-2">
                {contacts.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-inset px-4 py-3">
                    <c.icone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      {c.label && <p className="text-xs text-muted-2">{c.label}</p>}
                      <p className="truncate text-[13px] font-semibold text-foreground">{c.valeur}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <p className="mb-3 flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-accent uppercase">
              Lots attribués
              <Badge tone="accent">{lotsActuels.length}</Badge>
            </p>
            {lots.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-inset p-4 text-[13px] text-muted-foreground">
                Aucun lot attribué à cet attributaire.
              </div>
            ) : (
              <div className="space-y-2">
                {lots.map((attr, i) => {
                  const lot = attr.lots;
                  const st = STATUT_LOT[lot?.statut ?? "libre"] ?? STATUT_LOT.libre;
                  return (
                    <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-inset">
                          <Building2 className="size-4 text-accent" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-foreground">
                            Lot {lot?.numero_lot ?? "—"}
                            <span className="ml-1.5 text-xs font-normal text-muted-2">
                              {attr.actuel ? "· Actuel" : "· Historique"}
                            </span>
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {lot?.ilots?.lotissements?.nom ?? "—"}
                            {lot?.ilots?.numero && ` · Îlot ${lot.ilots.numero}`}
                            {lot?.superficie_m2 && ` · ${Number(lot.superficie_m2).toLocaleString("fr-FR")} m²`}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {attr.qualite && (
                          <span className="hidden rounded-full bg-inset px-2 py-0.5 text-xs font-medium text-muted-foreground sm:inline">
                            {QUALITE_LABELS[attr.qualite] ?? attr.qualite}
                          </span>
                        )}
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AttributairesPage() {
  const supabase = useMemo(() => createClient(), []);
  const { counts } = useBadgeCounts();

  const [attributaires, setAttributaires] = useState<AttributaireRecord[]>([]);
  const [search, setSearch] = useState("");

  // Modale création/édition (édition si editingId non nul)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
  }, [detailAttributaire, supabase]);

  const ouvrirFiche = (a: AttributaireRecord) => {
    setAttributaireLots([]);
    setDetailAttributaire(a);
  };

  const filtered = attributaires.filter((a) => {
    const q = search.toLowerCase();
    return !q || (a.nom ?? "").toLowerCase().includes(q) || (a.piece_num ?? "").toLowerCase().includes(q);
  });

  const valides = attributaires.filter((a) => Boolean(a.piece_num)).length;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim()) {
      setErrorMessage("Le nom est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      nom: form.nom.trim(),
      type: form.type as "personne_physique" | "collectif_ayants_droit" | "personne_morale",
      piece_nature: form.piece_nature.trim() || null,
      piece_num: form.piece_num.trim() || null,
      telephone: form.telephone.trim() || null,
      email: form.email.trim() || null,
      adresse: form.adresse.trim() || null,
    };

    const { error } = editingId
      ? await supabase.from("attributaires").update(payload).eq("id", editingId)
      : await supabase.from("attributaires").insert([payload]);

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setForm(EMPTY_FORM);
    setIsModalOpen(false);
    setIsSubmitting(false);
    setEditingId(null);
    setSuccessMessage(editingId ? "Profil mis à jour avec succès." : "Attributaire enregistré avec succès.");
    setTimeout(() => setSuccessMessage(null), 4000);
    await recharger();
  };

  const openEdit = (a: AttributaireRecord) => {
    setEditingId(a.id);
    setForm({
      type: a.type ?? "personne_physique",
      nom: a.nom ?? "",
      piece_nature: a.piece_nature ?? "",
      piece_num: a.piece_num ?? "",
      telephone: a.telephone ?? "",
      email: a.email ?? "",
      adresse: a.adresse ?? "",
    });
    setErrorMessage(null);
    setSuccessMessage(null);
    setDetailAttributaire(null);
    setIsModalOpen(true);
  };

  return (
    <AppShell loading={dataLoading} counts={counts} onRefresh={recharger}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Attributaires
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Registre officiel des attributaires, suivi des identités et des droits fonciers rattachés.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BoutonImprimer />
          <Button
            type="button"
            variant="primary"
            className="print:hidden"
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY_FORM);
              setIsModalOpen(true);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
          >
            <Plus />
            Nouvel attributaire
          </Button>
        </div>
      </div>

      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2"
        aria-label="Indicateurs des attributaires"
      >
        <Kpi
          icon={Users}
          label="Attributaires au registre"
          loading={dataLoading}
          value={attributaires.length}
          legende={<>dans votre périmètre</>}
        />
        <Kpi
          icon={ShieldCheck}
          label="Identités renseignées"
          loading={dataLoading}
          value={valides}
          tone={attributaires.length > 0 && valides < attributaires.length ? "warning" : "neutral"}
          legende={<>pièce d&apos;identité au dossier</>}
        />
      </motion.section>

      {successMessage && (
        <p role="status" className="rounded-xl border border-success/25 bg-success-subtle px-4 py-3 text-sm font-medium text-success">
          {successMessage}
        </p>
      )}

      <motion.div variants={stagger(0.05, 0.06)} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={fadeUp}>
          <Card className="p-3 print:hidden">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                placeholder="Rechercher un attributaire, un numéro de pièce…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Rechercher un attributaire"
              />
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="overflow-hidden print:border-none print:shadow-none">
            {dataLoading ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Chargement des attributaires…</p>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title={search ? "Aucun résultat" : "Aucun attributaire enregistré"}
                description={
                  search
                    ? `Aucun attributaire ne correspond à « ${search} ».`
                    : "Le registre des attributaires de votre périmètre est vide."
                }
              />
            ) : (
              <div className="max-h-[62vh] overflow-auto print:max-h-none print:overflow-visible">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-border bg-inset">
                      {TABLE_HEADERS.map((header) => (
                        <th
                          key={header}
                          scope="col"
                          className="bg-inset px-5 py-3 text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase last:text-right print:last:hidden"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((item) => {
                      const isValidated = Boolean(item.piece_num);
                      return (
                        <tr
                          key={item.id}
                          className="cursor-pointer transition-colors hover:bg-inset/70"
                          onClick={() => ouvrirFiche(item)}
                        >
                          <td className="px-5 py-3.5">
                            <p className="text-[13px] font-semibold text-foreground">{item.nom || "N/A"}</p>
                            {item.email && <p className="mt-0.5 text-xs text-muted-2">{item.email}</p>}
                          </td>
                          <td className="px-5 py-3.5 text-[13px] text-muted-foreground">
                            {libelleType(item.type)}
                          </td>
                          <td className="px-5 py-3.5 text-[13px] text-muted-foreground">
                            {item.piece_nature ? `${item.piece_nature} — ${item.piece_num || "N/A"}` : "Non renseignée"}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge tone={isValidated ? "success" : "warning"}>
                              {isValidated ? "Validé" : "En validation"}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 text-right print:hidden">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Voir la fiche de ${item.nom ?? "l'attributaire"}`}
                              onClick={(e) => { e.stopPropagation(); ouvrirFiche(item); }}
                            >
                              Voir la fiche
                              <ChevronRight />
                            </Button>
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

      {/* Création / édition */}
      {isModalOpen && (
        <ModaleFormulaire
          surTitre={editingId ? "Modifier le profil" : "Nouvel attributaire"}
          titre={editingId ? "Mettre à jour l'attributaire" : "Enregistrer un attributaire"}
          onClose={() => { setIsModalOpen(false); setEditingId(null); }}
          onSubmit={handleSubmit}
          error={errorMessage}
          isSubmitting={isSubmitting}
          libelleAction={editingId ? "Mettre à jour" : "Enregistrer"}
          libelleEnCours="Enregistrement…"
        >
          <ChampSelect
            id="attrib-type"
            label="Type d'attributaire"
            value={form.type}
            onChange={(v) => setForm((f) => ({ ...f, type: v }))}
          >
            {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </ChampSelect>

          <Field label="Nom complet" htmlFor="attrib-nom" required>
            <Input id="attrib-nom" type="text" value={form.nom} required placeholder="Ex. Kouassi Yao Bernard"
              onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nature de la pièce" htmlFor="attrib-piece-nature">
              <Input id="attrib-piece-nature" type="text" value={form.piece_nature} placeholder="CNI, Passeport…"
                onChange={(e) => setForm((f) => ({ ...f, piece_nature: e.target.value }))} />
            </Field>
            <Field label="Numéro de pièce" htmlFor="attrib-piece-num">
              <Input id="attrib-piece-num" type="text" value={form.piece_num} placeholder="CI-AB-2024-12345"
                onChange={(e) => setForm((f) => ({ ...f, piece_num: e.target.value }))} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Téléphone" htmlFor="attrib-tel">
              <Input id="attrib-tel" type="tel" value={form.telephone} placeholder="+225 07 00 00 00"
                onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} />
            </Field>
            <Field label="E-mail" htmlFor="attrib-email">
              <Input id="attrib-email" type="email" value={form.email} placeholder="exemple@mail.com"
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Field>
          </div>

          <Field label="Adresse" htmlFor="attrib-adresse">
            <Input id="attrib-adresse" type="text" value={form.adresse} placeholder="Ex. Anyama, Ebimpe"
              onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))} />
          </Field>
        </ModaleFormulaire>
      )}

      {/* Fiche attributaire */}
      {detailAttributaire && (
        <AttributaireDetailModal
          attributaire={detailAttributaire}
          lots={attributaireLots}
          onClose={() => setDetailAttributaire(null)}
          onEdit={() => openEdit(detailAttributaire)}
        />
      )}
    </AppShell>
  );
}
