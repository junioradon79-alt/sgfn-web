-- =====================================================================
-- EVENT TRIGGER : une fonction neuve de `public` ne naitra plus
--                 executable par `anon`
-- =====================================================================
--
-- ⚠️⚠️  A LIRE AVANT D'ECRIRE UNE MIGRATION QUI CREE UNE RPC PUBLIQUE  ⚠️⚠️
--
--   DEPUIS CE FICHIER, `create function` DANS `public` PERD AUTOMATIQUEMENT
--   SON GRANT `PUBLIC` — DONC `anon` NE PEUT PLUS L'APPELER.
--
--   Pour ouvrir DELIBEREMENT une fonction a `anon`, il faut desormais un
--   grant NOMME, ecrit APRES le `create` dans la meme migration :
--
--       create or replace function public.ma_rpc(...) ... ;
--       grant execute on function public.ma_rpc(...) to anon;   -- <= APRES
--
--   L'ordre n'est pas decoratif : l'event trigger se declenche a la FIN du
--   `create function`. Un grant ecrit AVANT serait retire ; un grant ecrit
--   APRES survit, parce que ce trigger ne touche JAMAIS un grant nomme.
--
--   C'est aussi ce qui rend une allowlist inutile ici : les 19 signatures
--   ouvertes a `anon` (voir 20260730020000) portent toutes `anon=X/postgres`,
--   un grant NOMME, et `create or replace` CONSERVE l'ACL d'une fonction
--   existante. Les rejouer ne les referme donc pas. Verifie, pas suppose :
--   voir la section PREUVES en fin de fichier.
--
-- ---------------------------------------------------------------------
-- POURQUOI CE FICHIER EXISTE — LE TROU QUE 20260730010000 NE POUVAIT PAS
-- FERMER
-- ---------------------------------------------------------------------
--
-- 20260730010000 a retire `anon` des `pg_default_acl` du schema `public`.
-- Cela a suffi pour les TABLES et les SEQUENCES, dont le defaut cable
-- n'accorde rien a PUBLIC. Cela n'a RIEN pu faire pour les FONCTIONS :
-- PostgreSQL possede un defaut CABLE EN DUR (`acldefault()`) qui accorde
-- EXECUTE a `PUBLIC` sur toute fonction neuve, et les entrees de
-- `pg_default_acl` s'y AJOUTENT au lieu de le remplacer. Quatre sondes
-- l'avaient etabli, dont le cas ou l'entree est entierement supprimee
-- (proacl NULL, `anon` execute quand meme) et le cas
-- `alter default privileges ... revoke execute on functions from public`,
-- qui est un PUR NO-OP sur cette installation.
--
-- Autrement dit : sans ce fichier, chaque nouvelle fonction de `public`
-- redevient appelable sur `/rest/v1/rpc/<nom>` avec la seule cle publique
-- anonyme. Le travail de 20260730020000 (93 -> 19) se serait erode a chaque
-- migration suivante, silencieusement.
--
-- Un event trigger `ddl_command_end` est la SEULE construction qui referme
-- ce trou : il agit apres la creation, la ou aucun defaut declaratif ne
-- peut intervenir.
--
-- ---------------------------------------------------------------------
-- CE QUE LE TRIGGER FAIT, EXACTEMENT — ET CE QU'IL NE FAIT PAS
-- ---------------------------------------------------------------------
--
--   Il execute `revoke execute on function <objet> from public`.
--
--   `from public` designe le PSEUDO-ROLE PUBLIC, pas le schema `public`.
--   Cette instruction retire le SEUL aclitem `=X` — celui qui n'a pas de
--   beneficiaire nomme a gauche du `=`. Elle ne peut, par construction,
--   pas retirer `anon=X`, `authenticated=X` ni `service_role=X`.
--
--   Concretement, sur une fonction neuve dont l'ACL vaut
--       {=X/postgres, postgres=X/postgres, authenticated=X/postgres,
--        service_role=X/postgres}
--   le trigger laisse
--       {postgres=X/postgres, authenticated=X/postgres,
--        service_role=X/postgres}
--   `anon` perd EXECUTE ; `authenticated` et `service_role` sont intacts.
--
-- CE QU'IL NE FAIT PAS, ET QU'IL NE FAUT PAS LUI DEMANDER :
--   * il ne referme RIEN de retroactif — les objets deja crees ne sont pas
--     touches, ce fichier n'ecrit sur aucun objet existant ;
--   * il ne touche pas aux TABLES ni aux VUES (tag `CREATE FUNCTION` seul) ;
--   * il ne couvre pas `CREATE PROCEDURE` — la forme exacte du tag a ete
--     arretee a `CREATE FUNCTION`. Aucune procedure n'existe aujourd'hui
--     dans `public` (138 objets, tous `prokind = 'f'`), mais une procedure
--     future naitrait ouverte a `anon`. C'est un trou CONNU, couvert par le
--     controle periodique de 20260730040000, pas par ce trigger.
--
-- ---------------------------------------------------------------------
-- 🔴 AUCUN `exception when others then null` DANS CE FICHIER
-- ---------------------------------------------------------------------
--
-- C'est deliberé et non negociable. Si le `revoke` echoue, le DDL entier
-- doit etre ANNULE BRUYAMMENT. Avaler l'erreur produirait exactement le
-- resultat que ce lot cherche a empecher : une migration qui passe au vert
-- alors qu'elle vient de creer une fonction ouverte a `anon`. Ce depot a
-- deja paye trois faux verts (`-ReadOnly` inerte, `revoke ... from public`
-- inerte, `signatures_requises` jamais lue) ; il n'en paiera pas un
-- quatrieme ici.
--
-- La contrepartie est assumee : si ce trigger casse, TOUT `create function`
-- dans `public` echoue. C'est pour cela que la sortie de secours est livree
-- LE MEME JOUR, committee, et pas improvisee a 3 h du matin :
--
--       scripts/desarmer-event-trigger.sql
--
--   🔴 `set event_triggers = off` NE MARCHE PAS sur cette base : elle rend
--   42501 (« permission denied to set parameter »), parce que le role de
--   connexion n'est pas superutilisateur. MESURE, pas suppose. Le
--   `drop event trigger` est donc la SEULE sortie de secours.
--
-- ---------------------------------------------------------------------
-- PERIMETRE REEL — CE QUE supautils LAISSE PASSER
-- ---------------------------------------------------------------------
--
-- `supautils` est charge sur cette base, et `supautils.privileged_role`
-- vaut `supabase_privileged_role`, dont `postgres` est membre (mesure :
-- `pg_has_role` vrai en MEMBER). C'est ce qui autorise `postgres`, non
-- superutilisateur, a creer un event trigger la ou PostgreSQL standard le
-- reserve aux superutilisateurs.
--
-- En contrepartie, supautils IGNORE cet event trigger pour :
--   * les superutilisateurs (dont `supabase_admin`, proprietaire des 6
--     event triggers de plateforme deja presents) ;
--   * les 13 roles reserves de la plateforme ;
--   * `CREATE EXTENSION`.
--
-- Une fonction creee par la plateforme Supabase elle-meme echappe donc a ce
-- trigger. Ce n'est pas une negligence : c'est precisement la raison pour
-- laquelle 20260730040000 installe un controle periodique EN PLUS. Les deux
-- dispositifs sont complementaires et aucun ne couvre seul le perimetre.
-- Le trigger EMPECHE ; le controle CONSTATE ce que le trigger n'a pas vu.
--
-- ---------------------------------------------------------------------
-- ETAT MESURE EN PRODUCTION LE 30/07/2026, AVANT CE FICHIER
-- ---------------------------------------------------------------------
--   138 fonctions dans `public`, dont 19 executables par `anon`, TOUTES par
--   grant NOMME (`anon=X/postgres`). ZERO fonction ne porte plus de grant
--   implicite a PUBLIC (`=X/...`) : la requete de controle rend une liste
--   vide. Ce trigger n'a donc AUCUN effet sur l'existant — il ne joue que
--   sur ce qui sera cree apres lui.
--
-- Migration IDEMPOTENTE : `create or replace` pour la fonction, creation de
-- l'event trigger gardee par un test d'existence (aucun `drop`).
-- =====================================================================

