"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// Verrouillage par inactivité : après 10 min sans activité, on DÉCONNECTE
// (signOut) — la seule mesure réellement sûre pour un poste partagé/non surveillé,
// puisqu'un simple overlay laisserait le jeton de session valide. Un avertissement
// avec compte à rebours de 30 s précède la déconnexion (évite les surprises en
// pleine lecture). Monté une fois dans DashboardShell → couvre tous les rôles.

const IDLE_MS = 10 * 60 * 1000; // 10 min
const WARN_MS = 30 * 1000; // avertissement 30 s avant
const THROTTLE_MS = 1000; // ne pas réarmer les minuteurs à chaque pixel

export function InactivityLogout() {
  const router = useRouter();
  const [warning, setWarning] = useState(false);
  const [reste, setReste] = useState(Math.ceil(WARN_MS / 1000));
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  // Le bouton « Rester connecté » doit pouvoir réarmer, mais la logique vit dans
  // l'effet → on l'expose via une ref.
  const resetRef = useRef<() => void>(() => {});

  useEffect(() => {
    let warnTimer: ReturnType<typeof setTimeout> | null = null;
    let logoutTimer: ReturnType<typeof setTimeout> | null = null;
    let countdown: ReturnType<typeof setInterval> | null = null;
    let dernierReset = 0;
    let deconnecte = false;

    const clearAll = () => {
      if (warnTimer) clearTimeout(warnTimer);
      if (logoutTimer) clearTimeout(logoutTimer);
      if (countdown) clearInterval(countdown);
      warnTimer = logoutTimer = null;
      countdown = null;
    };

    const deconnecter = async () => {
      if (deconnecte) return;
      deconnecte = true;
      clearAll();
      setDeconnexionEnCours(true);
      try {
        await createClient().auth.signOut();
      } catch {
        // même si signOut échoue (réseau), on quitte l'écran protégé
      }
      router.replace("/login");
    };

    const afficherAvertissement = () => {
      setWarning(true);
      setReste(Math.ceil(WARN_MS / 1000));
      countdown = setInterval(() => {
        setReste((r) => (r > 1 ? r - 1 : 0));
      }, 1000);
      logoutTimer = setTimeout(() => void deconnecter(), WARN_MS);
    };

    const reset = () => {
      if (deconnecte) return;
      clearAll();
      setWarning(false);
      warnTimer = setTimeout(afficherAvertissement, IDLE_MS - WARN_MS);
    };
    resetRef.current = reset;

    const onActivity = () => {
      const now = Date.now();
      if (now - dernierReset < THROTTLE_MS) return;
      dernierReset = now;
      reset();
    };

    // Capture : attrape aussi le scroll des conteneurs internes (main overflow-y-auto),
    // qui ne remonte pas jusqu'à window en phase de bouillonnement.
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"];
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    events.forEach((e) => window.addEventListener(e, onActivity, opts));
    reset(); // démarre le compteur

    return () => {
      clearAll();
      events.forEach((e) => window.removeEventListener(e, onActivity, opts));
    };
  }, [router]);

  if (!warning) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="verrou-titre"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
          <ShieldAlert className="h-6 w-6 text-amber-600" />
        </div>
        <p id="verrou-titre" className="text-base font-bold text-[#0B2E4F]">
          Session bientôt verrouillée
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Par sécurité, sans activité vous serez déconnecté dans{" "}
          <span className="font-bold tabular-nums text-[#0B2E4F]">{reste}&nbsp;s</span>.
        </p>

        <button
          type="button"
          onClick={() => resetRef.current()}
          disabled={deconnexionEnCours}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#0B2E4F] px-5 text-sm font-bold text-white transition hover:bg-[#0F5E8C] disabled:opacity-60"
        >
          Rester connecté
        </button>
        <button
          type="button"
          onClick={() => router.replace("/login")}
          disabled={deconnexionEnCours}
          className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {deconnexionEnCours ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Se déconnecter maintenant
        </button>
      </div>
    </div>
  );
}
