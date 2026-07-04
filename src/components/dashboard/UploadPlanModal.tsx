"use client";

import { useEffect, useState } from "react";
import { X, Upload, Loader2, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Input } from "@/components/ui/Input";
import SGFNButton from "@/components/ui/SGFNButton";

type LotOption = {
  id: string;
  numero_lot: string | null;
  ilots: { numero: string | null; lotissements: { nom: string | null } | null } | null;
};

type Step = "form" | "envoi" | "conversion" | "succes" | "erreur";

export default function UploadPlanModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const supabase = createClient();

  const [lots, setLots] = useState<LotOption[]>([]);
  const [search, setSearch] = useState("");
  const [lotId, setLotId] = useState<string | null>(null);
  const [titre, setTitre] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("lots")
      .select("id, numero_lot, ilots(numero, lotissements(nom))")
      .order("numero_lot")
      .then(({ data }) => setLots((data as unknown as LotOption[]) ?? []));
  }, []);

  const filtered = lots.filter((l) => {
    const q = search.toLowerCase();
    return !q || (l.numero_lot ?? "").toLowerCase().includes(q);
  }).slice(0, 50);

  const lotChoisi = lots.find((l) => l.id === lotId) ?? null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && !/\.(dwg|bak)$/i.test(f.name)) {
      setMessage("Seuls les fichiers .dwg et .bak sont acceptés.");
      setFile(null);
      return;
    }
    setMessage(null);
    setFile(f);
  };

  const soumettre = async () => {
    if (!lotId || !file) return;
    setStep("envoi");
    setMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié.");

      const id = crypto.randomUUID();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "dwg";
      const chemin = `plans-cad/${id}/original.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(chemin, file);
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("documents").insert({
        id,
        type: "plan_lot",
        lot_id: lotId,
        titre: titre.trim() || file.name,
        url_fichier: chemin,
        televerse_par: user.id,
      });
      if (insertErr) throw insertErr;

      setStep("conversion");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/convertir-plan-cad`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ document_id: id }),
        }
      );
      const json = await res.json();

      if (res.status === 503) {
        setMessage("Conversion indisponible pour le moment, le plan original reste téléchargeable.");
        setStep("succes");
      } else if (!json.ok) {
        setMessage(json.erreur ?? "La conversion a échoué, le plan original reste téléchargeable.");
        setStep("succes");
      } else {
        setStep("succes");
      }

      onUploaded();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Une erreur est survenue.");
      setStep("erreur");
    }
  };

  const enCours = step === "envoi" || step === "conversion";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={enCours ? undefined : onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#0D3B66]">Téléverser un plan</h2>
            <p className="mt-0.5 text-xs text-slate-500">Fichier AutoCAD (.dwg ou .bak) rattaché à un lot.</p>
          </div>
          {!enCours && (
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {step === "succes" ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-700">Plan téléversé</p>
            {message && <p className="mt-2 text-xs text-amber-600">{message}</p>}
            <SGFNButton onClick={onClose} className="mt-5 rounded-xl px-5 py-2.5 text-sm">
              Fermer
            </SGFNButton>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Lot concerné <span className="text-red-500">*</span>
              </label>
              {lotChoisi ? (
                <div className="flex items-center justify-between rounded-xl border border-[#0D3B66]/30 bg-[#0D3B66]/5 px-3 py-2.5 text-sm">
                  <span className="text-slate-700">
                    Lot {lotChoisi.numero_lot ?? "—"}
                    {lotChoisi.ilots?.numero ? ` · Îlot ${lotChoisi.ilots.numero}` : ""}
                    {lotChoisi.ilots?.lotissements?.nom ? ` · ${lotChoisi.ilots.lotissements.nom}` : ""}
                  </span>
                  {!enCours && (
                    <button onClick={() => setLotId(null)} className="text-xs font-semibold text-[#0D3B66] hover:underline">
                      Changer
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Rechercher un numéro de lot…"
                      className="pl-9 text-sm"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200">
                    {filtered.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-slate-400">Aucun lot trouvé.</p>
                    ) : (
                      filtered.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => setLotId(l.id)}
                          className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50"
                        >
                          <span>
                            Lot {l.numero_lot ?? "—"}
                            {l.ilots?.numero ? ` · Îlot ${l.ilots.numero}` : ""}
                          </span>
                          {l.ilots?.lotissements?.nom && (
                            <span className="text-xs text-slate-400">{l.ilots.lotissements.nom}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Titre (optionnel)</label>
              <Input
                placeholder="Plan de bornage — lot 42"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                disabled={enCours}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Fichier .dwg / .bak <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept=".dwg,.bak"
                onChange={handleFile}
                disabled={enCours}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#0D3B66]/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#0D3B66] hover:file:bg-[#0D3B66]/20"
              />
            </div>

            {message && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-red-600">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {message}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={enCours}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <SGFNButton
                onClick={soumettre}
                disabled={enCours || !lotId || !file}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm disabled:opacity-60"
              >
                {enCours ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {step === "envoi" ? "Envoi…" : "Conversion en cours…"}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Téléverser
                  </>
                )}
              </SGFNButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
