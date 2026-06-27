import { Database } from "../../database.types";

export type Profile =
  Database["public"]["Tables"]["profiles"]["Row"];

export type Lotissement =
  Database["public"]["Tables"]["lotissements"]["Row"];

export type Lot =
  Database["public"]["Tables"]["lots"]["Row"];

export type Attributaire =
  Database["public"]["Tables"]["attributaires"]["Row"];

export type Paiement =
  Database["public"]["Tables"]["paiements"]["Row"];