-- =====================================================================
-- CONTROLE PERIODIQUE : hurler des qu'une exposition anonyme apparait
-- =====================================================================
--
-- POURQUOI CE FICHIER EN PLUS DE L'EVENT TRIGGER (20260730030000)
--
--   L'event trigger EMPECHE ; ce controle CONSTATE. Aucun des deux ne
--   couvre seul le perimetre, et c'est la raison pour laquelle ils sont
--   decides ensemble.
--
--   Ce que l'event trigger NE VOIT PAS, et que ce controle rattrape :
--     * les 64 TABLES de base — le trigger ne filtre que `CREATE FUNCTION` ;
--     * les 9 VUES — meme raison ;
--     * tout objet cree par un role EXEMPTE par supautils : les
--       superutilisateurs (dont `supabase_admin`), les 13 roles reserves
--       de la plateforme, et `CREATE EXTENSION` ;
--     * `CREATE PROCEDURE`, hors du tag retenu pour le trigger ;
--     * un `grant execute ... to anon` pose APRES coup sur une fonction
--       existante — aucun event trigger `ddl_command_end` sur
--       `CREATE FUNCTION` ne le verra jamais ;
--     * la disparition du trigger lui-meme, via
--       scripts/desarmer-event-trigger.sql.
--
--   Ce dernier point est le plus important : le jour ou l'event trigger
--   sera desarme en urgence, ce controle restera le seul filet. Il est
--   ecrit pour continuer a fonctionner sans lui.
--
-- ---------------------------------------------------------------------
-- 🔴 COMMENT IL HURLE — ET POURQUOI PAS AUTREMENT
-- ---------------------------------------------------------------------
--
--   Sur ecart, la fonction ordonnancee LEVE UNE EXCEPTION. `pg_cron`
--   enregistre alors le run en `status = 'failed'` dans
--   `cron.job_run_details`, avec le detail complet dans `return_message`.
--   C'est durable, horodate, interrogeable, et visible dans le tableau de
--   bord Supabase (rubrique Cron, historique du job). Et comme le controle
--   repasse toutes les heures, il RECRIE tant que l'ecart n'est pas traite
--   ou admis : il ne s'eteint pas tout seul.
--
--   VERIFIE AVANT D'ETRE CHOISI, pas suppose :
--     `cron.log_run` vaut `on` sur cette base, et `cron.job_run_details`
--     contenait 4 466 lignes au 30/07/2026 (38 + 38 + 4 390 sur les trois
--     jobs existants), la plus recente a la minute pres. Le journal est
--     donc REELLEMENT alimente. Un siren branche sur un journal eteint
--     aurait ete un faux vert de plus.
--
--   POURQUOI PAS `enqueue_notification` / WhatsApp — MESURE, PAS SUPPOSE :
--     Le rail de notification de ce depot est ARRETE en sortie. Au
--     30/07/2026, `public.notifications` contient 24 lignes, TOUTES en
--     `canal = 'whatsapp'` et `statut = 'en_attente'`, `envoye_le` NULL,
--     la plus recente datant du 23/07. Le coffre (`vault.decrypted_secrets`)
--     ne contient que `sgfn_edge_bearer` et `sgfn_hook_secret` : aucun
--     secret Meta, donc l'edge `envoyer-whatsapp` est fail-closed et rien
--     ne part. Brancher l'alerte sur ce rail aurait produit exactement ce
--     que la commande interdit : un rapport que personne ne lit.
--
--   POURQUOI PAS `sgfn_call_edge` DIRECTEMENT :
--     Le rail HTTP, lui, FONCTIONNE — `net._http_response` montre un 200
--     toutes les dix minutes pour le job `envoyer-notifications-frequent`.
--     Mais il n'existe aucune edge function qui consommerait une alerte de
--     securite, et en inventer un slug non deploye produirait un 404
--     silencieux. Par ailleurs `net.http_post` est un enfilement
--     TRANSACTIONNEL : appele puis suivi d'un `raise exception`, il serait
--     annule avec la transaction. On ne peut donc pas pousser ET echouer
--     dans le meme run. L'echec de job, seul, est le signal fiable.
--     Ajouter un canal pousse suppose de deployer une edge function dediee :
--     c'est un chantier suivant, explicitement pas celui-ci.
--
-- ---------------------------------------------------------------------
-- 🔴 LIGNE DE BASE — POURQUOI IL EST SILENCIEUX LE PREMIER JOUR
-- ---------------------------------------------------------------------
--
--   Un controle qui crie des son installation est desarme dans la semaine
--   et ne sert plus jamais a rien. L'etat mesure en production le
--   30/07/2026 est donc ADMIS explicitement, en dur, ci-dessous. Tout ce
--   qui s'en ecarte — et rien d'autre — declenche l'alerte.
--
--   Ce que la ligne de base admet, et pourquoi :
--
--     * 19 FONCTIONS executables par `anon`. C'est l'allowlist arretee et
--       justifiee une par une par 20260730020000 : 5 RPC appelees par une
--       page reellement sans session, et 14 helpers cites dans une policy
--       RLS evaluee pour `anon` (sans eux le marketplace public tombe en
--       42501 — mesure). Elles sont listees ici par SIGNATURE COMPLETE, pas
--       par nom : une surcharge nouvelle d'une fonction allowlistee est un
--       objet different, et doit alerter.
--
--     * 64 TABLES de base, TOUTES avec RLS. La ligne de base est donc
--       « aucune table sans RLS » : aucune exception n'est admise, et il
--       n'y a pas de liste a tenir a jour. Les 64 portent encore
--       INSERT/UPDATE/DELETE pour `anon` au niveau table — dette connue
--       (20260730020000, point (d)), retenue par la seule RLS, ce qui est
--       precisement pourquoi une table qui PERDRAIT sa RLS est une urgence.
--
--     * 9 VUES lisibles par `anon`. Elles le sont toutes aujourd'hui.
--       Quatre d'entre elles avaient deja ete traitees en SECURITY
--       INVOKER par 20260724170000. On admet l'existant et on surveille
--       l'ajout : une DIXIEME vue lisible par `anon` alerte.
--
--     * 3 entrees `pg_default_acl` nommant `anon` sur le schema `public`,
--       celles du proprietaire `supabase_admin` (objtypes 'S', 'f', 'r').
--       Elles ne sont PAS refermables depuis ce depot : refus serveur 42501
--       mesure, le role de connexion n'etant ni superutilisateur ni membre
--       de `supabase_admin`. Leur portee reelle est etroite — elles ne
--       s'appliquent qu'aux objets crees PAR `supabase_admin`, or les 80
--       relations et les 138 fonctions de `public` appartiennent toutes a
--       `postgres`. Les 3 entrees de `postgres`, elles, ont ete nettoyees
--       par 20260730010000 et ne doivent PLUS JAMAIS renommer `anon` : si
--       l'une d'elles reapparait, c'est la cause racine qui se rouvre, et
--       ce controle le dira.
--
--   🔴 CONSEQUENCE A ACCEPTER : ouvrir DELIBEREMENT une fonction a `anon`
--   demande desormais DEUX gestes, dans la meme migration :
--       1. `grant execute on function public.ma_rpc(...) to anon;`
--       2. ajouter sa signature a `c_allowlist_fonctions` ci-dessous,
--          via une migration qui remplace cette fonction.
--   C'est voulu. La ligne de base vit dans le depot, sous revue git, et non
--   dans une table que n'importe quelle ecriture pourrait elargir sans
--   trace.
--
-- ---------------------------------------------------------------------
-- LE PIEGE QUE CE CONTROLE DESAMORCE — LES DROITS DE COLONNE
-- ---------------------------------------------------------------------
--
--   `has_table_privilege` NE VOIT PAS les grants de colonne. Sur cette base
--   meme, `lotissements` en est la preuve vivante et mesuree :
--       has_table_privilege('anon','lotissements','SELECT')      = false
--       has_any_column_privilege('anon','lotissements','SELECT')  = true
--   `anon` y lit 8 colonnes, et le controle « la table n'est pas lisible »
--   repond faussement vrai. C'est une leçon deja payee sur ce projet.
--   Le controle des vues teste donc les DEUX : niveau table ET niveau
--   colonne. Sans cela, une vue ouverte colonne par colonne passerait
--   inapercue.
--
--   De meme, la detection des fonctions s'appuie sur
--   `has_function_privilege`, QUI EST LE BON OUTIL ICI : il rend `true`
--   aussi bien pour un grant nomme `anon=X` que pour un grant implicite a
--   PUBLIC `=X`. C'est exactement ce qu'on veut DETECTER — les deux
--   mecanismes, la leçon est deja consignee. `proacl` n'est relu que pour
--   DIRE LEQUEL des deux est en cause, afin que l'alerte soit actionnable.
--
-- ---------------------------------------------------------------------
-- USAGE MANUEL
-- ---------------------------------------------------------------------
--   A tout moment, pour un constat complet sans declencher d'alerte :
--       select public.controle_exposition_anon();
--   Rend un `jsonb` : `nb_ecarts`, le detail des ecarts, le constat chiffre
--   du moment, et la ligne de base admise.
--
-- Migration IDEMPOTENTE : `create or replace` pour les deux fonctions,
-- `cron.schedule` upsert par nom de job. Aucun `drop`, aucune ecriture sur
-- un objet preexistant.
-- =====================================================================

