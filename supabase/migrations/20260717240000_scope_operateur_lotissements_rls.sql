-- Scope de l'opérateur à SES lotissements (RLS) — même principe que le commissaire.
--
-- L'opérateur (aménageur-lotisseur) ne gère que les lotissements qui lui sont
-- rattachés (lotissements.operateur_id = son étude, via mon_operateur_id()). Or
-- il disposait d'un accès NATIONAL au registre via les policies « métier »
-- (lots_read_metier, attributaires_read_metier, attributions_read), qui
-- court-circuitaient le scope par operateur_id déjà présent dans lots_read_scope.
-- On resserre chaque policy à son périmètre, SANS toucher aux autres rôles
-- (operateur_saisie, geometre, agent_ia, verificateur, chefferie inchangés).
--
-- NB : lotissements/ilots restent en lecture large (policies `qual = true`,
-- métadonnées conteneur exposées au marketplace public) — sujet distinct.

-- Ensemble des lots des lotissements rattachés à l'étude de l'opérateur.
create or replace function public.lot_ids_operateur()
  returns setof uuid
  language sql stable security definer set search_path to 'public'
as $$
  select l.id
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where lo.operateur_id = mon_operateur_id();
$$;
revoke execute on function public.lot_ids_operateur() from public, anon;
grant execute on function public.lot_ids_operateur() to authenticated;

-- 1) lots — retirer l'opérateur de la vue « métier » nationale (le scope par
--    operateur_id existe déjà dans lots_read_scope).
alter policy lots_read_metier on lots
using (
  mon_groupe() = any (array['operateur_saisie','geometre','agent_ia','verificateur']::groupe_utilisateur[])
);

-- 2) attributions — opérateur scopé aux attributions de ses lots.
alter policy attributions_read on attributions
using (
  est_admin()
  or (attributaire_id = mon_attributaire_id())
  or (mon_groupe() = any (array['chefferie','operateur_saisie','verificateur']::groupe_utilisateur[]))
  or ((mon_groupe() = 'operateur') and (lot_id in (select lot_ids_operateur())))
  or ((mon_groupe() = 'commissaire') and (lot_id in (select lot_ids_commissaire())))
  or ((mon_groupe() = any (array['proprietaire_terrien','proprietaire','acquereur']::groupe_utilisateur[])) and (lot_id in (select mes_lot_ids())))
);

-- 3) attributaires — opérateur scopé aux titulaires de ses lots.
alter policy attributaires_read_metier on attributaires
using (
  (mon_groupe() = any (array['operateur_saisie','geometre','agent_ia','chefferie']::groupe_utilisateur[]))
  or ((mon_groupe() = 'operateur') and (id in (
      select a.attributaire_id from attributions a where a.lot_id in (select lot_ids_operateur())
  )))
);
