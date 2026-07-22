-- ============================================================================
--  Conditions de generation des attestations de cession (22/07/2026)
--
--  Etat de depart, releve contre la production :
--
--   * DEUX chemins creent une attestation. Le gratuit (rang 1) passe par un
--     trigger sur `attributions` ; le payant (rang >= 2) n'insere qu'au
--     passage du paiement a `confirme`, dans `traiter_paiement_confirme`.
--   * AUCUNE contrainte d'unicite ne protege la table, et le chemin payant
--     n'a aucun garde-fou applicatif : un paiement qui repasse par `confirme`
--     apres en etre sorti cree une SECONDE attestation, nouvelle reference et
--     nouveau QR, pour le meme lot et le meme acquereur -- les deux se
--     verifieraient « valides ».
--   * RIEN n'exige d'APFC. Brignan Kakodji porte 849 lots et 0 APFC : toutes
--     ses attestations naitraient sans le titre coutumier qui fonde le
--     lotissement.
--
--  Decisions du commanditaire (22/07) :
--   1. l'APFC devient une condition de generation, avec derogation admin tracee ;
--   2. le rattrapage de masse exige une confirmation chiffree au-dela d'un seuil.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Derogation APFC -- portee par le lotissement, comme l'APFC elle-meme
-- ---------------------------------------------------------------------------
-- Pas de booleen : la presence de l'horodatage EST le drapeau, comme pour les
-- colonnes sig_*_le. Un booleen aurait pu contredire son propre motif.

alter table public.lotissements
  add column if not exists derogation_apfc_le    timestamptz,
  add column if not exists derogation_apfc_par   uuid references public.profiles(id),
  add column if not exists derogation_apfc_motif text;

comment on column public.lotissements.derogation_apfc_le is
  'Horodatage de la derogation permettant d''emettre des attestations sans APFC. NULL = pas de derogation.';

-- ---------------------------------------------------------------------------
-- 2. La condition, en un seul endroit
-- ---------------------------------------------------------------------------
-- Ecrite une fois et appelee par les trois chemins : une copie divergente
-- autoriserait silencieusement ce que les autres refusent.

create or replace function public.lot_peut_emettre_attestation(p_lot_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from lots l
    join ilots i on i.id = l.ilot_id
    join lotissements lo on lo.id = i.lotissement_id
    where l.id = p_lot_id
      and (
        lo.derogation_apfc_le is not null
        or exists (select 1 from attestations_coutumieres apfc where apfc.lotissement_id = lo.id)
      )
  );
$$;

comment on function public.lot_peut_emettre_attestation(uuid) is
  'Vrai si le lotissement du lot porte une APFC, ou une derogation admin tracee.';

