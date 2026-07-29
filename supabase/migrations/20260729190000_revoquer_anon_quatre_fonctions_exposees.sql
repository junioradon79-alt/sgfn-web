-- =====================================================================
-- Fermer l'acces ANONYME a quatre fonctions atteignables en production
-- =====================================================================
--
-- LA CAUSE — elle n'est PAS corrigee ici, lisez jusqu'au bout.
--
-- Le projet porte un `alter default privileges ... grant all on functions
-- to anon` (visible dans `pg_default_acl`, objtype 'f', schema public, pose
-- par `postgres` ET par `supabase_admin`). Consequence : **toute** fonction
-- creee dans `public` recoit un grant EXECUTE *nomme* a `anon`, du type
-- `anon=X/postgres`. Un `revoke execute ... from public` ne le retire pas :
-- il ne touche que le grant implicite `=X/postgres`. C'est pour cela que
-- des fonctions internes, jamais exposees volontairement, sont appelables
-- sur `/rest/v1/rpc/<nom>` avec la seule cle anon publique, sans compte.
--
-- Releve le 29/07/2026 : sur 138 fonctions de `public`, **99 portent `anon`
-- en EXECUTE**. Quatre ont ete prouvees atteignables en production :
--
--   1. _appliquer_modification_lotissement — `{"p_payload":{}}` renvoyait
--      400 P0001 « lotissement_id manquant dans le payload. » : l'erreur
--      vient du CORPS, donc la fonction s'executait. Avec un
--      `lotissement_id` seul, son `update` remet a NULL village, commune,
--      district, superficie_texte, nb_lots, nb_ilots, guide_reference et
--      pv_identification_physique_* (piege « efface les champs absents »
--      deja documente). Les uuid de lotissements sont publiquement lisibles.
--   2. _appliquer_creation_lotissement — idem, « Nom du lotissement manquant. »
--   3. lots_verifiables — rendait 49 entrees a anon, references
--      d'attestation comprises ; chainee avec verifier_document, elle
--      transforme le modele « il faut detenir le QR » en enumeration.
--   4. enqueue_notification — HTTP 204 en anon : insertion libre dans le
--      fil de notifications de n'importe quel profil.
--
-- CE QUE FAIT CETTE MIGRATION, ET RIEN DE PLUS
--
-- Elle revoque EXECUTE a `anon` et a `public` sur CES QUATRE fonctions.
-- Elle ne touche ni aux 95 autres, ni a `alter default privileges`.
-- Le ciblage se fait par `oid::regprocedure` : si une surcharge apparait
-- un jour, elle est attrapee sans reecrire de signature a la main.
--
-- 🔴 CHANTIER RESTANT — LE SUJET N'EST PAS CLOS :
--   (a) balayer les ~95 autres fonctions portant `anon` en EXECUTE et
--       trancher, une par une, celles qui doivent rester publiques ;
--   (b) corriger la CAUSE, c'est-a-dire les `alter default privileges
--       ... on functions to anon` (roles postgres et supabase_admin,
--       schemas public ET storage) — tant qu'ils sont la, toute nouvelle
--       fonction naitra exposee a anon ;
--   (c) attention : `create or replace` PRESERVE l'ACL existante, mais un
--       `drop function` + `create function` la recree depuis les default
--       privileges. Une future migration qui recree l'une de ces quatre
--       fonctions par drop/create RANIMERA le grant anon. Rejouer ce
--       fichier apres coup suffit a refermer.
--
-- CE QUI A ETE VERIFIE AVANT D'APPLIQUER (repetition en transaction annulee)
--   * `approuver_soumission` continue de fonctionner : elle est SECURITY
--     DEFINER et appartient a `postgres`, donc au moment ou elle appelle
--     `_appliquer_creation_lotissement` / `_appliquer_modification_lotissement`
--     le role effectif est `postgres`, qui conserve son grant nomme. Joue
--     REELLEMENT sur les deux branches sous session admin, en transaction
--     annulee : les deux ont rendu leur jsonb.
--   * Idem pour `_appliquer_maj_attributaire` (secdef/postgres) et pour les
--     4 triggers de notification (notif_vente, notif_certificat_vente,
--     notif_demande_acquisition, notif_attestation_cession) : tous SECURITY
--     DEFINER appartenant a `postgres`, donc insensibles a cette revocation.
--   * `authenticated` conserve EXECUTE sur `lots_verifiables`
--     (/dashboard/acquisition et /dashboard/mon-achat), `service_role` aussi
--     (edge functions, pg_net).
--   * Aucune page publique n'appelle ces quatre fonctions : les seules RPC
--     atteintes hors dashboard sont demander_inscription_geometre,
--     valider_invitation, calculer_score_confiance, get_public_stats et
--     annonce_active_pour_reference.
--
-- Migration IDEMPOTENTE : un `revoke` d'un droit deja absent est sans effet.
-- =====================================================================

do $$
declare
  r          record;
  v_traitees int := 0;
  v_restantes int;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        '_appliquer_modification_lotissement',
        '_appliquer_creation_lotissement',
        'lots_verifiables',
        'enqueue_notification'
      )
  loop
    -- `anon` : le grant NOMME pose par les default privileges.
    execute format('revoke execute on function %s from anon', r.sig);
    -- `public` : le grant IMPLICITE, present sur lots_verifiables et
    -- enqueue_notification. Le retirer ferme aussi la porte a tout role
    -- futur qui n'aurait pas de grant nomme.
    execute format('revoke execute on function %s from public', r.sig);
    v_traitees := v_traitees + 1;
  end loop;

  if v_traitees = 0 then
    raise exception 'Aucune des quatre fonctions ciblees n''a ete trouvee dans public : migration inoperante, a investiguer.';
  end if;

  -- Garde-fou : ce depot a deja ete trompe par un `revoke` parfaitement
  -- ecrit et totalement inerte. On RELIT donc l'ACL reelle, on ne se fie
  -- pas a la presence de l'instruction.
  select count(*) into v_restantes
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      '_appliquer_modification_lotissement',
      '_appliquer_creation_lotissement',
      'lots_verifiables',
      'enqueue_notification'
    )
    and (
      -- grant nomme a anon
      exists (select 1 from unnest(coalesce(p.proacl, '{}'::aclitem[])) a
              where a::text like 'anon=%')
      -- ou grant implicite a PUBLIC (l'aclitem commence alors par '=')
      or exists (select 1 from unnest(coalesce(p.proacl, '{}'::aclitem[])) a
                 where a::text like '=%')
    );

  if v_restantes > 0 then
    raise exception 'Revocation inoperante : % fonction(s) portent encore anon ou PUBLIC en EXECUTE.', v_restantes;
  end if;

  -- Et l'inverse : les roles legitimes doivent avoir survecu.
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        '_appliquer_modification_lotissement',
        '_appliquer_creation_lotissement',
        'lots_verifiables',
        'enqueue_notification'
      )
      and not (
        has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and has_function_privilege('service_role', p.oid, 'EXECUTE')
      )
  ) then
    raise exception 'Revocation trop large : authenticated ou service_role a perdu EXECUTE.';
  end if;

  raise notice 'Acces anon/PUBLIC revoque sur % signature(s).', v_traitees;
end $$;
