-- =====================================================================
-- Fermer anon ET authenticated sur toute la famille `_appliquer_*`
-- (helpers internes du maker-checker)
-- =====================================================================
--
-- POURQUOI CES FONCTIONS N'ONT AUCUNE RAISON D'ETRE APPELABLES DIRECTEMENT
--
-- Les `_appliquer_*` sont les cinq bras d'UNE seule fonction publique :
-- `approuver_soumission(uuid, text)`. C'est elle, et elle seule, qui porte la
-- garde d'autorisation du dispositif maker-checker :
--
--     if not public.est_admin() then
--       raise exception 'Action réservée aux administrateurs.';
--     end if;
--
-- puis elle verrouille la soumission (`for update`), refuse celles qui ne sont
-- pas `en_attente`, aiguille vers le bras correspondant a son `type`, et
-- consigne `traite_par` / `traite_le` / `resultat`.
--
-- 🔴 AUCUN des cinq bras ne porte de garde d'autorisation. Les cinq corps ont
-- ete relus un par un le 29/07/2026 : ce qu'on y trouve, ce sont des controles
-- METIER (payload complet, lot appartenant bien au lotissement declare, gel
-- juridique, aucune attestation creee pendant la saisie) — jamais un controle
-- de QUI appelle. Les `auth.uid()` qu'on y lit ne gardent rien : ils
-- renseignent des colonnes d'audit (`lots.cree_par`, `attributaires.cree_par`).
-- Une heuristique sur `prosrc` les compte a tort comme des gardes ; c'est un
-- faux positif, et c'est exactement ainsi qu'on croit une fonction protegee
-- alors que son seul rempart est son ACL.
--
-- Consequence directe : tant qu'un role peut les appeler sur
-- `/rest/v1/rpc/<nom>`, il ecrit au registre foncier SANS soumission, SANS
-- approbation, et SANS trace dans `soumissions_saisie`. Le maker-checker est
-- alors contournable par sa porte de service.
--
-- CE QUI ETAIT OUVERT, ET PROUVE ATTEIGNABLE EN PRODUCTION LE 29/07/2026
-- (charge `{"p_payload":{}}`, qui avorte sur un `raise` AVANT toute ecriture ;
--  une erreur P0001 du CORPS prouve que la fonction s'est bel et bien executee,
--  la ou un 42501 prouve qu'elle a ete refusee) :
--
--   · anon, cle publique seule, sans aucun compte :
--       _appliquer_creation_structure  → 400 P0001 « Nom du lotissement manquant. »
--       _appliquer_maj_attributions    → 400 P0001 « lotissement_id manquant… »
--     Soit, avec un vrai payload : creer un lotissement, ses ilots, ses lots,
--     des autorites coutumieres, des operateurs, des familles ; et reattribuer
--     des lots existants a un attributaire choisi.
--
--   · authenticated, JWT reel obtenu par signInWithPassword — y compris
--     `manuel.acquereur@sgfn.ci`, un simple compte ACQUEREUR, qui n'a rien a
--     voir avec la saisie :
--       _appliquer_creation_lotissement     → 400 P0001
--       _appliquer_modification_lotissement → 400 P0001
--       _appliquer_creation_structure       → 400 P0001
--       _appliquer_maj_attributions         → 400 P0001
--     Le role BASE est `authenticated` pour tout compte connecte : le groupe
--     applicatif (acquereur, geometre, chefferie…) n'entre pas en ligne de
--     compte. Ouvrir a `authenticated`, c'est ouvrir a tout le monde connecte.
--
-- ⭐ LA FORME DE REFERENCE EXISTE DEJA DANS LA FAMILLE
--
-- `_appliquer_maj_attributaire(jsonb)` portait deja, avant cette migration,
-- l'ACL exacte que l'on vise :
--
--     {postgres=X/postgres, service_role=X/postgres}
--
-- ni `anon`, ni `authenticated`, ni PUBLIC. Elle fonctionne ainsi depuis le
-- 26/07 (migration 20260726150000) et `approuver_soumission` l'appelle sans
-- difficulte. Cette migration ne fait qu'aligner ses quatre soeurs sur elle :
-- il n'y a aucune regle nouvelle a inventer, seulement une regle a generaliser.
--
-- POURQUOI REVOQUER N'EMPECHE PAS `approuver_soumission` DE FONCTIONNER
--
-- `approuver_soumission` est SECURITY DEFINER et appartient a `postgres`.
-- Pendant son execution, le role effectif est donc `postgres`, qui conserve
-- son grant. Ce raisonnement a ete VERIFIE PAR L'EXECUTION, pas seulement
-- ecrit : en transaction annulee, revocation deja appliquee, session
-- `set local role authenticated` (claims reinitialisees puis posees sur
-- manuel.admin), les CINQ branches ont ete rejouees pour de vrai et ont rendu
-- leur jsonb — creation d'un lotissement, modification relue sur la ligne,
-- creation d'une structure (1 ilot / 1 lot), attribution effective
-- (`statut_lot` relu a `attribue`), creation d'un attributaire. Dans la MEME
-- session et le MEME role, l'appel DIRECT de chacun des cinq helpers rendait
-- `42501 permission denied for function`. C'est ce contraste — meme session,
-- meme role, un chemin passe et l'autre non — qui demontre que l'appel
-- imbrique s'execute sous `postgres`.
--
-- CE QUE FAIT CETTE MIGRATION, ET RIEN DE PLUS
--
-- Elle revoque EXECUTE a `anon`, `authenticated` et PUBLIC sur les fonctions
-- `public._appliquer_*`, et laisse `postgres` et `service_role` intacts.
-- Le ciblage se fait sur le motif de nom puis par `oid::regprocedure` : les
-- surcharges eventuelles sont attrapees sans qu'aucune signature ne soit
-- ecrite a la main. Un futur membre de la famille sera ferme par defaut, ce
-- qui est le bon sens de la porte : s'il devait etre appelable, il faudrait
-- l'ouvrir explicitement, et donc l'assumer.
--
-- 🔴 LE SUJET N'EST PAS CLOS — CHANTIER TOUJOURS OUVERT
--
--   (a) Sur 138 fonctions de `public`, **95 portaient encore `anon` en EXECUTE**
--       au moment d'ecrire ces lignes. Cette migration n'en ferme que deux de
--       plus (creation_structure, maj_attributions) : il en reste ~93 a
--       balayer une par une, pour trancher celles qui doivent rester
--       publiques. Personne ne doit lire ce fichier comme la fin du dossier.
--       A noter au passage, releve pendant ce travail : `approuver_soumission`
--       elle-meme porte `anon=X/postgres`. Elle est vraiment gardee par
--       `est_admin()`, donc l'exposition est benigne — mais elle fait partie
--       des ~93 a reprendre.
--
--   (b) LA CAUSE n'est pas corrigee ici. Le projet porte des
--       `alter default privileges ... grant all on functions to anon`
--       (`pg_default_acl`, objtype 'f', poses par `postgres` ET par
--       `supabase_admin`, sur les schemas public ET storage). Tant qu'ils sont
--       la, **toute** fonction creee dans `public` naitra avec un grant NOMME
--       `anon=X/postgres` — qu'un `revoke ... from public` ne retire pas,
--       puisqu'il ne touche que le grant implicite `=X/postgres`.
--
--   (c) ⚠️ PIEGE A RETENIR : `create or replace function` PRESERVE l'ACL, mais
--       un `drop function` + `create function` la RECREE depuis les default
--       privileges — et ranime donc le grant `anon`. Toute future migration
--       qui recreerait l'un de ces helpers par drop/create rouvrirait la
--       porte, en silence. Rejouer ce fichier suffit a refermer.
--
-- Migration IDEMPOTENTE : revoquer un droit deja absent est sans effet, et le
-- fichier est ecrit pour pouvoir etre rejoue autant de fois que necessaire
-- (c'est d'ailleurs le remede au piege (c)).
-- =====================================================================

do $$
declare
  r            record;
  v_traitees   int := 0;
  v_manquants  text;
  v_restantes  text;
  v_perdus     text;
  -- Les cinq bras connus au 29/07/2026. La liste ne sert PAS au ciblage
  -- (le motif s'en charge) : elle sert de garde-fou, pour que la migration
  -- refuse de se croire efficace si l'un d'eux avait disparu ou ete renomme.
  v_attendus   text[] := array[
    '_appliquer_creation_lotissement',
    '_appliquer_modification_lotissement',
    '_appliquer_creation_structure',
    '_appliquer_maj_attributions',
    '_appliquer_maj_attributaire'
  ];
begin
  ------------------------------------------------------------------
  -- 1. Les cinq bras attendus sont-ils bien la ?
  ------------------------------------------------------------------
  select string_agg(a, ', ') into v_manquants
  from unnest(v_attendus) a
  where not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = a);

  if v_manquants is not null then
    raise exception
      'Famille _appliquer_* incomplete : % introuvable(s) dans public. Migration jouee trop tot, ou fonction renommee : a investiguer avant de continuer.',
      v_manquants;
  end if;

  ------------------------------------------------------------------
  -- 2. La revocation, sur le motif de nom, signature par signature
  ------------------------------------------------------------------
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like '\_appliquer\_%'
  loop
    -- `anon` et `authenticated` : les grants NOMMES poses par les default
    -- privileges. Ce sont eux qui rendent la fonction appelable sur
    -- /rest/v1/rpc ; un `revoke ... from public` ne les retire pas.
    execute format('revoke execute on function %s from anon', r.sig);
    execute format('revoke execute on function %s from authenticated', r.sig);
    -- PUBLIC : le grant IMPLICITE. Absent sur ces cinq aujourd'hui, mais le
    -- retirer ferme la porte a tout role futur sans grant nomme, et rend le
    -- fichier utile tel quel si un drop/create le ranimait (piege (c)).
    execute format('revoke execute on function %s from public', r.sig);
    v_traitees := v_traitees + 1;
  end loop;

  if v_traitees = 0 then
    raise exception 'Aucune fonction _appliquer_* trouvee dans public : migration inoperante, a investiguer.';
  end if;

  ------------------------------------------------------------------
  -- 3. Garde-fou : on RELIT l'ACL reelle dans pg_proc.proacl.
  --
  -- Ce depot a deja ete trompe par un `revoke ... from public` parfaitement
  -- ecrit et totalement inerte. La presence de l'instruction ne prouve rien,
  -- et `has_function_privilege` seul non plus : c'est l'aclitem qui tranche.
  ------------------------------------------------------------------
  select string_agg(p.oid::regprocedure::text || ' → ' || coalesce(p.proacl::text, 'null'), E'\n  ')
    into v_restantes
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname like '\_appliquer\_%'
    and exists (
      select 1 from unnest(coalesce(p.proacl, '{}'::aclitem[])) a
      where a::text like 'anon=%'          -- grant nomme a anon
         or a::text like 'authenticated=%' -- grant nomme a authenticated
         or a::text like '=%'              -- grant implicite a PUBLIC
    );

  if v_restantes is not null then
    raise exception 'Revocation INOPERANTE, l''ACL relue le dit :%s  %', E'\n', v_restantes;
  end if;

  ------------------------------------------------------------------
  -- 4. Et l'inverse : ne pas avoir coupe trop large.
  --
  -- `postgres` porte l'execution imbriquee depuis `approuver_soumission`
  -- (SECURITY DEFINER) ; `service_role` sert aux edge functions et aux
  -- travaux de maintenance. Perdre l'un des deux casserait l'approbation.
  ------------------------------------------------------------------
  select string_agg(p.oid::regprocedure::text || ' → ' || coalesce(p.proacl::text, 'null'), E'\n  ')
    into v_perdus
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname like '\_appliquer\_%'
    and not (
      exists (select 1 from unnest(coalesce(p.proacl, '{}'::aclitem[])) a where a::text like 'postgres=%X%')
      and exists (select 1 from unnest(coalesce(p.proacl, '{}'::aclitem[])) a where a::text like 'service_role=%X%')
    );

  if v_perdus is not null then
    raise exception 'Revocation TROP LARGE : postgres ou service_role a perdu EXECUTE :%s  %', E'\n', v_perdus;
  end if;

  raise notice 'Famille _appliquer_* alignee sur _appliquer_maj_attributaire : % signature(s), ACL reduite a postgres + service_role.', v_traitees;
end $$;
