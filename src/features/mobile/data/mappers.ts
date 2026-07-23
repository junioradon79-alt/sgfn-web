// Helpers purs (sans React) partagés par les écrans de l'app mobile.
// Le vocabulaire de statut est celui de l'enum réel `statut_lot`
// (libre / reserve_equipement / attribue / occupe / vendu / en_litige).

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

// ─── Statut de lot ─────────────────────────────────────────────────────────────

export const STATUT_LOT_LABELS: Record<string, string> = {
  libre: "Libre",
  reserve_equipement: "Réservé équipement",
  attribue: "Attribué",
  occupe: "Occupé",
  vendu: "Vendu",
  en_litige: "En litige",
};

export const STATUT_LOT_TONES: Record<string, Tone> = {
  libre: "neutral",
  reserve_equipement: "neutral",
  attribue: "accent",
  occupe: "success",
  vendu: "accent",
  en_litige: "danger",
};

export const statutLabel = (s: string | null | undefined) =>
  (s && STATUT_LOT_LABELS[s]) || s || "—";

export const statutTone = (s: string | null | undefined): Tone =>
  (s && STATUT_LOT_TONES[s]) || "neutral";

/** Regroupement des statuts en trois familles pour les compteurs d'accueil. */
export function grouperStatuts(statuts: (string | null | undefined)[]) {
  let enRegle = 0;
  let aSuivre = 0;
  let litige = 0;
  for (const s of statuts) {
    if (s === "en_litige") litige += 1;
    else if (s === "attribue" || s === "occupe" || s === "vendu") enRegle += 1;
    else aSuivre += 1; // libre, reserve_equipement, inconnu
  }
  return { enRegle, aSuivre, litige };
}

// ─── Score de confiance (mêmes seuils que le prototype) ─────────────────────────

export const scoreColor = (s: number): string =>
  s >= 80 ? "var(--success)" : s >= 50 ? "var(--warning)" : "var(--danger)";

export const scoreWord = (s: number): string =>
  s >= 80 ? "Élevé" : s >= 50 ? "Modéré" : "Faible";

export const scoreTone = (s: number): Tone =>
  s >= 80 ? "success" : s >= 50 ? "warning" : "danger";

// ─── Divers ─────────────────────────────────────────────────────────────────────

export const NATURE_DROIT_LABELS: Record<string, string> = {
  droit_coutumier: "Droit coutumier",
  attestation_villageoise: "Attestation villageoise",
  certificat_foncier: "Certificat foncier",
  acd: "ACD",
  titre_foncier: "Titre foncier",
};

export const natureDroitLabel = (n: string | null | undefined) =>
  (n && NATURE_DROIT_LABELS[n]) || n || "—";

export const QUALITE_LABELS: Record<string, string> = {
  ayant_droit: "Propriétaire d'origine",
  ayant_droit_transmission: "Ayant-droit par transmission",
  acquereur: "Acquéreur",
  operateur: "Opérateur",
  entrepreneur: "Entrepreneur",
  reservataire: "Réservataire",
};

export const qualiteLabel = (q: string | null | undefined) =>
  (q && QUALITE_LABELS[q]) || q || null;

export const GROUPE_LABELS: Record<string, string> = {
  chefferie: "Chefferie",
  proprietaire_terrien: "Propriétaire terrien",
  proprietaire: "Propriétaire",
  acquereur: "Acquéreur",
  amenageur: "Aménageur",
  operateur: "Opérateur",
  commissaire: "Commissaire",
  verificateur: "Vérificateur",
  geometre: "Géomètre",
  agent_ia: "Agent IA",
  admin: "Administration",
};

export const groupeLabel = (g: string | null | undefined) =>
  (g && GROUPE_LABELS[g]) || g || "Utilisateur";

export const initiales = (nom: string | null | undefined): string =>
  (nom || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";

export const prenom = (nom: string | null | undefined): string =>
  (nom || "").trim().split(/\s+/)[0] || "—";

export const fmtFCFA = (n: number | null | undefined): string =>
  n == null ? "—" : n.toLocaleString("fr-FR");

/** Horodatage relatif court, façon messagerie. */
export function fmtRelatif(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export const fmtHeure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

// ─── Notifications réelles (table `notifications`) ──────────────────────────────
// Le contenu « humain » vit dans `params` (etape/action/complement, lot, lieu),
// posé par les triggers métier. `type` donne le ton et un libellé de repli.

const NOTIF_TYPE_LABELS: Record<string, string> = {
  acquereur_vente_creee: "Achat enregistré",
  acquereur_certificat: "Vous êtes propriétaire",
  acquereur_attestation_prete: "Attestation prête",
  agence_nouvelle_demande: "Nouvelle demande d'acquisition",
  agence_attestation_a_facturer: "Attestation à facturer",
};

const NOTIF_TYPE_TONES: Record<string, Tone> = {
  acquereur_certificat: "success",
  acquereur_vente_creee: "accent",
  acquereur_attestation_prete: "accent",
  agence_nouvelle_demande: "warning",
  agence_attestation_a_facturer: "warning",
};

export type NotifRow = {
  id: string;
  type: string;
  params: Record<string, unknown> | null;
  cree_le: string;
};

export function decrireNotif(n: NotifRow): {
  id: string;
  title: string;
  body: string;
  tone: Tone;
  time: string;
} {
  const p = (n.params ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const title =
    str(p.etape) || str(p.action) || NOTIF_TYPE_LABELS[n.type] || "Notification";
  const body =
    str(p.complement) ||
    [str(p.lot), str(p.lieu)].filter(Boolean).join(" · ") ||
    "";
  return {
    id: n.id,
    title,
    body,
    tone: NOTIF_TYPE_TONES[n.type] ?? "neutral",
    time: fmtRelatif(n.cree_le),
  };
}
