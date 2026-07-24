"use client";

// Coquille de l'app mobile /app. Responsabilités partagées par TOUS les rôles :
// garde d'auth, flux public (Landing/Login/Signup), thème sombre, toast, et la
// colonne « téléphone ». Une fois connecté, elle branche l'expérience selon le
// rôle du compte (`profiles.groupe`) : Admin → AdminApp, sinon → CitizenApp.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { useMobileData } from "./data/useMobileData";
import { useWebNav } from "./data/useWebNav";
import {
  activerBiometrie,
  biometrieActive,
  biometrieDisponible,
  connexionBiometrique,
  desactiverBiometrie,
} from "@/lib/biometric";
import { Toast } from "./components/Toast";
import { InactivityLock } from "./components/InactivityLock";
import { EnableBiometricPrompt } from "./components/EnableBiometricPrompt";
import { LandingScreen } from "./screens/LandingScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { SignupScreen } from "./screens/SignupScreen";
import { BiometricLockScreen } from "./screens/BiometricLockScreen";
import { CitizenApp, type ExperienceProps } from "./CitizenApp";
import { AdminApp } from "./AdminApp";

const MARKET_URL = "https://monterrain.sgfn.ci";
const THEME_KEY = "sgnf-mobile-theme";

export function MobileApp() {
  const goWeb = useWebNav();
  const data = useMobileData();

  const [toast, setToast] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [unauthView, setUnauthView] = useState<"landing" | "login" | "signup" | "locked">("landing");

  // Biométrie : disponibilité matérielle + identifiants déjà enregistrés sur
  // cet appareil (source de vérité = le coffre natif, pas un simple drapeau
  // local). `pendingCreds` porte le mot de passe le temps d'afficher la
  // proposition d'activation post-connexion — jamais persisté tel quel.
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [showEnablePrompt, setShowEnablePrompt] = useState(false);
  const pendingCreds = useRef<{ email: string; password: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [avail, active] = await Promise.all([biometrieDisponible(), biometrieActive()]);
      if (!cancelled) {
        setBioAvailable(avail);
        setBioEnabled(active);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Thème : lu au montage, persisté à chaque bascule.
  useEffect(() => {
    try {
      if (localStorage.getItem(THEME_KEY) === "dark") setDark(true);
    } catch {
      /* localStorage indisponible */
    }
  }, []);
  const toggleDark = useCallback(() => {
    setDark((d) => {
      const n = !d;
      try {
        localStorage.setItem(THEME_KEY, n ? "dark" : "light");
      } catch {
        /* ignore */
      }
      return n;
    });
  }, []);

  // Toast auto-disparaissant.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);
  const flash = useCallback((msg: string) => setToast(msg), []);

  // Navigation partagée (liens sortants + déconnexion).
  const verify = useCallback(() => goWeb("/verifier/"), [goWeb]);
  const openMarket = useCallback(() => {
    if (typeof window !== "undefined") window.open(MARKET_URL, "_blank", "noopener,noreferrer");
  }, []);
  const openProfilComplet = useCallback(() => goWeb("/dashboard/profil/"), [goWeb]);

  // Déconnexion manuelle (bouton Profil) : toujours vers Landing.
  const logout = useCallback(async () => {
    await data.deconnexion();
    setUnauthView("landing");
  }, [data]);

  // Déconnexion par inactivité (InactivityLock) : le jeton est réellement
  // révoqué (cf. InactivityLock), mais si la biométrie est activée on propose
  // un déverrouillage rapide plutôt que de tout retaper.
  const lockForInactivity = useCallback(async () => {
    await data.deconnexion();
    setUnauthView(bioEnabled ? "locked" : "landing");
  }, [data, bioEnabled]);

  // Connexion par mot de passe : si l'appareil supporte la biométrie et
  // qu'elle n'est pas encore activée, propose de l'activer juste après.
  const handlePasswordLogin = useCallback(
    async (mail: string, password: string) => {
      const res = await data.connexion(mail, password);
      if (res.ok && bioAvailable && !bioEnabled) {
        pendingCreds.current = { email: mail, password };
        setShowEnablePrompt(true);
      }
      return res;
    },
    [data, bioAvailable, bioEnabled]
  );

  const handleEnableBiometric = useCallback(async () => {
    const creds = pendingCreds.current;
    pendingCreds.current = null;
    setShowEnablePrompt(false);
    if (!creds) return;
    const ok = await activerBiometrie(creds.email, creds.password);
    setBioEnabled(ok);
    flash(ok ? "Connexion biométrique activée" : "Biométrie indisponible sur cet appareil");
  }, [flash]);

  const dismissEnablePrompt = useCallback(() => {
    pendingCreds.current = null;
    setShowEnablePrompt(false);
  }, []);

  const handleDisableBiometric = useCallback(async () => {
    await desactiverBiometrie();
    setBioEnabled(false);
    flash("Connexion biométrique désactivée");
  }, [flash]);

  // Connexion biométrique : invite native → identifiants stockés → même appel
  // que la connexion par mot de passe. Si le mot de passe stocké a été rendu
  // caduc (changé depuis le web), on retire l'entrée biométrique plutôt que
  // de la laisser échouer silencieusement à chaque tentative.
  const handleBiometricLogin = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const creds = await connexionBiometrique();
    if (!creds) return { ok: false, error: "Authentification biométrique annulée ou échouée." };
    const res = await data.connexion(creds.email, creds.password);
    if (!res.ok) {
      await desactiverBiometrie();
      setBioEnabled(false);
    }
    return res;
  }, [data]);

  const shell = (children: ReactNode) => (
    <div className={dark ? "dark" : undefined}>
      <div className="flex min-h-[100dvh] justify-center bg-slate-100 dark:bg-black">
        <div className="relative flex h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden bg-background text-foreground shadow-xl">
          {children}
        </div>
      </div>
    </div>
  );

  if (data.loading) {
    return shell(
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-2">
        <Loader2 className="size-7 animate-spin text-primary" />
        <span className="text-[13px] font-medium">Chargement de votre espace…</span>
      </div>
    );
  }

  if (!data.authed) {
    return shell(
      <div className="relative flex-1 overflow-hidden">
        {unauthView === "landing" && (
          <LandingScreen
            onLogin={() => setUnauthView("login")}
            onSignup={() => setUnauthView("signup")}
            onMarket={openMarket}
          />
        )}
        {unauthView === "login" && (
          <LoginScreen
            onBack={() => setUnauthView("landing")}
            onConnect={handlePasswordLogin}
            onSignup={() => setUnauthView("signup")}
            biometricEnabled={bioEnabled}
            onBiometricLogin={handleBiometricLogin}
          />
        )}
        {unauthView === "signup" && (
          <SignupScreen
            onBack={() => setUnauthView("landing")}
            onValiderCode={data.validerCode}
            onInscrire={data.inscrire}
            onLogin={() => setUnauthView("login")}
          />
        )}
        {unauthView === "locked" && (
          <BiometricLockScreen onUnlock={handleBiometricLogin} onSwitchAccount={() => setUnauthView("landing")} />
        )}
      </div>
    );
  }

  // Connecté : on branche l'expérience selon le rôle.
  const expProps: ExperienceProps = {
    data,
    dark,
    toggleDark,
    flash,
    verify,
    openMarket,
    logout,
    openProfilComplet,
    biometricEnabled: bioEnabled,
    onDisableBiometric: handleDisableBiometric,
  };
  const isAdmin = data.profile?.groupe === "admin";

  return shell(
    <>
      {isAdmin ? <AdminApp {...expProps} /> : <CitizenApp {...expProps} />}
      <Toast message={toast} />
      <InactivityLock onExpire={lockForInactivity} />
      {showEnablePrompt && <EnableBiometricPrompt onEnable={handleEnableBiometric} onDismiss={dismissEnablePrompt} />}
    </>
  );
}
