/**
 * Rattrapage des attestations gratuites — seuil de volume.
 *
 * La règle est tenue par la base (`generer_attestations_gratuites_manquantes`,
 * migration `20260722180000`) : au-delà du seuil, la RPC **refuse** tant que
 * l'appelant ne lui répète pas le nombre exact de lots concernés. Le front n'a
 * donc pas à faire respecter la règle — il a seulement à ne pas surprendre
 * l'utilisateur, en demandant la confirmation avant l'appel plutôt qu'après le
 * refus.
 *
 * Pourquoi un seuil : la purge du 21/07 a vidé la table, la file de rattrapage
 * est aussitôt repassée à 400 lots, et l'écran continuait d'offrir un bouton
 * qui les aurait tous régénérés d'un clic — exactement la régénération de masse
 * écartée la veille.
 */
export const SEUIL_RATTRAPAGE = 20;
