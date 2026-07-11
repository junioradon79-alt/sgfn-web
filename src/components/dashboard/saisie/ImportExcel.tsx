"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  FileSpreadsheet,
  Loader2,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { CibleChoisie, LotEtat, NouvelAttributaire } from "@/lib/saisie";
import {
  construireFeuilleAide,
  construireFeuilleModele,
  normaliserNom,
  normaliserNumero,
  parserFeuilleImport,
  type LigneImport,
} from "@/lib/saisie-import";

type AttributaireOption = { id: string; nom: string | null; piece_nature: string | null; piece_num: string | null };

type Resolution =
  | { status: "auto" | "manuel_existant"; attributaire_id: string; nomAffiche: string }
  | { status: "manuel_nouveau"; ref: string; nomAffiche: string }
  | { status: "a_resoudre" };

/**
 * Import Excel simplifié (étape 4 du module Opérateur de saisie) : parse un
 * fichier « 1 ligne = 1 lot », résout les attributaires (recherche + création
 * explicite, jamais silencieuse), puis remonte le même vocabulaire que la
 * saisie manuelle (`mods`/`nouveaux`) au parent — qui gère l'aperçu du diff
 * et la soumission maker-checker sans rien dupliquer.
 */
export function ImportExcel({
  etats,
  onImport,
}: {
  etats: LotEtat[];
  onImport: (mods: Record<string, CibleChoisie>, nouveaux: NouvelAttributaire[]) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [lignes, setLignes] = useState<LigneImport[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});

  const lotParCle = useMemo(() => {
    const m = new Map<string, LotEtat>();
    etats.forEach((e) => m.set(`${normaliserNumero(e.ilot)}/${normaliserNumero(e.numero_lot)}`, e));
    return m;
  }, [etats]);

  const telechargerModele = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(construireFeuilleModele()), "Import");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(construireFeuilleAide()), "Aide");
    XLSX.writeFile(wb, "modele_import_attributions.xlsx");
  };

  const reset = () => {
    setFileName("");
    setErreurs([]);
    setLignes([]);
    setResolutions({});
  };

  const onFile = async (file: File) => {
    reset();
    setFileName(file.name);
    setParsing(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matrice = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
      const { lignes: parsees, erreurs: erreursFormat } = parserFeuilleImport(matrice);

      // Vérifie que chaque lot référencé existe bien dans le lotissement sélectionné.
      const erreursLot: string[] = [];
      for (const l of parsees) {
        const cle = `${normaliserNumero(l.ilot)}/${normaliserNumero(l.numeroLot)}`;
        if (!lotParCle.has(cle)) {
          erreursLot.push(`Ligne ${l.ligne} : lot introuvable (Îlot ${l.ilot} / Lot ${l.numeroLot}).`);
        }
      }
      setErreurs([...erreursFormat, ...erreursLot]);
      setLignes(parsees);

      // Résolution auto des attributaires : une recherche exacte par nom unique.
      const noms = new Map<string, string>();
      parsees.forEach((l) => {
        if (l.action === "attribuer" && l.attributaireNom) {
          const k = normaliserNom(l.attributaireNom);
          if (!noms.has(k)) noms.set(k, l.attributaireNom);
        }
      });
      const initial: Record<string, Resolution> = {};
      await Promise.all(
        Array.from(noms.entries()).map(async ([k, nomOriginal]) => {
          const { data } = await supabase
            .from("attributaires")
            .select("id, nom")
            .ilike("nom", nomOriginal)
            .limit(2);
          if (data && data.length === 1) {
            initial[k] = { status: "auto", attributaire_id: data[0].id, nomAffiche: data[0].nom ?? nomOriginal };
          } else {
            initial[k] = { status: "a_resoudre" };
          }
        }),
      );
      setResolutions(initial);
    } finally {
      setParsing(false);
    }
  };

  // Regroupe les lignes « attribuer » par attributaire unique, pour l'écran de résolution.
  const groupesAttributaires = useMemo(() => {
    const m = new Map<
      string,
      { nomOriginal: string; lignes: number[]; pieceNature?: string; pieceNum?: string; telephone?: string }
    >();
    lignes.forEach((l) => {
      if (l.action !== "attribuer" || !l.attributaireNom) return;
      const k = normaliserNom(l.attributaireNom);
      const g = m.get(k);
      if (g) {
        g.lignes.push(l.ligne);
      } else {
        m.set(k, {
          nomOriginal: l.attributaireNom,
          lignes: [l.ligne],
          pieceNature: l.pieceNature,
          pieceNum: l.pieceNum,
          telephone: l.telephone,
        });
      }
    });
    return m;
  }, [lignes]);

  const nbARésoudre = Array.from(groupesAttributaires.keys()).filter(
    (k) => (resolutions[k]?.status ?? "a_resoudre") === "a_resoudre",
  ).length;

  const pret = lignes.length > 0 && erreurs.length === 0 && nbARésoudre === 0;

  const ajouterAuDiff = () => {
    const mods: Record<string, CibleChoisie> = {};
    const nouveauxParRef = new Map<string, NouvelAttributaire>();
    for (const l of lignes) {
      const cle = `${normaliserNumero(l.ilot)}/${normaliserNumero(l.numeroLot)}`;
      const lot = lotParCle.get(cle);
      if (!lot) continue;
      if (l.action === "libre") {
        mods[lot.lot_id] = { type: "libre" };
        continue;
      }
      const k = normaliserNom(l.attributaireNom!);
      const res = resolutions[k];
      if (!res || res.status === "a_resoudre") continue;
      if (res.status === "manuel_nouveau") {
        mods[lot.lot_id] = {
          type: "attribue",
          attributaire_ref: res.ref,
          attributaire_nom: res.nomAffiche,
          qualite: l.qualite!,
        };
        if (!nouveauxParRef.has(res.ref)) {
          const g = groupesAttributaires.get(k);
          nouveauxParRef.set(res.ref, {
            ref: res.ref,
            nom: res.nomAffiche,
            type: "personne_physique",
            piece_nature: g?.pieceNature,
            piece_num: g?.pieceNum,
            telephone: g?.telephone,
          });
        }
      } else {
        mods[lot.lot_id] = {
          type: "attribue",
          attributaire_id: res.attributaire_id,
          attributaire_nom: res.nomAffiche,
          qualite: l.qualite!,
        };
      }
    }
    onImport(mods, Array.from(nouveauxParRef.values()));
    reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#0D3B66]">Import Excel</h2>
        <button
          type="button"
          onClick={() => void telechargerModele()}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E6091] hover:underline"
        >
          <Download className="h-3.5 w-3.5" />
          Télécharger le modèle
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        1 ligne = 1 lot (attribution ou remise en disponibilité). Le fichier n&apos;est jamais appliqué
        directement : il alimente l&apos;aperçu ci-dessous, à soumettre ensuite pour validation.
      </p>

      <div className="mt-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={parsing}
          className="inline-flex items-center gap-2 rounded-xl border border-[#0D3B66] px-4 py-2 text-sm font-semibold text-[#0D3B66] transition hover:bg-[#0D3B66] hover:text-white disabled:opacity-40"
        >
          {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          {parsing ? "Analyse en cours…" : fileName ? "Changer de fichier" : "Choisir un fichier Excel"}
        </button>
        {fileName && !parsing && <span className="ml-3 text-sm text-slate-500">{fileName}</span>}
      </div>

      {erreurs.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-200/70 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            {erreurs.length} erreur(s) à corriger dans le fichier
          </div>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            {erreurs.slice(0, 20).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {erreurs.length > 20 && <li>… et {erreurs.length - 20} de plus.</li>}
          </ul>
        </div>
      )}

      {lignes.length > 0 && erreurs.length === 0 && (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-[#0D3B66]">{lignes.length}</span> lot(s) reconnu(s) dans le
            fichier.
          </p>

          {groupesAttributaires.size > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700">
                Attributaires à confirmer ({groupesAttributaires.size})
              </h3>
              <div className="mt-2 space-y-2">
                {Array.from(groupesAttributaires.entries()).map(([k, g]) => (
                  <LigneResolutionAttributaire
                    key={k}
                    nomOriginal={g.nomOriginal}
                    nbLignes={g.lignes.length}
                    resolution={resolutions[k] ?? { status: "a_resoudre" }}
                    supabase={supabase}
                    pieceNature={g.pieceNature}
                    pieceNum={g.pieceNum}
                    telephone={g.telephone}
                    onResolve={(res) => setResolutions((r) => ({ ...r, [k]: res }))}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              {pret
                ? "Prêt à ajouter à l'aperçu des changements."
                : `${nbARésoudre} attributaire(s) restent à résoudre avant l'ajout.`}
            </p>
            <button
              type="button"
              onClick={ajouterAuDiff}
              disabled={!pret}
              className="inline-flex items-center gap-2 rounded-full bg-[#0D3B66] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#1E6091] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              Ajouter à l&apos;aperçu ({lignes.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LigneResolutionAttributaire({
  nomOriginal,
  nbLignes,
  resolution,
  supabase,
  pieceNature,
  pieceNum,
  telephone,
  onResolve,
}: {
  nomOriginal: string;
  nbLignes: number;
  resolution: Resolution;
  supabase: ReturnType<typeof createClient>;
  pieceNature?: string;
  pieceNum?: string;
  telephone?: string;
  onResolve: (res: Resolution) => void;
}) {
  const [recherche, setRecherche] = useState(false);
  const [query, setQuery] = useState("");
  const [resultats, setResultats] = useState<AttributaireOption[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let active = true;
    const t = setTimeout(() => {
      supabase
        .from("attributaires")
        .select("id, nom, piece_nature, piece_num")
        .ilike("nom", `%${q}%`)
        .order("nom")
        .limit(10)
        .then(({ data }) => {
          if (active) setResultats((data ?? []) as AttributaireOption[]);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, supabase]);

  const creerNouveau = () => {
    const ref = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    onResolve({ status: "manuel_nouveau", ref, nomAffiche: nomOriginal });
    setRecherche(false);
  };

  const badge =
    resolution.status === "auto" ? (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        Rapproché : {resolution.nomAffiche}
      </span>
    ) : resolution.status === "manuel_existant" ? (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        {resolution.nomAffiche}
      </span>
    ) : resolution.status === "manuel_nouveau" ? (
      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
        Nouvel attributaire
      </span>
    ) : (
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">À résoudre</span>
    );

  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-medium text-slate-800">{nomOriginal}</span>
          <span className="ml-2 text-xs text-slate-400">
            {nbLignes} lot{nbLignes > 1 ? "s" : ""}
            {pieceNum ? ` · ${pieceNature ? `${pieceNature} ` : ""}${pieceNum}` : ""}
            {telephone ? ` · ${telephone}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          <button
            type="button"
            onClick={() => setRecherche((v) => !v)}
            className="rounded-full p-1.5 text-slate-400 hover:bg-white hover:text-[#0D3B66]"
            aria-label="Résoudre"
          >
            {recherche ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {recherche && (
        <div className="mt-3 space-y-2 border-t border-slate-200/70 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un attributaire existant…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
            />
          </div>
          {resultats.length > 0 && query.trim().length >= 2 && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              {resultats.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onResolve({ status: "manuel_existant", attributaire_id: a.id, nomAffiche: a.nom ?? nomOriginal });
                    setRecherche(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-700">{a.nom}</span>
                  <span className="truncate text-xs text-slate-400">{a.piece_num ?? ""}</span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={creerNouveau}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E6091] hover:underline"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Créer « {nomOriginal} » comme nouvel attributaire
          </button>
        </div>
      )}
    </div>
  );
}
