// TerraCI Market — la découverte et la vente des terrains y vivent, hors de
// l'application. Extrait de `MobileApp` quand l'écran des terrains suivis a eu
// besoin d'ouvrir une annonce précise : `CitizenApp` ne peut pas importer
// `MobileApp`, qui l'importe déjà.

export const MARKET_URL = "https://monterrain.sgfn.ci";

/**
 * URL d'une annonce. `annonceId` peut manquer alors même que le lot est
 * annoncé en vente — l'annonce a pu être publiée entre deux lectures — auquel
 * cas on renvoie vers la liste plutôt que de fabriquer un lien mort.
 */
export function urlAnnonce(annonceId: string | null | undefined): string {
  return annonceId ? `${MARKET_URL}/annonces/${annonceId}/` : `${MARKET_URL}/annonces/`;
}