-- --- 1. Le constat, sans effet de bord ---------------------------------
--
-- SECURITY INVOKER (defaut) A DESSEIN : cette fonction ne lit que des
-- catalogues systeme, lisibles par tous. Lui donner SECURITY DEFINER
-- ajouterait un 79e objet privilegie a ce projet sans aucun gain. Elle
-- n'est de toute facon accordee qu'a `service_role`.

create or replace function public.controle_exposition_anon()
returns jsonb
language plpgsql
stable
set search_path to pg_catalog, public
as $$
declare
  -- ==================== LIGNE DE BASE, 30/07/2026 ====================
  -- Etat admis en production. Voir l'en-tete pour la justification de
  -- chaque ligne. Toute modification de ces trois constantes doit passer
  -- par une migration, donc par une revue git.

  -- Les 19 signatures de l'allowlist de 20260730020000.
  --   5 RPC de pages sans session :
  c_allowlist_fonctions constant text[] := array[
    'annonce_active_pour_reference(text)',
    'calculer_score_confiance(uuid)',
    'demander_inscription_geometre(text,text,text,text,text,text)',
    'get_public_stats()',
    'valider_invitation(text)',
  --   14 helpers cites dans une policy RLS evaluee pour anon :
    'est_admin()',
    'est_comptable()',
    'ma_chefferie_id()',
    'ma_famille_attributaire_id()',
    'ma_famille_id()',
    'mes_lot_ids()',
    'mon_attributaire_id()',
    'mon_collaborateur_id()',
    'mon_commissaire_id()',
    'mon_geometre_id()',
    'mon_groupe()',
    'mon_operateur_id()',
    'peut_contacter(uuid)',
    'suis_participant(uuid)'
  ];

  -- Les 9 vues de `public`, toutes lisibles par `anon` au 30/07/2026.
  c_allowlist_vues constant text[] := array[
    'annonces_publiques',
    'demandes_acquisition_agence',
    'photos_annonces_publiques',
    'v_attestations_bloquees_documents',
    'v_attestations_gratuites_manquantes',
    'v_collectifs_pv_manquant',
    'v_dossier_adu_completude',
    'v_niveau2_eligibles_manuel',
    'v_niveau3_retroactif_eligibles'
  ];

  -- Le seul proprietaire dont les entrees `pg_default_acl` sur `public`
  -- ont le droit de nommer `anon` : `supabase_admin`, non refermable
  -- (42501 mesure). Les entrees de `postgres` ne doivent plus jamais.
  c_defacl_owner_admis constant text := 'supabase_admin';
  -- ===================================================================

  v_fonctions jsonb;
  v_tables    jsonb;
  v_vues      jsonb;
  v_defacl    jsonb;
  v_n         integer;
