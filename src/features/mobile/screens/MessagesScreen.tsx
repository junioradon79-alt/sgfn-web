"use client";

import { MessageSquare } from "lucide-react";
import type { Convo } from "../data/useMobileData";
import { initiales, fmtRelatif } from "../data/mappers";

export function MessagesScreen({
  convos,
  userId,
  onOpenChat,
}: {
  convos: Convo[];
  userId: string | null;
  onOpenChat: (convId: string) => void;
}) {
  const autre = (c: Convo) =>
    (c.conversation_participants || []).find((p) => p.profile_id !== userId)?.profiles ?? null;
  const messagesTries = (c: Convo) =>
    [...(c.messages || [])].sort((a, b) => new Date(a.envoye_le).getTime() - new Date(b.envoye_le).getTime());
  const nbNonLus = (c: Convo) => (c.messages || []).filter((m) => !m.lu && m.expediteur !== userId).length;

  const tries = [...convos].sort((a, b) => {
    const dernier = (c: Convo) =>
      (c.messages || []).reduce((max, m) => Math.max(max, new Date(m.envoye_le).getTime()), new Date(c.cree_le).getTime());
    return dernier(b) - dernier(a);
  });

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <div className="flex-none px-[18px] pt-2 pb-3">
        <div className="text-[22px] font-extrabold text-foreground">Messages</div>
        <div className="mt-0.5 text-[12.5px] text-muted-foreground">Vos échanges avec les agents et géomètres</div>
      </div>

      <div className="sgnf-scroll flex-1 overflow-y-auto px-3 pb-6">
        {tries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
            <MessageSquare className="size-7 text-muted-2" />
            <div className="text-[14px] font-semibold text-foreground">Aucune conversation</div>
            <div className="text-[12px] text-muted-foreground">
              Vos échanges avec les agents SGNF et les géomètres apparaîtront ici.
            </div>
          </div>
        ) : (
          tries.map((c) => {
            const a = autre(c);
            const msgs = messagesTries(c);
            const last = msgs[msgs.length - 1];
            const n = nbNonLus(c);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpenChat(c.id)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left"
              >
                <span className="flex size-[46px] flex-none items-center justify-center rounded-full bg-primary text-[15px] font-bold text-primary-foreground">
                  {initiales(a?.nom_complet)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[14.5px] font-semibold text-foreground">
                      {a?.nom_complet ?? "Interlocuteur"}
                    </span>
                    <span className="flex-none text-[10.5px] text-muted-2">
                      {last ? fmtRelatif(last.envoye_le) : fmtRelatif(c.cree_le)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">
                      {last?.corps ?? c.sujet ?? "Sans sujet"}
                    </span>
                    {n > 0 && (
                      <span className="tabular flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
                        {n}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
