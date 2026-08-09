"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Banknote, CheckCircle2, Clock, CreditCard, Download, Loader2, Plus, Receipt, ShieldCheck, TrendingUp, X,
} from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge, CountBadge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ds/dialog";
import { Kpi } from "@/components/ds/kpi";
import { Field } from "@/components/ds/label";
import { Input } from "@/components/ds/input";
import { SelectItem } from "@/components/ds/select";
import { ChampSelect } from "@/components/dashboard/ModaleFormulaire";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { invokeEdge } from "@/lib/invoke-edge";
import { messageLecture } from "@/lib/supabase-pagination";
import { stagger } from "@/lib/motion";
import {
  MOYEN_OPTIONS, MOYEN_LABELS, STATUT_CONFIG, TYPE_DEMARCHE_LABELS, TYPE_OPTIONS, fcfa, isMoyenManuel,
  labelTypePaiement,
  type TypeDemarche, type TypePaiement,
} from "@/lib/paiements";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

// Le lib expose encore les statuts « ui/Badge » historiques ; on les traduit ici
// en tons du Design System.
const BADGE_TONE: Record<string, BadgeTone> = {
  disponible: "neutral",
  attribue: "success",
  en_validation: "warning",
  litige: "danger",
};

// Radix Select refuse la chaîne vide : sentinelle « rien de sélectionné ».
const VIDE = "__vide__";

type PaiementRecord = {
  id: string;
  type: string | null;
  montant_total: number | null;
  commission_sgfn: number | null;
  beneficiaire: string | null;
  moyen: string | null;
  statut: string | null;
  cree_le: string | null;
  acquereur_id: string | null;
  reference_externe: string | null;
  reference: string | null;
  echeance_id: string | null;
  vente_id: string | null;
  attributaires?: { nom: string | null } | null;
  ventes?: { type_vente: string | null } | null;
};

type Groupe = "admin" | "operateur" | "acquereur" | "verificateur" | "geometre" | "commissaire" | "amenageur" | "chefferie" | "proprietaire" | "agent_ia";

const TABLE_HEADERS = ["Réf.", "Bénéficiaire", "Type", "Montant", "Moyen", "Statut", "Date", ""] as const;

const BENEF_LABELS: Record<string, string> = {
  proprietaire: "Propriétaire",
  chefferie: "Chefferie",
  sgfn: "Commission SGNF",
  agregateur: "Agrégateur",
};

type RepartLigne = { beneficiaire_type: string; nom: string | null; montant: number };

// ── Sélecteurs liés par type de paiement ────────────────────────────────────

type AttestationOption = {
  id: string; reference: string; statut: string | null; cession_id: string | null;
  acquereur_id: string; attributaires: { nom: string | null } | null;
};
type DemarcheOption = {
  id: string; type: string | null; description: string | null; montant_honoraires: number | null;
  attributaire_id: string | null; attributaires: { nom: string | null } | null;
};
type VenteOption = {
  id: string; lot_id: string; prix_total: number; solde: number | null; type_vente: string | null;
  acquereur_id: string; attributaires: { nom: string | null } | null;
};
type EcheanceOption = { id: string; numero: number; montant_du: number; date_echeance: string };
type AttributaireOption = { id: string; nom: string };
type TarifOption = {
  type_demarche: TypeDemarche;
  montant_min: number | null;
  montant_max: number | null;
  commission_min: number | null;
  commission_max: number | null;
  actif: boolean;
};

// ── Modale Nouveau Paiement ──────────────────────────────────────────────────

type NouveauPaiementModalProps = {
  onClose: () => void;
  onCreated: () => void;
};