-- --- 1. La fonction de l'event trigger --------------------------------
--
-- SECURITY DEFINER : le `revoke` doit reussir meme si le DDL est joue par
-- un role qui n'est pas proprietaire du schema. La fonction appartient a
-- `postgres`, proprietaire des 138 fonctions de `public` (verifie).
--
-- `search_path` fige a `pg_catalog, public` : une fonction SECURITY DEFINER
-- sans search_path fige est detournable. `pg_catalog` en tete garantit en
-- outre que `format`, `pg_event_trigger_ddl_commands` et les operateurs
-- utilises ici ne peuvent pas etre masques par un objet de `public`.

create or replace function public.evt_fermer_public_sur_fonctions_neuves()
returns event_trigger
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  r record;
begin
  for r in
    select c.object_identity
    from pg_catalog.pg_event_trigger_ddl_commands() c
    where c.command_tag = 'CREATE FUNCTION'
      -- Le schema d'abord : ce trigger ne regit QUE `public`. Les schemas
      -- de plateforme (auth, storage, realtime, extensions, cron, graphql)
      -- gardent leur comportement d'origine.
      and c.schema_name = 'public'
      -- `not in_extension` : une fonction apportee par `create extension`
      -- appartient a l'extension. Lui retirer un grant la desynchroniserait
      -- de son script d'installation, et casserait un futur
      -- `alter extension update`.
      and not c.in_extension
      -- Ceinture et bretelles : le tag `CREATE FUNCTION` ne produit que du
      -- `pg_proc`, mais on ne construit un `revoke execute on function`
      -- que sur un objet dont on a verifie la classe.
      and c.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
  loop
    -- `object_identity` est deja qualifie par le schema et correctement
    -- quote par PostgreSQL (ex. `public.ma_rpc(text)`), y compris pour un
    -- nom qui exigerait des guillemets. On ne reconstruit donc PAS
    -- l'identite a la main a partir de proname/proargtypes.
    --
    -- 🔴 AUCUN bloc `exception` ici, VOLONTAIREMENT. Un echec de ce
    -- `revoke` doit remonter et annuler le `create function` appelant.
    execute pg_catalog.format(
      'revoke execute on function %s from public', r.object_identity);
  end loop;
