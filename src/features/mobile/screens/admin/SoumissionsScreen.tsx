"use client";

// Traiter la file des saisies SANS quitter l'app.
//
// Jusqu'ici l'onglet « À faire » se contentait d'ouvrir la page web du
// dashboard : `openWeb` fait un `window.location.assign()`, donc l'admin sortait
// de la WebView pour ne plus y revenir simplement. Valider une saisie est
// pourtant une décision courte — lire un résumé, trancher — qui n'a pas besoin
// du confort du bureau.
//
// Deux principes tiennent l'écran :
//   • approuver applique réellement les attributions en base et rejeter renvoie
//     l'opérateur à sa copie : ce sont des actes engageants, jamais déclenchés
//     sur un simple tap — une confirmation explicite s'interpose, et une seule
//     à la fois pour qu'on sache toujours de quelle soumission on parle ;
//   • le détail lot par lot n'est pas chargé (cf. `useSoumissions`) : la carte
//     montre le résumé pré-calculé, et le dit franchement avant de confirmer.
//
// L'écran est scindé en **conteneur** (branche la file réelle) et **vue** (ne
// connaît qu'un `FileSoumissions`). C'est ce qui le rend montable dans
// `/apercu-mobile` avec une file simulée : la file de production est vide et le
// seul compte de test est administrateur, si bien que l'écran qui porte les
// actes les plus irréversibles de l'app était aussi le seul qu'on ne pouvait
// pas regarder avant de le livrer.

import { useCallback, useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, ShieldAlert, TriangleAlert } from "lucide-react";

import { useBackHandler } from "@/lib/android-back";
import { CountBadge } from "@/components/ds/badge";
import type { ResumeCreation, ResumeMaj, TypeSoumission } from "@/lib/saisie";
import { BarHeader } from "../../components/MobileHeader";
import {
  useSoumissions,
  type FileSoumissions,
  type ResultatApplication,
  type SoumissionEnAttente,
} from "../../data/useSoumissions";

type Acte = "approuver" | "rejeter";

const TYPE_LABEL: Record<TypeSoumission, string> = {
  maj_attributions: "Mise à jour d'attributions",
  creation_structure: "Création de structure",
};

/** Pluriel simple — les libellés de la file n'ont pas de cas irrégulier. */
const s = (n: number) => (n > 1 ? "s" : "");

