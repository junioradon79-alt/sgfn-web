-- =====================================================================
-- Fermer `anon` sur les 74 fonctions de `public` hors allowlist
-- =====================================================================
--
-- ETAT MESURE EN PRODUCTION LE 30/07/2026, AVANT CE FICHIER
--   138 fonctions dans `public`, dont 93 executables par `anon` — c'est-a-dire
--   appelables sur `/rest/v1/rpc/<nom>` avec la seule cle publique anonyme,
--   sans compte. 78 d'entre elles sont SECURITY DEFINER : elles contournent
--   la RLS par construction.
--
--   Ce n'etait pas une decision : c'etait la consequence mecanique des
--   `pg_default_acl` du schema (voir 20260730010000). Personne n'a jamais
--   ouvert ces fonctions ; elles sont nees ouvertes.
--
-- CE QUE CETTE MIGRATION FAIT
--   Elle revoque EXECUTE a `anon` ET a `public` sur les 74 fonctions hors
--   allowlist, et elle transforme l'allowlist en grants NOMMES (revoke de
--   PUBLIC puis grant a anon) pour que l'intention soit relisible dans
--   `proacl` au lieu d'etre heritee d'un grant implicite.
--
--   Le double revoke n'est pas une precaution decorative : sur les 93,
--   63 portaient un grant implicite a PUBLIC (`=X/postgres`) en plus du
--   grant nomme (`anon=X/postgres`). Un `revoke ... from anon` seul aurait
--   laisse 63 fonctions ouvertes tout en paraissant reussir.
--
-- ---------------------------------------------------------------------
-- L'ALLOWLIST : 19 FONCTIONS, DEUX FAMILLES, CHACUNE JUSTIFIEE
-- ---------------------------------------------------------------------
--
-- FAMILLE 1 — 5 RPC appelees par une page REELLEMENT sans session.
--   Etabli en listant tous les `.rpc(` de `src/` : 68 sites d'appel, dont
--   63 sous `/dashboard` ou dans `src/features/mobile` (role `authenticated`,
--   donc hors sujet). Les 5 restants :
--
--   * get_public_stats()
--       src/hooks/usePublicStats.ts, consomme par src/components/home/
--       VitrineMain.tsx — les chiffres de la page d'accueil.
--   * calculer_score_confiance(uuid)
--       src/app/lotissements/[id]/LotissementDetailClient.tsx — route
--       publique, hors /dashboard, rendue en export statique.
--   * valider_invitation(text)
--       src/app/inscription/page.tsx — par construction appelee avant
--       qu'une session existe.
--   * demander_inscription_geometre(text x6)
--       src/app/devenir-geometre/page.tsx — formulaire public.
--   * annonce_active_pour_reference(text)
--       src/components/verification/InviteCompteAcquereur.tsx, monte par
--       src/components/verification/VerifierForm.tsx — la page /verifier.
--
--   NB : `verifier_document(text)` n'est PAS dans l'allowlist bien qu'elle
--   serve la page publique /verifier. Cette page ne l'appelle pas en RPC :
--   elle passe par l'edge function `verification-qr`, qui se connecte en
--   SUPABASE_SERVICE_ROLE_KEY (verifie ligne 25 de son index.ts). La
--   fermer a `anon` retire au passage la possibilite d'interroger le
--   registre sans passer par le peage de consultation.
--
-- FAMILLE 2 — 14 helpers appeles depuis une policy RLS evaluee pour `anon`.
--   C'est le piege principal de ce chantier. Une expression de policy est
--   evaluee AVEC LES DROITS DU ROLE QUI INTERROGE. Si `anon` perd EXECUTE
--   sur un helper cite dans le `USING` d'une table qu'il lit, la lecture ne
--   renvoie pas « zero ligne » : elle echoue en 42501, et la page publique
--   tombe. Aucune de ces 112 policies ne nomme `anon` explicitement — elles
--   portent toutes le role `public`, qui INCLUT `anon`. Chercher « anon »
--   dans pg_policies ne les trouve donc pas.
--
--     est_admin                 79 policies   -- dont annonces_marketplace
--     mon_groupe                18 policies       et photos_annonces, les
--     mon_attributaire_id       16 policies       deux lectures publiques
--     mon_commissaire_id         5 policies       du marketplace
--     est_comptable              4 policies
--     ma_chefferie_id            3 policies
--     ma_famille_attributaire_id 3 policies
--     mon_geometre_id            3 policies
--     mon_operateur_id           2 policies
--     peut_contacter             2 policies
--     ma_famille_id              1 policy
--     mes_lot_ids                1 policy
--     mon_collaborateur_id       1 policy
--     suis_participant           1 policy
--
--   PROUVE, pas suppose : en transaction annulee, avec l'allowlist reduite
--   aux 5 RPC, la lecture anonyme de `annonces_marketplace where statut =
--   'active'` et celle de `photos_annonces` passaient de 00000 a
--   « 42501 permission denied for function est_admin ». Le marketplace
--   public serait tombe. Six autres tables regressaient de meme
--   (attestations_coutumieres, constats, conversation_participants,
--   demandes_contact, missions_geometre, paiements, profiles, ventes).
--
--   Les 12 autres helpers ne servent, pour `anon`, qu'a rendre NULL : ils
--   ne fuitent rien. Ils sont conserves en application de la regle
--   d'arbitrage « dans le doute, laisser ouvert et signaler » — une lecture
--   publique cassee est un incident, une fonction ouverte un defaut connu.
--   Seul `est_admin` est prouve INDISPENSABLE ; les 13 autres sont une
--   precaution. Un chantier ulterieur pourra les rogner un par un, chacun
--   avec le test de lecture anonyme correspondant.
--
-- ---------------------------------------------------------------------
-- CE QUE CETTE MIGRATION NE CASSE PAS — TROIS RAISONNEMENTS VERIFIES
-- ---------------------------------------------------------------------
--
-- 1. LES TRIGGERS. On aurait pu croire qu'un trigger declenche par une
--    ecriture anonyme exige que `anon` ait EXECUTE sur sa fonction. C'EST
--    FAUX, et c'est mesure : `insert into demandes_contact default values`
--    joue en `set local role anon` rend « P0001 Jeton introuvable », qui est
--    le message de `tg_demande_contact_valide_jeton()` — alors que `anon`
--    n'a AUCUN droit d'execution sur cette fonction (et `authenticated`
--    non plus). PostgreSQL ne verifie EXECUTE sur une fonction de trigger
--    qu'au CREATE TRIGGER, jamais au declenchement. Les 33 fonctions de
--    trigger presentes dans la liste des 93 peuvent donc etre fermees sans
--    consequence. Accessoirement, cela repond au fil « demandes_contact »
--    laisse par l'audit precedent : `anon` y atteint bien un trigger BEFORE
--    (les triggers BEFORE s'executent AVANT le WITH CHECK de la RLS), mais
--    il n'a pas besoin du droit pour cela, et l'insertion est de toute
--    facon refusee ensuite.
--
-- 2. LES APPELS ENTRE FONCTIONS. `profil_de_attributaire`,
--    `destinataires_agence_lot`, `verifier_attestation` et
--    `verifier_attestation_attribution` ne sont appelees que depuis
--    d'autres fonctions — toutes SECURITY DEFINER et appartenant a
--    `postgres` (notif_vente, notif_certificat_vente,
--    notif_attestation_cession, notif_demande_acquisition,
--    verifier_document). L'appelant s'execute donc sous `postgres`, qui
--    conserve EXECUTE. Verifie en lisant `prosrc` de toutes les fonctions
--    de `public`.
--
-- 3. LES AUTRES ROLES. `authenticated` et `service_role` conservent
--    EXECUTE sur les 138 fonctions. Controle en fin de fichier, sur l'ACL
--    reelle. Les 3 taches `cron` (marquer_echeances_en_retard,
--    sgfn_call_edge x2) tournent en `postgres`.
--
-- ---------------------------------------------------------------------
-- ✅ PREUVE AVANT / APRES, EN TRANSACTION ANNULEE, ROLE `anon` EMPRUNTE
-- ---------------------------------------------------------------------
-- Emprunt : `set local request.jwt.claims = ''` PUIS `set local role anon`
-- (l'ordre compte : `reset role` ne reinitialise pas les revendications et
-- `auth.uid()` repondrait encore).
--
-- 42501 = ferme. Tout autre code = ATTEINTE : le corps s'est execute, donc
-- l'appel est bien passe. Les 12 ecritures SECURITY DEFINER echantillonnees
-- rendaient toutes P0001 AVANT — jamais 42501 :
--
--   creer_cession                    P0001 « Votre compte n'est rattache a aucun operateur… »
--   creer_vente                      P0001 « Demande introuvable. »
--   encaisser_vente_guichet          P0001 « Demande introuvable. »
--   convertir_demande_en_cession     P0001 « Demande introuvable. »
--   annuler_signature_attestation    P0001 « Action reservee aux administrateurs. »
--   approuver_soumission             P0001 « Action réservée aux administrateurs. »
--   revoquer_attestation             P0001 « Action reservee aux administrateurs. »
--   transferer_attribution           P0001 « Action reservee aux administrateurs. »
--   signer_attestation               P0001 « Attestation introuvable. »
--   soumettre_saisie                 P0001 « Authentification requise. »
--   marquer_paiement_recu            P0001 « Paiement introuvable: <NULL> »
--   valider_paiement_manuel          P0001 « Paiement introuvable: <NULL> »
--
-- APRES la revocation simulee : les 12 rendent 42501, les 5 RPC de
-- l'allowlist rendent exactement le meme code qu'avant, et AUCUNE des 20
-- lectures anonymes testees ne regresse.
--
-- ---------------------------------------------------------------------
-- 🔴 CE QUI RESTE OUVERT, ET CE QUI N'A PAS PU ETRE PROUVE
-- ---------------------------------------------------------------------
--   (a) 19 fonctions restent executables par `anon` — l'allowlist. 14 sont
--       une precaution, pas une necessite demontree (voir FAMILLE 2).
--   (b) 8 edge functions sont deployees sans source dans le depot (19
--       deployees, 11 dans supabase/functions/). Impossible de prouver par
--       le seul depot qu'aucune n'appelle une RPC avec la cle anon. Les 11
--       presentes ont ete verifiees : leurs 3 appels RPC
--       (verifier_document, marquer_paiement_recu, chef_autorite_a_la_date)
--       partent tous en SUPABASE_SERVICE_ROLE_KEY. Si une page blanchit
--       apres cette migration, commencer par la.
--   (c) `finaliser_inscription(text)` est fermee sans confirmation positive
--       qu'aucun appelant anonyme n'existe : elle n'apparait nulle part
--       dans `src/`, ni dans une policy, ni dans le corps d'une autre
--       fonction. Sa lecture tranche : elle ecrit `profiles ... where
--       id = auth.uid()` — inoperante sans session — mais marque quand meme
--       l'invitation `utilisee`. Ouverte a `anon`, elle permettait de
--       BRULER des codes d'invitation sans compte. La fermer corrige cela.
--       Le parcours reel passe par `valider_invitation`, qui reste ouverte.
--   (d) Les 73 tables de `public` portent toujours INSERT/UPDATE/DELETE
--       pour `anon` au niveau table. Hors perimetre de ce lot. La RLS les
--       retient : aucune policy d'ecriture de `public` n'est satisfiable
--       sans session (toutes exigent est_admin(), est_comptable(), un
--       controle de groupe ou auth.uid()) — verifie sur les 60 policies
--       INSERT/UPDATE/DELETE/ALL, et confirme en role `anon` sur
--       demandes_contact, suivis_parcelle et notifications.
--   (e) 🔴 DEFAUT PREEXISTANT, NON INTRODUIT ICI, NON CORRIGE ICI : en role
--       `anon`, `select ... from lots` echoue deja en « 42501 permission
--       denied for table lotissements » (la policy de `lots` lit
--       `lotissements`, ou `anon` n'a qu'un grant colonne par colonne sur 8
--       colonnes). De meme, attributions / attributaires / litiges /
--       attestations_cession / attestations_attribution_lot echouent en
--       42501 sur `lot_ids_operateur` ou `lot_ids_commissaire`, fermees a
--       `anon` par la migration 20260729200000. Consequence : le modal
--       « dossier du lot » de /lotissements/[id] est deja casse pour un
--       visiteur sans session. A traiter separement.
--
-- Migration IDEMPOTENTE et REJOUABLE : chaque revocation est journalisee.
-- ⚠️ `create or replace` PRESERVE l'ACL, mais `drop` + `create` la recree
-- depuis les default privileges. Une future migration qui recreerait l'une
-- de ces 74 fonctions par drop/create RANIMERAIT son grant PUBLIC (cf.
-- LIMITE 2 de 20260730010000). Rejouer ce fichier suffit a refermer.
-- =====================================================================

do $$
declare
  r            record;
  v_allowlist  text[] := array[
    -- Famille 1 : RPC appelees sans session
    'get_public_stats',
    'calculer_score_confiance',
    'valider_invitation',
    'demander_inscription_geometre',
    'annonce_active_pour_reference',
    -- Famille 2 : helpers cites dans une policy RLS evaluee pour anon
    'est_admin',
    'est_comptable',
    'ma_chefferie_id',
    'ma_famille_attributaire_id',
    'ma_famille_id',
    'mes_lot_ids',
    'mon_attributaire_id',
    'mon_collaborateur_id',
    'mon_commissaire_id',
    'mon_geometre_id',
    'mon_groupe',
    'mon_operateur_id',
    'peut_contacter',
    'suis_participant'
  ];
  v_revoquees  int := 0;
  v_allouees   int := 0;
  v_restantes  int;
  v_hors_liste text;
  v_manquantes text;
  v_sans_nom   text;
  v_perdus     text;
  v_touchees   text[] := '{}';
begin
  -- 1) Fermer tout ce qui n'est pas dans l'allowlist, a `anon` ET a PUBLIC.
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f','p')
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.proname <> all (v_allowlist)
    order by p.proname
  loop
    execute format('revoke execute on function %s from anon',   r.sig);
    execute format('revoke execute on function %s from public', r.sig);
    v_touchees  := v_touchees || r.sig::text;
    v_revoquees := v_revoquees + 1;
    raise notice 'anon ferme : %', r.sig;
  end loop;

  -- 2) L'allowlist : intention EXPLICITE. On retire le grant implicite a
  --    PUBLIC (qui ouvrirait aussi tout role futur) et on pose un grant
  --    nomme a `anon`, lisible dans `proacl`.
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f','p')
      and p.proname = any (v_allowlist)
    order by p.proname
  loop
    execute format('revoke execute on function %s from public', r.sig);
    execute format('grant  execute on function %s to anon',     r.sig);
    v_touchees := v_touchees || r.sig::text;
    v_allouees := v_allouees + 1;
  end loop;

  if v_revoquees = 0 and v_allouees = 0 then
    raise exception 'Migration inoperante : aucune fonction traitee dans public.';
  end if;

  -- ------------------------------------------------------------------
  -- CONTROLES SUR L'ACL REELLE. Ce depot s'est deja fait piéger par des
  -- `revoke` parfaitement ecrits et totalement inertes : on ne se fie pas
  -- a l'absence d'erreur, on relit.
  -- ------------------------------------------------------------------

  -- 2a) Plus aucune fonction hors allowlist ne doit etre atteignable.
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname)
    into v_hors_liste
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f','p')
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname <> all (v_allowlist);

  if v_hors_liste is not null then
    raise exception 'Revocation inoperante : anon atteint encore %', v_hors_liste;
  end if;

  -- 2b) ... et l'allowlist doit, elle, rester atteignable.
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname)
    into v_manquantes
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f','p')
    and p.proname = any (v_allowlist)
    and not has_function_privilege('anon', p.oid, 'EXECUTE');

  if v_manquantes is not null then
    raise exception 'Revocation trop large : l''allowlist a perdu anon sur %', v_manquantes;
  end if;

  -- 2c) L'allowlist doit tenir par un grant NOMME, pas par PUBLIC.
  --     `has_function_privilege` dit `true` dans les deux cas : il ne
  --     suffit pas. On lit `proacl`.
  select string_agg(p.oid::regprocedure::text, ', ' order by p.proname)
    into v_sans_nom
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f','p')
    and p.proname = any (v_allowlist)
    and not exists (select 1 from unnest(coalesce(p.proacl,'{}'::aclitem[])) a
                    where a::text like 'anon=%');

  if v_sans_nom is not null then
    raise exception 'Allowlist non explicite (pas de grant nomme a anon) sur %', v_sans_nom;
  end if;

  -- 2d) Personne d'autre ne doit avoir ete touche.
  --     23 fonctions de `public` sont deja fermees a `authenticated` AVANT
  --     ce fichier (helpers du maker-checker verrouilles par
  --     20260729200000, triggers internes, handle_new_user...). On ne peut
  --     donc pas exiger zero sur les 138 : on exige que ce fichier n'en ait
  --     pas AJOUTE, en ne controlant que les signatures qu'il a touchees.
  select string_agg(sig::text, ', ' order by sig::text)
    into v_perdus
  from unnest(v_touchees) as sig
  where not (has_function_privilege('authenticated', sig::regprocedure, 'EXECUTE')
             and has_function_privilege('service_role', sig::regprocedure, 'EXECUTE'));

  if v_perdus is not null then
    raise exception 'Revocation trop large : authenticated ou service_role a perdu EXECUTE sur %', v_perdus;
  end if;

  select count(*) into v_restantes
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f','p')
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  raise notice
    '% fonction(s) fermees a anon, % signature(s) d''allowlist regrantees. Restent % executables par anon.',
    v_revoquees, v_allouees, v_restantes;
end $$;
