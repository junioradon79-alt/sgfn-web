-- =====================================================================
-- SORTIE DE SECOURS — desarmer l'event trigger qui ferme `anon` sur les
--                     fonctions neuves de `public`
-- =====================================================================
--
-- A QUOI CE FICHIER SERT
--   L'event trigger `evt_fonctions_neuves_fermees_a_anon`
--   (supabase/migrations/20260730030000) s'execute a la fin de CHAQUE
--   `create function` dans le schema `public`, et il ne rattrape AUCUNE
--   erreur : c'est deliberé (voir l'en-tete de la migration). Si ce
--   trigger se met a echouer, TOUT `create function` dans `public` echoue
--   avec lui — donc toute migration, tout deploiement, tout correctif
--   urgent.
--
--   Ce fichier est la seule sortie. Il est committe LE MEME JOUR que le
--   trigger, exprès, pour ne pas etre improvise a 3 h du matin.
--
-- 🔴 POURQUOI UN `drop` ET PAS UN SIMPLE DESARMEMENT
--
--   Les deux voies « propres » sont FERMEES sur cette base, mesure et non
--   suppose :
--
--     set event_triggers = off;
--         => 42501, permission denied to set parameter "event_triggers"
--            (le role de connexion `postgres` n'est pas superutilisateur
--             sur Supabase heberge : rolsuper = false)
--
--     alter event trigger evt_fonctions_neuves_fermees_a_anon disable;
--         => a n'utiliser QUE si elle passe (voir l'ETAPE 1 ci-dessous) ;
--            elle est preferable au drop car reversible par `enable`.
--
--   Le `drop event trigger` est donc la sortie garantie. Elle est sans
--   danger pour les donnees : un event trigger ne porte aucun etat, et le
--   supprimer ne modifie l'ACL d'AUCUNE fonction deja creee. On perd
--   seulement la protection sur les fonctions creees APRES le drop.
--
-- ---------------------------------------------------------------------
-- MODE D'EMPLOI — COMMANDE EXACTE
-- ---------------------------------------------------------------------
--
--   Depuis PowerShell, a la racine du depot :
--
--     .\scripts\supabase-sql.ps1 -SqlFile .\scripts\desarmer-event-trigger.sql
--
--   ⚠️ NE PAS ajouter `-ReadOnly` : c'est un DDL, il doit ecrire. De toute
--      facon `-ReadOnly` REFUSERAIT ce fichier, parce qu'il contient un
--      `begin` de corps plpgsql en debut de ligne.
--
--   ⚠️ `supabase-sql.ps1` prend un CHEMIN DE FICHIER (`-SqlFile`), jamais
--      une chaine SQL.
--
--   ⚠️ L'API de management ne rend que le resultat de la DERNIERE
--      instruction. C'est pourquoi ce fichier se termine par un unique
--      `select` de constat, qui affiche l'etat REEL apres coup.
--
-- ---------------------------------------------------------------------
-- APRES LE DESARMEMENT — CE QU'IL FAUT SAVOIR
-- ---------------------------------------------------------------------
--
--   1. Le trou se rouvre : toute fonction creee ensuite dans `public`
--      naitra avec `=X` (PUBLIC) et sera appelable sur
--      `/rest/v1/rpc/<nom>` avec la seule cle publique anonyme. Il faut
--      alors ecrire a la main, dans chaque migration :
--          revoke execute on function public.ma_fonction(...) from public, anon;
--
--   2. Le controle periodique de 20260730040000 reste en place et
--      continuera de HURLER (job `cron` en echec) des qu'une fonction hors
--      allowlist deviendra executable par `anon`. Le filet de securite
--      subsiste donc ; c'est tout l'interet d'avoir deux dispositifs.
--
--   3. Pour REARMER, rejouer la migration :
--          .\scripts\supabase-sql.ps1 -SqlFile .\supabase\migrations\20260730030000_event_trigger_fonctions_neuves_fermees_a_anon.sql
--      Elle est idempotente et traite LES DEUX sorties de ce script : elle
--      recree le trigger s'il a ete supprime, et le REACTIVE s'il n'a ete
--      que desactive. Elle re-verifie ensuite son effet par une sonde
--      jetable, donc un rearmement qui ne rearmerait pas echouerait.
-- =====================================================================

-- --- ETAPE 1 : tenter le desarmement REVERSIBLE, sinon supprimer -------
--
-- On privilegie `disable` (reversible d'un `enable`). S'il est refuse, on
-- retombe sur le `drop`, qui est la sortie garantie. Le `raise notice`
-- indique laquelle des deux voies a effectivement ete prise.

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_event_trigger
    where evtname = 'evt_fonctions_neuves_fermees_a_anon'
  ) then
    raise notice 'Rien a faire : event trigger evt_fonctions_neuves_fermees_a_anon absent.';
    return;
  end if;

  begin
    alter event trigger evt_fonctions_neuves_fermees_a_anon disable;
    raise notice 'DESARME (reversible) : evtenabled passe a D. Rearmer avec ALTER EVENT TRIGGER ... ENABLE.';
  exception when others then
    -- Ce `exception` est ici LEGITIME, et c'est le seul du lot : on est
    -- dans la sortie de secours, ou l'objectif est de reussir a desarmer
    -- par n'importe quel moyen. Il ne masque rien : l'echec du `disable`
    -- est journalise, et le `drop` qui suit est lui-meme verifie par le
    -- `select` final.
    raise notice 'ALTER ... DISABLE refuse (% / %). Bascule sur DROP.', sqlstate, sqlerrm;
    drop event trigger evt_fonctions_neuves_fermees_a_anon;
    raise notice 'SUPPRIME : evt_fonctions_neuves_fermees_a_anon n''existe plus.';
  end;
end $$;

-- --- ETAPE 2 : constat REEL, pas une intention -------------------------
--
-- Unique `select` du fichier, donc le seul resultat que l'API rendra.
-- `etat_trigger` vaut :
--   'ABSENT'  -> supprime, le trou est rouvert
--   'DESACTIVE' -> present mais inerte, le trou est rouvert
--   'ACTIF'   -> 🔴 le desarmement a ECHOUE, ne pas se fier a ce script

select jsonb_build_object(
  'etat_trigger', coalesce(
    (select case evtenabled when 'O' then 'ACTIF' else 'DESACTIVE' end
     from pg_catalog.pg_event_trigger
     where evtname = 'evt_fonctions_neuves_fermees_a_anon'),
    'ABSENT'),
  'desarme', not exists (
    select 1 from pg_catalog.pg_event_trigger
    where evtname = 'evt_fonctions_neuves_fermees_a_anon' and evtenabled = 'O'),
  -- La fonction n'est PAS supprimee : elle est inerte sans son trigger, et
  -- la conserver permet de rearmer sans rejouer toute la migration.
  'fonction_conservee', exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'evt_fermer_public_sur_fonctions_neuves'),
  'controle_periodique_toujours_actif', exists (
    select 1 from cron.job where jobname = 'securite-exposition-anon' and active),
  'rappel', 'Le controle periodique 20260730040000 reste le filet. Rearmer via la migration 20260730030000.'
) as constat;
