"use client";

// Expérience citoyen (propriétaire / acquéreur) : onglets + écrans superposés.
// Extraite de MobileApp lors du passage à une coquille adaptative par rôle.

import { useCallback, useState } from "react";
import { Home, Boxes, ScanLine, MessageSquare, User } from "lucide-react";
import { useBackHandler } from "@/lib/android-back";
import { TabBar, type TabItem } from "./components/TabBar";
import { HomeScreen } from "./screens/HomeScreen";
import { ParcelsScreen } from "./screens/ParcelsScreen";
import { ParcelDetailScreen } from "./screens/ParcelDetailScreen";
import { MessagesScreen } from "./screens/MessagesScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { NewChatScreen } from "./screens/NewChatScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { PurchaseScreen } from "./screens/PurchaseScreen";
import type { MobileData } from "./data/useMobileData";

type Tab = "home" | "parcels" | "messages" | "profile";
type Overlay =
  | { kind: "detail"; lotId: string }
  | { kind: "purchase"; lotId: string }
  | { kind: "chat"; convId: string }
  | { kind: "newchat" }
  | { kind: "notifications" }
  | null;

export type ExperienceProps = {
  data: MobileData;
  dark: boolean;
  toggleDark: () => void;
  flash: (msg: string) => void;
  verify: () => void;
  openMarket: () => void;
  logout: () => void;
  openProfilComplet: () => void;
  biometricEnabled: boolean;
  onDisableBiometric: () => void;
};

export function CitizenApp({
  data,
  dark,
  toggleDark,
  flash,
  verify,
  openMarket,
  logout,
  openProfilComplet,
  biometricEnabled,
  onDisableBiometric,
}: ExperienceProps) {
  const [tab, setTab] = useState<Tab>("home");
  const [overlay, setOverlay] = useState<Overlay>(null);

  const goTab = useCallback((t: string) => {
    setOverlay(null);
    setTab(t as Tab);
  }, []);
  const back = useCallback(() => setOverlay(null), []);

  // Geste de retour Android : d'abord fermer le calque, puis revenir à
  // l'accueil. Ce n'est qu'au-delà que la coquille propose de quitter.
  useBackHandler(
    useCallback(() => {
      if (overlay) {
        setOverlay(null);
        return true;
      }
      if (tab !== "home") {
        setTab("home");
        return true;
      }
      return false;
    }, [overlay, tab]),
  );
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
  const openNewChat = useCallback(() => setOverlay({ kind: "newchat" }), []);
  // « Contacter » depuis le détail d'une parcelle : autant ouvrir directement la
  // rédaction — c'est ce que la personne veut faire, pas consulter une liste.
  const contact = useCallback(() => setOverlay({ kind: "newchat" }), []);

  const unread = data.convos.reduce(
    (n, c) => n + (c.messages || []).filter((m) => !m.lu && m.expediteur !== data.userId).length,
    0
  );
  const unreadNotif = data.notifs.some((n) => Date.now() - new Date(n.cree_le).getTime() < 48 * 3600 * 1000);

  const conv = overlay?.kind === "chat" ? data.convos.find((c) => c.id === overlay.convId) ?? null : null;
  const purchaseParcelle =
    overlay?.kind === "purchase" ? data.parcelles.find((p) => p.lotId === overlay.lotId) ?? null : null;

  const items: TabItem[] = [
    { key: "home", label: "Accueil", icon: Home },
    { key: "parcels", label: "Parcelles", icon: Boxes },
    { key: "verify", label: "Vérifier", icon: ScanLine, fab: true, onPress: verify },
    { key: "messages", label: "Messages", icon: MessageSquare, badge: unread },
    { key: "profile", label: "Profil", icon: User },
  ];

  return (
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
        {overlay?.kind === "newchat" && (
          <NewChatScreen
            moiId={data.userId}
            onBack={back}
            onCreer={data.creerConversation}
            onCree={(convId) => {
              setTab("messages");
              setOverlay({ kind: "chat", convId });
              flash("Message envoyé");
            }}
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
        {!overlay && tab === "parcels" && <ParcelsScreen parcelles={data.parcelles} onOpenParcel={openDetail} />}
        {!overlay && tab === "messages" && (
          <MessagesScreen
            convos={data.convos}
            userId={data.userId}
            onOpenChat={openChat}
            onNewChat={openNewChat}
          />
        )}
        {!overlay && tab === "profile" && (
          <ProfileScreen
            profile={data.profile}
            email={data.email}
            dark={dark}
            onToggleDark={toggleDark}
            onLogout={logout}
            onOpenProfilComplet={openProfilComplet}
            biometricEnabled={biometricEnabled}
            onDisableBiometric={onDisableBiometric}
          />
        )}
      </div>

      {!overlay && <TabBar items={items} active={tab} onNavigate={goTab} />}
    </>
  );
}
