-- =====================================================================
-- CORRECTIF DU CONTROLE PERIODIQUE (20260730040000)
--   1. il surveille enfin les GRANTS de `anon` sur les TABLES DE BASE,
--      niveau table ET niveau colonne ;
--   2. il mesure la lisibilite REELLE des vues, role `anon` EMPRUNTE,
--      au lieu de se fier a une affirmation qui etait FAUSSE.
-- =====================================================================
--
-- Ce fichier remplace `public.controle_exposition_anon()` et
-- `public.controle_exposition_anon_cron()`. Il ne cree, ne supprime et ne
-- reouvre AUCUN droit : il ne fait que REGARDER mieux. Le job cron 4
-- (`securite-exposition-anon`, '23 * * * *') est inchange et continue de
-- pointer sur `controle_exposition_anon_cron()`.
--
-- ---------------------------------------------------------------------
-- ECART 1 — CE QUE 20260730040000 PROMETTAIT ET NE FAISAIT PAS
-- ---------------------------------------------------------------------
--
-- Son en-tete annonce « tables, COLONNES, vues ». En realite il ne
-- regardait les tables que par `not relrowsecurity` (lignes 255-262) :
-- JAMAIS leurs grants. Consequence mesuree le 30/07/2026 :
--
--     `anon` detient SELECT AU NIVEAU TABLE sur 63 des 64 tables de base,
--     et le controle rendait pourtant `nb_ecarts = 0`.
--
-- Le chemin de reouverture le plus probable etait donc AVEUGLE. Quand une
-- lecture echoue, PostgreSQL suggere lui-meme dans son HINT de poser un
-- `grant`. Un `grant select on public.lotissements to anon` — une ligne,
-- ecrite de bonne foi pour debloquer une page — rouvrait EN SILENCE les
-- colonnes GPS et cadastre refermees le 24/07, sans qu'aucun dispositif ne
-- bronche.
--
--   🔴 RAPPEL DE METHODE, DEJA PAYE UNE FOIS SUR CE PROJET :
--   `has_table_privilege` et `information_schema.role_table_grants`
--   raisonnent AU NIVEAU TABLE et NE VOIENT PAS un grant de colonne. Sur
--   `lotissements` :
--       has_table_privilege('anon','lotissements','SELECT')     = false
--       has_any_column_privilege('anon','lotissements','SELECT') = true
--   Le niveau colonne se lit dans `pg_attribute.attacl` — c'est ce que fait
--   le point 1d ci-dessous. `information_schema.column_privileges` aurait
--   aussi convenu, mais elle MELANGE les grants de colonne et les grants de
--   table etendus a toutes les colonnes : elle ne permet pas de distinguer
--   les deux niveaux, or c'est exactement la distinction qui compte ici.
--
-- ---------------------------------------------------------------------
-- ECART 2 — LA LIGNE DE BASE DES VUES AFFIRMAIT FAUX
-- ---------------------------------------------------------------------
--
-- 20260730040000, ligne 95 : « 9 VUES lisibles par `anon`. Elles le sont
-- toutes aujourd'hui. » C'EST FAUX.
--
-- MESURE LE 30/07/2026, ROLE `anon` REELLEMENT EMPRUNTE
-- (`set local request.jwt.claims = ''` puis `set local role anon`,
--  transaction ANNULEE) — 1 vue sur 9 est lisible :
--
--     photos_annonces_publiques            00000  LISIBLE
--     annonces_publiques                   42501  permission denied for table lotissements
--     demandes_acquisition_agence          42501  permission denied for table lotissements
--     v_attestations_bloquees_documents    42501  permission denied for table lotissements
--     v_collectifs_pv_manquant             42501  permission denied for table lotissements
--     v_dossier_adu_completude             42501  permission denied for table lotissements
--     v_niveau2_eligibles_manuel           42501  permission denied for table lotissements
--     v_attestations_gratuites_manquantes  42501  permission denied for function lot_ids_operateur
--     v_niveau3_retroactif_eligibles       42501  permission denied for function lot_ids_operateur
--
-- Les 9 portent pourtant TOUTES `anon=arwdDxtm/postgres` au niveau de la
-- vue, et sont TOUTES en `security_invoker`. Elles ne sont donc pas fermees
-- par une DECISION : elles sont fermees PAR ACCIDENT, par un
-- `permission denied` sur une relation ou une fonction sous-jacente. C'est
-- une fermeture qu'un seul `grant` ailleurs peut annuler d'un coup.
--
-- Allowlister les 8 non lisibles sur la premisse « elles le sont toutes »
-- aurait grave cet accident dans le marbre : le jour ou l'une d'elles
-- deviendrait lisible, le controle serait reste muet. La ligne de base est
-- donc RESSERREE a la seule vue REELLEMENT lisible.
--
--   🔴 CONSEQUENCE A CONNAITRE : `has_table_privilege` sur la vue ne
--   pouvait PAS trancher — il rend `true` pour les 9. Seul l'EMPRUNT DU
--   ROLE tranche. Le controle emprunte donc reellement `anon` a chaque
--   passage (point 1f), et il verifie qu'il l'a bien emprunte (point 1h) :
--   une sonde qui echouerait a prendre le role rendrait « aucune vue
--   lisible » — le pire des faux verts.
--
--   Note d'exploitation, mesuree : `src/` ne reference plus NI
--   `annonces_publiques` NI `photos_annonces_publiques` (une seule
--   occurrence, dans un commentaire). Aucune page ne casse du fait de cette
--   ligne de base. Si un chantier futur remet le marketplace public sur
--   `annonces_publiques`, le controle CRIERA — et c'est le comportement
--   voulu : la reouverture devra etre inscrite ici, sous revue git.
--
-- ---------------------------------------------------------------------
-- 🔴 LIGNE DE BASE — ETAT REELLEMENT MESURE LE 30/07/2026
-- ---------------------------------------------------------------------
--
--   * 19 FONCTIONS executables par `anon` SUR UN PARC DE 141 dans `public`
--     (inchange, verifie : les 19 signatures relues sont exactement celles de
--     20260730020000, diff a vide). Le parc etait de 138 au 29/07 : trois
--     fonctions ont ete ajoutees depuis, et elles sont bien FERMEES a `anon` —
--     ce qui est precisement ce que l'event trigger doit produire.
--
--   * 64 TABLES de base, toutes avec RLS, dont 63 portent
--     `anon=arwdDxtm/postgres` au niveau table — donc SELECT compris.
--     C'est la dette de 20260730020000 point (d), retenue par la SEULE
--     RLS. Elle est ADMISE, mais GELEE : les 63 noms sont ecrits en dur.
--     Une 64e table qui prendrait SELECT pour `anon` est un ecart.
--     La comparaison est a SENS UNIQUE : une table qui PERD le grant ne
--     declenche rien (c'est une bonne nouvelle, pas une alerte).
--
--   * ⚠️ `lotissements` est le CAS PARTICULIER, LEGITIME ET VOULU. Elle est
--     la SEULE table sans SELECT au niveau table (`anon=awdDxtm/postgres`,
--     pas de `r`), et la seule a ouvrir des colonnes NOMMEMENT a `anon` :
--         id, nom, village, commune, district,
--         superficie_texte, nb_ilots, nb_lots
--     Ces 8 colonnes alimentent les pages publiques ; les colonnes GPS et
--     cadastre restent fermees. C'est le resultat du 24/07 et il est ADMIS
--     EXPLICITEMENT ici, pas silencieusement. Deux consequences directes :
--       - un `grant select on public.lotissements to anon` la ferait entrer
--         dans la liste des tables a SELECT niveau table, ou elle N'EST PAS
--         admise -> ECART (c'est precisement le scenario de l'ecart 1) ;
--       - une 9e colonne ouverte a `anon`, ici ou ailleurs -> ECART.
--
--   * 0 aclitem PUBLIC sur les 73 relations de `public` (64 tables + 9
--     vues). Ligne de base VIDE, donc zero entretien et signal maximal :
--     un `grant select on <t> to public` est un ecart immediat.
--
--   * 1 SEULE VUE reellement lisible par `anon` : `photos_annonces_publiques`.
--
--   * 3 entrees `pg_default_acl` de `supabase_admin` (inchange, non
--     refermables depuis ce depot : 42501 mesure).
--
-- ---------------------------------------------------------------------
-- CE QUE CE CONTROLE NE COUVRE TOUJOURS PAS — DIT FRANCHEMENT
-- ---------------------------------------------------------------------
--
--   (a) Les privileges d'ECRITURE de `anon` (INSERT/UPDATE/DELETE, presents
--       sur les 64 tables) ne sont PAS compares nom par nom. Ils sont
--       uniformes sur tout le parc et retenus par la RLS ; les surveiller
--       aurait produit une liste de 64 noms sans aucun signal. Le garde-fou
--       reste le point 1b (« aucune table sans RLS »), et il est
--       intransigeant. La lecture, elle, EST surveillee nom par nom, parce
--       que c'est elle qui expose des donnees.
--
--   (b) La sonde de lisibilite des vues emprunte `anon` : elle exige que le
--       role appelant soit MEMBRE de `anon`. `postgres` l'est (mesure), et
--       le job cron tourne sous `postgres` (mesure : `cron.job.username`).
--       `service_role` ne l'est PAS (mesure) : un appel par PostgREST en
--       service_role rendrait la sonde inoperante — et le point 1h le
--       signale alors comme un ECART, au lieu de rendre un vert vide.
--
-- ---------------------------------------------------------------------
-- PREUVE 1 — L'EVENT TRIGGER REVOQUE-T-IL VRAIMENT SUR UNE FONCTION NEUVE ?
-- ---------------------------------------------------------------------
--
-- 20260730030000 a pose `evt_fonctions_neuves_fermees_a_anon`, et tout le
-- dispositif de non-regression repose sur lui. Il n'avait jamais ete PROUVE :
-- en lecture seule c'est impossible (`create function` rend 25006). Fait le
-- 30/07/2026 en TRANSACTION ANNULEE, sonde creee puis sous-bloc rejete :
--
--     create function public._probe_evt_20260730() returns int
--       language sql as 'select 1';
--
--   proacl APRES declenchement du trigger, valeur BRUTE relevee :
--     {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--
--   has_function_privilege('anon', ..., 'EXECUTE') = false
--   residu apres annulation                        = 0 fonction
--
--   🔴 POURQUOI `proacl` ET PAS `has_function_privilege` SEUL : « plus aucune
--   mention de anon » est un faux vert documente sur ce projet. Un EXECUTE
--   peut venir du PSEUDO-ROLE PUBLIC, qui s'ecrit `=X/postgres` — sans
--   beneficiaire a gauche du `=` — et `anon` en herite sans jamais y etre
--   nomme. La valeur brute ci-dessus tranche les DEUX : ni `anon=`, ni `=X/`.
--   Le trigger fait donc bien son travail. C'est MESURE, plus infere.
--
-- ---------------------------------------------------------------------
-- ⚠️ PIEGE DE DEBOGAGE A CONNAITRE AVANT D'Y PERDRE UNE HEURE
-- ---------------------------------------------------------------------
--
-- Ce trigger est `SECURITY DEFINER` sous `postgres` et execute un
-- `revoke ... from public` sur chaque fonction neuve de `public`. Or on ne
-- revoque que ce qu'on a le droit de revoquer : une fonction creee dans
-- `public` sous un AUTRE PROPRIETAIRE ferait ECHOUER le revoke, et comme le
-- trigger tourne en `ddl_command_end`, cet echec ANNULE LE DDL LUI-MEME. La
-- migration casse alors sans rapport apparent avec ce qu'elle ecrit.
--
-- C'est le comportement VOULU — fail-loud plutot qu'une fonction neuve
-- laissee ouverte a `anon` — mais il faut le savoir : le message d'erreur
-- parle de privileges, pas d'event trigger. Toute migration future creant
-- une fonction dans `public` doit le faire sous `postgres`.
--
-- =====================================================================

-- --- 1. Le constat, sans effet de bord durable -------------------------
--
-- VOLATILE (et non plus STABLE) : la fonction emprunte desormais le role
-- `anon` le temps de la sonde. Le declarer STABLE serait mentir sur ce
-- qu'elle fait.
--
-- SECURITY INVOKER (defaut) maintenu : elle ne lit que des catalogues et
-- ne s'appuie sur aucun privilege qu'elle n'aurait pas deja.

create or replace function public.controle_exposition_anon()
returns jsonb
language plpgsql
volatile
set search_path to pg_catalog, public
as $$
declare
  -- ==================== LIGNE DE BASE, 30/07/2026 ====================
  -- Etat REELLEMENT MESURE en production. Voir l'en-tete pour la
  -- justification de chaque ligne. Toute modification passe par une
  -- migration, donc par une revue git.

  -- (i) Les 19 signatures ouvertes a `anon` par 20260730020000.
  --     5 RPC de pages sans session :
  c_allowlist_fonctions constant text[] := array[
    'annonce_active_pour_reference(text)',
    'calculer_score_confiance(uuid)',
    'demander_inscription_geometre(text,text,text,text,text,text)',
    'get_public_stats()',
    'valider_invitation(text)',
  --     14 helpers cites dans une policy RLS evaluee pour anon :
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

  -- (ii) Les 63 tables de base sur lesquelles `anon` detient SELECT AU
  --      NIVEAU TABLE au 30/07/2026 : la dette de 20260730020000 (d),
  --      retenue par la seule RLS. Admise mais GELEE.
  --      `lotissements` n'y figure PAS, et ne doit jamais y figurer :
  --      elle est ouverte colonne par colonne, cf. (iii).
  c_tables_select_anon_admises constant text[] := array[
    'annonces_marketplace', 'apports', 'attestations_attribution_lot',
    'attestations_cession', 'attestations_coutumieres', 'attributaires',
    'attributions', 'autorites_coutumieres', 'certificats_vente',
    'cessions', 'chefs_autorites_coutumieres', 'collaborateurs',
    'commissaires_justice', 'constats', 'consultations_qr',
    'conversation_documents', 'conversation_participants', 'conversations',
    'cvgfr', 'demandes_acquisition', 'demandes_contact',
    'demandes_inscription_geometre', 'demarches', 'depenses', 'documents',
    'dossiers_adu', 'echeances', 'familles', 'geometres_experts',
    'grandes_familles', 'grille_commissions', 'ilots', 'invitations',
    'jetons_marketplace', 'journal_audit', 'litiges', 'litiges_suivi',
    'lots', 'marketplace_etat_site', 'messages', 'missions_geometre',
    'notifications', 'notifications_a_envoyer', 'operateurs', 'paiements',
    'parametres_paiement', 'photos_annonces', 'profiles', 'propositions_ia',
    'pv_bornage', 'pv_reunions_famille', 'pv_reunions_famille_lots',
    'pv_reunions_famille_membres', 'repartitions_paiement', 'scans_qr',
    'soumissions_saisie', 'sous_prefectures', 'suivis_parcelle', 'tarifs',
    'tarifs_attestation_chefferie', 'transaction_parties', 'transactions',
    'ventes'
  ];

  -- (iii) ⚠️ LE CAS LEGITIME ET VOULU. Les 8 seules colonnes de `public`
  --       ouvertes NOMMEMENT a `anon` (`anon=r/postgres` dans
  --       `pg_attribute.attacl`). Elles alimentent les pages publiques ;
  --       les colonnes GPS et cadastre de `lotissements` restent fermees,
  --       et c'est tout l'objet du travail du 24/07.
  c_colonnes_anon_admises constant text[] := array[
    'lotissements.id',
    'lotissements.nom',
    'lotissements.village',
    'lotissements.commune',
    'lotissements.district',
    'lotissements.superficie_texte',
    'lotissements.nb_ilots',
    'lotissements.nb_lots'
  ];

  -- (iv) Les vues REELLEMENT lisibles par `anon`, role emprunte. UNE SEULE.
  --      Les 8 autres rendent 42501 : elles ne sont pas allowlistees, et si
  --      l'une devient lisible, ce controle crie.
  c_allowlist_vues_lisibles constant text[] := array[
    'photos_annonces_publiques'
  ];

  -- (v) Le seul proprietaire dont les entrees `pg_default_acl` sur `public`
  --     ont le droit de nommer `anon`.
  c_defacl_owner_admis constant text := 'supabase_admin';
  -- ===================================================================

  v_fonctions   jsonb;
  v_tables_rls  jsonb;
  v_grants_tbl  jsonb;
  v_grants_col  jsonb;
  v_acl_public  jsonb;
  v_vues        jsonb;
  v_vues_indet  jsonb;
  v_sonde       jsonb;
  v_defacl      jsonb;
  v_n           integer;

  v_toutes_vues        text[];
  v_vues_lisibles      text[] := array[]::text[];
  v_vues_indeterminees text[] := array[]::text[];
  v_sonde_ko           text   := null;
  v_role_initial       text;
  v_role_sonde         text   := null;
  v_nom                text;
begin
  -- 1a) Une fonction (ou PROCEDURE) de `public` executable par `anon` hors
  --     allowlist. `prokind in ('f','p')` couvre les procedures, que
  --     l'event trigger de 20260730030000 ne filtre pas.
  select coalesce(jsonb_agg(jsonb_build_object(
           'objet', x.ident, 'genre', x.genre, 'mecanisme', x.mecanisme
         ) order by x.ident), '[]'::jsonb)
    into v_fonctions
  from (
    select p.oid::regprocedure::text as ident,
           case p.prokind when 'p' then 'procedure' else 'fonction' end as genre,
           case
             when p.proacl is null
               then 'defaut cable PostgreSQL (proacl NULL, =X implicite a PUBLIC)'
             when exists (select 1 from unnest(p.proacl) a where a::text like 'anon=%')
               then 'grant NOMME anon=X'
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
  --     C'est le seul garde-fou des privileges d'ECRITURE de `anon`, qui
  --     sont presents sur les 64 tables (cf. en-tete, point (a)).
  select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
    into v_tables_rls
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r','p')
    and not c.relrowsecurity;

  -- 1c) 🔴 NOUVEAU — SELECT de `anon` AU NIVEAU TABLE, hors des 63 gelees.
  --     `has_table_privilege` est ICI le bon outil : il rend `true` aussi
  --     bien pour `anon=r` que pour un `=r` de PUBLIC, et c'est bien le
  --     niveau TABLE qu'on veut isoler (le niveau colonne est en 1d).
  --     Comparaison a SENS UNIQUE : perdre un grant n'alerte pas.
  select coalesce(jsonb_agg(jsonb_build_object(
           'table', x.relname, 'acl_anon', x.acl) order by x.relname), '[]'::jsonb)
    into v_grants_tbl
  from (
    select c.relname,
           coalesce((select string_agg(a::text, ' | ' order by a::text)
                     from unnest(c.relacl) a
                     where a::text like 'anon=%' or a::text like '=%'),
                    'via appartenance de role') as acl
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p')
      and pg_catalog.has_table_privilege('anon', c.oid, 'SELECT')
      and c.relname <> all (c_tables_select_anon_admises)
  ) x;

  -- 1d) 🔴 NOUVEAU — GRANTS DE COLONNE nommant `anon` ou PUBLIC, hors des 8
  --     admis. Lu dans `pg_attribute.attacl` : c'est le SEUL endroit ou un
  --     grant de colonne se voit. `has_table_privilege` et
  --     `information_schema.role_table_grants` sont AVEUGLES ici — lecon
  --     deja payee sur ce projet, et c'est exactement l'angle mort que ce
  --     point ferme. Porte sur les tables ET les vues.
  select coalesce(jsonb_agg(jsonb_build_object(
           'relation', x.relname, 'colonne', x.attname, 'acl', x.acl
         ) order by x.relname, x.attname), '[]'::jsonb)
    into v_grants_col
  from (
    select c.relname, a.attname,
           (select string_agg(y::text, ' | ' order by y::text)
            from unnest(a.attacl) y
            where y::text like 'anon=%' or y::text like '=%') as acl
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p','v','m')
      and a.attnum > 0
      and not a.attisdropped
      and a.attacl is not null
      and exists (select 1 from unnest(a.attacl) y
                  where y::text like 'anon=%' or y::text like '=%')
      and (c.relname || '.' || a.attname) <> all (c_colonnes_anon_admises)
  ) x;

  -- 1e) 🔴 NOUVEAU — un aclitem du PSEUDO-ROLE PUBLIC sur une relation de
  --     `public`, quel que soit le privilege. Ligne de base VIDE au
  --     30/07/2026 : zero entretien, signal maximal. Un aclitem PUBLIC se
  --     reconnait a l'absence de beneficiaire a gauche du `=`.
  select coalesce(jsonb_agg(jsonb_build_object(
           'relation', c.relname,
           'genre', c.relkind::text,
           'acl_public', (select string_agg(y::text, ' | ' order by y::text)
                          from unnest(c.relacl) y where y::text like '=%')
         ) order by c.relname), '[]'::jsonb)
    into v_acl_public
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r','p','v','m')
    and exists (select 1 from unnest(c.relacl) y where y::text like '=%');

  -- 1f) 🔴 NOUVEAU — LISIBILITE REELLE DES VUES, ROLE `anon` EMPRUNTE.
  --
  --     Pourquoi pas `has_table_privilege` : il rend `true` pour les 9 vues,
  --     alors qu'UNE SEULE est reellement lisible. Les 8 autres sont
  --     `security_invoker` et butent sur un 42501 d'une relation ou d'une
  --     fonction sous-jacente. Seul l'emprunt du role tranche.
  --
  --     🔴 RESTAURATION DU ROLE — comment elle est GARANTIE :
  --     le bloc se termine TOUJOURS par un `raise` volontaire, ce qui ANNULE
  --     le sous-bloc et RESTAURE avec lui `role`, `request.jwt.claims` et
  --     `statement_timeout`. Les variables plpgsql, elles, SURVIVENT a
  --     l'annulation d'un sous-bloc (comportement documente) : c'est ce qui
  --     permet de sortir le resultat sans laisser de trace. Un `set role`
  --     explicite en ceinture suit, au cas ou.

  select coalesce(array_agg(c.relname order by c.relname), array[]::text[])
    into v_toutes_vues
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('v','m');

  v_role_initial := current_user;

  begin
    -- Borne de temps, POSEE SANS ILLUSION : `statement_timeout` s'arme au
    -- debut d'une instruction de PREMIER NIVEAU. Pose ici, au milieu de
    -- l'appel deja en cours, il ne bornera PAS les sondes de cette execution ;
    -- il ne sert qu'a l'appelant qui invoquerait la fonction dans sa propre
    -- instruction suivante. Il est conserve parce qu'il ne coute rien, mais il
    -- ne faut RIEN en attendre : ecrire l'inverse serait un faux vert de plus.
    -- Si un depassement survient malgre tout, il rend 57014, classe en
    -- INDETERMINE ci-dessous — donc en ecart, jamais en vert.
    perform pg_catalog.set_config('statement_timeout', '15s', false);
    -- Sonde deterministe : on veut l'anonyme PUR, meme si l'appelant porte
    -- un JWT dans sa session.
    perform pg_catalog.set_config('request.jwt.claims', '', false);
    execute 'set role anon';
    -- On RELIT le role effectif au lieu de le supposer : c'est le controle
    -- du controle, exploite en 1h.
    v_role_sonde := current_user;

    foreach v_nom in array v_toutes_vues loop
      begin
        execute pg_catalog.format('select 1 from public.%I limit 1', v_nom);
        v_vues_lisibles := v_vues_lisibles || v_nom;
      exception
        when insufficient_privilege then
          -- 42501 : la vue est fermee a `anon`. C'est l'etat attendu.
          null;
        when others then
          -- Ni lisible ni franchement refusee : on ne SAIT pas. On le dit,
          -- et cela compte comme un ecart. Un « je ne sais pas » silencieux
          -- serait un faux vert.
          v_vues_indeterminees := v_vues_indeterminees || (v_nom || ' [' || sqlstate || ']');
      end;
    end loop;

    raise exception using errcode = 'P0001', message = '__SONDE_VUES_TERMINEE__';
  exception when others then
    if sqlerrm <> '__SONDE_VUES_TERMINEE__' then
      -- L'emprunt de role lui-meme a echoue : le controle est AVEUGLE sur
      -- les vues. Signale en 1h.
      v_sonde_ko := sqlstate || ' ' || sqlerrm;
    end if;
  end;

  -- Ceinture : l'annulation du sous-bloc a normalement deja restaure le
  -- role. On le verifie, et on le force si besoin.
  if current_user <> v_role_initial then
    execute pg_catalog.format('set role %I', v_role_initial);
  end if;

  select coalesce(jsonb_agg(v order by v), '[]'::jsonb)
    into v_vues
  from unnest(v_vues_lisibles) v
  where v <> all (c_allowlist_vues_lisibles);

  select coalesce(jsonb_agg(v order by v), '[]'::jsonb)
    into v_vues_indet
  from unnest(v_vues_indeterminees) v;

  -- 1h) 🔴 NOUVEAU — la sonde a-t-elle vraiment pris le role `anon` ?
  --     Sans ce point, une sonde inoperante rendrait « aucune vue lisible »
  --     et donc 0 ecart : le plus dangereux des faux verts, puisqu'il
  --     ressemble trait pour trait a un succes.
  v_sonde := case
    when v_sonde_ko is not null then
      jsonb_build_array(jsonb_build_object(
        'probleme', 'SONDE DES VUES INOPERANTE : emprunt du role anon impossible',
        'erreur', v_sonde_ko,
        'role_appelant', v_role_initial))
    when v_role_sonde is distinct from 'anon' then
      jsonb_build_array(jsonb_build_object(
        'probleme', 'SONDE DES VUES INOPERANTE : le role effectif n''etait pas anon',
        'role_effectif', coalesce(v_role_sonde, 'NULL'),
        'role_appelant', v_role_initial))
    else '[]'::jsonb
  end;

  -- 1i) Une entree `pg_default_acl` sur `public` nommant `anon`, au-dela des
  --     3 de `supabase_admin`. C'est la cause racine de tout ce lot.
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
       + jsonb_array_length(v_tables_rls)
       + jsonb_array_length(v_grants_tbl)
       + jsonb_array_length(v_grants_col)
       + jsonb_array_length(v_acl_public)
       + jsonb_array_length(v_vues)
       + jsonb_array_length(v_vues_indet)
       + jsonb_array_length(v_sonde)
       + jsonb_array_length(v_defacl);

  return jsonb_build_object(
    'horodatage', now(),
    'nb_ecarts', v_n,
    'ecarts', jsonb_build_object(
      'fonctions_anon_hors_allowlist',                v_fonctions,
      'tables_sans_rls',                              v_tables_rls,
      'tables_select_anon_niveau_table_hors_base',    v_grants_tbl,
      'grants_de_colonne_anon_hors_base',             v_grants_col,
      'relations_avec_aclitem_PUBLIC',                v_acl_public,
      'vues_REELLEMENT_lisibles_hors_allowlist',      v_vues,
      'vues_a_lisibilite_INDETERMINEE',               v_vues_indet,
      'sonde_role_anon_inoperante',                   v_sonde,
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
      'nb_tables_select_anon_niveau_table', (
        select count(*) from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r','p')
          and pg_catalog.has_table_privilege('anon', c.oid, 'SELECT')),
      'nb_colonnes_ouvertes_a_anon', (
        select count(*) from pg_catalog.pg_attribute a
        join pg_catalog.pg_class c on c.oid = a.attrelid
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r','p','v','m')
          and a.attnum > 0 and not a.attisdropped and a.attacl is not null
          and exists (select 1 from unnest(a.attacl) y where y::text like 'anon=%')),
      'nb_vues', (
        select count(*) from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('v','m')),
      'vues_REELLEMENT_lisibles_par_anon', to_jsonb(v_vues_lisibles),
      'role_effectif_de_la_sonde', coalesce(v_role_sonde, 'SONDE EN ECHEC'),
      'event_trigger_arme', exists (
        select 1 from pg_catalog.pg_event_trigger
        where evtname = 'evt_fonctions_neuves_fermees_a_anon' and evtenabled = 'O')
    ),
    'ligne_de_base', jsonb_build_object(
      'date', '2026-07-30',
      'source', '20260730050000 (corrige 20260730040000 : grants de table/colonne ajoutes, vues remesurees role emprunte)',
      'fonctions_admises', to_jsonb(c_allowlist_fonctions),
      'tables_select_anon_admises', to_jsonb(c_tables_select_anon_admises),
      'colonnes_anon_admises', to_jsonb(c_colonnes_anon_admises),
      'vues_reellement_lisibles_admises', to_jsonb(c_allowlist_vues_lisibles),
      'tables_sans_rls_admises', '[]'::jsonb,
      'relations_avec_aclitem_public_admises', '[]'::jsonb,
      'default_acl_proprietaire_admis', c_defacl_owner_admis
    )
  );