function dateLisible(iso: string | null): string {
  if (!iso) return "Date inconnue";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Puce = { texte: string; ton: "success" | "warning" | "accent" | "neutral" };

/**
 * Résumé lisible tiré du `resume` jsonb.
 *
 * Le jsonb ne porte que des compteurs bruts : sur une carte de 6 cm, une ligne
 * « 3 / 1 / 2 » ne dit rien de ce qui va changer dans le registre. On nomme
 * chaque volume, et on n'affiche que ce qui est non nul — un zéro n'apporte
 * aucune information à qui doit décider.
 */
function puces(soumission: SoumissionEnAttente): Puce[] {
  const r = soumission.resume;
  if (!r) return [];

  if (soumission.type === "maj_attributions") {
    const m = r as ResumeMaj;
    const liste: Puce[] = [];
    if (m.nouvelles_attributions > 0)
      liste.push({ texte: `${m.nouvelles_attributions} nouvelle${s(m.nouvelles_attributions)} attribution${s(m.nouvelles_attributions)}`, ton: "success" });
    if (m.reassignations > 0)
      liste.push({ texte: `${m.reassignations} réassignation${s(m.reassignations)}`, ton: "warning" });
    if (m.remises_libre > 0)
      liste.push({ texte: `${m.remises_libre} remise${s(m.remises_libre)} en disponibilité`, ton: "neutral" });
    // « nouvel » ne se pluralise pas en « nouvels » : au-delà de un, c'est
    // « nouveaux ». Le cas se présente dès le second attributaire créé, donc
    // sur à peu près tout import de guide de répartition.
    if (m.nouveaux_attributaires > 0)
      liste.push({
        texte: `${m.nouveaux_attributaires} ${m.nouveaux_attributaires > 1 ? "nouveaux" : "nouvel"} attributaire${s(m.nouveaux_attributaires)}`,
        ton: "accent",
      });
    if (m.inchanges > 0) liste.push({ texte: `${m.inchanges} sans effet`, ton: "neutral" });
    return liste;
  }

  const c = r as ResumeCreation;
  const liste: Puce[] = [
    { texte: `${c.nb_ilots} îlot${s(c.nb_ilots)}`, ton: "accent" },
    { texte: `${c.nb_lots} lot${s(c.nb_lots)}`, ton: "success" },
  ];
  if (c.nb_equipements > 0)
    liste.push({ texte: `${c.nb_equipements} équipement${s(c.nb_equipements)}`, ton: "neutral" });
  return liste;
}

/** Ce que la base a réellement écrit — plus honnête que le résumé annoncé. */
function resultatLisible(r: ResultatApplication | null): string {
  if (!r) return "";
  const bouts: string[] = [];
  if (r.nouvelles_attributions) bouts.push(`${r.nouvelles_attributions} attribution${s(r.nouvelles_attributions)}`);
  if (r.reassignations) bouts.push(`${r.reassignations} réassignation${s(r.reassignations)}`);
  if (r.remises_libre) bouts.push(`${r.remises_libre} remise${s(r.remises_libre)} en disponibilité`);
  if (r.nb_ilots) bouts.push(`${r.nb_ilots} îlot${s(r.nb_ilots)}`);
  if (r.nb_lots) bouts.push(`${r.nb_lots} lot${s(r.nb_lots)}`);
  return bouts.length ? ` ${bouts.join(", ")}.` : "";
}

// 🔴 Le texte reste en `text-foreground`, jamais dans la couleur du ton.
// Mesuré : `text-warning` sur `bg-warning-subtle` donne **2,83:1** en thème
// clair et `text-accent` sur `bg-accent-subtle` **3,95:1** en sombre — très
// en dessous d'AA, sur des chiffres qui décident d'une validation foncière.
// C'est la même conclusion que les cartes d'action : **la couleur porte la
// catégorie (le fond et la pastille), le texte porte l'information et doit
// rester lisible.**
const TON_PUCE: Record<Puce["ton"], string> = {
  success: "bg-success-subtle text-foreground",
  warning: "bg-warning-subtle text-foreground",
  accent: "bg-accent-subtle text-foreground",
  neutral: "bg-inset text-foreground",
};

/** La saturation pleine ne survit que dans la pastille, où rien ne se lit. */
const TON_POINT: Record<Puce["ton"], string> = {
  success: "bg-success",
  warning: "bg-warning",
  accent: "bg-accent",
  neutral: "bg-muted-2",
};

type PropsVue = {
  /** File déjà chargée — réelle dans l'app, simulée dans `/apercu-mobile`. */
  file: FileSoumissions;
  onBack: () => void;
  /** Une soumission traitée change le compteur « À faire » de la coquille. */
  onTraite?: () => void;
};

/** Conteneur : c'est lui, et lui seul, qui parle à la base. */
export function SoumissionsScreen({
  onBack,
  onTraite,
}: {
  onBack: () => void;
  onTraite?: () => void;
}) {
  const file = useSoumissions(true);
  return <SoumissionsVue file={file} onBack={onBack} onTraite={onTraite} />;
}

export function SoumissionsVue({ file, onBack, onTraite }: PropsVue) {
  const { soumissions, loading, erreur, recharger, approuver, rejeter } = file;

  // Une seule confirmation ouverte à la fois : deux panneaux dépliés sur un
  // écran de téléphone, et l'on ne sait plus lequel on confirme.
  const [confirmation, setConfirmation] = useState<{ id: string; acte: Acte } | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [enCours, setEnCours] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; texte: string } | null>(null);

  // Le geste de retour Android referme d'abord la confirmation : sinon un
  // réflexe de sortie ferait perdre le motif de rejet en cours de rédaction.
  useBackHandler(
    useCallback(() => {
      if (confirmation) {
        setConfirmation(null);
        return true;
      }
      return false;
    }, [confirmation]),
  );

  const demander = (id: string, acte: Acte) => {
    setConfirmation({ id, acte });
    setCommentaire("");
    setFlash(null);
  };

  const confirmer = async () => {
    if (!confirmation || enCours) return;
    const { id, acte } = confirmation;
    setEnCours(id);
    const res = acte === "approuver" ? await approuver(id, commentaire) : await rejeter(id, commentaire);
    setEnCours(null);
    if (!res.ok) {
      // Le message de la base est conservé tel quel : « Soumission déjà traitée »
      // ou « Action réservée aux administrateurs » disent précisément quoi faire.
      setFlash({ ok: false, texte: `Échec : ${res.error}` });
      return;
    }
    setConfirmation(null);
    setCommentaire("");
    setFlash({
      ok: true,
      texte:
        acte === "approuver"
          ? `Soumission approuvée et appliquée.${resultatLisible(res.resultat)}`
          : "Soumission rejetée. L'opérateur la retrouvera à corriger.",
    });
    onTraite?.();
  };

  const total = soumissions.length;

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <BarHeader
        onBack={onBack}
        title={
          <div className="min-w-0">
            <div className="truncate text-[16px] font-bold text-foreground">Saisies à valider</div>
            <div className="truncate text-[11.5px] text-muted-foreground">
              {loading ? "Chargement…" : `${total} en attente de décision`}
            </div>
          </div>
        }
        right={total > 0 ? <CountBadge value={total} /> : undefined}
      />

      <div className="sgnf-scroll flex-1 overflow-y-auto px-[18px] pt-3 pb-6">
        {flash && (
          <div
            role="alert"
            className={`mb-3 flex items-start gap-2 rounded-2xl px-3.5 py-3 text-[12.5px] font-medium ${
              flash.ok ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"
            }`}
          >
            {flash.ok ? (
              <CheckCircle2 className="mt-px size-4 flex-none" />
            ) : (
              <TriangleAlert className="mt-px size-4 flex-none" />
            )}
            <span className="min-w-0">{flash.texte}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Chargement de la file…
          </div>
        ) : erreur ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <TriangleAlert className="size-7 text-danger" />
            <div className="text-[14px] font-semibold text-foreground">File illisible</div>
            <div className="text-[12px] text-muted-foreground">{erreur}</div>
            <button
              type="button"
              onClick={() => void recharger()}
              className="mt-2 rounded-full border border-border px-4 py-2 text-[13px] font-semibold text-foreground"
            >
              Réessayer
            </button>
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <ClipboardCheck className="size-7 text-muted-2" />
            <div className="text-[14px] font-semibold text-foreground">File vide</div>
            <div className="text-[12px] text-muted-foreground">
              Aucune saisie n&apos;attend votre décision. Les soumissions des opérateurs
              apparaîtront ici dès leur envoi.
            </div>
          </div>
        ) : (
          <>
            {/* Teinte brique seulement quand la file est non vide — c'est la
                règle du reste de l'app : un bandeau rouge permanent ne signale
                plus rien. Ici la file EST non vide, donc le bandeau existe. */}
            <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-brick/45 bg-brick-subtle px-3.5 py-3">
              <CountBadge value={total} />
              <span className="min-w-0 text-[12.5px] font-semibold text-foreground">
                soumission{s(total)} attend{total > 1 ? "ent" : ""} votre décision
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {soumissions.map((item) => {
                // Deux raisons distinctes de figer les boutons d'une carte :
                //   • un envoi est en vol ailleurs — en lancer un second
                //     rendrait le message de retour impossible à rattacher ;
                //   • une confirmation est ouverte ailleurs ET porte déjà du
                //     texte : `demander()` remet le commentaire à vide, donc un
                //     tap ici jetterait un motif de rejet en cours de rédaction
                //     sans rien demander. Geler plutôt que redemander — l'écran
                //     n'a qu'un commentaire à la fois, et empiler une question
                //     par-dessus un acte qui en pose déjà deux ferait de la
                //     confirmation un réflexe, exactement ce qu'elle doit
                //     empêcher. Tant que rien n'est tapé, rien n'est figé : on
                //     ne paie la contrainte que quand il y a à perdre.
                const envoiAilleurs = enCours !== null && enCours !== item.id;
                const motifAilleurs =
                  confirmation !== null && confirmation.id !== item.id && commentaire.trim() !== "";
                return (
                  <CarteSoumission
                    key={item.id}
                    soumission={item}
                    acte={confirmation?.id === item.id ? confirmation.acte : null}
                    commentaire={commentaire}
                    onCommentaire={setCommentaire}
                    busy={enCours === item.id}
                    gele={envoiAilleurs || motifAilleurs}
                    onDemander={(a) => demander(item.id, a)}
                    onAnnuler={() => setConfirmation(null)}
                    onConfirmer={() => void confirmer()}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CarteSoumission({
  soumission,
  acte,
  commentaire,
  onCommentaire,
  busy,
  gele,
  onDemander,
  onAnnuler,
  onConfirmer,
}: {
  soumission: SoumissionEnAttente;
  /** Acte en cours de confirmation sur CETTE carte, `null` sinon. */
  acte: Acte | null;
  commentaire: string;
  onCommentaire: (v: string) => void;
  busy: boolean;
  /**
   * Une autre carte monopolise l'écran : envoi en vol, ou confirmation ouverte
   * avec un texte qu'un tap ici effacerait. Détail du calcul chez l'appelant.
   */
  gele: boolean;
  onDemander: (a: Acte) => void;
  onAnnuler: () => void;
  onConfirmer: () => void;
}) {
  const liste = puces(soumission);

  return (
    <div className="rounded-[20px] border border-border bg-card p-4 shadow-panel">
      <div className="text-[14.5px] font-bold text-foreground">
        {soumission.titre ?? TYPE_LABEL[soumission.type]}
      </div>
      {/* Sans titre, c'est le libellé de type qui monte en titre : le répéter
          en sous-titre remplirait deux lignes pour une seule information, sur
          une carte où la place sert à décider. Reste la date, qui distingue
          deux soumissions du même type. */}
      <div className="mt-0.5 text-[11.5px] text-muted-foreground">
        {soumission.titre
          ? `${TYPE_LABEL[soumission.type]} · ${dateLisible(soumission.cree_le)}`
          : dateLisible(soumission.cree_le)}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {liste.length > 0 ? (
          liste.map((p) => (
            <span
              key={p.texte}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${TON_PUCE[p.ton]}`}
            >
              <span className={`size-[6px] flex-none rounded-full ${TON_POINT[p.ton]}`} />
              {p.texte}
            </span>
          ))
        ) : (
          <span className="text-[12px] text-muted-2">Résumé non renseigné à la soumission.</span>
        )}
      </div>

      {acte === null ? (
        <div className="mt-3.5 flex gap-2">
          <button
            type="button"
            onClick={() => onDemander("rejeter")}
            disabled={gele}
            className="flex-1 rounded-full border border-border py-2.5 text-[13.5px] font-semibold text-foreground disabled:opacity-50"
          >
            Rejeter
          </button>
          <button
            type="button"
            onClick={() => onDemander("approuver")}
            disabled={gele}
            className="flex-1 rounded-full bg-primary py-2.5 text-[13.5px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            Approuver
          </button>
        </div>
      ) : (
        <div
          className={`mt-3.5 rounded-2xl border p-3 ${
            acte === "rejeter" ? "border-brick/45 bg-brick-subtle" : "border-warning/45 bg-warning-subtle"
          }`}
        >
          <div className="flex items-start gap-2">
            <ShieldAlert
              className={`mt-px size-4 flex-none ${acte === "rejeter" ? "text-brick" : "text-warning"}`}
            />
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-foreground">
                {acte === "rejeter" ? "Rejeter cette soumission ?" : "Approuver et appliquer ?"}
              </div>
              <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {acte === "rejeter" ? (
                  <>
                    L&apos;opérateur devra la corriger puis la resoumettre. Le motif est ce qui
                    lui dira quoi reprendre.
                  </>
                ) : (
                  <>
                    Les attributions seront écrites dans le registre foncier, avec effet immédiat.
                    Cette application n&apos;est pas annulable depuis l&apos;app. Le détail lot par
                    lot n&apos;est consultable que sur le dashboard web.
                  </>
                )}
              </div>
            </div>
          </div>

          <textarea
            value={commentaire}
            onChange={(e) => onCommentaire(e.target.value)}
            rows={2}
            placeholder={
              acte === "rejeter" ? "Motif du rejet (facultatif)…" : "Note interne (facultatif)…"
            }
            className="mt-2.5 w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-[13px] text-foreground outline-none"
          />

          {/* Le gel des autres cartes est invisible depuis ici — elles sont
              plus bas, hors du champ de vision. On l'annonce donc là où on
              tape, sans quoi des boutons éteints sans raison ailleurs
              passeraient pour une panne. */}
          {commentaire.trim() !== "" && (
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Les autres soumissions restent figées tant que ce texte n&apos;est pas envoyé ou
              annulé : passer à une autre carte l&apos;effacerait.
            </p>
          )}

          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={onAnnuler}
              disabled={busy}
              className="flex-1 rounded-full border border-border bg-card py-2.5 text-[13.5px] font-semibold text-foreground disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onConfirmer}
              disabled={busy}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[13.5px] font-semibold disabled:opacity-50 ${
                acte === "rejeter"
                  ? "bg-brick text-brick-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {acte === "rejeter" ? "Confirmer le rejet" : "Confirmer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
