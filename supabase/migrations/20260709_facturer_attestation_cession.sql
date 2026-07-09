-- Découplage de l'attestation de cession (09/07/2026)
--
-- Dans le nouveau modèle, la propriété bascule à la VENTE (certificat), pas à la
-- cession. L'attestation de cession devient une étape SÉPARÉE, après : on facture le
-- titulaire ACTUEL du lot (celui que la vente vient d'installer) SANS créer de
-- nouvelle attribution. `creer_cession` (qui, lui, transfère la propriété) reste
-- pour la cession manuelle administrative (écran Lots).
--
-- Palier par rang du titulaire actuel : 1 = gratuite (déjà générée), 2 = forfait
-- national (table tarifs), 3+ = tarif chefferie (tarifs_attestation_chefferie).
create or replace function public.facturer_attestation_cession(
  p_lot_id uuid,
  p_moyen  moyen_paiement default 'especes'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_attr_id    uuid;
  v_nom        text;
  v_rang       int;
  v_op         uuid;
  v_ac         uuid;
  v_tarif      record;
  v_tchef      record;
  v_montant    numeric;
  v_commission numeric;
  v_cession    uuid;
  v_paie       uuid;
  v_statut     statut_paiement;
begin
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action réservée aux administrateurs et opérateurs.';
  end if;

  select a.attributaire_id, att.nom, a.rang
    into v_attr_id, v_nom, v_rang
  from attributions a
  join attributaires att on att.id = a.attributaire_id
  where a.lot_id = p_lot_id and a.actuel = true
  order by a.rang desc
  limit 1;
  if not found then
    raise exception 'Ce lot n''a pas de titulaire actuel.';
  end if;

  if v_rang < 2 then
    raise exception 'La 1re attestation de ce lot est gratuite (déjà générée).';
  end if;

  if exists (
    select 1 from attestations_cession
    where lot_id = p_lot_id and acquereur_id = v_attr_id
  ) then
    raise exception 'Une attestation existe déjà pour le titulaire actuel de ce lot.';
  end if;

  select lo.operateur_id, lo.autorite_coutumiere_id
    into v_op, v_ac
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where l.id = p_lot_id;

  if v_rang = 2 then
    select montant_min, commission_min into v_tarif
    from tarifs where type_demarche = 'delivrance_attestation_cession' and actif = true;
    if not found then
      raise exception 'Tarif de la 2e attestation de cession non configuré (table tarifs).';
    end if;
    v_montant := v_tarif.montant_min;
    v_commission := v_tarif.commission_min;
  else
    if v_ac is null then
      raise exception 'Ce lotissement n''a pas d''autorité coutumière : tarif de la %e attestation impossible.', v_rang;
    end if;
    select montant_chefferie, commission_sgfn into v_tchef
    from tarifs_attestation_chefferie where autorite_coutumiere_id = v_ac and actif = true;
    if not found then
      raise exception 'Tarif non défini pour cette chefferie (3e attestation et plus) — voir onglet Paiements.';
    end if;
    v_montant := v_tchef.montant_chefferie + v_tchef.commission_sgfn;
    v_commission := v_tchef.commission_sgfn;
  end if;

  insert into cessions (lot_id, acquereur_id, operateur_id, montant_attestation, statut, date_cession, observation)
  values (p_lot_id, v_attr_id, v_op, v_montant, 'en_cours', current_date, 'Attestation de cession (post-vente) — facturation')
  returning id into v_cession;

  v_statut := case when p_moyen in ('especes', 'virement') then 'en_attente_validation' else 'en_attente' end;

  insert into paiements (cession_id, acquereur_id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut)
  values (v_cession, v_attr_id, 'attestation_cession', v_montant, v_commission, v_nom, p_moyen, v_statut)
  returning id into v_paie;

  return jsonb_build_object(
    'cession_id', v_cession,
    'paiement_id', v_paie,
    'rang', v_rang,
    'montant_total', v_montant,
    'commission_sgfn', v_commission,
    'statut_paiement', v_statut
  );
end;
$function$;

revoke all on function public.facturer_attestation_cession(uuid, moyen_paiement) from public;
grant execute on function public.facturer_attestation_cession(uuid, moyen_paiement) to authenticated;
