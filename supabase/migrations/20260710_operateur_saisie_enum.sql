-- Module « Opérateur de saisie » — étape 1a : nouvelle valeur d'enum.
-- Rôle dédié à la saisie/mise à jour des attributions et à la création de structure
-- (lotissements/îlots/lots), avec workflow maker-checker (l'admin valide avant application).
-- Additif, façon 'proprietaire_terrien'. DOIT être committé AVANT toute utilisation de la
-- valeur (Postgres interdit d'utiliser une valeur d'enum dans la transaction qui l'ajoute)
-- → le reste du module est dans 20260710_operateur_saisie_module.sql.

ALTER TYPE public.groupe_utilisateur ADD VALUE IF NOT EXISTS 'operateur_saisie' AFTER 'operateur';
