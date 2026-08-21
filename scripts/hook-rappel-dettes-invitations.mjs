#!/usr/bin/env node
// Rappel de démarrage de session : dettes ouvertes sur /dashboard/invitations
// (document directeur §4.3), demandé par le propriétaire du projet le 17/08/2026
// après le chantier commissaire Koelea-Accor.
// #53 corrigée le 21/08 (statut annulee au lieu de revoquee) — retirée du rappel.
// #61/#62 (numérotation §4.3) trouvées par le vérificateur le 21/08 en fermant #53.
// #63 (téléphone obligatoire non gardé en base) trouvée le 21/08 en livrant la Phase 1
// du chantier notifications WhatsApp — le formulaire l'impose, la policy INSERT non.
const message =
  "Rappel — dettes ouvertes sur /dashboard/invitations (doc directeur §4.3) :\n" +
  "#54 invitations_check ne couvre pas la branche groupe='commissaire' — seul le bouton " +
  "grisé de l'écran protège contre une invitation orpheline.\n" +
  "#61 fetchInvitations ignore l'erreur RLS et affiche « Aucune invitation » à " +
  "operateur/amenageur/proprietaire_terrien au lieu du refus réel.\n" +
  "#62 handleRevoquer n'a pas de .select() — un refus RLS silencieux laisse la ligne " +
  "« En attente » sans message.\n" +
  "#63 le téléphone obligatoire à l'invitation n'est imposé qu'à l'écran (required HTML) " +
  "— aucune contrainte CHECK en base, un admin via API/PostgREST peut encore l'omettre.";

process.stdout.write(JSON.stringify({ systemMessage: message }));
