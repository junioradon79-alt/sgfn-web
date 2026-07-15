-- Rebranding cosmétique SGFN -> SGNF : uniquement le texte visible (notes tarifaires,
-- message d'erreur). Les identifiants techniques (commission_sgfn, sgfn_call_edge,
-- beneficiaire_type='sgfn') restent inchangés, cf. décision du 15/07 : les renommer
-- exigerait une migration de schéma sur des tables financières/de sécurité en prod,
-- hors périmètre de ce rebranding cosmétique.

update public.tarifs_attestation_chefferie
set notes = replace(notes, 'commission SGFN', 'commission SGNF')
where id = 'bb723037-ed71-41a4-9b2a-9aaefab83e58';

update public.tarifs
set notes = replace(notes, 'commission SGFN', 'commission SGNF')
where id = 'b2b7f009-824f-4043-8796-81527828bab2';

-- Message d'erreur affiché à l'admin/opérateur quand le tarif palier-3 n'est pas
-- configuré pour une chefferie. Reste du corps de la fonction inchangé.
create or replace function public.creer_cession(p_lot_id uuid, p_acquereur_id uuid, p_date_cession date DEFAULT CURRENT_DATE, p_observation text DEFAULT NULL::text, p_moyen moyen_paiement DEFAULT 'especes'::moyen_paiement)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
