"use client";

// Expérience citoyen (propriétaire / acquéreur) : onglets + écrans superposés.
// Extraite de MobileApp lors du passage à une coquille adaptative par rôle.

import { useCallback, useState } from "react";
import { Home, Boxes, ScanLine, MessageSquare, User } from "lucide-react";
import { useBackHandler } from "@/lib/android-back";
import { lireNotifsLues, marquerNotifsLues } from "@/lib/notifs-lues";
import { TabBar, type TabItem } from "./components/TabBar";
import { HomeScreen } from "./screens/HomeScreen";
import { ParcelsScreen } from "./screens/ParcelsScreen";
import { ParcelDetailScreen } from "./screens/ParcelDetailScreen";
import { MessagesScreen } from "./screens/MessagesScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { NewChatScreen } from "./screens/NewChatScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { EditProfileScreen } from "./screens/EditProfileScreen";
import { PurchaseScreen } from "./screens/PurchaseScreen";
import { ReportIssueScreen } from "./screens/ReportIssueScreen";
import type { MobileData } from "./data/useMobileData";

type Tab = "home" | "parcels" | "messages" | "profile";
type Overlay =
  | { kind: "detail"; lotId: string }
  | { kind: "purchase"; lotId: string }
  | { kind: "report"; lotId: string }
  | { kind: "chat"; convId: string }
  | { kind: "newchat" }
  // L'état de lecture est figé ici, à l'ouverture : voir `openNotifications`.
  | { kind: "notifications"; dejaLues: Set<string> }
  | { kind: "editprofile" }
  | null;

export type ExperienceProps = {
  data: MobileData;
  dark: boolean;
  toggleDark: () => void;
  flash: (msg: string) => void;
  verify: () => void;
  openMarket: () => void;
  logout: () => void;
  biometricEnabled: boolean;
  onDisableBiometric: () => void;
  /**
   * Passe par la coquille et non par `data.changerMotDePasse` : elle seule
   * connaît l'état de la biométrie, dont le coffre doit être réécrit dans la
   * foulée (cf. `MobileApp.handleChangePassword`).
   */
  onChangePassword: (nouveau: string) => Promise<{ ok: boolean; error?: string; avis?: string }>;
};

export function CitizenApp({
  data,
  dark,
  toggleDark,
  flash,
  verify,
  openMarket,
  logout,
  biometricEnabled,
  onDisableBiometric,
  onChangePassword,
}: ExperienceProps) {
  const [tab, setTab] = useState<Tab>("home");
  const [overlay, setOverlay] = useState<Overlay>(null);
  // État de lecture des notifications : local à l'appareil (la table
  // `notifications` est en lecture seule, cf. `@/lib/notifs-lues`). Lu une
  // seule fois au montage — l'expérience n'est montée qu'une fois la session
  // établie, `data.userId` est donc déjà connu.
  const [notifsLues, setNotifsLues] = useState<Set<string>>(() => lireNotifsLues(data.userId));

  const goTab = useCallback((t: string) => {
    setOverlay(null);
    setTab(t as Tab);
  }, []);
  const back = useCallback(() => setOverlay(null), []);
  // Retour du signalement : on revient au détail de la parcelle dont il est
  // issu, jamais à la liste. Le lot est relu depuis le calque courant pour que
  // le rappel reste stable d'un rendu à l'autre.
  const backToDetail = useCallback(
    () => setOverlay((o) => (o?.kind === "report" ? { kind: "detail", lotId: o.lotId } : null)),
    [],
  );

  // Geste de retour Android : d'abord fermer le calque, puis revenir à
  // l'accueil. Ce n'est qu'au-delà que la coquille propose de quitter.
  useBackHandler(
    useCallback(() => {
      if (overlay) {
        // Le signalement s'ouvre *depuis* le détail d'une parcelle : le
        // refermer doit y ramener, sinon le geste de retour renverrait à la
        // liste et l'on perdrait la parcelle qu'on était en train de consulter.
        setOverlay(overlay.kind === "report" ? { kind: "detail", lotId: overlay.lotId } : null);
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
  const openReport = useCallback((lotId: string) => setOverlay({ kind: "report", lotId }), []);
  const openEditProfile = useCallback(() => setOverlay({ kind: "editprofile" }), []);

  // Ouvrir l'écran vaut lecture. L'état de lecture est **figé** dans le calque
  // avant d'être mis à jour : marquer et afficher depuis la même source ferait
  // disparaître la distinction non-lu à la seconde où l'on entre.
  const openNotifications = useCallback(() => {
    setOverlay({ kind: "notifications", dejaLues: notifsLues });
    setNotifsLues(marquerNotifsLues(data.userId, data.notifs.map((n) => n.id)));
  }, [notifsLues, data.userId, data.notifs]);
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
  // Une notification est « nouvelle » tant qu'elle n'a pas été ouverte, et non
  // parce qu'elle date de moins de 48 h : l'ancienne heuristique rallumait la
  // pastille sur des messages déjà lus et l'éteignait sur ceux jamais vus.
  const unreadNotif = data.notifs.some((n) => !notifsLues.has(n.id));

  const conv = overlay?.kind === "chat" ? data.convos.find((c) => c.id === overlay.convId) ?? null : null;
  const purchaseParcelle =
    overlay?.kind === "purchase" ? data.parcelles.find((p) => p.lotId === overlay.lotId) ?? null : null;
  const reportParcelle =
    overlay?.kind === "report" ? data.parcelles.find((p) => p.lotId === overlay.lotId) ?? null : null;

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
            onReport={openReport}
          />
        )}
        {overlay?.kind === "purchase" && (
          <PurchaseScreen parcelle={purchaseParcelle} onBack={back} onConfirm={data.suivreParcelle} />
        )}
        {overlay?.kind === "report" && (
          <ReportIssueScreen
            lotId={overlay.lotId}
            parcelle={reportParcelle}
            onBack={backToDetail}
            onSubmit={data.signalerProbleme}
            onDone={() => {
              backToDetail();
              flash("Signalement transmis");
            }}
            flash={flash}
          />
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
        {overlay?.kind === "notifications" && (
          <NotificationsScreen notifs={data.notifs} lues={overlay.dejaLues} onBack={back} />
        )}
        {overlay?.kind === "editprofile" && (
          <EditProfileScreen
            profile={data.profile}
            email={data.email}
            onBack={back}
            onSave={data.majProfil}
            onChangePassword={onChangePassword}
            flash={flash}
          />
        )}

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
