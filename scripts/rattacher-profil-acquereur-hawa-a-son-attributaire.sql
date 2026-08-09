-- ═══════════════════════════════════════════════════════════════════════════
-- C4 — Rattacher LE SEUL profil acquereur PROUVE a son propre attributaire
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 🔴 CE SCRIPT ECRIT EN PRODUCTION. IL N'A PAS ETE EXECUTE.
--    Il est livre pret a jouer, pour decision du proprietaire du projet.
--
--   powershell> .\scripts\supabase-sql.ps1 -SqlFile .\scripts\rattacher-profil-acquereur-hawa-a-son-attributaire.sql
--
-- ⚠️ SANS `-ReadOnly` : le fichier pilote lui-meme ses transactions, et le
-- commutateur refuse (a juste titre) tout script portant `begin` en debut de
-- ligne. La surete ne vient donc PAS de `-ReadOnly` mais des assertions
-- ci-dessous : toute anomalie leve une exception, qui annule la transaction
-- avant le `commit`. Rien ne s'ecrit a moitie.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POURQUOI CE SCRIPT EXISTE
--
-- Consigne du proprietaire du projet : « Toute attestation generee devra
-- pouvoir etre lisible par les parties concernees (Operateur, Proprietaire,
-- Acquereur, Chefferie...) ». L'acquereur est la SEULE des quatre parties
-- nommees qui ne lit rien aujourd'hui.
--
-- Ce n'est PAS un defaut de policy. `attcess_read` dit deja :
--     est_admin() OR (acquereur_id = mon_attributaire_id()) OR (commissaire scope)
-- Le droit existe. Ce qui manque, c'est la DONNEE : les 4 profils du groupe
-- `acquereur` ont tous `attributaire_id` a NULL, donc `mon_attributaire_id()`
-- rend NULL, donc la comparaison n'est jamais vraie, donc ils lisent 0 ligne
-- sur 106. Mesure du 07/08/2026 par emprunt de role sur cf76592b :
--     uid=cf76592b-… grp=acquereur attr=(null) role=authenticated
--     attestations_cession=0  attributaires=0  attributions=0  lots=0  documents=0
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 🔴 CE QUE CE SCRIPT NE FAIT PAS — ET POURQUOI (le point important)
--
-- Il ne rattache QU'UN SEUL des 4 profils. Les 3 autres restent NON RATTACHES,
-- volontairement. Un rattachement « probable » est un refus :
--
--   • 43c99057-…  « Assonhon »       angevencespro@gmail.com
--   • 3052d084-…  « Aristide Adon »  aristide.adon9@gmail.com
--        Ces deux profils ont ete DELIBEREMENT DETACHES le 23/07/2026. Ils
--        portaient l'attributaire du VENDEUR, recopie depuis l'invitation par
--        handle_new_user() : le compte apparaissait « proprietaire » de 23
--        parcelles qui ne lui appartenaient pas. Le correctif a mis leur
--        `attributaire_id` a NULL et a pose une contrainte fail-closed
--        (`20260723190000_invitation_acquereur_sans_attributaire.sql`) qui
--        INTERDIT desormais `attributaire_id` sur une invitation acquereur.
--        Les rattacher aujourd'hui RECREERAIT exactement ce sinistre.
--        Verifie le 07/08 : aucun attributaire de la base ne porte leur email,
--        leur telephone ni leur nom. Il n'existe aucun candidat.
--
--   • 62ce2e69-…  « Compte Test — Acquereur »  manuel.acquereur@sgfn.ci
--        COMPTE DE TEST. Precedent du 31/07/2026 : le profil d1c26661
--        (« Compte Test — Proprietaire ») partageait l'attributaire d'AKE
--        AMAFIN NICODEME, personne reelle, et lisait ses 14 documents, 12
--        attestations, 13 lots et 19 attributions. Un compte de demonstration
--        ne doit JAMAIS porter l'identite d'un administre. Aucun candidat non
--        plus : sa seule demande d'acquisition est `refusee` et porte
--        `attributaire_id` NULL.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LE FAISCEAU DE PREUVES DU SEUL RATTACHEMENT RETENU (mesure du 07/08/2026)
--
--   profil       cf76592b-7428-4494-a0c0-c913eeb23bfd  « Hawa »
--                hsheriff08@gmail.com   tel +61431957421   groupe acquereur
--   attributaire fc7622ce-309e-4214-b7de-95d4111077e8  « SHERIFF HAWA »
--                personne_physique      tel +61431957421   PASSPORT AUS 6523995
--
--   1. TELEPHONE IDENTIQUE, et UNIQUE dans `attributaires` (1 seule occurrence
--      de +61431957421 dans toute la table). Numero australien : la collision
--      fortuite avec un attributaire ivoirien n'est pas un scenario credible.
--
--   2. LA PREUVE N'EST PAS CIRCULAIRE. Le compte vient de l'inscription
--      publique (captage de leads QR). Verifie dans `src/app/inscription/page.tsx`
--      (l. 70-79) : le formulaire public initialise `telephone` a la chaine
--      vide et ne recoit de l'URL que `?public=1` et `?suivi=<reference>`.
--      AUCUN pre-remplissage depuis l'attestation ni depuis l'attributaire :
--      ce numero a ete SAISI par la personne.
--
--   3. LE DOCUMENT QUI L'A AMENEE LA NOMME. Son `raw_user_meta_data` porte
--      `suivi_reference = "ATT-CESS-2026-00896"`. Cette attestation existe et
--      son `acquereur_id` vaut EXACTEMENT fc7622ce-… : le document qu'elle est
--      venue consulter la designe comme l'acquereur.
--
--   4. ELLE EST L'ATTRIBUTAIRE ACTUEL, pas celui d'un tiers. Chaine du lot
--      42181e78 (« Koelea-Accor revu », lot 34) :
--          rang 1  N'CHO KOUTOUAN JULES (d0c68018-…)  ayant_droit               actuel=false
--          rang 2  SHERIFF HAWA         (fc7622ce-…)  ayant_droit_transmission  actuel=false
--          rang 3  SHERIFF HAWA         (fc7622ce-…)  acquereur                 actuel=TRUE, depuis 2026-07-23
--      `profiles.attributaire_id` signifie « l'attributaire que cette personne
--      EST ». C'est bien le cas ici — a la difference du bug du 23/07, ou le
--      profil recevait l'attributaire du CEDANT.
--
--   5. AUCUN PARTAGE D'IDENTITE. Verifie le 07/08 : aucun profil ne porte
--      fc7622ce-…, et AUCUN `attributaire_id` de la base n'est porte par plus
--      d'un profil (le sinistre du 31/07 est eteint). Le passeport
--      AUS 6523995 n'est porte que par ce seul attributaire.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CE QUE LE RATTACHEMENT OUVRE — MESURE, PAS ESTIME (07/08/2026)
--
--   attestations_cession   0 -> 4   (00870, 00895, 00896 revoquees ; 00902 generee)
--   attributions           0 -> 2   (rangs 2 et 3, les siennes)
--   lots                   0 -> 1   (42181e78, dont elle est l'attributaire actuel)
--   attributaires          0 -> 1   (sa propre fiche)
--   documents              0 -> 7   (7 PDF, TOUS des exemplaires de ses 4 propres
--                                    attestations — aucun document du cedant)
--   cessions / ventes / paiements / certificats_vente / dossiers_adu / demarches
--                          0 -> 0
--
-- ⚠️ Le stock ouvert est ENTIEREMENT le sien. Aucune donnee d'un tiers.
--
-- ⚠️ A SAVOIR TOUT DE MEME : la policy `documents_read` scope par LOT
--    (`a.lot_id = documents.lot_id AND a.actuel AND a.attributaire_id = mon_attributaire_id()`),
--    pas par date. Si un document du cedant etait un jour ajoute sur ce lot,
--    l'acquereur le lirait. Ce n'est pas le cas aujourd'hui (les 7 documents
--    sont ses propres attestations), mais la remarque vaut pour la suite.
--
-- REVERSIBILITE : un seul geste, note ici pour qu'il n'ait pas a etre devine.
--   update public.profiles set attributaire_id = null
--   where id = 'cf76592b-7428-4494-a0c0-c913eeb23bfd';
--
-- NOTE SUR LE TRIGGER `trg_protect_profile_privileged_columns` : il refuse
-- (42501) toute modification de `attributaire_id` par un non-admin, mais il
-- rend `new` sans controle quand `auth.uid()` est NULL — ce qui est le cas
-- d'un appel par l'API de management. Le script passe donc, sans avoir a
-- desarmer quoi que ce soit.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- DRY-RUN DES 13 ASSERTIONS, joue en -ReadOnly le 07/08/2026 : les 13 rendent
-- true. Le script s'executerait donc sans lever, en l'etat de la base ce jour.

