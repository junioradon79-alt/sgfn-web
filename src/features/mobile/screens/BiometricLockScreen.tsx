"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";

// Écran affiché à la place de Landing quand le verrouillage par inactivité
// (InactivityLock) a déconnecté un compte pour lequel la biométrie est
// activée : évite de tout retaper, tout en gardant la vraie déconnexion
// (jeton révoqué) décidée dans InactivityLock.

export function BiometricLockScreen({
  onUnlock,
  onSwitchAccount,
}: {
  onUnlock: () => Promise<{ ok: boolean; error?: string }>;
  onSwitchAccount: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tryUnlock = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    const res = await onUnlock();
    // Succès : l'écoute d'auth de MobileApp bascule l'affichage, rien à faire ici.
    if (!res.ok) {
      setError(res.error ?? "Authentification biométrique annulée ou échouée.");
      setLoading(false);
    }
  };

  return (
    <div className="sgnf-scroll absolute inset-0 flex flex-col items-center justify-center gap-6 bg-background px-[26px] text-center">
      <div className="flex size-24 items-center justify-center overflow-hidden rounded-[26px] border border-border bg-card shadow-panel">
        <img src="/logo-embleme.png" alt="SGNF" className="size-[78px] object-contain" />
      </div>
      <div>
        <div className="text-[17px] font-bold text-foreground">Session verrouillée</div>
        <div className="mx-auto mt-1.5 max-w-[260px] text-[13px] leading-relaxed text-muted-2">
          Par sécurité, votre session s&apos;est verrouillée. Déverrouillez par empreinte ou reconnaissance faciale.
        </div>
      </div>

      {error && <p className="max-w-[260px] text-[12.5px] font-medium text-danger">{error}</p>}

      <button
        type="button"
        onClick={tryUnlock}
        disabled={loading}
        className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-panel disabled:opacity-60"
        aria-label="Déverrouiller par biométrie"
      >
        {loading ? (
          <Loader2 className="size-8 animate-spin" />
        ) : (
          <Fingerprint className="size-9" strokeWidth={1.8} />
        )}
      </button>

      <button type="button" onClick={onSwitchAccount} className="text-[13px] font-semibold text-accent">
        Utiliser un autre compte
      </button>
    </div>
  );
}
