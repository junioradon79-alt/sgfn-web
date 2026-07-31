-- ═══════════════════════════════════════════════════════════════════════════
-- S2 — `lot_ids_chefferie()` : la juridiction, et plus l'appartenance familiale
-- ═══════════════════════════════════════════════════════════════════════════
--
-- MOTIF — directive du 29/07/2026 : chefferie ≠ chef de famille.
--
-- Corps retire :
--
--     or (lo.famille_id is not null
--         and lo.famille_id = (select p.famille_id from profiles p
--                              where p.id = auth.uid()))
--
-- Mesure du 31/07/2026, par emprunt de role, UNE TRANSACTION PAR IDENTITE,
-- temoin `auth.uid()` releve DANS la transaction :
--
--   e7091e37-… « Compte Test — Chefferie »   juridiction a9c32cda, famille (null)
--        lot_ids_chefferie() = 898     attributions lues = 1358   attributaires = 57
--
--   0be830c7-… N'CHO KOUTOUAN JULES         juridiction (null),  famille 2f980fc3
--        lot_ids_chefferie() = 49      attributions lues = 117    attributaires = 44
--
-- Le second compte n'a AUCUNE juridiction : `ma_chefferie_id()` y vaut NULL.
-- Les 49 lots qu'il atteignait venaient tous de la branche famille. Son
-- attributaire `d0c68018-…` ne detient plus RIEN (35 attributions, toutes
-- `actuel = false`) : c'est un cedant integral. Et par cette branche il lisait
-- 2 successeurs NOMMES EN CLAIR de ses propres lots cedes, via la policy
-- `attributaires_read_metier`. C'est precisement ce que la seconde phrase de
-- l'instruction du 29/07 interdit.
--
-- ⚠️ CETTE FONCTION A PLUSIEURS APPELANTS — releves en base, pas supposes :
--
--   policy `attributions_read`          (table `attributions`)  branche chefferie
--   policy `attributaires_read_metier`  (table `attributaires`) branche chefferie
--   fonction `soumettre_saisie(...)`    gardes d'ECRITURE du maker-checker (30/07)
--
--   (Le cahier de charges citait aussi `pv_famille_lots_commissaire_read` :
--    verification faite, cette policy appelle `lot_ids_commissaire()`, pas
--    `lot_ids_chefferie()`. Elle n'est pas concernee.)
--
-- L'effet sur les trois est VOULU et mesure. Pour l'ecriture, le banc
-- `scripts/e2e-chefferie-perimetre-saisie.sql` distingue un refus de garde
-- (`P0001`) d'une garde franchie (`25006`) sans deposer une ligne : il est
-- rejoue avant et apres.
--
-- ⭐ TEMOIN POSITIF : la chefferie qui a une juridiction ne perd RIEN.
-- e7091e37-… reste a 898 lots / 1358 attributions / 57 attributaires, et
-- continue de franchir toutes ses gardes d'ecriture legitimes.
--
-- Fail-closed par construction : `ma_chefferie_id()` NULL rend
-- `lo.autorite_coutumiere_id = NULL` -> NULL -> ligne EXCLUE. C'est le bon
-- sens du piege « une garde qui vaut NULL ne refuse rien » (§5 bis) : ici le
-- NULL restreint, il n'ouvre pas.

create or replace function public.lot_ids_chefferie()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select l.id
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where lo.autorite_coutumiere_id = public.ma_chefferie_id();
$function$;

-- Regle permanente §5 bis ① : le defaut du moteur est CABLE vers PUBLIC.
-- Un `create or replace` conserve l'ACL existante, mais on reaffirme les deux
-- revocations nommement pour que l'intention reste lisible dans `proacl`.
revoke execute on function public.lot_ids_chefferie() from public, anon;
grant  execute on function public.lot_ids_chefferie() to authenticated, service_role;

comment on function public.lot_ids_chefferie() is
  'Lots de la JURIDICTION de la chefferie appelante (`lotissements.autorite_coutumiere_id = ma_chefferie_id()`). La branche « ou meme famille que l''appelant » a ete RETIREE le 31/07/2026 : directive du 29/07, chefferie ≠ chef de famille. Elle donnait a un compte chefferie sans juridiction (0be830c7-…, cedant integral) 49 lots, 117 attributions et le nom en clair de 2 successeurs de ses propres lots cedes. Appelants : policies `attributions_read` et `attributaires_read_metier`, et les gardes d''ecriture de `soumettre_saisie`.';
