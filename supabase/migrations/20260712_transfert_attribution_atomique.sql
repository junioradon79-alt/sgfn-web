-- ============================================================================
-- Transfert d'attribution atomique
-- ============================================================================
-- Contexte : le bouton « Transférer / Attribuer » (dashboard admin, sections
-- Lots et Attributions) enchaînait côté client UPDATE actuel=false puis INSERT
-- puis UPDATE lots — sans transaction. Un échec à mi-chemin laissait le lot
-- sans titulaire actuel, et le bug historique (operateur_id invalide, erreur
-- jamais vérifiée) a produit des lots à DEUX attributions « actuelles ».
--
-- 1. Réparer les données existantes.
-- 2. Rendre le doublon impossible par construction (index unique partiel).
-- 3. RPC transactionnel transferer_attribution(), point d'entrée unique.
-- ============================================================================

-- 1. Réparation : pour tout lot ayant plusieurs attributions actuelles,
--    ne conserver comme actuelle que celle du rang le plus élevé.
--    (Cas connu au 12/07/2026 : Lot 34 Koelea-Accor revu — rang 1
--    N'CHO KOUTOUAN JULES et rang 2 SHERIFF HAWA tous deux actuels ;
--    le rang 2 est le titulaire légitime.)
update attributions a
set actuel = false
where a.actuel
  and exists (
    select 1 from attributions b
    where b.lot_id = a.lot_id and b.actuel and b.rang > a.rang
  );

-- 2. Défense structurelle : au plus UNE attribution actuelle par lot.
create unique index if not exists attributions_lot_actuel_uniq
  on attributions (lot_id)
  where actuel;

-- 3. RPC transactionnel : remplace les écritures directes des pages
--    /dashboard/lots (modale Transférer) et /dashboard/attributions.
create or replace function public.transferer_attribution(
  p_lot_id uuid,
  p_attributaire_id uuid,
  p_qualite qualite_attribution,
  p_actuel boolean default true,
  p_depuis date default current_date,
  p_observation text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_operateur_id   uuid;
  v_actuelle       record;
  v_rang           int;
  v_attribution_id uuid;
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;

  if p_lot_id is null or p_attributaire_id is null then
    raise exception 'Lot et attributaire requis.';
  end if;

  -- Verrouille le lot pour sérialiser les transferts concurrents.
  select lo.operateur_id into v_operateur_id
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where l.id = p_lot_id
  for update of l;

  if not found then
    raise exception 'Lot introuvable: %', p_lot_id;
  end if;

  if not exists (select 1 from attributaires where id = p_attributaire_id) then
    raise exception 'Attributaire introuvable: %', p_attributaire_id;
  end if;

  select a.id, a.attributaire_id into v_actuelle
  from attributions a
  where a.lot_id = p_lot_id and a.actuel
  order by a.rang desc
  limit 1;

  if p_actuel and found and v_actuelle.attributaire_id = p_attributaire_id then
    raise exception 'Cet attributaire est deja le titulaire actuel du lot.';
  end if;

  if p_actuel and found then
    update attributions set actuel = false where id = v_actuelle.id;
  end if;

  select coalesce(max(rang), 0) + 1 into v_rang
  from attributions where lot_id = p_lot_id;

  insert into attributions (lot_id, attributaire_id, qualite, rang, actuel, operateur_id, depuis, observation)
  values (p_lot_id, p_attributaire_id, p_qualite, v_rang, p_actuel, v_operateur_id, coalesce(p_depuis, current_date), p_observation)
  returning id into v_attribution_id;

  if p_actuel then
    update lots set statut = 'attribue' where id = p_lot_id;
  end if;

  return jsonb_build_object(
    'attribution_id', v_attribution_id,
    'rang', v_rang,
    'actuel', p_actuel
  );
end;
$function$;

revoke all on function public.transferer_attribution(uuid, uuid, qualite_attribution, boolean, date, text) from public;
grant execute on function public.transferer_attribution(uuid, uuid, qualite_attribution, boolean, date, text) to authenticated;
