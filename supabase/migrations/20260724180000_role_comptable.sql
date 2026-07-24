-- Nouveau rôle interne SGNF : comptable, dédié aux modules Comptabilité +
-- Collaborateurs (RH) demandés le 24/07. Usage interne uniquement (pas de
-- portée multi-organisations) — au même titre que `admin`, ce rôle se
-- provisionne par SQL direct, pas par le flux d'invitation self-service des
-- opérateurs (`/dashboard/invitations`), qui ne doit pas pouvoir le créer.
--
-- Isolée dans sa propre migration : `ALTER TYPE ... ADD VALUE` ne peut pas
-- être utilisée dans la même transaction qu'une requête qui référence la
-- valeur ajoutée (ex. la fonction est_comptable() de la migration suivante).
alter type public.groupe_utilisateur add value if not exists 'comptable';
