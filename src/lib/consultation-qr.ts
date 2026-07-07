// Tarif de la consultation QR payante (attestations de cession uniquement) —
// décision équipe du 07/07/2026. Le montant fait foi côté serveur : il est
// dupliqué dans l'edge function verification-qr — garder synchronisé.
export const CONSULTATION_QR = {
  montant_total: 60_000,
  part_chefferie: 50_000,
  commission_sgnf: 10_000,
} as const;

export function fmtMontantFCFA(v: number): string {
  return new Intl.NumberFormat("fr-FR").format(v) + " FCFA";
}
