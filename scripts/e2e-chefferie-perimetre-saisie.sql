-- Perimetre de saisie de la chefferie : les gardes de `soumettre_saisie`,
-- mesurees sur les DEUX comptes reels de production.
--
--   powershell> .\scripts\supabase-sql.ps1 -SqlFile .\scripts\e2e-chefferie-perimetre-saisie.sql
--
-- ⚠️ SANS `-ReadOnly` : le fichier pilote lui-meme ses transactions, et le
-- commutateur refuse (a juste titre) tout script portant `begin` en debut de
-- ligne. La surete vient d'ailleurs, et elle est expliquee ci-dessous.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- COMMENT CE FICHIER MESURE UNE GARDE SANS ECRIRE UNE LIGNE
--
-- Chaque sonde appelle `soumettre_saisie` pour de vrai, dans une transaction
-- `read only`. Deux issues, et deux seulement :
--
--   P0001  la garde a REFUSE  — le `raise exception` de la fonction, son
--          message est celui que verra la chefferie ;
--   25006  la garde a ete FRANCHIE — la fonction est allee jusqu'a l'`insert`
--          dans `soumissions_saisie`, que la transaction read only interdit.
--
-- C'est la seule facon de distinguer « refuse » de « accepte » sans deposer
-- quoi que ce soit dans la file de production. Un `raise` attrape par le
-- gestionnaire d'exception laisse la transaction vivante : les sondes
-- s'enchainent.
--
-- 🔴 UNE TRANSACTION PAR IDENTITE, avec son temoin releve DANS la transaction
-- (`auth.uid()`, `mon_groupe()`, `ma_chefferie_id()`). Une campagne menee en
-- un seul bloc a rendu des chiffres faux trois fois sur ce projet, et elle
-- passe au vert : l'identite reste celle du bloc precedent sans que rien ne le
-- signale. Le journal porte donc le temoin sur CHAQUE ligne.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POURQUOI CES DEUX COMPTES-LA
--
-- La production compte DEUX comptes `groupe=chefferie`, et leurs perimetres
-- sont REELLEMENT disjoints — le lot precedent affirmait le contraire et
-- croyait devoir fabriquer un monde de test :
--
--   A  e7091e37-…  autorite_coutumiere_id = a9c32cda-…  famille = (null)
--   B  0be830c7-…  autorite_coutumiere_id = (null)      famille = 2f980fc3-…
--
--   Brignan Kakodji  8820c6b8-…  autorite a9c32cda-…  famille (null)     849 lots
--   Koelea-Accor     c0e74efc-…  autorite a9c32cda-…  famille 2f980fc3-…  49 lots
--
-- B n'a AUCUNE juridiction. Il ne voit les 49 lots de Koelea que par la
-- branche FAMILLE de `lot_ids_chefferie()`. C'est tout l'objet du
-- resserrement : une chefferie agit sur le territoire dont elle est l'autorite
-- coutumiere, jamais par appartenance familiale (chefferie ≠ chef de famille).
--
-- ⭐ CHAQUE GARDE A SON CAS ACCEPTE. Une garde qui refuserait tout passerait
-- pour un correctif : A doit continuer de franchir la ou il est legitime.

