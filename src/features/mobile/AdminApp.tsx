"use client";

// Expérience Admin (Centre National de Pilotage). Même mécanique d'onglets que
// CitizenApp, mais alimentée par `useAdminOverview` (cockpit national) + le socle
// partagé (messages/notifs/profil). Sous-ensemble mobile ciblé : les actions
// lourdes ouvrent la page web du dashboard.

import { useCallback, useState } from "react";
import { Gauge, ClipboardList, ScanLine, MessageSquare, User } from "lucide-react";

import { useAdminOverview } from "@/hooks/useAdminOverview";
import { TabBar, type TabItem } from "./components/TabBar";
import { useWebNav } from "./data/useWebNav";
import { MessagesScreen } from "./screens/MessagesScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { PilotageScreen } from "./screens/admin/PilotageScreen";
import { FilesScreen } from "./screens/admin/FilesScreen";
import { PerimetresScreen } from "./screens/admin/PerimetresScreen";
import type { ExperienceProps } from "./CitizenApp";

type Tab = "pilotage" | "files" | "messages" | "profile";
type Overlay = { kind: "chat"; convId: string } | { kind: "notifications" } | { kind: "perimetres" } | null;

export function AdminApp({
  data,
  dark,
  toggleDark,
  verify,
  logout,
  openProfilComplet,
  biometricEnabled,
  onDisableBiometric,
}: ExperienceProps) {
  const openWeb = useWebNav();
  const overview = useAdminOverview(true);
  const [tab, setTab] = useState<Tab>("pilotage");
  const [overlay, setOverlay] = useState<Overlay>(null);

  const goTab = useCallback((t: string) => {
    setOverlay(null);
    setTab(t as Tab);
  }, []);
  const back = useCallback(() => setOverlay(null), []);
  const openNotifications = useCallback(() => setOverlay({ kind: "notifications" }), []);
  const openPerimetres = useCallback(() => setOverlay({ kind: "perimetres" }), []);
  const openChat = useCallback(
    (convId: string) => {
      const c = data.convos.find((x) => x.id === convId);
      if (c) void data.marquerLu(c);
      setOverlay({ kind: "chat", convId });
    },
    [data]
  );

  const unread = data.convos.reduce(
    (n, c) => n + (c.messages || []).filter((m) => !m.lu && m.expediteur !== data.userId).length,
    0
  );
  const unreadNotif = data.notifs.some((n) => Date.now() - new Date(n.cree_le).getTime() < 48 * 3600 * 1000);
  const aFaire =
    overview.files.saisieAValider +
    overview.files.demandesATraiter +
    overview.files.litigesOuverts +
    overview.files.dossiersAduEnCours;

  const conv = overlay?.kind === "chat" ? data.convos.find((c) => c.id === overlay.convId) ?? null : null;

  const items: TabItem[] = [
    { key: "pilotage", label: "Pilotage", icon: Gauge },
    { key: "files", label: "À faire", icon: ClipboardList, badge: aFaire },
    { key: "verify", label: "Vérifier", icon: ScanLine, fab: true, onPress: verify },
    { key: "messages", label: "Messages", icon: MessageSquare, badge: unread },
    { key: "profile", label: "Profil", icon: User },
  ];

  return (
    <>
      <div className="relative flex-1 overflow-hidden">
        {overlay?.kind === "chat" && conv && (
          <ChatScreen
            conv={conv}
            userId={data.userId}
            onBack={back}
            onSend={(corps) => data.envoyerMessage(conv.id, corps)}
          />
        )}
        {overlay?.kind === "notifications" && <NotificationsScreen notifs={data.notifs} onBack={back} />}
        {overlay?.kind === "perimetres" && <PerimetresScreen overview={overview} onBack={back} />}

        {!overlay && tab === "pilotage" && (
          <PilotageScreen
            overview={overview}
            profile={data.profile}
            unreadNotif={unreadNotif}
            onOpenNotifications={openNotifications}
            onOpenFiles={() => goTab("files")}
            onOpenPerimetres={openPerimetres}
          />
        )}
        {!overlay && tab === "files" && <FilesScreen overview={overview} openWeb={openWeb} />}
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
            biometricEnabled={biometricEnabled}
            onDisableBiometric={onDisableBiometric}
          />
        )}
      </div>

      {!overlay && <TabBar items={items} active={tab} onNavigate={goTab} />}
    </>
  );
}
