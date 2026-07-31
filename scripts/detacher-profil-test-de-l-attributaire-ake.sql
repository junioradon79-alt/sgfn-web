-- ═══════════════════════════════════════════════════════════════════════════
-- S5 — Detacher le PROFIL DE TEST de l'attributaire d'une personne REELLE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 🔴 CE SCRIPT ECRIT EN PRODUCTION. IL N'A PAS ETE EXECUTE.
--    Il est livre pret a jouer, pour decision du proprietaire du projet.
--
--   powershell> .\scripts\supabase-sql.ps1 -SqlFile .\scripts\detacher-profil-test-de-l-attributaire-ake.sql
--
-- ⚠️ SANS `-ReadOnly` : le fichier pilote lui-meme ses transactions, et le
-- commutateur refuse (a juste titre) tout script portant `begin` en debut de
-- ligne. La surete ne vient donc PAS de `-ReadOnly` mais des assertions
-- ci-dessous : toute anomalie leve une exception, qui annule la transaction
-- avant le `commit`. Rien ne s'ecrit a moitie.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LE FAIT, MESURE LE 31/07/2026
--
-- DEUX profils portent le MEME `attributaire_id` :
--
--   6b66b553-8230-4a11-a6c2-935573a49bdd   AKE AMAFIN NICODEME
--                                          (personne physique reelle, CNI CI001855051)
--
--     ← 6155d411-65a3-46a0-a807-9ce2a5233af4  « AKE AMAFIN NICODEME »
--                                              proprietaire_terrien — LEGITIME
--     ← d1c26661-9dab-4c47-8f08-a8d65b6fe5ec  « Compte Test — Proprietaire »
--                                              proprietaire_terrien — COMPTE DE TEST
--
-- Le compte de test lit, par emprunt de role verifie, exactement ce que lit la
-- personne reelle : 13 documents, 12 attestations de cession, ses lots et ses
-- attributions. Ce n'est pas un defaut de RLS — la RLS fait precisement ce
-- qu'on lui demande. C'est un defaut de DONNEE : un compte de demonstration
-- est rattache a l'identite d'un administre.
--
-- ⚠️ Aucune regle de ce lot ne corrige cela : tant que le rattachement existe,
-- toute policy correcte donnera au compte de test les droits de la personne.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CE QUE LE SCRIPT FAIT, ET RIEN D'AUTRE
--
--   UPDATE profiles SET attributaire_id = NULL
--   WHERE id = 'd1c26661-…'   ← LE SEUL profil de test
--
-- Il ne touche NI a l'attributaire `6b66b553-…`, NI au profil de la personne
-- reelle `6155d411-…`, NI a une seule attribution, NI a un seul document.
-- Le compte de test reste actif et connectable ; il devient simplement un
-- proprietaire_terrien sans rattachement, donc sans portefeuille.
--
-- Effet attendu sur le compte de test (a comparer au bloc AVANT du resultat) :
--   lots 13 -> 0, attributions 19 -> 0, documents 14 -> 0, attestations 12 -> 0
--   (chiffres du 31/07 apres-midi ; ils bougent avec la vie du registre)
--
-- REVERSIBILITE : un seul geste, note ici pour qu'il n'ait pas a etre devine.
--   update public.profiles set attributaire_id = '6b66b553-8230-4a11-a6c2-935573a49bdd'
--   where id = 'd1c26661-9dab-4c47-8f08-a8d65b6fe5ec';
--
-- NOTE SUR LE TRIGGER `trg_protect_profile_privileged_columns` : il refuse
-- (42501) toute modification de `attributaire_id` par un non-admin, mais il
-- rend `new` sans controle quand `auth.uid()` est NULL — ce qui est le cas
-- d'un appel par l'API de management. Le script passe donc, sans avoir a
-- desarmer quoi que ce soit.

begin;
drop table if exists s5;
create temp table s5(phase text, sonde text, valeur text) on commit preserve rows;
commit;

-- ═══ 1. MESURE AVANT — par emprunt du role du compte de test ═══════════════
begin;
set transaction read only;
do $$
declare v_temoin text; v_c jsonb;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"d1c26661-9dab-4c47-8f08-a8d65b6fe5ec","role":"authenticated"}', true);

  v_temoin := 'uid=' || coalesce(auth.uid()::text,'(null)')
           || ' grp=' || coalesce(public.mon_groupe()::text,'(null)')
           || ' attr=' || coalesce(public.mon_attributaire_id()::text,'(null)')
           || ' role=' || current_user;

  v_c := jsonb_build_object(
    'lots',                 (select count(*) from lots),
    'attributions',         (select count(*) from attributions),
    'attributaires',        (select count(*) from attributaires),
    'documents',            (select count(*) from documents),
    'attestations_cession', (select count(*) from attestations_cession),
    'attestations_attribution_lot', (select count(*) from attestations_attribution_lot)
  );

  execute 'reset role';
  perform set_config('request.jwt.claims','', true);
  insert into s5 values ('AVANT','_temoin_identite', v_temoin);
  insert into s5 select 'AVANT', k, v from jsonb_each_text(v_c) as e(k,v);
end $$;
commit;

-- ═══ 2. L'ECRITURE, sous assertions ════════════════════════════════════════
begin;
do $$
declare
  v_test_attr  uuid;
  v_test_nom   text;
  v_reel_attr  uuid;
  v_n          integer;
