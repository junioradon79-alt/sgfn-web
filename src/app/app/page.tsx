import type { Metadata } from "next";
import { MobileApp } from "@/features/mobile/MobileApp";

export const metadata: Metadata = {
  title: "SGNF · Mon espace",
  description: "Votre espace foncier mobile : parcelles, vérification, messages et notifications.",
};

// Espace mobile citoyen. Route autonome (hors /dashboard) : aucune sidebar ni
// en-tête web — l'app porte sa propre coquille à onglets.
export default function AppMobilePage() {
  return <MobileApp />;
}
