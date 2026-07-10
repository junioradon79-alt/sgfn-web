"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardEdit,
  Loader2,
  Plus,
  Search,
  Send,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { FileValidation } from "@/components/dashboard/saisie/FileValidation";
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
  resume: ResumeMaj | null;
  resultat: Record<string, unknown> | null;
  commentaire_admin: string | null;
  cree_le: string | null;
  traite_le: string | null;
};

// Ligne brute renvoyée par la requête lots + attributions imbriquées.
type LotRow = {
  id: string;
  numero_lot: string | null;
  statut: string | null;
  ilots: { numero: string | null } | null;
  attributions: {
    attributaire_id: string | null;
    qualite: string | null;
    actuel: boolean | null;
    attributaires: { nom: string | null } | null;
  }[];
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

  // ── Données de référence ──
  const [lotissements, setLotissements] = useState<Lotissement[]>([]);
  const [lotissementId, setLotissementId] = useState("");
  const [etats, setEtats] = useState<LotEtat[]>([]);
  const [etatsLoading, setEtatsLoading] = useState(false);

  // ── Modifications en cours (une cible par lot) ──
  const [mods, setMods] = useState<Record<string, CibleChoisie>>({});
  const [nouveaux, setNouveaux] = useState<NouvelAttributaire[]>([]);

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
  };

  // Chargement de l'état du lotissement sélectionné
  useEffect(() => {
    if (!lotissementId) return;
    let active = true;
    supabase
      .from("lots")
      .select(
        "id, numero_lot, statut, ilots!inner(numero, lotissement_id), attributions(attributaire_id, qualite, actuel, attributaires(nom))",
      )
      .eq("ilots.lotissement_id", lotissementId)
      .order("numero_lot")
      .then(({ data }) => {
        if (!active) return;
        const rows = (data ?? []) as unknown as LotRow[];
        const list: LotEtat[] = rows.map((r) => {
          const act = r.attributions?.find((a) => a.actuel);
          return {
            lot_id: r.id,
            ilot: r.ilots?.numero ?? "—",
            numero_lot: r.numero_lot ?? "—",
            statut: r.statut ?? "—",
            attributaire_id: act?.attributaire_id ?? null,
            attributaire_nom: act?.attributaires?.nom ?? null,
            qualite: (act?.qualite as Qualite) ?? null,
          };
        });
        setEtats(list);
        setEtatsLoading(false);
      });
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
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm font-medium">Ouverture du module de saisie…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* En-tête */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
          <ClipboardEdit className="h-4 w-4" />
          Saisie foncière
        </div>
        <h1 className="mt-2 text-2xl font-bold text-[#0D3B66]">Mise à jour de la base</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Renseignez les attributions puis soumettez pour validation. Rien n&apos;est appliqué avant
          l&apos;approbation d&apos;un administrateur.
        </p>
      </div>

      {/* Onglets */}
      <div className="mb-6 flex gap-1 rounded-full border border-slate-200/70 bg-white p-1 text-sm shadow-sm w-fit">
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
              tab === t.key ? "bg-[#0D3B66] text-white shadow-sm" : "text-slate-500 hover:text-[#0D3B66]"
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
              ? "border-emerald-200/80 bg-emerald-50 text-emerald-700"
              : "border-red-200/70 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {tab === "saisie" ? (
        <div className="space-y-6">
          {/* Sélection lotissement */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6">
            <label className="text-sm font-medium text-slate-700">Lotissement à mettre à jour</label>
            <select
              value={lotissementId}
              onChange={(e) => onSelectLotissement(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10 sm:max-w-md"
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
              {/* Éditeur de lot */}
              <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-sm font-semibold text-[#0D3B66]">Ajouter une modification</h2>
                {etatsLoading ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement des lots…
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {/* Recherche lot */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Lot concerné</label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={lotSel ? "" : lotFiltre}
                          onChange={(e) => {
                            setLotFiltre(e.target.value);
                            setLotSelId(null);
                          }}
                          placeholder="Rechercher un lot (n° lot, îlot, titulaire actuel)…"
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                        />
                      </div>
                      {lotSel ? (
                        <div className="mt-2 flex items-center justify-between rounded-xl border border-[#0D3B66]/20 bg-[#0D3B66]/5 px-3 py-2 text-sm">
                          <span className="text-slate-700">
                            <span className="font-semibold text-[#0D3B66]">
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
                            className="rounded-full p-1 text-slate-400 hover:bg-white hover:text-slate-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        lotFiltre.trim() && (
                          <div className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                            {lotsFiltres.length === 0 ? (
                              <div className="px-3 py-3 text-sm text-slate-400">Aucun lot trouvé.</div>
                            ) : (
                              lotsFiltres.map((e) => (
                                <button
                                  key={e.lot_id}
                                  type="button"
                                  onClick={() => {
                                    setLotSelId(e.lot_id);
                                    setLotFiltre("");
                                  }}
                                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                                >
                                  <span className="font-medium text-slate-700">
                                    Îlot {e.ilot} · Lot {e.numero_lot}
                                  </span>
                                  <span className="truncate text-xs text-slate-400">
                                    {e.attributaire_nom ?? "libre"}
                                    {mods[e.lot_id] ? " · déjà modifié" : ""}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )
                      )}
                    </div>

                    {lotSel && (
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
                                  ? "border-[#0D3B66] bg-[#0D3B66] text-white"
                                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
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
                              <label className="text-sm font-medium text-slate-700">Attributaire</label>
                              {attSel ? (
                                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                                  <span className="font-medium text-emerald-800">
                                    {attSel.nom}
                                    {attSel.kind === "nouveau" ? " · nouveau" : ""}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setAttSel(null)}
                                    className="rounded-full p-1 text-emerald-600 hover:bg-white"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                      value={attQuery}
                                      onChange={(e) => setAttQuery(e.target.value)}
                                      placeholder="Rechercher un attributaire…"
                                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                                    />
                                  </div>
                                  {(attResults.length > 0 || nouveaux.length > 0) && attQuery.trim().length >= 2 && (
                                    <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
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
                                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                                          >
                                            <span className="font-medium text-slate-700">{n.nom}</span>
                                            <span className="text-xs text-emerald-600">nouveau</span>
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
                                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                                        >
                                          <span className="font-medium text-slate-700">{a.nom}</span>
                                          <span className="truncate text-xs text-slate-400">
                                            {a.piece_num ?? ""}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setShowNouveauForm(true)}
                                    className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-[#1E6091] hover:underline"
                                  >
                                    <UserPlus className="h-3.5 w-3.5" />
                                    Créer un nouvel attributaire
                                  </button>
                                </>
                              )}
                            </div>

                            {/* Qualité */}
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium text-slate-700">Qualité</label>
                              <select
                                value={qualite}
                                onChange={(e) => setQualite(e.target.value as Qualite)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
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
                            className="inline-flex items-center gap-2 rounded-full bg-[#0D3B66] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#1E6091]"
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

              {/* Liste des modifications + aperçu */}
              <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[#0D3B66]">
                    Aperçu des changements ({changements.length})
                  </h2>
                  {changements.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                        {resume.nouvelles_attributions} nouvelle(s)
                      </span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                        {resume.reassignations} réassignation(s)
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                        {resume.remises_libre} remise(s) libre
                      </span>
                      {resume.inchanges > 0 && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500">
                          {resume.inchanges} sans effet
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {changements.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-500">
                    Aucune modification pour l&apos;instant. Utilisez le panneau ci-dessus pour en ajouter.
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-slate-200/70">
                          {["Lot", "Avant", "Après", "Changement", ""].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {changements.map((c) => (
                          <tr key={c.lotId} className="hover:bg-slate-50/60">
                            <td className="px-3 py-3 text-sm font-semibold text-[#0D3B66]">
                              Îlot {c.etat.ilot} · Lot {c.etat.numero_lot}
                            </td>
                            <td className="px-3 py-3 text-sm text-slate-600">
                              {c.etat.attributaire_nom
                                ? `${c.etat.attributaire_nom} (${labelQualite(c.etat.qualite)})`
                                : "libre"}
                            </td>
                            <td className="px-3 py-3 text-sm text-slate-800">
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
                                className="rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
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
                  <div className="mt-5 space-y-3 border-t border-slate-100 pt-5">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Titre de la soumission (optionnel)</label>
                      <input
                        value={titre}
                        onChange={(e) => setTitre(e.target.value)}
                        placeholder="Ex. Actualisation ACTU1A — Brignan Kakodji"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10 sm:max-w-md"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">
                        {nbEffectifs} changement(s) effectif(s) seront soumis pour validation.
                      </p>
                      <button
                        type="button"
                        onClick={soumettre}
                        disabled={submitting || nbEffectifs === 0}
                        className="inline-flex items-center gap-2 rounded-full bg-[#0D3B66] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#1E6091] disabled:cursor-not-allowed disabled:opacity-60"
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
        </div>
      ) : isAdmin ? (
        /* ── Onglet File de validation (admin) ── */
        <FileValidation />
      ) : (
        /* ── Onglet Mes soumissions (opérateur) ── */
        <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6">
          {soumissionsLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : soumissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-500">
              Aucune soumission pour l&apos;instant.
            </div>
          ) : (
            <div className="space-y-3">
              {soumissions.map((s) => {
                const b = STATUT_BADGE[s.statut];
                return (
                  <div key={s.id} className="rounded-2xl border border-slate-200/60 bg-slate-50/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {s.titre ?? (s.type === "maj_attributions" ? "Mise à jour d'attributions" : "Création de structure")}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {s.cree_le ? new Date(s.cree_le).toLocaleString("fr-FR") : ""}
                          {s.resume &&
                            ` · ${s.resume.nouvelles_attributions} nouvelle(s), ${s.resume.reassignations} réassign., ${s.resume.remises_libre} libre`}
                        </p>
                        {s.statut === "rejetee" && s.commentaire_admin && (
                          <p className="mt-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-[#0D3B66]">Nouvel attributaire</h2>
              <button
                type="button"
                onClick={() => setShowNouveauForm(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Nom complet <span className="text-red-500">*</span>
                </label>
                <input
                  value={nouveauForm.nom}
                  onChange={(e) => setNouveauForm((f) => ({ ...f, nom: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Type</label>
                <select
                  value={nouveauForm.type}
                  onChange={(e) =>
                    setNouveauForm((f) => ({ ...f, type: e.target.value as NouvelAttributaire["type"] }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
                >
                  <option value="personne_physique">Personne physique</option>
                  <option value="collectif_ayants_droit">Collectif d&apos;ayants droit</option>
                  <option value="personne_morale">Personne morale</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Nature pièce</label>
                  <input
                    value={nouveauForm.piece_nature}
                    onChange={(e) => setNouveauForm((f) => ({ ...f, piece_nature: e.target.value }))}
                    placeholder="CNI…"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">N° pièce</label>
                  <input
                    value={nouveauForm.piece_num}
                    onChange={(e) => setNouveauForm((f) => ({ ...f, piece_num: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Téléphone</label>
                <input
                  value={nouveauForm.telephone}
                  onChange={(e) => setNouveauForm((f) => ({ ...f, telephone: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowNouveauForm(false)}
                className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={creerNouveau}
                disabled={!nouveauForm.nom.trim()}
                className="rounded-full bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E6091] disabled:opacity-60"
              >
                Ajouter cet attributaire
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