end;
$$;

-- La fonction de l'event trigger n'a aucune raison d'etre appelable par
-- qui que ce soit : PostgreSQL l'invoque lui-meme. On la ferme sur les deux
-- mecanismes — PUBLIC ET le grant nomme — parce que fermer `anon` seul
-- laisserait `=X` debout (leçon de 20260730020000 : 63 fonctions sur 93
-- tenaient par PUBLIC, et un `revoke ... from anon` seul les aurait toutes
-- laissees ouvertes en paraissant reussir).
revoke execute on function public.evt_fermer_public_sur_fonctions_neuves()
  from public, anon;

-- --- 2. L'event trigger ------------------------------------------------
--
-- Cree sous condition d'absence : ce fichier n'emet aucun `drop`, y compris
-- `drop ... if exists`. Pour le desarmer, passer par
-- scripts/desarmer-event-trigger.sql ; pour REARMER, rejouer ce fichier.
--
-- Les TROIS cas sont traites, et c'est necessaire : la sortie de secours
-- tente d'abord un `alter event trigger ... disable`, qui laisse le trigger
-- PRESENT mais INERTE. Sans la branche « present et desactive » ci-dessous,
-- rejouer cette migration ne rearmerait rien et echouerait ensuite sur sa
-- propre assertion `evtenabled <> 'O'` — un rearmement qui ne rearme pas.

do $$
declare
  v_enabled "char";
begin
  select evtenabled into v_enabled
  from pg_catalog.pg_event_trigger
  where evtname = 'evt_fonctions_neuves_fermees_a_anon';

  if v_enabled is null then
    create event trigger evt_fonctions_neuves_fermees_a_anon
      on ddl_command_end
      when tag in ('CREATE FUNCTION')
      execute function public.evt_fermer_public_sur_fonctions_neuves();
    raise notice 'Event trigger CREE.';
  elsif v_enabled <> 'O' then
    alter event trigger evt_fonctions_neuves_fermees_a_anon enable;
    raise notice 'Event trigger present mais desactive : REARME.';
  else
    raise notice 'Event trigger deja actif : rien a faire.';
  end if;
