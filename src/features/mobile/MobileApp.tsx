"use client";

// Coquille de l'app mobile /app. Responsabilités partagées par TOUS les rôles :
// garde d'auth, flux public (Landing/Login/Signup), thème sombre, toast, et la
// colonne « téléphone ». Une fois connecté, elle branche l'expérience selon le
// rôle du compte (`profiles.groupe`) : Admin → AdminApp, sinon → CitizenApp.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { useMobileData } from "./data/useMobileData";
import { useWebNav } from "./data/useWebNav";
import { Toast } from "./components/Toast";
import { LandingScreen } from "./screens/LandingScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { SignupScreen } from "./screens/SignupScreen";
import { CitizenApp, type ExperienceProps } from "./CitizenApp";
import { AdminApp } from "./AdminApp";

const MARKET_URL = "https://monterrain.sgfn.ci";
const THEME_KEY = "sgnf-mobile-theme";

export function MobileApp() {
  const goWeb = useWebNav();
  const data = useMobileData();

  const [toast, setToast] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [unauthView, setUnauthView] = useState<"landing" | "login" | "signup">("landing");

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
  const logout = useCallback(async () => {
    await data.deconnexion();
    setUnauthView("landing");
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
            onConnect={data.connexion}
            onSignup={() => setUnauthView("signup")}
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
  };
  const isAdmin = data.profile?.groupe === "admin";

  return shell(
    <>
      {isAdmin ? <AdminApp {...expProps} /> : <CitizenApp {...expProps} />}
      <Toast message={toast} />
    </>
  );
}
