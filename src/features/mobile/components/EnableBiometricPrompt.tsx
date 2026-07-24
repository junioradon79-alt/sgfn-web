"use client";

import { Fingerprint } from "lucide-react";

// Proposée une fois, juste après une connexion réussie par mot de passe, si
// l'appareil supporte la biométrie et qu'elle n'est pas déjà activée.

export function EnableBiometricPrompt({
  onEnable,
  onDismiss,
}: {
  onEnable: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="biometrie-titre"
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-5 backdrop-blur-sm"
    >
      <div className="w-full max-w-[300px] rounded-2xl border border-border bg-card p-5 text-center shadow-float">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
          <Fingerprint className="h-5 w-5 text-primary" />
        </div>
        <p id="biometrie-titre" className="text-[15px] font-bold text-foreground">
          Activer la connexion biométrique ?
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-2">
          La prochaine fois, déverrouillez votre espace SGNF par empreinte ou reconnaissance faciale, sans retaper
          votre mot de passe.
        </p>

        <button
          type="button"
          onClick={onEnable}
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-[13px] font-bold text-primary-foreground transition"
        >
          Activer
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl border border-border px-5 text-[13px] font-semibold text-muted-2"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
