"use client";

// Coquille de l'app mobile /app. Responsabilités partagées par TOUS les rôles :
// garde d'auth, flux public (Landing/Login/Signup), thème sombre, toast, et la
// colonne « téléphone ». Une fois connecté, elle branche l'expérience selon le
// rôle du compte (`profiles.groupe`) : Admin → AdminApp, sinon → CitizenApp.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { useMobileData } from "./data/useMobileData";
import { useWebNav } from "./data/useWebNav";
import { useBackHandler, useBackConsomme, useSortieApplication, quitterApplication } from "@/lib/android-back";
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
/** Durée du toast — et donc de la fenêtre de confirmation de sortie. */
const TOAST_MS = 2800;

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
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);
  const flash = useCallback((msg: string) => setToast(msg), []);

  // ── Geste de retour Android ────────────────────────────────────────────────
  // Trois niveaux répondent, du plus haut au plus bas : le calque ou l'onglet
  // (CitizenApp/AdminApp), puis les écrans de connexion ci-dessous, puis la
  // sortie. Sur l'écran d'accueil du flux public comme sur l'onglet racine,
  // plus rien ne consomme le retour : on demande alors confirmation. Sortir
  // d'un coup de pouce au milieu d'une inscription serait brutal.
  const sortieArmee = useRef(false);

  useBackHandler(
    useCallback(() => {
      if (!data.authed && (unauthView === "login" || unauthView === "signup")) {
        setUnauthView("landing");
        return true;
      }
      return false;
    }, [data.authed, unauthView]),
  );

  // La fenêtre de confirmation dure exactement le temps du toast qui l'annonce
  // (2800 ms) : désynchronisées, le message pouvait rester affiché ~600 ms après
  // que l'armement avait expiré — l'utilisateur lisait « appuyez à nouveau »
  // alors qu'un nouvel appui ne faisait que réarmer.
  useSortieApplication(
    useCallback(() => {
      if (sortieArmee.current) {
        void quitterApplication();
        return;
      }
      sortieArmee.current = true;
      setToast("Appuyez à nouveau pour quitter");
      setTimeout(() => {
        sortieArmee.current = false;
      }, TOAST_MS);
    }, []),
  );

  // 🔴 L'armement ne doit pas survivre à une navigation. Sans ce désarmement,
  // armer à la racine puis naviguer puis revenir dans les 2,8 s faisait sortir
  // l'application **sans nouvel avertissement** — le geste précédent ayant été
  // consommé par un écran, l'utilisateur n'avait rien vu venir.
  useBackConsomme(
    useCallback(() => {
      sortieArmee.current = false;
    }, []),
  );

  // Navigation partagée (liens sortants + déconnexion).
  const verify = useCallback(() => goWeb("/verifier/"), [goWeb]);
  const openMarket = useCallback(() => {
    if (typeof window !== "undefined") window.open(MARKET_URL, "_blank", "noopener,noreferrer");
  }, []);
  // Plus de passerelle vers /dashboard/profil : le profil s'édite désormais
  // dans l'app (EditProfileScreen), sans quitter la WebView.

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
    flash(ok ? "Connexion biométrique activée" : "Activation annulée ou biométrie indisponible");
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

  // Changement de mot de passe : le coffre natif garde le mot de passe en clair
  // pour rejouer un `signInWithPassword`, il devient donc faux à la seconde du
  // changement. Sans cette remise à jour, c'est `handleBiometricLogin` qui s'en
  // apercevait — au lancement suivant, en supprimant l'entrée : la personne
  // perdait sa connexion biométrique **en différé**, sans avoir jamais su que
  // les deux étaient liées. Le branchement est ici et non dans `useMobileData`
  // parce que l'état de la biométrie appartient à la coquille ; la couche de
  // données n'a pas à connaître le coffre de l'appareil.
  const handleChangePassword = useCallback(
    async (nouveau: string) => {
      const res = await data.changerMotDePasse(nouveau);
      if (!res.ok || !bioEnabled) return res;
      const ok = data.email ? await activerBiometrie(data.email, nouveau) : false;
      if (ok) return res;
      // Réécriture impossible (invite refusée, coffre indisponible, e-mail de
      // session inconnu) : on désarme MAINTENANT et on le dit, plutôt que de
      // laisser un coffre périmé échouer plus tard sans explication. Jamais
      // d'erreur remontée pour autant — le mot de passe, lui, a bien changé
      // côté serveur, et l'annoncer raté pousserait à le changer une seconde
      // fois avec l'ancien qui ne marche déjà plus.
      await desactiverBiometrie();
      setBioEnabled(false);
      return {
        ...res,
        avis: "Mot de passe mis à jour. Réactivez la connexion biométrique depuis votre profil.",
      };
    },
    [data, bioEnabled],
  );

  // Connexion biométrique : invite native → identifiants stockés → même appel
  // que la connexion par mot de passe. Le mot de passe stocké peut encore être
  // caduc s'il a été changé **ailleurs** (dashboard web, réinitialisation par
  // e-mail) : dans ce cas on retire l'entrée plutôt que de la laisser échouer
  // silencieusement à chaque tentative.
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
    biometricEnabled: bioEnabled,
    onDisableBiometric: handleDisableBiometric,
    onChangePassword: handleChangePassword,
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
