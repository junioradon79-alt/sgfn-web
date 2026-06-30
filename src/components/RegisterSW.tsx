"use client";

import { useEffect } from "react";

export function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
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