begin
  -- 1a) Une fonction (ou procedure) de `public` executable par `anon` hors
  --     allowlist. `prokind in ('f','p')` couvre AUSSI les procedures, que
  --     l'event trigger ne filtre pas : c'est l'un des trous qu'il rattrape.
  select coalesce(jsonb_agg(jsonb_build_object(
           'objet', x.ident, 'genre', x.genre, 'mecanisme', x.mecanisme
         ) order by x.ident), '[]'::jsonb)
    into v_fonctions
  from (
    select p.oid::regprocedure::text as ident,
           case p.prokind when 'p' then 'procedure' else 'fonction' end as genre,
           -- On dit PAR QUEL MECANISME `anon` atteint l'objet : les deux
           -- existent, et le correctif n'est pas le meme.
           case
             when p.proacl is null
               then 'defaut cable PostgreSQL (proacl NULL, =X implicite a PUBLIC)'
             when exists (select 1 from unnest(p.proacl) a where a::text like 'anon=%')
               then 'grant NOMME anon=X'
             -- Un aclitem de PUBLIC se rend SANS beneficiaire a gauche du
             -- `=` : `=X/postgres`. C'est le seul motif a chercher.
             when exists (select 1 from unnest(p.proacl) a where a::text like '=%')
               then 'grant implicite a PUBLIC (=X)'
             else 'herite (appartenance de role)'
           end as mecanisme
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f','p')
      and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.oid::regprocedure::text <> all (c_allowlist_fonctions)
  ) x;

  -- 1b) Une table de base de `public` sans RLS. Aucune exception admise.
  select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
    into v_tables
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r','p')
    and not c.relrowsecurity;

  -- 1c) Une vue de `public` lisible par `anon` au-dela des 9 admises.
  --     🔴 Les DEUX niveaux sont testes : `has_table_privilege` seul
  --     laisserait passer une ouverture colonne par colonne (cf. en-tete,
  --     cas `lotissements`).
  select coalesce(jsonb_agg(jsonb_build_object(
           'vue', c.relname,
           'niveau_table',   pg_catalog.has_table_privilege('anon', c.oid, 'SELECT'),
           'niveau_colonne', pg_catalog.has_any_column_privilege('anon', c.oid, 'SELECT')
         ) order by c.relname), '[]'::jsonb)
    into v_vues
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('v','m')
    and (pg_catalog.has_table_privilege('anon', c.oid, 'SELECT')
      or pg_catalog.has_any_column_privilege('anon', c.oid, 'SELECT'))
    and c.relname <> all (c_allowlist_vues);

  -- 1d) Une entree `pg_default_acl` sur `public` nommant `anon`, au-dela
  --     des 3 de `supabase_admin`. C'est la cause racine de tout ce lot :
  --     si elle reapparait cote `postgres`, tout objet neuf redevient
  --     ouvert et le reste du dispositif ne suffira plus.
  select coalesce(jsonb_agg(jsonb_build_object(
           'proprietaire', pg_catalog.pg_get_userbyid(d.defaclrole),
           'objtype', d.defaclobjtype,
           'acl', d.defaclacl::text
         ) order by pg_catalog.pg_get_userbyid(d.defaclrole), d.defaclobjtype), '[]'::jsonb)
    into v_defacl
  from pg_catalog.pg_default_acl d
  join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public'
    and exists (select 1 from unnest(d.defaclacl) a where a::text like 'anon=%')
    and pg_catalog.pg_get_userbyid(d.defaclrole) <> c_defacl_owner_admis;

  v_n := jsonb_array_length(v_fonctions)
       + jsonb_array_length(v_tables)
       + jsonb_array_length(v_vues)
       + jsonb_array_length(v_defacl);

  return jsonb_build_object(
    'horodatage', now(),
    'nb_ecarts', v_n,
    'ecarts', jsonb_build_object(
      'fonctions_anon_hors_allowlist', v_fonctions,
      'tables_sans_rls', v_tables,
      'vues_anon_hors_allowlist', v_vues,
      'default_acl_nommant_anon_hors_supabase_admin', v_defacl
    ),
    -- Constat chiffre du moment : sert a diagnostiquer une derive lente
    -- (ex. le nombre de fonctions monte alors qu'aucun ecart n'est signale).
    'constat', jsonb_build_object(
      'nb_fonctions_public', (
        select count(*) from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prokind in ('f','p')),
      'nb_fonctions_anon', (
        select count(*) from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prokind in ('f','p')
          and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')),
      'nb_tables_base', (
        select count(*) from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r','p')),
      'nb_vues', (
        select count(*) from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('v','m')),
      'event_trigger_arme', exists (
        select 1 from pg_catalog.pg_event_trigger
        where evtname = 'evt_fonctions_neuves_fermees_a_anon' and evtenabled = 'O')
    ),
    'ligne_de_base', jsonb_build_object(
      'date', '2026-07-30',
      'fonctions_admises', to_jsonb(c_allowlist_fonctions),
      'vues_admises', to_jsonb(c_allowlist_vues),
      'tables_sans_rls_admises', '[]'::jsonb,
      'default_acl_proprietaire_admis', c_defacl_owner_admis
    )
  );
end;
$$;

-- Ce constat ne regarde personne d'autre que l'exploitation. Fermeture sur
-- les DEUX mecanismes (PUBLIC et grant nomme), comme partout dans ce lot.
revoke execute on function public.controle_exposition_anon() from public, anon;
grant  execute on function public.controle_exposition_anon() to service_role;

-- --- 2. Le siren -------------------------------------------------------
--
-- Silencieux si `nb_ecarts = 0` : le job passe en `succeeded` et personne
-- n'est derange. Sinon il LEVE, et `pg_cron` inscrit l'echec et le detail
-- dans `cron.job_run_details`.

create or replace function public.controle_exposition_anon_cron()
returns void
language plpgsql
set search_path to pg_catalog, public
as $$
declare
  v_rapport jsonb;
  v_n       integer;
begin
  v_rapport := public.controle_exposition_anon();
  v_n := (v_rapport->>'nb_ecarts')::integer;

  if v_n > 0 then
    -- 🔴 Aucun `exception when others` : si ce controle casse, il doit
    -- casser BRUYAMMENT plutot que de rendre un vert silencieux. Un
    -- controle de securite qui echoue en silence est pire que pas de
    -- controle du tout, parce qu'il inspire confiance.
    raise exception
      'SECURITE SGNF — % exposition(s) anonyme(s) hors ligne de base : %',
      v_n, jsonb_pretty(v_rapport->'ecarts')
      using
        hint =
          'Diagnostic : select public.controle_exposition_anon(); '
          || 'Si l''ouverture est DELIBEREE, ajouter la signature ou le nom a la '
          || 'ligne de base dans une migration remplacant '
          || 'public.controle_exposition_anon() (voir 20260730040000). '
          || 'Sinon : revoke execute ... from public, anon; ou alter table ... enable row level security;';
  end if;
end;
$$;

revoke execute on function public.controle_exposition_anon_cron() from public, anon;

-- --- 3. Ordonnancement -------------------------------------------------
--
-- Toutes les heures a la minute 23, decalee des trois jobs existants
-- (`0 2 * * *`, `0 7 * * *`, `*/10 * * * *`) pour ne pas empiler les
-- reveils. Horaire et non quotidien : une derive introduite par un
-- deploiement doit se voir dans l'heure, et un job qui echoue toutes les
-- heures est un signal qui ne s'eteint pas tout seul.
--
-- `cron.schedule(jobname, schedule, command)` est un UPSERT par nom :
-- rejouer cette migration met le job a jour sans le dupliquer.

select cron.schedule(
  'securite-exposition-anon',
  '23 * * * *',
  $cron$ select public.controle_exposition_anon_cron(); $cron$
);

-- --- 4. Verification EXECUTEE, pas supposee ----------------------------
--
-- Deux assertions, et la premiere est la plus importante de ce fichier :
-- le controle DOIT etre silencieux sur l'etat du jour. S'il ne l'est pas,
-- la ligne de base est fausse, et la migration echoue plutot que
-- d'installer un dispositif qui criera au loup des la premiere heure.

do $$
declare
  v_rapport jsonb;
  v_n       integer;
  v_job     record;
begin
  v_rapport := public.controle_exposition_anon();
  v_n := (v_rapport->>'nb_ecarts')::integer;

  if v_n <> 0 then
    raise exception
      'Ligne de base FAUSSE : le controle signale % ecart(s) sur l''etat du jour. Detail : %',
      v_n, jsonb_pretty(v_rapport->'ecarts');
  end if;

  -- Le job existe, il est actif, et il vise bien la bonne fonction.
  select jobid, schedule, command, active, username
    into v_job
  from cron.job where jobname = 'securite-exposition-anon';

  -- `not found` plutot que `v_job is null` : sur un RECORD, `is null` n'est
  -- vrai que si TOUS les champs sont nuls, ce qui est un test different et
  -- fragile.
  if not found then
    raise exception 'Job cron securite-exposition-anon absent apres cron.schedule.';
  end if;
  if not v_job.active then
    raise exception 'Job cron securite-exposition-anon present mais INACTIF.';
  end if;
  if v_job.command not like '%controle_exposition_anon_cron%' then
    raise exception 'Job cron securite-exposition-anon pointe ailleurs : %', v_job.command;
  end if;

  -- Le controle ne doit pas s'auto-signaler : ses deux fonctions viennent
  -- d'etre creees dans `public` et doivent etre fermees a `anon`.
  if pg_catalog.has_function_privilege('anon', 'public.controle_exposition_anon()', 'EXECUTE')
  or pg_catalog.has_function_privilege('anon', 'public.controle_exposition_anon_cron()', 'EXECUTE') then
    raise exception 'Les fonctions du controle sont elles-memes executables par anon.';
  end if;

  raise notice
    'Controle installe et SILENCIEUX (0 ecart). Job % (%), constat : %.',
    v_job.jobid, v_job.schedule, v_rapport->'constat';
end $$;
