"use client";

// Ouvrir un échange depuis l'app mobile.
//
// L'app savait répondre dans une conversation existante, jamais en ouvrir une :
// tant que l'agence n'avait pas écrit la première, un citoyen n'avait aucun
// moyen de la joindre depuis son téléphone.
//
// L'écran se lit en deux temps — choisir à qui, puis écrire — plutôt qu'un
// formulaire unique : sur un téléphone, la liste des destinataires et le champ
// de message se disputeraient la hauteur restante une fois le clavier ouvert.

import { useMemo, useState } from "react";
import { Loader2, Search, Send, UserRound } from "lucide-react";

import { useBackHandler } from "@/lib/android-back";
import { BarHeader } from "../components/MobileHeader";
import { initiales, groupeLabel } from "../data/mappers";
import { useContactsMessagerie, type Contact } from "../data/useMobileData";

export function NewChatScreen({
  moiId,
  onBack,
  onCreer,
  onCree,
}: {
  moiId: string | null;
  onBack: () => void;
  onCreer: (
    destinataireId: string,
    sujet: string,
    corps: string,
  ) => Promise<{ ok: boolean; convId?: string; error?: string }>;
  onCree: (convId: string) => void;
}) {
  const { contacts, loading } = useContactsMessagerie(true, moiId);
  const [recherche, setRecherche] = useState("");
  const [destinataire, setDestinataire] = useState<Contact | null>(null);
  const [sujet, setSujet] = useState("");
  const [corps, setCorps] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  // Le retour revient d'abord à la liste des destinataires : sinon on perdrait
  // le message en cours de rédaction pour une simple erreur de destinataire.
  useBackHandler(() => {
    if (destinataire) {
      setDestinataire(null);
      return true;
    }
    return false;
  });

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        (c.nom_complet ?? "").toLowerCase().includes(q) ||
        groupeLabel(c.groupe).toLowerCase().includes(q),
    );
  }, [contacts, recherche]);

  const envoyer = async () => {
    if (!destinataire || !corps.trim() || envoi) return;
    setEnvoi(true);
    setErreur("");
    const res = await onCreer(destinataire.id, sujet, corps);
    setEnvoi(false);
    if (res.ok && res.convId) onCree(res.convId);
    else setErreur(res.error ?? "L'envoi a échoué.");
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <BarHeader
        onBack={destinataire ? () => setDestinataire(null) : onBack}
        title={
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-foreground">
              {destinataire ? destinataire.nom_complet ?? "Interlocuteur" : "Nouveau message"}
            </div>
            <div className="truncate text-[11.5px] text-muted-foreground">
              {destinataire ? groupeLabel(destinataire.groupe) : "À qui souhaitez-vous écrire ?"}
            </div>
          </div>
        }
      />

      {!destinataire ? (
        <>
          <div className="flex-none px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 rounded-full border border-border bg-inset px-3.5 py-2.5">
              <Search className="size-4 flex-none text-muted-2" />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher un correspondant…"
                className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none"
              />
            </div>
          </div>

          <div className="sgnf-scroll flex-1 overflow-y-auto px-3 pb-6">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Chargement…
              </div>
            ) : filtres.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                <UserRound className="size-7 text-muted-2" />
                <div className="text-[14px] font-semibold text-foreground">
                  {recherche ? "Aucun correspondant" : "Aucun correspondant disponible"}
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {recherche
                    ? "Aucun nom ne correspond à votre recherche."
                    : "Vous pouvez écrire aux agents SGNF et aux personnes avec qui vous échangez déjà."}
                </div>
              </div>
            ) : (
              filtres.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setDestinataire(c)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left"
                >
                  <span className="flex size-[46px] flex-none items-center justify-center rounded-full bg-primary text-[15px] font-bold text-primary-foreground">
                    {initiales(c.nom_complet)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-foreground">
                      {c.nom_complet ?? "Sans nom"}
                    </span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {groupeLabel(c.groupe)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <div className="sgnf-scroll flex-1 overflow-y-auto px-4 py-4">
            <label className="block text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              Objet <span className="font-normal normal-case">(facultatif)</span>
            </label>
            <input
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              placeholder="Ex. Question sur mon lot 112"
              className="mt-1.5 w-full rounded-xl border border-border bg-inset px-3.5 py-2.5 text-[14px] text-foreground outline-none"
            />

            <label className="mt-4 block text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              Votre message
            </label>
            <textarea
              value={corps}
              onChange={(e) => setCorps(e.target.value)}
              rows={7}
              placeholder="Écrivez votre message…"
              className="mt-1.5 w-full resize-none rounded-xl border border-border bg-inset px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground outline-none"
            />

            {erreur && (
              <p role="alert" className="mt-3 rounded-xl bg-danger-subtle px-3.5 py-2.5 text-[12.5px] text-danger">
                {erreur}
              </p>
            )}
          </div>

          <div className="flex-none border-t border-border bg-card px-4 py-3">
            <button
              type="button"
              onClick={() => void envoyer()}
              disabled={envoi || !corps.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {envoi ? <Loader2 className="size-[18px] animate-spin" /> : <Send className="size-[18px]" />}
              {envoi ? "Envoi…" : "Envoyer"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
