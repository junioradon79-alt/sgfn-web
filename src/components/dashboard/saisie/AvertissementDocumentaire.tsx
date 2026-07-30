"use client";

// L'avertissement documentaire, des DEUX côtés de la file.
//
// Demande du 29/07, verbatim : « Toute saisie ne devra être possible que si les
// documents afférents sont renseignés dans la base de données ».
//
// 🔴 ARBITRAGE DU PROPRIÉTAIRE DU PROJET : cette condition **avertit**, elle ne
// **bloque** pas. Deux raisons, toutes deux mesurées :
//   • le maker-checker est déjà un point de contrôle humain — un administrateur
//     lit et approuve chaque soumission ;
//   • la condition existante refuserait **898 lots sur 898** : Koelea-Accor
//     n'a ni PV du guide ni PV d'identification (60/100), Brignan Kakodji n'a
//     même pas d'APFC (20/100), et aucune dérogation n'est posée. Bloquer
//     fermerait la saisie à la totalité du parc.
//
// D'où ce composant, employé aux deux bouts : au moment de **soumettre**
// (`SaisieChefferie`) et dans la **file de validation** (`FileValidation`).
// Que l'approbateur voie exactement ce que voit la personne qui a saisi est
// tout l'objet de l'arbitrage — sans quoi il tranche sans savoir.
//
// 🔴 La règle n'est PAS réécrite ici. Elle vit dans
// `manques_documentaires_lotissement(uuid, integer)`, qui délègue à
// `manques_documentaires_lot` puis à `calculer_score_confiance`. Si la règle
// change en base, cet écran suit sans être touché.

import { useEffect, useState } from "react";
import { FileWarning, ShieldQuestion } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type Etat =
  | { kind: "attente" }
  | { kind: "ok"; manques: string[] }
  | { kind: "echec"; erreur: string };

/**
 * 🔴 TROIS états, jamais deux. « Je n'ai pas pu savoir » n'est pas « dossier
 * complet » — les confondre est le faux vert que ce dépôt a documenté quatre
 * fois. Une erreur ne devient donc jamais une liste vide.
 */
export function AvertissementDocumentaire({
  lotissementId,
  /** `compact` : version d'une ligne, pour une carte de la file de validation. */
  compact = false,
}: {
  lotissementId: string | null | undefined;
  compact?: boolean;
}) {
  const [etat, setEtat] = useState<Etat>({ kind: "attente" });

  useEffect(() => {
    if (!lotissementId) return;
    const supabase = createClient();
    let actif = true;
    void (async () => {
      // 🔴 `p_niveau` TOUJOURS explicite. `manques_documentaires_lot` existe en
      // `(uuid)` ET en `(uuid, integer)` : un appel à un seul argument échoue
      // en `42725 function is not unique`. Le wrapper de lotissement n'a qu'une
      // signature, mais on garde la discipline — c'est le même piège une
      // fonction plus loin.
      //
      // 🔴 Niveau 2 délibérément : il nomme les QUATRE pièces, PV
      // d'identification physique compris. Rien n'étant bloqué, en nommer plus
      // ne coûte rien ; en nommer moins laisserait croire le dossier complet.
      const { data, error } = await supabase.rpc("manques_documentaires_lotissement", {
        p_lotissement_id: lotissementId,
        p_niveau: 2,
      });
      if (!actif) return;
      setEtat(error ? { kind: "echec", erreur: error.message } : { kind: "ok", manques: (data ?? []) as string[] });
    })();
    return () => {
      actif = false;
    };
  }, [lotissementId]);

  if (!lotissementId || etat.kind === "attente") return null;

  if (etat.kind === "echec") {
    return (
      <div
        className={`flex gap-2.5 rounded-xl border border-slate-300/70 bg-slate-50 px-3.5 py-2.5 ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        <ShieldQuestion className="mt-px h-4 w-4 flex-none text-slate-500" />
        <div className="min-w-0 text-slate-700">
          État du dossier documentaire <b>inconnu</b> — la vérification a échoué ({etat.erreur}).
          Ce n&apos;est <b>pas</b> la même chose qu&apos;un dossier complet.
        </div>
      </div>
    );
  }

  // Dossier complet : on ne dit rien. Un bandeau vert de plus sur chaque écran
  // rendrait invisible celui qui compte.
  if (etat.manques.length === 0) return null;

  return (
    <div
      className={`flex gap-2.5 rounded-xl border border-amber-300/70 bg-amber-50 px-3.5 py-2.5 ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      <FileWarning className="mt-px h-4 w-4 flex-none text-amber-600" />
      <div className="min-w-0 text-amber-900">
        <b>Dossier du lotissement incomplet</b> — pièces manquantes :{" "}
        {etat.manques.join(", ")}.
        {compact ? (
          <> L&apos;approbation reste possible : c&apos;est à vous d&apos;en décider.</>
        ) : (
          <>
            {" "}
            Vous pouvez soumettre malgré tout : l&apos;administrateur verra le même
            avertissement et tranchera. Tant que ces pièces manquent, le lotissement ne peut
            pas émettre d&apos;attestation.
          </>
        )}
      </div>
    </div>
  );
}
