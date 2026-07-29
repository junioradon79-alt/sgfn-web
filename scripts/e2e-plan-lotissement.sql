-- Le plan de morcellement au niveau du lotissement, exercé de bout en bout.
--
--   powershell> .\scripts\supabase-sql.ps1 -SqlFile .\scripts\e2e-plan-lotissement.sql
--
-- Attendu : 48 lignes, colonne `ok` à true partout.
--
-- ⚠️ SANS `-ReadOnly` : le fichier pilote lui-même `begin … rollback`, et le
-- commutateur refuse (à juste titre) tout script qui contient `begin` en début
-- de ligne. Le rollback final est ce qui rend l'exécution sûre en production.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CE QUE CE FICHIER PROUVE, ET POURQUOI IL EST ÉCRIT AINSI
--
-- 1. UNE GARDE D'ÉCRITURE NE SE PROUVE QUE PAR MUTATION — ET PAS PAR L'ERREUR.
--    Sous RLS, PostgreSQL ne traite pas les quatre verbes de la même façon :
--    un INSERT non couvert lève 42501, tandis qu'un UPDATE, un DELETE ou un
--    SELECT non couverts touchent 0 ligne SANS lever quoi que ce soit. « Pas
--    d'exception, donc c'est bon » est donc vrai pour l'un et faux pour les
--    trois autres — et l'inverse, « il y a une exception, donc c'est gardé »,
--    ne vaut pas davantage. Les contrôles 33 à 38 mesurent donc le seul fait
--    commun aux quatre verbes : APRÈS la tentative, la ligne est-elle en base,
--    et son contenu a-t-il bougé ? Le comptage se fait hors RLS (`reset role`
--    d'abord), sinon la policy de lecture masquerait une écriture réussie et un
--    dépôt abusif se lirait comme un refus. Ce défaut a déjà été payé trois
--    fois sur ce dépôt ; la première version de CE fichier l'a repayé une
--    quatrième (cf. le bandeau du §D).
--
-- 2. IL Y A TOUJOURS UN CAS QUI DOIT ÊTRE ACCEPTÉ.
--    Contrôles 8, 9, 32, 24, 26b : sans eux, une garde qui refuserait TOUT
--    passerait pour un correctif. Le dépôt admin doit marcher, la lecture
--    légitime doit rendre 1, l'insert `plan_lot` historique doit rester
--    possible.
--
-- 3. LE SCOPE SE PROUVE PAR LE VOISIN, PAS PAR SOI-MÊME.
--    Deux lotissements existent, chacun avec SON opérateur :
--      Brignan Kakodji     8820c6b8-…  opérateur 1b96f251-… (manuel.operateur)
--      Koelea-Accor revu   c0e74efc-…  opérateur 07244eb8-… (manuel.amenageur)
--    et un attributaire (6b66b553-…, « Compte Test — Propriétaire ») qui ne
--    détient de lots QUE dans Koelea. Chaque droit accordé est donc doublé du
--    refus symétrique chez le voisin. Un scope qui rend « vrai » partout se
--    voit ici, pas ailleurs.
--
-- 4. `reset role` NE RÉINITIALISE PAS `request.jwt.claims`.
--    Chaque bloc repose explicitement la variable à '' après usage : sans cela
--    le contrôle suivant hériterait de l'identité du précédent, et un refus
--    attendu passerait au vert pour la mauvaise raison.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- SÛRETÉ EN PRODUCTION — vérifiée, pas supposée
--   · `public.documents` ne porte AUCUN trigger (pg_trigger, hors internes) :
--     rien n'appelle `net.http_post` ni `sgfn_call_edge` depuis une écriture
--     ici. Aucune sortie hors base ne survit au rollback.
--   · Aucune séquence n'est consommée : `documents.id` est un uuid
--     (`uuid_generate_v4()`), pas un `nextval`. C'est la seule chose qu'un
--     rollback ne rattrape pas — le trou définitif laissé dans `seq_quittance`
--     par `scripts/e2e-paiement-guichet.sql` en est le rappel.
--   · Aucun objet n'est déposé dans le bucket : le §Storage lit les policies,
--     il ne téléverse rien.
--   · Toutes les lignes créées portent un id préfixé `e2e91a4-`, et le
--     contrôle 44 recompte la table après suppression explicite.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- PREUVE PAR MUTATION — faite le 29/07/2026, résultat ci-dessous
--
-- Ce fichier a été joué sur la production AVANT l'application de la migration
-- 20260729170000. Résultat : ERREUR au premier contrôle
-- (`column "lotissement_id" does not exist`), c'est-à-dire l'impossibilité
-- matérielle d'un faux vert sur la partie modèle de données.
-- La partie garde a été mutée séparément, migration appliquée, en ajoutant
-- à la main la policy permissive qu'on aurait pu écrire par réflexe :
--
--   create policy mut on public.documents for insert to authenticated
--     with check (lotissement_id is not null);
--
-- Contrôles tombés : 29, 30, 31 (les trois rôles non-admin réussissaient alors
-- leur insert : 1 ligne au lieu de 0). Le reste restait vert — la preuve que
-- ces trois contrôles-là, et eux seuls, mesurent la garde d'écriture.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- `ok boolean NOT NULL` : un contrôle qui virerait au NULL ne dit pas « faux »,
-- et tout comptage `where not ok` l'ignorerait en silence.
create temp table res(n int, controle text, ok boolean not null, detail text) on commit drop;

create temp table avant on commit drop as
select (select count(*) from public.documents) as nb_documents;

-- Identités et cibles, nommées une fois.
create temp table ctx on commit drop as select
  '8820c6b8-8ced-468f-bbcc-b63542d79621'::uuid as brignan,
  'c0e74efc-5dad-4b38-abe9-bd6f70be9464'::uuid as koelea,
  'a2accd0f-a597-4dcf-84e8-a01b88833085'::uuid as u_admin,
  'e7091e37-28de-4c9c-ac08-d603a0fae567'::uuid as u_chefferie,   -- ac a9c32cda (les 2 lotissements)
  '6e5f6dee-1c0c-4407-a5a1-50f23e4f4cc8'::uuid as u_op_brignan,  -- operateur 1b96f251
  '9609aa8b-52b2-4268-b09a-3eec71b360bc'::uuid as u_op_koelea,   -- operateur 07244eb8
  'd1c26661-9dab-4c47-8f08-a8d65b6fe5ec'::uuid as u_attr_koelea, -- attributaire 6b66b553, lots Koelea SEULEMENT
  'a8abac12-c892-426f-9345-8487aca49a83'::uuid as u_geometre,
  'c4912c37-e149-4a91-9786-f6c1623ba1b2'::uuid as u_verificateur,
  '62ce2e69-c93a-4555-9b64-4a8cf3d2c3c6'::uuid as u_acquereur,   -- attributaire_id NULL
  'e2e91a4c-0000-4000-8000-000000000001'::uuid as doc_brignan,
  'e2e91a4c-0000-4000-8000-000000000002'::uuid as doc_koelea;

-- ═══════════════════════════════════════════════════════════════════════════
-- A. Le logement en base
-- ═══════════════════════════════════════════════════════════════════════════

insert into res
select 1, 'documents.lotissement_id existe, uuid, FK vers lotissements ON DELETE CASCADE',
       coalesce(
         (select count(*) = 1 from information_schema.columns
           where table_schema='public' and table_name='documents'
             and column_name='lotissement_id' and data_type='uuid')
         and (select count(*) = 1 from pg_constraint
               where conrelid='public.documents'::regclass and contype='f'
                 and pg_get_constraintdef(oid) like 'FOREIGN KEY (lotissement_id) REFERENCES lotissements(id) ON DELETE CASCADE%'),
         false),
       coalesce((select string_agg(pg_get_constraintdef(oid), ' | ') from pg_constraint
                  where conrelid='public.documents'::regclass and contype='f'), '(aucune FK)');

insert into res
select 2, 'Les 3 colonnes de restitution fidele existent (nom_fichier, type_mime, taille_octets)',
       coalesce(count(*) = 3, false),
       coalesce(string_agg(column_name || ':' || data_type, ', ' order by column_name), '(aucune)')
from information_schema.columns
where table_schema='public' and table_name='documents'
  and column_name in ('nom_fichier','type_mime','taille_octets');

insert into res
select 3, 'Index sur lotissement_id (la fiche lotissement lit par ce filtre)',
       coalesce((select count(*) = 1 from pg_indexes
                  where schemaname='public' and tablename='documents'
                    and indexdef like '%(lotissement_id)%'), false),
       coalesce((select string_agg(indexname, ', ') from pg_indexes
                  where schemaname='public' and tablename='documents'
                    and indexdef like '%(lotissement_id)%'), '(aucun)');

insert into res
select 4, 'Contrainte d''exclusivite presente ET VALIDEE sur les lignes existantes',
       coalesce((select convalidated from pg_constraint
                  where conrelid='public.documents'::regclass
                    and conname='documents_rattachement_exclusif'), false),
       coalesce((select pg_get_constraintdef(oid) || ' / valide=' || convalidated::text from pg_constraint
                  where conrelid='public.documents'::regclass
                    and conname='documents_rattachement_exclusif'), '(absente)');

insert into res
select 5, 'Un plan_lotissement DOIT porter un lotissement_id — contrainte validee',
       coalesce((select convalidated from pg_constraint
                  where conrelid='public.documents'::regclass
                    and conname='documents_plan_lotissement_rattache'), false),
       coalesce((select pg_get_constraintdef(oid) || ' / valide=' || convalidated::text from pg_constraint
                  where conrelid='public.documents'::regclass
                    and conname='documents_plan_lotissement_rattache'), '(absente)');

-- Contraintes prouvées par mutation : on tente réellement les écritures interdites.
do $$
declare v_err text := '(aucune erreur — la contrainte n''a rien refuse)';
begin
  begin
    insert into public.documents (id, type, lot_id, lotissement_id, url_fichier)
    select 'e2e91a4c-0000-4000-8000-0000000000f1', 'plan_lotissement',
           (select l.id from lots l join ilots i on i.id=l.ilot_id where i.lotissement_id = c.brignan limit 1),
           c.brignan, 'plans-lotissement/x/f1.pdf' from ctx c;
  exception when check_violation then v_err := 'refuse : ' || sqlerrm;
  end;
  insert into res values (6, 'Mutation : lot_id ET lotissement_id ensemble sont REFUSES',
                          v_err like 'refuse :%', v_err);
end $$;

do $$
declare v_err text := '(aucune erreur — la contrainte n''a rien refuse)';
begin
  begin
    insert into public.documents (id, type, url_fichier)
    values ('e2e91a4c-0000-4000-8000-0000000000f2', 'plan_lotissement', 'plans-lotissement/x/f2.pdf');
  exception when check_violation then v_err := 'refuse : ' || sqlerrm;
  end;
  insert into res values (7, 'Mutation : plan_lotissement SANS rattachement est REFUSE',
                          v_err like 'refuse :%', v_err);
end $$;

-- Les deux cas qui doivent PASSER — sans eux, une contrainte qui refuse tout
-- ressemblerait à un correctif.
do $$
declare n int; v_err text := 'aucune';
begin
  begin
    insert into public.documents (id, type, lotissement_id, titre, url_fichier, nom_fichier, type_mime, taille_octets)
    select c.doc_brignan, 'plan_lotissement', c.brignan,
           'Plan de morcellement — controle e2e',
           'plans-lotissement/' || c.brignan || '/' || c.doc_brignan || '.pdf',
           'Plan de Morcellement Brignan Kakodji (Ebimpé 2020).pdf', 'application/pdf', 4194304
    from ctx c;
    get diagnostics n = row_count;
  exception when others then n := -1; v_err := sqlerrm;
  end;
  insert into res values (8, 'CONTRE-CONTROLE : plan_lotissement rattache au lotissement est ACCEPTE',
                          coalesce(n = 1, false), 'lignes=' || n || ' / erreur=' || v_err);
end $$;

do $$
declare n int; v_err text := 'aucune';
begin
  begin
    insert into public.documents (id, type, lot_id, url_fichier)
    select 'e2e91a4c-0000-4000-8000-0000000000f3', 'plan_lot',
           (select l.id from lots l join ilots i on i.id=l.ilot_id where i.lotissement_id = c.brignan limit 1),
           'plans-cad/e2e/f3.dxf' from ctx c;
    get diagnostics n = row_count;
  exception when others then n := -1; v_err := sqlerrm;
  end;
  insert into res values (9, 'CONTRE-CONTROLE : le rattachement historique au LOT reste possible',
                          coalesce(n = 1, false), 'lignes=' || n || ' / erreur=' || v_err);
end $$;

insert into res
select 10, 'Les lignes preexistantes (17 sans aucun rattachement) restent valides',
       coalesce((select count(*) = 0 from public.documents
                  where lot_id is not null and lotissement_id is not null), false),
       (select count(*)::text from public.documents where lot_id is null and lotissement_id is null)
       || ' ligne(s) sans rattachement, tolerees ; '
       || (select count(*)::text from public.documents where lot_id is not null and lotissement_id is not null)
       || ' ligne(s) doublement rattachee(s) (doit etre 0)';

-- Le second plan, sur Koelea : il sert au scope ET à /verifier plus bas.
insert into public.documents (id, type, lotissement_id, titre, url_fichier, nom_fichier, type_mime, taille_octets)
select c.doc_koelea, 'plan_lotissement', c.koelea, 'Plan Koelea — controle e2e',
       'plans-lotissement/' || c.koelea || '/' || c.doc_koelea || '.dwg',
       'Koelea-Accor.dwg', 'application/acad', 12582912
from ctx c;

-- ═══════════════════════════════════════════════════════════════════════════
-- B. Le prédicat de lecture, interrogé identité par identité
--
-- `peut_lire_documents_lotissement` est SECURITY DEFINER et ne lit que
-- `auth.uid()` : poser `request.jwt.claims` suffit, sans changer de rôle. Le
-- §C, lui, teste la RLS réelle et exige `set local role`.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare c record; r record;
begin
  select * into c from ctx;
  for r in
    select * from (values
      (11, c.u_admin,        c.brignan, true,  'admin — Brignan'),
      (12, c.u_chefferie,    c.brignan, true,  'chefferie de la juridiction — Brignan'),
      (13, c.u_op_brignan,   c.brignan, true,  'operateur du parc — Brignan (son lotissement)'),
      (14, c.u_op_brignan,   c.koelea,  false, 'operateur de Brignan — Koelea (le VOISIN : doit etre refuse)'),
      (15, c.u_op_koelea,    c.koelea,  true,  'operateur de Koelea — Koelea (son lotissement)'),
      (16, c.u_op_koelea,    c.brignan, false, 'operateur de Koelea — Brignan (le VOISIN : doit etre refuse)'),
      (17, c.u_attr_koelea,  c.koelea,  true,  'attributaire — Koelea (ou il detient des lots)'),
      (18, c.u_attr_koelea,  c.brignan, false, 'attributaire de Koelea — Brignan (aucun lot : doit etre refuse)'),
      (19, c.u_geometre,     c.brignan, false, 'geometre — refuse (aucun lien lotissement, cf. migration)'),
      (20, c.u_verificateur, c.brignan, false, 'verificateur — refuse'),
      (21, c.u_acquereur,    c.brignan, false, 'acquereur sans attributaire_id — refuse')
    ) t(n, uid, lotissement, attendu, libelle)
  loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', r.uid, 'role', 'authenticated')::text, true);
    insert into res
    select r.n, 'Predicat : ' || r.libelle,
           coalesce(public.peut_lire_documents_lotissement(r.lotissement) = r.attendu, false),
           'rendu=' || coalesce(public.peut_lire_documents_lotissement(r.lotissement)::text, '(null)')
           || ' / attendu=' || r.attendu::text;
  end loop;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- La garde NULL, celle qui a coûté trois fonctions le 28/07 : un profil sans
-- autorité coutumière ne doit RIEN ouvrir, même si le lotissement n'en a pas
-- non plus. `NULL = NULL` doit rester faux — `is not distinct from` aurait
-- rendu vrai et ouvert la lecture à tous les profils vides.
do $$
declare c record; v boolean;
begin
  select * into c from ctx;
  update public.profiles set autorite_coutumiere_id = null where id = c.u_chefferie;
  update public.lotissements set autorite_coutumiere_id = null where id = c.brignan;
  perform set_config('request.jwt.claims',
    json_build_object('sub', c.u_chefferie, 'role', 'authenticated')::text, true);
  v := public.peut_lire_documents_lotissement(c.brignan);
  perform set_config('request.jwt.claims', '', true);
  insert into res values (22, 'Garde NULL : profil sans autorite + lotissement sans autorite => REFUSE',
                          coalesce(v = false, false), 'rendu=' || coalesce(v::text,'(null)'));
  -- On remet l'état d'origine AVANT les contrôles suivants, qui s'appuient
  -- dessus. Le rollback final ne suffirait pas ici : c'est la même transaction.
  update public.profiles set autorite_coutumiere_id = 'a9c32cda-66bb-4f8b-b661-2c0ec0127dcb' where id = c.u_chefferie;
  update public.lotissements set autorite_coutumiere_id = 'a9c32cda-66bb-4f8b-b661-2c0ec0127dcb' where id = c.brignan;
end $$;

insert into res
select 23, 'Predicat sur un lotissement inconnu (NULL) : refuse, sans exception',
       coalesce(public.peut_lire_documents_lotissement(null) = false, false),
       'rendu=' || coalesce(public.peut_lire_documents_lotissement(null)::text, '(null)');

insert into res
select 24, 'ACL du predicat : anon NON, authenticated OUI',
       coalesce(
         has_function_privilege('anon', 'public.peut_lire_documents_lotissement(uuid)', 'execute') = false
         and has_function_privilege('authenticated', 'public.peut_lire_documents_lotissement(uuid)', 'execute'),
         false),
       'anon=' || has_function_privilege('anon', 'public.peut_lire_documents_lotissement(uuid)', 'execute')::text
       || ' / authenticated=' || has_function_privilege('authenticated', 'public.peut_lire_documents_lotissement(uuid)', 'execute')::text;

-- ═══════════════════════════════════════════════════════════════════════════
-- C. La RLS réelle sur `documents` — sous le rôle `authenticated`
--
-- Le prédicat peut être juste et la policy mal câblée. On relit donc la table
-- elle-même, sous chaque identité.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare c record; r record; n int; v_err text;
begin
  select * into c from ctx;
  for r in
    select * from (values
      (25, c.u_chefferie,   c.doc_brignan, 1, 'chefferie lit le plan de SA juridiction'),
      (26, c.u_op_brignan,  c.doc_brignan, 1, 'operateur lit le plan de SON parc'),
      (27, c.u_op_brignan,  c.doc_koelea,  0, 'operateur de Brignan NE lit PAS le plan de Koelea'),
      (28, c.u_attr_koelea, c.doc_koelea,  1, 'attributaire lit le plan de SON lotissement'),
      (29, c.u_attr_koelea, c.doc_brignan, 0, 'attributaire de Koelea NE lit PAS le plan de Brignan'),
      (30, c.u_geometre,    c.doc_brignan, 0, 'geometre ne lit aucun plan de lotissement'),
      (31, c.u_acquereur,   c.doc_brignan, 0, 'acquereur sans attributaire ne lit rien')
    ) t(n, uid, doc, attendu, libelle)
  loop
    v_err := 'aucune';
    perform set_config('request.jwt.claims',
      json_build_object('sub', r.uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      select count(*) into n from public.documents d where d.id = r.doc;
    exception when others then n := -1; v_err := sqlerrm;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    insert into res values (r.n, 'RLS lecture : ' || r.libelle,
      coalesce(n = r.attendu, false),
      'lignes=' || n || ' / attendu=' || r.attendu || ' / erreur=' || v_err);
  end loop;
end $$;

-- anon : le résultat mesuré n'est pas « 0 ligne » mais un REFUS franc, et il ne
-- vient pas de ce chantier. `documents_read` (policy `to public`, antérieure)
-- interroge `attributions`, dont la RLS appelle `lot_ids_operateur()` —
-- fonction sur laquelle `anon` n'a pas EXECUTE. La lecture s'arrête là.
-- Ma policy, elle, vise `to authenticated` : elle ne s'applique pas à `anon`.
-- Les deux issues acceptables sont donc « 0 ligne » et « refus » ; ce qui ne
-- l'est pas, c'est une ligne rendue. Le contrôle nomme la seconde plutôt que de
-- la maquiller en zéro, sinon un futur assouplissement de `documents_read`
-- passerait inaperçu.
do $$
declare c record; n int; v_err text := 'aucune';
begin
  select * into c from ctx;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  begin
    select count(*) into n from public.documents d where d.id in (c.doc_brignan, c.doc_koelea);
  exception when others then n := -1; v_err := sqlerrm;
  end;
  reset role;
  insert into res values (32, 'RLS lecture : anon n''obtient AUCUNE ligne (0 ligne, ou refus explicite)',
                          coalesce(n = 0 or (n = -1 and v_err like '%permission denied%'), false),
                          'lignes=' || n || ' / erreur=' || v_err);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- D. L'ÉCRITURE — le cœur du fichier
--
-- 🔴 CORRIGÉ APRÈS PREMIÈRE EXÉCUTION — le contrôle mesurait la mauvaise chose.
--
-- La première version attendait « 0 ligne, aucune erreur » pour les trois rôles
-- refusés. Les trois sont tombés au rouge avec
-- `new row violates row-level security policy for table "documents"`. Ce
-- n'était PAS la garde qui manquait : c'est PostgreSQL qui ne traite pas les
-- quatre verbes de la même façon.
--   · INSERT sans WITH CHECK permissif  → ERREUR 42501, rien n'est écrit ;
--   · UPDATE / DELETE sans USING        → 0 ligne, AUCUNE erreur (silencieux) ;
--   · SELECT sans USING                 → 0 ligne, AUCUNE erreur.
-- Les contrôles 37 et 38 exhibent le cas silencieux, ici même : `lignes=0 /
-- erreur=aucune`. C'est cette asymétrie qui rend le « pas d'exception donc
-- c'est bon » si trompeur — selon le verbe, il est vrai ou faux.
--
-- La correction ne consiste pas à attendre l'erreur (ce serait se lier à un
-- détail d'implémentation, et une future policy trop large rendrait « 1 ligne,
-- aucune erreur » qui passerait au vert nulle part). Elle consiste à mesurer le
-- SEUL fait qui compte, identique pour les quatre verbes : la ligne existe-t-
-- elle en base après la tentative ? Le comptage se fait après `reset role`,
-- donc en postgres, hors RLS — sinon la policy de lecture masquerait la ligne
-- écrite et un dépôt réussi se lirait comme un dépôt refusé.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare c record; r record; n int; v_err text; v_id uuid; v_present int;
begin
  select * into c from ctx;
  for r in
    select * from (values
      (33, c.u_chefferie,   0, 'chefferie NE PEUT PAS deposer'),
      (34, c.u_op_brignan,  0, 'operateur du parc NE PEUT PAS deposer'),
      (35, c.u_attr_koelea, 0, 'attributaire NE PEUT PAS deposer'),
      (36, c.u_admin,       1, 'CONTRE-CONTROLE : l''admin depose bien')
    ) t(n, uid, attendu, libelle)
  loop
    v_err := 'aucune';
    v_id := ('e2e91a4c-0000-4000-8000-0000000001' || lpad(r.n::text, 2, '0'))::uuid;
    perform set_config('request.jwt.claims',
      json_build_object('sub', r.uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      insert into public.documents (id, type, lotissement_id, titre, url_fichier, nom_fichier, type_mime)
      values (v_id, 'plan_lotissement', c.brignan, 'Tentative e2e',
              'plans-lotissement/' || c.brignan || '/' || v_id || '.pdf', 'tentative.pdf', 'application/pdf');
      get diagnostics n = row_count;
    exception when others then n := -1; v_err := sqlerrm;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);

    -- Le juge de paix : hors RLS, la ligne est-elle là ?
    select count(*) into v_present from public.documents where id = v_id;

    insert into res values (r.n, 'RLS ecriture : ' || r.libelle,
      coalesce(v_present = r.attendu, false),
      'ligne effectivement en base=' || v_present || ' / attendu=' || r.attendu
      || ' / row_count rendu=' || n || ' / erreur=' || v_err);
  end loop;
end $$;

do $$
declare c record; n int; v_err text := 'aucune';
begin
  select * into c from ctx;
  perform set_config('request.jwt.claims',
    json_build_object('sub', c.u_chefferie, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.documents set titre = 'DETOURNE' where id = c.doc_brignan;
    get diagnostics n = row_count;
  exception when others then n := -1; v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  -- `n = 0` ne suffit pas : c'est le titre RÉEL, relu hors RLS, qui dit si
  -- l'écriture a été refusée ou seulement invisible.
  insert into res values (37, 'RLS ecriture : la chefferie LIT le plan mais ne peut pas le MODIFIER',
    coalesce(n = 0
             and (select titre from public.documents where id = c.doc_brignan)
                 = 'Plan de morcellement — controle e2e', false),
    'lignes=' || n || ' / erreur=' || v_err
    || ' / titre actuel=' || coalesce((select titre from public.documents where id = c.doc_brignan), '(supprime)'));
end $$;

do $$
declare c record; n int; v_err text := 'aucune';
begin
  select * into c from ctx;
  perform set_config('request.jwt.claims',
    json_build_object('sub', c.u_op_brignan, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    delete from public.documents where id = c.doc_brignan;
    get diagnostics n = row_count;
  exception when others then n := -1; v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  -- Cas silencieux par excellence : 0 ligne, aucune erreur. Seule la survie de
  -- la ligne, constatée hors RLS, distingue « refusé » de « déjà supprimé ».
  insert into res values (38, 'RLS ecriture : l''operateur ne peut pas SUPPRIMER le plan de son parc',
    coalesce(n = 0 and (select count(*) from public.documents where id = c.doc_brignan) = 1, false),
    'lignes supprimees=' || n || ' / erreur=' || v_err
    || ' / le plan est toujours en base=' || (select count(*) from public.documents where id = c.doc_brignan)::text);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- E. Le fichier dans le bucket privé
-- ═══════════════════════════════════════════════════════════════════════════

insert into res
select 39, 'Storage : depot sous plans-lotissement/ reserve a est_admin()',
       coalesce((select count(*) = 1 from pg_policies
                  where schemaname='storage' and tablename='objects'
                    and policyname='documents_plans_lotissement_insert'
                    and cmd='INSERT'
                    and with_check like '%plans-lotissement%'
                    and with_check like '%est_admin()%'), false),
       coalesce((select with_check from pg_policies
                  where schemaname='storage' and tablename='objects'
                    and policyname='documents_plans_lotissement_insert'), '(absente)');

insert into res
select 40, 'Storage : suppression du fichier reservee a est_admin()',
       coalesce((select count(*) = 1 from pg_policies
                  where schemaname='storage' and tablename='objects'
                    and policyname='documents_plans_lotissement_delete'
                    and cmd='DELETE' and qual like '%est_admin()%'), false),
       coalesce((select qual from pg_policies
                  where schemaname='storage' and tablename='objects'
                    and policyname='documents_plans_lotissement_delete'), '(absente)');

-- La lecture directe du bucket est bornee a l'ADMIN, et a lui seul.
--
-- 🔴 Ce controle exigeait d'abord ZERO policy SELECT, au motif qu'une seconde
-- regle de lecture finit toujours par diverger de la premiere. Il etait vert —
-- et pourtant les 21 objets deposes par les controles e2e restaient dans le
-- bucket : `storage.remove()` fait un LOOKUP avant de detruire, et sans droit
-- de lecture il ne trouve rien, ne supprime rien, et repond « ok ». Un controle
-- peut donc etre vert ET decrire une regle qui casse la fonctionnalite.
--
-- La formulation corrigee est plus exigeante que l'ancienne : il ne suffit plus
-- qu'une policy SELECT existe, il faut qu'AUCUNE ne s'ouvre au-dela de l'admin.
insert into res
select 41, 'Storage : la lecture directe du prefixe est reservee a est_admin() (et exigee par remove())',
       coalesce(
         (select count(*) = 1 from pg_policies
           where schemaname='storage' and tablename='objects'
             and policyname='documents_plans_lotissement_admin_read'
             and cmd='SELECT' and qual like '%est_admin()%')
         -- Aucune AUTRE policy de lecture ne doit viser ce prefixe.
         and (select count(*) = 0 from pg_policies
               where schemaname='storage' and tablename='objects'
                 and cmd in ('SELECT','ALL')
                 and coalesce(qual,'') like '%plans-lotissement%'
                 and policyname <> 'documents_plans_lotissement_admin_read'),
         false),
       coalesce((select string_agg(policyname || '(' || cmd || ')', ', ') from pg_policies
                  where schemaname='storage' and tablename='objects'
                    and cmd in ('SELECT','ALL') and coalesce(qual,'') like '%plans-lotissement%'), '(aucune)');

-- ═══════════════════════════════════════════════════════════════════════════
-- F. /verifier — la clé publique, et ce qu'elle ne doit PAS contenir
-- ═══════════════════════════════════════════════════════════════════════════

-- L'APFC en base porte sur Koelea, où un plan vient d'être déposé (ligne
-- doc_koelea). Le contrôle 42 mesure donc l'état APRÈS dépôt, et le 43
-- l'état APRÈS retrait : la clé doit BOUGER, sinon elle ne lit rien.
insert into res
select 42, '/verifier branche APFC : plan_morcellement_depose = true quand le plan existe',
       coalesce((public.verifier_document('APFC-EBIMPE-2022-001')->>'plan_morcellement_depose')::boolean, false),
       coalesce(public.verifier_document('APFC-EBIMPE-2022-001')->>'plan_morcellement_depose', '(cle absente)');

do $$
declare c record; v text;
begin
  select * into c from ctx;
  delete from public.documents where id = c.doc_koelea;
  v := coalesce(public.verifier_document('APFC-EBIMPE-2022-001')->>'plan_morcellement_depose', '(cle absente)');
  insert into res values (43, '/verifier : la meme cle repasse a false quand le plan est retire (elle LIT, elle ne suppose pas)',
                          coalesce(v = 'false', false), 'rendu=' || v);
  -- remis en place pour la suite
  insert into public.documents (id, type, lotissement_id, titre, url_fichier, nom_fichier, type_mime, taille_octets)
  values (c.doc_koelea, 'plan_lotissement', c.koelea, 'Plan Koelea — controle e2e',
          'plans-lotissement/' || c.koelea || '/' || c.doc_koelea || '.dwg',
          'Koelea-Accor.dwg', 'application/acad', 12582912);
end $$;

insert into res
select 44, '/verifier : la page publique n''expose NI identifiant NI chemin du fichier',
       coalesce(
         public.verifier_document('APFC-EBIMPE-2022-001')::text not like '%plans-lotissement%'
         and public.verifier_document('APFC-EBIMPE-2022-001')::text not like '%e2e91a4c%'
         and public.verifier_document('APFC-EBIMPE-2022-001')::text not like '%url_fichier%',
         false),
       'longueur du jsonb rendu = ' || length(public.verifier_document('APFC-EBIMPE-2022-001')::text)::text;

-- Non-régression des autres branches : seule la branche APFC devait changer.
insert into res
select 45, '/verifier : les autres branches repondent comme avant (cession, inconnue)',
       coalesce(
         public.verifier_document('ATT-CESS-2026-00870')->>'type_document' = 'attestation_cession'
         and public.verifier_document('ATT-CESS-2026-00870') ? 'score_confiance'
         and public.verifier_document('ATT-CESS-2026-00870') ? 'proprietaire_actuel'
         and public.verifier_document('REF-INEXISTANTE-E2E-0000') = '{"type_document": null}'::jsonb
         -- la clé du chantier ne fuit PAS dans les branches lot
         and not (public.verifier_document('ATT-CESS-2026-00870') ? 'plan_morcellement_depose'),
         false),
       'cession=' || coalesce(public.verifier_document('ATT-CESS-2026-00870')->>'type_document','(null)')
       || ' / inconnue=' || public.verifier_document('REF-INEXISTANTE-E2E-0000')::text;

-- La vanne d'émission n'a pas bougé. Déposer un plan ne doit RIEN changer au
-- score ni aux deux fonctions qui en dépendent : le plan est une pièce de
-- référence, pas un des quatre critères dont dépend l'émission.
do $$
declare c record; v_lot uuid; v_score int; v_n1 boolean; v_n2 boolean;
begin
  select * into c from ctx;
  select l.id into v_lot from lots l join ilots i on i.id=l.ilot_id where i.lotissement_id = c.koelea limit 1;
  v_score := public.score_confiance_lot(v_lot);
  v_n1 := public.lot_peut_emettre_attestation_niveau1(v_lot);
  v_n2 := public.lot_peut_emettre_attestation_niveau2(v_lot);
  insert into res values (46,
    'Le score de confiance ignore le plan : 60/100 sur Koelea, niveau1=false, niveau2=false (inchange)',
    coalesce(v_score = 60 and v_n1 = false and v_n2 = false, false),
    'score=' || coalesce(v_score::text,'(null)') || ' niveau1=' || coalesce(v_n1::text,'(null)')
    || ' niveau2=' || coalesce(v_n2::text,'(null)'));
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Nettoyage, vérifié
-- ═══════════════════════════════════════════════════════════════════════════

delete from public.documents where id::text like 'e2e91a4c-%';

insert into res
select 47, 'Nettoyage : `documents` retrouve son compte de depart',
       coalesce((select count(*) from public.documents) = a.nb_documents, false),
       a.nb_documents::text || ' avant / ' || (select count(*) from public.documents)::text || ' apres'
from avant a;

-- Le journal se compte lui-même : plusieurs contrôles sont écrits
-- `insert … select … from <table> where <id>` et n'inscrivent RIEN si la ligne
-- attendue manque. Un contrôle disparu se lirait sinon comme un contrôle réussi.
insert into res
select 48, 'Le journal est complet : les 47 controles precedents sont inscrits',
       coalesce(count(*) = 47, false),
       count(*)::text || ' controle(s) inscrits, manquant(s) : ' ||
       coalesce((select string_agg(g::text, ', ') from generate_series(1,47) g where g not in (select n from res)), 'aucun')
from res;

select n, controle, ok, detail from res order by n;

rollback;
