// Pagination des lectures PostgREST.
//
// PostgREST plafonne CHAQUE réponse à 1000 lignes (db-max-rows, non contournable
// par .limit()). Une table qui dépasse ce seuil pour le rôle courant est donc
// tronquée SILENCIEUSEMENT (ex. `attributions` = 1352 lignes → 352 perdues, des
// lots affichés « Non attribué » à tort). `fetchAllPages` boucle sur .range()
// jusqu'à épuisement.
//
// ⚠️ L'appelant DOIT fournir un ordre déterministe (idéalement la clé primaire),
// sinon les pages peuvent se chevaucher ou omettre des lignes.
//
// Ce découpage sert AUSSI à éviter les embeds imbriqués lourds : PostgREST résout
// un embed à 2 niveaux (`lots→attributions→attributaires`) en LATERAL par ligne
// avec ré-évaluation de la RLS ligne à ligne. Sur ~900 lignes d'un rôle scopé,
// la requête dépasse le statement_timeout de 8 s (HTTP 500 → écran vide). Charger
// chaque relation À PLAT puis fusionner par clé côté client contourne les deux
// problèmes.

export const POSTGREST_MAX_ROWS = 1000;

/** Ce qu'une réponse PostgREST rend, tel qu'on en a besoin ici. */
export type ReponsePostgrest<T> = { data: T[] | null; error: ErreurLecture | null };

/**
 * Le strict nécessaire d'un `PostgrestError`. Typé en structure plutôt qu'en
 * import : les erreurs d'une RPC, d'un `select` et d'une vue ne partagent que
 * ces deux champs, et c'est tout ce dont la distinction ci-dessous a besoin.
 */
export type ErreurLecture = { message: string; code?: string | null };

/**
 * Résultat d'une lecture paginée.
 *
 * 🔴 `fetchAllPages` rendait `T[]` et déstructurait `const { data } = …` SANS
 * `error` : un refus RLS (`42501`) devenait une liste VIDE, silencieuse. Un
 * droit encore manquant et un droit accordé mais sans données s'affichaient
 * alors à l'identique — impossible de prouver qu'un élargissement de policy a
 * fonctionné, et une attestation bloquée se lisait comme « 0 attestation »
 * (dette #45 : un refus lu comme une bonne nouvelle là où l'admin voyait 822).
 *
 * Le type de retour est un OBJET, et non un tableau : `tsc` casse alors chez
 * chaque appelant (`rows.filter` sur un objet), ce qui force une prise de
 * position. Un simple champ optionnel, ou un tableau enrichi d'une propriété,
 * aurait laissé passer sans un mot exactement les appelants qu'il fallait
 * réveiller.
 *
 * `rows` peut être NON VIDE avec une `error` : une erreur survenue à la
 * deuxième page laisse la première déjà lue. La lecture est alors PARTIELLE —
 * l'afficher sans son motif serait le même piège, en plus discret.
 */
export type ResultatPagine<T> = { rows: T[]; error: ErreurLecture | null };

export async function fetchAllPages<T>(
  make: (from: number, to: number) => PromiseLike<ReponsePostgrest<T>>,
): Promise<ResultatPagine<T>> {
  const rows: T[] = [];
  for (let from = 0; ; from += POSTGREST_MAX_ROWS) {
    const { data, error } = await make(from, from + POSTGREST_MAX_ROWS - 1);
    if (error) return { rows, error };
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < POSTGREST_MAX_ROWS) break;
  }
  return { rows, error: null };
}

/**
 * Phrase d'écran pour une lecture qui a échoué.
 *
 * Reprend la distinction de `src/features/mobile/data/useAttestations.ts` : un
 * `code` renseigné prouve que la base a RÉPONDU non — `42501` est un refus de
 * droits, tout autre code une erreur de requête ; son absence trahit un échec
 * de transport, et l'état du serveur est alors inconnu. Les trois cas appellent
 * des gestes différents (demander un droit, corriger la requête, réessayer) :
 * les confondre en « une erreur est survenue » les rend tous les trois muets.
 *
 * `quoi` est un groupe nominal au pluriel — « les attestations de cession » —
 * placé après un tiret, pour n'avoir aucun accord à faire porter au gabarit.
 */
export function messageLecture(quoi: string, error: ErreurLecture): string {
  if (error.code === "42501") return `Accès refusé — ${quoi} : ${error.message}`;
  if (error.code) return `Lecture impossible — ${quoi} : ${error.message}`;
  return `Lecture interrompue (réseau, état inconnu) — ${quoi} : ${error.message}`;
}
