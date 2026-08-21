#!/usr/bin/env node
// Rappel de démarrage de session : dettes ouvertes sur /dashboard/invitations
// (document directeur §4.3), demandé par le propriétaire du projet le 17/08/2026
// après le chantier commissaire Koelea-Accor.
// #53 corrigée le 21/08 (statut annulee au lieu de revoquee) — retirée du rappel.
const message =
  "Rappel — dettes ouvertes sur /dashboard/invitations (doc directeur §4.3) :\n" +
  "#54 invitations_check ne couvre pas la branche groupe='commissaire' — seul le bouton " +
  "grisé de l'écran protège contre une invitation orpheline.\n" +
  "#55 (trouvée par le vérificateur le 21/08) fetchInvitations ignore l'erreur RLS et " +
  "affiche « Aucune invitation » à operateur/amenageur/proprietaire_terrien au lieu du refus réel.";

process.stdout.write(JSON.stringify({ systemMessage: message }));
