-- Rattachement de l'autorité coutumière du lotissement Brignan Kakodji (13/07/2026 soir)
--
-- autorite_coutumiere_id était NULL -- gap fonctionnel réel : creer_cession()
-- exige cette colonne pour calculer le tarif dès la 3e attestation (rang >= 3),
-- sinon "Ce lotissement n'a pas d'autorite coutumiere associee". La chefferie
-- réelle est la Chefferie d'Ebimpe, déjà utilisée par Koelea-Accor revu (même
-- village) et déjà tarifée dans tarifs_attestation_chefferie.

update public.lotissements
set autorite_coutumiere_id = 'a9c32cda-66bb-4f8b-b661-2c0ec0127dcb'
where nom = 'Brignan Kakodji' and autorite_coutumiere_id is null;