begin;
create temp table res(
  n int, identite text, sonde text, sqlstate text, verdict text, message text
) on commit preserve rows;
commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- IDENTITE A — e7091e37-… : chefferie d'Ebimpe, juridiction a9c32cda-…
-- ═══════════════════════════════════════════════════════════════════════════
begin;
set transaction read only;
do $$
declare
  v_res    jsonb := '[]'::jsonb;
  v_temoin text;
  v_state  text;
  v_msg    text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"e7091e37-28de-4c9c-ac08-d603a0fae567","role":"authenticated"}', true);

  v_temoin := coalesce(auth.uid()::text,'(null)')
           || ' / ' || coalesce(public.mon_groupe()::text,'(null)')
           || ' / chefferie=' || coalesce(public.ma_chefferie_id()::text,'(null)')
           || ' / role=' || current_user;

  -- A2 — corriger un attributaire de Koelea (juridiction a9c32cda). ACCEPTE.
  begin
    perform public.soumettre_saisie('maj_attributaire', null, 'sonde',
      '{"attributaire_id":"1ccef7c4-4c0b-4893-a236-786f43bfecd5","nom":"SONDE","type":"personne_physique"}'::jsonb, null);
    v_state := '00000'; v_msg := '(aucune erreur)';
  exception when others then v_state := sqlstate; v_msg := sqlerrm; end;
  v_res := v_res || jsonb_build_object('n',2,'s','A2 maj_attributaire — attributaire de Koelea (SA juridiction)','c',v_state,'m',v_msg);

  -- A3 — corriger un attributaire de Brignan (meme juridiction). ACCEPTE.
  begin
    perform public.soumettre_saisie('maj_attributaire', null, 'sonde',
      '{"attributaire_id":"0365fa45-79b5-437b-aea5-23c910e7f68c","nom":"SONDE","type":"personne_physique"}'::jsonb, null);
    v_state := '00000'; v_msg := '(aucune erreur)';
  exception when others then v_state := sqlstate; v_msg := sqlerrm; end;
  v_res := v_res || jsonb_build_object('n',3,'s','A3 maj_attributaire — attributaire de Brignan (SA juridiction)','c',v_state,'m',v_msg);

  -- A4 — un attributaire qui ne detient rien chez lui. REFUS attendu.
  begin
    perform public.soumettre_saisie('maj_attributaire', null, 'sonde',
      '{"attributaire_id":"00000000-0000-4000-8000-000000000000","nom":"SONDE","type":"personne_physique"}'::jsonb, null);
    v_state := '00000'; v_msg := '(aucune erreur)';
  exception when others then v_state := sqlstate; v_msg := sqlerrm; end;
  v_res := v_res || jsonb_build_object('n',4,'s','A4 maj_attributaire — attributaire hors de tout lot (REFUS attendu)','c',v_state,'m',v_msg);

  -- A5 — corriger un lot NON gele de sa juridiction. ACCEPTE.
  begin
    perform public.soumettre_saisie('modification_lot', null, 'sonde',
      '{"lot_id":"000f0d5d-ccc5-498b-99e6-056c8470f20d","observation":"sonde"}'::jsonb, null);
    v_state := '00000'; v_msg := '(aucune erreur)';
  exception when others then v_state := sqlstate; v_msg := sqlerrm; end;
  v_res := v_res || jsonb_build_object('n',5,'s','A5 modification_lot — lot NON gele de Koelea','c',v_state,'m',v_msg);

  -- A6 — corriger un lot SOUS GEL JURIDIQUE. Refus attendu A LA SOUMISSION.
  begin
    perform public.soumettre_saisie('modification_lot', null, 'sonde',
      '{"lot_id":"ae8063b2-c903-465a-b4fb-36fb164c9b44","observation":"sonde"}'::jsonb, null);
    v_state := '00000'; v_msg := '(aucune erreur)';
  exception when others then v_state := sqlstate; v_msg := sqlerrm; end;
  v_res := v_res || jsonb_build_object('n',6,'s','A6 modification_lot — lot SOUS GEL (refus attendu des la soumission)','c',v_state,'m',v_msg);

  -- A7 — renumeroter un ilot de sa juridiction. ACCEPTE.
  begin
    perform public.soumettre_saisie('modification_ilot', null, 'sonde',
      '{"ilot_id":"06b3d594-988c-43cc-9474-905d4c763961","numero":"SONDE"}'::jsonb, null);
    v_state := '00000'; v_msg := '(aucune erreur)';
  exception when others then v_state := sqlstate; v_msg := sqlerrm; end;
  v_res := v_res || jsonb_build_object('n',7,'s','A7 modification_ilot — ilot de Koelea','c',v_state,'m',v_msg);

  -- A8 — fiche de lotissement, payload NOMMANT sa cible. ACCEPTE.
  begin
    perform public.soumettre_saisie('modification_lotissement', 'c0e74efc-5dad-4b38-abe9-bd6f70be9464', 'sonde',
      '{"lotissement_id":"c0e74efc-5dad-4b38-abe9-bd6f70be9464","village":"sonde"}'::jsonb, null);
    v_state := '00000'; v_msg := '(aucune erreur)';
  exception when others then v_state := sqlstate; v_msg := sqlerrm; end;
  v_res := v_res || jsonb_build_object('n',8,'s','A8 modification_lotissement — payload avec lotissement_id','c',v_state,'m',v_msg);

  -- A9 — payload SANS lotissement_id : franchissait par repli sur le
  -- parametre, puis echouait a l'approbation. Refus attendu des la soumission.
  begin
    perform public.soumettre_saisie('modification_lotissement', '8820c6b8-8ced-468f-bbcc-b63542d79621', 'sonde',
      '{"village":"sonde"}'::jsonb, null);
    v_state := '00000'; v_msg := '(aucune erreur)';
  exception when others then v_state := sqlstate; v_msg := sqlerrm; end;
  v_res := v_res || jsonb_build_object('n',9,'s','A9 modification_lotissement — payload SANS lotissement_id (refus attendu)','c',v_state,'m',v_msg);

  -- A10 — creer un lotissement : il A une juridiction a lui rattacher. ACCEPTE.
  begin
    perform public.soumettre_saisie('creation_lotissement', null, 'sonde',
      '{"nom":"SONDE"}'::jsonb, null);
    v_state := '00000'; v_msg := '(aucune erreur)';
  exception when others then v_state := sqlstate; v_msg := sqlerrm; end;
  v_res := v_res || jsonb_build_object('n',10,'s','A10 creation_lotissement — chefferie AVEC juridiction','c',v_state,'m',v_msg);

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  insert into res
  select (e->>'n')::int, v_temoin, e->>'s', e->>'c',
         case e->>'c' when '25006' then 'GARDE FRANCHIE'
                      when 'P0001' then 'REFUS DE GARDE'
                      when '00000' then '?! aucune erreur'
                      else 'AUTRE' end,
         e->>'m'
  from jsonb_array_elements(v_res) e;
