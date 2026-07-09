-- Enrichit disponibilites_foncieres() pour le modal « Détails du lot » de l'espace acquéreur :
-- superficie, coordonnées (lot + fallback lotissement), n° de parcelle, nature du droit.
-- SECURITY DEFINER inchangé — les acquéreurs n'ont pas besoin d'accès direct à ilots/lotissements.

create or replace function public.disponibilites_foncieres()
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
    -- Détails du lot
    'superficie_m2', l.superficie_m2,
    'numero_parcelle', l.numero_parcelle,
    'nature_droit', l.nature_droit,
    'lot_latitude', l.latitude,
    'lot_longitude', l.longitude,
    -- Fallback géo au niveau lotissement (le positionnement se fait surtout à ce niveau)
    'lz_latitude', lo.latitude,
    'lz_longitude', lo.longitude,
    'lz_superficie_texte', lo.superficie_texte
  ) order by lo.nom, i.numero, l.numero_lot), '[]'::jsonb)
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  left join op on op.lot_id = l.id
  where l.statut = 'libre'
     or (op.lot_id is not null and l.statut <> 'vendu');
$function$;
