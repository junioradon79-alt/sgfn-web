-- Scope du commissaire de justice à SES lotissements (RLS).
--
-- Un commissaire de justice ne supervise que les lotissements dont il a légalisé
-- les PV (lotissements.pv_commissaire_justice_id = son étude, via mon_commissaire_id()).
-- Or plusieurs policies lui accordaient un accès NATIONAL non conditionnel — au
-- point qu'un commissaire même NON rattaché voyait tout le registre : 898 lots,
-- 1352 attributions, 54 attributaires, 409 attestations, 13 PV. On resserre chaque
-- policy à son périmètre, SANS toucher aux autres rôles (opérateur, géomètre,
-- vérificateur, chefferie, propriétaire terrien restent strictement inchangés :
-- seule la clause « commissaire » de chaque policy est réécrite).
--
-- litiges / constats / litiges_suivi étaient déjà scopés par commissaire_id.

-- Ensemble des lots des lotissements légalisés par l'étude du commissaire.
-- SECURITY DEFINER : lit lots/ilots/lotissements sans RLS (évite toute récursion
-- quand la fonction est appelée depuis une policy). Renvoie vide si non rattaché.
create or replace function public.lot_ids_commissaire()
  returns setof uuid
  language sql stable security definer set search_path to 'public'
as $$
  select l.id
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where lo.pv_commissaire_justice_id = mon_commissaire_id();
$$;
revoke execute on function public.lot_ids_commissaire() from public, anon;
grant execute on function public.lot_ids_commissaire() to authenticated;

-- 1) lots — retirer le commissaire de la vue « métier » nationale…
alter policy lots_read_metier on lots
using (
  mon_groupe() = any (array[
    'operateur','operateur_saisie','amenageur','geometre','agent_ia','verificateur'
  ]::groupe_utilisateur[])
);

-- …et le scoper dans lots_read_scope, via le lotissement du lot.
alter policy lots_read_scope on lots
using (
  est_admin()
  or (exists (
    select 1 from ilots i join lotissements lo on lo.id = i.lotissement_id
    where i.id = lots.ilot_id and (
      ((mon_groupe() = 'chefferie') and (lo.autorite_coutumiere_id = ma_chefferie_id()))
      or ((mon_groupe() = 'operateur') and (lo.operateur_id = mon_operateur_id()))
      or ((mon_groupe() = 'proprietaire') and (lo.famille_id = (select profiles.famille_id from profiles where profiles.id = (select auth.uid()))))
      or (mon_groupe() = 'verificateur')
      or ((mon_groupe() = 'commissaire') and (lo.pv_commissaire_justice_id = mon_commissaire_id()))
      or ((mon_groupe() = any (array['chefferie','proprietaire_terrien']::groupe_utilisateur[])) and (lo.famille_id is not null) and (lo.famille_id = (select profiles.famille_id from profiles where profiles.id = (select auth.uid()))))
    )
  ))
  or (exists (
    select 1 from attributions a where a.lot_id = lots.id and a.attributaire_id = mon_attributaire_id() and a.actuel
  ))
);

-- 2) attributions — commissaire scopé aux attributions de ses lots.
alter policy attributions_read on attributions
using (
  est_admin()
  or (attributaire_id = mon_attributaire_id())
  or (mon_groupe() = any (array['chefferie','operateur','operateur_saisie','verificateur']::groupe_utilisateur[]))
  or ((mon_groupe() = 'commissaire') and (lot_id in (select lot_ids_commissaire())))
  or ((mon_groupe() = any (array['proprietaire_terrien','proprietaire','acquereur']::groupe_utilisateur[])) and (lot_id in (select mes_lot_ids())))
);

-- 3) attributaires — commissaire scopé aux titulaires de ses lots.
alter policy attrib_oversight_read on attributaires
using (
  est_admin()
  or (id = mon_attributaire_id())
  or (mon_groupe() = 'verificateur')
  or ((mon_groupe() = 'commissaire') and (id in (
      select a.attributaire_id from attributions a where a.lot_id in (select lot_ids_commissaire())
  )))
);

-- 4) attestations_cession — commissaire scopé aux attestations de ses lots.
alter policy attcess_read on attestations_cession
using (
  est_admin()
  or (acquereur_id = mon_attributaire_id())
  or ((mon_groupe() = 'commissaire') and (lot_id in (select lot_ids_commissaire())))
);

-- 5) dossiers_adu — commissaire scopé par commissaire_id (comme litiges/constats).
alter policy dossiers_read on dossiers_adu
using (
  est_admin()
  or (demandeur_id = mon_attributaire_id())
  or (mon_groupe() = any (array['verificateur','proprietaire_terrien']::groupe_utilisateur[]))
  or ((mon_groupe() = 'commissaire') and (commissaire_id = mon_commissaire_id()))
  or ((mon_groupe() = 'geometre') and (geometre_id = mon_geometre_id()))
  or ((mon_groupe() = 'chefferie') and (exists (
      select 1 from lots l join ilots i on i.id = l.ilot_id join lotissements lo on lo.id = i.lotissement_id
      where l.id = dossiers_adu.lot_id and lo.autorite_coutumiere_id = ma_chefferie_id())))
);

-- 6) pv_reunions_famille — commissaire scopé aux PV touchant ses lots.
alter policy pv_famille_commissaire_read on pv_reunions_famille
using (
  est_admin()
  or ((mon_groupe() = 'commissaire') and (id in (
      select pl.pv_id from pv_reunions_famille_lots pl where pl.lot_id in (select lot_ids_commissaire())
  )))
);

-- 7) pv_reunions_famille_lots — idem, par lot.
alter policy pv_famille_lots_commissaire_read on pv_reunions_famille_lots
using (
  est_admin()
  or ((mon_groupe() = 'commissaire') and (lot_id in (select lot_ids_commissaire())))
);

-- 8) APFC — pas de rattachement direct lotissement→APFC : on retire simplement le
--    commissaire de la lecture nationale (les autres rôles restent inchangés).
alter policy apfc_read on attestations_coutumieres
using (
  est_admin()
  or ((mon_groupe() = 'chefferie') and (autorite_coutumiere_id = ma_chefferie_id()))
  or (mon_groupe() = any (array['proprietaire','operateur','verificateur','geometre']::groupe_utilisateur[]))
  or ((mon_groupe() = 'proprietaire_terrien') and (famille_id = ma_famille_id()))
);
