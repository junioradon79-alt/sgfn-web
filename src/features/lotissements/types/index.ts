// Les types viennent des types générés à la racine (`supabase gen types`),
// jamais d'une copie locale : ce module en portait une, écrite à la main, qui
// avait dérivé du schéma — `pv_numero_enregistrement` et
// `pv_commissaire_justice_id` y figuraient dans `Row` mais manquaient dans
// `Insert`/`Update`, rendant ces colonnes impossibles à saisir depuis le
// formulaire alors que la base les acceptait.
import type { Database } from "../../../../database.types";

export type Lotissement =
  Database["public"]["Tables"]["lotissements"]["Row"];

export type NewLotissement =
  Database["public"]["Tables"]["lotissements"]["Insert"];

export type UpdateLotissement =
  Database["public"]["Tables"]["lotissements"]["Update"];
