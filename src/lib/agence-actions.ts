// Logique partagée « action à faire côté agence » pour le tunnel de vente.
// Utilisée par le badge rouge du menu (Sidebar) ET par les pastilles de la page
// Demandes d'acquisition, pour un signal cohérent : rouge = c'est à NOUS de jouer.

export type AgenceDemande = {
  statut: string;
  vente_id: string | null;
  vente_statut: string | null;
  vente_paiement_statut: string | null;
  cession_id: string | null;
  paiement_statut: string | null;
  attestation_reference: string | null;
};

const OUVERTES = ["nouvelle", "en_discussion", "accord"];

/**
 * true = une action de l'agence est requise MAINTENANT (≠ « en attente du
 * paiement en ligne de l'acquéreur », qui n'est pas notre tour).
 */
export function actionAgenceRequise(d: AgenceDemande): boolean {
  if (d.attestation_reference) return false; // tunnel terminé
  if (OUVERTES.includes(d.statut)) return true; // demande à traiter / vente à créer
  if (d.statut !== "convertie") return false; // refusée / annulée
  const venteSoldee = d.vente_statut === "soldee";
  if (!venteSoldee) {
    // Paiement du lot au guichet en attente de validation = à encaisser.
    return d.vente_paiement_statut === "en_attente_validation";
  }
  if (!d.cession_id) return true; // vente soldée → attestation à facturer
  // Attestation facturée, paiement guichet en attente = à encaisser.
  return d.paiement_statut === "en_attente_validation";
}

/** Libellé court de l'action attendue (pour la pastille). null si rien à faire. */
export function libelleActionAgence(d: AgenceDemande): string | null {
  if (!actionAgenceRequise(d)) return null;
  if (OUVERTES.includes(d.statut)) return "À traiter";
  const venteSoldee = d.vente_statut === "soldee";
  if (!venteSoldee) return "Encaisser le lot";
  if (!d.cession_id) return "Facturer l'attestation";
  return "Encaisser l'attestation";
}