end;
$$;

-- Fermeture sur les DEUX mecanismes (PUBLIC et grant nomme), a l'identique
-- de 20260730040000 : aucune ACL n'est modifiee ici, seulement re-affirmee.
revoke execute on function public.controle_exposition_anon() from public, anon;
grant  execute on function public.controle_exposition_anon() to service_role;

-- --- 2. Le siren -------------------------------------------------------
--
-- Inchange dans son principe : silencieux si `nb_ecarts = 0`, sinon il LEVE
-- et `pg_cron` inscrit l'echec dans `cron.job_run_details`.
--
-- 🔴 PREUVE 2 — CE CHEMIN D'ECHEC EST DESORMAIS PROUVE, PAS INFERE. Au
-- 30/07/2026, `cron.job_run_details` contenait 4 491 lignes, TOUTES
-- `succeeded` : le chemin d'echec n'avait jamais ete emprunte sur cette base,
-- et tout le canal d'alerte reposait dessus. Un job JETABLE
-- (`_tmp_probe_echec_cron_20260730`, jobid 8, '* * * * *') dont la commande
-- levait deliberement a donc ete cree, laisse tourner, puis SUPPRIME (verifie
-- le 30/07 : 4 jobs cron, aucun residu). Ses trois runs, relus tels quels :
--
--   2026-07-30 14:25:00.034601+00  status=failed
--   2026-07-30 14:26:00.025247+00  status=failed
--   2026-07-30 14:27:00.024176+00  status=failed
--   return_message (identique aux trois) :
--     ERROR:  SONDE JETABLE 20260730 : echec DELIBERE, preuve que pg_cron
--     inscrit bien les echecs. Job supprime dans la foulee.
--     CONTEXT:  PL/pgSQL function inline_code_block line 1 at RAISE
--
-- Ce sont les 3 SEULES lignes non-`succeeded` de la table. Elles y sont
-- laissees EXPRES : leur message dit ce qu'elles sont, et elles constituent
-- la preuve que `raise` depuis une fonction cron produit bien une trace
-- lisible. Ne pas recreer de job jetable : c'est fait, et une fois suffit.
--
-- Seul le HINT change : il couvre les nouvelles familles d'ecarts.

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
    -- casser BRUYAMMENT plutot que de rendre un vert silencieux.
    raise exception
      'SECURITE SGNF — % exposition(s) anonyme(s) hors ligne de base : %',
      v_n, jsonb_pretty(v_rapport->'ecarts')
      using
        hint =
          'Diagnostic : select public.controle_exposition_anon(); '
          || 'Si l''ouverture est DELIBEREE, inscrire l''objet dans la ligne de base '
          || 'via une migration remplacant public.controle_exposition_anon() '
          || '(voir 20260730050000). Sinon, selon la famille d''ecart : '
          || 'fonction -> revoke execute on function ... from public, anon; '
          || 'table sans RLS -> alter table ... enable row level security; '
          || 'SELECT niveau table -> revoke select on ... from anon; '
          || 'grant de colonne -> revoke select (col) on ... from anon; '
          || 'aclitem PUBLIC -> revoke ... from public; '
          || 'vue lisible -> refermer la relation sous-jacente, pas la vue. '
          || 'Sonde inoperante -> le controle est AVEUGLE sur les vues : '
          || 'il doit tourner sous un role MEMBRE de anon (le job cron tourne sous postgres).';
  end if;
