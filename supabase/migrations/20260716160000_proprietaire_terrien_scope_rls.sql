-- Scoping RLS du rôle « propriétaire terrien » à sa famille.
-- Corrige deux fuites : un proprietaire_terrien lisait TOUTES les APFC et TOUS
-- les PV de réunion de famille en base (policies nationales). Ajoute aussi
-- l'accès en lecture aux litiges (+ suivi) de ses propres parcelles, jusqu'ici
-- inexistant (entrée de menu morte).

-- ── Helpers (mêmes conventions que ma_chefferie_id) ───────────────────────────
create or replace function public.ma_famille_id()
  returns uuid language sql stable security definer set search_path to 'public'
as $$ select famille_id from profiles where id = auth.uid(); $$;

create or replace function public.ma_famille_attributaire_id()
  returns uuid language sql stable security definer set search_path to 'public'
as $$
  select f.attributaire_id
  from profiles p join familles f on f.id = p.famille_id
  where p.id = auth.uid();
$$;

-- ── APFC : le PT ne voit que celles de sa famille (retiré du any national) ─────
drop policy if exists apfc_read on public.attestations_coutumieres;
create policy apfc_read on public.attestations_coutumieres
  for select using (
    est_admin()
    or (mon_groupe() = 'chefferie'::groupe_utilisateur and autorite_coutumiere_id = ma_chefferie_id())
    or (mon_groupe() = any (array['proprietaire'::groupe_utilisateur,'operateur'::groupe_utilisateur,'verificateur'::groupe_utilisateur,'geometre'::groupe_utilisateur,'commissaire'::groupe_utilisateur]))
    or (mon_groupe() = 'proprietaire_terrien'::groupe_utilisateur and famille_id = ma_famille_id())
  );

-- ── PV de réunion de famille : le PT ne voit que ceux du collectif de sa famille
drop policy if exists pv_famille_chefferie_read on public.pv_reunions_famille;
create policy pv_famille_chefferie_read on public.pv_reunions_famille
  for select using (est_admin() or mon_groupe() = 'chefferie'::groupe_utilisateur);

drop policy if exists pv_famille_pt_read on public.pv_reunions_famille;
create policy pv_famille_pt_read on public.pv_reunions_famille
  for select using (
    mon_groupe() = 'proprietaire_terrien'::groupe_utilisateur
    and collectif_attributaire_id = ma_famille_attributaire_id()
  );

-- ── Litiges + suivi : le PT voit ceux de ses parcelles (perso + collectif) ─────
drop policy if exists litiges_proprietaire_terrien_read on public.litiges;
create policy litiges_proprietaire_terrien_read on public.litiges
  for select using (
    mon_groupe() = 'proprietaire_terrien'::groupe_utilisateur
    and exists (
      select 1 from attributions a
      where a.lot_id = litiges.lot_id and a.actuel
        and a.attributaire_id in (mon_attributaire_id(), ma_famille_attributaire_id())
    )
  );

drop policy if exists litiges_suivi_pt_read on public.litiges_suivi;
create policy litiges_suivi_pt_read on public.litiges_suivi
  for select using (
    mon_groupe() = 'proprietaire_terrien'::groupe_utilisateur
    and exists (
      select 1 from litiges lg
      join attributions a on a.lot_id = lg.lot_id and a.actuel
      where lg.id = litiges_suivi.litige_id
        and a.attributaire_id in (mon_attributaire_id(), ma_famille_attributaire_id())
    )
  );
