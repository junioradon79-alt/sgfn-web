-- Nouveau rôle "Propriétaire terrien" — remplace, pour les NOUVELLES familles/lotissements
-- uniquement, le sous-rôle "chef de famille" jusqu'ici confondu avec "chefferie" (chef de
-- village). Les comptes existants (ex. Koelea-Accor Revu / N'CHO KOUTOUAN JULES) restent
-- sous l'ancien modèle groupe='chefferie'+famille_id indéfiniment — coexistence permanente,
-- pas une migration. Voir 20260707_add_proprietaire_terrien_rls.sql pour les policies.

ALTER TYPE public.groupe_utilisateur ADD VALUE IF NOT EXISTS 'proprietaire_terrien' AFTER 'chefferie';