end $$;
commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- IDENTITE B — 0be830c7-… : AUCUNE juridiction, rattachee a la famille de Koelea
-- ═══════════════════════════════════════════════════════════════════════════
begin;
set transaction read only;
do $$
declare
  v_res    jsonb := '[]'::jsonb;
  v_temoin text;
  v_state  text;
  v_msg    text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"0be830c7-312e-4572-ba37-8df47e6dd092","role":"authenticated"}', true);

  v_temoin := coalesce(auth.uid()::text,'(null)')
           || ' / ' || coalesce(public.mon_groupe()::text,'(null)')
           || ' / chefferie=' || coalesce(public.ma_chefferie_id()::text,'(null)')
           || ' / role=' || current_user;

  -- B20 — LE POINT DE L'ARBITRAGE. Attributaire de Koelea, atteint par la
  -- seule branche FAMILLE. Franchissait ; doit desormais etre refuse.
  begin
    perform public.soumettre_saisie('maj_attributaire', null, 'sonde',
      '{"attributaire_id":"1ccef7c4-4c0b-4893-a236-786f43bfecd5","nom":"SONDE","type":"personne_physique"}'::jsonb, null);
    v_state := '00000'; v_msg := '(aucune erreur)';
  exception when others then v_state := sqlstate; v_msg := sqlerrm; end;
  v_res := v_res || jsonb_build_object('n',20,'s','B20 maj_attributaire — attributaire atteint par la seule branche FAMILLE','c',v_state,'m',v_msg);

  -- B21 a B23 — les trois autres types, deja refuses avant ce lot.
  begin
    perform public.soumettre_saisie('modification_lot', null, 'sonde',
      '{"lot_id":"000f0d5d-ccc5-498b-99e6-056c8470f20d","observation":"sonde"}'::jsonb, null);
    v_state := '00000'; v_msg := '(aucune erreur)';
  exception when others then v_state := sqlstate; v_msg := sqlerrm; end;
  v_res := v_res || jsonb_build_object('n',21,'s','B21 modification_lot — meme lotissement, par la branche famille','c',v_state,'m',v_msg);

  begin
    perform public.soumettre_saisie('modification_ilot', null, 'sonde',
      '{"ilot_id":"06b3d594-988c-43cc-9474-905d4c763961","numero":"SONDE"}'::jsonb, null);
    v_state := '00000'; v_msg := '(aucune erreur)';
  exception when others then v_state := sqlstate; v_msg := sqlerrm; end;
  v_res := v_res || jsonb_build_object('n',22,'s','B22 modification_ilot — meme lotissement','c',v_state,'m',v_msg);

  begin
    perform public.soumettre_saisie('modification_lotissement', 'c0e74efc-5dad-4b38-abe9-bd6f70be9464', 'sonde',
      '{"lotissement_id":"c0e74efc-5dad-4b38-abe9-bd6f70be9464","village":"sonde"}'::jsonb, null);
    v_state := '00000'; v_msg := '(aucune erreur)';
  exception when others then v_state := sqlstate; v_msg := sqlerrm; end;
  v_res := v_res || jsonb_build_object('n',23,'s','B23 modification_lotissement — meme lotissement','c',v_state,'m',v_msg);

  -- B24 — DEFAUT PREEXISTANT : creer un lotissement sans juridiction a lui
  -- rattacher. `autorite_coutumiere_id` NULL serait injecte a l'approbation.
  begin
    perform public.soumettre_saisie('creation_lotissement', null, 'sonde',
      '{"nom":"SONDE"}'::jsonb, null);
    v_state := '00000'; v_msg := '(aucune erreur)';
  exception when others then v_state := sqlstate; v_msg := sqlerrm; end;
  v_res := v_res || jsonb_build_object('n',24,'s','B24 creation_lotissement — chefferie SANS juridiction (refus attendu)','c',v_state,'m',v_msg);

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  insert into res
  select (e->>'n')::int, v_temoin, e->>'s', e->>'c',
         case e->>'c' when '25006' then 'GARDE FRANCHIE'
                      when 'P0001' then 'REFUS DE GARDE'
                      when '00000' then '?! aucune erreur'
                      else 'AUTRE' end,
         e->>'m'
  from jsonb_array_elements(v_res) e;
end $$;
commit;

select n, identite, sonde, sqlstate, verdict, message from res order by n;
