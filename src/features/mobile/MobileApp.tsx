"use client";

// App mobile citoyen (/app). Machine à états reprenant la logique du prototype
// « SGNF App.dc.html » (onglet courant + écran superposé + toast + thème), mais
// alimentée par les données Supabase réelles du compte connecté.
// Login / Vérifier / TerraCI Market sont des liens sortants (choix produit).

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useMobileData } from "./data/useMobileData";
import { TabBar } from "./components/TabBar";
import { Toast } from "./components/Toast";
import { HomeScreen } from "./screens/HomeScreen";
import { ParcelsScreen } from "./screens/ParcelsScreen";
import { ParcelDetailScreen } from "./screens/ParcelDetailScreen";
import { MessagesScreen } from "./screens/MessagesScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { PurchaseScreen } from "./screens/PurchaseScreen";
import { LandingScreen } from "./screens/LandingScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { SignupScreen } from "./screens/SignupScreen";

export type Tab = "home" | "parcels" | "messages" | "profile";

type Overlay =
  | { kind: "detail"; lotId: string }
  | { kind: "purchase"; lotId: string }
  | { kind: "chat"; convId: string }
  | { kind: "notifications" }
  | null;

const MARKET_URL = "https://monterrain.sgfn.ci";
const THEME_KEY = "sgnf-mobile-theme";

export function MobileApp() {
  const router = useRouter();
  const data = useMobileData();

  const [tab, setTab] = useState<Tab>("home");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  // Écran affiché tant qu'on n'est pas connecté (Login/Vérifier/Market restaient
  // des liens sortants ; ici Landing/Login/Signup sont natifs à l'app).
  const [unauthView, setUnauthView] = useState<"landing" | "login" | "signup">("landing");

  // Thème : lu au montage, persisté à chaque bascule (portée : l'app mobile).
  useEffect(() => {
    try {
      if (localStorage.getItem(THEME_KEY) === "dark") setDark(true);
    } catch {
      /* localStorage indisponible : on reste en clair */
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

  // ── Navigation ───────────────────────────────────────────────────────────────
  const goTab = useCallback((t: Tab) => {
    setOverlay(null);
    setTab(t);
  }, []);
  const back = useCallback(() => setOverlay(null), []);
  const openDetail = useCallback((lotId: string) => setOverlay({ kind: "detail", lotId }), []);
  const openPurchase = useCallback((lotId: string) => setOverlay({ kind: "purchase", lotId }), []);
  const openNotifications = useCallback(() => setOverlay({ kind: "notifications" }), []);
  const openChat = useCallback(
    (convId: string) => {
      const conv = data.convos.find((c) => c.id === convId);
      if (conv) void data.marquerLu(conv);
      setOverlay({ kind: "chat", convId });
    },
    [data]
  );
  const verify = useCallback(() => router.push("/verifier/"), [router]);
  const openMarket = useCallback(() => {
    if (typeof window !== "undefined") window.open(MARKET_URL, "_blank", "noopener,noreferrer");
  }, []);
  const contact = useCallback(() => {
    setOverlay(null);
    setTab("messages");
    flash("Retrouvez vos échanges avec les agents ici");
  }, [flash]);
  const logout = useCallback(async () => {
    await data.deconnexion();
    setUnauthView("landing");
    // L'écoute d'auth (SIGNED_OUT) repasse l'app en mode déconnecté.
  }, [data]);
  const openProfilComplet = useCallback(() => router.push("/dashboard/profil/"), [router]);

  // ── Dérivés ──────────────────────────────────────────────────────────────────
  const unread = data.convos.reduce(
    (n, c) => n + (c.messages || []).filter((m) => !m.lu && m.expediteur !== data.userId).length,
    0
  );
  // Pas de « lu » sur la table notifications (statut = état d'envoi) : on signale
  // une activité récente (< 48 h) plutôt qu'un compteur de non-lus fictif.
  const unreadNotif = data.notifs.some((n) => Date.now() - new Date(n.cree_le).getTime() < 48 * 3600 * 1000);

  const conv = overlay?.kind === "chat" ? data.convos.find((c) => c.id === overlay.convId) ?? null : null;
  const purchaseParcelle =
    overlay?.kind === "purchase" ? data.parcelles.find((p) => p.lotId === overlay.lotId) ?? null : null;

  // ── Rendu ────────────────────────────────────────────────────────────────────
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

  return shell(
    <>
      <div className="relative flex-1 overflow-hidden">
        {overlay?.kind === "detail" && (
          <ParcelDetailScreen
            lotId={overlay.lotId}
            onBack={back}
            onVerify={verify}
            onContact={contact}
            onPurchase={openPurchase}
          />
        )}
        {overlay?.kind === "purchase" && (
          <PurchaseScreen parcelle={purchaseParcelle} onBack={back} onConfirm={data.suivreParcelle} />
        )}
        {overlay?.kind === "chat" && conv && (
          <ChatScreen
            conv={conv}
            userId={data.userId}
            onBack={back}
            onSend={(corps) => data.envoyerMessage(conv.id, corps)}
          />
        )}
        {overlay?.kind === "notifications" && <NotificationsScreen notifs={data.notifs} onBack={back} />}

        {!overlay && tab === "home" && (
          <HomeScreen
            profile={data.profile}
            parcelles={data.parcelles}
            notifs={data.notifs}
            unreadNotif={unreadNotif}
            onOpenParcel={openDetail}
            onOpenNotifications={openNotifications}
            onVerify={verify}
            onGoParcels={() => goTab("parcels")}
            onOpenMarket={openMarket}
          />
        )}
        {!overlay && tab === "parcels" && (
          <ParcelsScreen parcelles={data.parcelles} onOpenParcel={openDetail} />
        )}
        {!overlay && tab === "messages" && (
          <MessagesScreen convos={data.convos} userId={data.userId} onOpenChat={openChat} />
        )}
        {!overlay && tab === "profile" && (
          <ProfileScreen
            profile={data.profile}
            email={data.email}
            dark={dark}
            onToggleDark={toggleDark}
            onLogout={logout}
            onOpenProfilComplet={openProfilComplet}
          />
        )}
      </div>

      {!overlay && <TabBar active={tab} onNavigate={goTab} onVerify={verify} unread={unread} />}
      <Toast message={toast} />
    </>
  );
}
