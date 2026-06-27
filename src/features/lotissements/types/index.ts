import type { Database } from "./database.types";

export type Lotissement =
  Database["public"]["Tables"]["lotissements"]["Row"];

export type NewLotissement =
  Database["public"]["Tables"]["lotissements"]["Insert"];

export type UpdateLotissement =
  Database["public"]["Tables"]["lotissements"]["Update"];