begin;
drop table if exists c4;
create temp table c4(phase text, sonde text, valeur text) on commit preserve rows;
commit;

-- ═══ 1. MESURE AVANT — par emprunt du role du profil « Hawa » ══════════════
begin;
set transaction read only;
do $$
declare v_temoin text; v_c jsonb;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims',
    '{"sub":"cf76592b-7428-4494-a0c0-c913eeb23bfd","role":"authenticated"}', true);

  v_temoin := 'uid=' || coalesce(auth.uid()::text,'(null)')
           || ' grp=' || coalesce(public.mon_groupe()::text,'(null)')
           || ' attr=' || coalesce(public.mon_attributaire_id()::text,'(null)')
           || ' role=' || current_user;

  v_c := jsonb_build_object(
    'attestations_cession', (select count(*) from attestations_cession),
    'attributaires',        (select count(*) from attributaires),
    'attributions',         (select count(*) from attributions),
    'lots',                 (select count(*) from lots),
    'documents',            (select count(*) from documents),
    'cessions',             (select count(*) from cessions),
    'ventes',               (select count(*) from ventes)
  );

  execute 'reset role';
  perform set_config('request.jwt.claims','', true);
  insert into c4 values ('AVANT','_temoin_identite', v_temoin);
  insert into c4 select 'AVANT', k, v from jsonb_each_text(v_c) as e(k,v);
