"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

// Verrouillage par inactivité, pendant du InactivityLogout du dashboard web —
// sans lui, l'app mobile restait connectée indéfiniment tant que le téléphone
// n'était pas éteint (la session Supabase seule n'expire pas assez tôt). Après
// 10 min sans activité À L'ÉCRAN, on déconnecte réellement (pas un simple
// overlay, qui laisserait le jeton valide) ; avertissement de 30 s avant, pour
// ne pas surprendre en pleine lecture. À monter uniquement dans la branche
// « connecté » de MobileApp (jamais démonté/remonté pour une autre raison que
// la connexion).
//
// Deuxième mécanisme, indépendant : verrouillage au retour d'arrière-plan. Le
// premier ne suffit pas quand on QUITTE l'app (bouton Accueil, changement
// d'appli, écran éteint) — l'OS Android peut suspendre l'exécution JS d'une
// WebView cachée (Doze/App Standby), donc le setTimeout ci-dessous n'est pas
// fiable pendant cette période. On note plutôt l'horodatage de mise en
// arrière-plan dans localStorage (persiste même si l'OS tue le process) et on
// compare à l'horloge murale au retour — visibilitychange, lui, se déclenche
// de façon fiable sur pause/reprise d'Activity, contrairement aux minuteurs.

const IDLE_MS = 10 * 60 * 1000; // 10 min sans toucher l'écran, app visible
const WARN_MS = 30 * 1000; // avertissement 30 s avant
const THROTTLE_MS = 1000; // ne pas réarmer les minuteurs à chaque pixel
const BACKGROUND_LOCK_MS = 3 * 60 * 1000; // 3 min en arrière-plan → verrouillage immédiat au retour
const HIDDEN_AT_KEY = "sgnf-mobile-hidden-at";

export function InactivityLock({ onExpire }: { onExpire: () => void }) {
  const [warning, setWarning] = useState(false);
  const [reste, setReste] = useState(Math.ceil(WARN_MS / 1000));
  const [enCours, setEnCours] = useState(false);
  const resetRef = useRef<() => void>(() => {});

  // `onExpire` (= logout de MobileApp) change d'identité à chaque re-render, car
  // useMobileData renvoie un nouvel objet à chaque appel. On le lit via une ref
  // (tenue à jour dans un effet séparé) pour que le minuteur principal ne
  // dépende que du montage : sinon un re-render sans rapport avec l'activité
  // réelle (ex. un message reçu) réarmerait le minuteur, videant le mécanisme
  // de sa substance.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    let warnTimer: ReturnType<typeof setTimeout> | null = null;
    let logoutTimer: ReturnType<typeof setTimeout> | null = null;
    let countdown: ReturnType<typeof setInterval> | null = null;
    let dernierReset = 0;
    let expire = false;

    const clearAll = () => {
      if (warnTimer) clearTimeout(warnTimer);
      if (logoutTimer) clearTimeout(logoutTimer);
      if (countdown) clearInterval(countdown);
      warnTimer = logoutTimer = null;
      countdown = null;
    };

    const expirer = () => {
      if (expire) return;
      expire = true;
      clearAll();
      setEnCours(true);
      onExpireRef.current();
    };

    const afficherAvertissement = () => {
      setWarning(true);
      setReste(Math.ceil(WARN_MS / 1000));
      countdown = setInterval(() => {
        setReste((r) => (r > 1 ? r - 1 : 0));
      }, 1000);
      logoutTimer = setTimeout(expirer, WARN_MS);
    };

    const reset = () => {
      if (expire) return;
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

    // Lit puis efface le repère d'arrière-plan ; verrouille si l'absence a
    // dépassé le seuil, sinon relance l'idle-timer normalement. Partagé entre
    // le montage (l'app a pu être tuée par l'OS pendant qu'elle était cachée,
    // puis relancée) et le retour au premier plan (visibilitychange).
    const verifierRetourArrierePlan = (): boolean => {
      let hiddenAt: string | null = null;
      try {
        hiddenAt = localStorage.getItem(HIDDEN_AT_KEY);
        localStorage.removeItem(HIDDEN_AT_KEY);
      } catch {
        /* localStorage indisponible */
      }
      if (hiddenAt && Date.now() - Number(hiddenAt) >= BACKGROUND_LOCK_MS) {
        expirer();
        return true;
      }
      return false;
    };

    const onVisibility = () => {
      if (document.hidden) {
        clearAll();
        try {
          localStorage.setItem(HIDDEN_AT_KEY, String(Date.now()));
        } catch {
          /* localStorage indisponible */
        }
      } else if (!verifierRetourArrierePlan()) {
        reset();
      }
    };

    // Capture : attrape aussi le scroll des écrans internes (overflow-y-auto),
    // qui ne remonte pas jusqu'à window en phase de bouillonnement.
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"];
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    events.forEach((e) => window.addEventListener(e, onActivity, opts));
    document.addEventListener("visibilitychange", onVisibility);
    if (!verifierRetourArrierePlan()) reset(); // démarre le compteur

    return () => {
      clearAll();
      events.forEach((e) => window.removeEventListener(e, onActivity, opts));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!warning) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="verrou-mobile-titre"
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-5 backdrop-blur-sm"
    >
      <div className="w-full max-w-[300px] rounded-2xl border border-border bg-card p-5 text-center shadow-float">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-500/10">
          <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <p id="verrou-mobile-titre" className="text-[15px] font-bold text-foreground">
          Session bientôt verrouillée
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-2">
          Par sécurité, sans activité vous serez déconnecté dans{" "}
          <span className="font-bold tabular-nums text-foreground">{reste}&nbsp;s</span>.
        </p>

        <button
          type="button"
          onClick={() => resetRef.current()}
          disabled={enCours}
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-[13px] font-bold text-primary-foreground transition disabled:opacity-60"
        >
          Rester connecté
        </button>
        <button
          type="button"
          onClick={onExpire}
          disabled={enCours}
          className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-5 text-[13px] font-semibold text-muted-2 disabled:opacity-60"
        >
          {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Se déconnecter maintenant
        </button>
      </div>
    </div>
  );
}
