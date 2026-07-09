-- Demandes d'acquisition — clôture du tunnel : paiement + attestation (09/07/2026)
--
-- Toute la chaîne aval est déjà en triggers : à la confirmation du paiement
-- (paiements.statut = 'confirme'), traiter_paiement_confirme() crée l'attestation
-- de cession, qui déclenche à son tour la génération du QR (trg_qr_token) et du
-- document PDF (trg_gen_attcess → sgfn_call_edge). Il manquait deux maillons :
--   1) lier l'ACQUÉREUR (profil) à son attributaire, pour qu'il retrouve son
--      attestation dans « Mon espace » / « Documents » (RLS via mon_attributaire_id) ;
--   2) une action agence pour ENCAISSER (validation guichet) qui confirme le
--      paiement et renvoie la référence d'attestation générée.

-- 1. Conversion : réutilise l'attributaire déjà lié au profil du demandeur, sinon
--    le crée ET le rattache au profil (profiles.attributaire_id). Ainsi l'acquéreur
--    devient un propriétaire vérifiable qui voit son attestation dans ses espaces.
create or replace function public.convertir_demande_en_cession(
  p_demande_id  uuid,
  p_date_cession date default current_date,
  p_moyen        moyen_paiement default 'especes'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dem          record;
  v_attr_id      uuid;
  v_profile_attr uuid;
  v_res          jsonb;
begin
  select * into v_dem from demandes_acquisition where id = p_demande_id;
  if not found then
    raise exception 'Demande introuvable.';
  end if;
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action réservée aux administrateurs et opérateurs.';
  end if;
  if v_dem.statut = 'convertie' then
    raise exception 'Cette demande a déjà été convertie en cession.';
  end if;
  if v_dem.statut in ('refusee','annulee') then
    raise exception 'Impossible de convertir une demande refusée ou annulée.';
  end if;

  -- attributaire du demandeur : réutiliser si déjà présent, sinon créer + lier
  select attributaire_id into v_profile_attr from profiles where id = v_dem.demandeur_profile_id;
  if v_profile_attr is not null then
    v_attr_id := v_profile_attr;
    update attributaires
      set telephone = coalesce(telephone, v_dem.acquereur_telephone)
      where id = v_attr_id;
  else
    insert into attributaires (nom, type, telephone, cree_par)
    values (v_dem.acquereur_nom, 'personne_physique', v_dem.acquereur_telephone, auth.uid())
    returning id into v_attr_id;
    update profiles set attributaire_id = v_attr_id
      where id = v_dem.demandeur_profile_id and attributaire_id is null;
  end if;

  v_res := public.creer_cession(
    v_dem.lot_id,
    v_attr_id,
    coalesce(p_date_cession, current_date),
    'Cession issue de la demande d''acquisition ' || p_demande_id::text,
    p_moyen
  );

  update demandes_acquisition
  set statut = 'convertie',
      attributaire_id = v_attr_id,
      cession_id = (v_res->>'cession_id')::uuid,
      traite_par = auth.uid(),
      maj_le = now()
  where id = p_demande_id;

  return v_res || jsonb_build_object('demande_id', p_demande_id, 'attributaire_id', v_attr_id);
end;
$function$;

-- 2. Encaissement (validation guichet) : confirme le paiement de l'attestation de
--    la cession issue de la demande. La confirmation déclenche, via les triggers
--    existants, la génération de l'attestation (+ QR + PDF + quittance). Renvoie la
--    référence de l'attestation produite.
create or replace function public.encaisser_demande_acquisition(
  p_demande_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dem   record;
  v_paie  record;
  v_att   record;
begin
  select * into v_dem from demandes_acquisition where id = p_demande_id;
  if not found then
    raise exception 'Demande introuvable.';
  end if;
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action réservée aux administrateurs et opérateurs.';
  end if;
  if v_dem.cession_id is null then
    raise exception 'Cette demande n''a pas encore été convertie en cession.';
  end if;

  select id, statut, montant_total into v_paie
  from paiements
  where cession_id = v_dem.cession_id and type = 'attestation_cession'
  order by cree_le desc
  limit 1;
  if not found then
    raise exception 'Aucun paiement d''attestation rattaché à cette cession.';
  end if;

  if v_paie.statut <> 'confirme' then
    -- confirmation guichet → traiter_paiement_confirme() génère l'attestation
    update paiements
    set statut = 'confirme', valide_par = auth.uid(), valide_le = now()
    where id = v_paie.id;
  end if;

  -- l'attestation vient d'être créée (trigger synchrone) : on lit sa référence
  select reference, qr_token, statut::text as statut into v_att
  from attestations_cession
  where cession_id = v_dem.cession_id
  order by cree_le desc
  limit 1;

  return jsonb_build_object(
    'paiement_id', v_paie.id,
    'montant', v_paie.montant_total,
    'deja_paye', (v_paie.statut = 'confirme'),
    'attestation_reference', v_att.reference,
    'attestation_qr_token', v_att.qr_token,
    'attestation_statut', v_att.statut
  );
end;
$function$;

revoke all on function public.encaisser_demande_acquisition(uuid) from public;
grant execute on function public.encaisser_demande_acquisition(uuid) to authenticated;

-- 3. Vue agence enrichie : statut de paiement + référence/QR d'attestation.
create or replace view public.demandes_acquisition_agence
with (security_invoker = true) as
  select
    d.*,
    l.numero_lot,
    i.numero      as ilot_numero,
    lo.nom        as lotissement,
    lo.village,
    lo.commune,
    pr.nom_complet as demandeur_nom_complet,
    pa.statut      as paiement_statut,
    pa.montant_total as paiement_montant,
    ac.reference   as attestation_reference,
    ac.qr_token    as attestation_qr_token
  from demandes_acquisition d
  join lots l on l.id = d.lot_id
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  left join profiles pr on pr.id = d.demandeur_profile_id
  left join lateral (
    select statut, montant_total
    from paiements
    where cession_id = d.cession_id and type = 'attestation_cession'
    order by cree_le desc limit 1
  ) pa on true
  left join lateral (
    select reference, qr_token
    from attestations_cession
    where cession_id = d.cession_id
    order by cree_le desc limit 1
  ) ac on true;

grant select on public.demandes_acquisition_agence to authenticated;
