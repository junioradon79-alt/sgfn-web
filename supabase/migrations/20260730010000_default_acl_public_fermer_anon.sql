-- =====================================================================
-- LA CAUSE RACINE : tout objet NEUF de `public` naissait ouvert a `anon`
-- =====================================================================
--
-- ⚠️⚠️  A LIRE AVANT DE DEBUGGER UNE LECTURE PUBLIQUE QUI NE MARCHE PAS  ⚠️⚠️
--
--   APRES CETTE MIGRATION, UNE TABLE PUBLIQUE LEGITIME CREEE PLUS TARD NE
--   SERA **PAS** LISIBLE PAR `anon`, MEME AVEC UNE POLICY RLS PERMISSIVE.
--
--   La RLS filtre les LIGNES ; le grant SQL autorise l'ACCES A LA TABLE.
--   Il faut les deux. Avant ce correctif le grant tombait tout seul, donc
--   ecrire la policy suffisait — et on a pris l'habitude de croire que la
--   policy « donnait » l'acces. Ce n'est plus vrai. Il faut desormais, dans
--   la migration qui cree l'objet et de facon EXPLICITE :
--
--       grant select on public.ma_table_publique to anon;
--       grant usage, select on sequence public.ma_seq to anon;
--
--   C'est le comportement voulu : securise par defaut, ouvert a la demande.
--
--   ⚠️ POUR LES FONCTIONS, C'EST L'INVERSE — LIRE LA SECTION « LIMITE 2 » :
--   une fonction neuve reste executable par `anon`. Ce fichier ne peut pas
--   l'empecher, et ce n'est pas une negligence : c'est mesure.
--
-- ---------------------------------------------------------------------
-- CE QUI ETAIT MESURE EN PRODUCTION LE 30/07/2026, AVANT CE FICHIER
-- ---------------------------------------------------------------------
--
-- `pg_default_acl` portait SIX entrees pour le schema `public` — trois types
-- d'objet croises avec deux proprietaires — et les six nommaient `anon` :
--
--   objtype 'f' fonctions  / postgres        : anon=X/postgres
--   objtype 'f' fonctions  / supabase_admin  : anon=X/supabase_admin
--   objtype 'r' tables     / postgres        : anon=arwdDxtm/postgres
--   objtype 'r' tables     / supabase_admin  : anon=arwdDxtm/supabase_admin
--   objtype 'S' sequences  / postgres        : anon=rwU/postgres
--   objtype 'S' sequences  / supabase_admin  : anon=rwU/supabase_admin
--
-- `arwdDxtm` = INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES,
-- TRIGGER, MAINTAIN. Autrement dit : chaque table creee dans `public`
-- naissait avec ecriture complete accordee a la cle publique anonyme. Les
-- 73 tables et vues de `public` la portent effectivement aujourd'hui ; la
-- seule chose qui retient `anon` est la RLS, sur chacune d'elles, sans
-- filet en dessous.
--
-- Ces defauts sont un heritage de l'initialisation du projet Supabase. Ils
-- ne se voient dans aucun ecran, et `\dp` ne les montre pas : il faut lire
-- `pg_default_acl` explicitement. C'est pour cela qu'ils ont survecu a
-- plusieurs audits.
--
-- ---------------------------------------------------------------------
-- LE PIEGE DE `ALTER DEFAULT PRIVILEGES` — POURQUOI SIX INSTRUCTIONS
-- ---------------------------------------------------------------------
--
-- `alter default privileges` sans clause `FOR ROLE` ne modifie QUE l'entree
-- du role qui l'execute. Trois instructions (fonctions, tables, sequences)
-- auraient donc corrige la moitie de la matrice en paraissant reussir : le
-- script serait passe sans erreur, et la moitie serait restee debout. D'ou
-- les SIX instructions, `FOR ROLE` explicite partout, et une relecture
-- reelle de `pg_default_acl` en fin de fichier plutot qu'une confiance dans
-- l'absence d'erreur.
--
-- =====================================================================
-- 🔴 LIMITE 1 — LES TROIS ENTREES `supabase_admin` NE SONT PAS CORRIGEES
-- =====================================================================
--
-- Ce n'est pas un oubli, c'est un refus du serveur, mesure :
--
--   alter default privileges for role supabase_admin ... => 42501
--       « permission denied to change default privileges »
--   set role supabase_admin                              => 42501
--       « permission denied to set role "supabase_admin" »
--
-- Le role de connexion (scripts/supabase-sql.ps1) est `postgres`, qui sur
-- Supabase heberge n'est PAS superutilisateur (`rolsuper = false`) et n'est
-- PAS membre de `supabase_admin` (`pg_has_role` faux en MEMBER comme en
-- USAGE). Aucun client SQL disponible ici ne peut ecrire ces trois entrees.
-- Il faudrait un acces de plateforme (support Supabase).
--
-- CE QUE CETTE LIMITE COUTE REELLEMENT — mesure, pas suppose :
--
--   Un defaut `FOR ROLE supabase_admin` ne s'applique qu'aux objets CREES
--   PAR `supabase_admin`. Or dans le schema `public` de ce projet :
--       138 fonctions   -> proprietaire `postgres` (138 sur 138)
--        73 tables/vues -> proprietaire `postgres` (73 sur 73)
--         7 sequences   -> proprietaire `postgres` (7 sur 7)
--   Aucun objet de `public` n'appartient a `supabase_admin`. Les migrations
--   du depot s'executent sous `postgres` : leurs objets tombent tous sous
--   les entrees corrigees ici. Les entrees residuelles ne se declencheraient
--   que si la plateforme Supabase creait elle-meme un objet dans `public`.
--
--   Risque residuel reel mais etroit, et NON refermable depuis ce depot.
--   Sentinelle a rejouer si un doute survient :
--       select c.relname, pg_get_userbyid(c.relowner)
--       from pg_class c join pg_namespace n on n.oid = c.relnamespace
--       where n.nspname = 'public' and c.relkind in ('r','p','v','m','S')
--         and pg_get_userbyid(c.relowner) <> 'postgres';
--
-- =====================================================================
-- 🔴 LIMITE 2 — LES FONCTIONS RESTENT EXECUTABLES PAR `anon`, ET
--               `ALTER DEFAULT PRIVILEGES` NE PEUT RIEN Y FAIRE
-- =====================================================================
--
-- C'est le point le plus contre-intuitif de ce fichier, et il a failli
-- passer pour un succes. Le controle « plus aucune mention de anon dans
-- pg_default_acl » passe au VERT pour les fonctions — et pourtant une
-- fonction neuve reste appelable par `anon`.
--
-- POURQUOI. PostgreSQL possede un defaut CABLE EN DUR (`acldefault()`) qui,
-- pour les fonctions seulement, accorde EXECUTE a `PUBLIC`. Les entrees de
-- `pg_default_acl` ne REMPLACENT pas ce defaut cable : elles s'y AJOUTENT.
-- Retirer `anon=X` de l'entree laisse donc apparaitre `=X/postgres`, le
-- grant implicite a PUBLIC — dont `anon` herite. Les tables et les
-- sequences n'ont pas ce probleme : leur defaut cable n'accorde rien a
-- PUBLIC.
--
-- QUATRE SONDES JETABLES, EN TRANSACTION ANNULEE, ONT ETABLI CECI :
--
--   entree pg_default_acl (postgres/f)          ACL de la fonction creee              anon ?
--   ------------------------------------------  ------------------------------------  ------
--   {postgres,authenticated,service_role}=X     {=X, postgres, authenticated, srv}=X   OUI
--   + grant execute to public                   {=X, postgres, authenticated, srv}=X   OUI
--   + revoke execute from public  (no-op)       {=X, postgres, authenticated, srv}=X   OUI
--   entree entierement supprimee                proacl NULL (= defaut cable)           OUI
--
--   La troisieme ligne est la plus importante : `alter default privileges
--   ... revoke execute on functions from public` est un NO-OP ici, parce que
--   l'entree ne contient pas `=X` a retirer. La recette repandue sur
--   internet ne fonctionne donc PAS sur cette installation.
--
-- CE QUI RESTE VRAI ET UTILE MALGRE TOUT. Le `revoke ... from anon` sur les
-- fonctions est conserve dans ce fichier : il supprime le grant NOMME. Une
-- fonction neuve naitra desormais avec `=X` (PUBLIC) mais SANS `anon=X`. Il
-- suffit donc d'UN seul `revoke ... from public` pour la fermer, la ou il en
-- fallait deux. Ce n'est pas cosmetique : la moitie des revocations ecrites
-- dans ce depot etaient inertes faute d'avoir vise PUBLIC.
--
-- CE QU'IL FAUT ECRIRE, DESORMAIS, DANS TOUTE MIGRATION QUI CREE UNE
-- FONCTION NON PUBLIQUE DANS `public` :
--
--       revoke execute on function public.ma_fonction(...) from public, anon;
--
-- et, pour une RPC VOLONTAIREMENT publique, un grant NOMME (jamais PUBLIC,
-- pour que l'intention soit relisible) :
--
--       revoke execute on function public.ma_rpc(...) from public;
--       grant  execute on function public.ma_rpc(...) to anon;
--
-- OPTION NON RETENUE ICI, MAIS TESTEE ET FAISABLE : un event trigger
-- `ddl_command_end` sur `CREATE FUNCTION` qui retirerait le seul grant
-- PUBLIC des fonctions neuves de `public` (jamais les grants nommes, donc
-- sans casser une RPC allowlistee rejouee en `create or replace`). La
-- creation d'event trigger par le role `postgres` a ete verifiee possible
-- sur ce projet (sqlstate 00000, en transaction annulee). Elle n'est pas
-- installee ici : elle depasse le perimetre de ce lot et modifierait le
-- comportement de TOUT DDL de production, y compris celui de la plateforme.
-- A trancher separement.
--
-- ---------------------------------------------------------------------
-- PERIMETRE : CE QUI N'EST PAS TOUCHE
-- ---------------------------------------------------------------------
--   * `authenticated`, `service_role`, `postgres` : intacts dans les six
--     entrees. Seul `anon` est retire. Un controle en fin de fichier le
--     verifie et fait echouer la migration si ce n'est pas le cas.
--   * Les defauts des autres schemas — `storage` (owner postgres, qui
--     nomme anon), `graphql`, `graphql_public`, `auth`, `realtime`, `cron`,
--     `extensions` : defauts de plateforme, hors perimetre.
--   * Les objets DEJA existants : `alter default privileges` est sans effet
--     retroactif, par construction. Les 93 fonctions deja ouvertes sont
--     traitees par 20260730020000 ; les 73 tables deja ouvertes en ecriture
--     a `anon` restent un chantier ouvert, protegees par la seule RLS.
--
-- Migration IDEMPOTENTE : revoquer un droit deja absent est sans effet.
-- =====================================================================

-- --- Proprietaire `postgres` : les trois types d'objet -----------------
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;

alter default privileges for role postgres in schema public
  revoke all on tables from anon;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon;

-- --- Proprietaire `supabase_admin` : tentative honnete -----------------
--
-- On TENTE quand meme, dans un bloc qui n'interrompt pas la migration : le
-- jour ou ce fichier serait rejoue par un role membre de `supabase_admin`
-- (support plateforme, restauration), la matrice se refermerait toute
-- seule. Aujourd'hui les trois lignes levent 42501 et sont journalisees en
-- WARNING. On ne fait PAS echouer la migration pour autant : le correctif
-- `postgres` — celui qui couvre 100 % des objets reels — doit s'appliquer.
do $$
declare
  t text;
begin
  foreach t in array array[
    'revoke execute on functions from anon',
    'revoke all on tables from anon',
    'revoke all on sequences from anon'
  ] loop
    begin
      execute format(
        'alter default privileges for role supabase_admin in schema public %s', t);
      raise notice 'default privileges supabase_admin : applique -> %', t;
    exception when insufficient_privilege then
      raise warning
        'default privileges supabase_admin NON applique (42501, attendu sous le role postgres) : %', t;
    end;
  end loop;
end $$;

-- --- Controle reel : on relit `pg_default_acl`, on ne se fie pas au
-- --- silence des instructions ci-dessus ---------------------------------
do $$
declare
  v_anon_postgres  int;
  v_anon_sup_admin int;
  v_legitimes      int;
  v_entrees        int;
begin
  select count(*) into v_entrees
  from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public';

  -- Reste-t-il `anon` dans les entrees appartenant a `postgres` ? -> non attendu
  select count(*) into v_anon_postgres
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public'
    and pg_get_userbyid(d.defaclrole) = 'postgres'
    and exists (select 1 from unnest(coalesce(d.defaclacl, '{}'::aclitem[])) a
                where a::text like 'anon=%');

  -- Idem pour `supabase_admin` -> 3 attendus tant que la LIMITE 1 tient
  select count(*) into v_anon_sup_admin
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public'
    and pg_get_userbyid(d.defaclrole) = 'supabase_admin'
    and exists (select 1 from unnest(coalesce(d.defaclacl, '{}'::aclitem[])) a
                where a::text like 'anon=%');

  -- Les roles legitimes doivent avoir survecu partout : 6 entrees x
  -- (authenticated + service_role) = 12 mentions attendues.
  select count(*) into v_legitimes
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  cross join unnest(coalesce(d.defaclacl, '{}'::aclitem[])) a
  where n.nspname = 'public'
    and (a::text like 'authenticated=%' or a::text like 'service_role=%');

  if v_anon_postgres > 0 then
    raise exception
      'Correctif inoperant : % entree(s) pg_default_acl du role postgres nomment encore anon.',
      v_anon_postgres;
  end if;

  if v_legitimes < 2 * v_entrees then
    raise exception
      'Correctif trop large : seulement % mentions authenticated/service_role sur % attendues.',
      v_legitimes, 2 * v_entrees;
  end if;

  if v_anon_sup_admin > 0 then
    raise warning
      'LIMITE 1 CONFIRMEE : % entree(s) pg_default_acl du role supabase_admin nomment encore anon (42501, non refermable sous postgres).',
      v_anon_sup_admin;
  end if;

  raise notice
    'pg_default_acl(public) : anon retire des entrees postgres (% entrees au total). Rappel LIMITE 2 : les fonctions neuves restent PUBLIC-executables.',
    v_entrees;
end $$;
