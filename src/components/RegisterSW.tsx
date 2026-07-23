"use client";

import { useEffect } from "react";
import { isCapacitorNative } from "@/lib/capacitor";

export function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // ── Dans l'APK Capacitor : PAS de service worker ────────────────────────
    // Capacitor sert l'app (https://localhost) par interception native des
    // requêtes de la WebView. Le `fetch()` d'un service worker CONTOURNE cette
    // interception et tente un vrai accès réseau à `localhost` → échec → les
    // assets (_next/*.js) ne se chargent plus → écran blanc. On n'enregistre
    // donc aucun SW en natif, et on désenregistre celui qu'un ancien build
    // aurait pu laisser (sinon il continue de contrôler la page au relancement).
    if (isCapacitorNative()) {
      navigator.serviceWorker.getRegistrations?.().then((regs) =>
        regs.forEach((r) => r.unregister())
      ).catch(() => {});
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              // Nouvelle version disponible — recharger silencieusement
              sw.postMessage({ type: "SKIP_WAITING" });
              window.location.reload();
            }
          });
        });
      })
      .catch(() => {});
  }, []);

  return null;
}
