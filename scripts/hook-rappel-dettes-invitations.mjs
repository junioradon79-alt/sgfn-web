#!/usr/bin/env node
// Rappel de démarrage de session : deux dettes ouvertes sur /dashboard/invitations
// (document directeur §4.3, #53 et #54), demandé par le propriétaire du projet
// le 17/08/2026 après le chantier commissaire Koelea-Accor.
const message =
  "Rappel — 2 dettes ouvertes sur /dashboard/invitations (doc directeur §4.3) :\n" +
  "#53 le bouton « Révoquer » écrit statut='revoquee', refusé par invitations_statut_check " +
  "(seules en_attente/utilisee/expiree/annulee sont autorisées) — le code reste actif.\n" +
  "#54 invitations_check ne couvre pas la branche groupe='commissaire' — seul le bouton " +
  "grisé de l'écran protège contre une invitation orpheline.";

process.stdout.write(JSON.stringify({ systemMessage: message }));
