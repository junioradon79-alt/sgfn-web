export const JOUR_MS = 86_400_000;

/** Compte des horodatages par jour sur les `n` derniers jours (index 0 = le plus ancien). */
export function serieParJour(dates: Array<string | null>, jours: number): number[] {
  const out = new Array<number>(jours).fill(0);
  const debutAujourdhui = new Date();
  debutAujourdhui.setHours(0, 0, 0, 0);

  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d);
    if (Number.isNaN(t.getTime())) continue;
    t.setHours(0, 0, 0, 0);
    const ecart = Math.round((debutAujourdhui.getTime() - t.getTime()) / JOUR_MS);
    if (ecart >= 0 && ecart < jours) out[jours - 1 - ecart] += 1;
  }
  return out;
}
