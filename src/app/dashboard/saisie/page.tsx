"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardEdit,
  HelpCircle,
  Loader2,
  Plus,
  Search,
  Send,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { CountBadge } from "@/components/ds/badge";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { AppShell } from "@/components/pilotage/AppShell";
import { Button } from "@/components/ds/button";
import { fetchAllPages } from "@/lib/supabase-pagination";
import { FileValidation } from "@/components/dashboard/saisie/FileValidation";
import { ImportExcel } from "@/components/dashboard/saisie/ImportExcel";
import { CreationStructure } from "@/components/dashboard/saisie/CreationStructure";
import {
  CLASSE_LABELS,
  QUALITE_OPTIONS,
  classifier,
  labelQualite,
  type CibleChoisie,
  type ClasseChangement,
  type LotEtat,
  type NouvelAttributaire,
  type OperationCible,
  type PayloadMajAttributions,
  type Qualite,
  type ResumeCreation,
  type ResumeMaj,
  type StatutSoumission,
  type TypeSoumission,
} from "@/lib/saisie";
import type { Json } from "../../../../database.types";

type Lotissement = { id: string; nom: string | null; village: string | null };

type AttributaireOption = {
  id: string;
  nom: string | null;
  piece_nature: string | null;
  piece_num: string | null;
};

type Soumission = {
  id: string;
  type: TypeSoumission;
  titre: string | null;
  statut: StatutSoumission;
  resume: ResumeMaj | ResumeCreation | null;
  resultat: Record<string, unknown> | null;
  commentaire_admin: string | null;
  cree_le: string | null;
  traite_le: string | null;
};

const STATUT_BADGE: Record<StatutSoumission, { label: string; status: "attribue" | "en_validation" | "litige" | "disponible" }> = {
  en_attente: { label: "En attente", status: "en_validation" },
  approuvee: { label: "Approuvée", status: "attribue" },
  rejetee: { label: "Rejetée", status: "litige" },
};

const CLASSE_BADGE: Record<ClasseChangement, "attribue" | "en_validation" | "litige" | "disponible"> = {
  nouvelle_attribution: "attribue",
  reassignation: "en_validation",
  remise_libre: "disponible",
  inchange: "disponible",
};

