-- Lot 5b — Signal de demande latente pour le propriétaire terrien.
--
-- « N personnes attendent ce lot » : le propriétaire voit, lot par lot, combien
-- d'acquéreurs le suivent (captage QR) — ce qui transforme la demande latente en
-- déclencheur de mise en vente, juste à côté du bouton « Mettre en vente ».
--
-- La RLS de suivis_parcelle scope chaque utilisateur à SES propres suivis : un
-- propriétaire ne peut donc pas compter les suiveurs de ses lots directement.
-- Cette RPC SECURITY DEFINER renvoie un COMPTE agrégé (jamais l'identité des
-- suiveurs), strictement scopé aux lots que l'appelant détient (mes_lot_ids()).

create or replace function public.suiveurs_de_mes_lots()
  returns table (lot_id uuid, nb_suiveurs integer)
  language sql stable security definer set search_path to 'public'
as $$
  select s.lot_id, count(*)::int
  from suivis_parcelle s
  where s.lot_id in (select public.mes_lot_ids())
  group by s.lot_id;
$$;

revoke execute on function public.suiveurs_de_mes_lots() from public, anon;
grant execute on function public.suiveurs_de_mes_lots() to authenticated;