function NouveauPaiementModal({ onClose, onCreated }: NouveauPaiementModalProps) {
  const supabase = useMemo(() => createClient(), []);
  const [type, setType] = useState<TypePaiement>("attestation_cession");
  const [beneficiaire, setBeneficiaire] = useState("");
  const [montant, setMontant] = useState("");
  const [moyen, setMoyen] = useState("especes");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  /**
   * 🔴 Motif d'une LECTURE d'options refusée — distinct de `err`, qui porte les
   * refus de SAISIE. Les deux partageaient le même état : `handleSubmit` fait
   * `setErr("")` en préambule, ce qui effaçait le motif du refus RLS. Le
   * guichetier recevait alors « Sélectionnez une attestation. » — un reproche
   * de formulaire — là où la vraie cause était qu'aucune attestation n'avait
   * pu être LUE, et qu'il n'y avait donc rien à sélectionner.
   */
  const [chargeErr, setChargeErr] = useState("");

  const [attestations, setAttestations] = useState<AttestationOption[]>([]);
  const [demarches, setDemarches] = useState<DemarcheOption[]>([]);
  const [ventes, setVentes] = useState<VenteOption[]>([]);
  const [echeances, setEcheances] = useState<EcheanceOption[]>([]);
  const [attributaires, setAttributaires] = useState<AttributaireOption[]>([]);
  const [tarifs, setTarifs] = useState<TarifOption[]>([]);

  const [attestationId, setAttestationId] = useState("");
  const [demarcheId, setDemarcheId] = useState("");
  const [venteId, setVenteId] = useState("");
  const [echeanceId, setEcheanceId] = useState("");
  const [autreAttributaireId, setAutreAttributaireId] = useState("");

  // Charger les options liées selon le type sélectionné
  useEffect(() => {
    const load = async () => {
      setChargeErr("");
      if (type === "attestation_cession") {
        // 🔴 Une liste d'options vidée par un refus RLS se présentait comme
        // « rien à payer » : le guichetier concluait qu'aucune attestation
        // n'était en attente, au lieu de savoir qu'il ne pouvait pas les lire.
        const { data, error } = await supabase
          .from("attestations_cession")
          .select("id, reference, statut, cession_id, acquereur_id, attributaires(nom)")
          .neq("statut", "delivree");
        if (error) setChargeErr(messageLecture("les attestations de cession", error));
        setAttestations((data ?? []) as unknown as AttestationOption[]);
      } else if (type === "honoraires") {
        const { data, error } = await supabase
          .from("demarches")
          .select("id, type, description, montant_honoraires, attributaire_id, attributaires(nom)")
          .is("terminee_le", null);
        if (error) setChargeErr(messageLecture("les démarches", error));
        setDemarches((data ?? []) as unknown as DemarcheOption[]);
      } else if (type === "vente_terrain") {
        const { data, error } = await supabase
          .from("ventes")
          .select("id, lot_id, prix_total, solde, type_vente, acquereur_id, attributaires(nom)")
          .eq("statut", "en_cours");
        if (error) setChargeErr(messageLecture("les ventes en cours", error));
        setVentes((data ?? []) as unknown as VenteOption[]);
      } else if (type === "autre") {
        const { data, error } = await supabase
          .from("attributaires")
          .select("id, nom")
          .order("nom", { ascending: true });
        if (error) setChargeErr(messageLecture("les attributaires", error));
        setAttributaires((data ?? []) as AttributaireOption[]);
      }
    };
    void load();
  }, [supabase, type]);

  // Charger la grille tarifaire une seule fois
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("tarifs")
        .select("type_demarche, montant_min, montant_max, commission_min, commission_max, actif");
      setTarifs((data ?? []) as TarifOption[]);
    };
    void load();
  }, [supabase]);

  const tarifDe = useCallback(
    (typeDemarche: TypeDemarche | null | undefined) =>
      tarifs.find((t) => t.type_demarche === typeDemarche && t.actif),
    [tarifs]
  );

  const venteChoisie = ventes.find((v) => v.id === venteId);
  const demarcheChoisie = demarches.find((d) => d.id === demarcheId);
  const tarifActif =
    type === "attestation_cession"
      ? tarifDe("delivrance_attestation_cession")
      : type === "honoraires"
        ? tarifDe(demarcheChoisie?.type as TypeDemarche | undefined)
        : undefined;
  const montantReadOnly =
    (type === "honoraires" && demarcheChoisie?.montant_honoraires != null) ||
    (type === "vente_terrain" && !!venteChoisie);

  // Charger les échéances impayées de la vente choisie (vente échelonnée)
  useEffect(() => {
    const load = async () => {
      setEcheanceId("");
      setEcheances([]);
      if (venteChoisie?.type_vente === "echelonne") {
        const { data } = await supabase
          .from("echeances")
          .select("id, numero, montant_du, date_echeance")
          .eq("vente_id", venteChoisie.id)
          .neq("statut", "payee")
          .order("numero");
        setEcheances((data ?? []) as EcheanceOption[]);
      }
    };
    void load();
  }, [supabase, venteChoisie?.id, venteChoisie?.type_vente]);

  // Pré-remplir bénéficiaire / montant quand la sélection change
  useEffect(() => {
    const run = () => {
      if (type === "attestation_cession") {
        const a = attestations.find((x) => x.id === attestationId);
        setBeneficiaire(a?.attributaires?.nom ?? "");
        const tarif = tarifDe("delivrance_attestation_cession");
        setMontant(a && tarif?.montant_min != null ? String(tarif.montant_min) : "");
      } else if (type === "honoraires") {
        const d = demarches.find((x) => x.id === demarcheId);
        setBeneficiaire(d?.attributaires?.nom ?? "");
        if (d?.montant_honoraires != null) {
          setMontant(String(d.montant_honoraires));
        } else {
          const tarif = tarifDe(d?.type as TypeDemarche | undefined);
          setMontant(d && tarif?.montant_min != null ? String(tarif.montant_min) : "");
        }
      } else if (type === "vente_terrain") {
        setBeneficiaire(venteChoisie?.attributaires?.nom ?? "");
        const echeance = echeances.find((e) => e.id === echeanceId);
        if (venteChoisie?.type_vente === "echelonne") {
          setMontant(echeance ? String(echeance.montant_du) : "");
        } else {
          setMontant(venteChoisie ? String(venteChoisie.solde ?? venteChoisie.prix_total) : "");
        }
      } else if (type === "autre") {
        const a = attributaires.find((x) => x.id === autreAttributaireId);
        setBeneficiaire(a?.nom ?? "");
      }
    };
    run();
  }, [
    attestationId,
    attestations,
    autreAttributaireId,
    attributaires,
    demarcheId,
    demarches,
    echeanceId,
    echeances,
    tarifDe,
    type,
    venteChoisie,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    const montantNum = parseFloat(montant);
    if (isNaN(montantNum) || montantNum <= 0) {
      setErr("Montant invalide.");
      return;
    }

    const payload: Record<string, unknown> = {
      type,
      montant_total: montantNum,
      beneficiaire: beneficiaire || null,
      moyen,
      statut: isMoyenManuel(moyen) ? "en_attente_validation" : "en_attente",
    };

    if (type === "attestation_cession") {
      const a = attestations.find((x) => x.id === attestationId);
      if (!a) { setErr("Sélectionnez une attestation."); return; }
      const tarif = tarifDe("delivrance_attestation_cession");
      if (
        tarif?.montant_min != null && tarif.montant_max != null &&
        (montantNum < tarif.montant_min || montantNum > tarif.montant_max)
      ) {
        setErr(`Montant hors grille tarifaire (${fcfa(tarif.montant_min)} – ${fcfa(tarif.montant_max)}).`);
        return;
      }
      payload.cession_id = a.cession_id;
      payload.acquereur_id = a.acquereur_id;
      payload.commission_sgfn = tarif?.commission_min ?? 10000;
    } else if (type === "honoraires") {
      const d = demarches.find((x) => x.id === demarcheId);
      if (!d) { setErr("Sélectionnez une démarche."); return; }
      const tarif = tarifDe(d.type as TypeDemarche | undefined);
      if (
        tarif?.montant_min != null && tarif.montant_max != null &&
        (montantNum < tarif.montant_min || montantNum > tarif.montant_max)
      ) {
        setErr(`Montant hors grille tarifaire (${fcfa(tarif.montant_min)} – ${fcfa(tarif.montant_max)}).`);
        return;
      }
      payload.demarche_id = d.id;
      payload.acquereur_id = d.attributaire_id;
      payload.commission_sgfn = tarif?.commission_min ?? 0;
    } else if (type === "vente_terrain") {
      if (!venteChoisie) { setErr("Sélectionnez une vente."); return; }
      payload.vente_id = venteChoisie.id;
      payload.acquereur_id = venteChoisie.acquereur_id;
      if (venteChoisie.type_vente === "echelonne") {
        if (!echeanceId) { setErr("Sélectionnez une échéance."); return; }
        payload.echeance_id = echeanceId;
      }
    } else if (type === "autre") {
      if (!autreAttributaireId) { setErr("Sélectionnez un attributaire."); return; }
      payload.acquereur_id = autreAttributaireId;
      payload.commission_sgfn = 0;
    }

    setSaving(true);
    const { error } = await supabase.from("paiements").insert(payload as never);

    if (error) {
      setErr("Erreur lors de la création : " + error.message);
      setSaving(false);
      return;
    }

    onCreated();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau paiement</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <ChampSelect id="pay-type" label="Type" value={type} onChange={(v) => setType(v as TypePaiement)}>
              {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </ChampSelect>

            {type === "attestation_cession" && (
              <ChampSelect
                id="pay-att"
                label="Attestation de cession"
                value={attestationId || VIDE}
                onChange={(v) => setAttestationId(v === VIDE ? "" : v)}
              >
                <SelectItem value={VIDE}>— Sélectionner —</SelectItem>
                {attestations.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.reference} — {a.attributaires?.nom ?? "?"} ({a.statut})</SelectItem>
                ))}
              </ChampSelect>
            )}

            {type === "honoraires" && (
              <ChampSelect
                id="pay-dem"
                label="Démarche concernée"
                value={demarcheId || VIDE}
                onChange={(v) => setDemarcheId(v === VIDE ? "" : v)}
              >
                <SelectItem value={VIDE}>— Sélectionner —</SelectItem>
                {demarches.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {TYPE_DEMARCHE_LABELS[d.type as TypeDemarche] ?? d.type ?? "Démarche"} — {d.attributaires?.nom ?? "?"} ({d.montant_honoraires != null ? fcfa(d.montant_honoraires) : "à chiffrer"})
                  </SelectItem>
                ))}
              </ChampSelect>
            )}

            {type === "vente_terrain" && (
              <>
                <ChampSelect
                  id="pay-vente"
                  label="Vente"
                  value={venteId || VIDE}
                  onChange={(v) => setVenteId(v === VIDE ? "" : v)}
                >
                  <SelectItem value={VIDE}>— Sélectionner —</SelectItem>
                  {ventes.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.attributaires?.nom ?? "?"} — {fcfa(v.prix_total)} ({v.type_vente})</SelectItem>
                  ))}
                </ChampSelect>
                {venteChoisie?.type_vente === "echelonne" && (
                  <ChampSelect
                    id="pay-ech"
                    label="Échéance"
                    value={echeanceId || VIDE}
                    onChange={(v) => setEcheanceId(v === VIDE ? "" : v)}
                  >
                    <SelectItem value={VIDE}>— Sélectionner —</SelectItem>
                    {echeances.map((e) => (
                      <SelectItem key={e.id} value={e.id}>Échéance {e.numero} — {fcfa(e.montant_du)} (due le {e.date_echeance})</SelectItem>
                    ))}
                  </ChampSelect>
                )}
              </>
            )}

            {type === "autre" && (
              <ChampSelect
                id="pay-attr"
                label="Attributaire concerné"
                value={autreAttributaireId || VIDE}
                onChange={(v) => setAutreAttributaireId(v === VIDE ? "" : v)}
              >
                <SelectItem value={VIDE}>— Sélectionner —</SelectItem>
                {attributaires.map((a) => <SelectItem key={a.id} value={a.id}>{a.nom}</SelectItem>)}
              </ChampSelect>
            )}

            <div className="space-y-1.5">
              <label htmlFor="pay-montant" className="text-[13px] font-semibold text-foreground">Montant total (FCFA)</label>
              <Input
                id="pay-montant"
                type="number"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                readOnly={montantReadOnly}
                placeholder="Ex : 250000"
                className="read-only:bg-inset"
              />
              {tarifActif?.montant_min != null && tarifActif.montant_max != null && (
                <p className="text-xs text-muted-2">
                  Grille tarifaire : {fcfa(tarifActif.montant_min)} – {fcfa(tarifActif.montant_max)}
                </p>
              )}
              {type === "honoraires" && demarcheChoisie && !tarifActif && demarcheChoisie.montant_honoraires == null && (
                <p className="text-xs text-warning">
                  Montant non encore fixé dans la grille tarifaire — saisie libre à confirmer.
                </p>
              )}
            </div>

            <Field label="Bénéficiaire" htmlFor="pay-benef">
              <Input
                id="pay-benef"
                type="text"
                value={beneficiaire}
                onChange={(e) => setBeneficiaire(e.target.value)}
                placeholder="Nom complet"
              />
            </Field>

            <ChampSelect id="pay-moyen" label="Moyen de paiement" value={moyen} onChange={setMoyen}>
              {MOYEN_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </ChampSelect>

            {/* Les deux motifs coexistent : la liste d'options peut être
                illisible ET la saisie invalide. Les afficher séparément évite
                que l'un chasse l'autre. */}
            {chargeErr && (
              <p role="alert" className="rounded-md border border-danger/25 bg-danger-subtle px-3 py-2 text-xs font-medium text-danger">
                {chargeErr} — la liste ci-dessus est donc incomplète.
              </p>
            )}

            {err && (
              <p role="alert" className="rounded-md border border-danger/25 bg-danger-subtle px-3 py-2 text-xs font-medium text-danger">
                {err}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" variant="primary" loading={saving}>
              {saving ? "Enregistrement…" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Tarifs 3e attestation par chefferie (niveau 3) — admin ───────────────────
// La 1re attestation est gratuite, la 2e au forfait national (table `tarifs`).
// À partir de la 3e, le tarif est propre à chaque chefferie (autorité coutumière)
// et vit dans `tarifs_attestation_chefferie`. Sans ligne pour une chefferie,
// creer_cession() bloque toute 3e cession. Cet écran (admin) permet de fixer /
// activer ces tarifs. Écriture directe : la RLS `..._admin_write` réserve l'accès.

type ChefferieTarif = {
  autorite_coutumiere_id: string;
  nom: string;
  montant_chefferie: number | null;
  commission_sgfn: number | null;
  actif: boolean;
  hasRow: boolean;
};

function TarifsChefferieAdmin() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ChefferieTarif[]>([]);
  const [edits, setEdits] = useState<Record<string, { montant: string; commission: string; actif: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [chefRes, tarifRes] = await Promise.all([
      supabase.from("autorites_coutumieres").select("id, nom").order("nom", { ascending: true }),
      supabase
        .from("tarifs_attestation_chefferie")
        .select("autorite_coutumiere_id, montant_chefferie, commission_sgfn, actif"),
    ]);
    const tarifMap = new Map<string, { montant_chefferie: number | null; commission_sgfn: number | null; actif: boolean }>();
    for (const t of tarifRes.data ?? []) tarifMap.set(t.autorite_coutumiere_id, t);
    const list: ChefferieTarif[] = (chefRes.data ?? []).map((c) => {
      const t = tarifMap.get(c.id);
      return {
        autorite_coutumiere_id: c.id,
        nom: c.nom,
        montant_chefferie: t?.montant_chefferie ?? null,
        commission_sgfn: t?.commission_sgfn ?? null,
        actif: t?.actif ?? true,
        hasRow: !!t,
      };
    });
    setRows(list);
    const e: Record<string, { montant: string; commission: string; actif: boolean }> = {};
    for (const r of list) {
      e[r.autorite_coutumiere_id] = {
        montant: r.montant_chefferie != null ? String(r.montant_chefferie) : "",
        commission: r.commission_sgfn != null ? String(r.commission_sgfn) : "",
        actif: r.actif,
      };
    }
    setEdits(e);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  const setField = (id: string, field: "montant" | "commission", value: string) =>
    setEdits((s) => ({ ...s, [id]: { ...s[id], [field]: value.replace(/[^0-9]/g, "") } }));
  const toggleActif = (id: string) =>
    setEdits((s) => ({ ...s, [id]: { ...s[id], actif: !s[id]?.actif } }));

  const save = async (id: string) => {
    const e = edits[id];
    if (!e) return;
    const montant = e.montant.trim() === "" ? null : Number(e.montant);
    const commission = e.commission.trim() === "" ? null : Number(e.commission);
    if (e.actif && (montant == null || commission == null)) {
      setError("Renseignez le montant chefferie et la commission SGNF avant d'activer le tarif.");
      return;
    }
    setSavingId(id);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("tarifs_attestation_chefferie").upsert(
      {
        autorite_coutumiere_id: id,
        montant_chefferie: montant,
        commission_sgfn: commission,
        actif: e.actif,
        maj_par: user?.id ?? null,
        maj_le: new Date().toISOString(),
      },
      { onConflict: "autorite_coutumiere_id" }
    );
    setSavingId(null);
    if (err) {
      setError(err.message);
      return;
    }
    setSavedId(id);
    setTimeout(() => setSavedId(null), 2000);
    await load();
  };

  const nbConfigures = rows.filter((r) => r.hasRow && r.actif).length;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-inset/60"
      >
        <span className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold text-foreground">Tarifs 3e attestation par chefferie</span>
          <span className="rounded-full bg-inset px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {nbConfigures}/{rows.length} actif(s)
          </span>
        </span>
        <span className="text-xs font-medium text-accent">{open ? "Masquer" : "Configurer"}</span>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4">
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            À partir de la 3e attestation de cession sur un lot, le tarif dépend de la chefferie
            (autorité coutumière) du lotissement. Total facturé = montant chefferie + commission SGNF.
            Une chefferie sans tarif actif bloque toute 3e cession de ses lots.
          </p>

          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-danger/25 bg-danger-subtle px-3 py-2 text-xs text-danger">
              <X className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <p className="py-4 text-center text-sm text-muted-2">Chargement…</p>
          ) : rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-2">Aucune chefferie enregistrée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-2">
                    <th className="py-2 pr-3 font-medium">Chefferie</th>
                    <th className="py-2 pr-3 font-medium">Montant chefferie</th>
                    <th className="py-2 pr-3 font-medium">Commission SGNF</th>
                    <th className="py-2 pr-3 font-medium">Total</th>
                    <th className="py-2 pr-3 font-medium">Actif</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const e = edits[r.autorite_coutumiere_id] ?? { montant: "", commission: "", actif: true };
                    const total = (Number(e.montant) || 0) + (Number(e.commission) || 0);
                    return (
                      <tr key={r.autorite_coutumiere_id} className="border-b border-border last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-foreground">
                          {r.nom}
                          {!r.hasRow && (
                            <Badge tone="warning" className="ml-2">à définir</Badge>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          <Input
                            inputMode="numeric"
                            value={e.montant}
                            onChange={(ev) => setField(r.autorite_coutumiere_id, "montant", ev.target.value)}
                            placeholder="0"
                            className="w-28 tabular-nums"
                          />
                        </td>
                        <td className="py-2.5 pr-3">
                          <Input
                            inputMode="numeric"
                            value={e.commission}
                            onChange={(ev) => setField(r.autorite_coutumiere_id, "commission", ev.target.value)}
                            placeholder="0"
                            className="w-28 tabular-nums"
                          />
                        </td>
                        <td className="py-2.5 pr-3 font-semibold tabular-nums text-accent">{fcfa(total)}</td>
                        <td className="py-2.5 pr-3">
                          <button
                            type="button"
                            onClick={() => toggleActif(r.autorite_coutumiere_id)}
                            className={`inline-flex h-5 w-9 items-center rounded-full px-0.5 transition-colors ${
                              e.actif ? "bg-success" : "bg-border-strong"
                            }`}
                            aria-pressed={e.actif}
                          >
                            <span
                              className={`h-4 w-4 rounded-full bg-white transition-transform ${e.actif ? "translate-x-4" : ""}`}
                            />
                          </button>
                        </td>
                        <td className="py-2.5">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => void save(r.autorite_coutumiere_id)}
                            disabled={savingId === r.autorite_coutumiere_id}
                          >
                            {savedId === r.autorite_coutumiere_id ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Enregistré
                              </>
                            ) : savingId === r.autorite_coutumiere_id ? (
                              "Enregistrement…"
                            ) : (
                              "Enregistrer"
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Frais agrégateur (fixe par transaction en ligne) — admin ─────────────────
function FraisAgregateurConfig() {
  const supabase = useMemo(() => createClient(), []);
  const [valeur, setValeur] = useState("");
  const [initial, setInitial] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("parametres_paiement")
      .select("valeur")
      .eq("cle", "frais_agregateur_fixe")
      .maybeSingle();
    const v = data?.valeur ?? "0";
    setValeur(v);
    setInitial(v);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    const v = valeur.trim() === "" ? "0" : valeur.replace(/[^0-9]/g, "");
    const { error: e } = await supabase
      .from("parametres_paiement")
      .update({ valeur: v })
      .eq("cle", "frais_agregateur_fixe");
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    setValeur(v);
    setInitial(v);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card className="px-5 py-4">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-accent" />
        <span className="text-sm font-semibold text-foreground">Frais agrégateur — paiement en ligne</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Montant <span className="font-medium text-foreground">fixe</span> prélevé par l&apos;agrégateur (CinetPay) sur chaque
        transaction en ligne. Déduit de la commission SGNF (attestation) ; absorbé par l&apos;acquéreur (vente).
        Les paiements au guichet (espèces/virement) ne sont pas concernés.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Input
            inputMode="numeric"
            value={valeur}
            onChange={(e) => setValeur(e.target.value.replace(/[^0-9]/g, ""))}
            disabled={loading}
            placeholder="0"
            className="w-40 pr-14 tabular-nums"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-2">FCFA</span>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => void save()}
          disabled={saving || loading || valeur === initial}
        >
          {saved ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" /> Enregistré
            </>
          ) : saving ? (
            "Enregistrement…"
          ) : (
            "Enregistrer"
          )}
        </Button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </Card>
  );
}

function PaiementsContenu() {
  const supabase = useMemo(() => createClient(), []);
  const { counts } = useBadgeCounts();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [paiements, setPaiements] = useState<PaiementRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentAttributaireId, setCurrentAttributaireId] = useState<string | null>(null);
  const [groupe, setGroupe] = useState<Groupe | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  /** Motif d'un registre non lu (distinct de `payError`, propre au paiement). */
  const [chargeErreur, setChargeErreur] = useState<string | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [openRepart, setOpenRepart] = useState<string | null>(null);
  const [repartitions, setRepartitions] = useState<Record<string, RepartLigne[]>>({});

  const canCreate = groupe === "admin" || groupe === "operateur";
  const isAdmin = groupe === "admin";

  // La vue est dérivée de l'URL : la sous-entrée « Réconciliation » de la barre
  // (`?vue=reconciliation`) ouvre la file de validation manuelle, « Transactions »
  // le registre. Toute bascule ici reflète l'URL en miroir (barre resurlignée).
  const vue: "registre" | "a_valider" =
    searchParams.get("vue") === "reconciliation" ? "a_valider" : "registre";

  const changerVue = useCallback(
    (v: "registre" | "a_valider") => {
      router.replace(v === "a_valider" ? `${pathname}?vue=reconciliation` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const loadPaiements = useCallback(async () => {
    setDataLoading(true);
    const { data, error } = await supabase
      .from("paiements")
      .select("id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut, cree_le, acquereur_id, reference_externe, reference, echeance_id, vente_id, attributaires(nom), ventes(type_vente)")
      .order("cree_le", { ascending: false });
    const rows = (data ?? []) as unknown as PaiementRecord[];
    setPaiements(rows);
    // 🔴 Le registre refusé s'affichait « aucun paiement » : une caisse vide
    // et une caisse illisible ne peuvent pas se ressembler.
    setChargeErreur(error ? messageLecture("le registre des paiements", error) : null);
    setDataLoading(false);

    // Ventilation (répartition) des paiements confirmés
    const confirmedIds = rows.filter((p) => p.statut === "confirme").map((p) => p.id);
    if (confirmedIds.length === 0) {
      setRepartitions({});
      return;
    }
    const { data: reps, error: repsErr } = await supabase
      .from("repartitions_paiement")
      .select("paiement_id, beneficiaire_type, nom, montant")
      .in("paiement_id", confirmedIds);
    const map: Record<string, RepartLigne[]> = {};
    for (const r of (reps ?? []) as { paiement_id: string; beneficiaire_type: string; nom: string | null; montant: number }[]) {
      (map[r.paiement_id] ??= []).push({ beneficiaire_type: r.beneficiaire_type, nom: r.nom, montant: r.montant });
    }
    setRepartitions(map);
    if (repsErr) setChargeErreur(messageLecture("la ventilation des paiements confirmés", repsErr));
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("groupe, attributaire_id")
        .eq("id", user.id)
        .single();
      if (profile) {
        setGroupe(profile.groupe as Groupe);
        setCurrentAttributaireId(profile.attributaire_id);
      }

      await loadPaiements();
    };
    void init();
  }, [loadPaiements, supabase]);

  const handlePayer = async (p: PaiementRecord) => {
    setPayingId(p.id);
    setPayError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setPayingId(null); return; }

    const res = await invokeEdge<{ payment_url: string }>(
      supabase,
      "initier-paiement",
      { paiement_id: p.id },
      "Erreur lors de l'initialisation du paiement.",
    );

    if (res.error || !res.data) {
      setPayError(res.error ?? "Erreur lors de l'initialisation du paiement.");
      setPayingId(null);
      return;
    }

    // Redirection vers CinetPay
    window.location.assign(res.data.payment_url);
  };

  const handleValider = async (p: PaiementRecord) => {
    if (!currentUserId) return;
    setValidatingId(p.id);
    const { error } = await supabase.rpc("valider_paiement_manuel", {
      p_paiement_id: p.id,
      p_validateur: currentUserId,
    });
    if (!error) await loadPaiements();
    setValidatingId(null);
  };

  const handleTelechargerRecu = async (p: PaiementRecord) => {
    if (!p.reference) return;
    setDownloadingId(p.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/telecharger-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ table: "paiements", reference: p.reference }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.erreur || "Erreur");
      window.open(json.url, "_blank");
    } catch {
      setPayError("Le reçu n'est pas encore disponible pour ce paiement.");
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmes = paiements.filter((p) => p.statut === "confirme");
  const totalEncaisse = confirmes.reduce((s, p) => s + (p.montant_total ?? 0), 0);
  const totalCommission = confirmes.reduce((s, p) => s + (p.commission_sgfn ?? 0), 0);
  const enAttente = paiements.filter((p) => p.statut === "en_attente").length;
  const aValider = paiements.filter((p) => p.statut === "en_attente_validation");

  const paiementsAffiches = vue === "a_valider" ? aValider : paiements;

  return (
    <AppShell loading={dataLoading} counts={counts} onRefresh={loadPaiements}>
      {showModal && (
        <NouveauPaiementModal
          onClose={() => setShowModal(false)}
          onCreated={() => void loadPaiements()}
        />
      )}

      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Suivi des paiements
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Traçabilité des transactions, honoraires et commissions de la plateforme.{" "}
            <span className={enAttente > 0 ? "font-medium text-warning" : "font-medium text-success"}>
              {enAttente} en attente.
            </span>
          </p>
        </div>

        {canCreate && (
          <Button type="button" variant="primary" className="shrink-0" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" />
            Nouveau paiement
          </Button>
        )}
      </div>

      {chargeErreur && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger-subtle px-4 py-3 text-sm font-medium text-danger">
          {chargeErreur}
        </p>
      )}

      {isAdmin && (
        <div className="flex gap-2">
          <button
            onClick={() => changerVue("registre")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${vue === "registre" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-inset"}`}
          >
            Registre
          </button>
          <button
            onClick={() => changerVue("a_valider")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${vue === "a_valider" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-inset"}`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            À valider
            {aValider.length > 0 && (
              <CountBadge tone={vue === "a_valider" ? "inverse" : "brick"} value={aValider.length} />
            )}
          </button>
        </div>
      )}

      {payError && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/25 bg-danger-subtle px-4 py-3 text-sm text-danger">
          <X className="h-4 w-4 shrink-0" />
          {payError}
          <button onClick={() => setPayError(null)} className="ml-auto font-medium underline">
            Fermer
          </button>
        </div>
      )}

      {/* KPI */}
      {vue === "registre" && (
        <motion.section
          variants={stagger(0, 0.05)}
          initial="hidden"
          animate="show"
          className="grid gap-4 sm:grid-cols-3"
          aria-label="Indicateurs des paiements"
        >
          <Kpi icon={Banknote} label="Total encaissé" loading={dataLoading} value={totalEncaisse} format={fcfa} legende={<>paiements confirmés</>} />
          <Kpi icon={TrendingUp} label="Commission SGNF" loading={dataLoading} value={totalCommission} format={fcfa} legende={<>part de la plateforme</>} />
          <Kpi icon={Clock} label="Paiements en attente" loading={dataLoading} value={enAttente} tone={enAttente > 0 ? "warning" : "neutral"} legende={<>à traiter</>} />
        </motion.section>
      )}

      {/* Config admin : frais agrégateur + tarifs 3e attestation par chefferie */}
      {isAdmin && vue === "registre" && <FraisAgregateurConfig />}
      {isAdmin && vue === "registre" && <TarifsChefferieAdmin />}

      {/* Tableau. La teinte d'alerte ne vaut que pour la vue « À valider » : en
          vue Registre, la même carte affiche l'historique complet, qui n'attend
          personne — la teindre reviendrait à la peindre en permanence. */}
      <Card
        tone={vue === "a_valider" && aValider.length > 0 ? "alert" : "default"}
        className="overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border bg-inset px-5 py-3 group-data-[tone=alert]/card:border-brick group-data-[tone=alert]/card:bg-brick">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground group-data-[tone=alert]/card:text-brick-foreground">
            {vue === "a_valider" ? "Paiements en attente de validation manuelle" : "Registre des transactions"}
          </p>
          {vue === "a_valider" && aValider.length > 0 && (
            <CountBadge tone="inverse" value={aValider.length} />
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-inset">
                {TABLE_HEADERS.map((header, i) => (
                  <th
                    key={header || `col-${i}`}
                    scope="col"
                    className="px-5 py-3.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dataLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    Chargement des paiements…
                  </td>
                </tr>
              ) : paiementsAffiches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="h-6 w-6 text-muted-2" />
                      {chargeErreur
                        ? "Registre non lu — voir le message ci-dessus."
                        : vue === "a_valider"
                          ? "Aucun paiement à valider."
                          : "Aucun paiement enregistré."}
                    </div>
                  </td>
                </tr>
              ) : (
                paiementsAffiches.map((p) => {
                  const cfg = STATUT_CONFIG[p.statut ?? "en_attente"] ?? STATUT_CONFIG.en_attente;
                  const canPay =
                    vue === "registre" &&
                    p.statut === "en_attente" &&
                    !isMoyenManuel(p.moyen) &&
                    p.acquereur_id === currentAttributaireId;

                  const repart = repartitions[p.id] ?? [];
                  return (
                    <Fragment key={p.id}>
                    <tr className="transition-colors hover:bg-inset/60">
                      <td className="px-5 py-4 font-mono text-xs font-medium text-accent">
                        {p.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="max-w-[180px] truncate px-5 py-4 text-sm text-foreground">
                        {p.beneficiaire || (p.attributaires as { nom: string | null } | null)?.nom || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {labelTypePaiement(p.type, p.ventes?.type_vente)}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold tabular-nums text-foreground">
                        {fcfa(p.montant_total)}
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {MOYEN_LABELS[p.moyen ?? ""] ?? p.moyen ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={BADGE_TONE[cfg.badge] ?? "warning"}>{cfg.label}</Badge>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-2">
                        {p.cree_le
                          ? new Date(p.cree_le).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          {canPay && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => void handlePayer(p)}
                              disabled={payingId === p.id}
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              {payingId === p.id ? "…" : "Payer"}
                            </Button>
                          )}
                          {vue === "a_valider" && (
                            <Button
                              variant="primary"
                              size="sm"
                              className="bg-success text-white hover:bg-success/90"
                              onClick={() => void handleValider(p)}
                              disabled={validatingId === p.id}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {validatingId === p.id ? "…" : "Valider"}
                            </Button>
                          )}
                          {vue === "registre" && p.statut === "confirme" && p.reference && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleTelechargerRecu(p)}
                              disabled={downloadingId === p.id}
                              title="Télécharger le reçu"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {downloadingId === p.id ? "…" : "Reçu"}
                            </Button>
                          )}
                          {repart.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setOpenRepart(openRepart === p.id ? null : p.id)}
                              title="Voir la répartition"
                              className={openRepart === p.id ? "border-accent text-accent" : undefined}
                            >
                              <TrendingUp className="h-3.5 w-3.5" />
                              Répartition
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {openRepart === p.id && repart.length > 0 && (
                      <tr className="bg-inset/50">
                        <td colSpan={8} className="px-5 py-3">
                          <div className="flex flex-wrap items-stretch gap-2">
                            {repart.map((r, i) => (
                              <div
                                key={i}
                                className="min-w-[150px] rounded-lg border border-border bg-card px-3 py-2"
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">
                                  {BENEF_LABELS[r.beneficiaire_type] ?? r.beneficiaire_type}
                                </p>
                                {r.nom && <p className="truncate text-xs text-muted-foreground">{r.nom}</p>}
                                <p className="mt-0.5 text-sm font-bold tabular-nums text-accent">{fcfa(r.montant)}</p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Info agrégateur */}
      <p className="text-center text-xs text-muted-2">
        Paiements en ligne sécurisés via{" "}
        <span className="font-semibold text-muted-foreground">CinetPay</span> —
        Wave · Orange Money · MTN Money · Moov Money · Visa / Mastercard
      </p>
    </AppShell>
  );
}

// `useSearchParams` (vue Transactions/Réconciliation) impose une borne Suspense
// en export statique (output: export).
export default function PaiementsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      }
    >
      <PaiementsContenu />
    </Suspense>
  );
}
