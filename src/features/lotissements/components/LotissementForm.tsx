"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X, Loader2, FileText } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/utils/supabase/client";
import type { Lotissement, NewLotissement, UpdateLotissement } from "../types";

type CommissaireOption = { id: string; nom: string };

// `type_lotissement` est NOT NULL sans defaut (migration 20260818120000) :
// obligatoire a la creation. Options limitees a l'enum, source unique via
// l'index NewLotissement["type_lotissement"] (jamais de copie a la main).
const TYPES_LOTISSEMENT: { value: NewLotissement["type_lotissement"]; label: string }[] = [
  { value: "villageois", label: "Villageois" },
  { value: "approuve", label: "Approuvé" },
  { value: "acd", label: "ACD" },
];

type Props = {
  initialData?: Lotissement | null;
  onClose: () => void;
  // Union avec UpdateLotissement : le mode edition ne fournit jamais
  // `type_lotissement` (voir handleSubmit) — seule la RPC admin
  // definir_type_lotissement() le change, tracee dans journal_audit.
  onSubmit: (values: NewLotissement | UpdateLotissement) => void;
  // true quand la creation part vers proposerLotissement() (chefferie/
  // operateur, en attente d'approbation) : _appliquer_creation_lotissement
  // force 'villageois' cote base quoi que le formulaire envoie (decision
  // produit du 18/08 — une soumission chefferie/operateur est toujours un
  // lotissement villageois a l'origine). Proposer un select dont la valeur
  // est silencieusement ignoree serait trompeur ; ce mode remplace le select
  // par une ligne d'info et fige la valeur envoyee a 'villageois'.
  soumissionChefferie?: boolean;
};

