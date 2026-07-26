"use client";

// Expérience Admin (Centre National de Pilotage). Même mécanique d'onglets que
// CitizenApp, mais alimentée par `useAdminOverview` (cockpit national) + le socle
// partagé (messages/notifs/profil). Sous-ensemble mobile ciblé : la file des
// saisies se traite désormais dans l'app ; les trois autres files ouvrent
// encore la page web du dashboard.

import { useCallback, useState } from "react";
import { Gauge, ClipboardList, ScanLine, MessageSquare, User } from "lucide-react";

import { useAdminOverview } from "@/hooks/useAdminOverview";
import { useBackHandler } from "@/lib/android-back";
import { lireNotifsLues, marquerNotifsLues } from "@/lib/notifs-lues";
import { TabBar, type TabItem } from "./components/TabBar";
import { useWebNav } from "./data/useWebNav";
import { MessagesScreen } from "./screens/MessagesScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { NewChatScreen } from "./screens/NewChatScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { EditProfileScreen } from "./screens/EditProfileScreen";
import { PilotageScreen } from "./screens/admin/PilotageScreen";
import { FilesScreen } from "./screens/admin/FilesScreen";
import { PerimetresScreen } from "./screens/admin/PerimetresScreen";
import { SoumissionsScreen } from "./screens/admin/SoumissionsScreen";
import type { ExperienceProps } from "./CitizenApp";

type Tab = "pilotage" | "files" | "messages" | "profile";
type Overlay =
  | { kind: "chat"; convId: string }
  | { kind: "newchat" }
  // L'état de lecture est figé ici, à l'ouverture : voir `openNotifications`.
  | { kind: "notifications"; dejaLues: Set<string> }
  | { kind: "perimetres" }
  | { kind: "editprofile" }
  | { kind: "soumissions" }
  | null;

export function AdminApp({
  data,
  dark,
  toggleDark,
  flash,
  verify,
  logout,
  biometricEnabled,
  onDisableBiometric,
}: ExperienceProps) {
  const openWeb = useWebNav();
  const overview = useAdminOverview(true);
  const [tab, setTab] = useState<Tab>("pilotage");
  const [overlay, setOverlay] = useState<Overlay>(null);
  // Même mécanique que l'expérience citoyen : l'état de lecture des
  // notifications vit sur l'appareil (cf. `@/lib/notifs-lues`).
  const [notifsLues, setNotifsLues] = useState<Set<string>>(() => lireNotifsLues(data.userId));

  const goTab = useCallback((t: string) => {
    setOverlay(null);
    setTab(t as Tab);
  }, []);
  const back = useCallback(() => setOverlay(null), []);

  // Geste de retour Android — même règle que l'expérience citoyen, à ceci près
  // que l'écran racine est ici le Pilotage.
  useBackHandler(
    useCallback(() => {
      if (overlay) {
        setOverlay(null);
        return true;
      }
      if (tab !== "pilotage") {
        setTab("pilotage");
        return true;
      }
      return false;
    }, [overlay, tab]),
  );
  // Ouvrir vaut lecture ; l'état est figé dans le calque avant d'être mis à
  // jour, sinon la distinction non-lu disparaîtrait à l'ouverture même.
  const openNotifications = useCallback(() => {
    setOverlay({ kind: "notifications", dejaLues: notifsLues });
    setNotifsLues(marquerNotifsLues(data.userId, data.notifs.map((n) => n.id)));
  }, [notifsLues, data.userId, data.notifs]);
  const openPerimetres = useCallback(() => setOverlay({ kind: "perimetres" }), []);
  const openSoumissions = useCallback(() => setOverlay({ kind: "soumissions" }), []);
  const openEditProfile = useCallback(() => setOverlay({ kind: "editprofile" }), []);
  const openNewChat = useCallback(() => setOverlay({ kind: "newchat" }), []);
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
  // « Nouvelle » = jamais ouverte, et non « datée de moins de 48 h » :
  // l'ancienne heuristique rallumait la pastille sur du déjà-lu.
  const unreadNotif = data.notifs.some((n) => !notifsLues.has(n.id));
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
        {overlay?.kind === "notifications" && (
          <NotificationsScreen notifs={data.notifs} lues={overlay.dejaLues} onBack={back} />
        )}
        {overlay?.kind === "perimetres" && <PerimetresScreen overview={overview} onBack={back} />}
        {/* `overview.refresh` est stable : c'est lui qui remet à jour le
            compteur « À faire » de la barre d'onglets après une décision. */}
        {overlay?.kind === "soumissions" && (
          <SoumissionsScreen onBack={back} onTraite={overview.refresh} />
        )}
        {overlay?.kind === "editprofile" && (
          <EditProfileScreen
            profile={data.profile}
            email={data.email}
            onBack={back}
            onSave={data.majProfil}
            onChangePassword={data.changerMotDePasse}
            flash={flash}
          />
        )}

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
        {!overlay && tab === "files" && (
          <FilesScreen overview={overview} openWeb={openWeb} onOpenSoumissions={openSoumissions} />
        )}
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
            onEditProfile={openEditProfile}
            biometricEnabled={biometricEnabled}
            onDisableBiometric={onDisableBiometric}
          />
        )}
      </div>

      {!overlay && <TabBar items={items} active={tab} onNavigate={goTab} />}
    </>
  );
}