create or replace function public.accorder_derogation_apfc(p_lotissement_id uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;
  if p_motif is null or length(btrim(p_motif)) < 10 then
    raise exception 'Motif de derogation requis (10 caracteres minimum).';
  end if;
  if exists (select 1 from attestations_coutumieres where lotissement_id = p_lotissement_id) then
    raise exception 'Ce lotissement a deja une APFC : la derogation est sans objet.';
  end if;

  update lotissements
     set derogation_apfc_le    = now(),
         derogation_apfc_par   = auth.uid(),
         derogation_apfc_motif = btrim(p_motif)
   where id = p_lotissement_id;

  if not found then
    raise exception 'Lotissement introuvable : %', p_lotissement_id;
  end if;
end;
$$;

-- Contrairement a la revocation d'une attestation, une derogation n'engage
-- personne au dehors : elle se retire donc, et le retrait est le chemin normal
-- une fois l'APFC saisie.
create or replace function public.retirer_derogation_apfc(p_lotissement_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;

  update lotissements
     set derogation_apfc_le    = null,
         derogation_apfc_par   = null,
         derogation_apfc_motif = null
   where id = p_lotissement_id;

  if not found then
    raise exception 'Lotissement introuvable : %', p_lotissement_id;
  end if;
end;
$$;

revoke all on function public.accorder_derogation_apfc(uuid, text) from public, anon;
revoke all on function public.retirer_derogation_apfc(uuid)       from public, anon;
grant execute on function public.accorder_derogation_apfc(uuid, text) to authenticated;
grant execute on function public.retirer_derogation_apfc(uuid)        to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Unicite -- partielle, pour ne pas condamner la reemission
-- ---------------------------------------------------------------------------
-- La doctrine du 22/07 est qu'une revocation ne se defait pas : on corrige en
-- emettant une NOUVELLE attestation. Un index unique total l'interdirait, en
-- transformant la premiere revocation en impasse definitive pour ce lot et cet
-- acquereur. D'ou l'exclusion des lignes revoquees.

create unique index if not exists attestations_cession_lot_acquereur_uniq
  on public.attestations_cession (lot_id, acquereur_id)
  where statut <> 'revoquee';

-- ---------------------------------------------------------------------------
-- 4. Chemin gratuit (rang 1) : condition APFC, sans exception
-- ---------------------------------------------------------------------------
-- On sort SILENCIEUSEMENT plutot que de lever : cette fonction est appelee
-- depuis un trigger sur `attributions`. Une exception y bloquerait la creation
-- de toute attribution sur un lotissement sans APFC -- donc l'onboarding d'un
-- territoire, l'import d'un guide de repartition et `_appliquer_creation_
-- structure`. Le lot reste visible dans `v_attestations_bloquees_sans_apfc`,
-- et son attestation se creera au rattrapage des que l'APFC existera.

create or replace function public.creer_attestation_gratuite_si_eligible(
  p_lot_id uuid, p_attributaire_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ref text;
  v_apfc_id uuid;
begin
  if exists (
    select 1 from attestations_cession ac
    where ac.lot_id = p_lot_id and ac.acquereur_id = p_attributaire_id
      and ac.statut <> 'revoquee'
  ) then
    return; -- deja generee, on ne duplique pas
  end if;

  if not public.lot_peut_emettre_attestation(p_lot_id) then
    return; -- pas d'APFC ni de derogation : on n'emet pas
  end if;

  -- `order by` explicite : sans lui, un lotissement portant plusieurs APFC
  -- rattachait l'attestation a l'une d'elles au hasard, et le rattachement
  -- pouvait changer d'une execution a l'autre.
  select apfc.id into v_apfc_id
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  join attestations_coutumieres apfc on apfc.lotissement_id = lo.id
  where l.id = p_lot_id
  order by apfc.date_delivrance desc nulls last, apfc.id
  limit 1;

  v_ref := 'ATT-CESS-' || to_char(now(), 'YYYY') || '-' || lpad((nextval('seq_attestation'))::text, 5, '0');

  insert into attestations_cession (reference, cession_id, lot_id, acquereur_id, apfc_id, statut)
  values (v_ref, null, p_lot_id, p_attributaire_id, v_apfc_id, 'generee');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Chemin payant : on bloque AVANT d'encaisser
-- ---------------------------------------------------------------------------
-- Le refus est place dans `creer_cession` et `facturer_attestation_cession`,
-- pas dans `traiter_paiement_confirme` : refuser le document une fois l'argent
-- encaisse laisserait un paiement confirme sans contrepartie, ce qui est pire
-- que le defaut qu'on corrige. En amont, rien n'est encore engage.

create or replace function public.creer_cession(
  p_lot_id uuid,
  p_acquereur_id uuid,
  p_date_cession date DEFAULT CURRENT_DATE,
  p_observation text DEFAULT NULL::text,
  p_moyen moyen_paiement DEFAULT 'especes'::moyen_paiement)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_lotissement   record;
  v_actuelle      record;
  v_rang          int;
  v_tarif         record;
  v_tarif_chef    record;
  v_montant_total numeric;
  v_commission    numeric;
  v_montant_rev   numeric;
  v_cession_id    uuid;
  v_paiement_id   uuid;
  v_statut_paie   statut_paiement;
  v_beneficiaire  text;
begin
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action reservee aux administrateurs et operateurs.';
  end if;

  if p_acquereur_id is null then
    raise exception 'Acquereur requis.';
  end if;

  select lo.id as lotissement_id, lo.operateur_id, lo.autorite_coutumiere_id
    into v_lotissement
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where l.id = p_lot_id;

  if not found then
    raise exception 'Lot introuvable: %', p_lot_id;
  end if;

  if not public.lot_peut_emettre_attestation(p_lot_id) then
    raise exception 'Ce lotissement n''a pas d''APFC : aucune attestation de cession ne peut y etre emise. Saisissez l''APFC, ou demandez une derogation a un administrateur.';
  end if;

  select a.id, a.rang, a.attributaire_id
    into v_actuelle
  from attributions a
  where a.lot_id = p_lot_id and a.actuel = true
  order by a.rang desc
  limit 1;

  if not found then
    raise exception 'Ce lot n''a pas encore de titulaire actuel : impossible de creer une cession.';
  end if;

  if v_actuelle.attributaire_id = p_acquereur_id then
    raise exception 'L''acquereur selectionne est deja le titulaire actuel du lot.';
  end if;

  if exists (select 1 from cessions c where c.lot_id = p_lot_id and c.statut = 'en_cours') then
    raise exception 'Ce lot fait deja l''objet d''une cession en cours.';
  end if;

  v_rang := v_actuelle.rang + 1;

  if v_rang = 2 then
    select montant_min, commission_min into v_tarif
    from tarifs
    where type_demarche = 'delivrance_attestation_cession' and actif = true;

    if not found then
      raise exception 'Tarif de la 2e attestation de cession non configure (table tarifs).';
    end if;

    v_montant_total := v_tarif.montant_min;
    v_commission    := v_tarif.commission_min;
  else
    if v_lotissement.autorite_coutumiere_id is null then
      raise exception 'Ce lotissement n''a pas d''autorite coutumiere associee : impossible de calculer le tarif de la %e attestation.', v_rang;
    end if;

    select montant_chefferie, commission_sgfn into v_tarif_chef
    from tarifs_attestation_chefferie
    where autorite_coutumiere_id = v_lotissement.autorite_coutumiere_id and actif = true;

    if not found then
      raise exception 'Tarif non defini pour cette chefferie (3e attestation et plus) -- contactez l''equipe SGNF pour fixer le tarif.';
    end if;

    v_montant_total := v_tarif_chef.montant_chefferie + v_tarif_chef.commission_sgfn;
    v_commission    := v_tarif_chef.commission_sgfn;
  end if;

  v_montant_rev := v_montant_total - v_commission;

  select nom into v_beneficiaire from attributaires where id = p_acquereur_id;

  insert into cessions (lot_id, acquereur_id, operateur_id, montant_attestation, statut, date_cession, observation)
  values (p_lot_id, p_acquereur_id, v_lotissement.operateur_id, v_montant_total, 'en_cours', coalesce(p_date_cession, current_date), p_observation)
  returning id into v_cession_id;

  update attributions set actuel = false where id = v_actuelle.id;

  insert into attributions (lot_id, attributaire_id, qualite, rang, actuel, operateur_id, depuis, observation)
  values (p_lot_id, p_acquereur_id, 'acquereur', v_rang, true, v_lotissement.operateur_id, coalesce(p_date_cession, current_date), p_observation);

  v_statut_paie := case when p_moyen in ('especes', 'virement') then 'en_attente_validation' else 'en_attente' end;

  -- montant_reverse est une colonne generee (montant_total - commission_sgfn),
  -- ne pas l'inserer explicitement.
  insert into paiements (cession_id, acquereur_id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut)
  values (v_cession_id, p_acquereur_id, 'attestation_cession', v_montant_total, v_commission, v_beneficiaire, p_moyen, v_statut_paie)
  returning id into v_paiement_id;

  return jsonb_build_object(
    'cession_id', v_cession_id,
    'paiement_id', v_paiement_id,
    'rang', v_rang,
    'montant_total', v_montant_total,
    'commission_sgfn', v_commission,
    'montant_reverse', v_montant_rev,
    'statut_paiement', v_statut_paie
  );
end;
$$;

create or replace function public.facturer_attestation_cession(
  p_lot_id uuid,
  p_moyen moyen_paiement DEFAULT 'especes'::moyen_paiement)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_attr_id uuid; v_nom text; v_rang int; v_op uuid; v_ac uuid;
  v_tarif record; v_tchef record; v_montant numeric; v_commission numeric;
  v_cession uuid; v_paie uuid; v_statut statut_paiement;
begin
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action reservee aux administrateurs et operateurs.';
  end if;

  if not public.lot_peut_emettre_attestation(p_lot_id) then
    raise exception 'Ce lotissement n''a pas d''APFC : aucune attestation de cession ne peut y etre emise. Saisissez l''APFC, ou demandez une derogation a un administrateur.';
  end if;

  select a.attributaire_id, att.nom, a.rang into v_attr_id, v_nom, v_rang
  from attributions a join attributaires att on att.id = a.attributaire_id
  where a.lot_id = p_lot_id and a.actuel = true
  order by a.rang desc limit 1;
  if not found then raise exception 'Ce lot n''a pas de titulaire actuel.'; end if;

  if v_rang < 2 then
    raise exception 'La 1re attestation de ce lot est gratuite (deja generee).';
  end if;

  if exists (
    select 1 from attestations_cession
    where lot_id = p_lot_id and acquereur_id = v_attr_id and statut <> 'revoquee'
  ) then
    raise exception 'Une attestation existe deja pour le titulaire actuel de ce lot.';
  end if;

  select lo.operateur_id, lo.autorite_coutumiere_id into v_op, v_ac
  from lots l join ilots i on i.id = l.ilot_id join lotissements lo on lo.id = i.lotissement_id
  where l.id = p_lot_id;

  if v_rang = 2 then
    select montant_min, commission_min into v_tarif
    from tarifs where type_demarche = 'delivrance_attestation_cession' and actif = true;
    if not found then raise exception 'Tarif de la 2e attestation de cession non configure (table tarifs).'; end if;
    v_montant := v_tarif.montant_min; v_commission := v_tarif.commission_min;
  else
    if v_ac is null then
      raise exception 'Ce lotissement n''a pas d''autorite coutumiere : tarif de la %e attestation impossible.', v_rang;
    end if;
    select montant_chefferie, commission_sgfn into v_tchef
    from tarifs_attestation_chefferie where autorite_coutumiere_id = v_ac and actif = true;
    if not found then raise exception 'Tarif non defini pour cette chefferie (3e attestation et plus) -- voir onglet Paiements.'; end if;
    v_montant := v_tchef.montant_chefferie + v_tchef.commission_sgfn; v_commission := v_tchef.commission_sgfn;
  end if;

  insert into cessions (lot_id, acquereur_id, operateur_id, montant_attestation, statut, date_cession, observation)
  values (p_lot_id, v_attr_id, v_op, v_montant, 'en_cours', current_date, 'Attestation de cession (post-vente) -- facturation')
  returning id into v_cession;

  v_statut := case when p_moyen in ('especes', 'virement') then 'en_attente_validation' else 'en_attente' end;

  insert into paiements (cession_id, acquereur_id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut)
  values (v_cession, v_attr_id, 'attestation_cession', v_montant, v_commission, v_nom, p_moyen, v_statut)
  returning id into v_paie;

  return jsonb_build_object('cession_id', v_cession, 'paiement_id', v_paie, 'rang', v_rang,
    'montant_total', v_montant, 'commission_sgfn', v_commission, 'statut_paiement', v_statut);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Anti-doublon sur le chemin payant
-- ---------------------------------------------------------------------------
-- Le garde-fou manquait totalement ici, alors que le chemin gratuit en avait
-- un. L'index unique partiel (bloc 3) leverait desormais une erreur, ce qui
-- ferait echouer la confirmation du paiement : on teste donc explicitement,
-- pour que la confirmation reste idempotente au lieu de casser.

create or replace function public.traiter_paiement_confirme()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare v_ref text; v_total numeric; v_prix numeric;
begin
  if new.statut = 'confirme' and (tg_op='INSERT' or old.statut is distinct from 'confirme') then
    if new.confirme_le is null then new.confirme_le := now(); end if;
    if new.demarche_id is not null then
      update demarches set statut='payee_en_cours' where id=new.demarche_id and statut='en_attente_paiement';
    end if;
    if new.type='attestation_cession' and new.cession_id is not null then
      if not exists (
        select 1
        from attestations_cession ac
        join cessions c on c.id = new.cession_id
        where ac.statut <> 'revoquee'
          and (ac.cession_id = new.cession_id
               or (ac.lot_id = c.lot_id and ac.acquereur_id = c.acquereur_id))
      ) then
        v_ref := 'ATT-CESS-' || to_char(now(),'YYYY') || '-' || lpad((nextval('seq_attestation'))::text,5,'0');
        insert into attestations_cession(reference, cession_id, lot_id, acquereur_id, statut)
        select v_ref, c.id, c.lot_id, c.acquereur_id, 'generee' from cessions c where c.id = new.cession_id;
      end if;
      update cessions set statut = 'solde' where id = new.cession_id and statut <> 'solde';
    end if;
    if new.type='vente_terrain' and new.vente_id is not null then
      if new.echeance_id is not null then
        update echeances set montant_paye = montant_du, statut='payee', paye_le=now() where id=new.echeance_id;
      end if;
      select coalesce(sum(montant_paye),0) into v_total from echeances where vente_id = new.vente_id;
      v_total := v_total + coalesce((
        select sum(p.montant_total) from paiements p
        where p.vente_id = new.vente_id and p.echeance_id is null and p.statut='confirme' and p.id <> new.id
      ), 0);
      if new.echeance_id is null then
        v_total := v_total + new.montant_total;
      end if;
      update ventes set montant_paye = v_total where id = new.vente_id;
      select prix_total into v_prix from ventes where id = new.vente_id;
      if v_total >= v_prix then
        update ventes set statut='soldee' where id = new.vente_id;
        update cessions set statut='solde'
          where id = (select cession_id from ventes where id = new.vente_id);
      end if;
    end if;
  end if;
  return new;
end; $$;

-- ---------------------------------------------------------------------------
-- 7. Les deux files, separees
-- ---------------------------------------------------------------------------
-- Jusqu'ici une seule vue melangeait « generable maintenant » et « bloque par
-- un document manquant ». Les separer rend la cause visible : au 22/07, 381
-- des 400 lots eligibles le sont pour la seule raison que Brignan Kakodji n'a
-- pas d'APFC.

create or replace view public.v_attestations_gratuites_manquantes as
  select a.lot_id, a.attributaire_id, a.depuis
  from attributions a
  where a.qualite = any (array['ayant_droit'::qualite_attribution, 'operateur'::qualite_attribution])
    and a.rang = 1
    and a.actuel = true
    and public.lot_peut_emettre_attestation(a.lot_id)
    and not exists (
      select 1 from attestations_cession ac
      where ac.lot_id = a.lot_id and ac.acquereur_id = a.attributaire_id
        and ac.statut <> 'revoquee'
    );

create or replace view public.v_attestations_bloquees_sans_apfc as
  select a.lot_id, a.attributaire_id, a.depuis, lo.id as lotissement_id, lo.nom as lotissement
  from attributions a
  join lots l on l.id = a.lot_id
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where a.qualite = any (array['ayant_droit'::qualite_attribution, 'operateur'::qualite_attribution])
    and a.rang = 1
    and a.actuel = true
    and not public.lot_peut_emettre_attestation(a.lot_id)
    and not exists (
      select 1 from attestations_cession ac
      where ac.lot_id = a.lot_id and ac.acquereur_id = a.attributaire_id
        and ac.statut <> 'revoquee'
    );

grant select on public.v_attestations_bloquees_sans_apfc to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Rattrapage de masse : confirmation chiffree au-dela du seuil
-- ---------------------------------------------------------------------------
-- La purge du 21/07 a vide la table ; la vue est aussitot repassee a 400, et
-- l'ecran continuait d'offrir un bouton qui aurait regenere les 400 d'un clic
-- -- exactement la regeneration de masse ecartee la veille. Le seuil oblige
-- l'appelant a REPETER le nombre exact : on ne peut plus declencher une
-- operation de cette taille sans l'avoir lue.

create or replace function public.generer_attestations_gratuites_manquantes(
  p_confirmation int default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row record;
  v_count int := 0;
  v_total int;
  v_seuil constant int := 20;
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;

  select count(*) into v_total from public.v_attestations_gratuites_manquantes;

  if v_total > v_seuil and p_confirmation is distinct from v_total then
    raise exception
      '% attestations seraient generees d''un coup (seuil : %). Pour confirmer, rappelez l''operation en indiquant exactement ce nombre.',
      v_total, v_seuil;
  end if;

  for v_row in
    select lot_id, attributaire_id from public.v_attestations_gratuites_manquantes
  loop
    perform public.creer_attestation_gratuite_si_eligible(v_row.lot_id, v_row.attributaire_id);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('generees', v_count, 'eligibles', v_total);
end;
$$;

-- L'ancienne signature sans argument disparait : la laisser en place aurait
-- offert un contournement silencieux du seuil.
drop function if exists public.generer_attestations_gratuites_manquantes();

revoke all on function public.generer_attestations_gratuites_manquantes(int) from public, anon;
grant execute on function public.generer_attestations_gratuites_manquantes(int) to authenticated;