begin
  select attributaire_id, nom_complet into v_test_attr, v_test_nom
  from profiles where id = 'd1c26661-9dab-4c47-8f08-a8d65b6fe5ec';

  select attributaire_id into v_reel_attr
  from profiles where id = '6155d411-65a3-46a0-a807-9ce2a5233af4';

  -- Le profil de test doit exister et etre CELUI qu'on croit.
  if v_test_nom is null then
    raise exception 'Profil de test d1c26661-… introuvable : rien n''est ecrit.';
  end if;
  if v_test_nom not like 'Compte Test%' then
    raise exception 'Le profil d1c26661-… ne s''appelle plus « Compte Test… » mais « % » : arret par precaution.', v_test_nom;
  end if;

  -- Deja detache : on ne fait rien, et on le dit.
  if v_test_attr is null then
    insert into s5 values ('ECRITURE','resultat','DEJA DETACHE — aucune ecriture (attributaire_id etait deja NULL)');
    return;
  end if;

  -- Il doit porter EXACTEMENT l'attributaire partage identifie.
  if v_test_attr <> '6b66b553-8230-4a11-a6c2-935573a49bdd' then
    raise exception 'Le profil de test porte l''attributaire % et non 6b66b553-… : arret, la situation a change depuis la mesure du 31/07.', v_test_attr;
  end if;

  -- Le profil de la personne REELLE doit etre intact AVANT.
  if v_reel_attr is distinct from '6b66b553-8230-4a11-a6c2-935573a49bdd' then
    raise exception 'Le profil de AKE AMAFIN NICODEME (6155d411-…) ne porte plus 6b66b553-… mais % : arret.', v_reel_attr;
  end if;

  update profiles
     set attributaire_id = null
   where id = 'd1c26661-9dab-4c47-8f08-a8d65b6fe5ec'
     and attributaire_id = '6b66b553-8230-4a11-a6c2-935573a49bdd';

  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'L''UPDATE a touche % ligne(s) au lieu d''exactement 1 : transaction annulee.', v_n;
  end if;

  -- La personne REELLE doit etre intacte APRES. Ceinture et bretelles :
  -- c'est la seule chose que ce script ne doit jamais casser.
  select attributaire_id into v_reel_attr
  from profiles where id = '6155d411-65a3-46a0-a807-9ce2a5233af4';
  if v_reel_attr is distinct from '6b66b553-8230-4a11-a6c2-935573a49bdd' then
    raise exception 'APRES l''update, le profil de la personne reelle a bouge (%) : transaction annulee.', v_reel_attr;
  end if;

  -- L'attributaire lui-meme doit exister encore.
  if not exists (select 1 from attributaires where id = '6b66b553-8230-4a11-a6c2-935573a49bdd') then
    raise exception 'L''attributaire 6b66b553-… a disparu : transaction annulee.';
  end if;

  insert into s5 values ('ECRITURE','resultat','OK — 1 ligne mise a jour (profiles.attributaire_id -> NULL sur le seul compte de test)');
end $$;
commit;

-- ═══ 3. MESURE APRES — memes sondes, meme emprunt de role ══════════════════
begin;
set transaction read only;
do $$
declare v_temoin text; v_c jsonb;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"d1c26661-9dab-4c47-8f08-a8d65b6fe5ec","role":"authenticated"}', true);

  v_temoin := 'uid=' || coalesce(auth.uid()::text,'(null)')
           || ' grp=' || coalesce(public.mon_groupe()::text,'(null)')
           || ' attr=' || coalesce(public.mon_attributaire_id()::text,'(null)')
           || ' role=' || current_user;

  v_c := jsonb_build_object(
    'lots',                 (select count(*) from lots),
    'attributions',         (select count(*) from attributions),
    'attributaires',        (select count(*) from attributaires),
    'documents',            (select count(*) from documents),
    'attestations_cession', (select count(*) from attestations_cession),
    'attestations_attribution_lot', (select count(*) from attestations_attribution_lot)
  );

  execute 'reset role';
  perform set_config('request.jwt.claims','', true);
  insert into s5 values ('APRES','_temoin_identite', v_temoin);
  insert into s5 select 'APRES', k, v from jsonb_each_text(v_c) as e(k,v);
end $$;
commit;

-- ═══ 4. TEMOIN POSITIF — la personne reelle n'a rien perdu ═════════════════
begin;
set transaction read only;
do $$
declare v_temoin text; v_c jsonb;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"6155d411-65a3-46a0-a807-9ce2a5233af4","role":"authenticated"}', true);

  v_temoin := 'uid=' || coalesce(auth.uid()::text,'(null)')
           || ' attr=' || coalesce(public.mon_attributaire_id()::text,'(null)')
           || ' role=' || current_user;

  v_c := jsonb_build_object(
    'lots',                 (select count(*) from lots),
    'attributions',         (select count(*) from attributions),
    'documents',            (select count(*) from documents),
    'attestations_cession', (select count(*) from attestations_cession)
  );

  execute 'reset role';
  perform set_config('request.jwt.claims','', true);
  insert into s5 values ('TEMOIN AKE (personne reelle)','_temoin_identite', v_temoin);
  insert into s5 select 'TEMOIN AKE (personne reelle)', k, v from jsonb_each_text(v_c) as e(k,v);
end $$;
commit;

select phase, sonde, valeur from s5
order by case phase when 'AVANT' then 1 when 'ECRITURE' then 2 when 'APRES' then 3 else 4 end, sonde;
