"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Fingerprint, Loader2 } from "lucide-react";
import { BackButton } from "../components/MobileHeader";

export function LoginScreen({
  onBack,
  onConnect,
  onSignup,
  biometricEnabled = false,
  onBiometricLogin,
}: {
  onBack: () => void;
  onConnect: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  onSignup: () => void;
  /** Vrai si une session biométrique est déjà enregistrée sur cet appareil. */
  biometricEnabled?: boolean;
  onBiometricLogin?: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bioLoading, setBioLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    const res = await onConnect(email, password);
    // Succès : l'écoute d'auth bascule l'app sur l'espace connecté (pas de nav ici).
    if (!res.ok) {
      setError(res.error ?? "Connexion impossible. Vérifiez vos identifiants.");
      setLoading(false);
    }
  };

  const tryBiometric = async () => {
    if (bioLoading || !onBiometricLogin) return;
    setBioLoading(true);
    setError(null);
    const res = await onBiometricLogin();
    if (!res.ok) {
      setError(res.error ?? "Authentification biométrique annulée ou échouée.");
      setBioLoading(false);
    }
  };

  return (
    <div className="sgnf-scroll absolute inset-0 flex flex-col overflow-y-auto bg-background px-[26px] pt-4 pb-8">
      <div className="flex-none">
        <BackButton onClick={onBack} variant="neutral" />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-6 py-4">
        <div className="flex flex-col items-center gap-4">
          <div className="flex size-24 items-center justify-center overflow-hidden rounded-[26px] border border-border bg-card shadow-panel">
            <img src="/logo-embleme.png" alt="SGNF" className="size-[78px] object-contain" />
          </div>
          <div className="text-center">
            <div className="text-[30px] font-extrabold tracking-[0.16em] text-primary">SGNF</div>
            <div className="mx-auto mt-1 max-w-[230px] text-[11px] font-semibold tracking-wide text-muted-foreground">
              Système de Gestion Numérique du Foncier
            </div>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="flex flex-col gap-3.5 rounded-[22px] border border-border bg-card p-5 shadow-panel"
        >
          <div className="text-[13px] font-bold text-foreground">Se connecter</div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-muted-foreground">Adresse e-mail</span>
            <input
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@organisation.ci"
              required
              className="rounded-lg border border-border-strong bg-inset px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-muted-foreground">Mot de passe</span>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
                required
                className="w-full rounded-lg border border-border-strong bg-inset px-3 py-2.5 pr-11 text-[14px] text-foreground outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Masquer" : "Afficher"}
                className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-inset"
              >
                {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            </div>
          </label>

          {error && <p className="text-[12.5px] font-medium text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[15px] font-semibold text-primary-foreground shadow-panel disabled:opacity-60"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Se connecter
          </button>

          {biometricEnabled && onBiometricLogin && (
            <button
              type="button"
              onClick={tryBiometric}
              disabled={bioLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-inset px-4 py-3 text-[14px] font-semibold text-foreground disabled:opacity-60"
            >
              {bioLoading ? (
                <Loader2 className="size-[18px] animate-spin" />
              ) : (
                <Fingerprint className="size-[18px]" />
              )}
              Se connecter par biométrie
            </button>
          )}
        </form>

        <button type="button" onClick={onSignup} className="text-center text-[13px] font-semibold text-accent">
          Pas encore de compte ? Créer un compte
        </button>
      </div>

      <div className="flex-none pt-2 text-center text-[10.5px] text-muted-2">
        « La confiance se prouve, elle ne s&apos;affirme pas »
      </div>
    </div>
  );
}
