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

export async function fetchAllPages<T>(
  make: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += POSTGREST_MAX_ROWS) {
    const { data } = await make(from, from + POSTGREST_MAX_ROWS - 1);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < POSTGREST_MAX_ROWS) break;
  }
  return rows;
}
