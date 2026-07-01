import type { Database } from "../../database.types";

export type TypePaiement = Database["public"]["Enums"]["type_paiement"];
export type MoyenPaiement = Database["public"]["Enums"]["moyen_paiement"];
export type StatutPaiement = Database["public"]["Enums"]["statut_paiement"];
export type TypeVente = Database["public"]["Enums"]["type_vente"];

export const TYPE_OPTIONS: { value: TypePaiement; label: string }[] = [
  { value: "attestation_cession", label: "Attestation de cession" },
  { value: "honoraires", label: "Honoraires géomètre" },
  { value: "vente_terrain", label: "Vente terrain" },
  { value: "autre", label: "Autre" },
];

export const MOYEN_OPTIONS: { value: MoyenPaiement; label: string }[] = [
  { value: "wave", label: "Wave" },
  { value: "orange_money", label: "Orange Money" },
  { value: "mtn_money", label: "MTN Money" },
  { value: "moov_money", label: "Moov Money" },
  { value: "virement", label: "Virement bancaire" },
  { value: "especes", label: "Espèces" },
  { value: "autre", label: "Autre" },
];

export const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TYPE_OPTIONS.map((o) => [o.value, o.label])
);

export const MOYEN_LABELS: Record<string, string> = Object.fromEntries(
  MOYEN_OPTIONS.map((o) => [o.value, o.label])
);

export const STATUT_CONFIG: Record<
  string,
  { badge: "disponible" | "attribue" | "en_validation" | "litige"; label: string }
> = {
  confirme: { badge: "attribue", label: "Confirmé" },
  en_attente: { badge: "en_validation", label: "En attente" },
  initie: { badge: "en_validation", label: "Redirection en cours" },
  en_attente_validation: { badge: "en_validation", label: "En attente de validation" },
  echoue: { badge: "litige", label: "Échoué" },
  rembourse: { badge: "disponible", label: "Remboursé" },
};

export const MOYENS_MANUELS: MoyenPaiement[] = ["especes", "virement"];

export const isMoyenManuel = (moyen: string | null | undefined) =>
  MOYENS_MANUELS.includes(moyen as MoyenPaiement);

export const labelTypePaiement = (
  type: string | null | undefined,
  typeVente?: string | null
) => {
  if (type === "vente_terrain") {
    if (typeVente === "comptant") return "Vente au comptant";
    if (typeVente === "echelonne") return "Vente échelonnée";
  }

  return TYPE_LABELS[type ?? ""] ?? type ?? "—";
};

export const fcfa = (n: number | null) =>
  `${new Intl.NumberFormat("fr-FR").format(Math.round(n ?? 0))} FCFA`;
