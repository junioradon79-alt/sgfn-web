"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";
import {
  CLASSE_LABELS,
  classifier,
  labelQualite,
  type CibleChoisie,
  type ClasseChangement,
  type LotEtat,
  type OperationCible,
  type PayloadCreationStructure,
  type PayloadMajAttributions,
  type Qualite,
  type ResumeCreation,
  type ResumeMaj,
  type StatutSoumission,
  type TypeSoumission,
} from "@/lib/saisie";

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
  payload: unknown;
};

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

type LigneDiff = {
  lotId: string;
  label: string;
  avant: string;
  apres: string;
  classe: ClasseChangement;
};

const CLASSE_BADGE: Record<ClasseChangement, "attribue" | "en_validation" | "litige" | "disponible"> = {
  nouvelle_attribution: "attribue",
  reassignation: "en_validation",
  remise_libre: "disponible",
  inchange: "disponible",
};

const STATUT_BADGE: Record<StatutSoumission, { label: string; status: "attribue" | "en_validation" | "litige" }> = {
  en_attente: { label: "En attente", status: "en_validation" },
  approuvee: { label: "Approuvée", status: "attribue" },
  rejetee: { label: "Rejetée", status: "litige" },
};

export function FileValidation() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Soumission[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Ne pose pas loading(true) ici (état initial déjà true, refresh silencieux) :
  // évite un setState synchrone dans le corps de l'effet.
  const charger = useCallback(() => {
    supabase
      .from("soumissions_saisie")
      .select("id, type, titre, statut, resume, resultat, commentaire_admin, cree_le, traite_le, payload")
      .order("statut", { ascending: true }) // en_attente < approuvee < rejetee (alpha) : en_attente d'abord
      .order("cree_le", { ascending: false })
      .then(({ data }) => {
        setItems((data ?? []) as unknown as Soumission[]);
        setLoading(false);
      });
  }, [supabase]);

  useEffect(() => {
    charger();
  }, [charger]);

  const enAttente = items.filter((i) => i.statut === "en_attente");
  const traitees = items.filter((i) => i.statut !== "en_attente");

  return (
    <div className="space-y-6">
      {flash && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            flash.kind === "ok"
              ? "border-emerald-200/80 bg-emerald-50 text-emerald-700"
              : "border-red-200/70 bg-red-50 text-red-700"
          }`}
        >
          {flash.text}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-[#0D3B66]">
          À valider ({enAttente.length})
        </h2>
        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : enAttente.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-500">
            Aucune soumission en attente.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {enAttente.map((s) => (
              <CarteSoumission
                key={s.id}
                soumission={s}
                supabase={supabase}
                onDone={(msg) => {
                  setFlash(msg);
                  charger();
                  // Met à jour la pastille de rappel dans la sidebar.
                  window.dispatchEvent(new Event("sgnf:refresh-badges"));
                }}
              />
            ))}
          </div>
        )}
      </div>

      {traitees.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500">Historique ({traitees.length})</h2>
          <div className="mt-3 space-y-2">
            {traitees.map((s) => {
              const b = STATUT_BADGE[s.statut];
              return (
                <div key={s.id} className="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">
                        {s.titre ?? (s.type === "maj_attributions" ? "Mise à jour d'attributions" : "Création de structure")}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {s.traite_le ? new Date(s.traite_le).toLocaleString("fr-FR") : ""}
                        {s.resultat && typeof s.resultat === "object"
                          ? ` · ${JSON.stringify(s.resultat)}`
                          : ""}
                      </p>
                      {s.commentaire_admin && (
                        <p className="mt-1 text-xs text-slate-500">Note : {s.commentaire_admin}</p>
                      )}
                    </div>
                    <Badge status={b.status}>{b.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CarteSoumission({
  soumission,
  supabase,
  onDone,
}: {
  soumission: Soumission;
  supabase: ReturnType<typeof createClient>;
  onDone: (msg: { kind: "ok" | "err"; text: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [lignes, setLignes] = useState<LigneDiff[] | null>(null);
  const [structureNoms, setStructureNoms] = useState<{ autorite?: string; operateur?: string; famille?: string } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [comment, setComment] = useState("");

  const chargerDetailCreation = async () => {
    if (structureNoms) return;
    setDetailLoading(true);
    const payload = soumission.payload as PayloadCreationStructure;
    const meta = payload.lotissement;
    const noms: { autorite?: string; operateur?: string; famille?: string } = {};
    if (payload.nouvelle_autorite) noms.autorite = `${payload.nouvelle_autorite.nom} (nouvelle)`;
    if (payload.nouvel_operateur) noms.operateur = `${payload.nouvel_operateur.nom} (nouveau)`;
    if (payload.nouvelle_famille) noms.famille = `${payload.nouvelle_famille.nom} (nouvelle)`;
    await Promise.all([
      !payload.nouvelle_autorite && meta.autorite_coutumiere_id
        ? supabase
            .from("autorites_coutumieres")
            .select("nom")
            .eq("id", meta.autorite_coutumiere_id)
            .maybeSingle()
            .then(({ data }) => { noms.autorite = data?.nom ?? undefined; })
        : Promise.resolve(),
      !payload.nouvel_operateur && meta.operateur_id
        ? supabase
            .from("operateurs")
            .select("nom")
            .eq("id", meta.operateur_id)
            .maybeSingle()
            .then(({ data }) => { noms.operateur = data?.nom ?? undefined; })
        : Promise.resolve(),
      !payload.nouvelle_famille && meta.famille_id
        ? supabase
            .from("familles")
            .select("nom")
            .eq("id", meta.famille_id)
            .maybeSingle()
            .then(({ data }) => { noms.famille = data?.nom ?? undefined; })
        : Promise.resolve(),
    ]);
    setStructureNoms(noms);
    setDetailLoading(false);
  };

  const chargerDetail = async () => {
    if (lignes || soumission.type !== "maj_attributions") return;
    setDetailLoading(true);
    const payload = soumission.payload as PayloadMajAttributions;
    const ops = payload.operations ?? [];
    const lotIds = ops.map((o) => o.lot_id);
    const newByRef = new Map((payload.nouveaux_attributaires ?? []).map((n) => [n.ref, n.nom]));

    const { data: lotsData } = await supabase
      .from("lots")
      .select("id, numero_lot, statut, ilots(numero), attributions(attributaire_id, qualite, actuel, attributaires(nom))")
      .in("id", lotIds.length ? lotIds : ["00000000-0000-0000-0000-000000000000"]);
    const rows = (lotsData ?? []) as unknown as LotRow[];
    const etatByLot = new Map<string, LotEtat>();
    rows.forEach((r) => {
      const act = r.attributions?.find((a) => a.actuel);
      etatByLot.set(r.id, {
        lot_id: r.id,
        ilot: r.ilots?.numero ?? "—",
        numero_lot: r.numero_lot ?? "—",
        statut: r.statut ?? "—",
        attributaire_id: act?.attributaire_id ?? null,
        attributaire_nom: act?.attributaires?.nom ?? null,
        qualite: (act?.qualite as Qualite) ?? null,
      });
    });

    const idsExistants = ops
      .map((o) => (o.cible === "attribue" ? o.attributaire_id : undefined))
      .filter((x): x is string => !!x);
    const nomById = new Map<string, string>();
    if (idsExistants.length) {
      const { data: attrs } = await supabase
        .from("attributaires")
        .select("id, nom")
        .in("id", idsExistants);
      (attrs ?? []).forEach((a: { id: string; nom: string | null }) => nomById.set(a.id, a.nom ?? "—"));
    }

    const lignesCalc: LigneDiff[] = ops.map((op: OperationCible) => {
      const etat =
        etatByLot.get(op.lot_id) ??
        ({ lot_id: op.lot_id, ilot: "?", numero_lot: "?", statut: "?", attributaire_id: null, attributaire_nom: null, qualite: null } as LotEtat);
      let cible: CibleChoisie;
      let apres: string;
      if (op.cible === "libre") {
        cible = { type: "libre" };
        apres = "libre";
      } else {
        const nom = op.attributaire_id
          ? nomById.get(op.attributaire_id) ?? "—"
          : op.attributaire_ref
            ? `${newByRef.get(op.attributaire_ref) ?? "?"} (nouveau)`
            : "—";
        cible = {
          type: "attribue",
          attributaire_id: op.attributaire_id,
          attributaire_ref: op.attributaire_ref,
          attributaire_nom: nom,
          qualite: op.qualite,
        };
        apres = `${nom} (${labelQualite(op.qualite)})`;
      }
      return {
        lotId: op.lot_id,
        label: `Îlot ${etat.ilot} · Lot ${etat.numero_lot}`,
        avant: etat.attributaire_nom ? `${etat.attributaire_nom} (${labelQualite(etat.qualite)})` : "libre",
        apres,
        classe: classifier(etat, cible),
      };
    });
    setLignes(lignesCalc);
    setDetailLoading(false);
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    if (soumission.type === "creation_structure") void chargerDetailCreation();
    else void chargerDetail();
  };

  const approuver = async () => {
    setBusy("approve");
    const { data, error } = await supabase.rpc("approuver_soumission", {
      p_id: soumission.id,
    });
    setBusy(null);
    if (error) {
      onDone({ kind: "err", text: `Échec de l'approbation : ${error.message}` });
      return;
    }
    onDone({ kind: "ok", text: `Soumission approuvée et appliquée. ${data ? JSON.stringify(data) : ""}` });
  };

  const rejeter = async () => {
    setBusy("reject");
    const { error } = await supabase.rpc("rejeter_soumission", {
      p_id: soumission.id,
      p_commentaire: comment.trim() || undefined,
    });
    setBusy(null);
    if (error) {
      onDone({ kind: "err", text: `Échec du rejet : ${error.message}` });
      return;
    }
    onDone({ kind: "ok", text: "Soumission rejetée." });
  };

  const r = soumission.resume;

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {soumission.titre ??
              (soumission.type === "maj_attributions" ? "Mise à jour d'attributions" : "Création de structure")}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {soumission.cree_le ? new Date(soumission.cree_le).toLocaleString("fr-FR") : ""}
            {r && soumission.type === "maj_attributions" && (() => {
              const m = r as ResumeMaj;
              return ` · ${m.nouvelles_attributions} nouvelle(s), ${m.reassignations} réassign., ${m.remises_libre} libre${
                m.nouveaux_attributaires ? `, ${m.nouveaux_attributaires} nouvel(s) attributaire(s)` : ""
              }`;
            })()}
            {r && soumission.type === "creation_structure" &&
              ` · ${(r as ResumeCreation).nb_ilots} îlot(s), ${(r as ResumeCreation).nb_lots} lot(s)`}
          </p>
        </div>
        <Badge status="en_validation">En attente</Badge>
      </div>

      {(soumission.type === "maj_attributions" || soumission.type === "creation_structure") && (
        <button
          type="button"
          onClick={toggle}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#1E6091] hover:underline"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {open ? "Masquer le détail" : "Voir le détail"}
        </button>
      )}

      {open && soumission.type === "maj_attributions" && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200/70">
          {detailLoading ? (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Résolution du diff…
            </div>
          ) : (
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/70 bg-slate-50/60">
                  {["Lot", "Avant", "Après", "Changement"].map((h) => (
                    <th key={h} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(lignes ?? []).map((l) => (
                  <tr key={l.lotId}>
                    <td className="px-3 py-2 font-semibold text-[#0D3B66]">{l.label}</td>
                    <td className="px-3 py-2 text-slate-600">{l.avant}</td>
                    <td className="px-3 py-2 text-slate-800">{l.apres}</td>
                    <td className="px-3 py-2">
                      <Badge status={CLASSE_BADGE[l.classe]}>{CLASSE_LABELS[l.classe]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {open && soumission.type === "creation_structure" && (
        <div className="mt-3">
          {detailLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200/70 px-4 py-4 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : (
            <ApercuCreationStructure
              payload={soumission.payload as PayloadCreationStructure}
              noms={structureNoms}
            />
          )}
        </div>
      )}

      {/* Actions */}
      {rejectMode ? (
        <div className="mt-4 space-y-2 rounded-xl border border-red-200/70 bg-red-50/50 p-3">
          <label className="text-sm font-medium text-slate-700">Motif du rejet (optionnel)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Expliquez à l'opérateur pourquoi la soumission est rejetée…"
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#0D3B66] focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejectMode(false)}
              className="rounded-full border border-slate-200/70 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={rejeter}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Confirmer le rejet
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setRejectMode(true)}
            disabled={busy !== null}
            className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Rejeter
          </button>
          <button
            type="button"
            onClick={approuver}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0D3B66] px-5 py-2 text-sm font-medium text-white hover:bg-[#1E6091] disabled:opacity-60"
          >
            {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Approuver et appliquer
          </button>
        </div>
      )}
    </div>
  );
}

/** Aperçu en lecture seule d'un payload creation_structure, pour la revue admin avant approbation. */
function ApercuCreationStructure({
  payload,
  noms,
}: {
  payload: PayloadCreationStructure;
  noms: { autorite?: string; operateur?: string; famille?: string } | null;
}) {
  const meta = payload.lotissement;
  const totalLots = payload.ilots.reduce((n, i) => n + i.lots.length, 0);
  const totalEquipements = payload.ilots.reduce((n, i) => n + i.lots.filter((l) => l.est_equipement).length, 0);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200/70 bg-slate-50/40 p-4">
      <div className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <div>
          <span className="text-slate-400">Nom : </span>
          <span className="font-medium text-slate-700">{meta.nom}</span>
        </div>
        {meta.village && (
          <div><span className="text-slate-400">Village : </span><span className="text-slate-700">{meta.village}</span></div>
        )}
        {meta.commune && (
          <div><span className="text-slate-400">Commune : </span><span className="text-slate-700">{meta.commune}</span></div>
        )}
        {meta.district && (
          <div><span className="text-slate-400">District : </span><span className="text-slate-700">{meta.district}</span></div>
        )}
        {meta.superficie_texte && (
          <div><span className="text-slate-400">Superficie : </span><span className="text-slate-700">{meta.superficie_texte}</span></div>
        )}
        {meta.guide_reference && (
          <div><span className="text-slate-400">Réf. guide : </span><span className="text-slate-700">{meta.guide_reference}</span></div>
        )}
        {noms?.autorite && (
          <div><span className="text-slate-400">Autorité coutumière : </span><span className="text-slate-700">{noms.autorite}</span></div>
        )}
        {noms?.operateur && (
          <div><span className="text-slate-400">Opérateur : </span><span className="text-slate-700">{noms.operateur}</span></div>
        )}
        {noms?.famille && (
          <div><span className="text-slate-400">Famille : </span><span className="text-slate-700">{noms.famille}</span></div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-200/70 pt-3 text-xs">
        <span className="rounded-full bg-[#0D3B66]/10 px-2.5 py-1 font-medium text-[#0D3B66]">
          {payload.ilots.length} îlot(s)
        </span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
          {totalLots} lot(s)
        </span>
        {totalEquipements > 0 && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
            {totalEquipements} équipement(s)
          </span>
        )}
      </div>

      <div className="space-y-2">
        {payload.ilots.map((ilot) => (
          <div key={ilot.numero} className="rounded-lg border border-slate-200/70 bg-white p-3">
            <p className="text-sm font-semibold text-[#0D3B66]">
              Îlot {ilot.numero}
              <span className="ml-1 text-xs font-normal text-slate-400">({ilot.lots.length} lot(s))</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {ilot.lots.map((l) => l.numero_lot + (l.est_equipement ? "*" : "")).join(", ")}
            </p>
          </div>
        ))}
      </div>
      {totalEquipements > 0 && <p className="text-xs text-slate-400">* réserve / équipement</p>}
    </div>
  );
}
