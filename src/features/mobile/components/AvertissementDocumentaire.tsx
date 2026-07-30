"use client";

// L'avertissement documentaire de l'app mobile — DES DEUX CÔTÉS de la file.
//
// Demande du 29/07, verbatim : « Toute saisie ne devra être possible que si les
// documents afférents sont renseignés dans la base de données ».
//
// 🔴 ARBITRAGE DU PROPRIÉTAIRE DU PROJET : cette condition **avertit**, elle ne
// **bloque** pas — le maker-checker est déjà un contrôle humain, et la règle
// existante refuserait 898 lots sur 898. L'arbitrage ne tient que si les pièces
// manquantes sont nommées **aux deux bouts** : au moment de soumettre, et dans
// la file de validation. Sinon l'approbateur tranche sans savoir.
//
// 🔴 POURQUOI CE FICHIER EXISTE. Ce composant vivait *dans*
// `FicheParcelleScreen.tsx`, donc côté saisie seulement : `SoumissionsScreen`,
// le seul écran mobile qui appelle `approuver_soumission`, n'affichait aucun
// manque là où le web le faisait. Le sortir ici est ce qui empêche d'en écrire
// un second — c'est un écart au même arbitrage qui a été payé une fois.
//
// 🔴 LA RÈGLE N'EST PAS RÉÉCRITE ICI. Elle vit dans
// `manques_documentaires_lotissement(uuid, integer)`, qui délègue à
// `manques_documentaires_lot` puis à `calculer_score_confiance`. Si la règle
// change en base, ces écrans suivent sans être touchés. Le jumeau web
// (`components/dashboard/saisie/AvertissementDocumentaire.tsx`) interroge la
// même fonction : deux présentations, une seule vérité.

import { useEffect, useState } from "react";

import { createClient } from "@/utils/supabase/client";
import { Avertissement } from "../screens/admin/saisie/champs";

/**
 * 🔴 TROIS états, jamais deux. « Je n'ai pas pu savoir » n'est **pas** « dossier
 * complet » — les confondre est le faux vert que ce dépôt a documenté quatre
 * fois. Une erreur ne devient donc jamais une liste vide.
 */
type Etat =
  | { kind: "attente" }
  | { kind: "ok"; manques: string[] }
  | { kind: "echec"; erreur: string };

export function AvertissementDocumentaire({
  lotissementId,
  /** `compact` : formulation d'une carte de file, où c'est l'admin qui tranche. */
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
      // `(uuid)` ET en `(uuid, integer)` : un appel à un seul argument échoue en
      // `42725 function is not unique`. Le wrapper de lotissement n'a qu'une
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
      setEtat(
        error
          ? { kind: "echec", erreur: error.message }
          : { kind: "ok", manques: (data ?? []) as string[] },
      );
    })();
    return () => {
      actif = false;
    };
  }, [lotissementId]);

  if (!lotissementId || etat.kind === "attente") return null;

  if (etat.kind === "echec") {
    return (
      <div className={compact ? "mt-2.5" : "mb-4"}>
        <Avertissement>
          État du dossier documentaire <b>inconnu</b> — la vérification a échoué ({etat.erreur}).
          Ce n&apos;est <b>pas</b> la même chose qu&apos;un dossier complet.
        </Avertissement>
      </div>
    );
  }

  // Dossier complet : on ne dit rien. Un bandeau vert de plus sur chaque carte
  // rendrait invisible celui qui compte.
  if (etat.manques.length === 0) return null;

  return (
    <div className={compact ? "mt-2.5" : "mb-4"}>
      <Avertissement>
        <b>Dossier du lotissement incomplet.</b> Pièces manquantes :{" "}
        {etat.manques.join(", ")}.{" "}
        {compact ? (
          <>L&apos;approbation reste possible : c&apos;est à vous d&apos;en décider.</>
        ) : (
          <>
            Vous pouvez soumettre malgré tout — l&apos;administrateur verra le même
            avertissement et décidera. Tant que ces pièces manquent, le lotissement ne peut
            pas émettre d&apos;attestation.
          </>
        )}
      </Avertissement>
    </div>
  );
}