end;
$$;

revoke execute on function public.controle_exposition_anon_cron() from public, anon;

-- --- 3. Ordonnancement : INCHANGE --------------------------------------
--
-- Le job 4 `securite-exposition-anon` ('23 * * * *') existe deja et pointe
-- sur `controle_exposition_anon_cron()`, dont seul le CORPS change ici.
-- Aucun `cron.schedule` n'est rejoue : ce fichier ne doit pas pouvoir
-- deplacer un ordonnancement. La verification ci-dessous constate qu'il est
-- toujours la, actif, et qu'il vise la bonne fonction.

-- --- 4. Verification EXECUTEE, pas supposee ----------------------------
--
-- La plus importante d'abord : le controle CORRIGE doit rendre 0 ecart sur
-- l'etat du jour. Si la ligne de base est fausse, la migration echoue au
-- lieu d'installer un dispositif qui criera au loup des la premiere heure —
-- et qui serait desarme dans la semaine.

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
      'Ligne de base FAUSSE : le controle corrige signale % ecart(s) sur l''etat du jour. Detail : %',
      v_n, jsonb_pretty(v_rapport->'ecarts');
  end if;

  -- La sonde a REELLEMENT pris le role `anon`. Sans cette assertion, une
  -- sonde inoperante donnerait « 0 vue lisible » donc 0 ecart, et la
  -- migration passerait au vert en n'ayant rien mesure du tout.
  if v_rapport->'constat'->>'role_effectif_de_la_sonde' <> 'anon' then
    raise exception
      'Sonde des vues INOPERANTE : role effectif = %. Le controle serait aveugle sur les vues.',
      v_rapport->'constat'->>'role_effectif_de_la_sonde';
  end if;

  -- La sonde a bien vu la vue qu'on sait lisible. Une sonde qui ne trouve
  -- RIEN de lisible est suspecte : c'est la signature d'un emprunt de role
  -- qui n'a pas pris, ou d'une boucle qui ne s'execute pas.
  if not (v_rapport->'constat'->'vues_REELLEMENT_lisibles_par_anon')
          ? 'photos_annonces_publiques' then
    raise exception
      'Sonde des vues SUSPECTE : photos_annonces_publiques, mesuree lisible par anon le 30/07/2026, ne l''est plus. Vues vues lisibles : %',
      v_rapport->'constat'->'vues_REELLEMENT_lisibles_par_anon';
  end if;

  -- Le role de l'appelant a bien ete restaure apres la sonde.
  if current_user <> session_user then
    raise exception
      'Le role n''a PAS ete restaure apres la sonde : current_user = %, session_user = %.',
      current_user, session_user;
  end if;

  -- Le nouveau controle voit-il ce que l'ancien ne voyait pas ? On verifie
  -- que les compteurs sont bien alimentes, sinon la couverture ajoutee
  -- serait cosmetique.
  if (v_rapport->'constat'->>'nb_tables_select_anon_niveau_table')::int < 1
  or (v_rapport->'constat'->>'nb_colonnes_ouvertes_a_anon')::int <> 8 then
    raise exception
      'Compteurs de couverture inattendus : tables SELECT niveau table = %, colonnes ouvertes a anon = % (attendu 63 et 8).',
      v_rapport->'constat'->>'nb_tables_select_anon_niveau_table',
      v_rapport->'constat'->>'nb_colonnes_ouvertes_a_anon';
  end if;

  -- Le job existe toujours, actif, et vise la bonne fonction.
  select jobid, schedule, command, active, username
    into v_job
  from cron.job where jobname = 'securite-exposition-anon';

  if not found then
    raise exception 'Job cron securite-exposition-anon absent.';
  end if;
  if not v_job.active then
    raise exception 'Job cron securite-exposition-anon present mais INACTIF.';
  end if;
  if v_job.command not like '%controle_exposition_anon_cron%' then
    raise exception 'Job cron securite-exposition-anon pointe ailleurs : %', v_job.command;
  end if;

  -- Le controle ne doit pas s'auto-signaler.
  if pg_catalog.has_function_privilege('anon', 'public.controle_exposition_anon()', 'EXECUTE')
  or pg_catalog.has_function_privilege('anon', 'public.controle_exposition_anon_cron()', 'EXECUTE') then
    raise exception 'Les fonctions du controle sont elles-memes executables par anon.';
  end if;

  raise notice
    'Controle CORRIGE installe et SILENCIEUX (0 ecart). Job % (%), constat : %.',
    v_job.jobid, v_job.schedule, v_rapport->'constat';
end $$;
