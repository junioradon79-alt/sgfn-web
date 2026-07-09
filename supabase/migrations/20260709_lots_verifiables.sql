-- Espace acquéreur — registre des lots vérifiables.
-- Ne renvoie QUE les lots attribués (attribution active) qui possèdent une
-- attestation de cession : ce sont les seuls que l'acquéreur peut vérifier
-- (consultation payante 60 000 FCFA, sauf 1re attestation gratuite).
-- On expose la référence de la DERNIÈRE attestation (propriétaire actuel) pour
-- construire le lien/QR /verifier?ref=... ; on ne révèle PAS le propriétaire
-- (c'est le verdict payant qui le fait). SECURITY DEFINER : pas besoin d'accès
-- direct de l'acquéreur à ilots/lotissements/attestations.

create or replace function public.lots_verifiables()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with op as (
    select a.lot_id, att.nom as operateur_nom
    from attributions a
    join attributaires att on att.id = a.attributaire_id
    where a.qualite = 'operateur' and a.actuel = true
  ),
  att_cess as (
    -- attestation la plus récente par lot = celle du propriétaire actuel
    select distinct on (ac.lot_id) ac.lot_id, ac.reference, ac.statut, ac.date_emission
    from attestations_cession ac
    order by ac.lot_id, ac.date_emission desc nulls last
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'lot_id', l.id,
    'lotissement_id', lo.id,
    'ilot', i.numero,
    'lot', l.numero_lot,
    'lotissement', lo.nom,
    'village', lo.village,
    'commune', lo.commune,
    'district', lo.district,
    'est_lot_operateur', (op.lot_id is not null),
    'operateur_nom', op.operateur_nom,
    'superficie_m2', l.superficie_m2,
    'numero_parcelle', l.numero_parcelle,
    'nature_droit', l.nature_droit,
    'lot_latitude', l.latitude,
    'lot_longitude', l.longitude,
    'lz_latitude', lo.latitude,
    'lz_longitude', lo.longitude,
    'lz_superficie_texte', lo.superficie_texte,
    'attestation_reference', ac.reference,
    'attestation_statut', ac.statut
  ) order by lo.nom, i.numero, l.numero_lot), '[]'::jsonb)
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  join att_cess ac on ac.lot_id = l.id
  left join op on op.lot_id = l.id
  where exists (select 1 from attributions a where a.lot_id = l.id and a.actuel);
$function$;

grant execute on function public.lots_verifiables() to authenticated;