export default function SaisiePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { profile, loading: profileLoading } = useProfile();
  const { counts } = useBadgeCounts();

  const isAdmin = profile?.groupe === "admin";
  const autorise =
    !profileLoading &&
    (profile?.groupe === "operateur_saisie" || profile?.groupe === "admin");

  // Garde d'accès : seuls opérateur de saisie et admin voient ce module.
  useEffect(() => {
    if (!profileLoading && profile && !autorise) {
      router.replace("/dashboard");
    }
  }, [profileLoading, profile, autorise, router]);

  // Onglet 2 : « File de validation » pour l'admin (checker), « Mes soumissions » pour l'opérateur.
  const [tab, setTab] = useState<"saisie" | "soumissions">("saisie");

  // Mettre à jour un lotissement existant (attributions), ou en créer un nouveau
  // (formulaire séparé, cf. décision : l'Excel ne sert qu'aux attributions).
  const [modeType, setModeType] = useState<"maj" | "creation">("maj");

  // ── Données de référence ──
  const [lotissements, setLotissements] = useState<Lotissement[]>([]);
  const [lotissementId, setLotissementId] = useState("");
  const [etats, setEtats] = useState<LotEtat[]>([]);
  const [etatsLoading, setEtatsLoading] = useState(false);

  // ── Modifications en cours (une cible par lot) ──
  const [mods, setMods] = useState<Record<string, CibleChoisie>>({});
  const [nouveaux, setNouveaux] = useState<NouvelAttributaire[]>([]);

  // Saisie manuelle lot par lot, ou import d'un fichier Excel simplifié — les
  // deux modes alimentent les mêmes `mods`/`nouveaux`, donc le même aperçu du
  // diff et la même soumission ci-dessous.
  const [modeSaisie, setModeSaisie] = useState<"manuel" | "import">("manuel");

  // ── Éditeur de lot ──
  const [lotFiltre, setLotFiltre] = useState("");
  const [lotSelId, setLotSelId] = useState<string | null>(null);
  const [action, setAction] = useState<"attribue" | "libre">("attribue");
  const [qualite, setQualite] = useState<Qualite>("ayant_droit");
  const [attSel, setAttSel] = useState<
    | { kind: "existant"; id: string; nom: string }
    | { kind: "nouveau"; ref: string; nom: string }
    | null
  >(null);

  // ── Recherche attributaire ──
  const [attQuery, setAttQuery] = useState("");
  const [attResults, setAttResults] = useState<AttributaireOption[]>([]);
  const [showNouveauForm, setShowNouveauForm] = useState(false);
  const [nouveauForm, setNouveauForm] = useState({
    nom: "",
    type: "personne_physique" as NouvelAttributaire["type"],
    piece_nature: "",
    piece_num: "",
    telephone: "",
  });

  // ── Soumission ──
  const [titre, setTitre] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // ── Mes soumissions ──
  const [soumissions, setSoumissions] = useState<Soumission[]>([]);
  const [soumissionsLoading, setSoumissionsLoading] = useState(false);
  /** Ce qui attend l'agent : ses soumissions renvoyées par l'admin. */
  const aCorriger = soumissions.filter((s) => s.statut === "rejetee").length;

  // Chargement des lotissements
  useEffect(() => {
    if (!autorise) return;
    supabase
      .from("lotissements")
      .select("id, nom, village")
      .order("nom")
      .then(({ data }) => setLotissements((data ?? []) as Lotissement[]));
  }, [autorise, supabase]);

  // Changement de lotissement : resets synchrones dans le handler (hors effet).
  const onSelectLotissement = (id: string) => {
    setLotissementId(id);
    setMods({});
    setNouveaux([]);
    setLotSelId(null);
    setLotFiltre("");
    setMessage(null);
    setEtats([]);
    setEtatsLoading(!!id);
    setModeSaisie("manuel");
  };

  // Chargement de l'état du lotissement sélectionné.
  // L'embed imbriqué lots→attributions→attributaires timeoutait (8 s → HTTP 500 →
  // liste vide) sur un gros lotissement (Brignan = 846 lots). On charge à plat :
  // les lots du lotissement + les attributions ACTUELLES (les seules affichées),
  // fusion par lot_id, avec pagination. Cf. audit dashboards 18/07.
  useEffect(() => {
    if (!lotissementId) return;
    let active = true;
    void (async () => {
      type LotFlat = { id: string; numero_lot: string | null; statut: string | null; verrouille: boolean | null; ilots: { numero: string | null } | null };
      type AttrFlat = { lot_id: string | null; attributaire_id: string | null; qualite: string | null; attributaires: { nom: string | null } | null };
      const [lotsData, attrsData] = await Promise.all([
        fetchAllPages<LotFlat>((from, to) =>
          supabase
            .from("lots")
            // `verrouille` = gel juridique : la base refuse désormais d'appliquer
            // une opération sur un lot gelé, l'écran doit donc pouvoir le dire
            // AVANT que l'opérateur ne construise sa soumission.
            .select("id, numero_lot, statut, verrouille, ilots!inner(numero, lotissement_id)")
            .eq("ilots.lotissement_id", lotissementId)
            .order("numero_lot", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to) as unknown as PromiseLike<{ data: LotFlat[] | null }>
        ),
        fetchAllPages<AttrFlat>((from, to) =>
          supabase
            .from("attributions")
            .select("lot_id, attributaire_id, qualite, attributaires(nom)")
            .eq("actuel", true)
            .order("id", { ascending: true })
            .range(from, to) as unknown as PromiseLike<{ data: AttrFlat[] | null }>
        ),
      ]);
      if (!active) return;
      const attrByLot = new Map<string, AttrFlat>();
      for (const a of attrsData) if (a.lot_id) attrByLot.set(a.lot_id, a);
      const list: LotEtat[] = lotsData.map((r) => {
        const act = attrByLot.get(r.id);
        return {
          lot_id: r.id,
          ilot: r.ilots?.numero ?? "—",
          numero_lot: r.numero_lot ?? "—",
          statut: r.statut ?? "—",
          attributaire_id: act?.attributaire_id ?? null,
          attributaire_nom: act?.attributaires?.nom ?? null,
          qualite: (act?.qualite as Qualite) ?? null,
          verrouille: r.verrouille === true,
        };
      });
      setEtats(list);
      setEtatsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [lotissementId, supabase]);

  // Recherche attributaire (débounce léger). L'affichage est déjà gardé par
  // attQuery.trim().length >= 2, donc pas besoin de vider attResults ici.
  useEffect(() => {
    const q = attQuery.trim();
    if (q.length < 2) return;
    let active = true;
    const t = setTimeout(() => {
      supabase
        .from("attributaires")
        .select("id, nom, piece_nature, piece_num")
        .ilike("nom", `%${q}%`)
        .order("nom")
        .limit(20)
        .then(({ data }) => {
          if (active) setAttResults((data ?? []) as AttributaireOption[]);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [attQuery, supabase]);

  // Chargement des soumissions à l'ouverture de l'onglet (loading posé par le
  // handler d'onglet ; setState uniquement dans le callback .then).
  useEffect(() => {
    // L'admin utilise l'onglet « File de validation » (FileValidation) qui charge lui-même.
    if (tab !== "soumissions" || !autorise || isAdmin) return;
    let active = true;
    supabase
      .from("soumissions_saisie")
      .select("id, type, titre, statut, resume, resultat, commentaire_admin, cree_le, traite_le")
      .order("cree_le", { ascending: false })
      .then(({ data }) => {
        if (!active) return;
        setSoumissions((data ?? []) as unknown as Soumission[]);
        setSoumissionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, autorise, isAdmin, supabase]);

  const etatByLot = useMemo(() => {
    const m = new Map<string, LotEtat>();
    etats.forEach((e) => m.set(e.lot_id, e));
    return m;
  }, [etats]);

  const lotsFiltres = useMemo(() => {
    const q = lotFiltre.trim().toLowerCase();
    if (!q) return etats.slice(0, 30);
    return etats
      .filter(
        (e) =>
          e.numero_lot.toLowerCase().includes(q) ||
          e.ilot.toLowerCase().includes(q) ||
          (e.attributaire_nom ?? "").toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [etats, lotFiltre]);

  const lotSel = lotSelId ? etatByLot.get(lotSelId) ?? null : null;

  // Application d'une cible au lot sélectionné → ajoute/écrase dans mods.
  const appliquerAuLot = () => {
    if (!lotSel) return;
    let cible: CibleChoisie;
    if (action === "libre") {
      cible = { type: "libre" };
    } else {
      if (!attSel) {
        setMessage({ kind: "err", text: "Sélectionnez ou créez un attributaire." });
        return;
      }
      cible =
        attSel.kind === "existant"
          ? { type: "attribue", attributaire_id: attSel.id, attributaire_nom: attSel.nom, qualite }
          : { type: "attribue", attributaire_ref: attSel.ref, attributaire_nom: attSel.nom, qualite };
    }
    setMods((m) => ({ ...m, [lotSel.lot_id]: cible }));
    // reset éditeur
    setLotSelId(null);
    setLotFiltre("");
    setAttSel(null);
    setAttQuery("");
    setAttResults([]);
    setAction("attribue");
    setQualite("ayant_droit");
    setMessage(null);
  };

  const retirerMod = (lotId: string) => {
    setMods((m) => {
      const next = { ...m };
      delete next[lotId];
      return next;
    });
  };

  const creerNouveau = () => {
    const nom = nouveauForm.nom.trim();
    if (!nom) return;
    const ref = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const na: NouvelAttributaire = {
      ref,
      nom,
      type: nouveauForm.type,
      piece_nature: nouveauForm.piece_nature.trim() || undefined,
      piece_num: nouveauForm.piece_num.trim() || undefined,
      telephone: nouveauForm.telephone.trim() || undefined,
    };
    setNouveaux((n) => [...n, na]);
    setAttSel({ kind: "nouveau", ref, nom });
    setShowNouveauForm(false);
    setNouveauForm({ nom: "", type: "personne_physique", piece_nature: "", piece_num: "", telephone: "" });
  };

  // Diff calculé à partir des mods.
  const changements = useMemo(() => {
    return Object.entries(mods).map(([lotId, cible]) => {
      const etat = etatByLot.get(lotId)!;
      const classe = classifier(etat, cible);
      return { lotId, etat, cible, classe };
    });
  }, [mods, etatByLot]);

  const resume: ResumeMaj = useMemo(() => {
    const r: ResumeMaj = {
      nouvelles_attributions: 0,
      reassignations: 0,
      remises_libre: 0,
      inchanges: 0,
      nouveaux_attributaires: 0,
    };
    const refsUtilises = new Set<string>();
    for (const c of changements) {
      if (c.classe === "nouvelle_attribution") r.nouvelles_attributions++;
      else if (c.classe === "reassignation") r.reassignations++;
      else if (c.classe === "remise_libre") r.remises_libre++;
      else r.inchanges++;
      if (c.cible.type === "attribue" && c.cible.attributaire_ref) refsUtilises.add(c.cible.attributaire_ref);
    }
    r.nouveaux_attributaires = refsUtilises.size;
    return r;
  }, [changements]);

  const nbEffectifs = resume.nouvelles_attributions + resume.reassignations + resume.remises_libre;

  const soumettre = async () => {
    // opérations = changements réels uniquement (on exclut les no-op)
    const operations: OperationCible[] = [];
    const refsUtilises = new Set<string>();
    for (const c of changements) {
      if (c.classe === "inchange") continue;
      if (c.cible.type === "libre") {
        operations.push({ lot_id: c.lotId, cible: "libre" });
      } else {
        const base = { lot_id: c.lotId, cible: "attribue" as const, qualite: c.cible.qualite };
        if (c.cible.attributaire_id) {
          operations.push({ ...base, attributaire_id: c.cible.attributaire_id });
        } else if (c.cible.attributaire_ref) {
          operations.push({ ...base, attributaire_ref: c.cible.attributaire_ref });
          refsUtilises.add(c.cible.attributaire_ref);
        }
      }
    }
    if (operations.length === 0) {
      setMessage({ kind: "err", text: "Aucun changement à soumettre." });
      return;
    }
    const nouveaux_attributaires = nouveaux.filter((n) => refsUtilises.has(n.ref));
    const payload: PayloadMajAttributions = {
      lotissement_id: lotissementId,
      nouveaux_attributaires,
      operations,
    };
    const lotName = lotissements.find((l) => l.id === lotissementId)?.nom ?? "";
    const titreFinal = titre.trim() || `Mise à jour attributions — ${lotName}`;

    setSubmitting(true);
    setMessage(null);
    const { error } = await supabase.rpc("soumettre_saisie", {
      p_type: "maj_attributions",
      p_lotissement_id: lotissementId,
      p_titre: titreFinal,
      p_payload: payload as unknown as Json,
      p_resume: resume as unknown as Json,
    });
    setSubmitting(false);
    if (error) {
      setMessage({ kind: "err", text: error.message });
      return;
    }
    setMessage({
      kind: "ok",
      text: "Soumission envoyée. Un administrateur doit l'approuver avant application.",
    });
    setMods({});
    setNouveaux([]);
    setTitre("");
    // Met à jour la pastille « à valider » (utile si un admin soumet lui-même).
    window.dispatchEvent(new Event("sgnf:refresh-badges"));
  };

  if (profileLoading || !autorise) {
    return (
      <AppShell loading counts={counts} onRefresh={() => window.location.reload()}>
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-muted-2">
          <Loader2 className="size-6 animate-spin" />
          <span className="text-[13px] font-medium">Ouverture du module de saisie…</span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell loading={false} counts={counts} onRefresh={() => window.location.reload()}>
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.22em] text-primary uppercase">
            <ClipboardEdit className="size-3.5" />
            Saisie foncière
          </p>
          <h1 className="mt-1.5 font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Mise à jour de la base
          </h1>
          <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">
            Renseignez les attributions puis soumettez pour validation. Rien n&apos;est appliqué avant
            l&apos;approbation d&apos;un administrateur.
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/mode-emploi-saisie" target="_blank">
            <HelpCircle />
            Mode d&apos;emploi
          </Link>
        </Button>
      </div>

      {/* Onglets */}
      <div className="mb-6 flex gap-1 rounded-full border border-border bg-card p-1 text-sm shadow-sm w-fit">
        {[
          { key: "saisie" as const, label: "Nouvelle saisie" },
          { key: "soumissions" as const, label: isAdmin ? "File de validation" : "Mes soumissions" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              if (t.key === "soumissions" && !isAdmin) setSoumissionsLoading(true);
              setTab(t.key);
            }}
            className={`rounded-full px-4 py-1.5 font-medium transition ${
              tab === t.key ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
            message.kind === "ok"
              ? "border-success/30/80 bg-success-subtle text-success"
              : "border-danger/30/70 bg-danger-subtle text-danger"
          }`}
        >
          {message.text}
        </div>
      )}

      {tab === "saisie" ? (
        <div className="space-y-6">
          {/* Bascule Mettre à jour un lotissement existant / Créer un nouveau */}
          <div className="flex gap-1 rounded-full border border-border bg-card p-1 text-sm shadow-sm w-fit">
            {[
              { key: "maj" as const, label: "Mettre à jour un lotissement" },
              { key: "creation" as const, label: "Créer un nouveau lotissement" },
            ].map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setModeType(m.key)}
                className={`rounded-full px-4 py-1.5 font-medium transition ${
                  modeType === m.key ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-primary"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {modeType === "creation" ? (
            <CreationStructure onSubmitted={setMessage} />
          ) : (
            <>
          {/* Sélection lotissement */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
            <label className="text-sm font-medium text-foreground">Lotissement à mettre à jour</label>
            <select
              value={lotissementId}
              onChange={(e) => onSelectLotissement(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40 sm:max-w-md"
            >
              <option value="">— Sélectionner un lotissement —</option>
              {lotissements.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nom}
                  {l.village ? ` — ${l.village}` : ""}
                </option>
              ))}
            </select>
          </div>

          {lotissementId && (
            <>
              {/* Bascule Manuel / Import Excel */}
              <div className="flex gap-1 rounded-full border border-border bg-card p-1 text-sm shadow-sm w-fit">
                {[
                  { key: "manuel" as const, label: "Ligne par ligne" },
                  { key: "import" as const, label: "Import Excel" },
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setModeSaisie(m.key)}
                    className={`rounded-full px-4 py-1.5 font-medium transition ${
                      modeSaisie === m.key ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {modeSaisie === "import" && (
                <ImportExcel
                  etats={etats}
                  onImport={(nouveauxMods, nouveauxAttributaires) => {
                    setMods((m) => ({ ...m, ...nouveauxMods }));
                    setNouveaux((n) => [...n, ...nouveauxAttributaires]);
                    setMessage({
                      kind: "ok",
                      text: `${Object.keys(nouveauxMods).length} ligne(s) ajoutée(s) à l'aperçu des changements.`,
                    });
                  }}
                />
              )}

              {/* Éditeur de lot */}
              {modeSaisie === "manuel" && (
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
                <h2 className="text-sm font-semibold text-primary">Ajouter une modification</h2>
                {etatsLoading ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement des lots…
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {/* Recherche lot */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">Lot concerné</label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
                        <input
                          value={lotSel ? "" : lotFiltre}
                          onChange={(e) => {
                            setLotFiltre(e.target.value);
                            setLotSelId(null);
                          }}
                          placeholder="Rechercher un lot (n° lot, îlot, titulaire actuel)…"
                          className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-4 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40"
                        />
                      </div>
                      {lotSel ? (
                        <div className="mt-2 flex items-center justify-between rounded-xl border border-primary/20 bg-accent-subtle px-3 py-2 text-sm">
                          <span className="text-foreground">
                            <span className="font-semibold text-primary">
                              Îlot {lotSel.ilot} · Lot {lotSel.numero_lot}
                            </span>{" "}
                            — actuel :{" "}
                            {lotSel.attributaire_nom
                              ? `${lotSel.attributaire_nom} (${labelQualite(lotSel.qualite)})`
                              : "libre"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setLotSelId(null)}
                            className="rounded-full p-1 text-muted-2 hover:bg-card hover:text-muted-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        lotFiltre.trim() && (
                          <div className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-card shadow-sm">
                            {lotsFiltres.length === 0 ? (
                              <div className="px-3 py-3 text-sm text-muted-2">Aucun lot trouvé.</div>
                            ) : (
                              lotsFiltres.map((e) => (
                                <button
                                  key={e.lot_id}
                                  type="button"
                                  onClick={() => {
                                    setLotSelId(e.lot_id);
                                    setLotFiltre("");
                                  }}
                                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-inset"
                                >
                                  <span className="font-medium text-foreground">
                                    {e.verrouille && "🔒 "}
                                    Îlot {e.ilot} · Lot {e.numero_lot}
                                  </span>
                                  <span className="truncate text-xs text-muted-2">
                                    {e.verrouille
                                      ? "gel juridique"
                                      : (e.attributaire_nom ?? "libre")}
                                    {mods[e.lot_id] ? " · déjà modifié" : ""}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )
                      )}
                    </div>

                    {/* Gel juridique : la base refuse l'opération à
                        l'approbation. Le dire ICI, avant que l'opérateur ne
                        construise sa soumission — et surtout avant qu'un seul
                        lot gelé ne fasse échouer un lot de 400 opérations. */}
                    {lotSel?.verrouille && (
                      <div className="rounded-xl border border-warning/40 bg-warning-subtle px-3 py-2.5 text-sm text-foreground">
                        🔒 <b>Lot {lotSel.numero_lot} sous gel juridique.</b> Il ne peut être ni
                        réattribué ni remis en disponibilité : la base refusera l&apos;opération à
                        l&apos;approbation. Levez le gel depuis la fiche du lot avant de le saisir
                        ici.
                      </div>
                    )}

                    {lotSel && !lotSel.verrouille && (
                      <>
                        {/* Action */}
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: "attribue" as const, label: "Attribuer à…" },
                            { key: "libre" as const, label: "Remettre en disponibilité" },
                          ].map((a) => (
                            <button
                              key={a.key}
                              type="button"
                              onClick={() => setAction(a.key)}
                              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                                action === a.key
                                  ? "border-primary bg-primary text-white"
                                  : "border-border text-muted-foreground hover:bg-inset"
                              }`}
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>

                        {action === "attribue" && (
                          <div className="grid gap-4 sm:grid-cols-2">
                            {/* Attributaire */}
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-foreground">Attributaire</label>
                              {attSel ? (
                                <div className="flex items-center justify-between rounded-xl border border-success/30 bg-success-subtle px-3 py-2 text-sm">
                                  <span className="font-medium text-success">
                                    {attSel.nom}
                                    {attSel.kind === "nouveau" ? " · nouveau" : ""}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setAttSel(null)}
                                    className="rounded-full p-1 text-success hover:bg-card"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
                                    <input
                                      value={attQuery}
                                      onChange={(e) => setAttQuery(e.target.value)}
                                      placeholder="Rechercher un attributaire…"
                                      className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-4 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40"
                                    />
                                  </div>
                                  {(attResults.length > 0 || nouveaux.length > 0) && attQuery.trim().length >= 2 && (
                                    <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-card shadow-sm">
                                      {nouveaux
                                        .filter((n) => n.nom.toLowerCase().includes(attQuery.trim().toLowerCase()))
                                        .map((n) => (
                                          <button
                                            key={n.ref}
                                            type="button"
                                            onClick={() => {
                                              setAttSel({ kind: "nouveau", ref: n.ref, nom: n.nom });
                                              setAttQuery("");
                                            }}
                                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-inset"
                                          >
                                            <span className="font-medium text-foreground">{n.nom}</span>
                                            <span className="text-xs text-success">nouveau</span>
                                          </button>
                                        ))}
                                      {attResults.map((a) => (
                                        <button
                                          key={a.id}
                                          type="button"
                                          onClick={() => {
                                            setAttSel({ kind: "existant", id: a.id, nom: a.nom ?? "—" });
                                            setAttQuery("");
                                          }}
                                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-inset"
                                        >
                                          <span className="font-medium text-foreground">{a.nom}</span>
                                          <span className="truncate text-xs text-muted-2">
                                            {a.piece_num ?? ""}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setShowNouveauForm(true)}
                                    className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                                  >
                                    <UserPlus className="h-3.5 w-3.5" />
                                    Créer un nouvel attributaire
                                  </button>
                                </>
                              )}
                            </div>

                            {/* Qualité */}
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-foreground">Qualité</label>
                              <select
                                value={qualite}
                                onChange={(e) => setQualite(e.target.value as Qualite)}
                                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40"
                              >
                                {QUALITE_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={appliquerAuLot}
                            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
                          >
                            <Plus className="h-4 w-4" />
                            Ajouter à la liste
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* Liste des modifications + aperçu */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-primary">
                    Aperçu des changements ({changements.length})
                  </h2>
                  {changements.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-success-subtle px-2.5 py-1 font-medium text-success">
                        {resume.nouvelles_attributions} nouvelle(s)
                      </span>
                      <span className="rounded-full bg-warning-subtle px-2.5 py-1 font-medium text-warning">
                        {resume.reassignations} réassignation(s)
                      </span>
                      <span className="rounded-full bg-inset px-2.5 py-1 font-medium text-muted-foreground">
                        {resume.remises_libre} remise(s) libre
                      </span>
                      {resume.inchanges > 0 && (
                        <span className="rounded-full bg-inset px-2.5 py-1 font-medium text-muted-foreground">
                          {resume.inchanges} sans effet
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {changements.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-border bg-inset/70 p-5 text-sm text-muted-foreground">
                    Aucune modification pour l&apos;instant. Utilisez le panneau ci-dessus pour en ajouter.
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-border">
                          {["Lot", "Avant", "Après", "Changement", ""].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {changements.map((c) => (
                          <tr key={c.lotId} className="hover:bg-inset/60">
                            <td className="px-3 py-3 text-sm font-semibold text-primary">
                              Îlot {c.etat.ilot} · Lot {c.etat.numero_lot}
                            </td>
                            <td className="px-3 py-3 text-sm text-muted-foreground">
                              {c.etat.attributaire_nom
                                ? `${c.etat.attributaire_nom} (${labelQualite(c.etat.qualite)})`
                                : "libre"}
                            </td>
                            <td className="px-3 py-3 text-sm text-foreground">
                              {c.cible.type === "libre"
                                ? "libre"
                                : `${c.cible.attributaire_nom} (${labelQualite(c.cible.qualite)})`}
                            </td>
                            <td className="px-3 py-3">
                              <Badge status={CLASSE_BADGE[c.classe]}>{CLASSE_LABELS[c.classe]}</Badge>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => retirerMod(c.lotId)}
                                className="rounded-full p-1.5 text-muted-2 hover:bg-danger-subtle hover:text-danger"
                                aria-label="Retirer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {changements.length > 0 && (
                  <div className="mt-5 space-y-3 border-t border-border pt-5">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">Titre de la soumission (optionnel)</label>
                      <input
                        value={titre}
                        onChange={(e) => setTitre(e.target.value)}
                        placeholder="Ex. Actualisation ACTU1A — Brignan Kakodji"
                        className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40 sm:max-w-md"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        {nbEffectifs} changement(s) effectif(s) seront soumis pour validation.
                      </p>
                      <button
                        type="button"
                        onClick={soumettre}
                        disabled={submitting || nbEffectifs === 0}
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Soumettre pour validation
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
            </>
          )}
        </div>
      ) : isAdmin ? (
        /* ── Onglet File de validation (admin) ── */
        <FileValidation />
      ) : (
        /* ── Onglet Mes soumissions (opérateur) ──
           Une soumission rejetée est ce que l'agent doit corriger : c'est son
           « à nous de jouer » (cf. `fetchBadgeCounts`, clé `saisieRejetees`).
           La pastille rouge du menu l'annonçait déjà, l'écran d'arrivée non. */
        <div
          className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${
            aCorriger > 0 ? "border-brick/45 bg-brick-subtle ring-1 ring-brick/20" : "border-border/60 bg-card"
          }`}
        >
          {aCorriger > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <CountBadge value={aCorriger} />
              <span className="text-sm font-semibold text-foreground">
                soumission{aCorriger > 1 ? "s" : ""} rejetée{aCorriger > 1 ? "s" : ""} à corriger
              </span>
              <span className="text-sm text-muted-foreground">— le motif figure sous chacune.</span>
            </div>
          )}
          {soumissionsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : soumissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-inset/70 p-5 text-sm text-muted-foreground">
              Aucune soumission pour l&apos;instant.
            </div>
          ) : (
            <div className="space-y-3">
              {soumissions.map((s) => {
                const b = STATUT_BADGE[s.statut];
                return (
                  <div key={s.id} className="rounded-2xl border border-border/60 bg-inset/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {s.titre ?? (s.type === "maj_attributions" ? "Mise à jour d'attributions" : "Création de structure")}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-2">
                          {s.cree_le ? new Date(s.cree_le).toLocaleString("fr-FR") : ""}
                          {s.resume && s.type === "maj_attributions" &&
                            ` · ${(s.resume as ResumeMaj).nouvelles_attributions} nouvelle(s), ${(s.resume as ResumeMaj).reassignations} réassign., ${(s.resume as ResumeMaj).remises_libre} libre`}
                          {s.resume && s.type === "creation_structure" &&
                            ` · ${(s.resume as ResumeCreation).nb_ilots} îlot(s), ${(s.resume as ResumeCreation).nb_lots} lot(s)`}
                        </p>
                        {s.statut === "rejetee" && s.commentaire_admin && (
                          <p className="mt-1.5 rounded-lg bg-danger-subtle px-2.5 py-1.5 text-xs text-danger">
                            Motif : {s.commentaire_admin}
                          </p>
                        )}
                      </div>
                      <Badge status={b.status}>{b.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modale nouvel attributaire ── */}
      {showNouveauForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.75rem] border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-primary">Nouvel attributaire</h2>
              <button
                type="button"
                onClick={() => setShowNouveauForm(false)}
                className="rounded-full p-2 text-muted-2 hover:bg-inset"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Nom complet <span className="text-danger">*</span>
                </label>
                <input
                  value={nouveauForm.nom}
                  onChange={(e) => setNouveauForm((f) => ({ ...f, nom: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Type</label>
                <select
                  value={nouveauForm.type}
                  onChange={(e) =>
                    setNouveauForm((f) => ({ ...f, type: e.target.value as NouvelAttributaire["type"] }))
                  }
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none"
                >
                  <option value="personne_physique">Personne physique</option>
                  <option value="collectif_ayants_droit">Collectif d&apos;ayants droit</option>
                  <option value="personne_morale">Personne morale</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Nature pièce</label>
                  <input
                    value={nouveauForm.piece_nature}
                    onChange={(e) => setNouveauForm((f) => ({ ...f, piece_nature: e.target.value }))}
                    placeholder="CNI…"
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">N° pièce</label>
                  <input
                    value={nouveauForm.piece_num}
                    onChange={(e) => setNouveauForm((f) => ({ ...f, piece_num: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Téléphone</label>
                <input
                  value={nouveauForm.telephone}
                  onChange={(e) => setNouveauForm((f) => ({ ...f, telephone: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowNouveauForm(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-inset"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={creerNouveau}
                disabled={!nouveauForm.nom.trim()}
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
              >
                Ajouter cet attributaire
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
