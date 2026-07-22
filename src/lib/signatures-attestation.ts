/**
 * Signatures d'une attestation de cession — règles partagées.
 *
 * Doctrine (22/07) : les signatures sont **constatées**, pas électroniques. Le
 * document est signé sur papier ; l'application enregistre qu'elles y figurent
 * et qui l'a constaté. Voir la migration `20260722160000`.
 *
 * Ce module existe pour que la règle de libellé ne soit écrite qu'UNE fois :
 * elle est utilisée par le Coffre-fort documentaire et par l'écran Validations
 * de la chefferie, et une copie divergente serait invisible jusqu'à ce qu'un
 * écran affiche le mauvais titre.
 */

/** Clés de `lotissements.signatures_requises`, dans l'ordre d'affichage. */
export const SIGNATURES_ATTESTATION = [
  { cle: "proprietaire", label: "Propriétaire terrien" },
  { cle: "operateur", label: "Opérateur" },
  { cle: "chefferie", label: "Chefferie" },
] as const;

/** Jeu appliqué quand le lotissement n'en configure pas (norme à 3). */
export const SIGNATURES_PAR_DEFAUT = ["proprietaire", "operateur", "chefferie"];

/**
 * Le signataire « proprietaire » ne porte pas le même titre partout, et la
 * différence est de fond :
 *
 * - un lotissement rattaché à **une** famille (Koelea-Accor revu → lignée Ako
 *   Djebe) est signé par son **chef de famille** ;
 * - un lotissement couvrant **plusieurs** familles (Brignan Kakodji,
 *   `famille_id` nul, 16 représentants distincts au rang 1) est signé par le
 *   **propriétaire terrien** du lot concerné.
 *
 * Le libellé se déduit donc du rattachement du lotissement, sans configuration
 * supplémentaire à tenir à jour.
 */
export function libelleSignature(cle: string, lotissementAUneFamille: boolean): string {
  if (cle === "proprietaire") {
    return lotissementAUneFamille ? "Chef de famille" : "Propriétaire terrien";
  }
  return SIGNATURES_ATTESTATION.find((s) => s.cle === cle)?.label ?? cle;
}
