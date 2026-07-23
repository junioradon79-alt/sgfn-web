-- ============================================================================
--  Gating Niveau 1 / Niveau 2 (23/07/2026)
--
--  Remplace la regle "score de confiance = 100/100 pour tout" par 2 gates
--  distincts :
--   - Niveau 1 (Attestation de cession) : APFC delivree + Guide de repartition
--     + PV de repartition -- le PV d'identification physique n'est PLUS requis
--     (relachement vs la regle du 22/07 qui exigeait les 4 criteres).
--   - Niveau 2 (Attestation d'Attribution de Lot) : exactement la regle 4
--     criteres/100 d'aujourd'hui (rien ne change ici).
--  La derogation admin (derogation_documents_*) reste l'echappatoire commune
--  aux deux niveaux, inchangee.
--
--  Verification NOMMEE, pas un seuil numerique : apfc=0 + guide=20 +
--  pv_guide=20 + pv_identification=20 = 60 ne doit PAS satisfaire Niveau 1,
--  qui exige specifiquement apfc=40 (delivree) + guide=20 + pv_guide=20.
-- ============================================================================

create or replace function public.lot_peut_emettre_attestation_niveau1(p_lot_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  with s as (select public.calculer_score_confiance(p_lot_id) as j)
  select coalesce(
      (select lo.derogation_documents_le is not null
         from lots l join ilots i on i.id = l.ilot_id join lotissements lo on lo.id = i.lotissement_id
        where l.id = p_lot_id),
      false)
    or (
      (s.j->>'apfc')::int = 40
      and (s.j->>'guide_repartition')::int = 20
      and (s.j->>'pv_guide_repartition')::int = 20
    )
  from s;
$$;

comment on function public.lot_peut_emettre_attestation_niveau1(uuid) is
  'Niveau 1 (Attestation de cession) : APFC delivree + Guide de repartition + PV de repartition, ou derogation admin.';

create or replace function public.lot_peut_emettre_attestation_niveau2(p_lot_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
      (select lo.derogation_documents_le is not null
         from lots l join ilots i on i.id = l.ilot_id join lotissements lo on lo.id = i.lotissement_id
        where l.id = p_lot_id),
      false)
    or coalesce(public.score_confiance_lot(p_lot_id), 0) >= 100;
$$;

comment on function public.lot_peut_emettre_attestation_niveau2(uuid) is
  'Niveau 2 (Attestation d''Attribution de Lot) : score de confiance complet (100/100, incluant le PV d''identification physique), ou derogation admin.';

-- Alias de compatibilite : conserve pour les 2 vues qui l'appellent par ce nom
-- (v_attestations_gratuites_manquantes, v_attestations_bloquees_documents) --
-- aucun appelant TypeScript direct (verifie).
create or replace function public.lot_peut_emettre_attestation(p_lot_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.lot_peut_emettre_attestation_niveau1(p_lot_id);
$$;

comment on function public.lot_peut_emettre_attestation(uuid) is
  'Alias de compatibilite -> lot_peut_emettre_attestation_niveau1(). Utiliser directement niveau1/niveau2 pour tout nouveau code.';

-- manques_documentaires_lot() : n'accuse le PV d'identification physique que
-- pour un refus Niveau 2 (sinon un refus Niveau 1 blamerait a tort un critere
-- qui n'est plus exige a ce niveau).
create or replace function public.manques_documentaires_lot(p_lot_id uuid, p_niveau int default 1)
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $$
  with s as (select public.calculer_score_confiance(p_lot_id) as j)
  select array_remove(array[
    case when (s.j->>'apfc')::int < 40 then
      case when (s.j->>'apfc')::int = 0 then 'APFC absente'
           else 'APFC non delivree' end
    end,
    case when (s.j->>'guide_repartition')::int = 0 then 'guide de repartition' end,
    case when (s.j->>'pv_guide_repartition')::int = 0 then 'PV du guide de repartition' end,
    case when p_niveau = 2 and (s.j->>'pv_identification_physique')::int = 0 then 'PV d''identification physique' end
  ], null)
  from s;
$$;

create or replace function public.message_refus_documentaire(p_lot_id uuid, p_niveau int default 1)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select format(
    'Conditions incompletes (Niveau %s) : %s. Completez le dossier du lotissement, ou demandez une derogation a un administrateur.',
    p_niveau,
    array_to_string(public.manques_documentaires_lot(p_lot_id, p_niveau), ', ')
  );
$$;

-- Les 3 points d'entree de generation Niveau 1 basculent sur le gate niveau1
-- (au lieu de la regle 4-criteres) -- aucun autre changement dans ces
-- fonctions, le tarif/palier reste intact.

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
    return;
  end if;

  if not public.lot_peut_emettre_attestation_niveau1(p_lot_id) then
    return;
  end if;

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

  if not public.lot_peut_emettre_attestation_niveau1(p_lot_id) then
    raise exception '%', public.message_refus_documentaire(p_lot_id, 1);
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

  if not public.lot_peut_emettre_attestation_niveau1(p_lot_id) then
    raise exception '%', public.message_refus_documentaire(p_lot_id, 1);
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

-- Vues des lots bloques/eligibles : suivent desormais niveau1 (au lieu de la
-- regle 4-criteres) -- meme nom, meme forme, le contenu suit automatiquement
-- via lot_peut_emettre_attestation() (alias niveau1).
create or replace view public.v_attestations_gratuites_manquantes as
  select a.lot_id, a.attributaire_id, a.depuis
  from attributions a
  where a.qualite = any (array['ayant_droit'::qualite_attribution, 'operateur'::qualite_attribution])
    and a.rang = 1
    and a.actuel = true
    and public.lot_peut_emettre_attestation_niveau1(a.lot_id)
    and not exists (
      select 1 from attestations_cession ac
      where ac.lot_id = a.lot_id and ac.acquereur_id = a.attributaire_id
        and ac.statut <> 'revoquee'
    );

create or replace view public.v_attestations_bloquees_documents as
  select a.lot_id, a.attributaire_id, a.depuis,
         lo.id as lotissement_id, lo.nom as lotissement,
         public.score_confiance_lot(a.lot_id) as score,
         public.manques_documentaires_lot(a.lot_id, 1) as manques
  from attributions a
  join lots l on l.id = a.lot_id
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where a.qualite = any (array['ayant_droit'::qualite_attribution, 'operateur'::qualite_attribution])
    and a.rang = 1
    and a.actuel = true
    and not public.lot_peut_emettre_attestation_niveau1(a.lot_id)
    and not exists (
      select 1 from attestations_cession ac
      where ac.lot_id = a.lot_id and ac.acquereur_id = a.attributaire_id
        and ac.statut <> 'revoquee'
    );