end $$;
commit;

-- ═══ 2. L'ECRITURE, sous assertions ════════════════════════════════════════
begin;
do $$
declare
  v_prof_attr   uuid;
  v_prof_nom    text;
  v_prof_grp    text;
  v_prof_tel    text;
  v_att_nom     text;
  v_att_tel     text;
  v_n           integer;
begin
  select attributaire_id, nom_complet, groupe::text, telephone
    into v_prof_attr, v_prof_nom, v_prof_grp, v_prof_tel
  from profiles where id = 'cf76592b-7428-4494-a0c0-c913eeb23bfd';

  select nom, telephone into v_att_nom, v_att_tel
  from attributaires where id = 'fc7622ce-309e-4214-b7de-95d4111077e8';

  -- ── Le profil doit exister et etre CELUI qu'on croit ─────────────────────
  if v_prof_nom is null then
    raise exception 'Profil cf76592b-… introuvable : rien n''est ecrit.';
  end if;
  if v_prof_nom <> 'Hawa' then
    raise exception 'Le profil cf76592b-… ne s''appelle plus « Hawa » mais « % » : arret par precaution.', v_prof_nom;
  end if;
  if v_prof_grp <> 'acquereur' then
    raise exception 'Le profil cf76592b-… n''est plus du groupe acquereur mais « % » : arret.', v_prof_grp;
  end if;

  -- ── Deja rattache : on ne fait rien, et on le dit ────────────────────────
  if v_prof_attr = 'fc7622ce-309e-4214-b7de-95d4111077e8' then
    insert into c4 values ('ECRITURE','resultat','DEJA RATTACHE — aucune ecriture');
    return;
  end if;

  -- ── Il ne doit porter AUCUN autre rattachement ───────────────────────────
  -- Ecraser un attributaire_id existant reviendrait a deplacer une identite
  -- sans l'avoir mesuree. Si ce champ n'est plus NULL, la situation a change
  -- depuis la mesure du 07/08 : on s'arrete et on re-mesure a la main.
  if v_prof_attr is not null then
    raise exception 'Le profil cf76592b-… porte deja l''attributaire % : arret, la situation a change depuis la mesure du 07/08.', v_prof_attr;
  end if;

  -- ── L'attributaire doit exister et etre CELUI qu'on croit ────────────────
  if v_att_nom is null then
    raise exception 'Attributaire fc7622ce-… introuvable : rien n''est ecrit.';
  end if;
  if v_att_nom <> 'SHERIFF HAWA' then
    raise exception 'L''attributaire fc7622ce-… ne s''appelle plus « SHERIFF HAWA » mais « % » : arret.', v_att_nom;
  end if;

  -- ── LA PREUVE CENTRALE : le telephone, identique et unique ───────────────
  if v_prof_tel is null or v_att_tel is null or v_prof_tel <> v_att_tel then
    raise exception 'Le telephone du profil (%) ne coincide plus avec celui de l''attributaire (%) : la preuve du rattachement est tombee, arret.', v_prof_tel, v_att_tel;
  end if;
  if (select count(*) from attributaires where telephone = v_att_tel) <> 1 then
    raise exception 'Le telephone % est desormais porte par plusieurs attributaires : il ne prouve plus rien, arret.', v_att_tel;
  end if;

  -- ── PREUVE 2 : l'attestation consultee la designe comme acquereur ────────
  if not exists (
    select 1 from attestations_cession
    where reference = 'ATT-CESS-2026-00896'
      and acquereur_id = 'fc7622ce-309e-4214-b7de-95d4111077e8'
  ) then
    raise exception 'ATT-CESS-2026-00896 ne designe plus fc7622ce-… comme acquereur : arret.';
  end if;

  -- ── PREUVE 3 : elle est bien l'attributaire ACTUEL d'au moins un lot ─────
  -- C'est ce qui distingue ce cas du bug du 23/07 (ou le profil recevait
  -- l'attributaire du CEDANT, dont il n'etait pas l'attributaire actuel).
  if not exists (
    select 1 from attributions
    where attributaire_id = 'fc7622ce-309e-4214-b7de-95d4111077e8' and actuel
  ) then
    raise exception 'fc7622ce-… n''est l''attributaire ACTUEL d''aucun lot : le rattachement n''est plus justifie, arret.';
  end if;

  -- ── PREUVE 4 : personne d'autre ne porte cet attributaire ────────────────
  -- LE controle du sinistre du 31/07 : deux profils sur une meme identite.
  if (select count(*) from profiles where attributaire_id = 'fc7622ce-309e-4214-b7de-95d4111077e8') <> 0 then
    raise exception 'Un profil porte DEJA l''attributaire fc7622ce-… : rattacher cf76592b-… creerait une identite partagee, arret.';
  end if;

  -- ── L'ECRITURE, et elle seule ────────────────────────────────────────────
  update profiles
     set attributaire_id = 'fc7622ce-309e-4214-b7de-95d4111077e8'
   where id = 'cf76592b-7428-4494-a0c0-c913eeb23bfd'
     and attributaire_id is null;

  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'L''UPDATE a touche % ligne(s) au lieu d''exactement 1 : transaction annulee.', v_n;
  end if;

  -- ── APRES : exactement UN porteur, et zero identite partagee ─────────────
  if (select count(*) from profiles where attributaire_id = 'fc7622ce-309e-4214-b7de-95d4111077e8') <> 1 then
    raise exception 'APRES l''update, fc7622ce-… est porte par un nombre de profils different de 1 : transaction annulee.';
  end if;
  if exists (
    select 1 from profiles where attributaire_id is not null
    group by attributaire_id having count(*) > 1
  ) then
    raise exception 'APRES l''update, un attributaire_id est partage par plusieurs profils : transaction annulee.';
  end if;

  -- ── Les 3 AUTRES profils acquereur ne doivent PAS avoir bouge ────────────
  -- Ils restent volontairement non rattaches (cf. en-tete). Ceinture et
  -- bretelles : c'est la seule chose que ce script ne doit jamais toucher.
  if exists (
    select 1 from profiles
    where id in ('43c99057-827e-4f2f-96d1-5310b8a6799e',
                 '3052d084-84ae-490e-8e8a-35b62df620fa',
                 '62ce2e69-c93a-4555-9b64-4a8cf3d2c3c6')
      and attributaire_id is not null
  ) then
    raise exception 'Un des 3 profils acquereur qui doivent rester NON RATTACHES porte un attributaire : transaction annulee.';
  end if;

  insert into c4 values ('ECRITURE','resultat','OK — 1 ligne mise a jour (profiles.attributaire_id -> fc7622ce-… sur le seul profil prouve)');
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
    '{"sub":"cf76592b-7428-4494-a0c0-c913eeb23bfd","role":"authenticated"}', true);

  v_temoin := 'uid=' || coalesce(auth.uid()::text,'(null)')
           || ' grp=' || coalesce(public.mon_groupe()::text,'(null)')
           || ' attr=' || coalesce(public.mon_attributaire_id()::text,'(null)')
           || ' role=' || current_user;

  v_c := jsonb_build_object(
    'attestations_cession', (select count(*) from attestations_cession),
    'attributaires',        (select count(*) from attributaires),
    'attributions',         (select count(*) from attributions),
    'lots',                 (select count(*) from lots),
    'documents',            (select count(*) from documents),
    'cessions',             (select count(*) from cessions),
    'ventes',               (select count(*) from ventes)
  );

  execute 'reset role';
  perform set_config('request.jwt.claims','', true);
  insert into c4 values ('APRES','_temoin_identite', v_temoin);
  insert into c4 select 'APRES', k, v from jsonb_each_text(v_c) as e(k,v);
end $$;
commit;

-- ═══ 4. TEMOIN NEGATIF — les 3 autres acquereurs lisent toujours ZERO ══════
-- Si l'un d'eux se mettait a lire quelque chose, c'est que le script aurait
-- deborde. On le verifie plutot que de le supposer.
begin;
set transaction read only;
do $$
declare v_id uuid; v_n integer;
begin
  foreach v_id in array array[
    '43c99057-827e-4f2f-96d1-5310b8a6799e'::uuid,
    '3052d084-84ae-490e-8e8a-35b62df620fa'::uuid,
    '62ce2e69-c93a-4555-9b64-4a8cf3d2c3c6'::uuid
  ] loop
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
    select count(*) into v_n from attestations_cession;
    execute 'reset role';
    perform set_config('request.jwt.claims','', true);
    insert into c4 values ('TEMOIN NON RATTACHES', v_id::text || ' attestations_cession', v_n::text);
  end loop;
end $$;
commit;

select phase, sonde, valeur from c4
order by case phase when 'AVANT' then 1 when 'ECRITURE' then 2 when 'APRES' then 3 else 4 end, sonde;