export default function LotissementForm({ initialData, onClose, onSubmit, soumissionChefferie = false }: Props) {
  const isEdit = Boolean(initialData);
  const supabase = createClient();

  const [form, setForm] = useState({
    nom: initialData?.nom ?? "",
    // Pertinent seulement a la creation (champ masque en edition) : valeur
    // par defaut villageois, le cas le plus courant (ex. Koelea-Accor).
    // Type `string` en etat local comme les autres champs (le `set()`
    // generique ci-dessous assigne `e.target.value`, toujours une string) ;
    // cast vers l'enum seulement au moment de construire le payload.
    type_lotissement: "villageois",
    village: initialData?.village ?? "",
    commune: initialData?.commune ?? "",
    district: initialData?.district ?? "",
    superficie_texte: initialData?.superficie_texte ?? "",
    nb_lots: initialData?.nb_lots?.toString() ?? "",
    nb_ilots: initialData?.nb_ilots?.toString() ?? "",
    guide_reference: initialData?.guide_reference ?? "",
    pv_numero_enregistrement: initialData?.pv_numero_enregistrement ?? "",
    pv_commissaire_justice_id: initialData?.pv_commissaire_justice_id ?? "",
    tf_numero: initialData?.tf_numero ?? "",
    livre_foncier: initialData?.livre_foncier ?? "",
    geometre_expert: initialData?.geometre_expert ?? "",
    cabinet_geometre: initialData?.cabinet_geometre ?? "",
    pv_identification_physique_numero: initialData?.pv_identification_physique_numero ?? "",
    pv_identification_physique_date: initialData?.pv_identification_physique_date ?? "",
  });

  // Référentiel des commissaires de justice (créable depuis Administration →
  // Référentiels). Lisible par tout authentifié.
  const [commissaires, setCommissaires] = useState<CommissaireOption[]>([]);
  useEffect(() => {
    supabase
      .from("commissaires_justice")
      .select("id, nom")
      .order("nom")
      .then(({ data }) => setCommissaires((data ?? []) as CommissaireOption[]));
    // `supabase` est recréé à chaque rendu par createClient() : le laisser en
    // dépendance relancerait la requête en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fermeture au clavier (Échap) — sortie de secours si le formulaire est long.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [scanFile, setScanFile] = useState<File | null>(null);
  const scanUrl = initialData?.pv_identification_physique_scan_url ?? "";
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurScan, setErreurScan] = useState<string | null>(null);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleScanFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScanFile(e.target.files?.[0] ?? null);
    setErreurScan(null);
  };

  const voirScanActuel = async () => {
    if (!scanUrl) return;
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(scanUrl, 3600);
    if (error || !data) return;
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let finalScanUrl = scanUrl || null;

    if (scanFile) {
      setEnvoiEnCours(true);
      setErreurScan(null);
      try {
        const id = initialData?.id ?? crypto.randomUUID();
        const extension = scanFile.name.split(".").pop() ?? "pdf";
        const chemin = `pv-identification-physique/${id}/scan.${extension}`;
        const { error: uploadErr } = await supabase.storage
          .from("documents")
          .upload(chemin, scanFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        finalScanUrl = chemin;
      } catch (err) {
        setErreurScan(err instanceof Error ? err.message : "Le téléversement du scan a échoué.");
        setEnvoiEnCours(false);
        return;
      }
      setEnvoiEnCours(false);
    }

    const base = {
      nom: form.nom.trim(),
      village: form.village.trim() || null,
      commune: form.commune.trim() || null,
      district: form.district.trim() || null,
      superficie_texte: form.superficie_texte.trim() || null,
      nb_lots: form.nb_lots === "" ? null : Number(form.nb_lots),
      nb_ilots: form.nb_ilots === "" ? null : Number(form.nb_ilots),
      guide_reference: form.guide_reference.trim() || null,
      pv_numero_enregistrement: form.pv_numero_enregistrement.trim() || null,
      pv_commissaire_justice_id: form.pv_commissaire_justice_id || null,
      tf_numero: form.tf_numero.trim() || null,
      livre_foncier: form.livre_foncier.trim() || null,
      geometre_expert: form.geometre_expert.trim() || null,
      cabinet_geometre: form.cabinet_geometre.trim() || null,
      pv_identification_physique_numero: form.pv_identification_physique_numero.trim() || null,
      pv_identification_physique_date: form.pv_identification_physique_date || null,
      pv_identification_physique_scan_url: finalScanUrl,
    };

    // `type_lotissement` uniquement a la creation : en edition, l'envoyer
    // reviendrait a le modifier par un simple UPDATE de formulaire, ce que la
    // decision produit reserve a definir_type_lotissement() (motif trace dans
    // journal_audit). `base` seul satisfait deja UpdateLotissement (tous ses
    // champs y sont optionnels) ; NewLotissement exige explicitement le champ.
    if (isEdit) {
      onSubmit(base);
    } else {
      onSubmit({ ...base, type_lotissement: form.type_lotissement as NewLotissement["type_lotissement"] });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white shadow-2xl">
        {/* En-tête — fixe, toujours visible (ne défile pas avec le formulaire) */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
              {isEdit ? "Modifier" : "Nouveau lotissement"}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#0D3B66]">
              {isEdit ? initialData?.nom : "Enregistrer un lotissement"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          {/* Corps défilant */}
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 sm:px-8">
          {/* Nom */}
          <div className="space-y-1.5">
            <label htmlFor="lot-nom" className="text-sm font-medium text-slate-700">
              Nom du lotissement <span className="text-red-500">*</span>
            </label>
            <Input
              id="lot-nom"
              type="text"
              value={form.nom}
              onChange={set("nom")}
              placeholder="Ex. Lotissement Angré Extension"
              required
            />
          </div>

          {/* Type de lotissement — creation uniquement. Le type se modifie
              ensuite exclusivement via la RPC admin definir_type_lotissement()
              (motif obligatoire, trace dans journal_audit) : ce formulaire
              d'edition n'y touche jamais. */}
          {!isEdit && !soumissionChefferie && (
            <div className="space-y-1.5">
              <label htmlFor="lot-type" className="text-sm font-medium text-slate-700">
                Type de lotissement <span className="text-red-500">*</span>
              </label>
              <select
                id="lot-type"
                value={form.type_lotissement}
                onChange={set("type_lotissement")}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
              >
                {TYPES_LOTISSEMENT.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Soumission chefferie/operateur : le type n'est pas un choix ici
              (force 'villageois' a l'approbation, voir le commentaire sur
              soumissionChefferie plus haut) — informer plutot que proposer un
              select trompeur. */}
          {!isEdit && soumissionChefferie && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
              Type de lotissement : <strong>Villageois</strong>. Les statuts « Approuvé »
              et « ACD » sont attribués ensuite par un administrateur.
            </p>
          )}

          {/* Village + Commune */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="lot-village" className="text-sm font-medium text-slate-700">
                Village
              </label>
              <Input
                id="lot-village"
                type="text"
                value={form.village}
                onChange={set("village")}
                placeholder="Ex. Angré"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lot-commune" className="text-sm font-medium text-slate-700">
                Commune
              </label>
              <Input
                id="lot-commune"
                type="text"
                value={form.commune}
                onChange={set("commune")}
                placeholder="Ex. Cocody"
              />
            </div>
          </div>

          {/* District + Superficie */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="lot-district" className="text-sm font-medium text-slate-700">
                District
              </label>
              <Input
                id="lot-district"
                type="text"
                value={form.district}
                onChange={set("district")}
                placeholder="Ex. Abidjan"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lot-superficie" className="text-sm font-medium text-slate-700">
                Superficie
              </label>
              <Input
                id="lot-superficie"
                type="text"
                value={form.superficie_texte}
                onChange={set("superficie_texte")}
                placeholder="Ex. 4,5 ha"
              />
            </div>
          </div>

          {/* Nb lots + Nb îlots */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="lot-nb-lots" className="text-sm font-medium text-slate-700">
                Nombre de lots
              </label>
              <Input
                id="lot-nb-lots"
                type="number"
                min="0"
                value={form.nb_lots}
                onChange={set("nb_lots")}
                placeholder="Ex. 49"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lot-nb-ilots" className="text-sm font-medium text-slate-700">
                Nombre d&apos;îlots
              </label>
              <Input
                id="lot-nb-ilots"
                type="number"
                min="0"
                value={form.nb_ilots}
                onChange={set("nb_ilots")}
                placeholder="Ex. 6"
              />
            </div>
          </div>

          {/* Référence guide */}
          <div className="space-y-1.5">
            <label htmlFor="lot-guide" className="text-sm font-medium text-slate-700">
              Référence guide parcellaire
            </label>
            <Input
              id="lot-guide"
              type="text"
              value={form.guide_reference}
              onChange={set("guide_reference")}
              placeholder="Ex. GP-2024-CI-001"
            />
          </div>

          {/* PV du guide de répartition — 20 points du score de confiance.
              Le commissaire de justice provient du référentiel (Administration
              → Référentiels), il n'est pas saisi en texte libre. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="lot-pv-guide" className="text-sm font-medium text-slate-700">
                N° d&apos;enregistrement du PV du guide
              </label>
              <Input
                id="lot-pv-guide"
                type="text"
                value={form.pv_numero_enregistrement}
                onChange={set("pv_numero_enregistrement")}
                placeholder="Ex. PV-GR-2024-001"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lot-commissaire" className="text-sm font-medium text-slate-700">
                Commissaire de justice
              </label>
              <select
                id="lot-commissaire"
                value={form.pv_commissaire_justice_id}
                onChange={set("pv_commissaire_justice_id")}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
              >
                <option value="">—</option>
                {commissaires.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Références cadastrales */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="lot-tf" className="text-sm font-medium text-slate-700">
                N° de titre foncier
              </label>
              <Input
                id="lot-tf"
                type="text"
                value={form.tf_numero}
                onChange={set("tf_numero")}
                placeholder="Ex. TF 12345"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lot-livre" className="text-sm font-medium text-slate-700">
                Livre foncier
              </label>
              <Input
                id="lot-livre"
                type="text"
                value={form.livre_foncier}
                onChange={set("livre_foncier")}
                placeholder="Ex. Livre foncier d'Abidjan"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="lot-geometre" className="text-sm font-medium text-slate-700">
                Géomètre-expert
              </label>
              <Input
                id="lot-geometre"
                type="text"
                value={form.geometre_expert}
                onChange={set("geometre_expert")}
                placeholder="Ex. N'Guessan Kouadio"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lot-cabinet" className="text-sm font-medium text-slate-700">
                Cabinet
              </label>
              <Input
                id="lot-cabinet"
                type="text"
                value={form.cabinet_geometre}
                onChange={set("cabinet_geometre")}
                placeholder="Ex. Cabinet TOPO-CI"
              />
            </div>
          </div>

          {/* PV d'identification physique */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="lot-pv-idphys-numero" className="text-sm font-medium text-slate-700">
                N° PV d&apos;identification physique
              </label>
              <Input
                id="lot-pv-idphys-numero"
                type="text"
                value={form.pv_identification_physique_numero}
                onChange={set("pv_identification_physique_numero")}
                placeholder="Ex. PV-IDPHYS-2024-001"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lot-pv-idphys-date" className="text-sm font-medium text-slate-700">
                Date du PV
              </label>
              <Input
                id="lot-pv-idphys-date"
                type="date"
                value={form.pv_identification_physique_date ?? ""}
                onChange={set("pv_identification_physique_date")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="lot-pv-idphys-scan" className="text-sm font-medium text-slate-700">
              Scan du PV (optionnel)
            </label>
            <div className="flex items-center gap-3">
              <input
                id="lot-pv-idphys-scan"
                type="file"
                accept="application/pdf,image/*"
                onChange={handleScanFile}
                disabled={envoiEnCours}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#0D3B66]/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#0D3B66] hover:file:bg-[#0D3B66]/20"
              />
              {scanUrl && !scanFile && (
                <button
                  type="button"
                  onClick={voirScanActuel}
                  className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#0D3B66] hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Voir le scan
                </button>
              )}
            </div>
            {erreurScan && <p className="text-xs font-medium text-red-600">{erreurScan}</p>}
          </div>

          </div>

          {/* Actions — fixes, toujours visibles (barre basse) */}
          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
            <button
              type="button"
              onClick={onClose}
              disabled={envoiEnCours}
              className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={envoiEnCours}
              className="flex items-center justify-center gap-2 rounded-full bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#1E6091] disabled:opacity-60"
            >
              {envoiEnCours && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Enregistrer les modifications" : "Créer le lotissement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
