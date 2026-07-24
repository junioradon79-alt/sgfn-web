-- Rôle `collaborateur` : compte de connexion minimal pour un membre de
-- l'annuaire RH (`collaborateurs`), pour qu'il puisse accéder à sa propre
-- fiche + la messagerie. Séparé de la migration suivante car ALTER TYPE ...
-- ADD VALUE ne peut pas être utilisé dans la transaction qui le référence.
alter type public.groupe_utilisateur add value if not exists 'collaborateur';
