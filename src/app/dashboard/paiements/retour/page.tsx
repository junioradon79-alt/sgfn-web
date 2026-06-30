"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle2, XCircle, Clock, ArrowLeft, RefreshCw } from "lucide-react";

type Statut = "en_attente" | "confirme" | "echoue" | "rembourse" | null;

export default function RetourPaiementPage() {
  const params = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const [statut, setStatut] = useState<Statut>(null);
  const [montant, setMontant] = useState<number | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState(0);

  const checkStatut = async (txRef: string) => {
    const { data } = await supabase
      .from("paiements")
      .select("statut, montant_total, type")
      .eq("reference_externe", `cinetpay:${txRef}`)
      .maybeSingle();

    if (data) {
      setStatut(data.statut as Statut);
      setMontant(data.montant_total);
      setType(data.type);
      setLoading(false);
      return data.statut;
    }
    return null;
  };

  useEffect(() => {
    const txRef = params.get("transaction_id");
    if (!txRef) {
      setLoading(false);
      return;
    }

    let interval: ReturnType<typeof setInterval>;
    let count = 0;

    const poll = async () => {
      const s = await checkStatut(txRef);
      count++;
      setAttempts(count);
      // Arrêt si statut final ou après 10 tentatives (20 s)
      if (s === "confirme" || s === "echoue" || count >= 10) {
        clearInterval(interval);
        setLoading(false);
      }
    };

    void poll();
    interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  const TYPE_LABELS: Record<string, string> = {
    attestation_cession: "Attestation de cession",
    honoraires: "Honoraires géomètre",
    vente_terrain: "Vente terrain",
    autre: "Paiement SGFN",
  };

  const fcfa = (n: number | null) =>
    `${new Intl.NumberFormat("fr-FR").format(Math.round(n ?? 0))} FCFA`;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/60 bg-white p-8 shadow-sm text-center">
        {loading ? (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <Clock className="h-8 w-8 animate-pulse text-slate-400" />
            </div>
            <h2 className="text-lg font-bold text-[#0D3B66]">Vérification en cours…</h2>
            <p className="mt-2 text-sm text-slate-500">
              Nous vérifions le statut de votre paiement
              {attempts > 0 ? ` (${attempts}/10)` : ""}.
            </p>
          </>
        ) : statut === "confirme" ? (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-9 w-9 text-emerald-500" />
            </div>
            <h2 className="text-lg font-bold text-[#0D3B66]">Paiement confirmé !</h2>
            {type && (
              <p className="mt-1 text-sm font-medium text-slate-700">
                {TYPE_LABELS[type] ?? type}
              </p>
            )}
            {montant !== null && (
              <p className="mt-3 text-2xl font-bold tabular-nums text-emerald-600">
                {fcfa(montant)}
              </p>
            )}
            <p className="mt-3 text-sm text-slate-500">
              Un reçu a été enregistré dans votre espace. Vous pouvez consulter le
              registre des paiements ci-dessous.
            </p>
          </>
        ) : statut === "echoue" ? (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <XCircle className="h-9 w-9 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-[#0D3B66]">Paiement échoué</h2>
            <p className="mt-2 text-sm text-slate-500">
              La transaction n&apos;a pas abouti. Vous pouvez réessayer depuis le registre
              des paiements.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
              <Clock className="h-9 w-9 text-amber-500" />
            </div>
            <h2 className="text-lg font-bold text-[#0D3B66]">En cours de traitement</h2>
            <p className="mt-2 text-sm text-slate-500">
              Votre paiement est en cours de validation. Le statut sera mis à jour
              automatiquement dans les prochaines minutes.
            </p>
            <button
              onClick={() => {
                const txRef = params.get("transaction_id");
                if (txRef) { setLoading(true); setAttempts(0); void checkStatut(txRef).then(() => setLoading(false)); }
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Rafraîchir
            </button>
          </>
        )}

        <button
          onClick={() => router.push("/dashboard/paiements")}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D3B66] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1E6091]"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux paiements
        </button>
      </div>
    </div>
  );
}