end $$;

-- --- 3. Verification EXECUTEE, pas supposee ----------------------------
--
-- La migration echoue si le dispositif n'est pas reellement en place ou
-- s'il ne produit pas l'effet attendu. Le controle porte sur `proacl`, et
-- non sur « plus aucune mention de anon » : ce dernier est un FAUX VERT
-- connu et documente sur ce projet, puisque le droit peut venir de PUBLIC
-- sans que `anon` soit jamais nomme.

do $$
declare
  v_acl        text;
  v_anon_exec  boolean;
  v_enabled    "char";
  v_tags       text[];
  v_event      text;
begin
  -- 3a) L'event trigger existe, est ACTIF, et porte le bon evenement et le
  --     bon tag. Un trigger cree mais desactive donnerait un vert complet
  --     et ne protegerait rien.
  select evtenabled, evttags, evtevent
    into v_enabled, v_tags, v_event
  from pg_catalog.pg_event_trigger
  where evtname = 'evt_fonctions_neuves_fermees_a_anon';

  if v_enabled is null then
    raise exception 'Event trigger evt_fonctions_neuves_fermees_a_anon absent apres creation.';
  end if;
  if v_enabled <> 'O' then
    raise exception 'Event trigger present mais NON actif (evtenabled = %).', v_enabled;
  end if;
  if v_event <> 'ddl_command_end' then
    raise exception 'Event trigger sur le mauvais evenement : %.', v_event;
  end if;
  if v_tags is distinct from array['CREATE FUNCTION']::text[] then
    raise exception 'Event trigger sur les mauvais tags : %.', v_tags;
  end if;

  -- 3b) SONDE JETABLE. On cree une fonction dans `public` et on RELIT son
  --     `proacl`. C'est le seul controle qui ne ment pas.
  execute 'create function public._tmp_sonde_evt_20260730() returns int '
       || 'language sql immutable as $sonde$ select 1 $sonde$';

  select coalesce(p.proacl::text, 'NULL'),
         pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
    into v_acl, v_anon_exec
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '_tmp_sonde_evt_20260730';

  -- Suppression de la sonde AVANT tout `raise exception`, pour ne laisser
  -- aucun residu si l'assertion echoue.
  execute 'drop function public._tmp_sonde_evt_20260730()';

  if v_anon_exec then
    raise exception
      'Event trigger INOPERANT : une fonction neuve reste executable par anon (proacl = %).', v_acl;
  end if;

  -- Second controle, redondant a dessein : `has_function_privilege` a deja
  -- tranche ci-dessus, mais on verifie AUSSI que l'aclitem de PUBLIC a
  -- physiquement disparu de `proacl`. Un aclitem PUBLIC se rend sans
  -- beneficiaire a gauche du `=` : `{=X/postgres,...}` en tete de tableau,
  -- ou `,=X/postgres` ailleurs. C'est exactement le motif que le trigger
  -- doit avoir retire, et le seul qu'il ait le droit de retirer.
  if v_acl like '{=X/%' or v_acl like '%,=X/%' then
    raise exception
      'Event trigger INOPERANT : le grant PUBLIC (=X) subsiste (proacl = %).', v_acl;
  end if;

  -- Et le trigger ne doit avoir touche PERSONNE d'autre : une fonction
  -- neuve doit rester executable par `authenticated` et `service_role`,
  -- qui les tiennent des `pg_default_acl` corriges en 20260730010000.
  if v_acl not like '%authenticated=X%' or v_acl not like '%service_role=X%' then
    raise exception
      'Event trigger TROP LARGE : authenticated ou service_role a perdu EXECUTE (proacl = %).', v_acl;
  end if;

  raise notice
    'Event trigger actif. Sonde jetable : proacl = %, anon EXECUTE = %.',
    v_acl, v_anon_exec;
end $$;
