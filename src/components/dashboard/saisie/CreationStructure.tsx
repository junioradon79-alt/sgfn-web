"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Layers, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { LotStructure, PayloadCreationStructure, ResumeCreation } from "@/lib/saisie";
import type { Json } from "../../../../database.types";

type Lookup = { id: string; nom: string };

/**
 * Création d'un nouveau lotissement (étape 5) : formulaire séparé de la saisie
 * d'attributions, comme cadré avec le user — l'Excel ne sert qu'aux
 * attributions. Soumet un payload `creation_structure` via `soumettre_saisie`
 * (RPC déjà posée à l'étape 1, `_appliquer_creation_structure` insère
 * lotissement + îlots + lots seulement à l'approbation admin).
 */
export function CreationStructure({
  onSubmitted,
}: {
  onSubmitted: (msg: { kind: "ok" | "err"; text: string }) => void;
}) {
  const supabase = useMemo(() => createClient(), []);

  // Listes de référence (toutes lisibles par tout authentifié).
  const [autorites, setAutorites] = useState<Lookup[]>([]);
  const [operateurs, setOperateurs] = useState<Lookup[]>([]);
  const [familles, setFamilles] = useState<Lookup[]>([]);
  const [nomsExistants, setNomsExistants] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("autorites_coutumieres").select("id, nom").order("nom").then(({ data }) => setAutorites((data ?? []) as Lookup[]));
    supabase.from("operateurs").select("id, nom").order("nom").then(({ data }) => setOperateurs((data ?? []) as Lookup[]));
    supabase.from("familles").select("id, nom").order("nom").then(({ data }) => setFamilles((data ?? []) as Lookup[]));
    supabase
      .from("lotissements")
      .select("nom")
      .then(({ data }) => setNomsExistants((data ?? []).map((l) => (l as { nom: string }).nom)));
  }, [supabase]);

  // ── Métadonnées du lotissement ──
  const [nom, setNom] = useState("");
  const [village, setVillage] = useState("");
  const [commune, setCommune] = useState("");
  const [district, setDistrict] = useState("Abidjan");
  const [guideReference, setGuideReference] = useState("");
  const [superficieTexte, setSuperficieTexte] = useState("");

  // Autorité coutumière / opérateur / famille : choisir dans la liste existante,
  // ou créer une nouvelle entité (créée à l'approbation seulement, jamais
  // silencieusement — même principe que les nouveaux attributaires).
  const [autoriteId, setAutoriteId] = useState("");
  const [autoriteCreer, setAutoriteCreer] = useState(false);
  const [autoriteNouv, setAutoriteNouv] = useState<Record<string, string>>({});
  const [operateurId, setOperateurId] = useState("");
  const [operateurCreer, setOperateurCreer] = useState(false);
  const [operateurNouv, setOperateurNouv] = useState<Record<string, string>>({});
  const [familleId, setFamilleId] = useState("");
  const [familleCreer, setFamilleCreer] = useState(false);
  const [familleNouv, setFamilleNouv] = useState<Record<string, string>>({});

  const nomProche = useMemo(() => {
    const n = nom.trim().toLowerCase();
    if (n.length < 3) return null;
    return nomsExistants.find((e) => e.toLowerCase().includes(n) || n.includes(e.toLowerCase())) ?? null;
  }, [nom, nomsExistants]);

  // ── Îlots + lots en cours de construction ──
  const [ilots, setIlots] = useState<{ numero: string; lots: LotStructure[] }[]>([]);
  const [numeroIlot, setNumeroIlot] = useState("");
  const [ilotEditIdx, setIlotEditIdx] = useState<number | null>(null);

  // Éditeur « ajouter un lot » pour l'îlot sélectionné.
  const [numeroLot, setNumeroLot] = useState("");
  const [numeroParcelle, setNumeroParcelle] = useState("");
  const [superficieM2, setSuperficieM2] = useState("");
  const [estEquipement, setEstEquipement] = useState(false);

  const [titre, setTitre] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const ajouterIlot = () => {
    const numero = numeroIlot.trim();
    if (!numero) return;
    if (ilots.some((i) => i.numero === numero)) {
      setErreur(`L'îlot ${numero} a déjà été ajouté.`);
      return;
    }
    setIlotEditIdx(ilots.length);
    setIlots((list) => [...list, { numero, lots: [] }]);
    setNumeroIlot("");
    setErreur(null);
  };

  const retirerIlot = (idx: number) => {
    setIlots((list) => list.filter((_, i) => i !== idx));
    setIlotEditIdx((cur) => (cur === idx ? null : cur));
  };

  const ajouterLot = () => {
    if (ilotEditIdx === null) return;
    const num = numeroLot.trim();
    if (!num) {
      setErreur("Numéro de lot requis.");
      return;
    }
    const ilot = ilots[ilotEditIdx];
    if (ilot.lots.some((l) => l.numero_lot === num)) {
      setErreur(`Le lot ${num} existe déjà dans l'îlot ${ilot.numero}.`);
      return;
    }
    const lot: LotStructure = {
      numero_lot: num,
      numero_parcelle: numeroParcelle.trim() || undefined,
      superficie_m2: superficieM2.trim() ? Number(superficieM2) : null,
      est_equipement: estEquipement,
    };
    setIlots((list) => list.map((it, i) => (i === ilotEditIdx ? { ...it, lots: [...it.lots, lot] } : it)));
    setNumeroLot("");
    setNumeroParcelle("");
    setSuperficieM2("");
    setEstEquipement(false);
    setErreur(null);
  };

  const retirerLot = (ilotIdx: number, lotIdx: number) => {
    setIlots((list) =>
      list.map((it, i) => (i === ilotIdx ? { ...it, lots: it.lots.filter((_, j) => j !== lotIdx) } : it)),
    );
  };

  const totalLots = ilots.reduce((n, i) => n + i.lots.length, 0);
  const totalEquipements = ilots.reduce((n, i) => n + i.lots.filter((l) => l.est_equipement).length, 0);
  const autoritePrete = !autoriteCreer || (autoriteNouv.nom ?? "").trim().length > 0;
  const operateurPret = !operateurCreer || (operateurNouv.nom ?? "").trim().length > 0;
  const famillePrete = !familleCreer || (familleNouv.nom ?? "").trim().length > 0;
  const pret = nom.trim().length > 0 && totalLots > 0 && autoritePrete && operateurPret && famillePrete;

  const soumettre = async () => {
    if (!pret) return;
    setSubmitting(true);
    setErreur(null);
    const payload: PayloadCreationStructure = {
      lotissement: {
        nom: nom.trim(),
        village: village.trim() || undefined,
        commune: commune.trim() || undefined,
        district: district.trim() || undefined,
        autorite_coutumiere_id: !autoriteCreer ? autoriteId || undefined : undefined,
        operateur_id: !operateurCreer ? operateurId || undefined : undefined,
        famille_id: !familleCreer ? familleId || undefined : undefined,
        guide_reference: guideReference.trim() || undefined,
        superficie_texte: superficieTexte.trim() || undefined,
      },
      nouvelle_autorite: autoriteCreer
        ? {
            nom: (autoriteNouv.nom ?? "").trim(),
            type: (autoriteNouv.type ?? "").trim() || undefined,
            village: (autoriteNouv.village ?? "").trim() || undefined,
            chef: (autoriteNouv.chef ?? "").trim() || undefined,
            contact: (autoriteNouv.contact ?? "").trim() || undefined,
          }
        : undefined,
      nouvel_operateur: operateurCreer
        ? {
            nom: (operateurNouv.nom ?? "").trim(),
            type: (operateurNouv.type ?? "").trim() || undefined,
            contact: (operateurNouv.contact ?? "").trim() || undefined,
          }
        : undefined,
      nouvelle_famille: familleCreer
        ? {
            nom: (familleNouv.nom ?? "").trim(),
            chef_de_famille: (familleNouv.chef_de_famille ?? "").trim() || undefined,
            contact: (familleNouv.contact ?? "").trim() || undefined,
          }
        : undefined,
      ilots,
    };
    const resume: ResumeCreation = {
      nom_lotissement: nom.trim(),
      nb_ilots: ilots.length,
      nb_lots: totalLots,
      nb_equipements: totalEquipements,
    };
    const titreFinal = titre.trim() || `Création de lotissement — ${nom.trim()}`;

    const { error } = await supabase.rpc("soumettre_saisie", {
      p_type: "creation_structure",
      // Le paramètre SQL est `uuid` nullable (soumission sans lotissement existant) ;
      // le typage généré ne reflète pas cette nullabilité, d'où le cast explicite.
      p_lotissement_id: null as unknown as string,
      p_titre: titreFinal,
      p_payload: payload as unknown as Json,
      p_resume: resume as unknown as Json,
    });
    setSubmitting(false);
    if (error) {
      onSubmitted({ kind: "err", text: error.message });
      return;
    }
    onSubmitted({
      kind: "ok",
      text: "Soumission envoyée. Un administrateur doit l'approuver avant création réelle du lotissement.",
    });
    setNom("");
    setVillage("");
    setCommune("");
    setDistrict("Abidjan");
    setAutoriteId("");
    setAutoriteCreer(false);
    setAutoriteNouv({});
    setOperateurId("");
    setOperateurCreer(false);
    setOperateurNouv({});
    setFamilleId("");
    setFamilleCreer(false);
    setFamilleNouv({});
    setGuideReference("");
    setSuperficieTexte("");
    setIlots([]);
    setIlotEditIdx(null);
    setTitre("");
    window.dispatchEvent(new Event("sgnf:refresh-badges"));
  };

  return (
    <div className="space-y-6">
      {/* Métadonnées du lotissement */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-[#0D3B66]">Nouveau lotissement</h2>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Nom du lotissement <span className="text-red-500">*</span>
            </label>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex. Lotissement Angré Extension"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10 sm:max-w-md"
            />
            {nomProche && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                Un lotissement au nom proche existe déjà : « {nomProche} ». Vérifiez qu&apos;il ne s&apos;agit pas
                d&apos;un doublon.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Village</label>
              <input
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="Ex. Angré"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Commune</label>
              <input
                value={commune}
                onChange={(e) => setCommune(e.target.value)}
                placeholder="Ex. Cocody"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">District</label>
              <input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Superficie</label>
              <input
                value={superficieTexte}
                onChange={(e) => setSuperficieTexte(e.target.value)}
                placeholder="Ex. 4,5 ha"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <PickerOuCreation
              label="Autorité coutumière"
              options={autorites}
              selectedId={autoriteId}
              onSelectedId={setAutoriteId}
              creerMode={autoriteCreer}
              onCreerMode={setAutoriteCreer}
              champs={[
                { key: "nom", label: "Nom", required: true, placeholder: "Ex. Chefferie de…" },
                { key: "type", label: "Type", placeholder: "Ex. chefferie" },
                { key: "village", label: "Village" },
                { key: "chef", label: "Chef" },
                { key: "contact", label: "Contact" },
              ]}
              valeurs={autoriteNouv}
              onValeur={(k, v) => setAutoriteNouv((f) => ({ ...f, [k]: v }))}
            />
            <PickerOuCreation
              label="Opérateur"
              options={operateurs}
              selectedId={operateurId}
              onSelectedId={setOperateurId}
              creerMode={operateurCreer}
              onCreerMode={setOperateurCreer}
              champs={[
                { key: "nom", label: "Nom", required: true },
                { key: "type", label: "Type", placeholder: "Ex. operateur" },
                { key: "contact", label: "Contact" },
              ]}
              valeurs={operateurNouv}
              onValeur={(k, v) => setOperateurNouv((f) => ({ ...f, [k]: v }))}
            />
            <PickerOuCreation
              label="Famille"
              options={familles}
              selectedId={familleId}
              onSelectedId={setFamilleId}
              creerMode={familleCreer}
              onCreerMode={setFamilleCreer}
              champs={[
                { key: "nom", label: "Nom", required: true },
                { key: "chef_de_famille", label: "Chef de famille" },
                { key: "contact", label: "Contact" },
              ]}
              valeurs={familleNouv}
              onValeur={(k, v) => setFamilleNouv((f) => ({ ...f, [k]: v }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Référence guide parcellaire</label>
            <input
              value={guideReference}
              onChange={(e) => setGuideReference(e.target.value)}
              placeholder="Ex. GP-2024-CI-001"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10 sm:max-w-md"
            />
          </div>
        </div>
      </div>

      {/* Îlots + lots */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-[#0D3B66]">Îlots &amp; lots</h2>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Numéro d&apos;îlot</label>
            <input
              value={numeroIlot}
              onChange={(e) => setNumeroIlot(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ajouterIlot()}
              placeholder="Ex. 01"
              className="w-40 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
            />
          </div>
          <button
            type="button"
            onClick={ajouterIlot}
            className="inline-flex items-center gap-2 rounded-full border border-[#0D3B66] px-4 py-2 text-sm font-medium text-[#0D3B66] transition hover:bg-[#0D3B66] hover:text-white"
          >
            <Plus className="h-4 w-4" />
            Ajouter l&apos;îlot
          </button>
        </div>

        {erreur && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200/70 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {erreur}
          </div>
        )}

        {ilots.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-500">
            Aucun îlot pour l&apos;instant. Ajoutez-en un pour commencer à y saisir des lots.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {ilots.map((ilot, idx) => (
              <div key={ilot.numero} className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#0D3B66]">
                    <Layers className="h-4 w-4" />
                    Îlot {ilot.numero}
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 shadow-sm">
                      {ilot.lots.length} lot{ilot.lots.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIlotEditIdx(ilotEditIdx === idx ? null : idx)}
                      className="rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      {ilotEditIdx === idx ? "Fermer" : "Ajouter des lots"}
                    </button>
                    <button
                      type="button"
                      onClick={() => retirerIlot(idx)}
                      className="rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      aria-label="Retirer l'îlot"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {ilot.lots.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200/70">
                          {["Lot", "Parcelle", "Superficie (m²)", "Équipement", ""].map((h) => (
                            <th key={h} className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ilot.lots.map((l, lotIdx) => (
                          <tr key={l.numero_lot}>
                            <td className="px-2.5 py-2 font-medium text-slate-700">{l.numero_lot}</td>
                            <td className="px-2.5 py-2 text-slate-500">{l.numero_parcelle ?? "—"}</td>
                            <td className="px-2.5 py-2 text-slate-500">{l.superficie_m2 ?? "—"}</td>
                            <td className="px-2.5 py-2 text-slate-500">{l.est_equipement ? "Oui" : "—"}</td>
                            <td className="px-2.5 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => retirerLot(idx, lotIdx)}
                                className="rounded-full p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                                aria-label="Retirer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {ilotEditIdx === idx && (
                  <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-200/70 pt-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">N° lot</label>
                      <input
                        value={numeroLot}
                        onChange={(e) => setNumeroLot(e.target.value)}
                        placeholder="Ex. 001"
                        className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">N° parcelle</label>
                      <input
                        value={numeroParcelle}
                        onChange={(e) => setNumeroParcelle(e.target.value)}
                        className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Superficie (m²)</label>
                      <input
                        type="number"
                        min="0"
                        value={superficieM2}
                        onChange={(e) => setSuperficieM2(e.target.value)}
                        className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
                      />
                    </div>
                    <label className="flex items-center gap-1.5 pb-1.5 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={estEquipement}
                        onChange={(e) => setEstEquipement(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300"
                      />
                      Réserve / équipement
                    </label>
                    <button
                      type="button"
                      onClick={ajouterLot}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#0D3B66] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#1E6091]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ajouter ce lot
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aperçu + soumission */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#0D3B66]">Aperçu avant soumission</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[#0D3B66]/10 px-2.5 py-1 font-medium text-[#0D3B66]">
              {ilots.length} îlot(s)
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
        </div>

        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Titre de la soumission (optionnel)</label>
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder={`Ex. Création de lotissement — ${nom || "…"}`}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10 sm:max-w-md"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {pret
                ? "Prêt à soumettre pour validation."
                : "Renseignez un nom de lotissement et au moins un lot avant de soumettre."}
            </p>
            <button
              type="button"
              onClick={soumettre}
              disabled={submitting || !pret}
              className="inline-flex items-center gap-2 rounded-full bg-[#0D3B66] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#1E6091] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Soumettre pour validation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type Champ = { key: string; label: string; placeholder?: string; required?: boolean };

/** Sélecteur « existant dans la liste » ou « nouveau » (jamais de création silencieuse). */
function PickerOuCreation({
  label,
  options,
  selectedId,
  onSelectedId,
  creerMode,
  onCreerMode,
  champs,
  valeurs,
  onValeur,
}: {
  label: string;
  options: Lookup[];
  selectedId: string;
  onSelectedId: (id: string) => void;
  creerMode: boolean;
  onCreerMode: (v: boolean) => void;
  champs: Champ[];
  valeurs: Record<string, string>;
  onValeur: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <button
          type="button"
          onClick={() => onCreerMode(!creerMode)}
          className="text-xs font-medium text-[#1E6091] hover:underline"
        >
          {creerMode ? "Choisir dans la liste" : "+ Créer nouveau"}
        </button>
      </div>
      {!creerMode ? (
        <select
          value={selectedId}
          onChange={(e) => onSelectedId(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nom}
            </option>
          ))}
        </select>
      ) : (
        <div className="space-y-2 rounded-xl border border-dashed border-[#0D3B66]/30 bg-[#0D3B66]/5 p-3">
          {champs.map((c) => (
            <div key={c.key} className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                {c.label}
                {c.required && <span className="text-red-500"> *</span>}
              </label>
              <input
                value={valeurs[c.key] ?? ""}
                onChange={(e) => onValeur(c.key, e.target.value)}
                placeholder={c.placeholder}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
