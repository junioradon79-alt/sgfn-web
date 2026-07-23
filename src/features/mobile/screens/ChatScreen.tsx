"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { BarHeader } from "../components/MobileHeader";
import type { Convo } from "../data/useMobileData";
import { initiales, groupeLabel } from "../data/mappers";

export function ChatScreen({
  conv,
  userId,
  onBack,
  onSend,
}: {
  conv: Convo;
  userId: string | null;
  onBack: () => void;
  onSend: (corps: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const autre = (conv.conversation_participants || []).find((p) => p.profile_id !== userId)?.profiles ?? null;
  const messages = [...(conv.messages || [])].sort(
    (a, b) => new Date(a.envoye_le).getTime() - new Date(b.envoye_le).getTime()
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "auto" });
  }, [conv.messages.length]);

  const envoyer = async () => {
    const t = draft.trim();
    if (!t || sending) return;
    setSending(true);
    const ok = await onSend(t);
    if (ok) setDraft("");
    setSending(false);
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <BarHeader
        onBack={onBack}
        title={
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 flex-none items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
              {initiales(autre?.nom_complet)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold text-foreground">{autre?.nom_complet ?? "Interlocuteur"}</div>
              <div className="truncate text-[11.5px] text-muted-foreground">
                {conv.sujet || groupeLabel(autre?.groupe)}
              </div>
            </div>
          </div>
        }
      />

      <div className="sgnf-scroll flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4">
        {messages.map((m) => {
          const mine = m.expediteur === userId;
          return (
            <div
              key={m.id}
              className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug ${
                mine
                  ? "self-end rounded-br-[5px] bg-primary text-primary-foreground"
                  : "self-start rounded-bl-[5px] border border-border bg-card text-foreground"
              }`}
            >
              {m.corps}
              <span className={`mt-1 block text-right text-[9.5px] ${mine ? "text-primary-foreground/60" : "text-muted-2"}`}>
                {new Date(m.envoye_le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="flex flex-none items-center gap-2.5 border-t border-border bg-card px-3 py-2.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void envoyer();
            }
          }}
          placeholder="Écrire un message…"
          className="min-w-0 flex-1 rounded-full border border-border bg-inset px-4 py-2.5 text-[14px] text-foreground outline-none"
        />
        <button
          type="button"
          onClick={() => void envoyer()}
          disabled={sending || !draft.trim()}
          aria-label="Envoyer"
          className="flex size-11 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send className="size-5" />
        </button>
      </div>
    </div>
  );
}
