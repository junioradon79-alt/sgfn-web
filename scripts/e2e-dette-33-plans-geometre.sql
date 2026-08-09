-- ============================================================================
--  DETTE #33 — note de vérification, rejouable AVANT et APRÈS la migration
--  20260809100000_borner_les_plan_lot_du_geometre_lecture_depot_et_binaire.sql
--
--  COMMENT L'EXÉCUTER (le `-ReadOnly` est OBLIGATOIRE, et il suffit) :
--
--    powershell -File scripts\supabase-sql.ps1 `
--      -SqlFile scripts\e2e-dette-33-plans-geometre.sql -ReadOnly
--
--  Ce fichier ne contient AUCUNE instruction mutante et AUCUN `begin` en
--  début de ligne : c'est `-ReadOnly` qui fournit la transaction
--  (`begin; set transaction read only; … rollback;`), ce qui rend
--  l'emprunt de rôle possible sans qu'aucune écriture ne soit physiquement
--  autorisée. Il rend UN seul résultat, en fin de fichier.
--
--  ── CE QUE CETTE NOTE MESURE, ET COMMENT ─────────────────────────────────
--  Toutes les lectures de documents sont faites PAR EMPRUNT DE RÔLE, jamais
--  en admin — une requête admin ne dit rien de ce que lit un rôle (faux
--  rouge produit ainsi le 08/08). Chaque identité rend son propre TÉMOIN
--  (`auth.uid()`, `mon_groupe()`, `current_user`) relevé DANS la
--  transaction : sans lui, on ne sait pas qui a lu.
--  Les ensembles sont comparés par MD5 des identifiants lus, pas par leur
--  seul compte : deux comptes justes peuvent porter les mauvaises lignes.
--
--  ── ⚠️ LE PIÈGE DE LECTURE DE CETTE DETTE — À LIRE AVANT DE CONCLURE ─────
--  Les 2 seuls `plan_lot` du pays ont été déposés par le géomètre de
--  démonstration lui-même. Donc AVANT COMME APRÈS le correctif,
--  `md5_plan_lot_lus` du géomètre est ÉGAL à `md5_plan_lot_national`.
--  Cette égalité PROUVAIT la fuite avant (il lisait tout le stock) ; après,
--  elle ne prouve plus rien — ni la fuite, ni sa fermeture. Ne pas la lire
--  comme un rouge.
--  Ce qui prouve la fermeture est en §D (le tiers) et en §E (les prédicats
--  installés). Ce qui prouve la NON-RÉGRESSION est en §C (le géomètre lit
--  toujours ses 2 plans, md5 identique).
--
--  ── VALEURS DE RÉFÉRENCE, MESURÉES LE 09/08/2026 AVANT APPLICATION ───────
--    geometre_demo : documents_lus=2, plan_lot_lus=2,
--                    md5_ids_lus = 4d633e8fa209650081ea3968711df5b1
--    stock national plan_lot : 2, même md5
--    missions_geometre : 0 ligne
--    plan_lot déposés par un AUTRE que le géomètre de démo : 0
--    objets sous plans-cad/ : 7, dont 4 orphelins (aucune ligne documents)
--
--  ── CRITÈRES D'ACCEPTATION APRÈS APPLICATION ─────────────────────────────
--   ① geometre_demo.documents_lus = 2 ET
--     md5_ids_lus = 4d633e8fa209650081ea3968711df5b1  (INCHANGÉ — l'écran
--     `/dashboard/documents` ne doit pas s'être vidé)
--   ② §D.tiers_lirait = 0  (démonstration, cf. la limite honnête ci-dessous)
--   ③ §F.insert_usurpe = false, §F.insert_signe = true
--   ④ chefferie et opérateur du lot : comptes et md5 INCHANGÉS avant/après
--     (ce fichier ne touche aucune de leurs policies ; toute variation est
--     un dommage collatéral).
--     🔴 CE CRITÈRE N'AVAIT AUCUNE LIGNE DE BASE — il ne pouvait donc pas
--     échouer. Défaut relevé par le vérificateur le 09/08. Valeurs mesurées
--     ce jour AVANT application, à comparer telles quelles :
--       chefferie e7091e37… : 162 documents,
--                             md5 = d507eadb716e3046bf80b32019398f6d
--       opérateur 6e5f6dee… :   3 documents,
--                             md5 = 6483c2ee3b65ffcb539510ec5558da4f
--     Les deux doivent continuer à lire les 2 `plan_lot` du lot témoin.
--   ④bis §A.md5_autres_policies_documents = 20e0949b1f59e783f5e7e65d0384c557
--     (les CINQ autres policies de `documents` sont inchangées : ce fichier
--     n'en altère aucune, une variation signalerait un effet de bord)
--   ④ter contrôle horaire `securite-exposition-anon` : nb_ecarts = 0, avec un
--     balayage NON VIDE (nb_fonctions_public = 149, nb_fonctions_anon = 19,
--     nb_tables_base = 64, nb_vues = 9). Un « 0 écart » sur un balayage vide
--     serait un faux vert.
--   ⑤ §G : les deux fonctions neuves existent, et ni `anon` ni `PUBLIC` ne
--     figurent dans leur ACL
--
--  ── 🔴 LES DEUX LIMITES DE CETTE NOTE, DITES FRANCHEMENT ─────────────────
--  (1) LE TIERS N'EST PAS EMPRUNTÉ, IL EST DÉMONTRÉ. Il n'existe qu'UN seul
--      compte `groupe='geometre'` en production, et `demandes_inscription_
--      geometre` est vide : on ne peut pas emprunter l'identité d'un
--      géomètre concurrent qui n'existe pas. §D établit donc les deux
--      seules mesures dont dépendent les deux branches du prédicat —
--      « aucun `plan_lot` n'a un autre déposant » et « `missions_geometre`
--      est vide » —, ce qui suffit à conclure que TOUT autre géomètre
--      lirait 0. La conclusion est déductive, la mesure ne l'est pas.
--      POUR LA RENDRE EMPIRIQUE, une seule manœuvre, à autoriser
--      explicitement car elle ÉCRIT : qu'un ADMIN téléverse un plan depuis
--      `/dashboard/documents` (le bouton lui est ouvert). Le géomètre doit
--      alors continuer à lire 2 documents, pas 3. Avant le correctif il en
--      aurait lu 3. C'est le seul essai qui distingue vraiment les deux
--      états — et il ne peut pas être fait en lecture seule.
--  (2) LE `WITH CHECK` D'INSERT EST ÉVALUÉ, PAS DÉCLENCHÉ. Une transaction
--      en lecture seule refuse tout INSERT avec `25006` AVANT que la policy
--      ne soit consultée : un essai réel n'y prouverait rien. §F réécrit
--      donc le prédicat et l'évalue sous l'identité du géomètre, et §E
--      imprime À CÔTÉ le texte EXACT du prédicat en catalogue. Le
--      vérificateur doit comparer les deux à l'œil : c'est cette
--      comparaison qui fait la preuve, pas le booléen seul.
-- ============================================================================


-- ── §0. Identités, résolues en admin AVANT tout emprunt de rôle ────────────
-- (une fois `set local role authenticated` posé, `auth.users` n'est plus
--  lisible : tout ce qui doit être résolu en admin l'est ici.)

select set_config('sgnf.lot_temoin', 'b9f0cda3-0cfb-4d00-b261-52823e7a89e0', true);

select set_config('sgnf.uid_geo',
  coalesce((select u.id::text from auth.users u
            where u.email = 'manuel.geometre@sgfn.ci'), '(introuvable)'), true);

select set_config('sgnf.uid_chef',
  coalesce((select p.id::text
            from public.profiles p
            where p.autorite_coutumiere_id is not null
              and p.autorite_coutumiere_id = (
                select lo.autorite_coutumiere_id
                from public.lots l
                join public.ilots i on i.id = l.ilot_id
                join public.lotissements lo on lo.id = i.lotissement_id
                where l.id = current_setting('sgnf.lot_temoin')::uuid)
            order by p.id limit 1), '(introuvable)'), true);

select set_config('sgnf.uid_op',
  coalesce((select p.id::text
            from public.profiles p
            where p.operateur_id is not null
              and p.operateur_id = (
                select lo.operateur_id
                from public.lots l
                join public.ilots i on i.id = l.ilot_id
                join public.lotissements lo on lo.id = i.lotissement_id
                where l.id = current_setting('sgnf.lot_temoin')::uuid)
            order by p.id limit 1), '(introuvable)'), true);


-- ── §A. État en catalogue des TROIS objets touchés ─────────────────────────

select set_config('sgnf.policies', (
  select jsonb_agg(jsonb_build_object(
    'nom', pol.polname,
    'table', pol.polrelid::regclass::text,
    'cmd', case pol.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                           when 'w' then 'UPDATE' when 'd' then 'DELETE'
                           else 'ALL' end,
    'roles', (select jsonb_agg(r.rolname) from pg_roles r where r.oid = any(pol.polroles)),
    'using', pg_get_expr(pol.polqual, pol.polrelid),
    'with_check', pg_get_expr(pol.polwithcheck, pol.polrelid))
    order by pol.polname)
  from pg_policy pol
  where pol.polname in ('documents_geometre_plans_read',
                        'documents_geometre_plans_insert',
                        'documents_plans_cad_upload')
)::text, true);

-- Les CINQ autres policies de `documents` : elles se combinent en OU avec
-- celle qu'on resserre. Leur texte doit être IDENTIQUE avant et après.
select set_config('sgnf.autres_policies', (
  select md5(string_agg(pol.polname || '|' ||
             coalesce(pg_get_expr(pol.polqual, pol.polrelid),'-') || '|' ||
             coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid),'-'), E'\n'
             order by pol.polname))
  from pg_policy pol
  where pol.polrelid = 'public.documents'::regclass
    and pol.polname not in ('documents_geometre_plans_read',
                            'documents_geometre_plans_insert')
), true);


-- ── §B. Le stock, mesuré en ADMIN (référence, pas preuve d'accès) ──────────

select set_config('sgnf.stock', (
  select jsonb_build_object(
    'plan_lot_national', (select count(*) from public.documents where type = 'plan_lot'),
    'md5_plan_lot_national', (select md5(coalesce(string_agg(d.id::text, ',' order by d.id::text),'(vide)'))
                              from public.documents d where d.type = 'plan_lot'),
    'documents_total', (select count(*) from public.documents),
    'missions_geometre', (select count(*) from public.missions_geometre),
    'comptes_groupe_geometre', (select count(*) from public.profiles where groupe = 'geometre'),
    'objets_plans_cad', (select count(*) from storage.objects
                         where bucket_id = 'documents' and name like 'plans-cad/%'),
    'objets_plans_cad_orphelins', (select count(*) from storage.objects o
                         where o.bucket_id = 'documents' and o.name like 'plans-cad/%'
                           and not exists (select 1 from public.documents d
                                           where d.url_fichier = o.name or d.apercu_url = o.name))
  )::text), true);


-- ── §C. IDENTITÉ 1 — le géomètre de démonstration (non-régression) ─────────

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('sgnf.uid_geo'), 'role', 'authenticated')::text, true);
set local role authenticated;

select set_config('sgnf.mes_geo', (
  select jsonb_build_object(
    'temoin', coalesce(auth.uid()::text,'(null)')
           || ' / groupe=' || coalesce(public.mon_groupe()::text,'(null)')
           || ' / geometre_id=' || coalesce(public.mon_geometre_id()::text,'(null)')
           || ' / role=' || current_user,
    'documents_lus', (select count(*) from public.documents),
    'plan_lot_lus', (select count(*) from public.documents where type = 'plan_lot'),
    'md5_ids_lus', (select md5(coalesce(string_agg(d.id::text, ',' order by d.id::text),'(vide)'))
                    from public.documents d),
    'md5_plan_lot_lus', (select md5(coalesce(string_agg(d.id::text, ',' order by d.id::text),'(vide)'))
                         from public.documents d where d.type = 'plan_lot'),
    'plan_lot_lus_deposes_par_un_autre',
      (select count(*) from public.documents d
       where d.type = 'plan_lot' and d.televerse_par is distinct from auth.uid()),
    'objets_storage_lus', (select count(*) from storage.objects
                           where bucket_id = 'documents' and name like 'plans-cad/%')
  )::text), true);

reset role;


-- ── §D. LE TIERS — démonstration en deux mesures (cf. limite (1)) ──────────

select set_config('sgnf.tiers', (
  select jsonb_build_object(
    'branche_A_plan_lot_d_un_autre_deposant',
      (select count(*) from public.documents d
       where d.type = 'plan_lot'
         and (d.televerse_par is null
              or d.televerse_par is distinct from current_setting('sgnf.uid_geo')::uuid)),
    'branche_B_missions_existantes', (select count(*) from public.missions_geometre),
    'tiers_lirait', (
      select count(*) from public.documents d
      where d.type = 'plan_lot'
        and (
          (d.televerse_par is not null
           and d.televerse_par is distinct from current_setting('sgnf.uid_geo')::uuid)
          or (d.lot_id is not null
              and exists (select 1 from public.missions_geometre m where m.lot_id = d.lot_id))
        )),
    'lecture', 'branche A = 0 et branche B = 0 ⇒ tout géomètre autre que '
            || current_setting('sgnf.uid_geo') || ' lit 0 plan_lot. '
            || 'AVANT le correctif il en lisait '
            || (select count(*)::text from public.documents where type = 'plan_lot') || '.'
  )::text), true);


-- ── §E. Les deux fonctions installées par la migration ─────────────────────

select set_config('sgnf.fonctions', (
  select coalesce(jsonb_agg(jsonb_build_object(
      'nom', p.proname,
      'securite', case when p.prosecdef then 'SECURITY DEFINER' else 'invoker' end,
      'search_path', array_to_string(p.proconfig, ','),
      'acl', coalesce(array_to_string(p.proacl::text[], ' '), '(défaut = ouvert à PUBLIC !)'),
      'anon_peut_executer', has_function_privilege('anon', p.oid, 'execute'),
      -- ⚠️ `p.proacl is null` NE MESURE PAS CECI, contrairement à ce que le
      -- nom laissait croire dans une rédaction précédente : un ACL non nul
      -- peut parfaitement CONTENIR un aclitem PUBLIC explicite (`=X/postgres`,
      -- grantee vide avant le `=`) — et c'est précisément la forme que
      -- l'event trigger `evt_fonctions_neuves_fermees_a_anon` doit retirer.
      -- Les deux cas d'ouverture à PUBLIC sont donc testés séparément.
      'public_peut_executer', (
        p.proacl is null   -- défaut PostgreSQL : ouvert à PUBLIC
        or exists (select 1 from unnest(p.proacl) a where a::text like '=%')),
      'public_ouvert_par_defaut_acl_absent', p.proacl is null,
      'authenticated_peut_executer', has_function_privilege('authenticated', p.oid, 'execute'),
      'source', p.prosrc) order by p.proname), '[]'::jsonb)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('est_geometre_en_mission_sur_le_lot','plan_cad_reclame_par_sa_ligne')
)::text, true);


-- ── §F. IDENTITÉ 2 — le géomètre, table de vérité des DEUX `with check` ────
--
-- ⚠️ Prédicats RÉÉCRITS ici, pas déclenchés (cf. limite (2)). Les comparer
-- mot à mot avec `policies` du §A avant de leur accorder la moindre valeur.

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('sgnf.uid_geo'), 'role', 'authenticated')::text, true);
set local role authenticated;

select set_config('sgnf.check_insert', (
  select jsonb_build_object(
    'temoin', coalesce(auth.uid()::text,'(null)') || ' / role=' || current_user,

    -- documents_geometre_plans_insert — NEUF clauses depuis le 09/08 (quatre
    -- ajoutées au fil de DEUX passages du vérificateur : préfixe du chemin,
    -- interdiction des `..`, `apercu_url is null`, `lotissement_id is null`).
    -- ⚠️ Ces booléens sont FAUX PAR CONSTRUCTION pour les cas négatifs et vrais
    -- par construction pour `insert_signe` : ils reproduisent le prédicat, ils
    -- ne l'interrogent pas (cf. limite (2)). La preuve est la comparaison à
    -- l'œil avec `A_policies_touchees.with_check`, et elle n'a de valeur
    -- qu'APRÈS application de la migration. La ligne simulée
    -- porte l'id `aaaaaaaa-0000-4000-8000-000000000001`, d'où le chemin
    -- légitime `plans-cad/aaaaaaaa-…-000000000001/…`.
    --
    -- ⚠️ `televerse_par` n'est JAMAIS comparé à `auth.uid()` par lui-même ici :
    -- une rédaction précédente écrivait `auth.uid() = auth.uid()`, tautologie
    -- que seul `mon_groupe()` pouvait faire échouer. La valeur simulée vient
    -- de `sgnf.uid_geo`, résolu en §0 depuis `auth.users` par ADRESSE E-MAIL,
    -- donc par un chemin indépendant de la session empruntée.
    'insert_signe', (
      public.mon_groupe() = 'geometre'::public.groupe_utilisateur
      and 'plan_lot'::public.type_document = 'plan_lot'::public.type_document
      and current_setting('sgnf.uid_geo')::uuid is not null
      and current_setting('sgnf.uid_geo')::uuid = auth.uid()
      and 'plans-cad/aaaaaaaa-0000-4000-8000-000000000001/original.dxf' is not null
      and 'plans-cad/aaaaaaaa-0000-4000-8000-000000000001/original.dxf'
          like ('plans-cad/' || 'aaaaaaaa-0000-4000-8000-000000000001'::uuid::text || '/%')
      and 'plans-cad/aaaaaaaa-0000-4000-8000-000000000001/original.dxf' not like '%..%'
      and null::text is null            -- apercu_url is null
      and null::uuid is null),          -- lotissement_id is null
    -- 🔴 LA COLONNE VOISINE. `telecharger-document:79` signe `apercu_url`
    -- quand l'appelant demande `variant='apercu'`. Une ligne au chemin
    -- irréprochable mais à l'aperçu forgé rouvrait TOUTE l'escalade. Ce cas
    -- MANQUAIT à la première version de cette note, qui déclarait donc close
    -- une faille intacte. Doit valoir FALSE.
    'insert_apercu_forge', (
      public.mon_groupe() = 'geometre'::public.groupe_utilisateur
      and 'plan_lot'::public.type_document = 'plan_lot'::public.type_document
      and current_setting('sgnf.uid_geo')::uuid = auth.uid()
      and 'plans-cad/aaaaaaaa-0000-4000-8000-000000000001/original.dxf'
          like ('plans-cad/' || 'aaaaaaaa-0000-4000-8000-000000000001'::uuid::text || '/%')
      and 'attestations_cession/ATT-CESS-2026-00846.pdf'::text is null),
    -- Traversée : le `like` de préfixe est satisfait, mais le parseur d'URL
    -- normalise les `..` avant l'appel à storage. Doit valoir FALSE.
    'insert_chemin_traversee', (
      public.mon_groupe() = 'geometre'::public.groupe_utilisateur
      and 'plan_lot'::public.type_document = 'plan_lot'::public.type_document
      and current_setting('sgnf.uid_geo')::uuid = auth.uid()
      and 'plans-cad/aaaaaaaa-0000-4000-8000-000000000001/../../attestations_cession/ATT-CESS-2026-00846.pdf'
          like ('plans-cad/' || 'aaaaaaaa-0000-4000-8000-000000000001'::uuid::text || '/%')
      and 'plans-cad/aaaaaaaa-0000-4000-8000-000000000001/../../attestations_cession/ATT-CESS-2026-00846.pdf'
          not like '%..%'),
    -- Usurpation : `televerse_par` porte l'identité d'un AUTRE profil RÉEL
    -- (la chefferie du lot témoin, résolue en §0). L'uuid fabriqué
    -- `0000…0001` qui figurait ici était un témoin faible : il aurait violé
    -- la FK `documents_televerse_par_fkey` avant même d'atteindre la policy.
    'insert_usurpe', (
      public.mon_groupe() = 'geometre'::public.groupe_utilisateur
      and 'plan_lot'::public.type_document = 'plan_lot'::public.type_document
      and current_setting('sgnf.uid_chef')::uuid is not null
      and current_setting('sgnf.uid_chef')::uuid = auth.uid()),
    'insert_televerse_par_null', (
      public.mon_groupe() = 'geometre'::public.groupe_utilisateur
      and 'plan_lot'::public.type_document = 'plan_lot'::public.type_document
      and null::uuid is not null
      and null::uuid = auth.uid()),
    'insert_autre_type', (
      public.mon_groupe() = 'geometre'::public.groupe_utilisateur
      and 'plan_lotissement'::public.type_document = 'plan_lot'::public.type_document
      and current_setting('sgnf.uid_geo')::uuid = auth.uid()),
    -- 🔴 LA CLAUSE QUI FERME L'ESCALADE : une ligne signée de son nom, mais
    -- dont `url_fichier` désigne une ATTESTATION. Sans la clause ajoutée le
    -- 09/08, elle passait — et `telecharger-document` signait ensuite une URL
    -- service_role sur ce chemin. Doit valoir FALSE.
    'insert_chemin_forge', (
      public.mon_groupe() = 'geometre'::public.groupe_utilisateur
      and 'plan_lot'::public.type_document = 'plan_lot'::public.type_document
      and current_setting('sgnf.uid_geo')::uuid = auth.uid()
      and 'attestations_cession/ATT-CESS-2026-00846.pdf'
          like ('plans-cad/' || 'aaaaaaaa-0000-4000-8000-000000000001'::uuid::text || '/%')),
    -- Chemin bien sous `plans-cad/`, mais dans le dossier d'une AUTRE ligne.
    'insert_chemin_autre_ligne', (
      public.mon_groupe() = 'geometre'::public.groupe_utilisateur
      and 'plan_lot'::public.type_document = 'plan_lot'::public.type_document
      and current_setting('sgnf.uid_geo')::uuid = auth.uid()
      and 'plans-cad/16dbe0f9-f5e8-41c6-9d5a-1ee12c4fec89/original.dwg'
          like ('plans-cad/' || 'aaaaaaaa-0000-4000-8000-000000000001'::uuid::text || '/%')),
    -- Rattachement au LOTISSEMENT : légal au regard de
    -- `documents_rattachement_exclusif`, désormais refusé par la policy.
    'insert_rattache_lotissement', (
      public.mon_groupe() = 'geometre'::public.groupe_utilisateur
      and 'plan_lot'::public.type_document = 'plan_lot'::public.type_document
      and current_setting('sgnf.uid_geo')::uuid = auth.uid()
      and 'plans-cad/aaaaaaaa-0000-4000-8000-000000000001/original.dxf'
          like ('plans-cad/' || 'aaaaaaaa-0000-4000-8000-000000000001'::uuid::text || '/%')
      and 'e0000000-0000-4000-8000-000000000009'::uuid is null),

    -- documents_plans_cad_upload (logique de plan_cad_reclame_par_sa_ligne,
    -- réécrite : la fonction n'existe pas avant la migration)
    'storage_chemin_reclame_par_sa_ligne', exists (
      select 1 from public.documents d
      where d.url_fichier = 'plans-cad/16dbe0f9-f5e8-41c6-9d5a-1ee12c4fec89/original.dwg'
        and d.type = 'plan_lot'::public.type_document
        and d.televerse_par is not null and d.televerse_par = auth.uid()),
    'storage_chemin_orphelin', exists (
      select 1 from public.documents d
      where d.url_fichier = 'plans-cad/04f25d99-e291-4cbd-ba8b-3e6e59c5b186/original.dwg'
        and d.type = 'plan_lot'::public.type_document
        and d.televerse_par is not null and d.televerse_par = auth.uid()),
    'storage_chemin_libre', exists (
      select 1 from public.documents d
      where d.url_fichier = 'plans-cad/quelconque.html'
        and d.type = 'plan_lot'::public.type_document
        and d.televerse_par is not null and d.televerse_par = auth.uid()),

    'attendu', 'insert_signe=true ; TOUS LES AUTRES insert_* = false '
            || '(usurpe, televerse_par_null, autre_type, chemin_forge, '
            || 'apercu_forge, chemin_traversee, chemin_autre_ligne, '
            || 'rattache_lotissement) ; '
            || 'storage_chemin_reclame=true ; orphelin=false ; libre=false'
  )::text), true);

reset role;


-- ── §G. IDENTITÉS 3 et 4 — chefferie et opérateur du lot témoin ────────────
-- Aucune de leurs policies n'est touchée : leurs comptes et md5 doivent être
-- STRICTEMENT identiques avant et après. Toute variation est collatérale.

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('sgnf.uid_chef'), 'role', 'authenticated')::text, true);
set local role authenticated;

select set_config('sgnf.mes_chef', (
  select jsonb_build_object(
    'temoin', coalesce(auth.uid()::text,'(null)')
           || ' / groupe=' || coalesce(public.mon_groupe()::text,'(null)')
           || ' / role=' || current_user,
    'documents_lus', (select count(*) from public.documents),
    'plan_lot_lus', (select count(*) from public.documents where type = 'plan_lot'),
    'md5_ids_lus', (select md5(coalesce(string_agg(d.id::text, ',' order by d.id::text),'(vide)'))
                    from public.documents d)
  )::text), true);

reset role;

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('sgnf.uid_op'), 'role', 'authenticated')::text, true);
set local role authenticated;

select set_config('sgnf.mes_op', (
  select jsonb_build_object(
    'temoin', coalesce(auth.uid()::text,'(null)')
           || ' / groupe=' || coalesce(public.mon_groupe()::text,'(null)')
           || ' / role=' || current_user,
    'documents_lus', (select count(*) from public.documents),
    'plan_lot_lus', (select count(*) from public.documents where type = 'plan_lot'),
    'md5_ids_lus', (select md5(coalesce(string_agg(d.id::text, ',' order by d.id::text),'(vide)'))
                    from public.documents d)
  )::text), true);

reset role;


-- ── §H. Le contrôle horaire d'exposition `anon` ────────────────────────────
--
-- Le critère ④ter était ANNONCÉ dans l'en-tête de cette note et n'était
-- produit NULLE PART : les chiffres y étaient affirmés, jamais mesurés. Un
-- critère qu'on ne calcule pas est un faux vert — défaut relevé par le
-- vérificateur le 09/08. Il est exécuté ici.
--
-- Ce qui compte n'est pas `nb_ecarts = 0` seul : c'est `0 écart SUR UN
-- BALAYAGE NON VIDE`. Un contrôle qui n'a rien regardé rend lui aussi 0.

select set_config('sgnf.anon', (
  select coalesce(to_jsonb(public.controle_exposition_anon()), '{}'::jsonb)::text
), true);


-- ── LE RAPPORT ─────────────────────────────────────────────────────────────

select jsonb_pretty(jsonb_build_object(
  'A_policies_touchees',        current_setting('sgnf.policies')::jsonb,
  'H_exposition_anon',          current_setting('sgnf.anon')::jsonb,
  'A_md5_autres_policies_documents', current_setting('sgnf.autres_policies'),
  'B_stock_admin',              current_setting('sgnf.stock')::jsonb,
  'C_geometre_demo',            current_setting('sgnf.mes_geo')::jsonb,
  'D_tiers_demonstration',      current_setting('sgnf.tiers')::jsonb,
  'E_fonctions_installees',     current_setting('sgnf.fonctions')::jsonb,
  'F_tables_de_verite_insert',  current_setting('sgnf.check_insert')::jsonb,
  'G_chefferie_du_lot',         current_setting('sgnf.mes_chef')::jsonb,
  'G_operateur_du_lot',         current_setting('sgnf.mes_op')::jsonb
)) as rapport_dette_33;
